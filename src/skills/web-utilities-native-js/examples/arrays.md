# Native JavaScript Array Examples

> Deduplication, set algebra, grouping, chunking, sorting and compacting. See [SKILL.md](../SKILL.md)
> for the decisions and [core.md](core.md) for cloning and immutable updates.

---

## Deduplication

Primitives go through a `Set`; objects go through a `Map` keyed on whatever makes them the same
thing. The two `Map` shapes differ in which duplicate wins, and that is usually the actual question.

```typescript
const uniqueNumbers = [...new Set([1, 2, 2, 3, 3])]; // [1, 2, 3]

// Keeps the LAST occurrence — later entries overwrite earlier ones
const uniqueById = <T extends { id: string }>(items: readonly T[]): T[] => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];

// Keeps the FIRST occurrence
function uniqueByIdFirst<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
```

`Set` dedupes by `SameValueZero`, so it treats `NaN` as equal to itself but every object as distinct
from every other — two structurally identical objects both survive.

---

## Set Algebra

```typescript
const setA = new Set([1, 2, 3, 4, 5]);
const setB = new Set([4, 5, 6, 7, 8]);

setA.union(setB); // Set { 1, 2, 3, 4, 5, 6, 7, 8 }
setA.intersection(setB); // Set { 4, 5 }
setA.difference(setB); // Set { 1, 2, 3 }
setA.symmetricDifference(setB); // Set { 1, 2, 3, 6, 7, 8 }

new Set([1, 2]).isSubsetOf(setA); // true
setA.isSupersetOf(new Set([1, 2])); // true
setA.isDisjointFrom(new Set([10, 11])); // true

const asArray = [...setA.union(setB)];

// Fold across many sets — each step is O(size of the smaller set)
function commonTags(articles: readonly { tags: string[] }[]): string[] {
  if (articles.length === 0) return [];
  return [
    ...articles
      .slice(1)
      .reduce(
        (common, article) => common.intersection(new Set(article.tags)),
        new Set(articles[0].tags),
      ),
  ];
}
```

Where the ES2025 methods are not available, the same operations are a `Set` and a `filter`, with
the same complexity:

```typescript
const union = <T>(a: Set<T>, b: Set<T>) => new Set([...a, ...b]);
const intersection = <T>(a: Set<T>, b: Set<T>) =>
  new Set([...a].filter((x) => b.has(x)));
const difference = <T>(a: Set<T>, b: Set<T>) =>
  new Set([...a].filter((x) => !b.has(x)));
```

---

## Array Difference and Intersection

The array-shaped version of the same question. The `Set` is what makes it linear.

```typescript
const arrayDifference = <T>(a: readonly T[], b: readonly T[]): T[] => {
  const inB = new Set(b);
  return a.filter((x) => !inB.has(x));
};

// By key, for objects
const missingFrom = <T extends { id: string }>(
  a: readonly T[],
  b: readonly T[],
): T[] => {
  const idsInB = new Set(b.map((item) => item.id));
  return a.filter((item) => !idsInB.has(item.id));
};
```

```typescript
// ❌ O(n²) — `includes` and `some` each scan the whole second array per element
a.filter((x) => !b.includes(x));
a.filter((x) => !b.some((y) => y.id === x.id));
```

---

## Grouping

