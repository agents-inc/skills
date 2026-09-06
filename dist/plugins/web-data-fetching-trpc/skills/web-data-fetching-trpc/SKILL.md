---
name: web-data-fetching-trpc
description: tRPC type-safe API patterns — routers and procedures, input validation, context and middleware, TRPCError, and the typed client bridge
---

# tRPC Patterns

> **Quick Guide:** tRPC carries types from server to client through one exported type rather than
> through a generated schema, so `export type AppRouter = typeof appRouter` is the whole bridge and
> everything downstream fails without it. Procedures take a validated input and return a value;
> `TRPCError` codes are what become HTTP statuses; middleware narrows the context type so an
> authenticated procedure's `ctx.user` is non-nullable. In v11 the transformer moved inside the
> link, subscriptions are async generators, and `@trpc/tanstack-react-query` is the current React
> integration.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — initialization, context, a CRUD router, the provider, inferred types, `queryOptions`
- [examples/middleware.md](examples/middleware.md) — logging, rate limiting, resource-scoped access
- [examples/infinite-queries.md](examples/infinite-queries.md) — cursor pagination end to end
- [examples/optimistic-updates.md](examples/optimistic-updates.md) — the full snapshot-and-rollback cycle
- [examples/subscriptions.md](examples/subscriptions.md) — async generator subscriptions with resumable event ids
- [examples/file-uploads.md](examples/file-uploads.md) — `File` in an input schema (v11+)
- [reference.md](reference.md) — error code to HTTP status table, batching and invalidation notes, v10 → v11 migration

---

## Which path applies

- **`@trpc/tanstack-react-query`** — the current integration. `createTRPCContext` yields a `useTRPC`
  hook, and each procedure exposes `queryOptions()`, `mutationOptions()`, `infiniteQueryOptions()`
  and `queryKey()` that go straight into the standard query hooks. Pattern 5.
- **`@trpc/react-query`** — the classic integration, still supported in v11. Procedures carry their
  own `trpc.x.useQuery()` hooks instead, and a cache key comes from `getQueryKey(trpc.x)` rather
  than from a `queryKey()` on the procedure. Migrate when convenient; the two can coexist.

---

<critical_requirements>

## Before writing tRPC code

**Export the router's type: `export type AppRouter = typeof appRouter`.** That single line is the
whole client-side contract — without it the client falls back to `unknown` and every guarantee tRPC
offers is gone, with no error at the point the export was forgotten.

**Give every procedure that accepts input a validator on `.input()`.** It is both the runtime check
and the source of the handler's parameter type, so a procedure without one receives `unknown` and
tempts a cast.

**Throw `TRPCError` with a code rather than a bare `Error`.** The code is what maps to an HTTP
status and what the client switches on; a bare `Error` arrives as an opaque 500.

**Place the transformer inside `httpBatchLink()`, not on `createTRPCClient()`.** v11 moved it, and
the old position raises an error at client construction.

</critical_requirements>

---

**Auto-detection:** `initTRPC`, `createTRPCClient`, `createTRPCContext`, `createTRPCOptionsProxy`,
`@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@trpc/tanstack-react-query`, `TRPCError`,
`publicProcedure`, `protectedProcedure`, `httpBatchLink`, `httpSubscriptionLink`, `loggerLink`,
`inferRouterInputs`, `inferRouterOutputs`, `useTRPC`, `tracked`, `AppRouter`

**Applies to:**

- Router and procedure definition, and composing routers into one
- Input validation and the types inferred from it
- Per-request context, and middleware that narrows it
- Error codes and the shape the client receives
- Turning a procedure into typed query and mutation options
- Subscriptions, file inputs and cursor pagination

**Handled elsewhere:**

- APIs published for third-party or non-TypeScript consumers, which want a language-neutral contract
  document rather than a shared type
- Caching policy, retries and invalidation semantics — this skill settles how a procedure becomes
  the options a query client consumes, and the client decides what to do with them
- The schema library used on `.input()`; any validator the version supports works, and the examples
  show one
- Session and token issuance; context consumes a session rather than establishing one

---

<philosophy>

## Philosophy

There is no API description anywhere — no schema file, no generated client, no build step between
the two halves. The router's inferred type _is_ the contract, and it is shared by importing a type
across the codebase.

That buys immediate accuracy: a procedure's return type changes and every call site reddens in the
same typecheck, with no regeneration step to forget. It costs polyglot support, a published
contract, and HTTP caching — calls go out as POST by default, so a CDN in front of the endpoint has
nothing to cache. Which is why tRPC suits an internal API in one TypeScript codebase and suits a
public one badly.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Initialization

