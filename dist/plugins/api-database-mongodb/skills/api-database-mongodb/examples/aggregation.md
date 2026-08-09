# MongoDB Aggregation Examples

> Pipeline construction, stage ordering, joins, faceting and materialised views with the native driver. See [SKILL.md](../SKILL.md) for the decisions behind these.

**Core:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Indexes:** See [indexes.md](indexes.md). **Advanced:** See [patterns.md](patterns.md).

---

## Pattern 1: Pipeline Construction and Stage Order

### Good Example -- Revenue Report

```typescript
import type { Document, ObjectId } from "mongodb";

const TOP_CUSTOMER_COUNT = 10;

type RevenueByCustomer = {
  _id: ObjectId;
  total: number;
  orderCount: number;
};

async function topCustomers(
  orders: Collection<OrderDoc>,
  tenantId: ObjectId,
  since: Date,
): Promise<RevenueByCustomer[]> {
  return orders
    .aggregate<RevenueByCustomer>([
      // 1. Narrow first. This is the only stage that can use an index.
      { $match: { tenantId, status: "complete", createdAt: { $gte: since } } },
      // 2. Shrink documents before they flow through the expensive stages.
      { $project: { customerId: 1, total: 1 } },
      // 3. Aggregate.
      {
        $group: {
          _id: "$customerId",
          total: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: TOP_CUSTOMER_COUNT },
    ])
    .toArray();
}

export { topCustomers };
```

**Why good:** `$match` first lets a compound index on `{ tenantId, createdAt }` do the narrowing, `$project` cuts each document to two fields before grouping, and the explicit generic types an output shape that no longer resembles `OrderDoc`

### Bad Example -- Matching After Grouping

```typescript
// BAD
[
  { $group: { _id: "$customerId", total: { $sum: "$total" } } },
  { $match: { status: "complete" } },
];
```

**Why bad:** the group has already read the entire collection, so no index is usable and the work is done before anything is filtered; worse, `status` does not exist in the grouped output, so the match silently returns nothing and the report shows zero rows rather than an error

### Good Example -- Allowing Disk Use on a Large Group

```typescript
const results = await orders
  .aggregate<RevenueByCustomer>(pipeline, { allowDiskUse: true })
  .toArray();
```

**Why good:** each stage is capped at 100 MB of memory, so a group or sort over a large dataset fails without this; spilling to disk is slower but completes

---

## Pattern 2: $lookup (Joins)

### Good Example -- Lookup with a Sub-Pipeline

```typescript
const RECENT_ORDER_LIMIT = 5;

type CustomerWithOrders = {
  _id: ObjectId;
  email: string;
  recentOrders: Array<{ _id: ObjectId; total: number; createdAt: Date }>;
};

const results = await customers
  .aggregate<CustomerWithOrders>([
    { $match: { tenantId } },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "customerId", // MUST be indexed
        as: "recentOrders",
        pipeline: [
          { $match: { status: "complete" } },
          { $sort: { createdAt: -1 } },
          { $limit: RECENT_ORDER_LIMIT },
          { $project: { total: 1, createdAt: 1 } },
        ],
      },
    },
  ])
  .toArray();
```

**Why good:** the sub-pipeline filters, sorts, limits and projects inside the lookup, so each customer carries five small documents instead of every order they have ever placed

### Bad Example -- Unbounded Lookup on an Unindexed Field

```typescript
// BAD
{
  $lookup: {
    from: "orders",
    localField: "_id",
    foreignField: "customerId", // no index
    as: "orders",               // every order, every field
  },
}
```

**Why bad:** without an index on `customerId` the lookup scans the orders collection once per input customer, so 1,000 customers means 1,000 scans; embedding every order in full can also push a result document past the 16 MB limit, at which point the pipeline fails outright

**Before using `$lookup` at all:** if these two collections are always read together, the data may belong in one document. A join you perform on every read is a modelling decision to revisit, not just a query to tune.

---

## Pattern 3: $facet for Several Answers in One Pass

### Good Example -- Results and Metadata Together

