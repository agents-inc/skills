---
name: web-routing-react-router
description: Client-side routing with data APIs — loaders, actions, error boundaries, search params, nested layouts, and code splitting
---

# React Router Patterns

> **Quick Guide:** React Router v7 has three modes: Declarative (`<BrowserRouter>`), Data (`createBrowserRouter`), and Framework (Vite plugin). This skill covers **Data Mode** — the sweet spot for SPAs needing loaders, actions, and pending states without a full framework. All imports come from `"react-router"` (the `react-router-dom` package is removed). `defer()` and `json()` are removed in v7 — return plain objects from loaders. Form method values are now uppercase (`"POST"`, not `"post"`).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `createBrowserRouter` + `<RouterProvider>` for Data Mode — NEVER use `<BrowserRouter>` with `<Routes>` if you need loaders, actions, or fetchers)**

**(You MUST import from `"react-router"` — the `react-router-dom` package is removed in v7. All exports, including `RouterProvider` and `createBrowserRouter`, come from `"react-router"`)**

**(You MUST return plain objects from loaders — `json()` and `defer()` are removed in v7. Return `{ data }` directly or use `Response.json()`)**

**(You MUST use `throw redirect()` in loaders and shared helpers to short-circuit execution — `return redirect()` also works but does not stop execution in helper function call stacks)**

**(You MUST use `errorElement` or `ErrorBoundary` on routes — unhandled loader/action errors crash the entire router)**

</critical_requirements>

---

**Auto-detection:** React Router, createBrowserRouter, RouterProvider, useLoaderData, useActionData, useNavigation, useSearchParams, useFetcher, useRouteError, useParams, useNavigate, Outlet, NavLink, Form, loader, action, errorElement, ErrorBoundary, redirect, isRouteErrorResponse, route.lazy, useOutletContext, shouldRevalidate, useRevalidator

**When to use:**

- Building React SPAs that need data loading, form actions, or pending states
- Apps requiring nested layouts with shared UI (sidebars, headers)
- Route-level error boundaries and not-found handling
- URL search param state management
- Code splitting at the route level
- Non-navigating mutations (fetchers for inline forms, buttons)

**Key patterns covered:**

- Data Mode setup with `createBrowserRouter` and `RouterProvider`
- Route loaders and actions for data fetching and mutations
- Nested layouts with `<Outlet />` and `useOutletContext`
- Type-safe navigation with `Link`, `NavLink`, `useNavigate`, `redirect`
- Error handling with `errorElement`, `useRouteError`, `isRouteErrorResponse`
- Search params with `useSearchParams`
- Non-navigating mutations with `useFetcher`
- Code splitting with `route.lazy`
- Navigation state with `useNavigation`
- Protected routes and auth guard patterns

**When NOT to use:**

- Simple apps with 1-2 pages and no data loading (Declarative Mode with `<BrowserRouter>` is sufficient)
- Full-stack SSR apps (use Framework Mode or an SSR framework instead)
- Static sites without client-side navigation

---

## Examples

- [Core Setup & Route Config](examples/core.md) -- createBrowserRouter, RouterProvider, route objects, basic loaders
- [Data Loading & Actions](examples/data-loading.md) -- loaders, actions, Form, useFetcher, revalidation
- [Navigation & Search Params](examples/navigation.md) -- Link, NavLink, useNavigate, redirect, useSearchParams
- [Error Handling & Code Splitting](examples/error-handling.md) -- errorElement, useRouteError, route.lazy, pending UI
- [Layouts & Auth Guards](examples/layouts.md) -- Outlet, useOutletContext, protected routes, nested layouts

For quick API reference (hooks, components, route options), see [reference.md](reference.md).

---

<philosophy>

## Philosophy

React Router v7 treats the router as a data layer, not just a URL matcher. Routes define what data to load (`loader`), what mutations to handle (`action`), and what errors to catch (`errorElement`) — all before the component renders. This moves data orchestration out of components and into the route tree, eliminating loading waterfalls and duplicated error handling.

**Core principles:**

