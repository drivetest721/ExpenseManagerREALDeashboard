'''
Purpose : Pydantic schemas for Approval actions (approve, query, ask, reapply).

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request handling.

Dependencies: pydantic
'''

from typing import Optional
from pydantic import BaseModel, Field


class ApproveRequest(BaseModel):
    """Schema for approving a reimbursement."""
    pass  # No body needed, action is implicit


class QueryRequest(BaseModel):
    """Schema for raising a query on a reimbursement."""
    message: str = Field(..., min_length=1, max_length=1000)


class AskRequest(BaseModel):
    """Schema for raising a private ask on a reimbursement."""
    message: str = Field(..., min_length=1, max_length=1000)


class ReapplyRequest(BaseModel):
    """Schema for re-applying after a query or ask."""
    message: str = Field(..., min_length=1, max_length=1000)


class PaymentProofSchema(BaseModel):
    """Schema for storing payment proof details."""
    attachment_id: str  # reference to the uploaded proof file
    payment_date: str  # ISO datetime when payment was marked as paid
    paid_by: str  # user_id of the CA who marked as paid
    transaction_ref: str
    payment_method: Optional[str] = None


class PayRequest(BaseModel):
    """Schema for marking reimbursement as paid (CA action)."""
    transaction_ref: str = Field(..., min_length=1, max_length=200)
    payment_method: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = Field(None, max_length=1000)
    payment_proof_attachment_id: Optional[str] = Field(None, description="Attachment ID for proof of payment document")


class CAQueryRequest(BaseModel):
    """Schema for CA raising a query on a reimbursement."""
    message: str = Field(..., min_length=1, max_length=1000)


class CAReapplyRequest(BaseModel):
    """Schema for initiator responding to a CA query."""
    message: str = Field(..., min_length=1, max_length=1000)


class AcknowledgeRequest(BaseModel):
    """Schema for initiator acknowledging payment receipt."""
    note: Optional[str] = Field(None, max_length=1000)


class RejectRequest(BaseModel):
    """Schema for CA rejecting a reimbursement."""
    message: str = Field(..., min_length=1, max_length=1000)
