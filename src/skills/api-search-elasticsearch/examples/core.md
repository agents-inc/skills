# Elasticsearch -- Core Pattern Examples

> Client setup, index management, document CRUD, search basics, and TypeScript integration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [aggregations.md](aggregations.md) -- Terms, range, date_histogram, pipeline aggregations
- [vector-search.md](vector-search.md) -- Dense vector fields, kNN, hybrid search
- [pagination.md](pagination.md) -- search_after, PIT, scroll helpers
- [bulk-operations.md](bulk-operations.md) -- Bulk API, bulk helper, reindexing

---

## Client Setup

### Basic Setup with API Key Auth

```typescript
import { Client } from "@elastic/elasticsearch";

function createElasticsearchClient(): Client {
  const node = process.env.ELASTICSEARCH_URL;
  if (!node) {
    throw new Error("ELASTICSEARCH_URL environment variable is required");
  }

  return new Client({
    node,
    auth: {
      apiKey: process.env.ELASTICSEARCH_API_KEY ?? "",
    },
  });
}

export { createElasticsearchClient };
```

**Why good:** Environment variable validation, API key auth (preferred over basic auth), named export

### Elastic Cloud Setup

```typescript
import { Client } from "@elastic/elasticsearch";

function createCloudClient(): Client {
  const cloudId = process.env.ELASTIC_CLOUD_ID;
  if (!cloudId) {
    throw new Error("ELASTIC_CLOUD_ID environment variable is required");
  }

  return new Client({
    cloud: { id: cloudId },
    auth: {
      apiKey: process.env.ELASTICSEARCH_API_KEY ?? "",
    },
  });
}

export { createCloudClient };
```

**Why good:** `cloud.id` encodes the cluster URL -- no need to construct URLs manually, handles TLS automatically

### Health Check

```typescript
import type { Client } from "@elastic/elasticsearch";

const HEALTH_TIMEOUT_MS = 5000;

async function verifyConnection(client: Client): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    await client.ping({ signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export { verifyConnection };
```

**Why good:** `client.ping()` is the lightest health check, AbortController prevents hanging on unresponsive cluster, named constant for timeout

---

## Index Management

### Creating an Index with Explicit Mappings

```typescript
import type { Client } from "@elastic/elasticsearch";

const INDEX_NAME = "products";

async function createProductIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) return;

  await client.indices.create({
    index: INDEX_NAME,
    settings: {
      number_of_replicas: 1,
      refresh_interval: "1s",
      analysis: {
        analyzer: {
          product_analyzer: {
            type: "custom",
            tokenizer: "standard",
            filter: ["lowercase", "asciifolding"],
          },
        },
      },
    },
    mappings: {
      dynamic: "strict", // Reject documents with unmapped fields
      properties: {
        productId: { type: "keyword" },
        name: {
          type: "text",
          analyzer: "product_analyzer",
          fields: { keyword: { type: "keyword", ignore_above: 256 } },
        },
        description: { type: "text", analyzer: "product_analyzer" },
        price: { type: "float" },
        categories: { type: "keyword" },
        brand: { type: "keyword" },
        inStock: { type: "boolean" },
        tags: { type: "keyword" },
        createdAt: { type: "date" },
      },
    },
  });
}

export { createProductIndex };
```

**Why good:** `dynamic: "strict"` rejects unmapped fields (prevents mapping explosion), custom analyzer with asciifolding for accent-insensitive search, `text` + `keyword` multi-field on `name` for both search and aggregation, existence check prevents errors on re-run

### Adding Fields to Existing Mapping

```typescript
// You CAN add new fields to an existing mapping
// You CANNOT change the type of an existing field
async function addRatingField(client: Client): Promise<void> {
  await client.indices.putMapping({
    index: INDEX_NAME,
    properties: {
      rating: { type: "float" },
      reviewCount: { type: "integer" },
    },
  });
}

export { addRatingField };
```

**Important:** `putMapping` can only ADD new fields. Changing an existing field type (e.g., `text` to `keyword`) requires creating a new index with correct mappings and reindexing all documents.

### Index Aliases for Zero-Downtime Reindexing

```typescript
const PRODUCTS_READ_ALIAS = "products-read";
const PRODUCTS_WRITE_ALIAS = "products-write";

async function swapIndex(
  client: Client,
  oldIndex: string,
  newIndex: string,
): Promise<void> {
  await client.indices.updateAliases({
    actions: [
      { remove: { index: oldIndex, alias: PRODUCTS_READ_ALIAS } },
      { add: { index: newIndex, alias: PRODUCTS_READ_ALIAS } },
      { remove: { index: oldIndex, alias: PRODUCTS_WRITE_ALIAS } },
      { add: { index: newIndex, alias: PRODUCTS_WRITE_ALIAS } },
    ],
  });
}

export { swapIndex };
```

