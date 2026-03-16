# Cloudflare Workers — Durable Objects Examples

> Durable Object classes, SQLite storage, RPC methods, rate limiting, and WebSocket handling with hibernation. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [Setup & Configuration](setup.md) — Project setup and wrangler.jsonc
- [D1 Database](d1.md) — When to use D1 vs Durable Objects
- [Routing & Hono](routing.md) — API routing and middleware
- [KV Storage](kv.md) — Eventually consistent key-value storage

---

## Durable Object Binding Configuration

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

---

## Counter with RPC and SQLite

```typescript
// src/counter.ts — Durable Object with RPC and SQLite
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

// src/index.ts — Calling a Durable Object
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
// Bad Example — Single global Durable Object
const id = env.STATE.idFromName("global-state"); // Everything goes through one DO
const stub = env.STATE.get(id);
await stub.fetch(request); // Using fetch instead of RPC
```

**Why bad:** Single global DO becomes a bottleneck (~1000 req/sec max), `fetch()` requires manual request/response parsing — use RPC methods instead

---

## Rate Limiter with SQLite Storage

A per-key rate limiter using Durable Objects for strong consistency.

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

**Why good:** Per-IP sharding via `idFromName`, SQLite for durable rate limit tracking, sliding window with cleanup, proper rate limit headers

---

## WebSocket Chat Room with Hibernation

Persistent WebSocket connections using the Hibernatable WebSocket API for cost-effective real-time communication.

```typescript
// src/chat-room.ts — Hibernatable WebSockets
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
