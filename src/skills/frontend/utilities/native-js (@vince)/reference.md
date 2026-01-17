# Native JavaScript Reference

> Decision frameworks, anti-patterns, and red flags for native JavaScript utilities. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Native vs Utility Library

```
Need a utility function?
│
├─ Is there a native ES6-ES2025 equivalent?
│   ├─ YES → Use native (zero bundle cost)
│   │   Examples: map, filter, find, includes, Object.groupBy, Set.union
│   │
│   └─ NO → Is it a simple utility (debounce, throttle, chunk)?
│       ├─ YES → Implement natively (see patterns below)
│       │   - Simple implementations are ~10-20 lines
│       │   - No external dependencies
│       │
│       └─ NO → Is it complex with edge cases?
│           ├─ YES → Consider utility library
│           │   - Deep merge with array strategies
│           │   - Lazy evaluation chains
│           │   - Full-featured debounce (cancel, flush, leading/trailing)
│           │
│           └─ NO → Implement custom or evaluate need
```

### Native vs Lodash Quick Reference

| Task | Native Solution | Notes |
|------|-----------------|-------|
| `_.get` | `obj?.a?.b ?? default` | Optional chaining + nullish coalescing |
| `_.cloneDeep` | `structuredClone(obj)` | Handles Map, Set, Date, circular refs |
| `_.groupBy` | `Object.groupBy(arr, fn)` | ES2024 |
| `_.uniq` | `[...new Set(arr)]` | Primitives only |
| `_.uniqBy` | `[...new Map(arr.map(x => [x.id, x])).values()]` | By property |
| `_.last` | `arr.at(-1)` | ES2022 |
| `_.findLast` | `arr.findLast(fn)` | ES2023 |
| `_.sortBy` | `arr.toSorted((a,b) => ...)` | ES2023, immutable |
| `_.reverse` | `arr.toReversed()` | ES2023, immutable |
| `_.flatten` | `arr.flat()` | One level |
| `_.flattenDeep` | `arr.flat(Infinity)` | All levels |
| `_.compact` | `arr.filter(Boolean)` | Remove falsy |
| `_.pick` | Custom or destructuring | See examples |
| `_.omit` | Destructuring with rest | `const { a, ...rest } = obj` |
| `_.merge` (shallow) | `{ ...a, ...b }` | Spread operator |
| `_.difference` | `Set.difference()` or filter | ES2025 or custom |
| `_.intersection` | `Set.intersection()` or filter | ES2025 or custom |
| `_.union` | `[...new Set([...a, ...b])]` | Or ES2025 Set.union |
| `_.keys` | `Object.keys(obj)` | Native since ES5 |
| `_.values` | `Object.values(obj)` | Native since ES2017 |
| `_.entries` | `Object.entries(obj)` | Native since ES2017 |
| `_.fromPairs` | `Object.fromEntries(arr)` | ES2019 |
| `_.includes` | `arr.includes(val)` | Native since ES2016 |
| `_.isEmpty` | `Object.keys(obj).length === 0` | Simple check |

### Choosing Array Mutation vs Immutable

```
Does the operation modify the array?
├─ sort() → Use toSorted() (immutable)
├─ reverse() → Use toReversed() (immutable)
├─ splice() → Use toSpliced() (immutable)
├─ arr[i] = x → Use arr.with(i, x) (immutable)
├─ push() → Use [...arr, newItem] (creates new)
├─ unshift() → Use [newItem, ...arr] (creates new)
└─ pop()/shift() → Use slice() (creates new)

Why prefer immutable?
- Works with React state (reference equality)
- Prevents side effects in shared data
- Original preserved for comparison/undo
```

### Deep Clone Decision

```
Need to clone an object?
├─ Is it a simple object (no Date, Map, Set, functions)?
│   ├─ YES → JSON.parse(JSON.stringify(obj)) works but...
│   │   - Consider structuredClone anyway (cleaner)
│   └─ NO → Does it contain functions?
│       ├─ YES → Manual clone or library (structuredClone can't clone functions)
│       └─ NO → structuredClone(obj) ✓
│           Handles: Date, Map, Set, RegExp, ArrayBuffer, circular refs
```

---

## Function Utilities

### Debounce Pattern

```typescript
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

// Usage
const debouncedSearch = debounce(search, DEBOUNCE_DELAY_MS);

// Note: For cancel/flush/leading/trailing options, use a library
```

### Throttle Pattern

```typescript
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

// Usage
const throttledScroll = throttle(handleScroll, THROTTLE_INTERVAL_MS);
```

