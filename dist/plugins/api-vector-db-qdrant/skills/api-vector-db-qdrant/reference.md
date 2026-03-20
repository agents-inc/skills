# Qdrant Quick Reference

> API reference, filter operators, limits, decision frameworks, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## QdrantClient Methods -- Collections

| Method                                | Description                          | Returns                        |
| ------------------------------------- | ------------------------------------ | ------------------------------ |
| `new QdrantClient({ url, apiKey })`   | Create client (local or cloud)       | `QdrantClient`                 |
| `client.createCollection(name, args)` | Create collection with vector config | `Promise<boolean>`             |
| `client.getCollection(name)`          | Get collection info                  | `Promise<CollectionInfo>`      |
| `client.getCollections()`             | List all collections                 | `Promise<CollectionsResponse>` |
| `client.updateCollection(name, args)` | Update optimizer/quantization config | `Promise<boolean>`             |
| `client.deleteCollection(name)`       | Delete a collection                  | `Promise<boolean>`             |
| `client.collectionExists(name)`       | Check if collection exists           | `Promise<CollectionExistence>` |

## QdrantClient Methods -- Points

| Method                           | Description                         | Returns                   |
| -------------------------------- | ----------------------------------- | ------------------------- |
| `client.upsert(name, args)`      | Insert or update points             | `Promise<UpdateResult>`   |
| `client.retrieve(name, args)`    | Fetch points by ID                  | `Promise<Record[]>`       |
| `client.delete(name, args)`      | Delete by IDs or filter             | `Promise<UpdateResult>`   |
| `client.scroll(name, args)`      | Paginate through points             | `Promise<ScrollResult>`   |
| `client.count(name, args)`       | Count points (exact or approximate) | `Promise<CountResult>`    |
| `client.batchUpdate(name, args)` | Multiple operations in one call     | `Promise<UpdateResult[]>` |

## QdrantClient Methods -- Search & Query

| Method                                | Description                       | Returns                    |
| ------------------------------------- | --------------------------------- | -------------------------- |
| `client.query(name, args)`            | Universal search (preferred)      | `Promise<QueryResponse>`   |
| `client.queryBatch(name, args)`       | Multiple queries in one call      | `Promise<QueryResponse[]>` |
| `client.queryPointGroups(name, args)` | Grouped search by payload field   | `Promise<GroupsResult>`    |
| `client.search(name, args)`           | Vector similarity search (legacy) | `Promise<ScoredPoint[]>`   |
| `client.searchBatch(name, args)`      | Multiple searches in one call     | `Promise<ScoredPoint[][]>` |

## QdrantClient Methods -- Recommendations

| Method                                    | Description                             | Returns                    |
| ----------------------------------------- | --------------------------------------- | -------------------------- |
| `client.recommend(name, args)`            | Recommend by positive/negative examples | `Promise<ScoredPoint[]>`   |
| `client.recommendBatch(name, args)`       | Multiple recommendations in one call    | `Promise<ScoredPoint[][]>` |
| `client.recommendPointGroups(name, args)` | Grouped recommendations                 | `Promise<GroupsResult>`    |

## QdrantClient Methods -- Payload

| Method                                  | Description                         | Returns                 |
| --------------------------------------- | ----------------------------------- | ----------------------- |
| `client.setPayload(name, args)`         | Merge payload fields into points    | `Promise<UpdateResult>` |
| `client.overwritePayload(name, args)`   | Replace entire payload              | `Promise<UpdateResult>` |
| `client.deletePayload(name, args)`      | Remove specific payload keys        | `Promise<UpdateResult>` |
| `client.clearPayload(name, args)`       | Remove all payload from points      | `Promise<UpdateResult>` |
| `client.createPayloadIndex(name, args)` | Index a payload field for filtering | `Promise<UpdateResult>` |
| `client.deletePayloadIndex(name, args)` | Remove a payload field index        | `Promise<UpdateResult>` |

## QdrantClient Methods -- Vectors

| Method                             | Description                        | Returns                 |
| ---------------------------------- | ---------------------------------- | ----------------------- |
| `client.updateVectors(name, args)` | Update vectors for existing points | `Promise<UpdateResult>` |
| `client.deleteVectors(name, args)` | Remove named vectors from points   | `Promise<UpdateResult>` |

## QdrantClient Methods -- Snapshots

| Method                                      | Description                          | Returns                          |
| ------------------------------------------- | ------------------------------------ | -------------------------------- |
| `client.createSnapshot(name)`               | Create collection snapshot           | `Promise<SnapshotDescription>`   |
| `client.listSnapshots(name)`                | List collection snapshots            | `Promise<SnapshotDescription[]>` |
| `client.deleteSnapshot(name, snapshotName)` | Delete a snapshot                    | `Promise<boolean>`               |
| `client.recoverSnapshot(name, args)`        | Recover collection from snapshot URL | `Promise<boolean>`               |
| `client.createFullSnapshot()`               | Snapshot entire Qdrant instance      | `Promise<SnapshotDescription>`   |
| `client.listFullSnapshots()`                | List full instance snapshots         | `Promise<SnapshotDescription[]>` |

---

## Filter Condition Types

