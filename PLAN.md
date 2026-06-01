# PLAN.md — Expense Management (Real Dashboard App)

> **Source of Truth:** `.augment/rules/REAL_DASHBOARD_APP.txt`
> **Backend Rules:** `.augment/skills/backend/backend.md`
> **Frontend Rules:** `.augment/skills/frontend/frontend.md`
> **Agent Rules:** `.augment/rules/Augment_instruction.md`

---

## 1. System Understanding (Connected Dots)

The **Expense Management** module is a new component under the existing **Real Dashboard App** (React 19 + Vite + TypeScript front-end, FastAPI + Python 3.13 + MongoDB back-end). It replaces the company's offline reimbursement (HRMS) process with an online workflow.

### 1.1 Actors
| Actor | Capability |
|---|---|
| **Initiator (Employee/Junior)** | Creates reimbursement, uploads invoice/business-trip, edits drafts, re-applies on query, acknowledges payment. |
| **Manager** | Reviews team reimbursements, Approves / Queries / Asks (private). Cannot modify after approval. |
| **Owner** (Anirudh Sureka, Smeeta Sureka) | Top of every chain. Manages hierarchy, categories, limits, views all (incl. private Ask), analytics. |
| **CA / Accountant** | Final approver. Pays the employee. One CA-Query allowed; after re-apply only `Paid` / `Reject`. |
| **Admin** | Settings page — users, departments, categories, SLA day config, holidays. |

### 1.2 Core Workflow
`DRAFT → SUBMITTED → IN_REVIEW → (QUERY_RAISED | PRIVATE_ASK | REAPPLIED loop) → OWNER_APPROVED → CA_PENDING → (CA_QUERY → CA_REAPPLIED)? → PAID → PAYMENT_ACKNOWLEDGED → CLOSED`
Auto-rejection paths: `AUTO_REJECTED` (SLA), `REJECTED` (manual final).

### 1.3 Hard Rules (extracted)
- **Chain Snapshot** — built dynamically on submission, then **frozen** (never recalculated).
- **One current reviewer** at a time (`current_reviewer_id`, `current_step`).
- **Query** returns reimbursement to initiator → re-apply jumps **only** to querying manager (not chain restart).
- **Ask** is private — only sender + initiator + Owner/Admin can read.
- **CA** can query only **once**.
- **Payment method** (UPI ID / QR scanner) is mandatory **before first submission of a new reimbursement** (not on re-apply).
- **Approved managers** can neither modify nor query later.
- **SLA** counted in business days (skip Sat/Sun + holiday table). Default: 3 days approval, 2 days query response.
- **Attachments** stored as **binary inside MongoDB** (jpg, jpeg, png, webp, pdf, docx).
- **Reimbursement code** centralised counter → `RB-YYYY-000001`.
- **Audit** every mutation with `{ before, after, action }`.
- **Concurrency** via atomic Mongo filter `{ _id, current_reviewer_id }`.

### 1.4 Naming Convention (Augment Rule)
camelCase with type prefix — `strEmail`, `iCount`, `bIsActive`, `lsObjItems`, `dictResponse`, `objCollection`.

---

## 2. Target File Layout

### 2.1 Backend (`sourcecode/`)
```
sourcecode/
├── main.py
├── env_config.py
├── config/
│   └── mongodb_config.py
├── middleware/
│   ├── jwt_middleware.py
│   └── audit_middleware.py
├── routes/
│   ├── auth_routes.py
│   ├── user_routes.py
│   ├── department_routes.py
│   ├── category_routes.py
│   ├── allowance_routes.py
│   ├── reimbursement_routes.py
│   ├── approval_routes.py
│   ├── ca_routes.py
│   ├── payment_method_routes.py
│   ├── notification_routes.py
│   ├── settings_routes.py
│   ├── holiday_routes.py
│   └── attachment_routes.py
├── schemas/
│   ├── auth_schemas.py
│   ├── user_schemas.py
│   ├── department_schemas.py
│   ├── category_schemas.py
│   ├── reimbursement_schemas.py
│   ├── approval_schemas.py
│   ├── payment_method_schemas.py
│   ├── notification_schemas.py
│   ├── settings_schemas.py
│   ├── holiday_schemas.py
│   └── common_enums.py
├── controllers/
│   ├── ApprovalChainBuilder.py
│   ├── ReimbursementStateMachine.py
│   ├── NotificationDispatcher.py
│   ├── AuditLogger.py
│   ├── SLAEngine.py
│   └── ReimbursementCounter.py
├── services/
│   ├── email_service.py
│   └── scheduler_service.py
├── utils/
│   ├── date_utils.py
│   ├── business_day_utils.py
│   ├── file_utils.py
│   ├── crypto_utils.py
│   └── response_utils.py
└── logs/
```

