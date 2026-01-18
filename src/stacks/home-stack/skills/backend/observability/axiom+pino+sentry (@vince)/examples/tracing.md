# Observability - OpenTelemetry Tracing

> Custom spans and instrumentation for performance debugging. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [correlation-ids.md](correlation-ids.md) for request context propagation.

---

## Pattern: Tracing Utilities

**File: `packages/api/src/lib/tracing.ts`**

```typescript
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

---

## Pattern: Using Custom Spans

```typescript
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

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
