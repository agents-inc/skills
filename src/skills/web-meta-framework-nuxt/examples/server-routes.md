# Nuxt — Server Routes

> Handlers, validation, server middleware and error utilities. The file-to-URL table and the request
> utilities are in [reference.md](../reference.md).

---

## Basic Server Routes

### Good Example - GET Route with Query Parameters

```typescript
// server/api/users.get.ts
import type { H3Event } from "h3";

interface User {
  id: string;
  name: string;
  email: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default defineEventHandler(
  async (event: H3Event): Promise<{ data: User[]; total: number }> => {
    const query = getQuery(event);

    const page = Math.max(DEFAULT_PAGE, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Number(query.limit) || DEFAULT_LIMIT);
    const offset = (page - 1) * limit;

    // Query your database
    const users = await db.users.findMany({
      skip: offset,
      take: limit,
    });

    const total = await db.users.count();

    return { data: users, total };
  },
);
```

**Why good:** The `.get.ts` suffix is what makes any other method a 405 rather than a silent match,
and clamping `limit` between named bounds means a caller cannot ask for the whole table.

### Bad Example — no bounds on the query

```typescript
// WRONG - No input validation
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  // User could pass limit=999999
  const users = await db.users.findMany({ take: query.limit });
  return users;
});
```

**Why bad:** `limit=999999` returns the whole table, `query.limit` is `unknown` so nothing type-checks
the value it passes on, and the caller gets no total to paginate against.

---

## POST Route with Body Validation

### Good Example — create a resource

```typescript
// server/api/users.post.ts
import { CreateUserSchema } from "~/server/schemas/user"; // your schema validation library

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const result = CreateUserSchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: "Validation failed",
      data: result.error.issues,
    });
  }

  const user = await db.users.create({
    data: result.data,
  });

  setResponseStatus(event, HTTP_CREATED);
  return user;
});
```

**Why good:** `readBody` returns `unknown`, and the parse is what turns it into something typed —
everything after the guard works on `result.data` rather than on the raw body. The failure carries
the field-level issues, so the client can show them inline.

---

## Dynamic Route Parameters

### Good Example — GET a single resource

```typescript
// server/api/users/[id].get.ts
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: "User ID required",
    });
  }

  const user = await db.users.findUnique({
    where: { id },
  });

  if (!user) {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: "User not found",
    });
  }

  return user;
});
```

**Why good:** The missing-id and missing-row cases get different status codes, so the client can tell
a malformed request from an absent resource.

---

## PUT/PATCH Routes

### Good Example — update a resource

```typescript
// server/api/users/[id].put.ts
// UpdateUserSchema makes every field optional and refuses an empty body
import { UpdateUserSchema } from "~/server/schemas/user";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: "User ID required",
    });
  }

  const body = await readBody(event);
  const result = UpdateUserSchema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: "Validation failed",
      data: result.error.issues,
    });
  }

  try {
    const user = await db.users.update({
      where: { id },
      data: result.data,
    });
    return user;
  } catch {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: "User not found",
    });
  }
});
```

**Why good:** A partial update with every field optional still refuses an empty body, and the `catch`
turns a missing row into a 404 rather than a 500.

---

## DELETE Routes

### Good Example — delete a resource

```typescript
// server/api/users/[id].delete.ts
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_NO_CONTENT = 204;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: "User ID required",
    });
  }

  try {
    await db.users.delete({
      where: { id },
    });

    setResponseStatus(event, HTTP_NO_CONTENT);
    return null;
  } catch {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: "User not found",
    });
  }
});
```

**Why good:** 204 is the status for a successful delete with nothing to return, and returning `null`
keeps the body empty as that status requires.

---

## Catch-All Routes

### Good Example — a proxy route

```typescript
// server/api/proxy/[...path].ts
export default defineEventHandler(async (event) => {
  const path = event.context.params?.path || "";
  const method = event.method;

  const headers: HeadersInit = {};

  // Forward auth header if present
  const authHeader = getHeader(event, "authorization");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const response = await $fetch(`https://external-api.com/v1/${path}`, {
    method,
    headers,
    // Forward body for POST/PUT/PATCH
    ...(method !== "GET" &&
      method !== "DELETE" && {
        body: await readBody(event),
      }),
  });

  return response;
});
```

**Why good:** One handler covers every path under the prefix, and the body is only read for the
methods that carry one — `readBody` on a GET throws.

---

## Server Middleware

### Good Example — auth middleware

```typescript
// server/middleware/auth.ts
const HTTP_UNAUTHORIZED = 401;
const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register", "/api/health"];

export default defineEventHandler(async (event) => {
  const path = event.path;

  // Skip public routes
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return;
  }

  // Skip non-API routes
  if (!path.startsWith("/api")) {
    return;
  }

  const token = getHeader(event, "authorization")?.replace("Bearer ", "");

  if (!token) {
    throw createError({
      statusCode: HTTP_UNAUTHORIZED,
      statusMessage: "Authentication required",
    });
  }

  // Validate token and attach user to context
  const user = await validateToken(token);

  if (!user) {
    throw createError({
      statusCode: HTTP_UNAUTHORIZED,
      statusMessage: "Invalid token",
    });
  }

  // Attach to event context for route handlers
  event.context.user = user;
});
```

**Why good:** Every route is protected by default and the exceptions are listed in one place, so a new
endpoint is guarded the moment it exists. `event.context` is request-scoped, which is what makes it
safe to hang the user off.

### Usage in Route Handler

```typescript
// server/api/profile.get.ts
export default defineEventHandler((event) => {
  // User attached by middleware
  const user = event.context.user;

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Not authenticated",
    });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
});
```

---

## Error Handling

### Good Example - Structured Error Response

```typescript
// server/utils/errors.ts
interface AppErrorOptions {
  statusCode: number;
  message: string;
  code?: string;
  data?: unknown;
}

export function throwAppError(options: AppErrorOptions): never {
  throw createError({
    statusCode: options.statusCode,
    statusMessage: options.message,
    data: {
      code: options.code ?? "UNKNOWN_ERROR",
      details: options.data,
    },
  });
}
```

```typescript
// Usage in route
// server/api/orders/[id].get.ts
import { throwAppError } from "~/server/utils/errors";

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const user = event.context.user;

  const order = await db.orders.findUnique({
    where: { id },
  });

  if (!order) {
    throwAppError({
      statusCode: HTTP_NOT_FOUND,
      message: "Order not found",
      code: "ORDER_NOT_FOUND",
    });
  }

  if (order.userId !== user.id) {
    throwAppError({
      statusCode: HTTP_FORBIDDEN,
      message: "Access denied",
      code: "ACCESS_DENIED",
    });
  }

  return order;
});
```

**Why good:** A stable machine-readable `code` alongside the human message means the client can branch
on the failure without matching on English text. The `never` return type lets the compiler see that
nothing after the call runs.

---

_The file-to-URL table, the request utilities and the server-route checklist are in
[reference.md](../reference.md)._
