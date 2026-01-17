# Performance Reference

> Decision frameworks, anti-patterns, red flags, and integration guides for Photoroom webapp performance optimization. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Derived State: computed vs useMemo

```
Is the value derived from MobX observable state?
  YES --> Use computed getter in store
          MobX automatically caches and tracks dependencies
  NO --> Is it derived from React props/state?
    YES --> Is the calculation expensive (>1ms)?
      YES --> Consider useMemo
      NO --> Calculate inline (no memoization needed)
    NO --> Calculate inline
```

### Route Lazy Loading

```
Is this a secondary route (not primary user path)?
  YES --> Use .lazy.tsx suffix
  NO --> Is the route bundle very large (>100KB)?
    YES --> Consider splitting, use .lazy.tsx
    NO --> Non-lazy route is fine
```

### Optimization Decision

```
Is there a measured performance problem?
  YES --> Profile to identify bottleneck
    Rendering too slow --> Check observer(), computed
    List scroll jank --> Consider virtualization
    Memory growing --> Check cleanup (Stage, MobxQuery)
    Bundle too large --> Add lazy loading
  NO --> Keep code simple (premature optimization harms maintainability)
```

### Shallow vs Deep Observable

```
Is this a large collection (100+ items)?
  YES --> Do you need to observe individual item property changes?
    YES --> Use default observable (deep)
    NO --> Use observable.shallow
  NO --> Use default observable (makeAutoObservable)
```

### Quick Reference Table

| Scenario | Solution | Why |
|----------|----------|-----|
| Derived MobX state | `computed` getter in store | Automatic caching and dependency tracking |
| Component reactivity | `observer()` wrapper | Fine-grained re-renders |
| Secondary routes | `.lazy.tsx` suffix | Code-split bundle |
| WebGL resources | `stage.destroy()` in cleanup | Prevent GPU memory leaks |
| MobxQuery instances | `dispose()` method | Prevent subscription leaks |
| Large lists | Virtualization | Prevent DOM bloat |
| Large collections | `observable.shallow` | Reduce MobX overhead |

---

## Anti-Patterns

### useMemo for MobX-Derived State

Using `useMemo` to memoize values derived from MobX observables creates redundant caching. MobX computed getters already provide automatic caching with dependency tracking.

```typescript
// WRONG
const filtered = useMemo(
  () => store.items.filter(i => i.active),
  [store.items]
);

// CORRECT - computed in store
get filteredItems() {
  return this.items.filter(i => i.active);
}
```

**Why it's harmful:** Duplicates MobX's caching, dependency array can drift from actual dependencies, makes testing harder.

---

### React.memo on observer() Components

Wrapping `observer()` components with `React.memo()` provides no benefit - `observer()` already prevents unnecessary re-renders by tracking observable access.

```typescript
// WRONG
const MyComponent = memo(observer(() => {
  return <div>{store.value}</div>;
}));

// CORRECT - observer alone is sufficient
const MyComponent = observer(() => {
  return <div>{store.value}</div>;
});
```

**Why it's harmful:** Adds unnecessary wrapper, false sense of optimization, `observer()` already handles re-render prevention.

---

### Missing Resource Cleanup

Creating WebGL contexts (Stage) or MobxQuery instances without cleanup functions causes memory leaks that accumulate over time.

```typescript
// WRONG
useEffect(() => {
  const stage = new Stage({ canvas });
  // No cleanup!
}, []);

// CORRECT - always clean up
useEffect(() => {
  const stage = new Stage({ canvas });
  return () => stage.destroy();
}, []);
```

**Why it's harmful:** GPU memory grows until browser crashes, subscriptions fire on disposed stores causing errors.

---

### Optimizing Before Measuring

Adding `memo`, `useMemo`, or `useCallback` without first profiling to identify actual bottlenecks adds complexity without proven benefit.

```typescript
// WRONG - premature optimization
const MemoizedRow = memo(({ item }) => <Row item={item} />);
const handleClick = useCallback(() => doThing(), []);
const filtered = useMemo(() => items.filter(x => x), [items]);

// CORRECT - simple first, optimize if needed
const Row = ({ item }) => <Row item={item} />;
const handleClick = () => doThing();
const filtered = items.filter(x => x);
```

**Why it's harmful:** Adds cognitive overhead, makes code harder to read, often provides no measurable benefit.

---

### Deep Observation on Large Collections

Using `makeAutoObservable` on stores with large arrays causes MobX to create proxies for every nested property, even when only array-level changes matter.

```typescript
// WRONG
class Store {
  items: Item[] = []; // 10,000 items
  constructor() {
    makeAutoObservable(this); // Deeply observes all items
  }
}

// CORRECT - shallow observation
class Store {
  items: Item[] = [];
  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Only tracks array reference
    });
  }
}
```

**Why it's harmful:** Significant memory overhead, slower store initialization, unnecessary reactivity tracking.

---

### Missing observer() Wrapper

Components that read MobX observables without the `observer()` wrapper will never re-render when those observables change, showing stale data.

```typescript
// WRONG
const UserName = () => {
  return <span>{store.userName}</span>; // Never updates!
};

// CORRECT
const UserName = observer(() => {
  return <span>{store.userName}</span>;
});
```

**Why it's harmful:** UI shows stale data, common source of "my component doesn't update" bugs.

---

## RED FLAGS

**High Priority Issues:**

- Using `useMemo` for MobX-derived state - redundant, use computed in store instead
- Missing `observer()` wrapper - component won't re-render on MobX changes
- Missing `stage.destroy()` in cleanup - WebGL memory leak
- Missing MobxQuery disposal - subscription memory leak
- Premature optimization with `memo`/`useMemo`/`useCallback` - adds complexity without proof of need

**Medium Priority Issues:**

- Non-lazy routes for large secondary features (bloats initial bundle)
- Deep observation on large collections (use `observable.shallow`)
- Manual dependency tracking when MobX computed would handle it
- Missing displayName on observer components (DevTools debugging)

**Common Mistakes:**

- Adding React.memo to observer components (observer already optimizes)
- Using useCallback for handlers passed to observer children (observer handles it)
- Virtualizing small lists (<100 items) when simple map works fine
- Optimizing without profiling first

**Gotchas & Edge Cases:**

- `observable.shallow` only tracks reference changes, not item mutations
- Lazy routes can't have synchronous loaders (use non-lazy for data loading)
- Stage.destroy() must be called even if component errors during render
- MobxQuery dispose should be called even if query was never started
- Computed values are lazily evaluated - only calculated when accessed

---

## Integration Guide

Performance optimization in the Photoroom webapp integrates with MobX state management and TanStack Router.

**Works with:**

- **MobX** - computed getters for derived state, observer for reactivity
- **TanStack Router** - .lazy.tsx suffix for code-splitting
- **React Query (via MobxQuery)** - dispose pattern for subscription cleanup
- **WebGL/Stage** - destroy() for GPU resource cleanup

**Key integration points:**

- MobX stores should use computed getters, not components using useMemo
- TanStack Router file naming convention determines lazy loading
- MobxQuery bridges React Query with MobX stores - always dispose
- Stage instances must be destroyed to free GPU resources
