# State Management Patterns

**Auto-detection:** Deciding between React Query vs Zustand vs useState, server state vs client state, global state management, Context misuse

**When to use:**

- Deciding between React Query, Zustand, or useState for a use case
- Setting up Zustand for shared UI state (modals, sidebars, preferences)
- Managing forms with React Hook Form + Zod
- Understanding when NOT to use Context for state management

**Key patterns covered:**

- Server state = React Query ONLY (never store server data in Zustand)
- Client state = useState (local) or Zustand (shared, 2+ components)
- Context for dependency injection only (NEVER for state management)
- URL params for shareable/bookmarkable state (filters, search)

---

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


---

# State Management - Examples

---

## Server State vs Client State

### ✅ Example: React Query with OpenAPI-Generated Hooks (Actual Pattern)

```typescript
// apps/client-next/app/features.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries"; // ✅ Generated from OpenAPI
import { Feature } from "@repo/ui/feature";
import { Info } from "@repo/ui/info";
import { Skeleton } from "@repo/ui/skeleton";
import { Shell } from "./shell";
import styles from "./features.module.scss";

// ✅ GOOD: Server state managed by React Query with generated hooks
export const Features = () => {
  // ✅ Use generated query options
  const { isSuccess, isPending, error, data } = useQuery(getFeaturesOptions());

  // ✅ Handle loading state
  if (isPending) {
    return (
      <Shell>
        {Array(7)
          .fill("")
          .map((_, index) => (
            <div className={styles.row} key={index}>
              <Skeleton className={styles.skeletonCircle} />
              <Skeleton />
            </div>
          ))}
      </Shell>
    );
  }

  // ✅ Handle empty state
  if (isSuccess && !data.features?.length) {
    return (
      <Shell>
        <Info variant="info" message="No features found" />
      </Shell>
    );
  }

  // ✅ Handle error state
  if (error) {
    return (
      <Shell>
        <Info variant="error" message={`An error has occurred: ${error}`} />
      </Shell>
    );
  }

  // ✅ Render success state
  return (
    <Shell>
      {data?.features?.map((feature) => (
        <Feature key={feature.id} {...feature} />
      ))}
    </Shell>
  );
};
```

**OpenAPI Setup:**

```typescript
// packages/api/openapi-ts.config.ts
export default defineConfig({
  input: "./openapi.yaml",
  output: {
    format: "prettier",
    lint: "eslint",
    path: "./src/apiClient",
  },
  plugins: [
    ...defaultPlugins,
    "@hey-api/client-fetch",
    "@tanstack/react-query", // ✅ Generates React Query hooks
  ],
});
```

**QueryClient Configuration:**

```typescript
// apps/client-next/app/providers.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // ✅ Disable retries during development with MSW
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### ❌ BAD: Managing Server State in useState

```typescript
// ❌ DON'T DO THIS!
function FeaturesList() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/features")
      .then((res) => res.json())
      .then(setFeatures)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  // ❌ No caching, no automatic refetch, manual error handling, etc.
}
```

**Why React Query + Generated Hooks:**

- ✅ Automatic caching and revalidation
- ✅ Type-safe API calls from OpenAPI schema
- ✅ Automatic React Query hooks generation
- ✅ No manual query key management
- ✅ Background refetch and sync
- ✅ Simplified error and loading states

---

### ✅ Example: Local State - Component-Only (Actual Pattern)

```typescript
// packages/ui/src/patterns/feature/feature.tsx
import { useState } from "react";
import clsx from "clsx";
import { Switch } from "@radix-ui/react-switch";
import styles from "./feature.module.scss";

export type FeatureProps = {
  id: string;
  title: string;
  status: string;
  description: string;
};

// ✅ GOOD: Truly local state - only used in this component
export const Feature = ({ id, title, status, description }: FeatureProps) => {
  // ✅ This state is NEVER needed outside this component
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li
      className={clsx(styles.feature)}
      onClick={() => setIsExpanded((expandedState) => !expandedState)}
      data-expanded={isExpanded}
      data-testid="feature"
    >
      <Switch
        id={`${id}-switch`}
        className={styles.switch}
        checked={status === "done"}
        onClick={(event) => {
          event.stopPropagation();
        }}
      />
      <div>
        <strong>{title}</strong>
        {isExpanded && <p>{description}</p>}
      </div>
    </li>
  );
};
```

### ❌ Example: When Local State is NOT Enough

```typescript
// ❌ BAD: Prop drilling for shared state
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

