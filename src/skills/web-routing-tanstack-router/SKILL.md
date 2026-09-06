---
name: web-routing-tanstack-router
description: Type-safe client-side routing for React with file-based routes, search params validation, loaders, and code splitting
---

# TanStack Router Patterns

> **Quick Guide:** TanStack Router types the whole URL — path params, search params and loader return values all flow through inference, so a wrong `<Link to>` is a compile error. The router plugin generates `routeTree.gen.ts` from the routes directory; `validateSearch` turns search params into a validated schema; `beforeLoad` runs sequentially for guards and context, `loader` runs in parallel for data. Registering the router through `declare module` is what makes the type safety app-wide.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — plugin setup, root route with context, entry point and registration, devtools
- [examples/routes.md](examples/routes.md) — file conventions in practice, nested and pathless layouts, non-nested routes, catch-all
- [examples/navigation.md](examples/navigation.md) — `Link`, active options, search updaters, `useNavigate`, `redirect`
- [examples/data-loading.md](examples/data-loading.md) — loaders, `beforeLoad`, prefetch, blocking vs non-blocking, SWR caching
- [examples/search-params.md](examples/search-params.md) — Zod validation, filter pages, search middleware, plain-function validation
- [examples/auth-and-context.md](examples/auth-and-context.md) — context injection, guard patterns, return-to redirect, `getRouteApi`
- [examples/error-handling.md](examples/error-handling.md) — error, pending and not-found components, code splitting, preloading
- [reference.md](reference.md) — route options, loader context, hooks, `Link` props, router options, file-naming table

---

## Which path applies

- **File-based routes** — the plugin watches the routes directory and generates the tree. Routes are declared with `createFileRoute("/path")`, the path string is checked against the file's location, and `autoCodeSplitting` splits each route for free. Everything in [examples/routes.md](examples/routes.md) assumes this.
- **Code-based routes** — no plugin; routes are assembled by hand with `createRoute({ getParentRoute, path })`. Every route option below still applies, but the file-naming conventions do not, and the tree is yours to keep in sync.

Mixing the two in one project puts a hand-written route outside the generated tree, where the plugin cannot see it.

---

<critical_requirements>

## Before writing TanStack Router code

**Declare routes with `createFileRoute` while the plugin is generating the tree.** The path string is then validated against the file's real location, and the generated tree stays the single source of truth.

**Read search params through `validateSearch` and `useSearch()`.** They arrive typed, with defaults applied and invalid values already handled, which reading `window.location.search` gives up.

**Put auth checks in `beforeLoad`.** It runs before any component mounts and before child loaders fire, so a `throw redirect()` there costs no render and no wasted fetch.

**Hand services to routes through router context rather than importing them into loaders.** A loader that reads `context.apiClient` can be tested against a substituted client.

**Render `<Outlet />` in every layout route.** It is the slot the matched child renders into, and a layout without one renders its children nowhere, silently.

**Register the router with `declare module "@tanstack/react-router"`.** That single declaration is what gives `Link`, `useNavigate` and `redirect` their route-aware types across the app.

</critical_requirements>

---

**Auto-detection:** createFileRoute, createRootRouteWithContext, createLazyFileRoute, routeTree.gen, @tanstack/react-router, @tanstack/router-plugin, validateSearch, zodValidator, beforeLoad, loaderDeps, useRouteContext, getRouteApi, notFound, retainSearchParams, stripSearchParams, activeProps, preload="intent"

**Applies to:**

- Type-safe route trees, generated from files or assembled by hand
- Search params as validated, typed application state
- Route-level data loading with SWR caching and preloading
- Nested and pathless layouts, and guards that cover a subtree
- Dependency injection into loaders through router context
- Error, pending and not-found UI per route or router-wide
- Route-level code splitting

**Handled elsewhere:**

- Authoring the validation schema itself — `validateSearch` accepts any Standard Schema validator or a plain function, and how the schema is written belongs to whatever owns validation.
- A server-state cache shared across routes — loader data caches per route via `staleTime`; a cache that serves many components from one entry is a separate concern the router injects through context.
- Client state that never belongs in a URL.
- Styling active links — an active link exposes `data-status="active"` and `aria-current="page"`, and what is done with them is not the router's business.
- Server rendering and streaming.
- Another client-side router in the same app — TanStack Router owns the URL wholesale, so the two cannot both be mounted.

---

<philosophy>

TanStack Router treats the URL as typed state. Search params are validated schemas rather than strings, loader return types flow into `useLoaderData()`, and destinations are checked against the generated tree — so routing bugs surface at compile time instead of on a broken link.

- **The file system is the route tree.** Convention generates `routeTree.gen.ts`; nothing is registered by hand.
- **Loaders run before render.** Data is present when the component mounts, so there is no loading branch in the component.
- **Context flows down.** Dependencies arrive through `createRootRouteWithContext`, and each `beforeLoad` can add to what its children see.
- **Siblings load in parallel.** `beforeLoad` is the sequential phase; putting fetches there is what creates a waterfall.

</philosophy>

---

<decision_framework>

## beforeLoad or loader

```
What does this code do?
  +-- Auth check or permission guard?   -> beforeLoad (runs first, blocks everything below)
  +-- Conditional redirect?             -> beforeLoad (throw redirect())
  +-- Add data children will need?      -> beforeLoad (its return value merges into context)
  +-- Fetch data for this component?    -> loader (parallel with sibling loaders)
```

## How to navigate

```
Where are you?
  +-- In JSX, on something clickable?   -> <Link to="..." params={...} />
  +-- In a handler, after a mutation?   -> useNavigate()
  +-- In beforeLoad or a loader?        -> throw redirect()
  +-- Outside the React tree entirely?  -> router.navigate() on the router instance
```

