'''
Purpose : Pydantic schemas for in-app Notifications.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request handling.

Dependencies: pydantic
'''

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class NotificationResponseSchema(BaseModel):
    """A single notification row served to the frontend."""
    notification_id: str
    user_id: str
    type: str  # e.g. APPROVAL_PENDING, QUERY_RAISED, PAID, ACKNOWLEDGED, REJECTED, ASK
    title: str
    message: str = Field(default="", description="Plain text message (deprecated, use html_content)")
    html_content: Optional[str] = Field(None, description="Rich HTML notification template")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Structured notification data")
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


class SSENotificationEvent(BaseModel):
    """SSE event for notification updates."""
    event_type: str = Field(..., description="Event type (count_update, error)")
    unread_count: int = Field(default=0, description="Current unread notification count")
    has_new: bool = Field(default=False, description="True if new notifications arrived")
    timestamp: Optional[str] = Field(None, description="Event timestamp")
    message: Optional[str] = Field(None, description="Error message if event_type is error")
