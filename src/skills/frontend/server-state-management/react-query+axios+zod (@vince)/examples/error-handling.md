# API & Data Fetching - Error Handling

> Structured error logging with Sentry integration. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand axios instance from [core.md](core.md) first.

**Related Examples:**
- [mutations.md](mutations.md) - useMutation hooks with notifications
- [validation.md](validation.md) - Zod schema validation
- [mobx-bridge.md](mobx-bridge.md) - MobxQuery for store integration

---

## Pattern 7: Error Handling with Logger

Use module-specific loggers for API error tracking with structured context.

### Logger Creation

```typescript
// src/lib/logger.ts
import * as Sentry from "@sentry/browser";

export const makeLogger = (moduleName: string) => ({
  error: (message: string, context: Record<string, unknown> = {}, error?: Error) => {
    console.error(`[${moduleName}] ${message}`, context, error);
    Sentry.captureException(error ?? new Error(message), {
      tags: { module: moduleName },
      extra: context,
    });
  },
  info: (message: string, context: Record<string, unknown> = {}) => {
    console.info(`[${moduleName}] ${message}`, context);
  },
  warn: (message: string, context: Record<string, unknown> = {}) => {
    console.warn(`[${moduleName}] ${message}`, context);
  },
});
```

### Usage in API Functions

```typescript
import { makeLogger } from "lib/logger";
import { djangoBackend } from "lib/apiServices";
import { ContentAPI } from "lib/APIs";

const logger = makeLogger("ContentAPI");

export const fetchTemplate = async (templateId: string) => {
  try {
    const response = await djangoBackend.get(ContentAPI.templateURL(templateId));
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch template", { templateId }, error as Error);
    throw error; // Re-throw for React Query to handle
  }
};
```

**Why good:** Module name provides context for debugging, structured logging enables filtering in Sentry, Sentry integration catches errors in production, consistent pattern across codebase

```typescript
// BAD Example - No error context
catch (error) {
  console.error(error); // What operation failed? What ID?
}

// BAD Example - Swallowing errors
catch (error) {
  return null; // Caller doesn't know something went wrong!
}
```

**Why bad:** Generic logs make debugging impossible in production, swallowed errors hide failures and cause silent bugs

---
