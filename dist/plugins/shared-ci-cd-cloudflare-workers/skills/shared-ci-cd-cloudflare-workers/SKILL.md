---
name: shared-ci-cd-cloudflare-workers
description: Cloudflare Workers edge compute platform — Wrangler CLI, KV, D1, R2, Durable Objects, Queues, Workers AI, and Hono integration
---

# Cloudflare Workers Patterns

> **Quick Guide:** Cloudflare Workers run TypeScript/JavaScript on Cloudflare's global edge network with V8 isolates (not containers). Use `wrangler.jsonc` for configuration, `wrangler dev` for local development, and `wrangler deploy` for production. Access KV, D1, R2, Queues, Durable Objects, and Workers AI through type-safe bindings on the `env` parameter. Run `wrangler types` to auto-generate your `Env` interface. Pair with Hono for structured API routing. Stream large payloads — Workers have a 128 MB memory limit. Never store request-scoped state in module-level variables.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST run `wrangler types` to generate your Env interface — NEVER hand-write binding types)**

**(You MUST use `wrangler.jsonc` for new projects — Cloudflare recommends JSON config and some features are JSON-only)**

**(You MUST stream large request/response bodies — NEVER buffer entire payloads in memory (128 MB limit))**

**(You MUST avoid module-level mutable state — Workers reuse V8 isolates across requests, causing cross-request data leaks)**

**(You MUST use bindings for Cloudflare services (KV, D1, R2, Queues) — NEVER use REST APIs from within Workers)**

</critical_requirements>

---

**Detailed Resources:**

- For code examples, see [examples/](examples/) directory:
  - [cloudflare-workers.md](examples/cloudflare-workers.md) - Basic worker, KV cache, D1 database, R2 storage, Durable Objects, Hono API
- For Wrangler commands and binding types, see [reference.md](reference.md)

---

**Auto-detection:** Cloudflare Workers, wrangler, wrangler.toml, wrangler.jsonc, Workers KV, Cloudflare KV, D1 database, R2 bucket, Durable Objects, Cloudflare Queues, Workers AI, service binding, miniflare, compatibility_date, compatibility_flags, nodejs_compat, cloudflare:workers, ExportedHandler, DurableObject, wrangler dev, wrangler deploy, wrangler types, Cloudflare Pages Functions, edge worker, CF Worker

**When to use:**

- Deploying TypeScript/JavaScript to Cloudflare's edge network
- Configuring Wrangler CLI for local development and deployment
- Using Cloudflare bindings: KV, D1, R2, Queues, Durable Objects, Workers AI
- Building APIs on Workers with Hono framework
- Implementing real-time features with Durable Objects and WebSockets
- Setting up cron triggers and scheduled handlers
- Configuring service bindings for worker-to-worker communication
- Managing environment variables, secrets, and multi-environment deploys

**When NOT to use:**

- Long-running compute tasks exceeding CPU time limits (use traditional servers or Workflows)
- Applications requiring persistent TCP connections to external databases without Hyperdrive
- Workloads needing more than 128 MB memory per request

**Key patterns covered:**

- Wrangler configuration (`wrangler.jsonc`) and project setup
- Fetch handler, scheduled handler, and queue handler
- KV key-value storage (caching, config, session data)
- D1 SQLite database (relational data at the edge)
- R2 S3-compatible object storage (files, uploads, assets)
- Durable Objects (stateful edge compute, WebSockets, coordination)
- Cloudflare Queues (async message processing)
- Workers AI (inference at the edge)
- Hono framework integration with typed bindings
- Environment variables, secrets, and multi-environment config
- Service bindings (worker-to-worker RPC)
- Cron triggers and scheduled workers
- Streaming and performance optimization
- Testing with `@cloudflare/vitest-pool-workers`

---

<philosophy>

## Philosophy

Cloudflare Workers run on V8 isolates (not containers) across 300+ data centers worldwide. They start in under 5ms with zero cold starts. The programming model is fundamentally different from traditional servers:

