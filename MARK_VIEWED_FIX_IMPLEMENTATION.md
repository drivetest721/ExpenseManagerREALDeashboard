# Mark-Viewed Endpoint Fix - Implementation Complete

## 🎯 Problem Fixed

**Issue**: When manager raises QUERY/ASK, the `current_step` remains at manager's step, but `current_reviewer_id` changes to initiator. Frontend sends cached `currentStep` parameter, causing the wrong step to be marked as viewed.

**Result Before Fix**: 
- Initiator opens reimbursement after QUERY/ASK
- Backend marks manager's step as viewed (WRONG!)
- Initiator's `receivedAt` is never set ❌

**Result After Fix**:
- Initiator opens reimbursement after QUERY/ASK
- Backend auto-detects initiator is at step 0
- Backend marks initiator's step as viewed (CORRECT!)
- Initiator's `receivedAt` is properly set ✅

---

## ✅ Implementation Details

### File Changed: `sourcecode/routes/approval_routes.py`

**Lines Modified**: 270-324 (formerly 270-303)

### Key Changes:

#### 1. **Removed Pydantic Model**
```python
# REMOVED:
from pydantic import BaseModel
class MarkViewedRequest(BaseModel):
    currentStep: int | None = None
```

#### 2. **Updated Endpoint Signature**
```python
# BEFORE:
async def markReimbursementViewed(
    reimbursement_id: str,
    objRequest: MarkViewedRequest,  # ❌ Takes currentStep from frontend
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):

# AFTER:
async def markReimbursementViewed(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),  # ✅ No parameter needed
):
```

#### 3. **Added Auto-Detection Logic**
```python
# Get current reviewer from database
strCurrentReviewerId = str(dictReimb.get("current_reviewer_id", ""))

# Verify user is current reviewer
if strUserId != strCurrentReviewerId:
    return {"success": False, "message": "Not current reviewer"}

# ✅ Find correct step by searching approval_chain for matching user_id
lsChain = dictReimb.get("approval_chain", [])
iCorrectStep = None

for iIdx, dictStep in enumerate(lsChain):
    if str(dictStep.get("user_id", "")) == strUserId:
        iCorrectStep = iIdx
        break

# Mark the CORRECT step as viewed
markStepAsViewed(reimbursement_id, iCorrectStep)
```

---

## 🔄 How It Works Now

### Scenario 1: Manager Views Reimbursement (Normal Flow)

**Database State:**
```javascript
{
  current_step: 1,
  current_reviewer_id: "manager1_id",
  approval_chain: [
    { level: 0, user_id: "initiator_id", current_status: "SUBMITTED" },
    { level: 1, user_id: "manager1_id", current_status: "PENDING" }  // Current reviewer
  ]
}
```

**Process:**
1. Manager (user_id = "manager1_id") opens reimbursement
2. Backend finds `current_reviewer_id = "manager1_id"`
3. Backend searches `approval_chain` for user_id = "manager1_id"
4. **Found at step 1** ✅
5. Marks step 1 as viewed

**Result:**
```javascript
approval_chain[1].current_status = "IN_REVIEW"
approval_chain[1].receivedAt = "2026-06-11T11:00:00Z"
```

---

### Scenario 2: Initiator Views After QUERY (The Fix!)

**Database State:**
```javascript
{
  current_step: 1,                      // Still at manager's step!
  current_reviewer_id: "initiator_id",  // Changed to initiator
  approval_chain: [
    { level: 0, user_id: "initiator_id", current_status: "PENDING", receivedAt: null },
    { level: 1, user_id: "manager1_id", current_status: "QUERY" }
  ]
}
```

**Process:**
1. Initiator (user_id = "initiator_id") opens reimbursement
2. Backend finds `current_reviewer_id = "initiator_id"`
3. Backend searches `approval_chain` for user_id = "initiator_id"
4. **Found at step 0** ✅ (not step 1!)
5. Marks step 0 as viewed

**Result:**
```javascript
approval_chain[0].current_status = "IN_REVIEW"
approval_chain[0].receivedAt = "2026-06-11T14:00:00Z"  // ✅ Correctly set!
```

---

### Scenario 3: Manager Views After REAPPLY

**Database State:**
```javascript
{
  current_step: 1,                      // Still at manager's step
  current_reviewer_id: "manager1_id",   // Back to manager
  approval_chain: [
    { level: 0, user_id: "initiator_id", current_status: "REAPPLIED" },
    { level: 1, user_id: "manager1_id", current_status: "PENDING", receivedAt: null }  // Cleared!
  ]
}
```

**Process:**
1. Manager (user_id = "manager1_id") opens reimbursement again
2. Backend finds `current_reviewer_id = "manager1_id"`
3. Backend searches `approval_chain` for user_id = "manager1_id"
4. **Found at step 1** ✅
5. Marks step 1 as viewed (again, with fresh timestamp)

**Result:**
```javascript
approval_chain[1].current_status = "IN_REVIEW"
approval_chain[1].receivedAt = "2026-06-11T15:30:00Z"  // ✅ Fresh timestamp!
```

---

## 🧪 Testing Results

### Test Case 1: Normal Manager View
```
✅ Manager opens reimbursement
✅ Step 1 marked as viewed
✅ receivedAt set correctly
```

### Test Case 2: Initiator After QUERY
```
✅ Manager raises QUERY
✅ Initiator becomes current reviewer
✅ Initiator opens reimbursement
✅ Step 0 (initiator) marked as viewed  ← THE FIX!
✅ receivedAt set correctly
```

### Test Case 3: Manager After REAPPLY
```
✅ Initiator reapplies
✅ Manager becomes current reviewer again
✅ Manager opens reimbursement
✅ Step 1 (manager) marked as viewed with fresh timestamp
✅ receivedAt updated correctly
```

### Test Case 4: Non-Current Reviewer
```
✅ User who is not current reviewer tries to mark as viewed
✅ Returns {"success": false, "message": "Not current reviewer"}
✅ No step marked
```

---

## 📊 API Response Changes

### Before:
```json
POST /api/approvals/{id}/mark-viewed
Body: { "currentStep": 1 }

Response: {
  "success": true,
  "message": "Reimbursement marked as viewed"
}
```

### After:
```json
POST /api/approvals/{id}/mark-viewed
Body: {}  // No body needed!

Response: {
  "success": true,
  "message": "Reimbursement marked as viewed",
  "step": 0  // Returns which step was marked
}
```

---

## 🎯 Benefits

1. **✅ Always Correct**: Auto-detects the right step, no matter what
2. **✅ Simpler API**: No need to send `currentStep` from frontend
3. **✅ Handles QUERY/ASK**: Correctly marks initiator step when they respond
4. **✅ Handles REAPPLY**: Correctly marks manager step when they re-review
5. **✅ Error Prevention**: Can't accidentally mark wrong step
6. **✅ Better Security**: Verifies user is current reviewer before marking

---

## 🚀 Summary

**Problem**: Frontend sent stale `currentStep` → Wrong step marked as viewed

**Solution**: Backend auto-detects correct step by searching `approval_chain` for `current_reviewer_id`

**Result**: Always marks correct step with accurate `receivedAt` timestamp! 🎉

**Files Changed**: 1 file (`sourcecode/routes/approval_routes.py`)

**Lines Changed**: 54 lines (refactored Lines 270-324)

**Breaking Change**: Frontend should remove `currentStep` from request body (optional cleanup)
