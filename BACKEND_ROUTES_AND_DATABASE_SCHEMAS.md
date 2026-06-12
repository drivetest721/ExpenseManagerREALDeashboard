# Backend Routes and Database Schemas Documentation

**ExpenseManager System - Complete API and Database Reference**

---

## Table of Contents

1. [Overview](#overview)
2. [Backend Routes](#backend-routes)
3. [Database Collections Schema](#database-collections-schema)
4. [Pydantic Schema Models](#pydantic-schema-models)
5. [Enumerations](#enumerations)

---

## Overview

This document provides a comprehensive reference for all backend API routes and database schemas in the ExpenseManager system. The backend is built with FastAPI and MongoDB, using Pydantic for schema validation.

### Technology Stack
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Storage**: GridFS (for file attachments)
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Pydantic schemas

---

## Backend Routes

### Route Organization

All routes are organized under `/api` prefix with the following modules:

```
sourcecode/routes/
├── auth_routes.py              # Authentication & user profile
├── user_routes.py              # User CRUD operations
├── department_routes.py        # Department management
├── category_routes.py          # Reimbursement category management
├── allowance_routes.py         # User allowance views
├── reimbursement_routes.py     # Reimbursement CRUD & submission
├── approval_routes.py          # Approval actions (approve/query/ask/reject)
├── payment_method_routes.py    # Payment method management
├── attachment_routes.py        # File upload/download (GridFS)
├── notification_routes.py      # In-app notifications
├── notification_sse_routes.py  # Server-Sent Events for real-time notifications
├── sla_routes.py               # SLA monitoring & management
├── holiday_routes.py           # Company holiday management
└── analytics_routes.py         # Analytics & reporting
```

---

## 1. Authentication Routes (`/api/auth`)

**File**: `sourcecode/routes/auth_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/auth/login` | User login with email & password | Public | `LoginRequestSchema` | `LoginResponseSchema` (JWT + profile) |
| POST | `/auth/signup` | Initiate user registration | Public | `SignupRequestSchema` | `SignupResponseSchema` |
| POST | `/auth/verify-email` | Verify email with OTP code | Public | `VerifyEmailRequestSchema` | Success message |
| POST | `/auth/resend-code` | Resend verification OTP | Public | `ResendCodeRequestSchema` | `ResendCodeResponseSchema` |
| GET | `/auth/me` | Get current user profile | Authenticated | - | `MeResponseSchema` |
| POST | `/auth/logout` | Invalidate JWT token | Authenticated | - | `LogoutResponseSchema` |

### Key Features
- JWT-based authentication
- Email verification with 6-digit OTP
- Multi-role support (user can have multiple roles across departments)
- Primary role determination for token claims

---

## 2. User Routes (`/api/users`)

**File**: `sourcecode/routes/user_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/users/create` | Create new user | Admin | `UserCreateRequest` | `UserResponseSchema` |
| GET | `/users/list` | List all users (filterable) | Authenticated | Query params | `List[UserResponseSchema]` |
| GET | `/users/{user_id}` | Get user details | Authenticated | - | `UserResponseSchema` |
| PUT | `/users/{user_id}` | Update user profile | Admin | `UserUpdateRequest` | `UserResponseSchema` |
| DELETE | `/users/{user_id}` | Soft-delete user | Admin | - | Success message |
| PUT | `/users/{user_id}/managers` | Update user's managers | Admin | `UpdateManagersRequest` | `UserResponseSchema` |
| PUT | `/users/{user_id}/departments` | Update user's departments | Admin | `UpdateDepartmentsRequest` | `UserResponseSchema` |

### Query Parameters (List)
- `department_id`: Filter by department
- `role`: Filter by role

---

## 3. Department Routes (`/api/departments`)

**File**: `sourcecode/routes/department_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/departments/create` | Create department | Admin | `DepartmentCreateRequest` | `DepartmentResponseSchema` |
| GET | `/departments/list` | List departments | Authenticated | Query params | `List[DepartmentResponseSchema]` |
| PUT | `/departments/{department_id}` | Update department | Admin | `DepartmentUpdateRequest` | `DepartmentResponseSchema` |
| DELETE | `/departments/{department_id}` | Soft-delete department | Admin | - | Success message |

### Query Parameters (List)
- `include_inactive`: Include inactive departments (default: false)

---

## 4. Category Routes (`/api/categories`)

**File**: `sourcecode/routes/category_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/categories/create` | Create reimbursement category | Owner | `CategoryCreateRequest` | `CategoryResponseSchema` |
| GET | `/categories/list` | List categories | Authenticated | Query params | `List[CategoryResponseSchema]` |
| GET | `/categories/{category_id}` | Get category details | Authenticated | - | `CategoryResponseSchema` |
| PUT | `/categories/{category_id}` | Update category | Owner | `CategoryUpdateRequest` | `CategoryResponseSchema` |
| DELETE | `/categories/{category_id}` | Soft-delete category | Owner | - | Success message |

### Query Parameters (List)
- `include_inactive`: Include inactive categories (default: false)

---

## 5. Allowance Routes (`/api/allowance`)

**File**: `sourcecode/routes/allowance_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/allowance/my` | Get eligible categories for current user | Authenticated | - | `List[CategoryResponseSchema]` |
| GET | `/allowance/all` | Get all categories with assignees | Admin | - | `List[AllowanceWithAssigneesSchema]` |

---

## 6. Reimbursement Routes (`/api/reimbursements`)

**File**: `sourcecode/routes/reimbursement_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/reimbursements/draft` | Create draft reimbursement | Authenticated | `ReimbursementCreateRequest` | `ReimbursementResponseSchema` |
| POST | `/reimbursements/{id}/submit` | Submit reimbursement for approval | Authenticated (Initiator) | - | Success message |
| GET | `/reimbursements/my` | List current user's reimbursements | Authenticated | Query params | `List[ReimbursementListItemSchema]` |
| GET | `/reimbursements/team` | List team reimbursements | Authenticated | Query params | `List[ReimbursementListItemSchema]` |
| GET | `/reimbursements/{id}` | Get reimbursement details | Authenticated | - | `ReimbursementResponseSchema` |
| PUT | `/reimbursements/{id}` | Update draft reimbursement | Authenticated (Initiator) | `ReimbursementUpdateRequest` | `ReimbursementResponseSchema` |
| DELETE | `/reimbursements/{id}` | Delete draft reimbursement | Authenticated (Initiator) | - | Success message |
| GET | `/reimbursements/{id}/chain` | Get approval chain | Authenticated | - | `ApprovalChainResponseSchema` |

### Query Parameters (My)
- `status`: Filter by status (DRAFT, SUBMITTED, etc.)
- `limit`: Max results (default: 50)

### Query Parameters (Team)
- `bucket`: Filter bucket (pending-approvals, pending-completion, history)
  - **pending-approvals**: Current reviewer is self
  - **pending-completion**: In approval chain (not current reviewer)
  - **history**: Created by direct reports (or all for Owner/CA)

### Key Features
- Draft creation and submission workflow
- Approval chain generation on submission (frozen snapshot)
- Team visibility based on approval chain and manager relationships
- SLA tracking with received/response dates

---

## 7. Approval Routes (`/api/approvals`)

**File**: `sourcecode/routes/approval_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/approvals/{reimbursement_id}/approve` | Approve reimbursement | Current Reviewer | - | Success message |
| POST | `/approvals/{reimbursement_id}/query` | Raise public query | Current Reviewer | `QueryRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/ask` | Raise private ask | Current Reviewer | `AskRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/reapply` | Respond to query/ask | Initiator | `ReapplyRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/reject` | Reject reimbursement (CA) | CA | `RejectRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/ca-query` | CA raises query | CA | `CAQueryRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/ca-reapply` | Respond to CA query | Initiator | `CAReapplyRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/pay` | Mark as paid | CA | `PayRequest` | Success message |
| POST | `/approvals/{reimbursement_id}/acknowledge` | Acknowledge payment | Initiator | `AcknowledgeRequest` | Success message |

### Reviewer Actions
- **APPROVE**: Move to next reviewer in chain
- **QUERY**: Raise public question (visible to all)
- **ASK**: Raise private question (visible only to initiator and owner)
- **REAPPLY**: Initiator responds to query/ask
- **REJECT**: CA rejects the reimbursement (terminal state)
- **PAY**: CA marks as paid with transaction details
- **ACKNOWLEDGE**: Initiator acknowledges payment receipt (closes reimbursement)

---

## 8. Payment Method Routes (`/api/payment-methods`)

**File**: `sourcecode/routes/payment_method_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/payment-methods/create` | Create payment method | Authenticated | `PaymentMethodCreateRequest` | `PaymentMethodResponseSchema` |
| GET | `/payment-methods/my` | List user's payment methods | Authenticated | - | `List[PaymentMethodResponseSchema]` |
| PUT | `/payment-methods/{id}/set-default` | Set default payment method | Authenticated | - | Success message |
| DELETE | `/payment-methods/{id}` | Delete payment method | Authenticated | - | Success message |

### Payment Method Types
- **UPI_ID**: UPI identifier (e.g., user@paytm)
- **QR_CODE**: QR code image URL (uploaded via attachment service)

---

## 9. Attachment Routes (`/api/attachments`)

**File**: `sourcecode/routes/attachment_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| POST | `/attachments/upload` | Upload file to GridFS | Authenticated | Multipart file | Attachment metadata |
| GET | `/attachments/{id}/meta` | Get attachment metadata | Authenticated | - | File metadata |
| GET | `/attachments/{id}/download` | Download attachment | Authenticated | - | Binary stream |
| GET | `/attachments/{id}/view` | View attachment inline | Authenticated | - | Binary stream |
| DELETE | `/attachments/{id}` | Delete attachment | Admin | - | Success message |

### Supported File Types
- **Images**: jpg, jpeg, png, webp
- **Documents**: pdf, docx

### File Size Limit
- Maximum: 10 MB per file

---

## 10. Notification Routes (`/api/notifications`)

**File**: `sourcecode/routes/notification_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/notifications/list` | List user's notifications | Authenticated | Query params | `NotificationListResponse` |
| GET | `/notifications/unread-count` | Get unread count | Authenticated | - | Unread count |
| POST | `/notifications/mark-read` | Mark notifications as read | Authenticated | `MarkReadRequest` | Success message |
| DELETE | `/notifications/{id}` | Delete notification | Authenticated | - | Success message |

### Query Parameters (List)
- `limit`: Max results (default: 50, max: 200)
- `unread_only`: Show only unread notifications (default: false)

### Server-Sent Events (SSE)

**File**: `sourcecode/routes/notification_sse_routes.py`

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/notifications/stream` | SSE stream for real-time updates | Authenticated | - | Event stream |

---

## 11. SLA Routes (`/api/sla`)

**File**: `sourcecode/routes/sla_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/sla/events` | List SLA events | Admin | Query params | SLA events list |
| POST | `/sla/run` | Manually trigger SLA check | Admin | - | Job summary |

### Query Parameters (Events)
- `resolved`: Filter by resolution status
- `event_type`: Filter by type (REVIEW_PENDING, QUERY_RESPONSE_PENDING)
- `limit`: Max results (default: 50, max: 200)

---

## 12. Holiday Routes (`/api/holidays`)

**File**: `sourcecode/routes/holiday_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/holidays/list` | List all holidays | Authenticated | - | `List[HolidayResponseSchema]` |
| POST | `/holidays/create` | Create holiday | Admin | `HolidayCreateRequest` | `HolidayResponseSchema` |
| DELETE | `/holidays/{id}` | Delete holiday | Admin | - | Success message |

### Purpose
- Company holidays excluded from business-day SLA calculations
- Used by SLA engine for accurate due date computation

---

## 13. Analytics Routes (`/api/analytics`)

**File**: `sourcecode/routes/analytics_routes.py`

### Endpoints

| Method | Endpoint | Purpose | Access | Request Body | Response |
|--------|----------|---------|--------|--------------|----------|
| GET | `/analytics/summary` | High-level KPI dashboard | Admin | - | Summary statistics |
| GET | `/analytics/by-category` | Spending by category | Admin | Query params | Category breakdown |
| GET | `/analytics/by-status` | Count by status | Admin | - | Status breakdown |
| GET | `/analytics/monthly-trend` | Monthly spending trend | Admin | Query params | Trend data |
| GET | `/analytics/top-spenders` | Top spending users | Admin | Query params | User spending list |
| GET | `/analytics/pending-reviewers` | Pending by reviewer | Admin | - | Reviewer workload |

### Query Parameters
- `months`: Number of months to include (default: 6)
- `limit`: Max results for top lists (default: 10)

---

## Database Collections Schema

### MongoDB Collections

The ExpenseManager system uses the following MongoDB collections:

```
Collections:
├── users                       # User profiles and authentication
├── departments                 # Department definitions
├── reimbursement_categories    # Expense categories with limits
├── reimbursements              # Main reimbursement documents
├── reimbursement_items         # Embedded in reimbursements (not separate)
├── reimbursement_logs          # Activity logs
├── approval_steps              # Per-step approval tracking
├── payment_methods             # User payment methods
├── notifications               # In-app notifications
├── sla_events                  # SLA overdue tracking
├── audit_events                # System audit trail
├── holidays                    # Company holidays
├── pending_signups             # Email verification tracking
├── counters                    # Auto-increment counters
└── system_settings             # System configuration
```

---

## 1. Users Collection

**Collection**: `users`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "employee_id": String,              // Unique company employee ID (e.g., EMP001)
  "name": String,                     // Full name
  "email": String,                    // Email (unique, indexed)
  "password_hash": String,            // Bcrypt hashed password
  "is_active": Boolean,               // Account active status
  "has_payment_method": Boolean,      // Whether user has payment method configured

  // Multi-department support
  "departments": [
    {
      "department_id": String,        // Reference to departments collection
      "role": String,                 // owner, manager, senior_manager, employee, ca, intern
      "is_primary": Boolean           // Primary department flag
    }
  ],

  // Manager hierarchy
  "managers": [
    {
      "manager_id": String,           // User ID of manager
      "priority": Integer,            // Lower number = higher priority
      "approval_type": String         // mandatory | optional
    }
  ],

  // Default allowances
  "default_allowances": [
    {
      "category_id": String,          // Reference to reimbursement_categories
      "category_name": String,
      "max_limit": Float
    }
  ]
}
```

### Indexes
- `email` (unique, ascending)
- `employee_id` (unique, ascending, sparse)
- `is_active` (ascending)

---

## 2. Departments Collection

**Collection**: `departments`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "department_id": String,            // Unique department identifier (e.g., DEPT001)
  "department_name": String,          // Department name (unique, indexed)
  "owner_ids": [String],              // Array of user IDs who own this department
  "is_active": Boolean,               // Department active status
  "created_at": String,               // ISO datetime
  "created_by": String                // User ID
}
```

### Indexes
- `department_name` (unique, ascending)

---

## 3. Reimbursement Categories Collection

**Collection**: `reimbursement_categories`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "category_id": String,              // Unique 3-digit identifier (e.g., CAT001)
  "name": String,                     // Category name (indexed)
  "sub_categories": [String],         // Array of sub-category names
  "max_limit": Float,                 // Maximum reimbursement amount
  "allowed_roles": [String],          // Roles eligible for this category
  "department_ids": [String],         // Departments scoped to this category (empty = global)
  "requires_invoice": Boolean,        // Whether invoice is required
  "approval_required": Boolean,       // Whether approval is needed
  "is_active": Boolean,               // Category active status
  "created_at": String,               // ISO datetime
  "created_by": String                // User ID
}
```

### Indexes
- `name` (ascending)
- `is_active` (ascending)

---

## 4. Reimbursements Collection

**Collection**: `reimbursements`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "reimbursement_code": String,       // Unique code (e.g., RB-2026-000123)
  "initiator_id": String,             // User ID of initiator
  "initiator_name": String,           // Cached initiator name
  "form_type": String,                // general | business_trip
  "status": String,                   // Current reimbursement status (see enums)
  "description": String,              // Optional overall description (max 250 chars)

  // Line items (embedded)
  "items": [
    {
      "category_id": String,
      "category_name": String,        // Cached category name
      "sub_category": String,         // Optional sub-category
      "amount": Float,                // Item amount
      "expense_date": String,         // ISO date string
      "description": String,          // Item description (3-500 chars)
      "attachments": [String]         // Array of attachment IDs (GridFS references)
    }
  ],

  // Business trip metadata (optional)
  "business_trip_meta": {
    "from_date": String,              // ISO date
    "to_date": String                 // ISO date
  },

  // Approval chain (frozen snapshot at submission)
  "approval_chain": [
    {
      "level": Integer,               // Position in chain (1 = first reviewer)
      "user_id": String,              // Reviewer user ID
      "name": String,                 // Reviewer name
      "email": String,                // Reviewer email
      "role": String,                 // Reviewer role
      "priority": Integer,            // Priority from manager hierarchy
      "approval_type": String,        // mandatory | optional
      "status": String,               // PENDING | VIEWED | APPROVED | REJECTED | QUERY_RAISED
      "received_date": String,        // ISO datetime when first viewed after assignment
      "response_date": String,        // ISO datetime when action taken
      "action": String                // APPROVED | REJECTED | QUERY | ASK
    }
  ],

  // Current approval tracking
  "current_step": Integer,            // Current step index in approval chain
  "current_reviewer_id": String,      // User ID of current reviewer

  // Payment proof (when status is PAID or later)
  "payment_proof": {
    "attachment_id": String,          // GridFS reference to proof document
    "payment_date": String,           // ISO datetime
    "paid_by": String,                // User ID of CA who paid
    "transaction_ref": String,        // Transaction reference
    "payment_method": String          // Payment method used
  },

  // Timestamps
  "created_at": String,               // ISO datetime
  "updated_at": String,               // ISO datetime
  "submitted_at": String              // ISO datetime when submitted
}
```

### Indexes
- `initiator_id` (ascending)
- `current_reviewer_id` (ascending)
- `status` (ascending)
- `department_id` (ascending)
- `created_at` (descending)
- `reimbursement_code` (unique, ascending)
- Composite: `(current_reviewer_id, status, created_at)` for team queries

---

## 5. Reimbursement Logs Collection

**Collection**: `reimbursement_logs`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "reimbursement_id": String,         // Reference to reimbursements collection
  "log_type": String,                 // edit | activity | view
  "action_type": String,              // See ActionTypeEnum
  "action_by": String,                // User ID who performed action
  "action_by_name": String,           // Cached user name
  "visibility": String,               // public | private
  "message": String,                  // Optional message for queries/asks
  "metadata": Object,                 // Additional action-specific data
  "created_at": String                // ISO datetime
}
```

### Indexes
- Composite: `(reimbursement_id, created_at)` (descending on created_at)
- `action_by` (ascending)

---

## 6. Approval Steps Collection

**Collection**: `approval_steps`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "reimbursement_id": String,         // Reference to reimbursements collection
  "step_index": Integer,              // Step number in approval chain
  "reviewer_id": String,              // User ID of reviewer
  "reviewer_name": String,            // Cached reviewer name
  "status": String,                   // PENDING | APPROVED | REJECTED | QUERY_RAISED
  "received_date": String,            // ISO datetime when first viewed
  "response_date": String,            // ISO datetime when action taken
  "action": String,                   // APPROVED | REJECTED | QUERY | ASK
  "message": String,                  // Optional message
  "created_at": String                // ISO datetime
}
```

### Indexes
- `reimbursement_id` (ascending)
- Composite: `(reviewer_id, status)` (ascending on both)

---

## 7. Payment Methods Collection

**Collection**: `payment_methods`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "user_id": String,                  // Reference to users collection
  "type": String,                     // UPI_ID | QR_CODE
  "upi_id": String,                   // UPI identifier (e.g., user@paytm)
  "qr_image_url": String,             // GridFS attachment ID for QR code image
  "is_default": Boolean               // Whether this is the default payment method
}
```

### Indexes
- `user_id` (ascending)
- Composite: `(user_id, is_default)` (ascending on both)

---

## 8. Notifications Collection

**Collection**: `notifications`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "user_id": String,                  // Recipient user ID
  "type": String,                     // Notification type (see enums)
  "title": String,                    // Notification title
  "message": String,                  // Plain text message (deprecated)
  "html_content": String,             // Rich HTML notification template
  "metadata": {                       // Structured notification data
    "reimbursement_code": String,
    "initiator_name": String,
    "reviewer_name": String,
    "amount": Float,
    // ... other context-specific fields
  },
  "reimbursement_id": String,         // Optional reference to reimbursement
  "is_read": Boolean,                 // Read status
  "created_at": String                // ISO datetime
}
```

### Indexes
- Composite: `(user_id, is_read)` (ascending on both)
- `created_at` (descending)

---

## 9. SLA Events Collection

**Collection**: `sla_events`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "reimbursement_id": String,         // Reference to reimbursements collection
  "event_type": String,               // REVIEW_PENDING | QUERY_RESPONSE_PENDING
  "reviewer_id": String,              // User ID of reviewer
  "due_at": String,                   // ISO datetime when overdue
  "is_resolved": Boolean,             // Whether event is resolved
  "reminder_sent": Boolean,           // Whether reminder notification sent
  "resolve_reason": String,           // Reason for resolution
  "created_at": String                // ISO datetime
}
```

### Indexes
- `reimbursement_id` (ascending)
- Composite: `(due_at, is_resolved)` (ascending on both)

---

## 10. Audit Events Collection

**Collection**: `audit_events`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "collection": String,               // Collection name being audited
  "operation": String,                // INSERT | UPDATE | DELETE
  "reference_id": String,             // Document ID being modified
  "actor_id": String,                 // User ID who performed action
  "old_value": Object,                // Document state before change
  "new_value": Object,                // Document state after change
  "created_at": String                // ISO datetime
}
```