### Memoize Pattern

```typescript
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

// Usage
const memoizedExpensive = memoize(expensiveCalculation);

// Note: JSON.stringify key works for primitive args
// For complex objects, consider a WeakMap-based approach
```

### Once Pattern

```typescript
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

// Usage
const initializeOnce = once(heavyInitialization);
initializeOnce(); // Runs
initializeOnce(); // Returns cached result
```

---

## RED FLAGS

### High Priority Issues

- **Using `JSON.parse(JSON.stringify())` for deep clone** - Loses Date, Map, Set, undefined, functions. Use `structuredClone`.
- **Using mutating array methods with React state** - `sort()`, `reverse()`, `splice()` mutate in place. Use ES2023 immutable versions.
- **Using `arr[arr.length - 1]` for last element** - Verbose and error-prone. Use `arr.at(-1)`.
- **Using lodash for simple operations** - `_.get`, `_.last`, `_.uniq` have native alternatives. Check this skill first.
- **Using `includes()` or `indexOf()` in loops** - O(n) per check. Convert to Set first for O(1) lookups.

### Medium Priority Issues

- **Not using named constants for numbers** - Magic numbers like `arr.slice(-3)` are unclear. Use `const RECENT_COUNT = 3`.
- **Using `new Date(string)` for parsing** - Browser-inconsistent. Use proper date parsing (separate skill).
- **Reversing arrays just to find from end** - Use `findLast()` instead of `[...arr].reverse().find()`.
- **Creating objects in loops** - `Object.fromEntries` with map is often cleaner and more performant.
- **Not leveraging `Object.groupBy`** - Reduce-based grouping is verbose. Use ES2024 `Object.groupBy`.

### Common Mistakes

- Using `YYYY` style format tokens - that's Moment.js syntax, not native (use date-fns or Intl)
- Forgetting `toSorted()` returns a new array - some expect mutation like `sort()`
- Using `==` for null checks - use `=== null` or `== null` intentionally for null/undefined
- Not handling `undefined` from `at()` - `at(-1)` returns `undefined` for empty arrays
- Assuming `Object.keys()` order - insertion order is preserved for string keys in modern JS, but don't rely on it for logic

### Gotchas & Edge Cases

- **`structuredClone` cannot clone functions** - Will throw. Use manual clone if functions needed.
- **`structuredClone` cannot clone DOM nodes** - Will throw. Clone data separately from DOM.
- **`Object.groupBy` returns null-prototype object** - No `hasOwnProperty` method. Use `Object.hasOwn()`.
- **Set methods (ES2025) return Sets, not arrays** - Spread to array if needed: `[...setA.union(setB)]`.
- **`toSorted()` with no comparator** - Converts elements to strings and sorts lexicographically (like `sort()`).
- **`at()` with positive index** - Same as bracket notation, just cleaner syntax.
- **`findLast` returns `undefined`** - Not the index. Use `findLastIndex` for the index.

---

## Anti-Patterns

### JSON Clone for Complex Objects

Data loss and type corruption.

```typescript
// ❌ WRONG - Loses type information
const original = {
  date: new Date(),
  settings: new Map([["key", "value"]]),
  selected: new Set([1, 2, 3]),
};

const broken = JSON.parse(JSON.stringify(original));
// broken.date is a STRING, not Date
// broken.settings is {} empty object
// broken.selected is {} empty object

// ✅ CORRECT - Preserves all types
const correct = structuredClone(original);
// correct.date is Date
// correct.settings is Map
// correct.selected is Set
```

### Mutating Shared State

Causes bugs in React and shared references.

```typescript
// ❌ WRONG - Mutation affects original
const items = [{ id: 1 }, { id: 2 }];
const sorted = items.sort((a, b) => b.id - a.id);
// items is now ALSO sorted - they're the same array!

// ✅ CORRECT - Immutable operation
const items = [{ id: 1 }, { id: 2 }];
const sorted = items.toSorted((a, b) => b.id - a.id);
// items is unchanged, sorted is a new array
```

### O(n²) Set Operations

Using includes/indexOf in loops is slow.

```typescript
// ❌ WRONG - O(n²) complexity
const difference = arrA.filter((x) => !arrB.includes(x));
// includes is O(n), filter is O(n), total O(n²)

// ✅ CORRECT - O(n) complexity
const setB = new Set(arrB);
const difference = arrA.filter((x) => !setB.has(x));
// Set.has is O(1), filter is O(n), total O(n)
```

### Importing Lodash for Simple Operations

