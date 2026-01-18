# Caching Examples

Redis caching patterns for backend performance optimization.

---

## Redis Connection Setup

```typescript
// Good Example - Redis client with reconnection
import { createClient } from "redis";

const REDIS_RETRY_DELAY_MS = 1000;
const REDIS_MAX_RETRIES = 10;

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > REDIS_MAX_RETRIES) {
        console.error("Redis max retries reached, stopping reconnection");
        return new Error("Max retries reached");
      }
      return REDIS_RETRY_DELAY_MS * Math.pow(2, retries); // Exponential backoff
    },
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("connect", () => console.log("Redis connected"));
redisClient.on("reconnecting", () => console.log("Redis reconnecting..."));

async function initializeRedis() {
  if (redisClient.isOpen) return redisClient;
  await redisClient.connect();
  return redisClient;
}

async function shutdownRedis() {
  await redisClient.quit();
}

export { redisClient, initializeRedis, shutdownRedis };
```

**Why good:** Exponential backoff prevents hammering Redis during outages, named constants for configuration, error/connect events enable observability, graceful shutdown support

---

## Cache-Aside Pattern

The most common caching pattern. Check cache first, fetch from database on miss, store in cache.

```typescript
// Good Example - Cache-aside with TTL
import { redisClient } from "./redis";
import { db, users } from "./database";
import { eq } from "drizzle-orm";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = "app:user";

interface User {
  id: string;
  email: string;
  name: string;
}

async function getUserById(userId: string): Promise<User | null> {
  const cacheKey = `${CACHE_PREFIX}:${userId}`;

  // Check cache first
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as User;
  }

  // Cache miss - fetch from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return null;

  // Store in cache with TTL
  await redisClient.set(cacheKey, JSON.stringify(user), {
    EX: CACHE_TTL_SECONDS,
  });

  return user;
}

export { getUserById };
```

**Why good:** TTL prevents stale data accumulation, namespaced cache keys prevent collisions, early return on cache hit for performance

```typescript
// Bad Example - No TTL, generic keys
async function getUser(id: string) {
  const cached = await redis.get(id); // Generic key
  if (cached) return JSON.parse(cached);

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  await redis.set(id, JSON.stringify(user)); // No TTL!
  return user;
}
```

**Why bad:** No TTL means data never expires (memory exhaustion + infinite staleness), generic key could collide with other data types

---

## Write-Through Pattern

Update cache immediately when data changes to maintain consistency.

```typescript
// Good Example - Write-through caching
const CACHE_TTL_SECONDS = 300;

async function updateUserProfile(
  userId: string,
  updates: Partial<User>,
): Promise<User> {
  // Update database first
  const [updatedUser] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  // Immediately update cache (write-through)
  const cacheKey = `${CACHE_PREFIX}:${userId}`;
  await redisClient.set(cacheKey, JSON.stringify(updatedUser), {
    EX: CACHE_TTL_SECONDS,
  });

  return updatedUser;
}

async function deleteUser(userId: string): Promise<void> {
  // Delete from database
  await db.delete(users).where(eq(users.id, userId));

  // Invalidate cache
  const cacheKey = `${CACHE_PREFIX}:${userId}`;
  await redisClient.del(cacheKey);
}
```

**Why good:** Cache always reflects database state, no stale reads after updates, explicit invalidation on delete

---

## Caching Middleware

Reusable middleware for Express/Hono route caching.

```typescript
// Good Example - Caching middleware
import type { Context, Next } from "hono";

interface CacheOptions {
  ttlSeconds: number;
  keyPrefix: string;
}

const DEFAULT_CACHE_TTL = 300;

function createCacheMiddleware(options: CacheOptions) {
  return async (c: Context, next: Next) => {
    const cacheKey = `${options.keyPrefix}:${c.req.url}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { body, headers } = JSON.parse(cached);
      // Set cached headers
      Object.entries(headers).forEach(([key, value]) => {
        c.header(key, value as string);
      });
      c.header("X-Cache", "HIT");
      return c.json(body);
    }

    // Cache miss - continue to handler
    await next();

    // Only cache successful responses
    if (c.res.status >= 200 && c.res.status < 300) {
      const body = await c.res.clone().json();
      const headers = Object.fromEntries(c.res.headers.entries());

      await redisClient.set(
        cacheKey,
        JSON.stringify({ body, headers }),
        { EX: options.ttlSeconds || DEFAULT_CACHE_TTL },
      );
      c.header("X-Cache", "MISS");
    }
  };
}

