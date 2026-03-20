# Elasticsearch -- Vector Search Examples

> Dense vector fields, kNN queries, hybrid text+vector search, and similarity metrics. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and index management from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, index management, search basics
- [aggregations.md](aggregations.md) -- Combining aggregations with vector search

---

## Dense Vector Mapping

Configure a `dense_vector` field for kNN search.

```typescript
import type { Client } from "@elastic/elasticsearch";

const INDEX_NAME = "articles";
const EMBEDDING_DIMS = 768; // Must match your embedding model's output dimension

async function createVectorIndex(client: Client): Promise<void> {
  await client.indices.create({
    index: INDEX_NAME,
    mappings: {
      properties: {
        title: {
          type: "text",
          fields: { keyword: { type: "keyword" } },
        },
        content: { type: "text" },
        embedding: {
          type: "dense_vector",
          dims: EMBEDDING_DIMS,
          index: true, // Required for kNN search (default: true in 8.11+)
          similarity: "cosine", // cosine | l2_norm | dot_product | max_inner_product
        },
        category: { type: "keyword" },
        publishedAt: { type: "date" },
      },
    },
  });
}

export { createVectorIndex };
```

**Why good:** `dims` matches the embedding model's output dimension exactly (768 for most BERT-based models), `similarity: "cosine"` is the most common metric, `index: true` enables approximate kNN search

**Gotcha:** If `dims` does not match the actual vector length when indexing documents, Elasticsearch rejects the document with a `mapper_parsing_exception`. There is no auto-truncation or padding.

---

## Indexing Documents with Vectors

```typescript
interface Article {
  title: string;
  content: string;
  embedding: number[];
  category: string;
  publishedAt: string;
}

async function indexArticleWithVector(
  client: Client,
  article: Article,
  id: string,
): Promise<void> {
  await client.index({
    index: INDEX_NAME,
    id,
    document: article,
  });
}

export { indexArticleWithVector };
```

**Important:** The `embedding` array MUST have exactly `EMBEDDING_DIMS` elements. Generate embeddings using your embedding model before indexing -- Elasticsearch does not generate embeddings for you (unless you configure an ingest pipeline with a deployed model).

---

## Basic kNN Search

Find documents with vectors most similar to a query vector.

```typescript
const KNN_CANDIDATES = 100;
const KNN_RESULTS = 10;

async function vectorSearch(
  client: Client,
  queryVector: number[],
): Promise<Array<{ id: string; title: string; score: number }>> {
  const result = await client.search<Article>({
    index: INDEX_NAME,
    knn: {
      field: "embedding",
      query_vector: queryVector,
      k: KNN_RESULTS,
      num_candidates: KNN_CANDIDATES,
    },
  });

  return result.hits.hits
    .filter((hit) => hit._source !== undefined)
    .map((hit) => ({
      id: hit._id,
      title: hit._source!.title,
      score: hit._score ?? 0,
    }));
}

export { vectorSearch };
```

**Why good:** `num_candidates` controls the accuracy/speed tradeoff (higher = more accurate but slower), `k` is the number of results to return, named constants for both

**Key concept:** `num_candidates` determines how many candidates each shard considers before the final `k` results are selected. A ratio of `num_candidates / k >= 10` is a good starting point.

---

## kNN with Filters

Apply filters during the kNN search to restrict the vector space.

```typescript
async function filteredVectorSearch(
  client: Client,
  queryVector: number[],
  category: string,
): Promise<Array<{ id: string; title: string; score: number }>> {
  const result = await client.search<Article>({
    index: INDEX_NAME,
    knn: {
      field: "embedding",
      query_vector: queryVector,
      k: KNN_RESULTS,
      num_candidates: KNN_CANDIDATES,
      filter: {
        term: { category },
      },
    },
  });

  return result.hits.hits
    .filter((hit) => hit._source !== undefined)
    .map((hit) => ({
      id: hit._id,
      title: hit._source!.title,
      score: hit._score ?? 0,
    }));
}

export { filteredVectorSearch };
```

**Why good:** Filter is applied DURING the kNN search, not after -- this ensures exactly `k` results from the filtered subset, not fewer

**Gotcha:** Without the `filter` inside `knn`, you would need to use a top-level `query` filter which is applied AFTER kNN. Post-filtering can return fewer than `k` results because some of the `k` nearest neighbors may not match the filter.

---

## Hybrid Search (Text + Vector)

Combine traditional full-text search with vector similarity.

