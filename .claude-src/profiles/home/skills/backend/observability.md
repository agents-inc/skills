# Observability Patterns (Logging, Tracing, Error Handling)

> **Quick Guide:** Structured logging with Pino (debug/info/warn/error). Correlation IDs for request tracing. Sentry error boundaries in React. Attach user context after auth. Filter expected errors (404s). Create Axiom monitors for alerts.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST include correlation ID in ALL log statements for request tracing)**

**(You MUST use structured logging with required fields: level, message, correlationId, timestamp)**

**(You MUST filter expected errors (404, validation) from Sentry to avoid quota waste)**

**(You MUST attach user context to Sentry AFTER authentication completes)**

**(You MUST use child loggers with context instead of repeating fields in every log call)**

</critical_requirements>

---

**Auto-detection:** log, logger, pino, Sentry, error boundary, correlation ID, trace, span, observability, monitoring, alerting

**When to use:**

- Adding logging to new feature code
- Implementing error handling patterns
- Setting up request tracing with correlation IDs
- Creating custom traces and spans for performance debugging
- Configuring Sentry error boundaries in React components
- Creating Axiom monitors and alerts

**When NOT to use:**

- Initial project setup (use `setup/observability.md` instead)
- Installing dependencies (use `setup/observability.md` instead)
- Configuring `next.config.js` (use `setup/observability.md` instead)

**Key patterns covered:**

- Log levels decision tree (when to use debug/info/warn/error)
- Structured logging with required fields
- Correlation IDs: generating, propagating, attaching to logs
- Custom traces/spans with OpenTelemetry
- Sentry error boundaries in React (App Router compatible)
- Attaching user context to Sentry after auth
- Creating Axiom monitors and alerts
- Filtering noise (expected errors like 404s)
- Performance monitoring patterns
- Debugging guide: tracing a request through the system

---

<philosophy>

## Philosophy

**Good observability answers three questions:**

1. **What happened?** (Structured logs with context)
2. **Why did it happen?** (Error tracking with stack traces)
3. **How do I find it?** (Correlation IDs linking related events)

Logging should be **intentional, not defensive**. Every log statement should answer a specific question you might ask when debugging. Avoid logging "just in case" - it creates noise that makes real issues harder to find.

**This skill covers ongoing usage patterns. For initial setup (dependencies, configuration), see `setup/observability.md`.**

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Log Levels Decision Tree

Choose the appropriate log level based on the situation.

```
What are you logging?
├─ Development-only debugging info?
│   └─ debug (filtered in production)
├─ Normal operation events?
│   ├─ Request started/completed → info
│   ├─ User action completed → info
│   └─ Background job finished → info
├─ Something unexpected but recoverable?
│   ├─ Retry attempt → warn
│   ├─ Fallback used → warn
│   └─ Deprecation notice → warn
└─ Something that needs attention?
    ├─ Unhandled exception → error
    ├─ External service failure → error
    └─ Data integrity issue → error
```

**Level Guidelines:**

| Level | Production | When to Use |
|-------|------------|-------------|
| `debug` | Filtered | Development debugging, verbose tracing |
| `info` | Visible | Normal operations, request lifecycle, user actions |
| `warn` | Visible | Recoverable issues, retries, fallbacks |
| `error` | Visible + Alert | Unrecoverable issues, failures, exceptions |

```typescript
// ✅ Good Example - Appropriate log levels
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

```typescript
// ❌ Bad Example - Wrong log levels
// Using error for non-errors
logger.error({ userId }, "User logged in"); // This is info, not error!

// Using info for debugging
logger.info({ allUserData }, "Debugging user state"); // This is debug

// No level distinction
console.log("Something happened"); // No structured data, no level
```

**Why bad:** Wrong levels make filtering useless, error alerts trigger for normal events, no structured data prevents searching

---

### Pattern 2: Structured Logging with Required Fields

Every log statement should include structured context for searchability.

**Required Fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `correlationId` | string | Links all logs from same request |
| `service` | string | Identifies the service (api, web, worker) |
| `operation` | string | What action is being performed |
| `userId` | string? | User performing the action (if authenticated) |
| `duration` | number? | Time taken in milliseconds (for completed operations) |

```typescript
// ✅ Good Example - Structured logging with context
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