// ✅ GOOD: Use Zustand for shared state
import { create } from 'zustand';

const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

function Header() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  return <button onClick={toggleSidebar}>Toggle</button>;
}

function Sidebar() {
  const isOpen = useUIStore((state) => state.sidebarOpen);
  return <aside data-open={isOpen}>...</aside>;
}
```

### ✅ Example: Global State with Zustand (Recommended Pattern)

```typescript
// stores/ui-store.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  modalOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: () => void;
  closeModal: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

// ✅ GOOD: Global UI state in Zustand
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        modalOpen: false,
        theme: 'light',

        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setSidebarOpen: (open) =>
          set({ sidebarOpen: open }),

        openModal: () =>
          set({ modalOpen: true }),

        closeModal: () =>
          set({ modalOpen: false }),

        setTheme: (theme) =>
          set({ theme }),
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({ theme: state.theme }), // Only persist theme
      }
    )
  )
);
```

### ✅ Example: Using Zustand with Shallow Comparison

```typescript
import { shallow } from 'zustand/shallow';

// ❌ BAD: Will re-render on ANY store change
function Header() {
  const { sidebarOpen, modalOpen, theme } = useUIStore();
  return <header>...</header>;
}

// ✅ GOOD: Only re-renders when selected values change
function Header() {
  const { sidebarOpen, modalOpen, theme } = useUIStore(
    (state) => ({
      sidebarOpen: state.sidebarOpen,
      modalOpen: state.modalOpen,
      theme: state.theme,
    }),
    shallow
  );
  return <header>...</header>;
}

// ✅ ALTERNATIVE: Select only what you need
function Header() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  return <header>...</header>;
}
```

**Why Zustand for Shared State:**

- ✅ Simple API, minimal boilerplate
- ✅ No prop drilling
- ✅ TypeScript support
- ✅ DevTools integration
- ✅ Persistence middleware
- ✅ Fast and performant
- ✅ Works with React Server Components

**When to introduce Zustand:**

- State needed in 2+ disconnected components
- Prop drilling more than 2 levels
- State that should persist (with persist middleware)
- Complex UI state management


---

## React Query Patterns

### ✅ Example: Using Generated Query Options (Actual Pattern)

```typescript
// ✅ Generated query options from OpenAPI
// packages/api/src/apiClient/@tanstack/react-query.gen.ts
export const getFeaturesOptions = () => ({
  queryKey: ["features"], // ✅ Generated query key
  queryFn: async () => {
    const res = await client.GET("/features");
    return res.data;
  },
});
```

```typescript
// ✅ Usage in component
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

export const Features = () => {
  // ✅ Just use the generated options
  const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());

  // ✅ Handle all states...
};
```

---

## Client State Management

### Decision Tree: Local vs Global State

```typescript
// Is the state server data?
// → YES: Use React Query ✅

// Is the state needed in 2+ components?
// → YES: Use Zustand ✅
// → NO: Use useState ✅

// Does state need to persist across sessions?
// → YES: Use Zustand with persist middleware ✅

// Is state causing 3+ levels of prop drilling?
// → YES: Use Zustand ✅
```

### ❌ Example: DON'T Store Server Data in Client State

```typescript
// ❌ BAD: Server data in useState
function FeaturesList() {
  const [features, setFeatures] = useState<Feature[]>([]);

  useEffect(() => {
    fetch("/api/features")
      .then((res) => res.json())
      .then(setFeatures);
  }, []);
}

// ❌ BAD: Server data in Zustand
const useFeatureStore = create((set) => ({
  features: [],
  fetchFeatures: async () => {
    const res = await fetch("/api/features");
    const data = await res.json();
    set({ features: data });
  },
}));