1. **Bindings over APIs** - Access Cloudflare services (KV, D1, R2, Queues) through direct in-process bindings on the `env` parameter, not REST API calls. Bindings have zero network hop and zero auth overhead.
2. **Stateless by default** - Each request gets a fresh execution context. Workers reuse V8 isolates, so module-level variables persist across requests — this is a bug source, not a feature.
3. **Stream everything** - Workers have a 128 MB memory limit. Buffer nothing; stream request and response bodies using `TransformStream` and `pipeTo`.
4. **Edge-first architecture** - Code runs closest to the user. Use Durable Objects when you need coordination or state; use D1/KV/R2 for persistence.

**When to use Workers:**

- API endpoints, middleware, and request routing
- Caching layers and content transformation
- Webhook receivers and event processors
- Real-time collaboration (with Durable Objects)
- Full-stack applications (with Workers Static Assets or Pages)

**When NOT to use Workers:**

- CPU-intensive compute exceeding limits (10ms free / 30s paid per request)
- Workloads requiring more than 128 MB memory
- Applications needing persistent database connections (use Hyperdrive as a proxy)
- Long-running background jobs exceeding limits (use Workflows for durable execution)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Project Setup and Wrangler Configuration

Every Workers project starts with a `wrangler.jsonc` configuration file. Cloudflare recommends JSON format for new projects — some newer features are JSON-only.

#### Project Initialization

```bash
# Create a new Workers project
npm create cloudflare@latest -- my-worker

# Or with Hono template
npm create hono@latest my-api
# Select "cloudflare-workers" template
```

#### Configuration

```jsonc
// wrangler.jsonc - Good Example
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1.0,
  },
  "placement": {
    "mode": "smart",
  },
  "upload_source_maps": true,
}
```

**Why good:** JSON schema enables IDE autocomplete, `nodejs_compat` flag unlocks Node.js built-in modules, `observability` provides logs and traces in production, `smart` placement optimizes for latency, source maps enable readable stack traces

```toml
# wrangler.toml - Acceptable but not recommended for new projects
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

**Why bad:** TOML format misses JSON-only features, outdated compatibility_date misses runtime improvements and bug fixes, no observability configured (production is a black box), no source maps

#### Type Generation

```bash
# Generate Env interface from wrangler.jsonc bindings
npx wrangler types
# Creates worker-configuration.d.ts with all binding types
```

---

### Pattern 2: Fetch Handler (Request/Response)

The fetch handler is the entry point for HTTP requests. It receives the standard Web API `Request` object and must return a `Response`.

#### Module Worker Syntax

```typescript
// src/index.ts - Good Example
import type { ExportedHandler } from "cloudflare:workers";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return Response.json({ status: "healthy" });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** `satisfies ExportedHandler<Env>` provides type checking while preserving literal types, `Env` is auto-generated by `wrangler types`, uses Web API standard `Request`/`Response`, named constants for CORS headers

```typescript
// Bad Example
let requestCount = 0; // Module-level mutable state

export default {
  async fetch(request: Request, env: any, ctx: any) {
    requestCount++; // Cross-request data leak
    const body = await request.text(); // Buffers entire body in memory
    return new Response(body);
  },
};
```

**Why bad:** Module-level `requestCount` leaks across requests (V8 isolate reuse), `env: any` loses type safety, buffering `request.text()` risks hitting 128 MB limit on large payloads

---

### Pattern 3: KV Key-Value Storage

KV is an eventually-consistent key-value store for read-heavy workloads: configuration, session data, cached API responses, and feature flags.

#### Configuration

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

#### Usage

