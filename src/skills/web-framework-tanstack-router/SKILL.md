---
name: web-framework-tanstack-router
description: Type-safe client-side routing for React with file-based routes, search params validation, loaders, and code splitting
---

# TanStack Router Patterns

> **Quick Guide:** TanStack Router provides fully type-safe client-side routing for React. Use file-based routing with `@tanstack/router-plugin` for automatic route tree generation. Define search params with Zod via `@tanstack/zod-adapter`. Use `loader` for data fetching, `beforeLoad` for guards/redirects, and `createRootRouteWithContext` for dependency injection. Version: v1.x (stable).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `createFileRoute` for all file-based routes - NEVER define routes manually when using the router plugin)**

**(You MUST validate search params with `validateSearch` - NEVER read raw `window.location.search`)**

**(You MUST use `beforeLoad` for auth guards and redirects - NEVER check auth inside component render)**

**(You MUST pass `queryClient` via router context for TanStack Query integration - NEVER import it directly in loaders)**

**(You MUST use `<Outlet />` in layout routes to render child content - forgetting it renders nothing)**

</critical_requirements>

---

**Auto-detection:** TanStack Router, createFileRoute, createRootRoute, createRootRouteWithContext, createRouter, RouterProvider, Outlet, useNavigate, useSearch, useParams, useLoaderData, useRouteContext, routeTree.gen, tanstack/react-router, tanstack/router-plugin, validateSearch, zodValidator, beforeLoad, loader, notFound, redirect

**When to use:**

- Building React SPAs with type-safe client-side routing
- File-based routing with automatic route tree generation
- Validated and type-safe URL search parameters
- Route-level data loading with caching
- Nested layouts with shared UI across child routes
- Authentication guards and route protection
- Code splitting routes for performance

**Key patterns covered:**

- File-based routing setup with Vite plugin
- Route definitions (`createFileRoute`, `createRootRoute`)
- Type-safe navigation (`Link`, `useNavigate`, `redirect`)
- Search params validation with Zod
- Route loaders and `beforeLoad` middleware
- Nested layouts and pathless layout routes
- Route context and dependency injection
- Authentication guards and protected routes
- Code splitting with `autoCodeSplitting`
- Error, pending, and not-found handling
- TanStack Query integration
- Devtools setup

**When NOT to use:**

- Server-rendered apps with SSR needs (consider TanStack Start or Next.js)
- Simple apps with 1-2 pages (plain React Router or no router)
- Static sites without client-side navigation

**Detailed Resources:**

- For practical code examples, see [examples/tanstack-router.md](examples/tanstack-router.md)
- For quick reference of hooks and components, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

TanStack Router treats the URL as a first-class, fully-typed state manager. Every path parameter, search parameter, and loader return type is inferred through TypeScript, catching routing bugs at compile time rather than runtime. The router plugin generates a route tree from your file system, giving you type-safe `<Link>` components and `useNavigate` calls that validate destinations, params, and search params automatically.

**Core principles:**

- **URL is typed state** - Search params are validated schemas, not raw strings
- **File system is the route tree** - Convention over configuration via `@tanstack/router-plugin`
- **Loaders run before render** - Data is available when the component mounts, not after
- **Context flows down** - Dependency injection through `createRootRouteWithContext`, not global imports
- **Parallel by default** - Sibling route loaders run in parallel, not waterfall

**When to use TanStack Router:**

- React SPAs needing type-safe routing across the entire app
- Apps with complex search param state (filters, pagination, sorting)
- Apps requiring route-level data loading with SWR caching
- Projects that benefit from file-based routing conventions
- Teams that value compile-time route validation

**When NOT to use:**

- Full-stack SSR apps (use TanStack Start, Next.js, or Remix instead)
- Micro-frontends or embedded widgets with no routing needs
- Static marketing sites with no client-side navigation

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Project Setup and Installation

Install the core packages and configure the Vite plugin for file-based routing.

#### Packages

