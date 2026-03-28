# Vercel KV / Upstash Redis -- Core Examples

> Essential patterns for serverless Redis via `@upstash/redis`. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for command quick reference.

---

## Client Setup

### Environment-Based (Preferred on Vercel)

```typescript
import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from process.env
const redis = Redis.fromEnv();

export { redis };
```

**Why good:** Zero-config on Vercel (env vars injected by Upstash integration), no secrets in code, single shared instance

### Explicit Configuration

```typescript
import { Redis } from "@upstash/redis";

function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required",
    );
  }

  return new Redis({ url, token });
}

export { createRedisClient };
```

**Why good:** Validates env vars before use, works outside Vercel, factory pattern for testability

### Disabling Auto-Deserialization

```typescript
import { Redis } from "@upstash/redis";

// Returns raw strings instead of parsed JSON
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false,
});
```

**When to use:** Only when you need raw string responses (e.g., interoperating with non-JSON data written by another client). Breaks many TypeScript types -- handle with care.

---

## Basic CRUD with Auto-Serialization

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Strings
await redis.set("greeting", "hello");
const greeting = await redis.get<string>("greeting"); // "hello"

// Objects are auto-serialized to JSON
interface Product {
  id: string;
  name: string;
  price: number;
}

const PRODUCT_TTL_SECONDS = 3600;

await redis.set(
  "product:abc",
  { id: "abc", name: "Widget", price: 29.99 } satisfies Product,
  { ex: PRODUCT_TTL_SECONDS },
);

const product = await redis.get<Product>("product:abc");
// product is Product | null -- fully deserialized, typed

// Delete
await redis.del("product:abc");

// Check existence
const exists = await redis.exists("product:abc"); // 0 or 1
```

**Why good:** Type parameter on `get<T>()` provides TypeScript safety, auto-serialization handles JSON round-trips, TTL prevents stale data

---

## Gotcha: Date Objects Do Not Survive Round-Trip

```typescript
// Bad Example -- Date becomes a string
interface Event {
  name: string;
  date: Date;
}

await redis.set("event:1", { name: "Launch", date: new Date() });
const event = await redis.get<Event>("event:1");
// event.date is a STRING like "2025-03-20T..." -- NOT a Date object
// event.date.getTime() will throw TypeError
```

**Why bad:** `JSON.stringify(new Date())` produces an ISO string, `JSON.parse` does not revive it back to a `Date`. Store timestamps as numbers instead:

```typescript
// Good Example -- Use epoch milliseconds for dates
interface Event {
  name: string;
  dateMs: number;
}

await redis.set("event:1", { name: "Launch", dateMs: Date.now() });
const event = await redis.get<Event>("event:1");
const date = new Date(event!.dateMs); // Reconstruct Date from number
```

---

## TTL Strategies

```typescript
const TTL_SHORT_SECONDS = 60; // 1 minute -- volatile/real-time data
const TTL_MEDIUM_SECONDS = 300; // 5 minutes -- API response cache
const TTL_LONG_SECONDS = 3600; // 1 hour -- user profiles, product data
const TTL_SESSION_SECONDS = 86400; // 24 hours -- sessions

// Set with TTL (preferred -- atomic)
await redis.set("cache:feed", feedData, { ex: TTL_MEDIUM_SECONDS });

// Set with millisecond TTL
await redis.set("cache:realtime", data, { px: 500 });

// Distributed lock: set only if not exists
const LOCK_TTL_SECONDS = 30;
const lockAcquired = await redis.set("lock:checkout:789", "owner-id", {
  ex: LOCK_TTL_SECONDS,
  nx: true,
});
// lockAcquired is "OK" if acquired, null if already held

// Update TTL on existing key
await redis.expire("cache:feed", TTL_LONG_SECONDS);

// Check remaining TTL
const remaining = await redis.ttl("cache:feed"); // seconds, -1 if no TTL, -2 if key missing
```

---

## Hash Operations

Hashes allow partial reads/writes without serializing entire objects.

```typescript
const USER_KEY_PREFIX = "user:";
const USER_TTL_SECONDS = 3600;

// Set multiple fields
await redis.hset(`${USER_KEY_PREFIX}123`, {
  name: "Alice",
  email: "alice@example.com",
  loginCount: "0", // Hash values are strings in Redis
});

// Read single field
const email = await redis.hget<string>(`${USER_KEY_PREFIX}123`, "email");

// Read all fields
const user = await redis.hgetall<Record<string, string>>(
  `${USER_KEY_PREFIX}123`,
);
// Returns null if key doesn't exist (unlike ioredis which returns {})

// Check for missing key
if (user === null) {
  // Key does not exist
}

// Atomic increment (useful for counters)
await redis.hincrby(`${USER_KEY_PREFIX}123`, "loginCount", 1);

// Delete specific fields
await redis.hdel(`${USER_KEY_PREFIX}123`, "email");

