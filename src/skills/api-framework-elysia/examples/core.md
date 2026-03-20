# Elysia - Core Examples

> Essential patterns for Elysia route setup, validation, and plugin composition. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [eden-treaty.md](eden-treaty.md) - End-to-end type-safe client
- [lifecycle-errors.md](lifecycle-errors.md) - Lifecycle hooks, error handling, custom errors
- [websocket-testing.md](websocket-testing.md) - WebSocket patterns and unit testing

---

## Pattern 1: Modular App with Plugins

### Good Example - Method-Chained Modular Setup

```typescript
import { Elysia, t } from "elysia";

// Each module is its own Elysia instance with a name and prefix
const userRoutes = new Elysia({ name: "user", prefix: "/user" })
  .get("/", () => ({ users: [] }))
  .get("/:id", ({ params: { id } }) => ({ id }), {
    params: t.Object({
      id: t.Number(),
    }),
  })
  .post("/", ({ body }) => ({ created: body }), {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: "email" }),
    }),
  });

const healthRoutes = new Elysia({ name: "health", prefix: "/health" }).get(
  "/",
  () => ({ status: "ok" }),
);

// Main app composes plugins via .use()
const app = new Elysia().use(userRoutes).use(healthRoutes).listen(3000);

// REQUIRED: Export type for Eden Treaty clients
export type App = typeof app;
```

**Why good:** `name` prevents duplicate registration, `prefix` scopes routes, method chaining preserves type inference, `export type App` enables Eden Treaty

### Bad Example - Separate Calls and No Plugin Names

```typescript
// BAD: Separate calls break type inference
import { Elysia } from "elysia";

const app = new Elysia();

// BAD: Each call is separate -- types don't chain
app.get("/user", () => ({ users: [] }));
app.post("/user", ({ body }) => body);

// BAD: No name -- duplicate registration possible
const auth = new Elysia();
auth.derive(({ headers }) => ({ user: decodeToken(headers.authorization) }));

app.use(auth);

// BAD: Default export
export default app;
```

**Why bad:** separate route calls break Eden Treaty type inference, unnamed plugins can register multiple times, default export violates project conventions

---

## Pattern 2: TypeBox Validation

### Good Example - Complete Request/Response Validation

```typescript
import { Elysia, t } from "elysia";

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MIN_AGE = 0;
const MAX_AGE = 150;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const app = new Elysia()
  .post(
    "/user",
    ({ body }) => ({
      id: crypto.randomUUID(),
      ...body,
    }),
    {
      body: t.Object({
        name: t.String({
          minLength: MIN_NAME_LENGTH,
          maxLength: MAX_NAME_LENGTH,
          error: "Name must be 1-100 characters",
        }),
        email: t.String({ format: "email", error: "Invalid email format" }),
        age: t.Optional(
          t.Number({
            minimum: MIN_AGE,
            maximum: MAX_AGE,
          }),
        ),
      }),
      response: {
        200: t.Object({
          id: t.String({ format: "uuid" }),
          name: t.String(),
          email: t.String(),
          age: t.Optional(t.Number()),
        }),
        400: t.Object({
          error: t.String(),
        }),
      },
    },
  )
  .get("/user", ({ query }) => ({ users: [], page: query.page }), {
    query: t.Object({
      page: t.Optional(t.Number({ default: DEFAULT_PAGE })),
      limit: t.Optional(t.Number({ default: DEFAULT_LIMIT })),
      search: t.Optional(t.String()),
    }),
  });
```

**Why good:** named constants for all limits, `error` property on schema fields gives custom validation messages, response schemas per status code enable type narrowing, `t.Optional()` for non-required fields

### Bad Example - No Validation

```typescript
// BAD: No validation at all
new Elysia().post("/user", ({ body }) => {
  // body is unknown -- runtime crashes on bad input
  const name = body.name; // TypeError if body is not an object
  return { id: 1, name };
});
```

**Why bad:** no TypeBox schema means no validation, no type inference, crashes on malformed input

---

## Pattern 3: .derive() and .decorate()

### Good Example - Per-Request vs Singleton Context

```typescript
import { Elysia } from "elysia";

// Singleton service -- same instance for all requests
class DatabaseClient {
  query(sql: string) {
    return [];
  }
}
const db = new DatabaseClient();

const app = new Elysia({ name: "app" })
  // .decorate() for singletons (same for all requests)
  .decorate("db", db)
  // .derive() for per-request computed values
  .derive(({ headers }) => {
    const token = headers.authorization?.replace("Bearer ", "");
    return {
      userId: token ? decodeToken(token) : null,
    };
  })
  .get("/profile", ({ userId, db }) => {
    if (!userId) return { error: "Unauthorized" };
    return db.query(`SELECT * FROM users WHERE id = ${userId}`);
  });
```

