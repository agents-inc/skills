# tRPC Type-Safe API - Core Examples

> Essential patterns for tRPC setup and usage. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [middleware.md](middleware.md) - Logging, Rate Limiting, Org-Scoped Access
- [infinite-queries.md](infinite-queries.md) - Cursor Pagination, Infinite Scroll
- [optimistic-updates.md](optimistic-updates.md) - Optimistic Updates with Rollback
- [subscriptions.md](subscriptions.md) - Server-Sent Events
- [file-uploads.md](file-uploads.md) - FormData File Uploads (tRPC v11+)

---

## Pattern 1: Complete Router Setup

### Server-Side Initialization

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

// Named exports
export { router, publicProcedure, middleware };
```

### Context Factory

```typescript
// packages/api/src/trpc/context.ts
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { db } from "@repo/db";
import { auth } from "@repo/auth";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await auth.validateRequest(opts.req);

  return {
    db,
    session,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Named exports
export { createContext };
export type { Context };
```

### Bad Example - Missing Type Export

```typescript
// packages/api/src/root.ts

// BAD: AppRouter type not exported - clients have no type safety
const appRouter = router({
  user: userRouter,
});

// Missing: export type AppRouter = typeof appRouter;
```

**Why bad:** Without AppRouter type export, client has no type inference, autocomplete, or compile-time safety - defeats the entire purpose of tRPC

---

## Pattern 2: CRUD Router with Full Validation

### Complete User Router

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
  list: publicProcedure
    .input(listUsersSchema)
    .query(async ({ input, ctx }) => {
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
  getById: publicProcedure
    .input(userIdSchema)
    .query(async ({ input, ctx }) => {
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

// Named export
export { userRouter };
```

### Bad Example - No Validation

```typescript
// BAD: No input validation
const userRouter = router({
  create: publicProcedure.mutation(async ({ input, ctx }) => {
    // input is 'unknown' - no type safety
    return ctx.db.user.create({ data: input as any }); // Dangerous!
  }),
});
```

**Why bad:** Without Zod validation, input is unknown type, no runtime validation, SQL injection and invalid data risks, any cast defeats TypeScript safety

---

## Pattern 3: React Query Integration (tRPC v11)

### Provider Setup (New TanStack Integration - Recommended)

```typescript
// apps/client/lib/trpc.ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@repo/api";

// v11: Create typed context providers and hooks
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export { TRPCProvider, useTRPC, useTRPCClient };
```

```typescript
// apps/client/lib/trpc-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import { TRPCProvider } from "./trpc";
import type { AppRouter } from "@repo/api";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const isDevelopment = process.env.NODE_ENV === "development";

function getBaseUrl() {
  if (typeof window !== "undefined") return ""; // Browser - relative URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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
          // v11 CRITICAL: transformer goes INSIDE the link
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

// Named export
export { AppTRPCProvider };
```

### Bad Example - Transformer in Wrong Location

```typescript
// BAD: v11 error - transformer at client level
const trpcClient = createTRPCClient<AppRouter>({
  transformer: superjson, // WRONG - causes error in v11
  links: [
    httpBatchLink({ url: "/api/trpc" }),
  ],
});
```

**Why bad:** tRPC v11 moved transformer to links - placing it at client level causes "The transformer property has moved to httpLink/httpBatchLink/wsLink" error

### Bad Example - Magic Numbers

```typescript
// BAD: Magic numbers obscure configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What's this? 5 minutes? 3 minutes?
      retry: 3, // Why 3?
    },
  },
});
```

**Why bad:** Magic numbers require code archaeology to understand, makes policy changes difficult, violates project conventions

---

## Pattern 4: TypeScript Inference Utilities

### Extracting Types from Router

```typescript
// packages/api/src/types.ts
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

// Infer all input types
export type RouterInputs = inferRouterInputs<AppRouter>;

// Infer all output types
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Named exports for type definitions
export type { RouterInputs, RouterOutputs };
```

### Using Inferred Types in Components

```typescript
// apps/client/components/user-card.tsx
import type { RouterOutputs } from "@repo/api";

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

// Named export
export { UserCard };
```

### Bad Example - Manual Type Definitions

```typescript
// BAD: Manual types drift from backend
interface User {
  id: string;
  name: string;
  email: string;
  // Missing createdAt! Runtime error when accessed
}

function UserCard({ user }: { user: User }) {
  // TypeScript won't catch this - createdAt doesn't exist in manual type
  return <span>{user.createdAt.toLocaleDateString()}</span>;
}
```

**Why bad:** Manual types diverge from backend causing runtime errors, defeats tRPC's automatic type inference, double maintenance burden

---

## Pattern 5: v11 queryOptions/mutationOptions Pattern

### Using New v11 TanStack Integration API

```typescript
// apps/client/components/user-list.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function UserList() {
  // useTRPC from createTRPCContext provides typed procedure access
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // v11: queryOptions factory creates React Query compatible options
  const usersQuery = useQuery(trpc.user.list.queryOptions({ limit: 10 }));

  // v11: mutationOptions factory with custom onSuccess
  const createUser = useMutation({
    ...trpc.user.create.mutationOptions(),
    onSuccess: () => {
      // v11: queryKey for type-safe invalidation
      queryClient.invalidateQueries({
        queryKey: trpc.user.list.queryKey(),
      });
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

// Named export
export { UserList };
```

### Benefits of v11 TanStack Integration

- **Direct React Query hook usage** (`useQuery`, `useMutation` from TanStack)
- **`queryOptions()`** returns complete query configuration
- **`mutationOptions()`** returns complete mutation configuration
- **`queryKey()`** provides type-safe query keys for invalidation
- **Easier prefetching** with `queryClient.prefetchQuery(trpc.x.queryOptions())`
- **React Compiler compatible** - follows hooks rules properly
- **Lower learning curve** - use standard TanStack Query patterns

---
