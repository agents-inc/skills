# Pinia - Reference

Decision frameworks, red flags, and anti-patterns for Pinia state management.

---

## Decision Framework

### Store Syntax Decision Tree

```
Which store syntax should I use?

Need to use composables (useRoute, useI18n, custom)?
├─ YES → Setup Store
└─ NO → Need watchers inside the store?
    ├─ YES → Setup Store
    └─ NO → Need built-in $reset() method?
        ├─ YES → Options Store
        └─ NO → Prefer Vue Composition API style?
            ├─ YES → Setup Store
            └─ NO → Options Store
```

### State Management Decision Tree

```
Where should this state live?

Is it server data (from API)?
├─ YES → Data fetching solution (not Pinia's scope)
└─ NO → Is it URL-appropriate (filters, search, pagination)?
    ├─ YES → Route query params
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Pinia store
        └─ NO → Is it component-local UI state?
            ├─ YES → ref() or reactive() in component
            └─ NO → Is it a singleton/config value?
                └─ YES → App-level provide/inject
```

### Persistence Decision Tree

```
Should I persist this state?

Is it server data?
├─ YES → Do NOT persist (refetch on load)
└─ NO → Is it user preference (theme, locale)?
    ├─ YES → Persist to localStorage
    └─ NO → Is it session-specific (cart, form draft)?
        ├─ YES → Persist to sessionStorage
        └─ NO → Is it sensitive data?
            ├─ YES → Do NOT persist
            └─ NO → Evaluate case by case
```

### Quick Reference Table

| Use Case              | Solution                   | Why                                      |
| --------------------- | -------------------------- | ---------------------------------------- |
| Server/API data       | Data fetching solution     | Caching, synchronization, loading states |
| Shareable filters     | Route query params         | Bookmarkable, browser navigation         |
| Shared client state   | Pinia store                | Reactivity, DevTools, persistence        |
| Component-local state | `ref()` / `reactive()`     | Simpler, no overhead                     |
| User preferences      | Pinia + persistence plugin | Persists across sessions                 |
| Session-only state    | Pinia + sessionStorage     | Clears on tab close                      |

### Options Store vs Setup Store Comparison

| Feature             | Options Store                     | Setup Store                                |
| ------------------- | --------------------------------- | ------------------------------------------ |
| Syntax              | Object with state/getters/actions | Function returning refs/computed/functions |
| Built-in `$reset()` | Yes                               | No (must implement manually)               |
| Composables         | Limited                           | Full support                               |
| Watchers            | Not supported inside store        | Fully supported                            |
| Familiar to         | Vuex/Options API users            | Composition API users                      |
| TypeScript          | Good                              | Excellent                                  |
| Flexibility         | Standard                          | Maximum                                    |

---

## RED FLAGS

**High Priority Issues:**

- **Storing server/API data in Pinia** - causes stale data, no caching, manual sync complexity; use a data fetching solution instead
- **Destructuring state without storeToRefs()** - breaks reactivity, UI won't update
- **Private state in Setup stores** - not returning all refs breaks SSR, DevTools, and plugins
- **Browser APIs in state initialization** - crashes SSR (localStorage, window, document)
- **Default exports in store files** - violates project conventions, breaks tree-shaking
- **Magic numbers in state logic** - makes values unclear, hard to maintain

**Medium Priority Issues:**

- Circular dependencies between stores through getters/actions
- Persisting all state instead of selective paths
- Persisting server data (becomes stale)
- Using `this` in getters without `function` keyword (arrow functions have no `this`)
- Not providing type annotations for state in TypeScript

**Common Mistakes:**

- Forgetting to call store function: `useStore` vs `useStore()`
- Mutating state directly in components instead of through actions
- Not using `markRaw()` for non-reactive objects added to stores
- Overusing stores for simple component-local state
- Not handling async action errors properly

**Gotchas & Edge Cases:**

- `storeToRefs()` only works for state and getters, not actions
- Options store `$reset()` only resets to initial state function return
- Setup stores don't have built-in `$reset()` - must implement manually
- Store instances are singletons per Pinia instance
- In SSR, each request needs its own Pinia instance to avoid state pollution
- `$patch` with function allows accessing current state: `store.$patch(state => state.count++)`

---

## Anti-Patterns

### Destructuring Store State Directly

Destructuring state without `storeToRefs()` breaks reactivity. The template won't update when state changes.

```typescript
// WRONG - Breaks reactivity
const { count, user } = useCounterStore();

// CORRECT - Preserves reactivity
import { storeToRefs } from "pinia";
const store = useCounterStore();
const { count, user } = storeToRefs(store);
const { increment } = store; // Actions can be destructured directly
```

### Server Data in Pinia

Storing API responses in Pinia causes stale data and loses all benefits of a proper data fetching solution.