- **Routes own their data** — Loaders fetch before render, actions handle mutations. Components receive data, they do not fetch it.
- **URL is the source of truth** — Search params, path params, and navigation state all live in the URL. No hidden state.
- **Errors bubble up** — Like React error boundaries, `errorElement` catches errors at the nearest route. Unhandled errors bubble to the parent.
- **Revalidation is automatic** — After a successful action, all active loaders re-run. No manual cache invalidation needed. (In v7, loaders skip revalidation after action errors unless `shouldRevalidate` opts in.)
- **Fetchers are for mutations without navigation** — `useFetcher` handles inline forms, buttons, and background saves without changing the URL.

**When to use Data Mode:**

- SPAs with data loading needs and client-side routing
- Apps where you want route-level loaders/actions but control your own bundling
- Projects not ready for Framework Mode but outgrowing Declarative Mode

**When NOT to use:**

- If you only need URL matching and `<Link>` — Declarative Mode is simpler
- If you want SSR, streaming, or file-based routing — Framework Mode or an SSR framework is better
- If your app has no data loading — the overhead of Data Mode is not justified

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Data Mode Setup

Define routes as objects with `createBrowserRouter`. Pass the router to `<RouterProvider>`. This is the entry point for all Data Mode features.

```typescript
import { createBrowserRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { HomePage } from "./pages/home";
import { PostsPage, postsLoader } from "./pages/posts";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "posts",
        element: <PostsPage />,
        loader: postsLoader,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

**Why:** Route config lives outside React rendering, enabling the router to call loaders before components mount. `errorElement` at the root catches any unhandled error in the tree.

See [examples/core.md](examples/core.md) for complete setup with nested routes and error handling.

---

### Pattern 2: Loaders and Actions

Loaders fetch data before the route renders. Actions handle form mutations. Both receive `{ request, params }`. After an action completes, all active loaders automatically revalidate.

```typescript
// Loader: runs before render
export async function postsLoader() {
  const response = await fetch("/api/posts");
  if (!response.ok) throw new Response("Failed to load", { status: 500 });
  return response.json(); // or return { posts: await response.json() }
}

// Action: handles Form submissions
export async function createPostAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const post = await createPost({ title });
  return redirect(`/posts/${post.id}`);
}

// Route config
{
  path: "posts",
  element: <PostsPage />,
  loader: postsLoader,
  action: createPostAction,
}
```

**Why:** Loaders run in parallel for sibling routes — no waterfall. Actions revalidate all active loaders automatically, keeping the UI in sync. Throwing a `Response` from a loader triggers `errorElement`.

See [examples/data-loading.md](examples/data-loading.md) for actions, `useFetcher`, and revalidation patterns.

---

### Pattern 3: Error Boundaries with errorElement

Every route can define `errorElement` to catch errors from its loader, action, or component. Use `useRouteError()` to access the error and `isRouteErrorResponse()` to distinguish HTTP errors from unexpected exceptions.

```typescript
import { useRouteError, isRouteErrorResponse } from "react-router";

function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert">
        <h2>{error.status}: {error.statusText}</h2>
        <p>{error.data}</p>
      </div>
    );
  }

  return (
    <div role="alert">
      <h2>Unexpected Error</h2>
      <pre>{error instanceof Error ? error.message : "Unknown error"}</pre>
    </div>
  );
}
```

**Why:** `isRouteErrorResponse` distinguishes thrown `Response` objects (4xx/5xx from loaders) from unexpected exceptions. Without `errorElement`, a single loader failure crashes the entire router.

See [examples/error-handling.md](examples/error-handling.md) for nested error boundaries and retry patterns.

---

### Pattern 4: Nested Layouts with Outlet

Parent routes render `<Outlet />` where child routes appear. This creates persistent layouts (sidebars, headers) that do not unmount on child navigation.

```typescript
import { Outlet, NavLink } from "react-router";

