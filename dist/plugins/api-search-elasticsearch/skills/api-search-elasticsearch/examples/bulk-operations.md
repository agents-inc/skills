# Elasticsearch -- Bulk Operations Examples

> Bulk API, bulk helper, error handling, and reindexing patterns. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and index management from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, index management, document CRUD
- [pagination.md](pagination.md) -- scrollDocuments for reading all documents during reindex

---

## Bulk API (Low-Level)

The raw bulk API uses alternating action/document pairs.

```typescript
import type { Client, BulkResponse } from "@elastic/elasticsearch";

const INDEX_NAME = "products";

interface Product {
  productId: string;
  name: string;
  price: number;
  categories: string[];
}

async function bulkIndexProducts(
  client: Client,
  products: Product[],
): Promise<{ successful: number; failed: number }> {
  const operations = products.flatMap((doc) => [
    { index: { _index: INDEX_NAME, _id: doc.productId } },
    doc,
  ]);

  const result: BulkResponse = await client.bulk({
    operations,
    refresh: "wait_for", // Only in scripts/seeds -- NOT in production handlers
  });

  if (result.errors) {
    const failedItems = result.items.filter(
      (item) => item.index?.error !== undefined,
    );
    for (const item of failedItems) {
      console.error(
        `Failed to index ${item.index?._id}: ${item.index?.error?.reason}`,
      );
    }
    return {
      successful: products.length - failedItems.length,
      failed: failedItems.length,
    };
  }

  return { successful: products.length, failed: 0 };
}

export { bulkIndexProducts };
```

**Why good:** `flatMap` creates the alternating action/document format, explicit `_id` for upsert behavior, error handling checks `result.errors` and iterates `result.items` for details

**Gotcha:** A bulk request can return HTTP 200 but still have individual failures. Always check `result.errors` -- it's true if ANY item failed. Then iterate `result.items` to find which ones.

**Gotcha:** A 429 status on individual items means "too many requests" -- these are retriable. Other error codes (400, 409) typically indicate data issues that require fixing the document.

---

## Bulk Helper (Recommended)

The bulk helper handles batching, concurrency, retries, and back-pressure automatically.

```typescript
async function bulkIndexWithHelper(
  client: Client,
  products: Product[],
): Promise<{ total: number; successful: number; failed: number }> {
  const result = await client.helpers.bulk<Product>({
    datasource: products,
    onDocument(doc) {
      return { index: { _index: INDEX_NAME, _id: doc.productId } };
    },
    refreshOnCompletion: INDEX_NAME,
  });

  return {
    total: result.total,
    successful: result.successful,
    failed: result.failed,
  };
}

export { bulkIndexWithHelper };
```

**Why good:** Automatic batching (default: 5MB per batch), automatic concurrency (default: 5 parallel requests), automatic retries on 429, `refreshOnCompletion` triggers one refresh at the end

### Bulk Helper with Streaming Data Source

```typescript
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

async function bulkIndexFromFile(
  client: Client,
  filePath: string,
): Promise<{ total: number; failed: number }> {
  const lineReader = createInterface({
    input: createReadStream(filePath),
  });

  async function* generateDocuments() {
    for await (const line of lineReader) {
      if (line.trim()) {
        yield JSON.parse(line) as Product;
      }
    }
  }

  const result = await client.helpers.bulk<Product>({
    datasource: generateDocuments(),
    onDocument(doc) {
      return { index: { _index: INDEX_NAME, _id: doc.productId } };
    },
    refreshOnCompletion: INDEX_NAME,
  });

  return { total: result.total, failed: result.failed };
}

export { bulkIndexFromFile };
```

**Why good:** Async generator streams documents from file without loading all into memory, supports NDJSON format (one JSON object per line)

### Bulk Update

```typescript
async function bulkUpdatePrices(
  client: Client,
  updates: Array<{ productId: string; newPrice: number }>,
): Promise<{ total: number; failed: number }> {
  const result = await client.helpers.bulk({
    datasource: updates,
    onDocument(item) {
      return [
        { update: { _index: INDEX_NAME, _id: item.productId } },
        { doc: { price: item.newPrice } },
      ];
    },
  });

  return { total: result.total, failed: result.failed };
}

export { bulkUpdatePrices };
```

**Why good:** `onDocument` returns a two-element array for update operations -- first element is the action, second is the update body with `doc` for partial update

### Bulk Delete

```typescript
async function bulkDeleteProducts(
  client: Client,
  productIds: string[],
): Promise<{ total: number; failed: number }> {
  const result = await client.helpers.bulk({
    datasource: productIds,
    onDocument(id) {
      return { delete: { _index: INDEX_NAME, _id: id } };
    },
  });

  return { total: result.total, failed: result.failed };
}

export { bulkDeleteProducts };
```

