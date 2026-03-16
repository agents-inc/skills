---
name: api-database-redis
description: Redis in-memory data store patterns with ioredis and node-redis -- caching, sessions, rate limiting, pub/sub, streams, queues, transactions, cluster
---

# Redis Patterns

> **Quick Guide:** Use Redis as an in-memory data store for caching, session management, rate limiting, pub/sub messaging, and job queues. Use **ioredis** (v5.x) as the primary client for its superior TypeScript support, Cluster/Sentinel integration, auto-pipelining, and Lua scripting. Use **node-redis** (v5.x) only when you need Redis Stack modules (JSON, Search, TimeSeries). Always set `maxRetriesPerRequest: null` for BullMQ workers, use separate connections for Pub/Sub subscribers, and define Lua scripts via `defineCommand` for atomic multi-step operations.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use a SEPARATE Redis connection for Pub/Sub subscribers -- a subscribed connection enters a special mode and cannot execute other commands)**

**(You MUST set `maxRetriesPerRequest: null` on any ioredis connection passed to BullMQ -- BullMQ requires infinite retries and will throw if this is not set)**

**(You MUST use Lua scripts (`defineCommand` or `eval`) for any operation requiring atomicity across multiple Redis commands -- separate commands are NOT atomic even in a pipeline)**

**(You MUST handle the `error` event on every Redis client instance -- unhandled errors crash the Node.js process)**

</critical_requirements>

---

**Detailed Resources:**

- For code examples, see [examples/](examples/) folder:
  - [redis.md](examples/redis.md) - Caching patterns, session storage, rate limiting, pub/sub, job queues
- For decision frameworks, quick reference, and anti-patterns, see [reference.md](reference.md)

---

**Auto-detection:** Redis, ioredis, node-redis, createClient, RedisStore, BullMQ, Queue, Worker, pub/sub, MULTI, EXEC, pipeline, Lua script, defineCommand, xadd, xread, cache-aside, rate limit, session store, connect-redis, Redis.Cluster, Sentinel

**When to use:**

- Caching database queries or API responses (cache-aside, write-through)
- Session storage for Express/Hono/Fastify applications
- Distributed rate limiting (sliding window, token bucket)
- Real-time messaging with Pub/Sub
- Background job processing with BullMQ queues
- Leaderboards, counters, and real-time analytics with sorted sets
- Distributed locks and atomic operations with Lua scripts

**Key patterns covered:**

- ioredis connection setup, configuration, and error handling
- Data structures (strings, hashes, lists, sets, sorted sets, streams)
- Cache-aside and write-through caching with TTL management
- Session storage with connect-redis
- Rate limiting with Lua scripts (sliding window, token bucket)
- Pub/Sub messaging with separate connections
- Redis Streams for persistent message queues
- BullMQ for job queues with retries and scheduling
- Pipelining and transactions (MULTI/EXEC)
- Lua scripting for atomic operations
- Cluster mode and Sentinel for high availability
- Production connection management and reconnection strategies

**When NOT to use:**

- Primary database for relational data (use PostgreSQL/Drizzle)
- Document storage with complex queries (use MongoDB)
- Large binary file storage (use S3/object storage)
- Data that must survive total memory loss without persistence configured

---

<philosophy>

## Philosophy

Redis is an **in-memory data store** used as a cache, message broker, and streaming engine. The core principle: **use Redis for fast, ephemeral, or real-time data -- not as a primary database.**

**Core principles:**

1. **Cache, don't store** -- Redis complements your primary database. Cache frequently accessed data, but always have a source of truth elsewhere.
2. **Atomic operations** -- Use Lua scripts or MULTI/EXEC for operations spanning multiple keys. Individual Redis commands are atomic, but sequences are not.
3. **Separate concerns** -- Use different Redis databases (or key prefixes) for caching, sessions, and queues. Use separate connections for Pub/Sub.
4. **Set TTLs on everything** -- Memory is finite. Every cached key should expire. Use `EX` (seconds) or `PX` (milliseconds) on SET commands.
5. **Fail gracefully** -- Redis is a cache, not a database. If Redis is down, the application should degrade gracefully (bypass cache, use database directly).

**When to use Redis:**

- High-frequency reads that benefit from in-memory speed
- Session data shared across multiple application instances
- Rate limiting in distributed environments
- Real-time features (chat, notifications, live updates)
- Background job processing and task scheduling
- Leaderboards, counters, and analytics requiring atomic increments

