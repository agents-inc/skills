# MongoDB Query Examples

> Filters, projection, cursors, streaming, pagination and counting with the native driver. See [SKILL.md](../SKILL.md) for the decisions behind these.

**Core:** See [core.md](core.md). **Aggregation:** See [aggregation.md](aggregation.md). **Indexes:** See [indexes.md](indexes.md). **Advanced:** See [patterns.md](patterns.md).

---

## Pattern 1: Filters

### Good Example -- Typed Filter Construction

```typescript
import type { Filter } from "mongodb";

const MAX_RESULTS = 100;

type OrderQuery = {
  tenantId: ObjectId;
  status?: OrderStatus;
  minTotal?: number;
  since?: Date;
};

function buildOrderFilter(query: OrderQuery): Filter<OrderDoc> {
  const filter: Filter<OrderDoc> = { tenantId: query.tenantId };

  if (query.status !== undefined) filter.status = query.status;
  if (query.minTotal !== undefined) filter.total = { $gte: query.minTotal };
  if (query.since !== undefined) filter.createdAt = { $gte: query.since };

  return filter;
}

export { buildOrderFilter };
```

**Why good:** `Filter<OrderDoc>` checks every field name and operator against the document type, and the explicit `!== undefined` tests keep a legitimate `0` or empty string from being dropped the way a truthiness check would drop them

### Bad Example -- User Input Straight into a Filter

```typescript
// BAD: the request body becomes the filter
const orders = await collection
  .find({ tenantId, status: req.body.status })
  .toArray();
```

**Why bad:** a JSON body can supply an object rather than a string, so `{"status": {"$ne": null}}` turns the filter into an operator and returns every order in the tenant; the query is valid and nothing errors

### Good Example -- Coercing Before Filtering

```typescript
const ORDER_STATUSES = ["pending", "complete", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function parseStatus(input: unknown): OrderStatus | undefined {
  if (typeof input !== "string") return undefined;
  return ORDER_STATUSES.find((status) => status === input);
}

export { ORDER_STATUSES, parseStatus };
```

**Why good:** the value reaching the filter is a primitive drawn from a known set, so an injected operator object cannot survive the parse

### Good Example -- ObjectId Validation

```typescript
import { ObjectId } from "mongodb";

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

function parseObjectId(input: string): ObjectId | undefined {
  // ObjectId.isValid() returns true for ANY 12-character string, so
  // "123456789012" passes it. Test the hex representation instead.
  if (!OBJECT_ID_PATTERN.test(input)) return undefined;
  return new ObjectId(input);
}

export { parseObjectId };
```

**Why good:** rejects the 12-character strings `ObjectId.isValid()` accepts, so a malformed path parameter becomes a 400 rather than a query that quietly matches nothing

---

## Pattern 2: Projection

### Good Example -- Fetching Only What Is Used

```typescript
type OrderListItem = { _id: ObjectId; total: number; createdAt: Date };

const items = await orders
  .find(filter)
  .project<OrderListItem>({ total: 1, createdAt: 1 })
  .limit(MAX_RESULTS)
  .toArray();
```

**Why good:** projection happens on the server, so large unused fields never cross the network, and the generic re-types the cursor to the shape actually returned

### Good Example -- Excluding Instead of Including

```typescript
// Inclusion and exclusion cannot be mixed in one projection, except for _id.
const user = await users.findOne(
  { _id: id },
  { projection: { passwordHash: 0 } },
);
```

**Why good:** an exclusion projection keeps returning new fields as the document evolves while guaranteeing the sensitive one is never among them, which an inclusion list would need updating to match

### Bad Example -- Filtering Fields in Application Code

```typescript
// BAD
const all = await orders.find(filter).toArray();
const items = all.map(({ _id, total, createdAt }) => ({
  _id,
  total,
  createdAt,
}));
```

**Why bad:** every field of every document is serialised, transferred and parsed before being discarded, so the cost is paid in full and only the memory afterwards is saved

---

## Pattern 3: Cursors and Streaming

### Good Example -- Streaming an Unbounded Read

```typescript
async function emailActiveUsers(users: Collection<UserDoc>): Promise<number> {
  let sent = 0;

  // for await pulls one batch at a time, so memory stays flat whether the
  // collection holds a thousand documents or ten million.
  for await (const user of users.find({ isActive: true })) {
    await sendDigest(user.email);
    sent += 1;
  }

  return sent;
}

export { emailActiveUsers };
```

