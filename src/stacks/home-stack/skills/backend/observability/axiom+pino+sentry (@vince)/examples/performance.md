# Observability - Performance Monitoring

> Tracking utilities for database queries and external API calls. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [tracing.md](tracing.md) for OpenTelemetry integration.

---

## Pattern: Performance Tracking Utilities

```typescript
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

---

## Pattern: Using Performance Wrappers

```typescript
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

**Why good:** Named constants for thresholds, automatic slow operation detection, consistent error logging, duration tracking for all operations

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
