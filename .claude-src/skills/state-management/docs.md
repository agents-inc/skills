# State Management

> **Quick Guide:** Server data? React Query (§). Local UI? useState (§1). Shared UI? Zustand (§2). Singleton/DI? Context (§). **NEVER use Context for state management!**

---

## Server State vs Client State

**STRICT SEPARATION REQUIRED:**

**Server State = React Query ONLY**

- Data from APIs (users, products, posts, etc.)
- Database records
- Remote data of any kind
- **Use OpenAPI-generated React Query hooks** from `@repo/api/reactQueries`
- Automatic caching, revalidation, and synchronization

**Client State = Local (useState) OR Global (Zustand) based on scope**

**RULE: Use local state ONLY when state is truly component-local. As soon as state is needed in multiple places, use global state management.**

**Local State (React.useState):**

- ✅ Component-local UI state (isExpanded, isOpen, selectedIndex)
- ✅ State used ONLY within a single component
- ✅ Temporary UI state that doesn't need to be shared
- ✅ Form input values (if form is self-contained)

**Global State (Zustand/Context):**

- ✅ State needed by multiple components across the tree
- ✅ Modal open/closed state (accessed from multiple places)
- ✅ Sidebar collapsed state (header + sidebar need it)
- ✅ User preferences (theme, language, layout settings)
- ✅ Shopping cart, filters, selections shared across routes
- ✅ Any state that needs to be accessed from 2+ disconnected components

**Decision tree when you need to share state:**

1. **Is it server data?** → Use React Query ✅
2. **Is it URL-appropriate?** → Use URL params (Next.js searchParams) ✅
3. **Is it needed in 2+ components?** → Use Zustand ✅
4. **Is it truly component-local?** → Use useState ✅
5. **Is it a singleton/dependency?** → Use Context (ONLY for DI, not state) ✅

**NEVER: "Should I use Context for state management?" → NO. Use Zustand.**

**CRITICAL RED FLAGS:**

- ❌ **NEVER store server data in client state (useState, Context, Zustand)**
- ❌ **NEVER store UI state in React Query**
- ❌ Duplicating server data in client state
- ❌ Syncing server data manually to client state
- ❌ Using useState for state needed in multiple components (lift to Zustand instead)
- ❌ Prop drilling 3+ levels (use Zustand instead)

---

## React Query Patterns (OpenAPI-Generated)

**MANDATORY: Use OpenAPI-generated React Query hooks**

- API client generated from `packages/api/openapi.yaml`
- React Query hooks auto-generated via `@hey-api/openapi-ts`
- Import query options from `@repo/api/reactQueries`
- **DO NOT write custom query hooks** - use generated ones
- Query keys managed automatically by generated code

**Pattern:**

```typescript
// ✅ Import generated query options
import { getFeaturesOptions } from "@repo/api/reactQueries";

// ✅ Use with useQuery
const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());
```

**QueryClient Configuration:**

```typescript
// Centralized configuration with shared defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries during development with MSW
    },
  },
});
```

**Loading and Error State Handling:**

- **Always handle all states explicitly**: `isPending`, `isSuccess`, `error`
- Use `Skeleton` component for loading states
- Use `Info` component for error and empty states
- Never leave states unhandled

**RED FLAGS:**

- ❌ Writing custom useQuery hooks (use generated options)
- ❌ Manual query key management (let OpenAPI generate)
- ❌ Missing error handling
- ❌ No loading states (must use Skeleton)
- ❌ Not using generated API client
- ❌ Importing API functions directly instead of using generated hooks

---

## Client State Management (Local vs Global)

**RULE: Local state by default. Global state as soon as it's shared.**

### Local State (useState)

**Use ONLY when state is truly component-local**

**When to use useState:**

- ✅ State used ONLY in one component (isExpanded, isOpen)
- ✅ Temporary UI state that never needs to be shared
- ✅ Form input values (if form is self-contained)

**When NOT to use useState:**

- ❌ State needed in 2+ components (use Zustand)
- ❌ Prop drilling 3+ levels (use Zustand)
- ❌ Server data (use React Query)

**Example:**

```typescript
// ✅ Truly local state - only used in this component
export const Feature = ({ id, title, status, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li onClick={() => setIsExpanded((prev) => !prev)} data-expanded={isExpanded}>
      {/* ... */}
    </li>
  );
};
```