```typescript
// Good Example - KV with typed responses and TTL
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

**When to use:** Read-heavy workloads (config, cache, feature flags) where eventual consistency is acceptable. KV writes propagate globally in ~60 seconds.

**When not to use:** Relational data (use D1), frequent writes to the same key, strong consistency requirements (use Durable Objects).

---

### Pattern 4: D1 SQLite Database

D1 is a serverless SQLite database running at the edge. It supports full SQL, parameterized queries, batch operations, and sessions for sequential consistency.

#### Configuration

```jsonc
// wrangler.jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-app-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "migrations_dir": "migrations",
    },
  ],
}
```

#### Parameterized Queries

```typescript
// Good Example - D1 with parameterized queries and batch
interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

const DEFAULT_PAGE_SIZE = 20;

async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  const result = await db
    .prepare("SELECT id, email, name, created_at FROM users WHERE email = ?")
    .bind(email)
    .first<User>();
  return result;
}

async function listUsers(db: D1Database, page: number): Promise<User[]> {
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const { results } = await db
    .prepare(
      "SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(DEFAULT_PAGE_SIZE, offset)
    .all<User>();
  return results;
}

// Batch operations (executed sequentially, atomically)
async function createUserWithProfile(
  db: D1Database,
  email: string,
  name: string,
  bio: string,
): Promise<void> {
  await db.batch([
    db
      .prepare("INSERT INTO users (email, name) VALUES (?, ?)")
      .bind(email, name),
    db
      .prepare("INSERT INTO profiles (user_email, bio) VALUES (?, ?)")
      .bind(email, bio),
  ]);
}
```

**Why good:** Parameterized queries prevent SQL injection, `first<T>()` for single row with type, `all<T>()` for multiple rows, `batch()` for atomic multi-statement operations, named page size constant

```typescript
// Bad Example
const result = await env.DB.exec(
  `SELECT * FROM users WHERE email = '${email}'`, // SQL injection
);
```

**Why bad:** String interpolation enables SQL injection, `exec()` does not support parameter binding, `SELECT *` fetches unnecessary columns

#### Migrations

```bash
# Create a migration
npx wrangler d1 migrations create my-app-db create_users_table

# Apply locally
npx wrangler d1 migrations apply my-app-db --local

# Apply to production
npx wrangler d1 migrations apply my-app-db --remote
```

---

### Pattern 5: R2 Object Storage

R2 is S3-compatible object storage with zero egress fees. Use it for file uploads, images, documents, and any blob data.

#### Configuration

```jsonc
// wrangler.jsonc
{
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "my-files",
    },
  ],
}
```

#### Usage

```typescript
// Good Example - R2 file operations with streaming
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Remove leading /

    switch (request.method) {
      case "GET": {
        const object = await env.BUCKET.get(key);
        if (!object) {
          return new Response("Not Found", { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        // Stream body directly — never buffer
        return new Response(object.body, { headers });
      }

      case "PUT": {
        const contentLength = Number(
          request.headers.get("content-length") ?? 0,
        );
        if (contentLength > MAX_UPLOAD_SIZE) {
          return new Response("File too large", { status: 413 });
        }
        await env.BUCKET.put(key, request.body, {
          httpMetadata: request.headers,
        });
        return new Response(`Uploaded ${key}`, { status: 201 });
      }

      case "DELETE": {
        await env.BUCKET.delete(key);
        return new Response(null, { status: 204 });
      }

      default:
        return new Response("Method Not Allowed", { status: 405 });
    }
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** Streams R2 object body directly to response (no buffering), sets HTTP metadata and ETag for caching, validates upload size before accepting, uses `request.body` stream for uploads, named size constant

```typescript
// Bad Example
const object = await env.BUCKET.get(key);
const data = await object.arrayBuffer(); // Buffers entire file in memory
return new Response(data);
```

**Why bad:** `arrayBuffer()` loads entire file into memory — a 100 MB file exceeds the 128 MB Worker limit and crashes

---

### Pattern 6: Durable Objects (Stateful Edge Compute)

Durable Objects provide single-threaded, strongly consistent, stateful compute at the edge. Each instance has its own SQLite storage and handles requests serially, eliminating race conditions.

#### Configuration

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "COUNTER",
        "class_name": "Counter",
      },
    ],
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Counter"] }],
}
```

#### Implementation

```typescript
// src/counter.ts - Good Example: Durable Object with RPC and SQLite
import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Run migrations before processing any requests
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS counters (
          name TEXT PRIMARY KEY,
          value INTEGER NOT NULL DEFAULT 0
        )
      `);
    });
  }

  // RPC methods — automatically exposed, type-safe
  async increment(name: string, amount: number = 1): Promise<number> {
    const result = this.ctx.storage.sql.exec<{ value: number }>(
      `INSERT INTO counters (name, value) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET value = value + ?
       RETURNING value`,
      name,
      amount,
      amount,
    );
    return [...result][0].value;
  }

  async getCount(name: string): Promise<number> {
    const result = this.ctx.storage.sql.exec<{ value: number }>(
      "SELECT value FROM counters WHERE name = ?",
      name,
    );
    const rows = [...result];
    return rows.length > 0 ? rows[0].value : 0;
  }
}

// src/index.ts - Calling a Durable Object
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const id = env.COUNTER.idFromName("global");
    const stub = env.COUNTER.get(id);

    const count = await stub.increment("page-views");
    return Response.json({ count });
  },
} satisfies ExportedHandler<Env>;
```

