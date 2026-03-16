# Observability - Correlation IDs

> Middleware patterns for request tracing across services. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Structured Logging](core.md#pattern-2-structured-logging) from core examples first.

---

## Pattern: Correlation ID Middleware

**Key logic (adapt to your HTTP framework's middleware API):**

```typescript
import { randomUUID } from "crypto";

const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Middleware: extract or generate correlation ID per request.
 * Store it on the request context and set the response header.
 */
function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: () => void,
) {
  const correlationId = req.headers.get(CORRELATION_ID_HEADER) ?? randomUUID();

  // Store on request context (mechanism varies by framework)
  req.correlationId = correlationId;

  // Echo back in response for client tracing
  res.headers.set(CORRELATION_ID_HEADER, correlationId);

  next();
}

// Helper to retrieve correlation ID in route handlers
function getCorrelationId(req: Request): string {
  return req.correlationId ?? "unknown";
}
```

---

## Pattern: Request Logger Middleware

```typescript
import { logger } from "./logger";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * Middleware: create a request-scoped child logger with correlation context,
 * then log start/completion with appropriate level and duration.
 */
function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: () => void,
) {
  const startTime = performance.now();

  // Create request-scoped logger
  const log = logger.child({
    correlationId: req.correlationId,
    method: req.method,
    path: new URL(req.url).pathname,
  });

  log.info("Request started");

  next();

  const duration = Math.round(performance.now() - startTime);
  const status = res.status;
  const logData = { duration, status };

  if (status >= HTTP_STATUS_INTERNAL_ERROR) {
    log.error(logData, "Request failed with server error");
  } else if (status >= HTTP_STATUS_BAD_REQUEST) {
    log.warn(logData, "Request completed with client error");
  } else {
    log.info(logData, "Request completed successfully");
  }
}
```

**Why good:** Correlation ID propagated through entire request lifecycle, child logger prevents repeating context, appropriate log level based on response status, duration tracking built-in

---

## Pattern: Using in Route Handlers

```typescript
import { logger } from "./logger";

// Inside a route handler (adapt to your framework)
async function createJobHandler(req: Request) {
  const log = logger.child({
    correlationId: req.correlationId,
    operation: "job.create",
  });

  log.info("Processing job creation request");

  const job = await createJob(data);

  log.info({ jobId: job.id }, "Job created successfully");
  return Response.json(job);
}
```

---

## Pattern: AsyncLocalStorage with Mixin (Modern Alternative)

For applications where you need automatic context injection without manually creating child loggers in every handler, use AsyncLocalStorage with Pino's `mixin` option.

**async-context.ts** - Shared storage for request context:

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

**logger.ts** - Logger with automatic context injection via mixin:

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

**context-middleware.ts** - Middleware that wraps requests in async context:

```typescript
import { randomUUID } from "crypto";
import { asyncContext } from "./async-context";

const CORRELATION_ID_HEADER = "x-correlation-id";

// Adapt to your framework's middleware signature
function contextMiddleware(req: Request, res: Response, next: () => void) {
  const correlationId = req.headers.get(CORRELATION_ID_HEADER) ?? randomUUID();
  res.headers.set(CORRELATION_ID_HEADER, correlationId);

  // Run the rest of the request inside the async context
  asyncContext.run({ correlationId, service: "api" }, () => next());
}
```

**Usage (no child logger needed):**

```typescript
import { logger } from "./logger";

// Inside a route handler - correlationId is AUTOMATICALLY included via mixin
async function createJobHandler(req: Request) {
  logger.info({ operation: "job.create" }, "Processing job creation request");

  const job = await createJob(data);

  logger.info({ jobId: job.id }, "Job created successfully");
  return Response.json(job);
}
```

**Why good:** No manual child logger creation in every handler, context automatically propagates through entire async call chain (including nested function calls and database operations), cleaner code with less boilerplate, works across your entire codebase without passing logger instances

**When to use AsyncLocalStorage + mixin vs child loggers:**

- **AsyncLocalStorage + mixin**: When you want automatic context injection everywhere, larger applications with many nested function calls
- **Child loggers**: When you need explicit control, simpler applications, or want to add operation-specific context

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