### 2.2 Frontend (`client/src/`)
```
client/src/
├── components/
│   ├── AppHeader.tsx (existing)
│   ├── Footer.tsx (existing)
│   ├── ErrorCard.tsx
│   ├── common/
│   │   ├── InfoTooltip.tsx
│   │   ├── PageSectionHeader.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ActionButton.tsx
│   │   ├── TimelineCard.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSkeleton.tsx
│   ├── Reimbursement/
│   │   ├── NewReimbursementModal.tsx
│   │   ├── UploadInvoiceForm.tsx
│   │   ├── BusinessTripForm.tsx
│   │   ├── ReimbursementRow.tsx
│   │   ├── ChainView.tsx
│   │   ├── QueryAskDialog.tsx
│   │   ├── PaymentMethodPrompt.tsx
│   │   └── AcknowledgePaymentDialog.tsx
│   ├── Allowance/
│   │   ├── AllowanceCard.tsx
│   │   └── AssigneeList.tsx
│   └── Settings/
│       ├── UserManager.tsx
│       ├── CategoryManager.tsx
│       ├── HierarchyManager.tsx
│       ├── SLAConfig.tsx
│       └── HolidayManager.tsx
├── pages/
│   ├── ExpenseManagementPage.tsx
│   ├── AllowanceDetailsPage.tsx
│   ├── ProfilePage.tsx
│   └── SettingsPage.tsx
├── utils/
│   ├── reimbursementApi.ts
│   ├── categoryApi.ts
│   ├── allowanceApi.ts
│   ├── paymentMethodApi.ts
│   ├── notificationApi.ts
│   ├── settingsApi.ts
│   └── userApi.ts
├── hooks/
│   ├── useAuth.tsx (existing)
│   ├── useReimbursement.ts
│   ├── useNotification.ts
│   └── useCategory.ts
├── types/
│   ├── reimbursement.ts
│   ├── category.ts
│   ├── user.ts
│   └── notification.ts
└── context/
    └── ReimbursementContext.tsx
```

### 2.3 Tests
```
API Test/
├── auth_routes/Test/test.py
├── reimbursement_routes/Test/test.py
├── approval_routes/Test/test.py
├── ca_routes/Test/test.py
├── category_routes/Test/test.py
├── settings_routes/Test/test.py
└── ... (one folder per route file)
client/__tests__/  (Jest)
```

---

## 3. MongoDB Collections (Final Set)

| Collection | Purpose |
|---|---|
| `users` | Employee profile + `departments[]` (multi-role) + `managers[]` (priority + approval_type) |
| `departments` | Department metadata + `owner_ids[]` |
| `reimbursement_categories` | Categories, sub_categories, max_limit, allowed_roles, requires_invoice |
| `reimbursements` | Main reimbursement doc (status, chain snapshot, current reviewer) |
| `reimbursement_items` | Line items (category, sub_cat, amount, date, attachments[]) |
| `reimbursement_logs` | Action log (QUERY/ASK/APPROVE/REJECT/PAID/ACK) |
| `approval_steps` | Per-step approval tracking |
| `payment_methods` | UPI ID / QR scanner per user |
| `notifications` | In-app notifications |
| `sla_events` | Overdue tracker |
| `audit_events` | `{ before, after, action }` mutation log |
| `holidays` | Admin-managed non-business days |
| `system_settings` | `approval_sla_days`, `query_response_days`, etc. |
| `counters` | Centralised numbering (`RB-2026-000001`) |
| `attachments` | Binary file storage (GridFS) |

---

## 4. Phase-wise Task List

> **Status Legend:** ⬜ Pending · 🟡 In Progress · ✅ Completed · ⛔ Blocked

---

### **PHASE 0 — Project Scaffolding & Bootstrap** ✅
**Goal:** Lay out repo, virtual env, install deps, base FastAPI + Vite apps boot.