```typescript
// ❌ Bad Example - Unstructured logging
console.log("Creating job for user " + userId);
console.log("Job created: " + jobId);
```

**Why bad:** No structured data means can't search or filter, no correlation ID means can't trace request flow, string concatenation is not searchable, no duration tracking

---

### Pattern 3: Correlation IDs for Request Tracing

Generate and propagate correlation IDs to trace requests across services.

**File: `packages/api/src/middleware/correlation-id.ts`**

```typescript
// ✅ Good Example - Correlation ID middleware for Hono
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

**File: `packages/api/src/middleware/request-logger.ts`**

```typescript
// ✅ Good Example - Request logging middleware
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

**Using in Route Handlers:**

```typescript
// ✅ Good Example - Using correlation ID in handlers
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

### Pattern 4: Custom Traces and Spans with OpenTelemetry

Add custom instrumentation for performance debugging.

**File: `packages/api/src/lib/tracing.ts`**

```typescript
// ✅ Good Example - OpenTelemetry tracing utilities
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

const tracer = trace.getTracer("api");

/**
 * Wrap an async operation in a traced span
 */
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a simple span for synchronous operations
 */
export function createSpan(spanName: string, attributes?: Record<string, string | number | boolean>): Span {
  return tracer.startSpan(spanName, { attributes });
}
```

**Using Custom Spans:**

```typescript
// ✅ Good Example - Tracing database operations
import { withSpan } from "@/lib/tracing";
import { db, jobs, companies } from "@/lib/db";

const OPERATION_DB_QUERY = "db.query";

async function getJobWithCompany(jobId: string) {
  return withSpan(
    OPERATION_DB_QUERY,
    {
      "db.operation": "findFirst",
      "db.table": "jobs",
      "job.id": jobId,
    },
    async (span) => {
      const result = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
        with: { company: true },
      });

      span.setAttribute("db.rows_returned", result ? 1 : 0);
      return result;
    }
  );
}
```

**Why good:** Custom spans provide detailed performance breakdown, attributes enable filtering in Axiom, error handling records exceptions for debugging, spans automatically inherit parent context

---

### Pattern 5: Sentry Error Boundaries in React (App Router)

Catch and report React component errors with recovery capability.

**File: `apps/client-next/components/error-boundary.tsx`**

```typescript
// ✅ Good Example - Sentry error boundary for App Router
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to Sentry with component stack
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

// Default fallback component
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**File: `apps/client-next/app/global-error.tsx`**

```typescript
// ✅ Good Example - Global error handler for App Router
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="global-error">
          <h1>Something went wrong!</h1>
          <p>We've been notified and are working on a fix.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

**Why good:** Class component required for error boundaries (hooks can't catch render errors), Sentry receives component stack for debugging, reset capability allows recovery, custom fallback prop enables branded error UI

**Using Error Boundaries:**

```typescript
// ✅ Good Example - Wrapping feature sections
import { ErrorBoundary } from "@/components/error-boundary";
import { JobList } from "@/components/job-list";

export function JobsPage() {
  return (
    <div>
      <h1>Available Jobs</h1>
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <p>Failed to load jobs: {error.message}</p>
            <button onClick={reset}>Retry</button>
          </div>
        )}
      >
        <JobList />
      </ErrorBoundary>
    </div>
  );
}
```

---

### Pattern 6: Attaching User Context to Sentry

Add user information to Sentry after authentication for better debugging.

**File: `apps/client-next/lib/sentry-user.ts`**

```typescript
// ✅ Good Example - Setting Sentry user context
import * as Sentry from "@sentry/nextjs";

import type { User } from "@/types/user";

/**
 * Call after successful authentication
 */
export function setSentryUser(user: User) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    // Add custom attributes
    subscription: user.subscriptionTier,
  });
}

/**
 * Call on logout
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Add additional context for the current scope
 */
