# Reimbursement Approval Chain System

## Overview

The Reimbursement Approval Chain system is a production-ready engine that automatically generates hierarchical approval workflows based on employee-manager relationships. It ensures every reimbursement follows a structured approval path from the initiator through their management chain to the Owner and finally to the Accountant.

---

## Business Requirements

### Key Actors

- **Initiator**: The employee who creates and submits the reimbursement
- **Manager(s)**: Reviewers in the employee's management hierarchy
- **Owner**: Top-level approver who must review all reimbursements (except their own)
- **Accountant (CA)**: Final reviewer who processes payment

---

## Approval Chain Rules

### Rule 1: Hierarchical Levels

Every participant in the chain is assigned a level:

- **Level 1**: Initiator (implicit, not in chain)
- **Level 2**: First selected manager
- **Level 3**: Manager's manager
- **Level N**: Continues recursively through the hierarchy

### Rule 2: Manager Priority Selection

When an employee has multiple managers, the system selects based on **priority value**:

- **Lower priority number = Higher priority**
- Priority 1 is selected before Priority 2

**Example**:
```json
{
  "userId": "A",
  "managers": [
    {"managerId": "X", "priority": 2},
    {"managerId": "Y", "priority": 1}
  ]
}
```

**Result**: Manager Y is selected (priority 1 > priority 2)

**Approval Chain**: A → Y

### Rule 3: Accountant is Final Reviewer

- Accountant must always be the final reviewer
- No reviewer should exist after Accountant
- System automatically appends Accountant at the end

### Rule 4: Owner Before Accountant

- Owner must always appear before Accountant
- Expected chain ending: `... → Owner → Accountant`
- Every reimbursement must pass through Owner and Accountant
- Exception: If Owner is the initiator, they skip their own review

### Rule 5: Full Tree Generation

The system generates the **complete approval tree**, not just a linear chain.

**Example Hierarchy**:
```
          A (Initiator)
       /  |  \
      B   C   D
     / \  /
    P   Q  R
```

The system stores this entire tree structure for reference.

### Rule 6: Left-View Chain Extraction

The actual approval chain is extracted using the **left-view** (leftmost branch) of the tree:

```
A → B → P
```

This becomes the reimbursement's approval chain.

### Rule 7: Cycle Detection

The system detects and prevents circular references:

**Invalid Chain**:
```
A → B → C → A
```

**Result**: System throws an exception with cycle path details

### Rule 8: Duplicate Prevention

- Each reviewer can appear only once in the chain
- System tracks visited users to prevent duplicates
- Ensures efficient and clear approval flow

---

## Reimbursement Lifecycle

### Draft State

- User saves reimbursement
- No approval chain generated
- No reviewer assigned
- Status: `DRAFT`

### Submit Action

When a reimbursement is submitted:

1. **Generate approval tree** using ApprovalChainEngine
2. **Extract left-view chain** from the tree
3. **Store chain snapshot** in reimbursement document
4. **Set first manager** as current reviewer
5. **Status**: `DRAFT` → `SUBMITTED`

**CRITICAL**: The approval chain is **never regenerated** after submission. The manager hierarchy may change later, but the reimbursement always uses the stored snapshot from submission time.

---

## Current Reviewer Logic

The system tracks who can act on a reimbursement:

```json
{
  "current_reviewer_id": "USER123",
  "current_step": 0
}
```

- Only the current reviewer can perform actions (approve, query, reject)
- All other users have read-only access
- When a reviewer approves, the system moves to the next step

---

## Reviewer Actions

Supported actions at each approval step:

- **PENDING**: Initial state, waiting for reviewer action
- **VIEWED**: Reviewer has viewed the reimbursement
- **QUERY**: Reviewer raised a public question to initiator
- **ASK**: Reviewer raised a private question (visible only to initiator and owner)
- **APPROVED**: Reviewer approved and passed to next step
- **REJECTED**: Reviewer rejected (terminal state)

---

## Received Date Logic

**Definition**: The first time the current reviewer opens/views the reimbursement AFTER it became assigned to them.

**Example**:

```
Submitted: 2026-06-13 12:00:01 PM
Reviewer opens: 2026-06-13 03:00:00 PM
Received Date: 2026-06-13 03:00:00 PM
```

**Important**:
- If reviewer visited the page BEFORE being assigned, it does NOT count
- Received date is set only on the first view AFTER assignment
- Used to calculate SLA compliance and remaining days