// ✅ GOOD: Server data in React Query
function FeaturesList() {
  const { data } = useQuery(getFeaturesOptions());
  return data?.features?.map((f) => <Feature {...f} />);
}
```

---

## Context API - NOT for State Management

**Context is acceptable for framework providers** (e.g., QueryClientProvider for React Query, ThemeProvider for themes) **because they provide singletons that never change during runtime. Do NOT use Context for state management.**

### ❌ Example: NEVER Use Context for State Management

```typescript
// ❌ NEVER DO THIS - Context is NOT for state management!
interface UIContextValue {
  sidebarOpen: boolean;          // ❌ This is state!
  setSidebarOpen: (open: boolean) => void;
  modalOpen: boolean;            // ❌ This is state!
  setModalOpen: (open: boolean) => void;
  theme: 'light' | 'dark';       // ❌ This changes!
  setTheme: (theme: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // ❌ TERRIBLE: Every consumer re-renders on ANY change!
  // ❌ Sidebar changes → modal component re-renders
  // ❌ Theme changes → everything re-renders
  // ❌ No way to select specific values
  // ❌ Performance nightmare at scale
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

// ✅ CORRECT: Use Zustand for state management
import { create } from 'zustand';

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  modalOpen: false,
  setModalOpen: (open) => set({ modalOpen: open }),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));

// ✅ Components only re-render when THEIR selected values change
function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  // Only re-renders when sidebarOpen changes, not theme or modal
}
```

### ❌ Example: DON'T Use Context for ANY State

```typescript
// ❌ BAD: Server data in Context
interface AppContextValue {
  user: User;           // ❌ Use React Query
  products: Product[];  // ❌ Use React Query
  features: Feature[];  // ❌ Use React Query
}

// ❌ BAD: Cart state in Context
interface CartContextValue {
  items: CartItem[];    // ❌ Use Zustand
  addItem: (item) => void;
  removeItem: (id) => void;
}

// ❌ BAD: Filter state in Context
interface FilterContextValue {
  category: string;     // ❌ Use Zustand or URL params
  search: string;
  setCategory: (cat) => void;
}

// ✅ GOOD: Use the right tool
function App() {
  // Server data → React Query
  const { data: user } = useQuery(getUserOptions());
  const { data: products } = useQuery(getProductsOptions());

  // Shared UI state → Zustand
  const items = useCartStore((state) => state.items);

  // Filters → URL params
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
}
```

### ✅ Example: When Context is Acceptable (Rare)

```typescript
// ✅ Theme configuration - set once, rarely/never changes
const ThemeConfigContext = createContext<ThemeConfig>({
  colorScheme: 'system', // Set at app init
  density: 'comfortable',
  // These are CONFIG, not STATE
  // They don't change during normal app usage
});

// ✅ Database connection - singleton
const DatabaseContext = createContext<Database | null>(null);

// ✅ Feature flags - set at startup
const FeatureFlagsContext = createContext<FeatureFlags>({
  enableNewUI: true,
  enableBetaFeatures: false,
  // These don't change during runtime
});
```

**Summary:**

| Use Case | Solution | Why |
|----------|----------|-----|
| Framework providers | Context ✅ | Singletons that never change |
| Dependency injection | Context ✅ | Services, DB connections |
| Static configuration | Context ✅ | Set once at startup |
| **ANY state management** | **Zustand ✅** | **Context causes performance issues** |
| Server data | React Query ✅ | Made for this |
| Shared UI state | Zustand ✅ | Fast, selective re-renders |
| Local UI state | useState ✅ | Component-local only |

**Remember: If it changes based on user interaction → NOT Context. Use Zustand.**

---

## URL State

### ✅ Example: URL Params for Shareable Filters

```typescript
// Next.js App Router
import { useSearchParams } from "next/navigation";

function ProductList() {
  const searchParams = useSearchParams();

  // ✅ Read from URL
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const minPrice = searchParams.get("minPrice");

  // ✅ Use in React Query
  const { data } = useQuery(
    getProductsOptions({
      category,
      search,
      minPrice: minPrice ? Number(minPrice) : undefined,
    })
  );

  return <div>{/* ... */}</div>;
}
```

**Benefits:**

- ✅ Shareable URLs
- ✅ Browser back/forward works
- ✅ Bookmarkable
- ✅ Syncs with React Query automatically