export function setSentryContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data);
}
```

**Using in Auth Flow:**

```typescript
// ✅ Good Example - Setting user in auth hook
import { useEffect } from "react";
import { useSession } from "@/lib/auth";
import { setSentryUser, clearSentryUser } from "@/lib/sentry-user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useSession();

  useEffect(() => {
    if (isAuthenticated && user) {
      setSentryUser(user);
    } else {
      clearSentryUser();
    }
  }, [isAuthenticated, user]);

  return children;
}
```

**Why good:** User context helps identify affected users when debugging, cleared on logout for privacy, additional context can be added per-feature

---

### Pattern 7: Filtering Expected Errors

Prevent expected errors from polluting Sentry quota and alerts.

**File: `apps/client-next/sentry.client.config.ts`**

```typescript
// ✅ Good Example - Filtering expected errors
import * as Sentry from "@sentry/nextjs";

const IGNORED_ERROR_PATTERNS = [
  // User-initiated cancellations
  "AbortError",
  "cancelled",
  "user aborted",

  // Network issues (user's problem, not ours)
  "Failed to fetch",
  "NetworkError",
  "Load failed",

  // Expected authentication errors
  "Unauthorized",
  "Session expired",

  // Browser extensions causing issues
  "ResizeObserver loop",
  "Script error.",
];

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  beforeSend(event, hint) {
    const error = hint.originalException;

    // Skip expected errors by message pattern
    if (error instanceof Error) {
      const isIgnored = IGNORED_ERROR_PATTERNS.some((pattern) =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isIgnored) {
        return null;
      }
    }

    // Skip expected HTTP errors
    if (event.contexts?.response?.status_code) {
      const status = event.contexts.response.status_code;
      if (
        status === HTTP_STATUS_NOT_FOUND ||
        status === HTTP_STATUS_UNAUTHORIZED ||
        status === HTTP_STATUS_FORBIDDEN
      ) {
        return null;
      }
    }

    return event;
  },

  // Filter breadcrumbs to reduce noise
  beforeBreadcrumb(breadcrumb) {
    // Skip console.log breadcrumbs (too noisy)
    if (breadcrumb.category === "console" && breadcrumb.level === "log") {
      return null;
    }
    return breadcrumb;
  },
});
```

**Why good:** Named constants for HTTP status codes, configurable ignore patterns, filters both errors and noisy breadcrumbs, preserves unexpected errors for alerting

```typescript
// ❌ Bad Example - No filtering
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // No beforeSend - every error goes to Sentry
});
```

**Why bad:** Expected errors (404s, user cancellations) waste Sentry quota, alerts trigger for non-issues, real errors buried in noise

---

### Pattern 8: Creating Axiom Monitors and Alerts

Set up proactive monitoring for production issues.

**Error Rate Monitor:**

```apl
// Axiom APL - Error rate alert (> 1% errors)
['myapp-prod']
| where _time > ago(5m)
| summarize
    total = count(),
    errors = countif(level == "error")
| extend error_rate = todouble(errors) / todouble(total) * 100
| where error_rate > 1
```

**Latency Monitor:**

```apl
// Axiom APL - P95 latency alert (> 2 seconds)
['myapp-prod']
| where _time > ago(5m)
| where isnotnull(duration)
| summarize p95 = percentile(duration, 95)
| where p95 > 2000
```

**Specific Error Monitor:**

```apl
// Axiom APL - Database connection errors
['myapp-prod']
| where _time > ago(5m)
| where level == "error"
| where message contains "database" or message contains "connection"
| summarize count() by bin(_time, 1m)
| where count_ > 5
```

**Monitor Configuration in Axiom:**

1. **Error Rate Alert**
   - Query: Error rate > 1% over 5 minutes
   - Severity: Warning
   - Notification: Slack #alerts channel

2. **High Latency Alert**
   - Query: P95 > 2000ms over 5 minutes
   - Severity: Warning
   - Notification: Slack #alerts channel

3. **Database Errors Alert**
   - Query: > 5 database errors in 1 minute
   - Severity: Critical
   - Notification: PagerDuty + Slack

---

### Pattern 9: Performance Monitoring Patterns

Track and optimize slow operations.

```typescript
// ✅ Good Example - Performance monitoring
import { logger } from "@/lib/logger";

const SLOW_QUERY_THRESHOLD_MS = 1000;
const SLOW_API_CALL_THRESHOLD_MS = 3000;

/**
 * Wrap database queries with performance tracking
 */
