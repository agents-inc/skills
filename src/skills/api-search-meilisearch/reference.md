# Meilisearch Quick Reference

> Search parameters, settings defaults, client methods, decision frameworks, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Search Parameters

| Parameter                 | Type              | Default     | Description                                                |
| ------------------------- | ----------------- | ----------- | ---------------------------------------------------------- |
| `q`                       | `string \| null`  | `null`      | Search query (prefix-matched, typo-tolerant)               |
| `offset`                  | `number`          | `0`         | Number of results to skip (use with `limit`)               |
| `limit`                   | `number`          | `20`        | Max results to return (use with `offset`)                  |
| `page`                    | `number`          | `undefined` | Page number (1-indexed, use with `hitsPerPage`)            |
| `hitsPerPage`             | `number`          | `undefined` | Results per page (use with `page`)                         |
| `filter`                  | `string \| array` | `undefined` | Filter expression (requires `filterableAttributes`)        |
| `sort`                    | `string[]`        | `undefined` | Sort expressions: `["price:asc", "date:desc"]`             |
| `facets`                  | `string[]`        | `undefined` | Attributes to return facet counts for                      |
| `attributesToRetrieve`    | `string[]`        | `["*"]`     | Fields to include in results                               |
| `attributesToHighlight`   | `string[]`        | `undefined` | Fields to highlight matches in `_formatted`                |
| `attributesToCrop`        | `string[]`        | `undefined` | Fields to crop in `_formatted`                             |
| `cropLength`              | `number`          | `10`        | Max words in cropped values                                |
| `cropMarker`              | `string`          | `"..."`     | String marking crop boundaries                             |
| `highlightPreTag`         | `string`          | `"<em>"`    | String inserted before highlighted terms                   |
| `highlightPostTag`        | `string`          | `"</em>"`   | String inserted after highlighted terms                    |
| `showRankingScore`        | `boolean`         | `false`     | Include `_rankingScore` (0.0-1.0) per hit                  |
| `showRankingScoreDetails` | `boolean`         | `false`     | Include per-rule score breakdown                           |
| `rankingScoreThreshold`   | `number`          | `undefined` | Exclude results below this score (0.0-1.0)                 |
| `matchingStrategy`        | `string`          | `"last"`    | `"last"` \| `"all"` \| `"frequency"` -- how to match terms |
| `attributesToSearchOn`    | `string[]`        | `undefined` | Restrict search to specific fields only                    |
| `showMatchesPosition`     | `boolean`         | `false`     | Include byte offsets of matches                            |
| `distinct`                | `string`          | `undefined` | Return one document per distinct value of this attribute   |
| `locales`                 | `string[]`        | `undefined` | ISO-639 locale codes for language-specific tokenization    |
| `hybrid`                  | `object`          | `undefined` | `{ embedder, semanticRatio }` for hybrid search            |

---

## Index Settings Defaults

| Setting                             | Default Value                                                      |
| ----------------------------------- | ------------------------------------------------------------------ |
| `displayedAttributes`               | `["*"]` (all fields)                                               |
| `searchableAttributes`              | `["*"]` (all fields, equal weight)                                 |
| `filterableAttributes`              | `[]` (no filtering possible)                                       |
| `sortableAttributes`                | `[]` (no sorting possible)                                         |
| `rankingRules`                      | `["words", "typo", "proximity", "attribute", "sort", "exactness"]` |
| `distinctAttribute`                 | `null`                                                             |
| `stopWords`                         | `[]`                                                               |
| `synonyms`                          | `{}`                                                               |
| `typoTolerance.enabled`             | `true`                                                             |
| `typoTolerance.minWordSizeForTypos` | `{ oneTypo: 5, twoTypos: 9 }`                                      |
| `pagination.maxTotalHits`           | `1000`                                                             |
| `faceting.maxValuesPerFacet`        | `100`                                                              |
| `faceting.sortFacetValuesBy`        | `{ "*": "alpha" }`                                                 |
| `proximityPrecision`                | `"byWord"`                                                         |
| `searchCutoffMs`                    | `null` (defaults to 1500ms)                                        |

