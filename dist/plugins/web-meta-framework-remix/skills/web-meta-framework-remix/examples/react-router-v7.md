# Remix to React Router v7

> The migration in code: `routes.ts`, generated types, `clientAction`, Single Fetch, and the import
> and entry-file renames. The mapping table is in [SKILL.md](../SKILL.md).

---

## Route Configuration with routes.ts

`app/routes.ts` is the entry point in framework mode. File conventions still work, as an opt-in
through `@react-router/fs-routes`.

### Config-based routes (the default)

```typescript
// app/routes.ts
import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [
  index("./home.tsx"),
  route("about", "./about.tsx"),
  layout("./auth/layout.tsx", [
    route("login", "./auth/login.tsx"),
    route("register", "./auth/register.tsx"),
  ]),
  ...prefix("admin", [
    index("./admin/home.tsx"),
    route("users", "./admin/users.tsx"),
    route("users/:userId", "./admin/user-detail.tsx"),
  ]),
] satisfies RouteConfig;
```

**Why good:** The route tree is a value rather than a naming convention, so nesting is visible at a
glance instead of inferred from dots and underscores — and `satisfies RouteConfig` type-checks it.

### File-based routes (opt-in)

```typescript
// app/routes.ts -- use @react-router/fs-routes for Remix-style file conventions
import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;
```

**Why good:** The Remix v2 naming conventions (`$param`, `_layout`, `_index`) keep working, so an
existing `app/routes/` directory migrates without being rewritten.

### Both at once

```typescript
// app/routes.ts -- combine config + file-based
import { type RouteConfig, route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  route("api/health", "./api/health.ts"),
  ...(await flatRoutes()),
] satisfies RouteConfig;
```

**Key change:** Remix v2 read the file tree by default; React Router v7 reads `routes.ts`, and the file
tree only if that file asks for it.

---

## Generated Route Types

Types are generated from the route tree, so `typeof loader` is no longer how a component learns its
data's shape.

```typescript
// app/routes/products.$productId.tsx
import type { Route } from "./+types/products.$productId";
import { Form } from "react-router";

const HTTP_NOT_FOUND = 404;

// Route.LoaderArgs replaces LoaderFunctionArgs
export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  if (!product) {
    throw new Response("Not Found", { status: HTTP_NOT_FOUND });
  }

  return { product };
}

// Route.ActionArgs replaces ActionFunctionArgs
export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;

  const product = await db.product.update({
    where: { id: params.productId },
    data: { title },
  });

  return { product };
}

// Route.ComponentProps provides typed props
export default function ProductPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <div>
      <h1>{loaderData.product.name}</h1>

      <Form method="post">
        <input type="text" name="title" defaultValue={loaderData.product.name} />
        <button type="submit">Update</button>
      </Form>

      {actionData && <p>Product updated!</p>}
    </div>
  );
}
```

**Why good:** `params` is typed from the route pattern rather than as `Record<string, string |
undefined>`, so a typo in a parameter name is a compile error. The component takes `loaderData` as a
prop, which means it can be rendered in a test without a router around it.

---

## clientAction

A `clientAction` runs the mutation in the browser instead of sending it to the server.

```typescript
// app/routes/settings.preferences.tsx
import type { Route } from "./+types/settings.preferences";
import { Form } from "react-router";

const STORAGE_KEY = "user-preferences";

// Server action - saves to database
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme") as string;

  const session = await getSession(request);
  await db.userPreferences.update({
    where: { userId: session.userId },
    data: { theme },
  });

  return { success: true };
}

// Client action - saves to localStorage (runs INSTEAD of server action)
export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme") as string;

  // Browser-only code
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
  document.documentElement.setAttribute("data-theme", theme);

  return { success: true };
}

export default function PreferencesPage({ actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <label>
        <input type="radio" name="theme" value="light" />
        Light
      </label>
      <label>
        <input type="radio" name="theme" value="dark" />
        Dark
      </label>
      <button type="submit">Save Preferences</button>
      {actionData?.success && <span>Saved!</span>}
    </Form>
  );
}
```

**Why good:** `localStorage` and DOM writes cannot happen on the server, so this is where they belong —
and the theme applies with no round trip at all.

`clientAction` suits browser storage, client-only UI state, and calls to a third-party API. `action`
suits anything touching the database, the session, server storage, or a secret. Note which one wins:
when both exist, only `clientAction` runs, and the server `action` is skipped unless the
`clientAction` invokes it.

---

## Single Fetch

One HTTP request carries every loader's data on a client transition, rather than one request per
loader.

### Before: the json() wrapper

```typescript
// Old Remix v2 pattern
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  return json(
    { product },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
```

### After: raw objects, with data() only for headers

```typescript
// React Router v7 with Single Fetch
import { data } from "react-router";
import type { Route } from "./+types/products.$productId";

const CACHE_MAX_AGE_SECONDS = 60;

export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  // Return raw object if no custom headers
  // return { product };

  // Use data() utility only when you need custom headers or status
  return data(
    { product },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
      },
    },
  );
}
```

