'''
Purpose : Approval action routes (approve, query, ask, reapply, pay, reject, acknowledge).
          UPDATED: Unified routes (removed CA-specific /ca/ routes), integrated with new state machine.

Inputs  : HTTP requests (path params, JSON bodies).

Output  : JSON success/error responses.

Dependencies: fastapi, jwt_middleware, approval_schemas, ReimbursementStateMachine, ApprovalChainService
'''
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId

from middleware.jwt_middleware import getCurrentUserDependency
from schemas.approval_schemas import (
    ApproveRequest,
    QueryRequest,
    AskRequest,
    ReapplyRequest,
    PayRequest,
    AcknowledgeRequest,
    RejectRequest,
    PaymentProofSchema,
)
from controllers.ReimbursementStateMachine import transition
from controllers.ApprovalChainService import markStepAsViewed
from sourcecode.config.mongodb_config import get_collection
from utils.date_utils import getCurrentIst

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


@router.post("/{reimbursement_id}/approve", status_code=status.HTTP_200_OK)
async def approveReimbursement(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Approve a reimbursement (manager/owner/CA action).
              UPDATED: Works for all reviewer types including CA (no separate route needed).
    Access  : Current reviewer only.
    """
    try:
        objLogger.info(f"📥 APPROVE API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictNew = await transition(reimbursement_id, strUserId, "APPROVE", {})

        objLogger.info(f"✅ APPROVED | new status: {dictNew.get('status')}")
        dictNew["_id"] = str(dictNew["_id"])
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ APPROVE VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ APPROVE ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/query", status_code=status.HTTP_200_OK)
async def queryReimbursement(
    reimbursement_id: str,
    objRequest: QueryRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Raise a query on a reimbursement (any reviewer → initiator).
              UPDATED: Unified route for all reviewer types including CA.
    Access  : Current reviewer only.
    """
    try:
        objLogger.info(f"📥 QUERY API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = await transition(reimbursement_id, strUserId, "QUERY", dictPayload)

        objLogger.info(f"✅ QUERY RAISED | new status: {dictNew.get('status')}")
        dictNew["_id"] = str(dictNew["_id"])
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ QUERY VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ QUERY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/ask", status_code=status.HTTP_200_OK)
async def askReimbursement(
    reimbursement_id: str,
    objRequest: AskRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Raise a private ask on a reimbursement (any reviewer ↔ initiator).
              UPDATED: Works for all reviewer types.
    Access  : Current reviewer only.
    """
    try:
        objLogger.info(f"📥 ASK API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "private"}
        dictNew = await transition(reimbursement_id, strUserId, "ASK", dictPayload)

        objLogger.info(f"✅ ASK RAISED | new status: {dictNew.get('status')}")
        dictNew["_id"] = str(dictNew["_id"])
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ ASK VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ ASK ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/reapply", status_code=status.HTTP_200_OK)
async def reapplyReimbursement(
    reimbursement_id: str,
    objRequest: ReapplyRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Re-apply after a query or ask (initiator → current reviewer).
              UPDATED: Handles bIsReApply flag for initiator step tracking.
    Access  : Initiator only.
    """
    try:
        objLogger.info(f"📥 REAPPLY API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = await transition(reimbursement_id, strUserId, "REAPPLY", dictPayload)

        objLogger.info(f"✅ REAPPLIED | new status: {dictNew.get('status')}")
        dictNew["_id"] = str(dictNew["_id"])
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ REAPPLY VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ REAPPLY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


# ─── Payment & Final Actions ──────────────────────────────────────────────────
@router.post("/{reimbursement_id}/pay", status_code=status.HTTP_200_OK)
async def payReimbursement(
    reimbursement_id: str,
    objRequest: PayRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Mark a reimbursement as PAID after disbursing funds.
              UPDATED: Unified route (removed /ca/ prefix), works for final reviewer (typically CA).
    Access  : Current reviewer (final step in approval chain).
    Accepts optional payment_proof_attachment_id for proof of payment document.
    """
    try:
        objLogger.info(f"📥 PAY API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dtNow = getCurrentIst()

        dictPayload = {
            "message": objRequest.note or f"Paid (ref: {objRequest.transaction_ref})",
            "visibility": "public",
            "transaction_ref": objRequest.transaction_ref,
            "payment_method": objRequest.payment_method,
        }

        # Include payment proof if attachment provided
        if objRequest.payment_proof_attachment_id:
            dictPayload["payment_proof"] = {
                "attachment_id": objRequest.payment_proof_attachment_id,
                "payment_date": dtNow.isoformat(),
                "paid_by": strUserId,
                "transaction_ref": objRequest.transaction_ref,
                "payment_method": objRequest.payment_method,
            }

        dictNew = await transition(reimbursement_id, strUserId, "PAY", dictPayload)

        objLogger.info(f"✅ MARKED AS PAID | new status: {dictNew.get('status')}")
        dictNew["_id"] = str(dictNew["_id"])
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ PAY VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ PAY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))





@router.post("/{reimbursement_id}/acknowledge", status_code=status.HTTP_200_OK)
async def acknowledgePayment(
    reimbursement_id: str,
    objRequest: AcknowledgeRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Initiator acknowledges payment receipt (PAID → ACKNOWLEDGED).
              UPDATED: Terminal state is ACKNOWLEDGED instead of CLOSED.
    Access  : Initiator only.
    """
    try:
        objLogger.info(f"📥 ACKNOWLEDGE API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictPayload = {
            "message": objRequest.note or "Payment acknowledged",
            "visibility": "public",
        }
        dictNew = await transition(reimbursement_id, strUserId, "ACKNOWLEDGE", dictPayload)

        dictNew["_id"] = str(dictNew["_id"])
        objLogger.info(f"✅ ACKNOWLEDGED | new status: {dictNew.get('status')}")
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ ACKNOWLEDGE VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ ACKNOWLEDGE ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/reject", status_code=status.HTTP_200_OK)
async def rejectReimbursement(
    reimbursement_id: str,
    objRequest: RejectRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Reject a reimbursement (terminal state).
              UPDATED: Unified route (removed /ca/ prefix), works for any reviewer.
    Access  : Current reviewer (typically final reviewer like CA, but can be any reviewer).
    """
    try:
        objLogger.info(f"📥 REJECT API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = await transition(reimbursement_id, strUserId, "REJECT", dictPayload)

        dictNew["_id"] = str(dictNew["_id"])
        objLogger.info(f"✅ REJECTED | new status: {dictNew.get('status')}")
        return {"success": True, "status": dictNew.get("status"), "reimbursement": dictNew}

    except ValueError as objErr:
        objLogger.warning(f"⚠️ REJECT VALIDATION ERROR: {objErr}")
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ REJECT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))

# ─── Step Tracking ─────────────────────────────────────────────────────────────
@router.post("/{reimbursement_id}/mark-viewed", status_code=status.HTTP_200_OK)
async def markReimbursementViewed(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Mark a reimbursement as viewed by current reviewer (sets receivedAt timestamp).
              UPDATED: Auto-detects correct step based on current_reviewer_id.
              Fixes issue where QUERY/ASK changes current_reviewer but not current_step.
    Access  : Current reviewer only.
    """
    try:
        objLogger.info(f"📥 MARK-VIEWED API CALLED | ID: {reimbursement_id} | user: {dictCurrentUser.get('email')}")

        strUserId = dictCurrentUser["user_id"]
        objReimbs = get_collection("reimbursements")

        # Fetch fresh reimbursement data
        dictReimb = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})
        if not dictReimb:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        # Get current reviewer from database
        strCurrentReviewerId = str(dictReimb.get("current_reviewer_id", ""))

        # Verify user is current reviewer
        if strUserId != strCurrentReviewerId:
            objLogger.warning(f"⚠️ User {strUserId} is not current reviewer (current: {strCurrentReviewerId})")
            return {"success": False, "message": "Not current reviewer"}

        # Find correct step by searching approval_chain for matching user_id
        lsChain = dictReimb.get("approval_chain", [])
        iCorrectStep = None

        for iIdx, dictStep in enumerate(lsChain):
            if str(dictStep.get("user_id", "")) == strUserId:
                iCorrectStep = iIdx
                break

        if iCorrectStep is None:
            objLogger.error(f"❌ User {strUserId} not found in approval chain")
            return {"success": False, "message": "User not in approval chain"}

        # Mark the correct step as viewed
        markStepAsViewed(reimbursement_id, iCorrectStep)

        objLogger.info(f"✅ MARKED AS VIEWED | user={strUserId} | step={iCorrectStep}")
        return {"success": True, "message": "Reimbursement marked as viewed", "step": iCorrectStep}

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ MARK-VIEWED ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
