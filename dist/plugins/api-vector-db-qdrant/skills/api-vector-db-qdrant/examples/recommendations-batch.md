# Qdrant -- Recommendations, Batch Operations & Snapshots

> Recommend API, batch operations, and snapshot management. See [core.md](core.md) for basic operations.

**Related examples:**

- [core.md](core.md) -- Client setup, upsert, query, scroll, delete
- [filtering.md](filtering.md) -- Payload filtering conditions
- [named-vectors-quantization.md](named-vectors-quantization.md) -- Named vectors, quantization

---

## Recommend by Positive/Negative Examples

Find points similar to positive examples and dissimilar to negative examples.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

async function recommendSimilar(
  client: QdrantClient,
  collectionName: string,
  positiveIds: (string | number)[],
  negativeIds?: (string | number)[],
): Promise<void> {
  const results = await client.recommend(collectionName, {
    positive: positiveIds,
    negative: negativeIds ?? [],
    limit: TOP_K,
    with_payload: true,
  });

  for (const point of results) {
    console.log(point.id, point.score, point.payload);
  }
}

export { recommendSimilar };
```

**Why good:** Accepts point IDs as examples, optional negatives, `with_payload` for context

---

## Recommend with Strategy Selection

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

// Using query() with recommend -- preferred API
async function recommendWithStrategy(
  client: QdrantClient,
  collectionName: string,
): Promise<void> {
  // "average_vector" (default): averages positive/negative vectors
  // Good when examples are from the same cluster
  const averaged = await client.query(collectionName, {
    query: {
      recommend: {
        positive: [1, 42],
        negative: [7],
        strategy: "average_vector",
      },
    },
    limit: TOP_K,
    with_payload: true,
  });

  // "best_score": scores each candidate against each example individually
  // Better when positives span multiple clusters or negatives are important
  const bestScore = await client.query(collectionName, {
    query: {
      recommend: {
        positive: [1, 42],
        negative: [7],
        strategy: "best_score",
      },
    },
    limit: TOP_K,
    with_payload: true,
  });
}

export { recommendWithStrategy };
```

**Why good:** Shows both strategies with clear use-case guidance, uses `query()` universal endpoint

**When to use each:**

- `average_vector`: Fast, works well when positive examples are conceptually close
- `best_score`: Better accuracy when positives span diverse topics or when negatives are critical

---

## Recommend with Raw Vectors

Mix point IDs and raw vectors as positive/negative examples.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

const results = await client.query("documents", {
  query: {
    recommend: {
      positive: [
        42, // Existing point ID
        [0.2, 0.3, 0.4, 0.5], // Raw vector (from external source)
      ],
      negative: [7],
    },
  },
  limit: TOP_K,
  with_payload: true,
});
```

**Why good:** Combines stored point IDs with external vectors, useful when some reference items are not in the collection

---

## Recommend with Named Vectors

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

// Recommend based on "content" named vector
const results = await client.recommend("articles", {
  positive: [1, 42],
  using: "content", // Which named vector to use for similarity
  limit: TOP_K,
  with_payload: true,
});
```

**Why good:** `using` specifies which named vector drives the recommendation

---

## Recommend with Filter

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const TOP_K = 10;

const results = await client.recommend("documents", {
  positive: [1, 42],
  filter: {
    must: [{ key: "category", match: { value: "tutorial" } }],
    must_not: [{ key: "status", match: { value: "draft" } }],
  },
  limit: TOP_K,
  with_payload: true,
});
```

**Why good:** Combines recommendation with payload filtering, ensures results match business constraints

---

## Batch Upsert with Chunking

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const UPSERT_BATCH_SIZE = 200;

interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function batchUpsert(
  client: QdrantClient,
  collectionName: string,
  points: VectorPoint[],
): Promise<void> {
  const batches = chunkArray(points, UPSERT_BATCH_SIZE);

  for (const batch of batches) {
    await client.upsert(collectionName, {
      wait: true,
      points: batch,
    });
  }
}

export { batchUpsert, chunkArray };
```