export async function trackedQuery<T>(
  operation: string,
  query: () => Promise<T>,
  log: ReturnType<typeof logger.child>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await query();
    const duration = Math.round(performance.now() - startTime);

    // Log slow queries as warnings
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      log.warn({ operation, duration }, "Slow database query detected");
    } else {
      log.debug({ operation, duration }, "Query completed");
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    log.error({ operation, duration, error: (error as Error).message }, "Query failed");
    throw error;
  }
}

/**
 * Wrap external API calls with performance tracking
 */
export async function trackedApiCall<T>(
  service: string,
  endpoint: string,
  apiCall: () => Promise<T>,
  log: ReturnType<typeof logger.child>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await apiCall();
    const duration = Math.round(performance.now() - startTime);

    if (duration > SLOW_API_CALL_THRESHOLD_MS) {
      log.warn({ service, endpoint, duration }, "Slow external API call");
    } else {
      log.info({ service, endpoint, duration }, "External API call completed");
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    log.error(
      { service, endpoint, duration, error: (error as Error).message },
      "External API call failed"
    );
    throw error;
  }
}
```

**Using Performance Tracking:**

```typescript
// ✅ Good Example - Using performance wrappers
import { trackedQuery, trackedApiCall } from "@/lib/performance";
import { db, jobs } from "@/lib/db";

async function getJobsWithExternalData(log: Logger) {
  // Track database query
  const dbJobs = await trackedQuery(
    "jobs.findMany",
    () => db.query.jobs.findMany({ limit: 100 }),
    log
  );

  // Track external API call
  const enrichedData = await trackedApiCall(
    "enrichment-api",
    "/api/v1/enrich",
    () => fetch("https://api.enrichment.com/enrich", { body: JSON.stringify(dbJobs) }),
    log
  );

  return enrichedData;
}
```

---

### Pattern 10: Debugging Guide - Tracing a Request

How to trace a request through the system when debugging.

**Step 1: Get Correlation ID**

Find the correlation ID from:
- Response headers: `x-correlation-id`
- Error reports in Sentry
- User-reported issue (if client shows correlation ID)

**Step 2: Search Axiom**

```apl
// Find all logs for a specific request
['myapp-prod']
| where correlationId == "abc-123-def-456"
| order by _time asc
```

**Step 3: Analyze Request Flow**

```apl
// See request timeline with duration
['myapp-prod']
| where correlationId == "abc-123-def-456"
| project _time, level, operation, message, duration
| order by _time asc
```

**Step 4: Find Related Errors**

```apl
// Get error details and stack traces
['myapp-prod']
| where correlationId == "abc-123-def-456"
| where level == "error"
| project _time, message, error, stack
```

**Step 5: Check Sentry**

If an error was captured:
1. Search Sentry by correlation ID tag
2. Review stack trace with source maps
3. Check user context and breadcrumbs
4. View session replay if available

**Debugging Checklist:**

- [ ] Get correlation ID from error/user report
- [ ] Search Axiom for request timeline
- [ ] Identify where request failed
- [ ] Check error details and stack trace
- [ ] Review related database queries
- [ ] Check external service calls
- [ ] Verify user context in Sentry

</patterns>

---

<decision_framework>

## Decision Framework

### What to Log

```
Should I add a log statement?
├─ Will this help debug production issues?
│   ├─ YES → Add it with appropriate level
│   └─ NO → Skip it (avoid noise)
├─ Is this a state transition?
│   ├─ Job created, user authenticated → info
│   └─ Internal variable change → skip (use debugger)
├─ Is this an external integration?
│   ├─ YES → Log request/response with duration
│   └─ NO → Evaluate based on complexity
└─ Am I logging "just in case"?
    └─ YES → Remove it (creates noise)
```

### Log Level Selection

```
What log level should I use?
├─ Only useful during development?
│   └─ debug
├─ Normal successful operation?
│   └─ info
├─ Something wrong but handled?
│   └─ warn
└─ Something wrong that needs attention?
    └─ error
