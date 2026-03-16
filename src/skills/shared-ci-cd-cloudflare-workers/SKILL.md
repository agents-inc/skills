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

## Examples

- [Setup & Configuration](examples/setup.md) — wrangler.jsonc, project init, fetch handler, secrets, multi-env, CI/CD, testing
- [KV Storage](examples/kv.md) — KV binding, typed get/put, TTL, stale-while-revalidate caching
- [D1 Database](examples/d1.md) — D1 binding, parameterized queries, batch ops, migrations, Hono CRUD
- [R2 Object Storage](examples/r2.md) — R2 binding, file upload/download/delete with streaming
- [Durable Objects](examples/durable-objects.md) — DO classes, SQLite, RPC, rate limiter, WebSocket chat
- [Routing & Hono](examples/routing.md) — Hono framework, middleware, queues, cron, service bindings, AI, streaming
- [Quick Reference](reference.md) — Wrangler CLI commands, binding type signatures, config template, CPU limits

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

Every Workers project starts with `wrangler.jsonc`. Cloudflare recommends JSON format — some newer features are JSON-only. Run `wrangler types` after changing bindings to regenerate the `Env` interface.

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "placement": { "mode": "smart" },
  "upload_source_maps": true,
}
```

See [examples/setup.md](examples/setup.md) for full project initialization, multi-environment config, secrets management, CI/CD, and testing setup.

---

### Pattern 2: Fetch Handler (Request/Response)

The fetch handler is the entry point for HTTP requests. Use `satisfies ExportedHandler<Env>` for type safety.

```typescript
import type { ExportedHandler } from "cloudflare:workers";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "healthy" });
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

Never store mutable state in module-level variables — V8 isolate reuse causes cross-request data leaks. See [examples/setup.md](examples/setup.md) for complete handler with CORS and routing.

---

### Pattern 3: KV Key-Value Storage

KV is an eventually-consistent key-value store for read-heavy workloads. Use typed `get<T>(key, "json")`, always set `expirationTtl`, and use `ctx.waitUntil()` for non-blocking writes.

```typescript
const CACHE_TTL_SECONDS = 3_600;
const profile = await env.CACHE.get<UserProfile>(`user:${id}`, "json");
ctx.waitUntil(
  env.CACHE.put(`user:${id}`, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS,
  }),
);
```

**When to use:** Read-heavy workloads (config, cache, feature flags) where eventual consistency is acceptable (~60s propagation).

**When not to use:** Relational data (use D1), frequent writes to same key, strong consistency (use Durable Objects).

See [examples/kv.md](examples/kv.md) for stale-while-revalidate pattern and full caching examples.

---

### Pattern 4: D1 SQLite Database

D1 is serverless SQLite at the edge. Always use parameterized queries via `prepare().bind()` to prevent SQL injection. Use `batch()` for atomic multi-statement operations.

```typescript
const user = await db
  .prepare("SELECT * FROM users WHERE email = ?")
  .bind(email)
  .first<User>();

const { results } = await db
  .prepare("SELECT * FROM users LIMIT ? OFFSET ?")
  .bind(DEFAULT_PAGE_SIZE, offset)
  .all<User>();
```

See [examples/d1.md](examples/d1.md) for migrations, batch operations, and full Hono CRUD API.

---

### Pattern 5: R2 Object Storage

R2 is S3-compatible storage with zero egress fees. Always stream R2 bodies directly to responses — never call `.arrayBuffer()` or `.text()` on large objects.

```typescript
const object = await env.BUCKET.get(key);
if (!object) return new Response("Not Found", { status: 404 });
const headers = new Headers();
object.writeHttpMetadata(headers);
return new Response(object.body, { headers }); // Stream directly
```

See [examples/r2.md](examples/r2.md) for Hono file service with content-type validation and list operations.

---

### Pattern 6: Durable Objects (Stateful Edge Compute)

Durable Objects provide single-threaded, strongly consistent compute. Each instance has SQLite storage. Use RPC methods (not fetch) and `blockConcurrencyWhile` for schema migrations.

```typescript
import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS ...");
    });
  }
  async increment(name: string): Promise<number> {
    /* RPC method */
  }
}
```

**When to use:** Coordination (chat, collaboration), per-entity state (sessions, game instances), WebSocket connections, rate limiting.

**When not to use:** Stateless requests, high fan-out, global rate limiting (bottleneck).

See [examples/durable-objects.md](examples/durable-objects.md) for rate limiter and WebSocket chat with hibernation.

---

### Pattern 7: Queues, Cron, Service Bindings, Workers AI

**Queues** decouple producers from consumers with at-least-once delivery and configurable retries. **Cron triggers** invoke Workers on a schedule. **Service bindings** enable zero-cost worker-to-worker calls. **Workers AI** runs inference on Cloudflare's GPU network.

See [examples/routing.md](examples/routing.md) for all these patterns with full configuration and code examples.

---

### Pattern 8: Hono Framework on Workers

Hono is the recommended framework for structured APIs. Use `Hono<{ Bindings: Env }>` for type-safe binding access. Export `app.fetch` alongside scheduled/queue handlers.

```typescript
import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/users/:id", async (c) => {
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(c.req.param("id"))
    .first();
  return user ? c.json(user) : c.json({ error: "Not found" }, 404);
});

export default app;
```

See [examples/routing.md](examples/routing.md) for production Hono API with middleware, error handling, and multi-handler setup.

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
