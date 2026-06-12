'''
Purpose : Pydantic schemas for Reimbursement CRUD operations and chain view.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request/response handling.

Dependencies: pydantic, schemas.common_enums
'''

from typing import List, Optional
from datetime import date
from pydantic import BaseModel, Field

from schemas.common_enums import FormTypeEnum, ReimbursementStatusEnum, LogTypeEnum
from schemas.approval_chain_schemas import ApprovalChainNodeSchema


class ReimbursementItemSchema(BaseModel):
    """Schema for a single line item in a reimbursement."""
    category_id: str
    category_name: Optional[str] = None          # resolved from categories collection
    sub_category: Optional[str] = None
    amount: float = Field(..., ge=0)
    expense_date: date
    description: str = Field(..., min_length=3, max_length=500)
    attachments: List[str] = Field(default_factory=list, description="List of attachment_id references")


class BusinessTripMetaSchema(BaseModel):
    """Schema for business trip metadata."""
    from_date: date
    to_date: date


class ReimbursementCreateRequest(BaseModel):
    """Schema for creating a new reimbursement (draft or submit)."""
    form_type: FormTypeEnum
    description: Optional[str] = Field(None, max_length=250, description="Overall reimbursement description")
    items: List[ReimbursementItemSchema] = Field(..., min_length=1)
    business_trip_meta: Optional[BusinessTripMetaSchema] = None


class ReimbursementUpdateRequest(BaseModel):
    """Schema for updating a draft reimbursement (partial)."""
    description: Optional[str] = Field(None, max_length=250)
    items: Optional[List[ReimbursementItemSchema]] = None
    business_trip_meta: Optional[BusinessTripMetaSchema] = None


class PaymentProofSchema(BaseModel):
    """Schema for payment proof details."""
    attachment_id: str
    payment_date: str
    paid_by: str
    transaction_ref: str
    payment_method: Optional[str] = None


class ReimbursementResponseSchema(BaseModel):
    """
    Schema for returning a reimbursement.

    Enhanced with:
    - approval_chain: Embedded approval chain with detailed step tracking
    - current_reviewer_id: Current reviewer user ID
    - current_step: Current step in approval chain
    - submitted_at: First submission timestamp
    """
    reimbursement_id: str
    reimbursement_code: Optional[str] = None     # DEPRECATED: e.g. RB-2026-000001 (keep for backward compat)
    initiator_id: str
    initiator_name: str
    form_type: FormTypeEnum
    status: ReimbursementStatusEnum
    description: Optional[str] = None
    items: List[ReimbursementItemSchema]
    business_trip_meta: Optional[BusinessTripMetaSchema] = None
    payment_proof: Optional[PaymentProofSchema] = None  # Payment proof when status is PAID or later

    # NEW: Enhanced approval chain tracking
    approval_chain: Optional[List[ApprovalChainNodeSchema]] = Field(default_factory=list, description="Embedded approval chain with step tracking")
    current_reviewer_id: Optional[str] = Field(None, description="Current reviewer user ID")
    current_step: Optional[int] = Field(None, description="Current step index in approval chain")
    submitted_at: Optional[str] = Field(None, description="First submission timestamp")

    created_at: str
    updated_at: str


class ReimbursementItemSummarySchema(BaseModel):
    """Condensed item for list/table view — includes resolved category name."""
    category_id: str
    category_name: Optional[str] = None
    sub_category: Optional[str] = None
    amount: float
    expense_date: Optional[str] = None
    description: Optional[str] = None


class ReimbursementListItemSchema(BaseModel):
    """Schema for list view (condensed)."""
    reimbursement_id: str
    reimbursement_code: Optional[str] = None
    initiator_id: str
    initiator_name: str
    form_type: FormTypeEnum
    status: ReimbursementStatusEnum
    description: Optional[str] = None
    total_amount: float
    current_reviewer_id: Optional[str] = None
    current_step: Optional[int] = None
    submitted_at: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    items: List[ReimbursementItemSummarySchema] = Field(default_factory=list)


class ActivityLogSchema(BaseModel):
    """Schema for activity logs (edits, activity, views)."""
    log_id: str
    reimbursement_id: str
    log_type: Optional[LogTypeEnum] = None
    action: str
    action_by: str
    action_by_name: str
    action_by_email: str
    action_by_role: Optional[str] = None
    action_by_department: Optional[str] = None
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    message: Optional[str] = None
    visibility: str = "public"
    created_at: str