```typescript
interface Customer {
  id: string;
  name: string;
}

interface Order {
  id: string;
  status: "pending" | "shipped" | "delivered";
  total: number;
  customer: Customer;
}

// The same customer object is shared, which is what Map.groupBy keys on below
const acme: Customer = { id: "c1", name: "Acme" };
const globex: Customer = { id: "c2", name: "Globex" };

const orders: Order[] = [
  { id: "1", status: "pending", total: 100, customer: acme },
  { id: "2", status: "shipped", total: 200, customer: globex },
  { id: "3", status: "pending", total: 150, customer: acme },
  { id: "4", status: "delivered", total: 300, customer: globex },
];

const byStatus = Object.groupBy(orders, (order) => order.status);
// { pending: [...], shipped: [...], delivered: [...] }

// Values are `Order[] | undefined`, because the key set is not known statically
const pendingTotal = (byStatus.pending ?? []).reduce((n, o) => n + o.total, 0);

// Derived keys work the same way
const byValue = Object.groupBy(orders, (order) =>
  order.total >= 200 ? "highValue" : "standard",
);

// Map.groupBy when the key is an object, a number you want kept as one,
// or anything else that string coercion would flatten
const byCustomer = Map.groupBy(orders, (order) => order.customer);

const counts = Object.fromEntries(
  Object.entries(byStatus).map(([status, items]) => [
    status,
    items?.length ?? 0,
  ]),
);
```

The return is a null-prototype object, so it is safe to key with untrusted strings — no
`__proto__` collision, and no inherited `toString` masquerading as a group.

---

## Chunking

```typescript
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError("chunk size must be positive");

  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

chunk([1, 2, 3, 4, 5, 6, 7], 3); // [[1,2,3], [4,5,6], [7]]

// Sequential batching — the usual reason to chunk
async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  run: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const results: R[] = [];
  for (const batch of chunk(items, size)) {
    results.push(...(await run(batch)));
  }
  return results;
}
```

The `await` inside the loop is deliberate: `Promise.all` over every chunk would issue the whole
workload at once, which is the thing chunking was meant to avoid.

---

## Flattening

```typescript
[
  [1, 2],
  [3, 4],
].flat(); // [1, 2, 3, 4]
[1, [2, [3, [4]]]].flat(Infinity); // [1, 2, 3, 4]

// flatMap maps and flattens one level
const categories = [
  { name: "Fruits", items: ["Apple", "Banana"] },
  { name: "Vegetables", items: ["Carrot", "Broccoli"] },
];

categories.flatMap((category) => category.items);
// ["Apple", "Banana", "Carrot", "Broccoli"]

// Returning [] drops an element — filter and map in a single pass
const numbers = [1, 2, 3, 4, 5, 6];
const doubled = numbers.flatMap((n) => (n > 3 ? [n * 2] : [])); // [8, 10, 12]
```

---

## Immutable Sorting

```typescript
interface Employee {
  name: string;
  department: string;
  salary: number;
  hireDate: Date;
}

declare const employees: Employee[];

employees.toSorted((a, b) => a.salary - b.salary); // numbers: subtract
employees.toSorted((a, b) => a.name.localeCompare(b.name)); // strings: localeCompare
employees.toSorted((a, b) => +a.hireDate - +b.hireDate); // dates: coerce to ms

// Multi-key: fall through to the next comparison only on a tie
employees.toSorted(
  (a, b) => a.department.localeCompare(b.department) || b.salary - a.salary,
);
```

`localeCompare` is what makes `"ä"` sort next to `"a"` rather than after `"z"`; `<`/`>` compare
UTF-16 code units. For a large list, build the comparator once with `Intl.Collator` and pass
`collator.compare` — `localeCompare` constructs one per call.

With no comparator, `toSorted` compares string forms, so `[10, 9, 1].toSorted()` is `[1, 10, 9]`.

---

## Compacting

```typescript
[0, 1, false, 2, "", 3, null, undefined, NaN].filter(Boolean); // [1, 2, 3]
```

That drops `0`, `""` and `false` too, which is rarely what "remove the empties" meant. For nullish
only — and for a result TypeScript actually narrows:

```typescript
const compact = <T>(items: readonly (T | null | undefined)[]): T[] =>
  items.filter((item): item is T => item != null);

compact(["a", null, "b", undefined]); // string[], not (string | null | undefined)[]
```

The explicit `item is T` is the load-bearing part. TypeScript can infer a predicate from a simple
callback, but only when the callback's shape allows it — writing it out makes the narrowing
unconditional and survives the callback growing a second statement.
