'''
Purpose : Enhanced notification service with HTML templates and SSE support.
          Creates rich, context-aware notifications for reimbursement lifecycle events.

Inputs  : Reimbursement document, action, actor info, message.

Output  : Inserts notifications with HTML content into MongoDB. Best-effort; never raises.

Dependencies: config.mongodb_config, controllers.NotificationTemplates
'''

import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from bson import ObjectId

from config.mongodb_config import get_collection
from controllers.NotificationTemplates import NotificationTemplates
from env_config import objSettings
from services.notificationLibService import objNotifService  # Assuming this is the async notification sender
objLogger = logging.getLogger(__name__)


def _build_categories_list(dictReimbursement: dict) -> List[str]:
    """
    Purpose : Extract category names from reimbursement items.

    Inputs  :   (1) dictReimbursement : Reimbursement document (dict)

    Output  : List of category names (list of str)

    Example : _build_categories_list({items: [...]}) → ["Travel", "Food", "Accommodation"]
    """
    lsCategories = []
    lsItems = dictReimbursement.get("items", [])

    for dictItem in lsItems:
        strCategoryName = dictItem.get("category_name", "")
        if strCategoryName and strCategoryName not in lsCategories:
            lsCategories.append(strCategoryName)

    return lsCategories


def _calculate_total_amount(dictReimbursement: dict) -> float:
    """
    Purpose : Calculate total amount from all reimbursement items.

    Inputs  :   (1) dictReimbursement : Reimbursement document (dict)

    Output  : Total amount (float)

    Example : _calculate_total_amount({items: [...]}) → 15450.50
    """
    lsItems = dictReimbursement.get("items", [])
    fTotal = sum(item.get("amount", 0.0) for item in lsItems)
    return fTotal


def _calculate_due_date(iDays: int) -> str:
    """
    Purpose : Calculate due date from now + specified days.

    Inputs  :   (1) iDays : Number of days to add (int)

    Output  : ISO date string

    Example : _calculate_due_date(3) → "2026-06-16T10:30:00Z"
    """
    dtDue = datetime.now(timezone.utc) + timedelta(days=iDays)
    # Return ISO in configured local timezone if available
    try:
        tz = ZoneInfo(getattr(objSettings, 'TIMEZONE', 'Asia/Kolkata'))
        return dtDue.astimezone(tz).isoformat()
    except Exception:
        return dtDue.isoformat()


def _get_approval_history(dictReimbursement: dict) -> List[Dict]:
    """
    Purpose : Build approval history from approval chain.

    Inputs  :   (1) dictReimbursement : Reimbursement document (dict)

    Output  : List of approval history entries

    Example : _get_approval_history({...}) → [
                  {"reviewer_name": "John", "received_date": "...", "approved_date": "..."},
                  ...
              ]
    """
    lsHistory = []
    lsChain = dictReimbursement.get("approval_chain", [])

    # Add initiator
    strInitiatorName = dictReimbursement.get("initiator_name", "Initiator")
    strSubmissionDate = dictReimbursement.get("created_at", "")
    lsHistory.append({
        "reviewer_name": f"{strInitiatorName} (Initiator)",
        "received_date": "-",
        "approved_date": strSubmissionDate
    })

    # Add approved reviewers
    for dictStep in lsChain:
        if dictStep.get("status") == "APPROVED":
            lsHistory.append({
                "reviewer_name": dictStep.get("name", ""),
                "received_date": dictStep.get("received_date", "-"),
                "approved_date": dictStep.get("approved_at", "-")
            })

    return lsHistory


def _insert_notification(
    strUserId: str,
    strType: str,
    strTitle: str,
    strHtmlContent: str,
    dictMetadata: Dict,
    strReimbursementId: Optional[str] = None,
) -> None:
    """
    Purpose : Insert a single notification document with HTML content.

    Inputs  :   (1) strUserId          : Recipient user ID (str)
                (2) strType            : Notification type (str)
                (3) strTitle           : Notification title (str)
                (4) strHtmlContent     : HTML template (str)
                (5) dictMetadata       : Structured notification data (dict)
                (6) strReimbursementId : Reimbursement ID (str, optional)

    Output  : None (inserts into MongoDB)

    Example : _insert_notification("user123", "SUBMITTED", "Application Submitted", "<div>...</div>", {...}, "reimb456")
    """
    if not strUserId:
        return

    try:
        objNotifs = get_collection("notifications")
        try:
            tz = ZoneInfo(getattr(objSettings, 'TIMEZONE', 'Asia/Kolkata'))
            created_at = datetime.now(tz).isoformat()
        except Exception:
            created_at = datetime.now(timezone.utc).isoformat()

        objNotifs.insert_one({
            "user_id": str(strUserId),
            "type": strType,
            "title": strTitle,
            "message": dictMetadata.get("message", ""),  # Fallback for compatibility
            "html_content": strHtmlContent,
            "metadata": dictMetadata,
            "reimbursement_id": strReimbursementId,
            "is_read": False,
            "created_at": created_at,
        })

        objLogger.info(f"✅ Notification inserted | user_id={strUserId} | type={strType} | reimb_id={strReimbursementId}")
    except Exception as objErr:
        objLogger.error(f"❌ Error inserting notification: {objErr}")


