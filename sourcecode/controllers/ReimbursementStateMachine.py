'''
Purpose : State machine for reimbursement status transitions.
          Enforces allowed transitions and updates current_reviewer_id atomically.

Inputs  : Reimbursement ID, actor ID, action type, payload.

Output  : Updated reimbursement document (dict) or raises exception.

Dependencies: config.mongodb_config, controllers.AuditLogger
'''

import logging
from datetime import datetime, timezone
from bson import ObjectId

from config.mongodb_config import get_collection
from controllers.AuditLogger import logMutation
from controllers.NotificationServiceEnhanced import notifyActionEnhanced
from controllers.SLAEngine import createSLAEvent, resolveSLAEvents
from controllers.ActivityLogService import logActivity

objLogger = logging.getLogger(__name__)


# Valid transitions: {current_status: {action: next_status}}
TRANSITIONS = {
    "SUBMITTED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY_RAISED",
        "ASK": "PRIVATE_ASK",
    },
    "IN_REVIEW": {
        "APPROVE": "IN_REVIEW",  # Moves to next reviewer or OWNER_APPROVED
        "QUERY": "QUERY_RAISED",
        "ASK": "PRIVATE_ASK",
    },
    "QUERY_RAISED": {
        "REAPPLY": "REAPPLIED",
    },
    "PRIVATE_ASK": {
        "REAPPLY": "REAPPLIED",
    },
    "REAPPLIED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY_RAISED",
        "ASK": "PRIVATE_ASK",
    },
    "OWNER_APPROVED": {
        "SEND_TO_CA": "CA_PENDING",
        # CA actions allowed directly from OWNER_APPROVED when CA is already current_reviewer.
        # (New submissions go straight to CA_PENDING; these cover backward-compat.)
        "CA_QUERY": "CA_QUERY",
        "ASK": "PRIVATE_ASK",
        "PAY": "PAID",
        "REJECT": "REJECTED",
    },
    "CA_PENDING": {
        "CA_QUERY": "CA_QUERY",
        "ASK": "PRIVATE_ASK",
        "PAY": "PAID",
        "REJECT": "REJECTED",
    },
    "CA_QUERY": {
        "CA_REAPPLY": "CA_REAPPLIED",
    },
    "CA_REAPPLIED": {
        "CA_QUERY": "CA_QUERY",
        "ASK": "PRIVATE_ASK",
        "PAY": "PAID",
        "REJECT": "REJECTED",
    },
    "PAID": {
        "ACKNOWLEDGE": "PAYMENT_ACKNOWLEDGED",
    },
    "PAYMENT_ACKNOWLEDGED": {
        "CLOSE": "CLOSED",
    },
}


