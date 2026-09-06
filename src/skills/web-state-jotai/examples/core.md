# Jotai Core Patterns

> Primitive, derived, write-only and read-write atoms. See [SKILL.md](../SKILL.md) for the decision trees and red flags, and [reference.md](../reference.md) for the utility lookup.

---

## Pattern 1: Primitive Atoms

### Good Example - Module-Level Atoms

```typescript
import { atom } from "jotai";

// Inference covers most cases
const countAtom = atom(0);
const textAtom = atom("");
const isOpenAtom = atom(false);

// Explicit types for nullables, unions and empty collections
interface User {
  id: string;
  name: string;
  email: string;
}

const userAtom = atom<User | null>(null);
const itemsAtom = atom<string[]>([]);

type Theme = "light" | "dark" | "system";
const themeAtom = atom<Theme>("light");

export { countAtom, textAtom, isOpenAtom, userAtom, itemsAtom, themeAtom };
```

**Why good:** Each atom is created once, at module load, so its identity is stable for the life of the process — which is what makes the value in the store findable on the next render. `atom([])` would infer `never[]`, so an empty collection states its type.

### Bad Example - Atom Created Inside a Component

```typescript
import { atom, useAtom } from "jotai";

function Counter() {
  const countAtom = atom(0); // a new identity every render
  const [count, setCount] = useAtom(countAtom);

  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

**Why bad:** The click writes to an atom the next render will not look up, so the counter never leaves zero. Nothing errors, which is what makes this hard to spot.

---

## Pattern 2: Derived (Read-Only) Atoms

### Good Example - A Chain of Derivations

```typescript
import { atom } from "jotai";

const priceAtom = atom(100);
const quantityAtom = atom(2);
const taxRateAtom = atom(0.08);

const subtotalAtom = atom((get) => get(priceAtom) * get(quantityAtom));
const taxAtom = atom((get) => get(subtotalAtom) * get(taxRateAtom));
const totalAtom = atom((get) => get(subtotalAtom) + get(taxAtom));

// A derivation can branch; the dependencies are whatever it read this time
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
  statusAtom,
};
```

**Why good:** Changing `quantityAtom` recalculates the three derivations that read it and leaves anything else alone. A component reading `totalAtom` subscribes to that chain without naming any of it.

### Bad Example - Computing in the Component

```typescript
function Total() {
  const [price] = useAtom(priceAtom);
  const [quantity] = useAtom(quantityAtom);
  const [taxRate] = useAtom(taxRateAtom);

  const subtotal = price * quantity;
  const total = subtotal + subtotal * taxRate;

  return <div>${total.toFixed(2)}</div>;
}
```

**Why bad:** The component subscribes to three atoms rather than one derivation, the arithmetic reruns on every render, and no other component can reuse the result.

---

## Pattern 3: Write-Only Atoms (Action Atoms)

### Good Example - Encapsulated Actions

```typescript
import { atom } from "jotai";

const countAtom = atom(0);
const itemsAtom = atom<string[]>([]);
const selectedIndexAtom = atom<number | null>(null);

const incrementAtom = atom(null, (get, set) => {
  set(countAtom, get(countAtom) + 1);
});

// The write function takes arguments after (get, set)
const addAmountAtom = atom(null, (get, set, amount: number) => {
  set(countAtom, get(countAtom) + amount);
});

const resetAllAtom = atom(null, (get, set) => {
  set(countAtom, 0);
  set(itemsAtom, []);
  set(selectedIndexAtom, null);
});

export { countAtom, incrementAtom, addAmountAtom, resetAllAtom };
```

**Why good:** `resetAllAtom` writes three atoms in one operation, so no reader observes a partly-reset state. The `null` read function means nothing subscribes to the action itself.

### Usage

```typescript
import { useAtomValue, useSetAtom } from "jotai";

function Counter() {
  const count = useAtomValue(countAtom);
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

`useSetAtom` returns the setter without subscribing, so a component that only writes never re-renders on the value.

---

## Pattern 4: Read-Write Atoms

### Good Example - A Lens on One Property

```typescript
import { atom } from "jotai";

interface User {
  name: string;
  email: string;
  age: number;
}

const userAtom = atom<User>({ name: "", email: "", age: 0 });

const nameAtom = atom(
  (get) => get(userAtom).name,
  (get, set, newName: string) => {
    set(userAtom, { ...get(userAtom), name: newName });
  },
);

const emailAtom = atom(
  (get) => get(userAtom).email,
  (get, set, newEmail: string) => {
    set(userAtom, { ...get(userAtom), email: newEmail });
  },
);

export { userAtom, nameAtom, emailAtom };
```

**Why good:** A field editor binds to `nameAtom` and knows nothing about the shape around it. The whole object still updates through one atom, so anything reading `userAtom` stays correct.

### Good Example - Transforming Both Directions

```typescript
const textAtom = atom("hello");

const uppercaseAtom = atom(
  (get) => get(textAtom).toUpperCase(),
  (get, set, newValue: string) => {
    set(textAtom, newValue.toLowerCase());
  },
);
```

**Why good:** The stored form and the displayed form differ, and the conversion lives in one place rather than at each call site.

### Usage

```typescript
function NameEditor() {
  const [name, setName] = useAtom(nameAtom);

  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

export { NameEditor };
```
