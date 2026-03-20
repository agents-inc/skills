# Qdrant -- Named Vectors & Quantization Examples

> Multiple vectors per point and quantization configuration. See [core.md](core.md) for basic operations and [reference.md](../reference.md) for quantization method comparison.

**Related examples:**

- [core.md](core.md) -- Client setup, upsert, query, scroll, delete
- [filtering.md](filtering.md) -- Payload filtering conditions
- [recommendations-batch.md](recommendations-batch.md) -- Recommend API, batch operations

---

## Named Vectors -- Collection Setup

Store multiple embeddings per point (e.g., title + content embeddings from different models).

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TITLE_DIMENSION = 384; // e.g., all-MiniLM-L6-v2
const CONTENT_DIMENSION = 1536; // e.g., text-embedding-3-small

async function createMultiVectorCollection(
  client: QdrantClient,
): Promise<void> {
  await client.createCollection("articles", {
    vectors: {
      title: { size: TITLE_DIMENSION, distance: "Cosine" },
      content: { size: CONTENT_DIMENSION, distance: "Cosine" },
    },
  });
}

export { createMultiVectorCollection, TITLE_DIMENSION, CONTENT_DIMENSION };
```

**Why good:** Named constants for dimensions, different models can have different dimensions, each named vector has its own distance metric

---

## Named Vectors -- Upsert

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

interface ArticleVectors {
  title: number[];
  content: number[];
}

async function upsertArticleWithVectors(
  client: QdrantClient,
  id: string,
  vectors: ArticleVectors,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.upsert("articles", {
    wait: true,
    points: [
      {
        id,
        vector: vectors, // Object with named vector keys
        payload,
      },
    ],
  });
}

export { upsertArticleWithVectors };
```

**Why good:** Typed vector interface enforces both vectors are provided, vector is an object keyed by name (not an array)

---

## Named Vectors -- Search by Specific Vector

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

// Search by title similarity
async function searchByTitle(
  client: QdrantClient,
  titleEmbedding: number[],
): Promise<void> {
  const results = await client.query("articles", {
    query: titleEmbedding,
    using: "title", // Specify which named vector to search
    with_payload: true,
    limit: TOP_K,
  });

  for (const point of results.points) {
    console.log(point.id, point.score, point.payload);
  }
}

// Search by content similarity
async function searchByContent(
  client: QdrantClient,
  contentEmbedding: number[],
): Promise<void> {
  const results = await client.query("articles", {
    query: contentEmbedding,
    using: "content",
    with_payload: true,
    limit: TOP_K,
  });

  for (const point of results.points) {
    console.log(point.id, point.score, point.payload);
  }
}

export { searchByTitle, searchByContent };
```

**Why good:** `using` specifies which named vector to compare against, avoids searching the wrong vector space

**Gotcha:** If you omit `using`, Qdrant searches the default (unnamed) vector. If the collection only has named vectors (no default), the query will fail.

---

## Scalar Quantization

4x memory compression by converting float32 to int8. Best default choice for most workloads.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const EMBEDDING_DIMENSION = 1536;
const SCALAR_QUANTILE = 0.99; // Exclude top 1% outliers for better range mapping

async function createScalarQuantizedCollection(
  client: QdrantClient,
): Promise<void> {
  await client.createCollection("documents-sq", {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: "Cosine",
    },
    quantization_config: {
      scalar: {
        type: "int8",
        quantile: SCALAR_QUANTILE,
        always_ram: true, // Keep quantized vectors in RAM for speed
      },
    },
  });
}

export { createScalarQuantizedCollection };
```

**Why good:** Named constants, `quantile: 0.99` excludes outliers for better compression, `always_ram: true` keeps quantized data in memory

**Tradeoff:** ~4x memory savings with minimal accuracy loss (< 1% for most embedding models). Recommended as the default quantization method.

---

## Binary Quantization

32x memory compression by converting each float dimension to a single bit. Best for high-dimensional vectors (>= 1024 dims).

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const EMBEDDING_DIMENSION = 1536;

async function createBinaryQuantizedCollection(
  client: QdrantClient,
): Promise<void> {
  await client.createCollection("documents-bq", {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: "Cosine",
    },
    quantization_config: {
      binary: {
        always_ram: true,
      },
    },
  });
}

export { createBinaryQuantizedCollection };
```

**Why good:** Maximum speed (CPU XNOR + popcount operations), 32x compression, suitable for high-dimensional embeddings

**Tradeoff:** Higher accuracy loss than scalar, especially for low-dimensional vectors (< 1024 dims). Use `rescore: true` in search params to improve accuracy by re-scoring top candidates with original vectors.

---

## Product Quantization

Up to 64x compression. Slowest quantization method but maximizes memory savings.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const EMBEDDING_DIMENSION = 1536;

async function createProductQuantizedCollection(
  client: QdrantClient,
): Promise<void> {
  await client.createCollection("documents-pq", {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: "Cosine",
    },
    quantization_config: {
      product: {
        compression: "x16", // x4, x8, x16, x32, x64
        always_ram: true,
      },
    },
  });
}

export { createProductQuantizedCollection };
```

**Why good:** Configurable compression ratio, `always_ram: true` for speed

**Tradeoff:** Significant accuracy loss and slower search compared to scalar/binary. Use only when memory is the primary constraint and accuracy is secondary.

---

## Quantization with Search Params (Rescore)

Enable rescoring to improve accuracy for quantized collections.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;
const OVERSAMPLING = 2.0; // Retrieve 2x candidates for rescoring

const results = await client.query("documents-bq", {
  query: embedding,
  params: {
    quantization: {
      rescore: true, // Re-score top candidates with original float32 vectors
      oversampling: OVERSAMPLING, // Retrieve more candidates before rescoring
    },
  },
  with_payload: true,
  limit: TOP_K,
});
```

**Why good:** `rescore: true` re-evaluates top candidates using full-precision vectors, `oversampling` retrieves extra candidates to improve recall after rescoring

**When to use:** Always enable rescoring for binary quantization. Optional but recommended for product quantization. Usually unnecessary for scalar quantization.

---

## Per-Vector Quantization (Named Vectors)

Apply different quantization to different named vectors within the same collection.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TITLE_DIMENSION = 384;
const CONTENT_DIMENSION = 1536;

await client.createCollection("articles-optimized", {
  vectors: {
    title: {
      size: TITLE_DIMENSION,
      distance: "Cosine",
      quantization_config: {
        scalar: { type: "int8", always_ram: true },
      },
    },
    content: {
      size: CONTENT_DIMENSION,
      distance: "Cosine",
      quantization_config: {
        binary: { always_ram: true },
      },
    },
  },
});
```

**Why good:** Scalar quantization for low-dim title vectors (better accuracy), binary quantization for high-dim content vectors (better compression), per-vector optimization

---

## Add Quantization to Existing Collection

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const SCALAR_QUANTILE = 0.99;

async function enableQuantization(
  client: QdrantClient,
  collectionName: string,
): Promise<void> {
  await client.updateCollection(collectionName, {
    quantization_config: {
      scalar: {
        type: "int8",
        quantile: SCALAR_QUANTILE,
        always_ram: true,
      },
    },
  });
}

export { enableQuantization };
```

**Why good:** Quantization can be added retroactively via `updateCollection`, no re-ingestion needed

**Gotcha:** Adding quantization to a large existing collection triggers a background rebuild of quantized vectors. Collection remains available during rebuild, but CPU usage increases temporarily.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