#### Backend
- ✅ Create `sourcecode/` tree per §2.1 (empty `__init__.py` in each pkg).
- ✅ `py -3.13 -m venv .venv` ; activate.
- ✅ Install: `fastapi`, `uvicorn[standard]`, `pymongo`, `motor`, `pydantic`, `pydantic-settings`, `python-jose[cryptography]`, `passlib[bcrypt]`, `python-multipart`, `python-dotenv`, `apscheduler`, `aiosmtplib`, `email-validator`, `pytest`, `pytest-asyncio`, `httpx`. `requirements.txt` frozen.
- ✅ `sourcecode/main.py` — FastAPI app, CORS, router includes (empty), startup/shutdown hooks, rotating-file logging.
- ✅ `sourcecode/env_config.py` — typed env loader (Mongo URL, JWT secret, SMTP, etc.).
- ✅ `sourcecode/config/mongodb_config.py` — `get_collection(name)`, `ping_mongo()`, `ensure_indexes()`.
- ✅ Log rotation config under `sourcecode/logs/`.

#### Frontend
- ✅ Scaffold `client/` via `npm create vite@latest client -- --template react-ts` → React 19.2.6 + Vite 8.0.12 + TypeScript 6.
- ✅ Install: `react-router-dom@7`, `axios`, `zod`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `react-icons`, `sonner`, `react-hot-toast`, `clsx`, `tailwind-merge`, `class-variance-authority`.
- ✅ Tailwind v4 (`@tailwindcss/vite`) + `@theme` tokens (brand `#00703C`) from `ui_schema_guidelines.md`. `components/ui/` dir ready for shadcn additions.
- ✅ `client/src/App.tsx` routes scaffold (`/`, `/login`, `/expense`, `/allowance`, `/profile`, `/settings`, `/home`).
- ✅ `.env` + `.env.example` for backend & frontend; `.gitignore` at root. No secrets committed.
- ✅ Vite proxy `/api → http://localhost:8000`; path alias `@/* → src/*`.
- ✅ `AppHeader`, `Footer`, `ErrorCard`, `HomePage`, `PlaceholderPage`, `apiClient.ts`, `healthApi.ts` created.

#### Deliverables (verified)
- ✅ Backend boots; `GET /api/health` over HTTP returns `{ "success": true, "app": "ExpenseManager", "env": "development", "version": "0.1.0" }`.
- ✅ MongoDB connected; 11 indexes ensured on startup.
- ✅ `npm run build` succeeds (0 TS errors, 313 KB JS / 13 KB CSS).

---

### **PHASE 1 — Database Core: Indexes, Counters, Audit, Utils** ✅
**Goal:** Plumbing that every later phase will rely on.

#### Backend
- ✅ `config/mongodb_config.py` → `ensureIndexes()` per §3 (incl. `reimbursements` required indexes).
- ✅ `controllers/ReimbursementCounter.py` → `getNextReimbursementCode(strYear)` (atomic `$inc`).
- ✅ `controllers/AuditLogger.py` → `logMutation(strCollection, dictBefore, dictAfter, strAction, strActorId)`.
- ✅ `utils/date_utils.py` → `getCurrentIst()`, `toIst(dtUtc)`.
- ✅ `utils/business_day_utils.py` → `getBusinessDayDelta(dtStart, iDays)`, `isBusinessDay(dtDate)`.
- ✅ `utils/response_utils.py` → `successResponse(...)`, `errorResponse(...)`.
- ✅ `utils/crypto_utils.py` → `generateAskKeyPair()`, `encryptAskMessage(...)`, `decryptAskMessage(...)`.
- ✅ `schemas/common_enums.py` → `ReimbursementStatusEnum`, `ActionTypeEnum`, `VisibilityEnum`, `FormTypeEnum`, `PaymentMethodTypeEnum`, `ApprovalTypeEnum`, `NotificationTypeEnum`, `UserRoleEnum`.

#### Tests
- ✅ `API Test/utils/Test/test.py` — business-day skip, counter atomicity, audit insert.

---

### **PHASE 2 — Authentication & JWT Middleware** ✅
**Goal:** Login, JWT issue, role/department-aware `Depends` helpers.

