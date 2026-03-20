# Pinecone Quick Reference

> API reference, filter operators, limits, decision frameworks, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Pinecone Client Methods

| Method                            | Description                                             | Returns               |
| --------------------------------- | ------------------------------------------------------- | --------------------- |
| `new Pinecone({ apiKey })`        | Create client (reads `PINECONE_API_KEY` env if omitted) | `Pinecone`            |
| `pc.createIndex(options)`         | Create serverless or pod-based index                    | `Promise<IndexModel>` |
| `pc.createIndexForModel(options)` | Create index with integrated inference                  | `Promise<IndexModel>` |
| `pc.describeIndex(name)`          | Get index metadata and host                             | `Promise<IndexModel>` |
| `pc.listIndexes()`                | List all indexes                                        | `Promise<IndexList>`  |
| `pc.configureIndex(options)`      | Update index config (replicas, pod type)                | `Promise<IndexModel>` |
| `pc.deleteIndex(name)`            | Delete an index                                         | `Promise<void>`       |
| `pc.index({ host })`              | Target a specific index by host URL (preferred)         | `Index<T>`            |
| `pc.index(name, host)`            | Target by name + host (two-arg shorthand)               | `Index<T>`            |

## Index Methods (Vector Operations)

| Method                           | Description                                             | Returns                               |
| -------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `index.namespace(name)`          | Target a namespace within the index                     | `Index<T>`                            |
| `index.upsert({ records })`      | Insert or update vectors                                | `Promise<void>`                       |
| `index.upsertRecords(records[])` | Upsert with integrated inference (direct array, max 96) | `Promise<void>`                       |
| `index.query(options)`           | Find similar vectors                                    | `Promise<QueryResponse<T>>`           |
| `index.searchRecords(options)`   | Search with integrated inference                        | `Promise<SearchRecordsResponse>`      |
| `index.fetch({ ids })`           | Get vectors by ID                                       | `Promise<FetchResponse<T>>`           |
| `index.fetchByMetadata(options)` | Fetch vectors by metadata filter                        | `Promise<FetchByMetadataResponse<T>>` |
| `index.update(options)`          | Update vector values or metadata                        | `Promise<void>`                       |
| `index.deleteOne({ id })`        | Delete a single vector                                  | `Promise<void>`                       |
| `index.deleteMany(options)`      | Delete by IDs or metadata filter                        | `Promise<void>`                       |
| `index.deleteAll()`              | Delete all vectors in namespace                         | `Promise<void>`                       |
| `index.listPaginated(options)`   | List vector IDs with pagination                         | `Promise<ListResponse>`               |
| `index.describeIndexStats()`     | Get index statistics                                    | `Promise<IndexStatsDescription>`      |

## Namespace Management Methods

| Method                           | Description                                      | Returns                           |
| -------------------------------- | ------------------------------------------------ | --------------------------------- |
| `index.listNamespaces(options?)` | List all namespaces                              | `Promise<ListNamespacesResponse>` |
| `index.createNamespace(options)` | Create a namespace with optional metadata schema | `Promise<NamespaceDescription>`   |
| `index.describeNamespace(name)`  | Get namespace details                            | `Promise<NamespaceDescription>`   |
| `index.deleteNamespace(name)`    | Delete a namespace and all its vectors           | `Promise<void>`                   |

## Inference Methods

| Method                         | Description                   | Returns                   |
| ------------------------------ | ----------------------------- | ------------------------- |
| `pc.inference.embed(options)`  | Generate embeddings from text | `Promise<EmbeddingsList>` |
| `pc.inference.rerank(options)` | Rerank documents by relevance | `Promise<RerankResult>`   |
| `pc.inference.getModel(name)`  | Get model info                | `Promise<ModelInfo>`      |
| `pc.inference.listModels()`    | List available models         | `Promise<ModelInfoList>`  |

## Collections Methods (Pod-Based Only)

| Method                         | Description                           | Returns                    |
| ------------------------------ | ------------------------------------- | -------------------------- |
| `pc.createCollection(options)` | Create collection snapshot from index | `Promise<CollectionModel>` |
| `pc.listCollections()`         | List all collections                  | `Promise<CollectionList>`  |
| `pc.describeCollection(name)`  | Get collection details                | `Promise<CollectionModel>` |
| `pc.deleteCollection(name)`    | Delete a collection                   | `Promise<void>`            |

---

## Metadata Filter Operators

