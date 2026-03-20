# Fastify - Core Examples

> Essential patterns for server setup, route definition, error handling, and testing. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: None - start here.

---

## Pattern 1: Server Setup with Type Provider

### Good Example - Factory Pattern with TypeBox

```typescript
// src/server.ts
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { errorHandler } from "./plugins/error-handler";
import { userRoutes } from "./routes/users";

const SERVER_PORT = 3000;
const SERVER_HOST = "0.0.0.0";

const buildServer = () => {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register global error handler
  server.setErrorHandler(errorHandler);

  // Register route plugins with prefixes
  server.register(userRoutes, { prefix: "/api/users" });

  return server;
};

const start = async () => {
  const server = buildServer();

  try {
    await server.listen({ port: SERVER_PORT, host: SERVER_HOST });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

// Named exports
export { buildServer, start };
```

**Why good:** TypeBox provider enables type inference from schemas, factory function enables testing, logger configured from environment

### Bad Example - No Type Provider

```typescript
// WRONG: No type provider, inline configuration
import Fastify from "fastify";

const server = Fastify();

server.get("/users", async (req, reply) => {
  const limit = req.query.limit; // any type!
  return { users: [] };
});

server.listen({ port: 3000 });
```

**Why bad:** No type safety on request/response, magic number for port, no error handling for startup

---

## Pattern 2: Route Definition with Full Schema

### Good Example - Complete CRUD Routes

```typescript
// src/routes/users.ts
import type { FastifyPluginAsync } from "fastify";
import { Type } from "@fastify/type-provider-typebox";

import {
  UserSchema,
  CreateUserSchema,
  UserParamsSchema,
  UsersQuerySchema,
} from "../schemas/user";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NOT_FOUND = 404;

const ErrorSchema = Type.Object({
  statusCode: Type.Integer(),
  error: Type.String(),
  message: Type.String(),
});

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/users
  fastify.get(
    "/",
    {
      schema: {
        querystring: UsersQuerySchema,
        response: {
          [HTTP_OK]: Type.Object({
            users: Type.Array(UserSchema),
            total: Type.Integer(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      // request.query is typed as UsersQuery

      const users = await fastify.userService.list({ limit, offset });

      return reply.status(HTTP_OK).send({
        users,
        total: users.length,
      });
    },
  );

  // GET /api/users/:id
  fastify.get(
    "/:id",
    {
      schema: {
        params: UserParamsSchema,
        response: {
          [HTTP_OK]: UserSchema,
          [HTTP_NOT_FOUND]: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      // request.params is typed as UserParams

      const user = await fastify.userService.findById(id);

      if (!user) {
        return reply.status(HTTP_NOT_FOUND).send({
          statusCode: HTTP_NOT_FOUND,
          error: "Not Found",
          message: `User ${id} not found`,
        });
      }

      return reply.status(HTTP_OK).send(user);
    },
  );

  // POST /api/users
  fastify.post(
    "/",
    {
      schema: {
        body: CreateUserSchema,
        response: {
          [HTTP_CREATED]: UserSchema,
        },
      },
    },
    async (request, reply) => {
      const userData = request.body;
      // request.body is typed as CreateUser

      const user = await fastify.userService.create(userData);

      return reply.status(HTTP_CREATED).send(user);
    },
  );
};
```

**Why good:** Response schemas enable fast-json-stringify optimization (2-3x faster), full type inference on request objects, HTTP constants prevent magic numbers

---

## Pattern 3: Error Handling

### Good Example - Centralized Error Handler

```typescript
// src/plugins/error-handler.ts
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

// Custom error classes
export class NotFoundError extends Error {
  statusCode = HTTP_NOT_FOUND;

  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  statusCode = HTTP_BAD_REQUEST;
  details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // Fastify validation errors
  if (error.validation) {
    request.log.warn(
      { reqId: request.id, validation: error.validation },
      "Validation failed",
    );

    return reply.status(HTTP_BAD_REQUEST).send({
      statusCode: HTTP_BAD_REQUEST,
      error: "Bad Request",
      message: "Validation failed",
      details: error.validation,
    });
  }

  // Custom application errors
  if ("statusCode" in error && typeof error.statusCode === "number") {
    request.log.warn(
      { reqId: request.id, error: error.message },
      "Application error",
    );

    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      ...("details" in error ? { details: error.details } : {}),
    });
  }

  // Unexpected errors - log full details but send generic response
  request.log.error(
    { reqId: request.id, error: error.message, stack: error.stack },
    "Unexpected error",
  );

  return reply.status(HTTP_INTERNAL_ERROR).send({
    statusCode: HTTP_INTERNAL_ERROR,
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
};
```

**Why good:** Fastify validation errors handled specially (expose details), custom errors with statusCode, unexpected errors logged with stack but hidden from client

---

## Pattern 4: Service Injection via Decorators

### Good Example - Registration Order

```typescript
// src/server.ts
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { appConfig } from "./plugins/config";
import { services } from "./plugins/services";
import { userRoutes } from "./routes/users";

const buildServer = () => {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // 1. Infrastructure plugins first (no dependencies)
  server.register(appConfig);

  // 2. Service plugins (may depend on infrastructure)
  server.register(services);

  // 3. Route plugins last (depend on all above)
  server.register(userRoutes, { prefix: "/api/users" });

  return server;
};

export { buildServer };
```

**Why good:** Dependencies declared explicitly, clear registration order, infrastructure before services before routes

---

## Pattern 5: Testing with server.inject()

### Good Example - Test Structure

```typescript
// src/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from "your-test-runner";

import { buildServer } from "./server";

describe("User API", () => {
  let server: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    server = buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it("should list users", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/users",
      query: { limit: "10" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty("users");
    expect(body).toHaveProperty("total");
  });

  it("should validate query parameters", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/users",
      query: { limit: "-1" }, // Invalid: below minimum
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.message).toContain("Validation failed");
  });

  it("should create user with valid data", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/users",
      payload: {
        username: "testuser",
        email: "test@example.com",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.username).toBe("testuser");
    expect(body.id).toBeDefined();
  });

  it("should reject invalid email format", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/users",
      payload: {
        username: "testuser",
        email: "not-an-email",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
```

**Why good:** `server.inject()` tests without network overhead, `beforeEach`/`afterEach` ensures clean state, tests validation and success paths, no external test runner dependency
