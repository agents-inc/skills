# MobX Configuration

> makeAutoObservable vs makeObservable patterns. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 9: makeAutoObservable vs makeObservable

### Good Example - makeAutoObservable for most stores

```typescript
export class SimpleStore {
  value = "";
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setValue = (v: string) => {
    this.value = v;
  };

  get upperValue() {
    return this.value.toUpperCase();
  }
}
```

**Why good:** Automatically infers observables (properties), actions (methods), and computeds (getters), less boilerplate, good default for most stores

### Good Example - makeObservable for fine-grained control

```typescript
export class PerformanceStore {
  items: Item[] = [];
  selectedId: string | null = null;

  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Performance: don't deep-observe items
      selectedId: observable,
      addItem: action,
      selectedItem: computed,
      setExternalValue: false, // Exclude from observability
    });
  }

  addItem = (item: Item) => {
    this.items.push(item);
  };

  get selectedItem() {
    return this.items.find((i) => i.id === this.selectedId);
  }

  // Not an action - called from external non-MobX code
  setExternalValue(value: string) {
    // ...
  }
}
```

**Why good:** `observable.shallow` prevents deep observation for performance, can exclude specific methods from observability, explicit annotations document intent

---

## autoBind Option

### Good Example - autoBind for automatic method binding

```typescript
export class UserStore {
  name = "";
  isLoading = false;

  constructor() {
    // autoBind: true automatically binds all methods to the instance
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // Regular method - will be auto-bound due to autoBind: true
  async fetchUser() {
    this.isLoading = true;
    const data = await api.fetchUser();
    runInAction(() => {
      this.name = data.name;
      this.isLoading = false;
    });
  }

  // Can be safely destructured in components
  setName(name: string) {
    this.name = name;
  }
}

// In component - works correctly due to autoBind
const { fetchUser, setName } = userStore;
fetchUser(); // `this` is correctly bound
```

**Why good:** `autoBind: true` eliminates need for arrow functions everywhere, cleaner class syntax with regular methods, destructuring in components works correctly, official MobX-native solution for `this` binding

### Comparison - Arrow functions vs autoBind

```typescript
// Option A: Arrow functions (explicit binding)
export class StoreA {
  constructor() {
    makeAutoObservable(this);
  }

  fetchData = async () => { /* ... */ }; // Arrow function
}

// Option B: autoBind (implicit binding)
export class StoreB {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async fetchData() { /* ... */ } // Regular method
}
```

**Both options are valid.** Arrow functions are more explicit, while `autoBind` is cleaner for classes with many methods. Choose based on team preference and consistency with existing codebase

---

## Pattern 13: Modern Decorators (TypeScript 5+)

MobX supports TC39 Stage 3 decorators that eliminate the need for `makeObservable`/`makeAutoObservable`. These provide ~30% better runtime performance.

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": false, // MUST be false for modern decorators
    "useDefineForClassFields": true
  }
}
```

### Good Example - Modern Decorators with accessor

```typescript
import { observable, action, computed, runInAction } from "mobx";

export class UserStore {
  // Use accessor keyword with @observable
  @observable accessor name = "";
  @observable accessor isLoading = false;
  @observable accessor error: string | null = null;

  // @action is optional but adds clarity
  @action
  setName(name: string) {
    this.name = name;
  }

  // Computed getters work without decorator
  get upperName() {
    return this.name.toUpperCase();
  }

  // Async actions - still need runInAction after await
  @action
  async fetchUser() {
    this.isLoading = true;
    try {
      const data = await api.fetchUser();
      // Still need runInAction after await
      runInAction(() => {
        this.name = data.name;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err.message;
        this.isLoading = false;
      });
    }
  }
}

// No makeObservable call needed!
const store = new UserStore();
```

**Why good:** No constructor boilerplate, co-located field declarations with observability annotations, 30% better performance than makeAutoObservable, works with subclassing

### Bad Example - Missing accessor keyword

```typescript
export class UserStore {
  // BAD: Missing accessor - property won't be observable
  @observable name = "";

  // BAD: experimentalDecorators: true uses legacy decorators
}
```

**Why bad:** Modern decorators REQUIRE `accessor` keyword, without it the decorator does nothing, easy to miss when migrating from legacy decorators

### Gotcha: accessor Properties Are Non-Enumerable

```typescript
const store = new UserStore();
store.name = "John";

// Modern decorator gotcha
console.log(Object.keys(store)); // [] - accessor properties not included
console.log(JSON.stringify(store)); // "{}" - accessor properties not serialized

// Solution: implement toJSON
export class UserStore {
  @observable accessor name = "";

  toJSON() {
    return { name: this.name };
  }
}
```

**Why important:** Unlike legacy decorators, modern `@observable accessor` properties are non-enumerable, breaking `Object.keys()` and `JSON.stringify()`

---

## Pattern 15: mobx-react-lite vs mobx-react

### Package Comparison

| Feature | mobx-react-lite | mobx-react |
|---------|-----------------|------------|
| Bundle size | ~2KB | ~5KB |
| Functional components | Yes | Yes |
| Class components | No | Yes |
| observer HOC | Yes | Yes |
| Provider/inject | No | Yes |
| useLocalObservable | Yes | Yes |
| PropTypes | No | Yes |

### Good Example - mobx-react-lite (Recommended)

```typescript
import { observer, useLocalObservable } from "mobx-react-lite";
import { stores } from "stores";

// Functional component with observer
export const UserProfile = observer(() => {
  const { authStore } = stores;

  return (
    <div>
      <h1>{authStore.displayName}</h1>
      {authStore.isLoading && <Spinner />}
    </div>
  );
});

UserProfile.displayName = "UserProfile";
```

**Why good:** Smaller bundle, optimized for hooks and functional components, all modern patterns supported

### Good Example - useLocalObservable for Local State

```typescript
import { observer, useLocalObservable } from "mobx-react-lite";

const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
    get doubled() {
      return this.count * 2;
    },
  }));

  return (
    <div>
      <p>Count: {state.count}</p>
      <p>Doubled: {state.doubled}</p>
      <button onClick={state.increment}>Increment</button>
    </div>
  );
});
```

**Why good:** Local observable state without creating a store class, computed values work automatically, methods are bound to the store

### When to use mobx-react

```typescript
// Only if you need class components or Provider/inject pattern
import { observer, Provider, inject } from "mobx-react";

// Legacy class component support
@observer
class LegacyComponent extends React.Component {
  render() {
    return <div>{this.props.store.value}</div>;
  }
}

// Provider/inject pattern (legacy, prefer stores singleton)
<Provider authStore={authStore}>
  <InjectedComponent />
</Provider>
```

**When to use:** Legacy class component codebases, gradual migration projects, need Provider/inject pattern (though stores singleton is preferred)
