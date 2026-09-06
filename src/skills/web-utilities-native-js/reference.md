# Native JavaScript Reference

> The lodash-to-native lookup, the function utilities worth hand-rolling, and what needs an
> availability check. See [SKILL.md](SKILL.md) for the decisions and red flags, and
> [examples/](examples/) for full code.

---

## Utility Library to Native

| Utility             | Native                                                        | Notes                                          |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `_.get`             | `obj?.a?.b ?? fallback`                                       | `??`, not `\|\|` — `0` and `""` are values     |
| `_.cloneDeep`       | `structuredClone(obj)`                                        | Drops prototypes, throws on functions          |
| `_.groupBy`         | `Object.groupBy(arr, fn)`                                     | ES2024; `Map.groupBy` for non-string keys      |
| `_.uniq`            | `[...new Set(arr)]`                                           | Primitives only                                |
| `_.uniqBy`          | `[...new Map(arr.map(x => [x.id, x])).values()]`              | Keeps the last of each key                     |
| `_.last`            | `arr.at(-1)`                                                  | ES2022                                         |
| `_.findLast`        | `arr.findLast(fn)`                                            | ES2023                                         |
| `_.sortBy`          | `arr.toSorted(cmp)`                                           | ES2023, immutable                              |
| `_.reverse`         | `arr.toReversed()`                                            | ES2023, immutable                              |
| `_.flatten`         | `arr.flat()`                                                  | One level                                      |
| `_.flattenDeep`     | `arr.flat(Infinity)`                                          | All levels                                     |
| `_.compact`         | `arr.filter((x): x is T => x != null)`                        | `filter(Boolean)` also drops `0` and `""`      |
| `_.pick`            | Destructuring, or the typed helper                            | See [examples/objects.md](examples/objects.md) |
| `_.omit`            | `const { secret, ...rest } = obj`                             | Rest element                                   |
| `_.merge` (shallow) | `{ ...a, ...b }`                                              | Nested objects are replaced, not merged        |
| `_.difference`      | `setA.difference(setB)`                                       | ES2025, or `filter` over a `Set`               |
| `_.intersection`    | `setA.intersection(setB)`                                     | ES2025, or `filter` over a `Set`               |
| `_.union`           | `setA.union(setB)`                                            | ES2025, or `[...new Set([...a, ...b])]`        |
| `_.keyBy`           | `Object.fromEntries(arr.map(x => [x.id, x]))`                 | Or `new Map(...)` for non-string keys          |
| `_.mapValues`       | `Object.fromEntries(Object.entries(o).map(…))`                | See [examples/objects.md](examples/objects.md) |
| `_.invert`          | `Object.fromEntries(Object.entries(o).map(([k,v]) => [v,k]))` | Collisions keep the last                       |
| `_.isEmpty`         | `Object.keys(obj).length === 0`                               | Objects only                                   |
| `_.chunk`           | Slice loop                                                    | See [examples/arrays.md](examples/arrays.md)   |
| `_.debounce`        | Hand-rolled, below                                            | Take a library for `cancel`/`flush`            |
| `_.throttle`        | Hand-rolled, below                                            | Take a library for leading/trailing edges      |

---

## Function Utilities

None of these have a native equivalent, and all four are short enough to own.

### Debounce

Fires once the calls stop. Trailing edge only — a library is the answer for leading-edge,
`cancel` or `flush`.

```typescript
function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  waitMs: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), waitMs);
  };

  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}
```

The `cancel` is worth the two extra lines: without it a pending timer fires after the caller is
gone, which is the usual source of "state updated after teardown".

### Throttle

Fires at most once per interval, on the leading edge. Calls arriving inside the window are dropped
rather than deferred — for scroll and resize handlers that is the point; for a save button it is a
lost keystroke.

```typescript
function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  intervalMs: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= intervalMs) {
      lastRun = now;
      fn(...args);
    }
  };
}
```

### Memoize

```typescript
function memoize<T extends (...args: never[]) => unknown>(fn: T): T {
  const cache = new Map<string, unknown>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  }) as T;
}
```

Two limits. The `JSON.stringify` key only distinguishes arguments JSON can represent, so two
different objects with the same fields hit the same entry, and the cache grows without bound — for
a single object argument, a `WeakMap` keyed on the object both distinguishes correctly and lets
entries be collected.

### Once

```typescript
function once<T extends (...args: never[]) => unknown>(fn: T): T {
  let called = false;
  let result: unknown;

  return ((...args: Parameters<T>) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  }) as T;
}
```

---

## Availability

| Feature                                                | Edition | Check before shipping?          |
| ------------------------------------------------------ | ------- | ------------------------------- |
| `?.`, `??`                                             | ES2020  | No                              |
| `at()`, `Object.hasOwn`, `structuredClone`             | ES2022  | No                              |
| `findLast`, `findLastIndex`                            | ES2023  | No                              |
| `toSorted`, `toReversed`, `toSpliced`, `with`          | ES2023  | No                              |
| `Object.groupBy`, `Map.groupBy`                        | ES2024  | Yes — the newest widely shipped |
| `union`, `intersection`, `difference`, `isSubsetOf`, … | ES2025  | Yes — the least available       |

The two rows to check are the last two, and the check is your project's own browser and runtime
targets rather than a date. Both degrade to a few lines of `Set` and `reduce` — see
[examples/arrays.md](examples/arrays.md) — which is usually cheaper than a polyfill.

`structuredClone` is a host function rather than a language feature: it exists on `window`, on
`globalThis` in Node, and in workers, but not in every JavaScript embedding.