```

### Error Handling Strategy

```
How should I handle this error?
├─ Expected error (404, validation)?
│   └─ Log as warn, don't send to Sentry
├─ User-caused error (bad input)?
│   └─ Log as info, return friendly message
├─ System error (database down)?
│   └─ Log as error, send to Sentry, alert
└─ Unknown error (unexpected)?
    └─ Log as error, send to Sentry, investigate
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **setup/observability.md**: Initial configuration this skill builds upon
- **backend/api.md**: Hono middleware for logging and correlation IDs
- **backend/database.md**: Drizzle query logging patterns
- **frontend/react.md**: Error boundary patterns

**Related Patterns:**

- Use correlation ID middleware from Pattern 3 in all Hono routes
- Use error boundaries from Pattern 5 around feature sections
- Use performance wrappers from Pattern 9 for external calls

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing correlation ID in logs (impossible to trace requests)
- Using `console.log` instead of structured logger (not searchable)
- Logging sensitive data (passwords, tokens, PII)
- Not filtering expected errors in Sentry (quota waste)
- Error logs without stack traces (can't debug)

**Medium Priority Issues:**

- Wrong log level (errors as info, info as debug)
- Missing duration on completed operations
- No child loggers (repeating context in every log)
- Hardcoded log messages without variables
- No user context in Sentry (can't identify affected users)

**Common Mistakes:**

- Logging request/response bodies with sensitive data
- Using string interpolation instead of structured fields
- Missing try/catch around logging (can crash app if logger fails)
- Not clearing Sentry user on logout (privacy issue)
- Over-logging in hot paths (performance impact)

**Gotchas & Edge Cases:**

- Pino is async by default - logs may appear out of order in development
- Child loggers inherit context - don't add conflicting keys
- Sentry has 250 character limit on some fields
- Edge runtime doesn't support all Node.js logging features
- OpenTelemetry spans must be explicitly ended

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Missing Correlation ID

```typescript
// ❌ ANTI-PATTERN: Logs without correlation ID
logger.info("Processing payment");
// Later...
logger.info("Payment complete");
// Which payment? Can't trace!
```

**Why it's wrong:** Without correlation ID, can't link related logs for the same request.

**What to do instead:** Always include `correlationId` in log context via child logger.

---

### Logging Sensitive Data

```typescript
// ❌ ANTI-PATTERN: Logging passwords and tokens
logger.info({
  user: { email, password }, // NEVER log passwords!
  authToken: token, // NEVER log tokens!
});
```

**Why it's wrong:** Sensitive data in logs is a security vulnerability.

**What to do instead:** Use Pino's `redact` option to automatically remove sensitive fields.

---

### Wrong Log Levels

```typescript
// ❌ ANTI-PATTERN: Using error for non-errors
logger.error({ userId }, "User logged in"); // This is info!

// ❌ ANTI-PATTERN: Using info for debugging
logger.info({ internalState }, "Debug state"); // This is debug!
```

**Why it's wrong:** Breaks log filtering, triggers false alerts, hides real errors.

**What to do instead:** Follow the log level decision tree in Pattern 1.

---

### Console.log in Production

```typescript
// ❌ ANTI-PATTERN: Using console.log
console.log("User created:", userId);
console.log("Error:", error);
```

**Why it's wrong:** No structure, no levels, no correlation ID, not searchable in Axiom.

**What to do instead:** Always use the structured Pino logger.

---

### No Error Context

```typescript
// ❌ ANTI-PATTERN: Logging error without context
try {
  await processPayment(data);
} catch (error) {
  logger.error("Payment failed"); // No details!
}
```

**Why it's wrong:** Can't debug without knowing which payment, for which user, what the error was.

**What to do instead:** Include relevant context and error details.

```typescript
// ✅ CORRECT
catch (error) {
  logger.error(
    {
      paymentId,
      userId,
      amount,
      error: error.message,
      stack: error.stack,
    },
    "Payment processing failed"
  );
}
```

</anti_patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST include correlation ID in ALL log statements for request tracing)**

**(You MUST use structured logging with required fields: level, message, correlationId, timestamp)**

**(You MUST filter expected errors (404, validation) from Sentry to avoid quota waste)**

**(You MUST attach user context to Sentry AFTER authentication completes)**

**(You MUST use child loggers with context instead of repeating fields in every log call)**

**Failure to follow these rules will result in untraceable requests, wasted Sentry quota, and impossible debugging.**

</critical_reminders>
