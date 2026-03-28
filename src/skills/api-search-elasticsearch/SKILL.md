---
name: api-search-elasticsearch
description: Elasticsearch patterns -- client setup, index management, search DSL, aggregations, vector search, bulk operations, deep pagination
---

# Elasticsearch Patterns

> **Quick Guide:** Use `@elastic/elasticsearch` (v8.x/v9.x) as the TypeScript client. Elasticsearch is **near real-time** -- documents are NOT searchable immediately after indexing; they become visible after a refresh (default: every 1 second on active indices). You MUST define explicit mappings before indexing -- dynamic mapping infers types from the first document, and mismatched types in later documents cause hard failures you cannot fix without reindexing. Use `search_after` + Point in Time (PIT) for deep pagination -- NOT `from`/`size` beyond 10,000 hits and NOT the scroll API (deprecated for search). Use the `bulk` API or `client.helpers.bulk()` for any batch operation -- never loop individual index calls.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define explicit index mappings BEFORE indexing documents -- dynamic mapping infers types from the first document, and if a later document sends a different type for the same field, indexing fails with a `mapper_parsing_exception` that CANNOT be fixed without reindexing into a new index)**

**(You MUST use the `bulk` API for batch operations -- looping individual `client.index()` calls is orders of magnitude slower and can overwhelm the cluster with HTTP connections)**

**(You MUST NOT use `from`/`size` pagination beyond 10,000 results -- Elasticsearch throws `Result window is too large` by default; use `search_after` + PIT instead)**

**(You MUST NOT use `refresh: true` or `refresh: "wait_for"` in production request handlers -- forcing a refresh on every write degrades cluster performance; let the default 1-second refresh interval handle it)**

</critical_requirements>

---

## Examples

- [Core Patterns](examples/core.md) -- Client setup, index management, document CRUD, search basics, TypeScript integration
- [Aggregations](examples/aggregations.md) -- Terms, range, date_histogram, nested, pipeline aggregations
- [Vector Search](examples/vector-search.md) -- Dense vector fields, kNN queries, hybrid search, similarity metrics
- [Pagination](examples/pagination.md) -- from/size, search_after, Point in Time, scroll helpers
- [Bulk Operations](examples/bulk-operations.md) -- Bulk API, bulk helper, reindexing patterns

**Additional resources:**

- [reference.md](reference.md) -- Search DSL cheat sheet, mapping types, aggregation reference, decision frameworks

---

**Auto-detection:** Elasticsearch, elasticsearch, @elastic/elasticsearch, client.search, client.index, client.bulk, client.indices.create, client.indices.putMapping, dense_vector, knn, search_after, point in time, openPIT, aggregations, aggs, bool query, match query, term query, multi_match, nested query, range query, client.helpers.bulk, client.helpers.scrollSearch, BulkResponse, SearchResponse, MappingProperty

**When to use:**

- Full-text search with advanced relevance tuning (BM25, custom analyzers, boosting)
- Aggregations and analytics (terms, histograms, pipeline aggregations)
- Vector/semantic search with kNN on dense_vector fields
- Log and event data search with time-based queries
- Complex structured queries combining bool, nested, range, and geo filters
- Search across large datasets requiring deep pagination (search_after + PIT)

**Key patterns covered:**

- Client initialization and connection management
- Index management with explicit mappings and settings
- Document CRUD (index, get, update, delete)
- Search DSL (match, term, bool, range, nested, multi_match)
- Aggregations (terms, range, date_histogram, nested, pipeline)
- Full-text analysis (custom analyzers, tokenizers, filters)
- Vector search (dense_vector, kNN, hybrid text+vector)
- Bulk operations and reindexing
- Deep pagination (search_after + PIT)

**When NOT to use:**

- Simple keyword search on small datasets (client-side filtering or database LIKE queries are simpler)
- Primary data store (Elasticsearch is a search engine, not a database -- always have a source of truth elsewhere)
- Strong consistency requirements (Elasticsearch is eventually consistent by design)
- Simple autocomplete on a small list (a prefix trie or client-side filter is simpler)

---

<philosophy>

## Philosophy

Elasticsearch is a **distributed search and analytics engine** built on Apache Lucene. It excels at full-text search, structured queries, aggregations, and vector search at scale. Core principles:

1. **Near real-time, not real-time** -- Documents are indexed into segments. A refresh (default: every 1 second on active indices) makes new segments searchable. Do not expect immediate consistency after writes.
2. **Mappings are immutable** -- Once a field type is set (text, keyword, integer, etc.), it cannot be changed. Wrong types require reindexing into a new index. Always define mappings explicitly before first document.
3. **Search engine, not database** -- Elasticsearch should not be your source of truth. Always have a primary database and sync to Elasticsearch for search.
4. **Bulk everything** -- The bulk API amortizes HTTP overhead across thousands of operations. Never loop individual index/update/delete calls.
5. **Pagination has limits** -- `from`/`size` is capped at 10,000 hits by default (`index.max_result_window`). Deep pagination requires `search_after` + Point in Time (PIT). The scroll API is deprecated for search use cases.
6. **Text vs keyword matters** -- `text` fields are analyzed (tokenized, lowercased) for full-text search. `keyword` fields are exact-match only. Getting this wrong means either broken search or broken aggregations/filters.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup

Initialize the client with node URL and authentication. The client supports Elastic Cloud, API keys, basic auth, and bearer tokens.

```typescript
// Good Example -- Typed client setup with environment validation
import { Client } from "@elastic/elasticsearch";

function createElasticsearchClient(): Client {
  const node = process.env.ELASTICSEARCH_URL;
  if (!node) {
    throw new Error("ELASTICSEARCH_URL environment variable is required");
  }

  return new Client({
    node,
    auth: {
      apiKey: process.env.ELASTICSEARCH_API_KEY ?? "",
    },
  });
}

export { createElasticsearchClient };
```

**Why good:** Environment variable validation, named export, API key auth (preferred over basic auth in production)

```typescript
// Bad Example -- Hardcoded credentials
import { Client } from "@elastic/elasticsearch";
const client = new Client({
  node: "http://localhost:9200",
  auth: { username: "elastic", password: "changeme" },
});
```

**Why bad:** Hardcoded node URL and credentials leak in version control, basic auth with default password

See [examples/core.md](examples/core.md) for Elastic Cloud setup, health checks, and child clients.

---

### Pattern 2: Index with Explicit Mappings

Always define mappings before indexing. Dynamic mapping infers types from the first document -- if wrong, you must reindex.

```typescript
// Good Example -- Explicit mappings with text + keyword multi-field
const INDEX_NAME = "products";

await client.indices.create({
  index: INDEX_NAME,
  settings: {
    number_of_replicas: 1,
    refresh_interval: "1s",
  },
  mappings: {
    properties: {
      name: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      description: { type: "text", analyzer: "standard" },
      price: { type: "float" },
      categories: { type: "keyword" },
      inStock: { type: "boolean" },
      createdAt: { type: "date" },
    },
  },
});
```

**Why good:** Explicit types prevent mapping conflicts, `text` + `keyword` multi-field allows both full-text search and exact-match filtering/aggregation on `name`

```typescript
// Bad Example -- No mappings, relying on dynamic mapping
await client.indices.create({ index: "products" });
await client.index({
  index: "products",
  document: { price: "29.99" }, // Oops -- "29.99" is a string, mapped as text
});
// All future numeric price documents will fail with mapper_parsing_exception
```

**Why bad:** Dynamic mapping infers `price` as `text` from the string "29.99", and this mapping is immutable -- all future documents with numeric `price` will fail

See [examples/core.md](examples/core.md) for analysis settings, custom analyzers, and mapping migration.

---

### Pattern 3: Search with Bool Query

The bool query is the workhorse of Elasticsearch. It combines `must`, `should`, `must_not`, and `filter` clauses.

```typescript
// Good Example -- Bool query with filter context for exact matches
const MIN_PRICE = 10;
const MAX_PRICE = 100;

const result = await client.search<Product>({
  index: INDEX_NAME,
  query: {
    bool: {
      must: [{ match: { description: "wireless headphones" } }],
      filter: [
        { range: { price: { gte: MIN_PRICE, lte: MAX_PRICE } } },
        { term: { inStock: true } },
      ],
    },
  },
  size: 20,
});
// result.hits.hits[0]._source is typed as Product | undefined
```

**Why good:** `filter` context for exact matches (no scoring overhead, cacheable), `must` for full-text relevance scoring, named constants for range values, typed search with generic

```typescript
// Bad Example -- Everything in must (no filter context)
const result = await client.search({
  index: "products",
  query: {
    bool: {
      must: [
        { match: { description: "wireless headphones" } },
        { range: { price: { gte: 10, lte: 100 } } }, // Wasteful scoring
        { term: { inStock: true } }, // Wasteful scoring
      ],
    },
  },
});
```

