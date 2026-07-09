---
name: infra-platform-vercel
description: Vercel deployment platform — project configuration, serverless/edge functions, Routing Middleware, cron jobs, environment variables, monorepo setup
---

# Vercel Platform Patterns

> **Quick Guide:** Configure deployments with `vercel.json` (static) or `vercel.ts` (programmatic, build-time). Functions default to Node.js runtime in `iad1` region. Use `export const runtime = 'edge'` for edge functions (V8 isolates, global deployment). Routing Middleware runs before the cache globally. Secure cron jobs with `CRON_SECRET`. Enable Fluid compute for better concurrency and cost. Always place functions near your data source.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always include `"$schema": "https://openapi.vercel.sh/vercel.json"` in vercel.json for IDE validation)**

**(You MUST place functions in a region close to your data source -- the default `iad1` may add latency if your database is elsewhere)**

**(You MUST verify `CRON_SECRET` in cron job handlers -- Vercel cron endpoints are publicly accessible URLs)**

**(You MUST design cron jobs to be idempotent -- Vercel may deliver the same cron event more than once)**

**(You MUST NOT store secrets in vercel.json or source code -- use Environment Variables in the Vercel dashboard)**

</critical_requirements>

---

## Examples

- [Core Configuration & Functions](examples/core.md) -- vercel.json schema, functions config, runtime selection, regions, environment variables, Fluid compute
- [Routing & Middleware](examples/routing.md) -- Routing Middleware, headers, redirects, rewrites, conditional routing, geo-routing
- [Cron Jobs & Scheduling](examples/cron-jobs.md) -- cron configuration, CRON_SECRET verification, idempotent handlers
- [Monorepo & Advanced](examples/monorepo.md) -- monorepo setup, vercel.ts programmatic config, ignoreCommand, image optimization
- [Quick Reference](reference.md) -- vercel.json property reference, plan limits, region IDs, CLI commands

---

**Auto-detection:** Vercel, vercel.json, vercel.ts, @vercel/config, Vercel Functions, Vercel deploy, VERCEL_URL, VERCEL_ENV, VERCEL_REGION, Routing Middleware, middleware.ts, Edge Runtime, export const runtime, Fluid compute, vercel cron, cron jobs vercel, vercel.json crons, vercel dev, vercel build, vercel deploy, vercel env, vercel link, vercel pull, .vercelignore, vercel monorepo, vercel regions, vercel headers, vercel redirects, vercel rewrites

**When to use:**

- Configuring Vercel project settings via `vercel.json` or `vercel.ts`
- Deploying serverless functions (Node.js or Edge runtime)
- Setting up Routing Middleware for auth, geo-routing, or A/B testing
- Configuring cron jobs for scheduled tasks
- Managing environment variables across preview/production
- Setting up monorepo deployments with per-app configuration
- Configuring headers, redirects, rewrites, and URL routing
- Choosing function regions and memory/duration limits

**When NOT to use:**

- Long-running background jobs exceeding plan limits (use a dedicated job runner)
- Workloads requiring persistent WebSocket connections (Vercel functions are request/response)
- Applications needing custom server runtimes beyond Node.js/Edge/Bun/Python/Go/Ruby

**Key patterns covered:**