**Why good:** SQLite storage for durable persistence, `blockConcurrencyWhile` for safe schema migration, RPC methods instead of fetch handler (type-safe, ergonomic), `idFromName` for deterministic routing, SQL with parameterized queries

```typescript
// Bad Example - Single global Durable Object
const id = env.STATE.idFromName("global-state"); // Everything goes through one DO
const stub = env.STATE.get(id);
await stub.fetch(request); // Using fetch instead of RPC
```

**Why bad:** Single global DO becomes a bottleneck (~1000 req/sec max), `fetch()` requires manual request/response parsing — use RPC methods instead

**When to use:** Coordination (chat rooms, collaborative editing), per-entity state (user sessions, game instances), WebSocket connections, rate limiting per key.

**When not to use:** Stateless request handling, high fan-out scenarios, global rate limiting (bottleneck).

---

### Pattern 7: Cloudflare Queues (Async Message Processing)

Queues decouple producers from consumers for background processing, fan-out, and buffering. Messages are delivered at-least-once with configurable retries and dead-letter queues.

#### Configuration

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

#### Producer and Consumer

```typescript
// Good Example - Queue producer and consumer
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

### Pattern 8: Workers AI (Inference at the Edge)

Workers AI runs machine learning models (LLMs, embeddings, image generation) on Cloudflare's GPU network with no infrastructure management.

#### Configuration

```jsonc
// wrangler.jsonc
{
  "ai": {
    "binding": "AI",
  },
}
```

#### Usage

```typescript
// Good Example - Workers AI text generation
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

### Pattern 9: Hono Framework on Workers

Hono is an ultra-fast web framework designed for edge runtimes. It provides routing, middleware, and type-safe context — the recommended way to build structured APIs on Workers.

#### Setup

```typescript
// src/index.ts - Good Example: Hono with typed bindings
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

#### Hono with Multiple Handlers (Scheduled, Queue)

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

### Pattern 10: Environment Variables, Secrets, and Multi-Environment Config

Workers use bindings for configuration. Secrets are set via CLI; vars are in config. Environments create separate Workers per stage.

#### Secrets Management

```bash
# Set secrets (never in wrangler.jsonc or source code)
npx wrangler secret put API_KEY
npx wrangler secret put DATABASE_URL

# Bulk upload from file
npx wrangler deploy --secrets-file .env.production

