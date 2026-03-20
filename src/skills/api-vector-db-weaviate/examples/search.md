# Weaviate -- Search & Filtering Examples

> Search types, filtering, and generative search (RAG). See [core.md](core.md) for connection and collection setup.

**Related examples:**

- [core.md](core.md) -- Connection, collection setup, object CRUD
- [multi-tenancy.md](multi-tenancy.md) -- Tenant management, batch imports, cross-references

---

## Pattern 1: nearText (Semantic Search)

Search by natural language query. Requires a vectorizer module configured on the collection.

```typescript
const articles = client.collections.use("Article");
const SEARCH_LIMIT = 10;
const MAX_DISTANCE = 0.3;

// Basic nearText
const result = await articles.query.nearText("climate change policy", {
  limit: SEARCH_LIMIT,
  returnMetadata: ["distance"],
});

for (const obj of result.objects) {
  console.log(obj.properties.title, "distance:", obj.metadata?.distance);
}
```

**Why good:** `returnMetadata: ['distance']` enables relevance debugging, named constant for limit

### With Distance Threshold

```typescript
// Only return results within distance threshold
const result = await articles.query.nearText("renewable energy", {
  distance: MAX_DISTANCE,
  returnMetadata: ["distance"],
});
```

**When to use:** When you want to ensure a minimum relevance level rather than a fixed count.

### With Named Vector Target

```typescript
const products = client.collections.use("Product");

const result = await products.query.nearText("comfortable running shoes", {
  limit: SEARCH_LIMIT,
  targetVector: "description_vector", // Explicitly target the description embedding
  returnMetadata: ["distance"],
});
```

**When to use:** Collections with named vectors -- always specify `targetVector` to avoid defaulting to the first vector.

---

## Pattern 2: nearVector (Vector Search)

Search with a pre-computed embedding vector. No vectorizer module needed.

```typescript
const articles = client.collections.use("Article");
const SEARCH_LIMIT = 5;

// Use your own embedding
const queryVector = await myEmbeddingModel.encode("search query");

const result = await articles.query.nearVector(queryVector, {
  limit: SEARCH_LIMIT,
  returnMetadata: ["distance"],
});

for (const obj of result.objects) {
  console.log(obj.properties.title, obj.metadata?.distance);
}
```

