# Observability Setup - Health Check Examples

> Health check endpoints that integrate with your observability stack.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [sentry-config.md](sentry-config.md) | [pino-logger.md](pino-logger.md) | [axiom-integration.md](axiom-integration.md) | [ci-cd.md](ci-cd.md)

---

## Pattern 8: Health Check Endpoint

Health checks should report version info (tied to Sentry releases) and log results via your logger for Axiom dashboards.

### Shallow Check (for Load Balancers)

```typescript
// Good Example - Shallow health check
const HTTP_STATUS_OK = 200;

export async function handleHealthCheck(): Promise<Response> {
  return Response.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
    },
    { status: HTTP_STATUS_OK },
  );
}
```

### Deep Check (with Dependency Verification)

```typescript
// Good Example - Deep health check logging failures via Pino
import { logger } from "./logger"; // Your Pino logger instance

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

export async function handleDeepHealthCheck(
  checkDatabase: () => Promise<void>,
): Promise<Response> {
  let dbStatus: "connected" | "disconnected" = "disconnected";

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), HEALTH_CHECK_TIMEOUT_MS),
    );

    await Promise.race([checkDatabase(), timeoutPromise]);
    dbStatus = "connected";
  } catch (error) {
    logger.warn({ error }, "Health check: database unreachable");
    dbStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected";

  return Response.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
      dependencies: { database: dbStatus },
    },
    { status: isHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE },
  );
}
```

**Why good:** Version field ties to Sentry releases for correlation, failures logged via Pino (visible in Axiom dashboards), framework-agnostic using standard `Response` API, database check injected as dependency for testability
