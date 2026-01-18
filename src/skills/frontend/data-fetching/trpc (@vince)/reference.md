# tRPC Type-Safe API - Reference

> Decision frameworks, anti-patterns, and integration guides. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use tRPC vs Alternatives

```
Need API for TypeScript monorepo?
├─ Is client TypeScript? (browser, Node, React Native)
│   ├─ YES → Is API public (third-party consumers)?
│   │   ├─ YES → Use OpenAPI/REST (need docs & polyglot support)
│   │   └─ NO → Use tRPC ✓
│   └─ NO → Use OpenAPI/REST (non-TS clients)
├─ Need GraphQL features? (partial queries, subscriptions at scale)
│   └─ YES → Use GraphQL (Apollo/urql)
└─ Need HTTP caching at CDN?
    └─ YES → Use REST (tRPC uses POST by default)
```

### Procedure Type Selection

```
What operation are you implementing?
├─ Reading data (GET semantics)?
│   └─ Use .query() ✓
├─ Writing/modifying data (POST/PUT/DELETE semantics)?
│   └─ Use .mutation() ✓
└─ Real-time updates?
    └─ Use .subscription() ✓
```

### Authentication Strategy

```
Need authentication?
├─ Session-based (cookies)?
│   └─ Extract session in createContext, use protectedProcedure
├─ Token-based (JWT in header)?
│   └─ Validate token in createContext, use protectedProcedure
├─ API key?
│   └─ Validate in middleware, throw UNAUTHORIZED on failure
└─ Public endpoints?
    └─ Use publicProcedure
```

### Error Handling Strategy

```
What type of error?
├─ Validation failure (bad input)?
│   └─ Let Zod throw - tRPC formats automatically
├─ Resource not found?
│   └─ throw new TRPCError({ code: "NOT_FOUND" })
├─ Permission denied?
│   └─ throw new TRPCError({ code: "FORBIDDEN" })
├─ Not authenticated?
│   └─ throw new TRPCError({ code: "UNAUTHORIZED" })
├─ Rate limited?
│   └─ throw new TRPCError({ code: "TOO_MANY_REQUESTS" })
└─ Unknown server error?
    └─ throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: originalError })
```

### Cache Invalidation Strategy

```
After mutation, what to invalidate?
├─ Single item changed?
│   └─ utils.router.procedure.invalidate({ id })
├─ List may have changed (create/delete)?
│   └─ utils.router.list.invalidate()
├─ Multiple related queries?
│   └─ utils.router.invalidate() // Invalidates all procedures in router
└─ Need immediate UI update?
    └─ Use optimistic update with onMutate
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Query (@tanstack/react-query)**: tRPC's React client is built on React Query, inheriting all caching, background refetching, and devtools
- **Zod**: First-class integration - input schemas provide runtime validation and TypeScript inference automatically
- **Next.js**: Adapters for both App Router and Pages Router with full SSR support
- **Prisma**: Common pairing in T3 Stack - Prisma types flow through tRPC to client
- **SuperJSON**: Serialize Date, Map, Set, BigInt across the wire with transformer option

**Replaces / Conflicts with:**

- **OpenAPI code generation (hey-api, openapi-typescript)**: tRPC eliminates need for schema files and generated code
- **GraphQL**: Provides similar DX without schema language overhead for TypeScript-only stacks
- **axios/fetch wrappers**: tRPC handles serialization, batching, and type safety

**Framework Adapters:**

- **Next.js App Router**: `@trpc/server/adapters/fetch`
- **Next.js Pages Router**: `@trpc/server/adapters/next`
- **Express**: `@trpc/server/adapters/express`
- **Fastify**: `@trpc/server/adapters/fastify`
- **AWS Lambda**: `@trpc/server/adapters/aws-lambda`

</integration>

---

<anti_patterns>

## Anti-Patterns

### Missing AppRouter Type Export

The entire point of tRPC is type inference. Without exporting AppRouter, clients have no type safety.

```typescript
// BAD: Type not exported - clients have no type inference
const appRouter = router({ user: userRouter });

// GOOD: Export type for client-side inference
export const appRouter = router({ user: userRouter });
export type AppRouter = typeof appRouter; // THIS IS ESSENTIAL
```

### Raw Error Objects Instead of TRPCError

Raw Error objects don't map to HTTP status codes and lack structured error handling.

```typescript
// BAD: Raw error has no code or HTTP mapping
throw new Error("User not found");

