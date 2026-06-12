'''
Purpose : SLA (Service Level Agreement) Engine for the Expense Management system.
          Tracks approval and query-response deadlines, sends reminder notifications,
          and auto-rejects reimbursements that breach their SLA deadline.

Inputs  : Called from the APScheduler job (hourly) and from state-machine hooks.

Output  : Mutates reimbursements + notifications collections; emits log entries.

Dependencies: config.mongodb_config, controllers.NotificationService,
              utils.business_day_utils, env_config
'''

import logging
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from config.mongodb_config import get_collection
from env_config import objSettings
from utils.business_day_utils import getBusinessDayDelta
# from services.notificationLibService import objNotifService
from utils.email_service import sendEmail

objLogger = logging.getLogger(__name__)

# SLA event types
_REVIEW_PENDING         = "REVIEW_PENDING"          # reviewer must act
_QUERY_RESPONSE_PENDING = "QUERY_RESPONSE_PENDING"  # initiator must respond


# ── Public helpers called by state machine / submit route ──────────────────────

def createSLAEvent(
    strReimbursementId: str,
    strEventType: str,
    strReviewerId: Optional[str] = None,
    iDays: Optional[int] = None,
) -> None:
    """
    Purpose : Create (or replace) an active SLA deadline event for a reimbursement.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) strEventType       : _REVIEW_PENDING or _QUERY_RESPONSE_PENDING
                (3) strReviewerId      : Current reviewer user_id (optional, for context)
                (4) iDays              : Override deadline days (uses env defaults if None)

    Output  : None (inserts/upserts into sla_events collection)
    """
    try:
        iSLADays = iDays or (
            objSettings.SLA_APPROVAL_DAYS
            if strEventType == _REVIEW_PENDING
            else objSettings.SLA_QUERY_RESPONSE_DAYS
        )
        dtNow = datetime.now(timezone.utc)
        dtDue = getBusinessDayDelta(dtNow, iSLADays)

        objSLA = get_collection("sla_events")
        # Resolve any existing open event for the same reimbursement+type, then insert fresh
        objSLA.update_many(
            {"reimbursement_id": strReimbursementId, "event_type": strEventType, "is_resolved": False},
            {"$set": {"is_resolved": True, "resolved_at": dtNow.isoformat(), "resolve_reason": "superseded"}},
        )
        objSLA.insert_one({
            "reimbursement_id": strReimbursementId,
            "event_type": strEventType,
            "reviewer_id": strReviewerId,
            "due_at": dtDue.isoformat(),
            "is_resolved": False,
            "reminder_sent": False,
            "created_at": dtNow.isoformat(),
        })
        objLogger.info(f"📅 SLA EVENT CREATED | {strReimbursementId} | {strEventType} | due={dtDue.date()}")
    except Exception as objErr:
        objLogger.error(f"❌ createSLAEvent ERROR: {objErr}")


def resolveSLAEvents(strReimbursementId: str, strReason: str = "completed") -> None:
    """
    Purpose : Mark all open SLA events for a reimbursement as resolved.
              Called when a reimbursement reaches a terminal or action state.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) strReason          : Human-readable resolution reason

    Output  : None
    """
    try:
        objSLA = get_collection("sla_events")
        dtNow = datetime.now(timezone.utc)
        objSLA.update_many(
            {"reimbursement_id": strReimbursementId, "is_resolved": False},
            {"$set": {"is_resolved": True, "resolved_at": dtNow.isoformat(), "resolve_reason": strReason}},
        )
        objLogger.info(f"✅ SLA RESOLVED | {strReimbursementId} | reason={strReason}")
    except Exception as objErr:
        objLogger.error(f"❌ resolveSLAEvents ERROR: {objErr}")


