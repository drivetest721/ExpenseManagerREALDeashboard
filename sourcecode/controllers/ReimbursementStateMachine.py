'''
Purpose : Simplified state machine for reimbursement status transitions.
          9-state model: DRAFT → SUBMITTED → IN_REVIEW → QUERY/ASK → REAPPLIED → PAID/REJECTED → ACKNOWLEDGED
          Updates embedded approval chain with step tracking.

Inputs  : Reimbursement ID, actor ID, action type, payload.

Output  : Updated reimbursement document (dict) or raises exception.

Dependencies: config.mongodb_config, controllers.ApprovalChainService, utils.date_utils
'''

import logging
import traceback
from bson import ObjectId

from config.mongodb_config import get_collection
from controllers.AuditLogger import logMutation
from controllers.NotificationServiceEnhanced import notifyActionEnhanced
from controllers.SLAEngine import createSLAEvent, resolveSLAEvents
from controllers.ActivityLogService import logActivity
from controllers.ApprovalChainService import updateApprovalChainStep, markInitiatorReapply
from utils.date_utils import getCurrentIst

objLogger = logging.getLogger(__name__)


# NEW: Simplified state transitions (9 states)
TRANSITIONS = {
    "DRAFT": {
        "SUBMIT": "SUBMITTED"
    },
    "SUBMITTED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED"
    },
    "IN_REVIEW": {
        "APPROVE": "IN_REVIEW",     # Move to next reviewer or PAID
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED",
        "PAY": "PAID"
    },
    "QUERY": {
        "REAPPLY": "REAPPLIED"
    },
    "ASK": {
        "REAPPLY": "REAPPLIED"
    },
    "REAPPLIED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED",
        "PAY": "PAID"
    },
    "PAID": {
        "ACKNOWLEDGE": "ACKNOWLEDGED"
    },
    "REJECTED": {},
    "ACKNOWLEDGED": {}
}