#### Backend
- ✅ `middleware/jwt_middleware.py` → `getCurrentUserDependency`, `getAdminUserDependency`, `getOwnerUserDependency`, `getCaUserDependency`.
- ✅ `routes/auth_routes.py`
  - ✅ `POST /api/auth/login` (body `LoginRequestSchema` → `LoginResponseSchema`)
  - ✅ `POST /api/auth/logout`
  - ✅ `GET  /api/auth/me`
- ✅ `schemas/auth_schemas.py` → `LoginRequestSchema`, `LoginResponseSchema`, `MeResponseSchema`.

#### Frontend
- ✅ `hooks/useAuth.tsx` — `login`, `logout`, `isAuthenticated`, `user`; stores JWT in `localStorage`.
- ✅ `utils/userApi.ts` — `login`, `logout`, `getMe`.
- ✅ `pages/LoginPage.tsx` — react-hook-form + zod. **Trigger:** form `onSubmit` → `login()`.
- ✅ `context/AuthContext.tsx`.

#### Tests
- ✅ `API Test/auth_routes/Test/test.py` — happy path + invalid creds + expired token.

---

### **PHASE 3 — Users, Departments, Hierarchy** ✅
**Goal:** CRUD for `users` & `departments` and the multi-manager hierarchy model.

#### Backend
- ✅ `schemas/department_schemas.py` → `DepartmentCreateRequest`, `DepartmentUpdateRequest`, `DepartmentResponseSchema`.
- ✅ `schemas/user_schemas.py` → `UserCreateRequest`, `UserUpdateRequest`, `UserResponseSchema`, `ManagerEntrySchema`, `UserDepartmentEntrySchema`.
- ✅ `routes/department_routes.py`
  - ✅ `POST   /api/departments/create` (Admin/Owner)
  - ✅ `GET    /api/departments/list`
  - ✅ `PUT    /api/departments/{department_id}` (Admin/Owner)
  - ✅ `DELETE /api/departments/{department_id}` (Owner)
- ✅ `routes/user_routes.py`
  - ✅ `POST   /api/users/create` (Admin/Owner)
  - ✅ `GET    /api/users/list?department_id=&role=`
  - ✅ `GET    /api/users/{user_id}`
  - ✅ `PUT    /api/users/{user_id}` (Admin/Owner)
  - ✅ `PUT    /api/users/{user_id}/managers` (Owner) — update `managers[]` (priority + approval_type).
  - ✅ `DELETE /api/users/{user_id}` (Owner)
- ✅ Validation: `managers[]` must contain unique priorities; cannot self-manage.

#### Frontend
- ✅ `types/user.ts`, `types/department.ts`.
- ✅ `utils/userApi.ts` extend with `listUsers`, `createUser`, `updateUser`, `updateManagers`.
- ✅ Reusable `UserDropdown.tsx` for picker.

#### Tests
- ✅ `API Test/user_routes/Test/test_user_routes.py`, `API Test/department_routes/Test/test_department_routes.py`.

---

### **PHASE 4 — Categories & Allowance** ✅
**Goal:** Category CRUD with sub-categories, max-limit, allowed roles; allowance read-only views.

#### Backend
- ✅ `schemas/category_schemas.py` → `CategoryCreateRequest`, `CategoryUpdateRequest`, `CategoryResponseSchema` (incl. `sub_categories[]`, `max_limit`, `allowed_roles[]`, `department_ids[]`, `requires_invoice`, `approval_required`).
- ✅ `routes/category_routes.py` (Owner-only writes)
  - `POST   /api/categories/create`
  - `GET    /api/categories/list`
  - `PUT    /api/categories/{category_id}`
  - `DELETE /api/categories/{category_id}` (soft-delete via `is_active`)
- ✅ `routes/allowance_routes.py`
  - `GET /api/allowance/my` — categories visible to current user (role/department filter).
  - `GET /api/allowance/all` (Admin/Owner) — full blueprint + assignees per category.
- ✅ Routers registered in `main.py`.

#### Frontend
- ✅ `types/category.ts`.
- ✅ `utils/categoryApi.ts`, `utils/allowanceApi.ts`.
- ✅ `pages/AllowanceDetailsPage.tsx` (read-only).
  - **Trigger:** route mount → `useEffect` → `getMyAllowance()` (employee) OR `getAllAllowance()` (Admin/Owner).
