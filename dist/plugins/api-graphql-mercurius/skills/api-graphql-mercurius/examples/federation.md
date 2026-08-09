# Mercurius - Federation

> Federated GraphQL services and gateway composition with `@mercuriusjs/federation` and `@mercuriusjs/gateway`. See [SKILL.md](../SKILL.md) for decision guidance, [core.md](core.md) for fundamentals.

**Prerequisites**: Core Mercurius patterns, loader system understanding.

---

## Pattern 1: Federated Service

### Good Example - Service with Entity Loader

```typescript
import Fastify from "fastify";
import mercuriusFederation from "@mercuriusjs/federation";

const SERVER_PORT = 3001;

const schema = `
  extend type Query {
    me: User
  }

  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
  }
`;

const resolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: MercuriusContext) => {
      return ctx.reply.server.db.getCurrentUser(ctx.userId);
    },
  },
};

// CRITICAL: Define __resolveReference as a LOADER, not a resolver
const loaders = {
  User: {
    async __resolveReference(
      queries: Array<{ obj: { id: string } }>,
      ctx: MercuriusContext,
    ) {
      const ids = queries.map(({ obj }) => obj.id);
      const users = await ctx.reply.server.db.findUsersByIds(ids);
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Return in query order
      return queries.map(({ obj }) => userMap.get(obj.id) ?? null);
    },
  },
};

const app = Fastify({ logger: true });

app.register(mercuriusFederation, {
  schema,
  resolvers,
  loaders,
});

app.listen({ port: SERVER_PORT });
```

**Why good:** `__resolveReference` as a loader batches entity resolution (strongly recommended by Mercurius docs), Map for O(1) lookups, results in query order

### Bad Example - \_\_resolveReference as Resolver

```typescript
const resolvers = {
  User: {
    // N+1: called once per referenced entity
    __resolveReference: async (source: { id: string }) => {
      return db.findUser(source.id); // 1 query per entity reference!
    },
  },
};
```

**Why bad:** When the gateway resolves 50 user references, this fires 50 individual queries. As a loader, it would batch all 50 into a single query.

---

## Pattern 2: Gateway Configuration

### Good Example - Gateway Composing Services

```typescript
import Fastify from "fastify";
import mercuriusGateway from "@mercuriusjs/gateway";

const GATEWAY_PORT = 3000;
const POLLING_INTERVAL_MS = 5000;

const app = Fastify({ logger: true });

app.register(mercuriusGateway, {
  gateway: {
    services: [
      {
        name: "user",
        url: "http://user-service:3001/graphql",
        mandatory: true,
      },
      {
        name: "post",
        url: "http://post-service:3002/graphql",
        mandatory: true,
      },
      {
        name: "analytics",
        url: "http://analytics-service:3003/graphql",
        mandatory: false, // Non-critical service
      },
    ],
    pollingInterval: POLLING_INTERVAL_MS,
    errorHandler: (error, service) => {
      if (service.mandatory) {
        app.log.error(
          { error: error.message, service: service.name },
          "Mandatory service error",
        );
      } else {
        app.log.warn(
          { error: error.message, service: service.name },
          "Optional service unavailable",
        );
      }
    },
  },
});

app.listen({ port: GATEWAY_PORT });
```

**Why good:** `mandatory: true` ensures critical services must be available for schema composition, non-critical services degrade gracefully, polling interval enables automatic schema refresh, error handler differentiates severity

---

## Pattern 3: Gateway with Header Forwarding

### Good Example - Forwarding Auth Headers to Services

```typescript
app.register(mercuriusGateway, {
  gateway: {
    services: [
      {
        name: "user",
        url: "http://user-service:3001/graphql",
        mandatory: true,
        rewriteHeaders: (headers, context) => {
          return {
            authorization: headers.authorization,
            "x-request-id": headers["x-request-id"],
          };
        },
      },
    ],
  },
});
```

**Why good:** Only forwards necessary headers (not all), preserves auth context across service boundaries, request ID enables distributed tracing

---

## Pattern 4: Dynamic Schema Refresh

### Programmatic Schema Update

```typescript
// Trigger manual refresh (e.g., after deploying a new service version)
const newSchema = await app.graphql.gateway.refresh();

if (newSchema) {
  app.graphql.replaceSchema(newSchema);
  app.log.info("Gateway schema refreshed");
} else {
  app.log.info("Gateway schema unchanged");
}
```

**When to use:** When you need to trigger schema refresh outside of the polling interval (e.g., after a service deployment, via an admin endpoint).

**Note:** `refresh()` returns `null` if the schema hasn't changed. Always check before calling `replaceSchema()`.

---

## Pattern 5: Federated Service with Extended Types

### Good Example - Post Service Extending User

```typescript
import Fastify from "fastify";
import mercuriusFederation from "@mercuriusjs/federation";

const SERVER_PORT = 3002;

const schema = `
  extend type Query {
    post(id: ID!): Post
    posts(limit: Int): [Post!]!
  }

  type Post @key(fields: "id") {
    id: ID!
    title: String!
    content: String!
    author: User!
  }

  extend type User @key(fields: "id") {
    id: ID! @external
    posts: [Post!]!
  }
`;

const resolvers = {
  Query: {
    post: async (
      _parent: unknown,
      args: { id: string },
      ctx: MercuriusContext,
    ) => {
      return ctx.reply.server.db.findPost(args.id);
    },
  },
};

const loaders = {
  User: {
    async posts(
      queries: Array<{ obj: { id: string } }>,
      ctx: MercuriusContext,
    ) {
      const userIds = queries.map(({ obj }) => obj.id);
      const allPosts = await ctx.reply.server.db.findPostsByAuthorIds(userIds);
      return queries.map(({ obj }) =>
        allPosts.filter((post) => post.authorId === obj.id),
      );
    },
  },
  Post: {
    async __resolveReference(
      queries: Array<{ obj: { id: string } }>,
      ctx: MercuriusContext,
    ) {
      const ids = queries.map(({ obj }) => obj.id);
      const posts = await ctx.reply.server.db.findPostsByIds(ids);
      const postMap = new Map(posts.map((p) => [p.id, p]));
      return queries.map(({ obj }) => postMap.get(obj.id) ?? null);
    },
  },
};

const app = Fastify({ logger: true });

app.register(mercuriusFederation, {
  schema,
  resolvers,
  loaders,
});

app.listen({ port: SERVER_PORT });
```

**Why good:** Post service extends User type to add `posts` field, `@external` marks fields owned by another service, both `User.posts` and `Post.__resolveReference` use loaders for batch resolution