# Local development secrets
# Create .dev.vars (gitignored)
echo 'API_KEY=dev-key-12345' >> .dev.vars
```

#### Multi-Environment Configuration

```jsonc
// wrangler.jsonc - Good Example
{
  "name": "my-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "ENVIRONMENT": "production",
    "LOG_LEVEL": "warn",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-app-prod",
      "database_id": "prod-id",
    },
  ],
  "env": {
    "staging": {
      "name": "my-api-staging",
      "vars": {
        "ENVIRONMENT": "staging",
        "LOG_LEVEL": "debug",
      },
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "my-app-staging",
          "database_id": "staging-id",
        },
      ],
    },
  },
}
```

**Why good:** Bindings are re-declared per environment (they do not inherit), environment-specific vars override top-level, separate database per environment, secrets kept out of config

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Deploy to production (default)
npx wrangler deploy
```

---

### Pattern 11: Service Bindings (Worker-to-Worker RPC)

Service bindings allow Workers to call other Workers directly — zero cost, no public internet, type-safe RPC.

#### Configuration

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

#### Usage

```typescript
// Good Example - Service binding RPC call
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

### Pattern 12: Cron Triggers (Scheduled Workers)

Cron triggers invoke Workers on a schedule without an HTTP request. Use for cleanup, data sync, health checks, and periodic processing.

#### Configuration

```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": ["0 */6 * * *", "0 0 * * 1"],
  },
}
```

#### Scheduled Handler

```typescript
// Good Example - Scheduled handler
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

#### Testing Cron Locally

```bash
# Start dev server with scheduled trigger support
npx wrangler dev --test-scheduled

# Trigger manually
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

---

### Pattern 13: WebSockets with Durable Objects

Plain Workers cannot maintain WebSocket connections across isolate evictions. Use Durable Objects with the Hibernatable WebSocket API for persistent, cost-effective real-time connections.

#### Implementation

```typescript
// src/chat-room.ts - Good Example: Hibernatable WebSockets
import { DurableObject } from "cloudflare:workers";

interface ConnectionState {
  userId: string;
  joinedAt: number;
}

export class ChatRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept with hibernation support
    this.ctx.acceptWebSocket(server);

    // Attach metadata that survives hibernation
    const state: ConnectionState = {
      userId: new URL(request.url).searchParams.get("userId") ?? "anonymous",
      joinedAt: Date.now(),
    };
    server.serializeAttachment(state);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Called when a message arrives (even after hibernation)
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const state = ws.deserializeAttachment() as ConnectionState;
    const data =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    // Broadcast to all connected clients
    for (const client of this.ctx.getWebSockets()) {
      if (client !== ws) {
        client.send(
          JSON.stringify({
            userId: state.userId,
            message: data,
            timestamp: Date.now(),
          }),
        );
      }
    }
  }

  // MUST reciprocate close to avoid 1006 errors
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    ws.close(1011, "Internal error");
  }
}
```

**Why good:** Hibernatable API keeps connections alive while DO sleeps (reduces cost), `serializeAttachment` preserves metadata across hibernation, broadcasts to all clients via `getWebSockets()`, reciprocates close to prevent 1006 errors

---

### Pattern 14: Streaming and Performance

Workers have a 128 MB memory limit. Stream large payloads instead of buffering them.

#### Streaming Response

```typescript
// Good Example - Stream a large response
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

#### Transform Stream

```typescript
// Good Example - Transform stream pipeline
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

---

### Pattern 15: Testing with Vitest Pool Workers

Use `@cloudflare/vitest-pool-workers` to test inside the actual Workers runtime with real bindings.

#### Setup

```typescript
// vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
```

#### Test Example

```typescript
// src/__tests__/api.test.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../index";