- ✅ `components/allowance/AllowanceCard.tsx`, `components/allowance/AssigneeList.tsx`.
- ✅ Navbar link: **"Allowance Details"** (wired in `App.tsx`).

#### Tests
- ⬜ Integration tests skipped per user request.

---

### **PHASE 5 — Payment Methods (UPI / QR)** ✅
**Goal:** Per-user UPI ID / QR scanner; mandatory on first submit.

#### Backend
- ✅ `schemas/payment_method_schemas.py` → `PaymentMethodCreateRequest` (`type`, `upi_id?`, `qr_image_url?`, `is_default`), `PaymentMethodResponseSchema`.
- ✅ `routes/payment_method_routes.py`
  - `POST   /api/payment-methods/create`
  - `GET    /api/payment-methods/my`
  - `PUT    /api/payment-methods/{id}/default`
  - `DELETE /api/payment-methods/{id}`
- ✅ Helper `hasAnyPaymentMethod(strUserId) -> bool` in payment_method_routes.py.
- ✅ Router registered in `main.py`.

#### Frontend
- ✅ `types/paymentMethod.ts`.
- ✅ `utils/paymentMethodApi.ts`.
- ✅ `pages/ProfilePage.tsx` — upload/manage UPI ID or QR (image URL).
  - **Trigger:** "Create" button `onClick` → `createPaymentMethod()`.
- ⬜ `components/Reimbursement/PaymentMethodPrompt.tsx` modal — shown when user clicks **"New Reimbursement"** and has no payment method (will be implemented in Phase 7).

#### Tests
- ⬜ Integration tests skipped per user request.

---

### **PHASE 6 — Attachments (Binary in MongoDB / GridFS)** ✅
**Goal:** Upload/download attachments (jpg, jpeg, png, webp, pdf, docx) stored as binary.

#### Backend
- ✅ `utils/file_utils.py` → `validateMime()`, `validateFileSize()`, `MAX_FILE_BYTES` (10 MB).
- ✅ `routes/attachment_routes.py`
  - `POST /api/attachments/upload` (multipart) → returns `{ attachment_id, file_name, mime, size }`.
  - `GET  /api/attachments/{attachment_id}` — streams binary with proper Content-Type (auth-checked).
  - `DELETE /api/attachments/{attachment_id}` (Admin only).
- ✅ Router registered in `main.py`.
- ⬜ Auth refinement: restrict download to only initiator / chain participants / Owner / Admin (will be enforced in Phase 7+ when reimbursement context is available).

#### Frontend
- ✅ `utils/attachmentApi.ts`.
- ✅ Reusable `FileUploadWithPreview.tsx` (image preview, PDF icon).
- ⬜ Attach to reimbursement item rows (will be wired in Phase 7).

#### Tests
- ⬜ Integration tests skipped per user request.

---

### **PHASE 7 — Reimbursement Core: Draft, Submit, Items** ✅
**Goal:** Create/edit reimbursement (general + business-trip), draft store, submit (triggers chain build).

#### Backend
- ✅ `schemas/reimbursement_schemas.py`
  - `ReimbursementItemSchema` (category_id, sub_category, amount, expense_date, description, attachments[]).
  - `ReimbursementCreateRequest` (form_type, items[], business_trip_meta?: { from_date, to_date }).
  - `ReimbursementUpdateRequest` (partial — only for DRAFT).
  - `ReimbursementResponseSchema`, `ReimbursementListItemSchema`.
- ✅ `routes/reimbursement_routes.py`
  - `POST   /api/reimbursements/draft` — saves as DRAFT (status only; no chain build).
  - `PUT    /api/reimbursements/{id}/draft` — edit draft (DRAFT only).
  - `POST   /api/reimbursements/{id}/submit` — guards: has payment method? → SUBMITTED (chain build coming in Phase 8).
  - `GET    /api/reimbursements/my?bucket=draft|pending|history`
  - `GET    /api/reimbursements/{id}` (incl. items).
  - `DELETE /api/reimbursements/{id}` (DRAFT only).
- ✅ Business-trip validation: every item's `expense_date` ∈ [from_date, to_date].
- ✅ Payment method guard on submit.
- ✅ Audit on every state change.
- ✅ Router registered in `main.py`.