| Condition          | Description                      | Example                                                             |
| ------------------ | -------------------------------- | ------------------------------------------------------------------- |
| `match.value`      | Exact equality                   | `{ key: "city", match: { value: "London" } }`                       |
| `match.text`       | Full-text substring match        | `{ key: "description", match: { text: "vector" } }`                 |
| `match.any`        | Match any value in list          | `{ key: "city", match: { any: ["London", "Paris"] } }`              |
| `match.except`     | Exclude values in list           | `{ key: "city", match: { except: ["Berlin"] } }`                    |
| `range`            | Numeric range (gt, gte, lt, lte) | `{ key: "price", range: { gte: 10, lte: 100 } }`                    |
| `values_count`     | Count of payload values          | `{ key: "tags", values_count: { gte: 2 } }`                         |
| `geo_bounding_box` | Within rectangular area          | `{ key: "location", geo_bounding_box: { top_left, bottom_right } }` |
| `geo_radius`       | Within circular area             | `{ key: "location", geo_radius: { center, radius } }`               |
| `is_empty`         | Field has no value               | `{ is_empty: { key: "description" } }`                              |
| `is_null`          | Field is explicitly null         | `{ is_null: { key: "deleted_at" } }`                                |
| `has_id`           | Match by point IDs               | `{ has_id: [1, 2, 3] }`                                             |
| `nested`           | Filter on nested payload objects | `{ nested: { key: "items", filter: { must: [...] } } }`             |

## Filter Logic Operators

| Operator   | Description                     | Behavior                                   |
| ---------- | ------------------------------- | ------------------------------------------ |
| `must`     | All conditions must match (AND) | `filter: { must: [cond1, cond2] }`         |
| `should`   | At least one must match (OR)    | `filter: { should: [cond1, cond2] }`       |
| `must_not` | None may match (NOT)            | `filter: { must_not: [cond1] }`            |
| Combined   | Mix operators at top level      | `filter: { must: [...], must_not: [...] }` |

---

## Distance Metrics

| Metric      | Description                    | When to Use                                    |
| ----------- | ------------------------------ | ---------------------------------------------- |
| `Cosine`    | Cosine similarity (normalized) | Most embedding models (safe default)           |
| `Dot`       | Dot product                    | Pre-normalized embeddings (faster than Cosine) |
| `Euclid`    | L2 distance                    | Raw feature vectors where magnitude matters    |
| `Manhattan` | L1 / city-block distance       | Specialized use cases                          |

---

## Payload Field Types & Index Types

| Payload Type | Example Value              | Index Type | Notes                             |
| ------------ | -------------------------- | ---------- | --------------------------------- |
| keyword      | `"tutorial"`               | `keyword`  | Exact match, enum-like values     |
| integer      | `2024`                     | `integer`  | Range and exact match             |
| float        | `0.95`                     | `float`    | Range queries                     |
| bool         | `true`                     | `bool`     | Exact match only                  |
| text         | `"long description"`       | `text`     | Full-text tokenized search        |
| geo          | `{ lat: 51.5, lon: -0.1 }` | `geo`      | Bounding box and radius queries   |
| datetime     | `"2024-01-15T10:30:00Z"`   | `datetime` | Range queries on ISO 8601 strings |

---

## Quantization Methods

| Method         | Compression | Speed   | Accuracy | Best For                                   |
| -------------- | ----------- | ------- | -------- | ------------------------------------------ |
| Scalar (int8)  | 4x          | Fast    | High     | Default choice, balanced tradeoff          |
| Binary (1-bit) | 32x         | Fastest | Lower    | High-dim vectors (>= 1024), speed-critical |
| Product        | Up to 64x   | Slowest | Lowest   | Memory-critical, accuracy secondary        |

---

## Key Limits

| Resource                      | Limit                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| Point ID                      | Positive integer or UUID string (no zero, no negative)         |
| Vector dimensions             | No hard limit (practical: up to 65,535)                        |
| Payload per point             | No hard limit (practical: keep under a few KB for performance) |
| Points per upsert batch       | No hard limit (practical: 100-500 for network reliability)     |
| `scroll` page size (`limit`)  | Max 10,000 per page                                            |
| `query`/`search` result limit | Configurable (practical: keep under 1,000)                     |
| Snapshot recovery             | Must match Qdrant minor version (v1.14.x to v1.14.x)           |

---

## Production Checklist

### Security

- [ ] API key stored in environment variable, not in code
- [ ] Client used server-side only (never expose API key in browser)
- [ ] HTTPS enabled for cloud deployments (`url` includes `https://`)

### Collection Configuration

- [ ] Vector dimension matches embedding model output exactly
- [ ] Distance metric matches model recommendation (Cosine for most)
- [ ] HNSW parameters tuned if needed (default `m: 16`, `ef_construct: 100` works for most)
- [ ] Quantization configured if memory optimization needed

### Payload Indexes

- [ ] `createPayloadIndex()` called for every field used in filter conditions
- [ ] `createPayloadIndex()` called for fields used in `order_by` (scroll)
- [ ] Index type matches field type (`keyword` for strings, `integer` for numbers)
- [ ] Indexes created before bulk data ingestion (faster than retroactive indexing)

### Write Operations

- [ ] `wait: true` set on upserts when read-after-write consistency is required
- [ ] Batch size reasonable (100-500 points per upsert for network reliability)
- [ ] Point IDs are positive integers or UUID strings (not zero, not negative)
- [ ] Retry logic with exponential backoff for transient failures

### Query Optimization

- [ ] `with_payload: true` included when payload data is needed (not included by default)
- [ ] `limit` set to minimum needed (lower = faster)
- [ ] Filters use indexed payload fields
- [ ] `score_threshold` set to skip low-relevance results when applicable

### Monitoring

- [ ] Collection info tracked via `getCollection()` (vector count, segment info)
- [ ] Query latency monitored
- [ ] Snapshot schedule configured for backup

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
