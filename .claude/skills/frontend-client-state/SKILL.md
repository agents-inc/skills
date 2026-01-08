# Client State Management Patterns

> **Quick Guide:** Local UI state? useState. Shared UI (2+ components)? Zustand. Server data? React Query. URL-appropriate filters? searchParams. NEVER use Context for state management.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Managing Client State

**(You MUST use React Query for ALL server/API data - NEVER useState, Zustand, or Context)**

**(You MUST use Zustand for ALL shared UI state (2+ components) - NOT Context or prop drilling)**

**(You MUST use useState ONLY for truly component-local state - NOT for anything shared)**

**(You MUST use named exports ONLY - NO default exports in any state files)**

**(You MUST use named constants for ALL numbers - NO magic numbers in state code)**

</critical_requirements>

---

**Auto-detection:** Deciding between Zustand vs useState, global state management, Context misuse, client state patterns

**When to use:**

- Deciding between Zustand or useState for a use case
- Setting up Zustand for shared UI state (modals, sidebars, preferences)
- Understanding when NOT to use Context for state management
- Managing form state and validation patterns

**Key patterns covered:**

- Client state = useState (local) or Zustand (shared, 2+ components)
- Context for dependency injection only (NEVER for state management)
- URL params for shareable/bookmarkable state (filters, search)
- Form patterns with controlled components and Zod validation

**When NOT to use:**

- Server/API data (use React Query instead)
- State that should be shareable via URL (use searchParams)
- Any Context-based state management approach

---

<philosophy>

## Philosophy

React provides multiple tools for managing client state, but each has a specific purpose. The key principle: **use the right tool for the right job**. Server data belongs in React Query with caching and synchronization. Local UI state stays in useState. Shared UI state lives in Zustand for performance. URL state makes filters shareable. Context is ONLY for dependency injection, never state management.

The decision tree at the top of this skill guides you to the right solution based on your specific use case. Follow it strictly to avoid common pitfalls like using Context for state or putting server data in client state.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Server State vs Client State Decision

**STRICT SEPARATION REQUIRED**

The most critical decision: is this server data or client data?

#### Decision Tree

```
Is it server data (from API)?
├─ YES → React Query ✅
└─ NO → Is it URL-appropriate (filters, search)?
    ├─ YES → URL params (searchParams) ✅
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Zustand ✅
        └─ NO → Is it truly component-local?
            ├─ YES → useState ✅
            └─ NO → Is it a singleton/dependency?
                └─ YES → Context (ONLY for DI, not state) ✅
```

#### Constants

```typescript
// File naming convention
// stores/ui-store.ts (kebab-case, named export)

const MIN_PASSWORD_LENGTH = 8;
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY_MS = 300;
```

---

### Pattern 2: Local State with useState

Use ONLY when state is truly component-local and never shared.

#### When to Use

- ✅ State used ONLY in one component (isExpanded, isOpen)
- ✅ Temporary UI state that never needs to be shared
- ✅ Form input values (if form is self-contained)

#### When NOT to Use

- ❌ State needed in 2+ components (use Zustand)
- ❌ Prop drilling 3+ levels (use Zustand)
- ❌ Server data (use React Query)

#### Implementation

```typescript
import { useState } from "react";

const INITIAL_EXPANDED = false;

interface FeatureProps {
  id: string;
  title: string;
  status: string;
  description: string;
}

// ✅ Good Example - Truly local state
export const Feature = ({ id, title, status, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(INITIAL_EXPANDED);

  return (
    <li onClick={() => setIsExpanded((prev) => !prev)} data-expanded={isExpanded}>
      <h3>{title}</h3>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
```

**Why good:** State is truly local to this component, never shared, no prop drilling, named export follows project conventions, uses named constant for initial value

```typescript
// ❌ Bad Example - Managing server state in useState
import { useState, useEffect } from "react";

interface Feature {
  id: string;
  title: string;
  status: string;
}

function FeaturesList() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch("/api/features")
      .then((res) => res.json())
      .then(setFeatures)
      .catch(setError);
  }, []);

  // No caching, no automatic refetch, manual loading/error state
}
```

