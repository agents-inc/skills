---
name: web-meta-framework-remix
description: File-based routing, loaders, actions, defer streaming, useFetcher, error boundaries, progressive enhancement
---

# Remix / React Router v7 Framework Patterns

> **Quick Guide:** A route exports a `loader` for reads and an `action` for writes, both server-only,
> so a component never fetches its own data. Forms submit without JavaScript and nested routes load
> in parallel. The version fact that changes every example below: React Router v7 deprecates `json()`
> and `defer()` — return raw objects and raw Promises, and use `data()` only when you need a custom
> status or header.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the routes directory, file naming, a route end to end
- [examples/loaders.md](examples/loaders.md) — auth, pagination, search params, caching headers
- [examples/actions.md](examples/actions.md) — validation, accessible error display, delete with confirmation
- [examples/forms.md](examples/forms.md) — several forms in one route through the `intent` field
- [examples/nested-routes.md](examples/nested-routes.md) — layouts, index routes, pathless layouts
- [examples/error-handling.md](examples/error-handling.md) — error boundaries that branch on status
- [examples/optimistic.md](examples/optimistic.md) — optimistic UI and debounced search with `useFetcher`
- [examples/deferred.md](examples/deferred.md) — streaming with `Suspense` and `Await`
- [examples/resource-routes.md](examples/resource-routes.md) — JSON APIs, webhooks, file downloads
- [examples/meta.md](examples/meta.md) — titles, Open Graph, Twitter cards, canonical URLs
- [examples/react-router-v7.md](examples/react-router-v7.md) — `routes.ts`, generated types, `clientAction`, Single Fetch
- [reference.md](reference.md) — decision trees, route module exports, hooks, response utilities

---

## Which path applies

- **On Remix v2** — the examples in this skill are written for it: `@remix-run/*` imports,
  `json()`, `defer()` and `useLoaderData<typeof loader>()`.
- **On React Router v7 framework mode** — the concepts carry over unchanged and the API does not.
  Read [examples/react-router-v7.md](examples/react-router-v7.md) first and translate as you go; the
  mapping table is below.
- **Building a page** — a `loader`, a default export, and an `ErrorBoundary`; follow
  [examples/core.md](examples/core.md).
- **Building an endpoint** — omit the default export and the route becomes a resource route; follow
  [examples/resource-routes.md](examples/resource-routes.md).

---

<migration_notice>

## Remix v2 to React Router v7

Remix has merged into React Router v7. What was planned as Remix v3 is React Router v7's "framework
mode".

| Remix v2                          | React Router v7                                      |
| --------------------------------- | ---------------------------------------------------- |
| `json(data)`                      | Return the raw object                                |
| `json(data, { status, headers })` | `data(data, { status, headers })`                    |
| `defer({ key: promise })`         | Return `{ key: promise }` — Single Fetch streams it  |
| `@remix-run/node` imports         | `react-router` / `@react-router/node`                |
| `LoaderFunctionArgs`              | `Route.LoaderArgs` (generated)                       |
| `ActionFunctionArgs`              | `Route.ActionArgs` (generated)                       |
| `useLoaderData<typeof loader>()`  | `loaderData` from `Route.ComponentProps`             |
| `RemixServer`                     | `ServerRouter`                                       |
| `RemixBrowser`                    | `HydratedRouter` (from `react-router/dom`)           |
| File-based routing by default     | `routes.ts`, with `@react-router/fs-routes` optional |

