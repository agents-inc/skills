# Redis -- Rate Limiting Examples

> Sliding window and token bucket rate limiters with Lua scripts, plus middleware integration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Connection setup, Lua scripting basics
- [sessions.md](sessions.md) -- Session storage (often paired with rate limiting)
- [queues.md](queues.md) -- BullMQ for throttled job processing

---

## Sliding Window Rate Limiter (Lua Script)

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

**Why good:** Entire check-and-update is atomic via Lua, sorted set naturally orders by timestamp, PEXPIRE auto-cleans stale keys, returns remaining count and retry-after for HTTP headers

---

## Rate Limiting Middleware (Express/Hono)

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

**Why good:** Standard `X-RateLimit-*` headers for client awareness, `Retry-After` header for 429 responses, configurable limits per route

---

## Token Bucket Rate Limiter (Lua Script)

Allows burst traffic up to bucket capacity, then refills at a steady rate.

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);
redis.on("error", (err) => console.error("Redis error:", err.message));

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

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
