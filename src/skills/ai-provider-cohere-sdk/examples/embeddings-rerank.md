# Cohere SDK -- Embeddings & Rerank Examples

> Embedding generation, input type pairing, cosine similarity, rerank scoring, and semantic search pipeline. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming, error handling
- [tools-rag.md](tools-rag.md) -- Tool use, RAG with documents, citation handling

---

## Basic Embedding Generation

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });
const EMBEDDING_MODEL = "embed-v4.0";

// Embed documents for storage in a vector database
const response = await client.embed({
  model: EMBEDDING_MODEL,
  inputType: "search_document",
  texts: [
    "TypeScript is a typed superset of JavaScript.",
    "React is a library for building user interfaces.",
    "Node.js is a JavaScript runtime.",
  ],
  embeddingTypes: ["float"],
});

// response.embeddings.float is number[][] -- one vector per input text
const vectors = response.embeddings.float;
console.log(
  `Generated ${vectors.length} vectors of dimension ${vectors[0].length}`,
);
```

---

## Correct Input Type Pairing

The most critical gotcha with Cohere embeddings: `inputType` must match between indexing and querying.

```typescript
const EMBEDDING_MODEL = "embed-v4.0";

// INDEXING: Use "search_document" for documents going into your vector store
const docEmbeddings = await client.embed({
  model: EMBEDDING_MODEL,
  inputType: "search_document", // Documents being indexed
  texts: documents,
  embeddingTypes: ["float"],
});

// QUERYING: Use "search_query" for the user's search query
const queryEmbedding = await client.embed({
  model: EMBEDDING_MODEL,
  inputType: "search_query", // Query being searched
  texts: [userQuery],
  embeddingTypes: ["float"],
});
```

```typescript
// BAD: Using the same inputType for both
const docs = await client.embed({
  model: EMBEDDING_MODEL,
  inputType: "search_query", // WRONG: documents should use "search_document"
  texts: documents,
  embeddingTypes: ["float"],
});
```

**Why bad:** Cohere trains separate embedding spaces for documents vs queries. Using the wrong type silently produces vectors that don't align well, resulting in degraded search quality. There is no error -- results just get worse.

---

## Cosine Similarity Search

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Rank documents by similarity to query
const queryVector = queryEmbedding.embeddings.float[0];
const scored = docVectors.map((vec, index) => ({
  index,
  score: cosineSimilarity(queryVector, vec),
}));

scored.sort((a, b) => b.score - a.score);
console.log("Most similar:", scored[0]);
```

---

## Reduced Dimensions with embed-v4

`embed-v4.0` supports `outputDimension` for faster similarity search at minimal quality loss.

```typescript
const REDUCED_DIMENSION = 512;

const response = await client.embed({
  model: "embed-v4.0",
  inputType: "search_document",
  texts: documents,
  embeddingTypes: ["float"],
  outputDimension: REDUCED_DIMENSION, // 256 | 512 | 1024 | 1536
});

// Vectors are now 512-dimensional instead of default 1536
console.log(`Dimension: ${response.embeddings.float[0].length}`);
```

---

## Compressed Embedding Types

Use `int8` or `binary` for storage-efficient embeddings with minimal quality loss.

```typescript
const response = await client.embed({
  model: "embed-v4.0",
  inputType: "search_document",
  texts: documents,
  embeddingTypes: ["float", "int8"],
});

// Access both formats
const floatVectors = response.embeddings.float; // Full precision
const int8Vectors = response.embeddings.int8; // 4x compressed
```

---

## Batch Embedding (96 texts per call)

```typescript
const BATCH_SIZE = 96; // Cohere max per embed() call

async function embedAllDocuments(
  texts: string[],
  model: string,
): Promise<number[][]> {
  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embed({
      model,
      inputType: "search_document",
      texts: batch,
      embeddingTypes: ["float"],
    });
    allVectors.push(...response.embeddings.float);
  }

  return allVectors;
}
```

---

## Basic Rerank

Score and reorder documents by relevance to a query.

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });
const RERANK_MODEL = "rerank-v4.0-pro";
const TOP_N = 5;

const result = await client.rerank({
  model: RERANK_MODEL,
  query: "What is TypeScript?",
  documents: [
    "TypeScript is a typed superset of JavaScript developed by Microsoft.",
    "Python is a general-purpose programming language.",
    "TypeScript adds static typing to JavaScript.",
    "Java is a class-based, object-oriented language.",
    "TypeScript compiles to plain JavaScript.",
  ],
  topN: TOP_N,
});

for (const item of result.results) {
  console.log(`Doc[${item.index}] score: ${item.relevanceScore.toFixed(4)}`);
}
```

---

## Embed + Rerank Pipeline

Two-stage retrieval: embed for initial recall, rerank for precision.

```typescript
const EMBEDDING_MODEL = "embed-v4.0";
const RERANK_MODEL = "rerank-v4.0-pro";
const INITIAL_TOP_K = 20;
const FINAL_TOP_N = 5;

// Stage 1: Embed query and retrieve initial candidates via vector search
const queryEmbedding = await client.embed({
  model: EMBEDDING_MODEL,
  inputType: "search_query",
  texts: [userQuery],
  embeddingTypes: ["float"],
});

// ... perform vector search to get INITIAL_TOP_K candidates ...
const candidates: string[] = vectorSearchResults;

// Stage 2: Rerank candidates for precision
const reranked = await client.rerank({
  model: RERANK_MODEL,
  query: userQuery,
  documents: candidates,
  topN: FINAL_TOP_N,
});

// Top results by relevance
const topDocuments = reranked.results.map((r) => ({
  text: candidates[r.index],
  score: r.relevanceScore,
}));
```

---

## Classification Embeddings

Use `inputType: "classification"` for text classifier inputs.

```typescript
const response = await client.embed({
  model: "embed-v4.0",
  inputType: "classification",
  texts: ["This product is amazing!", "Terrible experience."],
  embeddingTypes: ["float"],
});

// Use these vectors as features for your classifier
const featureVectors = response.embeddings.float;
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
