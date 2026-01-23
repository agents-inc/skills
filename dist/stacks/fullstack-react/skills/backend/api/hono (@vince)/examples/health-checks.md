# Hono + OpenAPI - Health Check Examples

> Health check endpoint patterns for load balancers and monitoring. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route definition patterns from core examples first.

---

## Pattern 1: Shallow and Deep Health Checks

### Good Example - Shallow and Deep Health Checks

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { HealthCheckResult } from "@/lib/types";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

const HealthStatusSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]),
    timestamp: z.string(),
    uptime: z.number(),
    dependencies: z
      .object({
        database: z.enum(["connected", "disconnected", "degraded"]),
        redis: z.enum(["connected", "disconnected", "degraded"]).optional(),
      })
      .optional(),
  })
  .openapi("HealthStatus");

// Shallow health check (fast, no dependency checks)
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  tags: ["Health"],
  summary: "Health check",
  description: "Lightweight health check for load balancers",
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
      uptime: process.uptime(),
    },
    HTTP_STATUS_OK,
  );
});

// Deep health check (includes dependency checks)
const healthDeepRoute = createRoute({
  method: "get",
  path: "/health/deep",
  operationId: "getHealthDeep",
  tags: ["Health"],
  summary: "Deep health check",
  description: "Comprehensive health check including dependencies",
  responses: {
    200: {
      description: "Service and dependencies are healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
    503: {
      description: "Service or dependencies are unhealthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthDeepRoute, async (c) => {
  const checks = await Promise.allSettled([checkDatabase(), checkRedis()]);

  const dbStatus =
    checks[0].status === "fulfilled" ? checks[0].value.status : "disconnected";
  const redisStatus =
    checks[1].status === "fulfilled" ? checks[1].value.status : "disconnected";

  const isHealthy = dbStatus === "connected" && redisStatus === "connected";

  return c.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
    isHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE,
  );
});

// Dependency check helper (with timeout)
const checkDatabase = async (): Promise<{
  status: "connected" | "disconnected" | "degraded";
}> => {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), HEALTH_CHECK_TIMEOUT_MS),
    );

    await Promise.race([db.execute("SELECT 1"), timeoutPromise]);

    return { status: "connected" };
  } catch (error) {
    console.error("Database health check failed:", error);
    return { status: "disconnected" };
  }
};
```

**Why good:** Shallow /health is fast (liveness for LB), deep /health/deep checks deps (readiness), timeout prevents hanging forever, 503 triggers K8s restart

### Bad Example - Slow health check

```typescript
// BAD Example - Slow health check
app.get("/health", async (c) => {
  // BAD: Checks dependencies on every request (slow for load balancers)
  const db = await checkDatabase();
  const redis = await checkRedis();

  // BAD: Magic number 200
  // BAD: No timeout (can hang indefinitely)
  return c.json({ status: "ok" }, 200);
});
```

**Why bad:** Checking DB on every LB ping = slow + DB load, no timeout = LB request can hang forever, 200 on failure = LB keeps routing to broken instance

---
