# Client State - Core Examples

> Extended examples for Zustand and client state management. See [SKILL.md](../SKILL.md) for decision frameworks and red flags.

---

## Pattern 1: State Placement

### Constants Convention

```typescript
// stores/ui-store.ts (kebab-case, named export)

const MIN_PASSWORD_LENGTH = 8;
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY_MS = 300;
```

---

## Pattern 2: Local State with useState

### Good Example - Truly Local State

```typescript
import { useState } from "react";

const INITIAL_EXPANDED = false;

interface FeatureProps {
  id: string;
  title: string;
  description: string;
}

export const Feature = ({ id, title, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(INITIAL_EXPANDED);

  return (
    <li onClick={() => setIsExpanded((prev) => !prev)} data-expanded={isExpanded}>
      <h3>{title}</h3>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
```

**Why good:** State is truly local to this component, never shared, no prop drilling, named constant for initial value

### Bad Example - Server Data in useState

```typescript
import { useState, useEffect } from "react";

interface Feature {
  id: string;
  title: string;
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

**Why bad:** Server data belongs in a data fetching layer, no caching means duplicate requests, no automatic refetch on window focus, manually managing loading/error states

### Bad Example - Prop Drilling for Shared State

```typescript
import { useState } from "react";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Layout sidebarOpen={sidebarOpen}>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
    </Layout>
  );
}
```

**Why bad:** State shared across multiple components via props, layout coupling between Header/Sidebar/Layout, changing state location requires refactoring the entire prop chain

---

## Pattern 3: Zustand Store Setup

### Store with devtools and persist

```typescript
// stores/ui-store.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const DEFAULT_SIDEBAR_STATE = true;
const DEFAULT_THEME = "light";
const UI_STORAGE_KEY = "ui-storage";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: DEFAULT_SIDEBAR_STATE,
        theme: DEFAULT_THEME,

        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        setTheme: (theme) => set({ theme }),
      }),
      {
        name: UI_STORAGE_KEY,
        partialize: (state) => ({ theme: state.theme }), // Only persist preferences
      },
    ),
  ),
);
```

**Why good:** Named constants for defaults, devtools enables debugging, persist saves theme preference across sessions, partialize excludes transient UI state (sidebar open/closed shouldn't survive page refreshes)

> **Zustand v5 note:** persist no longer stores initial state during creation. If you need computed or randomized initial values, set them after creation: `useUIStore.setState({ theme: computedTheme })`

### Atomic Selectors (Preferred)

```typescript
// components/header.tsx
import { useUIStore } from "../stores/ui-store";

export const Header = () => {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header>
      <button onClick={toggleSidebar}>Toggle Sidebar</button>
    </header>
  );
};
```

**Why good:** Component only subscribes to one value, won't re-render when other state changes, cleanest and most performant approach

```typescript
// components/sidebar.tsx
import { useUIStore } from "../stores/ui-store";

export const Sidebar = () => {
  const isOpen = useUIStore((state) => state.sidebarOpen);

  return <aside data-open={isOpen}>...</aside>;
};
```

**Why good:** Subscribes only to sidebarOpen, ignores theme and modal changes entirely

### useShallow for Multiple Values

When you need multiple values from one store, use `useShallow` to avoid re-renders from reference changes:

```typescript
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../stores/ui-store";

export const StatusBar = () => {
  const { sidebarOpen, theme } = useUIStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      theme: state.theme,
    })),
  );
  return <div>...</div>;
};
```

**Why good:** useShallow does shallow comparison on the returned object, preventing re-renders when the object reference changes but values are identical

**Prefer atomic selectors** - multiple `useStore((s) => s.value)` calls are simpler and avoid the shallow comparison overhead. Use `useShallow` only when you genuinely need 3+ values from one store in a single component.

### Bad Example - Destructuring Entire Store

```typescript
// BAD - subscribes to EVERYTHING
export const Header = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  return <header>...</header>;
};
```

**Why bad:** No selector means the component subscribes to every state change, re-renders on ANY update even if it only uses two values

### Selector Stability (v5 Requirement)

Selectors must return stable references. Inline object/function creation causes infinite loops:

```typescript
// BAD - new function reference every render, infinite loop in v5
const action = useStore((state) => state.action ?? (() => {}));

// GOOD - stable fallback reference
const FALLBACK_ACTION = () => {};
const action = useStore((state) => state.action ?? FALLBACK_ACTION);
```

---

## Pattern 4: Context API - Dependency Injection ONLY

### Why Context Fails for State

```typescript
// NEVER DO THIS - Context is NOT for state management
import { createContext, useState } from "react";
import type { ReactNode } from "react";

interface UIContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: "light" | "dark";
  setTheme: (theme: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // TERRIBLE: Every consumer re-renders on ANY change
  return (
    <UIContext.Provider value={{ sidebarOpen, setSidebarOpen, theme, setTheme }}>
      {children}
    </UIContext.Provider>
  );
}
```

**Why bad:** Every consumer re-renders when ANY value changes, sidebar toggle causes unrelated components to re-render, new value object created every render, no way to select specific values

### Acceptable Context Usage - Dependency Injection

```typescript
// Good - Theme configuration (set once, never changes during runtime)
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
});

export { ThemeConfigContext };
```

**Why good:** Values are configuration not state, set once at app initialization, never change during runtime, no performance issues

```typescript
// Good - Database connection (singleton)
import { createContext } from "react";
import type { Database } from "./db-types";

const DatabaseContext = createContext<Database | null>(null);

export { DatabaseContext };
```

**Why good:** Singleton that never changes after initialization, pure dependency injection

---

## Pattern 5: URL State for Shareable Filters

### Good Example - URL Params for Filters

```typescript
// Use your framework's searchParams API (useSearchParams, useRouter, etc.)
const DEFAULT_PAGE = "1";
const DEFAULT_SORT = "newest";

export const ProductList = () => {
  // Read filter state from URL (framework-specific API)
  const searchParams = new URLSearchParams(window.location.search);

  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const page = searchParams.get("page") ?? DEFAULT_PAGE;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  // Pass URL params to your data fetching solution
  return <div>...</div>;
};
```

**Why good:** Filters are shareable via URL, browser back/forward works, bookmarkable for specific filter states, named constants for defaults

### Bad Example - Filter State in useState

```typescript
import { useState } from "react";

export const ProductList = () => {
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  // Not shareable, not bookmarkable, breaks browser navigation
};
```

**Why bad:** URLs can't be shared with specific filters, browser back button doesn't work for filter changes, can't bookmark filtered views
