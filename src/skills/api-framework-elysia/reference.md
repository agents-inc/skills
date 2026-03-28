# Elysia Quick Reference

> Decision frameworks, anti-patterns, and production checklist for Elysia. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

### When to Use Elysia

- Building on Bun runtime with type safety as the top priority
- Need RPC-style client with zero code generation (Eden Treaty)
- High-performance validation with TypeBox AOT compilation
- WebSocket support with schema validation baked in
- Plugin-based architecture with automatic type propagation

### When NOT to Use Elysia

- Node.js-only deployment (Elysia is Bun-first; Node adapter exists but is secondary)
- OpenAPI-first design workflow (Zod-OpenAPI integration is more mature in other frameworks)
- Team already invested in Express/Fastify middleware ecosystem
- Need broad community plugin ecosystem (Express/Fastify have more third-party middleware)

### TypeBox vs Standard Schema (Zod, Valibot, etc.)

**Use TypeBox (`t` from `elysia`):**

- Default choice for Bun projects -- AOT compilation is ~18x faster than Zod
- Full OpenAPI generation support with `@elysiajs/openapi`
- Best type inference with Elysia's internal types

**Use Standard Schema (Zod, Valibot, ArkType):**

- Sharing schemas between Bun backend and non-Bun frontend
- Team already has Zod schemas and doesn't want to rewrite
- Need Zod ecosystem (zod-to-json-schema, shared schema libraries)

**Mix validators in same route (1.4+):**

- Elysia 1.4+ supports different validators per field (params: Zod, body: Valibot)
- Standalone mode merges schemas rather than overwriting

### Scope Decision

| Scope    | Child | Current | Parent | Main | Use When                                     |
| -------- | ----- | ------- | ------ | ---- | -------------------------------------------- |
| `local`  | yes   | yes     | no     | no   | Default. Plugin-internal hooks and state.    |
| `scoped` | yes   | yes     | yes    | no   | Hooks that parent plugins need but not main. |
| `global` | yes   | yes     | yes    | yes  | Hooks that EVERY route in the app must run.  |

### State vs Decorate vs Derive

**`.state(key, value)`** -- Global mutable store. Shared across all requests. Access via `store`.

**`.decorate(key, value)`** -- Singleton value on context. Should NOT be mutated. Use for services, utilities, DB clients.

**`.derive(handler)`** -- Per-request computed value. Runs at transform phase (before validation). Can access `headers`, `query`, `body`.

**`.resolve(handler)`** -- Like `.derive()` but runs after validation. Access validated request data.

**Rule of thumb:** If it's the same for every request, use `.decorate()`. If it changes per request, use `.derive()` or `.resolve()`.

### Eden Treaty vs REST Client

**Use Eden Treaty:**

- Full-stack TypeScript monorepo
- Same Elysia version on client and server
- Want end-to-end type safety without code generation
- Internal APIs consumed by your own frontend

**Use REST/OpenAPI Client:**

- Multi-language clients (Python, Go, etc.)
- External consumers need generated SDKs
- Different teams own server and client
- Need formal OpenAPI documentation for third parties

### Guard vs Inline Validation

**Use `.guard()`:**

- Multiple routes share the same validation (e.g., auth headers)
- Want to encapsulate a group of protected routes
- Cleaner than repeating schemas on every route

**Use inline validation:**

- Route has unique schema not shared with others
- Simple one-off validation
- Schema is small (1-2 fields)

</decision_framework>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Breaking the Chain

```typescript
// ANTI-PATTERN: Separate calls break type inference
const app = new Elysia();

app.get("/users", () => "list");
app.post("/users", ({ body }) => body);

export type App = typeof app; // Types won't include route details!
```

**Why it's wrong:** Eden Treaty client will have no type information for routes. Type inference only flows through chained calls.

**What to do instead:** Chain all route definitions: `new Elysia().get(...).post(...)`.

---

### Using Deprecated error() Function

```typescript
// ANTI-PATTERN: error() is deprecated since 1.3
import { Elysia } from "elysia";

new Elysia().get("/", ({ error }) => {
  return error(404, "Not found"); // Deprecated!
});
```

