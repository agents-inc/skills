# Fastify - Plugin Examples

> Plugin system, encapsulation, and decorators. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Understand [Pattern 4: Plugin Encapsulation](../SKILL.md) from core patterns.

---

## Plugin Basics

### Good Example - Encapsulated Domain Plugin

```typescript
// src/plugins/auth-routes.ts
import type { FastifyPluginAsync } from "fastify";
import { Type } from "@fastify/type-provider-typebox";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_UNAUTHORIZED = 401;

// This plugin is ENCAPSULATED - decorators stay within this scope
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Local decorator - only available in this plugin
  fastify.decorate("authConfig", {
    tokenExpiry: 3600,
    refreshExpiry: 86400,
  });

  fastify.post(
    "/login",
    {
      schema: {
        body: Type.Object({
          email: Type.String({ format: "email" }),
          password: Type.String({ minLength: 8 }),
        }),
        response: {
          [HTTP_OK]: Type.Object({
            token: Type.String(),
            expiresIn: Type.Integer(),
          }),
          [HTTP_UNAUTHORIZED]: Type.Object({
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await validateCredentials(email, password);
      if (!user) {
        return reply.status(HTTP_UNAUTHORIZED).send({
          message: "Invalid credentials",
        });
      }

      const token = generateToken(user, fastify.authConfig.tokenExpiry);

      return reply.status(HTTP_OK).send({
        token,
        expiresIn: fastify.authConfig.tokenExpiry,
      });
    },
  );

  fastify.post("/logout", async (request, reply) => {
    // Logout logic
    return reply.status(HTTP_OK).send({ success: true });
  });
};
```

**Why good:** Plugin is encapsulated, authConfig decorator only accessible within this plugin, schemas define request/response types

---

## Shared Plugins with fastify-plugin

### Good Example - Database Connection Plugin

```typescript
// src/plugins/database.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

// Type augmentation for shared decorator
declare module "fastify" {
  interface FastifyInstance {
    db: {
      query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
      close: () => Promise<void>;
    };
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize database connection
  const pool = createDatabasePool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  const db = {
    query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
    close: async () => {
      await pool.end();
    },
  };

  // Expose to parent scope via fastify-plugin
  fastify.decorate("db", db);

  // Cleanup on server close
  fastify.addHook("onClose", async () => {
    await db.close();
    fastify.log.info("Database connection closed");
  });
};

// Wrap with fastify-plugin to break encapsulation
export const database = fp(databasePlugin, {
  name: "database",
  dependencies: [], // No dependencies
});
```

**Why good:** fastify-plugin exposes decorator to parent scope, type augmentation provides TypeScript support, onClose hook for cleanup

### Bad Example - Shared Plugin Without fp

```typescript
// WRONG - Decorator not visible to other plugins
import type { FastifyPluginAsync } from "fastify";

export const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", createDatabase());
  // This decorator is encapsulated!
};

// In another plugin:
fastify.register(databasePlugin);
fastify.register(async (f) => {
  f.db; // undefined! Encapsulation blocks access
});
```

**Why bad:** Without fastify-plugin wrapper, decorators are encapsulated and invisible to sibling plugins

---

## Plugin Registration Order

### Good Example - Dependency Management

```typescript
// src/server.ts
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { database } from "./plugins/database";
import { auth } from "./plugins/auth";
import { requestContext } from "./plugins/request-context";
import { userRoutes } from "./routes/users";
import { productRoutes } from "./routes/products";

const SERVER_PORT = 3000;
const SERVER_HOST = "0.0.0.0";

const buildServer = () => {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // 1. Infrastructure plugins first (no dependencies)
  server.register(database);
  server.register(requestContext);

  // 2. Middleware plugins (may depend on infrastructure)
  server.register(auth);

  // 3. Route plugins last (depend on all above)
  server.register(userRoutes, { prefix: "/api/users" });
  server.register(productRoutes, { prefix: "/api/products" });

  return server;
};

export { buildServer };
```

**Why good:** Clear registration order, infrastructure before middleware before routes, prefix option for route namespacing

---

## Plugin with Dependencies

### Good Example - Declaring Dependencies

