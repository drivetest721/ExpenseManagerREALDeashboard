'''
Purpose : Approval action routes (approve, query, ask, reapply).

Inputs  : HTTP requests (path params, JSON bodies).

Output  : JSON success/error responses.

Dependencies: fastapi, jwt_middleware, approval_schemas, ReimbursementStateMachine
'''
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone

from middleware.jwt_middleware import getCurrentUserDependency
from schemas.approval_schemas import (
    ApproveRequest,
    QueryRequest,
    AskRequest,
    ReapplyRequest,
    PayRequest,
    CAQueryRequest,
    CAReapplyRequest,
    AcknowledgeRequest,
    RejectRequest,
    PaymentProofSchema,
)
from controllers.ReimbursementStateMachine import transition

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


@router.post("/{reimbursement_id}/approve", status_code=status.HTTP_200_OK)
async def approveReimbursement(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Approve a reimbursement (manager action).
    Access  : Current reviewer only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictNew = transition(reimbursement_id, strUserId, "APPROVE")
        
        return {"success": True, "status": dictNew.get("status")}
    
    except ValueError as objErr:
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
    Purpose : Raise a query on a reimbursement (manager → initiator).
    Access  : Current reviewer only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = transition(reimbursement_id, strUserId, "QUERY", dictPayload)
        
        return {"success": True, "status": dictNew.get("status")}
    
    except ValueError as objErr:
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
    Purpose : Raise a private ask on a reimbursement (manager ↔ initiator).
    Access  : Current reviewer only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "private"}
        dictNew = transition(reimbursement_id, strUserId, "ASK", dictPayload)
        
        return {"success": True, "status": dictNew.get("status")}
    
    except ValueError as objErr:
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
    Purpose : Re-apply after a query or ask (initiator → manager).
    Access  : Initiator only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = transition(reimbursement_id, strUserId, "REAPPLY", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ REAPPLY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


# ─── CA Workflow Routes ────────────────────────────────────────────────────────

@router.post("/{reimbursement_id}/ca/pay", status_code=status.HTTP_200_OK)
async def payReimbursement(
    reimbursement_id: str,
    objRequest: PayRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : CA marks a reimbursement as PAID after disbursing funds.
    Access  : Current reviewer (must be CA).
    Accepts optional payment_proof_attachment_id for proof of payment document.
    """
    try:
        
        strUserId = dictCurrentUser["user_id"]
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
                "payment_date": datetime.now(timezone.utc).isoformat(),
                "paid_by": strUserId,
                "transaction_ref": objRequest.transaction_ref,
                "payment_method": objRequest.payment_method,
            }
        
        dictNew = transition(reimbursement_id, strUserId, "PAY", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ PAY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/ca/query", status_code=status.HTTP_200_OK)
async def caQueryReimbursement(
    reimbursement_id: str,
    objRequest: CAQueryRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : CA raises a query before payment (one-shot only per spec).
    Access  : Current reviewer (must be CA).
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = transition(reimbursement_id, strUserId, "CA_QUERY", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ CA_QUERY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/ca/reapply", status_code=status.HTTP_200_OK)
async def caReapplyReimbursement(
    reimbursement_id: str,
    objRequest: CAReapplyRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Initiator responds to a CA query.
    Access  : Initiator only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = transition(reimbursement_id, strUserId, "CA_REAPPLY", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ CA_REAPPLY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/acknowledge", status_code=status.HTTP_200_OK)
async def acknowledgePayment(
    reimbursement_id: str,
    objRequest: AcknowledgeRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Initiator acknowledges payment receipt (PAID → CLOSED).
    Access  : Initiator only.
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {
            "message": objRequest.note or "Payment acknowledged",
            "visibility": "public",
        }
        dictNew = transition(reimbursement_id, strUserId, "ACKNOWLEDGE", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ ACKNOWLEDGE ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/ca/reject", status_code=status.HTTP_200_OK)
async def rejectReimbursement(
    reimbursement_id: str,
    objRequest: RejectRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : CA rejects a reimbursement (terminal).
    Access  : Current reviewer (must be CA).
    """
    try:
        strUserId = dictCurrentUser["user_id"]
        dictPayload = {"message": objRequest.message, "visibility": "public"}
        dictNew = transition(reimbursement_id, strUserId, "REJECT", dictPayload)

        return {"success": True, "status": dictNew.get("status")}

    except ValueError as objErr:
        raise HTTPException(status_code=400, detail=str(objErr))
    except Exception as objErr:
        objLogger.error(f"❌ REJECT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
