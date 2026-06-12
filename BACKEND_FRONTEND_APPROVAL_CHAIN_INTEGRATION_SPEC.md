# Backend-Frontend Approval Chain Integration Specification

## 🚨 Current Issue

### Problem 1: Backend Not Using New Approval Chain Fields
The backend API endpoint `/api/reimbursements/:id/chain` (Lines 833-1172 in `reimbursement_routes.py`) is using **OLD logic based on activity logs** instead of the **NEW embedded approval chain fields** (`receivedAt`, `submittedAt`, `current_status`, `bIsReApply`).

### Problem 2: Initiator Not Marked as Viewed After QUERY/ASK
When manager raises QUERY/ASK, the initiator opens the reimbursement but `receivedAt` is **NOT** being set because the `ActivityLogService.logView()` is not correctly detecting the initiator as current reviewer.

### Problem 3: UI Using Outdated Field Names
The UI expects:
- `received_date` (old)
- `response_date` (old)
- `action_date` (old)
- `submitted_at` (old)

But backend now stores:
- `receivedAt` (new)
- `submittedAt` (new)
- `current_status` (new)

---

## 📊 Backend Schema (Current Implementation)

### Approval Chain Step Structure in MongoDB

```javascript
approval_chain: [
  {
    level: 0,                      // Step index
    user_id: "user123",
    name: "John Doe",
    email: "john@example.com",
    role: "manager",
    department: "Finance",
    priority: 1,
    approval_type: "SEQUENTIAL",
    
    // ✅ NEW STATUS TRACKING FIELDS (Added in recent update)
    current_status: "PENDING",     // PENDING | IN_REVIEW | SUBMITTED | APPROVED | QUERY | ASK | REAPPLIED | PAID | REJECTED
    receivedAt: null,              // ISO timestamp when user first viewed (after becoming current_reviewer)
    submittedAt: null,             // ISO timestamp when user took action (APPROVE, QUERY, ASK, REAPPLY)
    bIsReApply: false,             // Only for initiator (step 0), true if resubmitted after QUERY/ASK
    is_initiator: true,            // Only for step 0
  },
  // ... more steps
]
```

---

## 🔧 Required Backend Changes

### Change 1: Update `/api/reimbursements/:id/chain` Endpoint

**File**: `sourcecode/routes/reimbursement_routes.py` (Lines 833-1172)

**Current Logic (WRONG):**
- Loops through activity logs to find `received_date` and `response_date`
- Calculates status based on log actions
- Does NOT use embedded `approval_chain` fields

**New Logic (CORRECT):**
```python
@router.get("/{reimbursement_id}/chain")
async def getReimbursementChain(...):
    # ... access control ...
    
    lsChain = dictDoc.get("approval_chain", [])
    lsEnrichedChain = []
    
    for iIdx, dictStep in enumerate(lsChain):
        # Use embedded fields directly
        dictEnrichedStep = {
            "level": iIdx,
            "user_id": str(dictStep.get("user_id", "")),
            "name": dictStep.get("name", ""),
            "email": dictStep.get("email", ""),
            "role": dictStep.get("role", ""),
            "department": dictStep.get("department", ""),
            "priority": dictStep.get("priority", 0),
            "approval_type": dictStep.get("approval_type", ""),
            
            # ✅ Use NEW embedded fields
            "current_status": dictStep.get("current_status", "PENDING"),
            "receivedAt": dictStep.get("receivedAt"),        # NEW field
            "submittedAt": dictStep.get("submittedAt"),      # NEW field
            "bIsReApply": dictStep.get("bIsReApply", False), # NEW field (initiator only)
            "is_initiator": dictStep.get("is_initiator", False),
            
            # Calculate remaining days from receivedAt (if IN_REVIEW)
            "remaining_days": _calculateRemainingDays(
                dictStep.get("receivedAt"), 
                dictStep.get("current_status")
            )
        }
        
        lsEnrichedChain.append(dictEnrichedStep)
    
    return {
        "approval_chain": lsEnrichedChain,
        "current_step": dictDoc.get("current_step", 0),
        "current_reviewer_id": str(dictDoc.get("current_reviewer_id", "")),
        "logs": lsVisibleLogs,
    }
```

---

### Change 2: Helper Function for Remaining Days