```typescript
// src/plugins/user-service.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

interface UserService {
  findById: (id: string) => Promise<User | null>;
  create: (data: CreateUserInput) => Promise<User>;
  update: (id: string, data: UpdateUserInput) => Promise<User>;
}

declare module "fastify" {
  interface FastifyInstance {
    userService: UserService;
  }
}

const userServicePlugin: FastifyPluginAsync = async (fastify) => {
  // Access db decorator from database plugin
  const { db } = fastify;

  const userService: UserService = {
    findById: async (id) => {
      const [user] = await db.query<User>("SELECT * FROM users WHERE id = $1", [
        id,
      ]);
      return user || null;
    },

    create: async (data) => {
      const [user] = await db.query<User>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
        [data.name, data.email],
      );
      return user;
    },

    update: async (id, data) => {
      const [user] = await db.query<User>(
        "UPDATE users SET name = $1 WHERE id = $2 RETURNING *",
        [data.name, id],
      );
      return user;
    },
  };

  fastify.decorate("userService", userService);
};

export const userService = fp(userServicePlugin, {
  name: "user-service",
  dependencies: ["database"], // Requires database plugin
});
```

**Why good:** dependencies array ensures registration order, TypeScript augmentation for type safety, uses db decorator from database plugin

---

## Request Decorators

### Good Example - Per-Request State

```typescript
// src/plugins/request-context.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    startTime: bigint;
    userId: string | null;
  }
}

const requestContextPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate with initial values
  fastify.decorateRequest("requestId", "");
  fastify.decorateRequest("startTime", BigInt(0));
  fastify.decorateRequest("userId", null);

  // Set values per-request
  fastify.addHook("onRequest", async (request) => {
    request.requestId =
      request.headers[REQUEST_ID_HEADER]?.toString() ?? randomUUID();
    request.startTime = process.hrtime.bigint();
  });
};

export const requestContext = fp(requestContextPlugin, {
  name: "request-context",
});
```

**Usage in routes:**

```typescript
fastify.get("/", async (request, reply) => {
  // Access request decorators
  request.log.info({ requestId: request.requestId }, "Processing request");
  return { requestId: request.requestId };
});
```

**Why good:** decorateRequest with initial values, onRequest hook sets per-request state, type-safe access in routes

---

## Reply Decorators

### Good Example - Response Helpers

```typescript
// src/plugins/reply-helpers.ts
import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

declare module "fastify" {
  interface FastifyReply {
    notFound: (message: string) => void;
    badRequest: (message: string, details?: unknown) => void;
    conflict: (message: string) => void;
  }
}

const replyHelpersPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateReply(
    "notFound",
    function (this: FastifyReply, message: string) {
      this.status(HTTP_NOT_FOUND).send({
        statusCode: HTTP_NOT_FOUND,
        error: "Not Found",
        message,
      });
    },
  );

  fastify.decorateReply(
    "badRequest",
    function (this: FastifyReply, message: string, details?: unknown) {
      this.status(HTTP_BAD_REQUEST).send({
        statusCode: HTTP_BAD_REQUEST,
        error: "Bad Request",
        message,
        ...(details ? { details } : {}),
      });
    },
  );

  fastify.decorateReply(
    "conflict",
    function (this: FastifyReply, message: string) {
      this.status(HTTP_CONFLICT).send({
        statusCode: HTTP_CONFLICT,
        error: "Conflict",
        message,
      });
    },
  );
};

export const replyHelpers = fp(replyHelpersPlugin, {
  name: "reply-helpers",
});
```

**Usage:**

```typescript
fastify.get("/:id", async (request, reply) => {
  const user = await fastify.userService.findById(request.params.id);

  if (!user) {
    return reply.notFound(`User ${request.params.id} not found`);
  }

  return user;
});

fastify.post("/", async (request, reply) => {
  const exists = await fastify.userService.findByEmail(request.body.email);

  if (exists) {
    return reply.conflict("Email already registered");
  }

  return fastify.userService.create(request.body);
});
```

**Why good:** Reply helpers reduce boilerplate, consistent error format, `this` binding for access to reply instance

---

## Quick Reference

| Plugin Type           | Wrapper | Decorator Visibility      |
| --------------------- | ------- | ------------------------- |
| Domain/route plugin   | None    | Encapsulated (local only) |
| Shared infrastructure | `fp()`  | Exposed to parent scope   |
| Utility plugin        | `fp()`  | Exposed to parent scope   |

| fp() Option    | Purpose                             |
| -------------- | ----------------------------------- |
| `name`         | Plugin identifier for debugging     |
| `dependencies` | Required plugins (registered first) |
| `fastify`      | Fastify version constraint          |
| `encapsulate`  | Override encapsulation behavior     |

| Decorator Type      | Initial Value        | Set Per-Request     |
| ------------------- | -------------------- | ------------------- |
| `decorate()`        | Any                  | No (instance-level) |
| `decorateRequest()` | Required             | Yes (in hooks)      |
| `decorateReply()`   | Function with `this` | No (method)         |