describe("API Worker", () => {
  it("returns health check", async () => {
    const request = new Request("http://localhost/health");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "healthy" });
  });

  it("uses D1 database", async () => {
    // Real D1 binding available in test
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)",
    );
    await env.DB.prepare("INSERT INTO test (name) VALUES (?)")
      .bind("test-name")
      .run();

    const result = await env.DB.prepare(
      "SELECT name FROM test WHERE id = 1",
    ).first<{ name: string }>();
    expect(result?.name).toBe("test-name");
  });
});
```

**Why good:** Tests run inside actual Workers runtime (not Node.js), real bindings (KV, D1, R2) available in tests, isolated storage per test, catches runtime-specific issues early

</patterns>

---

<performance>

## Performance Optimization

### Request Processing

| Technique                             | Impact                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| Smart Placement (`"mode": "smart"`)   | Routes to optimal data center based on binding locations |
| Streaming responses                   | Avoids 128 MB memory limit, improves TTFB                |
| `ctx.waitUntil()` for background work | Returns response immediately, processes async work after |
| `nodejs_compat` flag                  | Access Node.js built-in modules (crypto, buffer, stream) |

### Storage Performance

| Storage         | Reads              | Writes                  | Consistency              | Best For                 |
| --------------- | ------------------ | ----------------------- | ------------------------ | ------------------------ |
| KV              | Fast (edge cached) | Slow (~60s propagation) | Eventually consistent    | Cache, config, flags     |
| D1              | Medium             | Medium                  | Strong (per-region)      | Relational data, queries |
| R2              | Medium             | Medium                  | Strong                   | Files, blobs, uploads    |
| Durable Objects | Fast (in-memory)   | Fast (SQLite)           | Strong (single-threaded) | Coordination, real-time  |

### Hyperdrive for External Databases

When connecting to PostgreSQL/MySQL outside Cloudflare, always use Hyperdrive. It maintains a connection pool close to your database, eliminating per-request TCP/TLS overhead.

```jsonc
// wrangler.jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "hyperdrive-config-id",
    },
  ],
}
```

### CPU Time Limits

| Plan          | CPU Time per Request                                |
| ------------- | --------------------------------------------------- |
| Free          | 10 ms                                               |
| Paid          | 30 seconds (default), configurable up to 15 minutes |
| Cron Triggers | 15 minutes                                          |

</performance>

---

<decision_framework>

## Decision Framework

### Choosing a Storage Primitive

```
What kind of data?
  |
  +-- Key-value pairs (cache, config, sessions)
  |     +-- Read-heavy, eventual consistency OK --> KV
  |     +-- Strong consistency needed --> Durable Objects
  |
  +-- Relational data with queries
  |     +-- Edge-native SQLite --> D1
  |     +-- External PostgreSQL/MySQL --> Hyperdrive
  |
  +-- Files and blobs (images, documents)
  |     +-- S3-compatible storage --> R2
  |
  +-- Coordination state (chat, multiplayer, collaboration)
  |     +-- Single-threaded consistency --> Durable Objects
  |
  +-- Message passing / background work
        +-- Simple fan-out, buffering --> Queues
        +-- Multi-step durable execution --> Workflows
```

### Choosing Between Workers and Pages

```
What are you building?
  |
  +-- API only (no frontend) --> Workers
  |
  +-- Static site + API --> Pages with Functions
  |
  +-- Full-stack with SSR --> Pages (framework) or Workers + Static Assets
  |
  +-- Background processing / cron --> Workers (Pages lacks cron support)
  |
  +-- Real-time / WebSockets --> Workers + Durable Objects
```

### When to Use Durable Objects vs D1

```
Do you need coordination between concurrent requests?
  |
  +-- YES (chat, game, collaboration) --> Durable Objects
  |     +-- Single-threaded, no race conditions
  |     +-- WebSocket support with hibernation
  |     +-- Per-entity sharding (one DO per room/session)
  |
  +-- NO (CRUD, reporting, querying) --> D1
        +-- Full SQL support
        +-- Cross-entity queries
        +-- Traditional database patterns
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Hono**: Recommended API framework for Workers — typed bindings via `Hono<{ Bindings: Env }>`, middleware ecosystem, zero overhead
- **Drizzle ORM**: Works with D1 for type-safe SQL queries and migrations
- **Prisma ORM**: Supports Workers and D1 since v5.12.0
- **Vitest**: `@cloudflare/vitest-pool-workers` for testing inside Workers runtime
- **GitHub Actions**: `cloudflare/wrangler-action@v3` for CI/CD deployment
- **Hyperdrive**: Connection pooling proxy for external PostgreSQL/MySQL
- **Vectorize**: Vector database for embeddings and semantic search with Workers AI

