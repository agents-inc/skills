# MobX Reference

> Decision frameworks, anti-patterns, and red flags for MobX development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

<decision_framework>

## Decision Framework

### State Management Decision Tree

```
What kind of state do I have?

Is it server data (from API)?
|-- YES --> Data fetching solution (NOT MobX stores)
|-- NO --> Is it URL-appropriate (filters, search)?
    |-- YES --> URL params (searchParams)
    |-- NO --> Is it shared across components?
        |-- YES --> MobX store
        |-- NO --> Is it truly component-local?
            |-- YES --> useState
            |-- NO --> MobX store (if complex) or useState (if simple)
```

### Store Method Decision

```
Is this a public method that may be destructured?
|-- YES --> Arrow function (preserves `this`)
|-- NO --> Is it called after await?
    |-- YES --> Wrap state mutations in runInAction()
    |-- NO --> Regular action
```

### makeAutoObservable vs makeObservable

```
Do you need fine-grained control?
|-- YES --> Is it for performance (shallow observation)?
|   |-- YES --> makeObservable with observable.shallow
|   |-- NO --> Is it to exclude specific methods?
|       |-- YES --> makeObservable with explicit annotations
|       |-- NO --> makeAutoObservable (with exclusions parameter)
|-- NO --> makeAutoObservable (default choice)
```

### Side Effect Location Decision

```
Where should this side effect live?
|
Is it reacting to MobX observable changes?
|-- YES --> reaction() in store constructor
|-- NO --> Is it synchronizing with external system (URL, DOM API)?
    |-- YES --> useEffect in component (valid use)
    |-- NO --> Is it business logic triggered by data changes?
        |-- YES --> reaction() in store
        |-- NO --> Component lifecycle (useEffect for setup/cleanup)
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data | Data fetching solution | Caching, synchronization, refetch |
| Complex client state | MobX store | Reactive, computed values, actions |
| Simple component state | useState | Simpler, no store needed |
| URL-shareable state | URL params | Bookmarkable, browser navigation |
| Side effects on state change | reaction() in store | Centralized, testable |
| External system sync | useEffect in component | React lifecycle |

</decision_framework>

---

<red_flags>

## RED FLAGS

### High Priority Issues

- Regular methods instead of arrow functions for public store methods - `this` is undefined when destructured
- Missing `runInAction()` after `await` calls - breaks MobX reactivity, causes warnings
- Missing `observer()` wrapper on components reading MobX state - components never re-render
- Using `useEffect` to react to MobX state changes - creates duplicate reactive systems
- Storing server/API data in MobX instead of data fetching solution - loses caching, refetch, sync benefits

### Medium Priority Issues

- Using `useMemo` for derived MobX state (use computed getters in stores)
- Passing stores as props instead of using stores singleton
- Not disposing MobxQuery instances (memory leaks)
- Accessing stores before RootStore.isLoading is false
- Creating new stores without adding to RootStore

### Common Mistakes

- Forgetting `{ fireImmediately: true }` on reactions that should run on init
- Not guarding against stale async responses in reactions
- Mutating observables in computed getters (should be read-only)
- Not using `Required<>` for dependencies type when providing defaults
- Missing displayName on observer components

### Gotchas & Edge Cases

- Code after `await` is NOT part of the action - always use `runInAction()`
- `observer()` must wrap the component, not be called inside
- Destructuring observables breaks reactivity - destructure at render time only
- `reaction()` runs once on setup with `fireImmediately: true`
- `observable.shallow` only observes array/object reference, not contents
- Private `#` fields are not observable - use for dependencies only

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### Regular Methods for Public Store Actions

Regular methods lose `this` binding when destructured. Use arrow functions.

```typescript
// BAD - Regular method
class Store {
  async fetchData() {
    this.isLoading = true; // undefined when destructured
  }
}

// GOOD - Arrow function
class Store {
  fetchData = async () => {
    this.isLoading = true; // works when destructured
  };
}
```

### Missing runInAction After Await

State mutations after await are outside action context.

```typescript
// BAD - State mutation outside action
fetchData = async () => {
  const data = await api.fetch();
  this.data = data; // MobX warning, reactivity may break
};

// GOOD - Wrapped in runInAction
fetchData = async () => {
  const data = await api.fetch();
  runInAction(() => {
    this.data = data;
  });
};
```

### useEffect to React to MobX State

Creates duplicate reactive systems. Use reaction() in stores.

```typescript
// BAD - useEffect for MobX state
useEffect(() => {
  if (store.isLoaded) doSomething();
}, [store.isLoaded]);

// GOOD - reaction in store
reaction(
  () => this.isLoaded,
  (isLoaded) => {
    if (isLoaded) doSomething();
  }
);
```

### Missing observer Wrapper

Components won't re-render without observer.

```typescript
// BAD - No observer
const Component = () => {
  return <div>{store.value}</div>; // Never updates
};

// GOOD - observer wrapper
const Component = observer(() => {
  return <div>{store.value}</div>; // Reactively updates
});
```

### Passing Stores as Props

Breaks the stores singleton pattern. Access via stores singleton.

```typescript
// BAD - Props drilling
<Child authStore={stores.authStore} />

// GOOD - Direct access
const Child = observer(() => {
  const { authStore } = stores;
});
```

</anti_patterns>

---

<quick_reference>

## Quick Reference

### Store Checklist

- [ ] Uses arrow functions for all public methods
- [ ] Uses `#` prefix for private dependencies
- [ ] Uses `makeAutoObservable` (or `makeObservable` for fine-grained control)
- [ ] Wraps state mutations after `await` in `runInAction()`
- [ ] Uses computed getters for derived state
- [ ] Uses `reaction()` for side effects (not useEffect in components)
- [ ] Exports type interface for external consumers
- [ ] Registered in RootStore

### Component Checklist

- [ ] Wrapped with `observer()` if reading MobX state
- [ ] Has `displayName` set for observer components
- [ ] Accesses stores via singleton (not props)
- [ ] Does NOT use useEffect to react to MobX state
- [ ] Does NOT use useMemo for MobX derived state

### Async Action Checklist

- [ ] Uses arrow function syntax
- [ ] Wraps ALL state mutations after `await` in `runInAction()`
- [ ] Has proper error handling with `runInAction()` in catch block
- [ ] Guards against stale responses in reactions

</quick_reference>
