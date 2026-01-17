# React - Core Examples

> Component architecture, variant props, and event handlers. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [icons.md](icons.md) - lucide-react usage, accessibility, color inheritance
- [hooks.md](hooks.md) - usePagination, useDebounce, useLocalStorage
- [error-boundaries.md](error-boundaries.md) - Error boundary implementation and recovery

---

## Component Architecture Examples

### Good Example - Component follows tier conventions

```typescript
// packages/ui/src/components/button/button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

// Type-safe variant props
export type ButtonVariant = "default" | "ghost" | "link";
export type ButtonSize = "default" | "large" | "icon";

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={className}
        data-variant={variant}
        data-size={size}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
```

**Why good:** forwardRef enables ref forwarding for focus management and DOM access, named export enables tree-shaking and follows project conventions, className prop exposed for custom styling, displayName improves debugging in React DevTools, data-attributes enable styling based on variants

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

## Variant Props Examples

### Good Example - Type-safe variant props

```typescript
import { forwardRef } from "react";

const ANIMATION_DURATION_MS = 200;

// Define variant types explicitly
export type AlertVariant = "info" | "warning" | "error" | "success";
export type AlertSize = "sm" | "md" | "lg";

export type AlertProps = React.ComponentProps<"div"> & {
  variant?: AlertVariant;
  size?: AlertSize;
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "info", size = "md", className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        style={{ transition: `all ${ANIMATION_DURATION_MS}ms ease`, ...style }}
        {...props}
      />
    );
  }
);

Alert.displayName = "Alert";
```

**Why good:** TypeScript union types provide autocomplete for variant values, data-attributes enable CSS styling based on variants, named constant for animation duration prevents magic numbers, forwardRef and displayName follow React conventions

### Bad Example - Untyped variants with string interpolation

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
