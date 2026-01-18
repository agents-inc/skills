# Remix → React Router v7 Migration Examples

> Patterns for migrating from Remix v2 to React Router v7, including new type generation, clientAction, and Single Fetch.

---

## Type Generation with Route Module Types

React Router v7 generates types automatically from your routes. Use generated types instead of `typeof loader`.

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
export async function action({ request }: Route.ActionArgs) {
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

**Why good:** Generated types from `./+types/route-name` eliminate manual `typeof loader`, TypeScript knows exact types for params/loaderData/actionData, no need for `useLoaderData<typeof loader>()` in components

---

## clientAction for Browser-Only Mutations

Use `clientAction` when you want mutations to run entirely in the browser (no server round-trip).

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

**Why good:** clientAction takes priority when both exist, server action can still sync to database if needed, browser-only code (localStorage, DOM manipulation) stays in clientAction, no network round-trip for local-only operations

**When to use clientAction:**
- Saving to localStorage/IndexedDB
- Updating client-only UI state
- Client-side API calls (not to your own server)
- Actions that don't need server validation

**When to use action:**
- Database operations
- Authentication/authorization
- File uploads to server storage
- Operations requiring secrets/environment variables

---

## Single Fetch with Raw Object Returns

Single Fetch makes a single HTTP call for all loaders on client transitions (instead of multiple parallel requests).

### Before: Using json() utility

```typescript
// Old Remix v2 pattern
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  return json({ product }, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
```

### After: Raw objects with data() for headers

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
    }
  );
}
```

**Why good:** No unnecessary json() wrapper, data() utility only when needed for headers/status, named constant for cache duration, raw object return is simpler

---

## Streaming with Single Fetch (Replacing defer)

Single Fetch allows returning Promises directly without `defer()`.

### Before: Using defer()

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

### After: Raw Promise returns with Single Fetch

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

**Why good:** No defer() wrapper needed, Promise returned directly in object, Single Fetch handles streaming automatically, Await/Suspense pattern remains the same

---

## Import Migration

Update imports from `@remix-run/*` packages to `react-router` / `@react-router/*`.

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

## Entry File Migration

Update entry files to use new React Router v7 components.

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

**Why good:** Component name changes are straightforward, API remains the same (context + url props)

---

## package.json Scripts

Update scripts to use React Router CLI instead of Remix CLI.

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

## Red Flags During Migration

### Missing Type Generation Setup

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

**Why wrong:** React Router v7 generates types automatically, `typeof loader` is the old pattern, generated types are more accurate and include params/searchParams

### Using json() with Single Fetch

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

const CACHE_MAX_AGE = 3600;

export async function loader() {
  const result = await fetchData();
  return data(
    { result },
    {
      status: 200,
      headers: { "Cache-Control": `max-age=${CACHE_MAX_AGE}` },
    }
  );
}
```

**Why wrong:** json() serialization is unnecessary with Single Fetch, raw objects are simpler and support more types (Date, Error, Promise, RegExp), data() utility exists specifically for headers/status

---

## Gotchas During Migration

**1. Single Fetch changes revalidation behavior**
- GET navigations now revalidate loaders by default (opt-out with `shouldRevalidate`)
- Action submissions with 4xx/5xx no longer revalidate automatically (opt-in required)

**2. Types must be generated**
- Run `react-router typegen` to generate `./+types/` directories
- Add `.react-router/` to `.gitignore`
- Include `.react-router/types/**/*` in `tsconfig.json`

**3. clientAction takes priority**
- If both `action` and `clientAction` exist, only `clientAction` runs
- Server `action` is completely skipped when `clientAction` is present
- Use this intentionally for progressive enhancement

**4. Node 20+ required**
- Single Fetch requires Node 20+'s native `fetch`
- Must call `installGlobals({ nativeFetch: true })` in custom servers
- Old `@remix-run/web-fetch` polyfill won't work
