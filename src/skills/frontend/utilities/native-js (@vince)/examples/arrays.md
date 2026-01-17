# Native JavaScript Array Examples

> Array manipulation patterns using native ES2022-ES2025 JavaScript. See [SKILL.md](../SKILL.md) for core concepts.

---

## Unique Values (Deduplication)

### Good Example - Set for Unique Primitives

```typescript
// Unique primitives with Set
const numbers = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4];
const uniqueNumbers = [...new Set(numbers)];
// [1, 2, 3, 4]

const strings = ["apple", "banana", "apple", "cherry", "banana"];
const uniqueStrings = [...new Set(strings)];
// ["apple", "banana", "cherry"]

// Unique by property (objects)
interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
  { id: "1", name: "Alice Updated", email: "alice@example.com" }, // Duplicate id
];

// Unique by id - keeps LAST occurrence
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

const uniqueUsers = uniqueById(users);
// [{ id: "1", name: "Alice Updated", ... }, { id: "2", name: "Bob", ... }]

// Unique by id - keeps FIRST occurrence
function uniqueByIdFirst<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const uniqueUsersFirst = uniqueByIdFirst(users);
// [{ id: "1", name: "Alice", ... }, { id: "2", name: "Bob", ... }]
```

**Why good:** Set is O(1) lookup, spread creates array, Map preserves last value per key

### Bad Example - Lodash or indexOf

```typescript
import { uniq, uniqBy } from "lodash"; // Adds bundle weight

const unique = uniq(numbers); // lodash
const uniqueById = uniqBy(users, "id"); // lodash

// O(n²) with indexOf
const uniqueNumbers = numbers.filter((num, index) => numbers.indexOf(num) === index);
```

**Why bad:** lodash adds ~3KB per function, indexOf is O(n) making filter O(n²)

---

## Set Operations (ES2025)

### Good Example - Native Set Methods

```typescript
// ES2025 Set methods
const setA = new Set([1, 2, 3, 4, 5]);
const setB = new Set([4, 5, 6, 7, 8]);

// Union - elements in either set
const union = setA.union(setB);
// Set { 1, 2, 3, 4, 5, 6, 7, 8 }

// Intersection - elements in both sets
const intersection = setA.intersection(setB);
// Set { 4, 5 }

// Difference - elements in A but not B
const difference = setA.difference(setB);
// Set { 1, 2, 3 }

// Symmetric difference - elements in either but not both
const symmetricDifference = setA.symmetricDifference(setB);
// Set { 1, 2, 3, 6, 7, 8 }

// Subset/superset checks
const isSubset = new Set([1, 2]).isSubsetOf(setA); // true
const isSuperset = setA.isSupersetOf(new Set([1, 2])); // true
const isDisjoint = setA.isDisjointFrom(new Set([10, 11])); // true

// Convert back to array
const unionArray = [...union];
// [1, 2, 3, 4, 5, 6, 7, 8]

// Practical example: Find common tags
interface Article {
  title: string;
  tags: string[];
}

function findCommonTags(articles: Article[]): string[] {
  if (articles.length === 0) return [];

  let common = new Set(articles[0].tags);

  for (const article of articles.slice(1)) {
    common = common.intersection(new Set(article.tags));
  }

  return [...common];
}

const articles: Article[] = [
  { title: "React Basics", tags: ["react", "javascript", "frontend"] },
  { title: "Advanced React", tags: ["react", "typescript", "frontend"] },
  { title: "React Testing", tags: ["react", "testing", "frontend"] },
];

const commonTags = findCommonTags(articles);
// ["react", "frontend"]
```

**Why good:** native O(n) set operations, clean API, no dependencies

### Fallback Example - Pre-ES2025 Set Operations

```typescript
// For environments without ES2025 Set methods

// Union
function setUnion<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

// Intersection
function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => b.has(x)));
}

// Difference
function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

// Usage
const union = setUnion(setA, setB);
const intersection = setIntersection(setA, setB);
const difference = setDifference(setA, setB);
```

**Why good:** fallback for older browsers, same O(n) complexity, easy to upgrade later

---

## Array Difference and Intersection

### Good Example - Without ES2025 Set Methods

```typescript
// Array difference (elements in A but not B)
function arrayDifference<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

const removed = arrayDifference([1, 2, 3, 4, 5], [2, 4]);
// [1, 3, 5]

// Array intersection (elements in both)
function arrayIntersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

const common = arrayIntersection([1, 2, 3], [2, 3, 4]);
// [2, 3]

// Object array difference by key
interface Item {
  id: string;
  name: string;
}

function objectDifference<T extends { id: string }>(a: T[], b: T[]): T[] {
  const idsB = new Set(b.map((item) => item.id));
  return a.filter((item) => !idsB.has(item.id));
}

const itemsA: Item[] = [
  { id: "1", name: "Item 1" },
  { id: "2", name: "Item 2" },
  { id: "3", name: "Item 3" },
];

const itemsB: Item[] = [
  { id: "2", name: "Item 2" },
];

const onlyInA = objectDifference(itemsA, itemsB);
// [{ id: "1", name: "Item 1" }, { id: "3", name: "Item 3" }]
```

