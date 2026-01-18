# Observability - Correlation IDs

> Middleware patterns for request tracing across services. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Structured Logging](core.md#pattern-2-structured-logging) from core examples first.

---

## Pattern: Correlation ID Middleware for Hono

**File: `packages/api/src/middleware/correlation-id.ts`**

```typescript
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import { randomUUID } from "crypto";

const CORRELATION_ID_HEADER = "x-correlation-id";

export const correlationIdMiddleware = createMiddleware(async (c: Context, next: Next) => {
  // Use existing correlation ID from upstream or generate new one
  const correlationId = c.req.header(CORRELATION_ID_HEADER) || randomUUID();

  // Store in context for handlers to access
  c.set("correlationId", correlationId);

  // Add to response headers for client tracing
  c.header(CORRELATION_ID_HEADER, correlationId);

  await next();
});

// Helper to get correlation ID in route handlers
export const getCorrelationId = (c: Context): string => {
  return c.get("correlationId") || "unknown";
};
```

---

## Pattern: Request Logger Middleware

**File: `packages/api/src/middleware/request-logger.ts`**

```typescript
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { logger } from "@/lib/logger";
import { getCorrelationId } from "./correlation-id";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export const requestLoggerMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const startTime = performance.now();
  const correlationId = getCorrelationId(c);

  // Create request-scoped logger
  const log = logger.child({
    correlationId,
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent"),
  });

  log.info("Request started");

  await next();

  const duration = Math.round(performance.now() - startTime);
  const status = c.res.status;

  // Log completion with appropriate level
  const logData = { duration, status };

  if (status >= HTTP_STATUS_INTERNAL_ERROR) {
    log.error(logData, "Request failed with server error");
  } else if (status >= HTTP_STATUS_BAD_REQUEST) {
    log.warn(logData, "Request completed with client error");
  } else {
    log.info(logData, "Request completed successfully");
  }
});
```

**Why good:** Correlation ID propagated through entire request lifecycle, child logger prevents repeating context, appropriate log level based on response status, duration tracking built-in

---

## Pattern: Using in Route Handlers

```typescript
import { Hono } from "hono";

import { logger } from "@/lib/logger";
import { getCorrelationId } from "@/middleware/correlation-id";

const app = new Hono();

app.post("/jobs", async (c) => {
  const correlationId = getCorrelationId(c);
  const log = logger.child({ correlationId, operation: "job.create" });

  log.info({ body: c.req.json() }, "Processing job creation request");

  // ... create job

  log.info({ jobId: job.id }, "Job created successfully");
  return c.json(job);
});
```

---

## Pattern: AsyncLocalStorage with Mixin (Modern Alternative)

For applications where you need automatic context injection without manually creating child loggers in every handler, use AsyncLocalStorage with Pino's `mixin` option.

**File: `packages/api/src/lib/async-context.ts`**

```typescript
import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  correlationId: string;
  userId?: string;
  service?: string;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = (): RequestContext | undefined => {
  return asyncContext.getStore();
};
```

**File: `packages/api/src/lib/logger.ts`**

```typescript
import pino from "pino";
import { getRequestContext } from "./async-context";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Mixin automatically injects context into EVERY log call
  mixin() {
    const context = getRequestContext();
    if (context) {
      return {
        correlationId: context.correlationId,
        userId: context.userId,
        service: context.service,
      };
    }
    return {};
  },
});
```

**File: `packages/api/src/middleware/context-middleware.ts`**

```typescript
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import { randomUUID } from "crypto";

import { asyncContext } from "@/lib/async-context";

const CORRELATION_ID_HEADER = "x-correlation-id";

export const contextMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const correlationId = c.req.header(CORRELATION_ID_HEADER) || randomUUID();
  c.header(CORRELATION_ID_HEADER, correlationId);

  // Run the rest of the request in the async context
  return asyncContext.run(
    {
      correlationId,
      service: "api",
    },
    () => next()
  );
});
```

**Usage (no child logger needed):**

```typescript
import { Hono } from "hono";
import { logger } from "@/lib/logger";
import { contextMiddleware } from "@/middleware/context-middleware";

const app = new Hono();
app.use(contextMiddleware);

app.post("/jobs", async (c) => {
  // correlationId is AUTOMATICALLY included via mixin!
  logger.info({ operation: "job.create" }, "Processing job creation request");

  const job = await createJob(data);

  logger.info({ jobId: job.id }, "Job created successfully");
  return c.json(job);
});
```

**Why good:** No manual child logger creation in every handler, context automatically propagates through entire async call chain (including nested function calls and database operations), cleaner code with less boilerplate, works across your entire codebase without passing logger instances

**When to use AsyncLocalStorage + mixin vs child loggers:**

- **AsyncLocalStorage + mixin**: When you want automatic context injection everywhere, larger applications with many nested function calls
- **Child loggers**: When you need explicit control, simpler applications, or want to add operation-specific context

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
