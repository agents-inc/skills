# Fastify - Schema Examples

> TypeBox schemas, validation, and type-safe routes. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Understand [Pattern 2: Schema Definition](../SKILL.md) from core patterns.

---

## Pattern 3: Complete Schema Set

### Good Example - Full Domain Schemas

```typescript
// src/schemas/user.ts
import { Type, Static } from "@fastify/type-provider-typebox";

// Named constants for validation constraints
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 0;
const MAX_AGE = 150;

// Base user schema
export const UserSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  username: Type.String({
    minLength: MIN_USERNAME_LENGTH,
    maxLength: MAX_USERNAME_LENGTH,
  }),
  email: Type.String({ format: "email" }),
  age: Type.Optional(Type.Integer({ minimum: MIN_AGE, maximum: MAX_AGE })),
  role: Type.Union([
    Type.Literal("user"),
    Type.Literal("admin"),
    Type.Literal("moderator"),
  ]),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

// Create input (subset of User)
export const CreateUserSchema = Type.Object({
  username: Type.String({
    minLength: MIN_USERNAME_LENGTH,
    maxLength: MAX_USERNAME_LENGTH,
  }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: MIN_PASSWORD_LENGTH }),
  age: Type.Optional(Type.Integer({ minimum: MIN_AGE, maximum: MAX_AGE })),
});

// Update input (all optional)
export const UpdateUserSchema = Type.Partial(
  Type.Pick(CreateUserSchema, ["username", "email", "age"]),
);

// Route params
export const UserParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

// Query params for list
export const UsersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sort: Type.Optional(
    Type.Union([
      Type.Literal("username"),
      Type.Literal("email"),
      Type.Literal("createdAt"),
    ]),
  ),
  order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
});

// Derive TypeScript types
export type User = Static<typeof UserSchema>;
export type CreateUser = Static<typeof CreateUserSchema>;
export type UpdateUser = Static<typeof UpdateUserSchema>;
export type UserParams = Static<typeof UserParamsSchema>;
export type UsersQuery = Static<typeof UsersQuerySchema>;
```

**Why good:** Named constants for constraints, Static<> derives types from schemas, Type.Partial for update schemas, Type.Union for enums

### Bad Example - Separate Types and Validation (DRIFT RISK)

```typescript
// WRONG - Types and validation can drift
interface User {
  id: string;
  username: string;
  email: string;
}

const validateUser = (data: unknown): data is User => {
  // Manual validation...
  return true;
};

// Later someone adds a field to interface but not validation
interface User {
  id: string;
  username: string;
  email: string;
  role: string; // Added here, not in validation!
}
```

**Why bad:** Manual validation drifts from types, no JSON Schema for documentation, no Fastify integration

---

## Pattern 4: Route with Full Schema

### Good Example - Complete CRUD Routes

```typescript
// src/routes/users.ts
import type { FastifyPluginAsync } from "fastify";
import { Type } from "@fastify/type-provider-typebox";

import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserParamsSchema,
  UsersQuerySchema,
} from "../schemas/user";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
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
            data: Type.Array(UserSchema),
            pagination: Type.Object({
              page: Type.Integer(),
              limit: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // request.query is fully typed as UsersQuery
      const { page = 1, limit = 20, sort, order } = request.query;

      const offset = (page - 1) * limit;
      const [users, total] = await Promise.all([
        fastify.userService.list({ offset, limit, sort, order }),
        fastify.userService.count(),
      ]);

      return reply.status(HTTP_OK).send({
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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
      // request.params.id is typed as string (uuid format)
      const user = await fastify.userService.findById(request.params.id);

      if (!user) {
        return reply.status(HTTP_NOT_FOUND).send({
          statusCode: HTTP_NOT_FOUND,
          error: "Not Found",
          message: `User ${request.params.id} not found`,
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
      // request.body is typed as CreateUser
      const user = await fastify.userService.create(request.body);
      return reply.status(HTTP_CREATED).send(user);
    },
  );

  // PATCH /api/users/:id
  fastify.patch(
    "/:id",
    {
      schema: {
        params: UserParamsSchema,
        body: UpdateUserSchema,
        response: {
          [HTTP_OK]: UserSchema,
          [HTTP_NOT_FOUND]: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await fastify.userService.update(
        request.params.id,
        request.body,
      );

      if (!user) {
        return reply.status(HTTP_NOT_FOUND).send({
          statusCode: HTTP_NOT_FOUND,
          error: "Not Found",
          message: `User ${request.params.id} not found`,
        });
      }

      return reply.status(HTTP_OK).send(user);
    },
  );

  // DELETE /api/users/:id
  fastify.delete(
    "/:id",
    {
      schema: {
        params: UserParamsSchema,
        response: {
          [HTTP_NO_CONTENT]: Type.Null(),
          [HTTP_NOT_FOUND]: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const deleted = await fastify.userService.delete(request.params.id);

      if (!deleted) {
        return reply.status(HTTP_NOT_FOUND).send({
          statusCode: HTTP_NOT_FOUND,
          error: "Not Found",
          message: `User ${request.params.id} not found`,
        });
      }

      return reply.status(HTTP_NO_CONTENT).send();
    },
  );
};
```