**Why bad:** Server data belongs in React Query not client state, no caching strategy means duplicate requests, no automatic refetch on window focus, manually managing loading/error states that React Query handles automatically

```typescript
// ❌ Bad Example - Prop drilling for shared state
import { useState } from "react";
import type { ReactNode } from "react";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Layout sidebarOpen={sidebarOpen}>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
      <Content />
    </Layout>
  );
}
```

**Why bad:** State is shared across multiple components creating prop drilling, layout coupling between Header/Sidebar/Layout, changing state location requires refactoring props through entire tree

**When to use:** State is genuinely used in only one component and will never be shared.

**When not to use:** As soon as state needs to be accessed from multiple components or requires prop drilling.

---

### Pattern 3: Global State with Zustand

Use as soon as state is needed in 2+ components across the tree.

#### When to Use

- ✅ State needed by 2+ components across the tree
- ✅ Modal state (trigger from header, render in layout)
- ✅ Sidebar collapsed (header button + sidebar component)
- ✅ User preferences (theme, language, layout)
- ✅ Shopping cart, filters, selected items
- ✅ Any shared UI state

#### Store Setup

```typescript
// stores/ui-store.ts
import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

const DEFAULT_SIDEBAR_STATE = true;
const DEFAULT_MODAL_STATE = false;
const DEFAULT_THEME = "light";
const UI_STORAGE_KEY = "ui-storage";

interface UIState {
  sidebarOpen: boolean;
  modalOpen: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: () => void;
  closeModal: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

// ✅ Good Example - Global UI state in Zustand
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: DEFAULT_SIDEBAR_STATE,
        modalOpen: DEFAULT_MODAL_STATE,
        theme: DEFAULT_THEME,

        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        openModal: () => set({ modalOpen: true }),

        closeModal: () => set({ modalOpen: false }),

        setTheme: (theme) => set({ theme }),
      }),
      {
        name: UI_STORAGE_KEY,
        partialize: (state) => ({ theme: state.theme }), // Only persist theme
      },
    ),
  ),
);
```

**Why good:** Named constants for all default values prevent magic strings/booleans, devtools middleware enables debugging, persist middleware saves theme preference across sessions, partialize prevents persisting transient UI state like modal/sidebar, named export follows project conventions

#### Usage in Components

```typescript
// components/header.tsx
import { useUIStore } from "../stores/ui-store";

// ✅ Good Example - Select only what you need
export const Header = () => {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header>
      <button onClick={toggleSidebar}>Toggle Sidebar</button>
    </header>
  );
};
```

**Why good:** Component only subscribes to the action it needs, won't re-render when sidebarOpen/modalOpen/theme change, minimal re-renders maximize performance

```typescript
// components/sidebar.tsx
import { useUIStore } from "../stores/ui-store";

// ✅ Good Example - Select specific value
export const Sidebar = () => {
  const isOpen = useUIStore((state) => state.sidebarOpen);

  return <aside data-open={isOpen}>...</aside>;
};
```

**Why good:** Component only subscribes to sidebarOpen value, won't re-render on theme or modal changes, data-attribute for styling follows project pattern

#### Shallow Comparison Pattern

```typescript
import { useUIStore } from "../stores/ui-store";
import { shallow } from "zustand/shallow";

// ❌ Bad Example - Will re-render on ANY store change
export const Header = () => {
  const { sidebarOpen, modalOpen, theme } = useUIStore();
  return <header>...</header>;
};
```

**Why bad:** Component subscribes to entire store, re-renders when ANY value changes even if component doesn't use those values, causes unnecessary re-renders and performance issues at scale

```typescript
// ✅ Good Example - Only re-renders when selected values change
export const Header = () => {
  const { sidebarOpen, modalOpen, theme } = useUIStore(
    (state) => ({
      sidebarOpen: state.sidebarOpen,
      modalOpen: state.modalOpen,
      theme: state.theme,
    }),
    shallow,
  );
  return <header>...</header>;
};
```

