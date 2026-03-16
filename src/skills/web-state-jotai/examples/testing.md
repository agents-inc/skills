# Jotai - Store, Provider, and Testing Examples

> Extended examples for stores, providers, and test isolation. See [core.md](core.md) for fundamental atom patterns.

**Prerequisites**: Understand primitive and derived atoms from core examples first.

---

## Pattern 1: Custom Store

### Good Example - Store for Outside-React Access

```typescript
import { atom, createStore } from "jotai";

const countAtom = atom(0);

// Create a custom store
const myStore = createStore();

// Pre-populate values
myStore.set(countAtom, 10);

// Read values outside React
const currentCount = myStore.get(countAtom);

// Subscribe to changes outside React
const unsubscribe = myStore.sub(countAtom, () => {
  const newValue = myStore.get(countAtom);
  // React to changes (logging, analytics, side effects)
});

export { myStore, countAtom };
```

**Why good:** Store enables Jotai state access in non-React code (event handlers, WebSocket callbacks, analytics)

### Good Example - Provider with Custom Store

```tsx
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";

interface AppProviderProps {
  children: ReactNode;
}

const appStore = createStore();

function AppProvider({ children }: AppProviderProps) {
  return <Provider store={appStore}>{children}</Provider>;
}

export { appStore, AppProvider };
```

### Good Example - Provider-less Mode

```tsx
import { useAtom, atom } from "jotai";

const countAtom = atom(0);

// Works without Provider -- uses default global store
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

export { Counter };
```

**Why good:** Provider-less mode works for simple apps, custom store enables external access

---

## Pattern 2: Resetting All State

### Good Example - Fresh Store for Full Reset

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
    setStore(createStore()); // Fresh store = all atoms reset to initial values
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

**Why good:** Creating new store resets every atom to its initial value, useful for logout or "start over" features

---

## Pattern 3: Test Isolation with Fresh Store

Jotai atoms use a global default store. Without isolation, state from one test leaks into the next.

### Good Example - Fresh Store Per Test

```typescript
import { createStore, Provider, atom } from "jotai";
import type { ReactNode } from "react";

const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2);

// Unit testing atoms directly via store (no component rendering)
// Use your test runner's describe/it/expect
let store: ReturnType<typeof createStore>;

// Fresh store before each test
beforeEach(() => {
  store = createStore();
});

// Test: starts with initial value
store.get(countAtom); // 0

// Test: can be updated
store.set(countAtom, 5);
store.get(countAtom); // 5

// Test: derived atom updates when base changes
store.set(countAtom, 3);
store.get(doubleAtom); // 6
```

### Good Example - Component Test Wrapper

```tsx
import { createStore, Provider } from "jotai";
import type { ReactNode, ReactElement } from "react";

// Reusable test wrapper -- fresh store each test
interface TestProviderProps {
  children: ReactNode;
  store?: ReturnType<typeof createStore>;
}

function TestProvider({ children, store }: TestProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}

// In your test setup:
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

// Render with isolated store
const renderWithStore = (ui: ReactElement) => {
  // Use your testing library's render function
  return render(<TestProvider store={store}>{ui}</TestProvider>);
};

// Pre-populate store for specific test scenarios
store.set(countAtom, 10);
renderWithStore(<Counter />);
// Counter shows 10, isolated from other tests
```

**Why good:** Fresh store prevents state leakage between tests, pre-populate for specific scenarios, same pattern works for unit and integration tests