**Why good:** Full schema for request (params, querystring, body) AND response, enables fast-json-stringify optimization, complete type inference

---

## Pattern 5: Reusable Schema Components

### Good Example - Shared Error and Pagination Schemas

```typescript
// src/schemas/common.ts
import { Type, TObject, TProperties } from "@fastify/type-provider-typebox";

// Standard error response
export const ErrorSchema = Type.Object({
  statusCode: Type.Integer(),
  error: Type.String(),
  message: Type.String(),
  details: Type.Optional(Type.Unknown()),
});

// Pagination wrapper factory
export const PaginatedResponse = <T extends TProperties>(
  itemSchema: TObject<T>,
) =>
  Type.Object({
    data: Type.Array(itemSchema),
    pagination: Type.Object({
      page: Type.Integer(),
      limit: Type.Integer(),
      total: Type.Integer(),
      totalPages: Type.Integer(),
    }),
  });

// Standard query params for paginated endpoints
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

// ID param schema (reusable)
export const IdParamSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});
```

**Usage:**

```typescript
import {
  ErrorSchema,
  PaginatedResponse,
  IdParamSchema,
} from "../schemas/common";
import { UserSchema } from "../schemas/user";

// Response schema
const UsersListResponse = PaginatedResponse(UserSchema);

fastify.get(
  "/",
  {
    schema: {
      response: {
        [HTTP_OK]: UsersListResponse,
      },
    },
  },
  async (request, reply) => {
    // ...
  },
);
```

**Why good:** Reusable schema components, factory function for paginated responses, consistent structure across endpoints

---

## Pattern 6: Schema Composition

### Good Example - Extending Schemas

```typescript
// src/schemas/post.ts
import { Type, Static } from "@fastify/type-provider-typebox";

const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;

// Base content fields
const PostContentSchema = Type.Object({
  title: Type.String({
    minLength: MIN_TITLE_LENGTH,
    maxLength: MAX_TITLE_LENGTH,
  }),
  content: Type.String({ maxLength: MAX_CONTENT_LENGTH }),
  published: Type.Boolean({ default: false }),
  tags: Type.Optional(Type.Array(Type.String())),
});

// Timestamps (auto-generated)
const TimestampSchema = Type.Object({
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

// Full post with ID and timestamps
export const PostSchema = Type.Intersect([
  Type.Object({ id: Type.String({ format: "uuid" }) }),
  PostContentSchema,
  TimestampSchema,
  Type.Object({
    authorId: Type.String({ format: "uuid" }),
  }),
]);

// Create input (just content)
export const CreatePostSchema = PostContentSchema;

// Update input (partial content)
export const UpdatePostSchema = Type.Partial(PostContentSchema);

// Summary for list views
export const PostSummarySchema = Type.Pick(PostSchema, [
  "id",
  "title",
  "published",
  "createdAt",
  "authorId",
]);

// Types
export type Post = Static<typeof PostSchema>;
export type CreatePost = Static<typeof CreatePostSchema>;
export type UpdatePost = Static<typeof UpdatePostSchema>;
export type PostSummary = Static<typeof PostSummarySchema>;
```

**Why good:** Type.Intersect for composition, Type.Pick for summary views, Type.Partial for update schemas, clear separation of concerns

---

## Validation Error Handling

> See [core.md Pattern 3](core.md) for the full error handler with validation error mapping, custom error classes, and unexpected error handling.

**Key point for schemas:** Fastify validation errors have a `.validation` array (not `.message`). Each entry contains `instancePath`, `message`, and `keyword` — use these to build client-friendly error details.

---

## Quick Reference

| TypeBox Type            | JSON Schema                             | TypeScript        |
| ----------------------- | --------------------------------------- | ----------------- |
| `Type.String()`         | `{ type: "string" }`                    | `string`          |
| `Type.Integer()`        | `{ type: "integer" }`                   | `number`          |
| `Type.Boolean()`        | `{ type: "boolean" }`                   | `boolean`         |
| `Type.Array(T)`         | `{ type: "array", items: T }`           | `T[]`             |
| `Type.Object({...})`    | `{ type: "object", properties: {...} }` | `{ ... }`         |
| `Type.Optional(T)`      | Property not required                   | `T \| undefined`  |
| `Type.Union([...])`     | `{ anyOf: [...] }`                      | Union type        |
| `Type.Literal("x")`     | `{ const: "x" }`                        | `"x"`             |
| `Type.Partial(T)`       | All properties optional                 | `Partial<T>`      |
| `Type.Pick(T, [...])`   | Subset of properties                    | `Pick<T, ...>`    |
| `Type.Intersect([...])` | Merged schemas                          | Intersection type |

| Schema Location  | Purpose                  |
| ---------------- | ------------------------ |
| `params`         | URL path parameters      |
| `querystring`    | Query string parameters  |
| `body`           | Request body             |
| `headers`        | Request headers          |
| `response[code]` | Response for status code |