---

## Client Method Quick Reference

### Meilisearch (Client)

| Method                                  | Returns                   | Description                       |
| --------------------------------------- | ------------------------- | --------------------------------- |
| `index<T>(uid)`                         | `Index<T>`                | Local reference (no network call) |
| `getIndex<T>(uid)`                      | `Promise<Index<T>>`       | Fetch index from server           |
| `getIndexes(params?)`                   | `Promise<IndexesResults>` | List all indexes                  |
| `createIndex(uid, options?)`            | `EnqueuedTaskPromise`     | Create index (async)              |
| `deleteIndex(uid)`                      | `EnqueuedTaskPromise`     | Delete index (async)              |
| `swapIndexes(params)`                   | `EnqueuedTaskPromise`     | Atomic index swap                 |
| `multiSearch({ queries, federation? })` | `Promise<...>`            | Search multiple indexes           |
| `health()`                              | `Promise<Health>`         | Server health check               |
| `getVersion()`                          | `Promise<Version>`        | Server version info               |
| `getKeys(params?)`                      | `Promise<KeysResults>`    | List API keys                     |
| `createKey(options)`                    | `Promise<Key>`            | Create API key                    |

### Index

| Method                              | Returns                   | Description                                |
| ----------------------------------- | ------------------------- | ------------------------------------------ |
| `search<D, S>(query?, options?)`    | `Promise<SearchResponse>` | Search documents                           |
| `addDocuments(docs, options?)`      | `EnqueuedTaskPromise`     | Add or replace documents                   |
| `updateDocuments(docs, options?)`   | `EnqueuedTaskPromise`     | Partial update documents                   |
| `deleteDocument(id)`                | `EnqueuedTaskPromise`     | Delete single document                     |
| `deleteDocuments(params)`           | `EnqueuedTaskPromise`     | Delete by IDs or filter                    |
| `deleteAllDocuments()`              | `EnqueuedTaskPromise`     | Delete all documents                       |
| `getSettings()`                     | `Promise<Settings>`       | Get all index settings                     |
| `updateSettings(settings)`          | `EnqueuedTaskPromise`     | Update multiple settings at once           |
| `updateFilterableAttributes(attrs)` | `EnqueuedTaskPromise`     | Set filterable attributes                  |
| `updateSortableAttributes(attrs)`   | `EnqueuedTaskPromise`     | Set sortable attributes                    |
| `updateSearchableAttributes(attrs)` | `EnqueuedTaskPromise`     | Set searchable attributes (order = weight) |
| `updateRankingRules(rules)`         | `EnqueuedTaskPromise`     | Set ranking rules                          |
| `updateSynonyms(synonyms)`          | `EnqueuedTaskPromise`     | Set synonym mappings                       |
| `updateStopWords(words)`            | `EnqueuedTaskPromise`     | Set stop words                             |
| `updateTypoTolerance(config)`       | `EnqueuedTaskPromise`     | Set typo tolerance config                  |

### EnqueuedTaskPromise

| Method / Property                        | Returns         | Description                         |
| ---------------------------------------- | --------------- | ----------------------------------- |
| `await task`                             | `EnqueuedTask`  | Get task UID and status             |
| `.waitTask({ timeOutMs?, intervalMs? })` | `Promise<Task>` | Poll until task completes (blocks!) |
| `.taskUid`                               | `number`        | Unique task identifier              |

---

## Filter Syntax

```
Comparison:    attribute = value, attribute != value, attribute > 10, attribute >= 10
String match:  genre = "science fiction"    (quotes required for multi-word values)
Exists:        attribute EXISTS, attribute NOT EXISTS
IS NULL:       attribute IS NULL, attribute IS NOT NULL
IS EMPTY:      attribute IS EMPTY, attribute IS NOT EMPTY
IN:            attribute IN ["value1", "value2"]
Logical:       expression AND expression, expression OR expression, NOT expression
Grouping:      (expression OR expression) AND expression
Geo:           _geoRadius(lat, lng, radius_m), _geoBoundingBox([lat, lng], [lat, lng])
```

**Precedence:** `AND` binds tighter than `OR` -- always use parentheses when combining:

```
// Correct
(category = "electronics" OR category = "computers") AND price < 500

// Wrong -- AND binds first, giving unexpected results
category = "electronics" OR category = "computers" AND price < 500
```

---

## Task Statuses

| Status       | Meaning                                 | Mutable? |
| ------------ | --------------------------------------- | -------- |
| `enqueued`   | Waiting in queue to be processed        | Yes      |
| `processing` | Currently being processed               | Yes      |
| `succeeded`  | Completed successfully, changes applied | No       |
| `failed`     | Error occurred, index unchanged         | No       |
| `canceled`   | Canceled before processing completed    | No       |

---

## Anti-Patterns

### Filtering Without Configuration

```typescript
// ANTI-PATTERN: filterableAttributes not configured
const results = await index.search("laptop", {
  filter: "price < 1000", // Silently returns 0 results
});
```

**Why it's wrong:** `filterableAttributes` defaults to an empty array. Filtering on an unconfigured attribute returns no results without any error.

**What to do instead:** Configure settings first (once, before any search):

```typescript
await index
  .updateFilterableAttributes(["price", "category", "brand"])
  .waitTask();
```

---

### waitTask in Request Handlers

```typescript
// ANTI-PATTERN: Blocking request on task completion
app.post("/products", async (req, res) => {
  const task = await index.addDocuments([req.body]);
  await task.waitTask(); // Polls until done -- may take seconds or minutes
  res.json({ indexed: true });
});
```

**Why it's wrong:** `.waitTask()` repeatedly polls Meilisearch until the task completes. Under load, the task queue may have hundreds of pending tasks, causing this to block for minutes.

**What to do instead:** Return the task UID immediately:

```typescript
app.post("/products", async (req, res) => {
  const task = await index.addDocuments([req.body]);
  res.json({ taskUid: task.taskUid, status: "enqueued" });
});
```

---

### Master Key in Frontend

```typescript
// ANTI-PATTERN: Master key in client-side code
const client = new Meilisearch({
  host: "https://search.example.com",
  apiKey: "master-key-abc123", // Full admin access!
});
```

**Why it's wrong:** The master key grants full access to create/delete indexes, manage keys, and modify all data. Exposing it in client-side code is a critical security vulnerability.

**What to do instead:** Create a search-only API key or use tenant tokens. See [examples/security.md](examples/security.md).

---

### Wrong Primary Key Inference

```typescript
// ANTI-PATTERN: Relying on auto-inference
const index = client.index("products");
await index.addDocuments([
  { productId: "p1", sku: "SKU001", name: "Widget" },
  // Meilisearch picks "productId" or "sku" -- unpredictable
]);
```

**Why it's wrong:** Meilisearch infers the primary key from the first document's fields. If the document has multiple candidate fields (anything ending in `id` or `Id`), the choice is arbitrary.

**What to do instead:** Set primary key explicitly:

```typescript
await index.addDocuments(products, { primaryKey: "productId" });
```

---

## Production Checklist

### Security

- [ ] Search-only API key or tenant tokens for client-side search (never master key)
- [ ] Master key stored in environment variable, not in code
- [ ] Tenant tokens with appropriate search rules for multi-tenant access
- [ ] API key rotation plan in place

### Index Configuration

- [ ] `filterableAttributes` configured for all fields used in filters and facets
- [ ] `sortableAttributes` configured for all fields used in sort
- [ ] `searchableAttributes` ordered by importance (first = highest weight)
- [ ] `typoTolerance` disabled on exact-match fields (SKUs, barcodes, codes)
- [ ] `pagination.maxTotalHits` increased if deep pagination is needed (default: 1000)
- [ ] Settings configured BEFORE adding documents (avoids double re-index)

### Operations

- [ ] Health check endpoint hitting `client.health()` or `client.isHealthy()`
- [ ] Task queue monitoring -- delete finished tasks periodically (queue limit ~10 GiB)
- [ ] Graceful handling of Meilisearch downtime (search is a feature, not a dependency)
- [ ] Document sync strategy to keep Meilisearch in sync with primary database

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