**Why good:** Named constant for batch size, reusable chunking utility, `wait: true` per batch for consistency

---

## Parallel Batch Upsert

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const UPSERT_BATCH_SIZE = 200;
const MAX_CONCURRENT = 5;

async function parallelBatchUpsert(
  client: QdrantClient,
  collectionName: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  const batches = chunkArray(points, UPSERT_BATCH_SIZE);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const window = batches.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      window.map((batch) =>
        client.upsert(collectionName, { wait: true, points: batch }),
      ),
    );
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export { parallelBatchUpsert };
```

**Why good:** Bounded concurrency prevents overwhelming the server, `Promise.all` for parallel execution within each window

---

## Batch Upsert with Retry Logic

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

const UPSERT_BATCH_SIZE = 200;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function upsertWithRetry(
  client: QdrantClient,
  collectionName: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await client.upsert(collectionName, { wait: true, points });
      return;
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("503") ||
          error.message.includes("ECONNRESET"));

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        throw error;
      }

      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

export { upsertWithRetry };
```

**Why good:** Exponential backoff for rate limits (429), server errors (503), and network issues, named constants, non-retryable errors propagate immediately

---

## Batch Update Operations

Use `batchUpdate` for multiple different operations in a single request.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

async function batchOperations(client: QdrantClient): Promise<void> {
  await client.batchUpdate("documents", {
    wait: true,
    operations: [
      // Upsert new points
      {
        upsert: {
          points: [
            {
              id: "new-1",
              vector: [0.1, 0.2, 0.3],
              payload: { title: "New Doc" },
            },
          ],
        },
      },
      // Update payload on existing points
      {
        set_payload: {
          payload: { reviewed: true },
          points: ["existing-1", "existing-2"],
        },
      },
      // Delete old points
      {
        delete: {
          points: ["old-1", "old-2"],
        },
      },
    ],
  });
}

export { batchOperations };
```

**Why good:** Multiple operation types in one atomic request, reduces network round-trips, `wait: true` for consistency

---

## Create and Recover Snapshots

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

// Create a snapshot for backup
async function backupCollection(
  client: QdrantClient,
  collectionName: string,
): Promise<string> {
  const snapshot = await client.createSnapshot(collectionName);
  console.log("Snapshot created:", snapshot.name, "size:", snapshot.size);
  return snapshot.name;
}

// List available snapshots
async function listBackups(
  client: QdrantClient,
  collectionName: string,
): Promise<void> {
  const snapshots = await client.listSnapshots(collectionName);
  for (const snap of snapshots) {
    console.log(snap.name, snap.creation_time, snap.size);
  }
}

// Recover from a snapshot URL
async function restoreCollection(
  client: QdrantClient,
  collectionName: string,
  snapshotUrl: string,
): Promise<void> {
  await client.recoverSnapshot(collectionName, {
    location: snapshotUrl,
  });
}

// Delete a snapshot
async function deleteBackup(
  client: QdrantClient,
  collectionName: string,
  snapshotName: string,
): Promise<void> {
  await client.deleteSnapshot(collectionName, snapshotName);
}

export { backupCollection, listBackups, restoreCollection, deleteBackup };
```

**Why good:** Complete snapshot lifecycle (create, list, recover, delete), named exports

**Gotcha:** Snapshot recovery requires matching Qdrant minor versions. A v1.14.x snapshot cannot be restored to a v1.15.x cluster. Always verify version compatibility before recovery.

---

## Full Instance Snapshot

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

async function fullBackup(client: QdrantClient): Promise<string> {
  const snapshot = await client.createFullSnapshot();
  console.log("Full snapshot:", snapshot.name);
  return snapshot.name;
}

async function listFullBackups(client: QdrantClient): Promise<void> {
  const snapshots = await client.listFullSnapshots();
  for (const snap of snapshots) {
    console.log(snap.name, snap.creation_time, snap.size);
  }
}

export { fullBackup, listFullBackups };
```

**Why good:** Backs up ALL collections in one snapshot, useful for disaster recovery

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