**Why good:** Delete operations have no document body -- `onDocument` returns only the action

---

## Bulk Helper Configuration

```typescript
const FLUSH_BYTES = 5_000_000; // 5MB -- max batch size before flushing
const FLUSH_INTERVAL_MS = 30_000; // 30s -- max time before flushing
const CONCURRENCY = 5; // Parallel bulk requests
const RETRIES = 3; // Retry attempts per document on 429

const result = await client.helpers.bulk<Product>({
  datasource: products,
  onDocument(doc) {
    return { index: { _index: INDEX_NAME, _id: doc.productId } };
  },
  flushBytes: FLUSH_BYTES,
  flushInterval: FLUSH_INTERVAL_MS,
  concurrency: CONCURRENCY,
  retries: RETRIES,
  refreshOnCompletion: INDEX_NAME,
  onDrop(doc) {
    // Called when a document fails after all retries
    console.error(`Dropped document: ${doc.document.productId}`);
  },
});
```

**Why good:** Named constants for all tuning parameters, `onDrop` callback for monitoring permanently failed documents

---

## Reindexing with Alias Swap

Zero-downtime reindex by creating a new index, copying data, and swapping aliases.

```typescript
const READ_ALIAS = "products-read";
const WRITE_ALIAS = "products-write";
const BATCH_SIZE = 500;

async function reindexWithAliasSwap(
  client: Client,
  newIndexName: string,
): Promise<void> {
  // 1. Create new index with updated mappings
  await client.indices.create({
    index: newIndexName,
    mappings: {
      properties: {
        productId: { type: "keyword" },
        name: {
          type: "text",
          fields: { keyword: { type: "keyword" } },
        },
        description: { type: "text" },
        price: { type: "float" },
        categories: { type: "keyword" },
        brand: { type: "keyword" },
        inStock: { type: "boolean" },
        rating: { type: "float" }, // New field
        createdAt: { type: "date" },
      },
    },
  });

  // 2. Disable refresh during bulk copy (faster indexing)
  await client.indices.putSettings({
    index: newIndexName,
    settings: { index: { refresh_interval: "-1" } },
  });

  // 3. Copy documents from old index using scroll
  const docs = client.helpers.scrollDocuments<Product>({
    index: READ_ALIAS,
    query: { match_all: {} },
  });

  await client.helpers.bulk({
    datasource: docs,
    onDocument(doc) {
      return { index: { _index: newIndexName, _id: doc.productId } };
    },
    refreshOnCompletion: newIndexName,
  });

  // 4. Re-enable refresh
  await client.indices.putSettings({
    index: newIndexName,
    settings: { index: { refresh_interval: "1s" } },
  });

  // 5. Atomic alias swap
  // Find the current index behind the alias
  const aliasInfo = await client.indices.getAlias({ name: READ_ALIAS });
  const oldIndexNames = Object.keys(aliasInfo);

  await client.indices.updateAliases({
    actions: [
      ...oldIndexNames.map((oldIdx) => ({
        remove: { index: oldIdx, alias: READ_ALIAS },
      })),
      ...oldIndexNames.map((oldIdx) => ({
        remove: { index: oldIdx, alias: WRITE_ALIAS },
      })),
      { add: { index: newIndexName, alias: READ_ALIAS } },
      { add: { index: newIndexName, alias: WRITE_ALIAS } },
    ],
  });
}

export { reindexWithAliasSwap };
```

**Why good:** Zero-downtime reindex using alias swap, refresh disabled during bulk copy for speed, `scrollDocuments` streams data without loading all into memory, alias swap is atomic

**Gotcha:** Disabling refresh during bulk copy is critical for performance -- without it, Elasticsearch creates a new segment every second during the copy. Always re-enable refresh after the copy completes.

---

## Server-Side Reindex API

For simple reindexing without transformation, use the built-in reindex API.

```typescript
async function reindexServerSide(
  client: Client,
  sourceIndex: string,
  destIndex: string,
): Promise<{ total: number }> {
  const result = await client.reindex({
    source: { index: sourceIndex },
    dest: { index: destIndex },
    wait_for_completion: true, // Block until done -- only in scripts
  });

  return { total: result.total ?? 0 };
}

export { reindexServerSide };
```

**Why good:** Server-side reindex avoids round-tripping documents through the client -- faster for large datasets. Use `wait_for_completion: false` for very large reindexes and poll the task API instead.

**When to use:** When you need to copy data between indices without transforming the document structure. For transformations (adding fields, changing types), use the client-side scroll + bulk pattern above.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
