# Cloudflare Workers Examples

## Example 1: Basic Worker with Routing

A minimal Worker that handles multiple routes with proper error handling and CORS.

```typescript
// src/index.ts
import type { ExportedHandler } from "cloudflare:workers";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const ROUTES = {
  HEALTH: "/health",
  API_PREFIX: "/api/",
} as const;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // Health check
      if (url.pathname === ROUTES.HEALTH) {
        return Response.json({ status: "healthy", timestamp: Date.now() });
      }

      // API routes
      if (url.pathname.startsWith(ROUTES.API_PREFIX)) {
        const response = await handleApiRoute(url, request, env);
        // Add CORS headers to all API responses
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          headers.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }

      return Response.json({ error: "Not Found" }, { status: 404 });
    } catch (error) {
      console.error("Unhandled error:", error);
      return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

async function handleApiRoute(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const path = url.pathname.slice(ROUTES.API_PREFIX.length);

  switch (path) {
    case "users":
      if (request.method === "GET") {
        return Response.json({ users: [] });
      }
      return new Response("Method Not Allowed", { status: 405 });
    default:
      return Response.json({ error: "Not Found" }, { status: 404 });
  }
}
```

---

## Example 2: KV-Backed Cache Layer

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

---

## Example 3: D1 Database CRUD API

A full CRUD API backed by D1 with parameterized queries and proper error handling.

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "d1-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "todo-app",
      "database_id": "your-database-id",
      "migrations_dir": "migrations",
    },
  ],
}
```

```sql
-- migrations/0001_create_todos.sql
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
```

```typescript
// src/index.ts
import { Hono } from "hono";

interface Todo {
  id: number;
  title: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_TITLE_LENGTH = 500;

const app = new Hono<{ Bindings: Env }>();

// List todos with pagination
app.get("/todos", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  const { results: todos } = await c.env.DB.prepare(
    "SELECT * FROM todos ORDER BY created_at DESC LIMIT ? OFFSET ?",
  )
    .bind(DEFAULT_PAGE_SIZE, offset)
    .all<Todo>();

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM todos",
  ).first<{ total: number }>();

  return c.json({
    todos,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    total: count?.total ?? 0,
  });
});

// Get single todo
app.get("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const todo = await c.env.DB.prepare("SELECT * FROM todos WHERE id = ?")
    .bind(id)
    .first<Todo>();

  if (!todo) {
    return c.json({ error: "Todo not found" }, 404);
  }
  return c.json(todo);
});

// Create todo
app.post("/todos", async (c) => {
  const { title } = await c.req.json<{ title: string }>();

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return c.json({ error: "Invalid title" }, 400);
  }

  const result = await c.env.DB.prepare(
    "INSERT INTO todos (title) VALUES (?) RETURNING *",
  )
    .bind(title)
    .first<Todo>();

  return c.json(result, 201);
});

