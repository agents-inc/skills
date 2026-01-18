# Observability Core Examples

> Essential logging patterns for everyday use. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [correlation-ids.md](correlation-ids.md) - Middleware for request tracing
- [tracing.md](tracing.md) - OpenTelemetry spans and custom instrumentation
- [error-boundaries.md](error-boundaries.md) - React error boundaries with Sentry
- [sentry-config.md](sentry-config.md) - User context and error filtering
- [axiom.md](axiom.md) - Monitors, alerts, and debugging queries
- [performance.md](performance.md) - Query and API call tracking

---

## Pattern 1: Log Levels

### Good Example - Appropriate Log Levels

```typescript
import { logger } from "@/lib/logger";

// debug: Development-only, filtered in production
logger.debug({ userId, query }, "Search query parameters");

// info: Normal operation completed
logger.info({ userId, jobId }, "Job application submitted successfully");

// warn: Something unexpected but handled
logger.warn({ userId, retryCount: attempt }, "Payment retry attempt");

// error: Something that needs attention
logger.error({ userId, error: err.message }, "Payment processing failed");
```

**Why good:** Each level has a clear purpose, makes log filtering effective, alerts only trigger on actual issues

### Bad Example - Wrong Log Levels

```typescript
// Using error for non-errors
logger.error({ userId }, "User logged in"); // This is info, not error!

// Using info for debugging
logger.info({ allUserData }, "Debugging user state"); // This is debug

// No level distinction
console.log("Something happened"); // No structured data, no level
```

**Why bad:** Wrong levels make filtering useless, error alerts trigger for normal events, no structured data prevents searching

---

## Pattern 2: Structured Logging

### Good Example - Structured Logging with Context

```typescript
import { logger } from "@/lib/logger";

const OPERATION_CREATE_JOB = "job.create";
const OPERATION_SEARCH_JOBS = "job.search";

// Create child logger with request context
const log = logger.child({
  correlationId: req.headers["x-correlation-id"],
  service: "api",
  userId: req.user?.id,
});

// Log operation start
log.info({ operation: OPERATION_CREATE_JOB, jobTitle }, "Creating job listing");

// Log operation completion with duration
const startTime = performance.now();
const job = await createJob(data);
const duration = Math.round(performance.now() - startTime);

log.info(
  {
    operation: OPERATION_CREATE_JOB,
    jobId: job.id,
    duration,
  },
  "Job listing created successfully"
);
```

**Why good:** Child logger inherits context (no repetition), named constants for operations enable consistent filtering, duration tracking enables performance monitoring, correlationId links all logs from same request

### Bad Example - Unstructured Logging

```typescript
console.log("Creating job for user " + userId);
console.log("Job created: " + jobId);
```

**Why bad:** No structured data means can't search or filter, no correlation ID means can't trace request flow, string concatenation is not searchable, no duration tracking

---

_Extended examples: [correlation-ids.md](correlation-ids.md) | [tracing.md](tracing.md) | [error-boundaries.md](error-boundaries.md) | [sentry-config.md](sentry-config.md) | [axiom.md](axiom.md) | [performance.md](performance.md)_
