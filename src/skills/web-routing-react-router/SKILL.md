---
name: web-routing-react-router
description: Client-side routing with data APIs — loaders, actions, error boundaries, search params, nested layouts, and code splitting
---

# React Router Patterns

> **Quick Guide:** This skill covers React Router v7 **Data Mode** — `createBrowserRouter` plus loaders, actions, fetchers and pending states, without a full framework. Four v7 facts change the answer: every export comes from `"react-router"`, with the DOM-only ones — `RouterProvider` included — also on `"react-router/dom"`, while `react-router-dom` survives v7 as a deprecated re-export and is deleted in v8; `json()` and `defer()` are removed so loaders return plain objects; form method values are uppercase (`"POST"`); and loaders skip revalidation after an action error unless `shouldRevalidate` opts back in.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — router setup, root layout, root error boundary, and the two v7 migration traps
- [examples/data-loading.md](examples/data-loading.md) — loaders, actions, `<Form>`, `useFetcher`, optimistic UI, `shouldRevalidate`, deferred data
- [examples/navigation.md](examples/navigation.md) — `Link`, `NavLink`, `useNavigate`, `redirect`, `useSearchParams` wired to loaders
- [examples/error-handling.md](examples/error-handling.md) — error bubbling, thrown responses, pending UI, `route.lazy`
- [examples/layouts.md](examples/layouts.md) — `Outlet`, `useOutletContext`, pathless auth layouts, `useBlocker`
- [reference.md](reference.md) — route options, hook and component tables, `createBrowserRouter` options

---

## Which path applies

React Router ships three modes, and only one of them has the data APIs.

- **Data Mode** — `createBrowserRouter` + `<RouterProvider>`. Loaders, actions, fetchers and `errorElement` all work. This is the skill; start at [examples/core.md](examples/core.md).
- **Declarative Mode** — `<BrowserRouter>` + `<Routes>`. URL matching and `<Link>` only. A `loader` prop here is silently ignored, so reach for it when there is no data to load and nothing in this skill's patterns applies.
- **Framework Mode** — file-based routes, SSR and streaming through the router's own bundler plugin. A separate surface with its own conventions, not covered here.

---

<critical_requirements>

## Before writing React Router code

**Import everything from `"react-router"`, and `RouterProvider` from `"react-router/dom"`** — that copy wires up `react-dom`'s `flushSync`. `react-router-dom` still installs in v7 as a re-export, so a stale import fails no build and nothing tells you; v8 deletes the package.

**Reach for `createBrowserRouter` + `<RouterProvider>` whenever a loader, action or fetcher is involved.** Those are Data Mode features; under `<BrowserRouter>` the props are accepted and ignored, with no error to tell you.

**Return plain objects from loaders**, or a `Response` you built yourself. `json()` and `defer()` were removed in v7.

**Use `throw redirect()` rather than `return redirect()`.** Throwing unwinds the whole call stack, which is what makes a shared `requireAuth()` helper stop the loader that called it.

**Give the root route an `errorElement` or `ErrorBoundary`.** It is the last catch in the tree; without one, a single loader failure replaces the app with the router's built-in error dump.

</critical_requirements>

---

**Auto-detection:** createBrowserRouter, RouterProvider, useLoaderData, useActionData, useNavigation, useSearchParams, useFetcher, useRouteError, isRouteErrorResponse, useOutletContext, useRevalidator, useBlocker, Outlet, NavLink, errorElement, shouldRevalidate, route.lazy, HydrateFallback

**Applies to:**

- Route trees with data loading, form actions and pending states
- Nested layouts with persistent shared UI
- Route-level error boundaries and not-found handling
- URL search params as application state
- Non-navigating mutations — inline forms, toggles, auto-save
- Route-level code splitting

**Handled elsewhere:**

- Caching and deduplicating server data across routes — a loader fetches per navigation, and whatever owns data fetching decides what is cached between them.
- Client state that has no business in the URL — this skill settles URL-shaped state only.
- Styling active and pending links — `NavLink` hands its state to a `className` or `style` function, and what those return is not its concern.
- Server rendering, streaming HTML and file-based route generation.

---

<philosophy>

React Router v7 treats the router as a data layer rather than a URL matcher. A route declares what to load (`loader`), what mutations it accepts (`action`), and what catches failures (`errorElement`) — all before its component renders. That moves orchestration out of components and removes the fetch-on-mount waterfall.

- **Routes own their data.** Components receive it; they do not fetch it.
- **The URL is the source of truth.** Path params, search params and navigation state all live there.
- **Errors bubble.** An error rises to the nearest `errorElement`, leaving parent layouts on screen.
- **Revalidation is automatic.** A successful action re-runs every active loader, so there is no cache to invalidate by hand.

</philosophy>

---

<decision_framework>

## Where the logic goes

```
What does this code do?
  +-- Fetch data the component needs?      -> loader (parallel with sibling loaders)
  +-- Handle a form submission?            -> action (reads FormData, returns errors or redirects)
  +-- Mutate without changing the URL?     -> useFetcher (independent state, runs concurrently)
  +-- Gate access to a subtree?            -> pathless layout route whose loader throws redirect()
```

## How to navigate

```
Where are you?
  +-- In JSX, on something clickable?      -> <Link> or <NavLink>
  +-- In a handler, after a side effect?   -> useNavigate()
  +-- In a loader or action?               -> throw redirect()
  +-- Outside the React tree entirely?     -> router.navigate() on the router object
```

