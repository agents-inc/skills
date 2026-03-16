---
name: web-utilities-native-js
description: Modern native JavaScript (ES2022-ES2025) utility patterns that replace lodash
---

# Native JavaScript Utility Patterns

> **Quick Guide:** Prefer native JavaScript (ES2022-ES2025) over utility libraries. Use `structuredClone` for deep cloning, `Object.groupBy` for grouping, ES2023 immutable array methods (`toSorted`, `toReversed`, `with`), and ES2025 Set methods for set operations. Only reach for utility libraries when native alternatives genuinely don't exist or lack needed features (cancel/flush on debounce, deep merge with array strategies).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use native ES2022+ methods before considering utility libraries - check this skill first)**

**(You MUST use immutable array methods (`toSorted`, `toReversed`, `toSpliced`, `with`) instead of mutating methods)**

**(You MUST use `structuredClone` for deep cloning - NOT JSON.parse/JSON.stringify hacks)**

**(You MUST define named constants for all numeric values - NO magic numbers in utility functions)**

</critical_requirements>

---

**Auto-detection:** native JavaScript utilities, lodash alternative, ES2023 array methods, toSorted, toReversed, structuredClone, Object.groupBy, Set union, Set intersection, optional chaining, nullish coalescing, at(), findLast

**When to use:**

- Array manipulation (find, filter, sort, reverse, chunk, unique, group)
- Object operations (pick, omit, merge, clone, groupBy)
- Set operations (union, intersection, difference)
- Deep cloning without external libraries
- Function utilities (debounce, throttle, memoize)

**When NOT to use:**

- Complex deep merge with custom array-handling strategies - use a library
- Lazy evaluation chains over large datasets - lodash chains are optimized for this
- Objects containing functions that need cloning - `structuredClone` cannot clone functions
- Full-featured debounce/throttle with cancel, flush, leading/trailing - use a library

**Key patterns covered:**

- Safe property access (optional chaining + nullish coalescing replaces `_.get`)
- Immutable array operations (`toSorted`, `toReversed`, `toSpliced`, `with`)
- Deep cloning with `structuredClone` (handles Map, Set, Date, circular refs)
- `Object.groupBy` / `Map.groupBy` (ES2024 - replaces reduce-based grouping)
- ES2025 Set methods (union, intersection, difference, symmetricDifference)
- Object pick/omit, unique values, chunking, flattening

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Safe access, deep cloning, immutable arrays, findLast
- [examples/arrays.md](examples/arrays.md) - Unique values, set operations, grouping, chunking, sorting
- [examples/objects.md](examples/objects.md) - Pick, omit, merge, mapKeys/mapValues, freeze
- [reference.md](reference.md) - Decision frameworks, lodash-to-native table, red flags, anti-patterns

---

<philosophy>

## Philosophy

Modern JavaScript (ES2022-ES2025) provides native alternatives for ~80% of common utility library functions. Using native methods means:

1. **Zero bundle cost** - No additional bytes shipped to users
2. **Better performance** - Native implementations are engine-optimized
3. **Future-proof** - Standards evolve, libraries may not
4. **Simpler debugging** - No library internals to step through

**Key principle:** Check native JavaScript first. Only use utility libraries for genuinely missing functionality.

```typescript
// Native is free - no imports needed
const unique = [...new Set(items)];
const last = items.at(-1);
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
const cloned = structuredClone(complexObject);
const grouped = Object.groupBy(items, (item) => item.category);
```

**ES Version Reference:**

| Feature                          | ES Version | Browser Support           |
| -------------------------------- | ---------- | ------------------------- |
| Optional chaining (`?.`)         | ES2020     | All modern browsers       |
| Nullish coalescing (`??`)        | ES2020     | All modern browsers       |
| `at()` negative indexing         | ES2022     | All modern browsers       |
| `toSorted`, `toReversed`, `with` | ES2023     | All modern browsers       |
| `Object.groupBy`, `Map.groupBy`  | ES2024     | Chrome 117+, Safari 17.4+ |
| Set methods (union, etc.)        | ES2025     | Chrome 122+, Safari 17+   |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Safe Property Access

Optional chaining + nullish coalescing replaces `_.get` with zero bundle cost.

```typescript
const DEFAULT_CITY = "Unknown";
const city = user?.address?.city ?? DEFAULT_CITY;
const result = service?.logger?.log?.("message"); // method call
const first = data?.items?.[0]?.name ?? "No items"; // array access
```

**Why this matters:** Handles null/undefined gracefully, type-safe with TypeScript, no runtime cost.

See [examples/core.md](examples/core.md) for full patterns.

---

### Pattern 2: Immutable Array Operations (ES2023)

