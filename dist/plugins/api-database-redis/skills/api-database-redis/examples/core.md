# Redis -- Core Patterns

> Connection setup, error handling, pipelining, transactions, cluster, sentinel, and fundamental configuration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [caching.md](caching.md) -- Cache-aside, write-through, invalidation
- [data-structures.md](data-structures.md) -- Strings, hashes, lists, sets, sorted sets
- [queues.md](queues.md) -- BullMQ, Redis Streams, distributed locks

---

## ioredis Connection with Error Handling

```typescript
import Redis from "ioredis";

const RETRY_DELAY_BASE_MS = 50;
const RETRY_DELAY_MAX_MS = 2000;

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is required");
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * RETRY_DELAY_BASE_MS, RETRY_DELAY_MAX_MS);
      return delay;
    },
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("Redis connected");
  });

  return client;
}

export { createRedisClient };
```

**Why good:** Environment variable validation, named constants for retry delays, `lazyConnect` prevents connection before ready, error event handler prevents process crash, reconnection strategy with exponential backoff capped at max delay

```typescript
// ❌ Bad Example - No error handling, hardcoded config
import Redis from "ioredis";

const redis = new Redis("redis://localhost:6379");
// No error handler -- unhandled errors crash the process
// No retry strategy -- uses default which may not suit your needs
// Hardcoded connection string -- leaks in version control
```

**Why bad:** Missing error event handler crashes Node.js process on connection failure, hardcoded URL prevents environment-specific configuration, no retry strategy customization

---

## node-redis Connection (Alternative)

Use node-redis when you need Redis Stack modules (JSON, Search, TimeSeries) or connect-redis v9+ for session storage.

```typescript
import { createClient } from "redis";

async function createNodeRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is required");
  }

  const client = createClient({ url });

  client.on("error", (err) => {
    console.error("Redis client error:", err.message);
  });

  await client.connect();
  return client;
}

export { createNodeRedisClient };
```

**When to use:** Redis Stack modules (JSON, Search, TimeSeries), connect-redis v9+ session storage (v9 dropped ioredis support).

---

## Pipelining (Non-Atomic Batching)

Batch multiple commands to reduce network round-trips.

```typescript
import type Redis from "ioredis";

const USER_KEY_PREFIX = "user:";
const USER_TTL_SECONDS = 3600;

async function cacheMultipleUsers(
  redis: Redis,
  users: Array<{ id: string; name: string; email: string }>,
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const user of users) {
    const key = `${USER_KEY_PREFIX}${user.id}`;
    pipeline.hset(key, { name: user.name, email: user.email });
    pipeline.expire(key, USER_TTL_SECONDS);
  }

  const results = await pipeline.exec();
  if (!results) {
    throw new Error("Pipeline execution returned null");
  }

  // Check for errors in pipeline results
  for (const [err] of results) {
    if (err) {
      throw new Error(`Pipeline command failed: ${err.message}`);
    }
  }
}

export { cacheMultipleUsers };
```

**Why good:** Single network round-trip for all commands, error checking on each result, named constants for prefix and TTL

---

## Transactions (MULTI/EXEC -- Atomic)

```typescript
import type Redis from "ioredis";

const BALANCE_KEY_PREFIX = "balance:";

async function transferBalance(
  redis: Redis,
  fromUserId: string,
  toUserId: string,
  amount: number,
): Promise<boolean> {
  const fromKey = `${BALANCE_KEY_PREFIX}${fromUserId}`;
  const toKey = `${BALANCE_KEY_PREFIX}${toUserId}`;

  // WATCH for optimistic locking
  await redis.watch(fromKey);

  const currentBalance = await redis.get(fromKey);
  if (!currentBalance || parseFloat(currentBalance) < amount) {
    await redis.unwatch();
    return false; // Insufficient balance
  }

  // MULTI/EXEC -- atomic execution
  const results = await redis
    .multi()
    .decrby(fromKey, amount)
    .incrby(toKey, amount)
    .exec();

  // results is null if WATCH detected a change (optimistic lock failure)
  if (!results) {
    return false; // Retry needed -- another client modified the key
  }

  return true;
}

export { transferBalance };
```

**Why good:** WATCH provides optimistic locking, MULTI/EXEC ensures atomicity, null check handles concurrent modification, clear return value for retry logic

```typescript
// ❌ Bad Example - Non-atomic balance transfer
await redis.decrby("balance:user1", 100);
await redis.incrby("balance:user2", 100);
// If the process crashes between these two commands,
// money disappears from user1 but never reaches user2
```

