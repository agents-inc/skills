---
name: web-routing-tanstack-router
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

**(You MUST pass services via router context - NEVER import them directly in loaders (breaks testability))**

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
- External data fetching library integration in loaders
- Devtools setup

**When NOT to use:**

- Server-rendered apps with SSR needs (use an SSR framework instead)
- Simple apps with 1-2 pages (a lightweight router or no router)
- Static sites without client-side navigation

---

## Examples

- [Core Setup & Configuration](examples/core.md) -- Vite plugin, root route, entry point, devtools
- [Routes & Layouts](examples/routes.md) -- file-based routing conventions, nested layouts, pathless routes, catch-all
- [Navigation](examples/navigation.md) -- Link component, useNavigate, redirect, active states
- [Data Loading](examples/data-loading.md) -- loaders, beforeLoad, external data fetching integration, SWR caching
- [Search Params](examples/search-params.md) -- Zod validation, updating params, search middleware
- [Auth & Context](examples/auth-and-context.md) -- auth guards, route context, dependency injection, getRouteApi
- [Error Handling & Code Splitting](examples/error-handling.md) -- error/pending/not-found components, code splitting

For quick API reference (hooks, components, route options), see [reference.md](reference.md).

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

- Full-stack SSR apps (use an SSR/full-stack framework instead)
- Micro-frontends or embedded widgets with no routing needs
- Static marketing sites with no client-side navigation

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Project Setup

Install `@tanstack/react-router`, `@tanstack/router-plugin`, and optionally `@tanstack/zod-adapter`. Configure the Vite plugin with `autoCodeSplitting: true` before the React plugin. Register the router via `declare module` for app-wide type safety.

```typescript
// vite.config.ts - Router plugin MUST come before React plugin
tanstackRouter({ target: "react", autoCodeSplitting: true }),
react(),
```

```typescript
// src/main.tsx - Register for type safety
const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

See [examples/core.md](examples/core.md) for complete setup with context and devtools.

---

### Pattern 2: File-Based Routing Conventions

The router plugin generates a typed route tree from your file structure. Key conventions:

| Convention   | Example              | Purpose                                  |
| ------------ | -------------------- | ---------------------------------------- |
| `__root.tsx` | `__root.tsx`         | Root layout, wraps entire app            |
| `index.tsx`  | `posts/index.tsx`    | Index route for directory (`/posts`)     |
| `$param`     | `$postId/index.tsx`  | Dynamic path parameter                   |
| `_prefix`    | `_authenticated.tsx` | Pathless layout (no URL segment)         |
| `route.tsx`  | `posts/route.tsx`    | Layout for directory children            |
| `suffix_`    | `posts_.detail.tsx`  | Non-nested route (escapes parent layout) |
| `$`          | `$.tsx`              | Splat/catch-all route                    |
| `-prefix`    | `-components.tsx`    | Ignored by router (not a route)          |
| `(group)`    | `(admin)/`           | Organizational grouping (no URL effect)  |

```typescript
// src/routes/posts/index.tsx
export const Route = createFileRoute("/posts/")({
  component: PostsIndex,
});
```

See [examples/routes.md](examples/routes.md) for nested layouts, pathless routes, non-nested routes, and catch-all routes.

---

### Pattern 3: Type-Safe Navigation

TanStack Router validates all navigation destinations, params, and search params at compile time.

```typescript
// Declarative - Link component
<Link to="/posts/$postId" params={{ postId: post.id }} preload="intent">
  {post.title}
</Link>

// Imperative - after side effects
const navigate = useNavigate();
await navigate({ to: "/posts/$postId", params: { postId: post.id }, replace: true });

// In loaders/beforeLoad - redirect
throw redirect({ to: "/login", search: { redirect: location.href } });
```

See [examples/navigation.md](examples/navigation.md) for active states, search param updaters, and navigation decision tree.

---

### Pattern 4: Search Params Validation

Validate and type search params with `validateSearch`. Use Zod adapter for schema-based validation with `fallback()` for safe defaults.

```typescript
import { zodValidator, fallback } from "@tanstack/zod-adapter";

const DEFAULT_PAGE = 1;
const schema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(schema),
  component: ProductsPage,
});

// In component: fully typed
const { page, q } = Route.useSearch();
```

See [examples/search-params.md](examples/search-params.md) for complete filter pages, search middleware, plain function validation, and declarative vs imperative updates.

---

### Pattern 5: Route Loaders and Data Loading

Loaders fetch data before the component renders. They run in parallel for sibling routes and support SWR-style caching.

```typescript
export const Route = createFileRoute("/posts/$postId/")({
  staleTime: STALE_TIME_MS,
  loader: async ({ params, context, abortController }) => {
    const post = await context.apiClient.getPost(params.postId, {
      signal: abortController.signal,
    });
    return { post };
  },
  component: PostDetail,
});

