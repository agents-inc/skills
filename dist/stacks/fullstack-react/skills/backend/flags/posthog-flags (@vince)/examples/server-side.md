# Server-Side Flag Evaluation Examples

> Server-side evaluation with posthog-node. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: Server-Side Flag Evaluation

Use `posthog-node` for server-side evaluation. Use local evaluation for performance.

### Setup

```typescript
// lib/posthog-server.ts
import { PostHog } from "posthog-node";

const POSTHOG_POLL_INTERVAL_MS = 30000; // 30 seconds
const FLAG_REQUEST_TIMEOUT_MS = 3000; // 3 seconds (default)

// Initialize with local evaluation
// Use Feature Flags Secure API Key (phs_*) from project settings > Feature Flags tab
// Personal API keys are DEPRECATED for local evaluation
export const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
  // Enable local evaluation with feature flags secure key (phs_*)
  personalApiKey: process.env.POSTHOG_FEATURE_FLAGS_KEY,
  // Poll for flag definition updates
  featureFlagsPollingInterval: POSTHOG_POLL_INTERVAL_MS,
  // Timeout for flag requests (prevents blocking on slow responses)
  featureFlagsRequestTimeoutMs: FLAG_REQUEST_TIMEOUT_MS,
});

// Named export
export { posthog };
```

**Note:** Get the Feature Flags Secure API Key from PostHog Project Settings > Feature Flags tab. The key starts with `phs_`. Personal API keys still work but are being deprecated for local evaluation.

### Good Example - Server-side flag evaluation

```typescript
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";

import { posthog } from "@/lib/posthog-server";
import { FLAG_BETA_DASHBOARD } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Evaluate flag server-side with user context
  const isBetaDashboard = await posthog.isFeatureEnabled(
    FLAG_BETA_DASHBOARD,
    userId,
    {
      // Provide person properties for targeting rules
      personProperties: {
        email: request.headers.get("x-user-email"),
        plan: request.headers.get("x-user-plan"),
      },
    }
  );

  if (isBetaDashboard) {
    return NextResponse.json({ dashboard: "beta", features: [...] });
  }

  return NextResponse.json({ dashboard: "stable", features: [...] });
}
```

**Why good:** Local evaluation reduces latency (500ms to 50ms), personProperties enable targeting, server-side prevents client manipulation

### Good Example - Local-only evaluation for performance

```typescript
const flag = await posthog.isFeatureEnabled(FLAG_BETA_DASHBOARD, userId, {
  personProperties: { plan: "enterprise" },
  // Only evaluate locally - don't fall back to server
  onlyEvaluateLocally: true,
});

// Returns undefined if local evaluation fails
if (flag === undefined) {
  // Fall back to default behavior
  return defaultDashboard();
}
```

**Why good:** onlyEvaluateLocally prevents server roundtrips, explicit undefined handling for fallback

### Bad Example - Server-side without local evaluation

```typescript
import { PostHog } from "posthog-node";

// BAD: No personalApiKey = no local evaluation
const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

// BAD: Every call makes a network request (500ms latency)
const flag = await posthog.isFeatureEnabled("beta-dashboard", userId);
```

**Why bad:** No local evaluation = network request per flag check, high latency (500ms vs 10-50ms), increases PostHog API costs

---

## Pattern: Distributed/Stateless Environments (Serverless/Edge)

In serverless/edge environments, the default in-memory cache causes performance issues due to per-request initialization. Use an external cache provider to share flag definitions.

### The Problem

```typescript
// BAD: In Lambda/Edge, each invocation may cold start
// Flag definitions are fetched on EVERY cold start = slow + expensive
const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  personalApiKey: process.env.POSTHOG_FEATURE_FLAGS_KEY,
});
// Cold start: +500ms to fetch definitions
```

### Solution 1: External Cache (Redis) - Node.js/Python Only

```typescript
// lib/posthog-server-redis.ts
import { PostHog } from "posthog-node";
import type { FlagDefinitionCacheProvider } from "posthog-node";
import { createClient } from "redis";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY = "posthog:flag-definitions";

// Create a Redis-based cache provider (experimental feature)
const createRedisCache = (redisUrl: string): FlagDefinitionCacheProvider => {
  const client = createClient({ url: redisUrl });
  client.connect();

  return {
    async get() {
      const data = await client.get(CACHE_KEY);
      return data ? JSON.parse(data) : undefined;
    },
    async set(data) {
      await client.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(data));
    },
  };
};

export const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
  personalApiKey: process.env.POSTHOG_FEATURE_FLAGS_KEY,
  // Use Redis for shared flag definitions across instances
  flagDefinitionCacheProvider: createRedisCache(process.env.REDIS_URL!),
});
```

**Why good:** All Lambda/Edge instances share one cache, only one instance fetches definitions, eliminates cold start penalty

### Solution 2: Split Read/Write Pattern (Cloudflare KV)

For storage backends without atomic locking (Cloudflare KV), use a cron job to write and workers to read.

```typescript
// scheduled-worker.ts (cron job - writes to KV)
import { PostHog } from "posthog-node";

const CACHE_KEY = "posthog-flags";

export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const posthog = new PostHog(env.POSTHOG_API_KEY, {
      personalApiKey: env.POSTHOG_FEATURE_FLAGS_KEY,
    });

    // Fetch latest flag definitions
    const definitions = await posthog.getAllFlags("system");

    // Write to KV for all workers to read
    await env.FLAGS_KV.put(CACHE_KEY, JSON.stringify(definitions));
  },
};
```

```typescript
// request-worker.ts (handles requests - reads from KV)
const CACHE_KEY = "posthog-flags";

export default {
  async fetch(request: Request, env: Env) {
    // Read flag definitions from KV (no API call)
    const definitions = await env.FLAGS_KV.get(CACHE_KEY, "json");

    // Evaluate locally without network request
    const isEnabled = definitions?.["beta-feature"] === true;

    return new Response(JSON.stringify({ isEnabled }));
  },
};
```

**Why good:** Zero network requests for flag evaluation, cron controls update frequency, works with any KV-like storage

**Note:** External cache providers are currently experimental and available in Node.js and Python SDKs only.

---

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