```bash
# Runtime dependencies
npm install @tanstack/react-router @tanstack/react-router-devtools

# Build tool plugin (dev dependency)
npm install -D @tanstack/router-plugin
```

#### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    // Router plugin MUST come before React plugin
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
});
```

**Why good:** `autoCodeSplitting: true` automatically splits route components and loaders into separate chunks, the plugin generates `routeTree.gen.ts` with full type safety, placing the router plugin before react plugin ensures correct transform order

#### Entry Point

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const ROOT_ELEMENT_ID = "root";

const rootElement = document.getElementById(ROOT_ELEMENT_ID);
if (!rootElement) throw new Error(`Missing #${ROOT_ELEMENT_ID} element`);

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

**Why good:** module declaration enables type-safe `Link` and `useNavigate` across the entire app, named constant for root element ID prevents magic strings, null check on root element catches missing DOM early

---

### Pattern 2: File-Based Routing Conventions

The router plugin generates a typed route tree from your file structure. Understanding the naming conventions is essential.

#### File Structure

```
src/routes/
  __root.tsx              # Root layout (required)
  index.tsx               # / (home page)
  about.tsx               # /about
  posts/
    index.tsx             # /posts
    $postId/
      index.tsx           # /posts/:postId
      edit.tsx            # /posts/:postId/edit
    route.tsx             # /posts layout wrapper
  _authenticated.tsx      # Pathless layout (no URL segment)
  _authenticated/
    dashboard.tsx         # /dashboard (wrapped by _authenticated layout)
    settings.tsx          # /settings (wrapped by _authenticated layout)
```

#### Naming Conventions

| Convention   | Example              | Purpose                                  |
| ------------ | -------------------- | ---------------------------------------- |
| `__root.tsx` | `__root.tsx`         | Root layout, wraps entire app            |
| `index.tsx`  | `posts/index.tsx`    | Index route for directory (`/posts`)     |
| `$param`     | `$postId/index.tsx`  | Dynamic path parameter                   |
| `$`          | `$.tsx`              | Splat/catch-all route                    |
| `_prefix`    | `_authenticated.tsx` | Pathless layout route (no URL segment)   |
| `route.tsx`  | `posts/route.tsx`    | Layout for directory children            |
| `-prefix`    | `-components.tsx`    | Ignored by router (not a route)          |
| `(group)`    | `(admin)/`           | Organizational grouping (no URL effect)  |
| `suffix_`    | `posts_.detail.tsx`  | Non-nested route (escapes parent layout) |

#### Root Route

```typescript
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <nav>
        <Link to="/" activeProps={{ className: "active" }}>
          Home
        </Link>
        <Link to="/posts" activeProps={{ className: "active" }}>
          Posts
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
```

#### File Route

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  component: PostsIndex,
});

function PostsIndex() {
  return <h1>All Posts</h1>;
}
```

**Why good:** `createFileRoute` path string is validated against the actual file location, `Outlet` in root layout renders matched child routes, devtools auto-hide in production builds, `activeProps` provides styling hooks for active navigation links

```typescript
// Bad Example - Manual route definition with file-based routing
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

// WRONG: Don't define routes manually when using the router plugin
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts",
  component: PostsIndex,
});
```

**Why bad:** manual route definitions bypass the plugin's type generation and route tree, the path string is not validated against the file system, creates maintenance burden of manual route tree assembly

---

### Pattern 3: Type-Safe Navigation

TanStack Router validates all navigation destinations, params, and search params at compile time.

#### Link Component

```typescript
// Good Example - Type-safe Link with params and search
import { Link } from "@tanstack/react-router";

