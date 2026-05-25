# UI Schema & Design Guidelines

This document outlines the design system, color schemas, and component patterns extracted from the Production Dashboard, Admin Settings, and Manage Users (Profile) pages. Future projects and pages should strictly follow these guidelines to maintain visual consistency across the application.

## 1. Global Color Theme & Layout

### Backgrounds
- **Main Page Background:** `bg-gray-50`
- **Card / Panel Background:** `bg-white`
- **Borders:** `border-gray-200` or `border-gray-300` for inputs.

### Typography
- **Primary Text:** `text-gray-900`
- **Secondary Text / Descriptions:** `text-gray-600` or `text-gray-500`
- **Font Families:**
  - Primarily standard sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`)
  - Some specific dashboards use `font-family: 'Calibri, sans-serif'`.

### Primary Brand Actions
- **Primary Buttons (e.g., Save, Add, Create):**
  - Background: `bg-[#00703C]` (Deep Green)
  - Hover: `hover:bg-[#005a30]`
  - Text: `text-white`
- **Secondary/Outline Buttons:**
  - Background: `bg-white`
  - Hover: `hover:bg-[#F7F7F7]` or `hover:bg-gray-50`
  - Text: `text-[#4A4A4A]` or `text-gray-700`
  - Border: `border-gray-300`

---

## 2. Status & Contextual Colors

These colors are specifically used for badges, buttons, and alert notifications depending on the context.

### Success / Active
- **Buttons:** `bg-green-600 hover:bg-green-700 text-white`
- **Badges/Banners:** `bg-green-50 text-green-700 border-green-200`
- **Icons:** `text-green-600` inside `bg-green-100` rounded containers.

### Error / Danger / Delete
- **Buttons:** `bg-red-600 hover:bg-red-700 text-white`
- **Badges/Banners:** `bg-red-50 text-red-700 border-red-200`
- **Icons:** `text-red-600` inside `bg-red-100` rounded containers.

### Warning / Inactive / Pending
- **Buttons:** `bg-orange-600 hover:bg-orange-700 text-white`
- **Badges/Banners:** `bg-orange-50 text-orange-700 border-orange-200` or `bg-yellow-50 text-yellow-800 border-yellow-200`

### Informational / Note
- **Badges/Banners:** `bg-blue-50 text-blue-700 border-blue-200`
- **Icons:** `text-blue-600` inside `bg-blue-100` rounded containers.

---

## 3. Notifications & Alert Banners

### Error Banner
```tsx
<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
  <div className="flex items-center gap-3">
    <AlertTriangle className="w-5 h-5 text-red-600" />
    <div>
      <h3 className="font-semibold text-red-900">Error Title</h3>
      <p className="text-sm text-red-800">Error description here.</p>
    </div>
  </div>
</div>
```

### Info / Note Banner
```tsx
<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
  <div className="flex items-center gap-2">
    <Info className="h-5 w-5 text-blue-400" />
    <p className="text-sm text-blue-800">
      <strong>Note:</strong> Informational text here.
    </p>
  </div>
</div>
```

### Warning Banner
```tsx
<div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
  <div className="flex items-center gap-3">
    <AlertTriangle className="w-6 h-6 text-yellow-600" />
    <div>
      <h3 className="font-semibold text-yellow-900">Warning Title</h3>
      <p className="text-sm text-yellow-700">Warning description here.</p>
    </div>
  </div>
</div>
```

---

## 4. Modals & Dialogs

- **Backdrop:** `fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50`
- **Modal Container:** `relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white`
- **Header:** `flex items-center justify-between mb-4`
- **Title:** `text-lg font-semibold text-gray-900`
- **Footer/Actions:** `flex justify-end space-x-3 pt-4 border-t border-gray-200` (optional top border)

---

## 5. Collapsible Components

### Container
```tsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
```

### Trigger / Header
```tsx
<button className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100">
  <div className="flex items-center gap-3">
    <div className="w-1 h-8 rounded-full bg-blue-500 flex-shrink-0" />
    <h3 className="text-sm lg:text-base font-semibold text-gray-900">Section Title</h3>
  </div>
  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "transform rotate-180" : ""}`} />
</button>
```

### Content Container
```tsx
<div className={`px-4 py-4 ${!isOpen ? 'hidden' : ''}`}>
  {/* Expandable content goes here */}
</div>
```

---

## 6. Input Fields & Forms

- **Base Class:** `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent`
- **Normal Border:** `border-gray-300 bg-white`
- **Error State Border:** `border-red-500`
- **Read-Only / Disabled:** `bg-gray-50 text-gray-500 cursor-not-allowed`

### Labels
```tsx
<label className="block text-sm font-medium text-gray-700 mb-1">
  Field Name <span className="text-red-500">*</span>
</label>
```

---

## 7. Data Tables / Lists

- **Container:** `bg-white rounded-lg shadow overflow-hidden`
- **Table Header (`thead`):** `bg-gray-100 text-sm uppercase tracking-wide text-gray-500`
- **Header Cells (`th`):** `px-3 py-2 text-left font-semibold whitespace-nowrap`
- **Row (`tr`):** `hover:bg-gray-50 border-b border-gray-200`
- **Data Cells (`td`):** `px-3 py-2 whitespace-nowrap text-sm lg:text-base`
