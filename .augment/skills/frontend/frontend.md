---
name: frontend.md
description: This skill defines frontend development rules for the **real dashboard app** - a React + Vite + TypeScript application with Tailwind CSS styling.
---

# frontend.md

---

## Core Frontend Architecture

### Tech Stack
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM v7
- **State Management:** React Hook Form, custom hooks (useAuth, useFeature)
- **HTTP Client:** Axios
- **Validation:** Zod
- **UI Components:** shadcn/ui (client/src/components/ui)
- **Icons:** Lucide React, React Icons
- **Notifications:** react-hot-toast, sonner

---

## Project Structure Rules

### File Organization
```
client/src/
├── components/          # Reusable components (UpperCamelCase.tsx)
│   ├── ui/             # shadcn/ui components (button, card, dialog, etc.)
│   ├── figma/          # Figma-integrated components
│   ├── Dashboard/      # Dashboard-specific components
│   ├── WODetails/      # Work Order detail components
│   └── [Feature]/      # Feature-specific component folders
├── pages/              # Page components (UpperCamelCase.tsx)
├── types/              # TypeScript definitions (camelCase.ts)
├── utils/              # API calls and utilities (<Feature>Api.ts)
├── hooks/              # Custom React hooks (useAuth.tsx, useFeature.ts)
├── data/               # Static data and constants
└── context/            # React context providers
```

### Naming Conventions
- **Components & Pages:** `UpperCamelCase.tsx` (e.g., `ProductionDashboard.tsx`, `AppHeader.tsx`)
- **API Files:** `<Feature>Api.ts` (e.g., `soFormApi.ts`, `productiondashboardApi.ts`)
- **Utilities:** `camelCase.ts` (e.g., `dateTimeUtils.ts`, `validation.ts`)
- **Types:** `camelCase.ts` or `kebab-case.ts` (e.g., `auth.ts`, `pdi-types.ts`)
- **Hooks:** `use<Name>.tsx` or `use<Name>.ts` (e.g., `useAuth.tsx`, `useFeature.ts`)

---

## UI Design Consistency Rules

### 1. Page Layout Structure
**EVERY page MUST follow this structure:**

```tsx
import { AppHeader } from "../components/AppHeader";
import Footer from "../components/Footer";

export default function YourPage() {
  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        {/* Page content */}
      </main>
      <Footer />
    </>
  );
}
```

**Rules:**
- ✅ **ALWAYS** include `<AppHeader />` at the top
- ✅ **ALWAYS** include `<Footer />` at the bottom
- ✅ Use `min-h-screen` on main content container
- ✅ Use `bg-gray-50` for consistent background color
- ✅ Use consistent padding: `py-6 px-4`
- ❌ **NEVER** alter existing component placement when adding new features
- ❌ **NEVER** remove or modify AppHeader/Footer without explicit permission

### 2. UI Components (shadcn/ui)
**Use existing shadcn/ui components from `client/src/components/ui/`:**

Available components:
- `button`, `input`, `label`, `textarea`
- `card`, `badge`, `alert`
- `dialog`, `sheet`, `drawer`
- `select`, `dropdown-menu`, `popover`
- `table`, `pagination`
- `tabs`, `accordion`, `collapsible`
- `calendar`, `checkbox`, `switch`
- `toast`, `sonner` (notifications)

**Rules:**
- ✅ **ALWAYS** import from `"../components/ui/<component>"`
- ✅ Use `<Card>` for content sections
- ✅ Use `<Button>` with variants: `default`, `outline`, `destructive`, `ghost`
- ✅ Use `<Badge>` for status indicators
- ✅ Use `<Dialog>` for modals
- ✅ Use Tailwind classes for custom styling
- ❌ **NEVER** create custom button/input components - use existing UI library

### 3. Styling Standards