#### Frontend
- ✅ `types/reimbursement.ts`.
- ✅ `utils/reimbursementApi.ts` — `createDraft`, `updateDraft`, `submit`, `listMy`, `getDetail`, `deleteDraft`.
- ✅ `pages/ExpenseManagementPage.tsx` — collapsible: **Personal Reimbursement** (`Draft` / `Pending` / `History`).
  - **Trigger:** route mount → `listMy('draft' | 'pending' | 'history')` per panel.
- ✅ Wired into `/expense` route in `App.tsx`.
- ⬜ `components/Reimbursement/NewReimbursementModal.tsx`, `UploadInvoiceForm.tsx`, `BusinessTripForm.tsx` — full form UI coming in Phase 8 (complex table forms deferred).

#### Tests
- ⬜ Integration tests skipped per user request.

---

### **PHASE 8 — Approval Chain Engine** ✅
**Goal:** Dynamic chain build on submit; **frozen snapshot**; one current reviewer.

#### Backend
- ✅ `controllers/ApprovalChainBuilder.py`
  - `buildChain(strInitiatorId, strCategoryId, strDepartmentId)` — walks `managers[]` by priority, climbs hierarchy until Owner, adds CA.
  - `snapshotChain(lsObjChain)` — serializes chain for frozen storage.
- ✅ `controllers/ReimbursementStateMachine.py`
  - `transition(strReimbursementId, strActorId, strAction, dictPayload)` — enforces transitions with state machine logic.
  - Atomic Mongo update with filter `{ _id, current_reviewer_id }` to prevent double approval.
  - State transition table (`TRANSITIONS` dict).
- ✅ `routes/approval_routes.py`
  - `POST /api/approvals/{reimbursement_id}/approve`
  - `POST /api/approvals/{reimbursement_id}/query` (body: `{ message }`)
  - `POST /api/approvals/{reimbursement_id}/ask` (body: `{ message }`)
  - `POST /api/approvals/{reimbursement_id}/reapply` (initiator only)
- ✅ `schemas/approval_schemas.py` → `ApproveRequest`, `QueryRequest`, `AskRequest`, `ReapplyRequest`.
- ✅ Logs every action via `reimbursement_logs` collection.
- ✅ Router registered in `main.py`.
- ✅ Reimbursement submit now builds chain, sets `current_step`, `current_reviewer_id`, `approval_chain`.

#### Frontend
- ✅ `pages/ExpenseManagementPage.tsx` — collapsible UI design (Draft / Pending / History) with status badges, count badges.
- ✅ Settings Page and Profile Page added to navbar (admin-only for Settings).
- ⬜ **Team Reimbursement** section for managers (pending approvals / pending completion / history) — Phase 9.
- ⬜ `components/Reimbursement/QueryAskDialog.tsx` — approve/query/ask UI — Phase 9.
- ⬜ `utils/reimbursementApi.ts` extend with `approve`, `query`, `ask`, `reapply`, `listTeam` — Phase 9.

#### Tests
- ⬜ Integration tests skipped per user request.

---

### **PHASE 9 — Chain View & Logs (Public/Private Visibility)** ⬜
**Goal:** Expand-on-click chain visualisation with public Query and access-controlled Ask reveal.

#### Backend
- ⬜ `GET /api/reimbursements/{id}/chain` — returns snapshot + step statuses + visible logs.
  - Visibility filter: `PUBLIC` logs → all participants; `PRIVATE` (Ask) → only sender + initiator + Owner/Admin (decrypt via crypto_utils).
- ⬜ `schemas/reimbursement_schemas.py` → `ChainViewResponseSchema`, `ChainLogEntrySchema`.

#### Frontend
- ⬜ `components/Reimbursement/ChainView.tsx` — timeline list (avatar, name, step, status, timestamp, message).
  - **Trigger:** click on reimbursement row → `getDetail()` + `getChain()`.
- ⬜ Reuse `TimelineCard.tsx`, `StatusBadge.tsx`.
- ⬜ Tooltip (`InfoTooltip`) on every status, action button, badge.

#### Tests
- ⬜ Extend `API Test/reimbursement_routes/Test/test.py` — chain visibility, private Ask decryption rules.

---

