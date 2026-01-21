# Nuxt 3 - Server Routes Examples

> API routes with defineEventHandler, validation, and error handling. See [SKILL.md](../SKILL.md) for core concepts.

---

## Basic Server Routes

### Good Example - GET Route with Query Parameters

```typescript
// server/api/users.get.ts
import type { H3Event } from 'h3'

interface User {
  id: string
  name: string
  email: string
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default defineEventHandler(async (event: H3Event): Promise<{ data: User[]; total: number }> => {
  const query = getQuery(event)

  const page = Math.max(DEFAULT_PAGE, Number(query.page) || DEFAULT_PAGE)
  const limit = Math.min(MAX_LIMIT, Number(query.limit) || DEFAULT_LIMIT)
  const offset = (page - 1) * limit

  // Query your database
  const users = await db.users.findMany({
    skip: offset,
    take: limit
  })

  const total = await db.users.count()

  return { data: users, total }
})
```

**Why good:** File suffix `.get.ts` restricts to GET method, named constants for defaults, Math.min/max for safe bounds, typed return value

### Bad Example - No Validation

```typescript
// WRONG - No input validation
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  // User could pass limit=999999
  const users = await db.users.findMany({ take: query.limit })
  return users
})
```

**Why bad:** No limit cap allows DoS via huge queries, no type safety, no pagination metadata

---

## POST Route with Body Validation

### Good Example - Create Resource with Zod

```typescript
// server/api/users.post.ts
import { z } from 'zod'

const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const MIN_NAME_LENGTH = 1
const MAX_NAME_LENGTH = 100

const CreateUserSchema = z.object({
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH),
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = CreateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: 'Validation failed',
      data: result.error.flatten()
    })
  }

  const user = await db.users.create({
    data: result.data
  })

  setResponseStatus(event, HTTP_CREATED)
  return user
})
```

**Why good:** Zod validates input, safeParse for typed errors, createError for HTTP errors, setResponseStatus for 201 Created

---

## Dynamic Route Parameters

### Good Example - GET Single Resource

```typescript
// server/api/users/[id].get.ts
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: 'User ID required'
    })
  }

  const user = await db.users.findUnique({
    where: { id }
  })

  if (!user) {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: 'User not found'
    })
  }

  return user
})
```

**Why good:** getRouterParam extracts dynamic segment, validation before database query, proper HTTP status codes

---

## PUT/PATCH Routes

### Good Example - Update Resource

```typescript
// server/api/users/[id].put.ts
import { z } from 'zod'

const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const MIN_NAME_LENGTH = 1
const MAX_NAME_LENGTH = 100

const UpdateUserSchema = z.object({
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH).optional(),
  email: z.string().email().optional()
}).refine(data => data.name || data.email, {
  message: 'At least one field required'
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: 'User ID required'
    })
  }

  const body = await readBody(event)
  const result = UpdateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: 'Validation failed',
      data: result.error.flatten()
    })
  }

  try {
    const user = await db.users.update({
      where: { id },
      data: result.data
    })
    return user
  } catch {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: 'User not found'
    })
  }
})
```

**Why good:** Optional fields with refine ensures at least one, try/catch for database errors, proper file naming for PUT method

---

## DELETE Routes

### Good Example - Delete Resource

```typescript
// server/api/users/[id].delete.ts
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_NO_CONTENT = 204

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: HTTP_BAD_REQUEST,
      statusMessage: 'User ID required'
    })
  }

  try {
    await db.users.delete({
      where: { id }
    })

    setResponseStatus(event, HTTP_NO_CONTENT)
    return null
  } catch {
    throw createError({
      statusCode: HTTP_NOT_FOUND,
      statusMessage: 'User not found'
    })
  }
})
```

**Why good:** 204 No Content for successful delete, returns null (no body), catches not-found case

---

## Catch-All Routes

### Good Example - Proxy Route

```typescript
// server/api/proxy/[...path].ts
export default defineEventHandler(async (event) => {
  const path = event.context.params?.path || ''
  const method = event.method

  const headers: HeadersInit = {}

  // Forward auth header if present
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    headers['Authorization'] = authHeader
  }

  const response = await $fetch(`https://external-api.com/v1/${path}`, {
    method,
    headers,
    // Forward body for POST/PUT/PATCH
    ...(method !== 'GET' && method !== 'DELETE' && {
      body: await readBody(event)
    })
  })

  return response
})
```

**Why good:** Catch-all with [...path], forwards method and auth, conditionally includes body

---

## Server Middleware

### Good Example - Auth Middleware

```typescript
// server/middleware/auth.ts
const HTTP_UNAUTHORIZED = 401
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register', '/api/health']

export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip public routes
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return
  }

  // Skip non-API routes
  if (!path.startsWith('/api')) {
    return
  }

  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')

  if (!token) {
    throw createError({
      statusCode: HTTP_UNAUTHORIZED,
      statusMessage: 'Authentication required'
    })
  }

  // Validate token and attach user to context
  const user = await validateToken(token)

  if (!user) {
    throw createError({
      statusCode: HTTP_UNAUTHORIZED,
      statusMessage: 'Invalid token'
    })
  }

  // Attach to event context for route handlers
  event.context.user = user
})
```

**Why good:** Middleware runs before all routes, skips public paths, attaches user to context for downstream handlers

### Usage in Route Handler

```typescript
// server/api/profile.get.ts
export default defineEventHandler((event) => {
  // User attached by middleware
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email
  }
})
```

---

## Error Handling

### Good Example - Structured Error Response

```typescript
// server/utils/errors.ts
interface AppErrorOptions {
  statusCode: number
  message: string
  code?: string
  data?: unknown
}

export function throwAppError(options: AppErrorOptions): never {
  throw createError({
    statusCode: options.statusCode,
    statusMessage: options.message,
    data: {
      code: options.code ?? 'UNKNOWN_ERROR',
      details: options.data
    }
  })
}
```

```typescript
// Usage in route
// server/api/orders/[id].get.ts
import { throwAppError } from '~/server/utils/errors'

const HTTP_NOT_FOUND = 404
const HTTP_FORBIDDEN = 403

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = event.context.user

  const order = await db.orders.findUnique({
    where: { id }
  })

  if (!order) {
    throwAppError({
      statusCode: HTTP_NOT_FOUND,
      message: 'Order not found',
      code: 'ORDER_NOT_FOUND'
    })
  }

  if (order.userId !== user.id) {
    throwAppError({
      statusCode: HTTP_FORBIDDEN,
      message: 'Access denied',
      code: 'ACCESS_DENIED'
    })
  }

  return order
})
```

**Why good:** Consistent error structure, reusable utility, error codes for client handling

---

## Quick Reference

| File Pattern | HTTP Method | URL |
|--------------|-------------|-----|
| `users.get.ts` | GET | /api/users |
| `users.post.ts` | POST | /api/users |
| `users/[id].get.ts` | GET | /api/users/:id |
| `users/[id].put.ts` | PUT | /api/users/:id |
| `users/[id].delete.ts` | DELETE | /api/users/:id |
| `users/[...path].ts` | ALL | /api/users/* |
| `users.ts` | ALL | /api/users |

| Utility | Purpose |
|---------|---------|
| `getQuery(event)` | Parse query parameters |
| `readBody(event)` | Parse request body |
| `getRouterParam(event, 'name')` | Get route parameter |
| `getHeader(event, 'name')` | Get request header |
| `setResponseStatus(event, code)` | Set response status |
| `createError({ statusCode, ... })` | Throw HTTP error |
