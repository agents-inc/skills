# Modern JavaScript Alternatives to Lodash (2025/2026)

> **Research Summary:** This document provides comprehensive guidance on replacing Lodash with native JavaScript (ES2022-ES2025) and modern utility libraries like es-toolkit and Radashi. Includes code examples, performance considerations, and decision frameworks.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Native JavaScript Alternatives by Category](#native-javascript-alternatives-by-category)
   - [Array Methods](#array-methods)
   - [Object Methods](#object-methods)
   - [String Methods](#string-methods)
   - [Collection/Iteration](#collectioniteration)
   - [Function Utilities](#function-utilities)
   - [Deep Operations](#deep-operations)
3. [Modern ES2023-ES2025 Features](#modern-es2023-es2025-features)
4. [Modern Utility Libraries](#modern-utility-libraries)
   - [es-toolkit](#es-toolkit)
   - [Radashi](#radashi)
   - [Comparison: es-toolkit vs Radashi](#comparison-es-toolkit-vs-radashi)
5. [When Lodash Is Still Appropriate](#when-lodash-is-still-appropriate)
6. [Performance Considerations](#performance-considerations)
7. [Bundle Size Impact](#bundle-size-impact)
8. [Migration Guide](#migration-guide)
9. [Decision Framework](#decision-framework)

---

## Executive Summary

**The Landscape in 2025:**

- Modern JavaScript (ES2022-ES2025) provides native alternatives for ~80% of common Lodash functions
- New utility libraries like **es-toolkit** and **Radashi** offer better performance, smaller bundles, and TypeScript-first design
- Lodash remains at ~70KB full bundle, while es-toolkit ships up to 97% less code
- Performance improvements of 2-11x are achievable with modern alternatives

**Key Recommendations:**

1. **Default to native JavaScript** for simple operations (map, filter, find, includes)
2. **Use es-toolkit** for Lodash-compatible replacements with better performance
3. **Use Radashi** for TypeScript-first projects wanting curated utilities
4. **Keep Lodash** only for complex edge cases (lazy evaluation chains, legacy support)

---

## Native JavaScript Alternatives by Category

### Array Methods

#### Finding Elements

```typescript
// ============================================
// _.find / _.findIndex
// ============================================

// Lodash
import { find, findIndex } from "lodash";
const user = find(users, { active: true });
const idx = findIndex(users, (u) => u.age > 30);

// Native ES6+
const user = users.find((u) => u.active === true);
const idx = users.findIndex((u) => u.age > 30);

// ============================================
// _.findLast / _.findLastIndex (ES2023)
// ============================================

// Lodash
import { findLast, findLastIndex } from "lodash";
const lastActive = findLast(users, { active: true });

// Native ES2023
const lastActive = users.findLast((u) => u.active === true);
const lastIdx = users.findLastIndex((u) => u.age > 30);
```

#### Array Manipulation

```typescript
// ============================================
// _.flatten / _.flattenDeep
// ============================================

// Lodash
import { flatten, flattenDeep } from "lodash";
const flat = flatten([[1, 2], [3, 4]]);
const deep = flattenDeep([[1, [2, [3, [4]]]]]);

// Native ES2019+
const flat = [[1, 2], [3, 4]].flat();
const deep = [[1, [2, [3, [4]]]]].flat(Infinity);

// ============================================
// _.compact (remove falsy values)
// ============================================

// Lodash
import { compact } from "lodash";
const cleaned = compact([0, 1, false, 2, "", 3, null]);

// Native
const cleaned = [0, 1, false, 2, "", 3, null].filter(Boolean);
// Result: [1, 2, 3]

// ============================================
// _.uniq / _.uniqBy
// ============================================

// Lodash
import { uniq, uniqBy } from "lodash";
const unique = uniq([1, 2, 2, 3, 3, 3]);
const uniqueById = uniqBy(users, "id");

// Native ES6+
const unique = [...new Set([1, 2, 2, 3, 3, 3])];

// For uniqBy, use a Map
const uniqueById = [
  ...new Map(users.map((u) => [u.id, u])).values(),
];

// ============================================
// _.difference
// ============================================

// Lodash
import { difference } from "lodash";
const diff = difference([1, 2, 3], [2, 3, 4]);
// Result: [1]

// Native
const diff = [1, 2, 3].filter((x) => ![2, 3, 4].includes(x));

// ES2025 Set methods (better performance)
const diff = [...new Set([1, 2, 3]).difference(new Set([2, 3, 4]))];

// ============================================
// _.intersection
// ============================================

// Lodash
import { intersection } from "lodash";
const common = intersection([1, 2, 3], [2, 3, 4]);
// Result: [2, 3]

// Native
const common = [1, 2, 3].filter((x) => [2, 3, 4].includes(x));

// ES2025 Set methods
const common = [...new Set([1, 2, 3]).intersection(new Set([2, 3, 4]))];

// ============================================
// _.union
// ============================================

// Lodash
import { union } from "lodash";
const merged = union([1, 2], [2, 3], [3, 4]);
// Result: [1, 2, 3, 4]

// Native ES6+
const merged = [...new Set([...[1, 2], ...[2, 3], ...[3, 4]])];

// ES2025 Set methods
const merged = [...new Set([1, 2]).union(new Set([2, 3])).union(new Set([3, 4]))];
```

#### Immutable Array Operations (ES2023)

```typescript
// ============================================
// _.sortBy → toSorted (ES2023)
// ============================================

// Lodash (mutates or requires spread)
import { sortBy } from "lodash";
const sorted = sortBy(users, ["age", "name"]);

// Native ES2023 - immutable!
const sorted = users.toSorted((a, b) => a.age - b.age);

// Multi-key sorting
const sorted = users.toSorted((a, b) => a.age - b.age || a.name.localeCompare(b.name));

// ============================================
// _.reverse → toReversed (ES2023)
// ============================================

// OLD: Mutates original array!
const reversed = arr.reverse();

// ES2023: Immutable
const reversed = arr.toReversed();

// ============================================
// _.splice → toSpliced (ES2023)
// ============================================

// OLD: Mutates original array
const removed = arr.splice(1, 2, "new");

// ES2023: Returns new array with changes
const modified = arr.toSpliced(1, 2, "new");

// ============================================
// Array element replacement → with() (ES2023)
// ============================================

// OLD
const updated = [...arr.slice(0, 2), "new", ...arr.slice(3)];

// ES2023
const updated = arr.with(2, "new");
```

#### Negative Indexing (ES2022)

```typescript
// ============================================
// _.last / _.nth → at() (ES2022)
// ============================================

// Lodash
import { last, nth } from "lodash";
const lastItem = last(arr);
const secondToLast = nth(arr, -2);

// Native ES2022
const lastItem = arr.at(-1);
const secondToLast = arr.at(-2);

// Works with strings too
const lastChar = "hello".at(-1); // "o"
```

#### Chunking and Grouping

```typescript
// ============================================
// _.chunk
// ============================================

// Lodash
import { chunk } from "lodash";
const chunks = chunk([1, 2, 3, 4, 5], 2);
// Result: [[1, 2], [3, 4], [5]]

// Native implementation
const CHUNK_SIZE = 2;

function chunk<T>(arr: T[], size: number): T[][] {
  return arr.reduce<T[][]>((chunks, item, index) => {
    const chunkIndex = Math.floor(index / size);
    if (!chunks[chunkIndex]) {
      chunks[chunkIndex] = [];
    }
    chunks[chunkIndex].push(item);
    return chunks;
  }, []);
}

// ============================================
// _.groupBy → Object.groupBy (ES2024)
// ============================================

// Lodash
import { groupBy } from "lodash";
const grouped = groupBy(users, "role");
// Result: { admin: [...], user: [...] }

// Native ES2024
const grouped = Object.groupBy(users, (user) => user.role);
// Returns null-prototype object

// Use Map.groupBy for object keys
const THRESHOLD = 6;
const restock = { restock: true };
const sufficient = { restock: false };

const grouped = Map.groupBy(inventory, ({ quantity }) =>
  quantity < THRESHOLD ? restock : sufficient
);

// Access: grouped.get(restock)
```

---

### Object Methods

#### Property Access and Manipulation

```typescript
// ============================================
// _.get → Optional Chaining + Nullish Coalescing (ES2020)
// ============================================

// Lodash
import { get } from "lodash";
const city = get(user, "address.city", "N/A");
const item = get(data, "items[0].name", "Unknown");

// Native ES2020
const city = user?.address?.city ?? "N/A";
const item = data?.items?.[0]?.name ?? "Unknown";

// With function calls
const result = obj?.method?.() ?? "default";

// ============================================
// _.pick
// ============================================

// Lodash
import { pick } from "lodash";
const subset = pick(user, ["id", "name", "email"]);

// Native with Object.fromEntries
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter((key) => key in obj).map((key) => [key, obj[key]])
  ) as Pick<T, K>;
}

// Or using reduce
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce(
    (result, key) => {
      if (key in obj) {
        result[key] = obj[key];
      }
      return result;
    },
    {} as Pick<T, K>
  );
}

// ============================================
// _.omit
// ============================================

// Lodash
import { omit } from "lodash";
const withoutPassword = omit(user, ["password", "secret"]);

// Native with destructuring (static keys)
const { password, secret, ...withoutPassword } = user;

// Native with Object.fromEntries (dynamic keys)
function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const keysSet = new Set<string | number | symbol>(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keysSet.has(key))
  ) as Omit<T, K>;
}

// ============================================
// _.mapKeys / _.mapValues
// ============================================

// Lodash
import { mapKeys, mapValues } from "lodash";
const prefixed = mapKeys(obj, (v, k) => `prefix_${k}`);
const doubled = mapValues(obj, (v) => v * 2);

// Native
function mapKeys<T extends object>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => string
): Record<string, T[keyof T]> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [fn(value as T[keyof T], key as keyof T), value])
  );
}

function mapValues<T extends object, R>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => R
): Record<keyof T, R> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fn(value as T[keyof T], key as keyof T)])
  ) as Record<keyof T, R>;
}
```

#### Object Transformation

```typescript
// ============================================
// _.assign / _.merge → Object.assign / Spread
// ============================================

// Lodash
import { assign, merge } from "lodash";
const combined = assign({}, obj1, obj2);

// Native (shallow)
const combined = { ...obj1, ...obj2 };
const combined = Object.assign({}, obj1, obj2);

// Deep merge requires custom implementation or library
// See "Deep Operations" section

// ============================================
// _.keys / _.values / _.entries
// ============================================

// All have native equivalents
const keys = Object.keys(obj);
const values = Object.values(obj);
const entries = Object.entries(obj);

// Type-safe iteration
for (const [key, value] of Object.entries(obj)) {
  console.log(`${key}: ${value}`);
}

// ============================================
// Object ↔ Array/Map conversions
// ============================================

// Object → Map
const map = new Map(Object.entries(obj));

// Map → Object
const obj = Object.fromEntries(map);

// URLSearchParams → Object
const params = new URLSearchParams("name=John&age=30");
const obj = Object.fromEntries(params);
// { name: "John", age: "30" }

// Transform object values
const doubled = Object.fromEntries(
  Object.entries(prices).map(([key, val]) => [key, val * 2])
);
```

---

### String Methods

```typescript
// ============================================
// _.capitalize
// ============================================

// Lodash
import { capitalize } from "lodash";
const cap = capitalize("hello"); // "Hello"

// Native
const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// ============================================
// _.camelCase / _.kebabCase / _.snakeCase
// ============================================

// These are complex - use a library or implement:

function camelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

// ============================================
// _.trim / _.trimStart / _.trimEnd
// ============================================

// Native equivalents exist
const trimmed = str.trim();
const leftTrimmed = str.trimStart();
const rightTrimmed = str.trimEnd();

// ============================================
// _.startsWith / _.endsWith / _.includes
// ============================================

// All native
str.startsWith("prefix");
str.endsWith("suffix");
str.includes("substring");

// ============================================
// _.pad / _.padStart / _.padEnd
// ============================================

// Native ES2017
const padded = "5".padStart(3, "0"); // "005"
const padded = "5".padEnd(3, "0"); // "500"

// ============================================
// _.repeat
// ============================================

// Native
const repeated = "ab".repeat(3); // "ababab"

// ============================================
// _.split with limit
// ============================================

// Native
const parts = "a-b-c-d".split("-", 2); // ["a", "b"]
```

---

### Collection/Iteration

```typescript
// ============================================
// _.forEach / _.map / _.filter / _.reduce
// ============================================

// All have direct native equivalents
arr.forEach((item, index) => {});
arr.map((item) => transform(item));
arr.filter((item) => predicate(item));
arr.reduce((acc, item) => acc + item, initialValue);

// ============================================
// _.some / _.every
// ============================================

// Native
const hasActive = users.some((u) => u.active);
const allActive = users.every((u) => u.active);

// ============================================
// _.includes
// ============================================

// Native (arrays and strings)
arr.includes(value);
str.includes(substring);

// With fromIndex
arr.includes(value, fromIndex);

// ============================================
// _.flatMap (ES2019)
// ============================================

// Lodash
import { flatMap } from "lodash";
const flat = flatMap(users, (u) => u.tags);

// Native ES2019
const flat = users.flatMap((u) => u.tags);

// Equivalent to:
const flat = users.map((u) => u.tags).flat();
```

---

### Function Utilities

```typescript
// ============================================
// _.debounce
// ============================================

// Lodash (full-featured)
import { debounce } from "lodash";
const debouncedSearch = debounce(search, 300, { leading: false, trailing: true });

// Native implementation
const DEBOUNCE_DELAY_MS = 300;

function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: unknown, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

const debouncedSearch = debounce(search, DEBOUNCE_DELAY_MS);

// ============================================
// _.throttle
// ============================================

// Lodash
import { throttle } from "lodash";
const throttledScroll = throttle(onScroll, 100);

// Native implementation
const THROTTLE_INTERVAL_MS = 100;

function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      func.apply(this, args);
    }
  };
}

const throttledScroll = throttle(onScroll, THROTTLE_INTERVAL_MS);

// Note: Lodash versions have cancel(), flush(), and leading/trailing options
// For production, prefer es-toolkit or Radashi implementations

// ============================================
// _.memoize
// ============================================

// Simple native implementation
function memoize<T extends (...args: unknown[]) => unknown>(
  func: T
): T {
  const cache = new Map<string, ReturnType<T>>();

  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = func.apply(this, args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  } as T;
}

// ============================================
// _.once
// ============================================

function once<T extends (...args: unknown[]) => unknown>(
  func: T
): T {
  let called = false;
  let result: ReturnType<T>;

  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (!called) {
      called = true;
      result = func.apply(this, args) as ReturnType<T>;
    }
    return result;
  } as T;
}

// ============================================
// _.noop
// ============================================

// Native
const noop = () => {};
```

---

### Deep Operations

```typescript
// ============================================
// _.cloneDeep → structuredClone (Web API)
// ============================================

// Lodash
import { cloneDeep } from "lodash";
const copy = cloneDeep(complexObject);

// Native (modern browsers, Node 17+)
const copy = structuredClone(complexObject);

// structuredClone supports:
// - Nested objects, arrays, Map, Set, Date, RegExp
// - Circular references
// - ArrayBuffer, TypedArray, Blob, File, ImageData

// structuredClone CANNOT clone:
// - Functions
// - DOM nodes
// - Symbols
// - Property descriptors, getters/setters
// - Prototype chain

// For objects with functions, use a library or custom implementation

// ============================================
// _.isEqual (deep equality)
// ============================================

// No native equivalent - implement or use library
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => isEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      isEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

// ============================================
// _.merge (deep merge)
// ============================================

// No native equivalent - implement or use library
function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        (target as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as object
        );
      } else {
        (target as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }
  return target;
}
```

---

## Modern ES2023-ES2025 Features

### ES2023 Array Methods

| Method | Description | Lodash Equivalent |
|--------|-------------|-------------------|
| `toSorted()` | Immutable sort | `_.sortBy()` |
| `toReversed()` | Immutable reverse | `_.reverse()` |
| `toSpliced()` | Immutable splice | N/A |
| `with()` | Immutable element replacement | N/A |
| `findLast()` | Find from end | `_.findLast()` |
| `findLastIndex()` | Find index from end | `_.findLastIndex()` |

### ES2024 Features

```typescript
// ============================================
// Object.groupBy / Map.groupBy
// ============================================

const products = [
  { name: "Laptop", category: "Electronics", price: 999 },
  { name: "Phone", category: "Electronics", price: 699 },
  { name: "Shirt", category: "Clothing", price: 49 },
];

// Group by category
const byCategory = Object.groupBy(products, (p) => p.category);
// { Electronics: [...], Clothing: [...] }

// ============================================
// Promise.withResolvers()
// ============================================

// Old pattern
let resolve: (value: unknown) => void;
let reject: (reason?: unknown) => void;
const promise = new Promise((res, rej) => {
  resolve = res;
  reject = rej;
});

// ES2024
const { promise, resolve, reject } = Promise.withResolvers<string>();

// Use case: Event-driven resolution
const { promise, resolve } = Promise.withResolvers<void>();
button.addEventListener("click", () => resolve(), { once: true });
await promise;
```

### ES2025 Set Methods

```typescript
// ============================================
// Set.union / intersection / difference
// ============================================

const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5, 6]);

// Union: elements in either set
const union = setA.union(setB);
// Set { 1, 2, 3, 4, 5, 6 }

// Intersection: elements in both sets
const intersection = setA.intersection(setB);
// Set { 3, 4 }

// Difference: elements in A but not B
const difference = setA.difference(setB);
// Set { 1, 2 }

// Symmetric difference: elements in either but not both
const symmetric = setA.symmetricDifference(setB);
// Set { 1, 2, 5, 6 }

// Subset/superset checks
setA.isSubsetOf(setB); // false
setA.isSupersetOf(new Set([1, 2])); // true
setA.isDisjointFrom(new Set([7, 8])); // true
```

---

## Modern Utility Libraries

### es-toolkit

**Overview:** A modern JavaScript utility library offering 2-3x better performance and up to 97% smaller bundle size compared to Lodash.

**Installation:**

```bash
npm install es-toolkit
# or
pnpm add es-toolkit
```

**Key Features:**

- 2-3x faster runtime performance
- Up to 97% smaller bundle size
- 100% TypeScript support
- Lodash compatibility layer (`es-toolkit/compat`)
- Used by Storybook, Recharts, MUI, CKEditor

**Usage Examples:**

```typescript
// Direct import
import { debounce, throttle, chunk, groupBy } from "es-toolkit";

// Lodash compatibility layer
import { debounce } from "es-toolkit/compat";

// Array utilities
import { chunk, uniq, difference, intersection } from "es-toolkit/array";

// Object utilities
import { pick, omit, mapValues } from "es-toolkit/object";

// Function utilities
import { debounce, throttle, memoize } from "es-toolkit/function";
```

**Bundle Size Comparison:**

| Function | Lodash | es-toolkit | Reduction |
|----------|--------|------------|-----------|
| `sample` | 2,000 bytes | 88 bytes | 96% |
| `omit` | 16,600 bytes | ~200 bytes | ~99% |
| `debounce` | ~5,000 bytes | ~300 bytes | 94% |

**Performance Benchmark:**

```
es-toolkit omit: 11.8x faster than lodash omit
es-toolkit pick: 9x faster than lodash pick
es-toolkit debounce: 2x faster than lodash debounce
```

---

### Radashi

**Overview:** A modern, community-first TypeScript toolkit with curated, type-safe utilities. Evolution of Radash with active maintenance.

**Installation:**

```bash
npm install radashi
# or
pnpm add radashi
```

**Key Features:**

- TypeScript-first with advanced type inference
- Zero dependencies
- Tree-shakeable
- 100+ utilities across 12 categories
- Community-driven development

**Categories:**

| Category | Functions | Examples |
|----------|-----------|----------|
| Array | 33 | `alphabetical`, `cluster`, `diff`, `group`, `unique`, `zip` |
| Async | 12 | `all`, `defer`, `guard`, `parallel`, `retry`, `sleep` |
| Curry | 12 | `chain`, `compose`, `debounce`, `memo`, `once`, `throttle` |
| Object | 19 | `assign`, `clone`, `cloneDeep`, `mapValues`, `omit`, `pick` |
| String | 11 | `camel`, `capitalize`, `dash`, `pascal`, `snake`, `title` |
| Typed | 30+ | `isArray`, `isEmpty`, `isEqual`, `isPromise` |

**Usage Examples:**

```typescript
import { select, objectify, defer, retry } from "radashi";

// select: Filter and transform in one pass
const affordable = select(
  products,
  (p) => ({ name: p.name, price: p.price }),
  (p) => p.inStock && p.price < 600
);

// objectify: Array to keyed object
const usersById = objectify(users, (u) => u.id);

// defer: Resource cleanup pattern
const result = await defer(async (cleanup) => {
  const connection = await connect();
  cleanup(() => connection.close());
  return await connection.query();
});

// retry: Automatic retry with backoff
const data = await retry({ times: 3, delay: 1000 }, async () => {
  return await fetchData();
});
```

---

### Comparison: es-toolkit vs Radashi

| Feature | es-toolkit | Radashi |
|---------|------------|---------|
| **Philosophy** | Lodash replacement | Curated TypeScript toolkit |
| **Lodash Compat** | Yes (`/compat`) | No (different API) |
| **Bundle Size** | Up to 97% smaller | Lightweight, tree-shakeable |
| **TypeScript** | Full support | TypeScript-first design |
| **Performance** | 2-3x faster than Lodash | Optimized implementations |
| **Functions** | Similar to Lodash | Unique utilities (select, defer) |
| **Maintenance** | Active (Toss) | Active (Community) |
| **Best For** | Lodash migration | New TypeScript projects |

**Recommendation:**

- **Choose es-toolkit** if migrating from Lodash or need a drop-in replacement
- **Choose Radashi** for new TypeScript projects wanting curated, unique utilities

---

## When Lodash Is Still Appropriate

### Valid Use Cases

1. **Lazy Evaluation Chains**

```typescript
// Lodash chains are lazy - only processes what's needed
const result = _(largeArray)
  .filter((x) => x > 10)
  .map((x) => x * 2)
  .take(5)
  .value();
// Only processes enough items to get 5 results

// Native is eager - processes everything
const result = largeArray
  .filter((x) => x > 10)
  .map((x) => x * 2)
  .slice(0, 5);
// Processes ALL items through filter and map first
```

2. **Legacy Browser Support**

   - Targeting IE11 or very old browsers
   - No build pipeline for polyfills

3. **Complex Deep Operations**

   - Deep equality with custom comparators
   - Deep merge with array handling strategies
   - Objects with functions that need cloning

4. **Specific Lodash Functions Without Native Equivalents**

   - `_.get` with default values and path parsing
   - `_.set` / `_.setWith`
   - `_.template`
   - `_.flow` / `_.flowRight`

### When to Avoid Lodash

- Modern browser-only projects
- Bundle size is critical
- Already using React (which requires modern browsers)
- TypeScript projects (es-toolkit/Radashi have better types)
- Performance-critical paths

---

## Performance Considerations

### Native vs Lodash Benchmarks (2025)

| Operation | Native | Lodash | Winner |
|-----------|--------|--------|--------|
| `filter` (objects) | 1x | 0.5x | Native |
| `filter` (primitives) | 1x | 1.1x | Similar |
| `map` (objects) | 1x | 0.5x | Native |
| `map` (primitives) | 1x | 2x | Lodash |
| `forEach` | 1x | 1.3x | Lodash |
| `reduce` (small arrays) | 1x | 1.1x | Similar |
| `reduce` (large arrays, Node) | 1x | 1.2x | Lodash |
| `reduce` (large arrays, Bun) | 1x | 0.8x | Native |

### Lazy Evaluation Advantage

```typescript
// 30 filters + 30 maps with native
const nativeResult = hugeArray
  .filter((x) => x > 10)
  .map((x) => x * 2);
// Processes ALL items twice

// 7 filters + 7 maps with Lodash chain (lazy)
const lodashResult = _(hugeArray)
  .filter((x) => x > 10)
  .map((x) => x * 2)
  .value();
// Significantly less work for early-terminating operations
```

### structuredClone vs lodash.cloneDeep

| Metric | structuredClone | lodash.cloneDeep |
|--------|-----------------|------------------|
| Speed (nested objects) | ~1.9ms | ~5.1ms |
| Bundle impact | 0 bytes | 17.4KB |
| Circular references | Yes | Yes |
| Functions | No | Yes |
| DOM nodes | No | Limited |

---

## Bundle Size Impact

### Full Library Sizes

| Library | Full Size | Gzipped |
|---------|-----------|---------|
| Lodash | 71.5KB | 25.2KB |
| es-toolkit | ~5KB | ~2KB |
| Radashi | 306KB | ~30KB |

### Per-Function Comparison

| Function | Lodash | es-toolkit | Native |
|----------|--------|------------|--------|
| `debounce` | 5.3KB | 0.3KB | 0KB |
| `cloneDeep` | 17.4KB | ~1KB | 0KB (structuredClone) |
| `groupBy` | ~8KB | ~0.5KB | 0KB (Object.groupBy) |
| `chunk` | ~4KB | ~0.2KB | 0KB (implement) |

### Tree-Shaking Considerations

```typescript
// BAD: Imports entire library
import _ from "lodash";
_.debounce(fn, 300);

// BETTER: Named imports (tree-shakeable)
import { debounce } from "lodash";
debounce(fn, 300);

// BEST: Direct path imports
import debounce from "lodash/debounce";
debounce(fn, 300);

// es-toolkit: Always tree-shakes properly
import { debounce } from "es-toolkit";
```

---

## Migration Guide

### Step 1: Audit Lodash Usage

```bash
# Find all lodash imports
grep -r "from 'lodash" src/
grep -r "require('lodash" src/
```

### Step 2: Categorize Functions

| Category | Action |
|----------|--------|
| Array (map, filter, find) | Replace with native |
| Object (keys, values, entries) | Replace with native |
| String (trim, pad, starts/endsWith) | Replace with native |
| Deep operations (cloneDeep, isEqual) | Use structuredClone or es-toolkit |
| Function (debounce, throttle) | Use es-toolkit or native |
| Complex (merge, get with paths) | Keep Lodash or use es-toolkit/compat |

### Step 3: Use es-toolkit/compat for Quick Migration

```typescript
// Before
import { debounce, chunk, groupBy, cloneDeep } from "lodash";

// After (drop-in replacement)
import { debounce, chunk, groupBy, cloneDeep } from "es-toolkit/compat";
```

### Step 4: Gradually Move to Native

```typescript
// Phase 1: es-toolkit/compat
import { groupBy } from "es-toolkit/compat";
const grouped = groupBy(users, "role");

// Phase 2: Native ES2024
const grouped = Object.groupBy(users, (u) => u.role);
```

### ESLint Plugin

Use `eslint-plugin-you-dont-need-lodash-underscore` to find replaceable functions:

```json
{
  "plugins": ["you-dont-need-lodash-underscore"],
  "rules": {
    "you-dont-need-lodash-underscore/all": "warn"
  }
}
```

---

## Decision Framework

```
Need a utility function?
│
├─ Is there a native ES6-ES2025 equivalent?
│   └─ YES → Use native
│       Examples: map, filter, find, includes, Object.groupBy, Set.union
│
├─ NO → Is it a simple utility (debounce, throttle, chunk)?
│   └─ YES → Use es-toolkit
│       - Better performance than Lodash
│       - Smaller bundle size
│       - TypeScript support
│
├─ NO → Is it a complex/unique utility?
│   └─ YES → Check Radashi
│       - TypeScript-first
│       - Unique utilities (select, defer, retry)
│       - Curated function set
│
├─ NO → Is Lodash compatibility critical?
│   └─ YES → Use es-toolkit/compat
│       - Drop-in Lodash replacement
│       - Same API, better performance
│
└─ NO → Implement custom or keep Lodash
    - Lazy evaluation chains
    - Legacy browser support
    - Highly specific edge cases
```

### Quick Reference Card

| Task | Recommendation |
|------|----------------|
| map, filter, find, reduce | Native Array methods |
| Deep clone | `structuredClone()` |
| Group by property | `Object.groupBy()` (ES2024) |
| Set operations | ES2025 Set methods |
| Property access | Optional chaining (`?.`) |
| Default values | Nullish coalescing (`??`) |
| Immutable sort/reverse | `toSorted()` / `toReversed()` |
| debounce, throttle | es-toolkit or Radashi |
| Deep equality | es-toolkit `isEqual` |
| pick, omit | Native or es-toolkit |
| Case conversion | Radashi or es-toolkit |
| Async utilities | Radashi (defer, retry, parallel) |

---

## Sources

- [You Don't Need Lodash/Underscore - GitHub](https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore)
- [es-toolkit Documentation](https://es-toolkit.dev/)
- [es-toolkit GitHub](https://github.com/toss/es-toolkit)
- [Radashi Documentation](https://radashi.js.org/)
- [Radashi GitHub](https://github.com/radashi-org/radashi)
- [MDN Web Docs - Object.groupBy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy)
- [MDN Web Docs - Array.prototype.toSorted](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted)
- [MDN Web Docs - Set.prototype.union](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union)
- [MDN Web Docs - structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
- [ES2023 New Array Copying Methods - Sonar](https://www.sonarsource.com/blog/es2023-new-array-copying-methods-javascript/)
- [ES2025 Set Methods - web.dev](https://web.dev/blog/set-methods)
- [Replace lodash.get with Optional Chaining - Saeloun Blog](https://blog.saeloun.com/2023/03/02/replace-lodash-get-with-optional-chaining-and-nullish-coalescing-operator/)
- [Why I Replaced Lodash with Native JavaScript in 2025 - Stackademic](https://blog.stackademic.com/why-i-replaced-lodash-with-native-javascript-in-2025-62763f231a32)
- [es-toolkit, a Lodash Alternative - LogRocket](https://blog.logrocket.com/es-toolkit-lodash-alternative/)
- [Radashi: The Lightweight TypeScript Utility Library - DEV Community](https://dev.to/githubopensource/radashi-the-lightweight-typescript-utility-library-that-will-blow-you-away-58e6)
