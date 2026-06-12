'''
Purpose : Pydantic schemas for Approval Chain data structures.
          Defines chain node, chain response, and reviewer action tracking.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for approval chain handling.

Dependencies: pydantic, typing
'''

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ApprovalChainNodeSchema(BaseModel):
    """
    Enhanced schema for a single step in the embedded approval chain.
    Includes detailed tracking of receivedAt, submittedAt, and bIsReApply.

    Note: step 0 is always the initiator
    """
    step: int = Field(..., description="Step index (0=initiator, 1+=reviewers)")
    user_id: str = Field(..., description="User ID for this step")
    username: str = Field(..., description="User full name for display")
    role: str = Field(..., description="User role (initiator, manager, owner, ca)")
    current_status: str = Field(..., description="Step status: PENDING | IN_REVIEW | QUERY | ASK | APPROVED | REJECTED | PAID | SUBMITTED | REAPPLIED | ACKNOWLEDGED")
    receivedAt: Optional[str] = Field(None, description="ISO datetime when user opened reimbursement after assignment")
    submittedAt: Optional[str] = Field(None, description="ISO datetime when user took action")
    bIsReApply: bool = Field(default=False, description="True if initiator resubmitted after query/ask (only for step 0)")

    # DEPRECATED: Keep for backward compatibility with old data
    level: Optional[int] = Field(None, description="DEPRECATED: Use step instead")
    name: Optional[str] = Field(None, description="DEPRECATED: Use username instead")
    email: Optional[str] = Field(None, description="DEPRECATED: User email")
    priority: Optional[int] = Field(None, description="DEPRECATED: Priority value from manager hierarchy")
    approval_type: Optional[str] = Field(None, description="DEPRECATED: mandatory | optional")
    status: Optional[str] = Field(None, description="DEPRECATED: Use current_status instead")
    received_date: Optional[str] = Field(None, description="DEPRECATED: Use receivedAt instead")
    response_date: Optional[str] = Field(None, description="DEPRECATED: Use submittedAt instead")
    action: Optional[str] = Field(None, description="DEPRECATED: Action taken")
    approved_at: Optional[str] = Field(None, description="DEPRECATED")
    approved_by: Optional[str] = Field(None, description="DEPRECATED")


class ApprovalChainResponseSchema(BaseModel):
    """
    Schema for GET /api/reimbursements/{id}/chain response.
    Contains approval chain with current reviewer and logs.
    """
    current_reviewer_id: str = Field(default="", description="User ID of current reviewer")
    current_step: int = Field(default=0, description="Current step index in approval chain")
    approval_chain: List[ApprovalChainNodeSchema] = Field(default_factory=list)
    logs: List[dict] = Field(default_factory=list, description="Activity logs")


class ReviewerActionSchema(BaseModel):
    """
    Schema for tracking reviewer actions and SLA compliance.
    """
    reviewer_id: str
    reviewer_name: str
    action: str  # PENDING, VIEWED, APPROVED, REJECTED, QUERY, ASK
    received_date: Optional[datetime] = None
    response_date: Optional[datetime] = None
    remaining_days: Optional[int] = None
    is_overdue: bool = False


class ApprovalTreeNodeSchema(BaseModel):
    """
    Schema for a node in the complete approval tree (full hierarchy).
    Used for storing the complete tree structure.
    """
    user_id: str
    name: str
    email: str
    role: str
    level: int
    priority: int
    approval_type: str
    status: str = "PENDING"
    children: List['ApprovalTreeNodeSchema'] = Field(default_factory=list)


class ApprovalTreeSchema(BaseModel):
    """
    Schema for the complete approval tree.
    """
    initiator_id: str
    initiator_name: str
    branches: List[ApprovalTreeNodeSchema] = Field(default_factory=list)