**Why good:** Single Fetch serialises richer types than JSON does — `Date`, `Error`, `Promise`,
`RegExp` and `Map` survive the trip — so the `json()` round trip through a string was both a step and
a downgrade. `data()` remains for the case the raw return cannot express: a custom status or header.

---

## Streaming without defer()

### Before: defer()

```typescript
// Old Remix v2 pattern
import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

export async function loader() {
  const user = await getUser(); // Critical data

  return defer({
    user,
    analytics: getAnalytics(user.id), // Non-critical - deferred Promise
  });
}

export default function Dashboard() {
  const { user, analytics } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Welcome, {user.name}</h1>

      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={analytics}>
          {(data) => <AnalyticsChart data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

### After: return the Promise

```typescript
// React Router v7 with Single Fetch
import type { Route } from "./+types/dashboard";
import { Await } from "react-router";
import { Suspense } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request); // Critical data - await it

  // Return Promise directly - no defer() needed
  return {
    user,
    analytics: getAnalytics(user.id), // Non-critical - returned as Promise
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user, analytics } = loaderData;

  return (
    <div>
      <h1>Welcome, {user.name}</h1>

      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={analytics}>
          {(data) => <AnalyticsChart data={data} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

**Why good:** A Promise in the returned object is now enough to mark it streamable, so the distinction
between awaited and streamed data is visible in the loader itself rather than in a wrapper call. The
`Suspense` and `Await` half of the pattern is unchanged.

---

## Imports

```typescript
// Before: Remix v2 imports
import { redirect, json } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

// After: React Router v7 imports
import { redirect, data } from "react-router"; // Note: data() replaces json()
import { Form } from "react-router";
import type { Route } from "./+types/my-route";

// Runtime-specific APIs still use @react-router namespace
import { createFileSessionStorage } from "@react-router/node";
```

**Key changes:**

- `@remix-run/react` → `react-router`
- `@remix-run/node` → `react-router` (most APIs) or `@react-router/node` (runtime-specific)
- `@remix-run/server-runtime` → `react-router`
- Type imports → `./+types/route-name` (generated types)

---

## Entry Files

### entry.server.tsx

```typescript
// Before: Remix v2
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  // ...
}

// After: React Router v7
import { ServerRouter } from "react-router";
import { renderToString } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const markup = renderToString(
    <ServerRouter context={remixContext} url={request.url} />
  );

  // ...
}
```

### entry.client.tsx

```typescript
// Before: Remix v2
import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";

hydrateRoot(
  document,
  <RemixBrowser />
);

// After: React Router v7
import { HydratedRouter } from "react-router/dom";
import { hydrateRoot } from "react-dom/client";

hydrateRoot(
  document,
  <HydratedRouter />
);
```

**Why good:** Only the component names change; the props and the surrounding code are identical, so
both entry files are a rename.

---

## package.json Scripts

```json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve build/server/index.js",
    "typecheck": "react-router typegen && tsc"
  }
}
```

**Key changes:**

- `remix vite:dev` → `react-router dev`
- `remix vite:build` → `react-router build`
- `remix-serve` → `react-router-serve`
- Add `react-router typegen` before `tsc` for type generation

---

## What Goes Wrong

### Still using typeof loader

```typescript
// WRONG - Still using typeof loader after migration
export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();
  // ...
}

// CORRECT - Use generated Route types
export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  // ...
}
```

**Why wrong:** It still compiles, which is what makes it easy to leave behind — but the generated types
know the route's params and search params as well as its loader data, and `typeof loader` knows only
the last.

### json() under Single Fetch

```typescript
// WRONG - json() is deprecated with Single Fetch
import { json } from "react-router";

export async function loader() {
  const data = await fetchData();
  return json({ data }); // Unnecessary wrapper
}

// CORRECT - Return raw objects
export async function loader() {
  const data = await fetchData();
  return { data }; // Direct return
}

// CORRECT - Use data() only when headers/status needed
import { data } from "react-router";

const HTTP_OK = 200;
const CACHE_MAX_AGE = 3600;

export async function loader() {
  const result = await fetchData();
  return data(
    { result },
    {
      status: HTTP_OK,
      headers: { "Cache-Control": `max-age=${CACHE_MAX_AGE}` },
    },
  );
}
```

**Why wrong:** The wrapper narrows what can cross the boundary — a `Date` comes back as a string, and a
`Promise` cannot be sent at all, which is the whole of what Single Fetch adds.

---

## Migration Gotchas

**Revalidation changed.** GET navigations revalidate every loader by default; `shouldRevalidate` is
the opt-out. Action submissions returning 4xx or 5xx no longer revalidate, and that is now the
opt-in.

**Types have to be generated.** Run `react-router typegen` to create the `./+types/` directories, add
`.react-router/` to `.gitignore`, and include `.react-router/types/**/*` in `tsconfig.json`. Without
this step every `./+types/` import fails to resolve.

**`clientAction` wins.** When both exist, only `clientAction` runs — the server `action` is skipped
unless the `clientAction` calls it explicitly.

**Node 20+.** Single Fetch depends on the native `fetch`; a custom server needs
`installGlobals({ nativeFetch: true })`, and the `@remix-run/web-fetch` polyfill does not work.
