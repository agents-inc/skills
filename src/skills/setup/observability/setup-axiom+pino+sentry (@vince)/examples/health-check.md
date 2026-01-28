# Observability Setup - Health Check Examples

> Health check endpoints for monitoring and load balancer integration.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [sentry-config.md](sentry-config.md) | [pino-logger.md](pino-logger.md) | [axiom-integration.md](axiom-integration.md) | [ci-cd.md](ci-cd.md)

---

## Pattern 8: Health Check Endpoint

### Next.js Health Check

**File: `apps/client-next/app/api/health/route.ts`**

```typescript
// Good Example - Health check endpoint
import { NextResponse } from "next/server";

const HTTP_STATUS_OK = 200;

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
    },
    { status: HTTP_STATUS_OK },
  );
}
```

---

### Hono Health Check with Dependency Checks

**File: `packages/api/src/routes/health.ts`**

```typescript
// Good Example - Hono health check with dependency checks
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { db } from "@/lib/db";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

const HealthStatusSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]),
    timestamp: z.string(),
    version: z.string(),
    dependencies: z
      .object({
        database: z.enum(["connected", "disconnected"]),
      })
      .optional(),
  })
  .openapi("HealthStatus");

const app = new OpenAPIHono();

// Shallow health check (fast, for load balancers)
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  tags: ["Health"],
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthRoute, async (c) => {
  return c.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
    },
    HTTP_STATUS_OK,
  );
});

// Deep health check (with dependency checks)
const healthDeepRoute = createRoute({
  method: "get",
  path: "/health/deep",
  operationId: "getHealthDeep",
  tags: ["Health"],
  responses: {
    200: {
      description: "Service and dependencies healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
    503: {
      description: "Service unhealthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthDeepRoute, async (c) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), HEALTH_CHECK_TIMEOUT_MS),
    );

    await Promise.race([db.execute("SELECT 1"), timeoutPromise]);
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected";

  return c.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
      dependencies: {
        database: dbStatus,
      },
    },
    isHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE,
  );
});

export { app as healthRoutes };
```

**Why good:** Two endpoints - shallow for frequent LB checks, deep for thorough monitoring, timeout prevents health check from hanging indefinitely, returns 503 when unhealthy so LB routes traffic elsewhere
