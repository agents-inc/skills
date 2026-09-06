# Pinia - Reference

> Comparison tables, anti-pattern code, TypeScript recipes and performance notes. The decision trees and the red flags are in [SKILL.md](SKILL.md).

---

## Options Store vs Setup Store

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

## Anti-Patterns

> For the complete red flags checklist, see [SKILL.md](SKILL.md#red-flags).

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
  pick: ['theme', 'locale', 'preferences'],  // Only user preferences
}
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