function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav>
        <NavLink to="/dashboard" end>Overview</NavLink>
        <NavLink to="/dashboard/analytics">Analytics</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// Route config
{
  path: "dashboard",
  element: <DashboardLayout />,
  children: [
    { index: true, element: <DashboardOverview /> },
    { path: "analytics", element: <AnalyticsPage />, loader: analyticsLoader },
  ],
}
```

**Why:** Layout routes share UI across child routes without re-rendering. `<Outlet />` is the slot where the matched child renders. Forgetting `<Outlet />` means child routes render nothing.

See [examples/layouts.md](examples/layouts.md) for `useOutletContext`, pathless layouts, and auth guards.

---

### Pattern 5: Navigation State with useNavigation

`useNavigation()` exposes the current navigation state. Use it for global loading indicators and optimistic UI during form submissions.

```typescript
import { useNavigation } from "react-router";

function GlobalSpinner() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  if (!isNavigating) return null;

  return <div className="global-spinner" aria-busy="true">Loading...</div>;
}
```

**Why:** `navigation.state` is `"idle"`, `"loading"` (loader running), or `"submitting"` (action running). Place the spinner in your root layout for app-wide pending indication.

---

### Pattern 6: Non-Navigating Mutations with useFetcher

`useFetcher` handles mutations that should not trigger a full page navigation — inline forms, toggle buttons, auto-save, "add to cart" actions.

```typescript
import { useFetcher } from "react-router";

function DeleteButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <fetcher.Form method="POST" action={`/posts/${postId}/delete`}>
      <button type="submit" disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </fetcher.Form>
  );
}
```

**Why:** Unlike `<Form>`, `fetcher.Form` does not change the URL. Multiple fetchers can be active simultaneously. Each fetcher has independent `state` and `data`. After the action completes, active loaders revalidate.

See [examples/data-loading.md](examples/data-loading.md) for `useFetcher` patterns including optimistic UI.

---

### Pattern 7: Code Splitting with route.lazy

Use `route.lazy` to defer loading route modules until navigation. In v7.5+, the object-based API allows granular splitting of individual properties.

```typescript
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "admin",
        lazy: () => import("./pages/admin"),
        // The module must export: Component, loader, action, errorElement, etc.
      },
    ],
  },
]);
```

```typescript
// v7.5+ granular lazy loading
{
  path: "admin",
  lazy: {
    loader: async () => (await import("./pages/admin.loader")).loader,
    Component: async () => (await import("./pages/admin.component")).AdminPage,
  },
}
```

**Why:** `route.lazy` keeps the initial bundle small. The function-based API loads everything at once. The v7.5+ object-based API lets you split loader, component, and action into separate chunks for parallel downloads.

See [examples/error-handling.md](examples/error-handling.md) for lazy loading patterns and preloading.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Mode to Use

```
What do you need from routing?
  +-- Just URL matching and Links?
  |   -> Declarative Mode (<BrowserRouter>)
  +-- Data loading, actions, pending states?
  |   -> Data Mode (createBrowserRouter) - this skill
  +-- SSR, file-based routing, full framework?
  |   -> Framework Mode (Vite plugin)
```

### Where to Put Data Logic

```
What does the logic do?
  +-- Fetch data for the component?
  |   -> loader (runs before render, parallel with siblings)
  +-- Handle a form submission or mutation?
  |   -> action (processes FormData, returns result or redirects)
  +-- Mutation without navigation (inline form, button)?
  |   -> useFetcher (independent state, no URL change)
  +-- Check auth and redirect?
  |   -> loader (throw redirect() if unauthorized)
```

### When to Use Each Navigation Method

```
Need to navigate?
  +-- Clickable element in JSX?
  |   +-- YES -> <Link> or <NavLink>
  |   +-- NO -> After side effect (form submit, mutation)?
  |       +-- YES -> useNavigate() or redirect() in action
  |       +-- NO -> In a loader?
  |           +-- YES -> throw redirect()
  |           +-- NO -> router.navigate()