Migration guide: [Upgrading from Remix](https://reactrouter.com/upgrading/remix)

</migration_notice>

---

<critical_requirements>

## Before writing Remix code

**Export `loader` and `action` from route modules only.** The build wires them up by route, so the
same export in a helper file is dead code that silently never runs.

**Throw a Response for an expected failure — 404, 403 — and let the `ErrorBoundary` render it.**
Returning `null` instead pushes a null check onto every consumer and loses the status code.

**Await the data the page cannot render without, and return the rest as Promises.** Anything awaited
delays the first byte; anything returned as a Promise streams in behind it.

**Name HTTP status codes as constants.** `HTTP_NOT_FOUND` says what the branch is for, where `404`
has to be recognised.

</critical_requirements>

---

**Auto-detection:** loader, action, clientLoader, clientAction, useLoaderData, useActionData,
useFetcher, useNavigation, useRouteError, isRouteErrorResponse, ErrorBoundary, HydrateFallback,
shouldRevalidate, defer, Await, Outlet, NavLink, meta function, links function, @remix-run/node,
@remix-run/react, react-router, ServerRouter, HydratedRouter, Route.LoaderArgs, Route.ComponentProps,
routes.ts, Single Fetch, app/routes/

**Applies to:**

- File-based routing, including nested layouts, index routes and pathless layouts
- Server-side data loading in loaders, and mutations in actions
- Forms that work before hydration and better after it
- Streaming non-critical data behind `Suspense` and `Await`
- Non-navigating mutations, optimistic UI and debounced search with `useFetcher`
- Route-scoped error boundaries that branch on HTTP status
- SEO through `meta`, and stylesheets and preloads through `links`
- Resource routes: JSON APIs, webhooks, file downloads

**Handled elsewhere:**

- Persistence — a loader queries and an action writes; neither the client nor the query shape is
  settled here
- Session and password handling — this skill's examples call an auth layer and read what it returns
- Schema validation — an action parses `FormData`; which library defines the schema is a separate
  choice
- Styling — `links` returns stylesheet descriptors, and what is in them is someone else's concern
- React component authoring itself, outside the route module's own exports

---

<philosophy>

## Philosophy

Remix collapses full-stack development to one mental model: **a route exports a loader for reads and
an action for writes, and both run only on the server**. That is what lets a route query a database
directly without a secret reaching the browser, and it is why there is no client-side fetching
library in the picture.

Four things follow:

1. **No fetch waterfalls** — loaders run before the component renders, and nested loaders run in
   parallel with each other rather than in sequence down the tree
2. **Progressive enhancement is the default** — a `<Form>` is a real form; JavaScript makes the
   submission smoother rather than making it possible
3. **HTTP semantics rather than framework ones** — caching is `Cache-Control`, errors are status
   codes, and requests and responses are the platform's own objects
4. **The URL is the state** — a nested URL maps to a nested component tree, and search params are
   where filter and pagination state lives

```
URL change -> loaders run in parallel -> component renders -> user submits
                                                                  |
                                              action runs -> loaders revalidate
```

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: File-Based Routing

Files in `app/routes/` become URLs; the naming characters control nesting and dynamic segments.

| File              | URL           | What the name does                     |
| ----------------- | ------------- | -------------------------------------- |
| `_index.tsx`      | `/`           | Index route                            |
| `about.tsx`       | `/about`      | Static segment                         |
| `blog.$slug.tsx`  | `/blog/:slug` | `$` marks a dynamic parameter          |
| `blog_.tsx`       | `/blog`       | Trailing `_` escapes the parent layout |
| `_auth.tsx`       | none          | Leading `_` makes a pathless layout    |
| `_auth.login.tsx` | `/login`      | Nested inside that layout              |
| `$.tsx`           | `/*`          | Splat / catch-all                      |

```typescript
// app/routes/blog.$slug.tsx
const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getPostBySlug(params.slug);
  if (!post) throw new Response("Not Found", { status: HTTP_NOT_FOUND });
  return { post };
}
```

Full code: [examples/core.md](examples/core.md) and
[examples/nested-routes.md](examples/nested-routes.md)

### Pattern 2: Loaders

A loader runs on the server for the initial render and over fetch on every client navigation
afterwards.

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await getUser(params.userId);
  if (!user) {
    throw json({ message: "User not found" }, { status: HTTP_NOT_FOUND });
  }
  return json({ user });
}
```

Parent loaders re-run when a child route changes — `shouldRevalidate` is the opt-out.

Full code: [examples/loaders.md](examples/loaders.md)

### Pattern 3: Actions

An action handles every non-GET method, runs before the loaders, and the loaders revalidate after it.

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  switch (formData.get("intent")) {
    case "update":
      return json({ success: true });
    case "delete":
      return redirect("/items");
    default:
      throw new Error(`Unknown intent`);
  }
}
```

A hidden `intent` field is how one route serves several forms. Redirect after a successful mutation
so a refresh does not resubmit.

Full code: [examples/actions.md](examples/actions.md) and [examples/forms.md](examples/forms.md)

