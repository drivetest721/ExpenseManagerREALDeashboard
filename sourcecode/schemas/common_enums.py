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
    """Full state-machine statuses for a reimbursement record."""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    QUERY_RAISED = "QUERY_RAISED"
    PRIVATE_ASK = "PRIVATE_ASK"
    REAPPLIED = "REAPPLIED"
    OWNER_APPROVED = "OWNER_APPROVED"
    CA_PENDING = "CA_PENDING"
    CA_QUERY = "CA_QUERY"
    CA_REAPPLIED = "CA_REAPPLIED"
    PAID = "PAID"
    PAYMENT_ACKNOWLEDGED = "PAYMENT_ACKNOWLEDGED"
    REJECTED = "REJECTED"
    AUTO_REJECTED = "AUTO_REJECTED"
    CLOSED = "CLOSED"


class FormTypeEnum(str, Enum):
    """Type of reimbursement form the initiator submitted."""
    GENERAL = "general"
    BUSINESS_TRIP = "business_trip"


# ---------------------------------------------------------------------------
# Approval Chain / Log Enums
# ---------------------------------------------------------------------------

class ActionTypeEnum(str, Enum):
    """Actions recorded in the reimbursement_logs collection."""
    DRAFT_SAVED = "DRAFT_SAVED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    QUERY_RAISED = "QUERY_RAISED"
    PRIVATE_ASK = "PRIVATE_ASK"
    REAPPLIED = "REAPPLIED"
    OWNER_APPROVED = "OWNER_APPROVED"
    SENT_TO_CA = "SENT_TO_CA"
    CA_QUERY = "CA_QUERY"
    CA_REAPPLIED = "CA_REAPPLIED"
    PAID = "PAID"
    PAYMENT_ACKNOWLEDGED = "PAYMENT_ACKNOWLEDGED"
    REJECTED = "REJECTED"
    AUTO_REJECTED = "AUTO_REJECTED"
    CLOSED = "CLOSED"


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
