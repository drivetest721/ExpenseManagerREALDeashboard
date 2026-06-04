'''
Purpose : Pydantic schemas for Authentication API endpoints.
          Validates login request body and shapes the JWT login response
          and /me profile response.

Inputs  : HTTP request bodies / MongoDB user documents.

Output  : Validated Python objects consumed by auth_routes.py.

Dependencies: pydantic, schemas.common_enums
'''

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

from schemas.common_enums import UserRoleEnum


# ── Request Schemas ────────────────────────────────────────────────────────────

class LoginRequestSchema(BaseModel):
    """POST /api/auth/login — request body."""

    email: EmailStr = Field(..., description="Registered employee email address")
    password: str = Field(..., min_length=1, description="Account password (plain-text over HTTPS)")

    model_config = {"str_strip_whitespace": True}


class SignupRequestSchema(BaseModel):
    """POST /api/auth/signup — request body."""

    name: str = Field(..., min_length=2, max_length=100, description="Full name")
    email: EmailStr = Field(..., description="Email address to register and verify")
    password: str = Field(..., min_length=6, max_length=72, description="Account password")
    employee_id: Optional[str] = Field(None, max_length=50, description="Optional company employee ID")

    model_config = {"str_strip_whitespace": True}


class VerifyEmailRequestSchema(BaseModel):
    """POST /api/auth/verify-email — request body."""

    email: EmailStr = Field(..., description="Email address being verified")
    code: str = Field(..., min_length=4, max_length=10, description="Verification code received via email")

    model_config = {"str_strip_whitespace": True}


class ResendCodeRequestSchema(BaseModel):
    """POST /api/auth/resend-code — request body."""

    email: EmailStr = Field(..., description="Email address to receive a fresh code")

    model_config = {"str_strip_whitespace": True}


# ── Nested / shared ────────────────────────────────────────────────────────────

class DepartmentEntrySchema(BaseModel):
    """Single department-role entry embedded in user profile."""

    department_id: str = Field(..., description="ObjectId of the department (string)")
    department_name: Optional[str] = Field(None, description="Resolved department name")
    role: UserRoleEnum = Field(..., description="User's role within this department")
    is_primary: bool = Field(default=True, description="Whether this is the user's primary department")


class ManagerEntrySchema(BaseModel):
    """Single manager-priority entry embedded in user profile."""

    manager_id: str = Field(..., description="ObjectId of the manager user")
    manager_name: Optional[str] = Field(None, description="Resolved manager full name")
    priority: int = Field(..., ge=1, description="Approval order (1 = first approver)")
    approval_type: str = Field(..., description="mandatory | optional")


class CategoryAllowanceEntrySchema(BaseModel):
    """Single category allowance entry for default reimbursement categories assigned to user."""

    category_id: str = Field(..., description="ObjectId of the category")
    category_name: Optional[str] = Field(None, description="Resolved category name")
    sub_category: Optional[str] = Field(None, description="Specific sub-category within the category")


# ── Response Schemas ───────────────────────────────────────────────────────────

class UserProfileSchema(BaseModel):
    """Minimal user profile embedded in login + /me responses."""

    user_id: str = Field(..., description="MongoDB _id as string")
    employee_id: Optional[str] = Field(None, description="Company employee ID (e.g. EMP001)")
    name: str = Field(..., description="Full name")
    email: str = Field(..., description="Email address")
    departments: List[DepartmentEntrySchema] = Field(default_factory=list)
    managers: List[ManagerEntrySchema] = Field(default_factory=list)
    default_allowances: List[CategoryAllowanceEntrySchema] = Field(
        default_factory=list,
        description="Default reimbursement categories assigned to this user",
    )
    is_active: bool = Field(default=True)
    has_payment_method: bool = Field(
        default=False,
        description="True if the user has at least one payment method on file",
    )
    ask_public_key: Optional[str] = Field(
        None,
        description="RSA public key for encrypting private Ask messages",
    )

    model_config = {"from_attributes": True}


class LoginResponseSchema(BaseModel):
    """POST /api/auth/login — success response."""

    success: bool = Field(default=True)
    message: str = Field(default="Login successful")
    access_token: str = Field(..., description="JWT bearer token")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(..., description="Token validity in seconds")
    user: UserProfileSchema


class MeResponseSchema(BaseModel):
    """GET /api/auth/me — success response."""

    success: bool = Field(default=True)
    user: UserProfileSchema


class LogoutResponseSchema(BaseModel):
    """POST /api/auth/logout — success response."""

    success: bool = Field(default=True)
    message: str = Field(default="Logged out successfully")


class SignupResponseSchema(BaseModel):
    """POST /api/auth/signup — success response."""

    success: bool = Field(default=True)
    message: str = Field(default="Verification code sent to your email")
    email: EmailStr = Field(..., description="Email the code was sent to")
    expires_in: int = Field(..., description="Code validity window in seconds")


class ResendCodeResponseSchema(BaseModel):
    """POST /api/auth/resend-code — success response."""

    success: bool = Field(default=True)
    message: str = Field(default="A new verification code has been sent")
    expires_in: int = Field(..., description="Code validity window in seconds")
