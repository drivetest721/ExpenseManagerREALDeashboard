'''
Purpose : Pydantic schemas for Payment Method CRUD operations.
          Users can store UPI ID or QR scanner images for receiving reimbursement payments.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request/response handling.

Dependencies: pydantic, schemas.common_enums
'''

from typing import Optional
from pydantic import BaseModel, Field

from schemas.common_enums import PaymentMethodTypeEnum


class PaymentMethodCreateRequest(BaseModel):
    """Schema for creating a new payment method."""
    type: PaymentMethodTypeEnum = Field(..., description="UPI_ID or QR_CODE")
    upi_id: Optional[str] = Field(None, min_length=3, max_length=100, description="UPI ID (e.g., user@paytm)")
    qr_image_url: Optional[str] = Field(None, description="URL to uploaded QR image (from attachment service)")
    is_default: bool = Field(default=False, description="Set as the default payment method")


class PaymentMethodUpdateRequest(BaseModel):
    """Schema for updating an existing payment method."""
    is_default: Optional[bool] = None


class PaymentMethodResponseSchema(BaseModel):
    """Schema for returning a payment method."""
    payment_method_id: str
    user_id: str
    type: PaymentMethodTypeEnum
    upi_id: Optional[str] = None
    qr_image_url: Optional[str] = None
    is_default: bool = False
