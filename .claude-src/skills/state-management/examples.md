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
