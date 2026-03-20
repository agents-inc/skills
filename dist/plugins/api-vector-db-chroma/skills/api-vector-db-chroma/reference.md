# Chroma Quick Reference

> API reference, filter operators, include options, limits, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## ChromaClient Methods

| Method                                          | Description                                           | Returns                 |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| `new ChromaClient({ path })`                    | Create HTTP client (default: `http://localhost:8000`) | `ChromaClient`          |
| `new CloudClient({ apiKey, tenant, database })` | Create Chroma Cloud client                            | `CloudClient`           |
| `client.heartbeat()`                            | Check server connectivity                             | `Promise<number>`       |
| `client.version()`                              | Get server version                                    | `Promise<string>`       |
| `client.createCollection(options)`              | Create a new collection                               | `Promise<Collection>`   |
| `client.getCollection(options)`                 | Get an existing collection                            | `Promise<Collection>`   |
| `client.getOrCreateCollection(options)`         | Get or create a collection                            | `Promise<Collection>`   |
| `client.deleteCollection({ name })`             | Delete a collection                                   | `Promise<void>`         |
| `client.listCollections({ limit?, offset? })`   | List collections (paginated)                          | `Promise<Collection[]>` |
| `client.countCollections()`                     | Count total collections                               | `Promise<number>`       |
| `client.reset()`                                | Reset entire database (dev only)                      | `Promise<void>`         |

## Collection Methods

| Method                       | Description                     | Returns                |
| ---------------------------- | ------------------------------- | ---------------------- |
| `collection.add(options)`    | Add documents/embeddings        | `Promise<void>`        |
| `collection.query(options)`  | Find similar documents          | `Promise<QueryResult>` |
| `collection.get(options?)`   | Get by IDs or filter            | `Promise<GetResult>`   |
| `collection.update(options)` | Update existing records         | `Promise<void>`        |
| `collection.upsert(options)` | Insert or update records        | `Promise<void>`        |
| `collection.delete(options)` | Delete by IDs or filter         | `Promise<void>`        |
| `collection.peek(options?)`  | Preview first N items           | `Promise<GetResult>`   |
| `collection.count()`         | Count records in collection     | `Promise<number>`      |
| `collection.modify(options)` | Update collection name/metadata | `Promise<void>`        |

---

## Method Parameters

### add / upsert

| Parameter    | Type                              | Required                    | Description                        |
| ------------ | --------------------------------- | --------------------------- | ---------------------------------- |
| `ids`        | `string[]`                        | Yes                         | Unique identifiers for each record |
| `documents`  | `string[]`                        | One of documents/embeddings | Text documents (auto-embedded)     |
| `embeddings` | `number[][]`                      | One of documents/embeddings | Pre-computed embedding vectors     |
| `metadatas`  | `Record<string, MetadataValue>[]` | No                          | Metadata for filtering             |
| `uris`       | `string[]`                        | No                          | URIs for data loaders              |

### query

| Parameter         | Type            | Required                | Description                     |
| ----------------- | --------------- | ----------------------- | ------------------------------- |
| `queryTexts`      | `string[]`      | One of texts/embeddings | Text queries (auto-embedded)    |
| `queryEmbeddings` | `number[][]`    | One of texts/embeddings | Pre-computed query embeddings   |
| `nResults`        | `number`        | No                      | Number of results (default: 10) |
| `where`           | `Where`         | No                      | Metadata filter                 |
| `whereDocument`   | `WhereDocument` | No                      | Document content filter         |
| `include`         | `Include[]`     | No                      | Fields to include in response   |

### get

| Parameter       | Type            | Required | Description                   |
| --------------- | --------------- | -------- | ----------------------------- |
| `ids`           | `string[]`      | No       | Specific IDs to retrieve      |
| `where`         | `Where`         | No       | Metadata filter               |
| `whereDocument` | `WhereDocument` | No       | Document content filter       |
| `limit`         | `number`        | No       | Max results to return         |
| `offset`        | `number`        | No       | Skip first N results          |
| `include`       | `Include[]`     | No       | Fields to include in response |

### delete

| Parameter       | Type            | Required | Description                          |
| --------------- | --------------- | -------- | ------------------------------------ |
| `ids`           | `string[]`      | No       | Specific IDs to delete               |
| `where`         | `Where`         | No       | Metadata filter for deletion         |
| `whereDocument` | `WhereDocument` | No       | Document content filter for deletion |

