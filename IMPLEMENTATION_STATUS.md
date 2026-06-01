# Implementation Status — Expense Manager

**Last Updated:** 2026-05-25  
**Project:** Real Dashboard — Expense Management (Reimbursement System)

---

## ✅ **Completed Phases (1-8)**

### **Phase 0** — Project Scaffolding ✅
- FastAPI backend with MongoDB (PyMongo + mongomock for tests)
- React 19 + Vite + TypeScript frontend
- Tailwind CSS v4 with custom theme (`#00703C` brand green)
- JWT authentication, bcrypt password hashing
- Rotating file logger, health endpoint
- `.env` configuration with pydantic-settings

### **Phase 1** — Authentication & JWT ✅
- `/api/auth/login` — JWT token generation
- `/api/auth/me` — current user profile
- `/api/auth/logout` — token invalidation
- JWT middleware (`getCurrentUserDependency`, `getAdminUserDependency`, `getOwnerUserDependency`)
- Frontend: AuthContext, LoginPage, ProtectedRoute

### **Phase 2** — Email Verification & Signup ✅
- `/api/auth/signup`, `/api/auth/verify-email`, `/api/auth/resend-code`
- 6-digit OTP verification with TTL (10 min expiry)
- `pending_signups` collection with unique email + TTL index
- Email service using aiosmtplib (Zoho SMTP credentials from `.env`)
- Frontend: SignupPage (two-step form: signup details → OTP verification)

### **Phase 3** — Users, Departments, Hierarchy ✅
- **Backend:**
  - `department_schemas.py`, `department_routes.py` (CRUD, Owner/Admin guards)
  - `user_schemas.py`, `user_routes.py` (CRUD, manager hierarchy, role-based access)
  - Multi-department roles, `managers[]` with priority + `approval_type` (mandatory/optional)
  - Soft-delete (`is_active`), audit logging
- **Frontend:**
  - `types/user.ts`, `types/department.ts`
  - `userApi.ts`, `departmentApi.ts`
  - `UserDropdown` component (async search, selection)
- **Tests:** 6 integration tests (department + user routes) — all passing

### **Phase 4** — Categories & Allowance ✅
- **Backend:**
  - `category_schemas.py` (CategoryCreateRequest, CategoryUpdateRequest, CategoryResponseSchema, AssigneeSchema, AllowanceWithAssigneesSchema)
  - `category_routes.py` (Owner-only CRUD: create, list, update, delete)
  - `allowance_routes.py` (`GET /my` — user-scoped, `GET /all` — admin view with assignees)
  - Role + department matching logic (`_userMatchesCategory`)
- **Frontend:**
  - `types/category.ts`
  - `categoryApi.ts`, `allowanceApi.ts`
  - `AllowanceDetailsPage` (smart role-based view)
  - `AllowanceCard`, `AssigneeList` components
  - Wired into `/allowance` route

### **Phase 5** — Payment Methods ✅
- **Backend:**
  - `payment_method_schemas.py` (PaymentMethodCreateRequest, PaymentMethodResponseSchema)
  - `payment_method_routes.py` (create, list, set default, delete)
  - `hasAnyPaymentMethod(strUserId)` helper for submit guard
- **Frontend:**
  - `types/paymentMethod.ts`
  - `paymentMethodApi.ts`
  - `ProfilePage` (UPI ID / QR Code management)
  - Wired into `/profile` route

### **Phase 6** — Attachments (GridFS) ✅
- **Backend:**
  - `utils/file_utils.py` (MIME validation, 10 MB limit, allowed: jpg, jpeg, png, webp, pdf, docx)
  - `attachment_routes.py` (upload, download, delete — using GridFS)
  - Binary streaming with proper Content-Type headers
- **Frontend:**
  - `attachmentApi.ts`
  - `FileUploadWithPreview` component (image preview, PDF icon)

