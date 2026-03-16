# Redis Practical Examples

> Caching patterns, session storage, rate limiting, pub/sub messaging, and job queue examples for Redis with ioredis.

---

## Caching Patterns

### Cache-Aside with Generic Helper

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

### Write-Through Cache

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

### Multi-Key Cache with Pipeline

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

### Cache Stampede Prevention (Singleflight)

```typescript
import type Redis from "ioredis";

const LOCK_TTL_SECONDS = 10;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_RETRIES = 20;

// Prevent multiple processes from regenerating the same cache entry simultaneously
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

## Session Storage

### Express Session with connect-redis

```typescript
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import Redis from "ioredis";

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_PREFIX = "sess:";
const COOKIE_MAX_AGE_MS = 86400000; // 24 hours

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const redisClient = new Redis(process.env.REDIS_URL!);
redisClient.on("error", (err) => {
  console.error("Redis session store error:", err.message);
});

const app = express();

app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: SESSION_PREFIX,
      ttl: SESSION_TTL_SECONDS,
    }),
    secret: SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Prevent XSS access to cookie
      maxAge: COOKIE_MAX_AGE_MS,
      sameSite: "lax", // CSRF protection
    },
  }),
);

export { app };
```

**Why good:** `resave: false` prevents race conditions with parallel requests, `saveUninitialized: false` avoids empty sessions, secure cookie in production, httpOnly prevents XSS, sameSite prevents CSRF

### Hono Session Middleware (Manual)

```typescript
import type Redis from "ioredis";
import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 86400;
const SESSION_COOKIE_NAME = "sid";

function sessionMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const sessionId = c.req.cookie(SESSION_COOKIE_NAME) ?? crypto.randomUUID();

    const key = `${SESSION_PREFIX}${sessionId}`;
    const raw = await redis.get(key);
    const session = raw ? JSON.parse(raw) : {};

    c.set("session", session);
    c.set("sessionId", sessionId);

    await next();

    // Save session after response
    const updatedSession = c.get("session");
    await redis.set(
      key,
      JSON.stringify(updatedSession),
      "EX",
      SESSION_TTL_SECONDS,
    );

    // Set cookie if new session
    if (!c.req.cookie(SESSION_COOKIE_NAME)) {
      c.header(
        "Set-Cookie",
        `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
      );
    }
  });
}

export { sessionMiddleware };
```

---

## Rate Limiting

### Sliding Window Rate Limiter (Lua Script)

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);
redis.on("error", (err) => console.error("Redis error:", err.message));

// Atomic sliding window rate limiter
redis.defineCommand("slidingWindowRateLimit", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local max_requests = tonumber(ARGV[1])
    local window_ms = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local window_start = now - window_ms

    -- Remove expired entries outside the window
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Count requests in current window
    local current = redis.call('ZCARD', key)

    if current < max_requests then
      -- Add this request (score = timestamp, member = unique ID)
      redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
      redis.call('PEXPIRE', key, window_ms)
      return {1, max_requests - current - 1} -- allowed, remaining
    else
      -- Get TTL until oldest entry expires
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local retry_after = 0
      if #oldest > 0 then
        retry_after = tonumber(oldest[2]) + window_ms - now
      end
      return {0, 0, retry_after} -- denied, remaining=0, retry_after_ms
    end
  `,
});

// TypeScript type declaration
declare module "ioredis" {
  interface RedisCommander<Context> {
    slidingWindowRateLimit(
      key: string,
      maxRequests: string,
      windowMs: string,
      nowMs: string,
    ): Promise<[number, number, number?]>;
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_WINDOW_MS = 60000; // 1 minute

async function checkRateLimit(
  identifier: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  const [allowed, remaining, retryAfterMs] = await redis.slidingWindowRateLimit(
    key,
    String(maxRequests),
    String(windowMs),
    String(now),
  );

  return {
    allowed: allowed === 1,
    remaining,
    retryAfterMs: retryAfterMs ?? undefined,
  };
}

export { checkRateLimit };
export type { RateLimitResult };
```

### Rate Limiting Middleware (Express/Hono)

```typescript
import type { Request, Response, NextFunction } from "express";
import { checkRateLimit } from "./rate-limiter";

const API_RATE_LIMIT = 100;
const API_RATE_WINDOW_MS = 60000; // 1 minute

function rateLimitMiddleware(
  maxRequests: number = API_RATE_LIMIT,
  windowMs: number = API_RATE_WINDOW_MS,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip ?? "unknown";
    const result = await checkRateLimit(identifier, maxRequests, windowMs);

    // Set standard rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.allowed) {
      res.setHeader(
        "Retry-After",
        Math.ceil((result.retryAfterMs ?? windowMs) / 1000),
      );
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    next();
  };
}

export { rateLimitMiddleware };
```

### Token Bucket Rate Limiter (Lua Script)

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);
redis.on("error", (err) => console.error("Redis error:", err.message));

// Token bucket allows burst traffic up to bucket capacity
redis.defineCommand("tokenBucket", {
  numberOfKeys: 1,
  lua: `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2]) -- tokens per second
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    -- Refill tokens based on elapsed time
    local elapsed = (now - last_refill) / 1000
    tokens = math.min(capacity, tokens + (elapsed * refill_rate))

    if tokens >= requested then
      tokens = tokens - requested
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
      redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
      return {1, math.floor(tokens)} -- allowed, remaining tokens
    else
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
      redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)
      return {0, math.floor(tokens)} -- denied, remaining tokens
    end
  `,
});

declare module "ioredis" {
  interface RedisCommander<Context> {
    tokenBucket(
      key: string,
      capacity: string,
      refillRate: string,
      nowMs: string,
      requested: string,
    ): Promise<[number, number]>;
  }
}

const BUCKET_CAPACITY = 50;
const REFILL_RATE = 10; // tokens per second

async function checkTokenBucket(
  identifier: string,
  tokensRequested: number = 1,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `tokenbucket:${identifier}`;
  const now = Date.now();

  const [allowed, remaining] = await redis.tokenBucket(
    key,
    String(BUCKET_CAPACITY),
    String(REFILL_RATE),
    String(now),
    String(tokensRequested),
  );

  return { allowed: allowed === 1, remaining };
}

export { checkTokenBucket };
```

**When to use sliding window:** Strict, evenly distributed rate limiting (API endpoints, login attempts).

**When to use token bucket:** Allow burst traffic up to capacity (file uploads, batch operations).

---

## Pub/Sub Messaging

### Event Broadcasting System

```typescript
import Redis from "ioredis";

// Event types
interface UserEvent {
  type: "user:created" | "user:updated" | "user:deleted";
  userId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const EVENT_CHANNEL_PREFIX = "events:";

function createEventBus() {
  const publisher = new Redis(process.env.REDIS_URL!);
  const subscriber = new Redis(process.env.REDIS_URL!);

  publisher.on("error", (err) =>
    console.error("Event publisher error:", err.message),
  );
  subscriber.on("error", (err) =>
    console.error("Event subscriber error:", err.message),
  );

  type EventHandler = (event: UserEvent) => void | Promise<void>;
  const handlers = new Map<string, EventHandler[]>();

  // Subscribe to event patterns
  async function subscribe(
    pattern: string,
    handler: EventHandler,
  ): Promise<void> {
    const channel = `${EVENT_CHANNEL_PREFIX}${pattern}`;

    if (!handlers.has(channel)) {
      handlers.set(channel, []);
      await subscriber.psubscribe(channel);
    }

    handlers.get(channel)!.push(handler);
  }

  // Handle incoming messages
  subscriber.on("pmessage", async (_pattern, channel, message) => {
    const event = JSON.parse(message) as UserEvent;

    // Find all matching handlers
    for (const [handlerPattern, handlerList] of handlers) {
      if (channelMatchesPattern(channel, handlerPattern)) {
        for (const handler of handlerList) {
          try {
            await handler(event);
          } catch (err) {
            console.error(`Event handler error on ${channel}:`, err);
          }
        }
      }
    }
  });

  // Publish events
  async function publish(event: UserEvent): Promise<number> {
    const channel = `${EVENT_CHANNEL_PREFIX}${event.type}`;
    return publisher.publish(channel, JSON.stringify(event));
  }

  // Cleanup
  async function close(): Promise<void> {
    await subscriber.punsubscribe();
    await publisher.quit();
    await subscriber.quit();
  }

  return { subscribe, publish, close };
}

function channelMatchesPattern(channel: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return regex.test(channel);
}

export { createEventBus };
export type { UserEvent };
```

#### Usage

```typescript
const eventBus = createEventBus();

// Subscribe to all user events
await eventBus.subscribe("user:*", async (event) => {
  console.log(`User event: ${event.type} for ${event.userId}`);
});

// Subscribe to specific event
await eventBus.subscribe("user:created", async (event) => {
  await sendWelcomeEmail(event.userId);
});

// Publish an event
await eventBus.publish({
  type: "user:created",
  userId: "user-123",
  timestamp: Date.now(),
  data: { name: "Alice" },
});
```

---

## Job Queues with BullMQ

### Complete Email Queue Example

```typescript
import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import Redis from "ioredis";

// Job data types
interface EmailJobData {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
}

interface EmailJobResult {
  messageId: string;
  sentAt: string;
}

// Constants
const QUEUE_NAME = "emails";
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;
const WORKER_CONCURRENCY = 5;
const STALLED_INTERVAL_MS = 30000;
const COMPLETED_RETENTION = 1000;
const FAILED_RETENTION = 5000;

// Connection factory -- each BullMQ component needs its own connection
function createConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ
  });
}

