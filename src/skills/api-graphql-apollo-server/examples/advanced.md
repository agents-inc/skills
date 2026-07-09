# Apollo Server - Advanced Patterns

> Subscriptions, federation, and custom plugins. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for server setup.

**Additional Examples:**

- [core.md](core.md) - Server setup, resolvers, context, error handling
- [data-sources.md](data-sources.md) - RESTDataSource, DataLoader, caching

---

## Pattern 1: Subscriptions with graphql-ws

### Good Example - WebSocket server alongside HTTP

```typescript
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { PubSub } from "graphql-subscriptions";
import express from "express";
import http from "http";
import cors from "cors";

// PubSub instance -- in-memory, dev only
// Production: use a distributed pub/sub system (Redis, Kafka, etc.)
const pubsub = new PubSub();

const POST_CREATED = "POST_CREATED";

const typeDefs = `#graphql
  type Post {
    id: ID!
    title: String!
    content: String!
  }

  type Query {
    posts: [Post!]!
  }

  type Mutation {
    createPost(title: String!, content: String!): Post!
  }

  type Subscription {
    postCreated: Post!
  }
`;

const resolvers = {
  Query: {
    posts: async (
      _parent: undefined,
      _args: Record<string, never>,
      ctx: MyContext,
    ) => {
      return ctx.dataSources.postsAPI.getAll();
    },
  },
  Mutation: {
    createPost: async (
      _parent: undefined,
      args: { title: string; content: string },
      ctx: MyContext,
    ) => {
      const post = await ctx.dataSources.postsAPI.create(args);

      // Publish event to subscribers
      await pubsub.publish(POST_CREATED, { postCreated: post });

      return post;
    },
  },
  Subscription: {
    postCreated: {
      // subscribe returns an AsyncIterator
      subscribe: () => pubsub.asyncIterator([POST_CREATED]),
      // resolve is optional -- transforms the published payload before sending
    },
  },
};

// Build executable schema (required for graphql-ws)
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = http.createServer(app);

// WebSocket server for subscriptions
const WS_PATH = "/subscriptions";

const wsServer = new WebSocketServer({
  server: httpServer,
  path: WS_PATH,
});

const serverCleanup = useServer({ schema }, wsServer);

// Apollo Server with drain plugins for both HTTP and WS
const server = new ApolloServer<MyContext>({
  schema,
  plugins: [
    // Drain HTTP connections on shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Drain WebSocket connections on shutdown
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

app.use(
  "/graphql",
  cors<cors.CorsRequest>(),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      dataSources: { postsAPI: new PostsAPI({ cache: server.cache }) },
    }),
  }),
);

const DEFAULT_PORT = 4000;

await new Promise<void>((resolve) => {
  httpServer.listen({ port: DEFAULT_PORT }, resolve);
});
```

**Why good:** separate drain plugins for HTTP and WebSocket, event name is a named constant, `makeExecutableSchema` creates schema usable by both Apollo Server and graphql-ws, subscription resolver returns `AsyncIterator`

### Bad Example - Missing drain and in-memory PubSub in production

```typescript
// BAD: no drain plugin for WebSocket server
const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  // Missing WebSocket drain!
});

// BAD: startStandaloneServer does NOT support subscriptions
const { url } = await startStandaloneServer(server);

// BAD: in-memory PubSub doesn't work across multiple server instances
const pubsub = new PubSub(); // Fine for dev, breaks in production
```

**Why bad:** WebSocket connections hang on shutdown without drain plugin, `startStandaloneServer` has no WebSocket support, in-memory PubSub loses events across instances

---

## Pattern 2: Subscription with Filtering

### Good Example - Filtered subscriptions

