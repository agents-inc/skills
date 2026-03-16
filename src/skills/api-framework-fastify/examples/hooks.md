# Fastify - Lifecycle Hooks Examples

> Request lifecycle, hooks, and cross-cutting concerns. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Understand [Pattern 5: Lifecycle Hooks](../SKILL.md) from core patterns.

---

## Hook Execution Order

Fastify hooks execute in this order:

1. `onRequest` - Before parsing (first hook)
2. `preParsing` - Before body parsing
3. `preValidation` - Before schema validation
4. `preHandler` - After validation, before handler
5. `preSerialization` - Before response serialization
6. `onSend` - Before sending response
7. `onResponse` - After response sent (async, non-blocking)
8. `onError` - When error occurs (can modify response)

---

## onRequest Hook

### Good Example - Request Timing and ID

```typescript
// src/plugins/request-timing.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    startTime: bigint;
  }
}

const requestTimingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("requestId", "");
  fastify.decorateRequest("startTime", BigInt(0));

  // onRequest: First hook, before any parsing
  fastify.addHook("onRequest", async (request) => {
    request.requestId =
      request.headers[REQUEST_ID_HEADER]?.toString() ?? randomUUID();
    request.startTime = process.hrtime.bigint();

    request.log.info({ requestId: request.requestId }, "Request started");
  });
};

export const requestTiming = fp(requestTimingPlugin, {
  name: "request-timing",
});
```

**Why good:** Captures timing before any processing, generates request ID if not provided, logs request start

---

## preHandler Hook

### Good Example - Authentication

```typescript
// src/plugins/auth.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

const HTTP_UNAUTHORIZED = 401;
const BEARER_PREFIX = "Bearer ";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
    userRole: string | null;
  }
}

// Route-level hook for authentication
export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return reply.status(HTTP_UNAUTHORIZED).send({
      statusCode: HTTP_UNAUTHORIZED,
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
    });
  }

  const token = authHeader.slice(BEARER_PREFIX.length);

  try {
    const decoded = await request.server.authService.verifyToken(token);
    request.userId = decoded.userId;
    request.userRole = decoded.role;
  } catch {
    return reply.status(HTTP_UNAUTHORIZED).send({
      statusCode: HTTP_UNAUTHORIZED,
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
};

// Plugin to set up request decorators
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", null);
  fastify.decorateRequest("userRole", null);
};

export const auth = fp(authPlugin, {
  name: "auth",
});
```

**Usage in routes:**

```typescript
// Apply to specific routes
fastify.get(
  "/profile",
  { preHandler: [requireAuth] },
  async (request, reply) => {
    // request.userId is set by auth hook
    const user = await fastify.userService.findById(request.userId!);
    return user;
  },
);

// Apply to all routes in a plugin
export const protectedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/dashboard", async (request) => {
    // All routes here require auth
  });
};
```

**Why good:** preHandler runs after validation (body is parsed), can short-circuit with reply, sets request decorators for downstream use

---

## onResponse Hook

### Good Example - Request Logging and Metrics

```typescript
// src/plugins/request-logger.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const requestLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  // onResponse: After response sent (non-blocking)
  fastify.addHook("onResponse", async (request, reply) => {
    const duration = process.hrtime.bigint() - request.startTime;
    const durationMs = Number(duration) / 1e6;

    request.log.info(
      {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: durationMs.toFixed(2),
        contentLength: reply.getHeader("content-length"),
      },
      "Request completed",
    );

    // Send to metrics system
    if (fastify.metrics) {
      fastify.metrics.recordRequest({
        method: request.method,
        path: request.routeOptions.url,
        statusCode: reply.statusCode,
        duration: durationMs,
      });
    }
  });
};

export const requestLogger = fp(requestLoggerPlugin, {
  name: "request-logger",
  dependencies: ["request-timing"],
});
```