// Queue
const emailQueue = new Queue<EmailJobData, EmailJobResult>(QUEUE_NAME, {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: BACKOFF_DELAY_MS },
    removeOnComplete: { count: COMPLETED_RETENTION },
    removeOnFail: { count: FAILED_RETENTION },
  },
});

// Worker
const emailWorker = new Worker<EmailJobData, EmailJobResult>(
  QUEUE_NAME,
  async (job: Job<EmailJobData, EmailJobResult>) => {
    const { to, subject, templateId, variables } = job.data;

    // Report progress
    await job.updateProgress(10);

    // Render template
    const html = await renderTemplate(templateId, variables);
    await job.updateProgress(50);

    // Send email
    const result = await sendEmail({ to, subject, html });
    await job.updateProgress(100);

    return {
      messageId: result.id,
      sentAt: new Date().toISOString(),
    };
  },
  {
    connection: createConnection(),
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: STALLED_INTERVAL_MS,
  },
);

// Event handlers
emailWorker.on("completed", (job, result) => {
  console.log(`Email sent to ${job.data.to} (messageId: ${result.messageId})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(
    `Email to ${job?.data.to} failed after ${job?.attemptsMade} attempts:`,
    err.message,
  );
});

// QueueEvents for monitoring
const emailEvents = new QueueEvents(QUEUE_NAME, {
  connection: createConnection(),
});

emailEvents.on("waiting", ({ jobId }) => {
  console.log(`Email job ${jobId} is waiting`);
});

export { emailQueue, emailWorker, emailEvents };
```

### Adding Different Job Types

```typescript
const WELCOME_DELAY_MS = 0;
const REMINDER_DELAY_MS = 86400000; // 24 hours
const HIGH_PRIORITY = 1;
const NORMAL_PRIORITY = 5;

// Immediate high-priority email
await emailQueue.add(
  "transactional",
  {
    to: "user@example.com",
    subject: "Password Reset",
    templateId: "password-reset",
    variables: { resetLink: "https://..." },
  },
  { priority: HIGH_PRIORITY },
);

// Delayed email
await emailQueue.add(
  "reminder",
  {
    to: "user@example.com",
    subject: "Complete your profile",
    templateId: "profile-reminder",
    variables: { userName: "Alice" },
  },
  { delay: REMINDER_DELAY_MS, priority: NORMAL_PRIORITY },
);

// Repeating email (daily digest)
await emailQueue.add(
  "daily-digest",
  {
    to: "user@example.com",
    subject: "Your Daily Digest",
    templateId: "daily-digest",
    variables: {},
  },
  {
    repeat: { pattern: "0 9 * * *", tz: "America/New_York" },
  },
);

// Bulk add
await emailQueue.addBulk([
  {
    name: "welcome",
    data: {
      to: "a@example.com",
      subject: "Welcome",
      templateId: "welcome",
      variables: {},
    },
  },
  {
    name: "welcome",
    data: {
      to: "b@example.com",
      subject: "Welcome",
      templateId: "welcome",
      variables: {},
    },
  },
  {
    name: "welcome",
    data: {
      to: "c@example.com",
      subject: "Welcome",
      templateId: "welcome",
      variables: {},
    },
  },
]);
```

### Graceful Shutdown

```typescript
async function shutdown(): Promise<void> {
  console.log("Shutting down workers...");

  // Close worker first (stop accepting new jobs)
  await emailWorker.close();

  // Close event listener
  await emailEvents.close();

  // Close queue last
  await emailQueue.close();

  console.log("All BullMQ connections closed");
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { shutdown };
```

---

## Distributed Lock

### Simple Lock with SET NX

```typescript
import type Redis from "ioredis";
import crypto from "node:crypto";

const LOCK_DEFAULT_TTL_MS = 10000; // 10 seconds
const LOCK_RETRY_DELAY_MS = 100;

interface LockOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

async function acquireLock(
  redis: Redis,
  resource: string,
  options: LockOptions = {},
): Promise<string | null> {
  const {
    ttlMs = LOCK_DEFAULT_TTL_MS,
    retryCount = 3,
    retryDelayMs = LOCK_RETRY_DELAY_MS,
  } = options;

  const lockKey = `lock:${resource}`;
  const lockValue = crypto.randomUUID(); // Unique owner ID

  for (let i = 0; i <= retryCount; i++) {
    const acquired = await redis.set(lockKey, lockValue, "PX", ttlMs, "NX");

    if (acquired === "OK") {
      return lockValue; // Return owner ID for safe release
    }

    if (i < retryCount) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null; // Failed to acquire
}

// Release lock only if we still own it (Lua script for atomicity)
async function releaseLock(
  redis: Redis,
  resource: string,
  lockValue: string,
): Promise<boolean> {
  const lockKey = `lock:${resource}`;

  const result = await redis.eval(
    `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
    `,
    1,
    lockKey,
    lockValue,
  );

  return result === 1;
}

export { acquireLock, releaseLock };
```

#### Usage with Resource Protection

```typescript
async function processExclusiveTask(redis: Redis, taskId: string) {
  const lockValue = await acquireLock(redis, `task:${taskId}`, {
    ttlMs: 30000,
  });

  if (!lockValue) {
    console.log(`Task ${taskId} is already being processed`);
    return;
  }

  try {
    // Do exclusive work here
    await performTask(taskId);
  } finally {
    // Always release in finally block
    await releaseLock(redis, `task:${taskId}`, lockValue);
  }
}
```

**Why good:** UUID lock value ensures only the owner can release, Lua script makes GET+DEL atomic (prevents releasing someone else's lock), PX for millisecond TTL precision, retry logic for contention, finally block ensures release even on error

---

## Redis Streams with Consumer Groups

### Order Processing Pipeline

```typescript
import Redis from "ioredis";

const STREAM_KEY = "stream:orders";
const GROUP_NAME = "order-processors";
const BLOCK_MS = 5000;
const BATCH_SIZE = 10;
const PENDING_CHECK_INTERVAL_MS = 60000;
const CLAIM_MIN_IDLE_MS = 30000;

// Producer
async function addOrderEvent(
  redis: Redis,
  event: { orderId: string; action: string; data: Record<string, unknown> },
): Promise<string> {
  return redis.xadd(
    STREAM_KEY,
    "*",
    "orderId",
    event.orderId,
    "action",
    event.action,
    "data",
    JSON.stringify(event.data),
  );
}

// Consumer with pending message recovery
async function startConsumer(
  redis: Redis,
  consumerName: string,
): Promise<void> {
  // Ensure group exists
  try {
    await redis.xgroup("CREATE", STREAM_KEY, GROUP_NAME, "0", "MKSTREAM");
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }

  // Process pending messages first (messages claimed but not ACKed)
  await processPending(redis, consumerName);

  // Then process new messages
  while (true) {
    const results = await redis.xreadgroup(
      "GROUP",
      GROUP_NAME,
      consumerName,
      "COUNT",
      String(BATCH_SIZE),
      "BLOCK",
      String(BLOCK_MS),
      "STREAMS",
      STREAM_KEY,
      ">",
    );

    if (!results) continue;

    for (const [, messages] of results) {
      for (const [id, fields] of messages) {
        const event = parseStreamFields(fields);
        try {
          await processOrder(event);
          await redis.xack(STREAM_KEY, GROUP_NAME, id);
        } catch (err) {
          console.error(`Failed to process ${id}:`, err);
          // Will be retried via pending recovery
        }
      }
    }
  }
}

// Claim and reprocess messages stuck in pending state
async function processPending(
  redis: Redis,
  consumerName: string,
): Promise<void> {
  const pending = await redis.xpending(
    STREAM_KEY,
    GROUP_NAME,
    "-",
    "+",
    String(BATCH_SIZE),
  );

  for (const [id, , idleTime] of pending) {
    if (Number(idleTime) > CLAIM_MIN_IDLE_MS) {
      const claimed = await redis.xclaim(
        STREAM_KEY,
        GROUP_NAME,
        consumerName,
        CLAIM_MIN_IDLE_MS,
        id,
      );

      for (const [claimedId, fields] of claimed) {
        try {
          const event = parseStreamFields(fields);
          await processOrder(event);
          await redis.xack(STREAM_KEY, GROUP_NAME, claimedId);
        } catch (err) {
          console.error(`Failed to reprocess ${claimedId}:`, err);
        }
      }
    }
  }
}

function parseStreamFields(fields: string[]): {
  orderId: string;
  action: string;
  data: Record<string, unknown>;
} {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return {
    orderId: obj.orderId,
    action: obj.action,
    data: JSON.parse(obj.data),
  };
}

export { addOrderEvent, startConsumer };
```

**Why good:** MKSTREAM creates stream if it doesn't exist, processes pending messages on startup for crash recovery, XCLAIM reclaims stuck messages from dead consumers, XACK confirms processing, field parsing handles Redis stream key-value pairs
