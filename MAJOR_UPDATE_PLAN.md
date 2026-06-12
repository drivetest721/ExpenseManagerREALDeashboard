# Major Update Plan - Reimbursement & Approval Chain Redesign

**Created**: 2026-06-10
**Scope**: Complete redesign of reimbursement ID generation, approval chain structure, and state machine transitions
**Impact**: HIGH - Breaking changes to database schema, routes, and frontend
**Purpose**: Simplify approval workflow, improve traceability, and enhance daily tracking

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Problems with Current Implementation](#problems-with-current-implementation)
4. [Proposed Solution](#proposed-solution)
5. [Database Schema Changes](#database-schema-changes)
6. [State Machine Redesign](#state-machine-redesign)
7. [Backend Route Changes](#backend-route-changes)
8. [Frontend Changes](#frontend-changes)
9. [Migration Strategy](#migration-strategy)
10. [Implementation Plan](#implementation-plan)

---

## Overview

### Current Problems

1. **Reimbursement ID** - Uses sequential counter (RB-2026-000123), not user-specific or date-trackable
2. **Approval Chain Storage** - Embedded in reimbursement document, hard to query and analyze
3. **Complex State Machine** - Too many states (CA_PENDING, CA_QUERY, CA_REAPPLIED, OWNER_APPROVED, etc.)
4. **No Daily Tracking** - Cannot easily track user's daily/monthly reimbursement counts
5. **Poor Traceability** - Approval chain steps not tracked in separate collection

### New Requirements (From MAJOR UPDATES.txt)

✅ **New Reimbursement ID Format**: `RB{DDMMYYYY}-{username}-{count}`
  - Example: `RB10062026-aryan-1`, `RB10062026-aryan-2`
  - Resets daily per user

✅ **Separate Approval Chain Collection**: Store approval chains in dedicated `approvals` collection

✅ **Reimbursement Lookup Collection**: Track daily user submissions for ID generation

✅ **Simplified State Machine**: Remove CA_PENDING, CA_QUERY, CA_REAPPLIED, OWNER_APPROVED states

✅ **Enhanced Step Tracking**: Each step tracks receivedAt, submittedAt, bIsReApply

✅ **Simpler Transitions**: DRAFT → SUBMITTED → QUERY/ASK → REAPPLIED → APPROVED → PAID/REJECTED → ACKNOWLEDGED (for PAID only)

---

## Current State Analysis

### Current Database Schema

**1. `reimbursements` Collection (Current)**

```javascript
{
  "_id": ObjectId,
  "reimbursement_code": "RB-2026-000123",  // Sequential counter
  "initiator_id": String,
  "initiator_name": String,
  "form_type": "general" | "business_trip",
  "status": "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "QUERY_RAISED" | "PRIVATE_ASK" |
            "REAPPLIED" | "OWNER_APPROVED" | "CA_PENDING" | "CA_QUERY" | "CA_REAPPLIED" |
            "PAID" | "PAYMENT_ACKNOWLEDGED" | "REJECTED" | "ACKNOWLEDGED",
  "description": String,
  "items": [/* embedded items */],
  "approval_chain": [/* embedded chain - PROBLEM: hard to query */],
  "current_step": Number,
  "current_reviewer_id": String,
  "created_at": String,
  "updated_at": String
}
```

**Issues:**
- ❌ Reimbursement code not user-specific or date-based
- ❌ Approval chain embedded (hard to query all chains for a user)
- ❌ No daily tracking of user submissions
- ❌ Too many CA-specific states

**2. Current State Machine (17 States)**

```python
TRANSITIONS = {
    "SUBMITTED": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "IN_REVIEW": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "QUERY_RAISED": {"REAPPLY": "REAPPLIED"},
    "PRIVATE_ASK": {"REAPPLY": "REAPPLIED"},
    "REAPPLIED": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "OWNER_APPROVED": {"SEND_TO_CA": "CA_PENDING", "CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "CA_PENDING": {"CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "CA_QUERY": {"CA_REAPPLY": "CA_REAPPLIED"},
    "CA_REAPPLIED": {"CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "PAID": {"ACKNOWLEDGE": "ACKNOWLEDGED"},
    "ACKNOWLEDGED": {},  # Terminal state
}
```

**Issues:**
- ❌ Too complex: CA_PENDING, CA_QUERY, CA_REAPPLIED, OWNER_APPROVED are redundant
- ❌ QUERY and ASK should use the same QUERY state
- ❌ Inconsistent status naming

**3. Current Approval Routes**

```python
# approval_routes.py (Current)
POST /api/approvals/{id}/approve           # Manager/Owner approves
POST /api/approvals/{id}/query             # Manager raises query
POST /api/approvals/{id}/ask               # Manager raises private ask
POST /api/approvals/{id}/reapply           # Initiator responds to query/ask
POST /api/approvals/{id}/ca/pay            # CA marks as paid
POST /api/approvals/{id}/ca/query          # CA raises query
POST /api/approvals/{id}/ca/reapply        # Initiator responds to CA query
POST /api/approvals/{id}/acknowledge       # Initiator acknowledges payment
POST /api/approvals/{id}/ca/reject         # CA rejects
```

**Issues:**
- ❌ Separate CA routes (ca/pay, ca/query, ca/reapply) - unnecessary complexity
- ❌ QUERY and ASK are separate actions - should be unified

---

## Problems with Current Implementation

### Problem 1: Reimbursement ID Not Traceable

**Current Format**: `RB-2026-000123`
- Uses global sequential counter from `counters` collection
- Cannot determine:
  - Which user submitted it
  - What date it was submitted
  - How many reimbursements user submitted that day

**Required Format**: `RB{DDMMYYYY}-{username}-{count}`
- Example: `RB10062026-aryan-1`, `RB10062026-aryan-2`, `RB11062026-aryan-1`
- Benefits:
  - ✅ Date-based ID (easy to find submissions by date)
  - ✅ User-specific (easy to find user's submissions)
  - ✅ Daily counter (resets each day)
  - ✅ Human-readable

### Problem 2: Approval Chain Structure Lacks Detail

**Current**: Simple embedded approval chain

```javascript
{
  "reimbursement_id": "...",
  "approval_chain": [
    {"step": 0, "user_id": "initiator", "status": "SUBMITTED"},
    {"step": 1, "user_id": "manager1", "status": "APPROVED"},
    {"step": 2, "user_id": "owner", "status": "PENDING"}
  ]
}
```

**Problems:**
- ❌ No separate tracking of receivedAt vs submittedAt per step
- ❌ No tracking of whether it's a reapply
- ❌ No role information stored in each step
- ❌ Missing username for display purposes

**Required**: Enhanced embedded approval chain

```javascript
{
  "reimbursement_id": "RB10062026-aryan-1",
  "approval_chain": [
    {
      "step": 0,
      "user_id": "aryan@123",
      "username": "Aryan Nayak",
      "role": "initiator",
      "current_status": "SUBMITTED",
      "receivedAt": null,
      "submittedAt": "2026-06-10T12:00:00Z",
      "bIsReApply": false
    },
    {
      "step": 1,
      "user_id": "manager@123",
      "username": "Manager Name",
      "role": "manager",
      "current_status": "PENDING",  // Changes to IN_REVIEW when opened
      "receivedAt": null,            // Set when manager opens it
      "submittedAt": null            // Set when manager takes action
      "bIsReApply": false
    }
  ]
}
```

**Note:** Keep approval chain embedded for simpler queries and atomic updates

### Problem 3: No Daily Tracking

**Current**: No way to track how many reimbursements a user submitted today

**Required**: `reimbursement-lookup` collection

```javascript
{
  "user_id": "aryan@123",
  "username": "Aryan Nayak",
  "date": "10-06-2026",  // DD-MM-YYYY
  "reimbursement_ids": ["RB10062026-aryan-1", "RB10062026-aryan-2", "RB10062026-aryan-3"]
}
```

**Benefits:**
- ✅ Easy to find next reimbursement ID for the day
- ✅ Daily/monthly submission analytics
- ✅ User-specific submission tracking

### Problem 4: Overly Complex State Machine

**Current**: 17 states including CA-specific states

**Problems:**
- CA_PENDING vs IN_REVIEW (when CA is current reviewer) - redundant
- CA_QUERY vs QUERY_RAISED - redundant
- CA_REAPPLIED vs REAPPLIED - redundant
- OWNER_APPROVED - unnecessary intermediate state

**Required**: Simplified 9 states

1. `DRAFT` - Initial state when created
2. `SUBMITTED` - When initiator first submits
3. `IN_REVIEW` - When any reviewer (Manager/Owner/CA) is reviewing
4. `QUERY` - When any reviewer raises a query
5. `ASK` - When any reviewer raises a private ask
6. `REAPPLIED` - When initiator responds to query/ask
7. `REJECTED` - When CA rejects (terminal state)
8. `PAID` - When CA marks as paid
9. `ACKNOWLEDGED` - When initiator acknowledges payment (terminal state)

---

## Proposed Solution

### Solution Overview

**1. New Reimbursement ID Generation**
- Format: `RB{DDMMYYYY}-{username}-{count}`
- Daily counter per user (resets each day)
- Stored in `reimbursement-lookup` collection

**2. Enhanced Embedded Approval Chain**
- Keep approval chain **embedded** in reimbursement document
- Enhanced structure with step-level tracking
- Stores step-by-step tracking with receivedAt/submittedAt
- Each step tracks user status independently

**3. Simplified State Machine**
- Remove: CA_PENDING, CA_QUERY, CA_REAPPLIED, OWNER_APPROVED
- Unify: QUERY and ASK into status tracking
- Single QUERY/ASK status regardless of who raises it

**4. Enhanced Step Tracking**
- Each step tracks:
  - `current_status`: Current status of this step user
  - `receivedAt`: When user opened reimbursement after it was assigned
  - `submittedAt`: When user took action (approve/query/ask)
  - `bIsReApply`: Whether this is a reapply submission

---

## Database Schema Changes

### 1. NEW: `reimbursement-lookup` Collection

**Purpose**: Track daily user submissions for ID generation

```javascript
{
  "_id": ObjectId,
  "user_id": String,                    // User ID
  "username": String,                   // User name (for readability)
  "date": String,                       // Format: "DD-MM-YYYY"
  "reimbursement_ids": [String],        // Array of IDs generated today
  "count": Number                       // Current count for the day
}
```

**Indexes:**
```javascript
db.reimbursement_lookup.createIndex({"user_id": 1, "date": 1}, {unique: true})
db.reimbursement_lookup.createIndex({"date": 1})
```

**Example:**
```javascript
{
  "user_id": "aryan@123",
  "username": "Aryan Nayak",
  "date": "10-06-2026",
  "reimbursement_ids": [
    "RB10062026-aryan-1",
    "RB10062026-aryan-2",
    "RB10062026-aryan-3"
  ],
  "count": 3
}
```

### 2. UPDATED: `reimbursements` Collection

**Changes:**
- ✅ Change `reimbursement_id` format to `RB{DDMMYYYY}-{username}-{count}`
- ✅ Keep `reimbursement_code` for backward compatibility
- ✅ **Keep `approval_chain` embedded** (enhanced structure)
- ✅ Keep `current_reviewer_id` and `current_step` for quick access
- ✅ Change `created_at` to mean "first submission time"
- ✅ Add `submitted_at` for first submission timestamp

**New Schema:**
```javascript
{
  "_id": ObjectId,
  "reimbursement_id": String,           // NEW: RB10062026-aryan-1
  "reimbursement_code": String,         // DEPRECATED: Keep for backward compat (RB-2026-000123)
  "initiator_id": String,
  "initiator_name": String,
  "form_type": "general" | "business_trip",
  "status": "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "QUERY" | "ASK" |
            "REAPPLIED" | "REJECTED" | "PAID" | "ACKNOWLEDGED",
  "description": String,
  "items": [/* embedded items */],

  // ENHANCED: Approval chain embedded with detailed step tracking
  "approval_chain": [
    {
      "step": Number,                   // 0 = initiator, 1 = first manager, etc.
      "user_id": String,                // User ID for this step
      "username": String,               // User name (for display)
      "role": String,                   // Role: initiator, manager, owner, ca
      "current_status": String,         // Status of THIS user's step
      "receivedAt": String | null,      // ISO datetime when user opened after assignment
      "submittedAt": String | null,     // ISO datetime when user took action
      "bIsReApply": Boolean             // Whether this is a reapply
    }
  ],

  // Keep for quick access (denormalized from approval_chain)
  "current_reviewer_id": String,
  "current_step": Number,

  // Timestamps
  "created_at": String,                 // When user FIRST SUBMITS (not draft save)
  "updated_at": String,                 // When user edits after submission
  "submitted_at": String,               // NEW: First submission timestamp

  // Payment tracking
  "paid_at": String,
  "paid_by": String,
  "payment_proof": Object
}
```

**Step Status Values:**
- **Step 0 (Initiator)**:
  - `DRAFT` - Saved as draft
  - `SUBMITTED` - First submission
  - `REAPPLIED` - Responded to query/ask

- **Step 1+ (Reviewers: Manager/Owner/CA)**:
  - `PENDING` - Assigned but not yet opened
  - `IN_REVIEW` - Opened by reviewer
  - `QUERY` - Raised a query
  - `ASK` - Raised a private ask
  - `APPROVED` - Approved and moved to next step
  - `REJECTED` - Rejected (CA only)
  - `PAID` - Marked as paid (CA only)

**Indexes:**
```javascript
// Keep existing indexes
db.reimbursements.createIndex({"reimbursement_id": 1}, {unique: true})
db.reimbursements.createIndex({"initiator_id": 1})
db.reimbursements.createIndex({"current_reviewer_id": 1})
db.reimbursements.createIndex({"status": 1})
db.reimbursements.createIndex({"created_at": -1})

// NEW: Index for finding reimbursements where user is in approval chain
db.reimbursements.createIndex({"approval_chain.user_id": 1})
```

**Example:**
```javascript
{
  "_id": ObjectId("..."),
  "reimbursement_id": "RB10062026-aryan-1",
  "reimbursement_code": "RB-2026-000123",  // Keep for backward compat
  "initiator_id": "aryan@123",
  "initiator_name": "Aryan Nayak",
  "form_type": "general",
  "status": "IN_REVIEW",
  "description": "Monthly office supplies",
  "items": [/* ... */],

  // Enhanced embedded approval chain
  "approval_chain": [
    {
      "step": 0,
      "user_id": "aryan@123",
      "username": "Aryan Nayak",
      "role": "initiator",
      "current_status": "SUBMITTED",
      "receivedAt": null,
      "submittedAt": "2026-06-10T12:00:00Z",
      "bIsReApply": false
    },
    {
      "step": 1,
      "user_id": "manager@123",
      "username": "Manager Name",
      "role": "manager",
      "current_status": "IN_REVIEW",      // Changed from PENDING when opened
      "receivedAt": "2026-06-10T14:30:00Z",  // Set when manager first opened
      "submittedAt": null,                   // Will be set when manager takes action
      "bIsReApply": false
    },
    {
      "step": 2,
      "user_id": "owner@123",
      "username": "Owner Name",
      "role": "owner",
      "current_status": "PENDING",
      "receivedAt": null,
      "submittedAt": null,
      "bIsReApply": false
    },
    {
      "step": 3,
      "user_id": "ca@123",
      "username": "CA Name",
      "role": "ca",
      "current_status": "PENDING",
      "receivedAt": null,
      "submittedAt": null,
      "bIsReApply": false
    }
  ],

  "current_reviewer_id": "manager@123",
  "current_step": 1,

  "created_at": "2026-06-10T12:00:00Z",
  "updated_at": "2026-06-10T12:00:00Z",
  "submitted_at": "2026-06-10T12:00:00Z"
}
```

---

## State Machine Redesign

### Current State Machine (17 States) ❌

```
DRAFT → SUBMITTED → IN_REVIEW → QUERY_RAISED → REAPPLIED → IN_REVIEW
                                ↓                            ↓
                           PRIVATE_ASK                  OWNER_APPROVED
                                ↓                            ↓
                           REAPPLIED                    CA_PENDING
                                                             ↓
                                                        CA_QUERY
                                                             ↓
                                                        CA_REAPPLIED
                                                             ↓
                                                         PAID
                                                             ↓
                                                             ↓
                                                       ACKNOWLEDGED
```

**Problems:**
- Too many CA-specific states
- QUERY_RAISED vs CA_QUERY (same action, different states)
- PRIVATE_ASK vs QUERY_RAISED (same workflow, separate paths)
- OWNER_APPROVED is unnecessary intermediate state

### New State Machine (9 States) ✅

```
DRAFT → SUBMITTED → IN_REVIEW → QUERY → REAPPLIED → IN_REVIEW → ... → PAID → ACKNOWLEDGED
                                   ↓
                                  ASK → REAPPLIED
                                   ↓
                               REJECTED (terminal)
```

**Simplified States:**

1. **DRAFT** - Reimbursement created but not submitted
2. **SUBMITTED** - Initiator submits reimbursement (first time)
3. **IN_REVIEW** - Any reviewer (Manager/Owner/CA) is reviewing
4. **QUERY** - Any reviewer raises a query (public)
5. **ASK** - Any reviewer raises a private ask
6. **REAPPLIED** - Initiator responds to query/ask
7. **REJECTED** - CA rejects the reimbursement (terminal state)
8. **PAID** - CA marks as paid
9. **ACKNOWLEDGED** - Initiator acknowledges payment (terminal state)

### New Transition Rules

```python
TRANSITIONS = {
    # Initiator can save draft or submit
    "DRAFT": {
        "SUBMIT": "SUBMITTED"
    },

    # First submission → first reviewer can review
    "SUBMITTED": {
        "APPROVE": "IN_REVIEW",      # Move to next reviewer
        "QUERY": "QUERY",             # Raise public query
        "ASK": "ASK",                 # Raise private ask
        "REJECT": "REJECTED"          # CA can reject anytime
    },

    # Any reviewer is reviewing
    "IN_REVIEW": {
        "APPROVE": "IN_REVIEW",       # Move to next reviewer (or PAID if CA is last)
        "QUERY": "QUERY",             # Raise query
        "ASK": "ASK",                 # Raise private ask
        "REJECT": "REJECTED",         # CA can reject
        "PAY": "PAID"                 # CA marks as paid (if approved by all)
    },

    # Initiator must respond to query
    "QUERY": {
        "REAPPLY": "REAPPLIED"        # Initiator responds
    },

    # Initiator must respond to ask
    "ASK": {
        "REAPPLY": "REAPPLIED"        # Initiator responds
    },

    # Initiator responded → back to reviewer
    "REAPPLIED": {
        "APPROVE": "IN_REVIEW",       # Reviewer approves
        "QUERY": "QUERY",             # Reviewer queries again
        "ASK": "ASK",                 # Reviewer asks again
        "REJECT": "REJECTED",         # CA rejects
        "PAY": "PAID"                 # CA pays (if approved)
    },

    # CA marked as paid → initiator must acknowledge
    "PAID": {
        "ACKNOWLEDGE": "ACKNOWLEDGED"       # Initiator acknowledges payment
    },

    # Terminal states (no further transitions)
    "REJECTED": {},      # Terminal: reimbursement rejected by CA
    "ACKNOWLEDGED": {}   # Terminal: payment acknowledged by initiator
}
```

### Status Change Scenarios (From Requirements)

**Scenario 1: Initiator Submits**
```
Action: User clicks "Submit"
Old Status: DRAFT
New Status: SUBMITTED
Current Reviewer: First manager
Step 0 Status: SUBMITTED
Step 1 Status: PENDING
```

**Scenario 2: Manager Opens Reimbursement**
```
Action: Manager opens detail page
Old Status: SUBMITTED (or REAPPLIED)
New Status: IN_REVIEW
Current Reviewer: Manager (unchanged)
Step Status: PENDING → IN_REVIEW
ReceivedAt: Set to current timestamp
```

**Scenario 3: Manager Raises Query**
```
Action: Manager clicks "Query"
Old Status: IN_REVIEW
New Status: QUERY
Current Reviewer: Initiator
Step Status: IN_REVIEW → QUERY
SubmittedAt: Set to current timestamp
```

**Scenario 4: Manager Raises Private Ask**
```
Action: Manager clicks "Ask"
Old Status: IN_REVIEW
New Status: ASK
Current Reviewer: Initiator
Step Status: IN_REVIEW → ASK
SubmittedAt: Set to current timestamp
```

**Scenario 5: Initiator Reapplies**
```
Action: Initiator responds to query/ask
Old Status: QUERY or ASK
New Status: REAPPLIED
Current Reviewer: Same manager who queried
Step 0 Status: REAPPLIED
bIsReApply: true
SubmittedAt: Set to current timestamp
```

**Scenario 6: Manager Approves**
```
Action: Manager clicks "Approve"
Old Status: IN_REVIEW or REAPPLIED
New Status: IN_REVIEW (next reviewer) or PAID (if last is CA and all approved)
Current Reviewer: Next in chain
Step Status: IN_REVIEW → APPROVED
SubmittedAt: Set to current timestamp
```

**Scenario 7: CA Marks as Paid**
```
Action: CA clicks "Pay"
Old Status: IN_REVIEW (when CA is current reviewer)
New Status: PAID
Current Reviewer: Initiator
Step Status: IN_REVIEW → PAID
SubmittedAt: Set to current timestamp
```

**Scenario 8: CA Rejects**
```
Action: CA clicks "Reject"
Old Status: IN_REVIEW, SUBMITTED, REAPPLIED
New Status: REJECTED
Current Reviewer: None
Step Status: REJECTED
SubmittedAt: Set to current timestamp
```

**Scenario 9: Initiator Acknowledges Payment**
```
Action: Initiator clicks "Acknowledge Payment"
Old Status: PAID
New Status: ACKNOWLEDGED
Current Reviewer: None
Step Status: ACKNOWLEDGED (step-level for initiator)
```

---

## Backend Route Changes

### Current Routes (approval_routes.py) ❌

```python
POST /api/approvals/{id}/approve           # Manager/Owner approves
POST /api/approvals/{id}/query             # Manager raises query
POST /api/approvals/{id}/ask               # Manager raises private ask
POST /api/approvals/{id}/reapply           # Initiator responds

# CA-specific routes (REMOVE THESE)
POST /api/approvals/{id}/ca/pay            # ❌ Remove - make generic
POST /api/approvals/{id}/ca/query          # ❌ Remove - use /query
POST /api/approvals/{id}/ca/reapply        # ❌ Remove - use /reapply
POST /api/approvals/{id}/ca/reject         # ❌ Remove - make generic

POST /api/approvals/{id}/acknowledge       # Initiator acknowledges
```

### Updated Routes (approval_routes.py) ✅

```python
# All reviewers (Manager/Owner/CA) can use these
POST /api/approvals/{id}/approve           # Any reviewer approves
POST /api/approvals/{id}/query             # Any reviewer raises query
POST /api/approvals/{id}/ask               # Any reviewer raises private ask
POST /api/approvals/{id}/reject            # Only CA can reject

# Initiator actions
POST /api/approvals/{id}/reapply           # Initiator responds to query/ask

# CA actions
POST /api/approvals/{id}/pay               # CA marks as paid (moved from /ca/pay)

# Payment acknowledgement
POST /api/approvals/{id}/acknowledge       # Initiator acknowledges payment

# NEW: View tracking
POST /api/approvals/{id}/view              # Track when reviewer opens (sets receivedAt)
```

**Changes:**
- ✅ Remove all `/ca/` prefix routes
- ✅ Unify QUERY for all reviewers (Manager/Owner/CA)
- ✅ Unify REAPPLY for all scenarios
- ✅ Add `/view` endpoint to track receivedAt
- ✅ Move `/ca/pay` to `/pay`
- ✅ Move `/ca/reject` to `/reject`

### Current Routes (reimbursement_routes.py) ❌

```python
POST /api/reimbursements/draft             # Create draft
PUT  /api/reimbursements/{id}/draft        # Update draft
POST /api/reimbursements/{id}/submit       # Submit reimbursement
GET  /api/reimbursements/my                # List my reimbursements
GET  /api/reimbursements/team              # List team reimbursements
GET  /api/reimbursements/{id}              # Get detail
DELETE /api/reimbursements/{id}            # Delete draft
GET  /api/reimbursements/{id}/chain        # Get approval chain
```

### Updated Routes (reimbursement_routes.py) ✅

```python
POST /api/reimbursements/draft             # Create draft (generates NEW ID format)
PUT  /api/reimbursements/{id}/draft        # Update draft
POST /api/reimbursements/{id}/submit       # Submit (creates embedded approval chain)
GET  /api/reimbursements/my                # List my reimbursements
GET  /api/reimbursements/team              # List team reimbursements (queries approval_chain.user_id)
GET  /api/reimbursements/{id}              # Get detail (includes embedded approval_chain)
DELETE /api/reimbursements/{id}            # Delete draft
GET  /api/reimbursements/{id}/chain        # Get approval chain (from embedded approval_chain field)
```

**Changes:**
- ✅ `POST /draft` generates new ID format: `RB{DDMMYYYY}-{username}-{count}`
- ✅ `POST /submit` creates enhanced embedded approval chain with step tracking
- ✅ `GET /team` uses `approval_chain.user_id` index to find reimbursements where user is reviewer
- ✅ `GET /{id}/chain` returns embedded `approval_chain` array with enhanced fields

### NEW Routes

```python
# Reimbursement lookup
GET /api/reimbursements/lookup/today       # Get today's submissions for current user
GET /api/reimbursements/lookup/user/{user_id}/{date}  # Get submissions for specific user/date
```

---

## Backend Implementation Changes

### 1. NEW Controller: `ReimbursementIDGenerator.py`

```python
"""
Purpose: Generate new reimbursement IDs in format RB{DDMMYYYY}-{username}-{count}
"""

from datetime import datetime, timezone
from config.mongodb_config import get_collection

def generateReimbursementId(strUserId: str, strUsername: str) -> str:
    """
    Generate new reimbursement ID for today.

    Format: RB{DDMMYYYY}-{username}-{count}
    Example: RB10062026-aryan-1

    Args:
        strUserId: User ID
        strUsername: User name (used in ID)

    Returns:
        New reimbursement ID
    """
    objLookup = get_collection("reimbursement_lookup")

    # Get today's date in DD-MM-YYYY format
    dtNow = datetime.now(timezone.utc)
    strDate = dtNow.strftime("%d-%m-%Y")
    strDateForId = dtNow.strftime("%d%m%Y")  # DDMMYYYY for ID

    # Clean username for ID (lowercase, no spaces)
    strCleanUsername = strUsername.lower().replace(" ", "")

    # Find or create lookup entry for today
    dictLookup = objLookup.find_one({"user_id": strUserId, "date": strDate})

    if not dictLookup:
        # First reimbursement today
        iCount = 1
        strReimbursementId = f"RB{strDateForId}-{strCleanUsername}-{iCount}"

        objLookup.insert_one({
            "user_id": strUserId,
            "username": strUsername,
            "date": strDate,
            "reimbursement_ids": [strReimbursementId],
            "count": iCount
        })
    else:
        # Increment count
        iCount = dictLookup["count"] + 1
        strReimbursementId = f"RB{strDateForId}-{strCleanUsername}-{iCount}"

        objLookup.update_one(
            {"user_id": strUserId, "date": strDate},
            {
                "$push": {"reimbursement_ids": strReimbursementId},
                "$set": {"count": iCount}
            }
        )

    return strReimbursementId
```

### 2. NEW Controller: `ApprovalChainService.py`

```python
"""
Purpose: Create and manage embedded approval chains in reimbursement documents
"""

from datetime import datetime, timezone
from bson import ObjectId
from config.mongodb_config import get_collection
from controllers.ApprovalChainEngine import build_approval_chain_for_reimbursement

def createEmbeddedApprovalChain(strInitiatorId: str) -> list:
    """
    Create enhanced approval chain array for embedding in reimbursement.

    Args:
        strInitiatorId: Initiator user ID

    Returns:
        List of approval chain step dicts
    """
    objUsers = get_collection("users")

    # Build approval chain using existing engine
    dictTree, lsChain = build_approval_chain_for_reimbursement(strInitiatorId)

    # Get initiator info
    dictInitiator = objUsers.find_one({"_id": ObjectId(strInitiatorId)})

    # Build enhanced chain array
    lsChainSteps = [
        {
            "step": 0,
            "user_id": strInitiatorId,
            "username": dictInitiator.get("name", ""),
            "role": "initiator",
            "current_status": "SUBMITTED",
            "receivedAt": None,
            "submittedAt": datetime.now(timezone.utc).isoformat(),
            "bIsReApply": False
        }
    ]

    # Add reviewers from chain
    for idx, dictReviewer in enumerate(lsChain):
        # Determine role from user's departments
        dictReviewerUser = objUsers.find_one({"_id": ObjectId(dictReviewer["user_id"])})
        strRole = "manager"  # Default

        if dictReviewerUser:
            for dept in dictReviewerUser.get("departments", []):
                if dept.get("role") == "owner":
                    strRole = "owner"
                    break
                elif dept.get("role") == "ca":
                    strRole = "ca"
                    break
                elif dept.get("role") == "senior_manager":
                    strRole = "senior_manager"

        lsChainSteps.append({
            "step": idx + 1,
            "user_id": dictReviewer["user_id"],
            "username": dictReviewer["name"],
            "role": strRole,
            "current_status": "PENDING",
            "receivedAt": None,
            "submittedAt": None,
            "bIsReApply": False
        })

    return lsChainSteps

def updateApprovalChainStep(strReimbursementId: str, iStep: int, dictUpdates: dict):
    """
    Update a specific step in the embedded approval chain.

    Args:
        strReimbursementId: Reimbursement ID
        iStep: Step index to update
        dictUpdates: Fields to update in the step
    """
    objReimbs = get_collection("reimbursements")

    # Build update query for specific array element
    dictUpdateFields = {}
    for strKey, objValue in dictUpdates.items():
        dictUpdateFields[f"approval_chain.{iStep}.{strKey}"] = objValue

    dictUpdateFields["updated_at"] = datetime.now(timezone.utc).isoformat()

    objReimbs.update_one(
        {"_id": ObjectId(strReimbursementId)},
        {"$set": dictUpdateFields}
    )

def markStepAsViewed(strReimbursementId: str, iStep: int):
    """
    Mark a step as viewed (sets receivedAt and changes status from PENDING to IN_REVIEW).

    Args:
        strReimbursementId: Reimbursement ID
        iStep: Step index
    """
    objReimbs = get_collection("reimbursements")

    # Get current step status
    dictReimb = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})
    if not dictReimb:
        return

    lsChain = dictReimb.get("approval_chain", [])
    if iStep >= len(lsChain):
        return

    dictStep = lsChain[iStep]

    # Only update if status is PENDING and receivedAt is not set
    if dictStep.get("current_status") == "PENDING" and not dictStep.get("receivedAt"):
        updateApprovalChainStep(strReimbursementId, iStep, {
            "current_status": "IN_REVIEW",
            "receivedAt": datetime.now(timezone.utc).isoformat()
        })
```

### 3. UPDATED Controller: `ReimbursementStateMachine.py`

**Changes to `TRANSITIONS` dict:**

```python
# OLD (17 states)
TRANSITIONS = {
    "SUBMITTED": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "IN_REVIEW": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "QUERY_RAISED": {"REAPPLY": "REAPPLIED"},
    "PRIVATE_ASK": {"REAPPLY": "REAPPLIED"},
    "REAPPLIED": {"APPROVE": "IN_REVIEW", "QUERY": "QUERY_RAISED", "ASK": "PRIVATE_ASK"},
    "OWNER_APPROVED": {"SEND_TO_CA": "CA_PENDING", "CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "CA_PENDING": {"CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "CA_QUERY": {"CA_REAPPLY": "CA_REAPPLIED"},
    "CA_REAPPLIED": {"CA_QUERY": "CA_QUERY", "PAY": "PAID", "REJECT": "REJECTED"},
    "PAID": {"ACKNOWLEDGE": "ACKNOWLEDGED"},
    "ACKNOWLEDGED": {},
}

# NEW (9 states) ✅
TRANSITIONS = {
    "DRAFT": {
        "SUBMIT": "SUBMITTED"
    },
    "SUBMITTED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED"
    },
    "IN_REVIEW": {
        "APPROVE": "IN_REVIEW",  # or PAID if last reviewer
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED",
        "PAY": "PAID"
    },
    "QUERY": {
        "REAPPLY": "REAPPLIED"
    },
    "ASK": {
        "REAPPLY": "REAPPLIED"
    },
    "REAPPLIED": {
        "APPROVE": "IN_REVIEW",
        "QUERY": "QUERY",
        "ASK": "ASK",
        "REJECT": "REJECTED",
        "PAY": "PAID"
    },
    "PAID": {
        "ACKNOWLEDGE": "ACKNOWLEDGED"
    },
    "REJECTED": {},        # Terminal state
    "ACKNOWLEDGED": {}     # Terminal state
}
```

**Changes to `transition()` function:**

- Remove CA_QUERY, CA_REAPPLY handling
- Update embedded approval chain using array element updates
- Set receivedAt when reviewer opens (new `/view` endpoint)
- Set submittedAt when reviewer takes action
- Use `ApprovalChainService.updateApprovalChainStep()` for step updates

---

## Frontend Changes

### TypeScript Interface Updates

**1. Update `client/src/types/reimbursement.ts`**

```typescript
// OLD
export interface Reimbursement {
  reimbursement_id: string;
  reimbursement_code?: string;  // RB-2026-000123
  // ...
}

// NEW ✅
export interface Reimbursement {
  reimbursement_id: string;        // RB10062026-aryan-1 (NEW FORMAT)
  reimbursement_code?: string;      // Deprecated, keep for compat
  approval_chain: ApprovalChainStep[];  // Enhanced embedded approval chain
  current_reviewer_id?: string;
  current_step?: number;
  // ...
  submitted_at?: string;            // First submission timestamp
}

// Enhanced approval chain step interface
export interface ApprovalChainStep {
  step: number;
  user_id: string;
  username: string;
  role: 'initiator' | 'manager' | 'owner' | 'ca';
  current_status: 'DRAFT' | 'SUBMITTED' | 'PENDING' | 'IN_REVIEW' | 'QUERY' | 'ASK' | 'APPROVED' | 'REJECTED' | 'PAID';
  receivedAt?: string;              // When user opened after assignment
  submittedAt?: string;             // When user took action
  bIsReApply: boolean;
}
```

**2. Update Status Types**

```typescript
// OLD (17 states)
export type ReimbursementStatus =
  | 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'QUERY_RAISED' | 'PRIVATE_ASK'
  | 'REAPPLIED' | 'OWNER_APPROVED' | 'CA_PENDING' | 'CA_QUERY' | 'CA_REAPPLIED'
  | 'PAID' | 'PAYMENT_ACKNOWLEDGED' | 'REJECTED' | 'AUTO_REJECTED' | 'ACKNOWLEDGED';

// NEW (9 states) ✅
export type ReimbursementStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'QUERY'
  | 'ASK'
  | 'REAPPLIED'
  | 'REJECTED'
  | 'PAID'
  | 'ACKNOWLEDGED';
```

### API Utility Updates

**1. Update `client/src/utils/approvalApi.ts`**

```typescript
// REMOVE ❌
export const caQueryReimbursementApi = async (...) => { ... }
export const caReapplyReimbursementApi = async (...) => { ... }
export const payReimbursementApi = async (strId: string, objPayload: PayRequest) => {
  const objResp = await apiClient.post(`/api/approvals/${strId}/ca/pay`, objPayload);
  return objResp.data;
};

// UPDATE ✅
export const payReimbursementApi = async (strId: string, objPayload: PayRequest) => {
  const objResp = await apiClient.post(`/api/approvals/${strId}/pay`, objPayload);
  return objResp.data;
};

export const rejectReimbursementApi = async (strId: string, objPayload: RejectRequest) => {
  const objResp = await apiClient.post(`/api/approvals/${strId}/reject`, objPayload);
  return objResp.data;
};

// NEW: Track when reviewer opens reimbursement
export const markAsViewedApi = async (strId: string) => {
  const objResp = await apiClient.post(`/api/approvals/${strId}/view`);
  return objResp.data;
};
```

**2. Update `client/src/utils/reimbursementApi.ts`**

```typescript
// UPDATE: Fetch approval chain from embedded field (returned in reimbursement detail)
export const getReimbursementApi = async (strId: string): Promise<Reimbursement> => {
  const objResp = await apiClient.get<Reimbursement>(`/api/reimbursements/${strId}`);
  return objResp.data;  // Includes embedded approval_chain field
};

// Or dedicated chain endpoint if needed
export const getReimbursementChainApi = async (strId: string): Promise<ApprovalChainStep[]> => {
  const objResp = await apiClient.get<ApprovalChainStep[]>(`/api/reimbursements/${strId}/chain`);
  return objResp.data;
};
```

### Component Updates

**1. `client/src/components/Reimbursement/QueryAskDialog.tsx`**

- Remove `ca_query` and `ca_reapply` action types
- Use unified `query` and `reapply` for all reviewers

**2. `client/src/pages/ReimbursementDetailPage.tsx`**

- Call `markAsViewedApi` when page loads (if user is current reviewer)
- Use embedded `approval_chain` field from reimbursement detail response
- Display enhanced step tracking (receivedAt, submittedAt)

**3. Display New Reimbursement ID Format**

- Update all places showing reimbursement code to display new format
- Example: `RB10062026-aryan-1` instead of `RB-2026-000123`

---

## Migration Strategy

### Phase 1: Database Preparation

**1. Create New Collection**

```javascript
// Create reimbursement-lookup collection
db.createCollection("reimbursement_lookup")
db.reimbursement_lookup.createIndex({"user_id": 1, "date": 1}, {unique: true})
db.reimbursement_lookup.createIndex({"date": 1})
```

**2. Update Reimbursements Collection Indexes**

```javascript
// Add new index for querying approval_chain.user_id
db.reimbursements.createIndex({"approval_chain.user_id": 1})

**3. Migration Script for Existing Reimbursements**

```python
"""
Migrate existing reimbursements to new schema:
1. Keep old reimbursement_code for backward compatibility
2. Generate new reimbursement_id in new format (use creation date)
3. Enhance embedded approval_chain with new fields
4. Create reimbursement-lookup entries
"""

from datetime import datetime
from bson import ObjectId

def migrateReimbursements():
    objReimbs = get_collection("reimbursements")
    objLookup = get_collection("reimbursement_lookup")
    objUsers = get_collection("users")

    for dictReimb in objReimbs.find({}):
        # Generate new ID format from created_at date
        dtCreated = datetime.fromisoformat(dictReimb["created_at"])
        strDate = dtCreated.strftime("%d%m%Y")

        # Get initiator username
        dictUser = objUsers.find_one({"_id": ObjectId(dictReimb["initiator_id"])})
        strUsername = dictUser.get("name", "unknown").lower().replace(" ", "")

        # Generate count (fallback to last 3 digits of old code)
        iCount = int(dictReimb["reimbursement_code"].split("-")[-1])

        strNewId = f"RB{strDate}-{strUsername}-{iCount}"

        # Enhance existing approval chain with new fields
        lsEnhancedChain = []
        if dictReimb.get("approval_chain"):
            for dictStep in dictReimb["approval_chain"]:
                # Get user info for username and role
                dictStepUser = objUsers.find_one({"_id": ObjectId(dictStep.get("user_id", ""))})

                lsEnhancedChain.append({
                    "step": dictStep.get("step", 0),
                    "user_id": dictStep.get("user_id", ""),
                    "username": dictStepUser.get("name", "") if dictStepUser else "",
                    "role": dictStep.get("role", "initiator"),
                    "current_status": dictStep.get("status", "PENDING"),
                    "receivedAt": dictStep.get("received_date", None),  # Map old field
                    "submittedAt": dictStep.get("response_date", None),  # Map old field
                    "bIsReApply": False  # Default for existing data
                })

        # Update reimbursement
        objReimbs.update_one(
            {"_id": dictReimb["_id"]},
            {
                "$set": {
                    "reimbursement_id": strNewId,
                    "approval_chain": lsEnhancedChain,
                    "submitted_at": dictReimb.get("created_at")  # First submission
                }
            }
        )

        # Create lookup entry (optional, for historical tracking)
        strLookupDate = dtCreated.strftime("%Y-%m-%d")
        objLookup.update_one(
            {"user_id": dictReimb["initiator_id"], "date": strLookupDate},
            {
                "$inc": {"count": 1},
                "$push": {"reimbursement_ids": strNewId}
            },
            upsert=True
        )
```

### Phase 2: Backend Implementation

**Week 1:**
- Day 1-2: Create new controllers (ReimbursementIDGenerator, ApprovalChainService for embedded chain)
- Day 3-4: Update ReimbursementStateMachine with new transitions (9 states)
- Day 5: Update routes (remove /ca/ prefixes, add /view endpoint, update chain queries)

**Week 2:**
- Day 1-2: Test new ID generation
- Day 3-4: Test approval chain creation and updates
- Day 5: Integration testing

### Phase 3: Frontend Updates

**Week 3:**
- Day 1-2: Update TypeScript interfaces
- Day 3-4: Update API utilities
- Day 5: Update components (remove CA-specific actions)

**Week 4:**
- Day 1-3: Testing and bug fixes
- Day 4-5: Deploy to staging

---

## Implementation Plan

### Milestone 1: Backend Foundation (Week 1-2)

✅ Create `reimbursement-lookup` collection
✅ Create `approvals` collection
✅ Create `ReimbursementIDGenerator.py`
✅ Create `ApprovalChainService.py`
✅ Update `ReimbursementStateMachine.py` transitions
✅ Write migration script for existing data

### Milestone 2: Backend Routes (Week 3)

✅ Update `/api/reimbursements/draft` to generate new ID format
✅ Update `/api/reimbursements/{id}/submit` to create approval chain
✅ Add `/api/reimbursements/{id}/approval-chain` endpoint
✅ Remove `/ca/` prefix from approval routes
✅ Add `/api/approvals/{id}/view` endpoint
✅ Update all routes to use `approvals` collection

### Milestone 3: Frontend Updates (Week 4-5)

✅ Update TypeScript interfaces
✅ Update API utilities
✅ Remove CA-specific actions from components
✅ Test new approval workflow

### Milestone 4: Migration & Deployment (Week 6)

✅ Run migration script on staging database
✅ Test end-to-end on staging
✅ Deploy to production
✅ Monitor for issues

---

## Conclusion

This major update simplifies the reimbursement and approval system by:

1. **Better Traceability**: New ID format (`RB10062026-aryan-1`) makes it easy to find submissions by date and user
2. **Improved Queryability**: Separate `approvals` collection enables complex queries
3. **Daily Tracking**: `reimbursement-lookup` collection tracks daily submissions per user
4. **Simplified State Machine**: 9 states instead of 17, removing redundant CA-specific states
5. **Cleaner Routes**: Unified routes for all reviewers, removing `/ca/` prefixes
6. **Enhanced Tracking**: Step-level tracking with `receivedAt` and `submittedAt` timestamps

**Total Effort**: 6 weeks
**Risk Level**: Medium-High (breaking changes to schema and routes)
**Migration Required**: Yes (existing reimbursements must be migrated)

---

**Next Steps:**

1. ✅ Review and approve this plan
2. ✅ Create feature branch for development
3. ✅ Begin Milestone 1: Backend foundation
4. ✅ Write comprehensive tests
5. ✅ Prepare migration scripts

---

**Document Version**: 1.0
**Last Updated**: 2026-06-10
**Author**: Development Team
**Status**: Ready for Review & Approval



---

## Identified Issues

### 1. Schema Inconsistencies

**Issue**: Response schemas don't always match database documents
- `ReimbursementResponseSchema` missing fields: `approval_chain`, `current_step`, `submitted_at`
- `ApprovalChainNodeSchema` missing: `approved_at_iso`, `comments`, `conditions`

**Impact**: Frontend cannot display complete information

### 2. Missing Validation Rules

**Issue**: Insufficient validation on approval actions
- No check if user can approve (must be current reviewer)
- No validation of query/ask message length consistency
- No validation of payment proof requirements

**Impact**: Potential data integrity issues

### 3. Incomplete Error Responses

**Issue**: Error responses lack detail
- Generic error messages like "Transition failed"
- No error codes for client-side handling
- Missing field-level validation errors

**Impact**: Poor debugging experience and user experience

### 4. Frontend-Backend Type Mismatches

**Issue**: TypeScript interfaces don't match Pydantic schemas
- `Reimbursement` interface missing `approval_chain` array
- `ChainStep` interface different structure than `ApprovalChainNodeSchema`
- Payment proof fields mismatch

**Impact**: Runtime errors and type casting issues

### 5. Limited Approval Actions

**Issue**: Approval workflow lacks flexibility
- No support for conditional approvals
- No support for approving with conditions/comments
- No support for delegating approvals
- No support for bulk actions

**Impact**: Inflexible workflow that doesn't match real-world scenarios

### 6. Approval Chain Limitations

**Issue**: Current chain structure is too rigid
- Cannot handle parallel approvals (multiple reviewers at same level)
- Cannot handle optional reviewers
- Cannot skip levels based on amount thresholds
- No support for auto-approval rules

**Impact**: Cannot support complex approval workflows

---

## Proposed Changes

### Change Set 1: Enhanced Approval Schemas

**Add to `approval_schemas.py`:**

```python
# Enhanced Approve Request with optional comments
class ApproveRequest(BaseModel):
    comments: Optional[str] = Field(None, max_length=500, description="Optional approval comments")
    conditions: Optional[List[str]] = Field(default_factory=list, description="Conditional approval requirements")

# Enhanced Query Request with severity
class QueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    severity: Optional[str] = Field("normal", description="normal | urgent | blocker")
    requires_response_by: Optional[str] = Field(None, description="ISO datetime deadline for response")

# New Partial Approve Request
class PartialApproveRequest(BaseModel):
    approved_items: List[str] = Field(..., description="List of item indices or IDs to approve")
    rejected_items: List[str] = Field(default_factory=list, description="List of item indices to reject")
    comments: str = Field(..., min_length=1, max_length=1000)

# New Delegate Request
class DelegateRequest(BaseModel):
    delegate_to_user_id: str = Field(..., description="User ID to delegate approval to")
    reason: str = Field(..., min_length=1, max_length=500)
    expiry_hours: Optional[int] = Field(24, ge=1, le=168, description="Hours until delegation expires")
```

### Change Set 2: Enhanced Reimbursement Response Schema

**Update `reimbursement_schemas.py`:**

```python
class ReimbursementResponseSchema(BaseModel):
    reimbursement_id: str
    reimbursement_code: Optional[str] = None
    initiator_id: str
    initiator_name: str
    form_type: FormTypeEnum
    status: ReimbursementStatusEnum
    description: Optional[str] = None
    items: List[ReimbursementItemSchema]
    business_trip_meta: Optional[BusinessTripMetaSchema] = None
    payment_proof: Optional[PaymentProofSchema] = None
    created_at: str
    updated_at: str
    submitted_at: Optional[str] = Field(None, description="ISO datetime when submitted")
    
    # NEW FIELDS
    approval_chain: List[ApprovalChainNodeSchema] = Field(default_factory=list, description="Frozen approval chain snapshot")
    current_step: int = Field(0, description="Current step index in approval chain")
    current_reviewer_id: Optional[str] = Field(None, description="User ID of current reviewer")
    total_amount: float = Field(0.0, description="Sum of all item amounts")
    can_edit: bool = Field(False, description="Whether current user can edit")
    can_delete: bool = Field(False, description="Whether current user can delete")
    can_submit: bool = Field(False, description="Whether current user can submit")
    permissions: Dict[str, bool] = Field(default_factory=dict, description="User-specific permissions")
```

### Change Set 3: Enhanced Approval Chain Node Schema

**Update `approval_chain_schemas.py`:**

```python
class ApprovalChainNodeSchema(BaseModel):
    level: int = Field(..., description="Position in chain (1 = first reviewer)")
    user_id: str
    name: str
    email: str
    role: str
    priority: int
    approval_type: str  # mandatory | optional
    status: str
    received_date: Optional[str] = None
    response_date: Optional[str] = None
    action: Optional[str] = None
    
    # NEW FIELDS
    comments: Optional[str] = Field(None, description="Reviewer's approval comments")
    conditions: List[str] = Field(default_factory=list, description="Conditional approval requirements")
    delegated_from: Optional[str] = Field(None, description="User ID if this approval was delegated")
    delegation_expiry: Optional[str] = Field(None, description="ISO datetime when delegation expires")
    auto_approved: bool = Field(False, description="Whether this was auto-approved by system rule")
    auto_approval_rule: Optional[str] = Field(None, description="Rule that triggered auto-approval")
    skipped: bool = Field(False, description="Whether this step was skipped")
    skip_reason: Optional[str] = Field(None, description="Reason for skipping this step")
```

### Change Set 4: New Approval Endpoints

**Add to `approval_routes.py`:**

```python
# Partial approval (approve some items, query others)
@router.post("/{reimbursement_id}/partial-approve")
async def partialApprove(
    reimbursement_id: str,
    objRequest: PartialApproveRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """Partially approve a reimbursement (some items approved, others need clarification)"""
    pass

# Delegate approval to another user
@router.post("/{reimbursement_id}/delegate")
async def delegateApproval(
    reimbursement_id: str,
    objRequest: DelegateRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """Delegate approval authority to another user temporarily"""
    pass

# Bulk approve multiple reimbursements
@router.post("/bulk-approve")
async def bulkApprove(
    objRequest: BulkApproveRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """Approve multiple reimbursements at once"""
    pass
```

### Change Set 5: Standardized Error Responses

**Add to new file `schemas/error_schemas.py`:**

```python
class ErrorDetail(BaseModel):
    field: Optional[str] = Field(None, description="Field name that caused the error")
    message: str = Field(..., description="Human-readable error message")
    code: str = Field(..., description="Machine-readable error code")
    


---

## Conclusion

This major update will significantly enhance the ExpenseManager system with:

1. **Better Type Safety** - Aligned schemas between backend and frontend
2. **Enhanced Features** - Delegation, partial approvals, bulk actions
3. **Improved UX** - Permission-based UI, better error messages
4. **Scalability** - Support for complex approval workflows
5. **Maintainability** - Standardized patterns, better documentation

**Timeline**: 5 weeks
**Risk Level**: Medium
**Expected ROI**: High

---

**Next Steps:**

1. Review and approve this plan
2. Begin Phase 1: Backend Schema Updates
3. Set up feature flags
4. Create migration scripts
5. Begin implementation

---

**Document Version**: 1.0
**Last Updated**: 2026-06-10
**Author**: Development Team
**Status**: Awaiting Approval
