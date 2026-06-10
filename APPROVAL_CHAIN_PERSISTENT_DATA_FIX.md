# Approval Chain - Persistent Data Storage Fix

## Problem

The approval chain was computing `received_date` and `action_date` from logs every time, which was:
- ❌ Inefficient (scanning logs on every request)
- ❌ Unreliable (logs could be missing or rate-limited)
- ❌ Not showing accurate timestamps in the UI

## Solution

Store persistent metadata **directly in the `approval_chain` array** when events happen:

### Data Structure

Each step in `approval_chain[]` now stores:

```javascript
{
  "user_id": "manager_123",
  "name": "Anita Patel",
  "email": "anita@example.com",
  "role": "manager",
  "department": "Finance",
  "level": 1,
  "priority": 1,
  "approval_type": "MANAGER",
  "status": "PENDING",           // NEW: Updated when action taken
  "received_date": null,         // NEW: Set when reviewer first views
  "action_date": null,           // NEW: Set when reviewer takes action (QUERY/ASK/REJECT)
  "approved_at": null,           // Existing: Set when APPROVE action
  "approved_by": null,
  "action": null                 // NEW: Action type (QUERY, ASK, APPROVE, REJECT)
}
```

---

## Implementation

### 1. Update `received_date` on First View

**File**: `sourcecode/controllers/ActivityLogService.py` (Lines 190-270)

**When**: Current reviewer views the page for the first time

**Action**: Update `approval_chain[current_step].received_date` with current timestamp

```python
# In logView function:
if strActorId == strCurrentReviewerId and iCurrentStep < len(lsChain):
    if not lsChain[iCurrentStep].get("received_date"):
        objReimbs.update_one(
            {"_id": ObjectId(strReimbursementId)},
            {"$set": {f"approval_chain.{iCurrentStep}.received_date": strNow}}
        )
```

---

### 2. Update `action_date` and `status` on Actions

**File**: `sourcecode/controllers/ReimbursementStateMachine.py` (Lines 195-241)

**When**: Reviewer takes action (QUERY, ASK, REJECT, APPROVE)

**Action**: Update `approval_chain[current_step]` with action details

```python
# For QUERY/ASK:
if strAction in ("QUERY", "ASK", "CA_QUERY"):
    lsChain[iCurrentStep]["action_date"] = strNow
    lsChain[iCurrentStep]["action"] = strAction
    lsChain[iCurrentStep]["status"] = "QUERY_RAISED"

# For REJECT:
if strAction == "REJECT":
    lsChain[iCurrentStep]["action_date"] = strNow
    lsChain[iCurrentStep]["action"] = "REJECT"
    lsChain[iCurrentStep]["status"] = "REJECTED"
    lsChain[iCurrentStep]["rejected_at"] = strNow
    lsChain[iCurrentStep]["rejected_by"] = strActorId

# APPROVE already updates approved_at
```

---

### 3. Read from Persistent Data

**File**: `sourcecode/routes/reimbursement_routes.py` (Lines 1016-1055)

**Change**: Instead of scanning logs, read directly from `approval_chain[]`

**Before** (Reading from logs):
```python
for log in lsReviewerLogs:
    if log.get("log_type") == "view":
        strReceivedDate = log.get("created_at")
        break
```

**After** (Reading from approval_chain):
```python
strReceivedDate = dictStep.get("received_date", None)
strActionDate = dictStep.get("action_date", None)
strApprovedAt = dictStep.get("approved_at", None)
strAction = dictStep.get("action", None)
```

---

## Complete Flow Example

### Manager Reviews Reimbursement

**1. Manager Views Page (First Time)**
```
POST /api/reimbursements/{id}/view
→ ActivityLogService.logView()
→ Updates approval_chain[0]:
  {
    "user_id": "manager_123",
    "received_date": "2026-06-09T10:15:30Z",  ✅ STORED
    "status": "PENDING"
  }
```

**2. Manager Raises QUERY**
```
POST /api/reimbursements/{id}/query
→ ReimbursementStateMachine.transition()
→ Updates approval_chain[0]:
  {
    "user_id": "manager_123",
    "received_date": "2026-06-09T10:15:30Z",
    "action_date": "2026-06-09T10:45:20Z",    ✅ STORED
    "action": "QUERY",                        ✅ STORED
    "status": "QUERY_RAISED"                  ✅ STORED
  }
```

**3. UI Displays Data**
```
GET /api/reimbursements/{id}/chain
→ Returns approval_chain with all data
→ Frontend shows:
  - "Received: 09/06/2026 10:15:30 AM IST"
  - "QUERY at: 09/06/2026 10:45:20 AM IST"
  - "✓ Completed"
```

---

## Files Modified

### Backend (3 files)
1. **`sourcecode/controllers/ActivityLogService.py`**
   - Lines 190-270: Added logic to update `received_date` in approval_chain on first view

2. **`sourcecode/controllers/ReimbursementStateMachine.py`**
   - Lines 195-241: Added logic to update `action_date`, `status`, `action` for QUERY/ASK/REJECT

3. **`sourcecode/routes/reimbursement_routes.py`**
   - Lines 1016-1055: Changed from log-scanning to reading persisted data from approval_chain

### Frontend (2 files)
4. **`client/src/utils/reimbursementApi.ts`**
   - Line 104: Added `action_date?: string` to ChainStep interface

5. **`client/src/components/Reimbursement/ActivityLogsPanel.tsx`**
   - Lines 736-743: Updated to display `action_date` for QUERY/ASK actions

---

## Benefits

✅ **Accurate Timestamps**: Data is stored when event happens, not computed later  
✅ **Performance**: No need to scan logs for every request  
✅ **Reliability**: Not dependent on log rate-limiting  
✅ **Simplicity**: Single source of truth in `approval_chain[]`  
✅ **Persistence**: Data survives even if logs are deleted

---

## Status: ✅ Complete

All timestamps (received_date, action_date, approved_at) are now stored persistently in the database and displayed accurately in the UI.
