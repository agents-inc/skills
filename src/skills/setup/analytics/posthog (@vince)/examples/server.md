# PostHog Setup - Server-Side Examples

> Server-side patterns for PostHog event capture. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.
>
> **Related examples:** [core.md](core.md) | [deployment.md](deployment.md)

---

## Pattern 1: Server Client Singleton

Create a singleton for server-side event capture to prevent multiple client instances.

```typescript
// ✅ Good Example - PostHog server client singleton
// lib/posthog/server.ts
import { PostHog } from "posthog-node";

const FLUSH_INTERVAL_MS = 10000;
const FLUSH_AT_COUNT = 20;

let posthogClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushInterval: FLUSH_INTERVAL_MS,
      flushAt: FLUSH_AT_COUNT,
    });
  }
  return posthogClient;
}

// For graceful shutdown in serverless environments
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}

// Named exports
export { getPostHogServerClient, shutdownPostHog };
```

**Why good:** Singleton prevents multiple client instances, flushInterval/flushAt configure batching, shutdown function for graceful cleanup, works in serverless (Vercel)

---

## Pattern 2: Next.js API Route Usage

Capture events in Next.js API routes with proper flush handling.

```typescript
// ✅ Good Example - Capturing events in API route
// app/api/signup/route.ts
import { NextResponse } from "next/server";

import { getPostHogServerClient } from "@/lib/posthog/server";

export async function POST(request: Request) {
  const posthog = getPostHogServerClient();
  const body = await request.json();

  // Capture signup event
  posthog.capture({
    distinctId: body.email,
    event: "user_signed_up",
    properties: {
      plan: body.plan,
      source: body.source,
    },
  });

  // CRITICAL: Flush events before response in serverless
  await posthog.flush();

  return NextResponse.json({ success: true });
}
```

**Why good:** `flush()` ensures events are sent before function terminates (important for serverless), distinctId uses user identifier, properties add context

---

## Pattern 2b: Alternative - captureImmediate for Serverless

For simpler serverless usage, use `captureImmediate` which awaits the HTTP request directly.

```typescript
// ✅ Good Example - Using captureImmediate (recommended for serverless)
// app/api/signup/route.ts
import { NextResponse } from "next/server";

import { getPostHogServerClient } from "@/lib/posthog/server";

export async function POST(request: Request) {
  const posthog = getPostHogServerClient();
  const body = await request.json();

  // captureImmediate awaits the HTTP request - no flush needed
  await posthog.captureImmediate({
    distinctId: body.email,
    event: "user_signed_up",
    properties: {
      plan: body.plan,
      source: body.source,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Why good:** `captureImmediate` guarantees the HTTP request finishes before the function continues or shuts down, simpler than managing flush() calls, recommended for serverless by PostHog

---

## Pattern 3: Next.js API Route with Flush

Capture events in Next.js API routes with proper flush handling.

```typescript
// ❌ Bad Example - Not flushing events
// app/api/action/route.ts
import { getPostHogServerClient } from "@/lib/posthog/server";

export async function POST(request: Request) {
  const posthog = getPostHogServerClient();

  posthog.capture({
    distinctId: "user-123",
    event: "action_performed",
  });

  // BAD: No flush() - events may be lost in serverless!
  return NextResponse.json({ success: true });
}
```

**Why bad:** PostHog batches events by default, serverless function may terminate before batch is sent, events are silently lost

---

## Pattern 3: Hono Middleware Integration

Create analytics middleware for Hono API routes with automatic flush handling.

```typescript
// ✅ Good Example - PostHog middleware for Hono
// middleware/analytics-middleware.ts
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { getPostHogServerClient } from "@/lib/posthog/server";

interface AnalyticsVariables {
  posthog: ReturnType<typeof getPostHogServerClient>;
}

export const analyticsMiddleware = createMiddleware<{
  Variables: AnalyticsVariables;
}>(async (c: Context, next: Next) => {
  const posthog = getPostHogServerClient();
  c.set("posthog", posthog);

  await next();

  // Flush after response is sent
  await posthog.flush();
});

// Named export
export { analyticsMiddleware };
```

**Why good:** PostHog client available via `c.get("posthog")` in handlers, automatic flush after response, typed variables for TypeScript safety

### Using the Middleware in Handlers

```typescript
// ✅ Good Example - Using posthog in Hono handler
// routes/users.ts
import { Hono } from "hono";

import { analyticsMiddleware } from "@/middleware/analytics-middleware";

const app = new Hono();

app.use("*", analyticsMiddleware);

app.post("/users", async (c) => {
  const posthog = c.get("posthog");
  const body = await c.req.json();

  // Track user creation
  posthog.capture({
    distinctId: body.email,
    event: "user_created",
    properties: {
      source: "api",
    },
  });

  // No need to flush - middleware handles it
  return c.json({ success: true });
});

export { app };
```

**Why good:** Handler doesn't need to manage flush, consistent tracking across all routes, clean separation of concerns

---