The last one is the only route out of a module that never renders — a fetch wrapper redirecting on a 401, for instance. The hooks all need a component.

## Which layout shape

```
What is shared, and does it belong in the URL?
  +-- Shared UI under a URL segment?    -> route.tsx in that directory
  +-- Shared UI or a guard, no segment? -> pathless layout (_authenticated.tsx)
  +-- URL nests but layout should not?  -> non-nested suffix (posts_.create.tsx)
  +-- Grouping for the file tree only?  -> group directory ((admin)/)
```

## Validating search params

Reach for the Zod adapter once a schema has several fields or is shared with a form, and for a plain `validateSearch` function for one or two params where a dependency buys nothing. Zod 3.24+ and Zod 4 implement Standard Schema and can be passed directly, using `.catch()` where the adapter's `fallback()` would have gone.

## Caching loader data

`staleTime` on a route is enough while the data belongs to that route. Once several components across the app need the same server data, inject a cache client through context and prefetch in the loader — and drop `staleTime` to `0` there, since two caches both deciding freshness fetch twice.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Project setup

The plugin runs before the React plugin and generates the tree; `declare module` registers the router so every `Link` and `navigate` is typed.

```typescript
// bundler config — router plugin first
tanstackRouter({ target: "react", autoCodeSplitting: true }),
react(),
```

```typescript
const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: File-based route declaration

A file's location determines its URL, and its `createFileRoute` path string has to match. The prefixes and suffixes that change nesting — `_pathless`, `posts_.escaped`, `$param`, `$` splat, `(group)`, `-ignored` — are tabulated in [reference.md](reference.md).

```typescript
// src/routes/posts/index.tsx  ->  /posts
export const Route = createFileRoute("/posts/")({
  component: PostsIndex,
});
```

Full code: [examples/routes.md](examples/routes.md)

---

### Pattern 3: Type-safe navigation

Destinations, params and search are all checked against the generated tree. `preload="intent"` warms the route on hover.

```typescript
<Link to="/posts/$postId" params={{ postId: post.id }} preload="intent">
  {post.title}
</Link>;

const navigate = useNavigate();
await navigate({ to: "/posts/$postId", params: { postId: post.id }, replace: true });

throw redirect({ to: "/login", search: { redirect: location.href } });
```

Full code: [examples/navigation.md](examples/navigation.md)

---

### Pattern 4: Search params validation

`validateSearch` turns the query string into a typed object. `fallback()` keeps an invalid param from throwing, and `.default()` fills a missing one.

```typescript
const schema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(schema),
  component: ProductsPage,
});

const { page, q } = Route.useSearch();
```

Full code: [examples/search-params.md](examples/search-params.md)

---

### Pattern 5: Route loaders

Loaders run before render, in parallel with siblings, and receive an `abortController` whose signal cancels the fetch when the user navigates away.

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
```

Full code: [examples/data-loading.md](examples/data-loading.md)

---

### Pattern 6: Nested and pathless layouts

A layout route wraps its children with shared UI. A `_` prefix makes the layout pathless — it adds UI and guards without adding a URL segment.

```typescript
// src/routes/_authenticated.tsx  ->  children live at /dashboard, /settings
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
```

Full code: [examples/routes.md](examples/routes.md)

---

### Pattern 7: Route context and dependency injection

`createRootRouteWithContext` fixes the context shape; `createRouter` supplies it; every loader and `beforeLoad` receives it typed. A `beforeLoad` return value merges into what its children see.

```typescript
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const router = createRouter({ routeTree, context: { auth, apiClient } });

loader: async ({ context }) => ({ posts: await context.apiClient.getPosts() });
```

Full code: [examples/auth-and-context.md](examples/auth-and-context.md)

---

### Pattern 8: Error, pending and not-found UI

Each is a route option, and `createRouter` takes a `default*` version of each for routes that declare none. `pendingMs` delays the spinner past a fast load; `pendingMinMs` stops it flickering.

```typescript
export const Route = createFileRoute("/posts/$postId/")({
  pendingMs: PENDING_DELAY_MS,
  pendingComponent: () => <div>Loading…</div>,
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

Full code: [examples/error-handling.md](examples/error-handling.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `return redirect()` or `return notFound()` — both have to be thrown to short-circuit the match.
- A layout route without `<Outlet />` — children render nowhere, with no error.
- The router plugin listed after the React plugin — the transform order is wrong and the generated tree does not take effect.
- Editing `routeTree.gen.ts` — it is regenerated on the next run and the edit is gone.
- A `createFileRoute` path string that does not match the file's location.
- `createRoute` by hand while the plugin is running — the route sits outside the generated tree.
- Auth checked in component render rather than `beforeLoad` — the protected view paints before the redirect, and child loaders have already run unauthenticated.
- `window.location.search` in place of `useSearch()` — no validation, no defaults, and no re-render when the URL changes.

**Surprising behaviour:**

- `beforeLoad` is the sequential phase, parent before child; a fetch there serialises what `loader` would have run in parallel.
- Without `fallback()`, an invalid search param throws instead of falling back to the default.
- A missing `declare module` registration costs type safety silently — `Link` and `navigate` still compile, just untyped.
- Search params are serialised into the URL, so large objects, binary payloads and secrets do not belong there.
- `useSearch({ strict: false })` returns a partial type, and is only right when the current route genuinely is unknown.
- Path params are strings; convert in the loader so the component receives the type it expects.
- `staleTime: 0` alongside an external cache double-fetches on every navigation.
- `to="."` without `from` resolves against whichever route the component happens to be under.
- Awaiting non-critical data in a loader blocks the render it was not needed for — start the fetch and let the component show its own pending state.

</red_flags>
