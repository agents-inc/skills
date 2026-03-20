# Elasticsearch -- Pagination Examples

> from/size, search_after, Point in Time (PIT), and scroll helper patterns. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and search basics from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, search basics
- [bulk-operations.md](bulk-operations.md) -- Bulk data export with scrollDocuments

---

## Pagination Decision Framework

```
How deep do results go?
-- Under 10,000 total and users jump between pages? -> from/size
-- Over 10,000 hits, forward-only (infinite scroll)? -> search_after
-- Over 10,000 hits, need consistent snapshot? -> search_after + PIT
-- Bulk data export (all documents)? -> client.helpers.scrollDocuments()
```

---

## from/size (Shallow Pagination)

Simple offset-based pagination. Limited to 10,000 total hits by default.

```typescript
import type { Client, SearchResponse } from "@elastic/elasticsearch";

const INDEX_NAME = "products";
const PAGE_SIZE = 20;

interface Product {
  productId: string;
  name: string;
  price: number;
}

async function getPage(
  client: Client,
  query: string,
  page: number,
): Promise<SearchResponse<Product>> {
  const from = (page - 1) * PAGE_SIZE;

  return client.search<Product>({
    index: INDEX_NAME,
    query: { match: { name: query } },
    from,
    size: PAGE_SIZE,
    track_total_hits: true, // Get exact total count
  });
}

export { getPage };
```

**Why good:** Simplest pagination, supports random page access (jump to page 5), `track_total_hits: true` for exact total count

**Limitations:**

- Default `index.max_result_window` is 10,000 -- `from + size` cannot exceed this
- Deep pages are expensive: Elasticsearch must fetch and discard `from` documents on every shard
- Not suitable for infinite scroll or large result sets

---

## search_after (Deep Pagination)

Stateless cursor-based pagination using sort values. No 10,000 hit limit.

```typescript
const PAGE_SIZE = 20;

async function searchAfterPage(
  client: Client,
  query: string,
  lastSort?: Array<string | number>,
): Promise<{
  hits: Product[];
  nextSort: Array<string | number> | null;
  total: number;
}> {
  const result = await client.search<Product>({
    index: INDEX_NAME,
    query: { match: { name: query } },
    sort: [
      { _score: "desc" },
      { "name.keyword": "asc" }, // Tiebreaker -- REQUIRED
    ],
    size: PAGE_SIZE,
    ...(lastSort ? { search_after: lastSort } : {}),
    track_total_hits: true,
  });

  const hits = result.hits.hits;
  const nextSort =
    hits.length > 0
      ? (hits[hits.length - 1].sort as Array<string | number>)
      : null;

  return {
    hits: hits.filter((h) => h._source !== undefined).map((h) => h._source!),
    nextSort,
    total:
      typeof result.hits.total === "number"
        ? result.hits.total
        : (result.hits.total?.value ?? 0),
  };
}

export { searchAfterPage };
```

**Why good:** No 10,000 hit limit, tiebreaker field prevents missing/duplicate documents, stateless (no server-side cursor to maintain)

**Gotcha:** `search_after` requires a `sort` parameter. You MUST include a tiebreaker field (a unique value like `_id` or a keyword field) -- without it, documents with identical sort values may be skipped or duplicated across pages.

**Gotcha:** `search_after` is forward-only. You cannot jump to page 5 directly -- you must iterate through pages 1-4 first. For random page access on small result sets, use `from`/`size`.

---

## search_after + Point in Time (Consistent Deep Pagination)

PIT creates a snapshot of the index state, ensuring consistent results even as documents are added/updated during pagination.

```typescript
const PIT_KEEP_ALIVE = "1m";
const PAGE_SIZE = 100;

async function paginateAllProducts(
  client: Client,
  onPage: (products: Product[]) => Promise<void>,
): Promise<void> {
  const pit = await client.openPointInTime({
    index: INDEX_NAME,
    keep_alive: PIT_KEEP_ALIVE,
  });

  let searchAfter: Array<string | number> | undefined;

  try {
    while (true) {
      const result = await client.search<Product>({
        pit: { id: pit.id, keep_alive: PIT_KEEP_ALIVE },
        sort: [{ createdAt: "desc" }, { _id: "asc" }],
        size: PAGE_SIZE,
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });

      const hits = result.hits.hits;
      if (hits.length === 0) break;

      const products = hits
        .filter((h) => h._source !== undefined)
        .map((h) => h._source!);

      await onPage(products);

      searchAfter = hits[hits.length - 1].sort as Array<string | number>;
    }
  } finally {
    await client.closePointInTime({ id: pit.id });
  }
}

export { paginateAllProducts };
```

**Why good:** PIT ensures consistent snapshot across all pages (no missing/duplicate documents from concurrent writes), `keep_alive` refreshed on each request, PIT closed in `finally` block (prevents resource leak)

**Key differences from plain search_after:**

- PIT provides a frozen view of the index -- new documents added during pagination are not visible
- Without PIT, `search_after` sees the live index -- concurrent writes can cause documents to shift between pages
- PIT requires no `index` parameter in the search (it's bound to the PIT)

**Gotcha:** PIT search automatically adds `_shard_doc` as an implicit tiebreaker. You can still add your own tiebreaker for deterministic ordering.

---

## scrollSearch Helper (Page-Level Iteration)

The built-in helper handles scroll management automatically. Use for batch processing.

```typescript
async function processAllDocuments(
  client: Client,
  onBatch: (docs: Product[]) => Promise<void>,
): Promise<void> {
  const scrollSearch = client.helpers.scrollSearch<Product>({
    index: INDEX_NAME,
    query: { match_all: {} },
    size: 500,
  });

  for await (const result of scrollSearch) {
    const docs = result.documents;
    await onBatch(docs);
  }
}

export { processAllDocuments };
```

**Why good:** Async iterator handles scroll lifecycle automatically (open, fetch, clear), `documents` property provides typed `_source` values directly

**When to use:** One-time batch processing or data export. NOT for user-facing pagination.

---

## scrollDocuments Helper (Document-Level Iteration)

Yields individual documents instead of pages. Most memory-efficient for large exports.

```typescript
async function exportAllProducts(client: Client): Promise<Product[]> {
  const allProducts: Product[] = [];

  const docs = client.helpers.scrollDocuments<Product>({
    index: INDEX_NAME,
    query: { match_all: {} },
  });

  for await (const doc of docs) {
    allProducts.push(doc);
  }

  return allProducts;
}

export { exportAllProducts };
```

**Why good:** Most memory-efficient -- processes one document at a time, automatic filter_path optimization

**When to use:** Large data exports, ETL pipelines, index migrations. The scroll API is NOT deprecated for this use case -- it's only deprecated for user-facing search pagination.

---

## Pagination Comparison

| Method                | Max Depth | Random Access | Consistency | Use Case                         |
| --------------------- | --------- | ------------- | ----------- | -------------------------------- |
| `from`/`size`         | 10,000    | Yes           | Live index  | UI with page numbers             |
| `search_after`        | Unlimited | No (forward)  | Live index  | Infinite scroll                  |
| `search_after` + PIT  | Unlimited | No (forward)  | Snapshot    | Deep pagination with consistency |
| `scrollSearch` helper | Unlimited | No (forward)  | Snapshot    | Batch processing (pages)         |
| `scrollDocuments`     | Unlimited | No (forward)  | Snapshot    | Batch processing (documents)     |

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
