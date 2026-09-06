# Native JavaScript Core Examples

> Cloning, immutable updates, end-relative access and searching from the end. See
> [SKILL.md](../SKILL.md) for the decisions, [arrays.md](arrays.md) for collection operations and
> [objects.md](objects.md) for object reshaping.

---

## Safe Access

The forms worth remembering are the two that are not plain property access, and the one operator
choice that is a real bug source.

```typescript
service?.logger?.log?.("message"); // call only if it is a function
data?.items?.[0]?.name; // index only if the array is there

const perPage = options.perPage ?? 20; // 0 survives
const broken = options.perPage || 20; // 0 becomes 20
```

`??` short-circuits on `null` and `undefined` only. `||` short-circuits on every falsy value, which
is why a zero, an empty string or a `false` silently becomes the default.

---

## Deep Cloning

```typescript
interface FormState {
  values: { name: string; birthDate: Date };
  preferences: Map<string, boolean>;
  selected: Set<string>;
  history: { at: Date; action: string }[];
}

const snapshot = structuredClone(state);
snapshot.preferences.set("newsletter", false); // still a Map
snapshot.values.birthDate.getTime(); // still a Date
// `state` is untouched at every depth

// The JSON round trip corrupts all three, without an error
const broken = JSON.parse(JSON.stringify(state));
broken.values.birthDate.getTime(); // TypeError — it is a string now
broken.preferences.get("newsletter"); // TypeError — it is {} now
```

Two limits:

```typescript
// Throws DataCloneError — behaviour cannot be cloned
structuredClone({ onSave: () => {} });

// Succeeds, and quietly returns a plain object
class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
  distance() {
    return Math.hypot(this.x, this.y);
  }
}
const clone = structuredClone(new Point(3, 4));
clone.x; // 3
clone.distance(); // TypeError — the prototype did not survive
```

For a class instance, clone the data and rebuild the instance from it, or give the class its own
`clone()` method — `structuredClone` copies state and has no way to carry behaviour.

---

## Immutable Array Updates

```typescript
interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: number;
}

const byPriority = (items: readonly Todo[]) =>
  items.toSorted((a, b) => a.priority - b.priority);

const removeAt = (items: readonly Todo[], index: number) =>
  items.toSpliced(index, 1);

const insertAt = (items: readonly Todo[], index: number, item: Todo) =>
  items.toSpliced(index, 0, item);

// `with` replaces one element — spread it, because the copy is shallow
const toggle = (items: readonly Todo[], index: number) =>
  items.with(index, { ...items[index], done: !items[index].done });
```

The shallow-copy point is the one that bites:

```typescript
const next = todos.toSorted((a, b) => a.priority - b.priority);
next[0].done = true; // ❌ also mutated todos — same object, new array
```

The classic methods still exist and still mutate, which makes this shape a silent bug:

```typescript
function sortedCopy(items: Todo[]): Todo[] {
  return items.sort((a, b) => a.priority - b.priority); // ❌ sorts the caller's array
}
```

`push`, `unshift`, `pop` and `shift` have no `to*` counterpart — use `[...items, item]`,
`[item, ...items]` and `slice`.

---

## End-Relative Access

```typescript
notifications.at(-1); // last
notifications.at(-2); // second to last
notifications.at(-100); // undefined, not a throw
"document.backup.txt".split(".").at(-1); // "txt"

// Last N, in original order
const recent = notifications.slice(-3);
```

`at()` returns `T | undefined` under every compiler setting, so TypeScript forces the empty case to be
handled. `notifications[notifications.length - 1]` types as `T` unless `noUncheckedIndexedAccess` is
on, which is how an `undefined` from an empty array reaches the next line unchecked.

---

## Searching From the End

```typescript
interface Transaction {
  id: string;
  status: "pending" | "completed" | "failed";
}

// Single pass from the end — no copy, no reversal
const lastCompleted = transactions.findLast((t) => t.status === "completed");
const lastFailedIndex = transactions.findLastIndex(
  (t) => t.status === "failed",
);

// The predicate receives the index, so position-aware searches stay one pass
const lastBeforeFailure = transactions.findLast(
  (t, index) => t.status === "completed" && index < lastFailedIndex,
);
```

`[...items].reverse().find(fn)` allocates a full copy to answer the same question, and the
reversal is the only reason the copy exists.
