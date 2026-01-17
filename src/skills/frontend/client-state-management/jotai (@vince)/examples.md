# Jotai - Code Examples

All code examples for Jotai atomic state management patterns with good/bad comparisons.

---

## Pattern 1: Primitive Atoms

### Good Example - Primitive Atoms with Type Inference

```typescript
import { atom } from "jotai";

// Constants for initial values
const INITIAL_COUNT = 0;
const INITIAL_TEXT = "";
const DEFAULT_THEME = "light" as const;

// Type inference works automatically
const countAtom = atom(INITIAL_COUNT);
const textAtom = atom(INITIAL_TEXT);
const isOpenAtom = atom(false);

// Explicit typing when needed (union types, nullable)
interface User {
  id: string;
  name: string;
  email: string;
}

const userAtom = atom<User | null>(null);
const itemsAtom = atom<string[]>([]);

// Union types for constrained values
type Theme = "light" | "dark" | "system";
const themeAtom = atom<Theme>(DEFAULT_THEME);

type Status = "idle" | "loading" | "success" | "error";
const statusAtom = atom<Status>("idle");

// Named exports
export { countAtom, textAtom, isOpenAtom, userAtom, itemsAtom, themeAtom, statusAtom };
```

**Why good:** Atoms defined at module level (not inside components), type inference used where possible, explicit typing for complex types, named constants for initial values, named exports follow project conventions

### Bad Example - Atoms Created Inside Component

```typescript
import { atom, useAtom } from "jotai";

function Counter() {
  // BAD: New atom created every render - state is never preserved!
  const countAtom = atom(0);
  const [count, setCount] = useAtom(countAtom);

  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

export default Counter; // BAD: Default export
```

**Why bad:** Atom created inside component means new atom every render, state resets constantly, clicking button appears to do nothing, default export violates project conventions

---

## Pattern 2: Derived (Read-Only) Atoms

### Good Example - Computed Atoms

```typescript
import { atom } from "jotai";

// Base atoms
const priceAtom = atom(100);
const quantityAtom = atom(2);
const taxRateAtom = atom(0.08);

// Derived atom - automatically recalculates when dependencies change
const subtotalAtom = atom((get) => get(priceAtom) * get(quantityAtom));

const taxAtom = atom((get) => get(subtotalAtom) * get(taxRateAtom));

const totalAtom = atom((get) => {
  const subtotal = get(subtotalAtom);
  const tax = get(taxAtom);
  return subtotal + tax;
});

// Conditional derived atom
const countAtom = atom(0);
const statusAtom = atom((get) => {
  const count = get(countAtom);
  if (count < 0) return "negative";
  if (count === 0) return "zero";
  return "positive";
});

// Chained derived atoms - each only recalculates when its dependencies change
const baseAtom = atom(1);
const step1Atom = atom((get) => get(baseAtom) * 2);
const step2Atom = atom((get) => get(step1Atom) + 10);
const finalAtom = atom((get) => `Result: ${get(step2Atom)}`);

export {
  priceAtom,
  quantityAtom,
  taxRateAtom,
  subtotalAtom,
  taxAtom,
  totalAtom,
  countAtom,
  statusAtom,
  baseAtom,
  finalAtom,
};
```

**Why good:** Dependencies tracked automatically, computed values cached until dependencies change, chain of derivations is clean and composable, each atom has single responsibility

### Bad Example - Computing in Component

```typescript
import { useAtom } from "jotai";

function Total() {
  const [price] = useAtom(priceAtom);
  const [quantity] = useAtom(quantityAtom);
  const [taxRate] = useAtom(taxRateAtom);

  // BAD: Recomputes every render, even if unrelated state changes
  const subtotal = price * quantity;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return <div>${total.toFixed(2)}</div>;
}
```

**Why bad:** Computation happens on every render, no caching, component re-renders for any state change even if these values haven't changed

---

## Pattern 3: Write-Only Atoms (Action Atoms)

### Good Example - Encapsulated Actions

