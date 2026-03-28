# tRPC Middleware Patterns

> Middleware for logging, rate limiting, and access control. See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand Pattern 1 (Router Setup) from core examples first.

---

## Logging Middleware

```typescript
// packages/api/src/trpc/middleware/logging.ts
import { middleware } from "../index";

const REQUEST_SLOW_THRESHOLD_MS = 1000;

export const loggingMiddleware = middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (durationMs > REQUEST_SLOW_THRESHOLD_MS) {
    console.warn(`Slow ${type} ${path}: ${durationMs}ms`);
  }

  return result;
});

// Named export
export { loggingMiddleware };
```

---

## Rate Limiting Middleware

```typescript
// packages/api/src/trpc/middleware/rate-limit.ts
import { TRPCError } from "@trpc/server";
import { middleware } from "../index";

const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Use your rate limiting solution (e.g., in-memory, Redis-backed, or a managed service)
// This example uses a simple in-memory store for illustration
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): {
  success: boolean;
  resetAt: number;
} {
  const now = Date.now();
  const entry = requestCounts.get(identifier);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
    });
    return { success: true, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_REQUESTS) {
    return { success: false, resetAt: entry.resetAt };
  }

  return { success: true, resetAt: entry.resetAt };
}

export const rateLimitMiddleware = middleware(async ({ ctx, next }) => {
  const identifier = ctx.user?.id ?? ctx.ip ?? "anonymous";
  const { success, resetAt } = checkRateLimit(identifier);

  if (!success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${Math.ceil((resetAt - Date.now()) / 1000)} seconds`,
    });
  }

  return next();
});

// Named export
export { rateLimitMiddleware };
```

---

## Organization-Scoped Access

```typescript
// packages/api/src/trpc/middleware/org-access.ts
import { TRPCError } from "@trpc/server";
import { middleware, protectedProcedure } from "../index";

// Middleware that validates org membership
// v11: rawInput changed to getRawInput() (async function)
const withOrgAccess = middleware(async ({ ctx, getRawInput, next }) => {
  const input = (await getRawInput()) as { orgId: string };

  if (!input.orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "orgId is required",
    });
  }

  const membership = await ctx.db.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: ctx.user.id,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this organization",
    });
  }

  return next({
    ctx: {
      ...ctx,
      orgMembership: membership,
    },
  });
});

// Create org-scoped procedure
export const orgProcedure = protectedProcedure.use(withOrgAccess);

// Named export
export { orgProcedure };
```

---

## Bad Example - Checking Auth in Every Handler

```typescript
// BAD: Duplicated auth checks in every procedure
const postRouter = router({
  create: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" }); // Repeated!
    // ...
  }),
  update: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" }); // Repeated!
    // ...
  }),
  delete: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" }); // Repeated!
    // ...
  }),
});
```

**Why bad:** Duplicated auth logic is error-prone (easy to forget), no TypeScript narrowing (ctx.user still nullable), middleware provides compile-time safety

---
