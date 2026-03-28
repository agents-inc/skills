# Observability - Sentry Configuration

> User context, error filtering, and client configuration. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Related**: See [error-boundaries.md](error-boundaries.md) for React error boundary components.

**SDK Version Notes:**

- v9.x: `captureUserFeedback()` renamed to `captureFeedback()`, `comments` field renamed to `message`
- v9.x: `enableTracing` option removed, use `tracesSampleRate` directly (no longer needs boolean flag)
- v9.x: `getCurrentHub()` removed, use `Sentry.getClient()`, `Sentry.getCurrentScope()`, or top-level functions
- v9.x: `beforeSendSpan` cannot return `null` to drop spans, use integrations instead
- v9.x: `hideSourceMaps` option removed (SDK emits hidden source maps by default)
- v9.x: Metrics API completely removed (was deprecated in v8)
- v9.x: Minimum browser support raised to ES2020 (Chrome 80+, Safari 14+, Firefox 74+)
- v10.x: `BaseClient` removed, use `Client`; `hasTracingEnabled()` renamed `hasSpansEnabled()`
- v10.x: OpenTelemetry dependencies bumped to v2; FID web vital reporting removed (use INP)
- v10.x: `_experiments.enableLogs` moved to top-level `enableLogs`
- v10.x: IP address inference now gated by `sendDefaultPii` option

---

## Pattern: Setting User Context

```typescript
// Import from your framework-specific Sentry package
import * as Sentry from "@sentry/react";

import type { User } from "../types/user";

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

---

## Pattern: Using in Auth Flow

```typescript
import { useEffect } from "react";
import { useSession } from "./auth";
import { setSentryUser, clearSentryUser } from "./sentry-user";

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

## Pattern: Error Filtering Configuration

```typescript
// Import from your framework-specific Sentry package
import * as Sentry from "@sentry/react";

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
  dsn: process.env.SENTRY_DSN,

  beforeSend(event, hint) {
    const error = hint.originalException;

    // Skip expected errors by message pattern
    if (error instanceof Error) {
      const isIgnored = IGNORED_ERROR_PATTERNS.some((pattern) =>
        error.message.toLowerCase().includes(pattern.toLowerCase()),
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

---

## Anti-Pattern: No Filtering

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // No beforeSend - every error goes to Sentry
});
```

**Why bad:** Expected errors (404s, user cancellations) waste Sentry quota, alerts trigger for non-issues, real errors buried in noise

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
