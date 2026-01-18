# React Reference

> Decision frameworks, anti-patterns, and red flags for React development. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for code examples.

---

## Decision Framework

### When to Accept ref as a Prop (React 19)

```
Does component need ref access?
├─ YES → Does it expose a DOM element?
│   ├─ YES → Add ref to props and pass to element (no forwardRef needed) ✓
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

### When to Use React 19 Form Hooks

```
Handling form submission?
├─ YES → Need pending/error state?
│   ├─ YES → Use useActionState ✓
│   └─ NO → Simple form action on <form action={fn}>
├─ Need form status in child components?
│   └─ YES → Use useFormStatus in child component ✓
├─ Need optimistic UI updates?
│   └─ YES → Use useOptimistic ✓
└─ Need to read promise/context conditionally?
    └─ YES → Use use() API ✓
```

---

## RED FLAGS

### High Priority Issues

- **Using `forwardRef` in React 19** - deprecated; pass `ref` as a regular prop instead
- Not exposing `className` prop on reusable components (prevents customization and composition)
- Using default exports in component libraries (prevents tree-shaking and violates project conventions)
- Magic numbers in code (use named constants: `const MAX_ITEMS = 100`)
- Using `useState` for form pending/error when `useActionState` exists (unnecessary boilerplate)
- Calling `useFormStatus` in the same component as `<form>` (won't work - must be child component)

### Medium Priority Issues

- Adding variant abstractions for components without variants (over-engineering)
- Using useCallback on every handler regardless of child memoization (premature optimization)
- Inline event handlers in JSX when passing to memoized children (causes unnecessary re-renders)
- Generic event handler names (`click`, `change`) instead of descriptive names
- Not exposing style prop alongside className for runtime values

### Common Mistakes

- Not typing event handlers explicitly (leads to runtime errors)
- Using string interpolation for class names (error-prone)
- Missing accessibility attributes on icon-only buttons (`title`, `aria-label`)
- Hardcoding icon colors instead of using `currentColor` inheritance
- No error boundaries around features (one error crashes entire app)

### Gotchas & Edge Cases

- **React 19**: `forwardRef` is deprecated - pass `ref` as a regular prop directly
- **React 19**: `use()` cannot be called in try-catch blocks - use Error Boundaries instead
- **React 19**: `useFormStatus` must be called from a child component inside `<form>`, not the form component itself
- **React 19**: Ref cleanup functions - return a cleanup function from ref callbacks instead of using `useEffect`
- Error boundaries don't catch errors in event handlers or async code (use try/catch for those)
- `useCallback` without memoized children adds overhead without benefit
- Icons inherit `currentColor` by default - explicitly setting color breaks theming
- Data-attributes (`data-active="true"`) are useful for styling based on state
- SSR requires checking `typeof window !== "undefined"` before accessing browser APIs
- Styles must be applied via `className` prop, not spread into component

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

### Default Exports in Component Libraries

Default exports prevent tree-shaking and violate project conventions. They also make imports inconsistent across the codebase.

```typescript
// WRONG - Default export
export default function Button() { ... }

// CORRECT - Named export
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
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
export const Card = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

// CORRECT - className prop exposed
export const Card = ({ children, className }: CardProps) => (
  <div className={className}>{children}</div>
);
```

### Adding Variant Abstractions for Simple Components

Variant props add unnecessary complexity for simple components. Only use when you have 2+ variant dimensions.

```typescript
// WRONG - Variant system for single-style component
type CardVariant = "default";
export const Card = ({ variant = "default" }: { variant?: CardVariant }) => ...

// CORRECT - Simple component without variant props
export const Card = ({ className, children }: CardProps) => (
  <div className={className}>{children}</div>
);
```

---

## Quick Reference

### Component Checklist (React 19)

- [ ] Accepts `ref` as a regular prop if exposing DOM elements (no forwardRef)
- [ ] Exposes `className` prop for customization
- [ ] Exposes `style` prop for runtime values
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
- [ ] Cleans up side effects (timers, subscriptions)
- [ ] Is SSR-safe when accessing browser APIs

### Event Handler Checklist

- [ ] Uses `handle` prefix for internal handlers
- [ ] Has explicit event types
- [ ] Uses named constants for magic numbers
- [ ] Uses `useCallback` only when passing to memoized children