**Why good:** onResponse is async and non-blocking (doesn't delay response), captures final status code and timing, good for metrics

---

## onError Hook

### Good Example - Error Logging and Transformation

```typescript
// src/plugins/error-logger.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

const errorLoggerPlugin: FastifyPluginAsync = async (fastify) => {
  // onError: When error occurs in handler
  fastify.addHook("onError", async (request, reply, error: AppError) => {
    const isClientError =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 500;

    if (isClientError) {
      // Log client errors as warnings
      request.log.warn(
        {
          requestId: request.requestId,
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
        },
        "Client error",
      );
    } else {
      // Log server errors with full stack
      request.log.error(
        {
          requestId: request.requestId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          statusCode: error.statusCode || 500,
        },
        "Server error",
      );

      // Report to error tracking service
      if (fastify.errorTracker) {
        fastify.errorTracker.capture(error, {
          requestId: request.requestId,
          userId: request.userId,
          url: request.url,
        });
      }
    }
  });
};

export const errorLogger = fp(errorLoggerPlugin, {
  name: "error-logger",
  dependencies: ["request-timing"],
});
```

**Why good:** Distinguishes client vs server errors for logging levels, captures full context, integrates with error tracking

---

## preSerialization Hook

### Good Example - Response Transformation

```typescript
// src/plugins/response-wrapper.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

interface WrappedResponse {
  success: boolean;
  data: unknown;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

const responseWrapperPlugin: FastifyPluginAsync = async (fastify) => {
  // preSerialization: Transform payload before stringify
  fastify.addHook("preSerialization", async (request, reply, payload) => {
    // Skip if already wrapped or error response
    if (payload && typeof payload === "object" && "success" in payload) {
      return payload;
    }

    // Only wrap successful responses
    const isSuccess =
      reply.statusCode >= HTTP_SUCCESS_MIN &&
      reply.statusCode <= HTTP_SUCCESS_MAX;

    if (!isSuccess) {
      return payload;
    }

    const wrapped: WrappedResponse = {
      success: true,
      data: payload,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return wrapped;
  });
};

export const responseWrapper = fp(responseWrapperPlugin, {
  name: "response-wrapper",
  dependencies: ["request-timing"],
});
```

**Why good:** preSerialization transforms before JSON.stringify, conditionally wraps only success responses, adds metadata

---

## onSend Hook

### Good Example - Response Headers

```typescript
// src/plugins/response-headers.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const responseHeadersPlugin: FastifyPluginAsync = async (fastify) => {
  // onSend: Last chance to modify response
  fastify.addHook("onSend", async (request, reply, payload) => {
    // Add request ID to response headers
    reply.header("x-request-id", request.requestId);

    // Add cache headers for GET requests
    if (request.method === "GET" && !reply.hasHeader("cache-control")) {
      reply.header("cache-control", "no-store");
    }

    // Calculate and add duration header
    if (request.startTime) {
      const duration = process.hrtime.bigint() - request.startTime;
      const durationMs = Number(duration) / 1e6;
      reply.header("x-response-time", `${durationMs.toFixed(2)}ms`);
    }

    return payload;
  });
};

export const responseHeaders = fp(responseHeadersPlugin, {
  name: "response-headers",
  dependencies: ["request-timing"],
});
```

**Why good:** onSend is last chance before response, adds correlation headers, calculates response time

---

## Route-Level vs Plugin-Level Hooks

### Good Example - Selective Hook Application

```typescript
// src/routes/admin.ts
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../plugins/auth";

const HTTP_FORBIDDEN = 403;

// Admin authorization hook
const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.userRole !== "admin") {
    return reply.status(HTTP_FORBIDDEN).send({
      statusCode: HTTP_FORBIDDEN,
      error: "Forbidden",
      message: "Admin access required",
    });
  }
};

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Plugin-level: applies to ALL routes in this plugin
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", requireAdmin);

  // All routes below require admin auth
  fastify.get("/stats", async () => {
    return fastify.statsService.getAll();
  });

  fastify.get("/users", async () => {
    return fastify.userService.listAll();
  });
};

// Alternative: Route-level hooks
export const mixedRoutes: FastifyPluginAsync = async (fastify) => {
  // Public route - no hooks
  fastify.get("/public", async () => {
    return { message: "Public content" };
  });

  // Protected route - route-level preHandler
  fastify.get("/protected", { preHandler: [requireAuth] }, async (request) => {
    return { userId: request.userId };
  });

  // Admin route - multiple route-level hooks
  fastify.delete(
    "/users/:id",
    { preHandler: [requireAuth, requireAdmin] },
    async (request) => {
      // Only admins
    },
  );
};
```

**Why good:** Plugin-level for consistent protection, route-level for selective application, hooks execute in array order

---

## Quick Reference

| Hook               | Timing            | Use For                       |
| ------------------ | ----------------- | ----------------------------- |
| `onRequest`        | Before parsing    | Request ID, timing start      |
| `preParsing`       | Before body parse | Stream transformation         |
| `preValidation`    | Before validation | Custom validation             |
| `preHandler`       | After validation  | Auth, authorization           |
| `preSerialization` | Before stringify  | Response transformation       |
| `onSend`           | Before send       | Headers, final modifications  |
| `onResponse`       | After sent        | Logging, metrics              |
| `onError`          | On error          | Error logging, transformation |

| Hook Level                            | Applies To                |
| ------------------------------------- | ------------------------- |
| `fastify.addHook()` in plugin         | All routes in that plugin |
| Route options `{ preHandler: [...] }` | Single route              |
| Root-level after fp() plugin          | All routes                |
