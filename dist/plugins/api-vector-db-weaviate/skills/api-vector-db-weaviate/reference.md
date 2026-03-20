# Weaviate Quick Reference

> API cheat sheet, vectorizer comparison, data types, and decision frameworks. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Connection Methods

| Method                              | Use Case                                         | Example                                                                                             |
| ----------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `connectToWeaviateCloud(url, opts)` | Weaviate Cloud managed instances                 | `weaviate.connectToWeaviateCloud(url, { authCredentials: new weaviate.ApiKey(key) })`               |
| `connectToLocal(opts?)`             | Local Docker instances (default: localhost:8080) | `weaviate.connectToLocal()`                                                                         |
| `connectToCustom(opts)`             | Custom host/port/protocol                        | `weaviate.connectToCustom({ httpHost: 'host', httpPort: 8080, grpcHost: 'host', grpcPort: 50051 })` |

### Connection Options

| Option            | Default | Description                                                   |
| ----------------- | ------- | ------------------------------------------------------------- |
| `authCredentials` | none    | `new weaviate.ApiKey(key)` for API key auth                   |
| `headers`         | `{}`    | API keys for vectorizer modules (`X-OpenAI-Api-Key`, etc.)    |
| `timeout.query`   | 30      | Query timeout in seconds                                      |
| `timeout.insert`  | 120     | Insert timeout in seconds                                     |
| `timeout.init`    | 2       | Init check timeout in seconds                                 |
| `skipInitChecks`  | false   | Skip version and port checks (temporary troubleshooting only) |

---

## Collection Operations

| Operation    | Method                                                          | Notes                                              |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------- |
| Create       | `client.collections.create({ name, vectorizers, properties })`  | Vectorizer must be set here                        |
| Get          | `client.collections.use('Name')`                                | Returns collection object for queries              |
| Exists       | `client.collections.exists('Name')`                             | Returns boolean                                    |
| List         | `client.collections.listAll()`                                  | Returns all collection configs                     |
| Config       | `collection.config.get()`                                       | Returns full collection configuration              |
| Update       | `collection.config.update({ ... })`                             | Limited -- can update index params, not vectorizer |
| Delete       | `client.collections.delete('Name')`                             | Permanent -- deletes all data                      |
| Add property | `collection.config.addProperty({ name, dataType })`             | Existing objects not reindexed                     |
| Add vector   | `collection.config.addVector(vectors.text2VecOpenAI({ name }))` | Named vectors only                                 |

---

## Data Operations

| Operation      | Method                                        | Returns                             |
| -------------- | --------------------------------------------- | ----------------------------------- |
| Insert one     | `collection.data.insert({ properties })`      | UUID string                         |
| Insert many    | `collection.data.insertMany(objects)`         | Response with `hasErrors`, `errors` |
| Update (merge) | `collection.data.update({ id, properties })`  | Preserves unspecified properties    |
| Replace (full) | `collection.data.replace({ id, properties })` | Deletes unspecified properties      |
| Delete one     | `collection.data.deleteById(id)`              | boolean                             |
| Delete many    | `collection.data.deleteMany(filter)`          | Count of deleted objects            |
| Exists         | `collection.data.exists(id)`                  | boolean                             |
| Fetch by ID    | `collection.query.fetchObjectById(id)`        | Object or null                      |

---

## Search Methods

| Method                               | Description                           | Key Options                                            |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------ |
| `query.nearText(text, opts)`         | Semantic search via vectorizer module | `limit`, `distance`, `filters`, `returnMetadata`       |
| `query.nearVector(vec, opts)`        | Search by raw vector                  | `limit`, `distance`, `filters`                         |
| `query.hybrid(text, opts)`           | Vector + keyword blend                | `alpha` (0=keyword, 1=vector), `fusionType`, `filters` |
| `query.bm25(text, opts)`             | Keyword search (BM25)                 | `queryProperties`, `filters`                           |
| `query.fetchObjects(opts)`           | List/filter without search            | `limit`, `offset`, `filters`, `sort`                   |
| `query.fetchObjectById(id)`          | Get single object                     | `includeVector`, `returnReferences`                    |
| `generate.nearText(text, gen, opts)` | RAG with semantic search              | `singlePrompt`, `groupedTask`                          |
| `generate.hybrid(text, gen, opts)`   | RAG with hybrid search                | Same as hybrid + generate options                      |
| `generate.fetchObjects(gen, opts)`   | RAG without search ranking            | `singlePrompt`, `groupedTask`                          |

