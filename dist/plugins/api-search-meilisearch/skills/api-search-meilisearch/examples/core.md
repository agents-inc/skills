# Meilisearch -- Core Pattern Examples

> Client setup, document operations, search basics, task management, and TypeScript integration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [filtering.md](filtering.md) -- Filters, facets, geo search
- [settings.md](settings.md) -- Ranking rules, typo tolerance, synonyms
- [security.md](security.md) -- API keys, tenant tokens, multi-tenancy

---

## Client Setup with Health Check

```typescript
import { Meilisearch } from "meilisearch";

const HEALTH_TIMEOUT_MS = 3000;

function createSearchClient(): Meilisearch {
  const host = process.env.MEILISEARCH_URL;
  const apiKey = process.env.MEILISEARCH_API_KEY;
  if (!host) {
    throw new Error("MEILISEARCH_URL environment variable is required");
  }

  return new Meilisearch({ host, apiKey });
}

async function verifyConnection(client: Meilisearch): Promise<boolean> {
  try {
    const health = await Promise.race([
      client.health(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Health check timed out")),
          HEALTH_TIMEOUT_MS,
        ),
      ),
    ]);
    return health.status === "available";
  } catch {
    return false;
  }
}

export { createSearchClient, verifyConnection };
```

**Why good:** Health check with timeout via `Promise.race` prevents hanging on unresponsive server (note: `client.health()` accepts no parameters), named constant for timeout duration, graceful false return on failure

---

## Document Operations

### Adding Documents

```typescript
import type { Meilisearch } from "meilisearch";

interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  categories: string[];
  brand: string;
  inStock: boolean;
}

const INDEX_NAME = "products";
const PRIMARY_KEY = "productId";

async function indexProducts(
  client: Meilisearch,
  products: Product[],
): Promise<number> {
  const index = client.index<Product>(INDEX_NAME);
  const task = await index.addDocuments(products, {
    primaryKey: PRIMARY_KEY,
  });
  return task.taskUid;
}

export { indexProducts };
export type { Product };
```

**Why good:** Explicit primary key, typed index with generic, returns task UID for tracking, named constants for index name and primary key

### Updating Documents (Partial)

```typescript
// updateDocuments merges fields -- only specified fields are updated
async function updateProductPrice(
  client: Meilisearch,
  productId: string,
  newPrice: number,
): Promise<number> {
  const index = client.index<Product>(INDEX_NAME);
  const task = await index.updateDocuments([{ productId, price: newPrice }]);
  return task.taskUid;
}

export { updateProductPrice };
```

**Why good:** `updateDocuments` performs a partial merge -- only `price` is updated, other fields are preserved. Compare with `addDocuments` which replaces the entire document.

### Deleting Documents

```typescript
// Delete by ID
async function deleteProduct(
  client: Meilisearch,
  productId: string,
): Promise<number> {
  const index = client.index<Product>(INDEX_NAME);
  const task = await index.deleteDocument(productId);
  return task.taskUid;
}

// Delete by filter (batch deletion)
async function deleteDiscontinuedProducts(
  client: Meilisearch,
): Promise<number> {
  const index = client.index<Product>(INDEX_NAME);
  const task = await index.deleteDocuments({
    filter: "inStock = false",
  });
  return task.taskUid;
}

export { deleteProduct, deleteDiscontinuedProducts };
```

**Why good:** Delete by filter allows batch deletion without knowing individual IDs, both methods return task UIDs for tracking

**Important:** Delete by filter requires `inStock` to be in `filterableAttributes`. The filter-based delete follows the same rules as search filters.

---

## Search Patterns

### Basic Search with Highlighting

```typescript
import type { Meilisearch, SearchResponse } from "meilisearch";

const DEFAULT_SEARCH_LIMIT = 20;

async function searchProducts(
  client: Meilisearch,
  query: string,
  options?: { limit?: number },
): Promise<SearchResponse<Product>> {
  const index = client.index<Product>(INDEX_NAME);
  return index.search(query, {
    limit: options?.limit ?? DEFAULT_SEARCH_LIMIT,
    attributesToHighlight: ["name", "description"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
  });
}

// Usage:
// const results = await searchProducts(client, "wireless headphones");
// results.hits[0].name -- original
// results.hits[0]._formatted.name -- "wireless <mark>headphones</mark>"

export { searchProducts };
```

**Why good:** Named constant for default limit, typed search response, highlighting configured with custom tags, `_formatted` field contains highlighted versions

### Placeholder Search (Browse Mode)

```typescript
// Empty query returns all documents matching filters -- useful for category browsing
async function browseProducts(
  client: Meilisearch,
  filters: { category?: string; brand?: string; sort?: string },
): Promise<SearchResponse<Product>> {
  const index = client.index<Product>(INDEX_NAME);

  const filterParts: string[] = [];
  if (filters.category) {
    filterParts.push(`categories = "${filters.category}"`);
  }
  if (filters.brand) {
    filterParts.push(`brand = "${filters.brand}"`);
  }

  return index.search("", {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: filters.sort ? [filters.sort] : undefined,
    limit: DEFAULT_SEARCH_LIMIT,
  });
}

export { browseProducts };
```

**Why good:** Empty string query is a valid "placeholder search" that returns all documents matching the filter, useful for browse/filter-only UIs

---

## Task Management

### Seed Script with waitTask