```typescript
import { withFilter } from "graphql-subscriptions";

const COMMENT_ADDED = "COMMENT_ADDED";

const resolvers = {
  Subscription: {
    // Filter: only send events for the post the client is watching
    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([COMMENT_ADDED]),
        (payload, variables) => {
          // Only send to subscribers watching this specific post
          return payload.commentAdded.postId === variables.postId;
        },
      ),
    },
  },
};

// Schema: subscription field with argument
// type Subscription {
//   commentAdded(postId: ID!): Comment!
// }
```

**Why good:** `withFilter` prevents sending events to unrelated subscribers, filter function compares payload to subscription variables, reduces unnecessary WebSocket traffic

---

## Pattern 3: Custom Plugins

### Good Example - Request logging plugin

```typescript
import type { ApolloServerPlugin } from "@apollo/server";

function requestLoggingPlugin(): ApolloServerPlugin<MyContext> {
  return {
    async requestDidStart(requestContext) {
      const operationName = requestContext.request.operationName ?? "anonymous";
      const start = Date.now();

      return {
        // Log parsing errors
        async parsingDidStart() {
          return async (err) => {
            if (err) {
              console.error(`Parse error in ${operationName}:`, err);
            }
          };
        },

        // Log validation errors
        async validationDidStart() {
          return async (errors) => {
            if (errors) {
              console.error(`Validation errors in ${operationName}:`, errors);
            }
          };
        },

        // Log all encountered errors
        async didEncounterErrors(ctx) {
          for (const err of ctx.errors) {
            console.error(
              `Error in ${operationName}:`,
              err.message,
              err.extensions,
            );
          }
        },

        // Log operation completion
        async willSendResponse() {
          const duration = Date.now() - start;
          console.log(`${operationName} completed in ${duration}ms`);
        },
      };
    },
  };
}

// Register plugin
const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  plugins: [requestLoggingPlugin()],
});
```

**Why good:** typed with `ApolloServerPlugin<MyContext>`, end hooks (returned functions) capture errors from parsing/validation, timing measured from request start to response, wrapped in factory function for reuse

### Good Example - Depth limiting plugin

```typescript
import type { ApolloServerPlugin } from "@apollo/server";
import { GraphQLError } from "graphql";

const MAX_QUERY_DEPTH = 10;

function depthLimitPlugin(
  maxDepth = MAX_QUERY_DEPTH,
): ApolloServerPlugin<MyContext> {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          const { document } = requestContext;
          const depth = calculateQueryDepth(document);

          if (depth > maxDepth) {
            throw new GraphQLError(
              `Query depth ${depth} exceeds maximum of ${maxDepth}`,
              {
                extensions: { code: "QUERY_TOO_DEEP", depth, maxDepth },
              },
            );
          }
        },
      };
    },
  };
}
```

**Why good:** named constant for max depth, plugin factory accepts configuration, throws `GraphQLError` with structured extensions, runs after operation is resolved but before execution

---

## Pattern 4: Server Lifecycle Plugin

### Good Example - Graceful startup and shutdown

```typescript
import type { ApolloServerPlugin } from "@apollo/server";

function lifecyclePlugin(): ApolloServerPlugin<MyContext> {
  return {
    // Runs when server starts
    async serverWillStart() {
      console.log("Apollo Server starting...");

      // Return object with shutdown hooks
      return {
        // Runs when server begins shutdown
        async drainServer() {
          console.log("Draining server connections...");
          // Close external connections (Redis, message queues, etc.)
        },

        // Runs after all connections are drained
        async serverWillStop() {
          console.log("Server stopped.");
        },
      };
    },

    // schemaDidLoadOrUpdate is synchronous (not async)
    schemaDidLoadOrUpdate(schemaContext) {
      console.log("Schema loaded/updated");
    },
  };
}
```

**Why good:** demonstrates the full server lifecycle, `drainServer` handles cleanup before shutdown, `schemaDidLoadOrUpdate` is correctly synchronous (only lifecycle hook that is)

---

## Pattern 5: Federation Subgraph

### Good Example - Subgraph with entity resolution