```

### Error Handling Strategy

```
Where to put error handling?
  +-- Root-level catch-all?
  |   -> errorElement on the root route (catches everything)
  +-- Per-page error UI?
  |   -> errorElement on each route (fine-grained)
  +-- Data-level not-found?
  |   -> throw new Response("Not Found", { status: 404 }) in loader
  +-- Distinguish HTTP errors from exceptions?
  |   -> isRouteErrorResponse(error) in errorElement component
```

### Layout Strategy

```
Need shared UI across routes?
  +-- Persistent layout (sidebar, header)?
  |   -> Parent route with <Outlet />
  +-- Pass data from layout to children?
  |   -> <Outlet context={...} /> + useOutletContext()
  +-- Auth guard wrapping multiple routes?
  |   -> Pathless layout route with loader that redirects
  +-- Route should escape parent layout?
  |   -> Move route outside the parent in the config
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `<BrowserRouter>` with `<Routes>` and expecting loaders/actions to work (they are Data Mode features requiring `createBrowserRouter`)
- Importing from `"react-router-dom"` in v7 (package is removed, use `"react-router"` for all imports)
- Using `json()` or `defer()` in v7 (removed, return plain objects from loaders)
- Using `return redirect()` inside shared helper functions (execution continues after the return — use `throw redirect()` to stop the entire call stack)
- Forgetting `errorElement` on the root route (unhandled loader errors crash the entire router with a white screen)

**Medium Priority Issues:**

- Forgetting `<Outlet />` in layout routes (child routes render nothing, no error shown)
- Using `useLoaderData()` in a component that does not belong to a route with a loader (returns `undefined`, hard to debug)
- Fetching data inside components with `useEffect` when a loader would eliminate the waterfall
- Using `navigation.formMethod === "post"` (v7 uppercases form methods: use `"POST"`)
- Creating multiple `<Form>` components when only one should navigate (use `useFetcher` for the others)

**Common Mistakes:**

- Returning data from an action without redirecting (users see stale UI on refresh because the action result is not a URL)
- Putting auth checks in components instead of loaders (the component renders briefly before the redirect)
- Using `navigate(-1)` for "back" without considering what "back" means when the user deep-linked (there is no history entry)
- Accessing `params` as numbers without parsing (`params.id` is always a `string`)

**Gotchas and Edge Cases:**

- Loaders for sibling routes run in parallel, but loaders for parent-child routes run sequentially (parent first, child after)
- After a successful action, ALL active loaders revalidate by default, not just the action's route — but in v7, loaders do NOT revalidate after action errors (4xx/5xx status) unless `shouldRevalidate` opts back in
- `useFetcher` does not trigger `useNavigation` state changes (fetcher state is independent)
- `shouldRevalidate` can suppress revalidation per-route, but defaults to revalidating everything after actions
- `useSearchParams` setter does NOT support React's setState queueing — multiple calls in the same tick do not build on previous values
- `route.lazy` cannot define `path`, `index`, `children`, or `id` — those must be statically defined in the route config
- The `request` in loaders and actions is a standard Web `Request` — use `request.formData()`, `request.json()`, etc.
- Throwing a `Response` object in a loader makes it available as an `ErrorResponse` via `useRouteError` — use `isRouteErrorResponse()` to type-narrow

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `createBrowserRouter` + `<RouterProvider>` for Data Mode — NEVER use `<BrowserRouter>` with `<Routes>` if you need loaders, actions, or fetchers)**

**(You MUST import from `"react-router"` — the `react-router-dom` package is removed in v7. All exports, including `RouterProvider` and `createBrowserRouter`, come from `"react-router"`)**

**(You MUST return plain objects from loaders — `json()` and `defer()` are removed in v7. Return `{ data }` directly or use `Response.json()`)**

**(You MUST use `throw redirect()` in loaders and shared helpers to short-circuit execution — `return redirect()` also works but does not stop execution in helper function call stacks)**

**(You MUST use `errorElement` or `ErrorBoundary` on routes — unhandled loader/action errors crash the entire router)**

**Failure to follow these rules will cause white screens from unhandled errors, broken data loading from wrong imports, and missed redirects in helper functions.**

</critical_reminders>
