# Pinecone -- Core Pattern Examples

> Client setup, index management, and fundamental vector operations (upsert, query, fetch, update, delete). Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [namespaces.md](namespaces.md) -- Namespace isolation, multi-tenant patterns
- [metadata-filtering.md](metadata-filtering.md) -- Filter operators and compound filters
- [hybrid-search.md](hybrid-search.md) -- Sparse-dense hybrid search
- [inference.md](inference.md) -- Embedding generation and reranking
- [batch-operations.md](batch-operations.md) -- Chunked upserts, parallel ingestion

---

## Client Initialization

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

function createPineconeClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY environment variable is required");
  }
  return new Pinecone({ apiKey });
}

export { createPineconeClient };
```

**Why good:** API key from environment variable (never hardcoded), explicit validation, named export

The `Pinecone` constructor also reads `PINECONE_API_KEY` from the environment automatically if no `apiKey` is passed. Explicit passing is preferred for clarity and to fail fast with a clear error.

---

## Create a Serverless Index

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

const EMBEDDING_DIMENSION = 1536; // Must match your embedding model
const INDEX_NAME = "documents";

async function createServerlessIndex(pc: Pinecone): Promise<string> {
  const indexModel = await pc.createIndex({
    name: INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
    waitUntilReady: true, // Block until index is ready for operations
  });

  return indexModel.host; // Save this -- use it to target the index
}

export { createServerlessIndex };
```

**Why good:** Named constants for dimension and name, `waitUntilReady: true` prevents premature operations, returns host URL for index targeting

```typescript
// ❌ Bad Example -- wrong dimension, no wait
const indexModel = await pc.createIndex({
  name: "docs",
  dimension: 768, // Mismatch if using a 1536-dim model
  metric: "cosine",
  spec: { serverless: { cloud: "aws", region: "us-east-1" } },
});
// Index may not be ready yet -- operations will fail
const index = pc.index({ host: indexModel.host });
await index.upsert({ records: [...] }); // May throw
```

**Why bad:** Dimension mismatch causes 400 errors on upsert, no `waitUntilReady` means index may not accept operations immediately

---

## Target an Index by Host

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

// v7 API -- target by host (preferred)
const INDEX_HOST = process.env.PINECONE_INDEX_HOST;

function getIndex(pc: Pinecone): ReturnType<Pinecone["index"]> {
  if (!INDEX_HOST) {
    throw new Error("PINECONE_INDEX_HOST environment variable is required");
  }
  return pc.index({ host: INDEX_HOST });
}