The last one is the only route out of a module that never renders — a fetch wrapper redirecting on a 401, for instance. The hooks all need a component.

## Where to catch errors

Put `errorElement` on the root for a guaranteed catch, and on individual routes where the failure has its own UI — a missing post reads differently from a failed dashboard. Throw a `Response` from a loader (`throw new Response("Not Found", { status: 404 })`) to make the failure an HTTP error that `isRouteErrorResponse` can narrow.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Data Mode setup

Routes are objects, defined outside React so the router can run loaders before anything mounts.

```typescript
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "posts", element: <PostsPage />, loader: postsLoader },
    ],
  },
]);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Loaders and actions

A loader runs before render; an action handles submissions. Both receive `{ request, params }`, where `request` is a standard Web `Request`. Sibling loaders run in parallel, parent before child.

```typescript
export async function postsLoader({ request }: LoaderFunctionArgs) {
  const response = await fetch("/api/posts");
  if (!response.ok) throw new Response("Failed to load", { status: 500 });
  return { posts: await response.json() };
}

export async function createPostAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const post = await createPost({ title: formData.get("title") });
  throw redirect(`/posts/${post.id}`);
}
```

Full code: [examples/data-loading.md](examples/data-loading.md)

---

### Pattern 3: Error boundaries with errorElement

`errorElement` catches failures from the route's loader, action and component alike. `isRouteErrorResponse` separates a thrown `Response` from an unexpected exception.

```typescript
function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <p role="alert">{error.status}: {error.statusText}</p>;
  }
  return <p role="alert">{error instanceof Error ? error.message : "Unknown error"}</p>;
}
```

Full code: [examples/error-handling.md](examples/error-handling.md)

---

### Pattern 4: Nested layouts with Outlet

A parent route renders `<Outlet />` where its matched child goes. The layout survives child navigation, so sidebars and their state persist.

```typescript
function DashboardLayout() {
  return (
    <div>
      <nav><NavLink to="/dashboard" end>Overview</NavLink></nav>
      <main><Outlet /></main>
    </div>
  );
}
```

Full code: [examples/layouts.md](examples/layouts.md)

---

### Pattern 5: Navigation state with useNavigation

`navigation.state` is `"idle"`, `"loading"` (a loader is running) or `"submitting"` (an action is). One indicator in the root layout covers the whole app.

```typescript
function GlobalSpinner() {
  const navigation = useNavigation();
  if (navigation.state === "idle") return null;
  return <div role="progressbar" aria-busy="true" />;
}
```

Full code: [examples/error-handling.md](examples/error-handling.md)

---

### Pattern 6: Non-navigating mutations with useFetcher

`fetcher.Form` submits to an action without changing the URL. Fetchers carry independent `state` and `data`, several can be in flight at once, and active loaders still revalidate when each one finishes.

```typescript
function DeleteButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="POST" action={`/posts/${postId}/delete`}>
      <button type="submit" disabled={fetcher.state !== "idle"}>Delete</button>
    </fetcher.Form>
  );
}
```

Full code: [examples/data-loading.md](examples/data-loading.md)

---

### Pattern 7: Code splitting with route.lazy

`route.lazy` defers a route module until navigation. The function form ships one chunk; the v7.5+ object form splits each property so the loader and the component download in parallel.

```typescript
{ path: "admin", lazy: () => import("./pages/admin") }

{
  path: "admin",
  lazy: {
    loader: async () => (await import("./pages/admin.loader")).loader,
    Component: async () => (await import("./pages/admin.component")).AdminPage,
  },
}
```

Full code: [examples/error-handling.md](examples/error-handling.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Importing from `"react-router-dom"` — deprecated in v7 and deleted in v8, and it still resolves today so nothing tells you — import from `"react-router"`, or `"react-router/dom"` for `RouterProvider`.
- Calling `json()` or `defer()` — removed in v7 — return a plain object, or a promise for the deferred half and read it with `<Await>`.
- `loader` or `action` on a `<Route>` under `<BrowserRouter>` — accepted and ignored with no warning — switch the tree to `createBrowserRouter`.
- No `errorElement` anywhere in the tree — one loader failure replaces the app with the router's default error dump — put one on the root.
- `return redirect()` inside a shared helper — the caller carries on with a `Response` as its return value — `throw` it instead.
- A layout that renders no `<Outlet />` — matched children render nowhere, silently.
- `useLoaderData()` in a component whose route has no loader — returns `undefined` well away from the cause.
- `navigation.formMethod === "post"` — v7 uppercases form methods — compare against `"POST"`.

**Surprising behaviour:**

- After a successful action every active loader revalidates, not just the acting route's. After an action _error_ none of them do, unless `shouldRevalidate` opts back in.
- `useFetcher` never moves `useNavigation` state; the two are independent.
- The `useSearchParams` setter does not queue like `setState` — two calls in one tick do not build on each other, so use the callback form.
- `route.lazy` cannot supply `path`, `index`, `children` or `id`; those stay in the static config.
- `params` values are always strings — parse in the loader rather than in the component.
- Returning data from an action instead of redirecting leaves the result unaddressable, so a refresh shows the pre-mutation UI.
- `navigate(-1)` assumes a history entry that a deep-linked visitor does not have.

</red_flags>