**Why good:** `.decorate()` for the DB client (shared singleton), `.derive()` for userId (computed per request from headers), both are type-safe in route handlers

### Bad Example - Using .decorate() for Per-Request Data

```typescript
// BAD: decorate runs once, not per request
new Elysia()
  .decorate("currentUser", null) // Same null for ALL requests
  .get("/profile", ({ currentUser }) => currentUser); // Always null
```

**Why bad:** `.decorate()` evaluates once at setup time, all requests share the same value

---

## Pattern 4: Guard for Route Groups

### Good Example - Scoped Validation with Guard

```typescript
import { Elysia, t } from "elysia";

const app = new Elysia()
  // Public routes -- no auth required
  .get("/", () => "welcome")
  .get("/health", () => ({ status: "ok" }))
  // Protected routes -- all require auth header
  .guard(
    {
      headers: t.Object({
        authorization: t.TemplateLiteral("Bearer ${string}"),
      }),
    },
    (app) =>
      app
        .get("/dashboard", ({ headers }) => ({
          message: `Authenticated: ${headers.authorization}`,
        }))
        .get("/settings", () => ({ theme: "dark" }))
        .post("/settings", ({ body }) => body, {
          body: t.Object({
            theme: t.Union([t.Literal("dark"), t.Literal("light")]),
          }),
        }),
  );
```

**Why good:** auth validation defined once for the group, public routes outside guard are unaffected, route-specific body schema merges with guard schema (standalone mode in 1.4+)

---

## Pattern 5: .group() with Prefix

### Good Example - Versioned API Groups

```typescript
import { Elysia, t } from "elysia";

const app = new Elysia()
  .group("/api/v1", (app) =>
    app
      .get("/users", () => ({ version: 1, users: [] }))
      .post("/users", ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      }),
  )
  .group(
    "/api/v2",
    {
      // Guard schema applied to all routes in this group
      headers: t.Object({
        "x-api-key": t.String(),
      }),
    },
    (app) =>
      app
        .get("/users", () => ({ version: 2, users: [] }))
        .post("/users", ({ body }) => body, {
          body: t.Object({
            name: t.String(),
            metadata: t.Optional(t.Record(t.String(), t.String())),
          }),
        }),
  );
```

**Why good:** `.group()` with guard schema combines prefix + validation in one call, v2 group requires API key while v1 does not

---

## Pattern 6: Reference Models

### Good Example - Reusable Named Schemas

```typescript
import { Elysia, t } from "elysia";

const MIN_PASSWORD_LENGTH = 8;

// Define reusable models once
const app = new Elysia()
  .model({
    signIn: t.Object({
      username: t.String(),
      password: t.String({ minLength: MIN_PASSWORD_LENGTH }),
    }),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      createdAt: t.String({ format: "date-time" }),
    }),
  })
  // Reference by name -- string key maps to registered model
  .post("/sign-in", ({ body }) => authenticate(body), {
    body: "signIn",
    response: "user",
  })
  .post("/sign-up", ({ body }) => createUser(body), {
    body: "signIn",
    response: "user",
  });
```

**Why good:** `.model()` registers reusable schemas, reference by string key in route options, single source of truth for shared shapes, eliminates schema duplication across routes

---

## Pattern 7: Macro for Cross-Cutting Concerns

### Good Example - Auth Macro with Schema

```typescript
import { Elysia, t } from "elysia";

const HTTP_UNAUTHORIZED = 401;

const authPlugin = new Elysia({ name: "auth" }).macro({
  isSignedIn: {
    // Macro adds cookie validation automatically
    cookie: t.Object({
      session: t.String(),
    }),
    // resolve runs before handler, can short-circuit
    resolve({ cookie: { session }, status }) {
      if (!session.value) {
        return status(HTTP_UNAUTHORIZED, "Unauthorized");
      }
      return { userId: decodeSession(session.value) };
    },
  },
});

const app = new Elysia()
  .use(authPlugin)
  .get("/public", () => "hello")
  .get(
    "/profile",
    ({ userId }) => ({ userId }), // userId injected by macro
    { isSignedIn: true }, // Enable the macro for this route
  );
```

**Why good:** macros encapsulate cross-cutting concerns (auth, rate limiting) as declarative flags on routes, schema and resolve are bundled together, `isSignedIn: true` is self-documenting in route options
