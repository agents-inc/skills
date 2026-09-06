# React — Core Examples

> Component shape, variant props, event handlers, accessible controls. See [SKILL.md](../SKILL.md) for the decisions and [reference.md](../reference.md) for the decision trees.

**Additional Examples:**

- [hooks.md](hooks.md) — usePagination, useDebounce, useLocalStorage
- [react-19-hooks.md](react-19-hooks.md) — useActionState, useFormStatus, useOptimistic, use(), ref cleanup

---

## Pattern 1: Component shape

### Good — ref as a regular prop

```typescript
export type ButtonVariant = "default" | "ghost" | "link";
export type ButtonSize = "default" | "large" | "icon";

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Button({
  variant = "default",
  size = "default",
  className,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      className={className}
      data-variant={variant}
      data-size={size}
      ref={ref}
      {...props}
    />
  );
}
```

**Why good:** `ref` arrives as a prop with no wrapper, `className` leaves styling to the consumer, and `data-*` attributes let any CSS layer select on the variant. Spreading `React.ComponentProps<"button">` means every native button attribute passes through unlisted.

### Bad — forwardRef

```typescript
import { forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => {
    return <button className={className} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";
```

**Why bad:** the wrapper and its manual `displayName` do nothing React 19 does not do for a plain prop.

### Bad — no seams at all

```typescript
export default function Button({ variant, size, onClick, children }) {
  return (
    <button className={`btn btn-${variant} btn-${size}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

**Why bad:** no `ref` breaks focus management and any library that needs the node; no `className` leaves the consumer unable to style it; interpolated class strings are unchecked, so a typo survives to runtime; untyped props catch nothing at compile time.

---

## Pattern 2: Typed variant props

### Good — union types and data attributes

```typescript
const ANIMATION_DURATION_MS = 200;

export type AlertVariant = "info" | "warning" | "error" | "success";
export type AlertSize = "sm" | "md" | "lg";

export type AlertProps = React.ComponentProps<"div"> & {
  variant?: AlertVariant;
  size?: AlertSize;
  ref?: React.Ref<HTMLDivElement>;
};

export function Alert({
  variant = "info",
  size = "md",
  className,
  style,
  ref,
  ...props
}: AlertProps) {
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
```

**Why good:** the unions give autocomplete and reject an unknown variant at compile time, and the caller's own `style` spreads last so it can override the transition.

### Bad — untyped variants in an interpolated class

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

**Why bad:** a misspelled variant compiles and produces a class nobody styled; `${className}` renders the string `undefined` when the prop is absent.

---

## Pattern 3: Event handler naming

### Good — descriptive names, typed events

```typescript
import type { FormEvent, ChangeEvent } from "react";

const MIN_PRICE = 0;

function ProductForm() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

**Why good:** the name says which field changed, and the event type makes `e.target.value` checked rather than `any`.

### Bad — generic names, untyped events

```typescript
function ProductForm() {
  const submit = (e) => { /* ... */ };
  const change = (e) => { /* ... */ };
  const blur = () => {
    if (price < 0) {
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

**Why bad:** `change` names nothing when a second field arrives, and an untyped `e` accepts any property access.

### useCallback — when it pays

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

**Why good:** the child is memoised, so a stable callback identity is what keeps it from re-rendering.

```typescript
function SearchBar() {
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  return <input onChange={handleSearch} />;
}
```

**Why bad:** a DOM element re-renders regardless of callback identity, so the wrapper is pure overhead.

---

## Accessible names on icon-only controls

### Good — icon button with an accessible name

```tsx
<button
  type="button"
  title="Expand details"
  aria-label="Expand details"
  onClick={handleToggle}
>
  {isExpanded ? (
    <span aria-hidden="true">&#9650;</span>
  ) : (
    <span aria-hidden="true">&#9660;</span>
  )}
</button>
```

**Why good:** `aria-label` names the control for assistive technology, `title` gives sighted users the same text on hover, and `aria-hidden` stops the glyph being announced twice.

### Bad — glyph with no name

```tsx
<button onClick={handleToggle}>
  <span>&#9660;</span>
</button>
```

**Why bad:** the accessible name becomes the glyph, so the control is announced as an unlabelled button.
