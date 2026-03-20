# Elasticsearch Quick Reference

> Search DSL, mapping types, aggregation reference, client methods, and decision frameworks. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Search DSL Quick Reference

### Query Types

| Query Type     | Purpose                                   | Context  | Example                                                           |
| -------------- | ----------------------------------------- | -------- | ----------------------------------------------------------------- |
| `match`        | Full-text search (analyzed)               | `must`   | `{ match: { title: "search engine" } }`                           |
| `multi_match`  | Full-text across multiple fields          | `must`   | `{ multi_match: { query: "search", fields: ["title", "body"] } }` |
| `match_phrase` | Exact phrase in order                     | `must`   | `{ match_phrase: { title: "search engine" } }`                    |
| `term`         | Exact value (NOT analyzed)                | `filter` | `{ term: { status: "published" } }`                               |
| `terms`        | Match any of multiple exact values        | `filter` | `{ terms: { status: ["published", "draft"] } }`                   |
| `range`        | Numeric/date range                        | `filter` | `{ range: { price: { gte: 10, lte: 100 } } }`                     |
| `exists`       | Field exists and is not null              | `filter` | `{ exists: { field: "description" } }`                            |
| `bool`         | Combine queries with must/should/filter   | any      | `{ bool: { must: [...], filter: [...] } }`                        |
| `nested`       | Query nested objects preserving structure | `must`   | `{ nested: { path: "comments", query: { ... } } }`                |
| `wildcard`     | Wildcard pattern match                    | `filter` | `{ wildcard: { name: { value: "elast*" } } }`                     |
| `fuzzy`        | Approximate string match                  | `must`   | `{ fuzzy: { name: { value: "serch", fuzziness: "AUTO" } } }`      |
| `prefix`       | Prefix match                              | `filter` | `{ prefix: { name: { value: "elast" } } }`                        |
| `ids`          | Match by document IDs                     | `filter` | `{ ids: { values: ["1", "2", "3"] } }`                            |

### Bool Query Structure

```
bool:
  must:      [ ... ]   # Must match, contributes to score
  should:    [ ... ]   # Optional match, boosts score (OR logic unless minimum_should_match set)
  filter:    [ ... ]   # Must match, NO scoring (cached, fast)
  must_not:  [ ... ]   # Must NOT match, NO scoring
```

**Key rule:** Use `filter` for yes/no conditions (term, range, exists). Use `must` only when relevance scoring matters (match, multi_match).

---

## Mapping Types

| Type           | Purpose                           | Searchable? | Aggregatable? | Sortable? |
| -------------- | --------------------------------- | ----------- | ------------- | --------- |
| `text`         | Full-text search (analyzed)       | Yes         | No\*          | No\*      |
| `keyword`      | Exact values, filtering, sorting  | Yes (exact) | Yes           | Yes       |
| `integer`      | 32-bit integer                    | Yes         | Yes           | Yes       |
| `long`         | 64-bit integer                    | Yes         | Yes           | Yes       |
| `float`        | 32-bit floating point             | Yes         | Yes           | Yes       |
| `double`       | 64-bit floating point             | Yes         | Yes           | Yes       |
| `boolean`      | true/false                        | Yes         | Yes           | Yes       |
| `date`         | ISO 8601 dates or epoch millis    | Yes         | Yes           | Yes       |
| `object`       | JSON object (flattened)           | Yes         | Depends       | No        |
| `nested`       | JSON object (preserves structure) | Yes         | Yes (nested)  | No        |
| `geo_point`    | Latitude/longitude pair           | Geo queries | Yes           | Geo sort  |
| `dense_vector` | Float vector for kNN search       | kNN queries | No            | No        |
| `ip`           | IPv4/IPv6 address                 | Yes         | Yes           | Yes       |
| `completion`   | Autocomplete suggestions          | Suggest API | No            | No        |

\*`text` fields cannot be aggregated or sorted directly. Use a `.keyword` sub-field for aggregation/sort.

### Multi-Field Pattern

The most common pattern: `text` for search, `keyword` sub-field for aggregation/filtering.

```json
{
  "name": {
    "type": "text",
    "analyzer": "standard",
    "fields": {
      "keyword": {
        "type": "keyword",
        "ignore_above": 256
      }
    }
  }
}
```

- Search: `{ "match": { "name": "wireless headphones" } }`
- Aggregate: `{ "terms": { "field": "name.keyword" } }`
- Sort: `{ "sort": [{ "name.keyword": "asc" }] }`

---

## Aggregation Types

### Bucket Aggregations (grouping)