### **Phase 7** — Reimbursement Core ✅
- **Backend:**
  - `reimbursement_schemas.py` (ReimbursementItemSchema, BusinessTripMetaSchema, ReimbursementCreateRequest, ReimbursementUpdateRequest, ReimbursementResponseSchema, ReimbursementListItemSchema)
  - `reimbursement_routes.py`:
    - `POST /draft` — create draft
    - `PUT /{id}/draft` — update draft
    - `POST /{id}/submit` — submit (guards: payment method → SUBMITTED)
    - `GET /my?bucket=draft|pending|history` — list buckets
    - `GET /{id}` — detail view
    - `DELETE /{id}` — delete draft
  - Business-trip date validation
  - Payment method guard on submit
- **Frontend:**
  - `types/reimbursement.ts`
  - `reimbursementApi.ts`
  - `ExpenseManagementPage` (Draft/Pending/History list view)
  - Wired into `/expense` route

### **Phase 8** — Approval Chain Engine ✅
- **Backend:**
  - `controllers/ApprovalChainBuilder.py` — `buildChain()` walks manager hierarchy by priority, climbs to Owner, adds CA; `snapshotChain()` serializes for frozen storage
  - `controllers/ReimbursementStateMachine.py` — `transition()` enforces state machine logic with atomic Mongo updates (`{ _id, current_reviewer_id }` filter to prevent double approval)
  - `routes/approval_routes.py`:
    - `POST /api/approvals/{id}/approve`
    - `POST /api/approvals/{id}/query` (body: `{ message }`)
    - `POST /api/approvals/{id}/ask` (body: `{ message }`)
    - `POST /api/approvals/{id}/reapply` (initiator only)
  - `schemas/approval_schemas.py` (ApproveRequest, QueryRequest, AskRequest, ReapplyRequest)
  - Logs all actions to `reimbursement_logs` collection
  - Reimbursement submit now builds chain, sets `approval_chain`, `current_step`, `current_reviewer_id`
- **Frontend:**
  - `ExpenseManagementPage` — **collapsible UI** (inspired by Drake Job Lifecycle screenshot):
    - Draft / Pending / History sections with expand/collapse icons
    - Status badges (colored pills: DRAFT, SUBMITTED, IN_REVIEW, etc.)
    - Count badges on section headers
    - Clean table-like rows
  - `AppHeader` — now includes Profile and Settings links (Settings admin-only)
  - `SettingsPage` — tabbed placeholder (Users, Departments, Categories, SLA, Holidays)
  - `ProfilePage` — enhanced with payment method management UI

---

## ⬜ **Remaining Phases (9-16)**

### **Phase 9** — Chain View & Logs ⬜
**Scope:**
- `GET /api/reimbursements/{id}/chain` — frozen chain + step statuses + visible logs
- Frontend: ChainView component (timeline, avatar, status badges, messages)
- Public/private log filtering (Ask messages decrypted only for sender + initiator + Owner/Admin)

### **Phase 10** — CA Workflow & Payment ⬜
**Scope:**
- `routes/ca_routes.py` (CA-only: pending, query, pay, reject)
- One CA-query allowed per reimbursement
- `POST /api/reimbursements/{id}/acknowledge` (initiator: PAID → PAYMENT_ACKNOWLEDGED → CLOSED)
- Frontend: CA Pending panel, AcknowledgePaymentDialog

### **Phase 11** — Notifications (In-app) ⬜
**Scope:**
- `controllers/NotificationDispatcher.py` — targeted notifications
- `routes/notification_routes.py` (my, mark-read, mark-all-read)
- Frontend: Bell icon in AppHeader, unread badge, dropdown, light polling (30s)

### **Phase 12** — SLA Engine & Scheduler ⬜
**Scope:**
- `services/scheduler_service.py` — APScheduler hourly job
- `controllers/SLAEngine.py` (overdue approvals, query response timeout → AUTO_REJECTED)
- Email escalation to admin/owner
- `sla_events` collection logging

