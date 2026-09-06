---
name: web-state-jotai
description: Atomic state management with auto-dependency tracking
---

# Jotai Patterns

> **Quick Guide:** Jotai builds state bottom-up out of atoms, each tracking its own dependencies, so a component re-renders only for the atoms it read. Atoms are defined at module level; defining one inside a component makes a new atom on every render and the state never survives. Async atoms suspend by default, so their consumers need a Suspense boundary — `loadable()` and `unwrap()` are the ways out of that. `atomFamily` from `jotai/utils` is deprecated in favour of the `jotai-family` package.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — primitive, derived, write-only and read-write atoms
- [examples/async.md](examples/async.md) — async atoms, Suspense, `loadable`, `unwrap`, atom families
- [examples/persistence.md](examples/persistence.md) — `atomWithStorage`, `selectAtom`, `splitAtom`
- [examples/testing.md](examples/testing.md) — stores, providers, reset and test isolation
- [reference.md](reference.md) — utility lookup and anti-pattern code

---

## Which path applies

- **The value is available synchronously** — primitive and derived atoms, no boundary needed; follow [examples/core.md](examples/core.md).
- **The value arrives from a promise** — the atom suspends, so the consumer needs a Suspense boundary or a wrapper that turns suspension into a value; follow [examples/async.md](examples/async.md).
- **The value has to outlive the tab** — storage-backed atoms, with a first-render caveat; follow [examples/persistence.md](examples/persistence.md).

---

<critical_requirements>

## Before writing Jotai code

**Define atoms at module level.** An atom is an identity, not a value — one created during render is a new identity each time, so the state resets on every render and the component appears not to respond.

**Give async atom consumers a Suspense boundary.** An async atom suspends the moment it is read, and a suspension with nothing to catch it propagates as an error.

**Put multi-atom updates behind a write-only atom.** The updates then land together, and the logic is reachable from anywhere without a component around it.

**Use the `jotai-family` package for parameterised atoms.** `atomFamily` in `jotai/utils` is deprecated, and families of either kind hold every atom they create until told otherwise.

</critical_requirements>

---

**Auto-detection:** `atom`, `useAtom`, `useAtomValue`, `useSetAtom`, `atomWithStorage`, `atomWithReset`, `splitAtom`, `selectAtom`, `loadable`, `unwrap`, `createStore`, `RESET`, `jotai/utils`, `jotai-family`, `Provider store`

**Applies to:**

- Composing state out of primitive, derived, write-only and read-write atoms
- Async atoms, and choosing between suspending and handling the loading state
- Persisting an atom, and splitting an array into per-item atoms
- Store and Provider scoping, including isolation between tests

**Handled elsewhere:**

- Server data — caching, invalidation and refetching belong to whatever owns the network; an async atom fetches once and has no opinion about staleness
- Single-value component state — one boolean in one component needs no atom
- State that should survive a paste of the URL — filters and pagination belong in the address bar

---

<philosophy>

Atoms are cells in a spreadsheet. A primitive atom holds a value, a derived atom is a formula over other cells, and changing a cell recalculates exactly the formulas that read it — nothing declares a dependency, because the dependency is whatever `get` was called on while the formula ran.

Two things follow. State is built bottom-up from small pieces rather than carved out of one large object, so the re-render boundary comes for free instead of from memoisation. And an atom is an **identity**, not a container: the value lives in a store, and the atom is the key. That is why the same atom read under two Providers gives two values, and why an atom created inside render is a different key each time.

</philosophy>

---

<decision_framework>

### Which atom shape

```
Does it hold a value of its own?
├─ YES -> primitive: atom(initialValue)
└─ NO -> Is it computed from other atoms?
    ├─ YES -> Does it also accept writes?
    │   ├─ YES -> read-write: atom(read, write)
    │   └─ NO  -> derived: atom((get) => ...)
    └─ NO -> it only performs updates
        └─ write-only: atom(null, (get, set) => ...)
```

### Async atoms, with or without Suspense

```
Should the consumer suspend while the value is pending?
├─ YES -> read the async atom directly, under a Suspense boundary
└─ NO -> Does the UI need to distinguish loading from error?
    ├─ YES -> loadable(asyncAtom) — a discriminated union on `state`
    └─ NO  -> unwrap(asyncAtom, fallback) — a plain value throughout
```

### Arrays

```
Does each item update independently?
├─ YES -> splitAtom, with a keyExtractor where items have ids
└─ NO  -> a single array atom is enough
```

Reach for a derived atom before `selectAtom`. The official docs call `selectAtom` an escape hatch; a derived atom expresses the same read with the dependency tracking that is the point of the library.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Primitive Atoms

A single value, typed by inference. Explicit types are for unions and nullables.

