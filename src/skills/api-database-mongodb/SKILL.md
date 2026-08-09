---
name: api-database-mongodb
description: Native MongoDB driver (the mongodb npm package) - MongoClient lifecycle, typed collections, CRUD result shapes, cursors, aggregation pipelines, index design, transactions
---

# MongoDB Native Driver Patterns

> **Quick Guide:** Talk to MongoDB through the official `mongodb` driver with no schema layer in between. Create ONE `MongoClient` per process and reuse it -- it owns the connection pool. Type collections with a generic: `db.collection<UserDoc>("users")`. Write operations return acknowledgements, never documents. `find()` returns a lazy cursor; stream it with `for await` instead of `toArray()` for anything unbounded. Put `$match` first in every pipeline so it can use an index. Verify indexes with `explain("executionStats")` rather than assuming. Transactions need a replica set, a session on every operation, and a callback that can safely run twice.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST create exactly ONE `MongoClient` per process and reuse it -- the client owns a connection pool, so constructing one per request opens a new pool per request and exhausts the server's connection limit)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- an operation without it silently runs outside the transaction and is not rolled back)**

**(You MUST write `withTransaction` callbacks to be safely re-runnable -- the driver retries them on transient errors, so any side effect outside the transaction happens more than once)**

**(You MUST iterate or close every cursor you open -- an abandoned cursor holds server-side resources until it times out)**

**(You MUST NOT expect write operations to return documents -- `insertOne` returns `{ acknowledged, insertedId }` and `updateOne` returns counts; only the `findOneAnd*` family returns a document)**

**(You MUST verify a query uses the index you intended with `explain("executionStats")` -- an unindexed query succeeds silently and only fails once the collection is large)**

</critical_requirements>

---

**Auto-detection:** mongodb, MongoClient, ServerApiVersion, client.db, db.collection, insertOne, insertMany, updateOne, findOneAndUpdate, deleteOne, bulkWrite, FindCursor, AggregationCursor, toArray, ObjectId, WithId, OptionalUnlessRequiredId, Filter, UpdateFilter, createIndex, createIndexes, explain, startSession, withTransaction, readPreference, writeConcern, maxPoolSize, serverSelectionTimeoutMS, MongoServerError, code 11000

**When to use:**

- Talking to MongoDB directly with no schema or modelling layer in between
- Aggregation-heavy workloads (reporting, analytics, materialised views)
- Bulk and batch pipelines where per-document overhead is the bottleneck
- Index design, query-plan investigation, and performance work
- Multi-document transactions with explicit session control
- Serverless and edge runtimes where client and pool lifecycle must be controlled by hand

**Key patterns covered:**

- Client and pool lifecycle (one client per process, startup and shutdown, serverless reuse)
- Typed collections and the driver's document type helpers
- CRUD and the result shapes each operation actually returns
- Cursors: lazy evaluation, streaming, batching, and pagination that stays fast
- Aggregation pipeline construction, stage ordering, and memory limits
- Index types, compound key ordering, and verification with `explain`
- Transactions: sessions, retry semantics, and when not to use one
- Error handling on driver-specific error codes

**When NOT to use:**

- You want schemas, validation, middleware hooks or population handled for you -- use an ODM layer instead of building one on top of this
- Highly relational data with multi-table joins and foreign key constraints (use a relational database)
- Simple key-value caching (use a dedicated key-value store)
- Time-series data at very large scale (use a purpose-built time-series database)

**Detailed Resources:**

- For decision tables, connection-option reference, and operator lookup, see [reference.md](reference.md)

**Core Patterns:**

- [examples/core.md](examples/core.md) - Client lifecycle, typed collections, CRUD and result shapes, error handling

**Query Patterns:**

- [examples/queries.md](examples/queries.md) - Filters, projection, cursors, streaming, keyset pagination, counting

**Aggregation:**

- [examples/aggregation.md](examples/aggregation.md) - Pipeline construction, `$lookup`, `$facet`, `$merge`, typed output

**Indexing:**

- [examples/indexes.md](examples/indexes.md) - Single-field, compound (ESR), partial, TTL, text, geospatial, and `explain`

**Advanced Patterns:**