// GOOD: TRPCError maps to HTTP 404
throw new TRPCError({
  code: "NOT_FOUND",
  message: "User not found",
});
```

### No Input Validation

Procedures without Zod validation have `unknown` input type and no runtime safety.

```typescript
// BAD: input is unknown, no validation
publicProcedure.mutation(async ({ input }) => {
  // input.email could be anything - SQL injection risk!
  return ctx.db.user.create({ data: input as any });
});

// GOOD: Validated and typed input
publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    // input.email is guaranteed to be valid email string
    return ctx.db.user.create({ data: input });
  });
```

### Duplicated Auth Checks

Using if statements in every procedure instead of middleware wastes code and risks forgetting checks.

```typescript
// BAD: Repeated in every procedure
const router = router({
  create: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    // ...
  }),
  update: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    // ...
  }),
});

// GOOD: Use protectedProcedure with middleware
const router = router({
  create: protectedProcedure.mutation(({ ctx }) => {
    // ctx.user is guaranteed non-null by middleware
  }),
  update: protectedProcedure.mutation(({ ctx }) => {
    // ctx.user is guaranteed non-null by middleware
  }),
});
```

### Manual Type Definitions

Defining types manually defeats tRPC's automatic inference and causes type drift.

```typescript
// BAD: Manual type will drift from backend
interface User {
  id: string;
  name: string;
  // Missing fields that exist on backend!
}

// GOOD: Use inferred types
import type { RouterOutputs } from "@repo/api";
type User = RouterOutputs["user"]["getById"];
```

### Optimistic Updates Without Rollback

Optimistic updates must include rollback logic for error cases.

```typescript
// BAD: No rollback on error
onMutate: async () => {
  utils.todo.list.setData(undefined, (old) => [...(old ?? []), newTodo]);
  // Missing: snapshot and rollback!
};

// GOOD: Full optimistic pattern
onMutate: async () => {
  await utils.todo.list.cancel();
  const previous = utils.todo.list.getData();
  utils.todo.list.setData(undefined, (old) => [...(old ?? []), newTodo]);
  return { previous };
},
onError: (err, vars, ctx) => {
  if (ctx?.previous) utils.todo.list.setData(undefined, ctx.previous);
},
```

### Magic Numbers in Configuration

Using raw numbers instead of named constants violates project conventions.

```typescript
// BAD: What do these numbers mean?
staleTime: 300000,
retry: 3,

// GOOD: Self-documenting constants
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
staleTime: FIVE_MINUTES_MS,
retry: DEFAULT_RETRY_ATTEMPTS,
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing `export type AppRouter`** - Clients have no type inference, defeats purpose of tRPC
- **Raw `throw new Error()`** - Should use `TRPCError` with appropriate code for HTTP mapping
- **Procedures without `.input()` validation** - No runtime validation, TypeScript type is `unknown`
- **Auth checks in procedure body** - Should use middleware for protected/admin procedures
- **Magic numbers** - All timeout/retry values must be named constants

**Medium Priority Issues:**

- **Not using `import type`** - Type-only imports should use `import type` syntax
- **Missing transformer** - Without SuperJSON, Date/Map/Set won't serialize correctly
- **Transformer in wrong location (v11)** - In v11, transformer goes INSIDE `httpBatchLink()`, NOT at `createClient()` level
- **No error formatter** - Zod errors should be formatted for better client DX
- **Optimistic updates without rollback** - Must include `onError` handler to restore previous state
- **Default exports** - Should use named exports per project conventions

**Common Mistakes:**

