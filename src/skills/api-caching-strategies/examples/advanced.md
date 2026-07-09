# Caching Strategies - Advanced Examples

> Cache invalidation, stampede prevention, distributed caching, write-behind. See [core.md](core.md) for cache-aside, HTTP caching, and TTL patterns.

---

## Tag-Based Cache Invalidation

Group related cache keys by tag to invalidate entire categories of cached data at once.

```typescript
// Good Example - Tag-based cache invalidation
async function setWithTags(
  key: string,
  value: string,
  ttl: number,
  tags: string[],
): Promise<void> {
  await cacheStore.set(key, value, { ttl });

  // Add key to each tag's set
  for (const tag of tags) {
    await cacheStore.sAdd(`tag:${tag}`, key);
    await cacheStore.expire(`tag:${tag}`, ttl);
  }
}

async function invalidateByTag(tag: string): Promise<number> {
  const keys = await cacheStore.sMembers(`tag:${tag}`);
  if (keys.length === 0) return 0;

  await cacheStore.del(keys);
  await cacheStore.del(`tag:${tag}`);
  return keys.length;
}

// Usage
const PRODUCT_TTL = 3600;

await setWithTags("myapp:product:123", JSON.stringify(product), PRODUCT_TTL, [
  "category:electronics",
  "brand:apple",
]);

// When electronics category changes -- invalidate all electronics products
const invalidated = await invalidateByTag("category:electronics");

export { setWithTags, invalidateByTag };
```

**Why good:** Enables invalidating related items without knowing exact keys, tag sets auto-expire with TTL, useful for category or relationship-based invalidation

---

## Pattern-Based Key Deletion

For cache stores that support key scanning (pattern matching), delete all keys matching a prefix.

```typescript
// Good Example - Pattern-based invalidation
const SCAN_BATCH_SIZE = 100;

async function invalidateByPattern(pattern: string): Promise<number> {
  let cursor = "0";
  let totalDeleted = 0;

  do {
    // SCAN is non-blocking (unlike KEYS which blocks for large datasets)
    const [nextCursor, keys] = await cacheStore.scan(cursor, {
      match: pattern,
      count: SCAN_BATCH_SIZE,
    });
    cursor = nextCursor;

    if (keys.length > 0) {
      await cacheStore.del(keys);
      totalDeleted += keys.length;
    }
  } while (cursor !== "0");

  return totalDeleted;
}

// Invalidate all cached data for a specific user
await invalidateByPattern("myapp:user:456:*");

export { invalidateByPattern };
```

**Why good:** SCAN is non-blocking (unlike KEYS), processes in batches to avoid memory spikes, returns count for monitoring

**When to use:** Invalidating all keys related to an entity (user sessions, user preferences, user cart). **When not to use:** Frequent invalidation of large key sets -- tag-based invalidation is more efficient.

---

## Stampede Prevention: Distributed Lock

Only one request regenerates the cache; others wait or receive stale data. Uses atomic set-if-not-exists for lock acquisition.

```typescript
// Good Example - Stampede prevention with distributed lock
const LOCK_TTL_SECONDS = 10;
const RETRY_DELAY_MS = 50;
const MAX_RETRIES = 20;

async function getWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
): Promise<T> {
  // Try cache first
  const cached = await cacheStore.get(key);
  if (cached) return JSON.parse(cached) as T;

  // Attempt to acquire lock (atomic set-if-not-exists)
  const lockKey = `lock:${key}`;
  const acquired = await cacheStore.set(lockKey, "1", {
    ttl: LOCK_TTL_SECONDS,
    nx: true, // Only set if key does not exist
  });

  if (acquired) {
    // Lock holder: fetch data, populate cache, release lock
    try {
      const data = await fetchFn();
      await cacheStore.set(key, JSON.stringify(data), { ttl });
      return data;
    } finally {
      await cacheStore.del(lockKey);
    }
  }

  // Non-holder: wait and retry
  for (let i = 0; i < MAX_RETRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const retryResult = await cacheStore.get(key);
    if (retryResult) return JSON.parse(retryResult) as T;
  }

  // Fallback: lock holder may have failed -- fetch directly
  return fetchFn();
}

export { getWithLock };
```

