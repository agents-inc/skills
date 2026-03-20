# Elysia - WebSocket & Testing Examples

> WebSocket patterns and unit testing approaches. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route definitions and validation from core examples first.

---

## Pattern 1: Basic WebSocket

### Good Example - Echo Server with Validation

```typescript
import { Elysia, t } from "elysia";

const app = new Elysia().ws("/ws", {
  // Validate incoming messages with TypeBox
  body: t.Object({
    type: t.Union([t.Literal("chat"), t.Literal("ping")]),
    content: t.String(),
  }),
  // Validate query params on initial connection
  query: t.Object({
    room: t.String(),
  }),
  open(ws) {
    const { room } = ws.data.query;
    ws.subscribe(room);
    ws.send({ event: "joined", room });
  },
  message(ws, { type, content }) {
    // message is already validated and typed
    if (type === "ping") {
      ws.send({ event: "pong" });
      return;
    }
    // Publish to all subscribers in the room
    const { room } = ws.data.query;
    ws.publish(room, { event: "message", content, room });
  },
  close(ws) {
    const { room } = ws.data.query;
    ws.unsubscribe(room);
  },
});
```

**Why good:** `body` schema validates every incoming message (invalid messages are rejected), `query` validates connection params, `ws.subscribe`/`ws.publish` for pub/sub channels, destructured `message` params are fully typed

### Bad Example - No Validation

```typescript
// BAD: No message validation
new Elysia().ws("/ws", {
  message(ws, message) {
    // message is unknown -- could be anything
    ws.send(JSON.stringify({ echo: message }));
  },
});
```

**Why bad:** no TypeBox schema means unvalidated input, `message` type is unknown, crashes on unexpected payloads

---

## Pattern 2: WebSocket with Derive

### Good Example - Auth in WebSocket

```typescript
import { Elysia, t } from "elysia";

const HTTP_UNAUTHORIZED = 401;

const wsApp = new Elysia()
  .derive(({ headers, status }) => {
    const token = headers.authorization?.replace("Bearer ", "");
    if (!token) return status(HTTP_UNAUTHORIZED, "Missing auth");
    return { userId: decodeToken(token) };
  })
  .ws("/notifications", {
    body: t.Object({
      type: t.Literal("subscribe"),
      channel: t.String(),
    }),
    open(ws) {
      // userId is available from derive
      const { userId } = ws.data;
      ws.subscribe(`user:${userId}`);
    },
    message(ws, { channel }) {
      const { userId } = ws.data;
      ws.subscribe(`${channel}:${userId}`);
    },
  });
```

**Why good:** `.derive()` runs before the WebSocket upgrade, auth happens at connection time (not per message), `ws.data` carries the derived context

---

## Pattern 3: Unit Testing with .handle()

### Good Example - Testing Without Network

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";

const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;

// Create app instance (no .listen() needed for tests)
const app = new Elysia()
  .get("/hello", () => "world")
  .post("/user", ({ body }) => ({ id: 1, ...body }), {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: "email" }),
    }),
  })
  .get(
    "/user/:id",
    ({ params: { id }, status }) => {
      if (id === 0) return status(HTTP_NOT_FOUND, { error: "Not found" });
      return { id, name: "Alice" };
    },
    {
      params: t.Object({ id: t.Number() }),
    },
  );

describe("API Routes", () => {
  it("GET /hello returns world", async () => {
    // IMPORTANT: Must use fully qualified URL
    const response = await app.handle(new Request("http://localhost/hello"));
    const text = await response.text();
    expect(text).toBe("world");
  });

  it("POST /user creates user", async () => {
    const response = await app.handle(
      new Request("http://localhost/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Alice",
          email: "alice@example.com",
        }),
      }),
    );
    const data = await response.json();
    expect(data.id).toBe(1);
    expect(data.name).toBe("Alice");
  });

  it("POST /user rejects invalid email", async () => {
    const response = await app.handle(
      new Request("http://localhost/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Alice",
          email: "not-an-email",
        }),
      }),
    );
    expect(response.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
  });

  it("GET /user/0 returns 404", async () => {
    const response = await app.handle(new Request("http://localhost/user/0"));
    expect(response.status).toBe(HTTP_NOT_FOUND);
  });
});
```

**Why good:** `.handle()` processes the full lifecycle (validation, hooks, handler) without starting an HTTP server, fully qualified URLs are required (not path fragments), tests run fast with no network overhead

> **Note:** `.handle()` requires a fully qualified URL (`http://localhost/path`), not a path fragment (`/path`). See [reference.md](../reference.md) for the anti-pattern.

For type-safe testing with Eden Treaty (no HTTP server needed), see [eden-treaty.md Pattern 5](eden-treaty.md#pattern-5-treaty-unit-testing-no-network).

---

## Pattern 4: Testing with Async Plugins

### Good Example - Awaiting Lazy-Loaded Modules

```typescript
import { describe, expect, it, beforeAll } from "bun:test";
import { Elysia } from "elysia";

// App with lazy-loaded plugin
const app = new Elysia()
  .use(import("./user-plugin"))
  .use(import("./health-plugin"));

describe("App with lazy plugins", () => {
  beforeAll(async () => {
    // REQUIRED: Wait for all async plugins to resolve
    await app.modules;
  });

  it("responds to lazy-loaded routes", async () => {
    const response = await app.handle(new Request("http://localhost/user/1"));
    expect(response.status).toBe(200);
  });
});
```

**Why good:** `await app.modules` resolves all lazy-loaded plugins before tests run, without this line, routes from async plugins may not be registered yet

---

## Pattern 5: Testing Lifecycle Hooks

### Good Example - Verifying Hook Behavior

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";

const HTTP_UNAUTHORIZED = 401;

const app = new Elysia()
  .derive(({ headers }) => ({
    apiKey: headers["x-api-key"] ?? null,
  }))
  .onBeforeHandle(({ apiKey, status }) => {
    if (!apiKey) return status(HTTP_UNAUTHORIZED, "Missing API key");
  })
  .get("/protected", ({ apiKey }) => ({ key: apiKey }));

describe("Auth lifecycle", () => {
  it("rejects requests without API key", async () => {
    const response = await app.handle(
      new Request("http://localhost/protected"),
    );
    expect(response.status).toBe(HTTP_UNAUTHORIZED);
  });

  it("accepts requests with API key", async () => {
    const response = await app.handle(
      new Request("http://localhost/protected", {
        headers: { "x-api-key": "valid-key" },
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.key).toBe("valid-key");
  });
});
```

**Why good:** `.handle()` executes the full lifecycle including `.derive()` and `onBeforeHandle`, tests verify both the auth rejection and success paths, named constant for status code