**Why bad:** Range and term queries in `must` waste CPU on relevance scoring for yes/no conditions; `filter` context skips scoring and enables Elasticsearch's filter cache

See [examples/core.md](examples/core.md) for multi_match, nested queries, and function_score.

---

### Pattern 4: Aggregations

Aggregations compute analytics over search results. `terms` for category counts, `range` for bucketing, `date_histogram` for time series.

```typescript
// Good Example -- Terms aggregation with sub-aggregation
const AGGREGATION_SIZE = 50;

const result = await client.search({
  index: INDEX_NAME,
  size: 0, // No hits needed, only aggregations
  aggs: {
    categories: {
      terms: { field: "categories", size: AGGREGATION_SIZE },
      aggs: {
        avgPrice: { avg: { field: "price" } },
      },
    },
  },
});
// result.aggregations?.categories.buckets -> [{ key: "electronics", doc_count: 42, avgPrice: { value: 89.5 } }]
```

**Why good:** `size: 0` skips hits when only aggregations are needed (faster), nested sub-aggregation for metrics per bucket, named constant for aggregation size

See [examples/aggregations.md](examples/aggregations.md) for date_histogram, range, nested, and pipeline aggregations.

---

### Pattern 5: Bulk Operations

The bulk API batches multiple index/update/delete operations in a single request. Use `client.helpers.bulk()` for the best developer experience.

```typescript
// Good Example -- Bulk helper with async generator
const result = await client.helpers.bulk<Product>({
  datasource: products,
  onDocument(doc) {
    return { index: { _index: INDEX_NAME, _id: doc.productId } };
  },
  refreshOnCompletion: INDEX_NAME,
});
// result.total, result.successful, result.failed
```

**Why good:** Bulk helper handles batching, concurrency, retries, and back-pressure automatically; `refreshOnCompletion` triggers one refresh at the end instead of per-document

```typescript
// Bad Example -- Looping individual index calls
for (const product of products) {
  await client.index({
    index: "products",
    document: product,
    refresh: true, // Refresh after EVERY document!
  });
}
```

**Why bad:** N individual HTTP requests instead of 1 bulk request, `refresh: true` on every document causes N segment refreshes (devastating to cluster performance)

See [examples/bulk-operations.md](examples/bulk-operations.md) for error handling, update operations, and reindexing.

---

### Pattern 6: Deep Pagination with search_after + PIT

`from`/`size` is limited to 10,000 hits. For deep pagination, use `search_after` with a Point in Time (PIT) for consistent results.

```typescript
// Good Example -- search_after with PIT
const PIT_KEEP_ALIVE = "1m";

const pit = await client.openPointInTime({
  index: INDEX_NAME,
  keep_alive: PIT_KEEP_ALIVE,
});

let searchAfter: Array<string | number> | undefined;
let allHits: Product[] = [];

while (true) {
  const result = await client.search<Product>({
    pit: { id: pit.id, keep_alive: PIT_KEEP_ALIVE },
    sort: [{ createdAt: "desc" }, { _id: "asc" }], // Tiebreaker!
    size: 100,
    ...(searchAfter ? { search_after: searchAfter } : {}),
  });

  const hits = result.hits.hits;
  if (hits.length === 0) break;

  allHits = allHits.concat(
    hits.filter((h) => h._source !== undefined).map((h) => h._source!),
  );
  searchAfter = hits[hits.length - 1].sort as Array<string | number>;
}

await client.closePointInTime({ id: pit.id });
```

**Why good:** PIT ensures consistent snapshot across pages, tiebreaker `_id` prevents missing/duplicate documents, `keep_alive` refreshed on each request

See [examples/pagination.md](examples/pagination.md) for from/size limits, scroll helpers, and pagination decision framework.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Query Type?

```
What kind of search do I need?
-- Full-text relevance search? -> match / multi_match in must
-- Exact value filtering? -> term / terms / range in filter
-- Combining text + filters? -> bool query (must for text, filter for exact)
-- Fuzzy matching? -> match with fuzziness: "AUTO"
-- Phrase matching? -> match_phrase
-- Complex nested objects? -> nested query with path
-- Vector similarity? -> knn with dense_vector field
-- Text + vector hybrid? -> query + knn in same request
```

### Pagination Strategy?

```
How deep do results go?
-- Under 10,000 total? -> from/size (simplest)
-- Over 10,000 hits? -> search_after + PIT (recommended)
-- Bulk data export? -> client.helpers.scrollSearch() or scrollDocuments()
-- Real-time infinite scroll? -> search_after (no PIT needed for forward-only)
```