```python
def _calculateRemainingDays(strReceivedAt: str | None, strStatus: str) -> int | None:
    """Calculate remaining days for SLA based on receivedAt timestamp"""
    if not strReceivedAt or strStatus not in ["IN_REVIEW", "PENDING"]:
        return None
    
    try:
        from datetime import datetime as dt, timedelta
        from env_config import objSettings
        
        # For IN_REVIEW status, calculate from receivedAt
        dtReceived = dt.fromisoformat(strReceivedAt.replace("Z", "+00:00"))
        iSLADays = objSettings.SLA_APPROVAL_DAYS
        dtDeadline = dtReceived + timedelta(days=iSLADays)
        dtNow = datetime.now(timezone.utc)
        
        return (dtDeadline - dtNow).days
    except Exception as e:
        objLogger.warning(f"Failed to calculate remaining days: {e}")
        return None
```

---

## 🎨 Required Frontend Changes

### Change 1: Update TypeScript Interface

**File**: `client/src/utils/reimbursementApi.ts` (Lines 92-111)

**Current Interface (WRONG):**
```typescript
export interface ChainStep {
  level: number;
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  priority: number;
  approval_type: string;
  status: string;                // OLD
  action?: string;              // OLD
  received_date?: string;       // OLD - should be receivedAt
  response_date?: string;       // OLD - should be submittedAt
  action_date?: string;         // OLD - unused
  remaining_days?: number;
  approved_at?: string;         // OLD - unused
  approved_by?: string;         // OLD - unused
  submitted_at?: string;        // OLD - should be submittedAt
  is_initiator?: boolean;
}
```

**New Interface (CORRECT):**
```typescript
export interface ChainStep {
  level: number;
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  priority: number;
  approval_type: string;
  
  // ✅ NEW STATUS TRACKING FIELDS
  current_status: 'PENDING' | 'IN_REVIEW' | 'SUBMITTED' | 'APPROVED' | 'QUERY' | 'ASK' | 'REAPPLIED' | 'PAID' | 'REJECTED';
  receivedAt?: string;          // NEW - when user first viewed
  submittedAt?: string;         // NEW - when user took action
  bIsReApply?: boolean;         // NEW - only for initiator
  is_initiator?: boolean;
  remaining_days?: number;      // Calculated from receivedAt
}
```

---

### Change 2: Update UI Rendering Logic

**File**: `client/src/components/Reimbursement/ActivityLogsPanel.tsx` (Lines 615-898)

**Key Changes:**

1. **Replace `objStep.status` with `objStep.current_status`**
2. **Replace `objStep.received_date` with `objStep.receivedAt`**
3. **Replace `objStep.response_date` and `objStep.submitted_at` with `objStep.submittedAt`**
4. **Use `objStep.current_status` for status display logic**

**Example UI Display Logic:**

```typescript
// Status badge rendering
function getStatusBadge(objStep: ChainStep) {
  switch (objStep.current_status) {
    case 'PENDING':
      return <Badge color="yellow">⏳ Pending</Badge>;
    case 'IN_REVIEW':
      return <Badge color="blue">👁️ Reviewing</Badge>;
    case 'APPROVED':
      return <Badge color="green">✅ Approved</Badge>;
    case 'QUERY':
      return <Badge color="orange">❓ Query Raised</Badge>;
    case 'ASK':
      return <Badge color="amber">💬 Ask Raised</Badge>;
    case 'REAPPLIED':
      return <Badge color="purple">🔄 Reapplied</Badge>;
    case 'SUBMITTED':
      return <Badge color="blue">📤 Submitted</Badge>;
    case 'REJECTED':
      return <Badge color="red">❌ Rejected</Badge>;
    case 'PAID':
      return <Badge color="green">💰 Paid</Badge>;
    default:
      return null;
  }
}
```

---

## 🚀 Implementation Plan

### Phase 1: Backend API Refactoring
1. Refactor `/api/reimbursements/:id/chain` endpoint
2. Add `_calculateRemainingDays()` helper
3. Test API response matches new schema

### Phase 2: Frontend Type Updates
1. Update TypeScript interfaces
2. Update API client types
3. Verify type safety

### Phase 3: Frontend UI Refactoring
1. Update ActivityLogsPanel component
2. Replace all old field references
3. Update status display logic
4. Test rendering with different statuses

### Phase 4: End-to-End Testing
1. Test complete approval workflow
2. Verify timestamps display correctly
3. Verify status badges display correctly
4. Test QUERY/ASK/REAPPLY flows

---

## ✅ Summary

**Current State**: Backend and frontend using mismatched field names and logic.

**Target State**: Backend returns embedded `approval_chain` with new fields, frontend displays using `current_status`, `receivedAt`, `submittedAt`.

**Files to Change**:
- Backend: `sourcecode/routes/reimbursement_routes.py`
- Frontend: `client/src/utils/reimbursementApi.ts`, `client/src/components/Reimbursement/ActivityLogsPanel.tsx`