| Operator  | Description                      | Supported Types         | Example                                   |
| --------- | -------------------------------- | ----------------------- | ----------------------------------------- |
| `$eq`     | Equal to                         | string, number, boolean | `{ genre: { $eq: "drama" } }`             |
| `$ne`     | Not equal to                     | string, number, boolean | `{ genre: { $ne: "comedy" } }`            |
| `$gt`     | Greater than                     | number                  | `{ year: { $gt: 2020 } }`                 |
| `$gte`    | Greater than or equal            | number                  | `{ year: { $gte: 2020 } }`                |
| `$lt`     | Less than                        | number                  | `{ year: { $lt: 2020 } }`                 |
| `$lte`    | Less than or equal               | number                  | `{ year: { $lte: 2020 } }`                |
| `$in`     | In array (max 10,000 values)     | string, number          | `{ genre: { $in: ["drama", "action"] } }` |
| `$nin`    | Not in array (max 10,000 values) | string, number          | `{ genre: { $nin: ["horror"] } }`         |
| `$exists` | Field exists or not              | boolean                 | `{ genre: { $exists: true } }`            |
| `$and`    | Logical AND (top-level)          | filter[]                | `{ $and: [filter1, filter2] }`            |
| `$or`     | Logical OR (top-level)           | filter[]                | `{ $or: [filter1, filter2] }`             |

**Rules:**

- Only `$and` and `$or` allowed at the query's top level
- `$in` and `$nin` accept max 10,000 values each
- Metadata keys cannot start with `$`
- No nested objects; flat key-value pairs only
- Supported types: string, number (int/float), boolean, string[]
- Null values are not supported

---

## Limits Quick Reference

| Resource                                                    | Limit                 |
| ----------------------------------------------------------- | --------------------- |
| Max vectors per upsert                                      | 1,000 records or 2 MB |
| Max metadata per record                                     | 40 KB                 |
| Max record ID length                                        | 512 characters        |
| Max dense vector dimensions                                 | 20,000                |
| Max sparse non-zero values                                  | 2,048 per vector      |
| Max `topK` (without metadata)                               | 10,000                |
| Max `topK` (with `includeMetadata` or `includeValues`)      | 1,000                 |
| Max vectors per fetch/delete                                | 1,000 IDs             |
| Max `$in` / `$nin` values                                   | 10,000 each           |
| Max text records per `upsertRecords` (integrated inference) | 96                    |
| Serverless indexes per project                              | 100                   |
| Pod-based indexes per project                               | 20                    |

---

## Supported Distance Metrics

| Metric       | Description                    | When to Use                                                          |
| ------------ | ------------------------------ | -------------------------------------------------------------------- |
| `cosine`     | Cosine similarity (normalized) | Most embedding models (default choice)                               |
| `dotproduct` | Dot product                    | Hybrid search (required for sparse-dense), pre-normalized embeddings |
| `euclidean`  | L2 distance                    | Raw feature vectors where absolute distance matters                  |

---

## Supported Metadata Types

| Type           | Example Value | Filter Support          | Notes                                     |
| -------------- | ------------- | ----------------------- | ----------------------------------------- |
| String         | `"drama"`     | All operators           | Keys cannot start with `$`                |
| Number (int)   | `2024`        | All operators           | Comparisons are type-strict               |
| Number (float) | `0.95`        | All operators           | Stored as 64-bit floats                   |
| Boolean        | `true`        | `$eq`, `$ne`, `$exists` | No `$gt`/`$lt` on booleans                |
| String array   | `["a", "b"]`  | `$in`, `$nin`, `$eq`    | Arrays of strings ONLY (no number arrays) |

---

## Production Checklist

### Security

- [ ] API key stored in environment variable, not in code
- [ ] SDK used server-side only (never in browser -- exposes API key)
- [ ] Index access restricted by project/API key scoping

### Index Configuration

- [ ] Dimension matches your embedding model's output dimension exactly
- [ ] Metric matches your embedding model's recommendation (cosine for most)
- [ ] Serverless index used unless pod-based is specifically required
- [ ] Index region chosen close to your application servers

### Data Management

- [ ] Metadata is flat key-value pairs (no nested objects)
- [ ] Metadata per record under 40 KB
- [ ] Record IDs are unique, deterministic, and under 512 characters
- [ ] Upserts batched at 200 records (well under 1,000/2 MB limit)
- [ ] Namespaces used for multi-tenant data isolation

### Query Optimization

- [ ] `topK` set to minimum needed (lower = faster + cheaper)
- [ ] `includeMetadata` and `includeValues` only when needed (max topK drops to 1,000)
- [ ] Metadata filters use indexed fields with reasonable cardinality
- [ ] Namespaces used instead of metadata filtering for tenant isolation

### Consistency & Reliability

- [ ] Application tolerates eventual consistency after upserts
- [ ] Freshness-critical flows poll `describeIndexStats()` before querying
- [ ] Error handling for 400 (bad request), 429 (rate limit), 500 (server error)
- [ ] Retry logic with exponential backoff for transient failures

### Monitoring

- [ ] Track vector count via `describeIndexStats()`
- [ ] Monitor read/write unit consumption
- [ ] Alert on dimension mismatch errors (misconfigured embedding pipeline)
- [ ] Track query latency percentiles

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
