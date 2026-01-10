# Client State - Code Examples

All code examples for client state management patterns with good/bad comparisons.

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

**Why bad:** Server data belongs in React Query not client state, no caching strategy means duplicate requests, no automatic refetch on window focus, manually managing loading/error states that React Query handles automatically

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

### Shallow Comparison Pattern

```typescript
import { useUIStore } from "../stores/ui-store";
import { shallow } from "zustand/shallow";

// Bad Example - Will re-render on ANY store change
export const Header = () => {
  const { sidebarOpen, modalOpen, theme } = useUIStore();
  return <header>...</header>;
};
```

**Why bad:** Component subscribes to entire store, re-renders when ANY value changes even if component doesn't use those values, causes unnecessary re-renders and performance issues at scale

```typescript
// Good Example - Only re-renders when selected values change
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

  // Pass URL params to React Query for data fetching
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

---

## Pattern 6: Form State and Validation

### Controlled Component Pattern

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

### Zod Schema Validation

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
