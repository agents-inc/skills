# React Reference

> Decision frameworks, anti-patterns, and red flags for React development. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for code examples.

---

## Decision Framework

### When to Accept ref as a Prop (React 19)

```
Does component need ref access?
├─ YES → Does it expose a DOM element?
│   ├─ YES → Add ref to props and pass to element (no forwardRef needed)
│   └─ NO → Use useImperativeHandle to expose custom methods
└─ NO → Don't accept ref prop (unnecessary)
```

> **Note:** React 19 deprecates `forwardRef`. Pass `ref` as a regular prop instead.

### When to Use Variant Props

```
Does component have visual variants?
├─ YES → Are there 2+ variant dimensions (color, size)?
│   ├─ YES → Use typed variant props (TypeScript unions)
│   └─ NO → Consider simple prop with 3+ values
└─ NO → Skip variant props (no complexity needed)
```

### When to Use useCallback

```
Are you passing handler to child?
├─ YES → Is child memoized with React.memo?
│   ├─ YES → Use useCallback
│   └─ NO → Don't use useCallback (no benefit)
└─ NO → Don't use useCallback (unnecessary overhead)
```

### Custom Hook vs Component

```
Is this reusable logic?
├─ YES → Does it render UI?
│   ├─ YES → Component
│   └─ NO → Does it use React hooks?
│       ├─ YES → Custom hook
│       └─ NO → Utility function
└─ NO → Keep inline in component
```

### When to Use React 19 Form Hooks

```
Handling form submission?
├─ YES → Need pending/error state?
│   ├─ YES → Use useActionState
│   └─ NO → Simple form action on <form action={fn}>
├─ Need form status in child components?
│   └─ YES → Use useFormStatus in child component
├─ Need optimistic UI updates?
│   └─ YES → Use useOptimistic
└─ Need to read promise/context conditionally?
    └─ YES → Use use() API
```

---

## Anti-Patterns

### Using forwardRef in React 19

In React 19, `forwardRef` is deprecated. Pass `ref` as a regular prop instead.

```typescript
// WRONG (React 19) - forwardRef is deprecated
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
Input.displayName = "Input";

// CORRECT (React 19) - ref as a regular prop
export function Input({ ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

### Magic Numbers Without Named Constants

All numeric values must be named constants. Magic numbers are unmaintainable, undocumented, and error-prone.

```typescript
// WRONG - Magic number
setTimeout(() => {}, 300);

// CORRECT - Named constant
const DEBOUNCE_DELAY_MS = 300;
setTimeout(() => {}, DEBOUNCE_DELAY_MS);
```

### Missing className Prop on Reusable Components

All reusable components must expose a className prop. Without it, consumers cannot apply custom styles or override defaults.

```typescript
// WRONG - No className prop
export function Card({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// CORRECT - className prop exposed
export function Card({ children, className }: CardProps) {
  return <div className={className}>{children}</div>;
}
```

### Adding Variant Abstractions for Simple Components

Variant props add unnecessary complexity for simple components. Only use when you have 2+ variant dimensions.

```typescript
// WRONG - Variant system for single-style component
type CardVariant = "default";
export function Card({ variant = "default" }: { variant?: CardVariant }) { ... }

// CORRECT - Simple component without variant props
export function Card({ className, children }: CardProps) {
  return <div className={className}>{children}</div>;
}
```

### useFormStatus in the Form Component

`useFormStatus` must be called from a child component rendered inside `<form>`, not the component that renders it.

```typescript
// WRONG - useFormStatus in form component (pending always false)
export function ContactForm({ action }) {
  const { pending } = useFormStatus(); // Will always be false!
  return <form action={action}><button disabled={pending}>Send</button></form>;
}

// CORRECT - useFormStatus in child component
function SubmitButton() {
  const { pending } = useFormStatus(); // Works correctly
  return <button type="submit" disabled={pending}>{pending ? "Sending..." : "Send"}</button>;
}
```

---

## Quick Reference

### Component Checklist (React 19)

- [ ] Accepts `ref` as a regular prop if exposing DOM elements (no forwardRef)
- [ ] Exposes `className` prop for customization
- [ ] Uses named exports (no default exports)
- [ ] Uses named constants for all numbers
- [ ] Uses typed variant props only when 2+ variant dimensions exist
- [ ] Has proper accessibility attributes on interactive elements

### React 19 Form Hooks Checklist

- [ ] Uses `useActionState` for form submissions with pending/error state
- [ ] Uses `useFormStatus` in child components (not in the form component itself)
- [ ] Uses `useOptimistic` for instant UI feedback during async operations
- [ ] Uses `use()` for reading promises/context conditionally

### Hook Checklist

- [ ] Follows `use` prefix naming convention
- [ ] Has proper TypeScript types
- [ ] Has proper dependency arrays
- [ ] Cleans up side effects (timers, subscriptions, observers)
- [ ] Is SSR-safe when accessing browser APIs

### Event Handler Checklist

- [ ] Uses `handle` prefix for internal handlers
- [ ] Has explicit event types
- [ ] Uses named constants for magic numbers
- [ ] Uses `useCallback` only when passing to memoized children
