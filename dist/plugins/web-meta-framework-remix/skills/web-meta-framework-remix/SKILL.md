---
name: web-meta-framework-remix
description: File-based routing, loaders, actions, defer streaming, useFetcher, error boundaries, progressive enhancement
---

# Remix / React Router v7 Framework Patterns

> **Quick Guide:** Each route exports a `loader` for reads and an `action` for writes. Both run on the server. Data flows through loaders, mutations go through actions, forms work without JavaScript, and nested routes enable parallel data loading. `json()` and `defer()` are deprecated in React Router v7 -- return raw objects instead, use `data()` for custom headers/status.

---

<migration_notice>

## IMPORTANT: React Router v7 Migration

**Remix has merged into React Router v7.** What was planned as Remix v3 is now React Router v7 "framework mode".

| Remix v2 (Deprecated)             | React Router v7 (Current)                    |
| --------------------------------- | -------------------------------------------- |
| `json(data)`                      | Return raw objects directly                  |
| `json(data, { status, headers })` | `data(data, { status, headers })`            |
| `defer({ key: promise })`         | Return `{ key: promise }` with Single Fetch  |
| `@remix-run/node` imports         | `react-router` / `@react-router/node`        |
| `LoaderFunctionArgs`              | `Route.LoaderArgs` (generated types)         |
| `ActionFunctionArgs`              | `Route.ActionArgs` (generated types)         |
| `useLoaderData<typeof loader>()`  | `loaderData` prop via `Route.ComponentProps` |
| `RemixServer`                     | `ServerRouter` (from `react-router`)         |
| `RemixBrowser`                    | `HydratedRouter` (from `react-router/dom`)   |

**This skill covers both Remix v2 and React Router v7 patterns.** Examples use Remix v2 imports by default with RR v7 equivalents documented in [examples/react-router-v7.md](examples/react-router-v7.md).

**Migration guide:** [Upgrading from Remix](https://reactrouter.com/upgrading/remix)

</migration_notice>

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST export loaders and actions as named exports from route modules only -- they do not work in non-route files)**

**(You MUST throw Response objects for expected errors (404, 403) -- use ErrorBoundary for handling)**

**(You MUST await critical data and return non-critical data as Promises for streaming)**

**(You MUST use named constants for HTTP status codes -- no magic numbers)**

</critical_requirements>

---

**Auto-detection:** Remix routes, React Router v7, loader function, action function, clientAction, clientLoader, useLoaderData, useActionData, useFetcher, defer, ErrorBoundary, Form component, meta function, links function, Single Fetch, ServerRouter, HydratedRouter, Route.LoaderArgs, Route.ComponentProps, shouldRevalidate

**When to use:**

- Building full-stack React applications with server-side rendering
- Implementing data loading with loaders and mutations with actions
- Creating progressively enhanced forms that work without JavaScript
- Streaming non-critical data with defer/Promises and Suspense
- Handling errors gracefully with route-level ErrorBoundary

**When NOT to use:**

- Static sites without server-side logic
- Simple SPAs without server rendering needs
- Projects already committed to a different meta-framework

**Key patterns covered:**

- File-based routing (routes/, \_index, $params, \_layout)
- Loaders for server-side data fetching
- Actions for mutations with progressive enhancement
- Streaming with defer() / raw Promises (RR v7)
- useFetcher for non-navigation mutations and optimistic UI
- Error boundaries with multi-status handling
- Meta and Links functions for SEO
- Resource routes (API endpoints, file downloads)
- Nested routing with parallel data loading
- React Router v7 migration (Single Fetch, type generation, clientAction)

---

<philosophy>

## Philosophy

Remix simplifies full-stack development to a single mental model: **each route exports a loader for reads and an action for writes**. Both functions execute exclusively on the server, enabling direct database access without exposing secrets to the client.

**Core Principles:**

1. **Server-first data loading**: Loaders run on the server before rendering, eliminating client-side data fetching waterfalls
2. **Progressive enhancement**: Forms work with plain POST requests -- JavaScript enhances but isn't required
3. **HTTP semantics**: Caching uses standard HTTP headers (Cache-Control), not framework-specific solutions
4. **Nested routes**: URL segments map to component hierarchy, enabling parallel data loading
5. **Web standards**: Uses Fetch API Request/Response objects throughout

**Data Flow:**

```
URL Change -> Loader(s) Execute -> Component Renders -> User Interacts
                                                            |
                                          Action Executes -> Loaders Revalidate
```

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: File-Based Routing

Files in `app/routes/` become URL paths. File naming conventions control nesting, layouts, and dynamic segments.