**When to use:** When you compute embeddings externally (e.g., using your own embedding service or a model Weaviate doesn't support).

---

## Pattern 3: BM25 (Keyword Search)

Traditional keyword search based on term frequency. No vector component.

```typescript
const articles = client.collections.use("Article");
const SEARCH_LIMIT = 10;

// Basic BM25
const result = await articles.query.bm25("vector database comparison", {
  limit: SEARCH_LIMIT,
  returnMetadata: ["score"],
});

for (const obj of result.objects) {
  console.log(obj.properties.title, "score:", obj.metadata?.score);
}
```

### BM25 with Property Targeting and Boosting

```typescript
// Search specific properties with weight boosting
const result = await articles.query.bm25("machine learning", {
  limit: SEARCH_LIMIT,
  queryProperties: ["title^3", "body"], // title weighted 3x
  returnMetadata: ["score"],
});
```

**Why good:** Property boosting (`title^3`) prioritizes matches in important fields

---

## Pattern 4: Hybrid Search

Combines vector search and keyword search with configurable weighting.

```typescript
import { Filters } from "weaviate-client";

const articles = client.collections.use("Article");
const SEARCH_LIMIT = 10;
const HYBRID_ALPHA = 0.75; // 0.0 = pure keyword, 1.0 = pure vector

const result = await articles.query.hybrid("neural network architecture", {
  alpha: HYBRID_ALPHA,
  limit: SEARCH_LIMIT,
  returnMetadata: ["score", "explainScore"],
});

for (const obj of result.objects) {
  console.log(obj.properties.title);
  console.log("Score:", obj.metadata?.score);
  console.log("Explanation:", obj.metadata?.explainScore);
}
```

**Why good:** `explainScore` shows the vector and keyword contributions, helping tune alpha

### Hybrid with Fusion Type

```typescript
// RelativeScore uses actual similarity scores (default since v1.24)
const result = await articles.query.hybrid("search query", {
  fusionType: "RelativeScore", // or "Ranked"
  alpha: HYBRID_ALPHA,
  limit: SEARCH_LIMIT,
});
```

**When to use:** `RelativeScore` (default) for most cases. `Ranked` when you want rank-based fusion regardless of actual similarity distances.

### Hybrid with Keyword Operator Control

```typescript
import { Bm25Operator } from "weaviate-client";

// Require at least 2 of 3 query tokens to match
const result = await articles.query.hybrid("Australian mammal cute", {
  bm25Operator: Bm25Operator.or({ minimumMatch: 2 }),
  alpha: HYBRID_ALPHA,
  limit: SEARCH_LIMIT,
});

// Require ALL query tokens to match
const strictResult = await articles.query.hybrid("neural network training", {
  bm25Operator: Bm25Operator.and(),
  alpha: HYBRID_ALPHA,
  limit: SEARCH_LIMIT,
});
```

---

## Pattern 5: Filtering

Filters work with all search methods. They narrow results AFTER vector/keyword retrieval.

### Single Filter

```typescript
const articles = client.collections.use("Article");

const result = await articles.query.nearText("technology trends", {
  limit: SEARCH_LIMIT,
  filters: articles.filter.byProperty("category").equal("technology"),
  returnMetadata: ["distance"],
});
```

### Combined Filters

```typescript
import { Filters } from "weaviate-client";

const result = await articles.query.hybrid("AI research", {
  alpha: HYBRID_ALPHA,
  limit: SEARCH_LIMIT,
  filters: Filters.and(
    articles.filter.byProperty("category").equal("technology"),
    articles.filter.byProperty("wordCount").greaterThan(500),
    Filters.not(articles.filter.byProperty("author").equal("Bot")),
  ),
});
```

**Why good:** Flat argument list to `Filters.and()`, not nested arrays

```typescript
// Bad Example -- Array argument to Filters.and
const result = await articles.query.hybrid("search", {
  filters: Filters.and([filterA, filterB]), // WRONG: expects flat args, not array
});
```

**Why bad:** `Filters.and()` takes variadic arguments, not an array -- `Filters.and(a, b, c)` not `Filters.and([a, b, c])`

### Nested Filters

```typescript
const result = await articles.query.fetchObjects({
  filters: Filters.and(
    articles.filter.byProperty("category").equal("technology"),
    Filters.or(
      articles.filter.byProperty("wordCount").greaterThan(2000),
      articles.filter.byProperty("wordCount").lessThan(500),
    ),
  ),
  limit: SEARCH_LIMIT,
});
```

### Filter with Like (Wildcard)

```typescript
const result = await articles.query.fetchObjects({
  filters: articles.filter.byProperty("title").like("*machine learning*"),
  limit: SEARCH_LIMIT,
});
```

### Filter by Date

```typescript
const cutoffDate = new Date("2024-01-01");
const result = await articles.query.fetchObjects({
  filters: articles.filter.byProperty("publishedAt").greaterThan(cutoffDate),
  limit: SEARCH_LIMIT,
});
```

### Filter by Cross-Reference

```typescript
const result = await articles.query.fetchObjects({
  filters: articles.filter
    .byRef("hasCategory")
    .byProperty("title")
    .equal("Science"),
  returnReferences: [
    {
      linkOn: "hasCategory",
      returnProperties: ["title"],
    },
  ],
  limit: SEARCH_LIMIT,
});
```

### Filter by Object ID

```typescript
const result = await articles.query.fetchObjects({
  filters: articles.filter.byId().equal(targetId),
});
```

### Filter by Property Length

```typescript
// Second arg `true` enables length-based filtering
const result = await articles.query.fetchObjects({
  filters: articles.filter.byProperty("title", true).greaterThan(20),
  limit: SEARCH_LIMIT,
});
```

---

## Pattern 6: Pagination

### Offset-Based Pagination

```typescript
const PAGE_SIZE = 20;

async function fetchPage(collection: Collection, page: number) {
  return collection.query.fetchObjects({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
}

// Page 0 (first 20), Page 1 (next 20), etc.
const page0 = await fetchPage(articles, 0);
const page1 = await fetchPage(articles, 1);
```

**When to use:** Simple pagination for user-facing pages. Offset has a 10,000 limit by default.

### Cursor-Based Pagination

```typescript
// Use after cursor for deep pagination beyond offset limits
const firstPage = await articles.query.fetchObjects({
  limit: PAGE_SIZE,
  returnMetadata: ["creationTime"],
});

// Get the last object's ID for cursor
const lastId = firstPage.objects[firstPage.objects.length - 1]?.uuid;
if (lastId) {
  const nextPage = await articles.query.fetchObjects({
    limit: PAGE_SIZE,
    after: lastId,
  });
}
```

**When to use:** Deep pagination or iterating large result sets where offset would be slow.

---

## Pattern 7: Return Options

```typescript
const articles = client.collections.use("Article");

// Return specific properties only
const result = await articles.query.fetchObjects({
  limit: SEARCH_LIMIT,
  returnProperties: ["title", "category"],
});

// Include vector in response
const withVector = await articles.query.fetchObjects({
  limit: SEARCH_LIMIT,
  includeVector: true,
});

// Return metadata (distance, score, creation time, etc.)
const withMeta = await articles.query.nearText("search term", {
  limit: SEARCH_LIMIT,
  returnMetadata: ["distance", "creationTime"],
});

// Return cross-references
const withRefs = await articles.query.fetchObjects({
  limit: SEARCH_LIMIT,
  returnReferences: [
    {
      linkOn: "hasCategory",
      returnProperties: ["title"],
    },
  ],
});
```

---

## Pattern 8: Generative Search (RAG) -- Single Prompt

Each search result is individually processed by the LLM. Requires a generative model configured on the collection.

```typescript
const articles = client.collections.use("Article");
const RAG_LIMIT = 5;

const result = await articles.generate.nearText(
  "climate change solutions",
  {
    singlePrompt: "Summarize this article in one tweet: {title} - {body}",
  },
  {
    limit: RAG_LIMIT,
    returnMetadata: ["distance"],
  },
);

for (const obj of result.objects) {
  console.log("Source:", obj.properties.title);
  console.log("Generated:", obj.generative?.text);
}
```

**Why good:** `{title}` and `{body}` are interpolated from each object's properties -- no manual string building needed

### With Metadata and Debug

```typescript
import { generativeParameters } from "weaviate-client";

const result = await articles.generate.nearText(
  "renewable energy",
  {
    singlePrompt: {
      prompt: "Extract 3 key points from: {title} - {body}",
      metadata: true,
      debug: true,
    },
    config: generativeParameters.openAI({ model: "gpt-4o" }),
  },
  { limit: RAG_LIMIT },
);

for (const obj of result.objects) {
  console.log("Generated:", obj.generative?.text);
  console.log("Debug:", obj.generative?.debug);
  console.log("Metadata:", obj.generative?.metadata);
}
```

---

## Pattern 9: Generative Search (RAG) -- Grouped Task

All search results are sent to the LLM as a single context. One output for the entire group.

```typescript
const articles = client.collections.use("Article");
const RAG_LIMIT = 5;

const result = await articles.generate.nearText(
  "artificial intelligence ethics",
  {
    groupedTask:
      "Based on these articles, write a summary of the main ethical concerns in AI.",
  },
  { limit: RAG_LIMIT },
);

// Single generated response for all results
console.log("Combined summary:", result.generative?.text);

// Individual source objects are still available
for (const obj of result.objects) {
  console.log("Source:", obj.properties.title);
}
```

**Why good:** `result.generative?.text` gives one combined output, individual `obj.properties` still accessible for citations

### Grouped Task with Selected Properties

```typescript
const result = await articles.generate.nearText(
  "machine learning applications",
  {
    groupedTask: "Compare and contrast these articles.",
    groupedProperties: ["title", "body"], // Only send title and body to LLM
  },
  { limit: RAG_LIMIT },
);
```

**When to use:** When you want to limit what properties the LLM sees, reducing token usage and improving focus.

---

## Pattern 10: Generative Search with Override Model

Override the collection's default generative model at query time.

```typescript
import { generativeParameters } from "weaviate-client";

const result = await articles.generate.nearText(
  "quantum computing",
  {
    singlePrompt: "Explain this to a 5-year-old: {title}",
    config: generativeParameters.anthropic({
      model: "claude-haiku-4-5",
      maxTokens: 200,
    }),
  },
  { limit: RAG_LIMIT },
);
```

**When to use:** When you need a different model for specific queries (e.g., faster model for summaries, more capable model for analysis).

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