```typescript
const FACET_PAGE_SIZE = 20;

type SearchResult = {
  items: Array<WithId<ProductDoc>>;
  totalCount: Array<{ count: number }>;
  byCategory: Array<{ _id: string; count: number }>;
};

const [result] = await products
  .aggregate<SearchResult>([
    { $match: filter }, // runs once, shared by every facet below
    {
      $facet: {
        items: [{ $sort: { score: -1 } }, { $limit: FACET_PAGE_SIZE }],
        totalCount: [{ $count: "count" }],
        byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
      },
    },
  ])
  .toArray();

const total = result.totalCount.at(0)?.count ?? 0;
```

**Why good:** one round trip and one shared `$match` instead of three queries repeating the same filter, so the counts cannot disagree with the page the way three separate queries can when data changes between them

**Note the shapes:** `$count` yields an array that is empty when nothing matched, which is why the total is read with `.at(0)?.count ?? 0` rather than indexed directly.

---

## Pattern 4: Date Grouping

### Good Example -- Daily Totals

```typescript
type DailyTotal = { _id: string; total: number };

const daily = await orders
  .aggregate<DailyTotal>([
    { $match: { tenantId, createdAt: { $gte: since } } },
    {
      $group: {
        // $dateToString groups in a named timezone, so "day" means the
        // user's day rather than the server's.
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: reportTimezone,
          },
        },
        total: { $sum: "$total" },
      },
    },
    { $sort: { _id: 1 } },
  ])
  .toArray();
```

**Why good:** the timezone is explicit, so a report does not silently shift by a day for users outside UTC, and sorting the formatted `YYYY-MM-DD` key sorts chronologically

---

## Pattern 5: $merge for Materialised Views

### Good Example -- Pre-Computing an Expensive Report

```typescript
// Runs on a schedule; readers query daily_revenue directly and pay nothing.
await orders
  .aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          tenantId: "$tenantId",
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        total: { $sum: "$total" },
      },
    },
    {
      $merge: {
        into: "daily_revenue",
        on: "_id",
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ])
  .toArray(); // the pipeline only runs when the cursor is consumed
```

**Why good:** `$merge` updates the target incrementally rather than replacing it, so readers never see an empty collection mid-refresh, and the expensive aggregation is paid once per schedule instead of once per reader

**The `toArray()` is load-bearing:** `aggregate()` returns a lazy cursor, so a pipeline ending in `$merge` writes nothing at all until the cursor is consumed.

---

## Pattern 6: Typing Aggregation Output

### Good Example -- Declaring the Output Shape

```typescript
type StatusBreakdown = { _id: OrderStatus; count: number };

const breakdown = await orders
  .aggregate<StatusBreakdown>([
    { $match: { tenantId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ])
  .toArray();
```

**Why good:** without the generic the cursor is typed as `Document`, so every field access is untyped and a renamed group key stays silent until it reaches a consumer

### Bad Example -- Reusing the Collection Type

```typescript
// BAD: the pipeline output is nothing like OrderDoc
const breakdown = await orders.aggregate<OrderDoc>(groupPipeline).toArray();
breakdown[0].total; // typed as number, actually undefined
```

**Why bad:** the type claims fields the grouped output never had, so reads are `undefined` with no compile error -- the exact failure the generic exists to prevent

**Aggregation output is not validated either.** The generic describes what the pipeline is expected to produce; nothing checks that it did.

---

## Performance Notes

| Concern                    | What to do                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| Index usage                | Only a leading `$match` (and a leading `$sort`) can use one. Put `$match` first.  |
| Document size mid-pipeline | `$project` or `$unset` early — every later stage carries whatever you left in.    |
| Memory                     | 100 MB per stage. Large `$group` or `$sort` needs `allowDiskUse: true`.           |
| Verifying a plan           | `aggregate(pipeline, { explain: true })` — same reasoning as `explain` on a find. |
| `$lookup` cost             | Index the `foreignField`, always. It runs per input document.                     |
| Repeated expensive reports | `$merge` into a collection on a schedule; read from that.                         |
| Result size                | Stream with `for await` rather than `toArray()` when the output is unbounded.     |
