# Mercurius Reference

> Decision frameworks, hook lifecycle, plugin options, and anti-patterns. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

### When to Use Mercurius

```
Building a GraphQL API on Node.js?
├─ Already using Fastify?
│   └─ YES → Mercurius (native Fastify integration)
├─ Need batched data loading built-in?
│   └─ YES → Mercurius (loader system, no external DataLoader)
├─ Need federation support?
│   └─ YES → Mercurius (@mercuriusjs/federation + @mercuriusjs/gateway)
├─ Need JIT query compilation?
│   └─ YES → Mercurius (graphql-jit integration)
├─ Not using Fastify?
│   └─ Consider a framework-agnostic solution
└─ Default → Mercurius if on Fastify, otherwise evaluate alternatives
```

### Loader vs Resolver Decision

```
Does this field fetch related data from a data source?
├─ YES → Always use a loader (prevents N+1)
└─ NO → Is it a computed/derived field?
    ├─ YES → Use a resolver (no batching needed)
    └─ NO → Is it a root query/mutation?
        ├─ YES → Use a resolver
        └─ NO → Check if the parent already provides the data
```

### Subscription Transport Decision

```
Running multiple server instances?
├─ YES → Use Redis emitter (mqemitter-redis)
└─ NO → Default in-memory emitter works
Need subscription authentication?
├─ YES → Use subscription.context + onConnect
└─ NO → Default context is sufficient
Need event filtering per subscriber?
├─ YES → Use withFilter
└─ NO → Direct pubsub.subscribe is sufficient
```

### Federation vs Monolith Decision

```
Is the GraphQL API managed by multiple teams?
├─ YES → Federation (@mercuriusjs/federation + @mercuriusjs/gateway)
└─ NO → Is the schema too large for one service?
    ├─ YES → Federation for domain separation
    └─ NO → Monolith (single Mercurius instance)
```

</decision_framework>

---

## GraphQL Lifecycle Hooks

### Request Lifecycle Order

| Hook          | When                        | Can Modify             | Common Use                   |
| ------------- | --------------------------- | ---------------------- | ---------------------------- |
| preParsing    | Before query string parsing | source (query string)  | Tracing, query preprocessing |
| preValidation | After parsing               | document (AST)         | Custom validation            |
| preExecution  | Before execution            | document, schema, vars | Auth, rate limiting, logging |
| onResolution  | After execution complete    | execution result       | Metrics, response logging    |

### Subscription Lifecycle Order

| Hook                          | When                       | Common Use                    |
| ----------------------------- | -------------------------- | ----------------------------- |
| preSubscriptionParsing        | Before parsing sub query   | Tracing                       |
| preSubscriptionExecution      | After parsing, before exec | Auth, connection validation   |
| onSubscriptionResolution      | After each event resolves  | Event logging, transformation |
| onSubscriptionEnd             | Subscription terminates    | Cleanup, metrics              |
| onSubscriptionConnectionClose | WebSocket closes           | Session cleanup               |
| onSubscriptionConnectionError | Connection error occurs    | Error logging, alerting       |

### Hook Registration

```typescript
// Register after app.ready() or inside a Fastify plugin
app.graphql.addHook("preParsing", async (schema, source, context) => {
  context.reply.server.log.info({ query: source }, "Incoming query");
});

app.graphql.addHook("preExecution", async (schema, document, context) => {
  // Can return { document, schema, variables, errors }
  // Modifying schema/document disables JIT for this execution
});

app.graphql.addHook("onResolution", async (execution, context) => {
  if (execution.errors?.length) {
    context.reply.server.log.warn(
      { errors: execution.errors },
      "GraphQL errors",
    );
  }
});
```

**Warning:** `preValidation` is skipped for queries served from the parse cache.

---

## Plugin Options Reference

### Core Options

| Option                | Type               | Default    | Description                                      |
| --------------------- | ------------------ | ---------- | ------------------------------------------------ |
| `schema`              | string / string[]  | required   | GraphQL SDL schema definition                    |
| `resolvers`           | object             | required   | Resolver functions by type                       |
| `loaders`             | object             | -          | Batch loader functions by type/field             |
| `context`             | function           | -          | `(req, reply) => object` per-request context     |
| `jit`                 | integer            | 0          | Executions before JIT compilation (0 = disabled) |
| `queryDepth`          | integer            | -          | Maximum allowed query nesting depth              |
| `graphiql`            | boolean / string   | true       | Enable GraphiQL IDE at `/graphiql`               |
| `routes`              | boolean            | true       | Expose `/graphql` endpoint                       |
| `path`                | string             | `/graphql` | Custom GraphQL endpoint path                     |
| `subscription`        | boolean / object   | false      | Enable WebSocket subscriptions                   |
| `errorHandler`        | function / boolean | true       | Custom GraphQL error handler                     |
| `errorFormatter`      | function           | -          | Custom error response formatting                 |
| `allowBatchedQueries` | boolean            | false      | Accept arrays of queries                         |
| `persistedQueries`    | object             | -          | Hash-to-query map for persisted queries          |
| `onlyPersisted`       | boolean            | false      | Reject non-persisted queries                     |
| `defineMutation`      | boolean            | false      | Auto-add empty Mutation type if undefined        |

