# Cloudflare Workers — KV Storage Examples

> KV namespace binding, get/put/delete/list operations, caching patterns, and stale-while-revalidate. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [Setup & Configuration](setup.md) — Project setup and wrangler.jsonc
- [D1 Database](d1.md) — Relational data with SQL
- [R2 Object Storage](r2.md) — File/blob storage
- [Routing & Hono](routing.md) — API routing and middleware

---

## KV Binding Configuration

```jsonc
// wrangler.jsonc
{
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "abc123def456",
    },
  ],
}
```

---

## Basic KV Operations

```typescript
// Good Example — KV with typed responses and TTL
const CACHE_TTL_SECONDS = 3_600; // 1 hour

interface UserProfile {
  name: string;
  email: string;
}

async function getCachedProfile(
  kv: KVNamespace,
  userId: string,
): Promise<UserProfile | null> {
  return kv.get<UserProfile>(`user:${userId}`, "json");
}

async function setCachedProfile(
  kv: KVNamespace,
  userId: string,
  profile: UserProfile,
): Promise<void> {
  await kv.put(`user:${userId}`, JSON.stringify(profile), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}

// In fetch handler
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const userId = new URL(request.url).searchParams.get("id");
    if (!userId) {
      return new Response("Missing id", { status: 400 });
    }

    const cached = await getCachedProfile(env.CACHE, userId);
    if (cached) {
      return Response.json(cached);
    }

    // Fetch from origin, cache in background
    const profile = await fetchProfileFromOrigin(userId);
    ctx.waitUntil(setCachedProfile(env.CACHE, userId, profile));
    return Response.json(profile);
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Typed `get<T>` with `"json"` return type, named TTL constant, `ctx.waitUntil()` for non-blocking cache writes, key prefix pattern for namespacing

```typescript
// Bad Example
const value = await env.CACHE.get("key"); // Untyped, returns string
await env.CACHE.put("key", data); // No TTL — data never expires
```

**Why bad:** Untyped get returns `string | null` requiring manual parsing, no TTL means stale data persists forever, no key prefix for organization

---

## Stale-While-Revalidate Cache

A Worker that caches expensive API responses in KV with TTL and stale-while-revalidate pattern.

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cache-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "your-kv-namespace-id",
    },
  ],
  "vars": {
    "UPSTREAM_API": "https://api.example.com",
  },
}
```

```typescript
// src/index.ts
import type { ExportedHandler } from "cloudflare:workers";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const STALE_TTL_SECONDS = 3_600; // 1 hour (serve stale while refreshing)
const CACHE_KEY_PREFIX = "api-cache:";

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

async function getCached<T>(
  kv: KVNamespace,
  key: string,
): Promise<{ data: T; isStale: boolean } | null> {
  const entry = await kv.get<CacheEntry<T>>(
    `${CACHE_KEY_PREFIX}${key}`,
    "json",
  );
  if (!entry) return null;

  const age = (Date.now() - entry.cachedAt) / 1_000;
  const isStale = age > entry.ttl;

  return { data: entry.data, isStale };
}

async function setCache<T>(
  kv: KVNamespace,
  key: string,
  data: T,
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    ttl: CACHE_TTL_SECONDS,
  };
  await kv.put(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(entry), {
    expirationTtl: STALE_TTL_SECONDS,
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const cacheKey = url.pathname + url.search;

    // Check cache
    const cached = await getCached<unknown>(env.CACHE, cacheKey);

    if (cached && !cached.isStale) {
      // Fresh cache hit
      return Response.json(cached.data, {
        headers: { "X-Cache": "HIT" },
      });
    }

    if (cached?.isStale) {
      // Stale: return stale data, refresh in background
      ctx.waitUntil(refreshCache(env, cacheKey, url));
      return Response.json(cached.data, {
        headers: { "X-Cache": "STALE" },
      });
    }

    // Cache miss: fetch from upstream
    const data = await fetchUpstream(env, url);
    ctx.waitUntil(setCache(env.CACHE, cacheKey, data));

    return Response.json(data, {
      headers: { "X-Cache": "MISS" },
    });
  },
} satisfies ExportedHandler<Env>;

async function fetchUpstream(env: Env, url: URL): Promise<unknown> {
  const upstream = `${env.UPSTREAM_API}${url.pathname}${url.search}`;
  const response = await fetch(upstream);
  if (!response.ok) {
    throw new Error(`Upstream error: ${response.status}`);
  }
  return response.json();
}

async function refreshCache(env: Env, key: string, url: URL): Promise<void> {
  try {
    const data = await fetchUpstream(env, url);
    await setCache(env.CACHE, key, data);
  } catch (error) {
    console.error("Background refresh failed:", error);
  }
}
```

**Why good:** Two-tier TTL (fresh vs stale), stale data served immediately while background refresh happens via `ctx.waitUntil()`, X-Cache headers for debugging, typed cache entries