**Why good:** O(n) with Set for lookup, works with objects via key extraction

### Bad Example - Nested Loops

```typescript
// O(n²) complexity
const difference = [1, 2, 3, 4, 5].filter((x) => ![2, 4].includes(x));
// includes is O(n), filter is O(n), total O(n²)

// Even worse for objects
const onlyInA = itemsA.filter(
  (a) => !itemsB.some((b) => b.id === a.id)
);
// some is O(n), filter is O(n), total O(n²)
```

**Why bad:** includes/some are O(n), making overall O(n²) - very slow for large arrays

---

## Grouping (Object.groupBy)

### Good Example - ES2024 Object.groupBy

```typescript
interface Order {
  id: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  total: number;
  customerId: string;
}

const orders: Order[] = [
  { id: "1", status: "pending", total: 100, customerId: "c1" },
  { id: "2", status: "shipped", total: 200, customerId: "c2" },
  { id: "3", status: "pending", total: 150, customerId: "c1" },
  { id: "4", status: "delivered", total: 300, customerId: "c3" },
  { id: "5", status: "shipped", total: 250, customerId: "c2" },
];

// Group by status
const byStatus = Object.groupBy(orders, (order) => order.status);
// {
//   pending: [{ id: "1", ... }, { id: "3", ... }],
//   shipped: [{ id: "2", ... }, { id: "5", ... }],
//   delivered: [{ id: "4", ... }]
// }

// Group by computed value
const HIGH_VALUE_THRESHOLD = 200;
const byValue = Object.groupBy(orders, (order) =>
  order.total >= HIGH_VALUE_THRESHOLD ? "highValue" : "standard"
);

// Access grouped data
const pendingOrders = byStatus.pending ?? [];
const pendingTotal = pendingOrders.reduce((sum, order) => sum + order.total, 0);

// Group by customer
const byCustomer = Object.groupBy(orders, (order) => order.customerId);

// Count per group
const countByStatus = Object.fromEntries(
  Object.entries(byStatus).map(([status, items]) => [status, items?.length ?? 0])
);
// { pending: 2, shipped: 2, delivered: 1 }
```

**Why good:** declarative, returns null-prototype object (safe from prototype pollution), single pass

### Bad Example - Manual Reduce

```typescript
// Verbose and error-prone
const byStatus = orders.reduce<Record<string, Order[]>>((acc, order) => {
  const key = order.status;
  if (!acc[key]) {
    acc[key] = [];
  }
  acc[key].push(order);
  return acc;
}, {});

// Easy to forget initialization check
const buggy = orders.reduce<Record<string, Order[]>>((acc, order) => {
  acc[order.status].push(order); // TypeError: Cannot read property 'push' of undefined
  return acc;
}, {});
```

**Why bad:** verbose boilerplate, easy to forget key initialization, prototype pollution risk with `{}`

---

## Chunking

### Good Example - Native Chunk Implementation

```typescript
const CHUNK_SIZE = 3;

function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error("Chunk size must be positive");
  }

  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const chunked = chunk(numbers, CHUNK_SIZE);
// [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

// Practical use: Batch API calls
const API_BATCH_SIZE = 50;

async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches = chunk(items, batchSize);
  const results: R[] = [];

  for (const batch of batches) {
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

// Usage
const userIds = ["1", "2", "3", /* ... 1000 ids */];
const users = await batchProcess(userIds, API_BATCH_SIZE, async (ids) => {
  // Fetch users in batches of 50
  return fetchUsers(ids);
});

// Alternative: Reduce-based chunk
function chunkReduce<T>(array: T[], size: number): T[][] {
  return array.reduce<T[][]>((acc, item, index) => {
    const chunkIndex = Math.floor(index / size);
    if (!acc[chunkIndex]) {
      acc[chunkIndex] = [];
    }
    acc[chunkIndex].push(item);
    return acc;
  }, []);
}
```

**Why good:** simple slice-based implementation, clear logic, handles edge cases

---

## Flattening

### Good Example - Native flat and flatMap