**Why good:** Lock has TTL so it auto-releases if holder crashes, atomic `nx` prevents race conditions, fallback to direct fetch prevents permanent stalls, bounded retries prevent infinite waits

---

## Stampede Prevention: Request Coalescing (Singleflight)

In-process deduplication -- concurrent requests for the same key share a single fetch instead of each making their own.

```typescript
// Good Example - In-process request coalescing (singleflight pattern)
const inFlightRequests = new Map<string, Promise<unknown>>();

async function coalesce<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetchFn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

// Usage with cache-aside
const PRODUCT_TTL = 3600;

async function getProduct(id: string): Promise<Product> {
  const cacheKey = `app:product:${id}`;
  const cached = await cacheStore.get(cacheKey);
  if (cached) return JSON.parse(cached) as Product;

  // All concurrent requests for the same product share one fetch
  const product = await coalesce(cacheKey, async () => {
    const result = await db.query.products.findFirst({
      where: eq(products.id, id),
    });
    if (!result) throw new Error(`Product ${id} not found`);

    await cacheStore.set(cacheKey, JSON.stringify(result), {
      ttl: PRODUCT_TTL,
    });
    return result;
  });

  return product;
}

export { coalesce };
```

**Why good:** Zero external dependencies (in-process Map), concurrent requests share one fetch (N requests = 1 database query), promise cleaned up automatically via `finally`, simpler than distributed locking

**When to use:** Single-process applications or when stampedes happen within a single instance. **When not to use:** Multi-instance deployments where the stampede spans across processes (use distributed locking instead).

---

## Stampede Prevention: Probabilistic Early Recomputation

Proactively refresh cache entries before they expire. Each access has an increasing probability of triggering background refresh as the TTL approaches expiration.

```typescript
// Good Example - Probabilistic early recomputation
const EARLY_RECOMPUTE_FACTOR = 0.1; // Start refreshing at 10% remaining TTL

interface CachedEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in ms
  ttlMs: number; // Original TTL for probability calculation
}

async function getWithEarlyRefresh<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const raw = await cacheStore.get(key);

  if (raw) {
    const entry = JSON.parse(raw) as CachedEntry<T>;
    const remainingMs = entry.expiresAt - Date.now();
    const remainingFraction = remainingMs / entry.ttlMs;

    // Probability of refresh increases as TTL approaches expiration
    if (
      remainingFraction < EARLY_RECOMPUTE_FACTOR &&
      Math.random() > remainingFraction
    ) {
      // Background refresh -- don't await, serve stale data immediately
      refreshInBackground(key, fetchFn, ttlMs);
    }

    return entry.data;
  }

  // Cache miss -- fetch synchronously
  return fetchAndStore(key, fetchFn, ttlMs);
}

async function fetchAndStore<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const data = await fetchFn();
  const entry: CachedEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
    ttlMs,
  };
  const ttlSeconds = Math.ceil(ttlMs / 1000);
  await cacheStore.set(key, JSON.stringify(entry), { ttl: ttlSeconds });
  return data;
}

function refreshInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number,
): void {
  fetchAndStore(key, fetchFn, ttlMs).catch((error) => {
    logger.warn("Background cache refresh failed", {
      key,
      error: getErrorMessage(error),
    });
  });
}

export { getWithEarlyRefresh };
```

**Why good:** Responses are never delayed by cache regeneration (always serves cached data), probability-based approach distributes refresh across time (avoids all entries refreshing simultaneously), background failures don't affect current request

**When to use:** High-traffic keys where even brief cache misses cause noticeable load spikes. **When not to use:** Low-traffic keys where the extra complexity is not justified.

---

## Write-Behind (Write-Back) Pattern

Write to cache immediately, persist to database asynchronously. Improves write latency at the cost of temporary inconsistency and data loss risk.