**Replaces / Conflicts with:**

- **AWS Lambda@Edge / CloudFront Functions**: Cloudflare Workers are the equivalent edge compute platform
- **Vercel Edge Functions**: Similar V8-based edge runtime but vendor-locked to Vercel
- **Express/Fastify on Workers**: Use Hono instead — designed for edge runtimes, smaller bundle

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Storing request-scoped data in module-level variables (V8 isolate reuse causes cross-request leaks)
- Buffering entire request/response bodies with `.text()` / `.arrayBuffer()` (128 MB memory limit)
- Hand-writing `Env` interface instead of running `wrangler types` (mismatches between config and code)
- Using REST APIs for KV/D1/R2/Queues from within Workers instead of bindings (unnecessary latency and auth overhead)
- Putting secrets in `wrangler.jsonc`, source code, or environment variables (use `wrangler secret put`)
- Creating a single global Durable Object for all traffic (bottleneck at ~1000 req/sec)

**Medium Priority Issues:**

- Using `wrangler.toml` for new projects (JSON format recommended, some features JSON-only)
- Outdated `compatibility_date` (misses runtime improvements and bug fixes)
- Missing `observability` config (production Workers are a black box without logs/traces)
- Destructuring `ctx` in fetch handler (loses `this` binding, `ctx.waitUntil` throws "Illegal invocation")
- Using `exec()` for D1 queries instead of `prepare().bind()` (no parameterization, SQL injection risk)
- Not reciprocating WebSocket close in Durable Objects (causes 1006 errors)

**Common Mistakes:**

- Forgetting that KV is eventually consistent (~60s propagation) and expecting instant reads after writes
- Using `Math.random()` for security-sensitive tokens (use `crypto.randomUUID()` or `crypto.getRandomValues()`)
- Not using `ctx.waitUntil()` for post-response background work (work may be cancelled when response is sent)
- Comparing secrets with `===` instead of `crypto.subtle.timingSafeEqual()` (timing side-channel attack)
- Using `passThroughOnException()` as error handling (hides bugs, use explicit try/catch)
- Floating promises (not awaited, not returned, not passed to `waitUntil()`) causing silent failures

**Gotchas and Edge Cases:**

- Bindings (KV, D1, R2, etc.) are NOT inherited across Wrangler environments — you must re-declare them per environment
- `wrangler dev` uses local simulation by default; use `--remote` to test against real Cloudflare services
- D1 batch operations execute sequentially (not in parallel) but atomically
- Durable Objects in-memory state is lost on eviction — always persist important data to SQLite first
- Workers on the free plan have a 10ms CPU time limit per request (not wall-clock time — I/O waiting is free)
- Cron trigger changes take up to 15 minutes to propagate globally
- `.dev.vars` file is for local secrets only and must be gitignored
- The `env` parameter from `cloudflare:workers` import creates a fresh reference; avoid caching binding derivatives at module scope

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST run `wrangler types` to generate your Env interface — NEVER hand-write binding types)**

**(You MUST use `wrangler.jsonc` for new projects — Cloudflare recommends JSON config and some features are JSON-only)**

**(You MUST stream large request/response bodies — NEVER buffer entire payloads in memory (128 MB limit))**

**(You MUST avoid module-level mutable state — Workers reuse V8 isolates across requests, causing cross-request data leaks)**

**(You MUST use bindings for Cloudflare services (KV, D1, R2, Queues) — NEVER use REST APIs from within Workers)**

**Failure to follow these rules will result in memory crashes (buffering), data leaks (module state), type mismatches (hand-written Env), unnecessary latency (REST over bindings), and secret exposure (secrets in config).**

</critical_reminders>