- [examples/patterns.md](examples/patterns.md) - Transactions, bulk writes, change streams, schema evolution, serverless

---

<philosophy>

## Philosophy

The native driver is a thin, faithful mapping of the MongoDB wire protocol into TypeScript. It gives you the database's own vocabulary -- commands, cursors, pipelines, sessions -- with nothing interpreting them on your behalf. **Its value is that nothing is hidden, and its cost is that nothing is provided.** There is no schema, no validation, no lifecycle hook, no lazy reference resolution. Whatever structure your documents have is the structure your code maintains.

That trade is worth making when the database's own model is the thing you are working with: aggregation pipelines, index behaviour, bulk throughput, transaction boundaries. It is a poor trade when what you actually wanted was application-layer modelling, because building a half-schema by hand is strictly worse than adopting one.

**Core principles:**

1. **One client, one pool, one process.** `MongoClient` is a long-lived object that manages a pool of sockets. Creating one per request is the single most expensive mistake available here, and it looks like correct resource hygiene while doing the opposite.
2. **The driver returns what the server returned.** Write commands return acknowledgements and counts, not documents. Code that assumes otherwise reads `undefined` rather than failing, so the mistake surfaces far from its cause.
3. **Cursors are lazy and finite.** `find()` sends nothing until iterated, and the resulting cursor holds server-side state until it is exhausted or closed. Stream what is unbounded; buffer only what you have bounded.
4. **Push work into the database.** An aggregation pipeline runs beside the data. The equivalent JavaScript runs after every candidate document has crossed the network.
5. **An index is a claim to be verified.** `createIndex` succeeding proves the index exists, not that your query uses it. `explain` is the only thing that proves the second.
6. **Types are yours to assert.** A collection generic is a compile-time promise about documents the driver never validates. Treat data crossing a trust boundary as unvalidated until you have validated it.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client and Pool Lifecycle

Construct one `MongoClient` at startup, reuse it everywhere, close it on shutdown. The client is thread-safe and pools internally, so sharing one is both correct and faster.

```typescript
import { MongoClient, ServerApiVersion } from "mongodb";

const POOL_SIZE_MAX = 20;
const POOL_SIZE_MIN = 2;
const SERVER_SELECTION_TIMEOUT_MS = 5_000;

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  maxPoolSize: POOL_SIZE_MAX,
  minPoolSize: POOL_SIZE_MIN,
  serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

await client.connect(); // optional, but fails fast on bad credentials or DNS
```

```typescript
// BAD: a client per request
export async function getUser(id: string) {
  const client = new MongoClient(uri); // a new pool, every request
  await client.connect();
  // ...
}
```

**Why bad:** each client opens its own pool, so concurrent requests multiply into hundreds of sockets and the server refuses new connections; the handshake cost is also paid per request instead of once

