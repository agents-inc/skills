# MongoDB Native Driver Reference

> Quick lookup: decision tables, connection options, result shapes, operators, and error codes. See [SKILL.md](SKILL.md) for patterns and [examples/](examples/) for full implementations.

---

## Decision Tables

### Which read method

| You need                         | Use                                           |
| -------------------------------- | --------------------------------------------- |
| One document                     | `findOne(filter)`                             |
| A bounded page                   | `find(filter).limit(n).toArray()`             |
| An unbounded set                 | `for await (const doc of find(filter))`       |
| Reshaped, grouped or joined data | `aggregate(pipeline)`                         |
| An exact count                   | `countDocuments(filter)`                      |
| An approximate total, instantly  | `estimatedDocumentCount()` (takes no filter)  |
| Unique values of a field         | `distinct(field, filter)` (16 MB result cap)  |
| Existence only                   | `findOne(filter, { projection: { _id: 1 } })` |

### Which write method

| You need                          | Use                                                     |
| --------------------------------- | ------------------------------------------------------- |
| Insert one / many                 | `insertOne` / `insertMany(docs, { ordered: false })`    |
| Change fields, discard the result | `updateOne` / `updateMany`                              |
| Change fields, get the document   | `findOneAndUpdate(f, u, { returnDocument: "after" })`   |
| Insert-or-update                  | `updateOne(f, u, { upsert: true })` with `$setOnInsert` |
| Overwrite a whole document        | `replaceOne`                                            |
| Many mixed operations             | `bulkWrite(ops, { ordered: false })`                    |
| Delete                            | `deleteOne` / `deleteMany`                              |

### Result shapes

| Operation            | Returns                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `insertOne`          | `{ acknowledged, insertedId }`                                             |
| `insertMany`         | `{ acknowledged, insertedCount, insertedIds }`                             |
| `updateOne/Many`     | `{ acknowledged, matchedCount, modifiedCount, upsertedCount, upsertedId }` |
| `replaceOne`         | Same as `updateOne`                                                        |
| `deleteOne/Many`     | `{ acknowledged, deletedCount }`                                           |
| `bulkWrite`          | Counts per operation type, plus `insertedIds` / `upsertedIds`              |
| `findOneAnd*`        | **The document, or `null`** — the only family that returns one             |
| `find` / `aggregate` | A lazy cursor — nothing runs until it is iterated                          |

`matchedCount` answers "did it exist". `modifiedCount` answers "did it change". They differ on a no-op update, and only the first one answers a not-found check.

---

## Connection Options

| Option                       | What it controls                                 | Typical                                     |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `maxPoolSize`                | Max connections in the pool                      | 10–20 per process                           |
| `minPoolSize`                | Connections kept warm                            | 2 (0 in serverless)                         |
| `maxIdleTimeMS`              | Before an idle connection is closed              | 30–60 s                                     |
| `serverSelectionTimeoutMS`   | How long to look for a reachable server          | 5 s                                         |
| `connectTimeoutMS`           | TCP/TLS handshake timeout                        | 10 s                                        |
| `socketTimeoutMS`            | Inactivity on an established socket              | Usually leave unset                         |
| `timeoutMS`                  | One end-to-end budget covering a whole operation | Prefer over per-stage ones                  |
| `retryWrites` / `retryReads` | Retry once after a transient network error       | `true` (the default)                        |
| `writeConcern`               | How many nodes acknowledge a write               | `{ w: "majority" }`                         |
| `readPreference`             | Which node serves reads                          | `primary` unless stale reads are acceptable |
| `serverApi`                  | Pin the versioned API across server upgrades     | `{ version: v1, strict: true }`             |

### Connection string

```
mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
mongodb://127.0.0.1:27017/<db>          # local — prefer 127.0.0.1 over localhost
```

`mongodb+srv://` resolves hosts through DNS SRV records, so the host list is not hard-coded. Percent-encode any password containing reserved characters (`@`, `:`, `/`, `?`, `#`), or authentication fails with an error that names the wrong host.

**Prefer `127.0.0.1` to `localhost` locally:** Node resolves `localhost` to IPv6 first on modern versions, and a server bound only to IPv4 then appears unreachable until server selection times out.

---

## Query Operators

