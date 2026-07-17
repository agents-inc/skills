# Caching Strategies - Core Examples

> Cache-aside, write-through, HTTP caching headers, TTL patterns, in-memory LRU caching. See [advanced.md](advanced.md) for invalidation, stampede prevention, and distributed caching patterns.

---

## Cache-Aside with Generic Wrapper

A reusable cache-aside wrapper that handles cache miss, fetch, store, and TTL in one function.

```typescript
// Good Example - Generic cache-aside wrapper
const DEFAULT_TTL_SECONDS = 300;

async function cacheable<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const cached = await cacheStore.get(cacheKey);
  if (cached) return JSON.parse(cached) as T;

  const data = await fetchFn();
  await cacheStore.set(cacheKey, JSON.stringify(data), { ttl: ttlSeconds });
  return data;
}

// Usage
const PRODUCT_TTL = 3600;
const PRODUCT_PREFIX = "app:product";

async function getProduct(id: string): Promise<Product | null> {
  return cacheable<Product | null>(
    `${PRODUCT_PREFIX}:${id}`,
    () => db.query.products.findFirst({ where: eq(products.id, id) }),
    PRODUCT_TTL,
  );
}

export { cacheable, getProduct };
```

**Why good:** Separates caching concern from business logic, configurable TTL per call, generic works with any data type, namespaced keys

```typescript
// Bad Example - Cache logic mixed with business logic, no TTL
async function getProduct(id: string) {
  try {
    const cached = await cacheStore.get(id);
    if (cached) return JSON.parse(cached);
  } catch {
    // Silently swallow -- cache failure hides bugs
  }

  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  await cacheStore.set(id, JSON.stringify(product)); // No TTL
  return product;
}
```

**Why bad:** No TTL means data never expires, generic key collides with other entity types, silently swallowing cache errors hides connection problems, caching logic mixed with data access

---

## Cache-Aside with Error Handling

When the cache store is unavailable, the application should still work -- fall through to the data source.

```typescript
// Good Example - Cache failure falls through to data source
const USER_TTL = 300;
const USER_PREFIX = "app:user";

async function getUserById(userId: string): Promise<User | null> {
  const cacheKey = `${USER_PREFIX}:${userId}`;

  // Cache read failure is non-fatal -- fall through to database
  try {
    const cached = await cacheStore.get(cacheKey);
    if (cached) return JSON.parse(cached) as User;
  } catch (error) {
    logger.warn("Cache read failed, falling through to database", {
      key: cacheKey,
      error: getErrorMessage(error),
    });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  // Cache write failure is non-fatal -- data was still fetched successfully
  try {
    await cacheStore.set(cacheKey, JSON.stringify(user), { ttl: USER_TTL });
  } catch (error) {
    logger.warn("Cache write failed", {
      key: cacheKey,
      error: getErrorMessage(error),
    });
  }

  return user;
}
```

**Why good:** Application degrades gracefully when cache is down, cache errors are logged (not silently swallowed), database is the source of truth

---

## Write-Through with Delete on Remove

```typescript
// Good Example - Write-through: update cache on mutation, delete on remove
const CACHE_TTL = 300;
const USER_PREFIX = "app:user";

async function updateUser(
  userId: string,
  updates: Partial<User>,
): Promise<User> {
  // Update database first (source of truth)
  const [updatedUser] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  // Write-through: update cache immediately
  const cacheKey = `${USER_PREFIX}:${userId}`;
  await cacheStore.set(cacheKey, JSON.stringify(updatedUser), {
    ttl: CACHE_TTL,
  });

  return updatedUser;
}

async function deleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));

  // Invalidate cache on delete
  const cacheKey = `${USER_PREFIX}:${userId}`;
  await cacheStore.del(cacheKey);
}

export { updateUser, deleteUser };
```

**Why good:** Cache always reflects latest database state after writes, explicit invalidation on delete prevents stale reads, TTL still set as safety net

