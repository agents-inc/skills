# MongoDB Index Examples

> Index types, compound key ordering, and verifying with `explain` using the native driver. See [SKILL.md](../SKILL.md) for the decisions behind these.

**Core:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Advanced:** See [patterns.md](patterns.md).

---

## Pattern 1: Creating Indexes

### Good Example -- Declared Once, Applied Deliberately

```typescript
import type { Collection, IndexDescription } from "mongodb";

const ORDER_INDEXES: IndexDescription[] = [
  { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
  { key: { customerId: 1 }, name: "customer" },
  { key: { reference: 1 }, name: "reference_unique", unique: true },
];

// Called from a migration or a controlled startup step — never a request path.
async function ensureOrderIndexes(orders: Collection<OrderDoc>): Promise<void> {
  await orders.createIndexes(ORDER_INDEXES);
}

export { ensureOrderIndexes, ORDER_INDEXES };
```

**Why good:** the full index set is one reviewable list rather than scattered calls, explicit names make `explain` output and drop operations legible, and `createIndexes` is idempotent so re-running it is safe

### Bad Example -- Creating Indexes in a Request Path

```typescript
// BAD
export async function listOrders(filter: Filter<OrderDoc>) {
  await orders.createIndex({ tenantId: 1 }); // every request
  return orders.find(filter).toArray();
}
```

**Why bad:** the call runs on every request, and the first build on a large collection contends with live traffic; a schema change that alters the index then conflicts with the existing one and starts throwing on a path that used to work

---

## Pattern 2: Compound Indexes and the ESR Rule

Order compound keys by how the query uses them: **E**quality first, then **S**ort, then **R**ange.

### Good Example -- ESR Applied

```typescript
// Query:
//   find({ tenantId, status: { $in: [...] } }).sort({ createdAt: -1 })
//        equality              range                 sort
await orders.createIndex(
  { tenantId: 1, createdAt: -1, status: 1 }, // E, S, R
  { name: "tenant_created_status" },
);
```

**Why good:** the equality field seeks to one section of the index, the sort field is then already in order so no in-memory sort is needed, and the range field filters what remains

### Bad Example -- Range Before Sort

```typescript
// BAD: R before S
await orders.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
```

**Why bad:** a range on `status` leaves the index scattered across many ranges, so `createdAt` is no longer traversed in order and the server sorts in memory — the index exists, is used, and still does not remove the sort, which is why this looks fine in `explain` until you read the sort stage

### Good Example -- Sort Direction on Compound Keys

```typescript
// Serves sort({ tenantId: 1, createdAt: -1 }) and its exact inverse
// sort({ tenantId: -1, createdAt: 1 }) — a mixed sort is not covered.
await orders.createIndex({ tenantId: 1, createdAt: -1 });
```

**Why good:** an index can be walked forwards or backwards, so one index serves both a sort and its complete reversal, and knowing that avoids creating a second index that adds write cost for nothing

---

## Pattern 3: Unique and Partial Indexes

### Good Example -- Conditional Uniqueness

```typescript
// Enforce unique email among active users only, so soft-deleted rows
// do not block a re-registration.
await users.createIndex(
  { email: 1 },
  {
    name: "email_unique_active",
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
```

**Why good:** the constraint matches the rule the application actually has, and the partial index is smaller and cheaper to maintain than one covering every document

### Good Example -- Indexing a Sparse Field

```typescript
// Only some orders have an external reference; index only those.
await orders.createIndex(
  { externalRef: 1 },
  {
    name: "external_ref",
    partialFilterExpression: { externalRef: { $exists: true } },
  },
);
```

**Why good:** documents without the field are absent from the index entirely, keeping it small

**A partial index is only used when the query provably matches its filter.** A query without `externalRef: { $exists: true }` (or a condition implying it) falls back to a collection scan, silently.

---

## Pattern 4: TTL Indexes

### Good Example -- Expiring Sessions

```typescript
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// The indexed field MUST hold a BSON Date. A number or an ISO string
// is ignored and nothing is ever deleted.
await sessions.createIndex(
  { expiresAt: 1 },
  { name: "session_ttl", expireAfterSeconds: SESSION_TTL_SECONDS },
);
```

**Why good:** expiry is enforced by the server rather than a cleanup job that can stop running, and the constant states the retention window in one place

### Good Example -- Per-Document Expiry

