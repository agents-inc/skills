# Elysia - Lifecycle Hooks & Error Handling Examples

> Lifecycle hooks, custom errors, and error handling patterns. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route definitions and `.derive()` from core examples first.

---

## Lifecycle Hook Order

Elysia processes requests through these phases in order:

1. **onRequest** -- First hook, runs for every request (rate limiting, CORS)
2. **onParse** -- Body parsing
3. **onTransform** -- Mutate context before validation (coerce types)
4. **onBeforeHandle** -- After validation, before handler (auth checks)
5. **Route Handler** -- Your business logic
6. **onAfterHandle** -- After handler, before response (add headers)
7. **onMapResponse** -- Transform response shape
8. **onError** -- Runs ONLY when an error is thrown anywhere
9. **onAfterResponse** -- After response sent to client (cleanup, analytics)

**Critical:** Hooks only apply to routes registered AFTER the hook. Order matters.

---

## Pattern 1: onBeforeHandle for Auth

### Good Example - Auth Guard via Lifecycle Hook

```typescript
import { Elysia, t } from "elysia";

const HTTP_UNAUTHORIZED = 401;

const authPlugin = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, ({ headers }) => ({
    bearerToken: headers.authorization?.replace("Bearer ", "") ?? null,
  }))
  .onBeforeHandle({ as: "scoped" }, ({ bearerToken, status }) => {
    if (!bearerToken) {
      // Returning a value short-circuits the handler
      return status(HTTP_UNAUTHORIZED, {
        error: "Missing Authorization header",
      });
    }
  });

const app = new Elysia()
  .get("/public", () => "no auth needed")
  .use(authPlugin) // Auth applies to routes registered AFTER this
  .get("/protected", ({ bearerToken }) => ({
    message: `Authenticated with token: ${bearerToken}`,
  }));
```

**Why good:** `{ as: "scoped" }` propagates the hook to the parent (not just within the plugin), returning a value from `onBeforeHandle` short-circuits the handler, public routes defined before `.use(authPlugin)` are unaffected

### Bad Example - Local Scope Doesn't Propagate

```typescript
// BAD: Hook stays local -- parent routes never see it
const HTTP_UNAUTHORIZED = 401;

const authPlugin = new Elysia({ name: "auth" }).onBeforeHandle(
  ({ headers, status }) => {
    // This ONLY runs for routes inside authPlugin, not parent routes
    if (!headers.authorization)
      return status(HTTP_UNAUTHORIZED, "Unauthorized");
  },
);
```

**Why bad:** default `local` scope means the hook only applies inside the plugin -- routes in the parent that `.use(authPlugin)` will NOT run this hook

---

## Pattern 2: onRequest for Rate Limiting

### Good Example - Early Request Interception

```typescript
import { Elysia } from "elysia";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 100;
const HTTP_TOO_MANY_REQUESTS = 429;

const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const rateLimitPlugin = new Elysia({ name: "rate-limit" }).onRequest(
  { as: "global" },
  ({ request, server, status }) => {
    const ip = server?.requestIP(request)?.address ?? "unknown";
    const now = Date.now();
    const entry = rateLimiter.get(ip);

    if (entry && now < entry.resetAt) {
      if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
        return status(HTTP_TOO_MANY_REQUESTS, "Rate limit exceeded");
      }
      entry.count++;
    } else {
      rateLimiter.set(ip, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
    }
  },
);
```

**Why good:** `onRequest` is the first lifecycle hook (runs before parsing), `{ as: "global" }` applies to ALL routes in the entire app, rate limiting at the earliest possible point avoids unnecessary work

---

## Pattern 3: onAfterHandle for Response Headers

### Good Example - Add Custom Headers to Responses

```typescript
import { Elysia } from "elysia";

const CACHE_MAX_AGE_SECONDS = 3600;

const app = new Elysia()
  .onAfterHandle({ as: "global" }, ({ set }) => {
    set.headers["x-powered-by"] = "Elysia";
    set.headers["x-request-id"] = crypto.randomUUID();
  })
  .get("/api/data", ({ set }) => {
    // Route-specific headers
    set.headers["cache-control"] = `public, max-age=${CACHE_MAX_AGE_SECONDS}`;
    return { data: "cached content" };
  });
```

**Why good:** `onAfterHandle` runs after the handler completes, ideal for response decoration, `set.headers` is the mutable response header object

---

## Pattern 4: Custom Error Classes

