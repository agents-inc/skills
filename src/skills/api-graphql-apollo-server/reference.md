# Apollo Server Quick Reference

> Decision frameworks, anti-patterns, and production checklist. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

### Server Setup Decision

```
Quick prototype or simple API?
├─ YES → startStandaloneServer (zero config)
└─ NO → Need subscriptions, custom middleware, or CORS control?
    ├─ YES → Framework middleware (expressMiddleware, etc.)
    └─ NO → startStandaloneServer (simpler to maintain)
```

### Data Source Decision

```
Wrapping a REST API?
├─ YES → RESTDataSource (built-in caching + deduplication)
└─ NO → Direct database access?
    ├─ YES → Custom data source class + DataLoader for N+1
    └─ NO → Third-party service with SDK?
        └─ YES → Custom class wrapping SDK in context
```

### N+1 Problem Decision

```
Is a field resolver called once per item in a list?
├─ YES → Does the underlying API support batch fetching?
│   ├─ YES → DataLoader with batch function
│   └─ NO → DataLoader for memoization (prevents duplicate single calls)
└─ NO → No DataLoader needed
```

### Subscription Transport Decision

```
Need real-time updates?
├─ YES → Use graphql-ws + ws package
│   ├─ In-memory PubSub for development only
│   └─ Distributed pub/sub (Redis, Kafka) for production
└─ NO → Polling from client or webhooks may suffice
```

### Schema Organization Decision

```
Schema < 200 lines?
├─ YES → Single typeDefs string is fine
└─ NO → Split into domain-specific schema fragments
    ├─ Each domain file exports typeDefs using extend type
    └─ Merge via typeDefs array in ApolloServer constructor
```

### Federation Decision

```
Single team, single service?
├─ YES → Monolithic Apollo Server
└─ NO → Multiple teams or bounded contexts?
    ├─ YES → Federation with @apollo/subgraph
    │   ├─ Each team owns a subgraph
    │   └─ Gateway (Apollo Router) composes supergraph
    └─ NO → Schema stitching (simpler, less tooling)
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

### Shared Data Source Instances

```typescript
// ANTI-PATTERN: data sources created once, shared across all requests
const usersAPI = new UsersAPI();
const postsAPI = new PostsAPI();

startStandaloneServer(server, {
  context: async () => ({
    dataSources: { usersAPI, postsAPI }, // Same instance for every request!
  }),
});
```

**Why wrong:** Cached data leaks between requests and users. One user's data served to another.

**Fix:** Create new instances inside the context function for each operation.

---

### Generic Error Throws

```typescript
// ANTI-PATTERN: generic Error in resolvers
throw new Error("Something went wrong");

// ANTI-PATTERN: leaking implementation details
throw new Error(`PostgreSQL error: relation "users" does not exist`);
```

**Why wrong:** Generic errors expose stack traces in development. Implementation details leak database structure and technology choices.

**Fix:** Throw `GraphQLError` with structured extension codes. Use `formatError` to sanitize.

---

### Fat Resolvers

```typescript
// ANTI-PATTERN: resolver does everything
const resolvers = {
  Mutation: {
    createUser: async (_parent, args) => {
      // Validation
      if (!args.email.includes("@")) throw new Error("Invalid email");
      // Business logic
      const hashedPassword = await bcrypt.hash(args.password, 10);
      // Database access
      const user = await db.query("INSERT INTO users ...");
      // Side effects
      await sendWelcomeEmail(user.email);
      return user;
    },
  },
};
```

**Why wrong:** Untestable, non-reusable, mixes concerns. Resolver should orchestrate, not implement.

**Fix:** Delegate to data sources and service functions. Resolver calls `dataSources.usersAPI.create(args)`.

---

### Missing Drain Plugin

```typescript
// ANTI-PATTERN: framework integration without drain
const httpServer = http.createServer(app);
const server = new ApolloServer({ typeDefs, resolvers }); // No drain plugin!

app.use("/graphql", expressMiddleware(server));
httpServer.listen(4000);
```

**Why wrong:** On SIGTERM, in-flight requests are terminated abruptly. Connections leak.

**Fix:** Add `ApolloServerPluginDrainHttpServer({ httpServer })` to plugins.

---

### Deprecated Package Imports

```typescript
// ANTI-PATTERN: legacy packages (pre-v4)
import { ApolloServer } from "apollo-server"; // Wrong!
import { ApolloServer } from "apollo-server-express"; // Wrong!
import { expressMiddleware } from "@apollo/server/express4"; // Removed in v5!