**When NOT to use:**

- As a primary database (data loss risk on restart without persistence)
- Complex queries with JOINs or aggregations (use a relational database)
- Storing data larger than available memory
- Long-term data archival

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: ioredis Connection Setup

Configure ioredis with proper error handling, reconnection strategy, and TypeScript types.

#### Basic Connection

```typescript
// ✅ Good Example - Proper ioredis setup with error handling
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

#### node-redis Connection (Alternative)

```typescript
// ✅ Good Example - node-redis when you need Redis Stack modules
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

**When to use:** Only when you need Redis Stack modules (JSON, Search, TimeSeries) -- ioredis does not support Redis Stack modules natively.

---

### Pattern 2: Data Structures and Basic Operations

Redis provides multiple data structures, each optimized for specific use cases.

#### Strings (Key-Value)

```typescript
import type Redis from "ioredis";

const DEFAULT_TTL_SECONDS = 3600; // 1 hour

async function setWithTTL(
  redis: Redis,
  key: string,
  value: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

async function getOrNull(redis: Redis, key: string): Promise<string | null> {
  return redis.get(key);
}

export { setWithTTL, getOrNull };
```

#### Hashes (Object-like)

```typescript
import type Redis from "ioredis";

interface UserProfile {
  name: string;
  email: string;
  role: string;
}

const USER_KEY_PREFIX = "user:";
const USER_TTL_SECONDS = 1800; // 30 minutes

async function setUserProfile(
  redis: Redis,
  userId: string,
  profile: UserProfile,
): Promise<void> {
  const key = `${USER_KEY_PREFIX}${userId}`;
  await redis.hset(key, profile);
  await redis.expire(key, USER_TTL_SECONDS);
}

async function getUserProfile(
  redis: Redis,
  userId: string,
): Promise<UserProfile | null> {
  const key = `${USER_KEY_PREFIX}${userId}`;
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return data as UserProfile;
}

export { setUserProfile, getUserProfile };
```

**Why good:** Key prefix separates concerns, TTL prevents stale data, null check on empty hash response, typed return

#### Sorted Sets (Leaderboards, Rankings)

```typescript
import type Redis from "ioredis";

const LEADERBOARD_KEY = "leaderboard:global";
const TOP_PLAYERS_COUNT = 10;

async function updateScore(
  redis: Redis,
  playerId: string,
  score: number,
): Promise<void> {
  await redis.zadd(LEADERBOARD_KEY, score, playerId);
}

async function getTopPlayers(
  redis: Redis,
): Promise<Array<{ playerId: string; score: number }>> {
  // ZREVRANGE returns highest scores first
  const results = await redis.zrevrange(
    LEADERBOARD_KEY,
    0,
    TOP_PLAYERS_COUNT - 1,
    "WITHSCORES",
  );

  const players: Array<{ playerId: string; score: number }> = [];
  for (let i = 0; i < results.length; i += 2) {
    players.push({
      playerId: results[i],
      score: parseFloat(results[i + 1]),
    });
  }
  return players;
}

async function getPlayerRank(
  redis: Redis,
  playerId: string,
): Promise<number | null> {
  // ZREVRANK returns 0-based rank (highest score = rank 0)
  const rank = await redis.zrevrank(LEADERBOARD_KEY, playerId);
  return rank !== null ? rank + 1 : null; // Convert to 1-based
}

export { updateScore, getTopPlayers, getPlayerRank };
```

**Why good:** Named constants for key and count, ZREVRANGE for descending order, WITHSCORES returns scores alongside members, 1-based rank conversion for user display

#### Lists (Queues, Recent Items)

```typescript
import type Redis from "ioredis";

const RECENT_ITEMS_KEY = "recent:items";
const MAX_RECENT_ITEMS = 50;

async function addRecentItem(redis: Redis, item: string): Promise<void> {
  await redis
    .pipeline()
    .lpush(RECENT_ITEMS_KEY, item)
    .ltrim(RECENT_ITEMS_KEY, 0, MAX_RECENT_ITEMS - 1)
    .exec();
}

async function getRecentItems(redis: Redis): Promise<string[]> {
  return redis.lrange(RECENT_ITEMS_KEY, 0, MAX_RECENT_ITEMS - 1);
}

export { addRecentItem, getRecentItems };
```

**Why good:** Pipeline groups push and trim into single round-trip, LTRIM caps list size preventing unbounded growth, named constants for key and limit

---

