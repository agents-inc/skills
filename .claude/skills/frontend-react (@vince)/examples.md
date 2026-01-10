# React Examples

> Complete code examples for React component patterns. See [skill.md](skill.md) for core concepts.

---

## Component Architecture Examples

### Good Example - Component follows tier conventions

```typescript
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

### Bad Example - Missing critical patterns

```typescript
export default function Button({ variant, size, onClick, children }) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

**Why bad:** default export prevents tree-shaking and violates project conventions, no ref forwarding breaks focus management and third-party library integrations, no className prop prevents customization, string interpolation for classes is not type-safe and prone to runtime errors, no TypeScript types means no compile-time safety

---

## SCSS Module Examples

### Good Example - Uses design tokens and data-attributes

```scss
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

### Bad Example - Hardcoded values and inline styles

```scss
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

---

## cva Variant Examples

### Good Example - Using cva for components with variants

```typescript
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

### Bad Example - Not using cva when component has variants

```typescript
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

---

## Icon Usage Examples

### Good Example - Icon in button with accessibility

```tsx
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon" title="Expand details" aria-label="Expand details">
  <ChevronDown />
</Button>
```

**Why good:** lucide-react provides tree-shakeable imports reducing bundle size, title attribute shows tooltip on hover, aria-label provides accessible name for screen readers, icon inherits color from button reducing CSS duplication

### Bad Example - Icon without accessibility

```tsx
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon">
  <ChevronDown />
</Button>
```

**Why bad:** missing title means no tooltip for sighted users, missing aria-label means screen readers announce "button" with no context, unusable for keyboard-only and screen reader users

### Good Example - Conditional icon rendering

```typescript
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

### Good Example - Icon sizing with design tokens

```scss
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

### Bad Example - Hardcoded icon sizing and colors

```scss
.icon {
  width: 16px; // Magic number
  height: 16px; // Magic number
  color: #3b82f6; // Hardcoded color
}
```

**Why bad:** magic numbers prevent consistent sizing across components, hardcoded colors break when theme changes, manual color management duplicates effort and causes inconsistencies

### Good Example - Accessible icon-only buttons

```typescript
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

### Good Example - Icons inherit color from parent

```tsx
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

### Bad Example - Manually setting icon colors

```tsx
<Button className={styles.successButton}>
  <CheckCircle className={styles.greenIcon} />
  Save
</Button>
```

**Why bad:** manual color classes create maintenance burden, icons can get out of sync with text color, breaks color consistency in themes

---

## Event Handler Examples

### Good Example - Descriptive event handler names

```typescript
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

### Bad Example - Generic names, unclear purpose

```typescript
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

### Good Example - useCallback with memoized component

```typescript
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

### Bad Example - useCallback without memoized child

```typescript
function SearchBar() {
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  // Input is not memoized, useCallback provides no benefit
  return <input onChange={handleSearch} />;
}
```

**Why bad:** useCallback adds overhead without benefit when child is not memoized, premature optimization that adds complexity, input element re-renders regardless of callback identity

---

## Custom Hook Examples

### usePagination Hook

```typescript
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

### usePagination Usage

```typescript
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

### useDebounce Hook

```typescript
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

### useDebounce Usage with React Query

```typescript
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

### useLocalStorage Hook

```typescript
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

### useLocalStorage Usage

```typescript
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

## Error Boundary Examples

### Good Example - Error boundary with retry and logging

```typescript
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

### Good Example - Error boundary with custom fallback and logging

```typescript
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

### Bad Example - No error boundary

```typescript
function App() {
  return <MainContent />; // One error crashes entire app
}
```

**Why bad:** unhandled render errors crash entire React app, no user feedback when errors occur, no way to recover without page reload
