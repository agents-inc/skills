# Cloudflare Workers — Routing & Middleware Examples

> API framework integration, middleware, multi-handler workers (scheduled, queue), and service bindings. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Setup & Configuration](core.md) — Project setup and wrangler.jsonc
- [D1 Database](d1.md) — D1 CRUD API
- [R2 Object Storage](r2.md) — R2 file service
- [KV Storage](kv.md) — KV caching patterns
- [Durable Objects](durable-objects.md) — Stateful edge compute

---

## Basic Framework Setup (Hono)

```typescript
// src/index.ts — Hono with typed bindings
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Use wrangler types-generated Env
const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

app.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const user = await c.env.DB.prepare(
    "SELECT id, email, name FROM users WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});

app.post("/upload/:key", async (c) => {
  const key = c.req.param("key");
  await c.env.BUCKET.put(key, c.req.raw.body);
  return c.json({ uploaded: key }, 201);
});

// Export for Workers runtime
export default app;
```

**Why good:** `Hono<{ Bindings: Env }>` provides type-safe access to all bindings via `c.env`, built-in middleware for cors/logging, clean route definitions, direct D1/R2 binding access through context

---

## Framework with Multiple Handlers (Scheduled, Queue)

```typescript
// When you need fetch + scheduled + queue handlers
const app = new Hono<{ Bindings: Env }>();
// ... routes ...

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Cron trigger handler
    await cleanupExpiredData(env.DB);
  },
  async queue(batch, env, ctx) {
    // Queue consumer handler
    for (const message of batch.messages) {
      // process messages
    }
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Hono handles HTTP routing while other event handlers (scheduled, queue) are exported alongside `app.fetch`

---

## Production API with D1, KV, Middleware

A production-ready Workers API (using Hono) with D1, KV caching, middleware, error handling, and structured logging.

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

**Why good:** Structured logging with JSON, secure headers middleware, global error handler with HTTPException, health checks for all dependencies, KV caching with background refresh, modular route files

---

## Queues (Producer and Consumer)

```jsonc
// wrangler.jsonc
{
  "queues": {
    "producers": [
      {
        "binding": "EMAIL_QUEUE",
        "queue": "email-notifications",
      },
    ],
    "consumers": [
      {
        "queue": "email-notifications",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "email-dlq",
        "max_concurrency": 5,
      },
    ],
  },
}
```

```typescript
// Good Example — Queue producer and consumer
interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export default {
  // Producer: enqueue messages from HTTP requests
  async fetch(request, env, ctx): Promise<Response> {
    const message: EmailMessage = await request.json();
    await env.EMAIL_QUEUE.send(message);
    return Response.json({ queued: true }, { status: 202 });
  },

  // Consumer: process message batches
  async queue(batch, env, ctx): Promise<void> {
    for (const message of batch.messages) {
      try {
        const email = message.body as EmailMessage;
        await sendEmail(env, email);
        message.ack(); // Acknowledge successful processing
      } catch (error) {
        message.retry(); // Retry on failure
      }
    }
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Typed message interface, per-message ack/retry for fine-grained control, dead-letter queue for poison messages, batch processing for efficiency, 202 status for async acceptance

---

## Cron Triggers (Scheduled Workers)

```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": ["0 */6 * * *", "0 0 * * 1"],
  },
}
```

```typescript
// Good Example — Scheduled handler
export default {
  async fetch(request, env, ctx): Promise<Response> {
    return new Response("OK");
  },

  async scheduled(event, env, ctx): Promise<void> {
    switch (event.cron) {
      case "0 */6 * * *":
        // Every 6 hours: clean expired cache
        ctx.waitUntil(cleanExpiredEntries(env.DB));
        break;
      case "0 0 * * 1":
        // Every Monday: generate weekly report
        ctx.waitUntil(generateWeeklyReport(env));
        break;
    }
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Switch on `event.cron` to handle multiple schedules, `ctx.waitUntil()` for background work, separate concerns per cron expression

```bash
# Test cron locally
npx wrangler dev --test-scheduled

# Trigger manually
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

---

## Service Bindings (Worker-to-Worker RPC)

```jsonc
// wrangler.jsonc (caller worker)
{
  "services": [
    {
      "binding": "AUTH_SERVICE",
      "service": "auth-worker",
    },
  ],
}
```

```typescript
// Good Example — Service binding call
export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Call another Worker via service binding (no HTTP overhead)
    const authResponse = await env.AUTH_SERVICE.fetch(
      new Request("https://auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: request.headers.get("authorization") }),
      }),
    );

    if (!authResponse.ok) {
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response("Authenticated!");
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Service binding bypasses public internet, no DNS resolution or TLS overhead, the call is in-process within Cloudflare's network

---

## Workers AI

```jsonc
// wrangler.jsonc
{
  "ai": {
    "binding": "AI",
  },
}
```

```typescript
// Good Example — Workers AI text generation
const MAX_PROMPT_LENGTH = 4_000;
const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { prompt } = await request.json<{ prompt: string }>();
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return new Response("Prompt too long", { status: 400 });
    }

    const result = await env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    return Response.json(result);
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Named model constant, input validation before inference, structured message format, type-safe AI binding

---

## Streaming Large Responses

```typescript
// Good Example — Stream a large R2 file
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const object = await env.BUCKET.get("large-file.csv");
    if (!object) {
      return new Response("Not Found", { status: 404 });
    }

    // Stream body directly — never call .text() or .arrayBuffer() on large files
    return new Response(object.body, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="large-file.csv"',
      },
    });
  },
} satisfies ExportedHandler<Env>;
```

```typescript
// Good Example — Transform stream pipeline
async function transformResponse(response: Response): Promise<Response> {
  const { readable, writable } = new TransformStream({
    transform(chunk, controller) {
      // Process each chunk without buffering the whole body
      controller.enqueue(chunk);
    },
  });

  response.body?.pipeTo(writable);
  return new Response(readable, response);
}
```

**Why good:** Processes data chunk-by-chunk, never loads entire payload into memory, compatible with R2/external fetch responses
