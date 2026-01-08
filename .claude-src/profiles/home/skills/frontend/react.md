---
name: React
description: Component architecture, hooks, patterns
---

# React Components

> **Quick Guide:** Tiered components (Primitives → Components → Patterns → Templates). Use `forwardRef` for ref forwarding. `cva` for type-safe variants. `asChild` pattern for polymorphic components. Expose `className` prop. lucide-react for icons.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `forwardRef` on ALL components that expose refs to DOM elements)**

**(You MUST expose `className` prop on ALL reusable components for customization)**

**(You MUST use named constants for ALL numeric values - NO magic numbers)**

**(You MUST use named exports - NO default exports in component libraries)**

**(You MUST add `displayName` to ALL forwardRef components for React DevTools)**

</critical_requirements>

---

**Auto-detection:** React components, component patterns, icon usage, cva, forwardRef

**When to use:**

- Building React components
- Implementing component variants with cva
- Working with icons in components
- Understanding component architecture

**Key patterns covered:**

- Component architecture tiers
- forwardRef and cva patterns
- Icon usage with lucide-react
- Custom hooks for common patterns
- Error boundaries with retry

**When NOT to use:**

- Simple one-off components without variants (skip cva, use SCSS Modules only)
- Components that don't need refs (skip forwardRef)
- Static content without interactivity (consider static HTML)

---

<philosophy>

## Philosophy

React components follow a tiered architecture from low-level primitives to high-level templates. Components should be composable, type-safe, and expose necessary customization points (`className`, refs). Use `cva` only when components have multiple variants to avoid over-engineering.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Component Architecture Tiers

React components are organized in a tiered hierarchy from low-level building blocks to high-level page layouts.

#### Tier Structure

1. **Primitives** (`src/primitives/`) - Low-level building blocks (skeleton)
2. **Components** (`src/components/`) - Reusable UI (button, switch, select)
3. **Patterns** (`src/patterns/`) - Composed patterns (feature, navigation)
4. **Templates** (`src/templates/`) - Page layouts (frame)

#### Implementation Guidelines

```typescript
// ✅ Good Example - Component follows tier conventions
// packages/ui/src/components/button/button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import styles from "./button.module.scss";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: clsx(styles.btn, styles.btnDefault),
      ghost: clsx(styles.btn, styles.btnGhost),
      link: clsx(styles.btn, styles.btnLink),
    },
    size: {
      default: clsx(styles.btn, styles.btnSizeDefault),
      large: clsx(styles.btn, styles.btnSizeLarge),
      icon: clsx(styles.btn, styles.btnSizeIcon),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={clsx(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
```

**Why good:** forwardRef enables ref forwarding for focus management and DOM access, named export enables tree-shaking and follows project conventions, className prop exposed for custom styling, displayName improves debugging in React DevTools

```typescript
// ❌ Bad Example - Missing critical patterns
export default function Button({ variant, size, onClick, children }) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

**Why bad:** default export prevents tree-shaking and violates project conventions, no ref forwarding breaks focus management and third-party library integrations, no className prop prevents customization, string interpolation for classes is not type-safe and prone to runtime errors, no TypeScript types means no compile-time safety

#### SCSS Module Structure

```scss
// ✅ Good Example - Uses design tokens and data-attributes
// packages/ui/src/components/button/button.module.scss
.btn {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: var(--text-size-body);
  font-weight: 600;

  border-radius: var(--radius-sm);
  border: 1px solid transparent;

  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btnDefault {
  background-color: var(--color-surface-base);
  color: var(--color-text-default);
  border-color: var(--color-surface-subtle);

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }

  &[data-active="true"] {
    color: var(--color-text-muted);
    background: var(--color-surface-strong);
  }
}

.btnGhost {
  background-color: transparent;

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }
}

.btnSizeDefault {
  padding: var(--space-md);
}

.btnSizeLarge {
  padding: var(--space-xlg) var(--space-xxlg);
}

