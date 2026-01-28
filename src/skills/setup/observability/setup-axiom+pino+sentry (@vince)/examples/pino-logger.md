# Observability Setup - Pino Logger Examples

> Pino logger configuration with development/production modes and security redaction.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [sentry-config.md](sentry-config.md) | [axiom-integration.md](axiom-integration.md) | [ci-cd.md](ci-cd.md) | [health-check.md](health-check.md)

---

## Pattern 9: Pino Logger Setup

**File: `packages/api/src/lib/logger.ts`**

```typescript
// Good Example - Pino logger configuration
import pino from "pino";

const LOG_LEVEL_DEVELOPMENT = "debug";
const LOG_LEVEL_PRODUCTION = "info";

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: isDevelopment ? LOG_LEVEL_DEVELOPMENT : LOG_LEVEL_PRODUCTION,

  // Use pino-pretty in development only
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Base fields included in every log
  base: {
    service: "api",
    version: process.env.APP_VERSION || "unknown",
  },

  // Redact sensitive fields
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "token",
    "apiKey",
  ],
});

// Create child logger for specific context
export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
```

**Why good:** Development gets pretty-printed logs for readability, production gets JSON for Axiom ingestion, base fields provide context in every log, sensitive fields redacted automatically

---

### Bad Example

```typescript
// Bad Example - pino-pretty in production
import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino-pretty", // Always pretty - BAD in production
  },
});
```

**Why bad:** pino-pretty adds significant overhead in production, defeats Pino's performance advantages, should be development-only