### **PHASE 10 — CA Workflow & Payment** ⬜
**Goal:** Owner-approved reimbursements reach CA; one CA-query allowed; mark Paid; initiator acknowledges → CLOSED.

#### Backend
- ⬜ `routes/ca_routes.py` (CA-only)
  - `GET  /api/ca/pending` — `CA_PENDING` + `CA_REAPPLIED`.
  - `POST /api/ca/{reimbursement_id}/query` — only if `ca_query_used === false`; sets flag true.
  - `POST /api/ca/{reimbursement_id}/pay` (body: `PayRequest` — approved_amount per item, txn note).
  - `POST /api/ca/{reimbursement_id}/reject`.
- ⬜ `POST /api/reimbursements/{id}/acknowledge` (initiator-only) — `PAID → PAYMENT_ACKNOWLEDGED → CLOSED`.
- ⬜ Visibility: until acknowledged, reimbursement remains in **Team Pending** for chain managers + Admin.
- ⬜ `schemas/approval_schemas.py` extend with `PayRequest`, `CaQueryRequest`, `CaRejectRequest`, `AcknowledgeRequest`.

#### Frontend
- ⬜ `pages/ExpenseManagementPage.tsx` — additional CA section (CA role only): `CA Pending` panel.
- ⬜ `components/Reimbursement/AcknowledgePaymentDialog.tsx`.
  - **Trigger:** initiator clicks **"Acknowledge Payment"** on a PAID reimbursement → `acknowledge()`.
- ⬜ CA action buttons: `Pay`, `Query` (1-time, disabled after use), `Reject`.

#### Tests
- ⬜ `API Test/ca_routes/Test/test.py` — CA-query one-time guard, pay → ack → CLOSED.

---

### **PHASE 11 — Notifications (In-app)** ⬜
**Goal:** Targeted notifications only to relevant actors (current reviewer, initiator, private participants).

#### Backend
- ⬜ `controllers/NotificationDispatcher.py` — `notify(strUserId, strTitle, strMsg, strType, strRefId)` + bulk variant.
- ⬜ Hooked from state machine for: Submitted, Approved (next reviewer only), Query (initiator only), Ask (private only), Re-applied (querying manager only), Paid (initiator + chain + admin), Acknowledged (chain), SLA overdue.
- ⬜ `routes/notification_routes.py`
  - `GET  /api/notifications/my?unread_only=`
  - `POST /api/notifications/{id}/mark-read`
  - `POST /api/notifications/mark-all-read`
- ⬜ `schemas/notification_schemas.py` → `NotificationResponseSchema`, `MarkReadRequest`.

#### Frontend
- ⬜ `utils/notificationApi.ts`, `hooks/useNotification.ts`.
- ⬜ Bell icon in `AppHeader` with unread badge + dropdown list.
  - **Trigger:** mount → `listMy()`; click bell → open dropdown; click item → `markRead()` + navigate.
  - Light polling every 30s (or WebSocket later).

#### Tests
- ⬜ `API Test/notification_routes/Test/test.py` — targeting correctness for each event.

---

### **PHASE 12 — SLA Engine, Scheduler & Email Escalation** ⬜
**Goal:** Hourly job — overdue detection, reminders, auto-reject queries, escalation email.

#### Backend
- ⬜ `services/scheduler_service.py` — APScheduler `IntervalTrigger(hours=1)` starts in `main.py` lifespan.
- ⬜ `services/email_service.py` — `sendEmail(strTo, strSubject, strHtml)` via SMTP.
- ⬜ `controllers/SLAEngine.py`
  - `scanOverdueApprovals()` — current reviewers past `approval_sla_days` business-days → notify + email admin/owner.
  - `scanOverdueQueryResponses()` — initiator past `query_response_days` → `AUTO_REJECTED` + notify chain.
  - All SLA hits logged in `sla_events`.
- ⬜ Configurable via `system_settings`.

#### Tests
- ⬜ `API Test/sla/Test/test.py` — fake clock; verify auto-reject path.

---

### **PHASE 13 — Settings Page (Admin/Owner)** ⬜
**Goal:** Single page for Admin/Owner to manage users, hierarchy, categories, SLA, holidays.

#### Backend
- ⬜ `schemas/settings_schemas.py` → `SlaSettingsRequest`, `SlaSettingsResponseSchema`.
- ⬜ `routes/settings_routes.py` (Admin/Owner)
  - `GET  /api/settings/sla`
  - `PUT  /api/settings/sla`
