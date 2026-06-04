'''
Purpose : Pydantic schemas for User CRUD operations and hierarchy management.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request/response handling.

Dependencies: pydantic, schemas.auth_schemas, schemas.common_enums
'''

from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr
from schemas.auth_schemas import DepartmentEntrySchema, ManagerEntrySchema, UserProfileSchema, CategoryAllowanceEntrySchema
from schemas.common_enums import UserRoleEnum, ApprovalTypeEnum


class UserDepartmentEntrySchema(DepartmentEntrySchema):
    """Extends DepartmentEntrySchema if needed, or just use as is."""
    pass


class UserCreateRequest(BaseModel):
    """Schema for creating a new user."""
    employee_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    departments: List[DepartmentEntrySchema] = Field(default_factory=list)
    managers: List[ManagerEntrySchema] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    """Schema for updating an existing user profile."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    departments: Optional[List[DepartmentEntrySchema]] = None


class ManagerUpdateEntrySchema(BaseModel):
    """Simplified schema for updating managers."""
    manager_id: str
    priority: int = Field(..., ge=1)
    approval_type: ApprovalTypeEnum = ApprovalTypeEnum.MANDATORY


class UserManagersUpdateRequest(BaseModel):
    """Schema for updating a user's manager hierarchy."""
    managers: List[ManagerUpdateEntrySchema]


class CategoryAllowanceUpdateEntrySchema(BaseModel):
    """Simplified schema for updating category allowances."""
    category_id: str
    sub_category: Optional[str] = None


class UserCategoriesUpdateRequest(BaseModel):
    """Schema for updating a user's default category allowances."""
    default_allowances: List[CategoryAllowanceUpdateEntrySchema]


class UserResponseSchema(UserProfileSchema):
    """Schema for returning full user details, inheriting from UserProfileSchema."""
    pass
