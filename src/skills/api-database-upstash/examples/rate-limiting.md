# Upstash -- Rate Limiting Examples

> @upstash/ratelimit algorithms, middleware integration, analytics, and edge runtime patterns. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Client setup, commands, pipeline, transactions
- [qstash.md](qstash.md) -- Background jobs, scheduling

---

## Sliding Window Rate Limiter

Smoothest algorithm -- no burst-at-boundary issues. Recommended default.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const MAX_REQUESTS = 100;
const WINDOW_DURATION = "60 s";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(MAX_REQUESTS, WINDOW_DURATION),
  analytics: true,
  prefix: "ratelimit:api",
});

export { ratelimit };
```

**Why good:** Named constants for limits, analytics enabled for monitoring, custom prefix avoids key collisions, sliding window prevents boundary burst problem

**When to use:** API endpoint protection, login attempt limiting, strict evenly-distributed rate limiting.

---

## Fixed Window Rate Limiter

Lowest computational cost. Allows burst at window boundaries.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const MAX_REQUESTS = 50;
const WINDOW_DURATION = "1 m";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(MAX_REQUESTS, WINDOW_DURATION),
});

export { ratelimit };
```

**When to use:** Simple rate limiting where boundary bursts are acceptable, multi-region setups (lower Redis command overhead than sliding window).

**Gotcha:** A user can make `MAX_REQUESTS` at second 59 of window 1 and `MAX_REQUESTS` at second 0 of window 2, effectively doubling their rate at boundaries.

---

## Token Bucket Rate Limiter

Allows controlled bursts up to bucket capacity, then refills at a steady rate.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const REFILL_RATE = 10; // tokens refilled per interval
const REFILL_INTERVAL = "10 s";
const MAX_TOKENS = 50; // maximum bucket capacity

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(REFILL_RATE, REFILL_INTERVAL, MAX_TOKENS),
});

export { ratelimit };
```

**When to use:** File uploads, batch operations, APIs where burst traffic is expected but should be smoothed out. `MAX_TOKENS > REFILL_RATE` allows initial burst.

**Not supported:** `MultiRegionRatelimit` does not support token bucket.

---

## Middleware Integration

### Generic Handler Pattern

```typescript
import type { Ratelimit } from "@upstash/ratelimit";

const RATE_LIMIT_STATUS = 429;

async function checkRateLimit(
  ratelimit: Ratelimit,
  identifier: string,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response | null> {
  const { success, limit, remaining, reset, pending } =
    await ratelimit.limit(identifier);

  // CRITICAL: Handle pending promise in edge runtimes
  if (waitUntil) {
    waitUntil(pending);
  }

  if (!success) {
    return new Response("Too Many Requests", {
      status: RATE_LIMIT_STATUS,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(reset),
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
      },
    });
  }

  return null; // Request allowed
}

export { checkRateLimit };
```

**Why good:** Returns `null` when allowed (caller continues), returns `Response` when blocked, handles `pending` via optional `waitUntil`, standard rate limit headers, `Retry-After` for client backoff

### Vercel Edge Usage

```typescript
import { ratelimit } from "../lib/rate-limiter";
import { checkRateLimit } from "../lib/check-rate-limit";

async function handler(
  request: Request,
  context: { waitUntil: (p: Promise<unknown>) => void },
) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";

  const blocked = await checkRateLimit(
    ratelimit,
    `api:${ip}`,
    context.waitUntil.bind(context),
  );
  if (blocked) return blocked;

  // Process request...
  return new Response("OK");
}

export { handler };
```

---

## The `pending` Promise (Critical for Edge Runtimes)

```typescript
const { success, pending } = await ratelimit.limit("user:123");

// BAD -- pending promise is silently dropped
// Analytics data is lost, multi-region sync may fail
if (!success) return new Response("Rate limited", { status: 429 });

// GOOD -- pending promise is handled
// On Vercel Edge:
context.waitUntil(pending);

// On Cloudflare Workers:
ctx.waitUntil(pending);

// On Node.js servers (not edge): pending resolves naturally, no action needed
```

**Why this matters:** The `pending` promise handles async operations like analytics submission and multi-region synchronization. In edge runtimes, the runtime terminates after the response is sent -- without `waitUntil`, pending work is silently dropped.

---

## Rate Limiting by Multiple Identifiers

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const IP_LIMIT = 100;
const IP_WINDOW = "60 s";
const USER_LIMIT = 500;
const USER_WINDOW = "60 s";

// Separate limiters for different scopes
const ipLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(IP_LIMIT, IP_WINDOW),
  prefix: "ratelimit:ip",
});

const userLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(USER_LIMIT, USER_WINDOW),
  prefix: "ratelimit:user",
});

async function dualRateLimit(
  ip: string,
  userId: string | null,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<{ allowed: boolean; response?: Response }> {
  // Check IP limit first (cheaper, catches abuse early)
  const ipResult = await ipLimiter.limit(ip);
  if (waitUntil) waitUntil(ipResult.pending);

  if (!ipResult.success) {
    return {
      allowed: false,
      response: new Response("Rate limited", { status: 429 }),
    };
  }

  // Check user limit if authenticated
  if (userId) {
    const userResult = await userLimiter.limit(userId);
    if (waitUntil) waitUntil(userResult.pending);

    if (!userResult.success) {
      return {
        allowed: false,
        response: new Response("Rate limited", { status: 429 }),
      };
    }
  }

  return { allowed: true };
}

export { dualRateLimit };
```

**Why good:** Separate limiters with different limits and prefixes, IP checked first (cheapest), user checked only when authenticated

---

## Checking Remaining Tokens Without Consuming

```typescript
// Check remaining quota without consuming a token
const { remaining, reset } = await ratelimit.getRemaining("user:123");

if (remaining < 10) {
  // User approaching limit -- log or alert as appropriate
}
```

**When to use:** Dashboard displays, pre-flight checks, warning thresholds.

---

## Resetting Rate Limit State

```typescript
// Reset a user's rate limit (e.g., after subscription upgrade)
await ratelimit.resetUsedTokens("user:123");
```

**When to use:** Account upgrades, admin overrides, testing.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