### text vs keyword?

```
What will I do with this field?
-- Full-text search (tokenized, relevance)? -> text
-- Exact match, filtering, aggregations, sorting? -> keyword
-- Both? -> Multi-field: { type: "text", fields: { keyword: { type: "keyword" } } }
-- Neither (just stored, never queried)? -> { type: "keyword", index: false }
```

### Filter vs Must?

```
Does relevance scoring matter for this clause?
-- YES (affects result order) -> must
-- NO (binary yes/no filter) -> filter (cached, no scoring overhead)
-- Exclude documents -> must_not (in filter context)
-- Boost if present (optional) -> should with minimum_should_match: 0
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Relying on dynamic mapping without explicit mappings -- wrong type inference causes `mapper_parsing_exception` that requires reindexing to fix
- Using `from`/`size` beyond 10,000 results -- Elasticsearch throws `Result window is too large`; use `search_after` + PIT
- Looping individual `client.index()` calls instead of `client.bulk()` or `client.helpers.bulk()` -- orders of magnitude slower, can overwhelm the cluster
- Using `refresh: true` or `refresh: "wait_for"` in production request handlers -- forces a segment refresh on every write, degrades cluster performance under load

**Medium Priority Issues:**

- Putting exact-match conditions (term, range) in `must` instead of `filter` -- wastes CPU on scoring, misses filter cache
- Using `text` type for fields that need exact matching or aggregation -- text fields are analyzed (tokenized), making aggregations return individual tokens instead of full values
- Not including a tiebreaker field in `sort` when using `search_after` -- documents with identical sort values may be skipped or duplicated across pages
- Missing `_source` check -- `hit._source` can be `undefined` if `_source` is disabled or fields are excluded; always handle this

**Gotchas & Edge Cases:**

- **Mapping types are immutable** -- once a field is mapped as `text`, you cannot change it to `keyword`. The only fix is to create a new index with correct mappings and reindex all documents
- **`text` vs `keyword` confusion** -- `text` fields are tokenized ("New York" becomes ["new", "york"]). Aggregating on a `text` field gives you individual tokens, not full values. Use `keyword` or a `.keyword` sub-field for aggregations
- **`match` vs `term` on text fields** -- `term` on a `text` field often returns no results because `term` does NOT analyze the query but the field value IS analyzed (e.g., term "New York" won't match the analyzed tokens "new" and "york")
- **Near real-time delay** -- after indexing, documents are NOT searchable until the next refresh (default: 1 second). Tests that index then immediately search must use `refresh: "wait_for"` or explicit `client.indices.refresh()`
- **Default `index.max_result_window` is 10,000** -- increasing this is possible but NOT recommended; deep pagination with `from`/`size` holds all skipped results in memory
- **Nested objects require `nested` mapping type** -- arrays of objects are flattened by default, losing the association between fields within each object. If you need to query "color: red AND size: large" on the same object in an array, use `nested`
- **Aggregation on `_id` is disabled by default** (8.x+) -- use a separate `id` field if you need to aggregate by document ID
- **`_score` is null in filter context** -- clauses in `filter` do not contribute to scoring; if you need scoring, use `must`
- **Bulk API partial failures** -- a bulk request can succeed overall but have individual failures. Always check `result.errors` and iterate `result.items` to find failed operations
- **Scroll API is deprecated for search** -- use `search_after` + PIT for deep pagination. Scroll is still valid for one-time data export but consumes cluster resources (open search contexts)
- **PIT must be closed** -- failing to close Point in Time contexts leaks resources on the cluster; always close in a finally block

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define explicit index mappings BEFORE indexing documents -- dynamic mapping infers types from the first document, and if a later document sends a different type for the same field, indexing fails with a `mapper_parsing_exception` that CANNOT be fixed without reindexing into a new index)**

**(You MUST use the `bulk` API for batch operations -- looping individual `client.index()` calls is orders of magnitude slower and can overwhelm the cluster with HTTP connections)**

**(You MUST NOT use `from`/`size` pagination beyond 10,000 results -- Elasticsearch throws `Result window is too large` by default; use `search_after` + PIT instead)**

**(You MUST NOT use `refresh: true` or `refresh: "wait_for"` in production request handlers -- forcing a refresh on every write degrades cluster performance; let the default 1-second refresh interval handle it)**

**Failure to follow these rules will cause mapping conflicts, pagination failures, cluster performance degradation, and silent data loss.**

</critical_reminders>