| Aggregation      | Purpose                         | Example                                                                |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------- |
| `terms`          | Group by exact field values     | `{ terms: { field: "status", size: 100 } }`                            |
| `range`          | Custom numeric ranges           | `{ range: { field: "price", ranges: [{ to: 50 }, ...] } }`             |
| `date_histogram` | Time-based buckets              | `{ date_histogram: { field: "created", calendar_interval: "month" } }` |
| `histogram`      | Numeric interval buckets        | `{ histogram: { field: "price", interval: 10 } }`                      |
| `filter`         | Single filter bucket            | `{ filter: { term: { status: "active" } } }`                           |
| `filters`        | Named filter buckets            | `{ filters: { filters: { active: ..., inactive: ... } } }`             |
| `nested`         | Aggregate within nested objects | `{ nested: { path: "comments" } }`                                     |

### Metric Aggregations (calculations)

| Aggregation   | Purpose                    | Example                                  |
| ------------- | -------------------------- | ---------------------------------------- |
| `avg`         | Average value              | `{ avg: { field: "price" } }`            |
| `sum`         | Total sum                  | `{ sum: { field: "quantity" } }`         |
| `min` / `max` | Minimum / Maximum          | `{ min: { field: "price" } }`            |
| `value_count` | Count of values            | `{ value_count: { field: "price" } }`    |
| `stats`       | min/max/avg/sum/count      | `{ stats: { field: "price" } }`          |
| `cardinality` | Approximate distinct count | `{ cardinality: { field: "userId" } }`   |
| `percentiles` | Distribution percentiles   | `{ percentiles: { field: "latency" } }`  |
| `top_hits`    | Top documents per bucket   | `{ top_hits: { size: 3, sort: [...] } }` |

### Pipeline Aggregations (calculations on other aggs)

| Aggregation      | Purpose                                       | buckets_path Example          |
| ---------------- | --------------------------------------------- | ----------------------------- |
| `avg_bucket`     | Average across sibling buckets                | `"monthly_sales>total_sales"` |
| `sum_bucket`     | Sum across sibling buckets                    | `"monthly_sales>total_sales"` |
| `max_bucket`     | Max across sibling buckets                    | `"monthly_sales>total_sales"` |
| `derivative`     | Rate of change between buckets                | `"total_sales"`               |
| `cumulative_sum` | Running total across buckets                  | `"total_sales"`               |
| `moving_fn`      | Moving function across buckets (script-based) | `"total_sales"` + `script`    |
| `bucket_sort`    | Sort parent buckets by sub-agg value          | N/A (uses `sort` param)       |

---

## Client API Quick Reference

### Client

| Method                     | Returns                    | Description                        |
| -------------------------- | -------------------------- | ---------------------------------- |
| `search<T>(params)`        | `SearchResponse<T>`        | Search documents                   |
| `index(params)`            | `IndexResponse`            | Index single document              |
| `get<T>(params)`           | `GetResponse<T>`           | Get document by ID                 |
| `update(params)`           | `UpdateResponse`           | Partial update document            |
| `delete(params)`           | `DeleteResponse`           | Delete document by ID              |
| `bulk(params)`             | `BulkResponse`             | Batch index/update/delete          |
| `deleteByQuery(params)`    | `DeleteByQueryResponse`    | Delete matching documents          |
| `updateByQuery(params)`    | `UpdateByQueryResponse`    | Update matching documents          |
| `mget(params)`             | `MgetResponse<T>`          | Get multiple documents by IDs      |
| `msearch(params)`          | `MsearchResponse`          | Multi-search in single request     |
| `openPointInTime(params)`  | `OpenPointInTimeResponse`  | Open PIT for consistent pagination |
| `closePointInTime(params)` | `ClosePointInTimeResponse` | Close PIT (release resources)      |

### Indices

| Method                          | Returns                | Description                       |
| ------------------------------- | ---------------------- | --------------------------------- |
| `indices.create(params)`        | `CreateIndexResponse`  | Create index with mappings        |
| `indices.delete(params)`        | `AcknowledgedResponse` | Delete index                      |
| `indices.exists(params)`        | `boolean`              | Check if index exists             |
| `indices.putMapping(params)`    | `AcknowledgedResponse` | Add new fields to mapping         |
| `indices.getMapping(params)`    | `GetMappingResponse`   | Get current mappings              |
| `indices.putSettings(params)`   | `AcknowledgedResponse` | Update index settings             |
| `indices.refresh(params)`       | `RefreshResponse`      | Force refresh (make docs visible) |
| `indices.putAlias(params)`      | `AcknowledgedResponse` | Create index alias                |
| `indices.deleteAlias(params)`   | `AcknowledgedResponse` | Delete index alias                |
| `indices.updateAliases(params)` | `AcknowledgedResponse` | Atomic alias swap                 |

### Helpers

| Method                            | Returns            | Description                         |
| --------------------------------- | ------------------ | ----------------------------------- |
| `helpers.bulk(params)`            | `BulkStats`        | Bulk with batching + retries        |
| `helpers.search(params)`          | `T[]`              | Returns only `_source` docs         |
| `helpers.scrollSearch(params)`    | `AsyncIterable`    | Scroll with async iteration (pages) |
| `helpers.scrollDocuments(params)` | `AsyncIterable<T>` | Scroll with async iteration (docs)  |
| `helpers.msearch()`               | `MsearchHelper`    | Batched multi-search                |

