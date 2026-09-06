# tRPC — Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions.

**Extended examples:**

- [middleware.md](middleware.md) — logging, rate limiting, resource-scoped access
- [infinite-queries.md](infinite-queries.md) — cursor pagination and infinite scroll
- [optimistic-updates.md](optimistic-updates.md) — snapshot and rollback
- [subscriptions.md](subscriptions.md) — async generator subscriptions over SSE
- [file-uploads.md](file-uploads.md) — `File` inputs (v11+)

---

## Pattern 1: Initialization and context

### Initialization

```typescript
// packages/api/src/trpc/index.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  // SuperJSON enables Date, Map, Set serialization
  transformer: superjson,
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

### The context factory

```typescript
// packages/api/src/trpc/context.ts
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createContext(opts: FetchCreateContextFnOptions) {
  // Use your auth solution to validate the request
  const session = await validateSession(opts.req);

  return {
    db, // Your database client
    session,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

`Context` is derived from the factory's return type, so adding a field to the factory makes it
available in every procedure without a second declaration to keep in step.

---

## Pattern 2: A CRUD router

```typescript
// packages/api/src/routers/user.ts
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Input schema constants
const userIdSchema = z.object({
  id: z.string().uuid(),
});

const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name required").max(100, "Name too long"),
  bio: z.string().max(500).optional(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
});

const listUsersSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  cursor: z.string().uuid().optional(),
});

export const userRouter = router({
  // List with cursor pagination
  list: publicProcedure.input(listUsersSchema).query(async ({ input, ctx }) => {
    const users = await ctx.db.user.findMany({
      take: input.limit + 1, // Fetch one extra for cursor
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | undefined;
    if (users.length > input.limit) {
      const nextItem = users.pop();
      nextCursor = nextItem?.id;
    }

    return { users, nextCursor };
  }),

  // Get by ID
  getById: publicProcedure.input(userIdSchema).query(async ({ input, ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: input.id },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `User ${input.id} not found`,
      });
    }

    return user;
  }),

  // Create (protected)
  create: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      // Check for duplicate email
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      return ctx.db.user.create({ data: input });
    }),

  // Update (protected, owner only)
  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      // Verify ownership
      const user = await ctx.db.user.findUnique({ where: { id } });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (user.id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Can only update your own profile",
        });
      }

      return ctx.db.user.update({ where: { id }, data });
    }),

  // Delete (protected, owner only)
  delete: protectedProcedure
    .input(userIdSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (user.id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

Two things worth copying. The list procedure takes `limit + 1` rows and pops the extra to derive
`nextCursor`, which answers "is there another page" without a second count query. And ownership is
checked after the existence check, so a missing row is a 404 rather than a 403 that tells the caller
the row exists.

### Bad example — no validator

```typescript
const userRouter = router({
  create: publicProcedure.mutation(async ({ input, ctx }) => {
    // input is `unknown`, so the cast below is the only way this compiles —
    // and it writes whatever the caller sent straight to the database
    return ctx.db.user.create({ data: input as any });
  }),
});
```

---

## Pattern 3: The client and provider

```typescript
// apps/client/lib/trpc.ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../api"; // Your shared API package

// One call yields the provider and the typed hooks for the whole router
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
```

```typescript
// apps/client/lib/trpc-provider.tsx
// Mark as client component if using an SSR framework

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import { TRPCProvider } from "./trpc";
import type { AppRouter } from "../../api"; // Your shared API package

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const isDevelopment = process.env.NODE_ENV === "development";

function getBaseUrl() {
  if (typeof window !== "undefined") return ""; // in the browser, a relative URL is enough
  // On the server, whatever variable the host publishes its own URL in
  if (process.env.DEPLOY_URL) return `https://${process.env.DEPLOY_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FIVE_MINUTES_MS,
        retry: isDevelopment ? false : DEFAULT_RETRY_ATTEMPTS,
      },
      mutations: {
        retry: false, // Don't retry mutations
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function AppTRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        // Logger in development
        loggerLink({
          enabled: () => isDevelopment,
        }),
        // Batch HTTP requests
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // v11: the transformer goes inside the link, not on the client
          transformer: superjson,
          headers() {
            return {
              "x-trpc-source": "react",
            };
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

`getQueryClient` returns a fresh client on the server and a singleton in the browser: a server
render must not share a cache between two users' requests, and a browser navigation must not throw
its cache away.

### Bad example — transformer in the v10 position

```typescript
const trpcClient = createTRPCClient<AppRouter>({
  transformer: superjson, // v11 throws: the transformer belongs on the link
  links: [httpBatchLink({ url: "/api/trpc" })],
});
```

---

## Pattern 4: Inferred types

```typescript
// packages/api/src/types.ts
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
```

### In a component

```typescript
// apps/client/components/user-card.tsx
import type { RouterOutputs } from "../../api"; // Your shared API package

// Extract specific procedure output type
type User = RouterOutputs["user"]["getById"];

interface UserCardProps {
  user: User;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <span>Joined {user.createdAt.toLocaleDateString()}</span>
    </div>
  );
}
```

`user.createdAt` is a `Date` here because the transformer preserved it — the same code against a
hand-written interface would have a `string` and `toLocaleDateString` would not exist on it.

---

## Pattern 5: queryOptions and mutationOptions

```typescript
// apps/client/components/user-list.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";

const PAGE_SIZE = 10;

export function UserList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const usersQuery = useQuery(trpc.user.list.queryOptions({ limit: PAGE_SIZE }));

  const createUser = useMutation({
    ...trpc.user.create.mutationOptions(),
    onSuccess: () => {
      // the same key the query above registered under
      queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() });
    },
  });

  return (
    <div>
      {usersQuery.data?.users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={() => createUser.mutate({ email: "new@example.com", name: "New User" })}>
        Add User
      </button>
    </div>
  );
}
```

`mutate`'s argument is typed from the procedure's input schema, and `usersQuery.data` from its
return type — so a field renamed on the server reddens both ends of this component.

Because these are plain options objects rather than bespoke hooks, anything the query client can do
to an options object works unchanged: prefetching, suspense variants, `select`, and passing the same
object to more than one call site.