**Why bad:** Two separate commands are not atomic, crash between them causes data inconsistency, no optimistic locking for concurrent access

---

## Cluster Mode

ioredis supports Redis Cluster for horizontal scaling and high availability.

```typescript
import Redis from "ioredis";

const CLUSTER_RETRY_BASE_MS = 100;
const CLUSTER_RETRY_MAX_MS = 2000;
const MAX_REDIRECTIONS = 16;

const cluster = new Redis.Cluster(
  [
    { host: "redis-node-1", port: 6379 },
    { host: "redis-node-2", port: 6379 },
    { host: "redis-node-3", port: 6379 },
  ],
  {
    clusterRetryStrategy(times) {
      return Math.min(times * CLUSTER_RETRY_BASE_MS, CLUSTER_RETRY_MAX_MS);
    },
    maxRedirections: MAX_REDIRECTIONS,
    scaleReads: "slave", // Read from replicas, write to master
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
    },
  },
);

cluster.on("error", (err) => {
  console.error("Cluster error:", err.message);
});

// Use cluster exactly like a regular Redis client
await cluster.set("key", "value");
const value = await cluster.get("key");

export { cluster };
```

**Why good:** Multiple seed nodes for discovery, `scaleReads: "slave"` offloads reads to replicas, retry strategy with backoff, password from environment variable

---

## Sentinel Setup

```typescript
import Redis from "ioredis";

const sentinel = new Redis({
  sentinels: [
    { host: "sentinel-1", port: 26379 },
    { host: "sentinel-2", port: 26379 },
    { host: "sentinel-3", port: 26379 },
  ],
  name: "mymaster", // Sentinel group name
  sentinelRetryStrategy(times) {
    return Math.min(times * 10, 1000);
  },
  failoverDetector: true, // Detect failover and reconnect automatically
});

sentinel.on("error", (err) => {
  console.error("Sentinel error:", err.message);
});

export { sentinel };
```

**Why good:** Multiple sentinel nodes for redundancy, `failoverDetector: true` for automatic master failover handling, retry strategy for sentinel connectivity

---

## Auto-Pipelining

ioredis can automatically batch commands issued during the same event loop tick:

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, {
  enableAutoPipelining: true,
});

// These three commands are automatically batched into one pipeline
const [name, email, role] = await Promise.all([
  redis.get("user:name"),
  redis.get("user:email"),
  redis.get("user:role"),
]);

export { redis };
```

**When to use:** High-throughput applications issuing many independent commands per request. Auto-pipelining reduces network round-trips without changing application code.

**When NOT to use:** When commands depend on each other's results (sequential logic), or when using WATCH/MULTI for transactions.

---

## Scanning Instead of KEYS

Never use `KEYS` in production -- it blocks the Redis server while scanning all keys.

```typescript
import type Redis from "ioredis";

const SCAN_BATCH_SIZE = 100;

async function findKeysByPattern(
  redis: Redis,
  pattern: string,
): Promise<string[]> {
  const allKeys: string[] = [];

  const stream = redis.scanStream({
    match: pattern,
    count: SCAN_BATCH_SIZE,
  });

  return new Promise((resolve, reject) => {
    stream.on("data", (keys: string[]) => {
      allKeys.push(...keys);
    });
    stream.on("end", () => resolve(allKeys));
    stream.on("error", (err) => reject(err));
  });
}

export { findKeysByPattern };
```

**Why good:** `scanStream` iterates incrementally without blocking Redis, `count` is a hint for batch size (not a guarantee), stream-based API handles large keyspaces

---

## Key Expiration Strategies

```typescript
const TTL_SHORT_SECONDS = 60; // 1 minute -- volatile data
const TTL_MEDIUM_SECONDS = 300; // 5 minutes -- API response cache
const TTL_LONG_SECONDS = 3600; // 1 hour -- user profiles
const TTL_SESSION_SECONDS = 86400; // 24 hours -- sessions

// SET with TTL (preferred -- atomic)
await redis.set("key", "value", "EX", TTL_MEDIUM_SECONDS);

// SET with millisecond TTL
await redis.set("key", "value", "PX", 500);

// SET only if key doesn't exist (distributed lock pattern)
const acquired = await redis.set("lock:resource", "owner-id", "EX", 30, "NX");
// Returns "OK" if lock acquired, null if already locked

// Update TTL on existing key
await redis.expire("key", TTL_LONG_SECONDS);
```

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
