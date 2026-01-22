# Observability Reference

> Decision frameworks, anti-patterns, and red flags for observability patterns. Back to [SKILL.md](SKILL.md) | See [examples/core.md](examples/core.md) for code examples.

---

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

---

## RED FLAGS

### High Priority Issues

- **Missing correlation ID in logs** - Impossible to trace requests across services
- **Using `console.log` instead of structured logger** - Not searchable, no levels
- **Logging sensitive data** - Passwords, tokens, PII are security vulnerabilities
- **Not filtering expected errors in Sentry** - Wastes quota, buries real issues
- **Error logs without stack traces** - Can't debug without knowing where error occurred

### Medium Priority Issues

- **Wrong log level** - Errors logged as info, info logged as debug
- **Missing duration on completed operations** - Can't identify slow operations
- **No child loggers** - Repeating context in every log call
- **Hardcoded log messages without variables** - Can't search for specific instances
- **No user context in Sentry** - Can't identify affected users

### Common Mistakes

- Logging request/response bodies with sensitive data
- Using string interpolation instead of structured fields
- Missing try/catch around logging (can crash app if logger fails)
- Not clearing Sentry user on logout (privacy issue)
- Over-logging in hot paths (performance impact)

### Gotchas & Edge Cases

- **Pino is async by default** - Logs may appear out of order in development
- **Child loggers inherit context** - Don't add conflicting keys; if parent and child use the same key, both appear in JSON output (last value wins when parsed)
- **Sentry has 250 character limit** - Some fields truncated
- **Edge runtime limitations** - Not all Node.js logging features work; redaction is NOT supported in browser environments
- **OpenTelemetry spans must be ended** - Forgetting to call `span.end()` leaks resources
- **Pino v10 breaking change** - Only dropped Node 18 support (Node 20+ required); otherwise API-compatible with v9
- **Transport options serialization** - Transport options must be compatible with Structured Clone Algorithm (no functions, symbols, or class instances)
- **formatters.level incompatibility** - Cannot use `formatters.level` when logging to multiple transport targets
- **Sentry v9: beforeSendSpan cannot drop spans** - Return value of `null` no longer supported; use integrations to control span recording instead
- **Sentry v9: enableTracing removed** - Use `tracesSampleRate` directly instead of `enableTracing: true`
- **Sentry v9: captureUserFeedback renamed** - Now `captureFeedback()` with `message` field instead of `comments`
- **Sentry v9: getCurrentHub removed** - Use `Sentry.getClient()`, `Sentry.getCurrentScope()`, or top-level functions instead
- **React 19 error hooks** - Use `Sentry.reactErrorHandler()` for `createRoot`/`hydrateRoot` hooks (requires SDK v8.6.0+)
- **captureReactException vs captureException** - Use `captureReactException` (v9.8.0+) in custom error boundaries for proper React component stacks
- **Session Replay v8+** - `unblock` and `unmask` options no longer add default DOM selectors; add explicitly if needed
- **Sentry Metrics API removed** - Completely removed in v9 (was deprecated in v8)

---

## Anti-Patterns to Avoid

### Missing Correlation ID

```typescript
// ANTI-PATTERN: Logs without correlation ID
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
// ANTI-PATTERN: Logging passwords and tokens
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
// ANTI-PATTERN: Using error for non-errors
logger.error({ userId }, "User logged in"); // This is info!

// ANTI-PATTERN: Using info for debugging
logger.info({ internalState }, "Debug state"); // This is debug!
```

**Why it's wrong:** Breaks log filtering, triggers false alerts, hides real errors.

**What to do instead:** Follow the log level decision tree above.

---

### Console.log in Production

```typescript
// ANTI-PATTERN: Using console.log
console.log("User created:", userId);
console.log("Error:", error);
```

**Why it's wrong:** No structure, no levels, no correlation ID, not searchable in Axiom.

**What to do instead:** Always use the structured Pino logger.

---

### No Error Context

```typescript
// ANTI-PATTERN: Logging error without context
try {
  await processPayment(data);
} catch (error) {
  logger.error("Payment failed"); // No details!
}
```

**Why it's wrong:** Can't debug without knowing which payment, for which user, what the error was.

**What to do instead:** Include relevant context and error details.

