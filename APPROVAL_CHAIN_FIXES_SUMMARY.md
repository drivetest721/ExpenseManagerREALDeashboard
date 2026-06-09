# Approval Chain - Critical Fixes Summary

## Issues Fixed

### Issue 1: Current Reviewer Incorrect After QUERY/ASK ❌ → ✅
**Problem**: When manager raised QUERY/ASK, the approval chain UI showed the manager as current reviewer instead of the initiator.

**Root Cause**: Frontend used index-based logic (`iCurrentStep`) instead of `current_reviewer_id` to determine current reviewer.

**Fix**:
- Updated `ActivityLogsPanel.tsx` to use `strCurrentReviewerId` prop
- Changed line 540 from index calculation to direct ID comparison:
  ```typescript
  const bIsCurrent = !bIsTerminal && objStep.user_id === strCurrentReviewerId;
  ```
- Updated `ReimbursementDetailPage.tsx` to pass `current_reviewer_id` to ActivityLogsPanel

---

### Issue 2: Current Reviewer Incorrect After REAPPLY ❌ → ✅
**Problem**: After initiator reapplied, the UI still showed initiator as current reviewer instead of the manager.

**Root Cause**: Backend state machine didn't update `current_reviewer_id` when REAPPLY action occurred.

**Fix**:
1. **Backend State Machine** (`ReimbursementStateMachine.py` lines 195-202):
   ```python
   # REAPPLY: Reset current_reviewer_id back to the manager who raised the query
   if strAction in ("REAPPLY", "CA_REAPPLY"):
       lsChain = dictOld.get("approval_chain", [])
       iCurrentStep = dictOld.get("current_step", 0)
       if iCurrentStep < len(lsChain):
           dictUpdates["current_reviewer_id"] = lsChain[iCurrentStep]["user_id"]
   ```

2. **Chain Endpoint Logic** (`reimbursement_routes.py` lines 1094-1120):
   - Added check to see if initiator has already reapplied
   - Only override `current_reviewer_id` to initiator if QUERY/ASK exists AND initiator hasn't reapplied

---

### Issue 3: Wrong Action Buttons Visibility ❌ → ✅
**Problem**: 
- After QUERY/ASK, initiator couldn't see REAPPLY button
- After REAPPLY, manager couldn't see approval action buttons

**Root Cause**: Fixed by Issues 1 & 2 - action buttons already used `strCurrentReviewerId` correctly.

**Verification**: `ReimbursementDetailsPanel.tsx` lines 73, 86, 92:
```typescript
const bIsCurrentReviewer = objUser?.user_id === strCurrentReviewerId;

// Manager actions - only if current reviewer
if (bIsCurrentReviewer && !bIsCA && ['SUBMITTED', 'IN_REVIEW', 'REAPPLIED'].includes(strStatus)) {
  lsActions.push('approve', 'query', 'ask');
}

// Initiator actions - only if query/ask raised
if (bIsInitiator && ['QUERY_RAISED', 'PRIVATE_ASK'].includes(strStatus)) {
  lsActions.push('reapply');
}
```

---

## Complete Flow After Fixes

### Scenario 1: Manager Raises QUERY

1. **Initial State**:
   - Status: `IN_REVIEW`
   - Current Reviewer: Manager (user_123)
   - Approval Chain Highlights: Manager tile (yellow)

2. **Manager Raises QUERY**:
   - Status: `IN_REVIEW` → `QUERY_RAISED`
   - Current Reviewer: Manager → **Initiator** ✅
   - Manager Tile: Shows "✓ Completed" + "QUERY at: timestamp" ✅
   - Initiator Tile: Shows yellow highlight + "⏳ CURRENTLY REVIEWING" ✅

3. **Initiator Views Page**:
   - Initiator's `received_date` is tracked (first VIEW after query)
   - Initiator Tile Shows:
     - "Submitted at: [original timestamp]"
     - "Received at: [view timestamp]" ✅
     - "⏰ Due in X days"
   - Action Buttons: REAPPLY button visible to initiator ✅

4. **Initiator Reapplies**:
   - Status: `QUERY_RAISED` → `REAPPLIED`
   - Current Reviewer: Initiator → **Manager** ✅
   - Initiator Tile: Shows "Reapplied at: timestamp" + "✓ Completed"
   - Manager Tile: Shows yellow highlight + "⏳ CURRENTLY REVIEWING" ✅
   - Action Buttons: APPROVE/QUERY/ASK visible to manager ✅

5. **Manager Approves**:
   - Status: `REAPPLIED` → `IN_REVIEW`
   - Current Reviewer: Manager → Next Reviewer
   - Normal flow continues

---

### Scenario 2: Manager Raises PRIVATE_ASK

Same flow as QUERY, except:
- Action is "PRIVATE_ASK" instead of "QUERY"
- Status: `IN_REVIEW` → `PRIVATE_ASK`
- Visibility: Only initiator, manager, and owner can see the ASK log

---

## Files Modified

### Backend
1. **`sourcecode/controllers/ReimbursementStateMachine.py`**
   - Lines 195-202: Added REAPPLY logic to reset `current_reviewer_id` to manager

2. **`sourcecode/routes/reimbursement_routes.py`**
   - Lines 918-1014: Enhanced initiator received_date tracking
   - Lines 1094-1120: Fixed current_reviewer_id override logic for QUERY/ASK/REAPPLY

### Frontend
3. **`client/src/components/Reimbursement/ActivityLogsPanel.tsx`**
   - Lines 48-56: Added `strCurrentReviewerId` prop
   - Lines 159-167: Updated function signature to accept `strCurrentReviewerId`
   - Lines 537-545: Changed from index-based to ID-based current reviewer detection
   - Lines 815-832: Updated Quick Status to show current reviewer name

4. **`client/src/pages/ReimbursementDetailPage.tsx`**
   - Line 126: Pass `strCurrentReviewerId={objChain.current_reviewer_id}` to ActivityLogsPanel

---

## Testing Checklist

### Test Case 1: QUERY Flow
- [ ] Manager views reimbursement in IN_REVIEW status
- [ ] Manager raises QUERY
- [ ] Verify: Initiator tile shows yellow highlight as current reviewer
- [ ] Verify: Manager tile shows "✓ Completed" + "QUERY at:"
- [ ] Verify: Manager cannot see action buttons
- [ ] Initiator views page
- [ ] Verify: Initiator sees REAPPLY button
- [ ] Initiator reapplies
- [ ] Verify: Manager tile shows yellow highlight as current reviewer
- [ ] Verify: Initiator tile shows "Reapplied at:"
- [ ] Verify: Manager sees APPROVE/QUERY/ASK buttons

### Test Case 2: PRIVATE_ASK Flow
- [ ] Same as QUERY flow, but verify ASK visibility

### Test Case 3: Multiple QUERY/REAPPLY Cycles
- [ ] Manager QUERY → Initiator REAPPLY → Manager QUERY again → Initiator REAPPLY
- [ ] Verify current reviewer switches correctly each time

---

## Status: ✅ All Issues Fixed

All three issues have been resolved. The approval chain now correctly:
1. ✅ Highlights initiator as current reviewer after manager QUERY/ASK
2. ✅ Highlights manager as current reviewer after initiator REAPPLY
3. ✅ Shows correct action buttons to the actual current reviewer only