### Pattern 3: Cache-Aside Pattern

The most common caching strategy: check cache first, fall back to database on miss, populate cache for next time.

```typescript
import type Redis from "ioredis";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY_PREFIX = "cache:";

interface CacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

async function cacheAside<T>(
  redis: Redis,
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttlSeconds = CACHE_TTL_SECONDS, keyPrefix = CACHE_KEY_PREFIX } =
    options;
  const cacheKey = `${keyPrefix}${key}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  // 2. Cache miss -- fetch from source
  const data = await fetcher();

  // 3. Populate cache (don't await -- fire and forget is fine for cache writes)
  redis.set(cacheKey, JSON.stringify(data), "EX", ttlSeconds).catch((err) => {
    console.error(`Cache write failed for ${cacheKey}:`, err.message);
  });

  return data;
}

export { cacheAside };
```

#### Usage

```typescript
// ✅ Good Example - Cache-aside with database fetcher
import { cacheAside } from "./cache";

const PRODUCT_CACHE_TTL = 600; // 10 minutes

async function getProduct(productId: string): Promise<Product> {
  return cacheAside(
    redis,
    `product:${productId}`,
    () => db.query.products.findFirst({ where: eq(products.id, productId) }),
    { ttlSeconds: PRODUCT_CACHE_TTL },
  );
}

export { getProduct };
```

**Why good:** Generic `cacheAside<T>` works with any data type, fire-and-forget cache write prevents cache failure from blocking response, configurable TTL per use case, key prefix separates cache keys from other Redis data

```typescript
// ❌ Bad Example - Manual cache-aside with no error handling
const data = await redis.get("product:123");
if (data) {
  return JSON.parse(data);
}
const product = await db.getProduct("123");
await redis.set("product:123", JSON.stringify(product));
// Missing TTL -- data never expires
// Missing error handling -- cache failure blocks response
// Hardcoded key -- no prefix separation
return product;
```

**Why bad:** No TTL causes stale data forever, cache write failure blocks the response, no key prefix risks collisions, not reusable

---

### Pattern 4: Cache Invalidation

Invalidating cache when data changes.

#### Write-Through with Invalidation

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

**When to use:** Write-heavy applications where consistency matters more than cache hit rate.

**When not to use:** Read-heavy applications with rare writes -- cache-aside with TTL is simpler and sufficient.

---

### Pattern 5: Pipelining and Transactions

Batch multiple commands to reduce network round-trips.

#### Pipelining (Non-Atomic Batching)

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

#### Transactions (MULTI/EXEC -- Atomic)

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

### Pattern 6: Lua Scripting for Atomic Operations

Lua scripts execute atomically on the Redis server -- no other command can run between script steps.

#### Defining Custom Commands

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

// Define a rate limiter as a custom command
redis.defineCommand("rateLimit", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

    -- Count current requests
    local count = redis.call('ZCARD', key)

    if count < limit then
      -- Add current request
      redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
      redis.call('EXPIRE', key, window)
      return 1 -- Allowed
    else
      return 0 -- Rate limited
    end
  `,
});

// TypeScript declaration for the custom command
declare module "ioredis" {
  interface RedisCommander<Context> {
    rateLimit(
      key: string,
      limit: string,
      windowMs: string,
      nowMs: string,
    ): Promise<number>;
  }
}

export { redis };
```

**Why good:** `defineCommand` uses EVALSHA internally for performance (sends script hash instead of full script on subsequent calls), declare module extends TypeScript types for custom commands, Lua script is atomic -- no race conditions between ZREMRANGEBYSCORE and ZADD

#### Using the Custom Command

```typescript
const MAX_REQUESTS = 100;
const WINDOW_SECONDS = 60;

async function checkRateLimit(
  redis: Redis,
  identifier: string,
): Promise<boolean> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  const allowed = await redis.rateLimit(
    key,
    String(MAX_REQUESTS),
    String(WINDOW_SECONDS * 1000),
    String(now),
  );

  return allowed === 1;
}

export { checkRateLimit };
```

---

### Pattern 7: Pub/Sub Messaging

Redis Pub/Sub requires **separate connections** for subscribing and publishing.

```typescript
// ✅ Good Example - Separate connections for pub/sub
import Redis from "ioredis";

const NOTIFICATION_CHANNEL = "notifications";