**Color Scheme:**
```tsx
// Background colors
bg-gray-50      // Page background
bg-white        // Card/panel background
bg-amber-50     // Input field background

// Border colors (consistent across all forms)
border-gray-400 // Default/empty fields
border-blue-500 // Filled fields
border-green-500 // Valid/success state
border-red-500  // Error/invalid state

// Text colors
text-gray-900   // Primary text
text-gray-600   // Secondary text
text-gray-500   // Disabled text
```

**Responsive Design:**
- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Mobile-first approach
- Test on mobile, tablet, and desktop

### 4. Component Reusability
**BEFORE creating a new component, check if it already exists:**

Common reusable components:
- `DateInputUS.tsx` - Date picker (MM/DD/YYYY format, calendar icon)
- `FlexibleSignatureInput.tsx` - Signature capture
- `UserDropdown.tsx` - User selection dropdown
- `FileUploadWithPreview.tsx` - File upload with preview
- `AttachmentManager.tsx` - Document attachment management
- `ValidationBanner.tsx` - Validation message display
- `DuplicateSubmissionPopup.tsx` - Duplicate detection

**Rules:**
- ✅ Import and use existing components
- ✅ Extend existing components via props
- ❌ **NEVER** duplicate existing functionality

---


## Tooltip / Information Rules

- Every important component, input field, workflow section, table header, approval action, status badge, and analytics card MUST contain an Information Icon (`i` icon).
- On hover of the Information Icon:
  - Show contextual tooltip/help text.
  - Tooltip text should explain:
    - purpose of the component
    - workflow meaning
    - expected user action
    - limitations/rules if applicable
- Tooltips should be concise and readable.
- Tooltip component must be reusable globally.

### Examples
- Reimbursement Status → Explain current reimbursement stage.
- Query Button → Explain what happens after query.
- Ask Button → Explain private communication behavior.
- Category Limit → Explain reimbursement limit policy.

---

## Clickable Elements

All clickable/interactable elements MUST use:

```css
cursor-pointer
```

### Includes
- Buttons
- Links
- Cards with onClick
- Table rows with expand/click
- Tabs
- Menu items
- Action icons
- Timeline items
- Approval cards
- Notifications
- Accordion headers
- File upload areas
- Pagination controls

---

## Text Elements

Text-selectable/editable content MUST use:

```css
cursor-text
```

### Includes
- Input fields
- Textareas
- Editable descriptions
- Comments
- Query messages
- Ask messages
- Notes
- Search bars

---

## Default Elements

Non-clickable/non-editable elements MUST use:

```css
cursor-default
```

---

# Accessibility Rules

- Never use clickable UI without `cursor-pointer`.
- Never use `cursor-pointer` on non-clickable elements.
- Tooltip must work on:
  - hover
  - keyboard focus
- Disabled buttons must visually appear disabled.
- Icons with actions must always have tooltip labels.
- Hover interactions must remain smooth and lightweight.

---

# Tailwind CSS Rules

## Mandatory Utility Classes

### Clickable
```tsx
className="cursor-pointer"
```

### Editable Text
```tsx
className="cursor-text"
```

### Default
```tsx
className="cursor-default"
```

### Disabled
```tsx
className="cursor-not-allowed opacity-50"
```

---

# shadcn/ui Rules

## Tooltip Component

Use centralized shadcn/ui tooltip component.

### Recommended Components
```tsx
Tooltip
TooltipTrigger
TooltipContent
```

---

# Information Icon Rules

Use consistent info icon throughout application.

## Recommended Icons
```tsx
Info
CircleHelp
```

from:
```tsx
lucide-react
```

---

# Shared Reusable Components

The application MUST contain reusable UI wrappers:

## Components
```text
InfoTooltip
PageSectionHeader
HoverCard
ActionButton
StatusBadge
TimelineCard
EmptyState
LoadingSkeleton
```

---

# Hover Interaction Rules

## Interactive Elements

Interactive elements MUST have:
- hover border
- hover background
- transition animation
- cursor-pointer

