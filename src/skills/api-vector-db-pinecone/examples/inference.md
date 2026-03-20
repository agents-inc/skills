# Pinecone -- Inference API Examples

> Embedding generation, reranking, and integrated inference indexes. See [core.md](core.md) for basic operations and [hybrid-search.md](hybrid-search.md) for sparse embeddings.

**Related examples:**

- [core.md](core.md) -- Client setup, upsert, query
- [hybrid-search.md](hybrid-search.md) -- Sparse embeddings for hybrid search
- [batch-operations.md](batch-operations.md) -- Batch embedding generation

---

## Generate Dense Embeddings

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

async function embedTexts(
  pc: Pinecone,
  texts: string[],
  inputType: "passage" | "query",
): Promise<number[][]> {
  const result = await pc.inference.embed({
    model: "multilingual-e5-large",
    inputs: texts.map((text) => ({ text })),
    parameters: {
      inputType, // "passage" for indexing, "query" for search
      truncate: "END", // Truncate if input exceeds model's context window
    },
  });

  return result.data.map((item) => {
    if (!item.values) {
      throw new Error("Embedding model did not return dense values");
    }
    return item.values;
  });
}

export { embedTexts };
```

**Why good:** `inputType` distinguishes indexing from querying (critical for asymmetric models), `truncate` handles long inputs gracefully, validates return values

**Important:** Always use `inputType: "passage"` when generating embeddings for documents being indexed, and `inputType: "query"` for search queries. Mixing these up degrades retrieval quality with asymmetric models.

---

## Rerank Query Results

Reranking improves relevance by scoring query-document pairs with a cross-encoder model, which is more accurate than vector similarity alone.

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const RERANK_TOP_N = 5;

interface RankedResult {
  id: string;
  text: string;
  relevanceScore: number;
}

async function rerankResults(
  pc: Pinecone,
  query: string,
  documents: Array<{ id: string; text: string }>,
): Promise<RankedResult[]> {
  const result = await pc.inference.rerank({
    model: "pinecone-rerank-v0",
    query,
    documents,
    topN: RERANK_TOP_N,
    returnDocuments: true,
    rankFields: ["text"],
  });

  return result.data.map((item) => ({
    id: item.document?.id ?? "",
    text: item.document?.text ?? "",
    relevanceScore: item.score,
  }));
}

export { rerankResults };
```

**Why good:** `topN` limits output, `returnDocuments: true` includes document content in response, `rankFields` specifies which fields to rank on, typed return value

**Pattern:** First query Pinecone for top-K candidates (e.g., 50), then rerank to get the most relevant top-N (e.g., 5). This two-stage approach balances recall and precision.

---

## Two-Stage Retrieval: Query + Rerank

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const INITIAL_TOP_K = 50; // Broad retrieval
const RERANK_TOP_N = 5; // Precise reranking

async function searchAndRerank(
  pc: Pinecone,
  index: ReturnType<Pinecone["index"]>,
  queryEmbedding: number[],
  queryText: string,
  namespace: string,
) {
  // Stage 1: Broad vector search
  const candidates = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK: INITIAL_TOP_K,
    includeMetadata: true,
  });

  if (candidates.matches.length === 0) {
    return [];
  }

  // Stage 2: Rerank with cross-encoder
  const documents = candidates.matches.map((m) => ({
    id: m.id,
    text: (m.metadata?.content as string) ?? "",
  }));

  const reranked = await pc.inference.rerank({
    model: "pinecone-rerank-v0",
    query: queryText,
    documents,
    topN: RERANK_TOP_N,
    returnDocuments: true,
    rankFields: ["text"],
  });

  return reranked.data.map((item) => ({
    id: item.document?.id ?? "",
    text: item.document?.text ?? "",
    score: item.score,
  }));
}

export { searchAndRerank };
```

**Why good:** Two-stage retrieval (broad recall then precise reranking), named constants for K and N, handles empty results

---

## Integrated Inference Index

Create an index that automatically generates embeddings on upsert and query -- no external embedding pipeline needed.

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME = "auto-embed";
const TEXT_FIELD = "chunk_text";

async function createIntegratedIndex(pc: Pinecone): Promise<string> {
  const indexModel = await pc.createIndexForModel({
    name: INDEX_NAME,
    cloud: "aws",
    region: "us-east-1",
    embed: {
      model: "multilingual-e5-large",
      fieldMap: { text: TEXT_FIELD }, // Which metadata field to embed
    },
  });

  return indexModel.host;
}

export { createIntegratedIndex };
```

**Why good:** Pinecone handles embedding automatically, `fieldMap` maps the text source field, no dimension/metric config needed (derived from model)

---

## Upsert and Search with Integrated Inference

With an integrated inference index, you upsert text records and search with text queries -- no vectors involved.

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const NAMESPACE = "articles";
const TOP_K = 10;

// Upsert raw text -- Pinecone generates embeddings automatically
async function upsertTextRecords(
  index: ReturnType<Pinecone["index"]>,
  records: Array<{ id: string; chunkText: string; category: string }>,
): Promise<void> {
  // upsertRecords takes a direct array, not { records: [...] }
  // _id is the canonical field; id also works as an alias
  await index.namespace(NAMESPACE).upsertRecords(
    records.map((r) => ({
      _id: r.id,
      chunk_text: r.chunkText, // Must match fieldMap.text from index creation
      category: r.category,
    })),
  );
}

// Search with text query -- Pinecone embeds the query automatically
async function searchByText(
  index: ReturnType<Pinecone["index"]>,
  queryText: string,
): Promise<void> {
  const results = await index.namespace(NAMESPACE).searchRecords({
    query: { topK: TOP_K, inputs: { text: queryText } },
  });

  for (const hit of results.result.hits) {
    console.log(hit._id, hit._score, hit.fields);
  }
}

export { upsertTextRecords, searchByText };
```

**Why good:** No vector generation code needed, `_id` identifies records (`id` also works as an alias), `upsertRecords` takes a direct array (not `{ records: [...] }`), search uses text input directly

**Gotcha:** Integrated inference indexes use different method names (`upsertRecords`/`searchRecords` instead of `upsert`/`query`), different record shapes (`_id` with metadata fields as top-level properties), and `upsertRecords` accepts a max of 96 records per call (not 1,000 like `upsert`).

---

## List Available Models

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

async function listEmbeddingModels(pc: Pinecone): Promise<void> {
  const models = await pc.inference.listModels({
    type: "embed", // Filter to embedding models only
  });

  for (const model of models.models ?? []) {
    console.log(
      `${model.model}: ${model.vectorType}, dim=${model.defaultDimension}`,
    );
  }
}

export { listEmbeddingModels };
```

**Why good:** Filtered by model type, shows key properties (vector type, dimension)

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