function createPubSubClients() {
  const url = process.env.REDIS_URL!;

  // Publisher can be your regular Redis client
  const publisher = new Redis(url);
  publisher.on("error", (err) => {
    console.error("Publisher error:", err.message);
  });

  // Subscriber MUST be a separate connection
  const subscriber = new Redis(url);
  subscriber.on("error", (err) => {
    console.error("Subscriber error:", err.message);
  });

  return { publisher, subscriber };
}

// Subscribe to channels
async function setupSubscriber(subscriber: Redis): Promise<void> {
  await subscriber.subscribe(NOTIFICATION_CHANNEL);

  subscriber.on("message", (channel, message) => {
    const data = JSON.parse(message);
    console.log(`Received on ${channel}:`, data);
    handleNotification(data);
  });
}

// Publish messages
async function publishNotification(
  publisher: Redis,
  notification: { userId: string; type: string; message: string },
): Promise<number> {
  // Returns number of subscribers that received the message
  return publisher.publish(NOTIFICATION_CHANNEL, JSON.stringify(notification));
}

export { createPubSubClients, setupSubscriber, publishNotification };
```

**Why good:** Separate connections for pub and sub (required by Redis protocol), error handlers on both, typed notification payload, publish returns subscriber count for observability

```typescript
// ❌ Bad Example - Using same connection for pub and sub
const redis = new Redis();
await redis.subscribe("channel");
await redis.set("key", "value"); // ERROR: connection is in subscriber mode
```

**Why bad:** A subscribed connection enters a special mode and cannot execute non-pub/sub commands -- `set` will throw an error

#### Pattern Subscriptions

```typescript
// Subscribe to all channels matching a pattern
await subscriber.psubscribe("notifications:*");

subscriber.on("pmessage", (pattern, channel, message) => {
  // pattern: "notifications:*"
  // channel: "notifications:user:123" (actual channel)
  // message: the published data
  console.log(`Pattern ${pattern} matched channel ${channel}`);
});
```

---

### Pattern 8: Redis Streams

Streams provide persistent, ordered message logs with consumer groups for reliable processing.

```typescript
import Redis from "ioredis";

const STREAM_KEY = "events:orders";
const CONSUMER_GROUP = "order-processors";
const BLOCK_TIMEOUT_MS = 5000;
const BATCH_SIZE = 10;

// Producer: add events to stream
async function publishOrderEvent(
  redis: Redis,
  event: { orderId: string; action: string; data: string },
): Promise<string> {
  // '*' auto-generates the entry ID (timestamp-based)
  const entryId = await redis.xadd(
    STREAM_KEY,
    "*",
    "orderId",
    event.orderId,
    "action",
    event.action,
    "data",
    event.data,
  );
  return entryId;
}

// Create consumer group (run once at startup)
async function createConsumerGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup("CREATE", STREAM_KEY, CONSUMER_GROUP, "0", "MKSTREAM");
  } catch (err) {
    // Group already exists -- safe to ignore
    if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }
}

// Consumer: read and acknowledge events
async function consumeOrderEvents(
  redis: Redis,
  consumerName: string,
): Promise<void> {
  while (true) {
    const results = await redis.xreadgroup(
      "GROUP",
      CONSUMER_GROUP,
      consumerName,
      "COUNT",
      String(BATCH_SIZE),
      "BLOCK",
      String(BLOCK_TIMEOUT_MS),
      "STREAMS",
      STREAM_KEY,
      ">", // Read only new messages
    );

    if (!results) continue; // Timeout, no new messages

    for (const [, messages] of results) {
      for (const [id, fields] of messages) {
        try {
          // Process the event
          await processOrderEvent(fields);

          // Acknowledge successful processing
          await redis.xack(STREAM_KEY, CONSUMER_GROUP, id);
        } catch (err) {
          console.error(`Failed to process event ${id}:`, err);
          // Message remains pending -- will be redelivered
        }
      }
    }
  }
}

export { publishOrderEvent, createConsumerGroup, consumeOrderEvents };
```

**Why good:** MKSTREAM creates the stream if it doesn't exist, BUSYGROUP error handling for idempotent group creation, XACK confirms processing (unacked messages redeliver), BLOCK prevents busy-waiting, named constants for all configuration

---

### Pattern 9: BullMQ Job Queues

BullMQ provides robust job queuing built on Redis with retries, scheduling, and priorities.

#### Queue and Worker Setup

```typescript
// ✅ Good Example - BullMQ with proper connection config
import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "email-queue";
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;
const CONCURRENCY = 5;

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

