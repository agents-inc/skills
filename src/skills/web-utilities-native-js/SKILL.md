---
name: web-utilities-native-js
description: Modern native JavaScript (ES2022-ES2025) utility patterns that replace lodash
---

# Native JavaScript Utility Patterns

> **Quick Guide:** Most utility-library calls now have a native equivalent with no bundle cost.
> The four that change how code is written are `structuredClone` for deep copies, the ES2023
> immutable array methods (`toSorted`, `toReversed`, `toSpliced`, `with`), `Object.groupBy` /
> `Map.groupBy`, and the ES2025 Set operations. The two facts that catch people out: a structured
> clone drops prototypes and throws on functions, and the immutable array methods copy one level
> deep.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — cloning, immutable updates, negative indexing, searching from the end
- [examples/arrays.md](examples/arrays.md) — deduplication, set operations, grouping, chunking, sorting, compacting
- [examples/objects.md](examples/objects.md) — typed pick/omit/mapValues, deep merge, lookup maps, freezing
- [reference.md](reference.md) — lodash-to-native table, function utilities (debounce, throttle, memoize), availability

---

<critical_requirements>

## Before writing utility code

**Reach for the native method before adding a dependency.** The lodash-to-native table in
[reference.md](reference.md) settles most of it in one lookup, and the native call ships nothing.

**Deep-copy with `structuredClone`.** A JSON round trip turns a `Date` into a string and a `Map` or
`Set` into `{}`, and it does so silently — the failure surfaces later, at the first `.getTime()`.

**Use the `to*` array methods where the array is shared.** `sort`, `reverse` and `splice` rewrite
the array in place, so a function that "returns a sorted copy" with `sort` has changed its caller's
data.

**Convert to a `Set` before repeated membership checks.** `includes` inside a `filter` is O(n²), and
the difference shows up at a few thousand elements.

</critical_requirements>

---

**Auto-detection:** structuredClone, Object.groupBy, Map.groupBy, toSorted, toReversed, toSpliced,
Array.prototype.with, findLast, findLastIndex, at(-1), Object.hasOwn, Object.fromEntries,
Set.prototype.union, Set.prototype.intersection, Set.prototype.difference, symmetricDifference,
isSubsetOf, isDisjointFrom, lodash alternative, native JavaScript utilities

**Applies to:**

- Array work — deduplicating, grouping, chunking, flattening, sorting immutably, searching from the end
- Object work — picking, omitting, merging, key/value transformation, lookup maps
- Set algebra — union, intersection, difference, subset tests
- Deep copying without a dependency
- Hand-rolled function utilities — debounce, throttle, memoize, once

**Handled elsewhere:**

- Date arithmetic, parsing and formatting — `Date` alone does not cover it
- Reactive updates — these methods produce new references, and what consumes a new reference is the concern of whatever owns the state
- Schema validation and runtime parsing — these utilities reshape data that is already trusted

---

<decision_framework>

## Native or a dependency

Three cases, in order:

- **A native method exists** — use it. The table in [reference.md](reference.md) is the lookup.
- **No native method, but the implementation is ten lines** — write it. `chunk`, `pick`, `omit`,
  `compact`, `deepMerge`, `debounce`, `throttle`, `memoize` and `once` are all in this skill,
  written out and typed.
- **The edge cases are the feature** — take the dependency. A debounce with `cancel`, `flush` and
  leading/trailing edges; a deep merge with per-key array strategies; lazy evaluation over a
  dataset large enough that intermediate arrays matter. Reimplementing these badly costs more than
  the bytes.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: structuredClone for deep copies

Preserves `Date`, `Map`, `Set`, `RegExp`, typed arrays and circular references — everything a JSON
round trip destroys.