---

## Search Parameters

| Parameter          | Type            | Default   | Description                                             |
| ------------------ | --------------- | --------- | ------------------------------------------------------- |
| `index`            | `string`        | required  | Index name or pattern                                   |
| `query`            | `object`        | match_all | Query DSL                                               |
| `size`             | `number`        | `10`      | Number of hits to return                                |
| `from`             | `number`        | `0`       | Offset for pagination (max 10,000 by default)           |
| `sort`             | `array`         | `_score`  | Sort order                                              |
| `_source`          | `boolean/array` | `true`    | Fields to include in `_source`                          |
| `aggs`             | `object`        | none      | Aggregations                                            |
| `highlight`        | `object`        | none      | Highlight matching terms                                |
| `search_after`     | `array`         | none      | Cursor for deep pagination                              |
| `pit`              | `object`        | none      | Point in Time for consistent pagination                 |
| `knn`              | `object`        | none      | kNN vector search                                       |
| `track_total_hits` | `bool/number`   | `10000`   | Track exact total hits (true = exact, number = up to N) |
| `timeout`          | `string`        | none      | Search timeout (e.g., "5s")                             |
| `explain`          | `boolean`       | `false`   | Include score explanation                               |

---

## Common Index Settings

| Setting                            | Default | Description                                        |
| ---------------------------------- | ------- | -------------------------------------------------- |
| `index.number_of_shards`           | `1`     | Primary shards (set at creation, immutable)        |
| `index.number_of_replicas`         | `1`     | Replica shards (can be changed dynamically)        |
| `index.refresh_interval`           | `"1s"`  | How often new docs become searchable               |
| `index.max_result_window`          | `10000` | Max `from + size` for pagination                   |
| `index.mapping.total_fields.limit` | `1000`  | Max fields in mapping (prevents mapping explosion) |

---

## Anti-Patterns

### Dynamic Mapping Without Explicit Types

```typescript
// ANTI-PATTERN: No mappings defined
await client.index({
  index: "events",
  document: { timestamp: "2024-01-15" }, // Mapped as "date"
});
// Later:
await client.index({
  index: "events",
  document: { timestamp: "not-a-date" }, // FAILS: mapper_parsing_exception
});
```

**Why it's wrong:** Dynamic mapping inferred `timestamp` as `date` from the first document. The second document with a non-date string fails permanently. You cannot change the mapping -- you must reindex.

**What to do instead:** Define explicit mappings before indexing any documents.

---

### Using term Query on text Fields

```typescript
// ANTI-PATTERN: term query on analyzed field
const result = await client.search({
  index: "products",
  query: { term: { name: "Wireless Headphones" } }, // Returns 0 results!
});
```

**Why it's wrong:** `text` fields are analyzed -- "Wireless Headphones" is stored as tokens ["wireless", "headphones"]. The `term` query does NOT analyze the input, so it looks for the exact un-analyzed string "Wireless Headphones" which doesn't exist.

**What to do instead:** Use `match` for text fields, or query the `.keyword` sub-field with `term`.

---

### Refresh on Every Write

```typescript
// ANTI-PATTERN: Forcing refresh in request handler
app.post("/products", async (req, res) => {
  await client.index({
    index: "products",
    document: req.body,
    refresh: true, // Forces segment refresh on EVERY write
  });
  res.json({ success: true });
});
```

**Why it's wrong:** Each refresh creates a new Lucene segment. Under write-heavy load, this creates thousands of tiny segments that must be merged, consuming CPU and I/O. The default 1-second refresh interval batches writes into efficient segments.

**What to do instead:** Let the default refresh interval handle it. Use `refresh: "wait_for"` only in tests and seed scripts.

---

## Production Checklist

### Mappings

- [ ] Explicit mappings defined for all fields before first document
- [ ] `text` + `keyword` multi-field on fields needing both search and aggregation
- [ ] `nested` type used for arrays of objects that need field-level query association
- [ ] `dynamic: "strict"` or `dynamic: false` to prevent unexpected field additions

### Performance

- [ ] `filter` context used for all non-scoring queries (term, range, exists)
- [ ] `size: 0` when only aggregations are needed
- [ ] Bulk API used for all batch operations
- [ ] No `refresh: true` in production request handlers
- [ ] `_source` filtering used to return only needed fields

### Pagination

- [ ] `search_after` + PIT used for results beyond 10,000
- [ ] Tiebreaker field included in sort for `search_after`
- [ ] PIT closed in finally block after use

### Reliability

- [ ] Bulk response `errors` flag checked for partial failures
- [ ] `_source` checked for undefined (can be missing if disabled)
- [ ] Connection error handling with retries
- [ ] Health check endpoint using `client.ping()` or `client.info()`

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
