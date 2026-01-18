# Hono + OpenAPI - Error Handling Examples

> Standardized error response patterns. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route handler patterns from core examples first.

---

## Pattern 1: Standardized Error Handling

### Good Example - Standardized Error Handling

```typescript
import { z } from "zod";
import type { Context } from "hono";

const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.any().optional(),
  })
  .openapi("ErrorResponse");

// Named constants for error codes (no magic strings)
export const ErrorCodes = {
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  INTERNAL_ERROR: "internal_error",
  DATABASE_ERROR: "database_error",
} as const;

export const handleRouteError = (error: unknown, c: Context) => {
  // Always log with context
  console.error("Route error:", error);

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return c.json(
      {
        error: ErrorCodes.VALIDATION_ERROR,
        message: "Validation failed",
        statusCode: HTTP_STATUS_UNPROCESSABLE_ENTITY,
        details: error.errors,
      },
      HTTP_STATUS_UNPROCESSABLE_ENTITY,
    );
  }

  // Handle database constraint violations
  if (error instanceof Error) {
    if (error.message.includes("unique constraint")) {
      return c.json(
        {
          error: ErrorCodes.VALIDATION_ERROR,
          message: "Resource already exists",
          statusCode: HTTP_STATUS_CONFLICT,
        },
        HTTP_STATUS_CONFLICT,
      );
    }

    return c.json(
      {
        error: ErrorCodes.INTERNAL_ERROR,
        message: error.message,
        statusCode: HTTP_STATUS_INTERNAL_ERROR,
      },
      HTTP_STATUS_INTERNAL_ERROR,
    );
  }

  // Fallback for unknown errors
  return c.json(
    {
      error: ErrorCodes.INTERNAL_ERROR,
      message: "An unexpected error occurred",
      statusCode: HTTP_STATUS_INTERNAL_ERROR,
    },
    HTTP_STATUS_INTERNAL_ERROR,
  );
};
```

**Why good:** Named error codes enable frontend handling (switch on code), Zod error details show which field failed, consistent shape = predictable client parsing

**Usage in routes:**

```typescript
app.openapi(getJobsRoute, async (c) => {
  try {
    // ... route logic
  } catch (error) {
    return handleRouteError(error, c);
  }
});
```

### Bad Example - Inconsistent error handling

```typescript
// BAD Example - Inconsistent error handling
app.get("/jobs", async (c) => {
  try {
    const jobs = await db.select().from(jobs);
    return c.json(jobs);
  } catch (error) {
    // BAD: Magic number 500
    // BAD: No error code constant
    // BAD: Generic message
    return c.json({ error: "Error" }, 500);
  }
});
```

**Why bad:** Magic 500 breaks when status changes, generic "Error" message can't be handled by frontend, no logging = blind to production issues

---