---

## Response Date Logic

**Definition**: The datetime when a reviewer performs an action (APPROVE, REJECT, or QUERY).

**Example**:
```json
{
  "response_date": "2026-06-14T09:15:00Z"
}
```

**Actions that set response_date**:
- APPROVE
- REJECT
- QUERY
- ASK

---

## Remaining Days Calculation

The system calculates remaining days for the current reviewer using the environment variable:

```env
REIMBURSEMENT_REVIEW_DAYS=3
```

**Formula**:
```
deadline = received_date + REIMBURSEMENT_REVIEW_DAYS
remaining_days = (deadline - current_date).days
```

**Display Logic**:
- **Negative days**: Overdue (shown in red)
- **0 days**: Due today (shown in orange)
- **1 day**: Urgent (shown in yellow)
- **2+ days**: Normal (shown in green)

---

## Approval Chain UI Data

The backend API returns enriched chain data:

**Endpoint**: `GET /api/reimbursements/{id}/chain`

**Response**:
```json
{
  "current_reviewer_id": "user123",
  "current_step": 1,
  "approval_chain": [
    {
      "level": 1,
      "user_id": "mgr456",
      "name": "John Manager",
      "email": "john@company.com",
      "role": "manager",
      "priority": 1,
      "approval_type": "mandatory",
      "status": "APPROVED",
      "action": "APPROVED",
      "received_date": "2026-06-13T15:00:00Z",
      "response_date": "2026-06-14T09:15:00Z",
      "remaining_days": null
    },
    {
      "level": 2,
      "user_id": "owner789",
      "name": "Sarah Owner",
      "email": "sarah@company.com",
      "role": "owner",
      "priority": 2,
      "approval_type": "mandatory",
      "status": "PENDING",
      "action": null,
      "received_date": "2026-06-14T10:00:00Z",
      "response_date": null,
      "remaining_days": 2
    }
  ],
  "logs": [...]
}
```

---

## Frontend Rendering

The frontend displays the approval chain as a vertical flow:

```
📝 Initiator
    |
👤 Manager (Level 1)
    ✓ Approved on Jun 14
    |
👔 Owner (Level 2)
    ⏳ 2 days remaining
    |
💰 Accountant (Level 3)
    ⏸️ Pending
```

**Visual Indicators**:
- ✓ Green checkmark: Approved
- ⏳ Yellow/Green: Days remaining
- ⚠️ Red: Overdue
- ⏸️ Gray: Pending

Current reviewer is highlighted with a yellow border.

---

## Technical Architecture

### Core Components

#### 1. ApprovalChainEngine

**File**: `sourcecode/controllers/ApprovalChainEngine.py`

Production-ready engine with:
- **Tree Generation**: Builds complete approval hierarchy
- **Left-View Extraction**: Extracts approval chain from tree
- **Cycle Detection**: Prevents circular manager relationships
- **Duplicate Prevention**: Ensures each reviewer appears once
- **Owner/Accountant Enforcement**: Guarantees Owner → Accountant rule

**Usage**:
```python
from controllers.ApprovalChainEngine import build_approval_chain_for_reimbursement

tree, chain = build_approval_chain_for_reimbursement(initiator_id)
```

#### 2. Schemas

**File**: `sourcecode/schemas/approval_chain_schemas.py`

Pydantic models for type safety:
- `ApprovalChainNodeSchema`: Single reviewer in chain
- `ApprovalChainResponseSchema`: Full API response
- `ReviewerActionSchema`: Action tracking
- `ApprovalTreeSchema`: Complete tree structure

#### 3. API Endpoints

**Submit Endpoint**: `POST /api/reimbursements/{id}/submit`
- Generates approval chain on submission
- Stores chain snapshot in reimbursement document
- Sets first reviewer as current

**Chain Endpoint**: `GET /api/reimbursements/{id}/chain`
- Returns approval chain with enriched data
- Calculates received/response dates from logs
- Computes remaining days for current reviewer

---

## Database Schema

### Reimbursement Document

