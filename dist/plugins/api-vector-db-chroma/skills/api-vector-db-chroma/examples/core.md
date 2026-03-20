# Chroma -- Core Pattern Examples

> Client setup, collection management, and fundamental operations (add, query, get, update, upsert, delete). Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [metadata-filtering.md](metadata-filtering.md) -- Filter operators and compound filters
- [embedding-functions.md](embedding-functions.md) -- Default, OpenAI, custom embedding functions

---

## Client Initialization (HTTP)

```typescript
import { ChromaClient } from "chromadb";

function createChromaClient(): ChromaClient {
  const chromaUrl = process.env.CHROMA_URL;
  if (!chromaUrl) {
    throw new Error("CHROMA_URL environment variable is required");
  }
  return new ChromaClient({ path: chromaUrl });
}

export { createChromaClient };
```

**Why good:** Server URL from environment variable (never hardcoded), validation before construction, named export

By default, `ChromaClient()` connects to `http://localhost:8000`. Explicit URL is preferred to avoid deployment-specific bugs.

---

## Cloud Client Initialization

```typescript
import { CloudClient } from "chromadb";

function createCloudClient(): CloudClient {
  const apiKey = process.env.CHROMA_API_KEY;
  if (!apiKey) {
    throw new Error("CHROMA_API_KEY environment variable is required");
  }
  return new CloudClient({
    apiKey,
    tenant: process.env.CHROMA_TENANT ?? "default_tenant",
    database: process.env.CHROMA_DATABASE ?? "default_database",
  });
}

export { createCloudClient };
```

**Why good:** API key from environment, explicit tenant and database, named export

---

## Client with Token Authentication

```typescript
import { ChromaClient } from "chromadb";

function createAuthenticatedClient(): ChromaClient {
  const chromaUrl = process.env.CHROMA_URL;
  const chromaToken = process.env.CHROMA_TOKEN;
  if (!chromaUrl || !chromaToken) {
    throw new Error(
      "CHROMA_URL and CHROMA_TOKEN environment variables required",
    );
  }

  return new ChromaClient({
    path: chromaUrl,
    auth: {
      provider: "token",
      credentials: chromaToken,
      tokenHeaderType: "X_CHROMA_TOKEN",
    },
  });
}

export { createAuthenticatedClient };
```

**Why good:** Token from environment, explicit auth provider and header type

---

## Create a Collection with Cosine Distance

```typescript
import { ChromaClient } from "chromadb";

const COLLECTION_NAME = "documents";

async function createCosineCollection(client: ChromaClient) {
  const collection = await client.createCollection({
    name: COLLECTION_NAME,
    configuration: {
      hnsw: { space: "cosine" },
    },
  });
  return collection;
}

export { createCosineCollection };
```

**Why good:** Named constant for collection name, `cosine` metric via `configuration` parameter (not deprecated metadata approach)

```typescript
// Bad Example -- deprecated HNSW config approach
const collection = await client.createCollection({
  name: "docs",
  metadata: { "hnsw:space": "cosine" }, // DEPRECATED in v3
});
```

**Why bad:** `metadata` prefix for HNSW settings is deprecated; use `configuration: { hnsw: { space } }` instead

---

## Get or Create Collection (Idempotent)

```typescript
import { ChromaClient } from "chromadb";

const COLLECTION_NAME = "articles";

async function getArticlesCollection(client: ChromaClient) {
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    configuration: {
      hnsw: { space: "cosine" },
    },
  });
  return collection;
}

export { getArticlesCollection };
```

**Why good:** Idempotent -- safe to call repeatedly, creates on first call, returns existing on subsequent calls

**Gotcha:** If the collection already exists, `getOrCreateCollection` ignores the `configuration` parameter. It does NOT update the existing collection's configuration.

---

## Add Documents with Automatic Embedding

```typescript
import type { ChromaClient } from "chromadb";

interface ArticleMetadata {
  title: string;
  category: string;
  year: number;
}

const COLLECTION_NAME = "articles";

async function addArticles(
  client: ChromaClient,
  articles: Array<{ id: string; text: string; metadata: ArticleMetadata }>,
): Promise<void> {
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });

  await collection.add({
    ids: articles.map((a) => a.id),
    documents: articles.map((a) => a.text),
    metadatas: articles.map((a) => a.metadata),
  });
}

export { addArticles };
export type { ArticleMetadata };
```

**Why good:** Typed metadata interface, documents auto-embedded by collection's embedding function, columnar format (parallel arrays)

```typescript
// Bad Example -- invalid metadata and missing content
await collection.add({
  ids: ["doc-1"],
  metadatas: [
    {
      title: "Guide",
      author: { name: "Alice", org: "Acme" }, // INVALID: nested object
    },
  ],
  // Missing documents AND embeddings -- at least one required
});
```