- ⬜ `schemas/holiday_schemas.py`, `routes/holiday_routes.py` (Admin)
  - `POST   /api/holidays/create`
  - `GET    /api/holidays/list?year=`
  - `DELETE /api/holidays/{holiday_id}`

#### Frontend
- ⬜ `pages/SettingsPage.tsx` (Admin/Owner only) — tabs: Users · Hierarchy · Categories · SLA · Holidays.
- ⬜ Components: `UserManager.tsx`, `HierarchyManager.tsx`, `CategoryManager.tsx`, `SLAConfig.tsx`, `HolidayManager.tsx`.
- ⬜ `utils/settingsApi.ts` (SLA + holidays).
  - **Triggers:** form `onSubmit` for each tab → matching API.

#### Tests
- ⬜ `API Test/settings_routes/Test/test.py`, `API Test/holiday_routes/Test/test.py`.

---

### **PHASE 14 — Cross-cutting UI Polish (per frontend.md)** ⬜
**Goal:** Tooltips, cursor rules, hover states, responsive, error card, loading/empty states.

- ⬜ Build/verify shared components: `InfoTooltip`, `PageSectionHeader`, `StatusBadge`, `ActionButton`, `TimelineCard`, `EmptyState`, `LoadingSkeleton`, `ErrorCard`.
- ⬜ Apply `cursor-pointer` / `cursor-text` / `cursor-default` rules globally.
- ⬜ Tooltip on every status badge, action button, info-bearing element (per `frontend.md`).
- ⬜ Hover transitions on cards/rows: `hover:bg-muted/50 transition-colors duration-200`.
- ⬜ Responsive — desktop / tablet / mobile sweeps.
- ⬜ Toast (`sonner`) for expected errors; `ErrorCard` for unhandled.
- ⬜ Centralised Axios interceptor → routes 401 to login, surfaces unhandled errors to global error boundary.

---

### **PHASE 15 — Testing & Coverage Sweep** ⬜
**Goal:** ≥99% coverage on critical paths per Augment Step 4.

#### Backend (pytest)
- ⬜ Per-route unittests under `API Test/<route_file>/Test/test.py`.
- ⬜ State machine matrix tests for every transition in §1.2.
- ⬜ Concurrency test: two managers approving same reimbursement simultaneously (atomic filter wins).
- ⬜ SLA simulated-time tests.

#### Frontend (Jest + React Testing Library)
- ⬜ Component tests for `NewReimbursementModal`, `UploadInvoiceForm`, `BusinessTripForm`, `ChainView`, `QueryAskDialog`, `AcknowledgePaymentDialog`.
- ⬜ Hook tests for `useAuth`, `useReimbursement`, `useNotification`.
- ⬜ Coverage report via `npm run test -- --coverage`.

---

### **PHASE 16 — Final Validation** ⬜
- ⬜ Cross-check every file in §2.1 / §2.2 against `REAL_DASHBOARD_APP.txt` field-by-field.
- ⬜ Verify every method named in the source-of-truth exists.
- ⬜ Verify every frontend trigger event invokes the correct API and updates UI state correctly.
- ⬜ Schema field cross-verification (per `Augment_instruction.md` → "Pydantic Schema Verification").
- ⬜ Backend route validation for all Pydantic-typed request bodies.
- ⬜ Parameter consistency check between `*_routes.py` ↔ `*_api.ts`.
- ⬜ All tests green; coverage targets met.
- ⬜ Update PLAN.md status markers to ✅.

---

## 5. Status Tracking

After each task is implemented, update the bullet's status marker in this file:
`⬜ → 🟡 → ✅` (or `⛔` if blocked, with a note).

## 6. Open Questions / Confirmations Needed
1. **Existing UI shell** (`AppHeader`, `Footer`, login page) — does any prior code exist outside `.augment/` that we should preserve? Workspace is currently empty.
2. **SMTP credentials** for email escalation — to be supplied via `.env`.
3. **JWT secret rotation** policy.
4. **Initial seed data** — list of users, departments, owners (Anirudh Sureka, Smeeta Sureka), CA accounts — does an import file exist?
5. **Attachment size cap** — confirm max bytes (suggest 10 MB per file).