- `vercel.json` / `vercel.ts` project configuration with IDE schema validation
- Serverless function configuration (runtime, memory, maxDuration, regions)
- Edge Runtime vs Node.js runtime tradeoffs
- Routing Middleware (runs before cache, global edge execution)
- Cron jobs with `CRON_SECRET` authentication
- Headers, redirects, rewrites with conditional matching (`has`/`missing`)
- Monorepo setup with root directory and ignored build steps
- Fluid compute for improved concurrency and cost efficiency
- Environment variables (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_REGION`)

---

<philosophy>

## Philosophy

Vercel is a deployment platform that auto-detects your framework and optimizes builds, routing, and function deployment. The key architectural principle: **configure only what you need to override**. Vercel's defaults are sensible for most projects -- `vercel.json` exists for when those defaults don't fit.

1. **Convention over configuration** -- Vercel auto-detects frameworks, build commands, and output directories. Only override when the defaults don't work.
2. **Functions near data** -- Serverless functions default to `iad1` (Washington, D.C.). If your database is in Europe, set `regions` to a European region.
3. **Edge for global, Node.js for power** -- Edge runtime runs globally with low latency but has limited APIs. Node.js runtime has full API access but runs in a single region by default.
4. **Routing Middleware runs before cache** -- Use it for personalization, auth, geo-routing. Keep it fast (50ms CPU average on Edge).
5. **Fluid compute** -- Enabled by default for new projects (since April 2025). Reuses function instances for concurrent requests, reducing cold starts and cost.

**When to use Vercel:**

- Deploying web applications with automatic framework detection
- Serverless API endpoints that scale to zero
- Edge-first applications needing global low-latency
- Projects needing preview deployments per PR

**When NOT to use Vercel:**

- Long-running compute exceeding plan maxDuration limits
- Applications requiring persistent connections (WebSockets beyond Vercel's support)
- Workloads with heavy sustained compute (cost-prohibitive at scale)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: vercel.json Configuration

Every Vercel project can have a `vercel.json` at the root for static configuration, or `vercel.ts` for programmatic build-time configuration. Always include the `$schema` for IDE autocompletion.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/daily-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Why good:** Schema enables IDE validation, regions explicit about function placement, maxDuration prevents runaway functions, cron declared in config alongside deployment

See [examples/core.md](examples/core.md) for complete configuration with all properties.

---

### Pattern 2: Serverless Functions (Node.js Runtime)

Functions in the `api/` directory are automatically deployed. The recommended signature uses the `fetch` handler. Node.js is the default runtime.

```typescript
// api/users.ts -- Node.js runtime (default)
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    // Your data fetching logic here
    return Response.json({ id, name: "Example User" });
  },
};
```

**Why good:** Uses Web Standard `fetch` signature (works across runtimes), `Response.json` for typed responses, proper error handling with status codes

See [examples/core.md](examples/core.md) for function configuration, streaming, and runtime selection.

---

### Pattern 3: Edge Runtime Functions

Edge functions run on V8 isolates globally, closest to the user. Use for latency-sensitive operations with limited API needs. Vercel now recommends Node.js for most use cases due to Fluid compute improvements.

```typescript
// api/geo.ts -- Edge runtime
export const runtime = "edge";

export default {
  async fetch(request: Request) {
    const country = request.headers.get("x-vercel-ip-country") ?? "US";
    return Response.json({ country, region: process.env.VERCEL_REGION });
  },
};
```

**When to use:** Latency-critical responses, geo-routing, simple request/response transformations

**When not to use:** Heavy computation, Node.js-only APIs (fs, child_process), large dependencies (1-4 MB code size limit)

See [examples/core.md](examples/core.md) for Edge vs Node.js comparison and limitations.

---

### Pattern 4: Routing Middleware

Routing Middleware executes before the cache on every request. Create a `middleware.ts` file at the project root. Default runtime is Edge but can be changed to Node.js.

```typescript
// middleware.ts -- runs before every request
export default function middleware(request: Request) {
  const url = new URL(request.url);

  // Redirect old paths
  if (url.pathname === "/old-page") {
    return new Response(null, {
      status: 302,
      headers: { Location: "/new-page" },
    });
  }
}

