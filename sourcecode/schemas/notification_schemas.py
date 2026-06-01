'''
Purpose : Pydantic schemas for in-app Notifications.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request handling.

Dependencies: pydantic
'''

from typing import Optional, List
from pydantic import BaseModel, Field


class NotificationResponseSchema(BaseModel):
    """A single notification row served to the frontend."""
    notification_id: str
    user_id: str
    type: str  # e.g. APPROVAL_PENDING, QUERY_RAISED, PAID, ACKNOWLEDGED, REJECTED, ASK
    title: str
    message: str
    reimbursement_id: Optional[str] = None
    is_read: bool = False
    created_at: str


class NotificationListResponse(BaseModel):
    """List response with unread count."""
    notifications: List[NotificationResponseSchema]
    unread_count: int


class MarkReadRequest(BaseModel):
    """Mark one or more notifications as read."""
    notification_ids: List[str] = Field(default_factory=list)
    mark_all: bool = False