### Global State (Zustand)

**Use as soon as state is needed in multiple places**

**When to use Zustand:**

- ✅ State needed by 2+ components across the tree
- ✅ Modal state (trigger from header, render in layout)
- ✅ Sidebar collapsed (header button + sidebar component)
- ✅ User preferences (theme, language, layout)
- ✅ Shopping cart, filters, selected items
- ✅ Any shared UI state

**Example:**

```typescript
// stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

// Usage in Header
function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  return <button onClick={toggleSidebar}>Toggle</button>;
}

// Usage in Sidebar
function Sidebar() {
  const isOpen = useUIStore((state) => state.sidebarOpen);
  return <aside data-open={isOpen}>...</aside>;
}
```

**Zustand Patterns:**

- **Prefer separate selectors** for best performance (each component selects only what it needs)
- Use `shallow` only when destructuring multiple values into an object
- Keep stores focused (ui-store, cart-store, not app-store)
- Use middleware: `persist` for localStorage, `devtools` for debugging

**Selector approaches:**

```typescript
// ✅ BEST: Separate selectors (no shallow needed)
const sidebarOpen = useUIStore((state) => state.sidebarOpen);
const theme = useUIStore((state) => state.theme);

// ✅ GOOD: Shallow when destructuring multiple values
import { shallow } from "zustand/shallow";
const { sidebarOpen, theme } = useUIStore(
  (state) => ({ sidebarOpen: state.sidebarOpen, theme: state.theme }),
  shallow,
);
```

**RED FLAGS:**

- ❌ Using useState for shared state (causes prop drilling)
- ❌ Using Context for frequently updating state (performance issues)
- ❌ Storing server data in Zustand (use React Query)
- ❌ Creating unnecessary object references in selectors (causes re-renders)

---

## Context API - NOT for State Management

**CRITICAL: Context is NOT a state management solution. It's for dependency injection and singletons ONLY.**

**ONLY use Context for:**

- ✅ Framework providers (QueryClientProvider, Router, etc.)
- ✅ Dependency injection (services, API clients, DB connections)
- ✅ Singletons that NEVER or RARELY change (theme configuration, i18n)
- ✅ Values that are set once at app initialization

**NEVER use Context for:**

- ❌ **ANY state management** (use Zustand instead)
- ❌ **ANY frequently updating values** (massive performance issues)
- ❌ Server data (use React Query)
- ❌ UI state (use Zustand for shared, useState for local)
- ❌ User interactions, selections, filters (use Zustand)
- ❌ Shopping carts, modals, sidebars (use Zustand)

**Why:** Every consumer re-renders on ANY value change. No selectors. Performance issues at scale.

**Pattern (Framework Setup ONLY):**

```typescript
// ✅ Context for framework providers - values NEVER change
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**❌ NEVER do this:**

```typescript
// ❌ NEVER use Context for state management
const UIContext = createContext();

function UIProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  // ❌ Every consumer re-renders on ANY change!
  return (
    <UIContext.Provider value={{ sidebarOpen, modalOpen, theme, ... }}>
      {children}
    </UIContext.Provider>
  );
}

// ✅ Use Zustand instead
const useUIStore = create((set) => ({
  sidebarOpen: true,
  modalOpen: false,
  theme: 'light',
  // ... actions
}));
```

**RED FLAGS:**

- ❌ **Context with useState/useReducer for state management**
- ❌ Context values that change based on user interactions
- ❌ Multiple pieces of state in one context
- ❌ Context for shopping cart, filters, selections
- ❌ "Splitting contexts" to fix performance (just use Zustand!)

---

## URL State for Shareable Filters

**PATTERN: Use URL params for shareable/bookmarkable state**

- Filter selections
- Search queries
- Pagination state
- Sort order
- Any state that should be shareable via URL

**Benefits:** Shareable URLs, browser navigation, bookmarkable, SEO-friendly.

**Example:**

```typescript
// Next.js App Router
const searchParams = useSearchParams();
const category = searchParams.get("category");
const search = searchParams.get("search");
```

**RED FLAGS:**

- ❌ Filter state in useState (not shareable)
- ❌ Not syncing URL params with React Query keys
