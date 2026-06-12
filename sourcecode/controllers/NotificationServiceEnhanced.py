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
# from services.notificationLibService import objNotifService  # Assuming this is the async notification sender
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
    objCategories = get_collection("reimbursement_categories")

    for dictItem in lsItems:
        strCategoryName = dictItem.get("category_name", "")
        strcategoryId = dictItem.get("category_id", "")
        if strcategoryId:
            # Fallback: fetch category name from DB if not present in item
            try:
                dictCategory = objCategories.find_one({"_id": ObjectId(strcategoryId)})
                if dictCategory:
                    strCategoryName = dictCategory.get("name", "")
            except Exception as objErr:
                objLogger.warning(f"⚠️  Failed to fetch category name for ID {strcategoryId}: {objErr}")
        
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


async def _insert_notification(
    strUserId: str,
    strType: str,
    strTitle: str,
    strHtmlContent: str,
    dictMetadata: Dict,
    strReimbursementId: Optional[str] = None,
    bUseLibrary = True
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
    # if bUseLibrary:
    #     # Use the async notification service from the library
    #     try:
            
    #         await objNotifService.send(
    #             strUserId=strUserId,
    #             strType=strType,
    #             strTitle=strTitle,
    #             strHtmlContent=strHtmlContent,
    #             dictMetadata=dictMetadata,
    #             strReimbursementId=strReimbursementId
    #         )
    #         objLogger.info(f"✅ Notification sent via library | user_id={strUserId} | type={strType} | reimb_id={strReimbursementId}")
    #     except Exception as objErr:
    #         objLogger.error(f"❌ Error sending notification via library: {objErr}")
    #     return
    
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
              UPDATED: Uses new 9-state system (DRAFT, SUBMITTED, IN_REVIEW, QUERY, ASK,
              REAPPLIED, REJECTED, PAID, ACKNOWLEDGED).

    Inputs  :   (1) dictReimbursement : Updated reimbursement document (dict)
                (2) strAction         : Action just executed (str) - SUBMIT, APPROVE, QUERY, ASK, REAPPLY, PAY, REJECT, ACKNOWLEDGE
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

        # Handle SUBMIT action (DRAFT → SUBMITTED)
        if strAction == "SUBMIT" or strAction == "SUBMITTED":
            # 1. Notify initiator of successful submission
            dictInitiatorMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "initiator_name": strInitiatorName,
                "categories": lsCategories,
                "total_amount": fTotalAmount,
                "submission_date": strSubmissionDate,
                "message": "Your reimbursement has been submitted successfully."
            }
            strInitiatorHtml = NotificationTemplates.submitted_to_initiator(dictInitiatorMeta)

            await _insert_notification(
                strInitiatorId,
                "SUBMITTED",
                "Application Submitted",
                strInitiatorHtml,
                dictInitiatorMeta,
                strReimbId
            )

            # 2. Notify first manager (approval_chain[1])
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
                await _insert_notification(
                    strCurrentReviewerId,
                    "APPROVAL_PENDING",
                    "Approval Required",
                    strManagerHtml,
                    dictManagerMeta,
                    strReimbId
                )

        # Handle APPROVE action (manager approves and escalates to next reviewer or auto-pays)
        elif strAction == "APPROVE":
            # 1. Notify initiator of approval progress
            dictProgressMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "manager_name": strActorName,
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "approved_date": datetime.now(timezone.utc).isoformat(),
                "message": f"Your reimbursement was approved by {strActorName}."
            }
            strProgressHtml = NotificationTemplates.approved(dictProgressMeta)
            await _insert_notification(
                strInitiatorId,
                "APPROVAL_PROGRESS",
                f"Approved by {strActorName}",
                strProgressHtml,
                dictProgressMeta,
                strReimbId
            )

            # 2. Check if there's a next reviewer (status will be IN_REVIEW if there is)
            # If last reviewer approved, status will be PAID (auto-transition)
            if strStatus == "IN_REVIEW" and strCurrentReviewerId and strCurrentReviewerId != strActorId:
                # Notify next reviewer with approval history
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
                await _insert_notification(
                    strCurrentReviewerId,
                    "APPROVAL_PENDING",
                    "Approval Required",
                    strNextHtml,
                    dictNextManagerMeta,
                    strReimbId
                )
            elif strStatus == "PAID":
                # Last reviewer approved, auto-transitioned to PAID - notification will be sent by PAY handler
                objLogger.info(f"✅ Last reviewer approved | Auto-transitioned to PAID | reimb_id={strReimbId}")

        # Handle QUERY action (any reviewer → initiator)
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
            await _insert_notification(
                strInitiatorId,
                "QUERY_RAISED",
                f"Query Raised by {strActorName}",
                strQueryHtml,
                dictQueryMeta,
                strReimbId
            )

        # Handle ASK action (any reviewer → initiator, private)
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
            await _insert_notification(
                strInitiatorId,
                "PRIVATE_ASK",
                f"Private Message from {strActorName}",
                strAskHtml,
                dictAskMeta,
                strReimbId
            )

        # Handle REAPPLY action (initiator → current reviewer)
        elif strAction == "REAPPLY" or strAction == "REAPPLIED":
            if strCurrentReviewerId:
                # Capture reapply message and persist a log
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

                # Notify current reviewer of reapplication
                await _insert_notification(
                    strCurrentReviewerId,
                    "REAPPLIED",
                    "Reimbursement Re-submitted",
                    f"<p>{dictReapplyMeta.get('message')}</p>",
                    dictReapplyMeta,
                    strReimbId
                )

        # Handle PAY action (notify initiator only)
        elif strAction == "PAY" or strAction == "PAID":
            # Notify initiator that payment has been disbursed
            dictPayMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "message": "Your reimbursement has been paid. Please acknowledge receipt."
            }
            strPayHtml = NotificationTemplates.payment_disbursed(dictPayMeta)
            await _insert_notification(
                strInitiatorId,
                "PAID",
                "Payment Disbursed",
                strPayHtml,
                dictPayMeta,
                strReimbId
            )

        # Handle REJECT action (notify initiator)
        elif strAction == "REJECT" or strAction == "REJECTED":
            # Notify initiator of rejection
            dictRejectMeta = {
                "reimbursement_id": strReimbCode or strReimbId,
                "rejection_reason": strMessage or "Your reimbursement was rejected.",
                "total_amount": fTotalAmount,
                "categories": lsCategories,
                "rejected_date": datetime.now(timezone.utc).isoformat(),
                "message": strMessage or "Your reimbursement was rejected."
            }
            strRejectHtml = NotificationTemplates.rejected(dictRejectMeta)
            await _insert_notification(
                strInitiatorId,
                "REJECTED",
                "Reimbursement Rejected",
                strRejectHtml,
                dictRejectMeta,
                strReimbId
            )

        # Handle ACKNOWLEDGE action (notify CA/paid_by only)
        elif strAction == "ACKNOWLEDGE" or strAction == "ACKNOWLEDGED":
            # Notify the CA who marked it as paid
            strCaId = str(dictReimbursement.get("paid_by", ""))
            if strCaId and strCaId != strActorId:
                dictAckMeta = {
                    "reimbursement_id": strReimbCode or strReimbId,
                    "initiator_name": strInitiatorName,
                    "message": f"{strInitiatorName} acknowledged the payment.",
                    "acknowledged_at": datetime.now(timezone.utc).isoformat()
                }
                await _insert_notification(
                    strCaId,
                    "ACKNOWLEDGED",
                    "Payment Acknowledged",
                    f"<p>{dictAckMeta['message']}</p>",
                    dictAckMeta,
                    strReimbId
                )

    except Exception as objErr:
        objLogger.error(f"❌ NOTIFY ENHANCED ERROR: {objErr}")
