# Client State - Core Examples

All code examples for core client state management patterns with good/bad comparisons.

**Extended Examples:**

- [Form State Examples](forms.md) - Form state and validation patterns

---

## Pattern 1: Server State vs Client State

### Constants Example

```typescript
// File naming convention
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
  status: string;
  description: string;
}

// Good Example - Truly local state
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

### Bad Example - Managing Server State in useState

```typescript
// Bad Example - Managing server state in useState
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

**Why bad:** Server data belongs in a data fetching layer not client state, no caching strategy means duplicate requests, no automatic refetch on window focus, manually managing loading/error states that a data fetching solution handles automatically

### Bad Example - Prop Drilling for Shared State

```typescript
// Bad Example - Prop drilling for shared state
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

## Pattern 3: Global State with Zustand

### Store Setup

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

// Good Example - Global UI state in Zustand
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: DEFAULT_SIDEBAR_STATE,
        modalOpen: DEFAULT_MODAL_STATE,
        theme: DEFAULT_THEME,

        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

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

> **Note (Zustand v5):** The persist middleware no longer stores initial state during store creation. If you need computed or randomized initial values, set them explicitly after store creation: `useUIStore.setState({ theme: computedTheme })`

### Usage in Components - Select Only What You Need

```typescript
// components/header.tsx
import { useUIStore } from "../stores/ui-store";

// Good Example - Select only what you need
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

### Usage in Components - Select Specific Value

```typescript
// components/sidebar.tsx
import { useUIStore } from "../stores/ui-store";

// Good Example - Select specific value
export const Sidebar = () => {
  const isOpen = useUIStore((state) => state.sidebarOpen);

  return <aside data-open={isOpen}>...</aside>;
};
```

**Why good:** Component only subscribes to sidebarOpen value, won't re-render on theme or modal changes, data-attribute for styling follows project pattern

### Shallow Comparison Pattern (useShallow - Zustand v5)

```typescript
import { useUIStore } from "../stores/ui-store";

// Bad Example - Will re-render on ANY store change
export const Header = () => {
  const { sidebarOpen, modalOpen, theme } = useUIStore();
  return <header>...</header>;
};
```

**Why bad:** Component subscribes to entire store, re-renders when ANY value changes even if component doesn't use those values, causes unnecessary re-renders and performance issues at scale

```typescript
// Good Example - Using useShallow hook (v5 pattern)
import { useShallow } from "zustand/react/shallow";

export const Header = () => {
  const { sidebarOpen, modalOpen, theme } = useUIStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      modalOpen: state.modalOpen,
      theme: state.theme,
    })),
  );
  return <header>...</header>;
};
```

**Why good:** useShallow hook prevents re-renders when object reference changes but values are the same, component only re-renders when these specific values change, v5 recommended pattern, better than subscribing to entire store

```typescript
// Better Example - Select only what you need (preferred)
export const Header = () => {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  return <header>...</header>;
};
```

**Why good:** Most performant approach, component only subscribes to exactly what it needs, no shallow comparison overhead, clearest intent

**When to use:** As soon as state needs to be accessed from 2+ disconnected components or prop drilling exceeds 2 levels.

**When not to use:** For truly local component state or server data.

### Selector Stability (Zustand v5 Requirement)

In v5, selectors must return stable references. Returning new objects, arrays, or functions inline causes infinite loops.

```typescript
// Bad Example - Creates new function on every render (causes infinite loop in v5)
const action = useStore((state) => state.action ?? (() => {}));
```

**Why bad:** Inline fallback `() => {}` creates a new reference every render, causing infinite re-render loops in v5

```typescript
// Good Example - Stable fallback reference
const FALLBACK_ACTION = () => {};

const action = useStore((state) => state.action ?? FALLBACK_ACTION);
```

**Why good:** Named constant provides stable reference, prevents infinite render loops, works correctly with Zustand v5's strict equality checks

---

## Pattern 4: Context API - Dependency Injection ONLY

### Why Context Fails for State

```typescript
// NEVER DO THIS - Context is NOT for state management!
import { createContext, useState } from "react";
import type { ReactNode } from "react";

interface UIContextValue {
  sidebarOpen: boolean;          // This is state!
  setSidebarOpen: (open: boolean) => void;
  modalOpen: boolean;            // This is state!
  setModalOpen: (open: boolean) => void;
  theme: "light" | "dark";       // This changes!
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

### Acceptable Context Usage - Theme Configuration

```typescript
// Good Example - Theme configuration (set once, rarely changes)
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

### Acceptable Context Usage - Database Connection

```typescript
// Good Example - Database connection (singleton)
import { createContext } from "react";
import type { Database } from "./db-types";

const DatabaseContext = createContext<Database | null>(null);

export { DatabaseContext };
```

**Why good:** Database connection is a singleton, never changes after initialization, dependency injection pattern, no re-render concerns

**When to use:** Singletons, dependency injection, values set once at startup.

**When not to use:** Anything that changes based on user interaction.

---

## Pattern 5: URL State for Shareable Filters

### Good Example - URL Params for Filters

```typescript
// app/products/page.tsx
import { useSearchParams } from "next/navigation";

const DEFAULT_PAGE = "1";
const DEFAULT_SORT = "newest";

export const ProductList = () => {
  const searchParams = useSearchParams();

  // Read filter state from URL
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const minPrice = searchParams.get("minPrice") ?? undefined;
  const page = searchParams.get("page") ?? DEFAULT_PAGE;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  // Pass URL params to your data fetching solution
  // const { data } = useGetProducts({ category, search, minPrice, page, sort });

  return <div>...</div>;
};
```

**Why good:** Filters are shareable via URL, browser back/forward works correctly, bookmarkable URLs for specific filter states, SEO-friendly for filtered views, named constants for defaults

### Bad Example - Filter State in useState

```typescript
// Bad Example - Filter state in useState
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