```typescript
// CORRECT
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

---

## Sensitive Data Redaction

Configure Pino to automatically redact sensitive fields:

```typescript
import pino from "pino";

const logger = pino({
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "authorization",
      "*.authorization",
      "creditCard",
      "*.creditCard",
      "ssn",
      "*.ssn",
    ],
    censor: "[REDACTED]",
  },
});
```

### Redaction Options (Pino v9+)

**Complete Field Removal:**

Use `remove: true` to completely remove sensitive fields from output (instead of censoring):

```typescript
const logger = pino({
  redact: {
    paths: ["password", "*.token", "headers.authorization"],
    remove: true, // Field is removed entirely, not replaced with censor
  },
});

// Input: { user: { password: "secret" }, name: "John" }
// Output: { user: {}, name: "John" } - password field gone
```

**Wildcard Patterns:**

- `a.b.*` - Redact all properties of `a.b`
- `a[*].b` - Redact `b` in all array elements of `a`
- `["a-b"].c` - Bracket notation for hyphenated properties

**Performance Notes (Pino v10+):**

- Pino v10+ uses `@pinojs/redact` (replaced `fast-redact`)
- No wildcards: ~2% overhead on JSON.stringify
- With wildcards: ~50% overhead when redacting multiple paths
- Redaction is NOT supported in browser environments

---

## Pino Transport Configuration (v7+)

Pino transports run in worker threads for non-blocking log processing.

### Basic Transport Setup

```typescript
import pino from "pino";

// Single transport to Axiom
const logger = pino(
  { level: "info" },
  pino.transport({
    target: "@axiomhq/pino",
    options: {
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
    },
  }),
);
```

### Multiple Transports

Log to multiple destinations with different levels:

```typescript
const logger = pino(
  { level: "debug" },
  pino.transport({
    targets: [
      // Console output for development
      {
        target: "pino-pretty",
        level: "debug",
        options: { colorize: true },
      },
      // Axiom for production (only info and above)
      {
        target: "@axiomhq/pino",
        level: "info",
        options: {
          dataset: process.env.AXIOM_DATASET,
          token: process.env.AXIOM_TOKEN,
        },
      },
      // File for audit trail (only errors)
      {
        target: "pino/file",
        level: "error",
        options: { destination: "/var/log/app-errors.log" },
      },
    ],
  }),
);
```

### Dedupe Option

Prevent duplicate logs when using multiple transports with overlapping levels:

```typescript
const logger = pino(
  { level: "debug" },
  pino.transport({
    dedupe: true, // Send only to highest matching level transport
    targets: [
      { target: "pino/file", level: "error", options: { destination: 1 } },
      { target: "pino/file", level: "info", options: { destination: 1 } },
    ],
  }),
);
```

**Note:** The `formatters.level` function cannot be used when logging to multiple destinations.

---

## Performance Impact Guidelines

| Action                           | Impact                 | Recommendation                 |
| -------------------------------- | ---------------------- | ------------------------------ |
| `logger.debug()` in hot path     | Low (filtered in prod) | OK if useful for dev           |
| `logger.info()` per request      | Low                    | Standard practice              |
| `logger.info()` per item in loop | High                   | Move outside loop or use debug |
| Logging large objects            | Medium-High            | Log only needed fields         |
| Creating spans per item          | Medium                 | Batch or sample                |

---

## Axiom Query Reference

### Find All Errors in Last Hour

```apl
['myapp-prod']
| where _time > ago(1h)
| where level == "error"
| summarize count() by message
| order by count_ desc
```

### Find Slowest Requests

```apl
['myapp-prod']
| where _time > ago(1h)
| where isnotnull(duration)
| order by duration desc
| take 100
```

### User Activity Timeline

```apl
['myapp-prod']
| where _time > ago(24h)
| where userId == "user-123"
| order by _time asc
```

### Error Rate by Endpoint

```apl
['myapp-prod']
| where _time > ago(1h)
| summarize
    total = count(),
    errors = countif(level == "error")
  by path
| extend error_rate = todouble(errors) / todouble(total) * 100
| order by error_rate desc
```

### P95 Latency by Endpoint

```apl
['myapp-prod']
| where _time > ago(1h)
| where isnotnull(duration)
| summarize p95 = percentile(duration, 95) by path
| order by p95 desc
```