See [examples/core.md](examples/core.md#pattern-1-client-and-pool-lifecycle) for startup, graceful shutdown, and serverless client reuse.

---

### Pattern 2: Typed Collections

The collection generic describes the document as _stored_. The driver's helpers then derive the right shape per operation -- `WithId<T>` for reads, `OptionalUnlessRequiredId<T>` for inserts, so a caller may omit `_id` and let the server generate it.

```typescript
import type { ObjectId, WithId } from "mongodb";

type UserDoc = {
  _id: ObjectId;
  email: string;
  createdAt: Date;
};

const users = client.db(DB_NAME).collection<UserDoc>("users");

const user: WithId<UserDoc> | null = await users.findOne({ email });
```

**Why good:** filters, updates and projections are all checked against `UserDoc`, so a typo in a field name is a compile error rather than a query that silently matches nothing

**The generic is an assertion, not a guarantee.** The driver does not validate documents against it. A collection written by an older version of the code, or by another service, can contain anything.

See [examples/core.md](examples/core.md#pattern-2-typed-collections) for projection typing, nested field paths, and validating untrusted documents.

---

### Pattern 3: CRUD and What It Returns

Every write returns an acknowledgement describing what happened. None of them return the document -- except the `findOneAnd*` family, which exists for exactly that.

```typescript
const { insertedId } = await users.insertOne({ email, createdAt: new Date() });

const { matchedCount, modifiedCount } = await users.updateOne(
  { _id: id },
  { $set: { email } },
);

// The one family that returns a document. In driver 6 it returns the document
// itself; pass includeResultMetadata: true for the older wrapped shape.
const updated = await users.findOneAndUpdate(
  { _id: id },
  { $set: { email } },
  { returnDocument: "after" },
);
```

**`matchedCount` and `modifiedCount` differ, and the gap is meaningful:** matched-but-not-modified means the document was found and already held those values. Treating `modifiedCount === 0` as "not found" reports a spurious 404 for a no-op update.

```typescript
// BAD: expecting the document back
const user = await users.insertOne(doc);
console.log(user.email); // undefined -- this is an acknowledgement, not a document
```

**Why bad:** the result is `{ acknowledged, insertedId }`, so every field read off it is `undefined` and the failure surfaces wherever that value is finally used, not here

See [examples/core.md](examples/core.md#pattern-3-crud-and-result-shapes) for upserts, `bulkWrite`, and duplicate-key handling.

---

### Pattern 4: Cursors and Streaming Reads

`find()` builds a cursor and sends nothing. The query runs when you iterate. `toArray()` buffers every matching document into memory, which is fine for a bounded page and a liability for anything else.

```typescript
const DEFAULT_PAGE_SIZE = 50;

// Bounded: buffering is fine
const page = await users
  .find({ isActive: true })
  .project<{ email: string }>({ email: 1, _id: 0 })
  .limit(DEFAULT_PAGE_SIZE)
  .toArray();

// Unbounded: stream, so memory stays flat regardless of collection size
for await (const user of users.find({ isActive: true })) {
  await sendDigest(user);
}
```

```typescript
// BAD: buffering an unbounded result
const everyone = await users.find({}).toArray(); // the whole collection, in memory
```

**Why bad:** memory grows with the collection rather than the page, so this passes in development against a small dataset and takes the process out in production

Deep `skip()` degrades the same way for a different reason: the server walks and discards every skipped document. Paginate on an indexed sort key instead.

See [examples/queries.md](examples/queries.md) for keyset pagination, batch sizing, and explicit cursor cleanup.

---

### Pattern 5: Aggregation Pipelines

Stage order is the whole performance story. `$match` first can use an index; anywhere else it filters documents already loaded and streamed through earlier stages.

```typescript
type RevenueByCustomer = { _id: ObjectId; total: number };

const results = await orders
  .aggregate<RevenueByCustomer>([
    { $match: { status: "complete", createdAt: { $gte: since } } }, // first: uses an index
    { $project: { customerId: 1, total: 1 } }, // early: shrinks documents
    { $group: { _id: "$customerId", total: { $sum: "$total" } } },
    { $sort: { total: -1 } },
    { $limit: TOP_CUSTOMER_COUNT },
  ])
  .toArray();
```

**Why good:** `$match` narrows using an index before anything else runs, `$project` cuts document size before the group, and the explicit generic types the output shape, which no longer resembles the input

```typescript
// BAD: filtering after grouping
{ $group: { _id: "$customerId", total: { $sum: "$total" } } },
{ $match: { status: "complete" } },  // every document was grouped first
```

**Why bad:** the group has already processed the whole collection, so the index is unusable and the filter now runs against grouped output where `status` no longer exists -- it silently matches nothing

See [examples/aggregation.md](examples/aggregation.md) for `$lookup`, `$facet`, `$merge`, and the memory limits.

---

### Pattern 6: Indexes and Verification

Create indexes in a migration or a startup routine you control, never in a request path. Compound key order follows **ESR**: equality fields first, then sort fields, then range fields.

```typescript
// Query: find({ tenantId, status: { $gte: x } }).sort({ createdAt: -1 })
await orders.createIndex(
  { tenantId: 1, createdAt: -1, status: 1 }, // E, S, R
  { name: "tenant_created_status" },
);
```

Then prove it. `createIndex` succeeding says nothing about whether your query uses it:

```typescript
const plan = await orders
  .find(filter)
  .sort({ createdAt: -1 })
  .explain("executionStats");
// Want IXSCAN, not COLLSCAN, and totalDocsExamined close to nReturned.
```

**Why this matters:** an unindexed query returns correct results at every size, so the defect is invisible until the collection is large enough for it to hurt, at which point it is a production incident rather than a test failure.

See [examples/indexes.md](examples/indexes.md) for partial, TTL, text and geospatial indexes, and reading `explain` output.

---

### Pattern 7: Transactions

Reach for one only when two or more documents must change together. Single-document writes are already atomic, so a transaction wrapped around one buys nothing and costs coordination.

```typescript
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await accounts.updateOne(
      { _id: from },
      { $inc: { balance: -amount } },
      { session },
    );
    await accounts.updateOne(
      { _id: to },
      { $inc: { balance: amount } },
      { session },
    );
  });
} finally {
  await session.endSession();
}
```

**Why good:** `withTransaction` commits on success and aborts on throw, retries transient errors on your behalf, and the `finally` releases the session even when the transaction fails

Two rules that are easy to miss:

- **Every operation needs `{ session }`.** One that omits it runs outside the transaction, is not rolled back, and raises no error to say so.
- **The callback can run more than once.** Retries re-run it, so any side effect that is not itself transactional -- an email, a queue publish, a counter in another store -- happens again on every retry.

Transactions require a replica set or sharded cluster; a standalone server rejects them.

See [examples/patterns.md](examples/patterns.md#pattern-1-transactions) for read/write concerns, retry semantics, and the single-document alternative.

</patterns>

---

<decision_framework>

## Decision Framework

**How should this read run?**

```
How many documents can this return?
├─ One → findOne()
├─ A bounded page → find().limit(n).toArray()
└─ Unbounded or unknown → for await (const doc of find(...))
    └─ Stopping early? → cursor.close() when you break out
```

**Query or pipeline?**

```
Does the answer need reshaping, grouping, or data from another collection?
├─ NO  → find() with a filter and a projection
└─ YES → aggregate()
    ├─ Grouping/totals        → $match first, then $group
    ├─ Joining a collection   → $lookup, with the foreign field indexed
    ├─ Several answers at once→ $facet (one pass, not N queries)
    └─ Result reused often    → $merge into a materialised collection
```

**Transaction or not?**

```
How many documents change?
├─ One  → No transaction. Single-document writes are already atomic.
│         Use $inc / $set / arrayFilters to do it in one update.
└─ Many → Do they have to change together?
    ├─ NO  → Separate writes. A transaction adds cost for nothing.
    └─ YES → withTransaction, { session } on every operation,
             callback safe to run twice, replica set required.
```

**Which compound index?**

```
Order the keys by how the query uses them (ESR):
1. Equality fields    — matched exactly            ({ tenantId: x })
2. Sort fields        — the sort key, in sort order
3. Range fields       — $gt / $lt / $in

Then run explain("executionStats") and confirm IXSCAN.
Getting the order wrong still produces an index, and it still gets ignored.
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Constructing a `MongoClient` per request or per operation** -- every client opens its own pool, so concurrency multiplies into hundreds of sockets and the server starts refusing connections. One client per process, shared.
- **Missing `{ session }` on an operation inside a transaction** -- that operation runs outside the transaction, commits independently, and is not rolled back when the transaction aborts. Nothing errors.
- **Side effects inside a `withTransaction` callback** -- the driver retries the callback on transient errors, so emails send twice and queue messages publish twice. Only database work belongs inside it.
- **`toArray()` on an unbounded query** -- memory scales with the collection, so it passes against development data and exhausts the process in production.
- **Assuming a write returned a document** -- `insertOne` and `updateOne` return acknowledgements, so every field read off them is `undefined` and the failure appears somewhere else entirely.
- **Trusting a query is indexed without `explain`** -- an unindexed query is correct at every size, so it is invisible until the collection is large enough to cause an outage.
- **Interpolating user input into a filter object** -- an attacker-supplied object containing `$ne` or `$gt` becomes an operator rather than a value. Coerce inputs to their expected primitive type before they reach a filter.

**Medium Priority Issues:**

- Treating `modifiedCount === 0` as "not found" -- a no-op update matches without modifying, which is a successful update, not a missing document.
- Deep `skip()` pagination -- the server walks and discards every skipped document, so page 500 costs 500 pages of work. Use a keyset on an indexed sort field.
- Creating indexes in a request path rather than a migration -- builds contend with live traffic and repeat on every process start.
- `$lookup` against an unindexed foreign field -- the lookup runs per input document, so this is a collection scan multiplied by the number of inputs.
- Indexing a low-cardinality field on its own -- an index on a two-value field examines roughly half the collection and rarely beats a scan.
- Omitting `writeConcern` on writes that must survive a failover -- the default acknowledges from the primary only.
- Leaving a cursor unconsumed after breaking out of a loop -- server-side resources are held until it times out.

**Common Mistakes:**

- Forgetting `returnDocument: "after"` on `findOneAndUpdate` -- the default returns the pre-update document.
- Passing a 24-character hex string where an `ObjectId` is required -- the filter matches nothing rather than erroring, because it is a valid string comparison against a non-string field.
- Using `ObjectId.isValid()` as input validation -- it returns `true` for any 12-character string, so `"123456789012"` passes. Test against a 24-hex-character pattern.
- Reusing one session across concurrent operations -- a session is single-threaded; parallel work needs separate sessions.
- Not handling `code === 11000` from a unique index -- duplicate key is an expected outcome of a race, not an exceptional one.
- Comparing `Date` values against ISO strings -- BSON dates and strings never compare equal.

**Gotchas & Edge Cases:**

- **The driver auto-connects on first operation**, so a missing `connect()` surfaces bad credentials on the first query instead of at startup. Call it explicitly to fail fast.
- **Driver 5 removed callback support entirely** -- every operation returns a promise, and callback-style code from older examples throws.
- **Driver 6 changed the `findOneAnd*` return shape** -- it returns the document directly; `includeResultMetadata: true` restores the older `{ value, ok, lastErrorObject }` wrapper.
- **`find()` sends nothing until iterated**, so a query with a syntax error throws where it is awaited, not where it is built.
- **A cursor's first batch is small** (101 documents) and later batches fill up to 16 MB, so the first `next()` is fast and a later one can pause noticeably.
- **Documents are capped at 16 MB** -- an unbounded embedded array eventually makes a document unwritable, and the failure arrives long after the design decision that caused it.
- **Aggregation stages have a 100 MB memory limit** -- a large `$group` or `$sort` fails unless `allowDiskUse: true` is set.
- **`$sort` only uses an index at the start of a pipeline.** After a `$group` or `$project` it sorts in memory against that limit.
- **TTL deletion is not immediate** -- the background task runs about once a minute, so expired documents remain readable briefly. The field must hold a BSON `Date`; a number or string is ignored silently.
- **A text index is limited to one per collection**, so adding a second requires dropping the first.
- **`createIndex` is idempotent for an identical key and options**, but the same key with different options raises `IndexOptionsConflict`.
- **Transactions need a replica set** -- a standalone server rejects them, which is why a transaction can pass in staging and fail on a developer's single-node machine.
- **Transactions have a server-side lifetime limit** (60 seconds by default) and abort when it is exceeded, so long-running work does not belong inside one.
- **`writeConcern` is per-operation and per-transaction**, and the transaction's own concern governs the commit regardless of what the individual operations asked for.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST create exactly ONE `MongoClient` per process and reuse it -- the client owns a connection pool, so constructing one per request opens a new pool per request and exhausts the server's connection limit)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- an operation without it silently runs outside the transaction and is not rolled back)**

**(You MUST write `withTransaction` callbacks to be safely re-runnable -- the driver retries them on transient errors, so any side effect outside the transaction happens more than once)**

**(You MUST iterate or close every cursor you open -- an abandoned cursor holds server-side resources until it times out)**

**(You MUST NOT expect write operations to return documents -- `insertOne` returns `{ acknowledged, insertedId }` and `updateOne` returns counts; only the `findOneAnd*` family returns a document)**

**(You MUST verify a query uses the index you intended with `explain("executionStats")` -- an unindexed query succeeds silently and only fails once the collection is large)**

**Failure to follow these rules will exhaust the connection pool under load, lose writes that appeared to be transactional, and ship queries whose cost is invisible until the collection is too large to fix quietly.**

</critical_reminders>