---

## Filter Operators

| Operator                | Example                                       | Notes             |
| ----------------------- | --------------------------------------------- | ----------------- |
| `equal(value)`          | `.byProperty('status').equal('active')`       | Exact match       |
| `notEqual(value)`       | `.byProperty('status').notEqual('draft')`     | Negation          |
| `greaterThan(value)`    | `.byProperty('price').greaterThan(100)`       | Exclusive         |
| `greaterOrEqual(value)` | `.byProperty('price').greaterOrEqual(100)`    | Inclusive         |
| `lessThan(value)`       | `.byProperty('price').lessThan(50)`           | Exclusive         |
| `lessOrEqual(value)`    | `.byProperty('price').lessOrEqual(50)`        | Inclusive         |
| `like(pattern)`         | `.byProperty('name').like('*smith*')`         | Wildcard match    |
| `containsAny(arr)`      | `.byProperty('tags').containsAny(['a', 'b'])` | Any token matches |
| `containsAll(arr)`      | `.byProperty('tags').containsAll(['a', 'b'])` | All tokens match  |
| `containsNone(arr)`     | `.byProperty('tags').containsNone(['x'])`     | No tokens match   |
| `isNull(bool)`          | `.byProperty('field').isNull(true)`           | Null check        |
| `withinGeoRange(opts)`  | `.byProperty('loc').withinGeoRange({...})`    | Geo proximity     |

### Combining Filters

```typescript
import { Filters } from "weaviate-client";

// AND
Filters.and(filterA, filterB, filterC);

// OR
Filters.or(filterA, filterB);

// NOT
Filters.not(filterA);

// Nested
Filters.and(filterA, Filters.or(filterB, filterC));
```

### Metadata Filters

```typescript
// By object ID
collection.filter.byId().equal(targetId);

// By creation time
collection.filter.byCreationTime().greaterOrEqual("2024-01-01T00:00:00Z");

// By property length (second arg = true)
collection.filter.byProperty("title", true).greaterThan(10);

// By cross-reference property
collection.filter.byRef("hasCategory").byProperty("title").equal("Science");
```

---

## Vectorizer Comparison

| Vectorizer             | Provider       | Use Case                | Requires API Key Header |
| ---------------------- | -------------- | ----------------------- | ----------------------- |
| `text2VecOpenAI`       | OpenAI         | General text embedding  | `X-OpenAI-Api-Key`      |
| `text2VecCohere`       | Cohere         | Multilingual, general   | `X-Cohere-Api-Key`      |
| `text2VecHuggingFace`  | HuggingFace    | Open-source models      | `X-HuggingFace-Api-Key` |
| `text2VecOllama`       | Ollama (local) | Self-hosted models      | None (local)            |
| `text2VecTransformers` | Custom         | Self-hosted transformer | None (local)            |
| `multi2VecClip`        | CLIP           | Image + text multimodal | Depends on provider     |
| `selfProvided`         | You            | Bring your own vectors  | None                    |

---

## Data Types

| `dataType.*`      | TypeScript Type | Description                 |
| ----------------- | --------------- | --------------------------- |
| `TEXT`            | string          | Tokenized text (searchable) |
| `TEXT_ARRAY`      | string[]        | Array of text values        |
| `INT`             | number          | Integer                     |
| `INT_ARRAY`       | number[]        | Array of integers           |
| `NUMBER`          | number          | Float                       |
| `NUMBER_ARRAY`    | number[]        | Array of floats             |
| `BOOLEAN`         | boolean         | True/false                  |
| `DATE`            | string/Date     | ISO 8601 date               |
| `UUID`            | string          | UUID reference              |
| `GEO_COORDINATES` | object          | `{ latitude, longitude }`   |
| `BLOB`            | string          | Base64 encoded binary       |
| `OBJECT`          | object          | Nested object               |
| `OBJECT_ARRAY`    | object[]        | Array of nested objects     |