```typescript
import { atom } from "jotai";

const INCREMENT_AMOUNT = 1;
const DECREMENT_AMOUNT = 1;

const countAtom = atom(0);

// Write-only action atom - first arg is null (no read value)
const incrementAtom = atom(null, (get, set) => {
  set(countAtom, get(countAtom) + INCREMENT_AMOUNT);
});

const decrementAtom = atom(null, (get, set) => {
  set(countAtom, get(countAtom) - DECREMENT_AMOUNT);
});

// Action atom with arguments
const addAmountAtom = atom(null, (get, set, amount: number) => {
  set(countAtom, get(countAtom) + amount);
});

// Action atom that updates multiple atoms
const itemsAtom = atom<string[]>([]);
const selectedIndexAtom = atom<number | null>(null);

const resetAllAtom = atom(null, (get, set) => {
  set(countAtom, 0);
  set(itemsAtom, []);
  set(selectedIndexAtom, null);
});

// Multiple arguments with explicit typing
const multiArgAtom = atom<null, [string, number], void>(
  null,
  (get, set, name: string, value: number) => {
    // Handle multiple arguments
    console.log(name, value);
  }
);

export {
  countAtom,
  incrementAtom,
  decrementAtom,
  addAmountAtom,
  resetAllAtom,
  multiArgAtom,
};
```

**Why good:** Actions are encapsulated and reusable, enables code splitting (action code only loaded when needed), multiple atoms can be updated atomically, explicit typing for arguments

### Usage Example

```typescript
import { useAtom, useSetAtom } from "jotai";

function Counter() {
  const [count] = useAtom(countAtom);
  const increment = useSetAtom(incrementAtom);
  const addAmount = useSetAtom(addAmountAtom);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+1</button>
      <button onClick={() => addAmount(10)}>+10</button>
    </div>
  );
}

export { Counter };
```

---

## Pattern 4: Read-Write Atoms

### Good Example - Lens-Like Pattern

```typescript
import { atom } from "jotai";

interface User {
  name: string;
  email: string;
  age: number;
}

const DEFAULT_USER: User = {
  name: "",
  email: "",
  age: 0,
};

const userAtom = atom<User>(DEFAULT_USER);

// Read-write atom for a specific property (lens pattern)
const nameAtom = atom(
  (get) => get(userAtom).name,
  (get, set, newName: string) => {
    set(userAtom, { ...get(userAtom), name: newName });
  }
);

const emailAtom = atom(
  (get) => get(userAtom).email,
  (get, set, newEmail: string) => {
    set(userAtom, { ...get(userAtom), email: newEmail });
  }
);

// Derived with transformation on both read and write
const textAtom = atom("hello");

const uppercaseAtom = atom(
  (get) => get(textAtom).toUpperCase(),
  (get, set, newValue: string) => {
    set(textAtom, newValue.toLowerCase());
  }
);

export { userAtom, nameAtom, emailAtom, uppercaseAtom };
```

**Why good:** Allows reading and writing specific parts of larger objects, keeps parent object intact while enabling granular updates, transformation logic encapsulated in atom

### Usage Example

```typescript
import { useAtom } from "jotai";

function NameEditor() {
  const [name, setName] = useAtom(nameAtom);

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Enter name"
    />
  );
}

export { NameEditor };
```

---

## Pattern 5: Async Atoms with Suspense

### Good Example - Async Read Atom

```typescript
import { atom } from "jotai";
import type { Atom } from "jotai";

interface User {
  id: number;
  name: string;
  email: string;
}

const userIdAtom = atom(1);

// Async read atom - triggers Suspense
const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json() as Promise<User>;
});

// Async atom with AbortController support
const userWithAbortAtom = atom(async (get, { signal }) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`, { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json() as Promise<User>;
});

export { userIdAtom, userAtom, userWithAbortAtom };
```

### Good Example - Suspense Setup

```tsx
import { Provider } from "jotai";
import { Suspense } from "react";

// CRITICAL: At least one Suspense must be inside Provider
function App() {
  return (
    <Provider>
      <Suspense fallback={<div>Loading...</div>}>
        <MainContent />
      </Suspense>
    </Provider>
  );
}

// Multiple Suspense boundaries for granular loading states
function MainContent() {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <Suspense fallback={<ContentSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

export { App };
```

**Why good:** Suspense boundary catches async atom loading, granular boundaries allow independent loading states, Provider wraps entire tree

### Good Example - Loadable Pattern (Non-Suspense)

```typescript
import { atom, useAtom } from "jotai";
import { loadable } from "jotai/utils";

const asyncDataAtom = atom(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// Convert to loadable - doesn't trigger Suspense
const loadableDataAtom = loadable(asyncDataAtom);

// Usage - handles loading/error/data states manually
function DataComponent() {
  const [state] = useAtom(loadableDataAtom);

  if (state.state === "loading") {
    return <div>Loading...</div>;
  }

  if (state.state === "hasError") {
    return <div>Error: {String(state.error)}</div>;
  }

  // state.state === 'hasData'
  return <div>{JSON.stringify(state.data)}</div>;
}

export { loadableDataAtom, DataComponent };
```

**Why good:** Loadable utility converts async atom to sync, returns discriminated union for type-safe state handling, no Suspense boundary needed

### Bad Example - No Suspense Boundary

```tsx
import { Provider } from "jotai";

function App() {
  return (
    <Provider>
      {/* BAD: No Suspense - will crash if asyncAtom is used */}
      <AsyncComponent />
    </Provider>
  );
}
```

**Why bad:** Async atoms trigger Suspense by default, missing boundary causes React error

---

## Pattern 6: atomFamily for Parameterized Atoms

### Good Example - Creating Atoms On-Demand

```typescript
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { Atom } from "jotai";

interface User {
  id: string;
  name: string;
  email: string;
}

// Create atoms on-demand based on parameters
const userAtomFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json() as Promise<User>;
  })
);