async def notifyActionEnhanced(
    dictReimbursement: dict,
    strAction: str,
    strActorId: str,
    strMessage: str = "",
    strVisibility: str = "public",
) -> None:
    """
    Purpose : Emit enhanced notifications with HTML templates based on reimbursement action.

    Inputs  :   (1) dictReimbursement : Updated reimbursement document (dict)
                (2) strAction         : Action just executed (str) - APPROVE, QUERY, ASK, etc.
                (3) strActorId        : User ID who took the action (str)
                (4) strMessage        : Optional human message attached to action (str)
                (5) strVisibility     : "public" or "private" (str)

    Output  : None. Best-effort; logs errors but does not raise.

    Example : notifyActionEnhanced(dictReimb, "APPROVE", "user123", "Looks good!")
    """
    try:
        # Extract common data
        strReimbId = str(dictReimbursement.get("_id", ""))
        strReimbCode = dictReimbursement.get("reimbursement_code", "")
        strInitiatorId = str(dictReimbursement.get("initiator_id", ""))
        strInitiatorName = dictReimbursement.get("initiator_name", "User")
        strStatus = dictReimbursement.get("status", "")
        strCurrentReviewerId = str(dictReimbursement.get("current_reviewer_id", ""))

        lsCategories = _build_categories_list(dictReimbursement)
        fTotalAmount = _calculate_total_amount(dictReimbursement)
        strSubmissionDate = dictReimbursement.get("created_at", datetime.now(timezone.utc).isoformat())

        # Get actor name
        objUsers = get_collection("users")
        dictActor = objUsers.find_one({"_id": ObjectId(strActorId)}) if strActorId else None
        strActorName = dictActor.get("name", "Manager") if dictActor else "Manager"

        # Handle SUBMITTED action
        if strAction == "APPROVE" and strStatus == "SUBMITTED":
            # First submission - notify initiator and first manager

            # 1. Notify initiator
            dictInitiatorMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "initiator_name": strInitiatorName,
                "categories": lsCategories,
                "total_amount": fTotalAmount,
                "submission_date": strSubmissionDate,
                "message": "Your reimbursement has been submitted successfully."
            }
            strInitiatorHtml = NotificationTemplates.submitted_to_initiator(dictInitiatorMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "SUBMITTED",
            #     "Application Submitted",
            #     strInitiatorHtml,
            #     dictInitiatorMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="SUBMITTED",
                strTitle="Application Submitted",
                strHtmlContent=strInitiatorHtml,
                dictMetadata=dictInitiatorMeta,
                strReimbursementId=strReimbId
            )

            # 2. Notify first manager
            if strCurrentReviewerId:
                iReviewDays = objSettings.SLA_APPROVAL_DAYS
                strDueDate = _calculate_due_date(iReviewDays)

                dictManagerMeta = {
                    "reimbursement_id": strReimbCode or strReimbId,
                    "initiator_name": strInitiatorName,
                    "categories": lsCategories,
                    "total_amount": fTotalAmount,
                    "submission_date": strSubmissionDate,
                    "due_date": strDueDate,
                    "message": f"{strInitiatorName}'s reimbursement requires your approval."
                }
                strManagerHtml = NotificationTemplates.approval_required(dictManagerMeta)
                # _insert_notification(
                #     strCurrentReviewerId,
                #     "APPROVAL_PENDING",
                #     "Approval Required",
                #     strManagerHtml,
                #     dictManagerMeta,
                #     strReimbId
                # )
                await objNotifService.send(
                    strUserId=strCurrentReviewerId,
                    strType="APPROVAL_PENDING",
                    strTitle="Approval Required",
                    strHtmlContent=strManagerHtml,
                    dictMetadata=dictManagerMeta,
                    strReimbursementId=strReimbId
                )

        # Handle APPROVE action (escalation to next reviewer)
        elif strAction == "APPROVE" and strStatus in ["IN_REVIEW", "REAPPLIED"]:
            # Notify initiator of progress
            dictProgressMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "manager_name": strActorName,
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "approved_date": datetime.now(timezone.utc).isoformat(),
                "message": f"Your reimbursement was approved by {strActorName}."
            }
            strProgressHtml = NotificationTemplates.approved(dictProgressMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "APPROVAL_PROGRESS",
            #     f"Approved by {strActorName}",
            #     strProgressHtml,
            #     dictProgressMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="APPROVAL_PROGRESS",
                strTitle=f"Approved by {strActorName}",
                strHtmlContent=strProgressHtml,
                dictMetadata=dictProgressMeta,
                strReimbursementId=strReimbId
            )

            # Notify next reviewer with history
            if strCurrentReviewerId and strCurrentReviewerId != strActorId:
                iReviewDays = objSettings.SLA_APPROVAL_DAYS
                strDueDate = _calculate_due_date(iReviewDays)
                lsHistory = _get_approval_history(dictReimbursement)

                dictNextManagerMeta = {
                    "reimbursement_id": strReimbCode or strReimbId,
                    "initiator_name": strInitiatorName,
                    "categories": lsCategories,
                    "total_amount": fTotalAmount,
                    "submission_date": strSubmissionDate,
                    "due_date": strDueDate,
                    "approval_history": lsHistory,
                    "message": f"{strInitiatorName}'s reimbursement requires your approval."
                }
                strNextHtml = NotificationTemplates.approval_required_with_history(dictNextManagerMeta)
                # _insert_notification(
                #     strCurrentReviewerId,
                #     "APPROVAL_PENDING",
                #     "Approval Required",
                #     strNextHtml,
                #     dictNextManagerMeta,
                #     strReimbId
                # )
                await objNotifService.send(
                    strUserId=strCurrentReviewerId,
                    strType="APPROVAL_PENDING",
                    strTitle="Approval Required",
                    strHtmlContent=strNextHtml,
                    dictMetadata=dictNextManagerMeta,
                    strReimbursementId=strReimbId
                )

        # Handle QUERY action
        elif strAction == "QUERY":
            iResponseDays = objSettings.SLA_QUERY_RESPONSE_DAYS
            strDueDate = _calculate_due_date(iResponseDays)
            # Timestamp in local timezone
            try:
                tz = ZoneInfo(getattr(objSettings, 'TIMEZONE', 'Asia/Kolkata'))
                strNowLocal = datetime.now(tz).isoformat()
            except Exception:
                strNowLocal = datetime.now(timezone.utc).isoformat()

            dictQueryMeta = {
                "manager_name": strActorName,
                "reimbursement_id": strReimbCode or strReimbId,
                "query_message": strMessage,
                "due_date": strDueDate,
                "query_raised_at": strNowLocal,
                "message": strMessage
            }
            strQueryHtml = NotificationTemplates.query_raised(dictQueryMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "QUERY_RAISED",
            #     f"Query Raised by {strActorName}",
            #     strQueryHtml,
            #     dictQueryMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="QUERY_RAISED",
                strTitle=f"Query Raised by {strActorName}",
                strHtmlContent=strQueryHtml,
                dictMetadata=dictQueryMeta,
                strReimbursementId=strReimbId
            )

        # Handle ASK action (private)
        elif strAction == "ASK":
            iResponseDays = objSettings.SLA_QUERY_RESPONSE_DAYS
            strDueDate = _calculate_due_date(iResponseDays)

            # Timestamp in local timezone
            try:
                tz = ZoneInfo(getattr(objSettings, 'TIMEZONE', 'Asia/Kolkata'))
                strNowLocal = datetime.now(tz).isoformat()
            except Exception:
                strNowLocal = datetime.now(timezone.utc).isoformat()

            dictAskMeta = {
                "manager_name": strActorName,
                "reimbursement_id": strReimbCode or strReimbId,
                "ask_message": strMessage,
                "due_date": strDueDate,
                "ask_raised_at": strNowLocal,
                "message": strMessage
            }
            strAskHtml = NotificationTemplates.private_ask(dictAskMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "PRIVATE_ASK",
            #     f"Private Message from {strActorName}",
            #     strAskHtml,
            #     dictAskMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="PRIVATE_ASK",
                strTitle=f"Private Message from {strActorName}",
                strHtmlContent=strAskHtml,
                dictMetadata=dictAskMeta,
                strReimbursementId=strReimbId
            )

        # Handle REAPPLY action
        elif strAction == "REAPPLY":
            if strCurrentReviewerId:
                # Capture reapply message and persist a log so client can show details
                try:
                    tz = ZoneInfo(getattr(objSettings, 'TIMEZONE', 'Asia/Kolkata'))
                    strNowLocal = datetime.now(tz).isoformat()
                except Exception:
                    strNowLocal = datetime.now(timezone.utc).isoformat()

                dictReapplyMeta = {
                    "reimbursement_id": strReimbCode or strReimbId,
                    "initiator_name": strInitiatorName,
                    "reapply_message": strMessage,
                    "reapplied_at": strNowLocal,
                    "message": strMessage or f"{strInitiatorName} responded to your query.",
                }
                # Persist a log entry for the reapply
                try:
                    objLogs = get_collection('reimbursement_logs')
                    objLogs.insert_one({
                        'reimbursement_id': strReimbId,
                        'action': 'REAPPLY',
                        'action_by': strActorId,
                        'message': strMessage,
                        'visibility': 'public',
                        'created_at': dictReapplyMeta['reapplied_at'],
                    })
                except Exception:
                    pass

                # Simple notification for reapply
                # _insert_notification(
                #     strCurrentReviewerId,
                #     "REAPPLIED",
                #     "Reimbursement Re-submitted",
                #     f"<p>{dictReapplyMeta.get('message')}</p>",
                #     dictReapplyMeta,
                #     strReimbId
                # )
                await objNotifService.send(
                    strUserId=strCurrentReviewerId,
                    strType="REAPPLIED",
                    strTitle="Reimbursement Re-submitted",
                    strHtmlContent=f"<p>{dictReapplyMeta.get('message')}</p>",
                    dictMetadata=dictReapplyMeta,
                    strReimbursementId=strReimbId
                )

        # Handle PAY action
        elif strAction == "PAY":
            dictPayMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "message": "Your reimbursement has been paid. Please acknowledge receipt."
            }
            strPayHtml = NotificationTemplates.payment_disbursed(dictPayMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "PAID",
            #     "Payment Disbursed",
            #     strPayHtml,
            #     dictPayMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="PAID",
                strTitle="Payment Disbursed",
                strHtmlContent=strPayHtml,
                dictMetadata=dictPayMeta,
                strReimbursementId=strReimbId
            )

        # Handle REJECT action
        elif strAction == "REJECT":
            dictRejectMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "rejection_reason": strMessage or "Your reimbursement was rejected.",
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "rejected_date": datetime.now(timezone.utc).isoformat(),
                "message": strMessage or "Your reimbursement was rejected."
            }
            strRejectHtml = NotificationTemplates.rejected(dictRejectMeta)
            # _insert_notification(
            #     strInitiatorId,
            #     "REJECTED",
            #     "Reimbursement Rejected",
            #     strRejectHtml,
            #     dictRejectMeta,
            #     strReimbId
            # )
            await objNotifService.send(
                strUserId=strInitiatorId,
                strType="REJECTED",
                strTitle="Reimbursement Rejected",
                strHtmlContent=strRejectHtml,
                dictMetadata=dictRejectMeta,
                strReimbursementId=strReimbId
            )

        # Handle ACKNOWLEDGE action
        elif strAction == "ACKNOWLEDGE":
            strCaId = str(dictReimbursement.get("paid_by", ""))
            if strCaId and strCaId != strActorId:
                dictAckMeta = {
                    "reimbursement_id": strReimbCode or strReimbId,
                    "initiator_name": strInitiatorName,
                    "message": f"{strInitiatorName} acknowledged the payment."
                }
                # _insert_notification(
                #     strCaId,
                #     "ACKNOWLEDGED",
                #     "Payment Acknowledged",
                #     f"<p>{dictAckMeta['message']}</p>",
                #     dictAckMeta,
                #     strReimbId
                # )
                await objNotifService.send(
                    strUserId=strCaId,
                    strType="ACKNOWLEDGED",
                    strTitle="Payment Acknowledged",
                    strHtmlContent=f"<p>{dictAckMeta['message']}</p>",
                    dictMetadata=dictAckMeta,
                    strReimbursementId=strReimbId
                )

    except Exception as objErr:
        objLogger.error(f"❌ NOTIFY ENHANCED ERROR: {objErr}")