.btnSizeIcon {
  padding: var(--space-md);
  aspect-ratio: 1;
}
```

**Why good:** design tokens ensure consistency across components, data-attributes for state styling separate state from presentation, scoped styles prevent global namespace pollution

```scss
// ❌ Bad Example - Hardcoded values and inline styles
.button {
  padding: 12px 24px; // Magic numbers
  background: #3b82f6; // Hardcoded color
  border-radius: 8px; // Magic number
}

.button.active {
  background: #2563eb; // className toggling for state
}
```

**Why bad:** hardcoded values prevent theme switching and break design system consistency, magic numbers are unmaintainable and inconsistent across components, className toggling for state is harder to manage than data-attributes

**When to use:** All reusable React components in the component library.

---

### Pattern 2: Component Variants with cva

Use `cva` (class-variance-authority) for type-safe component variants. Only use when component has multiple variants (size, color, etc.).

#### When to Use cva

- Component has 2+ visual variants (default, ghost, outline)
- Component has 2+ size variants (sm, md, lg)
- Need type-safe variant props
- Need compound variants (combinations of variants)

#### Implementation

```typescript
// ✅ Good Example - Using cva for components with variants
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import styles from "./alert.module.scss";

const ANIMATION_DURATION_MS = 200;

const alertVariants = cva("alert", {
  variants: {
    variant: {
      info: clsx(styles.alert, styles.alertInfo),
      warning: clsx(styles.alert, styles.alertWarning),
      error: clsx(styles.alert, styles.alertError),
      success: clsx(styles.alert, styles.alertSuccess),
    },
    size: {
      sm: clsx(styles.alert, styles.alertSm),
      md: clsx(styles.alert, styles.alertMd),
      lg: clsx(styles.alert, styles.alertLg),
    },
  },
  defaultVariants: {
    variant: "info",
    size: "md",
  },
});

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>;

export const Alert = ({ variant, size, className, ...props }: AlertProps) => {
  return (
    <div
      className={clsx(alertVariants({ variant, size, className }))}
      style={{ transition: `all ${ANIMATION_DURATION_MS}ms ease` }}
      {...props}
    />
  );
};
```

**Why good:** cva provides type-safe variant props with autocomplete, defaultVariants prevent undefined behavior, named constant for animation duration prevents magic numbers, VariantProps extracts correct TypeScript types from cva definition

```typescript
// ❌ Bad Example - Not using cva when component has variants
export const Alert = ({ variant = "info", size = "md", className, ...props }) => {
  return (
    <div
      className={`alert alert-${variant} alert-${size} ${className}`}
      style={{ transition: 'all 200ms ease' }}
      {...props}
    />
  );
};
```

**Why bad:** no type safety means typos compile but break at runtime, string interpolation is error-prone and hard to refactor, magic number 200 is not discoverable or maintainable, no TypeScript autocomplete for variant values

**When not to use:** Simple components without variants (overkill - use SCSS Modules only).

---

### Pattern 3: Icon Usage with lucide-react

Use `lucide-react` for consistent, tree-shakeable icons. Icons inherit color from parent by default.

#### Constants

```typescript
// Design token for icon sizing (defined in design system)
// --text-size-icon: 16px
```

#### Basic Icon Usage

```tsx
// ✅ Good Example - Icon in button with accessibility
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon" title="Expand details" aria-label="Expand details">
  <ChevronDown />
</Button>
```

**Why good:** lucide-react provides tree-shakeable imports reducing bundle size, title attribute shows tooltip on hover, aria-label provides accessible name for screen readers, icon inherits color from button reducing CSS duplication

```tsx
// ❌ Bad Example - Icon without accessibility
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon">
  <ChevronDown />
</Button>
```

**Why bad:** missing title means no tooltip for sighted users, missing aria-label means screen readers announce "button" with no context, unusable for keyboard-only and screen reader users

#### Icon in Component Pattern

```typescript
// ✅ Good Example - Conditional icon rendering
// packages/ui/src/patterns/feature/feature.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/button/button";
import styles from "./feature.module.scss";

