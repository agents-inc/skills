# Hono + OpenAPI - Advanced v4.x Features

> RPC client, Context Storage, Combine Middleware, and other v4.x features. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand route definition patterns from core examples first.

---

## Pattern 1: RPC Client (hc) with End-to-End Type Safety

**Since Hono v4.x** - Share type-safe API specifications between server and client without code generation.

### Server Setup

```typescript
// /app/api/[[...route]]/route.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { handle } from "hono/vercel";

const app = new OpenAPIHono().basePath("/api");

// Chain route definitions for proper type inference
const routes = app
  .openapi(
    createRoute({
      method: "get",
      path: "/users/{id}",
      operationId: "getUserById",
      request: {
        params: z.object({ id: z.string() }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: "User details",
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      return c.json({ id, name: "John Doe" }, 200);
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/users",
      operationId: "createUser",
      request: {
        body: {
          content: {
            "application/json": { schema: z.object({ name: z.string() }) },
          },
        },
      },
      responses: {
        201: {
          content: {
            "application/json": {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: "Created user",
        },
      },
    }),
    async (c) => {
      const { name } = c.req.valid("json");
      return c.json({ id: crypto.randomUUID(), name }, 201);
    },
  );

// REQUIRED: Export app type for RPC client
export type AppType = typeof routes;

// Named exports for Next.js
export { app };
export const GET = handle(app);
export const POST = handle(app);
```

**Why good:** Chained route definitions enable full type inference, AppType export shares types without code generation

**TypeScript Requirement:** Both client and server `tsconfig.json` must have `"strict": true` in `compilerOptions` for proper type inference in monorepos.

### Client Usage

```typescript
// /lib/api-client.ts
import { hc } from "hono/client";
import type { AppType } from "@/app/api/[[...route]]/route";
import type { InferRequestType, InferResponseType } from "hono/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Create type-safe client
export const apiClient = hc<AppType>(API_BASE_URL);

// Type-safe request/response types (for use with React Query, etc.)
type GetUserRequest = InferRequestType<
  (typeof apiClient.api.users)[":id"]["$get"]
>;
type GetUserResponse = InferResponseType<
  (typeof apiClient.api.users)[":id"]["$get"]
>;

// Usage in component
async function fetchUser(id: string) {
  const res = await apiClient.api.users[":id"].$get({
    param: { id },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status}`);
  }

  // Type-safe response
  const user = await res.json();
  return user; // type: { id: string; name: string }
}

// Create user with type-safe body
async function createUser(name: string) {
  const res = await apiClient.api.users.$post({
    json: { name },
  });

  if (!res.ok) {
    throw new Error(`Failed to create user: ${res.status}`);
  }

  return res.json();
}
```

**Why good:** Full type safety without code generation, InferRequestType/InferResponseType enable type extraction for React Query

### Typed URL Feature (v4.11.0+)

```typescript
import { hc } from "hono/client";
import type { AppType } from "@/app/api/[[...route]]/route";

const API_BASE_URL = "http://localhost:3000";

// Pass base URL as second type parameter for precise URL types
const client = hc<AppType, typeof API_BASE_URL>(API_BASE_URL);

// URL is now precisely typed for SWR keys
const url = client.api.users[":id"].$url({ param: { id: "123" } });
// Type: URL with precise path type for caching libraries
```

**Why good:** Enables type-safe URL keys for caching libraries like SWR

---

## Pattern 2: Context Storage (v4.6.0+)

**Access context outside of handlers** - Useful for accessing Cloudflare Workers bindings, typed variables, etc.

### Basic Setup

```typescript
// /app/api/[[...route]]/route.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { contextStorage, getContext } from "hono/context-storage";

type Env = {
  Variables: {
    userId: string;
    requestId: string;
  };
  Bindings: {
    DATABASE: D1Database; // Cloudflare D1
    KV: KVNamespace; // Cloudflare KV
  };
};

const app = new OpenAPIHono<Env>();

// Enable context storage middleware
app.use(contextStorage());

// Set variables in another middleware
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});
```

**Why good:** contextStorage() enables getContext() access anywhere in the call stack

### Accessing Context Outside Handlers

```typescript
// /lib/database.ts
import { getContext } from "hono/context-storage";

type Env = {
  Bindings: { DATABASE: D1Database };
  Variables: { requestId: string };
};

// Access context in utility functions (outside route handlers)
export async function getUser(id: string) {
  const ctx = getContext<Env>();

  // Access Cloudflare bindings
  const db = ctx.env.DATABASE;

  // Access typed variables
  const requestId = ctx.var.requestId;

  console.log(`[${requestId}] Fetching user ${id}`);

  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
}
```

**Why good:** getContext() provides typed access to bindings and variables in any function

### tryGetContext (v4.11.0+)

```typescript
import { tryGetContext } from "hono/context-storage";

type Env = {
  Variables: { userId: string };
};

// Returns undefined instead of throwing when context unavailable
export function getOptionalUserId(): string | undefined {
  const ctx = tryGetContext<Env>();

  // Safe to use without try/catch
  return ctx?.var.userId;
}

// Use in code that may run outside request context
export function logWithContext(message: string) {
  const ctx = tryGetContext<Env>();

  if (ctx) {
    console.log(`[User: ${ctx.var.userId}] ${message}`);
  } else {
    console.log(message);
  }
}
```

**Why good:** tryGetContext() is safer for code paths that may run outside request context (tests, background jobs)

---

## Pattern 3: Combine Middleware (some/every/except)

**Complex middleware composition** - Build sophisticated access control with `some`, `every`, and `except`.

### some - First Successful Middleware Wins

```typescript
import { some } from "hono/combine";
import { bearerAuth } from "hono/bearer-auth";

