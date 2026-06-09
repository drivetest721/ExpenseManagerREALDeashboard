# Approval Chain - Current Implementation & Enhancement Plan

## Overview
The Approval Chain visualizes the reimbursement journey from initiator to final approval/payment, showing:
- Who is involved in the approval process
- Current position in the workflow
- Past user behavior and actions
- Timeline with timestamps

---

## Current Implementation

### Backend (sourcecode/routes/reimbursement_routes.py - Line 794)

**Endpoint**: `GET /api/reimbursements/{reimbursement_id}/chain`

#### Data Sources:
1. **Reimbursement Document** (`reimbursements` collection)
   - `approval_chain[]`: List of approvers with their steps
   - `current_step`: Index of current reviewer (0-based)
   - `status`: Current status of reimbursement
   - `initiator_id`: User who created the reimbursement

2. **Activity Logs** (`reimbursement_logs` collection)
   - `log_type`: "edit", "activity", or "view"
   - `action`: Action performed (SUBMITTED, APPROVED, QUERY_RAISED, PRIVATE_ASK, PAGE_VIEWED, etc.)
   - `action_by`: User ID who performed the action
   - `created_at`: Timestamp of action
   - `visibility`: "public" or "private"

#### Chain Building Logic:

**1. Initiator (Step 0)**
- Added as first item in enriched chain
- `level`: 0
- `approval_type`: "INITIATOR"
- `status`: "COMPLETED" if submitted, else "INITIATED"
- `action`: "SUBMITTED" if submitted, else "INITIATED"
- `received_date`: Submission timestamp (from first SUBMIT log or created_at)
- `response_date`: None
- `approved_at`: Submission timestamp if submitted
- **No received_at initially** - Initiator doesn't "receive" their own submission

**2. Approval Chain Steps (from approval_chain[])**
For each reviewer in the chain:
- Enriched with user details (name, email, role, department)
- **Received Date**: First VIEW log after becoming current reviewer
- **Response Date**: Timestamp of action (APPROVE, REJECT, QUERY, ASK)
- **Remaining Days**: SLA calculation based on received_date + SLA_APPROVAL_DAYS
- **Status**: APPROVED (if action taken), or based on current_step

**3. Special Logic for QUERY/ASK**
- When manager raises QUERY or ASK:
  - Manager's task is marked as COMPLETED (they took action)
  - `current_reviewer_id` is updated to `initiator_id` (Lines 1037-1053)
  - Initiator now has "received_date" (when they view page after query)
  - Initiator must REAPPLY to move forward

---

## Frontend (client/src/components/Reimbursement/ActivityLogsPanel.tsx)

### UI Rendering (Lines 524-785):

**For Each User Tile:**
- User Name, Role, Email
- Status Badge (SUBMITTED/APPROVED/QUERY/ASK/etc.)
- Icon based on status
- Colored left border based on state

**Timestamp Display:**
1. **Initiator**:
   - Shows "Submitted at:" when status is COMPLETED
   - Shows remaining days if still in DRAFT

2. **Reviewers (Past)**:
   - Shows "Received:" timestamp
   - Shows action taken with response_date
   - Shows "✓ Completed" for past approvals

3. **Current Reviewer**:
   - Shows "⏳ Currently with {name}"
   - Shows "Received:" if they've viewed the page
   - Shows remaining days with color coding:
     - Red: Overdue (< 0 days)
     - Orange: Due today (0 days)
     - Yellow: Due in 1 day
     - Green: > 1 day remaining

4. **Manager who raised QUERY/ASK**:
   - Shows "Received:" timestamp
   - Shows action timestamp (QUERY/ASK)
   - Shows "✓ Completed" (their task is done)
   - Shows "🔔 Initiator action required"

---

## Requirements & Issues

### Current Problems:

1. **Initiator's "Received At" Logic**:
   - ❌ Currently NOT showing received_at when manager asks/queries
   - ❌ Backend doesn't track when initiator first views after query
   - ✅ Required: When manager QUERY/ASK → Current reviewer becomes initiator → Initiator views page → That timestamp should be "received_at"

2. **Inconsistent Received Date Calculation**:
   - Current logic: First VIEW log by reviewer
   - Issue: VIEW logs are rate-limited (5 minutes) - might miss first view
   - Need: More robust tracking of "received at" timestamp

3. **Status Display Confusion**:
   - Current: Manager shows both QUERY action AND "Completed"
   - Need: Clearer visual separation of "action taken" vs "waiting"

---

## Enhancement Requirements

### 1. Received At Timestamp Rules:
- **Initiator (Initial)**: NO received_at, only submission timestamp
- **Initiator (After Query/Ask)**: received_at = first VIEW after becoming current reviewer
- **All Reviewers**: received_at = first VIEW after becoming current reviewer

### 2. Action Timestamp Display:
For each user tile show:
- **Name** and **Current Status** (SUBMITTED/APPROVED/QUERY/ASK/REAPPLY)
- **Received At**: Timestamp when previous step completed AND current user viewed page
- **Action Timestamp**: When user performed action (Approved/Query/Ask/etc.)

### 3. Backend Changes Needed:
- Line 918-957: Fix initiator received_date logic when returning from query
- Line 1011-1030: Ensure current reviewer received_date tracks first VIEW correctly
- Line 1037-1053: When updating current_reviewer to initiator, ensure initiator's received_date will be tracked on next view