// CORRECT
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4"; // or express5
```

**Why wrong:** `apollo-server` and `apollo-server-express` are unmaintained. The `@apollo/server/express4` path was removed in v5.

---

### Monolithic Resolver Map

```typescript
// ANTI-PATTERN: all resolvers in one 1000+ line file
const resolvers = {
  Query: {
    users: ...,    // 20 lines
    user: ...,     // 15 lines
    posts: ...,    // 25 lines
    post: ...,     // 15 lines
    comments: ..., // 20 lines
    // ... 30 more resolvers
  },
  Mutation: {
    // ... 20 more resolvers
  },
  User: { ... },
  Post: { ... },
  Comment: { ... },
};
```

**Why wrong:** Merge conflicts, hard to find resolvers, no clear domain ownership.

**Fix:** Split into domain-specific resolver files, pass as array to `ApolloServer({ resolvers: [userResolvers, postResolvers] })`.

</anti_patterns>

---

## Built-in Error Codes Reference

| Code                            | Import from             | Use Case                               |
| ------------------------------- | ----------------------- | -------------------------------------- |
| `GRAPHQL_PARSE_FAILED`          | `@apollo/server/errors` | Syntax errors in operations            |
| `GRAPHQL_VALIDATION_FAILED`     | `@apollo/server/errors` | Operations invalid against schema      |
| `BAD_USER_INPUT`                | `@apollo/server/errors` | Invalid field argument values          |
| `BAD_REQUEST`                   | `@apollo/server/errors` | Error before parsing attempted         |
| `INTERNAL_SERVER_ERROR`         | `@apollo/server/errors` | Default for unspecified errors         |
| `PERSISTED_QUERY_NOT_FOUND`     | `@apollo/server/errors` | APQ hash not in cache                  |
| `PERSISTED_QUERY_NOT_SUPPORTED` | `@apollo/server/errors` | Server has APQ disabled                |
| `OPERATION_RESOLUTION_FAILURE`  | `@apollo/server/errors` | Can't determine which operation to run |

## Plugin Lifecycle Events Reference

### Server Events

| Event                   | Async  | Purpose                       |
| ----------------------- | ------ | ----------------------------- |
| `serverWillStart`       | Yes    | Server initialization         |
| `schemaDidLoadOrUpdate` | **No** | Schema loaded or hot-reloaded |

### Request Events (returned from `requestDidStart`)

| Event                  | Async  | Purpose                              |
| ---------------------- | ------ | ------------------------------------ |
| `didResolveSource`     | Yes    | After resolving operation source     |
| `parsingDidStart`      | Yes    | Before parsing (returns end hook)    |
| `validationDidStart`   | Yes    | Before validation (returns end hook) |
| `didResolveOperation`  | Yes    | After operation identified           |
| `responseForOperation` | Yes    | Override response for operation      |
| `executionDidStart`    | Yes    | Before execution (returns end hook)  |
| `willResolveField`     | **No** | Before each field resolves           |
| `didEncounterErrors`   | Yes    | After errors encountered             |
| `willSendResponse`     | Yes    | Before response sent                 |

### Shutdown Events (returned from `serverWillStart`)

| Event            | Async | Purpose                       |
| ---------------- | ----- | ----------------------------- |
| `drainServer`    | Yes   | Drain connections before stop |
| `serverWillStop` | Yes   | Final cleanup after drain     |

---

## Production Checklist

### Server Setup

- [ ] Using `@apollo/server` package (not deprecated `apollo-server`)
- [ ] Framework integration uses `ApolloServerPluginDrainHttpServer`
- [ ] `server.start()` called before framework middleware
- [ ] Context function creates new data source instances per request
- [ ] `NODE_ENV=production` set in production (disables introspection, hides stack traces)

### Error Handling

- [ ] All client-facing errors use `GraphQLError` with extension codes
- [ ] `formatError` configured to sanitize internal error details
- [ ] No database or infrastructure details in error messages
- [ ] Internal errors logged for debugging (not just swallowed)

### Security

- [ ] Introspection disabled in production (default behavior)
- [ ] CSRF prevention enabled (default behavior)
- [ ] Query depth limiting configured
- [ ] CORS configured with specific origins (not wildcard)
- [ ] `encodeURIComponent` used on all dynamic URL segments in RESTDataSource

### Performance

- [ ] DataLoader used for N+1-prone field resolvers
- [ ] RESTDataSource used for REST API wrapping (built-in caching)
- [ ] Pagination with max limits on list resolvers
- [ ] Response caching configured where appropriate

### Subscriptions (if used)

- [ ] `graphql-ws` + `ws` packages installed
- [ ] WebSocket drain plugin registered alongside HTTP drain
- [ ] Production pub/sub system (not in-memory PubSub)
- [ ] `startStandaloneServer` NOT used (doesn't support WebSocket)

### Federation (if used)

- [ ] `@apollo/subgraph` installed
- [ ] `buildSubgraphSchema` used instead of direct `ApolloServer({ typeDefs })`
- [ ] `@key` directives on all entity types
- [ ] `__resolveReference` implemented for all entities
- [ ] Federation 2 `@link` directive in schema