```typescript
const snapshot = structuredClone(state);
// Preserved: Date, Map, Set, RegExp, ArrayBuffer, circular refs
// Throws on: functions, DOM nodes, Proxy, symbols
// Silently lost: the prototype — a class instance clones to a plain object
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Immutable array methods (ES2023)

Four `to*` methods return a new array where the classic method rewrote the old one.

```typescript
items.toSorted((a, b) => a.price - b.price); // vs .sort()
items.toReversed(); // vs .reverse()
items.toSpliced(index, 1); // vs .splice()
items.with(index, { ...items[index], done: true }); // vs items[i] = x
```

The copy is shallow: the new array holds the same element objects, which is why the update above
spreads before writing.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Object.groupBy and Map.groupBy (ES2024)

```typescript
const byStatus = Object.groupBy(orders, (order) => order.status);
// { pending: [...], shipped: [...] } — null-prototype, values are `T[] | undefined`

const byCustomer = Map.groupBy(orders, (order) => order.customer);
// Map keyed by the object itself — use this when the key is not a string
```

`Object.groupBy` coerces the key to a string and returns a null-prototype object, so reach for
`Object.hasOwn(byStatus, key)` rather than `byStatus.hasOwnProperty(key)`.

Full code: [examples/arrays.md](examples/arrays.md)

---

### Pattern 4: Set operations (ES2025)

```typescript
setA.union(setB);
setA.intersection(setB);
setA.difference(setB); // in A, not in B
setA.symmetricDifference(setB);
setA.isSubsetOf(setB);
setA.isSupersetOf(setB);
setA.isDisjointFrom(setB);
```

Each returns a `Set`, so spread when an array is wanted. The argument is any set-like with `size`,
`has` and `keys` — a `Map` qualifies, a plain array does not.

Full code: [examples/arrays.md](examples/arrays.md)

---

### Pattern 5: Searching and indexing from the end

```typescript
logs.findLast((log) => log.level === "error"); // ES2023, single pass
logs.findLastIndex((log) => log.level === "error");
items.at(-1); // ES2022, undefined when empty
"file.backup.txt".split(".").at(-1); // "txt" — strings too
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Object.fromEntries as the transformation pivot

`entries → map/filter → fromEntries` covers pick, omit, invert, mapValues, mapKeys and array-to-lookup
in one shape, so those helpers are four lines each rather than a dependency.

```typescript
const keyed = Object.fromEntries(items.map((item) => [item.id, item]));
const withTax = Object.fromEntries(
  Object.entries(prices).map(([k, v]) => [k, v * 1.1]),
);
const passing = Object.fromEntries(
  Object.entries(scores).filter(([, score]) => score >= 90),
);
```

Full code: [examples/objects.md](examples/objects.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `structuredClone` on anything holding a function, a DOM node or a Proxy throws `DataCloneError` — clone the data separately from the behaviour.
- `JSON.parse(JSON.stringify(x))` does not throw; it corrupts. A `Date` becomes a string, a `Map` or `Set` becomes `{}`, `undefined` members vanish, and the first method call on the result is where it surfaces.
- `Object.groupBy` returns a null-prototype object, so `result.hasOwnProperty(...)` throws. Use `Object.hasOwn`.
- Set methods reject a plain array — they need something with `size`, `has` and `keys`.

**Surprising behaviour:**

- `structuredClone` discards the prototype. A class instance clones to a plain object with the same fields and none of the methods.
- `toSorted()` with no comparator sorts by string, so `[10, 9, 1].toSorted()` is `[1, 10, 9]` — exactly as `sort()` always did.
- The `to*` methods copy one level. Editing an element of the new array edits the same object in the old one.
- `arr.at(-1)` types as `T | undefined` whatever the compiler options, so the empty case has to be handled. `arr[arr.length - 1]` types as `T` unless `noUncheckedIndexedAccess` is on — that is the form that lets an `undefined` flow on unchecked.
- `structuredClone` on an `Error` succeeds and keeps the standard fields, but a `code`, a `status` or anything else attached to it is not in the copy.
- `filter(Boolean)` drops `0`, `""` and `false` along with the nullish values, and TypeScript does not narrow the result — `filter((x): x is T => x != null)` does both jobs correctly.
- `Object.freeze` is shallow, and outside strict mode a write to a frozen object fails silently rather than throwing.
- `Object.keys` returns integer-like keys first in ascending numeric order, whatever the insertion order — only string keys keep insertion order.

</red_flags>
