# tRPC Type-Safe API - Reference

> Decision frameworks, anti-patterns, error codes, and v11 migration. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use tRPC vs Alternatives

```
Need API for TypeScript monorepo?
├─ Is client TypeScript? (browser, Node, React Native)
│   ├─ YES → Is API public (third-party consumers)?
│   │   ├─ YES → Use OpenAPI/REST (need docs & polyglot support)
│   │   └─ NO → Use tRPC
│   └─ NO → Use OpenAPI/REST (non-TS clients)
├─ Need GraphQL features? (partial queries, subscriptions at scale)
│   └─ YES → Use GraphQL
└─ Need HTTP caching at CDN?
    └─ YES → Use REST (tRPC uses POST by default)
```

### Procedure Type Selection

```
What operation are you implementing?
├─ Reading data (GET semantics)?
│   └─ Use .query()
├─ Writing/modifying data (POST/PUT/DELETE semantics)?
│   └─ Use .mutation()
└─ Real-time updates?
    └─ Use .subscription() with async generators
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
│   └─ Let Zod throw -- tRPC formats automatically
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

### React Integration Selection (v11)

```
Starting new project?
├─ YES → Use @trpc/tanstack-react-query (recommended)
│        createTRPCContext, useTRPC, queryOptions(), mutationOptions()
└─ NO → Already using @trpc/react-query?
    ├─ YES → Classic integration still works in v11
    │        trpc.x.useQuery(), trpc.x.useMutation()
    └─ Gradually migrate to new integration when convenient
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

### Missing AppRouter Type Export

```typescript
// BAD: Type not exported -- clients have no type inference
const appRouter = router({ user: userRouter });

// GOOD: Export type for client-side inference
export const appRouter = router({ user: userRouter });
export type AppRouter = typeof appRouter;
```

### Raw Error Objects Instead of TRPCError

```typescript
// BAD: Raw error has no code or HTTP mapping
throw new Error("User not found");

// GOOD: TRPCError maps to HTTP 404
throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
```

### No Input Validation

```typescript
// BAD: input is unknown, no validation
publicProcedure.mutation(async ({ input }) => {
  return ctx.db.user.create({ data: input as any });
});

// GOOD: Validated and typed input
publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    return ctx.db.user.create({ data: input });
  });
```

### Duplicated Auth Checks

```typescript
// BAD: Repeated in every procedure
create: publicProcedure.mutation(({ ctx }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
}),

// GOOD: Use protectedProcedure with middleware
create: protectedProcedure.mutation(({ ctx }) => {
  // ctx.user guaranteed non-null by middleware
}),
```

### Manual Type Definitions

```typescript
// BAD: Manual type will drift from backend
interface User {
  id: string;
  name: string;
}

// GOOD: Use inferred types
import type { RouterOutputs } from "./api";
type User = RouterOutputs["user"]["getById"];
```

### Optimistic Updates Without Rollback

```typescript
// BAD: No snapshot, no rollback
onMutate: async () => {
  utils.todo.list.setData(undefined, (old) => [...(old ?? []), newTodo]);
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

### v11 Transformer in Wrong Location

```typescript
// BAD: v11 error -- transformer at client level
createTRPCClient({ transformer: superjson, links: [...] });

// GOOD: transformer inside the link
httpBatchLink({ url: "/api/trpc", transformer: superjson });
```

### Using observable() for Subscriptions (v10 Pattern)

```typescript
// BAD: v10 observable pattern (deprecated in v11)
import { observable } from "@trpc/server/observable";
.subscription(({ ctx }) => {
  return observable((emit) => { emit.next(data); });
});