```typescript
const TEXT_BOOST = 0.7;
const VECTOR_BOOST = 0.3;

async function hybridSearch(
  client: Client,
  queryText: string,
  queryVector: number[],
): Promise<Array<{ id: string; title: string; score: number }>> {
  const result = await client.search<Article>({
    index: INDEX_NAME,
    query: {
      match: {
        content: {
          query: queryText,
          boost: TEXT_BOOST,
        },
      },
    },
    knn: {
      field: "embedding",
      query_vector: queryVector,
      k: KNN_RESULTS,
      num_candidates: KNN_CANDIDATES,
      boost: VECTOR_BOOST,
    },
    size: KNN_RESULTS,
  });

  return result.hits.hits
    .filter((hit) => hit._source !== undefined)
    .map((hit) => ({
      id: hit._id,
      title: hit._source!.title,
      score: hit._score ?? 0,
    }));
}

export { hybridSearch };
```

**Why good:** Named constants for boost values, text and vector scores are combined with weighted boosts, `size` limits total results from both sources

**How scoring works:** The final `_score` = `TEXT_BOOST * text_score + VECTOR_BOOST * knn_score`. Adjust boosts to control the balance between keyword relevance and semantic similarity.

**Gotcha:** Results are combined via disjunction (OR) -- a document can appear from text match only, vector match only, or both. Documents matching both get a combined score.

---

## Semantic Search with Model Inference

Let Elasticsearch generate the query vector using a deployed model.

```typescript
const MODEL_ID = "my-text-embedding-model";

async function semanticSearch(
  client: Client,
  queryText: string,
): Promise<Array<{ id: string; title: string; score: number }>> {
  const result = await client.search<Article>({
    index: INDEX_NAME,
    knn: {
      field: "embedding",
      k: KNN_RESULTS,
      num_candidates: KNN_CANDIDATES,
      query_vector_builder: {
        text_embedding: {
          model_id: MODEL_ID,
          model_text: queryText,
        },
      },
    },
  });

  return result.hits.hits
    .filter((hit) => hit._source !== undefined)
    .map((hit) => ({
      id: hit._id,
      title: hit._source!.title,
      score: hit._score ?? 0,
    }));
}

export { semanticSearch };
```

**Why good:** `query_vector_builder` generates the vector server-side using a deployed ML model -- no need to call the embedding API separately in your application code

**When to use:** When you have a model deployed in Elasticsearch (via Eland or the trained models API). When embedding is done externally (e.g., OpenAI API), pass `query_vector` directly instead.

---

## Similarity Metrics

| Metric              | Use Case                                | Score Interpretation                        |
| ------------------- | --------------------------------------- | ------------------------------------------- |
| `cosine`            | General purpose, normalized embeddings  | -1 to 1 (mapped to 0-1 for `_score`)        |
| `dot_product`       | Optimized for unit-length vectors       | Unbounded (requires pre-normalized vectors) |
| `l2_norm`           | When absolute distance matters          | 0 = identical, higher = more different      |
| `max_inner_product` | When negative inner products are needed | Unbounded                                   |

**Recommendation:** Use `cosine` for most embedding models (sentence-transformers, OpenAI, Cohere). Use `dot_product` only if you know your vectors are pre-normalized to unit length.

**Gotcha:** `dot_product` on non-normalized vectors gives meaningless scores. Always normalize vectors before indexing if using `dot_product`.

---

## Quantization for Memory Efficiency

Dense vectors can be quantized to reduce memory usage.

```typescript
async function createQuantizedVectorIndex(client: Client): Promise<void> {
  await client.indices.create({
    index: "articles-quantized",
    mappings: {
      properties: {
        embedding: {
          type: "dense_vector",
          dims: EMBEDDING_DIMS,
          similarity: "cosine",
          index: true,
          index_options: {
            type: "int8_hnsw", // 4x less memory than float32
          },
        },
      },
    },
  });
}

export { createQuantizedVectorIndex };
```

**Why good:** `int8_hnsw` quantizes float32 vectors to int8, using ~4x less memory with minimal accuracy loss

**Available quantization types:**

- `hnsw` -- Full float32 precision (default)
- `int8_hnsw` -- 8-bit quantization (~4x memory reduction)
- `int4_hnsw` -- 4-bit quantization (~8x memory reduction, more accuracy loss)
- `bbq_hnsw` -- Better binary quantization (auto-selected for dims >= 384 in 8.15+)

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
