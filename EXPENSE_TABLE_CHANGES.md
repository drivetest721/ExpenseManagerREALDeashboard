# Expense Management Table Layout Changes

## Summary of Changes
The ExpenseManagementPage table layout has been restructured to show a **consolidated view** with one row per reimbursement instead of one row per item.

## Key Features

### 1. **Consolidated Row Display**
- **Sr No**: Serial number for each reimbursement (1, 2, 3, etc.)
- **Categories**: All unique categories from items combined and separated by comma
- **Sub Categories**: All unique sub-categories from items combined and separated by comma
- **Description**: Description from the **first item** of the reimbursement
- **Date Applied**: Date from the reimbursement (created_at)
- **Status**: Status badge (if applicable for the section)
- **Amount**: **Total amount** of all items in the reimbursement
- **Expand Button**: Chevron button to expand/collapse item details

### 2. **Expand/Collapse Functionality**
When a user clicks the expand button (ChevronDown/ChevronUp):
- **Expanded View** shows:
  - Individual items table with:
    - Item #
    - Category (individual)
    - Sub Category (individual)
    - Description (individual)
    - Expense Date
    - Amount (individual item amount)
  - Footer showing total of all items
  - "Open Full Details" button to navigate to detail page

### 3. **Applied to All 3 Sections**
The consolidated layout has been applied to:
- **Draft Section**: Shows draft reimbursements (no Status column)
- **Pending Section**: Shows pending reimbursements with status badges
- **History Section**: Shows completed reimbursements with Date of Payment column

The same layout applies to Team sections if the user has reviewer roles:
- **Pending My Approval**
- **Pending Completion**
- **Team History**

## Technical Implementation

### State Changes
Added tracking for expanded reimbursements:
```typescript
const [dictExpandedReimbursements, setDictExpandedReimbursements] = 
  useState<Record<string, boolean>>({});
```

### Component Structure
- Main table shows one row per reimbursement with summary data
- Each reimbursement is wrapped in a collapsible container
- Expanded detail view shows individual items in a nested table

### Sorting
- Sorting still works at the reimbursement level
- Can sort by: Applicant, Category, Sub Category, Description, Status, Date, Payment Date, Amount

## Benefits
1. **Cleaner Overview**: Users see one entry per reimbursement at a glance
2. **Less Clutter**: Eliminates row repetition when reimbursement has multiple items
3. **Quick Summary**: All item data consolidated in one row
4. **Details on Demand**: Users can expand to see individual items when needed
5. **Better Performance**: Fewer DOM elements when sections are expanded

## File Modified
- `client/src/pages/ExpenseManagementPage.tsx`
  - Imports: Added `ChevronLeft` icon
  - State: Added `dictExpandedReimbursements` state
  - Function: Completely rewrote `renderReimbTable()` function

## Testing Checklist
- [ ] Draft section shows consolidated rows
- [ ] Pending section shows consolidated rows with status
- [ ] History section shows consolidated rows with payment date
- [ ] Expand button toggles detail view
- [ ] Detail view shows all individual items correctly
- [ ] Sorting works on all columns
- [ ] Team sections display correctly (if user has reviewer role)
- [ ] "Open Full Details" button navigates to detail page
- [ ] Responsive design works on mobile/tablet
