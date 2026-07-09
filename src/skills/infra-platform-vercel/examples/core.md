# Vercel -- Core Configuration & Functions Examples

> Core configuration and function patterns for Vercel deployments. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Routing & Middleware](routing.md) -- Headers, redirects, rewrites, Routing Middleware
- [Cron Jobs & Scheduling](cron-jobs.md) -- Cron configuration and handler patterns
- [Monorepo & Advanced](monorepo.md) -- Monorepo setup, vercel.ts, image optimization

---

## vercel.json Complete Configuration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "outputDirectory": "dist",
  "framework": "nextjs",
  "cleanUrls": true,
  "trailingSlash": false,
  "fluid": true,
  "regions": ["iad1"],
  "functionFailoverRegions": ["sfo1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30,
      "regions": ["iad1"]
    },
    "api/eu-data.ts": {
      "maxDuration": 60,
      "regions": ["cdg1"],
      "functionFailoverRegions": ["lhr1"]
    }
  },
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
    { "source": "/old-path", "destination": "/new-path", "permanent": true }
  ],
  "rewrites": [{ "source": "/api/v1/:path*", "destination": "/api/:path*" }],
  "crons": [
    {
      "path": "/api/cron/daily-cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Why good:** Schema enables IDE validation, per-function regions optimize latency, Fluid compute enabled, security headers on all routes, cron declared alongside deployment config

```json
{
  "builds": [{ "src": "api/*.ts", "use": "@vercel/node" }],
  "functions": { "api/*.ts": { "memory": 3009 } }
}
```

**Why bad:** `builds` is a legacy property and cannot be combined with `functions`, missing `$schema` loses IDE validation, `memory` in vercel.json is ignored when Fluid compute is enabled (set in dashboard instead)

---

## Serverless Functions (Node.js Runtime)

### fetch Handler (Recommended)

```typescript
// api/users.ts -- uses Web Standard fetch signature
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Number(limitParam) || DEFAULT_LIMIT, MAX_LIMIT);

    // Your data fetching logic here
    const users = await fetchUsers(limit);
    return Response.json({ users, limit });
  },
};
```

**Why good:** Web Standard `fetch` signature works across runtimes (Node.js and Edge), named constants for limits, proper HTTP method checking, `Response.json` helper for typed responses

### HTTP Method Handlers

```typescript
// api/items.ts -- named HTTP method exports (framework-agnostic)
export function GET(request: Request) {
  return Response.json({ items: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Create item logic
  return Response.json({ created: true }, { status: 201 });
}
```

**Why good:** Separate exports per HTTP method, Vercel auto-routes to the correct handler, clean separation of concerns

---

## Edge Runtime Functions

```typescript
// api/geo.ts -- Edge runtime for global low-latency
export const runtime = "edge";

export default {
  async fetch(request: Request) {
    const country = request.headers.get("x-vercel-ip-country") ?? "US";
    const city = request.headers.get("x-vercel-ip-city") ?? "Unknown";
    const region = process.env.VERCEL_REGION;

    return Response.json({ country, city, executedIn: region });
  },
};
```

**Why good:** `runtime = "edge"` deploys globally, reads geo headers for location-aware responses, lightweight and fast

```typescript
// api/heavy.ts -- BAD: Edge with Node.js-only code
export const runtime = "edge";

import { readFileSync } from "fs"; // FAILS -- no fs in Edge

export default {
  async fetch() {
    const data = readFileSync("./config.json"); // Runtime error
    return Response.json(data);
  },
};
```

**Why bad:** Edge runtime has no `fs` module, `readFileSync` throws at runtime, use Node.js runtime for file system access

---

## Edge vs Node.js Runtime Decision

```typescript
// Node.js -- when you need full APIs
// api/generate-pdf.ts
import { createWriteStream } from "fs";
import { join } from "path";

export default {
  async fetch(request: Request) {
    // Full Node.js API access
    const tmpPath = join("/tmp", "output.pdf");
    // ... generate PDF using Node.js libraries
    return new Response("PDF generated");
  },
};
```

```typescript
// Edge -- when you need global speed with minimal deps
// api/redirect.ts
export const runtime = "edge";

export default {
  async fetch(request: Request) {
    const country = request.headers.get("x-vercel-ip-country");
    const target = country === "DE" ? "/de" : "/en";
    return Response.redirect(new URL(target, request.url));
  },
};
```

---

## Streaming Responses

```typescript
// api/stream.ts -- streaming for long-running responses
export default {
  async fetch(request: Request) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of ["Hello", " ", "World"]) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
```

**Why good:** Streaming avoids buffering entire response in memory, begins sending data immediately (important for Edge's 25s initial response limit), efficient for large payloads

---

## Environment Variables

```typescript
// Built-in Vercel environment variables
const ENV = process.env.VERCEL_ENV; // "production" | "preview" | "development"
const URL = process.env.VERCEL_URL; // "my-app-abc123.vercel.app" (no protocol!)
const REGION = process.env.VERCEL_REGION; // "iad1"
const SHA = process.env.VERCEL_GIT_COMMIT_SHA; // full commit hash
const BRANCH = process.env.VERCEL_GIT_COMMIT_REF; // "main", "feature/x"

// IMPORTANT: VERCEL_URL does not include protocol
const BASE_URL =
  process.env.VERCEL_ENV === "production"
    ? "https://myapp.com"
    : `https://${process.env.VERCEL_URL}`;
```

**Why good:** Handles protocol correctly, distinguishes production (custom domain) from preview (generated URL), uses built-in variables for deployment context

### Managing Environment Variables via CLI

```bash
# Pull env vars from Vercel to local .env file
vercel env pull .env.local

# Add a new environment variable
vercel env add MY_API_KEY

# Add for specific environment
vercel env add MY_API_KEY production

# List all environment variables
vercel env ls

# Remove an environment variable
vercel env rm MY_API_KEY
```

---

## Function Configuration in vercel.json

### Per-Function Overrides

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    },
    "api/heavy-compute.ts": {
      "maxDuration": 300,
      "regions": ["iad1"]
    },
    "api/eu-data.ts": {
      "regions": ["cdg1"],
      "functionFailoverRegions": ["lhr1"]
    }
  }
}
```

**Why good:** Global defaults with per-function overrides, heavy compute gets longer duration, EU data function runs in Paris with London failover

### Function Configuration via Code (Framework-Specific)

```typescript
// For frameworks that support route segment config:
export const runtime = "edge"; // or "nodejs" (default)
export const preferredRegion = ["iad1", "cdg1"];
export const maxDuration = 30;
export const dynamic = "force-dynamic"; // disable caching
```

---

## Fluid Compute

Fluid compute (enabled by default since April 2025) reuses function instances for concurrent requests, reducing cold starts and cost.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "fluid": true
}
```

**Key behaviors:**

- Function instances handle multiple concurrent requests
- Module-level state persists across requests within the same instance
- Priced on active CPU time (idle waiting is cheaper)
- Memory configuration is set in the dashboard, not vercel.json

**Gotcha:** Because instances are reused, module-level variables persist. This is useful for connection pooling but can cause issues if you store request-specific state at module scope.

```typescript
// Module-level state persists across requests -- use intentionally
let requestCount = 0; // Counts requests within this instance

export default {
  async fetch(request: Request) {
    requestCount++;
    // requestCount is NOT global -- it's per-instance
    return Response.json({ instanceRequests: requestCount });
  },
};
```