```typescript
import { atom } from "jotai";

const countAtom = atom(0);
const userAtom = atom<User | null>(null);
const themeAtom = atom<"light" | "dark" | "system">("light");
```

Full code: [examples/core.md](examples/core.md#pattern-1-primitive-atoms)

### Pattern 2: Derived Atoms

Dependencies are whatever the read function called `get` on, re-derived on each evaluation and cached until one of them changes.

```typescript
const subtotalAtom = atom((get) => get(priceAtom) * get(quantityAtom));
const taxAtom = atom((get) => get(subtotalAtom) * get(taxRateAtom));
const totalAtom = atom((get) => get(subtotalAtom) + get(taxAtom));
```

Full code: [examples/core.md](examples/core.md#pattern-2-derived-read-only-atoms)

### Pattern 3: Write-Only Atoms

A `null` read function marks an atom that only performs updates. Every `set` inside one write lands together.

```typescript
const resetAllAtom = atom(null, (get, set) => {
  set(countAtom, 0);
  set(itemsAtom, []);
  set(selectedAtom, null);
});
```

Full code: [examples/core.md](examples/core.md#pattern-3-write-only-atoms-action-atoms)

### Pattern 4: Read-Write Atoms

A lens onto part of a larger value: the read narrows, the write puts the whole value back.

```typescript
const nameAtom = atom(
  (get) => get(userAtom).name,
  (get, set, newName: string) => {
    set(userAtom, { ...get(userAtom), name: newName });
  },
);
```

Full code: [examples/core.md](examples/core.md#pattern-4-read-write-atoms)

### Pattern 5: Async Atoms with Suspense

An async read function makes the atom suspend when read.

```typescript
const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`);
  return response.json() as Promise<User>;
});

// Or, to handle the states by hand:
const loadableUserAtom = loadable(userAtom);
// { state: "loading" } | { state: "hasData", data } | { state: "hasError", error }
```

Full code: [examples/async.md](examples/async.md)

### Pattern 6: atomWithStorage for Persistence

Backs an atom with `localStorage`, `sessionStorage` or a storage object of your own. Setting it to `RESET` restores the initial value.

```typescript
import { atomWithStorage, RESET } from "jotai/utils";

const themeAtom = atomWithStorage<Theme>("app-theme", "light");
```

By default the first render shows the initial value and the stored value arrives after, which flickers. `{ getOnInit: true }` reads storage immediately, at the cost of a server render that cannot agree with it.

Full code: [examples/persistence.md](examples/persistence.md)

### Pattern 7: splitAtom for Arrays

Turns an array atom into an atom of item atoms, so editing one item re-renders one row.

```typescript
import { splitAtom } from "jotai/utils";

const todosAtom = atom<Todo[]>([]);
const todoAtomsAtom = splitAtom(todosAtom, (todo) => todo.id);
```

The key extractor is what keeps an item's atom identity stable across a reorder.

Full code: [examples/persistence.md](examples/persistence.md)

### Pattern 8: Stores and Providers

A store is where atom values actually live. Creating one explicitly gives access outside React, and isolation between trees.

```typescript
import { createStore, Provider } from "jotai";

const store = createStore();
store.set(countAtom, 10);
store.sub(countAtom, () => {
  /* value changed */
});

<Provider store={store}>
  <App />
</Provider>;
```

Full code: [examples/testing.md](examples/testing.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **An atom created inside a component** — a new identity each render, so the state resets and the UI appears frozen. Where an atom genuinely has to depend on a prop, `useMemo` over that prop is the narrow exception.
- **An async atom read with no Suspense boundary above it** — the suspension propagates as an error rather than a fallback.
- **`atomFamily` from `jotai/utils`** — deprecated; `jotai-family` is the current package.
- **A family with no eviction** — every parameter ever passed keeps an atom alive. `remove()` or `setShouldRemove()` is what bounds it.

**Surprising behaviour:**

- Each `Provider` holds its own values, so the same atom under two Providers is two pieces of state. Passing one `store` to both is what shares them.
- With no Provider at all, atoms resolve against a single global store shared by the whole app — which is why tests bleed into one another unless each gets a fresh store.
- `atomWithStorage` renders the initial value first and the stored value after, so a persisted theme flashes the default. `getOnInit: true` fixes the flash and introduces a hydration mismatch wherever the server rendered the default.
- `loadable()` never throws and never suspends; it returns a union, so reading `.data` without checking `.state` is reading a field that is not always there.
- Grouping unrelated fields into one atom re-renders every reader on every change — the same trade a single large store makes, taken inside a library built to avoid it.
- Atoms are compared by identity, not by contents, so two atoms created from the same initial value are two independent pieces of state.

</red_flags>