const VALID_API_KEY = process.env.API_KEY!;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS = 100;

// Skip rate limiting if client has valid token
app.use(
  "/api/*",
  some(
    // If bearer auth succeeds, rate limiting is skipped
    bearerAuth({ token: VALID_API_KEY }),
    // Otherwise, apply rate limiting
    rateLimitMiddleware,
  ),
);
```

**Why good:** Premium API key holders skip rate limits, anonymous users get rate limited

### every - All Middleware Must Succeed

```typescript
import { every } from "hono/combine";
import { bearerAuth } from "hono/bearer-auth";
import { ipRestriction, getConnInfo } from "hono/ip-restriction";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;
const ALLOWED_ADMIN_IPS = ["192.168.1.100", "10.0.0.1"];

// Both IP restriction AND bearer auth must pass
app.use(
  "/api/admin/*",
  every(
    ipRestriction(getConnInfo, { allowList: ALLOWED_ADMIN_IPS }),
    bearerAuth({ token: ADMIN_API_KEY }),
  ),
);
```

**Why good:** Defense in depth - both network location AND credentials required for admin routes

### except - Apply Middleware to All Except Specific Paths

```typescript
import { except } from "hono/combine";
import { bearerAuth } from "hono/bearer-auth";

const API_KEY = process.env.API_KEY!;

// Apply auth to all API routes EXCEPT public endpoints
app.use(
  "/api/*",
  except(
    // Paths to exclude from auth
    ["/api/health", "/api/public/*", "/api/docs"],
    // Middleware to apply to everything else
    bearerAuth({ token: API_KEY }),
  ),
);
```

**Why good:** Clean exception handling without duplicating middleware registration

### Complex Access Control

```typescript
import { some, every, except } from "hono/combine";
import { bearerAuth } from "hono/bearer-auth";
import { ipRestriction, getConnInfo } from "hono/ip-restriction";

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN!;
const EXTERNAL_TOKEN = process.env.EXTERNAL_TOKEN!;
const INTERNAL_IPS = ["10.0.0.0/8", "192.168.0.0/16"];

// Complex rule: Allow access if EITHER:
// 1. Request is from internal network WITH valid internal token, OR
// 2. Request has valid external token (from anywhere)
app.use(
  "/api/*",
  except(
    ["/api/health", "/api/docs"],
    some(
      every(
        ipRestriction(getConnInfo, { allowList: INTERNAL_IPS }),
        bearerAuth({ token: INTERNAL_TOKEN }),
      ),
      bearerAuth({ token: EXTERNAL_TOKEN }),
    ),
  ),
);
```

**Why good:** Composable middleware rules replace complex if/else auth logic

---

## Pattern 4: Custom NotFoundResponse Type (v4.11.0+)

**Type-safe 404 responses** - Module augmentation for custom not found response typing.

```typescript
// /types/hono.d.ts
import { OpenAPIHono } from "@hono/zod-openapi";

// Augment the Hono module to type 404 responses
declare module "hono" {
  interface NotFoundResponse {
    error: "not_found";
    message: string;
    path: string;
  }
}
```

```typescript
// /app/api/[[...route]]/route.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const app = new OpenAPIHono();

// Now c.notFound() is typed
app.notFound((c) => {
  return c.json(
    {
      error: "not_found" as const,
      message: "Resource not found",
      path: c.req.path,
    },
    404,
  );
});

export type AppType = typeof app;
```

```typescript
// Client gets typed 404 response
const res = await client.api.users[":id"].$get({ param: { id: "unknown" } });

if (res.status === 404) {
  const error = await res.json();
  // Type: { error: "not_found"; message: string; path: string }
  console.log(error.path);
}
```

**Why good:** 404 responses are properly typed on the client side via module augmentation

---

## Pattern 5: Timing Utility (wrapTime - v4.11.0+)

**Simplified timing measurement** - Wrap async operations with automatic timing.

```typescript
import { timing, wrapTime } from "hono/timing";

const app = new OpenAPIHono();

// Enable timing headers
app.use(timing());

app.openapi(getJobsRoute, async (c) => {
  // wrapTime wraps an async function with timing measurement
  const fetchJobs = wrapTime(
    "db", // metric name
    async () => {
      return db.select().from(jobs).limit(100);
    },
    "Database query", // optional description
  );

  const jobs = await fetchJobs(c);

  return c.json({ jobs }, 200);
});
```

Response headers will include:

```
Server-Timing: db;dur=45.2;desc="Database query"
```

**Why good:** Cleaner syntax than manual startTime/setMetric pattern, automatic header generation

---

## Bad Example - Missing v4.x Features

```typescript
// BAD Example - Not using v4.x features
import { Hono } from "hono";

const app = new Hono();

// BAD: No AppType export for RPC
// BAD: Not chaining routes for type inference
app.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  return c.json({ id, name: "John" });
});

// BAD: Complex auth logic without combine middleware
app.use("/api/*", async (c, next) => {
  const token = c.req.header("Authorization");
  const ip = c.req.header("X-Forwarded-For");

  // BAD: Messy if/else auth logic
  if (token === process.env.ADMIN_TOKEN) {
    await next();
  } else if (INTERNAL_IPS.includes(ip || "")) {
    if (token === process.env.INTERNAL_TOKEN) {
      await next();
    } else {
      return c.json({ error: "Unauthorized" }, 401);
    }
  } else {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

// BAD: Accessing context with props drilling
app.get("/users", async (c) => {
  // BAD: Have to pass c to every utility function
  const users = await fetchUsers(c.env.DATABASE, c.get("requestId"));
  return c.json(users);
});

export default app;
```

**Why bad:** No RPC type safety, messy auth logic (use some/every/except), no context storage (prop drilling), default export breaks spec generation

---