Unnecessary bundle weight.

```typescript
// ❌ WRONG - Adds ~3KB+ for each function
import { get, last, uniq, groupBy } from "lodash";

const value = get(obj, "a.b.c", "default");
const lastItem = last(arr);
const unique = uniq(arr);
const grouped = groupBy(items, "category");

// ✅ CORRECT - Zero bundle cost
const value = obj?.a?.b?.c ?? "default";
const lastItem = arr.at(-1);
const unique = [...new Set(arr)];
const grouped = Object.groupBy(items, (item) => item.category);
```

### Manual Reduce Instead of Built-ins

Verbose when built-in exists.

```typescript
// ❌ WRONG - Verbose reduce for grouping
const grouped = items.reduce((acc, item) => {
  const key = item.category;
  if (!acc[key]) acc[key] = [];
  acc[key].push(item);
  return acc;
}, {});

// ✅ CORRECT - Built-in groupBy
const grouped = Object.groupBy(items, (item) => item.category);
```

---

## Browser Support Reference

| Feature | Chrome | Firefox | Safari | Edge | Node.js |
|---------|--------|---------|--------|------|---------|
| Optional chaining (`?.`) | 80+ | 74+ | 13.1+ | 80+ | 14+ |
| Nullish coalescing (`??`) | 80+ | 72+ | 13.1+ | 80+ | 14+ |
| `at()` | 92+ | 90+ | 15.4+ | 92+ | 16.6+ |
| `toSorted/toReversed/with` | 110+ | 115+ | 16+ | 110+ | 20+ |
| `findLast/findLastIndex` | 97+ | 104+ | 15.4+ | 97+ | 18+ |
| `structuredClone` | 98+ | 94+ | 15.4+ | 98+ | 17+ |
| `Object.groupBy` | 117+ | 119+ | 17.4+ | 117+ | 21+ |
| `Set.union/intersection` | 122+ | 127+ | 17+ | 122+ | 22+ |
| `Object.hasOwn` | 93+ | 92+ | 15.4+ | 93+ | 16.9+ |

**Recommendation**: For most modern web apps targeting current browsers, all ES2023 features are safe. ES2024+ features (Object.groupBy) may need polyfills for older browser support. ES2025 Set methods are newest and may need feature detection.

---

## Quick Reference: Native Method Cheat Sheet

### Array Methods

```typescript
// Finding
arr.find(fn)           // First match
arr.findIndex(fn)      // Index of first match
arr.findLast(fn)       // Last match (ES2023)
arr.findLastIndex(fn)  // Index of last match (ES2023)
arr.includes(val)      // Boolean contains check
arr.indexOf(val)       // Index or -1

// Transformation (immutable)
arr.map(fn)            // Transform each
arr.filter(fn)         // Keep matching
arr.reduce(fn, init)   // Accumulate
arr.flat(depth)        // Flatten nested
arr.flatMap(fn)        // Map then flatten one level

// Immutable modifications (ES2023)
arr.toSorted(fn)       // Sort without mutation
arr.toReversed()       // Reverse without mutation
arr.toSpliced(i, n)    // Splice without mutation
arr.with(i, val)       // Replace at index

// Access
arr.at(i)              // Negative index support (ES2022)
arr.slice(start, end)  // Subarray (immutable)

// Checks
arr.every(fn)          // All match?
arr.some(fn)           // Any match?
```

### Object Methods

```typescript
// Iteration
Object.keys(obj)       // Array of keys
Object.values(obj)     // Array of values
Object.entries(obj)    // Array of [key, value]

// Creation
Object.fromEntries(arr)  // Array to object
Object.assign(t, s)      // Merge (mutates target)
{ ...a, ...b }           // Spread merge (new object)

// Grouping (ES2024)
Object.groupBy(arr, fn)  // Group by key function
Map.groupBy(arr, fn)     // Group to Map

// Checks
Object.hasOwn(obj, key)  // Safe own property check
key in obj               // Any property (including inherited)

// Immutability
Object.freeze(obj)       // Prevent all changes
Object.seal(obj)         // Prevent add/remove
structuredClone(obj)     // Deep copy
```

### Set Methods (ES2025)

```typescript
setA.union(setB)              // All elements
setA.intersection(setB)       // Common elements
setA.difference(setB)         // In A but not B
setA.symmetricDifference(setB) // In either but not both
setA.isSubsetOf(setB)         // All A in B?
setA.isSupersetOf(setB)       // All B in A?
setA.isDisjointFrom(setB)     // No common elements?
```