```typescript
// Bad Example - Update database but forget to update cache
async function updateUser(userId: string, updates: Partial<User>) {
  await db.update(users).set(updates).where(eq(users.id, userId));
  // Cache still has old data until TTL expires!
}
```

**Why bad:** Stale cache serves outdated data until TTL expires, users see old values after saving changes

---

## HTTP Caching: Cache-Control Headers

Setting appropriate Cache-Control headers on API responses reduces requests to your server entirely.

```typescript
// Good Example - Cache-Control for different API endpoint types

// Public list endpoint -- CDN can cache, browser caches briefly
const LIST_MAX_AGE = 60;
const LIST_S_MAXAGE = 300;
const LIST_SWR = 60;

function setPublicListHeaders(res: Response): void {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${LIST_MAX_AGE}, s-maxage=${LIST_S_MAXAGE}, stale-while-revalidate=${LIST_SWR}`,
  );
}

// User-specific endpoint -- private cache only, always revalidate
function setPrivateHeaders(res: Response): void {
  res.setHeader("Cache-Control", "private, no-cache");
}

// Sensitive data -- never cache
function setNoCacheHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
}
```

**Why good:** Different endpoints get appropriate caching strategies, `s-maxage` lets CDN cache longer than browser, `stale-while-revalidate` improves availability during refresh

---

## HTTP Caching: ETag and Conditional Requests

ETags enable conditional requests -- the server can respond with 304 Not Modified when data hasn't changed, saving bandwidth and serialization cost.

```typescript
// Good Example - ETag generation and conditional request handling
import { createHash } from "node:crypto";

function generateETag(body: unknown): string {
  const content = JSON.stringify(body);
  const hash = createHash("md5").update(content).digest("hex");
  return `"${hash}"`;
}

// Middleware or route handler for conditional responses
async function handleConditionalGet(
  req: Request,
  res: Response,
  body: unknown,
): Promise<boolean> {
  const etag = generateETag(body);
  res.setHeader("ETag", etag);

  const clientETag = req.headers["if-none-match"];
  if (clientETag === etag) {
    res.status(304).end();
    return true; // Response already sent
  }

  return false; // Caller should send the full response
}

// Usage in a route handler
async function getProducts(req: Request, res: Response) {
  const products = await db.query.products.findMany();

  const notModified = await handleConditionalGet(req, res, products);
  if (notModified) return;

  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  res.json(products);
}

export { generateETag, handleConditionalGet };
```

**Why good:** 304 responses save bandwidth (no body), ETag based on content hash detects actual changes, separates conditional logic from route handler

**When to use:** Endpoints where the response body is expensive to transfer but cheap to check for changes (product listings, configuration data).

---

## CDN Caching with s-maxage

Use `s-maxage` to let CDNs (shared caches) cache responses longer than the browser. Combine with `stale-while-revalidate` for high availability.

```typescript
// Good Example - CDN-optimized cache headers
const BROWSER_MAX_AGE = 60; // Browser: 1 minute
const CDN_MAX_AGE = 300; // CDN: 5 minutes
const SWR_WINDOW = 60; // Serve stale for 60s while refreshing
const ERROR_WINDOW = 600; // Serve stale for 10m during origin errors

function setCDNCacheHeaders(res: Response): void {
  res.setHeader(
    "Cache-Control",
    [
      "public",
      `max-age=${BROWSER_MAX_AGE}`,
      `s-maxage=${CDN_MAX_AGE}`,
      `stale-while-revalidate=${SWR_WINDOW}`,
      `stale-if-error=${ERROR_WINDOW}`,
    ].join(", "),
  );
}
```

**Why good:** `s-maxage` overrides `max-age` for CDNs only, `stale-while-revalidate` ensures users never wait for origin refresh, `stale-if-error` provides resilience during origin outages

---

## In-Memory LRU Cache

For single-process hot data. Faster than a distributed cache (no network hop) but not shared across instances.

```typescript
// Good Example - LRU cache for hot data (lru-cache v11+)
import { LRUCache } from "lru-cache";

const MAX_ITEMS = 500;
const TTL_MS = 300_000; // 5 minutes