### Pattern 4: Streaming

Await what the page needs; hand back the rest as Promises.

```typescript
// Remix v2
return defer({ user, analytics: getAnalytics() });

// React Router v7 — Single Fetch streams a raw Promise
return { user, analytics: getAnalytics() };
```

```tsx
<Suspense fallback={<Skeleton />}>
  <Await resolve={analytics} errorElement={<p>Failed to load</p>}>
    {(data) => <Chart data={data} />}
  </Await>
</Suspense>
```

Stream analytics, comments and recommendations. Await auth state, the page title and anything a
crawler reads.

Full code: [examples/deferred.md](examples/deferred.md)

### Pattern 5: useFetcher

A fetcher submits or loads without navigating, which is what inline interactions need.

```typescript
const fetcher = useFetcher();

// Optimistic UI: the in-flight submission is already in fetcher.formData
const optimisticIsLiked = fetcher.formData
  ? fetcher.formData.get("liked") === "true"
  : isLiked;
```

`<Form>` for anything that should change the URL; `useFetcher` for likes, toggles, inline edits and
autocomplete.

Full code: [examples/optimistic.md](examples/optimistic.md)

### Pattern 6: Error Boundaries

An exported `ErrorBoundary` catches everything below it in the route tree, and the first branch tells
a thrown Response from an unexpected exception.

```tsx
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert">
        <h1>{error.status}</h1>
      </div>
    );
  }

  return (
    <div role="alert">
      <h1>Unexpected Error</h1>
    </div>
  );
}
```

The boundary is route-scoped, so the rest of the page keeps working.

Full code: [examples/error-handling.md](examples/error-handling.md)

### Pattern 7: Meta and Links

`meta` builds the head tags from the loader's data; `links` declares stylesheets and preloads.

```typescript
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Not Found" }];
  return [
    { title: `${data.post.title} | ${SITE_NAME}` },
    { property: "og:title", content: data.post.title },
    { tagName: "link", rel: "canonical", href: url },
  ];
};
```

`meta` receives `undefined` data when the loader threw, and `links` cannot see loader data at all —
a dynamic `<link>` goes through `meta` with `tagName: "link"`.

Full code: [examples/meta.md](examples/meta.md)

### Pattern 8: Resource Routes

A route module with no default export renders nothing and returns whatever its loader or action
does.

```typescript
// app/routes/api.health.ts
export async function loader() {
  return json({ status: "healthy", timestamp: new Date().toISOString() });
}
```

Full code: [examples/resource-routes.md](examples/resource-routes.md)

### Pattern 9: Nested Routes

Nested routes share the parent's layout and load alongside it rather than after it, so an auth check
in a parent layout protects every child.

| File                  | Role                                       |
| --------------------- | ------------------------------------------ |
| `admin.tsx`           | Layout — renders `<Outlet />`              |
| `admin._index.tsx`    | What renders at `/admin` itself            |
| `admin.users.tsx`     | A child route                              |
| `admin_.settings.tsx` | `/admin/settings` without the admin layout |
| `_auth.tsx`           | A layout that contributes no URL segment   |

Full code: [examples/nested-routes.md](examples/nested-routes.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `loader` or `action` exported from a file that is not a route module — nothing calls it
- `<Form>` with no `method="post"` — it submits as a GET, so the action never runs
- `defer()` without a `<Suspense>` and `<Await>` around the consumer
- A form action targeting an index route without `?index` — the parent's action receives it
- `meta` reading `data` without a null branch — `data` is `undefined` when the loader threw
- A secret in a module a route component imports — route modules are bundled for the browser, unlike
  loaders and actions

**Surprising behaviour:**

- Every parent loader re-runs on a child navigation, so an expensive parent query runs far more often
  than expected — `shouldRevalidate` is the control
- All loaders revalidate after an action, whether or not they relate to what it changed
- `links` cannot access loader data, so a dynamic stylesheet URL has to go through `meta`
- On React Router v7, `clientAction` takes priority when both exist, and the server `action` is
  skipped unless the `clientAction` calls it
- Returning `null` from a loader compiles and type-checks, and pushes the failure to whatever renders
  it
- A `useFetcher` with no optimistic read of `fetcher.formData` shows nothing until the round trip
  finishes

</red_flags>
