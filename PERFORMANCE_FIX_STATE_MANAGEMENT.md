# Performance Fix: State Management & PDF Re-rendering Issue ✅

**Date**: 2026-06-16  
**Issue**: PDF viewer and API calls triggered on every state change (typing, dropdown selection)  
**Status**: FIXED

---

## 🐛 **Problem Description**

### Symptoms
- Every time user types in input fields (description, amount, etc.)
- Every time user selects from dropdown (category, payment method, etc.)
- **PDF viewer re-renders** and **API calls execute**

### Root Cause
The `useEffect` in `NewReimbursementPage.tsx` was tracking the **entire row objects** (`lsRows`, `lsMatrixRows`) as dependencies:

```typescript
useEffect(() => {
  if (bShowMatrix) {
    preview.rebuildFromIds(matrixAllAttachmentIds(lsMatrixRows));
  } else {
    const lsIds: string[] = [];
    for (const r of lsRows) for (const id of r.attachments) lsIds.push(id);
    preview.rebuildFromIds(lsIds);
  }
}, [bShowMatrix, lsRows, lsMatrixRows]);  // ❌ Triggers on ANY row property change!
```

**Why this caused issues**:
1. User types "100" → `lsRows` array updates → useEffect triggers
2. `preview.rebuildFromIds()` called → `lsAllAttachments` state updates
3. `lsAllAttachments` change triggers API useEffect in `useInvoicePreview.ts`
4. API calls: `scanAttachmentApi()` → `getAttachmentMetaApi()` → `fetchAttachmentBlobApi()`
5. PDF re-renders unnecessarily

---

## ✅ **Solution Applied**

### Strategy
1. **Memoize attachment IDs** - Only recompute when actual attachment IDs change
2. **Optimize state comparison** - Prevent unnecessary state updates in `rebuildFromIds()`
3. **Track only attachments** - Ignore changes to other row properties

---

## 🔧 **Changes Made**

### 1. **Add useMemo Hook** (NewReimbursementPage.tsx)

**File**: `client/src/pages/NewReimbursementPage.tsx`  
**Lines**: 17, 249-268

**Change 1**: Import `useMemo`
```typescript
// Before
import { useEffect, useState } from 'react';

// After
import { useEffect, useState, useMemo } from 'react';
```

**Change 2**: Memoize attachment ID extraction
```typescript
// ── Memoize attachment IDs to prevent unnecessary API calls ──
// Only recompute when actual attachment IDs change, not when other row properties change
const lsCurrentAttachmentIds = useMemo(() => {
  if (bShowMatrix) {
    return matrixAllAttachmentIds(lsMatrixRows);
  } else {
    const lsIds: string[] = [];
    for (const r of lsRows) {
      for (const id of r.attachments) {
        lsIds.push(id);
      }
    }
    return lsIds;
  }
}, [
  bShowMatrix,
  // Only track attachment changes for general expenses
  bShowMatrix ? lsMatrixRows : lsRows.map(r => r.attachments.join(',')).join('|')
]);

// ── Keep preview's attachment list in sync with active dataset ──
useEffect(() => {
  preview.rebuildFromIds(lsCurrentAttachmentIds);
}, [lsCurrentAttachmentIds]);
```

**Key Improvements**:
- ✅ `useMemo` only recomputes when attachment IDs actually change
- ✅ For general expenses: tracks `lsRows.map(r => r.attachments.join(','))` instead of entire `lsRows`
- ✅ For business trips: still tracks `lsMatrixRows` (matrix attachments are complex)
- ✅ Changing amount, category, description won't trigger recomputation

---

### 2. **Optimize rebuildFromIds()** (useInvoicePreview.ts)

**File**: `client/src/components/Reimbursement/shared/useInvoicePreview.ts`  
**Lines**: 23-40

```typescript
// Rebuild unique attachment list from any source (rows / matrix cells).
const rebuildFromIds = (lsIds: string[]) => {
  const lsUnique: string[] = [];
  for (const strId of lsIds) {
    if (strId && !lsUnique.includes(strId)) lsUnique.push(strId);
  }
  
  // ✅ Only update state if the attachment list actually changed
  setLsAllAttachments(prev => {
    if (prev.length !== lsUnique.length) return lsUnique;
    if (prev.every((id, idx) => id === lsUnique[idx])) return prev;
    return lsUnique;  // Return same reference if content is identical
  });
  
  if (lsUnique.length > 0 && iPreviewIdx >= lsUnique.length) {
    setIPreviewIdx(lsUnique.length - 1);
  }
};
```

**Key Improvements**:
- ✅ Compares new attachment list with previous before updating state
- ✅ Returns previous reference if content is identical (prevents re-render)
- ✅ Only triggers downstream useEffect if attachments truly changed

---

## 📊 **Performance Impact**

### Before Fix
```
User types "1" → lsRows updates → rebuildFromIds() → API call
User types "0" → lsRows updates → rebuildFromIds() → API call
User types "0" → lsRows updates → rebuildFromIds() → API call
Total: 3 unnecessary API calls for typing "100"
```

### After Fix
```
User types "1" → lsRows updates → useMemo: attachments unchanged → No API call ✅
User types "0" → lsRows updates → useMemo: attachments unchanged → No API call ✅
User types "0" → lsRows updates → useMemo: attachments unchanged → No API call ✅
User uploads file → lsRows updates → useMemo: attachments changed → API call ✅
Total: Only 1 API call when attachment actually added
```

---

## 🎯 **Benefits**

1. ✅ **No more unnecessary API calls** - Only triggers when attachments change
2. ✅ **No more PDF re-renders** - PDF stable unless attachment list changes
3. ✅ **Smooth typing experience** - Input fields don't lag
4. ✅ **Faster dropdown selection** - Category/payment method selection instant
5. ✅ **Better UX** - No loading spinners during normal data entry
6. ✅ **Lower server load** - Eliminates redundant virus scans and blob fetches

---

## 🧪 **Testing**

Test these scenarios to verify the fix:

- [x] Type in amount field → No PDF flicker
- [x] Type in description → No API calls
- [x] Select category from dropdown → No PDF reload
- [x] Select payment method → No re-render
- [x] Upload new attachment → PDF loads correctly ✅
- [x] Remove attachment → PDF updates correctly ✅
- [x] Navigate between attachments → Preview works ✅

---

## 📁 **Files Modified**

1. **`client/src/pages/NewReimbursementPage.tsx`**
   - Line 17: Added `useMemo` import
   - Lines 249-268: Memoized attachment ID extraction with optimized dependencies

2. **`client/src/components/Reimbursement/shared/useInvoicePreview.ts`**
   - Lines 23-40: Added state comparison in `rebuildFromIds()` to prevent unnecessary updates

---

## 🔑 **Key Concepts Used**

1. **React.useMemo** - Memoize computed values based on specific dependencies
2. **Dependency Optimization** - Track only what matters (attachments, not all row data)
3. **State Comparison** - Prevent state updates when new value equals old value
4. **Reference Equality** - Return same reference to prevent downstream re-renders

---

**Status**: PRODUCTION READY 🚀  
**No more performance issues with state updates!**
