# Mercurius - Core Examples

> Essential patterns for registration, resolvers, loaders, context, error handling, and testing. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Fastify knowledge recommended. See also: [subscriptions.md](subscriptions.md), [federation.md](federation.md).

---

## Pattern 1: Full Registration with Options

### Good Example - Complete Setup

```typescript
import Fastify from "fastify";
import mercurius from "mercurius";
import type { MercuriusContext } from "mercurius";
import type { FastifyRequest, FastifyReply } from "fastify";

const JIT_THRESHOLD = 1;
const MAX_QUERY_DEPTH = 10;
const SERVER_PORT = 3000;

const schema = `
  type Query {
    user(id: ID!): User
    users(limit: Int): [User!]!
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    authorId: ID!
  }
`;

const buildContext = async (req: FastifyRequest, _reply: FastifyReply) => {
  return {
    userId: req.headers["x-user-id"] as string | undefined,
  };
};

type PromiseType<T> = T extends PromiseLike<infer U> ? U : T;

declare module "mercurius" {
  interface MercuriusContext extends PromiseType<
    ReturnType<typeof buildContext>
  > {}
}

const app = Fastify({ logger: true });

app.register(mercurius, {
  schema,
  resolvers,
  loaders,
  context: buildContext,
  jit: JIT_THRESHOLD,
  queryDepth: MAX_QUERY_DEPTH,
  graphiql: process.env.NODE_ENV !== "production",
});

const start = async () => {
  await app.listen({ port: SERVER_PORT });
};

start();
```

**Why good:** JIT enabled for production performance, query depth prevents abuse, GraphiQL disabled in production, context builder provides typed per-request data, all numeric values are named constants

### Bad Example - Missing Key Options

```typescript
import Fastify from "fastify";
import mercurius from "mercurius";

const app = Fastify();

app.register(mercurius, {
  schema,
  resolvers,
  // No loaders - N+1 problems
  // No jit - missing performance optimization
  // No queryDepth - vulnerable to depth attacks
  // No context - no per-request data
  // graphiql defaults to true - exposed in production
});
```

**Why bad:** No loaders means N+1 queries, JIT disabled (default 0), no query depth limit allows abuse, graphiql exposed in production

---

## Pattern 2: Resolvers

### Good Example - Typed Resolvers with Context Access

```typescript
import type { MercuriusContext } from "mercurius";

const DEFAULT_LIMIT = 20;

const resolvers = {
  Query: {
    user: async (
      _parent: unknown,
      args: { id: string },
      ctx: MercuriusContext,
    ) => {
      return ctx.reply.server.db.findUser(args.id);
    },
    users: async (
      _parent: unknown,
      args: { limit?: number },
      ctx: MercuriusContext,
    ) => {
      const limit = args.limit ?? DEFAULT_LIMIT;
      return ctx.reply.server.db.listUsers({ limit });
    },
  },
  Mutation: {
    createUser: async (
      _parent: unknown,
      args: { name: string; email: string },
      ctx: MercuriusContext,
    ) => {
      if (!ctx.userId) {
        throw new mercurius.ErrorWithProps("Unauthorized", {}, 401);
      }
      return ctx.reply.server.db.createUser(args);
    },
  },
};
```

**Why good:** Typed context gives autocomplete, Fastify decorators accessed via `ctx.reply.server`, `ErrorWithProps` for GraphQL-compliant errors with extensions, named constant for default limit

### Bad Example - Untyped Resolvers

```typescript
const resolvers = {
  Query: {
    user: async (_: any, args: any, ctx: any) => {
      // No type safety, no autocomplete
      return db.findUser(args.id);
    },
    users: async () => {
      return db.listUsers({ limit: 20 }); // Magic number
    },
  },
};
```

**Why bad:** `any` types lose all type safety, direct `db` access instead of Fastify decorators, magic number for limit

---

## Pattern 3: Loaders (Batched Data Fetching)

### Good Example - Loader with Proper Batching

```typescript
import type { MercuriusContext } from "mercurius";

interface LoaderQuery<T> {
  obj: T;
  params: Record<string, unknown>;
}

const loaders = {
  User: {
    async posts(
      queries: Array<LoaderQuery<{ id: string }>>,
      ctx: MercuriusContext,
    ) {
      // 1. Collect all IDs from the batch
      const userIds = queries.map(({ obj }) => obj.id);

      // 2. Single bulk fetch
      const allPosts = await ctx.reply.server.db.findPostsByAuthorIds(userIds);

      // 3. Map results back in query order (CRITICAL)
      return queries.map(({ obj }) =>
        allPosts.filter((post) => post.authorId === obj.id),
      );
    },
  },
  Post: {
    async author(
      queries: Array<LoaderQuery<{ authorId: string }>>,
      ctx: MercuriusContext,
    ) {
      const authorIds = [...new Set(queries.map(({ obj }) => obj.authorId))];
      const authors = await ctx.reply.server.db.findUsersByIds(authorIds);
      const authorMap = new Map(authors.map((a) => [a.id, a]));

      return queries.map(({ obj }) => authorMap.get(obj.authorId) ?? null);
    },
  },
};
```