**Why bad:** Nested metadata objects are rejected, either `documents` or `embeddings` must be provided

---

## Add Documents with Pre-Computed Embeddings

```typescript
import type { ChromaClient } from "chromadb";

const COLLECTION_NAME = "articles";

async function addWithEmbeddings(
  client: ChromaClient,
  records: Array<{
    id: string;
    embedding: number[];
    text: string;
    metadata: Record<string, string | number>;
  }>,
): Promise<void> {
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    configuration: { hnsw: { space: "cosine" } },
  });

  await collection.add({
    ids: records.map((r) => r.id),
    embeddings: records.map((r) => r.embedding),
    documents: records.map((r) => r.text),
    metadatas: records.map((r) => r.metadata),
  });
}

export { addWithEmbeddings };
```

**Why good:** Pre-computed embeddings bypass the collection's embedding function, documents stored for retrieval, metadata for filtering

**Note:** When both `embeddings` and `documents` are provided, Chroma stores the documents but uses the provided embeddings (does not re-embed).

---

## Query by Text Similarity

```typescript
import type { ChromaClient } from "chromadb";

const N_RESULTS = 10;
const COLLECTION_NAME = "articles";

interface SearchResult {
  id: string;
  document: string | null;
  distance: number | null;
  metadata: Record<string, string | number | boolean> | null;
}

async function searchArticles(
  client: ChromaClient,
  queryText: string,
): Promise<SearchResult[]> {
  const collection = await client.getCollection({ name: COLLECTION_NAME });

  const results = await collection.query({
    queryTexts: [queryText],
    nResults: N_RESULTS,
    include: ["documents", "metadatas", "distances"],
  });

  // Results are nested arrays -- [0] for the first query
  return results.ids[0].map((id, i) => ({
    id,
    document: results.documents?.[0]?.[i] ?? null,
    distance: results.distances?.[0]?.[i] ?? null,
    metadata: results.metadatas?.[0]?.[i] ?? null,
  }));
}

export { searchArticles };
```

**Why good:** Named constant for nResults, explicit include, correct nested array access `[0]`, handles nullable fields, typed return value

```typescript
// Bad Example -- incorrect result access
const results = await collection.query({
  queryTexts: ["query"],
  nResults: 5,
});

// BUG: results.ids is string[][], not string[]
console.log(results.ids[0]); // This is correct
console.log(results.ids.length); // This is the number of QUERIES, not results!
```

**Why bad:** Treating `results.ids` as a flat array leads to bugs; must use `results.ids[0]` for single-query results

---

## Query with Multiple Queries (Batched)

```typescript
const N_RESULTS = 5;

async function batchQuery(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  queries: string[],
) {
  const results = await collection.query({
    queryTexts: queries, // Multiple queries in one call
    nResults: N_RESULTS,
  });

  // Each query gets its own result set
  return queries.map((query, queryIndex) => ({
    query,
    results: results.ids[queryIndex].map((id, i) => ({
      id,
      distance: results.distances?.[queryIndex]?.[i] ?? null,
    })),
  }));
}

export { batchQuery };
```

**Why good:** Multiple queries in single API call, correct nested array indexing per query, efficient batching

---

## Query with Pre-Computed Embeddings

```typescript
const N_RESULTS = 10;

const results = await collection.query({
  queryEmbeddings: [queryVector], // Pre-computed embedding
  nResults: N_RESULTS,
  include: ["documents", "metadatas", "distances"],
});
```

**Why good:** Bypasses collection's embedding function, useful when you manage your own embedding pipeline

**Note:** Do not pass both `queryTexts` and `queryEmbeddings` -- use one or the other.

---

## Get Documents by ID

```typescript
async function getDocuments(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  ids: string[],
) {
  const results = await collection.get({
    ids,
    include: ["documents", "metadatas"],
  });

  // get() returns flat arrays (not nested like query())
  return results.ids.map((id, i) => ({
    id,
    document: results.documents?.[i] ?? null,
    metadata: results.metadatas?.[i] ?? null,
  }));
}

export { getDocuments };
```

**Why good:** `get()` returns flat arrays (unlike `query()`), explicit include, handles nullable fields

**Gotcha:** `get()` silently omits IDs that don't exist. If you request 5 IDs and 2 don't exist, you get 3 results with no error.

---

## Get with Pagination