// Shared connection config
function createBullMQConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ
  });
}

// Queue: add jobs
const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: MAX_RETRY_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: BACKOFF_DELAY_MS,
    },
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed
    removeOnFail: { count: 5000 }, // Keep last 5000 failed
  },
});

// Worker: process jobs
const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { to, subject, body } = job.data;
    await sendEmail(to, subject, body);
    return { sent: true, to };
  },
  {
    connection: createBullMQConnection(),
    concurrency: CONCURRENCY,
  },
);

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed: email sent to ${job.data.to}`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

export { emailQueue, emailWorker };
```

**Why good:** `maxRetriesPerRequest: null` is required for BullMQ (it retries internally), typed job data with `Queue<EmailJobData>`, exponential backoff for retries, cleanup policies prevent unbounded Redis memory growth, separate connection per Queue/Worker (BullMQ requirement)

```typescript
// ❌ Bad Example - BullMQ without required config
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(); // Missing maxRetriesPerRequest: null
const queue = new Queue("emails", { connection });
// BullMQ will throw: "maxRetriesPerRequest must be null"
```

**Why bad:** BullMQ requires `maxRetriesPerRequest: null` -- without it, ioredis gives up retrying after a set number of attempts, but BullMQ expects to retry forever

#### Adding Jobs with Scheduling

```typescript
const REPORT_DELAY_MS = 60000; // 1 minute
const HIGH_PRIORITY = 1;
const LOW_PRIORITY = 10;

// Immediate job
await emailQueue.add("welcome-email", {
  to: "user@example.com",
  subject: "Welcome!",
  body: "Thanks for signing up.",
});

// Delayed job
await emailQueue.add(
  "reminder-email",
  { to: "user@example.com", subject: "Reminder", body: "Don't forget!" },
  { delay: REPORT_DELAY_MS },
);

// Priority job (lower number = higher priority)
await emailQueue.add(
  "urgent-email",
  { to: "admin@example.com", subject: "Alert!", body: "System alert." },
  { priority: HIGH_PRIORITY },
);

// Repeatable job (cron schedule)
await emailQueue.add(
  "daily-digest",
  { to: "user@example.com", subject: "Daily Digest", body: "..." },
  { repeat: { pattern: "0 9 * * *" } }, // Every day at 9 AM
);
```

---

### Pattern 10: Cluster Mode

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

#### Sentinel Setup

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

</patterns>

---

<performance>

## Performance Optimization

### Auto-Pipelining

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

### Key Expiration Strategies

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

### Scanning Instead of KEYS

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

</performance>

---

<decision_framework>

## Decision Framework

### Which Redis Client?

```
Which Redis client should I use?
├─ Need Redis Stack modules (JSON, Search, TimeSeries)? → node-redis (v5.x)
├─ Using BullMQ for job queues? → ioredis (BullMQ requires it)
├─ Need Cluster or Sentinel support? → ioredis (built-in, battle-tested)
├─ Need auto-pipelining? → ioredis (enableAutoPipelining option)
└─ General caching/sessions/pub-sub? → ioredis (recommended default)
```

### Which Caching Strategy?

```
How should I cache this data?
├─ Read-heavy, tolerates brief staleness? → Cache-aside with TTL
├─ Needs strong consistency after writes? → Write-through (update DB + invalidate cache)
├─ Write-heavy, can tolerate brief data loss? → Write-behind (async cache update)
└─ Data changes rarely? → Cache-aside with long TTL + manual invalidation
```

### Which Data Structure?

```
What Redis data structure should I use?
├─ Simple key-value (cache, sessions)? → Strings (GET/SET)
├─ Object with multiple fields? → Hashes (HSET/HGET)
├─ Ordered ranking/leaderboard? → Sorted Sets (ZADD/ZRANGE)
├─ Queue (FIFO/LIFO)? → Lists (LPUSH/RPOP)
├─ Unique collection (tags, categories)? → Sets (SADD/SMEMBERS)
├─ Persistent message log with consumers? → Streams (XADD/XREAD)
└─ Rate limiting (sliding window)? → Sorted Sets + Lua script
```

### Which Messaging Pattern?

```
How should I implement real-time messaging?
├─ Fire-and-forget broadcast? → Pub/Sub (no persistence)
├─ Need message persistence and replay? → Streams with consumer groups
├─ Need reliable job processing with retries? → BullMQ (built on Redis)
└─ Need request-reply pattern? → Pub/Sub with correlation IDs
```