### **Phase 13** — Settings Page ⬜
**Scope:**
- `routes/settings_routes.py`, `routes/holiday_routes.py`
- Frontend: SettingsPage (tabs: Users, Hierarchy, Categories, SLA, Holidays)
- Components: UserManager, HierarchyManager, CategoryManager, SLAConfig, HolidayManager

### **Phase 14** — Analytics ✅
- **Backend:** `routes/analytics_routes.py` — 6 admin-only endpoints:
  - `GET /api/analytics/summary` (totals + amounts KPIs)
  - `GET /api/analytics/by-status` (status counts/totals)
  - `GET /api/analytics/by-category` (spend per category)
  - `GET /api/analytics/by-department` (spend per primary department)
  - `GET /api/analytics/monthly-trend?months=N` (time series)
  - `GET /api/analytics/top-spenders?limit=N` (ranked approved spend)
- **Frontend:** `pages/AnalyticsPage.tsx` (`/analytics`, owner-guarded)
  - KPI tiles, status donut, monthly trend line, category & department bars, top-spenders table
  - Inline SVG charts (`BarChart`, `DonutChart`, `LineChart`) — no external chart lib
- `AppHeader` Analytics link visible to Owner/CA
- Aggregation queries: total reimbursements, avg approval time, category breakdown, etc.

### **Phase 15** — Mobile Responsive ⬜
**Scope:**
- Tailwind responsive breakpoints (`sm`, `md`, `lg`)
- Mobile-first collapsible nav, touch-friendly buttons

### **Phase 16** — Production Hardening ⬜
**Scope:**
- Rate limiting (FastAPI rate-limit middleware)
- Security review (CORS, CSP headers, input sanitization)
- Deployment docs (Docker, env vars, MongoDB replica set, SSL, reverse proxy)

---

## 📦 **Backend Files Created**

| File | Purpose |
|------|---------|
| `sourcecode/main.py` | FastAPI app entry-point, router includes, lifespan hooks |
| `sourcecode/env_config.py` | Environment variable loader (pydantic-settings) |
| `sourcecode/config/mongodb_config.py` | MongoDB connection, `get_collection()`, index bootstrap |
| `sourcecode/middleware/jwt_middleware.py` | JWT decode, role guards (getCurrentUser, getAdmin, getOwner) |
| `sourcecode/schemas/common_enums.py` | Shared enums (UserRoleEnum, ReimbursementStatusEnum, etc.) |
| `sourcecode/schemas/auth_schemas.py` | Auth request/response schemas (login, signup, verify) |
| `sourcecode/schemas/user_schemas.py` | User CRUD schemas |
| `sourcecode/schemas/department_schemas.py` | Department CRUD schemas |
| `sourcecode/schemas/category_schemas.py` | Category + Allowance schemas |
| `sourcecode/schemas/payment_method_schemas.py` | Payment method schemas |
| `sourcecode/schemas/reimbursement_schemas.py` | Reimbursement schemas |
| `sourcecode/routes/auth_routes.py` | Auth routes (login, signup, verify, logout) |
| `sourcecode/routes/user_routes.py` | User CRUD routes |
| `sourcecode/routes/department_routes.py` | Department CRUD routes |
| `sourcecode/routes/category_routes.py` | Category CRUD routes (Owner-only) |
| `sourcecode/routes/allowance_routes.py` | Allowance read-only views |
| `sourcecode/routes/payment_method_routes.py` | Payment method CRUD routes |
| `sourcecode/routes/attachment_routes.py` | Attachment upload/download (GridFS) |
| `sourcecode/routes/reimbursement_routes.py` | Reimbursement CRUD routes |
| `sourcecode/controllers/AuditLogger.py` | Audit log writer (`logMutation`) |
| `sourcecode/utils/email_service.py` | Email sender (aiosmtplib) |
| `sourcecode/utils/file_utils.py` | File validation (MIME, size) |

---

## 📦 **Frontend Files Created**