### Recommended Tailwind
```tsx
hover:bg-muted/50 transition-colors duration-200
```

---

# Card Interaction Rules

All expandable/clickable cards MUST:
- visually indicate hover state
- show pointer cursor
- support keyboard accessibility

---

# Table Rules

Clickable table rows MUST:
- use hover background
- use cursor-pointer
- clearly indicate selected row

### Example
```tsx
className="cursor-pointer hover:bg-muted/40"
```

---

# Workflow UX Rules

This application is workflow-heavy.

Therefore users must always understand:
- what is clickable
- what is editable
- current reimbursement status
- pending reviewer
- next workflow step
- why reimbursement was queried/rejected

The UI should minimize confusion during reimbursement approvals.

---

# Animation Rules

Use subtle animations only.

## Allowed
- fade
- hover transition
- accordion animation
- modal animation

## Avoid
- heavy motion
- distracting effects
- long transitions

---

# Mobile Responsiveness Rules

The UI MUST support:
- desktop
- tablet
- mobile responsive layouts

## Required
- responsive tables
- collapsible sections
- scroll-safe modals
- adaptive forms

---

# Theme Rules

Use consistent design tokens.

## Tailwind Standards
- rounded-lg
- rounded-xl
- shadow-sm
- border-muted
- bg-background
- text-muted-foreground

Avoid inconsistent spacing/colors.

---

# Backedn and Database

## Database Integration Rules

### Middleware Pattern for API Calls
**ALWAYS use middleware pattern when connecting to database:**

```tsx
// In utils/<feature>Api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const fetchData = async (params: any) => {
  try {
    // Get auth token from storage
    const token = localStorage.getItem('auth_token');

    const response = await axios.get(
      `${API_BASE_URL}/api/<endpoint>`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      }
    );

    return response.data;
  } catch (error) {
    // Error handling (see below)
    throw error;
  }
};
```

**Rules:**
- ✅ Create dedicated `<feature>Api.ts` file in `client/src/utils/`
- ✅ **ALWAYS** include JWT token in Authorization header
- ✅ Use environment variable for API base URL
- ✅ Handle errors gracefully (see error handling section)
- ❌ **NEVER** make direct database calls from components
- ❌ **NEVER** hardcode API URLs

---

## Error Handling Standards

### Error Types and Display Methods

**1. Unhandled Exceptions → Error Card Component**
```tsx
// Create ErrorCard.tsx if it doesn't exist
import { AlertTriangle } from "lucide-react";
import { Card } from "./ui/card";

export function ErrorCard({ error }: { error: Error }) {
  return (
    <Card className="border-red-500 bg-red-50 p-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-red-600" />
        <div>
          <h3 className="font-semibold text-red-900">An error occurred</h3>
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      </div>
    </Card>
  );
}
```

**Rules:**
- ❌ **NEVER** use toast for unhandled exceptions
- ✅ Display error in dedicated error card component
- ✅ Show user-friendly message (no technical jargon/stack traces)

**2. Expected Errors → Toast Notifications**
```tsx
import { toast } from "sonner"; // or react-hot-toast

// Success
toast.success("Operation completed successfully");

// Error (expected/anticipated)
toast.error("Invalid input. Please check your data.");

// Warning
toast.warning("This action cannot be undone");

// Info
toast.info("Please wait while we process your request");
```

**Rules:**
- ✅ Use toast for expected errors (validation, business logic)
- ✅ Keep messages concise and actionable
- ✅ Avoid technical terms in user-facing messages

### Error Handling in API Calls
```tsx
try {
  const data = await fetchSomething();
  toast.success("Data loaded successfully");
} catch (error: any) {
  // Expected API errors
  if (error.response?.status === 400) {
    toast.error(error.response.data.detail || "Invalid request");
  } else if (error.response?.status === 404) {
    toast.error("Resource not found");
  } else {
    // Unhandled exception - show error card
    setError(error);
  }
}
```