**Why good:** `updateAliases` is atomic -- read and write aliases switch simultaneously, no downtime during reindex

---

## Document Operations

### Indexing a Document

```typescript
import type { Client } from "@elastic/elasticsearch";

interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  categories: string[];
  brand: string;
  inStock: boolean;
  createdAt: string;
}

const INDEX_NAME = "products";

async function indexProduct(client: Client, product: Product): Promise<string> {
  const result = await client.index({
    index: INDEX_NAME,
    id: product.productId, // Explicit ID for upsert behavior
    document: product,
  });
  return result._id;
}

export { indexProduct };
export type { Product };
```

**Why good:** Explicit `id` enables upsert (index or replace), typed document, returns the document ID

### Getting a Document by ID

```typescript
async function getProduct(
  client: Client,
  productId: string,
): Promise<Product | null> {
  try {
    const result = await client.get<Product>({
      index: INDEX_NAME,
      id: productId,
    });
    return result._source ?? null;
  } catch (err) {
    if (
      err instanceof Error &&
      "statusCode" in err &&
      (err as { statusCode: number }).statusCode === 404
    ) {
      return null;
    }
    throw err;
  }
}

export { getProduct };
```

**Why good:** `_source` can be undefined, 404 handled gracefully (document not found is not an error in most use cases), generic type flows through to `_source`

### Partial Update

```typescript
async function updateProductPrice(
  client: Client,
  productId: string,
  newPrice: number,
): Promise<void> {
  await client.update({
    index: INDEX_NAME,
    id: productId,
    doc: { price: newPrice },
  });
}

export { updateProductPrice };
```

**Why good:** `doc` performs partial update -- only `price` changes, all other fields preserved. Compare with `client.index()` which replaces the entire document.

### Scripted Update (Atomic)

```typescript
const PRICE_INCREASE_PERCENTAGE = 10;

async function increasePriceByPercent(
  client: Client,
  productId: string,
): Promise<void> {
  await client.update({
    index: INDEX_NAME,
    id: productId,
    script: {
      source: "ctx._source.price *= (1 + params.pct / 100.0)",
      params: { pct: PRICE_INCREASE_PERCENTAGE },
    },
  });
}

export { increasePriceByPercent };
```

**Why good:** Script runs on the shard -- atomic, no read-modify-write race condition. Named constant for the percentage value.

### Delete by ID and by Query

```typescript
async function deleteProduct(client: Client, productId: string): Promise<void> {
  await client.delete({
    index: INDEX_NAME,
    id: productId,
  });
}

async function deleteOutOfStockProducts(client: Client): Promise<number> {
  const result = await client.deleteByQuery({
    index: INDEX_NAME,
    query: {
      term: { inStock: false },
    },
  });
  return result.deleted ?? 0;
}

export { deleteProduct, deleteOutOfStockProducts };
```

**Why good:** `deleteByQuery` for batch deletion without knowing individual IDs, returns count of deleted documents

---

## Search Patterns

### Basic Search with Highlighting

```typescript
import type { Client, SearchResponse } from "@elastic/elasticsearch";

const DEFAULT_SEARCH_LIMIT = 20;

async function searchProducts(
  client: Client,
  query: string,
  options?: { limit?: number },
): Promise<SearchResponse<Product>> {
  return client.search<Product>({
    index: INDEX_NAME,
    query: {
      multi_match: {
        query,
        fields: ["name^3", "description", "brand^2"],
        type: "best_fields",
        fuzziness: "AUTO",
      },
    },
    highlight: {
      fields: {
        name: {},
        description: { fragment_size: 150, number_of_fragments: 2 },
      },
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
    },
    size: options?.limit ?? DEFAULT_SEARCH_LIMIT,
  });
}

// Usage:
// const results = await searchProducts(client, "wireless headphones");
// results.hits.hits[0]._source?.name -- original
// results.hits.hits[0].highlight?.name?.[0] -- "<mark>wireless</mark> <mark>headphones</mark>"

export { searchProducts };
```

**Why good:** `name^3` boosts name matches 3x, `fuzziness: "AUTO"` handles typos, highlighting configured with custom tags, typed search response

### Bool Query with Filter Context