// With custom equality function for complex params
interface ItemParams {
  id: string;
  version: number;
}

const itemAtomFamily = atomFamily(
  (params: ItemParams) => atom({ ...params, count: 0 }),
  (a, b) => a.id === b.id && a.version === b.version
);

export { userAtomFamily, itemAtomFamily };
```

### Usage Example

```tsx
import { useAtom } from "jotai";
import { Suspense } from "react";

interface UserProfileProps {
  userId: string;
}

function UserProfile({ userId }: UserProfileProps) {
  const [user] = useAtom(userAtomFamily(userId));
  return <div>{user.name}</div>;
}

function UserList({ userIds }: { userIds: string[] }) {
  return (
    <div>
      {userIds.map((id) => (
        <Suspense key={id} fallback={<div>Loading user...</div>}>
          <UserProfile userId={id} />
        </Suspense>
      ))}
    </div>
  );
}

export { UserProfile, UserList };
```

**Why good:** Atoms created lazily when needed, same params return same atom instance, custom equality prevents unnecessary atom recreation

---

## Pattern 7: atomWithStorage for Persistence

### Good Example - localStorage Persistence

```typescript
import { atomWithStorage, createJSONStorage, RESET } from "jotai/utils";

const STORAGE_KEY_THEME = "app-theme";
const STORAGE_KEY_PREFERENCES = "user-preferences";
const DEFAULT_THEME = "light" as const;

type Theme = "light" | "dark" | "system";

interface UserPreferences {
  notifications: boolean;
  language: string;
  fontSize: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: true,
  language: "en",
  fontSize: 16,
};

// Persists to localStorage by default
const themeAtom = atomWithStorage<Theme>(STORAGE_KEY_THEME, DEFAULT_THEME);

const preferencesAtom = atomWithStorage<UserPreferences>(
  STORAGE_KEY_PREFERENCES,
  DEFAULT_PREFERENCES
);

// sessionStorage variant
const sessionStorage = createJSONStorage(() => globalThis.sessionStorage);

const sessionDataAtom = atomWithStorage(
  "session-data",
  { token: "" },
  sessionStorage
);

export { themeAtom, preferencesAtom, sessionDataAtom, RESET };
```

### Good Example - Resetting Stored Values

```tsx
import { useSetAtom } from "jotai";
import { RESET } from "jotai/utils";

function ResetButton() {
  const setPreferences = useSetAtom(preferencesAtom);

  const handleReset = () => {
    setPreferences(RESET); // Resets to default value
  };

  return <button onClick={handleReset}>Reset to Defaults</button>;
}

export { ResetButton };
```

**Why good:** Automatic localStorage sync, RESET symbol for clearing stored values, supports custom storage backends

---

## Pattern 8: splitAtom for Array Optimization

### Good Example - Optimized Array Items

```typescript
import { atom, useAtom } from "jotai";
import { splitAtom } from "jotai/utils";
import type { PrimitiveAtom } from "jotai";

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const todosAtom = atom<Todo[]>([
  { id: "1", text: "Learn Jotai", done: false },
  { id: "2", text: "Build app", done: false },
]);

// Split into individual atoms - each item gets its own atom
const todoAtomsAtom = splitAtom(todosAtom);

// With keyExtractor for stability (recommended for items with IDs)
const todoAtomsWithKeyAtom = splitAtom(todosAtom, (todo) => todo.id);

export { todosAtom, todoAtomsAtom, todoAtomsWithKeyAtom };
```

### Usage Example - Optimized List

```tsx
import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";

interface TodoItemProps {
  todoAtom: PrimitiveAtom<Todo>;
  onRemove: () => void;
}