# ── Scheduler job ──────────────────────────────────────────────────────────────
async def runSLACheck() -> dict:
    """
    Purpose : Hourly scheduler job. Scans unresolved SLA events and:
              1. Sends a 1-day-remaining reminder notification (once).
              2. Auto-rejects overdue REVIEW_PENDING reimbursements.
              3. Auto-rejects overdue QUERY_RESPONSE_PENDING reimbursements.

    Inputs  : None

    Output  : Summary dict { reminders_sent, auto_rejected, errors }
    """
    from controllers.NotificationService import _insertOne  # local import avoids circular

    objLogger.info("⏰ SLA CHECK START")
    iReminders = 0
    iRejected = 0
    iErrors = 0

    try:
        objSLA = get_collection("sla_events")
        objReimbs = get_collection("reimbursements")
        objLogs = get_collection("reimbursement_logs")
        dtNow = datetime.now(timezone.utc)
        dtNowIso = dtNow.isoformat()

        lsOpen = list(objSLA.find({"is_resolved": False}))

        for dictEvent in lsOpen:
            try:
                strReimbId = dictEvent["reimbursement_id"]
                strEventType = dictEvent["event_type"]
                strDueAt = dictEvent.get("due_at", "")

                # Parse due_at
                dtDue = datetime.fromisoformat(strDueAt.replace("Z", "+00:00")) if strDueAt else None
                if not dtDue:
                    continue

                # Fetch live reimbursement
                dictReimb = objReimbs.find_one({"_id": ObjectId(strReimbId)})
                if not dictReimb:
                    objSLA.update_one({"_id": dictEvent["_id"]}, {"$set": {"is_resolved": True, "resolve_reason": "not_found"}})
                    continue

                strStatus = dictReimb.get("status", "")
                # Skip if already terminal
                if strStatus in ("CLOSED", "REJECTED", "AUTO_REJECTED", "PAID", "PAYMENT_ACKNOWLEDGED"):
                    objSLA.update_one({"_id": dictEvent["_id"]}, {"$set": {"is_resolved": True, "resolve_reason": "terminal_status"}})
                    continue

                strInitiatorId = str(dictReimb.get("initiator_id", ""))
                strInitiatorName = dictReimb.get("initiator_name", "User")
                strCurrentReviewerId = str(dictReimb.get("current_reviewer_id", ""))

                dtDiff = (dtDue - dtNow).total_seconds()

                # ── Overdue: auto-reject ───────────────────────────────────────
                if dtDiff <= 0:
                    # objReimbs.update_one(
                    #     {"_id": ObjectId(strReimbId)},
                    #     {"$set": {"status": "AUTO_REJECTED", "updated_at": dtNowIso,
                    #               "auto_rejected_at": dtNowIso, "auto_reject_reason": f"SLA breach: {strEventType}"}},
                    # )
                    # objLogs.insert_one({
                    #     "reimbursement_id": strReimbId, "action": "AUTO_REJECTED",
                    #     "action_by": "system", "message": f"SLA breach: {strEventType} deadline passed.",
                    #     "visibility": "public", "created_at": dtNowIso,
                    # })
                    
                    # Notify initiator
                    objUsers = get_collection("users")
                    dictInitiator = objUsers.find_one({"_id": ObjectId(strInitiatorId)}, {"email": 1})
                    dictReviewer = objUsers.find_one({"_id": ObjectId(strCurrentReviewerId)}, {"email": 1, "name": 1}) if strCurrentReviewerId else None
                    await sendEmail(
                        strToEmail=dictInitiator.get("email", ""),
                        strSubject="Your reimbursement is due to SLA breach",
                        strBody=f"Dear {strInitiatorName},\n\nYour reimbursement (ref: {strReimbId[:8]}) was due to SLA breach because the {strEventType} SLA deadline was missed.\n\nPlease contact your administrator for details.\n\nBest,\nExpense Management System"
                    )
                    _insertOne(strInitiatorId, "AUTO_REJECTED", "Reimbursement auto-rejected",
                               f"Your reimbursement was auto-rejected because the {strEventType} SLA deadline was missed.",
                               strReimbId)
                    
                    # Notify reviewer if applicable
                    if strCurrentReviewerId and strCurrentReviewerId != strInitiatorId:
                        await sendEmail(
                            strToEmail=dictReviewer.get("email", ""),
                            strSubject="SLA breach — reimbursement auto-rejected",
                            strBody=f"Dear {dictReviewer.get('name', 'User')},\n\n{strInitiatorName}'s reimbursement was auto-rejected due to SLA timeout.\n\nBest,\nExpense Management System"
                        )
                        _insertOne(strCurrentReviewerId, "INFO", "SLA breach — reimbursement auto-rejected",
                                   f"{strInitiatorName}'s reimbursement was auto-rejected because the {strEventType} SLA deadline was missed.",
                                   strReimbId)
                    objSLA.update_one({"_id": dictEvent["_id"]}, {"$set": {"reminder_sent": True}})
                    iRejected += 1
                    objLogger.warning(f"🚨 AUTO-REJECTED {strReimbId} (SLA breach: {strEventType})")

                # ── Reminder: 0–24 h left ──────────────────────────────────────
                elif dtDiff <= 86400 and not dictEvent.get("reminder_sent", False):
                    iHoursLeft = max(1, int(dtDiff / 3600))
                    if strEventType == _REVIEW_PENDING:
                        _insertOne(strCurrentReviewerId, "SLA_REMINDER",
                                   "Urgent: Approval deadline approaching",
                                   f"{strInitiatorName}'s reimbursement requires your action within ~{iHoursLeft}h or it will be auto-rejected.",
                                   strReimbId)
                    else:
                        _insertOne(strInitiatorId, "SLA_REMINDER",
                                   "Urgent: Query response deadline approaching",
                                   f"You must respond to the query on your reimbursement within ~{iHoursLeft}h or it will be auto-rejected.",
                                   strReimbId)
                    objSLA.update_one({"_id": dictEvent["_id"]}, {"$set": {"reminder_sent": True}})
                    iReminders += 1
                    objLogger.info(f"🔔 SLA REMINDER SENT for {strReimbId} ({iHoursLeft}h left)")

            except Exception as objItemErr:
                objLogger.error(f"❌ SLA item error ({dictEvent.get('reimbursement_id')}): {objItemErr}")
                iErrors += 1

    except Exception as objErr:
        objLogger.error(f"❌ SLA CHECK FATAL: {objErr}")
        iErrors += 1

    summary = {"reminders_sent": iReminders, "auto_rejected": iRejected, "errors": iErrors}
    objLogger.info(f"⏰ SLA CHECK DONE | {summary}")
    return summary
