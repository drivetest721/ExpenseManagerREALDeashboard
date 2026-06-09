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
    Schema for a single node in the approval chain.
    Represents one reviewer in the chain.
    """
    level: int = Field(..., description="Position in chain (1 = first reviewer)")
    user_id: str = Field(..., description="Reviewer user ID")
    name: str = Field(..., description="Reviewer full name")
    email: str = Field(..., description="Reviewer email")
    role: str = Field(..., description="Reviewer role (manager, owner, ca, etc.)")
    priority: int = Field(..., description="Priority value from manager hierarchy")
    approval_type: str = Field(..., description="mandatory | optional")
    status: str = Field(default="PENDING", description="PENDING | VIEWED | APPROVED | REJECTED | QUERY_RAISED")
    
    # Action tracking
    received_date: Optional[str] = Field(None, description="ISO datetime when reviewer first viewed after assignment")
    response_date: Optional[str] = Field(None, description="ISO datetime when reviewer took action (approve/reject/query)")
    action: Optional[str] = Field(None, description="Action taken: APPROVED | REJECTED | QUERY | ASK")
    
    # Additional metadata
    approved_at: Optional[str] = Field(None, description="ISO datetime when approved (legacy)")
    approved_by: Optional[str] = Field(None, description="User ID who approved (legacy)")


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