// Data is guaranteed available - no loading state needed
const { post } = Route.useLoaderData();
```

**beforeLoad** runs first (sequentially) for auth checks and context enrichment. **loader** runs after (in parallel with siblings) for data fetching.

See [examples/data-loading.md](examples/data-loading.md) for external data fetching integration, non-blocking prefetch, and SWR caching.

---

### Pattern 6: Nested Layouts and Outlets

Layout routes wrap child routes with shared UI. Use `<Outlet />` to render matched child content.

```typescript
// src/routes/posts/route.tsx - Layout for /posts/*
export const Route = createFileRoute("/posts")({
  component: () => (
    <div className="posts-layout">
      <aside>{/* Sidebar */}</aside>
      <Outlet /> {/* Renders child route */}
    </div>
  ),
});
```

Pathless layouts (`_prefix`) add UI/guards without affecting the URL:

```typescript
// src/routes/_authenticated.tsx -> children at /dashboard, /settings (no /_authenticated in URL)
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
```

See [examples/routes.md](examples/routes.md) for nested pathless layouts, non-nested routes, and catch-all routes.

---

### Pattern 7: Route Context and Dependency Injection

Use `createRootRouteWithContext` to inject dependencies (auth, data clients, services) into all routes via typed context.

```typescript
// Root: define context shape
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

// Entry: provide context
const router = createRouter({
  routeTree,
  context: { auth: authService, apiClient },
});

// Routes: access typed context in loaders
loader: async ({ context }) => {
  const posts = await context.apiClient.getPosts();
  return { posts };
};
```

See [examples/auth-and-context.md](examples/auth-and-context.md) for complete patterns including context enrichment via `beforeLoad` and `getRouteApi` for shared components.

---

### Pattern 8: Error, Pending, and Not-Found Handling

```typescript
const PENDING_DELAY_MS = 200;

export const Route = createFileRoute("/posts/$postId/")({
  pendingMs: PENDING_DELAY_MS,
  pendingComponent: () => <div>Loading...</div>,
  errorComponent: ({ error, reset }) => (
    <div role="alert">
      <pre>{error.message}</pre>
      <button type="button" onClick={reset}>Retry</button>
    </div>
  ),
  notFoundComponent: () => <div>Post not found</div>,
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) throw notFound();
    return { post };
  },
  component: PostDetail,
});
```

See [examples/error-handling.md](examples/error-handling.md) for router-level defaults, code splitting strategies, and preloading.

</patterns>

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
  +-- Prefetch data for an external cache?
  |   -> loader (prefetch via context-injected client, runs in parallel)
```

### Data Loading Strategy

```
How to load data?
  +-- Simple app, no shared cache needs?
  |   -> Built-in route loaders with staleTime
  +-- Complex app with shared server state cache?
  |   -> External data fetching library + prefetch in loaders
  +-- Data needed only for this component?
  |   -> Route loader (useLoaderData)
  +-- Data shared across many components?
  |   -> External data fetching library (client in context)
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
  +-- Zod 3.24.0+ / Zod 4+ with Standard Schema?
  |   -> Can use Zod directly without adapter (use `.catch()` for defaults)
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

**Package ecosystem:**

| Package                           | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `@tanstack/react-router`          | Core router for React                      |
| `@tanstack/router-plugin`         | Vite/Webpack plugin for file-based routing |
| `@tanstack/react-router-devtools` | Development tools                          |
| `@tanstack/zod-adapter`           | Zod integration for search params          |
| `@tanstack/valibot-adapter`       | Valibot integration for search params      |

**Schema validation adapters:** Use `@tanstack/zod-adapter` or `@tanstack/valibot-adapter` for search params. Zod 3.24.0+ supports Standard Schema and can be used directly without an adapter.

**External data fetching:** The router context system (`createRootRouteWithContext`) enables injecting any data fetching client. Loaders can prefetch data via `context`, and components consume cached data. See [examples/data-loading.md](examples/data-loading.md).

**Conflicts with other client routers:** TanStack Router replaces any other client-side routing solution. Do not combine with another router library.

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Defining routes manually with `createRoute` when using file-based routing plugin (routes will be out of sync with generated tree)
- Reading `window.location.search` directly instead of `useSearch()` (bypasses validation, breaks SSR, loses reactivity)
- Checking auth inside component render instead of `beforeLoad` (component flashes before redirect, race conditions)
- Forgetting `<Outlet />` in layout routes (child routes render nothing)
- Importing services/clients directly in loaders instead of using router context (breaks testability, couples to global state)

**Medium Priority Issues:**

- Awaiting non-critical data in loaders (blocks render unnecessarily - fire-and-forget prefetch for non-critical data)
- Not using `fallback()` with Zod adapter (invalid search params throw errors instead of falling back to defaults)
- Missing `declare module "@tanstack/react-router"` registration (Link, navigate lose type safety across the app)
- Duplicating auth checks in every route instead of using a pathless layout guard
- Using `staleTime: 0` when an external data cache handles freshness (double-fetching on every navigation)

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

**(You MUST pass services via router context - NEVER import them directly in loaders (breaks testability))**

**(You MUST use `<Outlet />` in layout routes to render child content - forgetting it renders nothing)**

**Failure to follow these rules will break type safety, create security vulnerabilities in auth flows, and cause routes to silently render nothing.**

</critical_reminders>
