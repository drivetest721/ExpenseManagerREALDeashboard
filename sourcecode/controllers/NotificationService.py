'''
Purpose : Notification service — creates in-app notifications for relevant actors
          based on reimbursement state transitions.

Inputs  : Reimbursement document, action, actor info.

Output  : Inserts into notifications collection. Best-effort; never raises.

Dependencies: config.mongodb_config
'''

import logging
from datetime import datetime, timezone
from typing import List, Optional

from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)


def _insertOne(
    strUserId: str,
    strType: str,
    strTitle: str,
    strMessage: str,
    strReimbursementId: Optional[str] = None,
) -> None:
    """Insert a single notification document."""
    if not strUserId:
        return
    try:
        objNotifs = get_collection("notifications")
        objNotifs.insert_one({
            "user_id": str(strUserId),
            "type": strType,
            "title": strTitle,
            "message": strMessage,
            "reimbursement_id": strReimbursementId,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as objErr:
        objLogger.error(f"❌ NOTIFICATION INSERT ERROR: {objErr}")


def notifyAction(
    dictReimbursement: dict,
    strAction: str,
    strActorId: str,
    strMessage: str = "",
    strVisibility: str = "public",
) -> None:
    """
    Purpose : Emit notifications to relevant participants based on the action.

    Inputs  :   (1) dictReimbursement  : Updated reimbursement document (dict)
                (2) strAction          : Action just executed (APPROVE, QUERY, ASK, ...)
                (3) strActorId         : User who took the action (str)
                (4) strMessage         : Optional human message attached to the action
                (5) strVisibility      : "public" or "private" (controls ASK visibility)

    Output  : None. Best-effort; logs errors but does not raise.
    """
    try:
        strReimbId = str(dictReimbursement.get("_id", ""))
        strInitiatorId = str(dictReimbursement.get("initiator_id", ""))
        strInitiatorName = dictReimbursement.get("initiator_name", "User")
        strStatus = dictReimbursement.get("status", "")
        strCurrentReviewerId = str(dictReimbursement.get("current_reviewer_id", ""))

        strShort = strMessage[:120] if strMessage else ""

        if strAction == "APPROVE":
            # Notify initiator of progress
            _insertOne(
                strInitiatorId,
                "APPROVAL_PROGRESS",
                "Reimbursement approved at a step",
                f"Your reimbursement progressed to {strStatus}.",
                strReimbId,
            )
            # Notify next reviewer if there is one
            if strCurrentReviewerId and strCurrentReviewerId != strActorId:
                _insertOne(
                    strCurrentReviewerId,
                    "APPROVAL_PENDING",
                    "Approval required",
                    f"{strInitiatorName}'s reimbursement is awaiting your approval.",
                    strReimbId,
                )

        elif strAction == "QUERY":
            _insertOne(strInitiatorId, "QUERY_RAISED", "Query raised on your reimbursement", strShort, strReimbId)

        elif strAction == "ASK":
            # Private — only initiator sees the message
            _insertOne(strInitiatorId, "PRIVATE_ASK", "Private message about your reimbursement", strShort, strReimbId)

        elif strAction == "REAPPLY":
            if strCurrentReviewerId:
                _insertOne(strCurrentReviewerId, "REAPPLIED", "Reimbursement re-submitted", f"{strInitiatorName} responded to your query.", strReimbId)

        elif strAction == "CA_QUERY":
            _insertOne(strInitiatorId, "CA_QUERY", "CA raised a query", strShort, strReimbId)

        elif strAction == "CA_REAPPLY":
            if strCurrentReviewerId:
                _insertOne(strCurrentReviewerId, "CA_REAPPLIED", "CA query response", f"{strInitiatorName} responded to your CA query.", strReimbId)

        elif strAction == "PAY":
            _insertOne(strInitiatorId, "PAID", "Payment disbursed", "Your reimbursement has been marked as PAID. Please acknowledge.", strReimbId)

        elif strAction == "ACKNOWLEDGE":
            # Notify CA (current_reviewer was CA before close; use paid_by as fallback)
            strCaId = str(dictReimbursement.get("paid_by", ""))
            if strCaId and strCaId != strActorId:
                _insertOne(strCaId, "ACKNOWLEDGED", "Payment acknowledged", f"{strInitiatorName} acknowledged the payment.", strReimbId)

        elif strAction == "REJECT":
            _insertOne(strInitiatorId, "REJECTED", "Reimbursement rejected", strShort or "Your reimbursement was rejected.", strReimbId)

    except Exception as objErr:
        objLogger.error(f"❌ NOTIFY ERROR: {objErr}")
