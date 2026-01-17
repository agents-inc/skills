# Jotai Testing Patterns

Patterns for testing Jotai atoms and components.

---

## Pattern 1: Store and Provider Patterns

### Good Example - Custom Store

```typescript
import { atom, createStore, Provider } from "jotai";
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
import { createStore, atom } from "jotai";

const countAtom = atom(0);
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
import { useAtom, atom } from "jotai";

const countAtom = atom(0);

// Works without Provider - uses default store
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

export { Counter };
```

**Why good:** Provider-less mode works for simple cases, custom store enables access outside React, subscription pattern for external integrations

---

## Pattern 2: Resetting All State

### Good Example - Fresh Store for Reset

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

---

## Pattern 3: Testing with Custom Store

### Good Example - Unit Testing Atoms

```typescript
import { createStore, atom } from "jotai";
import { describe, it, expect, beforeEach } from "vitest";

const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2);

describe("countAtom", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("starts with initial value", () => {
    expect(store.get(countAtom)).toBe(0);
  });

  it("can be updated", () => {
    store.set(countAtom, 5);
    expect(store.get(countAtom)).toBe(5);
  });

  it("derived atom updates when base changes", () => {
    store.set(countAtom, 3);
    expect(store.get(doubleAtom)).toBe(6);
  });
});
```

### Good Example - Testing Components with Atoms

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider, createStore, atom } from "jotai";
import { describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";

const countAtom = atom(0);

interface TestProviderProps {
  children: ReactNode;
  store?: ReturnType<typeof createStore>;
}

function TestProvider({ children, store }: TestProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}

describe("Counter component", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("renders initial count", () => {
    render(
      <TestProvider store={store}>
        <Counter />
      </TestProvider>
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("increments count on click", () => {
    render(
      <TestProvider store={store}>
        <Counter />
      </TestProvider>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("can start with pre-populated value", () => {
    store.set(countAtom, 10);
    render(
      <TestProvider store={store}>
        <Counter />
      </TestProvider>
    );
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});
```

**Why good:** Fresh store per test prevents state leakage, pre-populate values for specific test scenarios, same patterns work in unit and integration tests
