# TanStack Router -- Auth & Context Examples

> Route context, dependency injection via createRootRouteWithContext, auth guards with beforeLoad, protected routes, and accessing route data from shared components. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Setup & Configuration](setup.md) -- root route with context, entry point
- [Routes & Layouts](routes.md) -- pathless layout routes for auth guards
- [Data Loading](data-loading.md) -- beforeLoad vs loader

---

## Setting Up Router Context

```typescript
// src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Outlet,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

// Define the shape of your router context
export interface RouterContext {
  queryClient: QueryClient;
  auth: AuthService;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return <Outlet />;
}
```

```typescript
// src/main.tsx - Provide context when creating the router
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { authService } from "./services/auth";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: authService,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

**Why:** `createRootRouteWithContext<RouterContext>()` enforces that `context` is passed to `createRouter`. TypeScript errors if required context properties are missing. All loaders/beforeLoad hooks receive fully typed `context`. Avoids global imports in loaders making them testable.

---

## Accessing Context in Routes

```typescript
// src/routes/posts/$postId/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ context, params }) => {
    // context.queryClient is typed from RouterContext
    const post = await context.queryClient.ensureQueryData({
      queryKey: ["posts", params.postId],
      queryFn: () => fetchPost(params.postId),
    });
    return { post };
  },
  component: PostDetail,
});
```

---

## Enriching Context with beforeLoad

`beforeLoad` return values merge into context for child routes and loaders.

```typescript
// src/routes/_authenticated.tsx
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const user = await context.auth.getUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    // Returned object merges into context for all child routes
    return { user };
  },
  component: () => <Outlet />,
});

// src/routes/_authenticated/profile.tsx
export const Route = createFileRoute("/_authenticated/profile")({
  loader: async ({ context }) => {
    // context.user is available here, typed from the parent beforeLoad
    const profile = await fetchProfile(context.user.id);
    return { profile };
  },
  component: ProfilePage,
});
```

**Why:** Context accumulates down the route tree. Child routes see all parent context additions. `beforeLoad` return value is merged into context automatically. TypeScript infers the full context shape including parent additions.

---

## Complete Auth Guard Pattern

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: () => <Outlet />,
});
```

```typescript
// src/routes/login.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const loginSearchSchema = z.object({
  redirect: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/login")({
  validateSearch: zodValidator(loginSearchSchema),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();

  const handleLogin = async (credentials: Credentials) => {
    await loginUser(credentials);
    // Navigate to the originally requested page after login
    await navigate({ to: redirectTo });
  };

  return <LoginForm onSubmit={handleLogin} />;
}
```

**Why:** `location.href` captures the full intended URL including search params. The login page receives the redirect target as a validated search param. After successful login the user returns to their original destination.

---

## Protected Dashboard (Using Parent Context)

```typescript
// src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    // context.user is available from _authenticated beforeLoad
    const stats = await fetchDashboardStats(context.user.id);
    return { stats };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { stats } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <div>
        <p>Total posts: {stats.totalPosts}</p>
        <p>Total comments: {stats.totalComments}</p>
      </div>
    </div>
  );
}
```

---

## Accessing Route Data from Shared Components (getRouteApi)

Use `getRouteApi` to access route data from components that are not directly defined in the route file.

```typescript
// src/components/post-header.tsx
import { getRouteApi, Link } from "@tanstack/react-router";

// Create a typed route API reference
const postRoute = getRouteApi("/posts/$postId/");

export function PostHeader() {
  // Fully typed - params and loader data from the post route
  const { postId } = postRoute.useParams();
  const { post } = postRoute.useLoaderData();

  return (
    <header>
      <Link to="/posts">Back</Link>
      <h1>{post.title}</h1>
      <span>Post #{postId}</span>
    </header>
  );
}
```

**Why:** `getRouteApi` provides typed access to a specific route's data from any component. Useful for shared components rendered within a specific route's tree. `Route.useX()` is preferred in route files; `getRouteApi` is for shared components.