```javascript
{
  "_id": ObjectId("..."),
  "reimbursement_code": "RB-2026-000123",
  "initiator_id": "user123",
  "status": "IN_REVIEW",

  // Approval chain snapshot (frozen at submission)
  "approval_chain": [
    {
      "level": 1,
      "user_id": "mgr456",
      "name": "John Manager",
      "email": "john@company.com",
      "role": "manager",
      "priority": 1,
      "approval_type": "mandatory",
      "status": "APPROVED"
    },
    {
      "level": 2,
      "user_id": "owner789",
      "name": "Sarah Owner",
      "email": "sarah@company.com",
      "role": "owner",
      "priority": 2,
      "approval_type": "mandatory",
      "status": "PENDING"
    }
  ],

  // Current reviewer tracking
  "current_step": 1,
  "current_reviewer_id": "owner789",

  // Full approval tree (optional, for reference)
  "approval_tree": {
    "initiator_id": "user123",
    "initiator_name": "Bob Employee",
    "branches": [...]
  }
}
```

---

## Configuration

### Environment Variables

```env
# Number of business days for review SLA
REIMBURSEMENT_REVIEW_DAYS=3

# Alternative name (same purpose)
SLA_APPROVAL_DAYS=3
```

---

## Examples

### Example 1: Simple Chain

**Hierarchy**:
```
Employee (Bob)
  └─ Manager (John, priority=1)
      └─ Owner (Sarah)
```

**Generated Chain**:
```
Level 1: John (Manager)
Level 2: Sarah (Owner)
Level 3: Alice (Accountant)
```

### Example 2: Multiple Managers

**Hierarchy**:
```
Employee (Bob)
  ├─ Manager A (priority=2)
  └─ Manager B (priority=1)
      └─ Senior Manager (priority=1)
          └─ Owner
```

**Generated Chain** (left-view):
```
Level 1: Manager B (priority 1 selected)
Level 2: Senior Manager
Level 3: Owner
Level 4: Accountant
```

### Example 3: Owner as Initiator

**Hierarchy**:
```
Owner (Sarah) - no managers
```

**Generated Chain**:
```
Level 1: Accountant
```

Owner's reimbursements skip manager review and go directly to Accountant.

---

## Error Handling

### Cycle Detection

**Input**:
```
A → B → C → A
```

**Output**:
```
ValueError: Cycle detected in approval chain: A -> B -> C -> A
```

### Missing Managers

If an employee has no configured managers and is not an Owner:
- System automatically assigns the Owner as their manager
- Ensures every reimbursement has a valid approval path

---

## Best Practices

1. **Never modify approval chain** after submission
2. **Always use stored snapshot** for chain rendering
3. **Track view logs** to calculate received dates accurately
4. **Validate manager hierarchies** before deployment
5. **Monitor SLA compliance** using remaining days
6. **Handle edge cases**: Owner as initiator, no managers, etc.

---

## Troubleshooting

### Chain not generating

**Check**:
1. Employee has at least one manager configured
2. Manager users exist and are active
3. Owner user exists and is active
4. Accountant user exists and is active

### Incorrect chain order

**Check**:
1. Manager priority values (lower = higher priority)
2. Manager hierarchy is correctly configured
3. No circular references in manager relationships

### Remaining days not showing

**Check**:
1. Current reviewer has viewed the reimbursement
2. View log was created after reviewer assignment
3. `REIMBURSEMENT_REVIEW_DAYS` is configured in `.env`

---

## API Reference

### Build Approval Chain

```python
def build_approval_chain_for_reimbursement(initiator_id: str) -> Tuple[Dict, List[Dict]]:
    """
    Build approval chain for a reimbursement submission.

    Args:
        initiator_id: User ID of the initiator

    Returns:
        Tuple of (full_tree, left_view_chain)

    Raises:
        ValueError: If cycle detected or invalid hierarchy
    """
```

### Get Approval Chain

```
GET /api/reimbursements/{reimbursement_id}/chain

Response:
{
  "current_reviewer_id": string,
  "current_step": number,
  "approval_chain": ApprovalChainNode[],
  "logs": ActivityLog[]
}
```

---

## Summary

The Reimbursement Approval Chain system provides:

✅ **Automated chain generation** based on employee-manager hierarchy
✅ **Complete tree structure** with left-view chain extraction
✅ **Cycle detection** and duplicate prevention
✅ **Owner → Accountant enforcement**
✅ **Frozen snapshot** that never changes after submission
✅ **SLA tracking** with received/response dates
✅ **Remaining days calculation** for current reviewer
✅ **Production-ready** with comprehensive error handling

This ensures every reimbursement follows a consistent, auditable approval workflow.