// Set TTL on the hash key
await redis.expire(`${USER_KEY_PREFIX}123`, USER_TTL_SECONDS);
```

**Why good:** Partial field reads avoid transferring entire object, `hincrby` is atomic, explicit TTL

---

## Pipelines (Non-Atomic Batch)

Batch multiple commands into a single HTTP request to reduce latency.

```typescript
const CACHE_TTL_SECONDS = 300;

// Pipeline -- commands are NOT atomic but execute in a single HTTP round-trip
const pipe = redis.pipeline();
pipe.set("user:1:name", "Alice", { ex: CACHE_TTL_SECONDS });
pipe.set("user:1:email", "alice@example.com", { ex: CACHE_TTL_SECONDS });
pipe.incr("stats:signups");
pipe.get<string>("config:feature-flag");

const [setResult1, setResult2, signupCount, featureFlag] =
  await pipe.exec<[string, string, number, string | null]>();
```

**Why good:** Single HTTP request regardless of command count, typed results via generic parameter, massive latency reduction

---

## Transactions (Atomic MULTI/EXEC)

Atomic execution -- all commands succeed or all fail.

```typescript
// Transfer balance atomically
const tx = redis.multi();
tx.decrby("balance:user1", 100);
tx.incrby("balance:user2", 100);

const [newBalance1, newBalance2] = await tx.exec<[number, number]>();
```

**Why good:** Atomic -- no interleaving between commands, single HTTP request

**Important:** Upstash REST transactions do NOT support `WATCH` for optimistic locking. If you need conditional updates based on current values, use Lua scripts or redesign with atomic commands (`incr`, `setnx`).

---

## Rate Limiting (Sliding Window)

```typescript
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_KEY_PREFIX = "ratelimit:";

interface RateLimitResult {
  limited: boolean;
  remaining: number;
}

async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const key = `${RATE_LIMIT_KEY_PREFIX}${identifier}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart); // Remove expired entries
  pipe.zcard(key); // Count current window
  pipe.zadd(key, { score: now, member: `${now}-${Math.random()}` }); // Add request
  pipe.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)); // Auto-cleanup

  const results = await pipe.exec<[number, number, number, number]>();
  const currentCount = results[1];

  return {
    limited: currentCount >= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - currentCount),
  };
}

export { checkRateLimit };
export type { RateLimitResult };
```

**Why good:** Sliding window via sorted set scores, pipeline batches all ops into one HTTP call, TTL auto-cleans abandoned keys, returns remaining quota for response headers

**When to use:** Simple per-identifier rate limiting. For production workloads, consider `@upstash/ratelimit` which provides built-in sliding window, fixed window, and token bucket algorithms with less code.

---

## Session Storage

```typescript
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

const redis = Redis.fromEnv();

const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_KEY_PREFIX = "session:";

interface SessionData {
  userId: string;
  role: string;
  createdAt: number;
}

async function createSession(userId: string, role: string): Promise<string> {
  const sessionId = randomUUID();
  const session: SessionData = {
    userId,
    role,
    createdAt: Date.now(),
  };

  await redis.set(`${SESSION_KEY_PREFIX}${sessionId}`, session, {
    ex: SESSION_TTL_SECONDS,
  });

  return sessionId;
}

async function getSession(sessionId: string): Promise<SessionData | null> {
  return redis.get<SessionData>(`${SESSION_KEY_PREFIX}${sessionId}`);
}

async function refreshSession(sessionId: string): Promise<boolean> {
  // Extend TTL on access (sliding expiration)
  const result = await redis.expire(
    `${SESSION_KEY_PREFIX}${sessionId}`,
    SESSION_TTL_SECONDS,
  );
  return result === 1; // 1 = key exists and TTL set, 0 = key not found
}

async function destroySession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_KEY_PREFIX}${sessionId}`);
}

export { createSession, getSession, refreshSession, destroySession };
export type { SessionData };
```

**Why good:** Named constants, typed session data, sliding expiration via `expire()`, auto-serialization handles JSON, cleanup via TTL

---

## Cache-Aside Helper

```typescript
const DEFAULT_CACHE_TTL_SECONDS = 300;

async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS,
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();

  // Fire-and-forget -- don't block response on cache write
  redis.set(key, data, { ex: ttlSeconds }).catch((err: unknown) => {
    console.error(`Cache write failed for ${key}:`, err);
  });

  return data;
}

export { cacheAside };
```

**Why good:** Generic type preserves TypeScript safety, fire-and-forget prevents cache failures from blocking, auto-serialization handles objects, configurable TTL

---

## Edge Runtime Usage

```typescript
// Works in Vercel Edge Runtime (no TCP, pure HTTP)
// Works in any edge/serverless runtime -- export runtime config per your framework
import { Redis } from "@upstash/redis";

export const runtime = "edge";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  const value = await redis.get(key);
  return Response.json({ value });
}
```

**Why good:** Works in edge runtime where TCP-based Redis clients (ioredis, node-redis) cannot connect, `Redis.fromEnv()` auto-configures

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
