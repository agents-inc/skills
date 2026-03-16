# Cloudflare Workers — Setup & Configuration Examples

> Setup and configuration patterns for Cloudflare Workers projects. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [KV Storage](kv.md) — Key-value storage patterns
- [D1 Database](d1.md) — SQLite database patterns
- [R2 Object Storage](r2.md) — File storage patterns
- [Durable Objects](durable-objects.md) — Stateful edge compute
- [Routing & Hono](routing.md) — API routing and middleware

---

## Project Initialization

```bash
# Create a new Workers project
npm create cloudflare@latest -- my-worker

# Or with Hono template
npm create hono@latest my-api
# Select "cloudflare-workers" template
```

---

## wrangler.jsonc Configuration

```jsonc
// wrangler.jsonc — recommended for all new projects
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
# wrangler.toml — acceptable but not recommended for new projects
name = "my-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

**Why bad:** TOML format misses JSON-only features, outdated compatibility_date misses runtime improvements and bug fixes, no observability configured (production is a black box), no source maps

---

## Type Generation

```bash
# Generate Env interface from wrangler.jsonc bindings
npx wrangler types
# Creates worker-configuration.d.ts with all binding types
```

Always run `wrangler types` after changing bindings in `wrangler.jsonc`. Never hand-write the `Env` interface.

---

## Basic Fetch Handler

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

**Why good:** `satisfies ExportedHandler<Env>` provides type checking while preserving literal types, named constants for routes and headers, proper error handling with try/catch, CORS support

---

## Module-Level State Anti-Pattern

```typescript
// BAD: Module-level mutable state
let requestCount = 0; // Leaks across requests

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

## Secrets Management

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

---

## Multi-Environment Configuration

```jsonc
// wrangler.jsonc
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

## GitHub Actions CI/CD Deployment

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

---

## Testing with Vitest Pool Workers

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
