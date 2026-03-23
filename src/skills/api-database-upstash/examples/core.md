# Upstash -- Core Examples

> Client setup, commands, auto-serialization, pipeline, and transaction patterns. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [rate-limiting.md](rate-limiting.md) -- @upstash/ratelimit algorithms, middleware, analytics
- [qstash.md](qstash.md) -- Background jobs, scheduling, message publishing

---

## Client Initialization

### Redis.fromEnv() (Preferred)

```typescript
import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from environment
const redis = Redis.fromEnv();

export { redis };
```

**Why good:** Zero-config, environment variables injected by platform (Vercel, Fly.io, Heroku), no secrets in code, works across all deployment environments

### Explicit Constructor

```typescript
import { Redis } from "@upstash/redis";

const REQUEST_TIMEOUT_MS = 5000;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: true,
  signal: () => AbortSignal.timeout(REQUEST_TIMEOUT_MS),
});

export { redis };
```

**When to use:** When you need to configure timeout, disable auto-deserialization, or use a non-standard env var name.

---

## Disabling Auto-Deserialization

When interoperating with non-Upstash clients (ioredis, redis-cli) that store raw strings:

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false,
});

// Now redis.get() returns raw strings -- you must JSON.parse manually
const raw = await redis.get<string>("key");
if (raw !== null) {
  const parsed = JSON.parse(raw);
}

export { redis };
```

**When to use:** When another service writes raw strings to the same Redis instance and Upstash's auto-deserialization would fail to parse them.

---

## Auto-Serialization Behavior

### Objects Round-Trip Automatically

```typescript
interface UserProfile {
  name: string;
  email: string;
  preferences: { theme: string; language: string };
}

const CACHE_TTL_SECONDS = 3600;

// Store an object -- auto-serialized with JSON.stringify
await redis.set<UserProfile>(
  "user:123",
  {
    name: "Alice",
    email: "alice@example.com",
    preferences: { theme: "dark", language: "en" },
  },
  { ex: CACHE_TTL_SECONDS },
);

// Retrieve -- auto-deserialized with JSON.parse
const user = await redis.get<UserProfile>("user:123");
// user is UserProfile | null -- NOT a string
if (user !== null) {
  // user.preferences.theme => "dark" -- direct property access
}
```

**Why good:** No manual `JSON.stringify`/`JSON.parse`, TypeScript generic provides type safety, nested objects preserved

### The Double-Serialization Trap

```typescript
// BAD -- double-encoding
await redis.set("user:123", JSON.stringify({ name: "Alice" }));
// Stored as: "\"{ \\\"name\\\": \\\"Alice\\\" }\""

const result = await redis.get("user:123");
// result is the STRING '{"name":"Alice"}' -- NOT an object
// Because auto-serialization already called JSON.stringify on your string
```

**Why bad:** `JSON.stringify` is called automatically. Calling it manually means Upstash serializes the already-serialized string, producing double-encoded JSON.

### Numbers and Primitive Values

```typescript
// Numbers are preserved as numbers
await redis.set("counter", 42);
const count = await redis.get<number>("counter");
// count is 42 (number), not "42" (string)

// BUT: Large numbers become strings
const LARGE_ID = "101600000000150081467";
await redis.set("big-id", LARGE_ID);
const bigId = await redis.get<string>("big-id");
// bigId is "101600000000150081467" (string) because > Number.MAX_SAFE_INTEGER
```

**Gotcha:** Numbers larger than `2^53 - 1` (9007199254740991) are returned as strings regardless of TypeScript type annotation. Always validate large numeric values.

---

## Pipeline Batching

### Basic Pipeline

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const USER_TTL_SECONDS = 3600;

async function cacheUserData(userId: string, name: string, email: string) {
  const pipe = redis.pipeline();

  pipe.set(`user:${userId}:name`, name, { ex: USER_TTL_SECONDS });
  pipe.set(`user:${userId}:email`, email, { ex: USER_TTL_SECONDS });
  pipe.incr("stats:total-users");
  pipe.sadd("users:active", userId);

  // Single HTTP request for all 4 commands
  const [nameResult, emailResult, totalUsers, addedCount] =
    await pipe.exec<["OK", "OK", number, number]>();

  return { totalUsers, isNewActiveUser: addedCount === 1 };
}

export { cacheUserData };
```

**Why good:** 4 commands in 1 HTTP request, typed results with generics, named TTL constant

### Chained Pipeline Syntax

```typescript
const results = await redis
  .pipeline()
  .set("key1", "value1")
  .set("key2", "value2")
  .get("key1")
  .exec<["OK", "OK", string]>();
```

**When to use:** Quick inline batching when you don't need to conditionally add commands.

---