**Why good:** shallow comparison prevents re-renders when object reference changes but values are the same, component only re-renders when these specific values change, better than subscribing to entire store

```typescript
// ✅ Better Example - Select only what you need (preferred)
export const Header = () => {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  return <header>...</header>;
};
```

**Why good:** Most performant approach, component only subscribes to exactly what it needs, no shallow comparison overhead, clearest intent

**When to use:** As soon as state needs to be accessed from 2+ disconnected components or prop drilling exceeds 2 levels.

**When not to use:** For truly local component state or server data.

---

### Pattern 4: Context API - Dependency Injection ONLY

Context is NOT a state management solution. It's for dependency injection and singletons ONLY.

#### ONLY Use Context For

- ✅ Framework providers (QueryClientProvider, Router, etc.)
- ✅ Dependency injection (services, API clients, DB connections)
- ✅ Singletons that NEVER or RARELY change (theme configuration, i18n)
- ✅ Values that are set once at app initialization

#### NEVER Use Context For

- ❌ **ANY state management** (use Zustand instead)
- ❌ **ANY frequently updating values** (massive performance issues)
- ❌ Server data (use React Query)
- ❌ UI state (use Zustand for shared, useState for local)
- ❌ User interactions, selections, filters (use Zustand)
- ❌ Shopping carts, modals, sidebars (use Zustand)

#### Why Context Fails for State

```typescript
// ❌ NEVER DO THIS - Context is NOT for state management!
import { createContext, useState } from "react";
import type { ReactNode } from "react";

interface UIContextValue {
  sidebarOpen: boolean;          // ❌ This is state!
  setSidebarOpen: (open: boolean) => void;
  modalOpen: boolean;            // ❌ This is state!
  setModalOpen: (open: boolean) => void;
  theme: "light" | "dark";       // ❌ This changes!
  setTheme: (theme: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // TERRIBLE: Every consumer re-renders on ANY change!
  return (
    <UIContext.Provider value={{
      sidebarOpen, setSidebarOpen,
      modalOpen, setModalOpen,
      theme, setTheme,
    }}>
      {children}
    </UIContext.Provider>
  );
}
```

**Why bad:** Every consumer re-renders when ANY value changes, sidebar toggle causes modal component to re-render, theme change re-renders everything, no way to select specific values, creates performance nightmare at scale, new object created on every render

#### Acceptable Context Usage

```typescript
// ✅ Good Example - Theme configuration (set once, rarely changes)
import { createContext } from "react";

const DEFAULT_COLOR_SCHEME = "system";
const DEFAULT_DENSITY = "comfortable";

interface ThemeConfig {
  colorScheme: "system" | "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
}

const ThemeConfigContext = createContext<ThemeConfig>({
  colorScheme: DEFAULT_COLOR_SCHEME,
  density: DEFAULT_DENSITY,
  // These are CONFIG, not STATE
  // They don't change during normal app usage
});

export { ThemeConfigContext };
```

**Why good:** Values are configuration not state, set once at app initialization, rarely/never change during runtime, no performance issues because values are static

```typescript
// ✅ Good Example - Database connection (singleton)
import { createContext } from "react";
import type { Database } from "./db-types";

const DatabaseContext = createContext<Database | null>(null);

export { DatabaseContext };
```

**Why good:** Database connection is a singleton, never changes after initialization, dependency injection pattern, no re-render concerns

**When to use:** Singletons, dependency injection, values set once at startup.

**When not to use:** Anything that changes based on user interaction.

---

### Pattern 5: URL State for Shareable Filters

Use URL params for shareable/bookmarkable state.

#### When to Use URL State

- ✅ Filter selections
- ✅ Search queries
- ✅ Pagination state
- ✅ Sort order
- ✅ Any state that should be shareable via URL

#### Implementation with Next.js