```typescript
const PAGE_SIZE = 50;

async function getAllDocuments(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
): Promise<Array<{ id: string; document: string | null }>> {
  const allResults: Array<{ id: string; document: string | null }> = [];
  let offset = 0;

  while (true) {
    const page = await collection.get({
      limit: PAGE_SIZE,
      offset,
      include: ["documents"],
    });

    if (page.ids.length === 0) {
      break;
    }

    allResults.push(
      ...page.ids.map((id, i) => ({
        id,
        document: page.documents?.[i] ?? null,
      })),
    );

    offset += page.ids.length;
  }

  return allResults;
}

export { getAllDocuments };
```

**Why good:** Paginated retrieval for large collections, named constant for page size, terminates when no more results

---

## Update Existing Records

```typescript
async function updateDocumentMetadata(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  id: string,
  newCategory: string,
): Promise<void> {
  await collection.update({
    ids: [id],
    metadatas: [{ category: newCategory }],
  });
}

export { updateDocumentMetadata };
```

**Why good:** Updates specific fields without re-embedding (if only metadata changes)

**Gotcha:** `update()` silently ignores non-existent IDs. If the ID doesn't exist, nothing happens and no error is thrown. Use `upsert()` for create-or-update semantics.

**Note:** If `documents` are provided in `update()`, Chroma re-embeds them using the collection's embedding function.

---

## Upsert (Create or Update)

```typescript
async function upsertDocuments(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  docs: Array<{
    id: string;
    text: string;
    metadata: Record<string, string | number | boolean>;
  }>,
): Promise<void> {
  await collection.upsert({
    ids: docs.map((d) => d.id),
    documents: docs.map((d) => d.text),
    metadatas: docs.map((d) => d.metadata),
  });
}

export { upsertDocuments };
```

**Why good:** Idempotent -- creates new records or updates existing ones, safer than `add()` for pipelines that may run multiple times

---

## Delete Records

```typescript
// Delete by IDs
async function deleteByIds(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  ids: string[],
): Promise<void> {
  await collection.delete({ ids });
}

// Delete by metadata filter
async function deleteByCategory(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
  category: string,
): Promise<void> {
  await collection.delete({
    where: { category: { $eq: category } },
  });
}

export { deleteByIds, deleteByCategory };
```

**Why good:** Two deletion patterns (by ID, by filter), named exports

**Gotcha:** `delete()` with no arguments is a no-op -- it does not delete everything. Pass `ids` or `where` to target specific records.

---

## Delete Collection

```typescript
async function removeCollection(
  client: ChromaClient,
  collectionName: string,
): Promise<void> {
  await client.deleteCollection({ name: collectionName });
}

export { removeCollection };
```

**Why good:** Clean deletion of entire collection including all vectors, metadata, and configuration

**Note:** This is irreversible. To recreate with different HNSW settings, delete and recreate the collection.

---

## Collection Health Check

```typescript
import { ChromaClient } from "chromadb";

async function healthCheck(client: ChromaClient): Promise<{
  serverAlive: boolean;
  version: string | null;
  collectionCount: number;
}> {
  try {
    await client.heartbeat();
    const version = await client.version();
    const count = await client.countCollections();

    return { serverAlive: true, version, collectionCount: count };
  } catch {
    return { serverAlive: false, version: null, collectionCount: 0 };
  }
}

export { healthCheck };
```

**Why good:** Uses `heartbeat()` for connectivity check, `version()` for compatibility verification, handles connection failures gracefully

---

## Peek at Collection Contents

```typescript
const PEEK_LIMIT = 5;

async function peekCollection(
  collection: Awaited<ReturnType<ChromaClient["getCollection"]>>,
) {
  const preview = await collection.peek({ limit: PEEK_LIMIT });

  console.log(`Total records: ${await collection.count()}`);
  for (let i = 0; i < preview.ids.length; i++) {
    console.log(preview.ids[i], preview.documents?.[i]?.slice(0, 100));
  }
}

export { peekCollection };
```

**Why good:** Quick debugging tool, `peek()` returns first N items in insertion order, `count()` for total size

**Note:** `peek()` is for debugging, not querying. Results are in insertion order, not relevance order.

---

## Result Iteration with `.rows()`

```typescript
// Get results -- flat iteration
const getResults = await collection.get({
  include: ["documents", "metadatas"],
});

for (const row of getResults.rows()) {
  console.log(row.id, row.document, row.metadata);
}

// Query results -- nested iteration (one batch per query)
const queryResults = await collection.query({
  queryTexts: ["search term"],
  nResults: 5,
});

for (const batch of queryResults.rows()) {
  for (const row of batch) {
    console.log(row.id, row.document, row.metadata, row.distance);
  }
}
```

**Why good:** `.rows()` provides a cleaner iteration API than manual index access, handles the nested/flat difference between query and get results

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
