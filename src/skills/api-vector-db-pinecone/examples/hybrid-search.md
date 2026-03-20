# Pinecone -- Hybrid Search Examples

> Sparse-dense hybrid search combining semantic and keyword retrieval. See [core.md](core.md) for basic query patterns and [inference.md](inference.md) for embedding generation.

**Related examples:**

- [core.md](core.md) -- Basic vector operations
- [inference.md](inference.md) -- Sparse embedding generation with `pinecone-sparse-english-v0`

---

## Create a Hybrid Index

Hybrid search requires `dotproduct` metric -- the only metric that supports combined sparse+dense queries.

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

const DENSE_DIMENSION = 1536;
const HYBRID_INDEX_NAME = "hybrid-search";

async function createHybridIndex(pc: Pinecone): Promise<string> {
  const indexModel = await pc.createIndex({
    name: HYBRID_INDEX_NAME,
    dimension: DENSE_DIMENSION,
    metric: "dotproduct", // REQUIRED for hybrid search
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
    waitUntilReady: true,
  });

  return indexModel.host;
}

export { createHybridIndex };
```

**Why good:** Uses `dotproduct` metric (required for sparse-dense), `waitUntilReady` prevents premature operations

```typescript
// ❌ Bad Example -- wrong metric for hybrid
await pc.createIndex({
  name: "hybrid",
  dimension: 1536,
  metric: "cosine", // Does NOT support sparse-dense queries
  spec: { serverless: { cloud: "aws", region: "us-east-1" } },
});
```

**Why bad:** `cosine` and `euclidean` metrics do not support sparse vector queries; only `dotproduct` works for hybrid search

---

## Upsert with Sparse + Dense Vectors

Each record can have both `values` (dense) and `sparseValues` (sparse).

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const NAMESPACE = "documents";

interface SparseVector {
  indices: number[]; // uint32 positive integers
  values: number[]; // Non-zero floats
}

async function upsertHybridRecord(
  index: ReturnType<Pinecone["index"]>,
  id: string,
  denseEmbedding: number[],
  sparseEmbedding: SparseVector,
  metadata: Record<string, string | number>,
): Promise<void> {
  await index.namespace(NAMESPACE).upsert({
    records: [
      {
        id,
        values: denseEmbedding,
        sparseValues: sparseEmbedding,
        metadata,
      },
    ],
  });
}

export { upsertHybridRecord };
export type { SparseVector };
```

**Why good:** Both dense and sparse vectors on the same record, typed sparse vector interface, metadata included

**Gotcha:** Sparse vector `indices` must be positive 32-bit integers and `values` must be non-zero floats. Zero values are silently dropped.

---

## Hybrid Query with Alpha Weighting

Control the balance between semantic (dense) and keyword (sparse) relevance using alpha weighting.

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";
import type { SparseVector } from "./upsert-hybrid";

const TOP_K = 10;
const NAMESPACE = "documents";

function scaleVector(vector: number[], alpha: number): number[] {
  return vector.map((v) => v * alpha);
}

function scaleSparseVector(sparse: SparseVector, alpha: number): SparseVector {
  return {
    indices: sparse.indices,
    values: sparse.values.map((v) => v * alpha),
  };
}

async function hybridSearch(
  index: ReturnType<Pinecone["index"]>,
  denseQuery: number[],
  sparseQuery: SparseVector,
  alpha: number = 0.7, // 0 = pure keyword, 1 = pure semantic
): Promise<void> {
  const results = await index.namespace(NAMESPACE).query({
    vector: scaleVector(denseQuery, alpha),
    sparseVector: scaleSparseVector(sparseQuery, 1 - alpha),
    topK: TOP_K,
    includeMetadata: true,
  });

  for (const match of results.matches) {
    console.log(match.id, match.score, match.metadata);
  }
}

export { hybridSearch };
```

**Why good:** Alpha weighting controls semantic vs keyword balance, scaling applied before query, pure semantic (alpha=1) or pure keyword (alpha=0) modes available

**Note:** Alpha tuning is domain-specific. Start at 0.7 (70% semantic, 30% keyword) and adjust based on relevance evaluation.

---

## Generate Sparse Embeddings via Inference API

Use Pinecone's hosted sparse model for keyword-style embeddings.

```typescript
import { Pinecone } from "@pinecone-database/pinecone";
import type { SparseVector } from "./upsert-hybrid";

async function generateSparseEmbedding(
  pc: Pinecone,
  text: string,
  inputType: "passage" | "query",
): Promise<SparseVector> {
  const result = await pc.inference.embed({
    model: "pinecone-sparse-english-v0",
    inputs: [{ text }],
    parameters: { inputType, truncate: "END" },
  });

  const embedding = result.data[0];
  if (!embedding.sparseValues) {
    throw new Error("Sparse model did not return sparse values");
  }

  return {
    indices: embedding.sparseValues.indices,
    values: embedding.sparseValues.values,
  };
}

export { generateSparseEmbedding };
```

**Why good:** Uses `inputType` to distinguish passage indexing from query time, `truncate: "END"` handles long inputs

**Important:** Use `inputType: "passage"` when generating embeddings for upsert and `inputType: "query"` when generating embeddings for search. Using the wrong type degrades relevance.

---

## Limitations of Single Hybrid Index

```
Hybrid index (dotproduct metric):
  ✅ Combined sparse + dense queries
  ✅ Alpha weighting for relevance tuning
  ❌ Cannot do sparse-only queries
  ❌ Cannot use integrated embedding (createIndexForModel)
  ❌ Cannot use searchRecords or upsertRecords convenience methods

Separate dense index (cosine metric):
  ✅ Integrated inference (automatic embedding)
  ✅ searchRecords / upsertRecords
  ❌ No sparse vector support
  ❌ No hybrid queries
```

**When to choose hybrid:** You need combined semantic + keyword search and are willing to manage your own embedding pipeline.

**When to skip hybrid:** Pure semantic search is sufficient, and you want the simplest architecture with integrated inference.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