// Usage
app.get(
  "/api/products",
  createCacheMiddleware({ ttlSeconds: 600, keyPrefix: "api" }),
  async (c) => {
    const products = await db.query.products.findMany();
    return c.json(products);
  },
);
```

**Why good:** Reusable across routes, only caches successful responses, X-Cache header for debugging, configurable TTL per route

---

## Cache Key Strategies

```typescript
// Good Example - Structured cache keys
const CACHE_PREFIX = "myapp";

// Simple entity caching
const userKey = (id: string) => `${CACHE_PREFIX}:user:${id}`;
const productKey = (id: string) => `${CACHE_PREFIX}:product:${id}`;

// Query result caching (include query params in key)
const productListKey = (filters: ProductFilters) => {
  const normalized = JSON.stringify({
    category: filters.category || "all",
    minPrice: filters.minPrice || 0,
    maxPrice: filters.maxPrice || Infinity,
    page: filters.page || 1,
  });
  // Hash for shorter keys
  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  return `${CACHE_PREFIX}:products:list:${hash}`;
};

// User-specific caching
const userCartKey = (userId: string) => `${CACHE_PREFIX}:cart:${userId}`;

// Pattern for bulk invalidation
const userPattern = (userId: string) => `${CACHE_PREFIX}:user:${userId}:*`;
```

**Why good:** Consistent prefix prevents collisions with other apps, hierarchical structure enables pattern-based invalidation, hashing complex queries keeps keys manageable

---

## Cache Invalidation Patterns

### 1. Direct Invalidation

```typescript
// Delete specific key on update
async function updateProduct(id: string, data: ProductUpdate) {
  await db.update(products).set(data).where(eq(products.id, id));
  await redisClient.del(productKey(id));

  // Also invalidate list caches that might contain this product
  const listPattern = `${CACHE_PREFIX}:products:list:*`;
  const keys = await redisClient.keys(listPattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
}
```

### 2. TTL-Based Expiration

```typescript
// Let TTL handle expiration - simpler but allows staleness
const SHORT_TTL = 60; // 1 minute for frequently changing data
const MEDIUM_TTL = 300; // 5 minutes for user data
const LONG_TTL = 3600; // 1 hour for static content
```

### 3. Tag-Based Invalidation

```typescript
// Good Example - Tag-based cache invalidation
async function setWithTags(
  key: string,
  value: string,
  ttl: number,
  tags: string[],
) {
  // Store the value
  await redisClient.set(key, value, { EX: ttl });

  // Add key to each tag set
  for (const tag of tags) {
    await redisClient.sAdd(`tag:${tag}`, key);
    await redisClient.expire(`tag:${tag}`, ttl);
  }
}

async function invalidateByTag(tag: string) {
  const keys = await redisClient.sMembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redisClient.del(keys);
    await redisClient.del(`tag:${tag}`);
  }
}

// Usage
await setWithTags(
  productKey("123"),
  JSON.stringify(product),
  MEDIUM_TTL,
  ["category:electronics", "brand:apple"],
);

// Invalidate all electronics products
await invalidateByTag("category:electronics");
```

**Why good:** Enables invalidating related cached items without knowing exact keys, useful for category/relationship-based invalidation

---

## TTL Best Practices

| Data Type | Recommended TTL | Rationale |
|-----------|-----------------|-----------|
| User session | 86400s (24h) | Balance security vs convenience |
| User profile | 300s (5m) | Changes infrequently |
| Product catalog | 3600s (1h) | Infrequent updates |
| Search results | 60s (1m) | Balance freshness vs performance |
| Real-time data | 10-30s | Need fresh data |
| Static config | 86400s+ | Rarely changes |

**TTL Anti-Patterns:**
- ❌ No TTL (infinite cache) - Memory exhaustion, infinite staleness
- ❌ Very short TTL everywhere (< 10s) - Defeats caching purpose
- ❌ Same TTL for all data - Different data has different freshness needs

---

## See Also

- [database.md](database.md) - Query optimization and connection pooling
- [async.md](async.md) - Event loop and worker threads
