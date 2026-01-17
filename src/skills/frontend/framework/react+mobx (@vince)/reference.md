# React Component Reference

> Decision frameworks, anti-patterns, and red flags for React development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) folder for code examples.

---

## Decision Framework

### When to Use observer()

```
Does component read MobX observable state?
├─ YES → Wrap with observer() ✓
└─ NO → Standard component (no wrapper needed)
```

### When to Use useTranslation vs t()

```
Is this a React component?
├─ YES → Use useTranslation() hook ✓
└─ NO → Is it a hook that could be in component context?
    ├─ YES → Use useTranslation() hook ✓
    └─ NO → Use direct t() import
```

### When to Use useEffect

```
Is the side effect in response to MobX state change?
├─ YES → Use reaction() in store instead
└─ NO → Is it synchronizing with external system?
    ├─ YES → useEffect is appropriate ✓
    └─ NO → Is it cleanup (event listeners, subscriptions)?
        ├─ YES → useEffect is appropriate ✓
        └─ NO → Evaluate if effect is needed at all
```

### When to Add displayName

```
Is component wrapped with observer()?
├─ YES → Add displayName ✓
└─ NO → Is component wrapped with forwardRef()?
    ├─ YES → Add displayName ✓
    └─ NO → displayName optional (name inferred)
```

### Type vs Interface

```
Defining props or local types?
├─ Use type ✓ (ESLint enforced)
└─ Exception: Declaration merging in .d.ts files → interface allowed
```

---

## RED FLAGS

### High Priority Issues

- Missing `observer()` wrapper on components reading MobX state (component won't re-render)
- Using `interface` for props (ESLint error - use `type`)
- Hardcoded user-facing text without translation (blocks internationalization)
- Passing stores as props instead of using singleton (breaks reactive chain)
- Default exports except App.tsx (prevents tree-shaking)

### Medium Priority Issues

- Missing `displayName` on observer/forwardRef components (breaks DevTools debugging)
- Using `useEffect` to sync MobX state (creates duplicate reactive system)
- Using `useMemo` for MobX derived state (redundant - use computed in store)
- Using `t` import in components instead of `useTranslation()` hook (won't react to language changes)
- Using lucide-react instead of @photoroom/icons (inconsistent with design system)

### Common Mistakes

- Syncing MobX state to local state with useState (unnecessary - read directly)
- Forgetting to destructure stores from singleton
- Missing translation keys for dynamic content
- Not extending HTML attributes on wrapper components

### Gotchas & Edge Cases

- `observer()` components don't infer displayName - must set manually
- Direct `t()` import doesn't react to language changes - use in hooks/utilities only
- MobX observables lose reactivity when destructured to primitives outside observer
- `useTranslation()` returns stable `t` function - no need to memoize
- Stories files exempt from `i18next/no-literal-string` rule

---

## Anti-Patterns

### Missing observer() Wrapper

Components that read MobX observables without `observer()` will not re-render when state changes.

```typescript
// BAD - No observer wrapper
export const UserStatus = () => {
  const { authStore } = stores;
  return <div>{authStore.isLoggedIn ? "Logged in" : "Guest"}</div>;
};
// Component shows stale data - requires page reload to update

// GOOD - Wrap with observer()
export const UserStatus = observer(() => {
  const { authStore } = stores;
  return <div>{authStore.isLoggedIn ? "Logged in" : "Guest"}</div>;
});
```

### Using interface for Props

ESLint enforces `type` for props definitions via `@typescript-eslint/consistent-type-definitions`.

```typescript
// BAD - interface for props
export interface ButtonProps {
  label: string;
}

// GOOD - type for props
export type ButtonProps = {
  label: string;
};
```

### Passing Stores as Props

Passing stores as props breaks the MobX reactive chain and creates unnecessary coupling.

```typescript
// BAD - Stores as props
export const useCreateTeam = (notificationsStore, teamsStore) => { ... };
const hook = useCreateTeam(stores.notificationsStore, stores.teamsStore);

// GOOD - Access stores via singleton
export const useCreateTeam = () => {
  const { notificationsStore, teamsStore } = stores;
  // ...
};
```

### useEffect for MobX State Changes

Using useEffect to react to MobX observable changes creates a duplicate reactive system.

```typescript
// BAD - useEffect with MobX
useEffect(() => {
  if (myStore.isLoaded) doSomething();
}, [myStore.isLoaded]);

// GOOD - reaction() in store constructor
reaction(
  () => this.isLoaded,
  (isLoaded) => {
    if (isLoaded) doSomething();
  }
);
```

### useMemo for MobX Derived State

MobX computed values already cache and track dependencies automatically.

```typescript
// BAD - useMemo with MobX
const activeItems = useMemo(() => store.items.filter(i => i.active), [store.items]);

// GOOD - Computed getter in store
get activeItems() {
  return this.items.filter(item => item.active);
}
```

### Hardcoded User-Facing Text

All user-facing strings must use translation keys for internationalization.

```typescript
// BAD - Hardcoded text
<button>Save</button>

// GOOD - useTranslation()
const { t } = useTranslation();
<button>{t("common.save")}</button>
```

### Default Exports

Default exports prevent tree-shaking and violate project conventions.

```typescript
// BAD - Default export
export default function Button() { ... }

// GOOD - Named export
export const Button = () => { ... };
```

**Exception:** `App.tsx` may use default export.

---

## Quick Reference

### Component Checklist

- [ ] Uses `type` for props (not interface)
- [ ] Wrapped with `observer()` if reading MobX state
- [ ] Has `displayName` set for observer/forwardRef components
- [ ] Uses named exports (no default exports except App.tsx)
- [ ] Extends HTML attributes for wrapper components
- [ ] Uses `useTranslation()` for user-facing text

### Hook Checklist

- [ ] Follows `use` prefix naming convention
- [ ] Accesses stores via singleton (not parameters)
- [ ] Uses `useTranslation()` for translatable strings
- [ ] Has proper TypeScript types

### i18n Checklist

- [ ] All user-facing text uses translation keys
- [ ] Components use `useTranslation()` hook
- [ ] Non-component code uses direct `t()` import
- [ ] Dynamic content uses interpolation: `t("key", { count })`
