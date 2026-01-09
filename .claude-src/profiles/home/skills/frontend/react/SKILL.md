---
name: React
description: Component architecture, hooks, patterns
---

# React Components

> **Quick Guide:** Tiered components (Primitives -> Components -> Patterns -> Templates). Use `forwardRef` for ref forwarding. `cva` for type-safe variants. `asChild` pattern for polymorphic components. Expose `className` prop. lucide-react for icons.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

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

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

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
// Good Example - Component follows tier conventions
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
// Good Example - Using cva for components with variants
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

**When not to use:** Simple components without variants (overkill - use SCSS Modules only).

---

### Pattern 3: Icon Usage with lucide-react

Use `lucide-react` for consistent, tree-shakeable icons. Icons inherit color from parent by default.

#### Basic Icon Usage

```tsx
// Good Example - Icon in button with accessibility
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon" title="Expand details" aria-label="Expand details">
  <ChevronDown />
</Button>
```

**Why good:** lucide-react provides tree-shakeable imports reducing bundle size, title attribute shows tooltip on hover, aria-label provides accessible name for screen readers, icon inherits color from button reducing CSS duplication

#### Icon-Only Buttons with Accessibility

```typescript
// Good Example - Accessible icon-only buttons
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
// Good Example - Descriptive event handler names
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

---

### Pattern 5: Custom Hooks

Extract reusable logic into custom hooks following the `use` prefix convention.

Key hooks covered:
- `usePagination` - Pagination state and navigation
- `useDebounce` - Debounce values for search inputs
- `useLocalStorage` - Type-safe localStorage persistence

See [examples.md](examples.md) for complete hook implementations.

---

### Pattern 6: Error Boundaries with Retry

Use Error Boundaries to catch React render errors and provide retry capability.

```typescript
// Good Example - Error boundary with retry and logging
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

**When to use:** Place error boundaries around feature sections, not just the root. Use React Query's error boundaries for data fetching errors.

**When not to use:** Error boundaries don't catch event handler errors, async errors, or SSR errors - use try/catch for those.

</patterns>

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

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `forwardRef` on ALL components that expose refs to DOM elements)**

**(You MUST expose `className` prop on ALL reusable components for customization)**

**(You MUST use named constants for ALL numeric values - NO magic numbers)**

**(You MUST use named exports - NO default exports in component libraries)**

**(You MUST add `displayName` to ALL forwardRef components for React DevTools)**

**Failure to follow these rules will break component composition, prevent tree-shaking, and reduce code maintainability.**

</critical_reminders>
