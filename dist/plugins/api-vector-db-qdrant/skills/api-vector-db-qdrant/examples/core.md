# Qdrant -- Core Pattern Examples

> Client setup, collection management, and fundamental point operations (upsert, query, scroll, retrieve, delete, count). Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [filtering.md](filtering.md) -- must/should/must_not conditions, match/range operators
- [named-vectors-quantization.md](named-vectors-quantization.md) -- Multiple vectors per point, quantization
- [recommendations-batch.md](recommendations-batch.md) -- Recommend API, batch operations, snapshots

---

## Client Initialization

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

function createQdrantClient(): QdrantClient {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url) {
    throw new Error("QDRANT_URL environment variable is required");
  }
  // apiKey is optional for local instances
  return new QdrantClient({ url, apiKey });
}

export { createQdrantClient };
```

**Why good:** URL from environment variable (never hardcoded), optional API key for local vs cloud, explicit validation, named export

For local development without authentication:

```typescript
const client = new QdrantClient({ url: "http://localhost:6333" });
```

For Qdrant Cloud:

```typescript
const client = new QdrantClient({
  url: "https://your-cluster.cloud.qdrant.io",
  apiKey: process.env.QDRANT_API_KEY,
});
```

**Note:** You can also use `host` + `port` instead of `url`, but `url` is preferred because it includes the protocol and avoids ambiguity with HTTPS.

---

## Create a Collection

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const EMBEDDING_DIMENSION = 1536; // Must match your embedding model
const COLLECTION_NAME = "documents";

async function createDocumentsCollection(client: QdrantClient): Promise<void> {
  const exists = await client.collectionExists(COLLECTION_NAME);
  if (exists.exists) {
    return; // Collection already exists
  }

  await client.createCollection(COLLECTION_NAME, {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: "Cosine",
    },
  });
}

export { createDocumentsCollection, COLLECTION_NAME, EMBEDDING_DIMENSION };
```

**Why good:** Named constants for dimension and collection name, idempotent (checks existence first), explicit distance metric

```typescript
// Bad Example -- missing existence check, hardcoded values
await client.createCollection("docs", {
  vectors: { size: 768, distance: "Cosine" },
});
// Throws if collection already exists; dimension may not match model
```

**Why bad:** No existence check causes errors on re-run, hardcoded dimension risks mismatch

---

## Create Collection with HNSW Tuning

```typescript
const EMBEDDING_DIMENSION = 1536;
const HNSW_M = 16; // Connections per node (higher = better recall, more memory)
const HNSW_EF_CONSTRUCT = 200; // Build-time search width (higher = better index, slower build)

await client.createCollection("high-recall-docs", {
  vectors: {
    size: EMBEDDING_DIMENSION,
    distance: "Cosine",
  },
  hnsw_config: {
    m: HNSW_M,
    ef_construct: HNSW_EF_CONSTRUCT,
  },
});
```

**Why good:** Named constants for HNSW parameters, explicit tuning for recall-critical workloads

**Gotcha:** Higher `m` and `ef_construct` values improve recall but increase memory usage and index build time. The defaults (`m: 16`, `ef_construct: 100`) work well for most use cases.

---

## Upsert Points with Typed Payload

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

interface ArticlePayload {
  title: string;
  category: string;
  publishedAt: number; // Unix timestamp
  tags: string[];
}

async function upsertArticle(
  client: QdrantClient,
  id: string,
  embedding: number[],
  payload: ArticlePayload,
): Promise<void> {
  await client.upsert("articles", {
    wait: true,
    points: [{ id, vector: embedding, payload }],
  });
}

export { upsertArticle };
export type { ArticlePayload };
```

**Why good:** Type-safe payload interface, `wait: true` for read-after-write consistency, string ID (UUID-format), named export

```typescript
// Bad Example -- no wait, numeric ID issues
await client.upsert("articles", {
  points: [
    {
      id: 0, // INVALID: point IDs must be positive integers or UUID strings
      vector: embedding,
      payload: { title: "Guide" },
    },
  ],
});
// No wait: true -- data may not be queryable immediately
```

**Why bad:** `id: 0` is invalid (must be positive integer or UUID string), missing `wait: true` means subsequent queries may miss this point

---

## Query by Vector Similarity

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;
const COLLECTION_NAME = "articles";

interface SearchResult {
  id: string | number;
  score: number;
  payload: Record<string, unknown> | null;
}

async function searchArticles(
  client: QdrantClient,
  queryEmbedding: number[],
  category?: string,
): Promise<SearchResult[]> {
  const filter = category
    ? { must: [{ key: "category", match: { value: category } }] }
    : undefined;

  const response = await client.query(COLLECTION_NAME, {
    query: queryEmbedding,
    filter,
    with_payload: true,
    limit: TOP_K,
  });

  return response.points.map((point) => ({
    id: point.id,
    score: point.score ?? 0,
    payload: point.payload ?? null,
  }));
}

export { searchArticles };
```