```typescript
// app/products/page.tsx
import { useSearchParams } from "next/navigation";

const DEFAULT_PAGE = "1";
const DEFAULT_SORT = "newest";

export const ProductList = () => {
  const searchParams = useSearchParams();

  // ✅ Read filter state from URL
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const minPrice = searchParams.get("minPrice") ?? undefined;
  const page = searchParams.get("page") ?? DEFAULT_PAGE;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  // Pass URL params to React Query for data fetching
  // const { data } = useGetProducts({ category, search, minPrice, page, sort });

  return <div>...</div>;
};
```

**Why good:** Filters are shareable via URL, browser back/forward works correctly, bookmarkable URLs for specific filter states, SEO-friendly for filtered views, named constants for defaults

```typescript
// ❌ Bad Example - Filter state in useState
import { useState } from "react";

export const ProductList = () => {
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  // Not shareable, not bookmarkable, breaks browser navigation
};
```

**Why bad:** URLs can't be shared with specific filters, browser back button doesn't work for filter changes, can't bookmark filtered views, breaks user expectations for web navigation

**When to use:** Any state that users might want to share, bookmark, or navigate to directly.

**When not to use:** Transient UI state like modal open/closed, sidebar expanded, or sensitive data.

---

### Pattern 6: Form State and Validation

Use controlled components with Zod validation.

#### Controlled Component Pattern

```typescript
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

const MIN_PASSWORD_LENGTH = 8;
const INITIAL_EMAIL = "";
const INITIAL_PASSWORD = "";

export const LoginForm = () => {
  const [email, setEmail] = useState(INITIAL_EMAIL);
  const [password, setPassword] = useState(INITIAL_PASSWORD);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors({ ...errors, email: "" });
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) {
      setErrors({ ...errors, password: "" });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = "Email is required";
    if (password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (error) {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={handleEmailChange}
        aria-invalid={!!errors.email}
      />
      {errors.email && <span className="error">{errors.email}</span>}

      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
        aria-invalid={!!errors.password}
      />
      {errors.password && <span className="error">{errors.password}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
};
```

**Why good:** Named constants for validation rules and initial values, errors clear when user starts fixing field, explicit event typing for type safety, loading state prevents double-submission, aria-invalid for accessibility

#### Zod Schema Validation

```typescript
import { z } from "zod";

const MIN_DESCRIPTION_LENGTH = 10;
const MIN_SALARY = 0;

const JobFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(MIN_DESCRIPTION_LENGTH, `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin && data.salaryMax) {
        return data.salaryMax > data.salaryMin;
      }
      return true;
    },
    {
      message: "Maximum salary must be greater than minimum salary",
      path: ["salaryMax"],
    },
  );

type JobFormData = z.infer<typeof JobFormSchema>;

export { JobFormSchema };
export type { JobFormData };
```

**Why good:** Named constants for validation thresholds, type inference from schema, cross-field validation with refine, descriptive error messages, named exports

**When to use:** Forms with validation requirements, especially with cross-field validation or complex rules.

**When not to use:** Simple single-input forms like search boxes.

</patterns>

---

<decision_framework>

## Decision Framework

### State Management Decision Tree

```
What kind of state do I have?

Is it server data (from API)?
├─ YES → React Query ✅
└─ NO → Is it URL-appropriate (filters, search, shareable)?
    ├─ YES → URL params (searchParams) ✅
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Zustand ✅
        └─ NO → Is it truly component-local?
            ├─ YES → useState ✅
            └─ NO → Is it a singleton/dependency?
                └─ YES → Context (ONLY for DI) ✅
```

### Form Library Decision

```
What kind of form do I have?

Simple form (1-3 fields, minimal validation)?
├─ YES → Vanilla React (useState + Zod) ✅
└─ NO → Complex form (10+ fields, field-level validation)?
    └─ YES → React Hook Form ✅
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data | React Query ✅ | Caching, synchronization, loading states |
| Shareable filters | URL params ✅ | Bookmarkable, browser navigation |
| Shared UI state (2+ components) | Zustand ✅ | Fast, selective re-renders, no prop drilling |
| Local UI state (1 component) | useState ✅ | Simple, component-local |
| Framework providers | Context ✅ | Singletons that never change |
| Dependency injection | Context ✅ | Services, DB connections |
| **ANY state management** | **NEVER Context** | **Use Zustand instead** |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Storing server/API data in client state (useState, Context, Zustand)** - causes stale data, no caching, manual sync complexity
- ❌ **Using Context with useState/useReducer for state management** - every consumer re-renders on any change, performance nightmare
- ❌ **Using useState for state needed in 2+ components** - causes prop drilling, tight coupling, refactoring difficulty
- ❌ **Default exports in state files** - violates project conventions, breaks tree-shaking
- ❌ **Magic numbers in validation or initial state** - makes rules unclear, hard to maintain