- Forgetting to wrap tRPC provider around app
- Not canceling queries before optimistic update (`await utils.x.cancel()`)
- Using `retry: true` for mutations (should be `false` - don't retry writes)
- Missing `credentials: "include"` in httpBatchLink when using cookie auth
- Invalidating wrong query keys after mutation

**Gotchas & Edge Cases:**

- `httpBatchLink` combines requests - all batched requests share the same HTTP status
- SuperJSON transformer must be configured on BOTH client and server
- tRPC uses POST by default - won't benefit from HTTP caching without configuration
- Subscription reconnection must be handled client-side
- Query keys are automatically generated - use `getQueryKey()` if you need them explicitly
- Context is created per-request - don't store mutable state in context
- Middleware runs in order - auth middleware should come before rate limiting

</red_flags>

---

## tRPC v11 Migration Notes

### Breaking Changes from v10

1. **Transformer Location Changed** (CRITICAL):
   ```typescript
   // v10 (no longer works in v11)
   trpc.createClient({
     transformer: superjson, // WRONG - will cause error in v11
     links: [httpBatchLink({ url: '/api/trpc' })]
   })

   // v11 (correct - transformer INSIDE the link)
   trpc.createClient({
     links: [
       httpBatchLink({
         url: '/api/trpc',
         transformer: superjson, // CORRECT - inside httpBatchLink
       })
     ]
   })
   ```

2. **React Query v5 Required**: Update to `@tanstack/react-query@^5`
   - Replace `isLoading` with `isPending` throughout your code

3. **New TanStack Integration Package** (recommended):
   ```typescript
   // New v11 package for TanStack-native integration
   import { createTRPCContext } from "@trpc/tanstack-react-query";

   export const { TRPCProvider, useTRPC, useTRPCClient } =
     createTRPCContext<AppRouter>();
   ```

4. **New queryOptions/mutationOptions API** (recommended, not required):
   ```typescript
   // Classic (still works with @trpc/react-query)
   trpc.user.getById.useQuery({ id })

   // New v11 pattern (with @trpc/tanstack-react-query)
   const trpc = useTRPC();
   useQuery(trpc.user.getById.queryOptions({ id }))
   ```

5. **queryKey() Method**: Access type-safe query keys for cache manipulation
   ```typescript
   queryClient.invalidateQueries({
     queryKey: trpc.user.list.queryKey()
   })
   ```

6. **Subscription Output Type Changes**:
   ```typescript
   // Before: output: __OUTPUT__
   // After: output: AsyncGenerator<__OUTPUT__, void, unknown>
   ```

7. **Removed .interop() Mode**: v9 compatibility layer removed

### Installation for v11

```bash
# New TanStack-native integration (recommended)
npm install @trpc/server@^11 @trpc/client@^11 @trpc/tanstack-react-query @tanstack/react-query@^5

# Classic integration (still supported)
npm install @trpc/server@^11 @trpc/client@^11 @trpc/react-query@^11 @tanstack/react-query@^5
```

### New v11 Features

- **FormData/File Support**: Native support for `File`, `Blob`, `Uint8Array` uploads
- **httpBatchStreamLink**: Streaming responses for large datasets
- **Shorthand Router Definitions**: Plain objects instead of explicit `router()` calls
- **Server-Sent Events**: SSE subscriptions as alternative to WebSockets
- **Generator Subscriptions**: JavaScript generators with cleanup support

---

## Error Code Reference

| tRPC Code | HTTP Status | When to Use |
|-----------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid input (beyond Zod validation) |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `METHOD_NOT_SUPPORTED` | 405 | Wrong HTTP method |
| `TIMEOUT` | 408 | Request timed out |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `PRECONDITION_FAILED` | 412 | Precondition not met |
| `PAYLOAD_TOO_LARGE` | 413 | Request body too large |
| `UNPROCESSABLE_CONTENT` | 422 | Semantic validation failure |
| `TOO_MANY_REQUESTS` | 429 | Rate limited |
| `CLIENT_CLOSED_REQUEST` | 499 | Client disconnected |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
| `NOT_IMPLEMENTED` | 501 | Feature not implemented |
| `BAD_GATEWAY` | 502 | Upstream service error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `GATEWAY_TIMEOUT` | 504 | Upstream timeout |

---

## Query Key Patterns

tRPC generates query keys automatically, but you can access them when needed:

```typescript
// Get query key for a procedure
import { getQueryKey } from "@trpc/react-query";

// For a query
const userKey = getQueryKey(trpc.user.getById, { id: "123" }, "query");
// Result: [["user", "getById"], { input: { id: "123" }, type: "query" }]

// For a mutation
const createKey = getQueryKey(trpc.user.create, undefined, "mutation");

// For invalidation by prefix
queryClient.invalidateQueries({ queryKey: [["user"]] }); // All user.* queries
```

---

## Performance Optimization

### Request Batching

tRPC's `httpBatchLink` automatically combines multiple requests made in the same render cycle:

```typescript
// These 3 calls become 1 HTTP request
const user = trpc.user.getById.useQuery({ id: "1" });
const posts = trpc.post.list.useQuery();
const comments = trpc.comment.recent.useQuery();
```

### Prefetching

```typescript
// Prefetch on hover for instant navigation
function UserLink({ userId }: { userId: string }) {
  const utils = trpc.useUtils();

  return (
    <Link
      href={`/user/${userId}`}
      onMouseEnter={() => {
        utils.user.getById.prefetch({ id: userId });
      }}
    >
      View Profile
    </Link>
  );
}
```

### Selective Invalidation

```typescript
// DON'T: Invalidate everything
utils.invalidate(); // Refetches ALL queries

// DO: Invalidate specific queries
utils.user.getById.invalidate({ id: userId }); // Only this user
utils.post.list.invalidate(); // Only post list
```