```typescript
interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  categories?: string[];
  inStock?: boolean;
  query?: string;
}

async function filteredSearch(
  client: Client,
  filters: SearchFilters,
): Promise<SearchResponse<Product>> {
  const must: object[] = [];
  const filterClauses: object[] = [];

  if (filters.query) {
    must.push({
      multi_match: {
        query: filters.query,
        fields: ["name^3", "description", "brand"],
      },
    });
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    filterClauses.push({
      range: {
        price: {
          ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
          ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
        },
      },
    });
  }

  if (filters.categories?.length) {
    filterClauses.push({ terms: { categories: filters.categories } });
  }

  if (filters.inStock !== undefined) {
    filterClauses.push({ term: { inStock: filters.inStock } });
  }

  return client.search<Product>({
    index: INDEX_NAME,
    query: {
      bool: {
        ...(must.length > 0 ? { must } : {}),
        ...(filterClauses.length > 0 ? { filter: filterClauses } : {}),
      },
    },
    size: DEFAULT_SEARCH_LIMIT,
  });
}

export { filteredSearch };
```

**Why good:** Exact-match conditions in `filter` (no scoring, cached), full-text in `must` (scoring), dynamic query construction based on provided filters

### Nested Query

```typescript
// For arrays of objects where field association matters
// Mapping must use "nested" type, not default "object"

interface ProductWithReviews extends Product {
  reviews: Array<{ author: string; rating: number; text: string }>;
}

async function searchByReview(
  client: Client,
  minRating: number,
  reviewText: string,
): Promise<SearchResponse<ProductWithReviews>> {
  return client.search<ProductWithReviews>({
    index: INDEX_NAME,
    query: {
      nested: {
        path: "reviews",
        query: {
          bool: {
            must: [{ match: { "reviews.text": reviewText } }],
            filter: [{ range: { "reviews.rating": { gte: minRating } } }],
          },
        },
        inner_hits: { size: 3 }, // Return matching nested docs
      },
    },
  });
}

export { searchByReview };
```

**Why good:** `nested` query preserves field association within each review object (without `nested`, searching for "great" with rating >= 4 could match "great" from one review and rating 5 from a different review), `inner_hits` returns the matching nested documents

**Important:** The `reviews` field must be mapped as `"type": "nested"`. Default `object` mapping flattens the array, losing field-level association.

---

## TypeScript Integration

### Typed Search Results

```typescript
import type { Client, SearchHit } from "@elastic/elasticsearch";

// Generic type flows through to hits
async function searchAndTransform(
  client: Client,
  query: string,
): Promise<Array<{ id: string; name: string; score: number }>> {
  const result = await client.search<Product>({
    index: INDEX_NAME,
    query: { match: { name: query } },
    size: 10,
  });

  return result.hits.hits
    .filter(
      (hit): hit is SearchHit<Product> & { _source: Product } =>
        hit._source !== undefined,
    )
    .map((hit) => ({
      id: hit._id,
      name: hit._source.name,
      score: hit._score ?? 0,
    }));
}

export { searchAndTransform };
```

**Why good:** Type guard filters out hits with missing `_source`, `_score` can be null (e.g., in filter context), generic type parameter provides type safety on `_source`

### Importing Elasticsearch Types

```typescript
import type {
  SearchResponse,
  SearchHit,
  BulkResponse,
  MappingProperty,
} from "@elastic/elasticsearch/lib/api/types";

// Or use the estypes namespace for full type coverage
import type { estypes } from "@elastic/elasticsearch";

type MySearchResponse = estypes.SearchResponse<Product>;
```

**Why good:** `estypes` provides complete request/response types matching the Elasticsearch specification

---

## Error Handling

### Common Error Patterns

```typescript
import { errors } from "@elastic/elasticsearch";

async function safeSearch(
  client: Client,
  query: string,
): Promise<SearchResponse<Product> | null> {
  try {
    return await client.search<Product>({
      index: INDEX_NAME,
      query: { match: { name: query } },
    });
  } catch (err) {
    if (err instanceof errors.ResponseError) {
      if (err.statusCode === 404) {
        // Index doesn't exist
        return null;
      }
      if (err.statusCode === 400) {
        // Bad query (malformed DSL)
        throw new Error(`Invalid search query: ${err.message}`);
      }
    }
    if (err instanceof errors.ConnectionError) {
      // Cluster unreachable
      throw new Error("Elasticsearch cluster unavailable");
    }
    throw err;
  }
}

export { safeSearch };
```

**Why good:** `errors.ResponseError` for HTTP errors with status codes, `errors.ConnectionError` for network issues, specific handling per status code

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