### Indexes
- Composite: `(collection, created_at)` (descending on created_at)
- `actor_id` (ascending)
- `reference_id` (ascending)

---

## 11. Holidays Collection

**Collection**: `holidays`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "date": Date,                       // Date object for SLA calculations
  "date_str": String,                 // ISO date string YYYY-MM-DD (unique)
  "name": String,                     // Holiday name
  "created_at": String,               // ISO datetime
  "created_by": String                // User ID
}
```

### Indexes
- `date` (unique, ascending)

---

## 12. Pending Signups Collection

**Collection**: `pending_signups`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "email": String,                    // Email (unique, indexed)
  "password_hash": String,            // Bcrypt hashed password
  "verification_code": String,        // 6-digit OTP
  "expires_at": Date,                 // Expiration datetime (TTL index)
  "created_at": String                // ISO datetime
}
```

### Indexes
- `email` (unique, ascending)
- `expires_at` (TTL index - auto-deletes after expiration)

---

## 13. Counters Collection

**Collection**: `counters`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "name": String,                     // Counter name (e.g., "reimbursement_code")
  "value": Integer                    // Current counter value
}
```

### Indexes
- `name` (unique, ascending)

---

## 14. System Settings Collection

**Collection**: `system_settings`

### Schema Structure

```javascript
{
  "_id": ObjectId,
  "key": String,                      // Setting key (unique)
  "value": Mixed,                     // Setting value (any type)
  "description": String,              // Setting description
  "updated_at": String,               // ISO datetime
  "updated_by": String                // User ID
}
```

### Indexes
- `key` (unique, ascending)

---

## Pydantic Schema Models

### Schema Organization

```
sourcecode/schemas/
├── common_enums.py                   # Shared enumerations
├── auth_schemas.py                   # Authentication schemas
├── user_schemas.py                   # User CRUD schemas
├── department_schemas.py             # Department schemas
├── category_schemas.py               # Category & allowance schemas
├── reimbursement_schemas.py          # Reimbursement schemas
├── approval_schemas.py               # Approval action schemas
├── approval_chain_schemas.py         # Approval chain structures
├── payment_method_schemas.py         # Payment method schemas
└── notification_schemas.py           # Notification schemas
```

---

## Key Pydantic Models

### 1. User Schemas (`user_schemas.py`)

```python
# Create Request
class UserCreateRequest(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    password: str
    departments: List[DepartmentEntrySchema]
    managers: List[ManagerEntrySchema]

# Update Request
class UserUpdateRequest(BaseModel):
    name: Optional[str]
    email: Optional[EmailStr]
    password: Optional[str]
    is_active: Optional[bool]
    departments: Optional[List[DepartmentEntrySchema]]
    managers: Optional[List[ManagerEntrySchema]]

# Response Schema
class UserResponseSchema(BaseModel):
    user_id: str
    employee_id: str
    name: str
    email: str
    is_active: bool
    has_payment_method: bool
    departments: List[DepartmentEntrySchema]
    managers: List[ManagerEntrySchema]
    default_allowances: List[CategoryAllowanceEntrySchema]
```

### 2. Reimbursement Schemas (`reimbursement_schemas.py`)

```python
# Item Schema
class ReimbursementItemSchema(BaseModel):
    category_id: str
    category_name: Optional[str]
    sub_category: Optional[str]
    amount: float
    expense_date: date
    description: str
    attachments: List[str]  # Attachment IDs

# Create Request
class ReimbursementCreateRequest(BaseModel):
    form_type: FormTypeEnum  # general | business_trip
    description: Optional[str]
    items: List[ReimbursementItemSchema]
    business_trip_meta: Optional[BusinessTripMetaSchema]

# Response Schema
class ReimbursementResponseSchema(BaseModel):
    reimbursement_id: str
    reimbursement_code: Optional[str]
    initiator_id: str
    initiator_name: str
    form_type: FormTypeEnum
    status: ReimbursementStatusEnum
    description: Optional[str]
    items: List[ReimbursementItemSchema]
    business_trip_meta: Optional[BusinessTripMetaSchema]
    payment_proof: Optional[PaymentProofSchema]
    created_at: str
    updated_at: str
```

### 3. Approval Chain Schemas (`approval_chain_schemas.py`)

```python
# Chain Node
class ApprovalChainNodeSchema(BaseModel):
    level: int
    user_id: str
    name: str
    email: str
    role: str
    priority: int
    approval_type: str  # mandatory | optional
    status: str
    received_date: Optional[str]
    response_date: Optional[str]
    action: Optional[str]

# Chain Response
class ApprovalChainResponseSchema(BaseModel):
    current_reviewer_id: str
    current_step: int
    approval_chain: List[ApprovalChainNodeSchema]
    logs: List[dict]
```

---

## Enumerations

### File: `common_enums.py`

```python
# User Roles
class UserRoleEnum(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    SENIOR_MANAGER = "senior_manager"
    EMPLOYEE = "employee"
    CA = "ca"
    INTERN = "intern"

# Reimbursement Status
class ReimbursementStatusEnum(str, Enum):
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

# Form Type
class FormTypeEnum(str, Enum):
    GENERAL = "general"
    BUSINESS_TRIP = "business_trip"

# Action Type
class ActionTypeEnum(str, Enum):
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

# Payment Method Type
class PaymentMethodTypeEnum(str, Enum):
    UPI_ID = "UPI_ID"
    QR_CODE = "QR_CODE"

# Approval Type
class ApprovalTypeEnum(str, Enum):
    MANDATORY = "mandatory"
    OPTIONAL = "optional"
```

---

## Summary

This documentation provides a complete reference for:

✅ **15 Route Modules** with 80+ endpoints
✅ **14 MongoDB Collections** with complete schemas
✅ **20+ Pydantic Models** for request/response validation
✅ **8 Core Enumerations** for type safety
✅ **GridFS Integration** for file storage
✅ **JWT Authentication** with role-based access control
✅ **Approval Chain System** with frozen snapshots
✅ **SLA Tracking** with business-day calculations
✅ **Real-time Notifications** via SSE
✅ **Complete Audit Trail** for compliance

---

**Last Updated**: 2026-06-10
**Version**: 1.0
**Backend Framework**: FastAPI (Python)
**Database**: MongoDB 6.0+
**Authentication**: JWT

---

## Appendix A: Common Request/Response Patterns

### Authentication Header Format

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Error Response Format

All errors follow a consistent format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP Status Codes:
- `200 OK` - Successful GET/POST/PUT
- `201 Created` - Successful resource creation
- `400 Bad Request` - Validation error or invalid input
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource (e.g., email already exists)
- `500 Internal Server Error` - Server-side error

### Success Response Format

Most mutation endpoints return:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* resource details */ }
}
```

---

## Appendix B: Reimbursement Status Flow

### Status State Machine

```
DRAFT
  ↓ (submit)
SUBMITTED
  ↓ (assign to first reviewer)
IN_REVIEW
  ↓ (approve by all managers)
OWNER_APPROVED
  ↓ (forward to CA)
CA_PENDING
  ↓ (CA pays)
PAID
  ↓ (initiator acknowledges)
PAYMENT_ACKNOWLEDGED
  ↓ (auto-close)
CLOSED
```

### Alternative Paths

**Query Flow:**
```
IN_REVIEW → QUERY_RAISED (reviewer raises query)
QUERY_RAISED → REAPPLIED (initiator responds)
REAPPLIED → IN_REVIEW (back to reviewer)
```

**Private Ask Flow:**
```
IN_REVIEW → PRIVATE_ASK (reviewer asks privately)
PRIVATE_ASK → REAPPLIED (initiator responds)
REAPPLIED → IN_REVIEW (back to reviewer)
```

**CA Query Flow:**
```
CA_PENDING → CA_QUERY (CA raises query)
CA_QUERY → CA_REAPPLIED (initiator responds)
CA_REAPPLIED → CA_PENDING (back to CA)
```

**Rejection Paths:**
```
IN_REVIEW → REJECTED (reviewer rejects)
CA_PENDING → REJECTED (CA rejects)
```

**Auto-Rejection:**
```
Any non-terminal state → AUTO_REJECTED (SLA overdue with no response)
```

---

## Appendix C: Approval Chain Generation Rules

### Priority-Based Manager Selection

When an employee has multiple managers, the system selects based on **priority value** (lower number = higher priority):

```javascript
// Example: Employee has 3 managers
{
  "managers": [
    {"manager_id": "M1", "priority": 3},
    {"manager_id": "M2", "priority": 1},  // ← Selected (highest priority)
    {"manager_id": "M3", "priority": 2}
  ]
}
```

**Result**: Manager M2 is selected as the first reviewer.

### Hierarchical Chain Building

The approval chain is built by recursively following the manager hierarchy:

1. Start with the initiator
2. Find their highest-priority manager → Level 1
3. Find that manager's highest-priority manager → Level 2
4. Continue until reaching the Owner
5. Add Accountant (CA) as the final reviewer

### Special Cases

**Owner as Initiator:**
- Owner's reimbursements skip manager review
- Go directly to Accountant (CA)

**Employee with No Managers:**
- System automatically assigns Owner as reviewer
- Ensures every reimbursement has a valid approval path

**Cycle Detection:**
- System prevents circular manager relationships
- Throws error if A → B → C → A is detected

---

## Appendix D: SLA Calculation Logic

### Business Days Calculation

SLA is calculated in **business days** (excludes weekends and company holidays):

**Configuration:**
```env
REIMBURSEMENT_REVIEW_DAYS=3  # Number of business days for review
```

**Formula:**
```
due_date = received_date + REIMBURSEMENT_REVIEW_DAYS (business days)
remaining_days = (due_date - current_date).days
```

### Received Date Logic

**Definition**: The first time the current reviewer views the reimbursement AFTER being assigned.

**Example:**
```
Submitted:       2026-06-10 09:00:00
Assigned to Mgr: 2026-06-10 09:00:01
Manager views:   2026-06-10 14:30:00  ← Received date set here
Due date:        2026-06-13 09:00:01  (3 business days later)
```

### Holiday Exclusion

Company holidays are stored in the `holidays` collection and excluded from business day calculations.

**Example:**
```
Received: Monday, June 10
Holiday:  Tuesday, June 11 (Company Holiday)
Day 1:    Wednesday, June 12
Day 2:    Thursday, June 13
Day 3:    Friday, June 14
Due Date: Friday, June 14 EOD
```

---

## Appendix E: Notification Types and Templates

### Notification Event Types

| Type | Trigger | Recipients |
|------|---------|------------|
| `APPROVAL_PENDING` | Reimbursement submitted / forwarded | Current reviewer |
| `QUERY_RAISED` | Reviewer raises public query | Initiator + all chain members |
| `PRIVATE_ASK` | Reviewer raises private ask | Initiator + Owner |
| `REAPPLIED` | Initiator responds to query/ask | Original reviewer |
| `APPROVED` | Reviewer approves | Initiator |
| `REJECTED` | Reviewer/CA rejects | Initiator |
| `PAID` | CA marks as paid | Initiator |
| `PAYMENT_ACKNOWLEDGED` | Initiator acknowledges payment | CA + Owner |
| `SLA_OVERDUE` | Review deadline passed | Reviewer + Owner |
| `SLA_REMINDER` | 1 day before deadline | Reviewer |

### Notification Metadata Structure

```javascript
{
  "notification_id": "...",
  "user_id": "...",
  "type": "APPROVAL_PENDING",
  "title": "New Reimbursement Pending Review",
  "html_content": "<p>You have a new reimbursement...</p>",
  "metadata": {
    "reimbursement_id": "...",
    "reimbursement_code": "RB-2026-000123",
    "initiator_name": "John Doe",
    "initiator_email": "john@company.com",
    "total_amount": 5000.00,
    "form_type": "general",
    "submitted_at": "2026-06-10T09:00:00Z",
    "remaining_days": 3
  },
  "is_read": false,
  "created_at": "2026-06-10T09:00:01Z"
}
```

---

## Appendix F: GridFS File Storage

### File Upload Process

1. Client uploads file via `/api/attachments/upload`
2. Backend validates MIME type and file size
3. File stored in GridFS with metadata
4. GridFS returns unique `attachment_id`
5. `attachment_id` stored in reimbursement item's `attachments[]` array

### File Metadata

GridFS stores the following metadata with each file:

```javascript
{
  "_id": ObjectId,              // attachment_id
  "filename": "invoice.pdf",
  "contentType": "application/pdf",
  "length": 245760,             // File size in bytes
  "uploadDate": ISODate,
  "metadata": {
    "uploaded_by": "user_id",   // Who uploaded
    "original_name": "invoice.pdf"
  }
}
```

### Supported MIME Types

| Extension | MIME Type | Use Case |
|-----------|-----------|----------|
| `.jpg`, `.jpeg` | `image/jpeg` | Invoice photos |
| `.png` | `image/png` | Invoice photos, QR codes |
| `.webp` | `image/webp` | Modern image format |
| `.pdf` | `application/pdf` | Invoice documents |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Supporting documents |

### File Size Limits

- **Maximum file size**: 10 MB per file
- **No limit** on number of attachments per reimbursement item

---

## Appendix G: Role-Based Access Control (RBAC)

### Role Hierarchy

```
Owner (Highest privileges)
  ↓
CA (Chartered Accountant)
  ↓
Senior Manager
  ↓
Manager
  ↓
Employee
  ↓
Intern (Lowest privileges)
```

### Permission Matrix

| Action | Owner | CA | Manager | Employee | Intern |
|--------|-------|----|---------|-----------| -------|
| Create reimbursement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit reimbursement | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own reimbursements | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team reimbursements | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve reimbursements | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark as paid | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create departments | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create categories | ✅ | ❌ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage holidays | ✅ | ✅ | ❌ | ❌ | ❌ |
| View SLA events | ✅ | ✅ | ❌ | ❌ | ❌ |

### Access Control Implementation

**Middleware Functions:**
```python
# Any authenticated user
getCurrentUserDependency()

# Owner role only
getOwnerUserDependency()

# Owner or CA only (Admin level)
getAdminUserDependency()
```

**Usage in Routes:**
```python
@router.post("/create")
async def createCategory(
    objRequest: CategoryCreateRequest,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    # Only Owner can create categories
    pass
```

---

## Appendix H: Environment Variables Reference

### Required Configuration

```env
# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=expense_manager

# JWT Configuration
JWT_SECRET_KEY=<strong-secret-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# SLA Configuration
REIMBURSEMENT_REVIEW_DAYS=3  # Business days for review
SLA_APPROVAL_DAYS=3          # Alternative name (same purpose)

# Email Configuration (for OTP verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@company.com
SMTP_FROM_NAME=ExpenseManager

# Verification Code Settings
VERIFICATION_CODE_LENGTH=6
VERIFICATION_CODE_TTL_MINUTES=15

# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=True  # Development only

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# File Upload Limits
MAX_FILE_SIZE_MB=10
```

### Optional Configuration

```env
# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/expense_manager.log

# Notification Settings
NOTIFICATION_BATCH_SIZE=50
NOTIFICATION_RETENTION_DAYS=90

# Session Settings
SESSION_TIMEOUT_MINUTES=30
```

---

## Appendix I: Testing Endpoints with cURL

### Authentication Examples

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Get Current User:**
```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <jwt_token>"
```

### Reimbursement Examples

**Create Draft:**
```bash
curl -X POST http://localhost:8000/api/reimbursements/draft \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "form_type": "general",
    "description": "Monthly office supplies",
    "items": [
      {
        "category_id": "CAT001",
        "amount": 1500.00,
        "expense_date": "2026-06-10",
        "description": "Printer paper and toner",
        "attachments": []
      }
    ]
  }'
```

**Submit Reimbursement:**
```bash
curl -X POST http://localhost:8000/api/reimbursements/{id}/submit \
  -H "Authorization: Bearer <jwt_token>"
```

**Approve Reimbursement:**
```bash
curl -X POST http://localhost:8000/api/approvals/{id}/approve \
  -H "Authorization: Bearer <jwt_token>"
```

### File Upload Example

```bash
curl -X POST http://localhost:8000/api/attachments/upload \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@/path/to/invoice.pdf"
```

---

## Appendix J: Database Indexes Summary

### Performance-Critical Indexes

```javascript
// reimbursements collection
db.reimbursements.createIndex({"reimbursement_code": 1}, {unique: true})
db.reimbursements.createIndex({"initiator_id": 1})
db.reimbursements.createIndex({"current_reviewer_id": 1, "status": 1, "created_at": -1})

// users collection
db.users.createIndex({"email": 1}, {unique: true})
db.users.createIndex({"employee_id": 1}, {unique: true, sparse: true})

// reimbursement_logs collection
db.reimbursement_logs.createIndex({"reimbursement_id": 1, "created_at": -1})

// notifications collection
db.notifications.createIndex({"user_id": 1, "is_read": 1})
db.notifications.createIndex({"created_at": -1})

// sla_events collection
db.sla_events.createIndex({"due_at": 1, "is_resolved": 1})

// holidays collection
db.holidays.createIndex({"date": 1}, {unique: true})

// pending_signups collection (TTL index)
db.pending_signups.createIndex({"expires_at": 1}, {expireAfterSeconds: 0})
```

### Index Purposes

- **Unique indexes**: Prevent duplicate entries (email, employee_id, reimbursement_code)
- **Single-field indexes**: Fast lookups (initiator_id, user_id)
- **Compound indexes**: Optimize complex queries (reviewer + status + date)
- **TTL indexes**: Auto-delete expired documents (pending_signups)
- **Sparse indexes**: Index only documents with the field (employee_id)

---

## End of Documentation

For implementation details, refer to:
- `APPROVAL_CHAIN.md` - Approval chain system documentation
- `NOTIFICATION_SYSTEM.md` - Notification system documentation
- `SYSTEM_CONTEXT_AND_API_MAPPING.md` - Frontend-backend mapping
- `IMPLEMENTATION_STATUS.md` - Current implementation status