Initialize once per application and export the factories the routers compose from.

```typescript
const t = initTRPC.context<Context>().create({
  transformer: superjson, // Date, Map and Set survive the wire
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

The error formatter is what turns a validation failure into something a form can render per field,
instead of one message.

Full code: [examples/core.md](examples/core.md) — including the per-request context factory

---

### Pattern 2: Procedures and input validation

```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export const userRouter = router({
  create: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      // input: { email: string; name: string } — validated, and typed from the same schema
      return ctx.db.user.create({ data: input });
    }),
});
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Middleware that narrows the context

```typescript
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.user } });
});

export const protectedProcedure = publicProcedure.use(isAuthenticated);
```

The `next({ ctx })` return type is what makes `ctx.user` non-nullable in every procedure built on
`protectedProcedure` — so forgetting the check becomes a compile error rather than a review comment.

Full code: [examples/middleware.md](examples/middleware.md)

---

### Pattern 4: The type bridge

```typescript
export const appRouter = router({ user: userRouter, post: postRouter });
export type AppRouter = typeof appRouter;

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

type User = RouterOutputs["user"]["getById"];
```

Component props take `RouterOutputs[...]` rather than a hand-written interface, so a field removed
from a procedure reddens every component that read it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Typed query and mutation options

```typescript
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

const trpc = useTRPC();
const { data } = useQuery(trpc.user.getById.queryOptions({ id: userId }));
```

Each procedure carries `queryOptions()`, `mutationOptions()`, `infiniteQueryOptions()` and
`queryKey()`. The options object goes into the ordinary hook, so anything the query client can do to
an options object works here too.

Full code: [examples/core.md](examples/core.md) — provider, links and a component

---

### Pattern 6: Errors

```typescript
// Server
throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "Failed to delete",
  cause: error,
});
```

```typescript
// Client
onError: (error) => {
  switch (error.data?.code) {
    case "NOT_FOUND":
      return toast.error("Not found");
    case "FORBIDDEN":
      return toast.error("Not allowed");
  }
};
```

`cause` keeps the original stack for the server logs while the client still receives only the code
and message. The code-to-status table is in [reference.md](reference.md).

---

### Pattern 7: Optimistic updates

Cancel, snapshot, write, roll back on failure, invalidate when settled — all five, since the
rollback is what makes the optimistic write safe.

```typescript
const toggleTodo = useMutation({
  ...trpc.todo.toggle.mutationOptions(),
  onMutate: async ({ id }) => {
    await queryClient.cancelQueries({ queryKey: trpc.todo.list.queryKey() });
    const previousTodos = queryClient.getQueryData(trpc.todo.list.queryKey());
    queryClient.setQueryData(trpc.todo.list.queryKey(), (old) =>
      toggle(old, id),
    );
    return { previousTodos };
  },
  onError: (err, vars, context) =>
    queryClient.setQueryData(trpc.todo.list.queryKey(), context?.previousTodos),
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() }),
});
```

The `cancelQueries` is not optional: an in-flight refetch that resolves after the optimistic write
overwrites it with the pre-mutation server state.

Full code: [examples/optimistic-updates.md](examples/optimistic-updates.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `export type AppRouter` — the client infers `unknown` and every procedure call is untyped,
  with nothing failing at the file that omitted it.
- A transformer on `createTRPCClient()` in v11 — client construction throws, naming the link it
  should have gone in.
- A transformer configured on one side only — the two ends disagree about the wire format, and
  `Date`, `Map` and `Set` arrive as something else.
- `observable()` in a subscription — that is the v10 shape; v11 subscriptions are async generators.
- `rawInput` in middleware — v11 replaced it with `await getRawInput()`.
- An optimistic write with no snapshot and no `onError` — a failed mutation leaves the UI showing a
  change that never happened.

**Surprising behaviour:**

- `httpBatchLink` merges concurrent calls into one request, so every procedure in a batch shares one
  HTTP status — a 401 from one is the status the others see too.
- Context is built per request, so anything mutable stored on it is discarded and never shared.
- Middleware runs in declaration order, which decides what each layer can see: auth before rate
  limiting means the limit is keyed on a known user.
- A retried mutation repeats a write — set `retry: false` for mutations.
- Resumable subscriptions need `lastEventId` in the input schema for `tracked()` to have somewhere
  to resume from.
- An auth check written in a procedure body leaves `ctx.user` nullable to the type system, so the
  next procedure that forgets it compiles.

</red_flags>
