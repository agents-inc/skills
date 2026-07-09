# GraphQL Yoga Quick Reference

> Decision frameworks, plugin reference, production checklist. Referenced from [SKILL.md](../SKILL.md).

---

## Key Imports

| Import                   | Package                                     | Purpose                                             |
| ------------------------ | ------------------------------------------- | --------------------------------------------------- |
| `createYoga`             | `graphql-yoga`                              | Create Yoga server instance                         |
| `createSchema`           | `graphql-yoga`                              | Create schema from SDL + resolvers                  |
| `createPubSub`           | `graphql-yoga`                              | In-memory publish/subscribe for subscriptions       |
| `pipe`, `filter`, `map`  | `graphql-yoga`                              | Stream utilities for subscription filtering         |
| `maskError`              | `graphql-yoga`                              | Default error masking function (for custom masking) |
| `GraphQLError`           | `graphql`                                   | Intentional client-facing errors (bypasses masking) |
| `useResponseCache`       | `@graphql-yoga/plugin-response-cache`       | HTTP-level response caching                         |
| `usePersistedOperations` | `@graphql-yoga/plugin-persisted-operations` | Restrict to pre-approved operations                 |
| `useCSRFPrevention`      | `@graphql-yoga/plugin-csrf-prevention`      | Require custom header for CSRF protection           |
| `useDeferStream`         | `@graphql-yoga/plugin-defer-stream`         | @defer and @stream directive support                |
| `createRedisEventTarget` | `@graphql-yoga/redis-event-target`          | Redis-backed PubSub for multi-instance              |

---

## createYoga Options

| Option         | Type                                           | Default           | Purpose                           |
| -------------- | ---------------------------------------------- | ----------------- | --------------------------------- |
| `schema`       | `GraphQLSchema`                                | required          | The GraphQL schema                |
| `context`      | `(initialContext) => T`                        | `{}`              | Context factory (async supported) |
| `plugins`      | `Plugin[]`                                     | `[]`              | Envelop and Yoga plugins          |
| `cors`         | `CORSOptions \| (req) => CORSOptions \| false` | `{ origin: '*' }` | CORS configuration                |
| `graphiql`     | `boolean \| GraphiQLOptions`                   | `true`            | GraphiQL IDE                      |
| `maskedErrors` | `boolean \| { maskError }`                     | `true`            | Error masking                     |
| `logging`      | `LogLevel \| LoggerObject`                     | `"info"`          | Log level or custom logger        |
| `multipart`    | `boolean`                                      | `true`            | Enable/disable file uploads       |

---

## Plugin Hook Execution Order

```
HTTP Request arrives
  |
  v
onRequest -----> (can short-circuit with endResponse)
  |
  v
onRequestParse -> (parse GraphQL params from HTTP body)
  |
  v
onParams -------> (can skip execution with setResult -- cache hit)
  |
  v
onParse --------> (parse GraphQL document)
  |
  v
onValidate -----> (validate document against schema)
  |
  v
onContextBuilding (build resolver context)
  |
  v
onExecute / onSubscribe
  |
  v
onExecutionResult
  |
  v
onResultProcess -> (serialize result to HTTP response)
  |
  v
onResponse ------> (final headers/logging before send)
```

---

## Schema Approach Decision

| Approach           | Tool                               | When to Use                                    |
| ------------------ | ---------------------------------- | ---------------------------------------------- |
| Schema-first (SDL) | `createSchema` from `graphql-yoga` | Quick prototyping, teams that prefer SDL       |
| Code-first         | Pothos, Nexus, gqtx                | Full TypeScript inference in schema definition |
| Vanilla graphql-js | `GraphQLSchema` constructor        | Maximum control, no dependencies               |

All produce a `GraphQLSchema` instance that Yoga accepts.

---

## Subscription Transport Decision

| Transport                | Default? | Setup                                 | Best For                                       |
| ------------------------ | -------- | ------------------------------------- | ---------------------------------------------- |
| SSE (Server-Sent Events) | Yes      | Zero config                           | Unidirectional updates, works through proxies  |
| WebSocket (graphql-ws)   | No       | Requires `ws` + `graphql-ws` packages | Bidirectional communication, existing WS infra |
| SSE Single Connection    | No       | `@graphql-yoga/plugin-graphql-sse`    | Multiple subscriptions over one connection     |

---

## Production Checklist

- [ ] `graphiql: false` (or conditional on `NODE_ENV`)
- [ ] CORS locked to specific origins (not `*`)
- [ ] CSRF prevention plugin enabled for browser clients
- [ ] Error masking enabled (default) -- using `GraphQLError` for intentional errors
- [ ] Logging level set to `"warn"` or custom logger connected
- [ ] Response caching for read-heavy queries
- [ ] Security plugins (GraphQL Armor) for public APIs
- [ ] Persisted operations for private APIs (reject arbitrary queries)
- [ ] Redis-backed PubSub if using subscriptions with multiple instances
- [ ] `graphql` peer dependency installed alongside `graphql-yoga`
