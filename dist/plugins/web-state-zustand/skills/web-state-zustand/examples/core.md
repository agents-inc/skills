# Zustand - Core Examples

> Full code for the patterns in [SKILL.md](../SKILL.md). Version facts and the middleware lookup are in [reference.md](../reference.md).

---

## Pattern 1: Store Setup

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
        partialize: (state) => ({ theme: state.theme }),
      },
    ),
  ),
);
```

**Why good:** `devtools` makes every action inspectable, and `partialize` persists the theme preference while leaving transient UI out — a sidebar that remembers being closed across a refresh reads as a bug to the user.

Computed or randomised initial values are set after creation, because v5's `persist` no longer captures initial state at creation time:

```typescript
useUIStore.setState({ theme: detectPreferredTheme() });
```

---

## Pattern 2: Atomic Selectors

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

**Why good:** Subscribes to `toggleSidebar` alone, so theme changes and sidebar toggles never touch this component.

### Bad Example - Destructuring the Whole Store

```typescript
export const Header = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  return <header>...</header>;
};
```

**Why bad:** No selector means a subscription to every field, so the component re-renders on any store update.

---

## Pattern 3: useShallow for Multiple Values

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

**Why good:** `useShallow` compares the returned object field by field, so a fresh object with identical values does not re-render.

Below three values, separate atomic selectors are simpler and skip the comparison entirely.

### Selector Stability

A selector that builds a new reference each call loops forever in v5:

```typescript
// BAD - a new function every render
const action = useStore((state) => state.action ?? (() => {}));

// GOOD - one stable fallback
const FALLBACK_ACTION = () => {};
const action = useStore((state) => state.action ?? FALLBACK_ACTION);
```

---

## Pattern 4: Context for Injection, Not State

### Bad Example - State in Context

```typescript
import { createContext, useState } from "react";
import type { ReactNode } from "react";

interface UIContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <UIContext.Provider value={{ sidebarOpen, setSidebarOpen, theme, setTheme }}>
      {children}
    </UIContext.Provider>
  );
}
```

**Why bad:** A fresh value object every render re-renders every consumer, and Context offers no way to subscribe to one field — toggling the sidebar re-renders components that only read the theme.

### Good Example - A Singleton Nothing Mutates

```typescript
import { createContext } from "react";
import type { Database } from "./db-types";

const DatabaseContext = createContext<Database | null>(null);

export { DatabaseContext };
```

**Why good:** Set once at initialisation and never reassigned, so the re-render cost never arises. This is injection, not state.

---

## Pattern 5: URL State for Shareable Filters

```typescript
// Read through your router's searchParams API where you have one.
const DEFAULT_PAGE = "1";
const DEFAULT_SORT = "newest";

export const ProductList = () => {
  const searchParams = new URLSearchParams(window.location.search);

  const category = searchParams.get("category") ?? undefined;
  const page = searchParams.get("page") ?? DEFAULT_PAGE;
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;

  return <div>...</div>;
};
```

**Why good:** The filtered view is bookmarkable and the back button steps through filter changes. The same state in a store or in `useState` is reachable only by repeating the clicks.

Params arrive as strings, so numbers and booleans need parsing before use.