**Medium Priority Issues:**

- ⚠️ Prop drilling 3+ levels instead of using Zustand
- ⚠️ Filter state in useState instead of URL params (not shareable)
- ⚠️ Creating unnecessary object references in Zustand selectors (causes re-renders)
- ⚠️ Subscribing to entire Zustand store instead of specific values
- ⚠️ Validating on every keystroke instead of on blur/submit

**Common Mistakes:**

- Mixing controlled and uncontrolled inputs in forms
- Not preventing default on form submit
- Showing validation errors before user finishes typing
- Not typing form events explicitly (use `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`)
- Disabling input fields during submission (only disable submit button)
- Not handling submit errors with user-friendly messages
- Missing loading states during async operations

**Gotchas & Edge Cases:**

- Context re-renders ALL consumers when ANY value changes - no way to select specific values
- Zustand selectors that return new objects cause re-renders even if values identical (use shallow or primitive selectors)
- URL params are always strings - need parsing for numbers/booleans
- Form validation on every keystroke kills performance - validate on blur/submit
- Persisting modal/sidebar state across sessions confuses users - only persist preferences

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### ❌ Context for State Management

Using React Context with useState/useReducer for state management causes every consumer to re-render when ANY value changes. This creates a performance nightmare at scale with no way to select specific values.

```typescript
// ❌ WRONG - Context causes full re-renders
const AppContext = createContext({ user: null, theme: 'light', cart: [] });

// ✅ CORRECT - Zustand with selectors
const useStore = create((set) => ({ user: null, theme: 'light', cart: [] }));
const theme = useStore((s) => s.theme); // Only re-renders when theme changes
```

### ❌ Server Data in Client State

Storing API/server data in useState, Zustand, or Context causes stale data, no caching, and manual synchronization complexity.

```typescript
// ❌ WRONG - Server data in useState
const [users, setUsers] = useState([]);
useEffect(() => { fetchUsers().then(setUsers); }, []);

// ✅ CORRECT - React Query handles caching, refetch, sync
const { data: users } = useQuery(getUsersOptions());
```

### ❌ Prop Drilling for Shared State

Using useState and passing props through 3+ levels creates tight coupling and refactoring difficulty.

```typescript
// ❌ WRONG - Prop drilling
<Parent isOpen={isOpen} setIsOpen={setIsOpen}>
  <Child isOpen={isOpen} setIsOpen={setIsOpen}>
    <GrandChild isOpen={isOpen} setIsOpen={setIsOpen} />

// ✅ CORRECT - Zustand accessed directly
const isOpen = useUIStore((s) => s.isOpen);
```

### ❌ Magic Numbers in State Logic

Using raw numbers for validation thresholds, timeouts, or initial values.

```typescript
// ❌ WRONG - Magic numbers
if (password.length < 8) { ... }
setTimeout(save, 300);

// ✅ CORRECT - Named constants
const MIN_PASSWORD_LENGTH = 8;
const DEBOUNCE_DELAY_MS = 300;
```

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST use React Query for ALL server/API data - NEVER useState, Zustand, or Context)**

**(You MUST use Zustand for ALL shared UI state (2+ components) - NOT Context or prop drilling)**

**(You MUST use useState ONLY for truly component-local state - NOT for anything shared)**

**(You MUST use named exports ONLY - NO default exports in any state files)**

**(You MUST use named constants for ALL numbers - NO magic numbers in state code)**

**Failure to follow these rules will cause stale data issues, performance problems, and convention violations.**

</critical_reminders>