```typescript
import { Meilisearch } from "meilisearch";

const INDEX_NAME = "products";
const PRIMARY_KEY = "productId";

async function seedSearchIndex(
  client: Meilisearch,
  products: Product[],
): Promise<void> {
  const index = client.index<Product>(INDEX_NAME);

  // Step 1: Configure settings and wait for completion
  const settingsTask = await index
    .updateSettings({
      filterableAttributes: ["price", "categories", "brand", "inStock"],
      sortableAttributes: ["price", "createdAt"],
      searchableAttributes: ["name", "description", "brand"],
    })
    .waitTask();

  if (settingsTask.status === "failed") {
    throw new Error(`Settings update failed: ${settingsTask.error?.message}`);
  }

  // Step 2: Add documents and wait for completion
  const docsTask = await index
    .addDocuments(products, { primaryKey: PRIMARY_KEY })
    .waitTask();

  if (docsTask.status === "failed") {
    throw new Error(`Document indexing failed: ${docsTask.error?.message}`);
  }

  console.log(
    `Indexed ${docsTask.details?.indexedDocuments} of ${docsTask.details?.receivedDocuments} documents`,
  );
}

export { seedSearchIndex };
```

**Why good:** Settings configured BEFORE documents (avoids re-index), `.waitTask()` used in seed script (not request handler), task failure checked, indexing statistics logged

### Fire-and-Forget in API Handlers

```typescript
// In request handlers: return task UID, don't wait
async function handleProductCreate(
  client: Meilisearch,
  product: Product,
): Promise<{ taskUid: number }> {
  const index = client.index<Product>(INDEX_NAME);
  const task = await index.addDocuments([product], {
    primaryKey: PRIMARY_KEY,
  });
  // Do NOT call .waitTask() here -- return immediately
  return { taskUid: task.taskUid };
}

export { handleProductCreate };
```

**Why good:** Returns task UID immediately without blocking, client can poll task status separately if needed

### Batch Operations with Multiple Tasks

```typescript
async function reindexAll(
  client: Meilisearch,
  products: Product[],
): Promise<void> {
  const index = client.index<Product>(INDEX_NAME);

  // Delete all existing documents
  const deleteTask = await index.deleteAllDocuments().waitTask();
  if (deleteTask.status === "failed") {
    throw new Error(`Delete failed: ${deleteTask.error?.message}`);
  }

  // Re-add all documents
  const addTask = await index
    .addDocuments(products, { primaryKey: PRIMARY_KEY })
    .waitTask();

  if (addTask.status === "failed") {
    throw new Error(`Reindex failed: ${addTask.error?.message}`);
  }
}

export { reindexAll };
```

**Why good:** Sequential task execution in a script, each task waited and checked before proceeding

---

## Multi-Search

### Standard Multi-Search (Separate Results)

```typescript
import type { Meilisearch } from "meilisearch";

async function globalSearch(
  client: Meilisearch,
  query: string,
): Promise<{
  products: Product[];
  articles: Article[];
}> {
  const results = await client.multiSearch({
    queries: [
      {
        indexUid: "products",
        q: query,
        limit: 5,
        attributesToRetrieve: ["productId", "name", "price"],
      },
      {
        indexUid: "articles",
        q: query,
        limit: 5,
        attributesToRetrieve: ["articleId", "title", "summary"],
      },
    ],
  });

  return {
    products: results.results[0].hits as Product[],
    articles: results.results[1].hits as Article[],
  };
}

export { globalSearch };
```

**Why good:** Single network request for searching two indexes, each query has independent parameters, results array order matches queries array order

### Federated Search (Merged Results)

```typescript
// Federated search merges results from multiple indexes into one ranked list
async function federatedSearch(
  client: Meilisearch,
  query: string,
): Promise<unknown[]> {
  const results = await client.multiSearch({
    federation: {},
    queries: [
      { indexUid: "products", q: query },
      { indexUid: "articles", q: query },
    ],
  });

  // results.hits is a single merged list
  return results.hits;
}

export { federatedSearch };
```

**Why good:** `federation: {}` triggers merged results, single ranked list across all indexes

---

## TypeScript Integration

### Typed Search Results

```typescript
import type { Meilisearch, SearchResponse, Hits } from "meilisearch";

interface Movie {
  id: string;
  title: string;
  genres: string[];
  releaseDate: number;
  rating: number;
}

// Generic type flows through to hits
async function searchMovies(
  client: Meilisearch,
  query: string,
): Promise<Hits<Movie>> {
  const index = client.index<Movie>("movies");
  const response = await index.search(query, {
    filter: "rating > 7",
    limit: 10,
  });
  // response.hits is typed as Hits<Movie>
  return response.hits;
}

export { searchMovies };
export type { Movie };
```

**Why good:** `client.index<Movie>("movies")` propagates the type to `search()` results, `Hits<Movie>` type used for return value

---

## AbortController for Cancellable Search

```typescript
// Useful for autocomplete: cancel previous search when user types again
function createCancellableSearch(client: Meilisearch) {
  let controller: AbortController | null = null;

  return async function search(
    query: string,
  ): Promise<SearchResponse<Product> | null> {
    // Cancel previous in-flight request
    if (controller) {
      controller.abort();
    }
    controller = new AbortController();

    try {
      const index = client.index<Product>(INDEX_NAME);
      return await index.search(
        query,
        { limit: 10 },
        {
          signal: controller.signal,
        },
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null; // Request was cancelled -- expected
      }
      throw err;
    }
  };
}

export { createCancellableSearch };
```

**Why good:** Each new search cancels the previous in-flight request, AbortError handled gracefully (not thrown), closure maintains controller state

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