```typescript
// Good Example - Write-behind with buffered persistence
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BUFFER_SIZE = 100;

interface PendingWrite {
  key: string;
  value: unknown;
  timestamp: number;
}

class WriteBuffer {
  private buffer: PendingWrite[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly persistFn: (writes: PendingWrite[]) => Promise<void>,
  ) {}

  add(key: string, value: unknown): void {
    this.buffer.push({ key, value, timestamp: Date.now() });

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) return;

    const writes = [...this.buffer];
    this.buffer = [];

    try {
      await this.persistFn(writes);
    } catch (error) {
      // Re-queue failed writes for retry
      logger.error("Write-behind flush failed, re-queuing", {
        count: writes.length,
        error: getErrorMessage(error),
      });
      this.buffer.unshift(...writes);
    }
  }

  /** Call on process shutdown to persist remaining writes */
  async shutdown(): Promise<void> {
    await this.flush();
  }
}

// Usage
const writeBuffer = new WriteBuffer(async (writes) => {
  // Batch insert/update in a single transaction
  await db.transaction(async (tx) => {
    for (const write of writes) {
      await tx.insert(analytics).values(write.value as AnalyticsEvent);
    }
  });
});

// Write is instant -- only updates cache, buffers the database write
async function trackEvent(event: AnalyticsEvent): Promise<void> {
  const cacheKey = `app:event:${event.id}`;
  await cacheStore.set(cacheKey, JSON.stringify(event), { ttl: 3600 });
  writeBuffer.add(cacheKey, event);
}

// Register shutdown handler
process.on("SIGTERM", async () => {
  await writeBuffer.shutdown();
  process.exit(0);
});

export { WriteBuffer, trackEvent };
```

**Why good:** Write latency is minimal (only cache write), batched persistence reduces database round-trips, failed writes are re-queued, shutdown handler flushes remaining buffer

**When to use:** Analytics, logging, activity tracking -- write-heavy workloads where occasional data loss is acceptable. **When not to use:** Financial transactions, user data mutations, or anything requiring write durability guarantees.

---

## Cache Hit/Miss Monitoring

Track cache performance to verify caching is actually helping.

```typescript
// Good Example - Cache metrics wrapper
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
}

const metrics = new Map<string, CacheMetrics>();

function getMetrics(prefix: string): CacheMetrics {
  if (!metrics.has(prefix)) {
    metrics.set(prefix, { hits: 0, misses: 0, errors: 0 });
  }
  return metrics.get(prefix)!;
}

async function getCachedWithMetrics<T>(
  key: string,
  prefix: string,
  fetchFn: () => Promise<T>,
  ttl: number,
): Promise<T> {
  const m = getMetrics(prefix);

  try {
    const cached = await cacheStore.get(key);
    if (cached) {
      m.hits++;
      return JSON.parse(cached) as T;
    }
  } catch {
    m.errors++;
  }

  m.misses++;
  const data = await fetchFn();
  await cacheStore.set(key, JSON.stringify(data), { ttl });
  return data;
}

function getCacheStats(): Record<string, CacheMetrics & { hitRate: string }> {
  const stats: Record<string, CacheMetrics & { hitRate: string }> = {};
  for (const [prefix, m] of metrics) {
    const total = m.hits + m.misses;
    const hitRate =
      total > 0 ? `${((m.hits / total) * 100).toFixed(1)}%` : "N/A";
    stats[prefix] = { ...m, hitRate };
  }
  return stats;
}

export { getCachedWithMetrics, getCacheStats };
```

**Why good:** Per-prefix metrics show which caches are effective, hit rate calculation provides actionable data, error tracking surfaces cache connection issues

**Target cache hit rates:**

| Cache Type      | Good Hit Rate | Action if Below                              |
| --------------- | ------------- | -------------------------------------------- |
| User profile    | > 80%         | Increase TTL or check invalidation frequency |
| Product catalog | > 90%         | Cache may be too small (increase max items)  |
| Search results  | > 60%         | Expected lower rate due to query diversity   |

---

## See Also

- [core.md](core.md) - Cache-aside, HTTP caching, TTL patterns, in-memory LRU caching