```typescript
// flat - flatten nested arrays
const nested = [[1, 2], [3, 4], [5, 6]];
const flattened = nested.flat();
// [1, 2, 3, 4, 5, 6]

// flat with depth
const deepNested = [1, [2, [3, [4, [5]]]]];
const flatOne = deepNested.flat();      // [1, 2, [3, [4, [5]]]]
const flatTwo = deepNested.flat(2);     // [1, 2, 3, [4, [5]]]
const flatAll = deepNested.flat(Infinity); // [1, 2, 3, 4, 5]

// flatMap - map then flatten one level
interface Category {
  name: string;
  items: string[];
}

const categories: Category[] = [
  { name: "Fruits", items: ["Apple", "Banana"] },
  { name: "Vegetables", items: ["Carrot", "Broccoli"] },
];

// Get all items
const allItems = categories.flatMap((cat) => cat.items);
// ["Apple", "Banana", "Carrot", "Broccoli"]

// flatMap for optional results (filter + map in one)
const numbers = [1, 2, 3, 4, 5, 6];
const THRESHOLD = 3;

const doubled = numbers.flatMap((n) =>
  n > THRESHOLD ? [n * 2] : []
);
// [8, 10, 12] - only doubles numbers > 3

// Practical: Extract nested tags
interface Post {
  title: string;
  tags: string[];
}

const posts: Post[] = [
  { title: "Post 1", tags: ["react", "javascript"] },
  { title: "Post 2", tags: ["typescript", "react"] },
];

const allTags = posts.flatMap((post) => post.tags);
const uniqueTags = [...new Set(allTags)];
// ["react", "javascript", "typescript"]
```

**Why good:** native methods are optimized, flatMap combines map+flat for efficiency, Infinity flattens all levels

---

## Sorting (Immutable)

### Good Example - toSorted with Various Comparators

```typescript
interface Employee {
  name: string;
  department: string;
  salary: number;
  hireDate: Date;
}

const employees: Employee[] = [
  { name: "Alice", department: "Engineering", salary: 120000, hireDate: new Date("2020-03-15") },
  { name: "Bob", department: "Marketing", salary: 80000, hireDate: new Date("2019-07-22") },
  { name: "Charlie", department: "Engineering", salary: 95000, hireDate: new Date("2021-01-10") },
  { name: "Diana", department: "Marketing", salary: 85000, hireDate: new Date("2020-11-05") },
];

// Sort by salary (ascending)
const bySalaryAsc = employees.toSorted((a, b) => a.salary - b.salary);

// Sort by salary (descending)
const bySalaryDesc = employees.toSorted((a, b) => b.salary - a.salary);

// Sort by name (alphabetical)
const byName = employees.toSorted((a, b) => a.name.localeCompare(b.name));

// Sort by date (oldest first)
const byHireDate = employees.toSorted(
  (a, b) => a.hireDate.getTime() - b.hireDate.getTime()
);

// Multi-key sort: department, then salary descending
const byDeptThenSalary = employees.toSorted((a, b) => {
  const deptCompare = a.department.localeCompare(b.department);
  if (deptCompare !== 0) return deptCompare;
  return b.salary - a.salary; // Higher salary first within department
});

// Original array unchanged
console.log(employees[0].name); // "Alice" - unchanged

// Reusable comparator factory
function createComparator<T>(
  key: keyof T,
  direction: "asc" | "desc" = "asc"
): (a: T, b: T) => number {
  return (a, b) => {
    const valueA = a[key];
    const valueB = b[key];

    let comparison: number;
    if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else if (typeof valueA === "number" && typeof valueB === "number") {
      comparison = valueA - valueB;
    } else {
      comparison = 0;
    }

    return direction === "asc" ? comparison : -comparison;
  };
}

const byNameDesc = employees.toSorted(createComparator("name", "desc"));
```

**Why good:** toSorted never mutates original, clear comparator patterns, reusable factory

### Bad Example - Mutating Sort

```typescript
// Mutates the array!
const sorted = employees.sort((a, b) => a.salary - b.salary);
// employees is now also sorted - mutation!

// Common mistake: forgetting sort mutates
function getSortedCopy(items: Employee[]): Employee[] {
  return items.sort((a, b) => a.salary - b.salary);
  // BUG: items is mutated, not just the return value
}
```

**Why bad:** sort() mutates the original array, causing bugs when the array is shared or used elsewhere

---

## Compact (Remove Falsy Values)

### Good Example - filter(Boolean)

```typescript
// Remove falsy values (null, undefined, 0, "", false, NaN)
const mixed = [0, 1, false, 2, "", 3, null, undefined, NaN, 4];
const truthy = mixed.filter(Boolean);
// [1, 2, 3, 4]

// Practical: Clean up optional values
interface FormData {
  name?: string;
  email?: string;
  phone?: string;
}

function getFilledFields(data: FormData): string[] {
  return [data.name, data.email, data.phone].filter(
    (value): value is string => Boolean(value)
  );
}

const formData: FormData = {
  name: "John",
  email: "",
  phone: undefined,
};

const filled = getFilledFields(formData);
// ["John"]

// Filter out nullish but keep 0 and false
const values = [0, 1, null, 2, undefined, 3, false];
const nonNullish = values.filter((v) => v != null);
// [0, 1, 2, 3, false]

// Type-safe compact for specific type
function compact<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item != null);
}

const maybeStrings: (string | null | undefined)[] = ["a", null, "b", undefined, "c"];
const strings = compact(maybeStrings);
// ["a", "b", "c"] - TypeScript knows this is string[]
```

**Why good:** filter(Boolean) is idiomatic, type guard preserves TypeScript inference