// GOOD: v11 async generator pattern
.subscription(async function* ({ ctx, signal }) {
  for await (const data of eventStream({ signal })) {
    yield data;
  }
});
```

</anti_patterns>

---

## Error Code Reference

| tRPC Code               | HTTP Status | When to Use                           |
| ----------------------- | ----------- | ------------------------------------- |
| `BAD_REQUEST`           | 400         | Invalid input (beyond Zod validation) |
| `UNAUTHORIZED`          | 401         | Not authenticated                     |
| `FORBIDDEN`             | 403         | Authenticated but not permitted       |
| `NOT_FOUND`             | 404         | Resource doesn't exist                |
| `METHOD_NOT_SUPPORTED`  | 405         | Wrong HTTP method                     |
| `TIMEOUT`               | 408         | Request timed out                     |
| `CONFLICT`              | 409         | Resource conflict (e.g., duplicate)   |
| `PRECONDITION_FAILED`   | 412         | Precondition not met                  |
| `PAYLOAD_TOO_LARGE`     | 413         | Request body too large                |
| `UNPROCESSABLE_CONTENT` | 422         | Semantic validation failure           |
| `TOO_MANY_REQUESTS`     | 429         | Rate limited                          |
| `CLIENT_CLOSED_REQUEST` | 499         | Client disconnected                   |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error               |
| `NOT_IMPLEMENTED`       | 501         | Feature not implemented               |
| `BAD_GATEWAY`           | 502         | Upstream service error                |
| `SERVICE_UNAVAILABLE`   | 503         | Service temporarily unavailable       |
| `GATEWAY_TIMEOUT`       | 504         | Upstream timeout                      |

---

## Performance Optimization

### Request Batching

`httpBatchLink` automatically combines multiple requests made in the same render cycle:

```typescript
// These 3 calls become 1 HTTP request
const user = useQuery(trpc.user.getById.queryOptions({ id: "1" }));
const posts = useQuery(trpc.post.list.queryOptions());
const comments = useQuery(trpc.comment.recent.queryOptions());
```

### Prefetching

```typescript
// Prefetch on hover for instant navigation
function UserLink({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (
    <a
      href={`/user/${userId}`}
      onMouseEnter={() => {
        queryClient.prefetchQuery(trpc.user.getById.queryOptions({ id: userId }));
      }}
    >
      View Profile
    </a>
  );
}
```

### Selective Invalidation

```typescript
const queryClient = useQueryClient();
const trpc = useTRPC();

// DON'T: Invalidate everything
queryClient.invalidateQueries(); // Refetches ALL queries

// DO: Invalidate specific queries
queryClient.invalidateQueries({
  queryKey: trpc.user.getById.queryKey({ id: userId }),
});
queryClient.invalidateQueries({ queryKey: trpc.post.list.queryKey() });
```

---

## tRPC v11 Migration Notes

### Breaking Changes from v10

1. **Transformer Location Changed** (CRITICAL):

   ```typescript
   // v10 (no longer works in v11)
   createTRPCClient({ transformer: superjson, links: [...] });

   // v11 (correct -- transformer INSIDE the link)
   httpBatchLink({ url: "/api/trpc", transformer: superjson });
   ```

2. **React Query v5 Required**: `@tanstack/react-query@^5`
   - Replace `isLoading` with `isPending`

3. **`rawInput` renamed to `getRawInput()`** in middleware:

   ```typescript
   // v10
   const input = opts.rawInput;
   // v11
   const input = await opts.getRawInput();
   ```

4. **`createTRPCProxyClient` renamed to `createTRPCClient`**

5. **Subscriptions**: Async generators replace `observable()` pattern

   ```typescript
   // v11: async generator with signal
   .subscription(async function* ({ signal }) {
     for await (const data of stream({ signal })) {
       yield tracked(data.id, data);
     }
   });
   ```

6. **Removed**: `.interop()` mode, `inferHandlerInput<T>`, `ProcedureArgs<T>`

7. **Requirements**: TypeScript >= 5.7.2, Node.js 18+

### New v11 Features

- **`@trpc/tanstack-react-query`**: New TanStack-native integration with `queryOptions`/`mutationOptions`
- **FormData/File Support**: Native support for `File`, `Blob`, `Uint8Array` uploads
- **`httpBatchStreamLink`**: Streaming responses for large datasets
- **Server-Sent Events**: `httpSubscriptionLink` for SSE subscriptions
- **`tracked()` helper**: Automatic reconnection with event ID resumption
- **React Server Components**: Prefetch helpers with `createTRPCOptionsProxy`

### Installation for v11

```bash
# New TanStack-native integration (recommended)
npm install @trpc/server@^11 @trpc/client@^11 @trpc/tanstack-react-query @tanstack/react-query@^5

# Classic integration (still supported)
npm install @trpc/server@^11 @trpc/client@^11 @trpc/react-query@^11 @tanstack/react-query@^5
```