```typescript
// expireAfterSeconds: 0 deletes each document at the time its own field holds,
// which lets different documents expire on different schedules.
await tokens.createIndex(
  { expiresAt: 1 },
  { name: "token_ttl", expireAfterSeconds: 0 },
);

await tokens.insertOne({ value, expiresAt: new Date(Date.now() + ttlMs) });
```

**Why good:** one index serves many retention policies, so a short-lived token and a long-lived one coexist without a second index

**Deletion is not immediate.** The background task runs roughly every minute, so expired documents stay readable for a short window. Filter on `expiresAt` in queries where that matters rather than trusting the sweep.

---

## Pattern 5: Text Indexes

### Good Example -- Full-Text Search

```typescript
const TITLE_WEIGHT = 10;
const BODY_WEIGHT = 1;
const SEARCH_RESULT_LIMIT = 20;

await articles.createIndex(
  { title: "text", body: "text" },
  { name: "article_text", weights: { title: TITLE_WEIGHT, body: BODY_WEIGHT } },
);

type ScoredArticle = WithId<ArticleDoc> & { score: number };

const results = await articles
  .find({ $text: { $search: query } })
  .project<ScoredArticle>({ score: { $meta: "textScore" }, title: 1, body: 1 })
  .sort({ score: { $meta: "textScore" } })
  .limit(SEARCH_RESULT_LIMIT)
  .toArray();
```

**Why good:** weighting ranks a title match above a body match, and the score is both projected and sorted on, which are two separate steps — sorting without projecting it produces an error

**One text index per collection.** Adding a second requires dropping the first, so the field list has to be decided as a whole rather than extended later.

---

## Pattern 6: Geospatial Indexes

### Good Example -- Nearby Search

```typescript
const SEARCH_RADIUS_METRES = 5_000;
const NEARBY_LIMIT = 20;

// Coordinates are [longitude, latitude] — that order, always.
await venues.createIndex({ location: "2dsphere" }, { name: "venue_location" });

const nearby = await venues
  .find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [longitude, latitude] },
        $maxDistance: SEARCH_RADIUS_METRES,
      },
    },
  })
  .limit(NEARBY_LIMIT)
  .toArray();
```

**Why good:** `$near` returns results already ordered nearest-first so no sort stage is needed, and `$maxDistance` in metres bounds the scan

**The coordinate order is the usual defect here:** GeoJSON is `[longitude, latitude]` while most APIs and every map UI say "lat, lng". Reversed coordinates produce plausible-looking results in the wrong hemisphere rather than an error.

---

## Pattern 7: Verifying with explain

### Good Example -- Confirming the Index Is Used

```typescript
const plan = await orders
  .find({ tenantId, status: "complete" })
  .sort({ createdAt: -1 })
  .explain("executionStats");
```

Read three things from the output:

| Field                                             | Want           | A problem when                                                |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------- |
| `winningPlan.stage`                               | `IXSCAN`       | `COLLSCAN` — no index is being used at all                    |
| `executionStats.totalDocsExamined` vs `nReturned` | Close together | Examined ≫ returned — the index narrows poorly                |
| A `SORT` stage in the plan                        | Absent         | Present — the sort is happening in memory, not from the index |

### Good Example -- Finding Unused Indexes

```typescript
// Every index costs write throughput and storage. One never read is pure cost.
const usage = await orders.aggregate([{ $indexStats: {} }]).toArray();
```

**Why good:** `accesses.ops` per index turns index cleanup into evidence rather than guesswork — but read it only from a server that has been up long enough to be representative, since the counters reset on restart

### Bad Example -- Assuming the Index Works

```typescript
// BAD
await orders.createIndex({ tenantId: 1, status: 1 });
// ...ship it, and find out at scale
```

**Why bad:** an unindexed or badly ordered query returns correct results at every size, so nothing fails in review or in tests — the defect only appears when the collection is large, which is exactly when it is hardest to fix

---

## Index Rules of Thumb

- Index every field you filter or sort on in a query that runs often; leave the rest unindexed.
- Prefer one well-ordered compound index over several single-field ones — the server generally uses one index per query.
- Do not index a low-cardinality field alone (a two-value status), but it can earn its place as a later key in a compound index.
- Every index slows writes and consumes storage. An index with no reads is pure cost.
- Build indexes before a collection grows, not after it has become a problem.
- `explain` before and after. An index you did not verify is a hypothesis.