async def transition(strReimbursementId: str, strActorId: str, strAction: str, dictPayload: dict = None) -> dict:
    """
    Purpose : Execute a state transition on a reimbursement.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) strActorId         : User ID performing the action (str)
                (3) strAction          : Action (SUBMIT, APPROVE, QUERY, ASK, REAPPLY, REJECT, PAY, ACKNOWLEDGE)
                (4) dictPayload        : Optional payload (dict)

    Output  : Updated reimbursement document (dict)

    Example : await transition("reimb123", "user456", "APPROVE", {})
    """
    try:
        objLogger.info(f"📥 TRANSITION | reimb: {strReimbursementId} | action: {strAction} | actor: {strActorId}")
        
        objReimbs = get_collection("reimbursements")
        
        # Fetch current reimbursement
        dictOld = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})
        if not dictOld:
            objLogger.error(f"❌ Reimbursement not found: {strReimbursementId}")
            raise ValueError("Reimbursement not found")
        
        strCurrentStatus = dictOld.get("status", "")
        
        # Validate transition
        if strCurrentStatus not in TRANSITIONS:
            objLogger.error(f"❌ No transitions for status: {strCurrentStatus}")
            raise ValueError(f"No transitions defined for status {strCurrentStatus}")
        
        
        bIsOwner = (strCurrentStatus == "SUBMITTED" and strAction == "PAY") # NOTE

        if bIsOwner:
            strCurrentStatus = "IN_REVIEW"
        if strAction not in TRANSITIONS[strCurrentStatus]:
            objLogger.error(f"❌ Action {strAction} not allowed from {strCurrentStatus}")
            raise ValueError(f"Action {strAction} not allowed from status {strCurrentStatus}")
        
        strNextStatus = TRANSITIONS[strCurrentStatus][strAction]
        dtNow = getCurrentIst()
        
        # Base update
        dictUpdates = {
            "status": strNextStatus,
            "updated_at": dtNow.isoformat()
        }
        
        objLogger.info(f"🔄 {strCurrentStatus} → {strNextStatus}")
        
        # Get current approval chain and step
        lsChain = dictOld.get("approval_chain", [])
        iCurrentStep = dictOld.get("current_step", 0)
        
        # Handle different actions
        if strAction == "SUBMIT":
            dictUpdates["submitted_at"] = dtNow.isoformat()

            # Mark initiator (step 0) as submitted
            updateApprovalChainStep(strReimbursementId, 0, {
                "current_status": "SUBMITTED",
                "submittedAt": dtNow.isoformat()
            })

            if len(lsChain) > 1:
                dictUpdates["current_step"] = 1
                dictUpdates["current_reviewer_id"] = lsChain[1]["user_id"]

                # Set first manager status to PENDING (they haven't viewed yet)
                updateApprovalChainStep(strReimbursementId, 1, {
                    "current_status": "PENDING"
                })

                createSLAEvent(strReimbursementId, "REVIEW_PENDING", lsChain[1]["user_id"])
        
        elif strAction == "APPROVE":
            # Mark current step as approved
            if iCurrentStep < len(lsChain):
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "APPROVED",
                    "submittedAt": dtNow.isoformat()
                })

            # Move to next step
            iNextStep = iCurrentStep + 1
            if iNextStep < len(lsChain):
                dictUpdates["current_step"] = iNextStep
                dictUpdates["current_reviewer_id"] = lsChain[iNextStep]["user_id"]

                # Set next manager status to PENDING (they haven't viewed yet)
                updateApprovalChainStep(strReimbursementId, iNextStep, {
                    "current_status": "PENDING"
                })

                createSLAEvent(strReimbursementId, "REVIEW_PENDING", lsChain[iNextStep]["user_id"])
            else:
                # Last reviewer (CA) approved - auto PAY
                dictUpdates["status"] = "PAID"
                dictUpdates["current_step"] = len(lsChain)
                dictUpdates["current_reviewer_id"] = ""
                resolveSLAEvents(strReimbursementId, "approved")

        elif strAction == "QUERY":
            # Reviewer raises query
            if iCurrentStep < len(lsChain):
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "QUERY",
                    "submittedAt": dtNow.isoformat()
                })

            # Set initiator (step 0) status to PENDING and clear receivedAt for fresh tracking
            updateApprovalChainStep(strReimbursementId, 0, {
                "current_status": "PENDING",
                "receivedAt": None  # Clear to track when initiator first views after query
            })

            dictUpdates["current_reviewer_id"] = dictOld.get("initiator_id", "")
            createSLAEvent(strReimbursementId, "QUERY_RESPONSE_PENDING", dictOld.get("initiator_id"))

        elif strAction == "ASK":
            # Reviewer raises private ask
            if iCurrentStep < len(lsChain):
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "ASK",
                    "submittedAt": dtNow.isoformat()
                })

            # Set initiator (step 0) status to PENDING and clear receivedAt for fresh tracking
            updateApprovalChainStep(strReimbursementId, 0, {
                "current_status": "PENDING",
                "receivedAt": None  # Clear to track when initiator first views after ask
            })

            dictUpdates["current_reviewer_id"] = dictOld.get("initiator_id", "")
            createSLAEvent(strReimbursementId, "QUERY_RESPONSE_PENDING", dictOld.get("initiator_id"))

        elif strAction == "REAPPLY":
            # Initiator responds to query/ask
            markInitiatorReapply(strReimbursementId)

            # Return to the reviewer who raised query/ask
            if iCurrentStep < len(lsChain):
                dictUpdates["current_reviewer_id"] = lsChain[iCurrentStep]["user_id"]

                # Set reviewer status to PENDING and clear receivedAt for fresh tracking
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "PENDING",
                    "receivedAt": None  # Clear to track when reviewer first views after reapply
                })

                createSLAEvent(strReimbursementId, "REVIEW_PENDING", lsChain[iCurrentStep]["user_id"])
            resolveSLAEvents(strReimbursementId, "reapplied")

        elif strAction == "PAY":
            # CA marks as paid
            if iCurrentStep < len(lsChain):
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "PAID",
                    "submittedAt": dtNow.isoformat()
                })

            dictUpdates["paid_at"] = dtNow.isoformat()
            dictUpdates["paid_by"] = strActorId
            dictUpdates["current_reviewer_id"] = ""

            # Store payment proof if provided
            if dictPayload:
                if dictPayload.get("payment_proof_attachment_id"):
                    dictUpdates["payment_proof"] = {
                        "attachment_id": dictPayload["payment_proof_attachment_id"],
                        "payment_date": dtNow.isoformat(),
                        "paid_by": strActorId,
                        "transaction_ref": dictPayload.get("transaction_ref", ""),
                        "payment_method": dictPayload.get("payment_method", "")
                    }

            resolveSLAEvents(strReimbursementId, "paid")

        elif strAction == "REJECT":
            # CA rejects
            if iCurrentStep < len(lsChain):
                updateApprovalChainStep(strReimbursementId, iCurrentStep, {
                    "current_status": "REJECTED",
                    "submittedAt": dtNow.isoformat()
                })

            dictUpdates["rejected_at"] = dtNow.isoformat()
            dictUpdates["rejected_by"] = strActorId
            dictUpdates["current_reviewer_id"] = ""

            if dictPayload and dictPayload.get("rejection_reason"):
                dictUpdates["rejection_reason"] = dictPayload["rejection_reason"]

            resolveSLAEvents(strReimbursementId, "rejected")

        elif strAction == "ACKNOWLEDGE":
            # Initiator acknowledges payment
            updateApprovalChainStep(strReimbursementId, 0, {
                "current_status": "ACKNOWLEDGED",
                "submittedAt": dtNow.isoformat()
            })

            dictUpdates["acknowledged_at"] = dtNow.isoformat()
            dictUpdates["acknowledged_by"] = strActorId
            dictUpdates["current_reviewer_id"] = ""

        # Perform atomic update
        objResult = objReimbs.update_one(
            {"_id": ObjectId(strReimbursementId)},
            {"$set": dictUpdates}
        )

        if objResult.modified_count == 0:
            objLogger.warning(f"⚠️ No document modified")

        # Fetch updated document
        dictNew = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})

        # Log activity
        logActivity(
            strReimbursementId,
            strActorId,
            strAction,
            strCurrentStatus,
            strNextStatus,
            dictPayload.get("message", "") if dictPayload else "",
            "public")

        # Log mutation for audit
        logMutation("reimbursements", dictOld, dictNew, f"transition_{strAction}", strActorId, strReimbursementId)

        # Send notifications
        await notifyActionEnhanced(
            dictNew,
            strAction, 
            strActorId, 
            dictPayload.get("message", "") if dictPayload else "",
            dictPayload.get("visibility", "public") if dictPayload else "public",
        )

        objLogger.info(f"✅ Transition successful | new status: {strNextStatus}")
        return dictNew

    except Exception as objErr:
        objLogger.error(f"❌ Transition failed: {str(objErr)}")
        objLogger.error(traceback.format_exc())
        raise Exception(f"State transition failed: {str(objErr)}")