**Why good:** Single bulk query instead of N individual queries, results mapped back by index (required), Map for O(1) lookups, deduplicates IDs with Set

### Bad Example - Resolver Instead of Loader

```typescript
const resolvers = {
  User: {
    // N+1 problem: called once per user in the list
    posts: async (parent: { id: string }) => {
      return db.findPostsByAuthorId(parent.id); // 1 query per user!
    },
  },
};
```

**Why bad:** If the query returns 50 users, this fires 50 individual database queries. A loader would batch all 50 into a single query.

---

## Pattern 4: Loader with Cache Control

### Disabling Cache Per-Loader

```typescript
const loaders = {
  User: {
    posts: {
      async loader(
        queries: Array<LoaderQuery<{ id: string }>>,
        ctx: MercuriusContext,
      ) {
        const userIds = queries.map(({ obj }) => obj.id);
        const allPosts =
          await ctx.reply.server.db.findPostsByAuthorIds(userIds);
        return queries.map(({ obj }) =>
          allPosts.filter((post) => post.authorId === obj.id),
        );
      },
      opts: {
        cache: false, // Disable caching for this loader
      },
    },
  },
};
```

**When to use:** When the same field may return different data within a single request (e.g., after a mutation modifies the data mid-request).

**Default behavior:** Caching is enabled by default. Within one request, if the same loader is called with the same `obj`, the cached result is returned.

---

## Pattern 5: Error Handling

### Good Example - ErrorWithProps for GraphQL Errors

```typescript
import mercurius from "mercurius";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

const resolvers = {
  Query: {
    user: async (
      _parent: unknown,
      args: { id: string },
      ctx: MercuriusContext,
    ) => {
      if (!ctx.userId) {
        throw new mercurius.ErrorWithProps(
          "Authentication required",
          { code: "UNAUTHENTICATED" },
          HTTP_UNAUTHORIZED,
        );
      }

      const user = await ctx.reply.server.db.findUser(args.id);

      if (!user) {
        throw new mercurius.ErrorWithProps(
          "User not found",
          { code: "NOT_FOUND", id: args.id },
          HTTP_NOT_FOUND,
        );
      }

      return user;
    },
  },
};
```

**Why good:** `ErrorWithProps` returns GraphQL-spec-compliant errors with extensions, HTTP status codes as named constants, extensions carry machine-readable error codes

### Custom Error Formatter

```typescript
app.register(mercurius, {
  schema,
  resolvers,
  errorFormatter: (execution, ctx) => {
    const errors = execution.errors?.map((error) => ({
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: {
        code: error.extensions?.code ?? "INTERNAL_ERROR",
        // Strip stack traces in production
        ...(process.env.NODE_ENV !== "production" && {
          stack: error.extensions?.stack,
        }),
      },
    }));

    return {
      statusCode: execution.errors?.[0]?.extensions?.statusCode ?? 200,
      response: { data: execution.data, errors },
    };
  },
});
```

**Why good:** Custom formatter strips stack traces in production, preserves machine-readable error codes, returns proper status code from error extensions

---

## Pattern 6: Testing with app.graphql()

### Good Example - Direct GraphQL Execution

```typescript
import { buildApp } from "./app";

let app: ReturnType<typeof buildApp>;

beforeEach(async () => {
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

it("should return a user by ID", async () => {
  const query = `
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
      }
    }
  `;

  const response = await app.graphql(query, null, { id: "user-1" });

  expect(response.data.user).toStrictEqual({
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
  });
});

it("should return error for missing user", async () => {
  const query = `
    query GetUser($id: ID!) {
      user(id: $id) { id name }
    }
  `;

  const response = await app.graphql(query, null, { id: "nonexistent" });

  expect(response.errors).toBeDefined();
  expect(response.errors[0].message).toBe("User not found");
});
```

**Why good:** `app.graphql()` tests the full GraphQL pipeline without HTTP overhead, factory function for test isolation, tests both success and error paths

### Testing via HTTP with inject()

```typescript
it("should handle GraphQL over HTTP", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/graphql",
    payload: {
      query: `{ users(limit: 5) { id name } }`,
    },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.data.users).toHaveLength(5);
});
```

**When to use:** When you need to test HTTP-level concerns (headers, status codes, content negotiation) rather than just GraphQL resolution.
