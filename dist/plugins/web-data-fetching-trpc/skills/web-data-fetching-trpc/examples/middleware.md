# tRPC — Middleware Examples

> Logging, rate limiting and scoped access. See [core.md](core.md) for initialization.

**Prerequisites**: Pattern 1 (initialization and context) from core.

---

## Logging

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
```

`next()` is awaited, so the timing brackets the whole downstream chain including the handler — which
is what makes this measure the procedure rather than the middleware.

---

## Rate limiting

```typescript
// packages/api/src/trpc/middleware/rate-limit.ts
import { TRPCError } from "@trpc/server";
import { middleware } from "../index";

const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// An in-memory counter, to keep the example self-contained. A real deployment needs a shared
// store, or each server process enforces its own separate limit.
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
```

The identifier falls back through user, then address, then a shared bucket — so an authenticated
user keeps their own allowance across devices while anonymous traffic shares one.

---

## Scoping access to a resource

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

export const orgProcedure = protectedProcedure.use(withOrgAccess);
```

Composing onto `protectedProcedure` rather than `publicProcedure` is what lets this middleware read
`ctx.user.id` without a null check — the layer below already narrowed it. And because the membership
is returned through `next({ ctx })`, every procedure built on `orgProcedure` gets it typed, without
a second lookup.

`getRawInput()` is used because a middleware runs before the procedure's own `.input()` parses, so
the value is unvalidated — hence the explicit `orgId` check rather than trusting the cast.