**Why good:** Uses `query()` (universal endpoint), optional filter, `with_payload: true`, named constants, typed response

---

## Retrieve Points by ID

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

async function getArticles(
  client: QdrantClient,
  ids: (string | number)[],
): Promise<void> {
  const records = await client.retrieve("articles", {
    ids,
    with_payload: true,
    with_vector: false, // Skip vectors to reduce response size
  });

  for (const record of records) {
    console.log(record.id, record.payload);
  }
}

export { getArticles };
```

**Why good:** Retrieves by ID without vector search, `with_vector: false` reduces response size, explicit payload inclusion

**Gotcha:** Unlike Pinecone's `fetch()` which returns an object keyed by ID, Qdrant's `retrieve()` returns an array. Missing IDs are silently omitted (no error thrown).

---

## Scroll Through All Points

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const PAGE_SIZE = 100;

async function scrollAllPoints(
  client: QdrantClient,
  collectionName: string,
): Promise<
  Array<{ id: string | number; payload: Record<string, unknown> | null }>
> {
  const allPoints: Array<{
    id: string | number;
    payload: Record<string, unknown> | null;
  }> = [];
  let offset: string | number | undefined;

  do {
    const response = await client.scroll(collectionName, {
      limit: PAGE_SIZE,
      offset,
      with_payload: true,
      with_vector: false,
    });

    for (const point of response.points) {
      allPoints.push({ id: point.id, payload: point.payload ?? null });
    }

    offset = response.next_page_offset ?? undefined;
  } while (offset !== undefined);

  return allPoints;
}

export { scrollAllPoints };
```

**Why good:** Cursor-based pagination using `next_page_offset`, skips vectors for efficiency, named constant for page size

**Gotcha:** `scroll()` returns `next_page_offset` as the cursor for the next page. This is NOT a numeric page offset -- it is a point ID. Pass it directly as `offset` for the next request.

---

## Delete Points

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

// Delete by IDs
async function deleteByIds(
  client: QdrantClient,
  collectionName: string,
  ids: (string | number)[],
): Promise<void> {
  await client.delete(collectionName, {
    wait: true,
    points: ids,
  });
}

// Delete by filter
async function deleteByCategory(
  client: QdrantClient,
  collectionName: string,
  category: string,
): Promise<void> {
  await client.delete(collectionName, {
    wait: true,
    filter: {
      must: [{ key: "category", match: { value: category } }],
    },
  });
}

export { deleteByIds, deleteByCategory };
```

**Why good:** Two deletion patterns (by ID, by filter), `wait: true` for consistency, Qdrant filter syntax

---

## Count Points

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

async function countByCategory(
  client: QdrantClient,
  collectionName: string,
  category: string,
): Promise<number> {
  const result = await client.count(collectionName, {
    filter: {
      must: [{ key: "category", match: { value: category } }],
    },
    exact: true, // Exact count (slower) vs approximate (faster, default)
  });

  return result.count;
}

export { countByCategory };
```

**Why good:** Filtered count, explicit `exact: true` when precision matters

**Gotcha:** `exact: true` performs a full scan and is slow on large collections. Use `exact: false` (default) for approximate counts in dashboards or monitoring.

---

## Payload Operations (Set, Overwrite, Delete, Clear)

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

// Merge new fields into existing payload (preserves other fields)
async function addPayloadFields(
  client: QdrantClient,
  collectionName: string,
  pointIds: (string | number)[],
  fields: Record<string, unknown>,
): Promise<void> {
  await client.setPayload(collectionName, {
    payload: fields,
    points: pointIds,
    wait: true,
  });
}

// Replace entire payload (removes all existing fields)
async function replacePayload(
  client: QdrantClient,
  collectionName: string,
  pointIds: (string | number)[],
  payload: Record<string, unknown>,
): Promise<void> {
  await client.overwritePayload(collectionName, {
    payload,
    points: pointIds,
    wait: true,
  });
}

// Remove specific payload keys
async function removePayloadKeys(
  client: QdrantClient,
  collectionName: string,
  pointIds: (string | number)[],
  keys: string[],
): Promise<void> {
  await client.deletePayload(collectionName, {
    keys,
    points: pointIds,
    wait: true,
  });
}

export { addPayloadFields, replacePayload, removePayloadKeys };
```

**Why good:** Three distinct operations for payload management, `wait: true` for consistency

**Critical distinction:** `setPayload` MERGES fields (like `Object.assign`), while `overwritePayload` REPLACES the entire payload. Use `setPayload` to add a field without losing existing data.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