export const Feature = ({ id, title, description, status }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li onClick={() => setIsExpanded(!isExpanded)}>
      <h2>{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        className={styles.expandButton}
        aria-label={isExpanded ? "Collapse details" : "Expand details"}
      >
        {isExpanded ? (
          <ChevronUp className={styles.icon} />
        ) : (
          <ChevronDown className={styles.icon} />
        )}
      </Button>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
```

**Why good:** dynamic aria-label accurately describes current state, conditional icon rendering provides visual feedback, className prop on icon enables consistent sizing via design tokens

#### Icon Styling

```scss
// ✅ Good Example - Icon sizing with design tokens
// packages/ui/src/patterns/feature/feature.module.scss
.expandButton {
  // Button already has proper sizing
  // Icon inherits color from button
}

.icon {
  // Use design token for consistent sizing
  width: var(--text-size-icon); // 16px
  height: var(--text-size-icon);
}
```

**Why good:** design token ensures consistent icon sizing across all components, color inheritance via currentColor keeps icons synced with text color

```scss
// ❌ Bad Example - Hardcoded icon sizing and colors
.icon {
  width: 16px; // Magic number
  height: 16px; // Magic number
  color: #3b82f6; // Hardcoded color
}
```

**Why bad:** magic numbers prevent consistent sizing across components, hardcoded colors break when theme changes, manual color management duplicates effort and causes inconsistencies

#### Icon-Only Buttons with Accessibility

```typescript
// ✅ Good Example - Accessible icon-only buttons
import { CircleUserRound, CodeXml } from "lucide-react";
import { Button } from "../../components/button/button";

const GITHUB_URL = "https://github.com/username";
const BLOG_URL = "https://blog.example.com";

export const Socials = () => {
  return (
    <ul>
      <li>
        <Button
          size="icon"
          title="View GitHub profile"
          aria-label="View GitHub profile"
          onClick={() => window.open(GITHUB_URL, "_blank")}
        >
          <CodeXml />
        </Button>
      </li>
      <li>
        <Button
          size="icon"
          title="Visit blog"
          aria-label="Visit blog"
          onClick={() => window.open(BLOG_URL, "_blank")}
        >
          <CircleUserRound />
        </Button>
      </li>
    </ul>
  );
};
```

**Why good:** both title and aria-label provide accessibility for different user needs, named constants for URLs prevent magic strings, title shows tooltip on hover, aria-label provides context for screen readers

#### Icon Color Inheritance

```tsx
// ✅ Good Example - Icons inherit color from parent
<Button className={styles.successButton}>
  <CheckCircle />  {/* Icon inherits green color */}
  Save
</Button>

<Button className={styles.errorButton}>
  <XCircle />  {/* Icon inherits red color */}
  Delete
</Button>
```

**Why good:** using currentColor keeps icon colors synced with text, reduces CSS duplication, automatic color consistency across themes

```tsx
// ❌ Bad Example - Manually setting icon colors
<Button className={styles.successButton}>
  <CheckCircle className={styles.greenIcon} />
  Save
</Button>
```

**Why bad:** manual color classes create maintenance burden, icons can get out of sync with text color, breaks color consistency in themes

---

### Pattern 4: Event Handler Naming Conventions

Use descriptive event handler names with `handle` prefix for internal handlers and `on` prefix for callback props.

#### Naming Rules

- `handle` prefix for internal handlers: `handleClick`, `handleSubmit`, `handleChange`
- `on` prefix for callback props: `onClick`, `onSubmit`, `onChange`
- Include the element or action: `handleNameChange`, `handlePriceBlur`
- Type events explicitly: `FormEvent<HTMLFormElement>`, `ChangeEvent<HTMLInputElement>`

#### Implementation

```typescript
// ✅ Good Example - Descriptive event handler names
import type { FormEvent, ChangeEvent } from "react";

const MIN_PRICE = 0;

function ProductForm() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Submit logic
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handlePriceBlur = () => {
    if (price < MIN_PRICE) {
      setPrice(MIN_PRICE);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleNameChange} />
      <input onBlur={handlePriceBlur} />
    </form>
  );
}
```

**Why good:** descriptive names make code self-documenting, explicit event types catch errors at compile time, named constant MIN_PRICE prevents magic number, handle prefix clearly identifies internal event handlers

```typescript
// ❌ Bad Example - Generic names, unclear purpose
function ProductForm() {
  const submit = (e) => { /* ... */ };
  const change = (e) => { /* ... */ };
  const blur = () => {
    if (price < 0) { // Magic number
      setPrice(0);
    }
  };

  return (
    <form onSubmit={submit}>
      <input onChange={change} />
      <input onBlur={blur} />
    </form>
  );
}
```

**Why bad:** generic names don't describe what changes or what submits, no event types means runtime errors only, magic number 0 has no context, missing handle prefix creates ambiguity about function purpose

#### useCallback for Handlers with Memoized Children

```typescript
// ✅ Good Example - useCallback with memoized component
import { useCallback } from "react";
import type { Job } from "./types";

const MemoizedJobList = React.memo(JobList);

function JobBoard() {
  const handleJobClick = useCallback((job: Job) => {
    openDrawer(job.id);
  }, [openDrawer]);

  return <MemoizedJobList jobs={jobs} onJobClick={handleJobClick} />;
}
```

**Why good:** useCallback prevents function recreation on every render, memoized child component won't re-render unnecessarily, performance optimization has measurable impact with memoized children

```typescript
// ❌ Bad Example - useCallback without memoized child
function SearchBar() {
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  // Input is not memoized, useCallback provides no benefit
  return <input onChange={handleSearch} />;
}
```

**Why bad:** useCallback adds overhead without benefit when child is not memoized, premature optimization that adds complexity, input element re-renders regardless of callback identity

**When to use:** Only use useCallback when passing handlers to memoized components or expensive child trees.

---

### Pattern 5: Custom Hooks

Extract reusable logic into custom hooks following the `use` prefix convention.

#### usePagination Hook

```typescript
// ✅ Good Example - Reusable pagination hook
import { useState, useMemo } from "react";

const DEFAULT_INITIAL_PAGE = 1;

interface UsePaginationProps {
  totalItems: number;
  itemsPerPage: number;
  initialPage?: number;
}

export function usePagination({
  totalItems,
  itemsPerPage,
  initialPage = DEFAULT_INITIAL_PAGE
}: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.ceil(totalItems / itemsPerPage),
    [totalItems, itemsPerPage]
  );

  const startIndex = useMemo(
    () => (currentPage - 1) * itemsPerPage,
    [currentPage, itemsPerPage]
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + itemsPerPage, totalItems),
    [startIndex, itemsPerPage, totalItems]
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage: () => setCurrentPage(1),
    goToLastPage: () => setCurrentPage(totalPages),
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
```

**Why good:** encapsulates pagination logic for reuse across components, memoized calculations prevent unnecessary re-computation, complete API with all common pagination operations, named constant for default page value

#### Hook Usage

```typescript
// ✅ Good Example - Using pagination hook
import type { Product } from "./types";

const ITEMS_PER_PAGE = 10;

function ProductList({ products }: { products: Product[] }) {
  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: products.length,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const visibleProducts = products.slice(startIndex, endIndex);

  return (
    <div>
      <ul>
        {visibleProducts.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
      <div>
        <button onClick={() => goToPage(currentPage - 1)} disabled={!hasPrevPage}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={() => goToPage(currentPage + 1)} disabled={!hasNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}
```

**Why good:** hook extracts all pagination complexity from component, named constant for items per page, declarative API makes component code readable

#### useDebounce Hook

```typescript
// ✅ Good Example - Debounce hook for search inputs
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Why good:** generic type parameter makes hook reusable with any value type, cleanup function prevents memory leaks, proper dependency array ensures correct behavior

#### useDebounce Usage with React Query

```typescript
// ✅ Good Example - Debounced search with React Query
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const DEBOUNCE_DELAY_MS = 500;
const MIN_SEARCH_LENGTH = 0;

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY_MS);

  const { data } = useQuery({
    queryKey: ["search", debouncedSearchTerm],
    queryFn: () => searchAPI(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length > MIN_SEARCH_LENGTH,
  });

  return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
}
```

**Why good:** debounce prevents excessive API calls, named constants for delay and minimum length, enabled option prevents unnecessary queries for empty search

#### useLocalStorage Hook

```typescript
// ✅ Good Example - Type-safe localStorage persistence
import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

**Why good:** SSR-safe with window check, error handling prevents crashes, supports functional updates like useState, generic type provides type safety

#### useLocalStorage Usage

```typescript
// ✅ Good Example - Theme persistence
function Settings() {
  const [theme, setTheme] = useLocalStorage("theme", "light");

  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      Toggle theme: {theme}
    </button>
  );
}
```

**Why good:** theme persists across page reloads, type-safe theme values, simple API matches useState

---

### Pattern 6: Error Boundaries with Retry

Use Error Boundaries to catch React render errors and provide retry capability.

#### Implementation

```typescript
// ✅ Good Example - Error boundary with retry and logging
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: "red", marginTop: "1rem" }}>{this.state.error.message}</pre>
          <Button onClick={this.reset} style={{ marginTop: "1rem" }}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Why good:** catches render errors preventing full app crashes, retry capability allows recovery from transient errors, custom fallback prop enables branded error UI, onError callback enables error tracking integration

#### Error Boundary Usage

```typescript
// ✅ Good Example - Error boundary with custom fallback and logging
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h1>Oops!</h1>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
  onError={(error) => {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    console.error("Error tracked:", error);
  }}
>
  <App />
</ErrorBoundary>
```

**Why good:** custom fallback provides branded error experience, onError integration sends errors to monitoring service, retry button improves UX for transient failures

```typescript
// ❌ Bad Example - No error boundary
function App() {
  return <MainContent />; // One error crashes entire app
}
```

**Why bad:** unhandled render errors crash entire React app, no user feedback when errors occur, no way to recover without page reload

**When to use:** Place error boundaries around feature sections, not just the root. Use React Query's error boundaries for data fetching errors.

**When not to use:** Error boundaries don't catch event handler errors, async errors, or SSR errors - use try/catch for those.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Use forwardRef

```
Does component need ref access?
├─ YES → Does it expose a DOM element?
│   ├─ YES → Use forwardRef ✓
│   └─ NO → Use useImperativeHandle to expose custom methods
└─ NO → Don't use forwardRef (unnecessary)
```

### When to Use cva

```
Does component have variants?
├─ YES → Are there 2+ variant dimensions (color, size)?
│   ├─ YES → Use cva ✓
│   └─ NO → Consider cva only if 3+ values in single dimension
└─ NO → Don't use cva (use SCSS Modules only)
```

### When to Use useCallback

```
Are you passing handler to child?
├─ YES → Is child memoized with React.memo?
│   ├─ YES → Use useCallback ✓
│   └─ NO → Don't use useCallback (no benefit)
└─ NO → Don't use useCallback (unnecessary overhead)
```

### Custom Hook vs Component

```
Is this reusable logic?
├─ YES → Does it render UI?
│   ├─ YES → Component
│   └─ NO → Does it use React hooks?
│       ├─ YES → Custom hook ✓
│       └─ NO → Utility function
└─ NO → Keep inline in component
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **SCSS Modules**: All React components use SCSS Modules for styling
- **cva**: Type-safe variant management for components with multiple variants
- **Radix UI**: Primitives like `Slot` for polymorphic components
- **lucide-react**: Icon library for consistent iconography
- **React Query**: State management for server data (separate from component state)
- **Zustand**: Global client state management (separate from local component state)

**Component State vs Global State:**

- Use local component state (`useState`) for UI-only state
- Use Zustand for global client state needed across components
- Use React Query for all server data

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Missing `forwardRef` on components that expose refs (breaks ref usage in parent components)
- ❌ Not exposing `className` prop on reusable components (prevents customization and composition)
- ❌ Using default exports in component libraries (prevents tree-shaking and violates project conventions)
- ❌ Magic numbers in code (use named constants: `const MAX_ITEMS = 100`)
- ❌ Missing `displayName` on forwardRef components (breaks React DevTools debugging)

**Medium Priority Issues:**

- ⚠️ Using cva for components without variants (over-engineering - use SCSS Modules only)
- ⚠️ Hardcoding styles instead of using design tokens (breaks theme consistency)
- ⚠️ Using useCallback on every handler regardless of child memoization (premature optimization)
- ⚠️ Inline event handlers in JSX when passing to memoized children (causes unnecessary re-renders)
- ⚠️ Generic event handler names (`click`, `change`) instead of descriptive names

**Common Mistakes:**

- Not typing event handlers explicitly (leads to runtime errors)
- Using string interpolation for class names instead of `clsx` (error-prone and not type-safe)
- Missing accessibility attributes on icon-only buttons (`title`, `aria-label`)
- Hardcoding icon colors instead of using `currentColor` inheritance
- No error boundaries around features (one error crashes entire app)

**Gotchas & Edge Cases:**

- `forwardRef` components need `displayName` set manually (not inferred like regular components)
- Error boundaries don't catch errors in event handlers or async code (use try/catch for those)
- `useCallback` without memoized children adds overhead without benefit
- Icons inherit `currentColor` by default - explicitly setting color breaks theming
- SCSS Module class names must be applied via `className` prop, not spread into component
- Data-attributes (`data-active="true"`) are better than className toggling for state styling
- SSR requires checking `typeof window !== "undefined"` before accessing browser APIs

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### ❌ Missing forwardRef on Interactive Components

Components that expose DOM elements MUST use forwardRef. Without it, parent components cannot manage focus, trigger animations, or integrate with form libraries like react-hook-form.

```typescript
// ❌ WRONG - Parent cannot access input ref
export const Input = ({ ...props }) => <input {...props} />;

// ✅ CORRECT - Parent can forward refs
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
Input.displayName = "Input";
```

### ❌ Default Exports in Component Libraries

Default exports prevent tree-shaking and violate project conventions. They also make imports inconsistent across the codebase.

```typescript
// ❌ WRONG - Default export
export default function Button() { ... }

// ✅ CORRECT - Named export
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
```

### ❌ Magic Numbers Without Named Constants

All numeric values must be named constants. Magic numbers are unmaintainable, undocumented, and error-prone.

```typescript
// ❌ WRONG - Magic number
setTimeout(() => {}, 300);

// ✅ CORRECT - Named constant
const DEBOUNCE_DELAY_MS = 300;
setTimeout(() => {}, DEBOUNCE_DELAY_MS);
```

### ❌ Missing className Prop on Reusable Components

All reusable components must expose a className prop. Without it, consumers cannot apply custom styles or override defaults.

```typescript
// ❌ WRONG - No className prop
export const Card = ({ children }) => (
  <div className={styles.card}>{children}</div>
);

// ✅ CORRECT - className prop merged
export const Card = ({ children, className }) => (
  <div className={clsx(styles.card, className)}>{children}</div>
);
```

### ❌ Using cva for Components Without Variants

cva adds unnecessary complexity for simple components. Only use when you have 2+ variant dimensions.

```typescript
// ❌ WRONG - cva for single-style component
const cardStyles = cva("card", { variants: {} });

// ✅ CORRECT - SCSS Modules only
import styles from "./card.module.scss";
<div className={styles.card}>...</div>
```

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `forwardRef` on ALL components that expose refs to DOM elements)**

**(You MUST expose `className` prop on ALL reusable components for customization)**

**(You MUST use named constants for ALL numeric values - NO magic numbers)**

**(You MUST use named exports - NO default exports in component libraries)**

**(You MUST add `displayName` to ALL forwardRef components for React DevTools)**

**Failure to follow these rules will break component composition, prevent tree-shaking, and reduce code maintainability.**

</critical_reminders>