### 4. Frontend Changes Needed:
- Lines 634-664: Update initiator display to show received_at when returning from query
- Lines 666-723: Ensure clear display of received vs action timestamps
- Add visual distinction between "task completed" and "waiting for action"

---

## Implementation Plan

### Phase 1: Backend Enhancement
1. ✅ Add logic to track initiator's received_date when returning from QUERY/ASK
2. ✅ Ensure VIEW logs correctly populate received_date for all chain participants
3. ✅ Add field to distinguish "first view after assignment" from subsequent views

### Phase 2: Frontend Enhancement  
1. ✅ Update initiator tile to show received_at when appropriate
2. ✅ Improve timestamp labeling clarity
3. ✅ Add visual indicators for different states

### Phase 3: Testing
1. Test initiator flow: Submit → Manager Query → Initiator views → Reapply
2. Test reviewer flow: Assignment → First view → Action
3. Verify SLA calculations based on received_date

---

---

## Implementation Summary ✅

### Changes Made:

#### 1. Backend Changes (`sourcecode/routes/reimbursement_routes.py`):
- **Lines 918-1014**: Enhanced initiator tracking logic
  - Detects when manager raises QUERY/ASK
  - Tracks initiator's first VIEW log after becoming current reviewer
  - Calculates `received_date` only when initiator returns from QUERY/ASK
  - Added `submitted_at` field to always show submission timestamp
  - Properly handles REAPPLIED action tracking

#### 2. Frontend Interface (`client/src/utils/reimbursementApi.ts`):
- **Line 107**: Added `submitted_at?: string` to `ChainStep` interface

#### 3. Frontend Display (`client/src/components/Reimbursement/ActivityLogsPanel.tsx`):
- **Lines 141-156**: Updated `fmtDateTime` function
  - Format: `dd/mm/yyyy hh:mm:ss AM/PM IST`
  - Displays full timestamp with IST timezone

- **Lines 553-560**: Enhanced current reviewer highlighting
  - Yellow border with ring effect
  - Box shadow for prominence
  - Conditional styling based on current status

- **Lines 579-621**: Added hover tooltip on user name
  - Shows full name, email, and department
  - Dark tooltip with arrow pointer
  - Smooth hover transition

- **Lines 627-634**: Enhanced current reviewer indicator
  - Prominent yellow badge with "CURRENTLY REVIEWING"
  - Animated pulse effect
  - Larger icon and text

- **Lines 661-714**: Updated initiator timestamp display
  - Always shows "Submitted at:" with submission timestamp
  - Shows "Received at:" only when returning from QUERY/ASK
  - Shows "Reapplied at:" when initiator responds
  - Proper color coding for remaining days

---

## Testing Checklist

### Test Case 1: Initial Submission Flow
1. ✅ Initiator creates and submits reimbursement
2. ✅ Initiator tile should show:
   - "Submitted at: [timestamp] IST"
   - NO "Received at" field
   - Status: COMPLETED
3. ✅ First reviewer becomes current
4. ✅ First reviewer tile should show:
   - Yellow highlight with ring
   - "⏳ CURRENTLY REVIEWING" badge
   - "Received at:" when they first view the page

### Test Case 2: Manager QUERY Flow
1. ✅ Manager raises QUERY
2. ✅ Manager tile should show:
   - "Received at: [timestamp]"
   - "QUERY at: [timestamp]"
   - "✓ Completed" status
3. ✅ Initiator becomes current reviewer
4. ✅ Initiator tile should show:
   - "Submitted at: [original timestamp]"
   - "Received at: [timestamp when viewed after query]"
   - Yellow highlight as current reviewer
   - Remaining days calculation

### Test Case 3: Manager PRIVATE_ASK Flow
1. ✅ Manager raises PRIVATE_ASK
2. ✅ Similar to QUERY flow
3. ✅ Only initiator and manager should see the ASK action

### Test Case 4: Initiator REAPPLY Flow
1. ✅ After QUERY/ASK, initiator reapplies
2. ✅ Initiator tile should show:
   - "Submitted at: [original]"
   - "Received at: [when viewed after query]"
   - "Reapplied at: [reapply timestamp]"
3. ✅ Next reviewer becomes current
4. ✅ Next reviewer should have yellow highlight

### Test Case 5: Hover Tooltip
1. ✅ Hover over any user name
2. ✅ Tooltip should appear showing:
   - Full name
   - Email address
   - Department name
3. ✅ Tooltip should disappear on mouse leave

### Test Case 6: Timestamp Format
1. ✅ All timestamps should display as:
   - Format: `dd/mm/yyyy hh:mm:ss AM/PM IST`
   - Example: `15/06/2026 02:30:45 PM IST`

### Test Case 7: Current Reviewer Highlighting
1. ✅ Current reviewer tile should have:
   - Yellow left border (4px)
   - Yellow background
   - Ring effect (ring-2 ring-yellow-400)
   - Box shadow
   - "⏳ CURRENTLY REVIEWING" badge with pulse animation

---

## Files Modified

1. `sourcecode/routes/reimbursement_routes.py` (Lines 918-1014)
2. `client/src/utils/reimbursementApi.ts` (Line 107)
3. `client/src/components/Reimbursement/ActivityLogsPanel.tsx` (Multiple sections)

---

**Status**: ✅ Implementation Complete - Ready for Testing
