# Pinecone -- Batch Operations Examples

> Chunked upserts, parallel ingestion, and bulk data management. See [core.md](core.md) for single-record operations.

**Related examples:**

- [core.md](core.md) -- Basic upsert, query, fetch, delete
- [inference.md](inference.md) -- Batch embedding generation

---

## Shared Utility: Chunk Array

All batch patterns below use this chunking utility.

```typescript
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export { chunkArray };
```

---

## Chunked Sequential Upsert

Batch upserts at 200 records to stay well within the 1,000-record / 2 MB limit.

```typescript
import type { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

const UPSERT_BATCH_SIZE = 200;

interface VectorRecord<T extends RecordMetadata = RecordMetadata> {
  id: string;
  values: number[];
  metadata?: T;
}

async function batchUpsert<T extends RecordMetadata>(
  index: ReturnType<Pinecone["index"]>,
  namespace: string,
  records: VectorRecord<T>[],
): Promise<void> {
  const batches = chunkArray(records, UPSERT_BATCH_SIZE);
  const ns = index.namespace(namespace);

  for (const batch of batches) {
    await ns.upsert({ records: batch });
  }
}

export { batchUpsert };
```

**Why good:** Named constant for batch size, generic metadata type, sequential processing avoids overwhelming the API

---

## Parallel Upsert with Concurrency Control

For large datasets, parallel upserts increase throughput while respecting rate limits.

```typescript
import type { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

const UPSERT_BATCH_SIZE = 200;
const MAX_CONCURRENT_UPSERTS = 5;

async function parallelBatchUpsert<T extends RecordMetadata>(
  index: ReturnType<Pinecone["index"]>,
  namespace: string,
  records: Array<{ id: string; values: number[]; metadata?: T }>,
): Promise<void> {
  const batches = chunkArray(records, UPSERT_BATCH_SIZE);
  const ns = index.namespace(namespace);

  // Process batches with bounded concurrency
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_UPSERTS) {
    const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT_UPSERTS);
    await Promise.all(
      concurrentBatches.map((batch) => ns.upsert({ records: batch })),
    );
  }
}

export { parallelBatchUpsert };
```

**Why good:** Bounded concurrency prevents rate limiting, `Promise.all` for parallel execution within each window, sequential windows prevent overload

---

## Batch Upsert with Progress Tracking

```typescript
import type { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

const UPSERT_BATCH_SIZE = 200;

async function batchUpsertWithProgress<T extends RecordMetadata>(
  index: ReturnType<Pinecone["index"]>,
  namespace: string,
  records: Array<{ id: string; values: number[]; metadata?: T }>,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const batches = chunkArray(records, UPSERT_BATCH_SIZE);
  const ns = index.namespace(namespace);
  let completed = 0;

  for (const batch of batches) {
    await ns.upsert({ records: batch });
    completed += batch.length;
    onProgress?.(completed, records.length);
  }
}

export { batchUpsertWithProgress };
```

**Why good:** Progress callback for long-running ingestion jobs, accurate count tracking

---

## Batch Upsert with Retry Logic

```typescript
import type { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";

const UPSERT_BATCH_SIZE = 200;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function upsertWithRetry<T extends RecordMetadata>(
  ns: ReturnType<Pinecone["index"]>,
  records: Array<{ id: string; values: number[]; metadata?: T }>,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await ns.upsert({ records });
      return;
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("429") || error.message.includes("503"));

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        throw error;
      }

      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

async function batchUpsertWithRetry<T extends RecordMetadata>(
  index: ReturnType<Pinecone["index"]>,
  namespace: string,
  records: Array<{ id: string; values: number[]; metadata?: T }>,
): Promise<void> {
  const batches = chunkArray(records, UPSERT_BATCH_SIZE);
  const ns = index.namespace(namespace);

  for (const batch of batches) {
    await upsertWithRetry(ns, batch);
  }
}

export { batchUpsertWithRetry };
```

**Why good:** Exponential backoff for rate limits (429) and server errors (503), named constants, non-retryable errors propagate immediately

---

## Verify Upsert Completion

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

async function waitForUpsertCompletion(
  index: ReturnType<Pinecone["index"]>,
  expectedCount: number,
  namespace?: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const stats = await index.describeIndexStats();

    const currentCount = namespace
      ? (stats.namespaces?.[namespace]?.recordCount ?? 0)
      : (stats.totalRecordCount ?? 0);

    if (currentCount >= expectedCount) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false; // Timed out waiting for vectors to be indexed
}

export { waitForUpsertCompletion };
```

**Why good:** Handles eventual consistency by polling, namespace-aware count check, timeout prevents infinite waiting

**Gotcha:** `describeIndexStats()` counts are approximate. For exact verification, query for a specific recently-upserted ID using `fetch`.

---

## Batch Delete by IDs

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const DELETE_BATCH_SIZE = 1000; // Max IDs per deleteMany call

async function batchDelete(
  index: ReturnType<Pinecone["index"]>,
  namespace: string,
  ids: string[],
): Promise<void> {
  const ns = index.namespace(namespace);
  const batches = chunkArray(ids, DELETE_BATCH_SIZE);

  for (const batch of batches) {
    await ns.deleteMany({ ids: batch });
  }
}

export { batchDelete };
```

**Why good:** Respects 1,000 ID limit per delete request, sequential batching

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
