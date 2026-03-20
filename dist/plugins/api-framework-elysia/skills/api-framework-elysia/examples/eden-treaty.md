# Elysia - Eden Treaty Examples

> End-to-end type-safe client patterns. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand method chaining and `export type App` from core examples first.

---

## Pattern 1: Basic Eden Treaty Setup

### Good Example - Type-Safe Client

```typescript
// server.ts
import { Elysia, t } from "elysia";

const app = new Elysia()
  .get(
    "/user/:id",
    ({ params: { id } }) => ({
      id,
      name: "Alice",
      email: "alice@example.com",
    }),
    {
      params: t.Object({ id: t.Number() }),
    },
  )
  .post(
    "/user",
    ({ body }) => ({
      id: crypto.randomUUID(),
      ...body,
    }),
    {
      body: t.Object({
        name: t.String(),
        email: t.String({ format: "email" }),
      }),
    },
  )
  .listen(3000);

export type App = typeof app;
```

```typescript
// client.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";

const api = treaty<App>("localhost:3000");

// GET /user/:id -- dynamic params use function syntax
const { data, error } = await api.user({ id: 42 }).get();

if (error) {
  // error is typed based on route's error responses
  console.error(error);
  return;
}
// data is typed as { id: number; name: string; email: string }
console.log(data.name);

// POST /user -- body passed as argument
const { data: created } = await api.user.post({
  name: "Bob",
  email: "bob@example.com",
});
```

**Why good:** zero code generation, paths and methods are fully typed via dot notation, dynamic params use function syntax (not bracket notation), `data`/`error` destructuring provides type narrowing

### Bad Example - Losing Type Safety

```typescript
// BAD: Using fetch instead of treaty
const response = await fetch("http://localhost:3000/user/42");
const data = await response.json(); // data is 'any'

// BAD: Wrong dynamic param syntax
const { data } = await api.user[42].get(); // This syntax doesn't work!
```

**Why bad:** raw `fetch` loses all type information, bracket notation doesn't work for dynamic params in Eden Treaty

---

## Pattern 2: Response Handling

### Good Example - Error/Data Type Narrowing

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";

const api = treaty<App>("localhost:3000");

async function getUser(id: number) {
  const { data, error, status } = await api.user({ id }).get();

  // When status >= 300: data is null, error has the value
  // When status < 300: error is null, data has the value
  if (error) {
    switch (error.status) {
      case 404:
        console.log("User not found");
        break;
      case 500:
        console.log("Server error:", error.value);
        break;
    }
    return null;
  }

  // TypeScript knows data is non-null here
  return data;
}
```

**Why good:** Eden Treaty splits responses into `data` (success) and `error` (failure) with proper type narrowing, `error.status` enables exhaustive handling by status code

---

## Pattern 3: File Upload via Treaty

### Good Example - Multipart Upload

```typescript
// server.ts
import { Elysia, t } from "elysia";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const app = new Elysia().post(
  "/upload",
  ({ body }) => ({
    name: body.file.name,
    size: body.file.size,
  }),
  {
    body: t.Object({
      file: t.File({ maxSize: MAX_FILE_SIZE_BYTES }),
      description: t.Optional(t.String()),
    }),
  },
);

export type App = typeof app;
```

```typescript
// client.ts
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";

const api = treaty<App>("localhost:3000");

// Eden Treaty handles FormData conversion automatically
const { data } = await api.upload.post({
  file: new File(["content"], "readme.txt"),
  description: "A text file",
});
```

**Why good:** `t.File()` auto-detects multipart content type, Eden Treaty converts the object to FormData automatically, file validation (max size) runs server-side

---

## Pattern 4: Treaty with Headers and Auth

### Good Example - Custom Headers per Request

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "./server";

// Set default headers for all requests
const api = treaty<App>("localhost:3000", {
  headers: {
    "x-api-version": "1",
  },
});

// Override headers per request using $headers
const { data } = await api.profile.get({
  $headers: {
    authorization: `Bearer ${token}`,
  },
});
```

**Why good:** treaty config sets baseline headers, `$headers` in request options overrides per-call, headers are type-checked if the route has a `headers` schema

---

## Pattern 5: Treaty Unit Testing (No Network)

### Good Example - Direct Instance Testing

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";
import { treaty } from "@elysiajs/eden";

const app = new Elysia()
  .get("/hello", () => "hi")
  .get("/user/:id", ({ params: { id } }) => ({ id, name: "Test" }), {
    params: t.Object({ id: t.Number() }),
  });

// Pass Elysia instance directly -- no HTTP server started
const api = treaty(app);

describe("User API", () => {
  it("returns greeting", async () => {
    const { data } = await api.hello.get();
    expect(data).toBe("hi");
  });

  it("returns user by id", async () => {
    const { data } = await api.user({ id: 1 }).get();
    expect(data?.name).toBe("Test");
  });
});
```

**Why good:** passing the Elysia instance directly to `treaty()` bypasses HTTP -- tests run without starting a server, full type safety and lifecycle hooks still execute, faster than network-based tests
