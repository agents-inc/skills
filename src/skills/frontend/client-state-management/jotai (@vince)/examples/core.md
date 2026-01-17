# Jotai Core Patterns

Essential patterns for Jotai atomic state management.

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

export {
  priceAtom,
  quantityAtom,
  taxRateAtom,
  subtotalAtom,
  taxAtom,
  totalAtom,
  countAtom,
  statusAtom,
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

export {
  countAtom,
  incrementAtom,
  decrementAtom,
  addAmountAtom,
  resetAllAtom,
};
```

**Why good:** Actions are encapsulated and reusable, enables code splitting, multiple atoms can be updated atomically

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