**Why it's wrong:** `error()` was deprecated in 1.3 in favor of `status()`. Use `status()` for all new code.

**What to do instead:** Use `status()`:

```typescript
const HTTP_NOT_FOUND = 404;

new Elysia().get("/", ({ status }) => {
  return status(HTTP_NOT_FOUND, "Not found");
});
```

---

### Controller Classes with Context Parameters

```typescript
// ANTI-PATTERN: Passing Context to class methods
abstract class Controller {
  static root(context: Context) {
    // Hard to type, loses type integrity
  }
}

new Elysia().get("/", (ctx) => Controller.root(ctx));
```

**Why it's wrong:** Creates "hard to type" situations, loses type safety. Context types are complex and change per route.

**What to do instead:** Destructure what you need and call service functions with plain values:

```typescript
new Elysia().get("/", ({ query }) => UserService.list(query));
```

---

### Overusing .decorate() for Request-Dependent Data

```typescript
// ANTI-PATTERN: Decorating with per-request data
new Elysia()
  .decorate("currentUser", null) // Will be same for ALL requests!
  .get("/profile", ({ currentUser }) => currentUser);
```

**Why it's wrong:** `.decorate()` runs once at setup, not per request. All requests share the same value.

**What to do instead:** Use `.derive()` for per-request computed values:

```typescript
new Elysia()
  .derive(({ headers }) => ({
    currentUser: getUserFromToken(headers.authorization),
  }))
  .get("/profile", ({ currentUser }) => currentUser);
```

---

### Not Naming Plugins

```typescript
// ANTI-PATTERN: Unnamed plugins get re-registered
const auth = new Elysia() // No name!
  .derive(({ headers }) => ({ user: decodeJwt(headers.authorization) }));

new Elysia()
  .use(auth) // Registered once
  .use(somePluginThatAlsoUsesAuth); // auth registered AGAIN
```

**Why it's wrong:** Without `name`, Elysia cannot deduplicate. The derive handler runs twice per request.

**What to do instead:**

```typescript
const auth = new Elysia({ name: "auth" }).derive(({ headers }) => ({
  user: decodeJwt(headers.authorization),
}));
```

---

### Forgetting Scope on Shared Hooks

```typescript
// ANTI-PATTERN: Hook only applies locally
const logger = new Elysia({ name: "logger" }).onBeforeHandle(({ request }) => {
  console.log(request.url);
});

new Elysia().use(logger).get("/", () => "hi"); // Logger does NOT run for this route!
```

**Why it's wrong:** Lifecycle hooks default to `local` scope -- they only apply to routes inside the plugin, not to routes in the parent.

**What to do instead:**

```typescript
const logger = new Elysia({ name: "logger" }).onBeforeHandle(
  { as: "scoped" },
  ({ request }) => {
    console.log(request.url);
  },
);
```

---

### Wrong URL in .handle() Tests

```typescript
// ANTI-PATTERN: Partial URL path
const response = await app.handle(new Request("/users")); // Throws!
```

**Why it's wrong:** `.handle()` requires a fully qualified URL with protocol and host.

**What to do instead:**

```typescript
const response = await app.handle(new Request("http://localhost/users"));
```

</anti_patterns>

---

## Production Checklist

### Before Deploying

- [ ] All route definitions are method-chained (not separate statements)
- [ ] `export type App = typeof app` present if using Eden Treaty
- [ ] Using `status()` not `error()` for error responses
- [ ] No magic numbers in validation schemas or status codes
- [ ] Plugin instances have `name` property for deduplication
- [ ] `.derive()` / `.resolve()` used for per-request data (not `.decorate()`)
- [ ] Lifecycle hooks have correct scope (`local` / `scoped` / `global`)
- [ ] `onError` handles `VALIDATION`, `NOT_FOUND`, `PARSE` codes at minimum
- [ ] WebSocket handlers have TypeBox schemas for message validation
- [ ] Tests use fully qualified URLs in `.handle()` calls
- [ ] `await app.modules` called in tests if using lazy-loaded plugins