// Optional: change runtime from Edge (default) to Node.js
export const config = {
  runtime: "nodejs",
};
```

**Why good:** Runs globally before cache, can personalize static content, supports auth checks, geo-routing, A/B testing

**Limits:** 50ms average CPU time on Edge runtime, 4 MB max request body, 14 KB max URL length

See [examples/routing.md](examples/routing.md) for auth, geo-routing, and conditional middleware patterns.

---

### Pattern 5: Cron Jobs

Define scheduled functions in `vercel.json`. Cron endpoints are regular API routes -- secure them with `CRON_SECRET`.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

```typescript
// api/cron/cleanup.ts
export default {
  async fetch(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Your scheduled task logic here (must be idempotent)
    return Response.json({ success: true });
  },
};
```

**Why good:** CRON_SECRET verification prevents unauthorized invocation, idempotent design handles duplicate delivery, simple cron expression syntax

**Gotcha:** Crons only run on Production deployments, not Preview. Vercel may deliver events more than once.

See [examples/cron-jobs.md](examples/cron-jobs.md) for schedule expressions and handler patterns.

---

### Pattern 6: Headers, Redirects, and Rewrites

Configure routing rules in `vercel.json` with optional `has`/`missing` conditions for matching request properties.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/blog/:slug",
      "destination": "/posts/:slug",
      "permanent": true
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.example.com/:path*" }
  ]
}
```

**Why good:** Declarative routing rules applied at the CDN layer (fast), pattern matching with named segments (`:slug`, `:path*`), conditional matching with `has`/`missing`

See [examples/routing.md](examples/routing.md) for geo-based redirects, conditional headers, and rewrite patterns.

---

### Pattern 7: Environment Variables

Vercel provides built-in environment variables and supports custom ones via the dashboard. Access framework-agnostic variables via `process.env`.

```typescript
// Built-in environment variables
const DEPLOYMENT_ENV = process.env.VERCEL_ENV; // "production" | "preview" | "development"
const DEPLOYMENT_URL = process.env.VERCEL_URL; // e.g., "my-app-abc123.vercel.app"
const FUNCTION_REGION = process.env.VERCEL_REGION; // e.g., "iad1"
const GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
```

**Gotcha:** `VERCEL_URL` does not include the protocol (`https://`). Always prepend it: `` `https://${process.env.VERCEL_URL}` ``

See [examples/core.md](examples/core.md) for environment variable scoping and CRON_SECRET setup.

---

### Pattern 8: Monorepo Setup

Vercel supports monorepos by setting the Root Directory per project. Use `ignoreCommand` to skip builds when the relevant app hasn't changed.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./",
  "buildCommand": "pnpm --filter my-app build",
  "installCommand": "pnpm install"
}
```

**Key setup:** In the Vercel dashboard, set Root Directory to `apps/my-app` (or wherever the app lives). Vercel CLI should always be run from the monorepo root.

See [examples/monorepo.md](examples/monorepo.md) for monorepo setup, Nx integration, custom ignore patterns, and vercel.ts programmatic config.

</patterns>

---

<performance>

## Performance Optimization

### Function Placement

| Setting                   | Purpose                                 | When to use                                  |
| ------------------------- | --------------------------------------- | -------------------------------------------- |
| `regions: ["iad1"]`       | Deploy to specific region(s)            | When your data source is in a known region   |
| `functionFailoverRegions` | Failover during outages                 | Enterprise plan, critical APIs               |
| `fluid: true`             | Reuse instances for concurrent requests | Default for new projects since April 2025    |
| Per-function `regions`    | Different regions per function          | When functions access different data sources |

For runtime comparison and plan limits, see [reference.md](reference.md).

</performance>

---

<decision_framework>

## Decision Framework

### Choosing a Runtime

```
What does your function need?
  |
  +-- Full Node.js APIs (fs, child_process, native modules)?
  |     --> Node.js runtime
  |
  +-- Global low-latency, minimal dependencies?
  |     --> Edge runtime (but consider Node.js + multi-region)
  |
  +-- Heavy computation or large dependencies?
  |     --> Node.js runtime (250 MB limit vs 1-4 MB Edge)
  |
  +-- Not sure?
        --> Node.js (default, recommended by Vercel for most cases)