| Operator                   | Matches                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `$eq` `$ne`                | Equal / not equal                                            |
| `$gt` `$gte` `$lt` `$lte`  | Ranges                                                       |
| `$in` `$nin`               | Membership of an array of values                             |
| `$exists`                  | Field present or absent                                      |
| `$type`                    | BSON type                                                    |
| `$regex`                   | Pattern — anchored (`^`) can use an index; unanchored cannot |
| `$and` `$or` `$nor` `$not` | Logical composition                                          |
| `$all`                     | Array contains all listed values                             |
| `$elemMatch`               | One array element matches every condition                    |
| `$size`                    | Exact array length                                           |
| `$expr`                    | Compare two fields of the same document                      |
| `$text`                    | Text index search                                            |
| `$near` `$geoWithin`       | Geospatial                                                   |

`{ tags: { $gt: "a", $lt: "z" } }` matches a document where _some_ element beats each condition separately. Use `$elemMatch` when one element must satisfy all of them.

## Update Operators

| Operator                  | Effect                                               |
| ------------------------- | ---------------------------------------------------- |
| `$set` `$unset`           | Set or remove fields                                 |
| `$setOnInsert`            | Apply only when an upsert creates the document       |
| `$inc` `$mul`             | Arithmetic, atomically                               |
| `$min` `$max`             | Set only if lower / higher than the current value    |
| `$rename`                 | Rename a field                                       |
| `$currentDate`            | Server clock, avoiding host clock drift              |
| `$push` `$addToSet`       | Append / append-if-absent                            |
| `$pull` `$pullAll` `$pop` | Remove elements                                      |
| `$each` `$slice` `$sort`  | Modifiers for `$push` — bound an array as you append |
| `arrayFilters`            | Update matching array elements by condition          |

Bound an array as you write it rather than trimming it later:

```typescript
const MAX_HISTORY = 50;

await doc.updateOne(filter, {
  $push: { history: { $each: [entry], $slice: -MAX_HISTORY } },
});
```

## Aggregation Stages

| Stage                            | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `$match`                         | Filter — **first**, so it can use an index             |
| `$project` `$addFields` `$unset` | Reshape; use early to shrink documents                 |
| `$group`                         | Aggregate by key                                       |
| `$sort` `$limit` `$skip`         | Order and slice — only a leading `$sort` uses an index |
| `$lookup`                        | Join — index the `foreignField`                        |
| `$unwind`                        | One document per array element                         |
| `$facet`                         | Several sub-pipelines over one input                   |
| `$bucket` `$bucketAuto`          | Group into ranges                                      |
| `$merge` `$out`                  | Write results to a collection                          |
| `$count`                         | Count into a single-field document                     |
| `$setWindowFields`               | Running totals, rankings, moving averages              |

---

## Error Codes

| Condition                  | Detect with                                             |
| -------------------------- | ------------------------------------------------------- |
| Duplicate key              | `MongoServerError` with `code === 11000`                |
| No reachable server        | `MongoServerSelectionError`                             |
| Network failure mid-op     | `MongoNetworkError`                                     |
| Partial bulk failure       | `MongoBulkWriteError` — read `result` and `writeErrors` |
| Document failed validation | `MongoServerError` with `code === 121`                  |
| Transaction can be retried | Error label `TransientTransactionError`                 |
| Commit outcome unknown     | Error label `UnknownTransactionCommitResult`            |

`withTransaction` already retries both transaction labels. Handle them by hand only outside it.

---

## mongosh Commands

```bash
mongosh "mongodb+srv://cluster.example.net/appdb" --username admin

show dbs
use appdb
show collections

db.orders.findOne({ status: "pending" })
db.orders.countDocuments({ tenantId })

db.orders.getIndexes()
db.orders.createIndex({ tenantId: 1, createdAt: -1 }, { name: "tenant_created" })
db.orders.dropIndex("tenant_created")
db.orders.aggregate([{ $indexStats: {} }])

db.orders.find({ tenantId }).sort({ createdAt: -1 }).explain("executionStats")

db.currentOp({ "secs_running": { $gt: 5 } })   # long-running operations
db.serverStatus().connections                   # current vs available
```

---

## Version Notes

The driver's major version determines several behaviours worth checking against the version actually installed:

- **Callbacks were removed** — every operation returns a promise. Callback-style code from older material throws.
- **`findOneAnd*` returns the document directly.** Pass `includeResultMetadata: true` for the older `{ value, ok, lastErrorObject }` wrapper.
- **`timeoutMS`** provides one end-to-end budget per operation, superseding the older per-stage timeout options.
- **The `background` index option is ignored** — the driver still accepts it, but MongoDB 4.2+ builds every index without blocking, so the option no longer changes anything.