| File Name         | URL           | Description                   |
| ----------------- | ------------- | ----------------------------- |
| `_index.tsx`      | `/`           | Index route (root)            |
| `about.tsx`       | `/about`      | Static route                  |
| `blog.$slug.tsx`  | `/blog/:slug` | Dynamic parameter             |
| `blog_.tsx`       | `/blog`       | Pathless layout escape        |
| `_auth.tsx`       | (none)        | Layout route (no URL segment) |
| `_auth.login.tsx` | `/login`      | Route nested in layout        |
| `$.tsx`           | `/*`          | Splat/catch-all route         |

```typescript
// app/routes/blog.$slug.tsx -- dynamic route with loader
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await db.post.findUnique({ where: { slug: params.slug } });
  if (!post) throw new Response("Not Found", { status: 404 });
  return { post };
}
```

**Why good:** File names map directly to URLs, `$` prefix for dynamic segments, loader params are typed

See [examples/core.md](examples/core.md) for complete route examples and [examples/nested-routes.md](examples/nested-routes.md) for layout nesting patterns.

---

### Pattern 2: Loaders for Data Fetching

Loaders are server-only functions that provide data to routes. They run on initial server render and on client navigation via fetch.

```typescript
const HTTP_NOT_FOUND = 404;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw json({ message: "User not found" }, { status: HTTP_NOT_FOUND });
  }
  return json({ user });
}
```

**Key rules:**

- Always throw Response for expected errors (triggers ErrorBoundary)
- Use `useLoaderData<typeof loader>()` for type-safe access (or `Route.ComponentProps` in RR v7)
- Loaders run on every navigation -- parent loaders re-run even for child route changes
- Use `shouldRevalidate` to optimize unnecessary re-runs

See [examples/loaders.md](examples/loaders.md) for authentication, pagination, and caching examples.

---

### Pattern 3: Actions for Mutations

Actions handle non-GET requests (POST, PUT, DELETE, PATCH). They run before loaders and enable progressive form handling.

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "update": {
      /* ... */ return json({ success: true });
    }
    case "delete": {
      /* ... */ return redirect("/items");
    }
    default:
      throw new Error(`Unknown intent: ${intent}`);
  }
}
```

**Key rules:**

- Use hidden `intent` field for multiple actions in one route
- Redirect after successful mutations to prevent double-submission
- Return validation errors with `json({ errors }, { status: 400 })`
- Forms work without JavaScript -- progressive enhancement by default

See [examples/actions.md](examples/actions.md) for validation and [examples/forms.md](examples/forms.md) for multi-form patterns.

---

### Pattern 4: Streaming with defer / Promises

Await critical data, return Promises for non-critical data that can stream in.

```typescript
// Remix v2: use defer()
return defer({
  user, // Awaited -- critical
  analytics: getAnalytics(), // Promise -- streams in
});

// React Router v7: return raw objects with Promises
return {
  user, // Awaited -- critical
  analytics: getAnalytics(), // Promise -- streams via Single Fetch
};
```

Render streamed data with `<Suspense>` + `<Await>`:

```tsx
<Suspense fallback={<Skeleton />}>
  <Await resolve={analytics} errorElement={<p>Failed to load</p>}>
    {(data) => <Chart data={data} />}
  </Await>
</Suspense>
```

**When to stream:** Analytics, comments, recommendations, secondary content below the fold.
**When NOT to stream:** Auth state, page title, SEO-critical content, data for page structure.

See [examples/deferred.md](examples/deferred.md) for complete streaming examples.

---

### Pattern 5: useFetcher for Non-Navigation Mutations

`useFetcher` enables data loading and mutations without page navigation. Essential for inline interactions.

```typescript
const fetcher = useFetcher();

// Optimistic UI: show expected state immediately
const optimisticIsLiked = fetcher.formData
  ? fetcher.formData.get("liked") === "true"
  : isLiked;