| File | Purpose |
|------|---------|
| `client/src/App.tsx` | Route table (/, /login, /signup, /expense, /allowance, /profile, /settings) |
| `client/src/main.tsx` | React entry-point, AuthProvider wrapper |
| `client/src/context/AuthContext.tsx` | Global auth state (login, logout, refreshUser) |
| `client/src/hooks/useAuth.tsx` | Re-export of `useAuthContext` |
| `client/src/components/ProtectedRoute.tsx` | Route guard (redirects unauthed to /login) |
| `client/src/components/AppHeader.tsx` | Top navbar (Expense Management, Allowance Details) |
| `client/src/components/Footer.tsx` | Footer component |
| `client/src/components/common/UserDropdown.tsx` | Reusable async user search dropdown |
| `client/src/components/common/FileUploadWithPreview.tsx` | File upload component (image preview, PDF icon) |
| `client/src/components/allowance/AllowanceCard.tsx` | Category details card |
| `client/src/components/allowance/AssigneeList.tsx` | Assignee table for admin view |
| `client/src/pages/LoginPage.tsx` | Login form |
| `client/src/pages/SignupPage.tsx` | Two-step signup (details → OTP) |
| `client/src/pages/AllowanceDetailsPage.tsx` | Allowance read-only view |
| `client/src/pages/ProfilePage.tsx` | User profile + payment method management |
| `client/src/pages/ExpenseManagementPage.tsx` | Reimbursement list (Draft/Pending/History) |
| `client/src/types/user.ts` | User, DepartmentEntry, ManagerEntry types |
| `client/src/types/department.ts` | Department types |
| `client/src/types/category.ts` | Category, Allowance types |
| `client/src/types/paymentMethod.ts` | PaymentMethod types |
| `client/src/types/reimbursement.ts` | Reimbursement, ReimbursementItem types |
| `client/src/utils/apiClient.ts` | Axios instance with auth interceptor |
| `client/src/utils/authApi.ts` | Auth API wrappers |
| `client/src/utils/userApi.ts` | User API wrappers |
| `client/src/utils/departmentApi.ts` | Department API wrappers |
| `client/src/utils/categoryApi.ts` | Category API wrappers |
| `client/src/utils/allowanceApi.ts` | Allowance API wrappers |
| `client/src/utils/paymentMethodApi.ts` | Payment method API wrappers |
| `client/src/utils/attachmentApi.ts` | Attachment API wrappers |
| `client/src/utils/reimbursementApi.ts` | Reimbursement API wrappers |

---

## 🎯 **Next Steps (Phase 8+)**

1. **Approval Chain Engine** — most critical; unblocks workflow
2. **Chain View & Logs** — visualization layer for chain
3. **CA Workflow** — final payment approval
4. **Notifications** — in-app alerts
5. **SLA Engine** — auto-reject overdue queries
6. **Settings Page** — admin UI for categories, SLA config, holidays
7. **Analytics** — reporting dashboard
8. **Mobile Responsive** — ensure all pages work on mobile
9. **Production Hardening** — rate limiting, security review, deployment docs

---

## 🧪 **Testing Notes**

- **Integration tests:** Skipped per user request (no test generation)
- **Manual testing:** All endpoints should be tested via Postman/Thunder Client or frontend
- **Existing tests:** 6 department/user route tests (mongomock) — all passing

---

## 🚀 **How to Run**

### Backend
```bash
cd c:\aryan\ExpenseManager
.venv\Scripts\activate
python sourcecode/main.py
```

### Frontend
```bash
cd c:\aryan\ExpenseManager\client
npm run dev
```

### MongoDB
- Local: `mongodb://localhost:27017` or configure in `.env`

---

**Summary:** Phases 1-7 complete (auth, users, departments, categories, allowance, payment methods, attachments, reimbursement core). Phases 8-16 remain (approval engine, chain view, CA workflow, notifications, SLA, settings, analytics, mobile, production hardening).