function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to="/posts/$postId"
            params={{ postId: post.id }}
            search={{ tab: "comments" }}
            activeProps={{ className: "font-bold" }}
            preload="intent"
          >
            {post.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

**Why good:** TypeScript validates that `/posts/$postId` exists in the route tree, `params` is required and typed to match the route's path params, `search` is validated against the route's search schema, `preload="intent"` prefetches data on hover for instant navigation

#### Imperative Navigation

```typescript
// Good Example - useNavigate for side-effect navigation
import { useNavigate } from "@tanstack/react-router";

function CreatePostForm() {
  const navigate = useNavigate();

  const handleSubmit = async (data: PostFormData) => {
    const post = await createPost(data);
    // Navigate after successful mutation
    await navigate({
      to: "/posts/$postId",
      params: { postId: post.id },
      replace: true,
    });
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

**Why good:** `useNavigate` is for imperative navigation after side effects (mutations, async actions), `replace: true` prevents back-button returning to the form, all params are type-checked against the route tree

#### Redirect from Loaders

```typescript
// Good Example - redirect() in beforeLoad
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAdmin) {
      throw redirect({
        to: "/",
        search: { error: "unauthorized" },
      });
    }
  },
  component: AdminDashboard,
});
```

**Why good:** `redirect()` accepts the same typed options as `navigate`, throwing it from `beforeLoad` prevents the component from ever rendering, search params on redirect are validated against the target route's schema

---

### Pattern 4: Search Params Validation

Search params are validated and typed using `validateSearch`. Use the Zod adapter for schema-based validation with defaults and error handling.

#### Installation

```bash
npm install @tanstack/zod-adapter zod
```

#### Zod Adapter Pattern

```typescript
// Good Example - Search params with Zod validation
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const productsSearchSchema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: fallback(z.number().min(1).max(100), DEFAULT_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  category: fallback(z.enum(["all", "electronics", "books", "clothing"]), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["price", "name", "date"]), "date").default("date"),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(productsSearchSchema),
  component: ProductsPage,
});

function ProductsPage() {
  // Fully typed - { page: number, pageSize: number, category: string, q: string, sort: string }
  const search = Route.useSearch();

  return (
    <div>
      <p>
        Page {search.page}, showing {search.pageSize} per page
      </p>
      <p>Category: {search.category}</p>
    </div>
  );
}
```

**Why good:** `fallback()` provides safe defaults for invalid/missing params instead of throwing errors, Zod schema gives full type inference to `useSearch()`, `.min()` and `.max()` validate bounds at the URL level, named constants prevent magic numbers for defaults

#### Updating Search Params

```typescript
// Good Example - Updating search params with functional updater
import { Link, useNavigate } from "@tanstack/react-router";
import { Route } from "./products";

function Pagination() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const handleNextPage = () => {
    navigate({
      search: (prev) => ({ ...prev, page: prev.page + 1 }),
    });
  };

  return (
    <div>
      {/* Declarative - Link with search updater */}
      <Link
        from={Route.fullPath}
        search={(prev) => ({ ...prev, page: prev.page - 1 })}
      >
        Previous
      </Link>

      <span>Page {page}</span>

      {/* Imperative - navigate with search updater */}
      <button type="button" onClick={handleNextPage}>
        Next
      </button>
    </div>
  );
}
```

**Why good:** functional updater `(prev) => ({...prev, ...})` preserves other search params, both Link and navigate support the same search updater pattern, `from` prop anchors type inference to the correct route's search schema

```typescript
// Bad Example - Reading search params manually
function ProductsPage() {
  // WRONG: Bypasses validation, loses type safety
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page") || 1);

  return <p>Page {page}</p>;
}
```

**Why bad:** bypasses `validateSearch` entirely losing all type safety, no default handling or validation, breaks SSR compatibility, does not react to URL changes

#### Plain Function Validation (No Zod)

```typescript
// Good Example - validateSearch without external schema library
import type { SearchSchemaInput } from "@tanstack/react-router";

const DEFAULT_PAGE = 1;