```

### Choosing Where to Put Logic

```
Does it need to run before every request (auth, redirects)?
  |
  +-- YES --> Routing Middleware (middleware.ts)
  |
  +-- NO --> Is it a scheduled task?
        |
        +-- YES --> Cron job (vercel.json crons + api route)
        |
        +-- NO --> Is it an API endpoint?
              |
              +-- YES --> Vercel Function (api/ directory)
              |
              +-- NO --> Is it a static routing rule?
                    |
                    +-- YES --> vercel.json (headers/redirects/rewrites)
                    +-- NO  --> Framework-specific solution
```

### Static Config vs Programmatic Config

```
Is your configuration static and predictable?
  |
  +-- YES --> vercel.json
  |
  +-- NO --> Do you need env vars, API calls, or conditional logic at build time?
        |
        +-- YES --> vercel.ts (with @vercel/config)
        +-- NO  --> vercel.json
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Storing secrets in `vercel.json` or committing `.env` files -- use the Vercel dashboard Environment Variables or `vercel env` CLI
- Missing `CRON_SECRET` verification in cron handlers -- cron endpoints are publicly accessible URLs anyone can call
- Using Edge runtime when you need Node.js APIs (fs, native modules, large packages) -- will fail at runtime with missing API errors
- Setting `maxDuration` above your plan limit -- deployment will fail
- Not setting `regions` when your database is outside `iad1` -- every function call makes a cross-region database round trip

**Medium Priority Issues:**

- Missing `$schema` in vercel.json -- loses IDE autocompletion and validation that catches config errors before deployment
- Using `permanent: true` redirects during development -- browsers cache 308s aggressively, hard to undo
- Not using `ignoreCommand` in monorepos -- every commit triggers builds for all apps, wasting build minutes
- Hardcoding `VERCEL_URL` without protocol -- `VERCEL_URL` does not include `https://`, must be prepended

**Common Mistakes:**

- Assuming cron jobs run on Preview deployments -- they only run on Production
- Using `statusCode` and `permanent` together in redirects -- they are mutually exclusive
- Not making cron handlers idempotent -- Vercel may deliver events more than once
- Expecting Edge functions to have file system access -- Edge runtime has no `fs` module
- Using `builds` property in vercel.json -- it is legacy, use `functions` instead

**Gotchas & Edge Cases:**

- Edge Runtime: `eval()`, `new Function()`, and dynamic `WebAssembly.instantiate` are disabled for security
- Edge Runtime: Must begin sending response within 25 seconds (can stream up to 300s after)
- Routing Middleware: 50ms average CPU time limit on Edge, 4 MB max request body, 14 KB max URL length
- `cleanUrls: true` causes 404s in local `vercel dev` but works in production
- `has`/`missing` conditions on redirects/headers don't work locally with `vercel dev`
- `VERCEL_URL` differs between Production (custom domain) and Preview (generated `.vercel.app` URL)
- Fluid compute reuses function instances -- module-level state persists across requests (can be useful for caching, but be aware of stale data)
- Function `memory` cannot be set in vercel.json when Fluid compute is enabled -- use the dashboard instead
- `vercel.ts` only runs at build time, not at request time -- it generates static config
- Edge function code size limits are after gzip: 1 MB (Hobby), 2 MB (Pro), 4 MB (Enterprise)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always include `"$schema": "https://openapi.vercel.sh/vercel.json"` in vercel.json for IDE validation)**

**(You MUST place functions in a region close to your data source -- the default `iad1` may add latency if your database is elsewhere)**

**(You MUST verify `CRON_SECRET` in cron job handlers -- Vercel cron endpoints are publicly accessible URLs)**

**(You MUST design cron jobs to be idempotent -- Vercel may deliver the same cron event more than once)**

**(You MUST NOT store secrets in vercel.json or source code -- use Environment Variables in the Vercel dashboard)**

**Failure to follow these rules will result in security vulnerabilities (exposed secrets, unprotected cron endpoints), poor performance (cross-region latency), and deployment failures (invalid config, exceeded limits).**

</critical_reminders>
