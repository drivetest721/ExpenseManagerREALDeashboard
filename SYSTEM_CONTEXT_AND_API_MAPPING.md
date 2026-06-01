# Expense Manager — System Context & API Mapping

**Created:** May 29, 2026  
**Purpose:** Comprehensive documentation of the current system architecture, UI structure, and Frontend-to-Backend API mapping for UI redesign planning.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Core Business Workflow](#4-core-business-workflow)
5. [Frontend Structure](#5-frontend-structure)
6. [Backend Structure](#6-backend-structure)
7. [Complete API Mapping](#7-complete-api-mapping)
8. [Business Logic Controllers](#8-business-logic-controllers)
9. [Current UI Design](#9-current-ui-design)
10. [Data Models & Collections](#10-data-models--collections)

---

## 1. System Overview

### 1.1 Purpose
The **Expense Manager** is a complete reimbursement management system that replaces offline HRMS processes with an online workflow. It enables employees to:
- Submit expense reimbursements (general expenses or business trips)
- Track approval chains through manager hierarchy
- Handle queries and private communications
- Acknowledge payments
- View analytics (for admins)

### 1.2 Key Features
- **Multi-level approval chain** with automatic hierarchy detection
- **Frozen chain snapshot** on submission (never recalculated)
- **State machine** driven workflow with atomic transitions
- **SLA tracking** with business day calculations
- **Query/Ask system** (public queries, private asks)
- **CA (Accountant) workflow** with single query allowed
- **Payment acknowledgment** flow
- **Real-time notifications**
- **Analytics dashboard** for Owners/CA
- **Audit logging** for all mutations
- **Binary attachment storage** (GridFS)

### 1.3 System Constraints
- Payment method (UPI ID or QR) **mandatory** before first submission
- **One current reviewer** at a time (atomic concurrency control)
- **Query returns to initiator** → re-apply jumps to querying manager only
- **Ask is private** — visible to sender + initiator + Owner/Admin only
- **CA can query only once** per reimbursement
- **Approved managers cannot modify** or query later
- **SLA counted in business days** (excludes Sat/Sun + holidays)
- **Attachments required** for all reimbursement items (invoice/receipt)

---

## 2. Architecture & Tech Stack

### 2.1 Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.6 |
| Build Tool | Vite | 8.0.12 |
| Language | TypeScript | 6.x |
| Router | React Router DOM | 7.x |
| HTTP Client | Axios | Latest |
| Styling | Tailwind CSS | v4 |
| Form Handling | React Hook Form + Zod | Latest |
| Icons | Lucide React | Latest |
| Toast | Sonner / React Hot Toast | Latest |

**Build Output:**
- JavaScript: ~313 KB
- CSS: ~13 KB

### 2.2 Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | Latest |
| Language | Python | 3.13 |
| Runtime | Uvicorn | Latest |
| Database | MongoDB | Latest (PyMongo) |
| Authentication | JWT | python-jose |
| Password Hashing | Bcrypt | passlib |
| Email Service | SMTP (Zoho) | aiosmtplib |
| Scheduler | APScheduler | Latest |
| Testing | Pytest + httpx | Latest |

### 2.3 Architecture Pattern
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Pages   │  │Components│  │  Hooks   │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │                    │
│       └─────────────┴─────────────┘                    │
│                     │                                   │
│              ┌──────▼──────┐                          │
│              │  API Utils  │ (axios wrappers)          │
│              └──────┬──────┘                          │
└─────────────────────┼──────────────────────────────────┘
                      │ HTTP/REST
                      │ /api/*
┌─────────────────────▼──────────────────────────────────┐
│              BACKEND (FastAPI)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │ Routes  │→ │Middleware│→ │Controllers│              │
│  └────┬────┘  └─────────┘  └────┬────┘               │
│       │                          │                     │
│       │       ┌──────────┐       │                     │
│       └───────┤ Services ├───────┘                     │
│               └────┬─────┘                            │
└────────────────────┼────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  MONGODB                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  users   │ │departments│ │categories│               │
│  │reimbursem│ │   logs   │ │attachments│              │
│  └──────────┘ └──────────┘ └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & Permissions

### 3.1 Role Hierarchy
| Role | Access Level | Capabilities |
|------|-------------|--------------|
| **Employee/Junior** | Basic | Create reimbursement, upload attachments, edit drafts, re-apply after query, acknowledge payment |
| **Manager** | Reviewer | All employee capabilities + Review team reimbursements, Approve/Query/Ask (private), Cannot modify after approval |
| **Senior Manager** | Reviewer | Same as Manager but higher in hierarchy |
| **Owner** | Admin | Top of every chain, Manages hierarchy/categories/limits, Views all (incl. private Ask), Analytics access |
| **CA (Accountant)** | Final Approver | Final approval, Pays employee, One CA-Query allowed, After re-apply: only Paid/Reject |
| **Admin** | System Admin | Settings page (users, departments, categories, SLA config, holidays) |

### 3.2 Role-Based Route Guards
```typescript
// Frontend route guards
<ProtectedRoute> — requires authentication
<AdminRoute> — requires admin/owner role
<OwnerRoute> — requires owner role
<CARoute> — requires CA role

// Backend dependency guards
getCurrentUserDependency — any authenticated user
getAdminUserDependency — admin/owner only
getOwnerUserDependency — owner only
getCaUserDependency — CA only
```

---

## 4. Core Business Workflow

### 4.1 Reimbursement Lifecycle

```
┌─────────┐
│  DRAFT  │◄─── Employee creates/edits
└────┬────┘
     │ Submit (requires payment method)
     ▼
┌──────────┐
│SUBMITTED │
└────┬─────┘
     │ Auto-assigned to first reviewer
     ▼
┌───────────┐     ┌─────────────┐
│ IN_REVIEW │◄────┤  REAPPLIED  │
└─────┬─────┘     └──────▲──────┘
      │                  │
      ├──Approve────►Next Reviewer
      │                  │
      ├──Query──────►┌────────────┐
      │              │QUERY_RAISED│
      │              └──────┬─────┘
      │                     │
      └──Ask────────►┌────────────┐
                     │PRIVATE_ASK │
                     └──────┬─────┘
                            │
                            └──Reapply───┘

After all approvals:
┌───────────────┐
│OWNER_APPROVED │
└───────┬───────┘
        │ Auto-assigned to CA
        ▼
┌───────────┐     ┌──────────────┐
│CA_PENDING │◄────┤CA_REAPPLIED  │
└─────┬─────┘     └───────▲──────┘
      │                   │
      ├──Pay────────►┌──────┐
      │              │ PAID │
      │              └──┬───┘
      │                 │ Employee acknowledges
      │                 ▼
      ├──CA Query───►┌─────────┐
      │              │CA_QUERY │
      │              └────┬────┘
      │                   │
      │                   └──CA Reapply───┘
      │
      └──Reject────►┌──────────┐
                    │ REJECTED │
                    └──────────┘

Final states:
┌─────────────────────┐
│PAYMENT_ACKNOWLEDGED │──Auto close──►┌────────┐
└─────────────────────┘                │ CLOSED │
                                       └────────┘
```

### 4.2 State Transitions (Defined in ReimbursementStateMachine.py)

| Current Status | Valid Actions | Next Status |
|---------------|---------------|-------------|
| SUBMITTED | APPROVE | IN_REVIEW |
| SUBMITTED | QUERY | QUERY_RAISED |
| SUBMITTED | ASK | PRIVATE_ASK |
| IN_REVIEW | APPROVE | IN_REVIEW (next reviewer) or OWNER_APPROVED |
| IN_REVIEW | QUERY | QUERY_RAISED |
| IN_REVIEW | ASK | PRIVATE_ASK |
| QUERY_RAISED | REAPPLY | REAPPLIED |
| PRIVATE_ASK | REAPPLY | REAPPLIED |
| REAPPLIED | APPROVE | IN_REVIEW |
| REAPPLIED | QUERY | QUERY_RAISED |
| REAPPLIED | ASK | PRIVATE_ASK |
| OWNER_APPROVED | SEND_TO_CA | CA_PENDING |
| CA_PENDING | CA_QUERY | CA_QUERY |
| CA_PENDING | ASK | PRIVATE_ASK |
| CA_PENDING | PAY | PAID |
| CA_PENDING | REJECT | REJECTED |
| CA_QUERY | CA_REAPPLY | CA_REAPPLIED |
| CA_REAPPLIED | CA_QUERY | CA_QUERY |
| CA_REAPPLIED | PAY | PAID |
| CA_REAPPLIED | REJECT | REJECTED |
| PAID | ACKNOWLEDGE | PAYMENT_ACKNOWLEDGED → CLOSED |

### 4.3 Approval Chain Building Logic

**Algorithm (ApprovalChainBuilder.py):**
1. Fetch initiator user document
2. Check if initiator is Owner (special case: no manager chain)
3. Walk initiator's managers by priority (sorted)
4. For each manager:
   - Add to chain
   - Recursively climb to their manager
   - Continue until reaching Owner
5. Add Owner to chain (if not already present)
6. Add CA (Accountant) as final step
7. **Freeze chain** (snapshot stored in reimbursement doc)
8. Set `current_step = 0`, `current_reviewer_id = chain[0].user_id`

**Key Rules:**
- Chain is built ONCE on submission
- Chain NEVER recalculates
- Query returns to initiator → re-apply jumps to querying manager only (not chain restart)
- Atomic concurrency: `{ _id, current_reviewer_id }` filter prevents double approval

---

## 5. Frontend Structure

### 5.1 Directory Layout
```
client/src/
├── pages/                    # Top-level route pages
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── HomePage.tsx
│   ├── ExpenseManagementPage.tsx    # Main reimbursement hub
│   ├── AllowanceDetailsPage.tsx      # Read-only allowances
│   ├── AnalyticsPage.tsx             # Owner/CA analytics
│   ├── ProfilePage.tsx               # Payment methods
│   ├── SettingsPage.tsx              # Admin settings
│   └── NotificationsInboxPage.tsx
│
├── components/
│   ├── AppHeader.tsx                 # Top navigation
│   ├── Footer.tsx
│   ├── ErrorBoundary.tsx
│   ├── ErrorCard.tsx
│   ├── ProtectedRoute.tsx
│   │
│   ├── common/                       # Reusable components
│   │   ├── InfoButton.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ...
│   │
│   ├── Reimbursement/
│   │   ├── NewReimbursementModal.tsx
│   │   ├── ReimbursementDetailModal.tsx
│   │   ├── ChainView.tsx              # Timeline view
│   │   ├── QueryAskDialog.tsx
│   │   ├── CAPayDialog.tsx
│   │   └── AttachmentViewerModal.tsx
│   │
│   ├── Allowance/
│   │   └── AllowanceCard.tsx
│   │
│   ├── Analytics/
│   │   ├── BarChart.tsx               # Inline SVG charts
│   │   ├── DonutChart.tsx
│   │   └── LineChart.tsx
│   │
│   ├── Settings/
│   │   ├── UsersPanel.tsx
│   │   ├── DepartmentsPanel.tsx
│   │   ├── CategoriesPanel.tsx
│   │   └── HolidaysPanel.tsx
│   │
│   ├── Notifications/
│   │   └── NotificationDropdown.tsx
│   │
│   └── ui/                            # shadcn-style primitives
│       └── ...
│
├── utils/                             # API clients (axios wrappers)
│   ├── apiClient.ts                   # Base axios instance
│   ├── authApi.ts
│   ├── userApi.ts
│   ├── departmentApi.ts
│   ├── categoryApi.ts
│   ├── allowanceApi.ts
│   ├── reimbursementApi.ts
│   ├── approvalApi.ts
│   ├── paymentMethodApi.ts
│   ├── attachmentApi.ts
│   ├── notificationApi.ts
│   ├── analyticsApi.ts
│   ├── slaApi.ts
│   └── holidayApi.ts
│
├── hooks/
│   └── useAuth.tsx                    # Auth context hook
│
├── types/                             # TypeScript interfaces
│   ├── user.ts
│   ├── department.ts
│   ├── category.ts
│   ├── reimbursement.ts
│   ├── approval.ts
│   ├── paymentMethod.ts
│   ├── notification.ts
│   └── analytics.ts
│
├── context/
│   └── AuthContext.tsx
│
├── App.tsx                            # Route definitions
├── main.tsx
└── index.css
```

### 5.2 Key Pages & Their Purpose

| Page | Route | Access | Purpose |
|------|-------|--------|---------|
| LoginPage | `/login` | Public | JWT authentication |
| SignupPage | `/signup` | Public | User registration with OTP |
| HomePage | `/` | Protected | Landing page after login |
| ExpenseManagementPage | `/expense` | Protected | Main reimbursement hub (Draft/Pending/History/Team sections) |
| AllowanceDetailsPage | `/allowance` | Protected | Read-only allowances table |
| ProfilePage | `/profile` | Protected | User profile + payment methods |
| SettingsPage | `/settings` | Admin | System settings (users, departments, categories, SLA, holidays) |
| AnalyticsPage | `/analytics` | Owner/CA | Dashboard with KPIs and charts |
| NotificationsInboxPage | `/notifications` | Protected | Notification center |

---

## 6. Backend Structure

### 6.1 Directory Layout
```
sourcecode/
├── main.py                           # FastAPI app entry
├── env_config.py                     # Environment loader
│
├── config/
│   └── mongodb_config.py             # MongoDB connection + indexes
│
├── middleware/
│   ├── jwt_middleware.py             # JWT decode + role guards
│   └── security_middleware.py
│
├── routes/                           # FastAPI routers
│   ├── auth_routes.py
│   ├── user_routes.py
│   ├── department_routes.py
│   ├── category_routes.py
│   ├── allowance_routes.py
│   ├── reimbursement_routes.py
│   ├── approval_routes.py
│   ├── payment_method_routes.py
│   ├── attachment_routes.py
│   ├── notification_routes.py
│   ├── analytics_routes.py
│   ├── sla_routes.py
│   └── holiday_routes.py
│
├── schemas/                          # Pydantic models
│   ├── auth_schemas.py
│   ├── user_schemas.py
│   ├── department_schemas.py
│   ├── category_schemas.py
│   ├── reimbursement_schemas.py
│   ├── approval_schemas.py
│   ├── payment_method_schemas.py
│   ├── notification_schemas.py
│   └── common_enums.py               # Shared enums
│
├── controllers/                      # Business logic
│   ├── ApprovalChainBuilder.py       # Dynamic chain builder
│   ├── ReimbursementStateMachine.py  # State transition engine
│   ├── NotificationService.py        # Notification dispatcher
│   ├── AuditLogger.py                # Mutation logging
│   ├── SLAEngine.py                  # Overdue tracking
│   └── ReimbursementCounter.py       # RB-YYYY-000001 generator
│
├── services/
│   └── email_service.py              # SMTP email sender
│
├── utils/
│   ├── date_utils.py
│   ├── business_day_utils.py
│   ├── file_utils.py                 # Attachment validation
│   ├── crypto_utils.py
│   └── response_utils.py
│
└── logs/
```

---

## 7. Complete API Mapping

### 7.1 Authentication & User Management

#### Frontend API Client: `authApi.ts`, `userApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `login()` | POST | `/api/auth/login` | `auth_routes.py` | JWT login |
| `signup()` | POST | `/api/auth/signup` | `auth_routes.py` | Create pending signup |
| `verifyEmail()` | POST | `/api/auth/verify-email` | `auth_routes.py` | Verify OTP |
| `resendCode()` | POST | `/api/auth/resend-code` | `auth_routes.py` | Resend OTP |
| `logout()` | POST | `/api/auth/logout` | `auth_routes.py` | Invalidate token |
| `getMe()` | GET | `/api/auth/me` | `auth_routes.py` | Current user profile |
| `listUsers()` | GET | `/api/users/list` | `user_routes.py` | List users (filterable) |
| `getUser()` | GET | `/api/users/{id}` | `user_routes.py` | Get user detail |
| `createUser()` | POST | `/api/users/create` | `user_routes.py` | Create user (Admin) |
| `updateUser()` | PUT | `/api/users/{id}` | `user_routes.py` | Update user (Admin) |
| `updateManagers()` | PUT | `/api/users/{id}/managers` | `user_routes.py` | Update manager hierarchy (Owner) |
| `deleteUser()` | DELETE | `/api/users/{id}` | `user_routes.py` | Soft-delete user (Owner) |

**Key Logic:**
- **Login:** Validates credentials → generates JWT → returns token + user profile
- **Signup:** Creates pending_signup doc → sends OTP via email
- **Verify:** Matches OTP → creates user doc → auto-login
- **Update Managers:** Validates priority uniqueness → updates managers[] array

---

### 7.2 Departments

#### Frontend API Client: `departmentApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `listDepartments()` | GET | `/api/departments/list` | `department_routes.py` | List all departments |
| `getDepartment()` | GET | `/api/departments/{id}` | `department_routes.py` | Get department detail |
| `createDepartment()` | POST | `/api/departments/create` | `department_routes.py` | Create department (Admin) |
| `updateDepartment()` | PUT | `/api/departments/{id}` | `department_routes.py` | Update department (Admin) |
| `deleteDepartment()` | DELETE | `/api/departments/{id}` | `department_routes.py` | Delete department (Owner) |

**Key Logic:**
- Departments store `owner_ids[]` (multiple owners per dept)
- Users have `departments[]` array (multi-department roles)

---

### 7.3 Categories & Allowances

#### Frontend API Client: `categoryApi.ts`, `allowanceApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `listCategories()` | GET | `/api/categories/list` | `category_routes.py` | List all categories (Owner) |
| `getCategory()` | GET | `/api/categories/{id}` | `category_routes.py` | Get category detail |
| `createCategory()` | POST | `/api/categories/create` | `category_routes.py` | Create category (Owner) |
| `updateCategory()` | PUT | `/api/categories/{id}` | `category_routes.py` | Update category (Owner) |
| `deleteCategory()` | DELETE | `/api/categories/{id}` | `category_routes.py` | Soft-delete category (Owner) |
| `getMyAllowance()` | GET | `/api/allowance/my` | `allowance_routes.py` | Categories visible to current user |
| `getAllAllowance()` | GET | `/api/allowance/all` | `allowance_routes.py` | All categories + assignees (Admin) |

**Key Logic:**
- Categories have `sub_categories[]`, `max_limit`, `allowed_roles[]`, `department_ids[]`
- Allowance routes filter categories by user role + department matching
- `requires_invoice` field enforced on submission

---

### 7.4 Reimbursements (Core)

#### Frontend API Client: `reimbursementApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `createDraft()` | POST | `/api/reimbursements/draft` | `reimbursement_routes.py` | Create new draft |
| `updateDraft()` | PUT | `/api/reimbursements/{id}/draft` | `reimbursement_routes.py` | Update draft |
| `submitReimbursement()` | POST | `/api/reimbursements/{id}/submit` | `reimbursement_routes.py` | Submit draft (DRAFT → SUBMITTED) |
| `listMyReimbursements()` | GET | `/api/reimbursements/my?bucket=draft\|pending\|history` | `reimbursement_routes.py` | List user's reimbursements |
| `listTeamReimbursements()` | GET | `/api/reimbursements/team?bucket=pending-approvals\|pending-completion\|history` | `reimbursement_routes.py` | List team reimbursements (reviewer) |
| `getReimbursementDetail()` | GET | `/api/reimbursements/{id}` | `reimbursement_routes.py` | Get full detail + items |
| `deleteReimbursement()` | DELETE | `/api/reimbursements/{id}` | `reimbursement_routes.py` | Delete draft |
| `getReimbursementChain()` | GET | `/api/reimbursements/{id}/chain` | `reimbursement_routes.py` | Get approval chain + logs |

**Key Logic:**
- **Draft:** Saves reimbursement with status=DRAFT (no chain build)
- **Submit:** 
  1. Validates payment method exists
  2. Validates business trip dates (if applicable)
  3. Validates category limits
  4. Builds approval chain (ApprovalChainBuilder)
  5. Sets status=SUBMITTED, current_step=0, current_reviewer_id
  6. Creates SLA event
  7. Notifies first reviewer
- **List (my):** Filters by bucket:
  - `draft` → status=DRAFT
  - `pending` → status IN (SUBMITTED, IN_REVIEW, QUERY_RAISED, PRIVATE_ASK, REAPPLIED, OWNER_APPROVED, CA_PENDING, CA_QUERY, CA_REAPPLIED)
  - `history` → status IN (PAID, PAYMENT_ACKNOWLEDGED, REJECTED, AUTO_REJECTED, CLOSED)
- **List (team):** Filters by reviewer role:
  - `pending-approvals` → current_reviewer_id = me
  - `pending-completion` → I'm in approval_chain but not current reviewer
  - `history` → I'm in approval_chain + status is terminal

---

### 7.5 Approvals (Actions)

#### Frontend API Client: `approvalApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `approveReimbursement()` | POST | `/api/approvals/{id}/approve` | `approval_routes.py` | Approve (manager) |
| `queryReimbursement()` | POST | `/api/approvals/{id}/query` | `approval_routes.py` | Raise query (manager) |
| `askReimbursement()` | POST | `/api/approvals/{id}/ask` | `approval_routes.py` | Private ask (manager) |
| `reapplyReimbursement()` | POST | `/api/approvals/{id}/reapply` | `approval_routes.py` | Re-apply (initiator) |
| `payReimbursement()` | POST | `/api/approvals/{id}/ca/pay` | `approval_routes.py` | Pay (CA) |
| `caQueryReimbursement()` | POST | `/api/approvals/{id}/ca/query` | `approval_routes.py` | CA query (CA) |
| `caReapplyReimbursement()` | POST | `/api/approvals/{id}/ca/reapply` | `approval_routes.py` | CA re-apply (initiator) |
| `acknowledgePayment()` | POST | `/api/approvals/{id}/acknowledge` | `approval_routes.py` | Acknowledge payment (initiator) |
| `rejectReimbursement()` | POST | `/api/approvals/{id}/ca/reject` | `approval_routes.py` | Reject (CA) |

**Key Logic:**
- All actions call `transition()` in ReimbursementStateMachine.py
- Atomic update with filter `{ _id, current_reviewer_id }` prevents double action
- Each action:
  1. Validates allowed transition
  2. Updates status
  3. Logs action to `reimbursement_logs`
  4. Notifies relevant parties
  5. Updates approval chain step status
  6. Moves `current_step` pointer (if approve)

---

### 7.6 Payment Methods

#### Frontend API Client: `paymentMethodApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `createPaymentMethod()` | POST | `/api/payment-methods/create` | `payment_method_routes.py` | Add UPI/QR |
| `listMyPaymentMethods()` | GET | `/api/payment-methods/my` | `payment_method_routes.py` | List user's methods |
| `setDefaultPaymentMethod()` | PUT | `/api/payment-methods/{id}/default` | `payment_method_routes.py` | Set default |
| `deletePaymentMethod()` | DELETE | `/api/payment-methods/{id}` | `payment_method_routes.py` | Delete method |

**Key Logic:**
- `hasAnyPaymentMethod()` helper checks if user has at least one method
- Guard on reimbursement submit: blocks if no payment method
- Frontend: ProfilePage manages payment methods

---

### 7.7 Attachments (Binary Storage)

#### Frontend API Client: `attachmentApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `uploadAttachment()` | POST | `/api/attachments/upload` | `attachment_routes.py` | Upload file (multipart) |
| `downloadAttachment()` | GET | `/api/attachments/{id}` | `attachment_routes.py` | Stream binary |
| `deleteAttachment()` | DELETE | `/api/attachments/{id}` | `attachment_routes.py` | Delete (Admin) |

**Key Logic:**
- Uses GridFS for binary storage
- Validates MIME types: jpg, jpeg, png, webp, pdf, docx
- Max file size: 10 MB
- Streams binary with proper Content-Type headers
- Auth-checked: only initiator / chain participants / Owner / Admin can download

---

### 7.8 Notifications

#### Frontend API Client: `notificationApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `listMyNotifications()` | GET | `/api/notifications/my` | `notification_routes.py` | List user's notifications |
| `markAsRead()` | PUT | `/api/notifications/{id}/read` | `notification_routes.py` | Mark single read |
| `markAllAsRead()` | PUT | `/api/notifications/mark-all-read` | `notification_routes.py` | Mark all read |

**Key Logic:**
- Notifications inserted by NotificationService.py on every reimbursement action
- Types: APPROVAL_PENDING, APPROVAL_PROGRESS, QUERY_RAISED, PRIVATE_ASK, REAPPLY_RESPONSE, CA_PENDING, PAID, PAYMENT_ACKNOWLEDGED
- Frontend: Bell icon in AppHeader with unread badge, polling every 30s

---

### 7.9 Analytics (Owner/CA Dashboard)

#### Frontend API Client: `analyticsApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `getAnalyticsSummary()` | GET | `/api/analytics/summary` | `analytics_routes.py` | KPI totals (count, amounts) |
| `getAnalyticsByStatus()` | GET | `/api/analytics/by-status` | `analytics_routes.py` | Status distribution |
| `getAnalyticsByCategory()` | GET | `/api/analytics/by-category` | `analytics_routes.py` | Spend per category |
| `getAnalyticsByDepartment()` | GET | `/api/analytics/by-department` | `analytics_routes.py` | Spend per department |
| `getAnalyticsMonthlyTrend()` | GET | `/api/analytics/monthly-trend?months=N` | `analytics_routes.py` | Time series (N months) |
| `getAnalyticsTopSpenders()` | GET | `/api/analytics/top-spenders?limit=N` | `analytics_routes.py` | Top N spenders (approved) |

**Key Logic:**
- Aggregation queries on `reimbursements` collection
- Frontend: AnalyticsPage with inline SVG charts (no external chart lib)
- KPI tiles, status donut, monthly trend line, category/department bars, top-spenders table

---

### 7.10 SLA & Holidays

#### Frontend API Client: `slaApi.ts`, `holidayApi.ts`

| Frontend Function | HTTP Method | Backend Endpoint | Backend Route File | Purpose |
|-------------------|-------------|------------------|-------------------|---------|
| `getSLASettings()` | GET | `/api/sla/settings` | `sla_routes.py` | Get SLA config |
| `updateSLASettings()` | PUT | `/api/sla/settings` | `sla_routes.py` | Update SLA days (Owner) |
| `getSLAOverdueCount()` | GET | `/api/sla/overdue-count` | `sla_routes.py` | Count overdue items |
| `listHolidays()` | GET | `/api/holidays/list` | `holiday_routes.py` | List holidays |
| `createHoliday()` | POST | `/api/holidays/create` | `holiday_routes.py` | Create holiday (Admin) |
| `deleteHoliday()` | DELETE | `/api/holidays/{id}` | `holiday_routes.py` | Delete holiday (Admin) |

**Key Logic:**
- SLA tracked in business days (excludes Sat/Sun + holidays)
- Default: 3 days approval, 2 days query response
- SLAEngine.py runs hourly job (APScheduler) to check overdue and auto-reject

---

## 8. Business Logic Controllers

### 8.1 ApprovalChainBuilder.py

**Purpose:** Dynamically builds approval chain on reimbursement submission.

**Algorithm:**
```python
def buildChain(strInitiatorId, strCategoryId=None, strDepartmentId=None):
    1. Fetch initiator user
    2. Check if initiator is Owner (special case)
    3. Walk initiator's managers[] by priority (sorted)
    4. For each manager:
       a. Add to chain
       b. Recursively climb to manager's manager
       c. Stop when reaching Owner
    5. Add Owner to chain (if not already)
    6. Add CA as final step
    7. Return frozen chain snapshot
```

**Chain Structure:**
```python
[
  {
    "user_id": "mgr1",
    "name": "John Doe",
    "email": "john@example.com",
    "priority": 1,
    "approval_type": "mandatory",  # or "optional"
    "status": "PENDING",
  },
  {
    "user_id": "mgr2",
    ...
    "priority": 2,
    "status": "PENDING",
  },
  ...
  {
    "user_id": "ca1",
    "name": "CA Name",
    "priority": N,
    "status": "PENDING",
  }
]
```

---

### 8.2 ReimbursementStateMachine.py

**Purpose:** Enforces state transitions with atomic concurrency control.

**Core Function:**
```python
def transition(strReimbursementId, strActorId, strAction, dictPayload=None):
    1. Fetch reimbursement doc
    2. Validate current status allows action (TRANSITIONS dict)
    3. Calculate next status
    4. Build update dict:
       - Update status
       - Handle APPROVE: mark step approved, move to next reviewer
       - Handle PAY: record payment metadata, mark CA step approved
       - Handle ACKNOWLEDGE: record ack metadata, auto-close
       - Handle REJECT: record rejection metadata
    5. Atomic update with filter { _id, current_reviewer_id: actor }
    6. Log action to reimbursement_logs
    7. Notify relevant parties
    8. Update/resolve SLA events
    9. Return updated doc
```

**Key Features:**
- **Atomic concurrency:** Filter on `current_reviewer_id` prevents double approval
- **Chain progression:** APPROVE moves `current_step` pointer
- **Auto-close:** ACKNOWLEDGE auto-transitions to CLOSED
- **CA detection:** When next reviewer is CA, skip OWNER_APPROVED → CA_PENDING

---

### 8.3 NotificationService.py

**Purpose:** Emits in-app notifications to relevant participants.

**Core Function:**
```python
def notifyAction(dictReimbursement, strAction, strActorId, strMessage, strVisibility):
    1. Extract reimbursement metadata (id, initiator, status, current_reviewer)
    2. Based on action:
       - APPROVE: notify initiator (progress) + next reviewer (pending)
       - QUERY: notify initiator (query raised)
       - ASK: notify initiator (private ask)
       - REAPPLY: notify current reviewer (reapplied)
       - PAY: notify initiator (paid)
       - ACKNOWLEDGE: notify CA (acknowledged)
       - REJECT: notify initiator (rejected)
    3. Insert notification docs
    4. Best-effort: log errors but never raise
```

---

### 8.4 AuditLogger.py

**Purpose:** Logs all mutations for compliance.

**Core Function:**
```python
def logMutation(strCollection, dictBefore, dictAfter, strAction, strActorId):
    1. Insert into audit_events collection:
       {
         "collection": strCollection,
         "document_id": dictBefore["_id"],
         "action": strAction,
         "actor_id": strActorId,
         "before": dictBefore,
         "after": dictAfter,
         "timestamp": NOW,
       }
    2. Best-effort: log errors but never raise
```

---

### 8.5 SLAEngine.py

**Purpose:** Tracks overdue approvals and auto-rejects after deadline.

**Core Function:**
```python
def checkSLAViolations():
    1. Fetch all pending reimbursements (status in IN_REVIEW, QUERY_RAISED, CA_PENDING, etc.)
    2. For each:
       a. Calculate business days since last action (skip Sat/Sun + holidays)
       b. Compare to SLA threshold (approval_sla_days or query_response_days)
       c. If overdue:
          - Send escalation email to admin/owner
          - If past auto-reject threshold: transition to AUTO_REJECTED
    3. Log SLA events
```

**Scheduler:** APScheduler runs `checkSLAViolations()` every hour.

---

### 8.6 ReimbursementCounter.py

**Purpose:** Generates unique reimbursement codes (RB-YYYY-000001).

**Core Function:**
```python
def getNextReimbursementCode(strYear):
    1. Atomic findOneAndUpdate on counters collection:
       { "type": "reimbursement", "year": strYear }
       $inc: { "sequence": 1 }
    2. Format: f"RB-{strYear}-{iSequence:06d}"
    3. Return code
```

---

## 9. Current UI Design

### 9.1 Design System

**Theme:**
- **Brand Color:** `#00703C` (Dark Green)
- **Tailwind CSS v4** with custom theme tokens
- **Typography:** System fonts
- **Spacing:** Tailwind default scale
- **Borders:** Rounded corners (rounded-lg, rounded-2xl)
- **Shadows:** Subtle shadows (shadow-sm, shadow-md)

**Color Palette:**
```css
--color-brand: #00703C;
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-700: #374151;
--color-gray-900: #111827;
```

**Status Colors:**
- DRAFT → Gray
- SUBMITTED → Blue
- IN_REVIEW → Yellow
- QUERY_RAISED → Orange
- PRIVATE_ASK → Orange
- REAPPLIED → Blue
- OWNER_APPROVED → Green
- CA_PENDING → Purple
- CA_QUERY → Orange
- CA_REAPPLIED → Blue
- PAID → Emerald (#00703C)
- PAYMENT_ACKNOWLEDGED → Teal
- REJECTED → Red
- AUTO_REJECTED → Dark Red
- CLOSED → Gray

---

### 9.2 Component Design Patterns

#### 9.2.1 Collapsible Sections (Inspired by Drake Job Lifecycle)

**ExpenseManagementPage:**
- Sections: Personal (Draft/Pending/History) + Team (Pending Approvals/Pending Completion/History)
- Each section:
  - **Header:** Icon + Title + Count Badge + Expand/Collapse chevron
  - **Vertical bar** on left (colored per section tone)
  - **Content:** Table with rows (Category | Sub Category | Amount | Status | Date Applied | Date Paid | View)
  - **Empty state:** Friendly message when no items

**Visual:**
```
┌─────────────────────────────────────────────────────────┐
│ 📝 Drafts (3)                                    ▼      │
├─────────────────────────────────────────────────────────┤
│ │ Category     │ Sub Cat │ Amount │ Status │ Actions  ││
│ │ Travel       │ Flight  │ ₹5,000 │ DRAFT  │ [View]   ││
│ │ Meals        │ Lunch   │ ₹500   │ DRAFT  │ [View]   ││
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ⏳ Pending (5)                                   ▼      │
├─────────────────────────────────────────────────────────┤
│ │ Category     │ Sub Cat │ Amount │ Status     │ View ││
│ │ Travel       │ Hotel   │ ₹12k   │ IN_REVIEW  │ [👁] ││
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📚 History (20)                                  ►      │
└─────────────────────────────────────────────────────────┘
(collapsed)
```

---

#### 9.2.2 Status Badges

**Design:**
- Pill shape (rounded-full)
- Small text (text-xs)
- Colored background + text
- Example: `<span class="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">PAID</span>`

**Usage:** Everywhere status is displayed (tables, detail modal, chain view)

---

#### 9.2.3 Timeline View (ChainView.tsx)

**Design:**
- Vertical timeline with dots
- Each step: Avatar (or icon) + Name + Status + Timestamp
- Status indicators: Pending (gray), Approved (green), Current (blue pulse)
- Logs displayed inline below each step (public logs)
- Private Ask logs shown only to sender + initiator + Owner

**Visual:**
```
┌─────────────────────────────────────────────┐
│ Approval Chain                              │
├─────────────────────────────────────────────┤
│ ● John Doe (Manager)                        │
│   ✓ Approved — May 15, 2026 10:30 AM       │
│                                             │
│ ● Jane Smith (Senior Manager)              │
│   ✓ Approved — May 16, 2026 02:15 PM       │
│                                             │
│ ⏳ Alice Owner (Owner)                      │
│   ⏳ Pending approval...                    │
│                                             │
│ ○ CA Name (Accountant)                     │
│   ⏳ Awaiting...                            │
└─────────────────────────────────────────────┘
```

---

#### 9.2.4 Modal Dialogs

**Types:**
1. **NewReimbursementModal** — Create new reimbursement
2. **ReimbursementDetailModal** — View full detail + items + chain
3. **QueryAskDialog** — Raise query or ask
4. **CAPayDialog** — CA payment form
5. **AttachmentViewerModal** — View attachment (image preview / PDF)

**Design:**
- Overlay backdrop (bg-black/50)
- Centered modal card (max-w-2xl)
- Header with title + close button
- Body with scrollable content
- Footer with action buttons

---

#### 9.2.5 Analytics Dashboard (AnalyticsPage.tsx)

**Layout:**
- KPI Tiles (4 tiles: Total Spend, Pending, Paid Out, Reimbursements)
- Status Distribution (Donut Chart)
- Monthly Trend (Line Chart)
- Category Spend (Bar Chart)
- Department Spend (Bar Chart)
- Top Spenders (Table)

**Charts:** Inline SVG (no external library)

**Visual:**
```
┌────────────┬────────────┬────────────┬────────────┐
│ Total Spend│  Pending   │  Paid Out  │ Reimburse  │
│  ₹1,23,456 │  ₹45,000   │  ₹78,456   │    142     │
└────────────┴────────────┴────────────┴────────────┘

┌─────────────────────┐  ┌─────────────────────────┐
│ Status Distribution │  │   Monthly Trend (6M)    │
│   (Donut Chart)     │  │    (Line Chart)         │
└─────────────────────┘  └─────────────────────────┘

┌─────────────────────┐  ┌─────────────────────────┐
│  Category Spend     │  │   Department Spend      │
│   (Bar Chart)       │  │    (Bar Chart)          │
└─────────────────────┘  └─────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Top Spenders                                    │
│ 1. John Doe         ₹25,000                     │
│ 2. Jane Smith       ₹20,000                     │
│ 3. Alice Owner      ₹18,000                     │
└─────────────────────────────────────────────────┘
```

---

#### 9.2.6 AppHeader Navigation

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Expense Manager    Home | Expense | Allowance    │
│                           Analytics | Profile | Settings │
│                           [🔔 3] [User ▼]               │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Logo + Brand name (left)
- Nav links (center)
- Notifications bell icon with unread count badge
- User dropdown (logout)

**Role-based visibility:**
- Analytics link: Owner/CA only
- Settings link: Admin only

---

### 9.3 Responsive Design

**Breakpoints:**
- Mobile: `< 640px` (stacked layout)
- Tablet: `640px - 1024px` (2-column grid)
- Desktop: `> 1024px` (3-column grid)

**Mobile Considerations:**
- Collapsible navigation
- Single-column tables (stacked cards on mobile)
- Touch-friendly buttons (min 44px height)
- Swipe gestures for modals

---

### 9.4 UX Patterns

#### 9.4.1 Loading States
- Skeleton loaders for tables
- Spinner for buttons during async actions
- "Loading..." text for long operations

#### 9.4.2 Empty States
- Friendly message + icon
- Call-to-action button (e.g., "Create your first reimbursement")

#### 9.4.3 Error Handling
- Toast notifications for errors (react-hot-toast)
- Inline error messages in forms
- ErrorCard component for page-level errors

#### 9.4.4 Success Feedback
- Toast notifications for success (green)
- Status badge updates
- Auto-refresh lists after mutation

---

## 10. Data Models & Collections

### 10.1 MongoDB Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | Employee profiles | `name, email, password_hash, departments[], managers[], is_active` |
| `departments` | Department metadata | `name, code, owner_ids[], is_active` |
| `reimbursement_categories` | Categories + limits | `name, sub_categories[], max_limit, allowed_roles[], department_ids[], requires_invoice` |
| `reimbursements` | Main reimbursement docs | `reimbursement_code, initiator_id, status, items[], approval_chain[], current_step, current_reviewer_id, business_trip_meta` |
| `reimbursement_items` | Line items (embedded) | `category_id, sub_category, amount, expense_date, attachments[]` |
| `reimbursement_logs` | Action logs | `reimbursement_id, action, action_by, message, visibility, created_at` |
| `approval_steps` | Per-step tracking (embedded in chain) | `user_id, name, email, priority, approval_type, status, approved_at, approved_by` |
| `payment_methods` | UPI/QR per user | `user_id, type, upi_id, qr_image_url, is_default` |
| `notifications` | In-app notifications | `user_id, type, title, message, reimbursement_id, is_read, created_at` |
| `sla_events` | Overdue tracker | `reimbursement_id, event_type, triggered_at, resolved_at` |
| `audit_events` | Mutation logs | `collection, document_id, action, actor_id, before, after, timestamp` |
| `holidays` | Non-business days | `date, name, is_active` |
| `system_settings` | SLA config | `approval_sla_days, query_response_days` |
| `counters` | Sequence generator | `type, year, sequence` |
| `attachments` | GridFS binary storage | `filename, content_type, length, upload_date, metadata` |
| `pending_signups` | OTP verification | `email, otp_hash, name, password_hash, created_at` (TTL index) |

---

### 10.2 Key Indexes

**Reimbursements:**
- `{ reimbursement_code: 1 }` (unique)
- `{ initiator_id: 1, status: 1 }`
- `{ current_reviewer_id: 1, status: 1 }`
- `{ "approval_chain.user_id": 1 }`
- `{ status: 1, updated_at: 1 }`

**Users:**
- `{ email: 1 }` (unique)
- `{ departments.department_id: 1 }`
- `{ managers.manager_id: 1 }`

**Notifications:**
- `{ user_id: 1, is_read: 1, created_at: -1 }`

**Reimbursement Logs:**
- `{ reimbursement_id: 1, created_at: -1 }`

**SLA Events:**
- `{ reimbursement_id: 1, event_type: 1, resolved_at: 1 }`

---

### 10.3 Reimbursement Document Schema (Example)

```javascript
{
  "_id": ObjectId("..."),
  "reimbursement_code": "RB-2026-000123",
  "initiator_id": "user_id_123",
  "initiator_name": "John Doe",
  "initiator_email": "john@example.com",
  "form_type": "general",  // or "business_trip"
  "status": "IN_REVIEW",
  "items": [
    {
      "category_id": "cat_id_1",
      "category_name": "Travel",
      "sub_category": "Flight",
      "amount": 5000.00,
      "expense_date": "2026-05-15",
      "description": "Mumbai to Delhi flight",
      "attachments": ["attachment_id_1", "attachment_id_2"]
    }
  ],
  "total_amount": 5000.00,
  "business_trip_meta": null,  // or { from_date, to_date }
  "approval_chain": [
    {
      "user_id": "mgr_id_1",
      "name": "Manager Name",
      "email": "mgr@example.com",
      "priority": 1,
      "approval_type": "mandatory",
      "status": "APPROVED",
      "approved_at": "2026-05-16T10:30:00Z",
      "approved_by": "mgr_id_1"
    },
    {
      "user_id": "owner_id_1",
      "name": "Owner Name",
      "email": "owner@example.com",
      "priority": 2,
      "approval_type": "mandatory",
      "status": "PENDING",
      "approved_at": null,
      "approved_by": null
    },
    {
      "user_id": "ca_id_1",
      "name": "CA Name",
      "email": "ca@example.com",
      "priority": 3,
      "approval_type": "mandatory",
      "status": "PENDING",
      "approved_at": null,
      "approved_by": null
    }
  ],
  "current_step": 1,
  "current_reviewer_id": "owner_id_1",
  "submitted_at": "2026-05-15T14:00:00Z",
  "paid_at": null,
  "paid_by": null,
  "transaction_ref": null,
  "payment_method": null,
  "acknowledged_at": null,
  "acknowledged_by": null,
  "rejected_at": null,
  "rejected_by": null,
  "created_at": "2026-05-15T12:00:00Z",
  "updated_at": "2026-05-16T10:30:00Z"
}
```

---

## Summary

This document provides a **complete context** of the Expense Manager system, including:

✅ **Architecture & Tech Stack** — Frontend (React 19 + Vite + TypeScript) + Backend (FastAPI + Python 3.13 + MongoDB)  
✅ **User Roles & Permissions** — Employee, Manager, Owner, CA, Admin  
✅ **Core Business Workflow** — State machine with frozen approval chains  
✅ **Frontend Structure** — Pages, Components, Hooks, Utils (API clients)  
✅ **Backend Structure** — Routes, Schemas, Controllers, Services  
✅ **Complete API Mapping** — Frontend functions → Backend endpoints (50+ endpoints documented)  
✅ **Business Logic Controllers** — ApprovalChainBuilder, ReimbursementStateMachine, NotificationService, SLAEngine  
✅ **Current UI Design** — Collapsible sections, status badges, timeline view, modal dialogs, analytics dashboard  
✅ **Data Models** — MongoDB collections + schemas  

---

**Next Steps:**
You can now provide your UI redesign requirements, and I'll apply the changes systematically across the frontend components while preserving the backend API contracts.

---

**Document Version:** 1.0  
**Last Updated:** May 29, 2026
