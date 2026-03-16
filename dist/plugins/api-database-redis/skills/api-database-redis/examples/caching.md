# Redis -- Caching Pattern Examples

> Cache-aside, write-through, invalidation, stampede prevention, and multi-key cache patterns. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [setup.md](setup.md) -- Connection setup, pipelining, transactions
- [data-structures.md](data-structures.md) -- Hashes, lists, sets, sorted sets
- [sessions.md](sessions.md) -- Session storage patterns

---

## Cache-Aside with Generic Helper

```typescript
import type Redis from "ioredis";

const DEFAULT_CACHE_TTL_SECONDS = 300; // 5 minutes

interface CacheResult<T> {
  data: T;
  fromCache: boolean;
}

async function cacheAside<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
): Promise<CacheResult<T>> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return { data: JSON.parse(cached) as T, fromCache: true };
    }
  } catch (err) {
    // Cache read failure -- proceed to fetch from source
    console.error(`Cache read failed for ${key}:`, (err as Error).message);
  }

  const data = await fetcher();

  // Non-blocking cache write
  redis.set(key, JSON.stringify(data), "EX", ttlSeconds).catch((err) => {
    console.error(`Cache write failed for ${key}:`, err.message);
  });

  return { data, fromCache: false };
}

export { cacheAside };
export type { CacheResult };
```

**Why good:** Graceful degradation on cache read failure, non-blocking write prevents cache failure from blocking response, typed return distinguishes cache hit from miss

---

## Write-Through Cache

```typescript
import type Redis from "ioredis";

const PRODUCT_CACHE_PREFIX = "cache:product:";
const PRODUCT_CACHE_TTL_SECONDS = 600; // 10 minutes

async function writeThrough<T extends { id: string }>(
  redis: Redis,
  entity: T,
  dbWriter: (entity: T) => Promise<T>,
): Promise<T> {
  // 1. Write to database first (source of truth)
  const saved = await dbWriter(entity);

  // 2. Update cache with fresh data
  const key = `${PRODUCT_CACHE_PREFIX}${saved.id}`;
  await redis.set(key, JSON.stringify(saved), "EX", PRODUCT_CACHE_TTL_SECONDS);

  return saved;
}

export { writeThrough };
```

**When to use:** Write-heavy applications where consistency matters more than cache hit rate.

**When not to use:** Read-heavy applications with rare writes -- cache-aside with TTL is simpler and sufficient.

---

## Cache Invalidation (Write-Through with Delete)

```typescript
import type Redis from "ioredis";

const PRODUCT_CACHE_PREFIX = "cache:product:";
const PRODUCT_LIST_CACHE_KEY = "cache:products:list";
const PRODUCT_CACHE_TTL = 600; // 10 minutes

async function updateProduct(
  redis: Redis,
  productId: string,
  updates: Partial<Product>,
): Promise<Product> {
  // 1. Update database (source of truth)
  const updated = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, productId))
    .returning();

  // 2. Invalidate specific cache entry
  await redis.del(`${PRODUCT_CACHE_PREFIX}${productId}`);

  // 3. Invalidate list cache (stale after update)
  await redis.del(PRODUCT_LIST_CACHE_KEY);

  return updated[0];
}

async function deleteProduct(redis: Redis, productId: string): Promise<void> {
  await db.delete(products).where(eq(products.id, productId));

  // Invalidate all related cache keys using pattern
  const keys = await redis.keys(`${PRODUCT_CACHE_PREFIX}${productId}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export { updateProduct, deleteProduct };
```

**Why good:** Database is always updated first (source of truth), both specific and list caches invalidated, pattern-based deletion for related keys

---

## Multi-Key Cache with Pipeline

```typescript
import type Redis from "ioredis";

const CACHE_PREFIX = "cache:user:";
const CACHE_TTL_SECONDS = 300;

async function getMultipleFromCache(
  redis: Redis,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const pipeline = redis.pipeline();
  for (const id of userIds) {
    pipeline.get(`${CACHE_PREFIX}${id}`);
  }

  const results = await pipeline.exec();
  if (!results) {
    throw new Error("Pipeline execution returned null");
  }

  const cache = new Map<string, string | null>();
  for (let i = 0; i < userIds.length; i++) {
    const [err, value] = results[i];
    cache.set(userIds[i], err ? null : (value as string | null));
  }

  return cache;
}

async function setMultipleInCache(
  redis: Redis,
  entries: Array<{ id: string; data: unknown }>,
): Promise<void> {
  const pipeline = redis.pipeline();
  for (const entry of entries) {
    pipeline.set(
      `${CACHE_PREFIX}${entry.id}`,
      JSON.stringify(entry.data),
      "EX",
      CACHE_TTL_SECONDS,
    );
  }
  await pipeline.exec();
}

export { getMultipleFromCache, setMultipleInCache };
```

**Why good:** Pipeline reduces multiple GET/SET calls to single round-trip, error handling per result, typed Map return

---

## Cache Stampede Prevention (Singleflight)

Prevents multiple processes from regenerating the same cache entry simultaneously.

```typescript
import type Redis from "ioredis";

const LOCK_TTL_SECONDS = 10;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_RETRIES = 20;

async function cacheAsideWithLock<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  // Check cache first
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  // Try to acquire lock
  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(
    lockKey,
    "1",
    "EX",
    LOCK_TTL_SECONDS,
    "NX",
  );

  if (lockAcquired === "OK") {
    try {
      // We have the lock -- fetch and populate cache
      const data = await fetcher();
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      return data;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Another process is fetching -- wait and retry cache read
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    const result = await redis.get(key);
    if (result !== null) {
      return JSON.parse(result) as T;
    }
  }

  // Lock expired, cache still empty -- fall back to direct fetch
  return fetcher();
}

export { cacheAsideWithLock };
```

**Why good:** NX flag prevents multiple processes from acquiring the lock, lock has TTL to prevent deadlocks if process crashes, fallback to direct fetch if lock holder fails

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