---

## Form Validation Standards

### Field-Level Validation
```tsx
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type FormData = z.infer<typeof formSchema>;

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormData) => {
    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register("email")}
        error={errors.email?.message}
        label="Email"
      />
    </form>
  );
}
```

**Rules:**
- ✅ Use Zod for schema validation
- ✅ Use React Hook Form for form state
- ✅ Display validation errors inline
- ✅ Show which fields are required before submission

---

## Authentication & Authorization

### Using useAuth Hook
```tsx
import { useAuth } from "../hooks/useAuth";

function ProtectedComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <p>Welcome, {user?.full_name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Rules:**
- ✅ Use `useAuth()` hook for authentication state
- ✅ Check `isAuthenticated` before rendering protected content
- ✅ Store JWT token in localStorage
- ✅ Include token in all API requests

---

## State Management

### Local State (useState)
```tsx
const [loading, setLoading] = useState(false);
const [data, setData] = useState<DataType | null>(null);
```

### Form State (React Hook Form)
```tsx
const { register, handleSubmit, watch, setValue } = useForm();
```

### Global State (Context)
```tsx
import { useFeature } from "../hooks/useFeature";
import { useAuth } from "../hooks/useAuth";
```

**Rules:**
- ✅ Use `useState` for local component state
- ✅ Use React Hook Form for forms
- ✅ Use Context for global state (auth, features, departments)
- ❌ **NEVER** use Redux (not part of this project)

---

## TypeScript Standards

### Type Definitions
```tsx
// In client/src/types/<feature>.ts
export interface UserData {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  department: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
```

**Rules:**
- ✅ Define types in `client/src/types/` directory
- ✅ Use `interface` for object shapes
- ✅ Use `type` for unions, intersections, or complex types
- ✅ Export all types/interfaces
- ❌ **NEVER** use `any` - use `unknown` if type is truly unknown

---

## Code Quality & Best Practices

### Before Committing
- [ ] Remove unused imports, variables, functions
- [ ] Run `npm run build` successfully (no TypeScript errors)
- [ ] Test on multiple screen sizes
- [ ] Verify error handling for edge cases
- [ ] Check that AppHeader/Footer are present
- [ ] Ensure consistent styling with existing pages

### Performance
- ✅ Use `useMemo` for expensive calculations
- ✅ Use `useCallback` for event handlers passed as props
- ✅ Lazy load heavy components with `React.lazy()`
- ✅ Optimize images and assets

### Accessibility
- ✅ Use semantic HTML elements
- ✅ Include `alt` text for images
- ✅ Ensure keyboard navigation works
- ✅ Use ARIA labels where needed

---

## Common Patterns

### Loading States
```tsx
{loading ? (
  <div className="flex justify-center items-center py-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
) : (
  <div>{/* Content */}</div>
)}
```

### Empty States
```tsx
{data.length === 0 ? (
  <div className="text-center py-12 text-gray-500">
    <p>No data available</p>
  </div>
) : (
  <div>{/* Data list */}</div>
)}
```

### Modal Dialogs
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

---

## Summary Checklist

When creating or modifying frontend pages:

✅ **DO:**
- Include AppHeader and Footer on all pages
- Use existing shadcn/ui components
- Follow naming conventions (UpperCamelCase for components)
- Create dedicated API files in utils/
- Handle errors with toast (expected) or error card (unhandled)
- Use middleware pattern for database calls
- Define TypeScript types
- Test responsive design
- Remove unused code before committing

❌ **DON'T:**
- Alter existing component placement without permission
- Create duplicate components
- Make direct database calls from components
- Use toast for unhandled exceptions
- Hardcode API URLs or configuration
- Use `any` type in TypeScript
- Skip validation or error handling

---

**Last Updated:** May 2026
**Framework:** React 19 + Vite + TypeScript + Tailwind CSS