**Why good:** the cursor is fully consumed so it closes on its own, and peak memory is one batch rather than the whole result set

### Good Example -- Closing a Cursor You Abandon

```typescript
const cursor = orders.find({ status: "pending" });

try {
  for await (const order of cursor) {
    if (await shouldStop(order)) break; // leaves the cursor open
  }
} finally {
  await cursor.close();
}
```

**Why good:** breaking out mid-iteration leaves an open server-side cursor holding resources until it times out; the `finally` releases it immediately and is harmless when the loop finished normally

### Good Example -- Batch Size for Slow Per-Document Work

```typescript
const SLOW_CONSUMER_BATCH_SIZE = 20;

const cursor = orders
  .find({ status: "pending" })
  .batchSize(SLOW_CONSUMER_BATCH_SIZE);
```

**Why good:** smaller batches shorten the pause when a batch is fetched and reduce the work discarded if the consumer stops early, which matters when each document triggers slow work

### Bad Example -- Buffering Everything

```typescript
// BAD
const everyone = await users.find({}).toArray();
for (const user of everyone) await sendDigest(user.email);
```

**Why bad:** the entire collection is materialised before the first email is sent, so memory scales with the data and the process dies once the collection outgrows the heap -- which it will not do in development

---

## Pattern 4: Pagination

### Good Example -- Keyset Pagination

```typescript
const PAGE_SIZE = 25;

type Page<T> = { items: T[]; nextCursor: string | undefined };

// Requires an index on the sort key. _id is monotonic enough for most feeds;
// use a compound key when sorting on something else.
async function pageOrders(
  orders: Collection<OrderDoc>,
  after: ObjectId | undefined,
): Promise<Page<WithId<OrderDoc>>> {
  const filter: Filter<OrderDoc> = after ? { _id: { $lt: after } } : {};

  const items = await orders
    .find(filter)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE)
    .toArray();

  const last = items.at(-1);
  return {
    items,
    nextCursor:
      items.length === PAGE_SIZE ? last?._id.toHexString() : undefined,
  };
}

export { pageOrders };
```

**Why good:** every page costs the same because the index seeks straight to the cursor position, and `nextCursor` is `undefined` on a short page so the caller knows the feed ended without an extra count query

### Bad Example -- Deep Offset Pagination

```typescript
// BAD
const items = await orders
  .find(filter)
  .sort({ createdAt: -1 })
  .skip(page * PAGE_SIZE) // page 500 walks 12,500 documents to discard them
  .limit(PAGE_SIZE)
  .toArray();
```

**Why bad:** the server walks and discards every skipped document, so cost grows with page depth and the last pages time out; results also shift when a document is inserted between requests, so items can be seen twice or missed entirely

---

## Pattern 5: Counting

### Good Example -- Choosing the Right Count

```typescript
// Accurate, but scans the index or collection to answer.
const pending = await orders.countDocuments({ status: "pending" });

// Reads collection metadata: constant time, but approximate, and it takes
// no filter. Fine for a dashboard total, wrong for anything that must reconcile.
const approximateTotal = await orders.estimatedDocumentCount();
```

**Why good:** the choice is made explicitly on whether the number must be exact, rather than reaching for whichever is faster and discovering the imprecision later

### Good Example -- Existence Without Counting

```typescript
// findOne with a projection stops at the first match; counting does not.
const exists =
  (await users.findOne({ email }, { projection: { _id: 1 } })) !== null;
```

**Why good:** counting scans every match to produce a number the caller then compares to zero, while this stops as soon as one document is found

---

## Pattern 6: Distinct and Sorting

### Good Example -- Distinct Values

```typescript
const statuses = await orders.distinct("status", { tenantId });
```

**Why good:** the deduplication happens on the server, so only the distinct values cross the network rather than every document

**Limitation:** the result must fit in a single 16 MB reply. For a high-cardinality field use a `$group` pipeline, which streams instead.

### Good Example -- Sorting on an Indexed Field

```typescript
const recent = await orders
  .find({ tenantId })
  .sort({ createdAt: -1 }) // needs an index whose keys match this sort
  .limit(PAGE_SIZE)
  .toArray();
```

**Why good:** a sort backed by an index reads in order and stops at the limit; an unindexed sort loads every match into memory first and fails outright once that exceeds the server's sort limit