---

## Metadata Filter Operators (`where`)

| Operator        | Description           | Supported Types         | Example                                   |
| --------------- | --------------------- | ----------------------- | ----------------------------------------- |
| `$eq`           | Equal to (default)    | string, number, boolean | `{ genre: { $eq: "drama" } }`             |
| `$ne`           | Not equal to          | string, number, boolean | `{ genre: { $ne: "comedy" } }`            |
| `$gt`           | Greater than          | number only             | `{ year: { $gt: 2020 } }`                 |
| `$gte`          | Greater than or equal | number only             | `{ year: { $gte: 2020 } }`                |
| `$lt`           | Less than             | number only             | `{ year: { $lt: 2020 } }`                 |
| `$lte`          | Less than or equal    | number only             | `{ year: { $lte: 2020 } }`                |
| `$in`           | In set                | string, number, boolean | `{ genre: { $in: ["drama", "action"] } }` |
| `$nin`          | Not in set            | string, number, boolean | `{ genre: { $nin: ["horror"] } }`         |
| `$contains`     | Array contains value  | typed arrays            | `{ authors: { $contains: "Chen" } }`      |
| `$not_contains` | Array excludes value  | typed arrays            | `{ tags: { $not_contains: "draft" } }`    |
| `$and`          | Logical AND           | filter[]                | `{ $and: [filter1, filter2] }`            |
| `$or`           | Logical OR            | filter[]                | `{ $or: [filter1, filter2] }`             |

**Rules:**

- Direct equality shorthand: `{ field: "value" }` equals `{ field: { $eq: "value" } }`
- `$gt`, `$gte`, `$lt`, `$lte` work on numeric values only
- `$contains` / `$not_contains` work on array metadata fields only (Chroma >= 1.5.0)
- Array metadata must be homogeneous (all same type: string, int, float, or boolean)
- Nested objects are not supported in metadata -- flat key-value pairs only
- Metadata keys are case-sensitive

---

## Document Content Filter Operators (`whereDocument`)

| Operator        | Description                       | Example                                          |
| --------------- | --------------------------------- | ------------------------------------------------ |
| `$contains`     | Case-sensitive substring match    | `{ $contains: "neural network" }`                |
| `$not_contains` | Excludes documents with substring | `{ $not_contains: "deprecated" }`                |
| `$regex`        | Regex pattern match               | `{ $regex: "deep\\s+learning" }`                 |
| `$not_regex`    | Excludes documents matching regex | `{ $not_regex: "draft.*v[0-9]" }`                |
| `$and`          | Logical AND for document filters  | `{ $and: [{$contains: "A"}, {$contains: "B"}] }` |
| `$or`           | Logical OR for document filters   | `{ $or: [{$contains: "A"}, {$contains: "B"}] }`  |

---

## Include Options

| Value          | In `query()` default? | In `get()` default? | Description                       |
| -------------- | --------------------- | ------------------- | --------------------------------- |
| `"documents"`  | Yes                   | Yes                 | Document text content             |
| `"metadatas"`  | Yes                   | Yes                 | Metadata key-value pairs          |
| `"distances"`  | Yes                   | No                  | Similarity distances (query only) |
| `"embeddings"` | No                    | No                  | Raw embedding vectors             |
| `"uris"`       | No                    | No                  | Data loader URIs                  |

---

## Return Type Structures

### QueryResult (from `query()`)

```typescript
interface QueryResult {
  ids: string[][]; // Nested: [query1_ids, query2_ids, ...]
  documents: (string | null)[][];
  metadatas: (Record<string, MetadataValue> | null)[][];
  embeddings: (number[] | null)[][] | null;
  distances: (number | null)[][] | null;
  uris: (string | null)[][] | null;
  include: Include[];
}
```

### GetResult (from `get()`, `peek()`)

```typescript
interface GetResult {
  ids: string[]; // Flat array
  documents: (string | null)[];
  metadatas: (Record<string, MetadataValue> | null)[];
  embeddings: number[][] | null;
  uris: (string | null)[] | null;
  include: Include[];
}
```

