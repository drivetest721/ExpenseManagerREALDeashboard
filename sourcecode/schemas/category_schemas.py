'''
Purpose : Pydantic schemas for Reimbursement Category CRUD operations and the
          Allowance read-only views.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request/response handling.

Dependencies: pydantic, schemas.common_enums
'''

from typing import List, Optional
from pydantic import BaseModel, Field

from schemas.common_enums import UserRoleEnum


class CategoryCreateRequest(BaseModel):
    """Schema for creating a new reimbursement category."""
    category_id: str = Field(..., description="Unique 3-digit identifier for the category")
    name: str = Field(..., min_length=2, max_length=100)
    sub_categories: List[str] = Field(default_factory=list)
    max_limit: float = Field(..., ge=0, description="Maximum amount the company will reimburse for this category.")
    allowed_roles: List[UserRoleEnum] = Field(default_factory=list, description="Roles that may demand this category.")
    department_ids: List[str] = Field(default_factory=list, description="Departments scoped to this category; empty = global.")
    requires_invoice: bool = Field(default=True)
    approval_required: bool = Field(default=True)


class CategoryUpdateRequest(BaseModel):
    """Schema for updating an existing category (partial)."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    sub_categories: Optional[List[str]] = None
    max_limit: Optional[float] = Field(None, ge=0)
    allowed_roles: Optional[List[UserRoleEnum]] = None
    department_ids: Optional[List[str]] = None
    requires_invoice: Optional[bool] = None
    approval_required: Optional[bool] = None
    is_active: Optional[bool] = None


class CategoryResponseSchema(BaseModel):
    """Schema for returning a category."""
    category_id: str
    name: str
    sub_categories: List[str] = Field(default_factory=list)
    max_limit: float
    allowed_roles: List[UserRoleEnum] = Field(default_factory=list)
    department_ids: List[str] = Field(default_factory=list)
    requires_invoice: bool = True
    approval_required: bool = True
    is_active: bool = True


# ── Allowance views ───────────────────────────────────────────────────────────


class AssigneeSchema(BaseModel):
    """Minimal user reference attached to an allowance view."""
    user_id: str
    name: str
    email: str
    role: UserRoleEnum
    department_id: Optional[str] = None
    department_name: Optional[str] = None


class AllowanceWithAssigneesSchema(CategoryResponseSchema):
    """Admin/Owner view — category blueprint + matched assignees."""
    assignees: List[AssigneeSchema] = Field(default_factory=list)