export const Route = createFileRoute("/posts/")({
  validateSearch: (
    input: Record<string, unknown> & SearchSchemaInput,
  ): { page: number; tag?: string } => ({
    page: Number(input.page ?? DEFAULT_PAGE) || DEFAULT_PAGE,
    tag: typeof input.tag === "string" ? input.tag : undefined,
  }),
  component: PostsList,
});
```

**Why good:** `SearchSchemaInput` marker type signals that input is optional (users navigate without search params), plain function validation works without additional dependencies, return type becomes the typed search schema

---

### Pattern 5: Route Loaders and Data Loading

Loaders fetch data before the component renders. They run in parallel for sibling routes and support SWR-style caching.

#### Basic Loader

```typescript
// Good Example - Route with loader
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  component: PostsPage,
});

function PostsPage() {
  // Data is guaranteed available - loader resolved before render
  const { posts } = Route.useLoaderData();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

**Why good:** `useLoaderData()` is fully typed from the loader return type, data is available on first render (no loading spinners in the component), loader errors are caught by the route's `errorComponent`

#### Loader with Params, Search, and Context

```typescript
// Good Example - Loader accessing all available data
import { createFileRoute } from "@tanstack/react-router";

const STALE_TIME_MS = 60_000; // 1 minute

export const Route = createFileRoute("/posts/$postId/")({
  // Cache loader results for 1 minute
  staleTime: STALE_TIME_MS,
  loader: async ({ params, context, abortController }) => {
    const post = await context.apiClient.getPost(params.postId, {
      signal: abortController.signal,
    });
    return { post };
  },
  component: PostDetail,
});

function PostDetail() {
  const { post } = Route.useLoaderData();
  return <article>{post.title}</article>;
}
```

**Why good:** `params.postId` is typed from the route path, `context.apiClient` is injected via router context (no global imports), `abortController.signal` cancels fetch on navigation away, `staleTime` enables SWR-style caching to avoid redundant fetches

#### beforeLoad vs loader

```typescript
// Good Example - beforeLoad for middleware, loader for data
export const Route = createFileRoute("/dashboard/")({
  // beforeLoad: runs first, sequentially, blocks loaders
  // Use for: auth checks, redirects, adding to context
  beforeLoad: async ({ context }) => {
    const user = await context.auth.getUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    // Return value merges into context for child routes and loader
    return { user };
  },

  // loader: runs after beforeLoad, in parallel with sibling loaders
  // Use for: fetching data the component needs
  loader: async ({ context }) => {
    // context.user is available from beforeLoad above
    const stats = await fetchDashboardStats(context.user.id);
    return { stats };
  },

  component: Dashboard,
});
```

**Why good:** separation of concerns - `beforeLoad` handles auth/redirects, `loader` handles data, `beforeLoad` return value automatically merges into context for the loader and child routes, parallel execution of sibling loaders prevents waterfalls

---

### Pattern 6: Nested Layouts and Outlets

Layout routes wrap child routes with shared UI without adding a URL segment.

#### Directory Layout Route

```typescript
// src/routes/posts/route.tsx - Layout for all /posts/* routes
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  component: PostsLayout,
});

function PostsLayout() {
  return (
    <div className="posts-layout">
      <aside>
        <h2>Posts Navigation</h2>
        {/* Sidebar shared across all /posts/* pages */}
      </aside>
      <section>
        <Outlet /> {/* Renders /posts/, /posts/$postId, etc. */}
      </section>
    </div>
  );
}
```

#### Pathless Layout Route

```typescript
// src/routes/_authenticated.tsx - Wraps children without adding URL segment
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="authenticated-layout">
      <header>{/* Authenticated header with user info */}</header>
      <Outlet /> {/* Renders /dashboard, /settings, etc. */}
    </div>
  );
}

// src/routes/_authenticated/dashboard.tsx -> URL: /dashboard
// src/routes/_authenticated/settings.tsx  -> URL: /settings
```

**Why good:** pathless layout (`_` prefix) adds shared UI and auth guards without affecting the URL, all children inherit the `beforeLoad` auth check, `Outlet` renders the matched child route within the shared layout

```typescript
// Bad Example - Checking auth in every child route
// src/routes/dashboard.tsx
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async ({ context }) => {
    // WRONG: duplicating auth check in every protected route
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: Dashboard,
});
```

**Why bad:** auth logic duplicated in every protected route instead of a single layout route, easy to forget on new routes creating security holes, violates DRY principle

---

### Pattern 7: Route Context and Dependency Injection

Route context provides type-safe dependency injection throughout the route tree, eliminating global imports in loaders.

#### Setting Up Router Context

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

**Why good:** `createRootRouteWithContext<RouterContext>()` enforces that `context` is passed to `createRouter`, TypeScript errors if required context properties are missing, all loaders/beforeLoad hooks receive fully typed `context`, avoids global imports in loaders making them testable

#### Accessing Context in Routes

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

#### Enriching Context with beforeLoad

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

**Why good:** context accumulates down the route tree - child routes see all parent context additions, `beforeLoad` return value is merged into context automatically, TypeScript infers the full context shape including parent additions

---

### Pattern 8: Authentication Guards and Protected Routes

Use `beforeLoad` with `redirect()` to protect routes. The pathless layout pattern groups protected routes under a single guard.

#### Complete Auth Guard Pattern

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
import { zodValidator } from "@tanstack/zod-adapter";
import { fallback } from "@tanstack/zod-adapter";
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

**Why good:** `location.href` captures the full intended URL including search params, the login page receives the redirect target as a validated search param, after successful login the user returns to their original destination, all routes under `_authenticated/` are protected by a single guard

---

### Pattern 9: Error, Pending, and Not-Found Handling

TanStack Router provides route-level error boundaries, loading indicators, and not-found handling.

#### Error and Pending Components

```typescript
// Good Example - Route with error and pending handling
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";

const PENDING_DELAY_MS = 200;
const PENDING_MIN_DISPLAY_MS = 300;

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    return { post };
  },
  // Show loading UI after 200ms (avoids flash for fast loads)
  pendingMs: PENDING_DELAY_MS,
  // Keep loading UI visible for at least 300ms (avoids flicker)
  pendingMinMs: PENDING_MIN_DISPLAY_MS,
  pendingComponent: () => <div>Loading post...</div>,
  errorComponent: ({ error, reset }) => (
    <div role="alert">
      <p>Failed to load post</p>
      <pre>{error.message}</pre>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </div>
  ),
  component: PostDetail,
});
```

**Why good:** `pendingMs` prevents loading flash for fast navigations, `pendingMinMs` prevents loading flicker for near-threshold loads, `errorComponent` receives `reset` function for retry capability, named constants for timing values prevent magic numbers

#### Not-Found Handling

```typescript
// Good Example - Not-found at route and router level
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) {
      // Triggers the route's notFoundComponent
      throw notFound();
    }
    return { post };
  },
  notFoundComponent: () => (
    <div>
      <h2>Post not found</h2>
      <p>The post you are looking for does not exist.</p>
    </div>
  ),
  component: PostDetail,
});
```

```typescript
// Router-level default not-found (catches unmatched URLs)
const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div>
      <h1>404</h1>
      <p>Page not found</p>
    </div>
  ),
});
```

**Why good:** `notFound()` in loaders handles data-level not-found (valid route, missing data), `notFoundComponent` on route handles that specific route's not-found, `defaultNotFoundComponent` on router catches URLs that match no route at all

---

### Pattern 10: Code Splitting

Enable automatic code splitting to lazy-load route components and loaders.

#### Automatic Code Splitting (Recommended)

```typescript
// vite.config.ts - Enable automatic code splitting
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true, // Splits component + loader per route
    }),
    react(),
  ],
});
```

**Why good:** no manual `lazy()` calls needed, the plugin automatically extracts `component`, `loader`, `pendingComponent`, and `errorComponent` into separate chunks, each route only loads its code when navigated to

#### Manual Code Splitting (When Needed)

```typescript
// src/routes/posts.lazy.tsx - Lazy-loaded route component
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/posts")({
  component: PostsPage,
});

function PostsPage() {
  return <div>Posts content loaded lazily</div>;
}
```

```typescript
// src/routes/posts.tsx - Critical route config (always loaded)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  // loader, beforeLoad, validateSearch stay in the main bundle
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  // component is defined in posts.lazy.tsx
});
```

**Why good:** `.lazy.tsx` files are only loaded when the route is navigated to, critical route config (loaders, search validation) stays in the main bundle for preloading, manual splitting gives fine-grained control when auto splitting is insufficient

**When to use:** prefer `autoCodeSplitting: true` for most projects. Manual splitting is useful when you need specific bundling behavior or when not using the router plugin.

---

### Pattern 11: TanStack Query Integration

TanStack Router pairs with TanStack Query for advanced server state management. Loaders prefetch query data, components consume it reactively.

#### Prefetching in Loaders

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

const postsQueryOptions = {
  queryKey: ["posts"] as const,
  queryFn: fetchPosts,
};

export const Route = createFileRoute("/posts/")({
  loader: async ({ context }) => {
    // Prefetch in loader - data is ready when component renders
    await context.queryClient.ensureQueryData(postsQueryOptions);
  },
  component: PostsPage,
});

function PostsPage() {
  // useSuspenseQuery will read from cache (already prefetched)
  const { data: posts } = useSuspenseQuery(postsQueryOptions);

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

**Why good:** `ensureQueryData` in loader prefetches data before component renders, `useSuspenseQuery` in component reads from cache (no loading state needed), TanStack Query handles background refetching, cache invalidation, and optimistic updates, query options are shared between loader and component ensuring cache key consistency

#### Non-Blocking Prefetch

```typescript
// Good Example - Fire-and-forget prefetch (no await)
export const Route = createFileRoute("/dashboard/")({
  loader: async ({ context }) => {
    // Critical data - awaited (blocks render)
    const stats = await context.queryClient.ensureQueryData(statsQueryOptions);

    // Non-critical data - not awaited (starts fetching, doesn't block)
    context.queryClient.prefetchQuery(recentActivityQueryOptions);

    return { stats };
  },
  component: Dashboard,
});
```

**Why good:** critical data blocks render ensuring it is available, non-critical data starts fetching in parallel without blocking, the component can show a loading state for non-critical data while critical data is immediate

---

### Pattern 12: Devtools

TanStack Router Devtools provide route tree visualization, search param inspection, and navigation debugging.

```typescript
// src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      {/* Auto-hidden in production (process.env.NODE_ENV === "production") */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
});
```

**Why good:** devtools are automatically excluded from production builds, placing in root route provides visibility across all routes, shows route tree, active route, search params, loader status

#### Lazy-Loaded Devtools (Optional)

```typescript
// Lazy-load devtools to reduce dev bundle size
import { lazy, Suspense } from "react";

const RouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : lazy(() =>
        import("@tanstack/react-router-devtools").then((mod) => ({
          default: mod.TanStackRouterDevtools,
        })),
      );

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Suspense>
        <RouterDevtools position="bottom-right" />
      </Suspense>
    </>
  ),
});
```

**Why good:** devtools are lazy-loaded so they do not increase initial bundle size even in development, production build tree-shakes the entire import, `Suspense` wrapper prevents flash while devtools load

</patterns>

---

<performance>

## Performance Optimization

### Preloading

Configure route preloading to fetch data before the user clicks a link.

```typescript
// Router-level preloading defaults
const router = createRouter({
  routeTree,
  defaultPreload: "intent", // Preload on hover/focus
});

// Per-link preloading override
<Link to="/posts/$postId" params={{ postId: "1" }} preload="intent">
  View Post
</Link>
```

**Preload strategies:**

| Strategy     | Behavior                                      |
| ------------ | --------------------------------------------- |
| `"intent"`   | Preloads on hover/focus (recommended default) |
| `"viewport"` | Preloads when link enters viewport            |
| `"render"`   | Preloads immediately on render                |
| `false`      | No preloading                                 |

### SWR Caching

TanStack Router includes built-in stale-while-revalidate caching for loaders.

```typescript
const STALE_TIME_MS = 30_000; // 30 seconds
const GC_TIME_MS = 300_000; // 5 minutes

// Router-level defaults
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultStaleTime: STALE_TIME_MS,
  defaultGcTime: GC_TIME_MS,
});

// Per-route override
export const Route = createFileRoute("/posts/")({
  staleTime: STALE_TIME_MS,
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  component: PostsPage,
});
```

**Caching properties:**

| Property           | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `staleTime`        | How long cached data is considered fresh (skips re-fetch)    |
| `gcTime`           | How long stale data stays in cache before garbage collection |
| `preloadStaleTime` | Separate stale time for preloaded data                       |

### Search Middleware for Clean URLs

Use search middleware to strip default values and retain important params during navigation.

```typescript
import { retainSearchParams, stripSearchParams } from "@tanstack/react-router";

const DEFAULT_PAGE = 1;
const DEFAULT_SORT = "date";

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(productsSearchSchema),
  search: {
    middlewares: [
      // Keep these params when navigating away and back
      retainSearchParams(["q"]),
      // Remove params matching defaults from URL
      stripSearchParams({ page: DEFAULT_PAGE, sort: DEFAULT_SORT }),
    ],
  },
  component: ProductsPage,
});
```

**Why good:** `stripSearchParams` keeps URLs clean by removing default values, `retainSearchParams` preserves important state across navigations, both reduce URL clutter while maintaining full type safety

</performance>

---

<decision_framework>

## Decision Framework

### When to Use Each Navigation Method

```
Need to navigate?
  +-- Is it a clickable element in JSX?
  |   +-- YES -> Use <Link to="..." />
  |   +-- NO -> Is it after a side effect (form submit, mutation)?
  |       +-- YES -> Use useNavigate()
  |       +-- NO -> Is it in a loader/beforeLoad?
  |           +-- YES -> throw redirect()
  |           +-- NO -> Use router.navigate()
```

### Where to Put Logic: beforeLoad vs loader

```
What does the logic do?
  +-- Auth check / permission guard?
  |   -> beforeLoad (blocks everything, runs first)
  +-- Redirect based on conditions?
  |   -> beforeLoad (throw redirect())
  +-- Add data to context for children?
  |   -> beforeLoad (return value merges into context)
  +-- Fetch data for the component?
  |   -> loader (runs in parallel with siblings)
  +-- Prefetch TanStack Query data?
  |   -> loader (ensureQueryData in parallel)
```

### Data Loading Strategy

```
How to load data?
  +-- Simple app, no shared cache needs?
  |   -> Built-in route loaders with staleTime
  +-- Complex app with shared server state?
  |   -> TanStack Query + ensureQueryData in loaders
  +-- Data needed only for this component?
  |   -> Route loader (useLoaderData)
  +-- Data shared across many components?
  |   -> TanStack Query (queryClient in context)
```

### Search Params: Zod Adapter vs Plain Function

```
Validating search params?
  +-- Complex schema with many fields?
  |   -> Zod adapter (zodValidator + fallback)
  +-- Simple 1-2 params?
  |   -> Plain validateSearch function
  +-- Need shared schema with forms?
  |   -> Zod adapter (share schema between route and form)
  +-- Zod 3.24.0+ with Standard Schema?
  |   -> Can use Zod directly without adapter
```

### Layout Strategy

```
Need shared UI across routes?
  +-- Shared UI for a URL segment (/posts/*)?
  |   -> route.tsx in directory (posts/route.tsx)
  +-- Shared UI without URL segment (auth guard)?
  |   -> Pathless layout (_authenticated.tsx)
  +-- Route should escape parent layout?
  |   -> Non-nested route suffix (posts_.detail.tsx)
  +-- Organizational grouping only?
  |   -> Group directory ((admin)/)
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **TanStack Query**: Prefetch in loaders via `context.queryClient.ensureQueryData()`, consume with `useSuspenseQuery` in components
- **TanStack Start**: Full-stack framework built on TanStack Router for SSR/SSG (use when you need server rendering)
- **Zod**: Search params validation via `@tanstack/zod-adapter` or Standard Schema (Zod 3.24.0+)
- **Valibot**: Alternative schema validation via `@tanstack/valibot-adapter`
- **React 19**: Compatible with React 19 features (Suspense, use(), transitions)

**Replaces / Conflicts with:**

- **React Router**: Both are client-side routers - use one or the other, not both
- **Next.js App Router**: Next.js has its own file-based routing - do not combine
- **Wouter**: Lightweight alternative - TanStack Router is the type-safe choice for larger apps

**Package ecosystem:**

| Package                           | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `@tanstack/react-router`          | Core router for React                        |
| `@tanstack/router-plugin`         | Vite/Webpack plugin for file-based routing   |
| `@tanstack/react-router-devtools` | Development tools                            |
| `@tanstack/zod-adapter`           | Zod integration for search params            |
| `@tanstack/valibot-adapter`       | Valibot integration for search params        |
| `@tanstack/start`                 | Full-stack SSR framework built on the router |

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Defining routes manually with `createRoute` when using file-based routing plugin (routes will be out of sync with generated tree)
- Reading `window.location.search` directly instead of `useSearch()` (bypasses validation, breaks SSR, loses reactivity)
- Checking auth inside component render instead of `beforeLoad` (component flashes before redirect, race conditions)
- Forgetting `<Outlet />` in layout routes (child routes render nothing)
- Importing `queryClient` directly in loaders instead of using router context (breaks testability, couples to global state)

**Medium Priority Issues:**

- Awaiting non-critical data in loaders (blocks render unnecessarily - use `prefetchQuery` for non-critical data)
- Not using `fallback()` with Zod adapter (invalid search params throw errors instead of falling back to defaults)
- Missing `declare module "@tanstack/react-router"` registration (Link, navigate lose type safety across the app)
- Duplicating auth checks in every route instead of using a pathless layout guard
- Using `staleTime: 0` when TanStack Query handles caching (double-fetching on every navigation)

**Common Mistakes:**

- Putting data-fetching logic in `beforeLoad` instead of `loader` (creates waterfalls, `beforeLoad` runs sequentially)
- Forgetting to pass `context` when creating the router (TypeScript error if using `createRootRouteWithContext`)
- Using `to="."` without `from` in child components (path resolution may be wrong)
- Not handling the `redirect` search param in the login page (users lose their intended destination)

**Gotchas and Edge Cases:**

- `beforeLoad` runs sequentially (parent before child) while `loader` runs in parallel - heavy work in `beforeLoad` creates waterfalls
- The `routeTree.gen.ts` file is auto-generated - never edit it manually, it will be overwritten
- `createFileRoute` path string must exactly match the file's location in the routes directory
- Search params are serialized to the URL - avoid large objects, binary data, or sensitive information
- `notFound()` and `redirect()` must be **thrown**, not returned
- The router plugin must be listed **before** the React plugin in Vite config
- `useSearch({ strict: false })` returns a partial type - only use when you genuinely do not know which route you are on
- Path params (`$postId`) are always strings - cast to number in the loader if needed, not in the component

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `createFileRoute` for all file-based routes - NEVER define routes manually when using the router plugin)**

**(You MUST validate search params with `validateSearch` - NEVER read raw `window.location.search`)**

**(You MUST use `beforeLoad` for auth guards and redirects - NEVER check auth inside component render)**

**(You MUST pass `queryClient` via router context for TanStack Query integration - NEVER import it directly in loaders)**

**(You MUST use `<Outlet />` in layout routes to render child content - forgetting it renders nothing)**

**Failure to follow these rules will break type safety, create security vulnerabilities in auth flows, and cause routes to silently render nothing.**

</critical_reminders>
