---
name: api-graphql-apollo-server
description: GraphQL API server with Apollo Server — schema, resolvers, context, error handling, data sources, plugins
---

# GraphQL API with Apollo Server

> **Quick Guide:** Use `@apollo/server` (v5) for schema-first GraphQL APIs. Define schemas with SDL (`typeDefs`), implement field population with resolvers, share per-request state via the `context` function, and handle errors with `GraphQLError` + extension codes. Use `startStandaloneServer` for quick setups or integrate with your HTTP framework for production. DataLoader solves the N+1 problem. Plugins hook into the request lifecycle for logging, auth, and performance.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST import from `@apollo/server` -- NOT the deprecated `apollo-server` or `apollo-server-express` packages)**

**(You MUST create new data source and DataLoader instances per request in the context function -- sharing across requests causes data leaks)**

**(You MUST throw `GraphQLError` (from `graphql`) with extension codes for client-facing errors -- generic `Error` exposes stack traces)**

**(You MUST use `ApolloServerPluginDrainHttpServer` when integrating with an HTTP framework -- without it the server doesn't shut down gracefully)**

</critical_requirements>

---

**Auto-detection:** Apollo Server, @apollo/server, ApolloServer, startStandaloneServer, expressMiddleware, GraphQLError, typeDefs, resolvers, contextValue, DataLoader, RESTDataSource, @apollo/datasource-rest, ApolloServerPlugin, buildSubgraphSchema, @apollo/subgraph, graphql-ws, PubSub, formatError, gql tag

**When to use:**

- Building a GraphQL API with schema-first (SDL) design
- Defining typed resolvers with shared context (auth, data sources)
- Wrapping REST APIs or databases behind a unified GraphQL layer
- Implementing real-time features with subscriptions (via `graphql-ws`)
- Building federated subgraphs with `@apollo/subgraph`
- Adding lifecycle hooks with plugins (logging, auth, tracing)

**When NOT to use:**

- Simple REST APIs without nested data relationships (a REST framework is simpler)
- APIs consumed only by one client you control with no query flexibility needs
- Performance-critical APIs where schema overhead matters (consider a code-first approach)

**Key patterns covered:**

- Server setup with `startStandaloneServer` and framework middleware integration
- Resolver structure, arguments (`parent`, `args`, `contextValue`, `info`), and chains
- Context function for per-request state (auth tokens, data sources, DataLoaders)
- Error handling with `GraphQLError`, built-in codes, and `formatError`
- RESTDataSource for wrapping REST APIs with caching and deduplication
- DataLoader for batching and deduplication (N+1 problem)
- Custom plugins with server-level and request-level lifecycle hooks
- Subscriptions with `graphql-ws` and WebSocket server
- Federation subgraph setup with `@apollo/subgraph`

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Server setup, resolvers, context, error handling
- [examples/data-sources.md](examples/data-sources.md) - RESTDataSource, DataLoader, caching
- [examples/advanced.md](examples/advanced.md) - Subscriptions, federation, custom plugins
- [reference.md](reference.md) - Decision frameworks, anti-patterns, production checklist

---

<philosophy>

## Philosophy

Apollo Server follows a **schema-first** approach: define your API contract in SDL, then implement resolvers to populate each field. The schema is the single source of truth for your API shape, documentation, and type system.

**Core principles:**

1. **Schema as contract** -- SDL defines what clients can query before implementation begins
2. **Thin resolvers** -- Resolvers orchestrate data fetching but delegate to data sources and services
3. **Per-request context** -- Each operation gets fresh data source instances and auth state via the context function
4. **Graceful error handling** -- `GraphQLError` with extension codes communicates errors without leaking internals

**Use Apollo Server when:**

- You need a unified API layer over multiple data sources (REST, DB, services)
- Clients benefit from querying exactly the data they need (mobile, varied frontends)
- Schema documentation and introspection matter for developer experience
- You want lifecycle plugins for observability, auth, and caching

**Use simpler approaches when:**

- A single REST endpoint suffices for your use case
- You have no nested data relationships worth expressing in a graph
- The overhead of schema definition and resolver wiring doesn't justify the flexibility

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Server Setup

Two approaches: `startStandaloneServer` for quick/simple setups, or framework middleware integration for production.

```typescript
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const server = new ApolloServer({ typeDefs, resolvers });

const DEFAULT_PORT = 4000;

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    token: req.headers.authorization,
  }),
  listen: { port: DEFAULT_PORT },
});
```

**Why good:** minimal boilerplate for development, context function provides per-request auth state

For production with an HTTP framework, use `expressMiddleware` (from `@as-integrations/express4` or `@as-integrations/express5`) with `ApolloServerPluginDrainHttpServer` for graceful shutdown.

See [examples/core.md](examples/core.md) for both setup patterns with full TypeScript types.

---

### Pattern 2: Resolver Structure and Arguments

Resolvers receive four arguments: `parent` (return value from parent resolver), `args` (field arguments), `contextValue` (shared per-request state), and `info` (operation metadata).

```typescript
const resolvers = {
  Query: {
    user: async (_parent, args, contextValue) => {
      return contextValue.dataSources.usersAPI.getUser(args.id);
    },
  },
  User: {
    posts: async (parent, _args, contextValue) => {
      return contextValue.dataSources.postsAPI.getPostsByAuthor(parent.id);
    },
  },
};
```

**Why good:** parent chaining enables nested queries without client round-trips, data source access through context keeps resolvers thin

See [examples/core.md](examples/core.md) for full resolver patterns with type safety.

---

### Pattern 3: Context Function

The context function runs for every operation. Use it to create per-request data sources, extract auth, and set up DataLoaders.

```typescript
interface MyContext {
  token: string | undefined;
  dataSources: {
    usersAPI: UsersAPI;
    postsAPI: PostsAPI;
  };
}

const server = new ApolloServer<MyContext>({ typeDefs, resolvers });
```

**Critical:** Create new data source instances per request. Sharing instances across requests causes stale data and leaks between users.

See [examples/core.md](examples/core.md) for complete context setup.

---

### Pattern 4: Error Handling with GraphQLError

Throw `GraphQLError` (from the `graphql` package) with extension codes for structured client errors. Use `formatError` to sanitize errors before sending.

```typescript
import { GraphQLError } from "graphql";

throw new GraphQLError("User not found", {
  extensions: {
    code: "USER_NOT_FOUND",
    argumentName: "id",
  },
});
```

**Built-in codes** (from `ApolloServerErrorCode`): `GRAPHQL_PARSE_FAILED`, `GRAPHQL_VALIDATION_FAILED`, `BAD_USER_INPUT`, `INTERNAL_SERVER_ERROR`, `BAD_REQUEST`, `PERSISTED_QUERY_NOT_FOUND`.

See [examples/core.md](examples/core.md) for `formatError`, custom codes, and auth error patterns.

---

### Pattern 5: RESTDataSource

Wrap REST APIs with `@apollo/datasource-rest` for built-in caching, request deduplication, and HTTP method helpers.

```typescript
import { RESTDataSource } from "@apollo/datasource-rest";

class MoviesAPI extends RESTDataSource {
  override baseURL = "https://movies-api.example.com/";

  async getMovie(id: string): Promise<Movie> {
    return this.get<Movie>(`movies/${encodeURIComponent(id)}`);
  }
}
```

**Two-layer caching:** (1) request deduplication prevents duplicate GET calls within a single operation, (2) HTTP response caching honors `cache-control` headers.

See [examples/data-sources.md](examples/data-sources.md) for RESTDataSource methods, custom caching, and `willSendRequest`.

---

### Pattern 6: DataLoader for N+1 Prevention

Use DataLoader to batch and deduplicate database or API calls within a single GraphQL operation.

```typescript
import DataLoader from "dataloader";

const userLoader = new DataLoader<string, User>(async (ids) => {
  const users = await db.users.findMany({ where: { id: { in: [...ids] } } });
  return ids.map(
    (id) => users.find((u) => u.id === id) ?? new Error(`User ${id} not found`),
  );
});
```

**Critical:** Create new DataLoader instances per request (in the context function). DataLoader caches results for the request lifetime -- sharing across requests serves stale data.

See [examples/data-sources.md](examples/data-sources.md) for DataLoader setup, batching patterns, and integration with context.

---

### Pattern 7: Custom Plugins

Plugins hook into server and request lifecycle events. Use them for logging, auth checks, performance tracing, and error reporting.

```typescript
import type { ApolloServerPlugin } from "@apollo/server";

const loggingPlugin: ApolloServerPlugin<MyContext> = {
  async requestDidStart(requestContext) {
    const start = Date.now();
    return {
      async willSendResponse() {
        const duration = Date.now() - start;
        console.log(`Operation took ${duration}ms`);
      },
    };
  },
};
```

**Key lifecycle events:** `serverWillStart`, `requestDidStart`, `parsingDidStart`, `validationDidStart`, `executionDidStart`, `didEncounterErrors`, `willSendResponse`.

See [examples/advanced.md](examples/advanced.md) for complete plugin patterns.

---

### Pattern 8: Subscriptions with graphql-ws

Apollo Server does not include a built-in WebSocket transport. Use `graphql-ws` + `ws` for real-time subscriptions alongside your HTTP server.

```typescript
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";

const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/subscriptions",
});
const serverCleanup = useServer({ schema }, wsServer);
```

**Note:** `startStandaloneServer` does not support subscriptions -- use framework middleware integration instead. The in-memory `PubSub` from `graphql-subscriptions` is for development only; use a distributed pub/sub system in production.

See [examples/advanced.md](examples/advanced.md) for complete subscription setup with drain plugins.

---

### Pattern 9: Federation Subgraph

Use `@apollo/subgraph` to build a subgraph that participates in a federated supergraph. Entities use `@key` directives and `__resolveReference` resolvers.

```typescript
import { buildSubgraphSchema } from "@apollo/subgraph";

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});
```

**Key concepts:** `@key` designates entity identity fields, `__resolveReference` fetches entities by their key fields, `extend type` contributes fields from other subgraphs.

See [examples/advanced.md](examples/advanced.md) for federation schema and reference resolver patterns.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority:**

- **Importing from deprecated packages** (`apollo-server`, `apollo-server-express`) -- use `@apollo/server` exclusively
- **Sharing data source or DataLoader instances across requests** -- causes stale data and cross-user leaks; create new instances in the context function
- **Throwing generic `Error` from resolvers** -- exposes stack traces to clients; use `GraphQLError` with extension codes
- **Missing `ApolloServerPluginDrainHttpServer`** when using framework integration -- server won't shut down gracefully, leaving connections hanging
- **Calling `expressMiddleware` before `server.start()`** -- throws an error; `start()` must complete first

**Medium Priority:**

- **Using `c.req.params` instead of resolver `args`** -- bypasses GraphQL argument validation
- **No pagination limits on list resolvers** -- returns entire datasets; always enforce max limits
- **In-memory `PubSub` in production** -- only works for a single server instance; use a distributed system
- **Missing `encodeURIComponent` on dynamic URL segments in RESTDataSource** -- path traversal vulnerability
- **Not using `formatError` to sanitize errors** -- internal error messages and stack traces leak to clients in development mode

**Gotchas & Edge Cases:**

- **Default resolvers:** Apollo Server auto-resolves fields matching property names on the parent object -- you don't need explicit resolvers for simple property access
- **`contextValue` is shared:** Never destructively modify `contextValue` in resolvers -- other resolvers in the same operation share the object
- **Resolver return value of `undefined`:** Triggers the default resolver to try accessing a property on the parent -- may cause unexpected behavior if the parent doesn't have that field
- **Introspection disabled in production:** By default, introspection is off when `NODE_ENV=production` -- override with `introspection: true` if needed
- **Variable coercion errors:** In v5, malformed variables return HTTP 400 by default (v4 returned 200) -- existing clients may need updates
- **Express integration in v5:** Import `expressMiddleware` from `@as-integrations/express4` or `@as-integrations/express5` (not from `@apollo/server/express4` which was removed)
- **Subscription resolvers:** Must return an `AsyncIterator` from `subscribe`, not a direct value -- the `resolve` function (optional) transforms the event payload
- **Plugin lifecycle:** All plugin methods are async except `willResolveField` and `schemaDidLoadOrUpdate`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST import from `@apollo/server` -- NOT the deprecated `apollo-server` or `apollo-server-express` packages)**

**(You MUST create new data source and DataLoader instances per request in the context function -- sharing across requests causes data leaks)**

**(You MUST throw `GraphQLError` (from `graphql`) with extension codes for client-facing errors -- generic `Error` exposes stack traces)**

**(You MUST use `ApolloServerPluginDrainHttpServer` when integrating with an HTTP framework -- without it the server doesn't shut down gracefully)**

**Failure to follow these rules will cause data leaks between users, expose internal errors to clients, and prevent graceful shutdown.**

</critical_reminders>