interface CachedConfig {
  value: string;
  updatedAt: Date;
}

const configCache = new LRUCache<string, CachedConfig>({
  max: MAX_ITEMS,
  ttl: TTL_MS,
});

function getCachedConfig(key: string): CachedConfig | undefined {
  return configCache.get(key);
}

function setCachedConfig(key: string, config: CachedConfig): void {
  configCache.set(key, config);
}

export { getCachedConfig, setCachedConfig };
```

**Why good:** No serialization overhead (stores objects directly), automatic LRU eviction when max reached, TTL prevents staleness, type-safe with generics

```typescript
// Bad Example - Unbounded Map as cache
const cache = new Map<string, unknown>(); // No max size, no TTL

function getCached(key: string) {
  return cache.get(key); // Never evicted, never expires
}

function setCached(key: string, value: unknown) {
  cache.set(key, value); // Memory grows without bound
}
```

**Why bad:** No size limit means memory grows unbounded, no TTL means data is stale forever, no eviction policy means the cache fills up and never frees memory

---

## LRU Cache with Fetch Method

The `fetch` option in lru-cache provides built-in cache-aside behavior -- on a miss, it calls your fetch function automatically.

```typescript
// Good Example - LRU cache with automatic fetch on miss
import { LRUCache } from "lru-cache";

const MAX_ITEMS = 200;
const TTL_MS = 60_000; // 1 minute

const featureFlagCache = new LRUCache<string, boolean>({
  max: MAX_ITEMS,
  ttl: TTL_MS,
  // Called automatically on cache miss
  fetchMethod: async (key) => {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.key, key),
    });
    return flag?.enabled ?? false;
  },
});

// Usage: fetch() returns cached value or calls fetchMethod
async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const result = await featureFlagCache.fetch(flagKey);
  return result ?? false;
}

export { isFeatureEnabled };
```

**Why good:** Cache-aside logic is built into the cache itself, no manual get/set coordination, fetch is deduplicated (concurrent calls for the same key share one fetch)

---

## TTL Strategy by Data Type

```typescript
// Named constants for TTL values -- document the rationale
const TTL = {
  /** Static config that changes via deploy */
  STATIC_CONFIG: 3600,

  /** Product catalog updated by admin */
  PRODUCT: 300,

  /** User profile updated by user */
  USER_PROFILE: 60,

  /** Search results -- balance freshness vs performance */
  SEARCH: 30,

  /** Real-time data -- near-fresh */
  REALTIME: 10,

  /** Session data -- long-lived by design */
  SESSION: 86400,
} as const;

export { TTL };
```

**Why good:** Named constants with comments make TTL decisions explicit, `as const` preserves literal types, centralized TTL values prevent inconsistency across the codebase

---

## Cache Key Generation

```typescript
// Good Example - Structured cache key generation
import { createHash } from "node:crypto";

const CACHE_PREFIX = "myapp";

// Entity keys: prefix:type:id
const cacheKeys = {
  user: (id: string) => `${CACHE_PREFIX}:user:${id}`,
  product: (id: string) => `${CACHE_PREFIX}:product:${id}`,
  cart: (userId: string) => `${CACHE_PREFIX}:cart:${userId}`,

  // Query result keys: hash the normalized query params
  productList: (filters: Record<string, unknown>) => {
    // Sort keys for deterministic hashing
    const sorted = JSON.stringify(filters, Object.keys(filters).sort());
    const hash = createHash("md5").update(sorted).digest("hex");
    return `${CACHE_PREFIX}:products:list:${hash}`;
  },

  // Pattern for bulk invalidation
  userPattern: (userId: string) => `${CACHE_PREFIX}:user:${userId}:*`,
} as const;

export { cacheKeys, CACHE_PREFIX };
```

**Why good:** Consistent prefix prevents cross-application collisions, hierarchical keys enable pattern-based invalidation, sorted JSON ensures deterministic hashing regardless of property insertion order

---

## See Also

- [advanced.md](advanced.md) - Cache invalidation, stampede prevention, distributed caching