### Good Example - Typed Custom Errors

```typescript
import { Elysia } from "elysia";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

class ValidationError extends Error {
  status = HTTP_BAD_REQUEST;
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

class NotFoundError extends Error {
  status = HTTP_NOT_FOUND;
  constructor(public resource: string) {
    super(`${resource} not found`);
  }
}

class ForbiddenError extends Error {
  status = HTTP_FORBIDDEN;
  constructor() {
    super("Insufficient permissions");
  }
}

const app = new Elysia()
  .error({
    ValidationError,
    NotFoundError,
    ForbiddenError,
  })
  .onError(({ code, error, status }) => {
    // code is narrowed to string union of registered error names
    switch (code) {
      case "ValidationError":
        // error is typed as ValidationError here
        return status(HTTP_BAD_REQUEST, {
          error: "validation_error",
          field: error.field,
          message: error.message,
        });

      case "NotFoundError":
        return status(HTTP_NOT_FOUND, {
          error: "not_found",
          resource: error.resource,
        });

      case "ForbiddenError":
        return status(HTTP_FORBIDDEN, {
          error: "forbidden",
          message: error.message,
        });

      case "VALIDATION":
        // Built-in Elysia validation error
        return status(HTTP_BAD_REQUEST, {
          error: "validation_error",
          message: "Request validation failed",
        });

      case "NOT_FOUND":
        // Built-in Elysia 404
        return status(HTTP_NOT_FOUND, {
          error: "not_found",
          message: "Route not found",
        });
    }
  })
  .get("/user/:id", ({ params: { id } }) => {
    const user = findUser(id);
    if (!user) throw new NotFoundError("User");
    return user;
  });
```

**Why good:** `.error()` registers custom error classes for type-safe `code` narrowing in `onError`, `status` property on error class sets the default HTTP status, built-in codes (`VALIDATION`, `NOT_FOUND`, `PARSE`, `INTERNAL_SERVER_ERROR`) coexist with custom ones

---

## Pattern 5: onTransform for Input Coercion

### Good Example - Coerce Before Validation

```typescript
import { Elysia, t } from "elysia";

const app = new Elysia()
  .onTransform(({ params }) => {
    // Coerce string params to numbers before validation runs
    if (params && "id" in params) {
      const parsed = Number(params.id);
      if (!Number.isNaN(parsed)) {
        params.id = parsed;
      }
    }
  })
  .get("/user/:id", ({ params: { id } }) => ({ id }), {
    params: t.Object({ id: t.Number() }),
  });
```

**Why good:** `onTransform` runs BEFORE validation, so coerced values pass the `t.Number()` check, avoids validation failures for URL params that are always strings

> **Note:** Elysia 1.3+ has automatic type coercion for query/params when using TypeBox schemas, so manual `onTransform` coercion is often unnecessary. Use it for custom coercion logic only.

---

## Pattern 6: onAfterResponse for Cleanup

### Good Example - Logging and Analytics

```typescript
import { Elysia } from "elysia";

const app = new Elysia()
  .onAfterResponse({ as: "global" }, ({ request, set }) => {
    // Runs AFTER the response is sent to the client
    // Safe for slow operations -- doesn't affect response time
    console.log(
      JSON.stringify({
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status,
        timestamp: new Date().toISOString(),
      }),
    );
  })
  .get("/", () => "hello");
```

**Why good:** `onAfterResponse` runs after the client receives the response, expensive logging or analytics don't add latency, `{ as: "global" }` captures all routes

---

## Pattern 7: Throwing vs Returning Status

### Important Distinction

```typescript
import { Elysia } from "elysia";

const HTTP_UNAUTHORIZED = 401;
const HTTP_TEAPOT = 418;

const app = new Elysia()
  .onError(({ code }) => {
    console.log("onError triggered:", code);
  })
  // THROWING status triggers onError
  .get("/throw", ({ status }) => {
    throw status(HTTP_TEAPOT, "I'm a teapot");
    // onError WILL run with code "UNKNOWN"
  })
  // RETURNING status does NOT trigger onError
  .get("/return", ({ status }) => {
    return status(HTTP_UNAUTHORIZED, "Not authorized");
    // onError will NOT run -- response sent directly
  });
```

**Why important:** throwing `status()` routes through `onError` for centralized handling, returning `status()` bypasses `onError` entirely and sends the response directly -- choose based on whether you want centralized error handling for this case