// Update todo
app.put("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { title, completed } = await c.req.json<{
    title?: string;
    completed?: boolean;
  }>();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) {
    if (title.length > MAX_TITLE_LENGTH) {
      return c.json({ error: "Title too long" }, 400);
    }
    updates.push("title = ?");
    values.push(title);
  }
  if (completed !== undefined) {
    updates.push("completed = ?");
    values.push(completed ? 1 : 0);
  }

  if (updates.length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE todos SET ${updates.join(", ")} WHERE id = ? RETURNING *`,
  )
    .bind(...values)
    .first<Todo>();

  if (!result) {
    return c.json({ error: "Todo not found" }, 404);
  }
  return c.json(result);
});

// Delete todo
app.delete("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const result = await c.env.DB.prepare("DELETE FROM todos WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Todo not found" }, 404);
  }
  return c.body(null, 204);
});

export default app;
```

---

## Example 4: R2 File Storage Service

An R2-backed file upload/download service with presigned-URL-like key generation and content-type handling.

```typescript
// src/index.ts
import { Hono } from "hono";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

const app = new Hono<{ Bindings: Env }>();

// Upload file
app.put("/files/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const contentType =
    c.req.header("content-type") ?? "application/octet-stream";
  const contentLength = Number(c.req.header("content-length") ?? 0);

  if (contentLength > MAX_FILE_SIZE) {
    return c.json({ error: "File too large", maxSize: MAX_FILE_SIZE }, 413);
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return c.json({ error: "Content type not allowed" }, 415);
  }

  const object = await c.env.BUCKET.put(key, c.req.raw.body, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      uploadedBy: c.req.header("x-user-id") ?? "anonymous",
    },
  });

  return c.json(
    {
      key: object?.key,
      size: object?.size,
      etag: object?.etag,
    },
    201,
  );
});

// Download file (streaming)
app.get("/files/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.BUCKET.get(key);

  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // Stream body directly to response
  return new Response(object.body, { headers });
});

// List files with prefix
app.get("/files", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const cursor = c.req.query("cursor");

  const listed = await c.env.BUCKET.list({
    prefix,
    cursor: cursor ?? undefined,
    limit: 100,
  });

  return c.json({
    objects: listed.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      etag: obj.etag,
    })),
    truncated: listed.truncated,
    cursor: listed.truncated ? listed.cursor : undefined,
  });
});

// Delete file
app.delete("/files/:key{.+}", async (c) => {
  const key = c.req.param("key");
  await c.env.BUCKET.delete(key);
  return c.body(null, 204);
});

export default app;
```

---

## Example 5: Durable Objects Rate Limiter

A per-key rate limiter using Durable Objects for strong consistency and SQLite storage.

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "rate-limiter",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "RATE_LIMITER", "class_name": "RateLimiter" }],
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["RateLimiter"] }],
}
```

```typescript
// src/rate-limiter.ts
import { DurableObject } from "cloudflare:workers";

const WINDOW_SIZE_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 100; // 100 requests per window

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)",
      );
    });
  }

  async checkLimit(): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    // Clean old entries and count in one batch (write coalescing)
    this.ctx.storage.sql.exec(
      "DELETE FROM requests WHERE timestamp < ?",
      windowStart,
    );

    const countResult = this.ctx.storage.sql.exec<{ count: number }>(
      "SELECT COUNT(*) as count FROM requests WHERE timestamp >= ?",
      windowStart,
    );
    const count = [...countResult][0].count;

    if (count >= MAX_REQUESTS) {
      // Find when the oldest request in the window expires
      const oldestResult = this.ctx.storage.sql.exec<{ timestamp: number }>(
        "SELECT MIN(timestamp) as timestamp FROM requests WHERE timestamp >= ?",
        windowStart,
      );
      const oldest = [...oldestResult][0].timestamp;

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + WINDOW_SIZE_MS,
      };
    }

    // Record this request
    this.ctx.storage.sql.exec(
      "INSERT INTO requests (timestamp) VALUES (?)",
      now,
    );

    return {
      allowed: true,
      remaining: MAX_REQUESTS - count - 1,
      resetAt: now + WINDOW_SIZE_MS,
    };
  }
}
```

```typescript
// src/index.ts
import type { ExportedHandler } from "cloudflare:workers";

export { RateLimiter } from "./rate-limiter";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Rate limit by IP address (one DO per IP)
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const id = env.RATE_LIMITER.idFromName(ip);
    const limiter = env.RATE_LIMITER.get(id);

    const result = await limiter.checkLimit();

    if (!result.allowed) {
      return Response.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((result.resetAt - Date.now()) / 1_000),
            ),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.resetAt),
          },
        },
      );
    }

    // Process the actual request
    return Response.json(
      {
        message: "OK",
        rateLimitRemaining: result.remaining,
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetAt),
        },
      },
    );
  },
} satisfies ExportedHandler<Env>;
```

---

## Example 6: Full Hono API on Workers

A production-ready Hono API with D1, KV caching, middleware, error handling, and structured logging.

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "hono-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1.0,
  },
  "placement": { "mode": "smart" },
  "upload_source_maps": true,
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "hono-api-db",
      "database_id": "your-id",
      "migrations_dir": "migrations",
    },
  ],
  "kv_namespaces": [{ "binding": "CACHE", "id": "your-kv-id" }],
  "vars": {
    "ENVIRONMENT": "production",
  },
  "triggers": {
    "crons": ["0 2 * * *"],
  },
}
```

