# Approval Chain UI Data Specification

This document specifies the exact data structure and status tracking for displaying the approval chain in the UI.

## 📋 Approval Chain Step Schema

Each step in `approval_chain[]` contains:

```typescript
{
  level: number;              // Step index (0 = initiator, 1+ = managers)
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  priority: number;
  approval_type: string;
  
  // STATUS TRACKING FIELDS
  current_status: string;     // PENDING | IN_REVIEW | SUBMITTED | APPROVED | QUERY | ASK | REAPPLIED | PAID | REJECTED
  receivedAt?: string;        // ISO timestamp when user first viewed (after becoming current_reviewer)
  submittedAt?: string;       // ISO timestamp when user took action (APPROVE, QUERY, ASK, REAPPLY)
  bIsReApply?: boolean;       // Only for initiator (step 0), true if resubmitted after QUERY/ASK
  is_initiator?: boolean;     // True for step 0
}
```

---

## 🔄 Status Flow Examples

### **Case 1: Initial Submission**

**Database State:**
```javascript
approval_chain: [
  { level: 0, name: "John (Initiator)", current_status: "SUBMITTED", submittedAt: "2026-06-11T10:00:00Z", is_initiator: true },
  { level: 1, name: "Manager 1", current_status: "PENDING", receivedAt: null },
  { level: 2, name: "Manager 2", current_status: "PENDING", receivedAt: null },
  { level: 3, name: "Manager 3 (CA)", current_status: "PENDING", receivedAt: null }
]
current_step: 1
current_reviewer_id: "manager1_id"
```

**UI Display:**
```
✅ John (Initiator) - SUBMITTED
   Submitted At: Jun 11, 2026 10:00 AM
   |
⏳ Manager 1 - PENDING
   (Waiting for view)
   |
⏳ Manager 2 - PENDING
   |
⏳ Manager 3 (CA) - PENDING
```

---

### **Case 2: Manager 1 Opens Reimbursement**

**Database Update (ActivityLogService):**
```javascript
approval_chain[1].current_status = "IN_REVIEW"
approval_chain[1].receivedAt = "2026-06-11T11:00:00Z"
```

**UI Display:**
```
✅ John (Initiator) - SUBMITTED
   Submitted At: Jun 11, 2026 10:00 AM
   |
👁️ Manager 1 - IN REVIEW
   Received At: Jun 11, 2026 11:00 AM
   Due Date: Jun 14, 2026 11:00 AM (3 days from received)
   |
⏳ Manager 2 - PENDING
   |
⏳ Manager 3 (CA) - PENDING
```

---

### **Case 3: Manager 1 Raises QUERY**

**Database Update (ReimbursementStateMachine):**
```javascript
approval_chain[1].current_status = "QUERY"
approval_chain[1].submittedAt = "2026-06-11T12:00:00Z"
approval_chain[0].current_status = "PENDING"
approval_chain[0].receivedAt = null  // Cleared!
current_reviewer_id = "john_id"  // Initiator
status = "QUERY"
```

**UI Display:**
```
⏳ John (Initiator) - PENDING
   Submitted At: Jun 11, 2026 10:00 AM
   (Waiting to view query)
   |
❓ Manager 1 - QUERY
   Received At: Jun 11, 2026 11:00 AM
   Query Raised At: Jun 11, 2026 12:00 PM
   |
⏳ Manager 2 - PENDING
   |
⏳ Manager 3 (CA) - PENDING
```

---

### **Case 4: Initiator Opens After QUERY**

**Database Update (ActivityLogService):**
```javascript
approval_chain[0].current_status = "IN_REVIEW"
approval_chain[0].receivedAt = "2026-06-11T14:00:00Z"
```

**UI Display:**
```
👁️ John (Initiator) - IN REVIEW
   Submitted At: Jun 11, 2026 10:00 AM
   Received Query At: Jun 11, 2026 2:00 PM
   Due Date: Jun 12, 2026 2:00 PM (1 day for query response)
   |
❓ Manager 1 - QUERY
   Received At: Jun 11, 2026 11:00 AM
   Query Raised At: Jun 11, 2026 12:00 PM
   |
⏳ Manager 2 - PENDING
   |
⏳ Manager 3 (CA) - PENDING
```

---

### **Case 5: Initiator Reapplies**

**Database Update (ReimbursementStateMachine):**
```javascript
approval_chain[0].bIsReApply = true
approval_chain[0].current_status = "REAPPLIED"
approval_chain[0].submittedAt = "2026-06-11T15:00:00Z"
approval_chain[1].current_status = "PENDING"
approval_chain[1].receivedAt = null  // Cleared!
current_reviewer_id = "manager1_id"
status = "REAPPLIED"
```

**UI Display:**
```
🔄 John (Initiator) - REAPPLIED
   Submitted At: Jun 11, 2026 10:00 AM
   Received Query At: Jun 11, 2026 2:00 PM
   Reapplied At: Jun 11, 2026 3:00 PM
   |
⏳ Manager 1 - PENDING
   Query Raised At: Jun 11, 2026 12:00 PM
   (Waiting to re-review)
   |
⏳ Manager 2 - PENDING
   |
⏳ Manager 3 (CA) - PENDING
```

---

## 🎯 Key Status Tracking Rules

### **PENDING Status**
- User has **NOT** opened the reimbursement yet
- `receivedAt` is `null` or cleared
- UI shows: ⏳ "Waiting for review"

### **IN_REVIEW Status**
- User has **opened** the reimbursement but **NOT** taken action
- `receivedAt` is set
- UI shows: 👁️ "Received At" + "Due Date" (calculated from receivedAt + SLA days)

### **Action Statuses (SUBMITTED, APPROVED, QUERY, ASK, REAPPLIED, PAID, REJECTED)**
- User has **taken an action**
- `submittedAt` is set
- UI shows: ✅/❓/🔄 "Action At" timestamp

---

## 📊 UI Display Logic

```typescript
function getStepDisplay(step: ChainStep, currentReviewerId: string, status: string) {
  const isCurrent = step.user_id === currentReviewerId && status !== 'PAID' && status !== 'ACKNOWLEDGED' && status !== 'REJECTED';
  
  if (step.current_status === 'PENDING') {
    return {
      icon: '⏳',
      label: 'PENDING',
      color: 'yellow',
      showReceivedAt: false,
      showDueDate: false
    };
  }
  
  if (step.current_status === 'IN_REVIEW') {
    return {
      icon: '👁️',
      label: 'IN REVIEW',
      color: 'green',
      showReceivedAt: true,
      showDueDate: true,
      dueDate: calculateDueDate(step.receivedAt, SLA_DAYS)
    };
  }
  
  if (step.current_status === 'APPROVED') {
    return {
      icon: '✅',
      label: 'APPROVED',
      color: 'green',
      showSubmittedAt: true
    };
  }
  
  // ... other statuses
}
```

---

## 🔧 Backend Changes Summary

All changes are implemented in:
- ✅ `sourcecode/controllers/ReimbursementStateMachine.py`
- ✅ `sourcecode/controllers/ActivityLogService.py`
- ✅ `sourcecode/controllers/ApprovalChainService.py`

The UI can now reliably use the `approval_chain` array to display accurate status tracking! 🎉