```

**Use `<Form>` for:** Create/login/wizards -- actions that should change the URL.
**Use `useFetcher` for:** Like buttons, toggles, inline editing, search autocomplete.

See [examples/optimistic.md](examples/optimistic.md) for optimistic UI and debounced search.

---

### Pattern 6: Error Boundaries

Export `ErrorBoundary` from route modules. Distinguish between thrown Response errors and unexpected JavaScript errors.

```typescript
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // Thrown Response: render status-specific UI
    return <div role="alert"><h1>{error.status}</h1></div>;
  }

  if (error instanceof Error) {
    // Unexpected error: generic fallback
    return <div role="alert"><h1>Unexpected Error</h1></div>;
  }

  return <div role="alert"><h1>Unknown Error</h1></div>;
}
```

**Key rules:**

- Throw `json({ message }, { status: 404 })` for expected errors
- ErrorBoundary is route-scoped -- rest of the page stays functional
- Use named constants for HTTP status codes
- `isRouteErrorResponse()` checks if error was a thrown Response

See [examples/error-handling.md](examples/error-handling.md) for multi-status error boundaries.

---

### Pattern 7: Meta and Links Functions

Export `meta` for SEO metadata and `links` for stylesheets/preloads.

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

**Gotcha:** `meta` function receives null data on error -- always handle the missing data case.
**Gotcha:** `links` function cannot access loader data -- use `meta` with `tagName: "link"` for dynamic links.

See [examples/meta.md](examples/meta.md) for Open Graph and Twitter Card patterns.

---

### Pattern 8: Resource Routes

Routes without a default export become resource routes -- useful for APIs, webhooks, and file downloads.

```typescript
// app/routes/api.health.ts (no default export = resource route)
export async function loader() {
  return json({ status: "healthy", timestamp: new Date().toISOString() });
}
```

See [examples/resource-routes.md](examples/resource-routes.md) for webhook and file download examples.

---

### Pattern 9: Nested Routes and Layouts

Nested routes share parent layouts and load data in parallel. Parent loaders provide shared data, child loaders run concurrently.

| Pattern               | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `admin.tsx`           | Layout (has `<Outlet />`)                      |
| `admin._index.tsx`    | Index route (renders at parent URL)            |
| `admin.users.tsx`     | Nested child route                             |
| `admin_.settings.tsx` | Escapes parent layout with trailing underscore |
| `_auth.tsx`           | Pathless layout with leading underscore        |

See [examples/nested-routes.md](examples/nested-routes.md) for admin layout and pathless layout examples.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - File-based routing, route naming, essential hooks
- [examples/loaders.md](examples/loaders.md) - Protected routes, pagination, caching headers
- [examples/actions.md](examples/actions.md) - Signup forms, validation, delete with confirmation
- [examples/forms.md](examples/forms.md) - Multiple forms in one route, intent pattern
- [examples/nested-routes.md](examples/nested-routes.md) - Layouts, pathless routes, admin panels
- [examples/error-handling.md](examples/error-handling.md) - Multi-status error boundaries
- [examples/optimistic.md](examples/optimistic.md) - Optimistic UI, debounced search
- [examples/deferred.md](examples/deferred.md) - Streaming with defer/Promises
- [examples/resource-routes.md](examples/resource-routes.md) - API endpoints, webhooks, file downloads
- [examples/meta.md](examples/meta.md) - SEO meta tags, Open Graph, Twitter Cards
- [examples/react-router-v7.md](examples/react-router-v7.md) - Migration: type generation, clientAction, Single Fetch
- [reference.md](reference.md) - Decision frameworks, anti-patterns, route module exports

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Loaders/actions exported from non-route files -- Remix only runs these from route modules
- Missing type inference -- always use `useLoaderData<typeof loader>()` or `Route.ComponentProps`
- Client-side data fetching with useEffect + fetch -- use loaders for server data
- Returning null from loader instead of throwing Response -- every consumer must null-check

**Medium Priority Issues:**

- Streaming critical data (page title, auth state) -- causes content flicker
- useFetcher without optimistic UI -- makes interactions feel slow
- Magic numbers for HTTP status codes -- use named constants
- Form without `method="post"` -- defaults to GET, action not called

**Gotchas & Edge Cases:**

- Loader runs on every navigation -- even for child route changes, parent loaders re-run (use `shouldRevalidate` to optimize)
- Action runs before all loaders -- after action, all loaders revalidate by default
- `defer()` requires `<Suspense>` + `<Await>` wrapper -- forgetting causes errors
- Index routes need `?index` query param for form actions targeting them
- `meta` function receives null data on error -- must handle missing data case
- `links` function cannot access loader data -- use `meta` with `tagName: "link"` for dynamic links
- In React Router v7, `clientAction` takes priority when both `action` and `clientAction` exist -- server action is completely skipped

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST export loaders and actions as named exports from route modules only -- they do not work in non-route files)**

**(You MUST throw Response objects for expected errors (404, 403) -- use ErrorBoundary for handling)**

**(You MUST await critical data and return non-critical data as Promises for streaming)**

**(You MUST use named constants for HTTP status codes -- no magic numbers)**

**Failure to follow these rules will break data loading, type safety, and error handling.**

</critical_reminders>