### Atomicity Decision

```
Do I need atomicity across multiple commands?
├─ YES → Are the commands on the same key?
│   ├─ YES → Use a single atomic command (INCR, SETNX, etc.)
│   └─ NO → Use Lua script (defineCommand)
├─ NO, but I want batching → Use pipeline (non-atomic, single round-trip)
└─ Need optimistic locking? → Use WATCH + MULTI/EXEC
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Drizzle/Prisma** -- Cache database queries using cache-aside pattern; invalidate cache on writes
- **Express/Hono/Fastify** -- Session storage via connect-redis, rate limiting middleware
- **BullMQ** -- Job queues built on Redis (requires ioredis with `maxRetriesPerRequest: null`)
- **Socket.IO** -- Redis adapter for scaling WebSocket connections across multiple servers
- **Docker/Kubernetes** -- Redis containers for development, Redis Cluster for production

**Replaces / Conflicts with:**

- **In-memory caches (node-cache, lru-cache)** -- Redis provides distributed caching across multiple app instances; in-memory caches are per-process only
- **Database-backed sessions** -- Redis sessions are faster and reduce database load
- **RabbitMQ/Kafka** (partially) -- Redis Streams and BullMQ cover most queue use cases; use dedicated message brokers for complex routing or massive throughput

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using the same connection for Pub/Sub subscribe and regular commands -- subscribed connections cannot execute non-pub/sub commands
- Missing `maxRetriesPerRequest: null` on BullMQ connections -- BullMQ throws immediately without this setting
- Using `KEYS` command in production -- blocks the entire Redis server while scanning all keys
- No `error` event handler on Redis client -- unhandled errors crash the Node.js process
- Storing large objects (> 1 MB) in Redis -- degrades performance and wastes memory; store a reference and fetch from object storage

**Medium Priority Issues:**

- Missing TTL on cached keys -- causes unbounded memory growth until Redis runs out of memory
- Using `del` with many keys instead of `unlink` -- `del` blocks Redis; `unlink` frees memory asynchronously
- Not using pipelining for batch operations -- each command is a separate network round-trip
- Serializing/deserializing complex objects without error handling -- malformed JSON in cache crashes on parse
- Sharing a single Redis connection across BullMQ Queue and Worker -- each needs its own connection

**Common Mistakes:**

- Assuming pipeline commands are atomic -- pipelines batch for network efficiency but do not provide atomicity (use MULTI/EXEC or Lua)
- Forgetting that `hgetall` returns an empty object `{}` for non-existent keys (not `null`) -- check `Object.keys(result).length === 0`
- Using `MULTI/EXEC` without `WATCH` for conditional updates -- transactions execute unconditionally unless you WATCH keys first
- Not handling `null` returns from `GET` -- cache misses return `null`, not `undefined`
- Connecting to Redis without TLS in production -- credentials sent in plaintext over the network

**Gotchas & Edge Cases:**

- Redis `HGETALL` returns all values as strings -- numbers stored with `HSET` come back as strings, requiring explicit parsing
- `EXPIRE` resets when a key is overwritten with `SET` -- if you `SET` a key that already has a TTL, the TTL is removed unless you include `EX`/`PX` in the `SET` command
- Pub/Sub messages are fire-and-forget -- if no subscriber is listening when a message is published, it is lost forever (use Streams for persistence)
- Redis Cluster does not support multi-key operations across different hash slots -- use `{hash-tag}` prefix to force related keys to the same slot
- `WATCH` is connection-scoped -- concurrent requests sharing a connection will interfere with each other's WATCH state
- ioredis auto-pipelining does not work with `WATCH`/`MULTI` or blocking commands (`BRPOP`, `BLPOP`, `XREAD BLOCK`)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use a SEPARATE Redis connection for Pub/Sub subscribers -- a subscribed connection enters a special mode and cannot execute other commands)**

**(You MUST set `maxRetriesPerRequest: null` on any ioredis connection passed to BullMQ -- BullMQ requires infinite retries and will throw if this is not set)**

**(You MUST use Lua scripts (`defineCommand` or `eval`) for any operation requiring atomicity across multiple Redis commands -- separate commands are NOT atomic even in a pipeline)**

**(You MUST handle the `error` event on every Redis client instance -- unhandled errors crash the Node.js process)**

**Failure to follow these rules will cause pub/sub failures, BullMQ connection errors, race conditions, and application crashes.**

</critical_reminders>