### Subscription Options (when `subscription` is an object)

| Option         | Type     | Description                                      |
| -------------- | -------- | ------------------------------------------------ |
| `emitter`      | object   | Custom MQEmitter (e.g., mqemitter-redis)         |
| `pubsub`       | object   | Custom PubSub implementation                     |
| `context`      | function | `(connection, request) => object` for WS context |
| `onConnect`    | function | Called on WebSocket connection_init              |
| `onDisconnect` | function | Called on WebSocket disconnect                   |

---

## Anti-Patterns to Avoid

### Using External DataLoader Instead of Mercurius Loaders

```typescript
// WRONG: Manual DataLoader instantiation
import DataLoader from "dataloader";

const resolvers = {
  Query: {
    users: async (_parent: unknown, _args: unknown, ctx: MercuriusContext) => {
      // DataLoader created per-request manually
      const userLoader = new DataLoader((ids: string[]) => fetchUsers(ids));
      return userLoader.loadMany(["1", "2", "3"]);
    },
  },
};
```

```typescript
// CORRECT: Mercurius built-in loaders
const loaders = {
  Query: {
    // Loaders are request-scoped and batched automatically
    async users(
      queries: Array<{ params: { ids: string[] } }>,
      ctx: MercuriusContext,
    ) {
      const allIds = queries.flatMap(({ params }) => params.ids);
      return fetchUsers(allIds);
    },
  },
};
```

**Why it matters:** Mercurius loaders are request-scoped by default and integrate with the GraphQL execution pipeline. External DataLoader requires manual per-request instantiation and does not benefit from Mercurius's caching layer.

---

### Missing subscription: true

```typescript
// WRONG: Subscription resolvers defined but subscriptions not enabled
app.register(mercurius, {
  schema, // includes Subscription type
  resolvers, // includes Subscription resolvers
  // subscription option missing — defaults to false
});
```

```typescript
// CORRECT: Explicitly enable subscriptions
app.register(mercurius, {
  schema,
  resolvers,
  subscription: true,
});
```

**Why it matters:** Subscription resolvers are silently ignored when `subscription` is not enabled. No error is thrown — subscribers simply never receive events.

---

### Hooks Registered Too Early

```typescript
// WRONG: Hook registered before plugin is ready
const app = Fastify();
app.register(mercurius, { schema, resolvers });

// app.graphql does not exist yet!
app.graphql.addHook("preExecution", async () => {});
```

```typescript
// CORRECT: Register hooks inside a Fastify plugin (ensures readiness)
app.register(async (fastify) => {
  fastify.graphql.addHook("preExecution", async (schema, document, context) => {
    // Hook registered after mercurius is loaded
  });
});
```

**Why it matters:** `app.graphql` is decorated by Mercurius during plugin registration. Accessing it before `ready()` or outside a plugin throws a runtime error.

---

## Quick Reference: Mercurius Ecosystem Packages

| Package                         | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `mercurius`                     | Core GraphQL plugin for Fastify            |
| `@mercuriusjs/federation`       | Build federated GraphQL services           |
| `@mercuriusjs/gateway`          | Compose federated services into a gateway  |
| `mercurius-codegen`             | Auto-generate TypeScript types from schema |
| `mercurius-cache`               | Response-level caching for resolvers       |
| `mercurius-upload`              | File upload support (multipart)            |
| `mercurius-logging`             | Automatic query/mutation logging           |
| `mercurius-integration-testing` | Testing utilities for Mercurius APIs       |

---

## Production Checklist

### Before Deploying

- [ ] JIT enabled (`jit: 1` or higher threshold)
- [ ] `queryDepth` set to prevent abuse (minimum 7 if using GraphiQL)
- [ ] `graphiql: false` in production
- [ ] Loaders defined for ALL fields fetching related data
- [ ] Error formatter strips stack traces in production
- [ ] `subscription: true` only if subscriptions are needed
- [ ] Redis emitter configured for multi-instance deployments
- [ ] Context function provides auth data from request headers
- [ ] Federation `__resolveReference` defined as loaders (not resolvers)
- [ ] Hook registration happens inside Fastify plugins (not at top level)