// Each TodoItem only re-renders when its own todo changes
function TodoItem({ todoAtom, onRemove }: TodoItemProps) {
  const [todo, setTodo] = useAtom(todoAtom);

  const toggleDone = () => {
    setTodo({ ...todo, done: !todo.done });
  };

  return (
    <div>
      <input type="checkbox" checked={todo.done} onChange={toggleDone} />
      <span>{todo.text}</span>
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}

function TodoList() {
  const [todoAtoms, dispatch] = useAtom(todoAtomsWithKeyAtom);

  return (
    <ul>
      {todoAtoms.map((todoAtom) => (
        <li key={`${todoAtom}`}>
          <TodoItem
            todoAtom={todoAtom}
            onRemove={() => dispatch({ type: "remove", atom: todoAtom })}
          />
        </li>
      ))}
    </ul>
  );
}

export { TodoItem, TodoList };
```

**Why good:** Updating one item only re-renders that item's component, dispatch handles add/remove operations, keyExtractor ensures stable atom identity

---

## Pattern 9: selectAtom for Large Objects

### Good Example - Granular Selection

```typescript
import { atom } from "jotai";
import { selectAtom } from "jotai/utils";

interface UserProfile {
  name: string;
  email: string;
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  preferences: {
    theme: "light",
    notifications: true,
  },
  metadata: {
    createdAt: "",
    updatedAt: "",
  },
};

const userProfileAtom = atom<UserProfile>(DEFAULT_PROFILE);

// Only re-render when name changes
const nameAtom = selectAtom(userProfileAtom, (profile) => profile.name);

// Deep selection with custom equality
const themeAtom = selectAtom(
  userProfileAtom,
  (profile) => profile.preferences.theme,
  (a, b) => a === b
);

// Select computed value
const hasNotificationsAtom = selectAtom(
  userProfileAtom,
  (profile) => profile.preferences.notifications
);

export { userProfileAtom, nameAtom, themeAtom, hasNotificationsAtom };
```

**Why good:** Components only subscribe to specific properties, prevents re-renders when unrelated parts of object change, custom equality for precise control

### When NOT to Use selectAtom

```typescript
// BAD: Object updates every second - selectAtom adds overhead without benefit
const realtimeDataAtom = atom({ x: 0, y: 0, z: 0 }); // Updates 60fps
const xAtom = selectAtom(realtimeDataAtom, (d) => d.x); // Wasteful

// GOOD: Just use the atom directly for frequently-updating data
function LiveDisplay() {
  const [data] = useAtom(realtimeDataAtom);
  return (
    <div>
      {data.x}, {data.y}, {data.z}
    </div>
  );
}
```

**Why bad:** When all values update together anyway, selectAtom adds overhead without preventing re-renders

---

## Pattern 10: Store and Provider Patterns

### Good Example - Custom Store

```typescript
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";

const countAtom = atom(0);

// Create a custom store
const myStore = createStore();

// Pre-populate values
myStore.set(countAtom, 10);

// Subscribe to changes outside React
const unsubscribe = myStore.sub(countAtom, () => {
  console.log("Count changed:", myStore.get(countAtom));
});

// Provider with custom store
interface AppProviderProps {
  children: ReactNode;
}

function AppProvider({ children }: AppProviderProps) {
  return <Provider store={myStore}>{children}</Provider>;
}

export { myStore, AppProvider, countAtom };
```

### Good Example - Using Store Outside React

```typescript
import { createStore } from "jotai";

const store = createStore();

// Get value
const currentCount = store.get(countAtom);

// Set value
store.set(countAtom, 42);

// Subscribe to changes
const unsub = store.sub(countAtom, () => {
  console.log("New value:", store.get(countAtom));
});

// Cleanup later
// unsub();

export { store };
```

### Good Example - Provider-less Mode (Default)

```tsx
import { useAtom } from "jotai";

// Works without Provider - uses default store
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

export { Counter };
```

**Why good:** Provider-less mode works for simple cases, custom store enables access outside React, subscription pattern for external integrations

### Good Example - Resetting All State

```tsx
import { useState } from "react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";

interface ResettableProviderProps {
  children: ReactNode;
}

function ResettableProvider({ children }: ResettableProviderProps) {
  const [store, setStore] = useState(() => createStore());

  const resetAll = () => {
    setStore(createStore()); // Fresh store = reset all atoms
  };

  return (
    <Provider store={store}>
      <button onClick={resetAll}>Reset All</button>
      {children}
    </Provider>
  );
}

export { ResettableProvider };
```

**Why good:** Creating new store resets all atoms to initial values, useful for logout or testing scenarios