export { getIndex };
```

**Why good:** Host URL from environment, avoids extra API call to resolve name to host

If you don't have the host URL stored, use `describeIndex` to retrieve it:

```typescript
const indexModel = await pc.describeIndex(INDEX_NAME);
const index = pc.index({ host: indexModel.host });
```

---

## Upsert Vectors with Typed Metadata

```typescript
import type { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

interface ArticleMetadata extends RecordMetadata {
  title: string;
  category: string;
  publishedAt: number; // Unix timestamp
  tags: string[]; // Only string arrays are supported
}

const NAMESPACE = "articles";

async function upsertArticle(
  index: ReturnType<Pinecone["index"]>,
  id: string,
  embedding: number[],
  metadata: ArticleMetadata,
): Promise<void> {
  await index.namespace(NAMESPACE).upsert({
    records: [{ id, values: embedding, metadata }],
  });
}

export { upsertArticle };
export type { ArticleMetadata };
```

**Why good:** Type-safe metadata via `RecordMetadata` extension, namespace isolation, Unix timestamp for dates (not Date objects), string array for tags

```typescript
// ❌ Bad Example -- invalid metadata
await index.upsert({
  records: [
    {
      id: "doc-1",
      values: embedding,
      metadata: {
        title: "Guide",
        author: { name: "Alice", role: "admin" }, // INVALID: nested object
        createdAt: new Date(), // INVALID: Date object
        $priority: "high", // INVALID: key starts with $
        score: null, // INVALID: null value
      },
    },
  ],
});
```

**Why bad:** Nested objects are not supported, Date objects are not serializable, `$`-prefixed keys are reserved for operators, null values are rejected

---

## Query by Vector Similarity

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";
import type { ArticleMetadata } from "./upsert-article";

const TOP_K = 10;
const NAMESPACE = "articles";

interface SearchResult {
  id: string;
  score: number;
  metadata: ArticleMetadata | undefined;
}

async function searchArticles(
  index: ReturnType<Pinecone["index"]>,
  queryEmbedding: number[],
  category?: string,
): Promise<SearchResult[]> {
  const filter = category ? { category: { $eq: category } } : undefined;

  const response = await index.namespace(NAMESPACE).query({
    vector: queryEmbedding,
    topK: TOP_K,
    includeMetadata: true,
    filter,
  });

  return response.matches.map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata as ArticleMetadata | undefined,
  }));
}

export { searchArticles };
```

**Why good:** Optional filter, `includeMetadata: true` to get metadata back, typed response mapping, named constant for topK

---

## Fetch Vectors by ID

```typescript
const NAMESPACE = "articles";

async function fetchArticles(
  index: ReturnType<Pinecone["index"]>,
  ids: string[],
): Promise<void> {
  // Max 1,000 IDs per fetch
  const response = await index.namespace(NAMESPACE).fetch({ ids });

  for (const [id, record] of Object.entries(response.records)) {
    console.log(id, record.metadata);
    // record.values contains the vector (if stored)
  }
}

export { fetchArticles };
```

**Why good:** Targets namespace, respects 1,000 ID limit, iterates response records correctly

**Gotcha:** `fetch` returns an object keyed by ID, not an array. Missing IDs are silently omitted from the response (no error thrown).

---

## Update Vector Metadata

```typescript
const NAMESPACE = "articles";

async function updateArticleCategory(
  index: ReturnType<Pinecone["index"]>,
  id: string,
  newCategory: string,
): Promise<void> {
  await index.namespace(NAMESPACE).update({
    id,
    metadata: { category: newCategory },
    // Only specified fields are updated -- other metadata fields are preserved
  });
}

export { updateArticleCategory };
```

**Why good:** Partial metadata update (only `category` changes, other fields preserved), targets namespace

**Gotcha:** `update()` merges metadata fields, it does not replace the entire metadata object. To remove a metadata field, you must re-upsert the entire record.

---

## Delete Vectors

```typescript
const NAMESPACE = "articles";

// Delete by IDs
async function deleteArticles(
  index: ReturnType<Pinecone["index"]>,
  ids: string[],
): Promise<void> {
  await index.namespace(NAMESPACE).deleteMany({ ids });
}

// Delete by metadata filter
async function deleteByCategory(
  index: ReturnType<Pinecone["index"]>,
  category: string,
): Promise<void> {
  await index.namespace(NAMESPACE).deleteMany({
    filter: { category: { $eq: category } },
  });
}

// Delete all vectors in a namespace
async function clearNamespace(
  index: ReturnType<Pinecone["index"]>,
): Promise<void> {
  await index.namespace(NAMESPACE).deleteAll();
}

export { deleteArticles, deleteByCategory, clearNamespace };
```

**Why good:** Three deletion patterns (by ID, by filter, all), targets namespace, named exports

**Gotcha:** `deleteAll()` without a namespace targets the default (empty) namespace. To delete everything across all namespaces, you must delete each namespace individually or delete and recreate the index.

---

## Check Index Statistics

```typescript
async function getIndexStats(
  index: ReturnType<Pinecone["index"]>,
): Promise<void> {
  const stats = await index.describeIndexStats();

  console.log("Total vectors:", stats.totalRecordCount);
  console.log("Index fullness:", stats.indexFullness);
  console.log("Dimension:", stats.dimension);

  // Per-namespace breakdown
  if (stats.namespaces) {
    for (const [ns, nsStats] of Object.entries(stats.namespaces)) {
      console.log(`  Namespace "${ns}": ${nsStats.recordCount} vectors`);
    }
  }
}

export { getIndexStats };
```

**Why good:** Shows total and per-namespace counts, useful for monitoring and verifying upsert completion

**Gotcha:** Record counts from `describeIndexStats()` are approximate and may lag behind recent upserts by several seconds.

---

## List Vector IDs with Pagination

```typescript
const PAGE_SIZE = 100;
const NAMESPACE = "articles";

async function listAllVectorIds(
  index: ReturnType<Pinecone["index"]>,
): Promise<string[]> {
  const allIds: string[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await index.namespace(NAMESPACE).listPaginated({
      limit: PAGE_SIZE,
      paginationToken,
      prefix: "doc-", // Optional: filter by ID prefix
    });

    if (response.vectors) {
      allIds.push(...response.vectors.map((v) => v.id));
    }
    paginationToken = response.pagination?.next;
  } while (paginationToken);

  return allIds;
}

export { listAllVectorIds };
```

**Why good:** Handles pagination correctly, optional prefix filter, collects all IDs across pages

**Gotcha:** `listPaginated` returns only vector IDs, not values or metadata. Use `fetch` to get full vector data for specific IDs.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