Always use immutable variants - critical for reactive frameworks and shared state.

```typescript
const sorted = items.toSorted((a, b) => a.price - b.price); // not .sort()
const reversed = items.toReversed(); // not .reverse()
const updated = items.with(1, newItem); // not items[1] = x
const removed = items.toSpliced(1, 1); // not .splice()
```

**Why this matters:** Mutating methods cause bugs in shared state and reactive frameworks that rely on reference equality to detect changes.

See [examples/core.md](examples/core.md) for immutable update patterns.

---

### Pattern 3: Deep Cloning with structuredClone

Replaces JSON round-trip and lodash `_.cloneDeep`. Handles types JSON cannot.

```typescript
const cloned = structuredClone(complexObject);
// Preserves: Date, Map, Set, RegExp, ArrayBuffer, circular references
// Cannot clone: functions, DOM nodes, Error objects with custom properties
```

**Why this matters:** `JSON.parse(JSON.stringify())` silently corrupts Date (becomes string), Map/Set (becomes `{}`), and loses `undefined`.

See [examples/core.md](examples/core.md) for cloning patterns.

---

### Pattern 4: Object.groupBy (ES2024)

Replaces verbose reduce-based grouping and lodash `_.groupBy`.

```typescript
const byCategory = Object.groupBy(products, (p) => p.category);
const THRESHOLD = 100;
const byRange = Object.groupBy(items, (item) =>
  item.price >= THRESHOLD ? "expensive" : "affordable",
);
// Returns null-prototype object - use Object.hasOwn() not hasOwnProperty
```

**Why this matters:** Reduce-based grouping is verbose, error-prone (forgetting key init), and has prototype pollution risk with `{}`.

See [examples/arrays.md](examples/arrays.md) for grouping patterns.

---

### Pattern 5: ES2025 Set Methods

Native set operations replace manual filter-based implementations.

```typescript
const union = setA.union(setB);
const common = setA.intersection(setB);
const diff = setA.difference(setB);
const either = setA.symmetricDifference(setB);
const isSub = setA.isSubsetOf(setB);
// Returns Set - spread to array if needed: [...setA.union(setB)]
```

**Why this matters:** Filter + includes/indexOf is O(n^2). Native Set methods are O(n).

See [examples/arrays.md](examples/arrays.md) for set operations and pre-ES2025 fallbacks.

---

### Pattern 6: Finding from End (ES2023)

`findLast` and `findLastIndex` replace reverse-then-find anti-pattern.

```typescript
const lastError = logs.findLast((log) => log.level === "error");
const lastErrorIdx = logs.findLastIndex((log) => log.level === "error");
```

**Why this matters:** `[...arr].reverse().find()` creates unnecessary copy. `findLast` is single-pass.

See [examples/core.md](examples/core.md) for findLast patterns.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority:**

- Using `JSON.parse(JSON.stringify())` for deep clone - loses Date, Map, Set, undefined. Use `structuredClone`.
- Using mutating array methods (`.sort()`, `.reverse()`, `.splice()`) on shared state - causes bugs in reactive frameworks. Use ES2023 immutable versions.
- Using lodash for operations with native equivalents (`_.get`, `_.last`, `_.uniq`, `_.groupBy`) - unnecessary bundle weight.
- Using `includes()` or `indexOf()` in loops - O(n) per check. Convert to Set first for O(1) lookups.

**Medium Priority:**

- Magic numbers like `arr.slice(-3)` - use named constants: `const RECENT_COUNT = 3`.
- Reversing arrays to find from end - use `findLast()` instead of `[...arr].reverse().find()`.
- Reduce-based grouping - use `Object.groupBy()` (ES2024).
- Using `arr[arr.length - 1]` for last element - use `arr.at(-1)`.

**Gotchas & Edge Cases:**

- `structuredClone` throws on functions, DOM nodes - use manual clone if these are present.
- `Object.groupBy` returns null-prototype object - no `hasOwnProperty`. Use `Object.hasOwn()`.
- Set methods return Sets, not arrays - spread to array if needed: `[...setA.union(setB)]`.
- `toSorted()` with no comparator converts elements to strings (like `sort()`).
- `at()` returns `undefined` for empty arrays or out-of-bounds indices.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use native ES2022+ methods before considering utility libraries - check this skill first)**

**(You MUST use immutable array methods (`toSorted`, `toReversed`, `toSpliced`, `with`) instead of mutating methods)**

**(You MUST use `structuredClone` for deep cloning - NOT JSON.parse/JSON.stringify hacks)**

**(You MUST define named constants for all numeric values - NO magic numbers in utility functions)**

**Failure to follow these rules will cause unnecessary bundle bloat and mutation bugs.**

</critical_reminders>