**Critical difference:** `query()` returns nested arrays (batched queries), `get()` returns flat arrays.

---

## HNSW Configuration Parameters

| Parameter         | Default   | Modifiable after creation? | Description                             |
| ----------------- | --------- | -------------------------- | --------------------------------------- |
| `space`           | `"l2"`    | No                         | Distance function: `l2`, `cosine`, `ip` |
| `ef_construction` | `100`     | No                         | Candidate list size during index build  |
| `ef_search`       | `100`     | Yes                        | Candidate list during queries           |
| `max_neighbors`   | `16`      | No                         | Max connections per graph node          |
| `num_threads`     | CPU cores | Yes                        | Threads for operations                  |
| `batch_size`      | `100`     | Yes                        | Vectors per batch                       |
| `sync_threshold`  | `1000`    | Yes                        | Index sync trigger                      |
| `resize_factor`   | `1.2`     | Yes                        | Growth multiplier on resize             |

---

## Distance Metrics

| Metric   | Description                          | When to Use                                         |
| -------- | ------------------------------------ | --------------------------------------------------- |
| `l2`     | Euclidean distance squared (default) | Raw feature vectors where absolute distance matters |
| `cosine` | Cosine similarity (normalized)       | Most embedding models (recommended for text)        |
| `ip`     | Inner product                        | Pre-normalized embeddings, dot product similarity   |

---

## Supported Metadata Types

| Type           | Example Value   | Filter Support               |
| -------------- | --------------- | ---------------------------- |
| String         | `"drama"`       | All operators                |
| Number (int)   | `2024`          | All operators                |
| Number (float) | `0.95`          | All operators                |
| Boolean        | `true`          | `$eq`, `$ne`, `$in`, `$nin`  |
| String array   | `["a", "b"]`    | `$contains`, `$not_contains` |
| Int array      | `[1, 2, 3]`     | `$contains`, `$not_contains` |
| Float array    | `[0.1, 0.2]`    | `$contains`, `$not_contains` |
| Boolean array  | `[true, false]` | `$contains`, `$not_contains` |

**Constraints:** Arrays must be homogeneous (all elements same type). Empty arrays and nested arrays are not allowed. Nested objects are not supported.

---

## Embedding Function Packages

| Package                           | Model                  | Use Case                               |
| --------------------------------- | ---------------------- | -------------------------------------- |
| `@chroma-core/default-embed`      | all-MiniLM-L6-v2       | Local, English text, quick prototyping |
| `@chroma-core/openai`             | text-embedding-3-small | High-quality, production use           |
| `@chroma-core/cohere`             | Cohere embed models    | Multilingual support                   |
| `@chroma-core/google-gemini`      | Gemini embeddings      | Google ecosystem                       |
| `@chroma-core/ollama`             | Ollama models          | Self-hosted, local LLMs                |
| `@chroma-core/huggingface-server` | HF models              | Custom HF models                       |
| `@chroma-core/voyageai`           | Voyage AI models       | Specialized embeddings                 |
| `@chroma-core/jina`               | Jina AI models         | Long-context embeddings                |
| `@chroma-core/all`                | All providers          | Install everything                     |

---

## Production Checklist

### Security

- [ ] Chroma server behind authentication (token or basic auth)
- [ ] API tokens stored in environment variables, not in code
- [ ] `client.reset()` disabled in production (dangerous -- deletes everything)

### Collection Configuration

- [ ] Distance metric set explicitly (`cosine` for text embeddings)
- [ ] Embedding function configured per collection (not relying on defaults)
- [ ] `ef_construction` increased for large collections (better recall, slower build)

### Data Management

- [ ] Metadata values are flat (no nested objects)
- [ ] IDs are unique and deterministic
- [ ] `upsert` used instead of `add` for idempotent operations
- [ ] Large datasets added in batches (avoid single massive `add` call)

### Query Optimization

- [ ] `nResults` set to minimum needed (lower = faster)
- [ ] `include` parameter used to exclude unnecessary fields
- [ ] `where` filters use indexed metadata fields
- [ ] `whereDocument` used sparingly (can be slow on large collections)

### Monitoring

- [ ] `collection.count()` tracked for growth monitoring
- [ ] `client.heartbeat()` used for health checks
- [ ] Error handling for connection failures and timeouts

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
