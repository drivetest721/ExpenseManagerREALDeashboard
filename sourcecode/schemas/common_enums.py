'''
Purpose : Shared enumerations used across all features of the Expense Management system.
          Import from here to avoid duplication and enforce consistency.

Inputs  : None (pure definitions)

Output  : Enum classes consumed by Pydantic schemas, routes, and controllers.

Dependencies: None (stdlib only)
'''

from enum import Enum


# ---------------------------------------------------------------------------
# User / Role Enums
# ---------------------------------------------------------------------------

class UserRoleEnum(str, Enum):
    """Roles a user may hold within a department."""
    OWNER = "owner"
    MANAGER = "manager"
    SENIOR_MANAGER = "senior_manager"
    EMPLOYEE = "employee"
    CA = "ca"
    INTERN = "intern"


class ApprovalTypeEnum(str, Enum):
    """Determines whether an approver in the chain is required or optional."""
    MANDATORY = "mandatory"
    OPTIONAL = "optional"


# ---------------------------------------------------------------------------
# Reimbursement Core Enums
# ---------------------------------------------------------------------------

class ReimbursementStatusEnum(str, Enum):
    """
    Simplified state-machine statuses for a reimbursement record.

    States:
    - DRAFT: Initial draft, not yet submitted
    - SUBMITTED: First submission by initiator
    - IN_REVIEW: Being reviewed by current reviewer
    - QUERY: Reviewer raised a query (public)
    - ASK: Reviewer raised an ask (private communication)
    - REAPPLIED: Initiator responded to query/ask
    - REJECTED: CA rejected the reimbursement (terminal state)
    - PAID: CA marked as paid
    - ACKNOWLEDGED: Initiator acknowledged payment (terminal state)
    """
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    QUERY = "QUERY"
    ASK = "ASK"
    REAPPLIED = "REAPPLIED"
    REJECTED = "REJECTED"
    PAID = "PAID"
    ACKNOWLEDGED = "ACKNOWLEDGED"

    # DEPRECATED: Keep for backward compatibility with old data
    QUERY_RAISED = "QUERY_RAISED"
    PRIVATE_ASK = "PRIVATE_ASK"
    OWNER_APPROVED = "OWNER_APPROVED"
    CA_PENDING = "CA_PENDING"
    CA_QUERY = "CA_QUERY"
    CA_REAPPLIED = "CA_REAPPLIED"
    PAYMENT_ACKNOWLEDGED = "PAYMENT_ACKNOWLEDGED"
    AUTO_REJECTED = "AUTO_REJECTED"
    CLOSED = "CLOSED"


class FormTypeEnum(str, Enum):
    """Type of reimbursement form the initiator submitted."""
    GENERAL = "general"
    BUSINESS_TRIP = "business_trip"


# ---------------------------------------------------------------------------
# Approval Chain / Log Enums
# ---------------------------------------------------------------------------

class LogTypeEnum(str, Enum):
    """Type of log entry in reimbursement_logs collection."""
    EDIT = "edit"
    ACTIVITY = "activity"
    VIEW = "view"


class ActionTypeEnum(str, Enum):
    """Actions recorded in the reimbursement_logs collection."""
    # Activity actions (NEW simplified)
    DRAFT_SAVED = "DRAFT_SAVED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    QUERY = "QUERY"
    ASK = "ASK"
    REAPPLIED = "REAPPLIED"
    PAID = "PAID"
    REJECTED = "REJECTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    VIEWED = "VIEWED"  # When reviewer opens reimbursement

    # DEPRECATED: Keep for backward compatibility
    QUERY_RAISED = "QUERY_RAISED"
    PRIVATE_ASK = "PRIVATE_ASK"
    OWNER_APPROVED = "OWNER_APPROVED"
    SENT_TO_CA = "SENT_TO_CA"
    CA_QUERY = "CA_QUERY"
    CA_REAPPLIED = "CA_REAPPLIED"
    PAYMENT_ACKNOWLEDGED = "PAYMENT_ACKNOWLEDGED"
    AUTO_REJECTED = "AUTO_REJECTED"
    CLOSED = "CLOSED"

    # Edit actions
    FIELD_CHANGED = "FIELD_CHANGED"
    ATTACHMENT_UPLOADED = "ATTACHMENT_UPLOADED"
    ATTACHMENT_REMOVED = "ATTACHMENT_REMOVED"
    BUTTON_CLICKED = "BUTTON_CLICKED"

    # View actions
    PAGE_VIEWED = "PAGE_VIEWED"


class VisibilityEnum(str, Enum):
    """Controls who can see a log entry in the chain view."""
    PUBLIC = "public"      # All participants + owner/admin
    PRIVATE = "private"    # Only sender, initiator, and owner/admin


# ---------------------------------------------------------------------------
# Payment Method Enum
# ---------------------------------------------------------------------------

class PaymentMethodTypeEnum(str, Enum):
    """Payment method options available to the initiator."""
    UPI_ID = "UPI_ID"
    QR_CODE = "QR_CODE"


# ---------------------------------------------------------------------------
# Notification Enum
# ---------------------------------------------------------------------------

class NotificationTypeEnum(str, Enum):
    """Classifies the subject of an in-app notification."""
    REIMBURSEMENT = "REIMBURSEMENT"
    SLA_OVERDUE = "SLA_OVERDUE"
    SYSTEM = "SYSTEM"
