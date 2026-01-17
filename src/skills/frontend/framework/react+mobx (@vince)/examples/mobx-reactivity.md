# React + MobX - Reactivity Patterns

> MobX-specific reactivity patterns avoiding React anti-patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [core.md](core.md) - Basic component structure, observer wrapper
- [hooks.md](hooks.md) - Custom hooks with stores
- [i18n.md](i18n.md) - useTranslation patterns
- [patterns.md](patterns.md) - Promise-based modal pattern

---

## Pattern 9: Avoiding useEffect with MobX

### Good Example - Reaction in store, not useEffect

```typescript
// In store constructor:
class Store {
  constructor() {
    makeAutoObservable(this);

    reaction(
      () => this.isLoaded,
      (isLoaded) => {
        if (isLoaded) {
          this.doSomething();
        }
      }
    );
  }
}

// In component - just read state:
export const MyComponent = observer(() => {
  const { myStore } = stores;

  return <div>{myStore.isLoaded ? "Ready" : "Loading"}</div>;
});
```

**Why good:** side effects handled in store where logic belongs, component stays simple and declarative, no duplicate reactive systems

### Bad Example - useEffect to react to MobX changes

```typescript
export const MyComponent = observer(() => {
  const { myStore } = stores;

  useEffect(() => {
    if (myStore.isLoaded) {
      doSomething();
    }
  }, [myStore.isLoaded]);

  return <div>{myStore.isLoaded ? "Ready" : "Loading"}</div>;
});
```

**Why bad:** creates duplicate reactive system (MobX + useEffect), side effect logic scattered across components, harder to test and maintain

### When useEffect IS Appropriate

Use useEffect for non-MobX concerns:
- URL parameter handling
- Focus management
- Integration with non-MobX libraries
- Browser API cleanup (event listeners, timers)

---

## Pattern 10: useMemo with MobX

### Good Example - Computed value in store

```typescript
class Store {
  items: Item[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  get activeItems() {
    return this.items.filter(item => item.active);
  }
}

// In component - read computed directly:
export const ItemList = observer(() => {
  const { store } = stores;

  return (
    <ul>
      {store.activeItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});
```

**Why good:** MobX `computed` values are automatically cached and only recalculate when dependencies change, no need for dependency array management

### Bad Example - useMemo for MobX derived state

```typescript
export const ItemList = observer(() => {
  const { store } = stores;

  const activeItems = useMemo(() => {
    return store.items.filter(item => item.active);
  }, [store.items]);

  return (
    <ul>
      {activeItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});
```

**Why bad:** useMemo with MobX creates redundant memoization, MobX already tracks dependencies and caches computed values, dependency array management is error-prone