```typescript
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { userRoutes } from "./routes/users";
import { healthRoutes } from "./routes/health";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", cors());
app.use("*", secureHeaders());

// Structured request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(
    JSON.stringify({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      env: c.env.ENVIRONMENT,
    }),
  );
});

// Global error handler
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error("Unhandled error:", error);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Mount routes
app.route("/", healthRoutes);
app.route("/api/users", userRoutes);

// 404 fallback
app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Export with additional handlers
export default {
  fetch: app.fetch,

  async scheduled(event, env, ctx): Promise<void> {
    if (event.cron === "0 2 * * *") {
      // Daily cleanup at 2 AM
      ctx.waitUntil(
        env.DB.prepare(
          "DELETE FROM sessions WHERE expires_at < datetime('now')",
        ).run(),
      );
    }
  },
} satisfies ExportedHandler<Env>;
```

```typescript
// src/routes/health.ts
import { Hono } from "hono";

const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/health", async (c) => {
  const checks: Record<string, string> = {};

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.database = "healthy";
  } catch {
    checks.database = "unhealthy";
  }

  try {
    await c.env.CACHE.get("health-check");
    checks.cache = "healthy";
  } catch {
    checks.cache = "unhealthy";
  }

  const healthy = Object.values(checks).every((v) => v === "healthy");
  return c.json(
    { status: healthy ? "healthy" : "degraded", checks },
    healthy ? 200 : 503,
  );
});

export { healthRoutes };
```

```typescript
// src/routes/users.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

const CACHE_TTL_SECONDS = 300;
const DEFAULT_PAGE_SIZE = 20;

const userRoutes = new Hono<{ Bindings: Env }>();

// List users with KV caching
userRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const cacheKey = `users:page:${page}`;

  // Check KV cache first
  const cached = await c.env.CACHE.get<{ users: User[]; total: number }>(
    cacheKey,
    "json",
  );
  if (cached) {
    return c.json({ ...cached, cached: true });
  }

  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const { results: users } = await c.env.DB.prepare(
    "SELECT id, email, name, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?",
  )
    .bind(DEFAULT_PAGE_SIZE, offset)
    .all<User>();

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM users",
  ).first<{ total: number }>();

  const data = {
    users,
    total: count?.total ?? 0,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  // Cache in background
  c.executionCtx.waitUntil(
    c.env.CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: CACHE_TTL_SECONDS,
    }),
  );

  return c.json({ ...data, cached: false });
});

// Get single user
userRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const user = await c.env.DB.prepare(
    "SELECT id, email, name, created_at FROM users WHERE id = ?",
  )
    .bind(id)
    .first<User>();

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return c.json(user);
});

// Create user
userRoutes.post("/", async (c) => {
  const { email, name } = await c.req.json<{ email: string; name: string }>();

  if (!email || !name) {
    throw new HTTPException(400, { message: "email and name are required" });
  }

  const user = await c.env.DB.prepare(
    "INSERT INTO users (email, name) VALUES (?, ?) RETURNING id, email, name, created_at",
  )
    .bind(email, name)
    .first<User>();

  return c.json(user, 201);
});

export { userRoutes };
```

---

## Example 7: GitHub Actions CI/CD Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy Worker

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npx wrangler types
      - run: npx tsc --noEmit
      - run: npx vitest run

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          # Optionally deploy to staging first
          # command: deploy --env staging

      - name: Apply D1 Migrations
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: d1 migrations apply my-database --remote
```
