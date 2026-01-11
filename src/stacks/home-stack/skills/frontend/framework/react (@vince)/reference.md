# React Reference

> Decision frameworks, anti-patterns, and red flags for React development. See [skill.md](skill.md) for core concepts and [examples.md](examples.md) for code examples.

---

## Decision Framework

### When to Use forwardRef

```
Does component need ref access?
├─ YES → Does it expose a DOM element?
│   ├─ YES → Use forwardRef ✓
│   └─ NO → Use useImperativeHandle to expose custom methods
└─ NO → Don't use forwardRef (unnecessary)
```

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

---

## RED FLAGS

### High Priority Issues

- Missing `forwardRef` on components that expose refs (breaks ref usage in parent components)
- Not exposing `className` prop on reusable components (prevents customization and composition)
- Using default exports in component libraries (prevents tree-shaking and violates project conventions)
- Magic numbers in code (use named constants: `const MAX_ITEMS = 100`)
- Missing `displayName` on forwardRef components (breaks React DevTools debugging)

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

- `forwardRef` components need `displayName` set manually (not inferred like regular components)
- Error boundaries don't catch errors in event handlers or async code (use try/catch for those)
- `useCallback` without memoized children adds overhead without benefit
- Icons inherit `currentColor` by default - explicitly setting color breaks theming
- Data-attributes (`data-active="true"`) are useful for styling based on state
- SSR requires checking `typeof window !== "undefined"` before accessing browser APIs
- Styles must be applied via `className` prop, not spread into component

---

## Anti-Patterns

### Missing forwardRef on Interactive Components

Components that expose DOM elements MUST use forwardRef. Without it, parent components cannot manage focus, trigger animations, or integrate with form libraries like react-hook-form.

```typescript
// WRONG - Parent cannot access input ref
export const Input = ({ ...props }) => <input {...props} />;

// CORRECT - Parent can forward refs
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));
Input.displayName = "Input";
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

### Component Checklist

- [ ] Uses `forwardRef` if exposing DOM elements
- [ ] Exposes `className` prop for customization
- [ ] Exposes `style` prop for runtime values
- [ ] Uses named exports (no default exports)
- [ ] Uses named constants for all numbers
- [ ] Has `displayName` set for forwardRef components
- [ ] Uses typed variant props only when 2+ variant dimensions exist
- [ ] Has proper accessibility attributes on interactive elements

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