---

## Generative Model Configuration

| Provider  | Import                   | Example                                               |
| --------- | ------------------------ | ----------------------------------------------------- |
| OpenAI    | `generative.openAI()`    | `generative.openAI({ model: "gpt-4o" })`              |
| Cohere    | `generative.cohere()`    | `generative.cohere({ model: "command-r-plus" })`      |
| Anthropic | `generative.anthropic()` | `generative.anthropic({ model: "claude-haiku-4-5" })` |
| Ollama    | `generative.ollama()`    | `generative.ollama({ model: "llama3" })`              |

### Reranker Configuration

| Provider | Import                | Example               |
| -------- | --------------------- | --------------------- |
| Cohere   | `reranker.cohere()`   | `reranker.cohere()`   |
| VoyageAI | `reranker.voyageAI()` | `reranker.voyageAI()` |

---

## Vector Index Types

| Type      | Use Case                                       | Config                            |
| --------- | ---------------------------------------------- | --------------------------------- |
| `hnsw`    | Default, good for most use cases               | `configure.vectorIndex.hnsw()`    |
| `flat`    | Small collections (< 10K objects)              | `configure.vectorIndex.flat()`    |
| `dynamic` | Auto-switches flat -> hnsw as collection grows | `configure.vectorIndex.dynamic()` |

### Quantization (Compression)

```typescript
configure.vectorIndex.hnsw({
  quantizer: configure.vectorIndex.quantizer.pq(), // Product quantization
});

configure.vectorIndex.flat({
  quantizer: configure.vectorIndex.quantizer.bq(), // Binary quantization
});
```

---

## Multi-Tenancy Quick Reference

| Operation          | Method                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Enable             | `multiTenancy: weaviate.configure.multiTenancy({ enabled: true })` in create |
| Auto-create        | `autoTenantCreation: true` in multiTenancy config                            |
| Add tenants        | `collection.tenants.create([{ name: 'tenantA' }])`                           |
| List tenants       | `collection.tenants.get()`                                                   |
| Get by name        | `collection.tenants.getByName('tenantA')`                                    |
| Delete tenants     | `collection.tenants.remove([{ name: 'tenantB' }])`                           |
| Set state          | `collection.tenants.update({ name: 'tenantA', activityStatus: 'ACTIVE' })`   |
| Query with tenant  | `collection.withTenant('tenantA').query.fetchObjects()`                      |
| Insert with tenant | `collection.withTenant('tenantA').data.insert({ ... })`                      |

### Tenant States

| State       | Description                                    |
| ----------- | ---------------------------------------------- |
| `ACTIVE`    | Tenant is loaded and queryable (default)       |
| `INACTIVE`  | Tenant data on disk, not loaded in memory      |
| `OFFLOADED` | Tenant data moved to cold storage (cloud only) |

---

## Production Checklist

### Connection

- [ ] `client.close()` called in cleanup/shutdown handlers
- [ ] API key headers for vectorizer modules (`X-OpenAI-Api-Key`, etc.)
- [ ] Query timeout increased for RAG operations (`query: 60`)
- [ ] `skipInitChecks: false` (only true for temporary debugging)

### Collections

- [ ] Vectorizer configured at creation time
- [ ] Properties defined with explicit data types (not auto-detected)
- [ ] Generative model configured if using RAG
- [ ] Vector index type appropriate for collection size

### Data

- [ ] `insertMany` response checked for `hasErrors`
- [ ] Deterministic UUIDs via `generateUuid5` for idempotent imports
- [ ] `update` (merge) vs `replace` (overwrite) chosen correctly

### Multi-Tenancy

- [ ] Tenant name validated (alphanumeric, underscore, hyphen; 4-64 chars)
- [ ] `.withTenant()` used on all operations for multi-tenant collections
- [ ] Inactive tenant activation before queries
- [ ] Backups only include ACTIVE tenants

### Search

- [ ] `targetVector` specified for named vector collections
- [ ] `returnMetadata: ['distance']` or `['score']` for relevance debugging
- [ ] Filters combined with `Filters.and()` / `Filters.or()` (not arrays)
- [ ] `alpha` parameter documented for hybrid search tuning

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