```typescript
// WRONG - Server data in Pinia
const useUsersStore = defineStore("users", {
  state: () => ({ users: [], loading: false, error: null }),
  actions: {
    async fetchUsers() {
      this.loading = true;
      this.users = await api.getUsers();
      this.loading = false;
    },
  },
});

// CORRECT - Use a data fetching solution for server data
// Pinia is only for client state that doesn't come from APIs
```

### Private State in Setup Stores

Not returning all state properties breaks SSR hydration and DevTools.

```typescript
// WRONG - Private state not returned
export const useBrokenStore = defineStore("broken", () => {
  const count = ref(0);
  const internalCache = ref({}); // Private - NOT returned!

  return { count }; // internalCache missing - breaks SSR!
});

// CORRECT - Return all state
export const useCorrectStore = defineStore("correct", () => {
  const count = ref(0);
  const cache = ref({}); // All state must be returned

  return { count, cache };
});
```

### Browser APIs in State Initialization

Using browser APIs in state initialization crashes SSR.

```typescript
// WRONG - Crashes on server
state: () => ({
  theme: localStorage.getItem('theme') ?? 'light',
  width: window.innerWidth,
})

// CORRECT - SSR-safe defaults with client-side hydration
state: () => ({
  theme: 'light',
  width: 0,
}),
actions: {
  hydrateClient() {
    if (typeof window !== 'undefined') {
      this.theme = localStorage.getItem('theme') ?? 'light';
      this.width = window.innerWidth;
    }
  },
}
```

### Circular Store Dependencies

Stores calling each other through getters/actions can create infinite loops.

```typescript
// WRONG - Circular dependency through getters
// store-a.ts
getters: {
  combined() {
    return this.value + useStoreB().derived;  // Uses B
  },
}

// store-b.ts
getters: {
  derived() {
    return useStoreA().combined;  // Uses A - INFINITE LOOP!
  },
}

// CORRECT - Break the cycle
// Only one store should depend on the other, OR
// Move shared logic to a third store/composable
```

### Persisting Everything

Persisting all state including transient UI state causes issues.

```typescript
// WRONG - Persists everything
persist: true

// CORRECT - Selective persistence
persist: {
  paths: ['theme', 'locale', 'preferences'],  // Only user preferences
}
```

### Magic Numbers in State

Using raw numbers for thresholds and limits.

```typescript
// WRONG - Magic numbers
if (this.items.length >= 100) { ... }
setTimeout(this.save, 300);

// CORRECT - Named constants
const MAX_CART_ITEMS = 100;
const SAVE_DEBOUNCE_MS = 300;

if (this.items.length >= MAX_CART_ITEMS) { ... }
setTimeout(this.save, SAVE_DEBOUNCE_MS);
```

---

## TypeScript Patterns

### Typing Options Store State

```typescript
interface UserState {
  user: User | null;
  preferences: UserPreferences;
}

export const useUserStore = defineStore("user", {
  state: (): UserState => ({
    user: null,
    preferences: DEFAULT_PREFERENCES,
  }),
  // getters and actions have type inference from state
});
```

### Typing Getters with Parameters

```typescript
getters: {
  // Getter returning a function for parameters
  getItemById: (state) => {
    return (id: string): Item | undefined => {
      return state.items.find((item) => item.id === id);
    };
  },
}
```

### Typing Setup Store

```typescript
export const useTypedStore = defineStore("typed", () => {
  // Explicit types for refs
  const count = ref<number>(0);
  const user = ref<User | null>(null);
  const items = ref<Item[]>([]);

  // Computed types are inferred
  const isEmpty = computed(() => items.value.length === 0);

  // Explicit return types for actions
  function addItem(item: Item): void {
    items.value.push(item);
  }

  async function fetchUser(id: string): Promise<User> {
    // ...
  }

  return { count, user, items, isEmpty, addItem, fetchUser };
});
```

---

## Performance Tips

### Selective Subscriptions

Only subscribe to the state you need to minimize re-renders.

```typescript
// Less optimal - subscribes to entire store
const store = useStore();
// Component re-renders on ANY store change

// Better - subscribe to specific values
const count = computed(() => useStore().count);
// Component only re-renders when count changes
```

### Batch Updates with $patch

Use `$patch` for multiple state changes to trigger only one update.

```typescript
// Multiple updates - triggers multiple reactions
store.name = "Alice";
store.age = 30;
store.city = "Paris";

// Single update - triggers one reaction
store.$patch({
  name: "Alice",
  age: 30,
  city: "Paris",
});

// Or with a function for complex updates
store.$patch((state) => {
  state.items.push(newItem);
  state.count++;
});
```

### Avoid Computed in Store Subscriptions

Don't create new computed in store subscriptions - they won't be cleaned up.

```typescript
// WRONG - Creates new computed that leaks
store.$subscribe(() => {
  const doubled = computed(() => store.count * 2);  // Memory leak!
});

// CORRECT - Use getters for derived state
getters: {
  doubled: (state) => state.count * 2,
}
```