async def transition(strReimbursementId: str, strActorId: str, strAction: str, dictPayload: dict = None) -> dict:
    """
    Purpose : Execute a state transition on a reimbursement.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) strActorId         : User ID performing the action (str)
                (3) strAction          : Action type (str) — APPROVE, QUERY, ASK, REAPPLY, etc.
                (4) dictPayload        : Optional payload (dict) — e.g., message for QUERY/ASK

    Output  : Updated reimbursement document (dict)

    Example : transition("reimb123", "user456", "APPROVE") → {...}
    """
    try:
        objReimbs = get_collection("reimbursements")
        objLogs = get_collection("reimbursement_logs")
        
        dictOld = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})
        if not dictOld:
            raise ValueError("Reimbursement not found")
        
        strCurrentStatus = dictOld.get("status", "")
        
        # Validate transition
        if strCurrentStatus not in TRANSITIONS:
            raise ValueError(f"No transitions defined for status {strCurrentStatus}")
        
        if strAction not in TRANSITIONS[strCurrentStatus]:
            raise ValueError(f"Action {strAction} not allowed from status {strCurrentStatus}")
        
        strNextStatus = TRANSITIONS[strCurrentStatus][strAction]

        # Build update dict
        dictUpdates = {
            "status": strNextStatus,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Handle APPROVE logic (move to next reviewer or OWNER_APPROVED)
        if strAction == "APPROVE":
            lsChain = dictOld.get("approval_chain", [])
            iCurrentStep = dictOld.get("current_step", 0)
            
            # Mark current step as APPROVED
            if iCurrentStep < len(lsChain):
                lsChain[iCurrentStep]["status"] = "APPROVED"
                lsChain[iCurrentStep]["approved_at"] = datetime.now(timezone.utc).isoformat()
                lsChain[iCurrentStep]["approved_by"] = strActorId
            
            # Move to next step
            iNextStep = iCurrentStep + 1
            if iNextStep < len(lsChain):
                # Check if next reviewer is CA
                dictNextReviewer = lsChain[iNextStep]
                objUsers = get_collection("users")
                dictNextUser = objUsers.find_one({"_id": ObjectId(dictNextReviewer["user_id"])})
                bIsCA = any(d.get("role") == "ca" for d in dictNextUser.get("departments", []))
                
                if bIsCA:
                    # CA is next — skip OWNER_APPROVED and go straight to CA_PENDING
                    # so the CA immediately has actionable status without a SEND_TO_CA trigger.
                    dictUpdates["status"] = "CA_PENDING"
                    dictUpdates["current_step"] = iNextStep
                    dictUpdates["current_reviewer_id"] = dictNextReviewer["user_id"]
                else:
                    dictUpdates["status"] = "IN_REVIEW"
                    dictUpdates["current_step"] = iNextStep
                    dictUpdates["current_reviewer_id"] = dictNextReviewer["user_id"]
            else:
                dictUpdates["status"] = "OWNER_APPROVED"
            
            dictUpdates["approval_chain"] = lsChain

        # PAY: record payment metadata; mark CA chain step as APPROVED and clear reviewer
        if strAction == "PAY":
            dictUpdates["paid_at"] = datetime.now(timezone.utc).isoformat()
            dictUpdates["paid_by"] = strActorId
            if dictPayload:
                if dictPayload.get("transaction_ref"):
                    dictUpdates["transaction_ref"] = dictPayload["transaction_ref"]
                if dictPayload.get("payment_method"):
                    dictUpdates["payment_method"] = dictPayload["payment_method"]

            # Persist payment proof attachment if provided either as a simple id
            # or as a full payment_proof object supplied by the route.
            if dictPayload:
                if dictPayload.get("payment_proof_attachment_id"):
                    dictUpdates["payment_proof"] = {
                        "attachment_id": dictPayload.get("payment_proof_attachment_id"),
                        "payment_date": dictUpdates.get("paid_at"),
                        "paid_by": strActorId,
                        "transaction_ref": dictPayload.get("transaction_ref"),
                        "payment_method": dictPayload.get("payment_method"),
                    }
                elif dictPayload.get("payment_proof") and isinstance(dictPayload.get("payment_proof"), dict):
                    # Accept the provided dict (trusting the route to populate sensible fields)
                    dictProof = dict(dictPayload.get("payment_proof"))
                    # Ensure payment_date / paid_by are present
                    if not dictProof.get("payment_date"):
                        dictProof["payment_date"] = dictUpdates.get("paid_at")
                    if not dictProof.get("paid_by"):
                        dictProof["paid_by"] = strActorId
                    dictUpdates["payment_proof"] = dictProof

            lsChain = dictOld.get("approval_chain", [])
            iCurrentStep = dictOld.get("current_step", 0)
            if iCurrentStep < len(lsChain):
                lsChain[iCurrentStep]["status"] = "APPROVED"
                lsChain[iCurrentStep]["approved_at"] = datetime.now(timezone.utc).isoformat()
                lsChain[iCurrentStep]["approved_by"] = strActorId
            dictUpdates["approval_chain"] = lsChain
            dictUpdates["current_step"] = len(lsChain)
            dictUpdates["current_reviewer_id"] = ""

        # REAPPLY: Reset current_reviewer_id back to the manager who raised the query
        if strAction in ("REAPPLY", "CA_REAPPLY"):
            # Get the current_step and set current_reviewer back to that step's user
            lsChain = dictOld.get("approval_chain", [])
            iCurrentStep = dictOld.get("current_step", 0)
            if iCurrentStep < len(lsChain):
                dictUpdates["current_reviewer_id"] = lsChain[iCurrentStep]["user_id"]
                objLogger.info(f"📧 REAPPLY: Returning to reviewer {lsChain[iCurrentStep]['user_id']} at step {iCurrentStep}")

        # ACKNOWLEDGE: record acknowledgement metadata; also auto-close
        if strAction == "ACKNOWLEDGE":
            dictUpdates["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
            dictUpdates["acknowledged_by"] = strActorId
            dictUpdates["status"] = "CLOSED"
            dictUpdates["current_reviewer_id"] = ""

        # REJECT: record rejection metadata
        if strAction == "REJECT":
            dictUpdates["rejected_at"] = datetime.now(timezone.utc).isoformat()
            dictUpdates["rejected_by"] = strActorId

        # Atomic update with filter on current_reviewer_id to prevent double action
        if strAction in ("APPROVE", "PAY", "CA_QUERY", "REJECT"):
            # Default: actor must be the current reviewer
            filter_query = {"_id": ObjectId(strReimbursementId), "current_reviewer_id": strActorId}

            # Special-case PAY: allow a CA user to mark as paid when status is OWNER_APPROVED/CA_PENDING/CA_REAPPLIED
            if strAction == "PAY":
                try:
                    objUsers = get_collection("users")
                    dictActor = objUsers.find_one({"_id": ObjectId(strActorId)})
                    bActorIsCA = any(d.get("role") == "ca" for d in dictActor.get("departments", [])) if dictActor else False
                except Exception:
                    bActorIsCA = False

                if bActorIsCA:
                    filter_query = {
                        "_id": ObjectId(strReimbursementId),
                        "$or": [
                            {"current_reviewer_id": strActorId},
                            {"status": {"$in": ["OWNER_APPROVED", "CA_PENDING", "CA_REAPPLIED"]}},
                        ],
                    }

            objResult = objReimbs.update_one(filter_query, {"$set": dictUpdates})
            if objResult.matched_count == 0:
                raise ValueError("You are not the current reviewer or this has already been actioned")
        elif strAction in ("ACKNOWLEDGE", "REAPPLY", "CA_REAPPLY"):
            # Initiator-only actions: filter on initiator_id
            objResult = objReimbs.update_one(
                {"_id": ObjectId(strReimbursementId), "initiator_id": strActorId},
                {"$set": dictUpdates}
            )
            if objResult.matched_count == 0:
                raise ValueError("Only the initiator can perform this action")
        else:
            objReimbs.update_one(
                {"_id": ObjectId(strReimbursementId)},
                {"$set": dictUpdates}
            )
        
        dictNew = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})

        # Log activity using ActivityLogService
        logActivity(
            strReimbursementId,
            strActorId,
            strAction,
            strCurrentStatus,
            strNextStatus,
            dictPayload.get("message", "") if dictPayload else "",
            dictPayload.get("visibility", "public") if dictPayload else "public",
        )
        
        logMutation("reimbursements", dictOld, dictNew, "UPDATE", strActorId, strReimbursementId)
        objLogger.info(f"✅ STATE TRANSITION: {strReimbursementId} {strCurrentStatus} → {strNextStatus} by {strActorId}")

        # Best-effort notification dispatch (never blocks the transition)
        try:
            await notifyActionEnhanced(
                dictNew,
                strAction,
                strActorId,
                dictPayload.get("message", "") if dictPayload else "",
                dictPayload.get("visibility", "public") if dictPayload else "public",
            )
        except Exception as objNotifErr:
            objLogger.error(f"⚠️  Notification dispatch failed: {objNotifErr}")

        # Best-effort SLA event management
        try:
            strNewStatus = dictNew.get("status", "")
            strNewReviewerId = str(dictNew.get("current_reviewer_id", ""))

            if strAction in ("QUERY", "ASK"):
                # Initiator must respond — start query-response SLA
                createSLAEvent(strReimbursementId, "QUERY_RESPONSE_PENDING", strActorId)

            elif strAction == "REAPPLY":
                # Reviewer must re-approve — start review SLA
                createSLAEvent(strReimbursementId, "REVIEW_PENDING", strNewReviewerId)

            elif strAction == "APPROVE":
                if strNewStatus == "IN_REVIEW":
                    # Next reviewer in chain — new review SLA
                    createSLAEvent(strReimbursementId, "REVIEW_PENDING", strNewReviewerId)
                elif strNewStatus in ("OWNER_APPROVED", "CA_PENDING"):
                    # CA step — resolve old SLA, start fresh for CA
                    resolveSLAEvents(strReimbursementId, "owner_approved")
                    createSLAEvent(strReimbursementId, "REVIEW_PENDING", strNewReviewerId)

            elif strAction in ("REJECT", "AUTO_REJECTED", "ACKNOWLEDGE", "CLOSE", "PAY"):
                resolveSLAEvents(strReimbursementId, strAction.lower())

        except Exception as objSLAErr:
            objLogger.error(f"⚠️  SLA hook failed: {objSLAErr}")

        return dictNew
    
    except Exception as objErr:
        objLogger.error(f"❌ STATE TRANSITION ERROR: {objErr}")
        raise