```typescript
import { ApolloServer } from "@apollo/server";
import { buildSubgraphSchema } from "@apollo/subgraph";
import gql from "graphql-tag";

// Federation 2 schema with @link directive
const typeDefs = gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.0"
      import: ["@key", "@external", "@requires"]
    )

  type Product @key(fields: "id") {
    id: ID!
    name: String!
    price: Float!
    inStock: Boolean!
  }

  type Query {
    products: [Product!]!
    product(id: ID!): Product
  }
`;

const resolvers = {
  Query: {
    products: async (
      _parent: undefined,
      _args: Record<string, never>,
      ctx: MyContext,
    ) => {
      return ctx.dataSources.productsAPI.getAll();
    },
    product: async (
      _parent: undefined,
      args: { id: string },
      ctx: MyContext,
    ) => {
      return ctx.dataSources.productsAPI.getById(args.id);
    },
  },
  Product: {
    // Reference resolver: called by the gateway to resolve entities by @key fields
    __resolveReference: async (reference: { id: string }, ctx: MyContext) => {
      return ctx.dataSources.productsAPI.getById(reference.id);
    },
  },
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});
```

**Why good:** Federation 2 `@link` directive, `@key` designates entity identity, `__resolveReference` fetches entities by key for cross-subgraph resolution, `buildSubgraphSchema` adds federation metadata

### Good Example - Contributing to another subgraph's type

```typescript
// Reviews subgraph extends Product from Products subgraph
const typeDefs = gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.0"
      import: ["@key", "@external"]
    )

  type Review {
    id: ID!
    rating: Int!
    comment: String!
    product: Product!
  }

  # Extend Product from another subgraph
  type Product @key(fields: "id") {
    id: ID! @external
    reviews: [Review!]!
  }

  type Query {
    reviews: [Review!]!
  }
`;

const resolvers = {
  Product: {
    reviews: async (
      parent: { id: string },
      _args: Record<string, never>,
      ctx: MyContext,
    ) => {
      return ctx.dataSources.reviewsAPI.getByProductId(parent.id);
    },
  },
};
```

**Why good:** `@external` marks `id` as owned by another subgraph, `reviews` field is contributed by this subgraph, gateway composes both subgraphs into a unified API

---

## Pattern 6: Custom Directives

### Good Example - Schema directive for field-level authorization

```typescript
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { GraphQLError } from "graphql";
import type { GraphQLSchema } from "graphql";

const AUTH_DIRECTIVE_NAME = "auth";

// Schema directive definition
// directive @auth(requires: Role = ADMIN) on FIELD_DEFINITION
// enum Role { ADMIN USER }

function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(
        schema,
        fieldConfig,
        AUTH_DIRECTIVE_NAME,
      )?.[0];

      if (authDirective) {
        const { requires: requiredRole } = authDirective;
        const { resolve: originalResolve } = fieldConfig;

        fieldConfig.resolve = async (source, args, contextValue, info) => {
          if (!contextValue.user) {
            throw new GraphQLError("Authentication required", {
              extensions: { code: "UNAUTHENTICATED" },
            });
          }
          if (contextValue.user.role !== requiredRole) {
            throw new GraphQLError(`Requires ${requiredRole} role`, {
              extensions: { code: "FORBIDDEN", requiredRole },
            });
          }

          return originalResolve
            ? originalResolve(source, args, contextValue, info)
            : source[info.fieldName];
        };
      }

      return fieldConfig;
    },
  });
}

// Apply directive to schema
const schema = authDirectiveTransformer(
  makeExecutableSchema({ typeDefs, resolvers }),
);

const server = new ApolloServer({ schema });
```

**Why good:** directive transformer uses `@graphql-tools/utils` (the standard approach), wraps original resolve to preserve behavior, falls back to default field resolution, auth checks before field execution

### Usage in schema

```graphql
type Query {
  publicPosts: [Post!]!
  adminDashboard: Dashboard! @auth(requires: ADMIN)
  userProfile: Profile! @auth(requires: USER)
}
```