## Transactions (Multi/Exec)

### Atomic Counter Update

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

async function atomicOrderUpdate(orderId: string) {
  const tx = redis.multi();
  tx.incr("orders:count");
  tx.set(`order:${orderId}:status`, "confirmed");
  tx.set(`order:${orderId}:updated-at`, Date.now());

  // All 3 commands execute atomically
  const [count, status1, status2] = await tx.exec<[number, "OK", "OK"]>();

  return { orderNumber: count };
}

export { atomicOrderUpdate };
```

**Why good:** Atomic execution (no interleaving), typed results, single HTTP request

### Pipeline vs Transaction Decision

```typescript
// Use PIPELINE when commands are independent
// (order doesn't matter, partial failure is acceptable)
const pipe = redis.pipeline();
pipe.set("analytics:page-views", views);
pipe.set("analytics:unique-users", users);
await pipe.exec();

// Use TRANSACTION when commands must be all-or-nothing
// (atomic execution, no interleaving from other clients)
const tx = redis.multi();
tx.decrby(`balance:${fromUser}`, amount);
tx.incrby(`balance:${toUser}`, amount);
await tx.exec();
```

---

## Cache-Aside Pattern

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const CACHE_TTL_SECONDS = 300;

async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL_SECONDS,
): Promise<T> {
  // Check cache first
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss -- fetch from source
  const data = await fetcher();

  // Populate cache (fire-and-forget -- don't block response on cache write)
  redis.set(key, data, { ex: ttlSeconds }).catch((err) => {
    // Log cache write failure via your logging solution
  });

  return data;
}

export { cacheAside };
```

**Why good:** Generic `cacheAside<T>` works with any type, auto-serialization handles objects, fire-and-forget cache write, `null` check for cache miss (not truthiness)

```typescript
// BAD -- blocking on cache write
async function badCacheAside(key: string, fetcher: () => Promise<unknown>) {
  const cached = await redis.get(key);
  if (cached) return cached; // BUG: falsy values (0, "", false) treated as cache miss

  const data = await fetcher();
  await redis.set(key, data); // BLOCKS response on cache write
  // Missing TTL -- unbounded memory growth
  return data;
}
```

**Why bad:** Truthiness check fails for falsy values like `0` or `""`, blocking cache write adds latency to response, missing TTL causes unbounded growth

---

## SET Options (Differs from ioredis)

```typescript
// Upstash: options object
await redis.set("key", "value", { ex: 300 }); // TTL in seconds
await redis.set("key", "value", { px: 5000 }); // TTL in milliseconds
await redis.set("key", "value", { nx: true }); // Only if NOT exists
await redis.set("key", "value", { xx: true }); // Only if EXISTS
await redis.set("key", "value", { ex: 300, nx: true }); // Combined

// ioredis: positional args (does NOT work with @upstash/redis)
// redis.set("key", "value", "EX", 300);       // WRONG for Upstash
// redis.set("key", "value", "EX", 30, "NX");  // WRONG for Upstash
```

**Gotcha:** If migrating from ioredis, all SET option arguments must be converted to the object form.

---

## ZADD Options (Differs from ioredis)

```typescript
// Upstash: object with score + member
await redis.zadd("leaderboard", { score: 100, member: "player-1" });

// Multiple members
await redis.zadd(
  "leaderboard",
  { score: 100, member: "player-1" },
  { score: 200, member: "player-2" },
);

// ioredis: positional args (does NOT work with @upstash/redis)
// redis.zadd("leaderboard", 100, "player-1"); // WRONG for Upstash
```

---

## Singleton Pattern for Serverless

```typescript
// lib/redis.ts -- module-level singleton
import { Redis } from "@upstash/redis";

// Reused across warm invocations (HTTP keep-alive benefits)
const redis = Redis.fromEnv();

export { redis };
```

```typescript
// api/handler.ts -- import the singleton
import { redis } from "../lib/redis";

async function handler(request: Request): Promise<Response> {
  const data = await redis.get("key");
  return new Response(JSON.stringify(data));
}

export { handler };
```

**Why good:** Module-level singleton is reused across warm Lambda/Edge invocations, avoids creating new instances per request, benefits from HTTP keep-alive

---

## SCAN for Key Iteration

```typescript
const SCAN_BATCH_SIZE = 100;
let cursor = 0;
const allKeys: string[] = [];

do {
  const [nextCursor, keys] = await redis.scan(cursor, {
    match: "user:*",
    count: SCAN_BATCH_SIZE,
  });
  cursor = nextCursor;
  allKeys.push(...keys);
} while (cursor !== 0);
```

**Why good:** Incremental scanning, doesn't block Redis like `KEYS`, `count` is a hint for batch size

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
