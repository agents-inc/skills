# Next.js 15 and 16 Features

> Code for the features added in 15.x and the ones that changed shape in 16. The version tables,
> removals and requirements are in [reference.md](../reference.md); this file is the working code.
> See [core.md](core.md) for routing and layouts.

---

## Partial Prerendering (PPR) — 15.x only

Prerender the static shell and stream the dynamic parts into it.

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: "incremental", // opt in per route
  },
};

export default nextConfig;
```

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { StaticHeader } from "./static-header";
import { DynamicStats } from "./dynamic-stats";
import { StatsSkeleton } from "./skeletons";

export const experimental_ppr = true;

export default function DashboardPage() {
  return (
    <div>
      <StaticHeader /> {/* prerendered at build time */}
      <Suspense fallback={<StatsSkeleton />}>
        <DynamicStats /> {/* streams in at request time */}
      </Suspense>
    </div>
  );
}
```

```tsx
// app/dashboard/dynamic-stats.tsx
import { cookies } from "next/headers";

export async function DynamicStats() {
  const cookieStore = await cookies(); // a dynamic API makes this component dynamic
  const userId = cookieStore.get("userId")?.value;
  return <StatsDisplay stats={await fetchUserStats(userId)} />;
}
```

**Why good:** A page that is mostly chrome plus one personalised panel gets the static page's
first paint and the dynamic page's freshness.

**When to use:** Dashboards and product pages — a static layout wrapping user-specific content.
Fully static or fully dynamic pages gain nothing.

**On Next.js 16:** `experimental.ppr` and `experimental_ppr` are gone. Use `cacheComponents: true`
with `"use cache"`, below.

---

## `next/form`

An HTML form that prefetches its destination and navigates client-side, while still submitting
without JavaScript.

```tsx
// app/search/page.tsx
import Form from "next/form";

export default function SearchPage() {
  return (
    <Form action="/search/results">
      <label htmlFor="query">Search</label>
      <input type="text" id="query" name="query" required />
      <button type="submit">Search</button>
    </Form>
  );
}
```

```tsx
// app/search/results/page.tsx
export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  if (!query) return <p>Enter a search term</p>;

  const results = await searchProducts(query);
  return (
    <ul>
      {results.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

**Why good:** A plain `<form>` reloads the page on submit. `next/form` prefetches the results route
while the user is still typing and then navigates client-side, and falls back to the plain behaviour
with JavaScript off.

---

## Turbopack

```bash
next dev --turbopack     # development, stable since 15.0
next build --turbopack   # production, beta in 15.5, default in 16
```

Smaller projects see the least benefit, and CSS ordering can differ from Webpack in edge cases. On
16, opt back out with `next build --webpack`.

---

## Typed Routes

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
};

export default nextConfig;
```

```tsx
// app/components/nav.tsx
import Link from "next/link";

export function Navigation() {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/users/123">User Profile</Link>
      <Link href="/nonexistent-route">Invalid</Link> {/* type error */}
    </nav>
  );
}
```

Run `next typegen` to generate the types without starting a dev server or a build — `next typegen &&
tsc --noEmit` is the CI form.

### Route Props Helpers

`PageProps`, `LayoutProps` and `RouteContext` are global; the route pattern is the type argument.

```tsx
// app/blog/[slug]/page.tsx — no import needed
export default async function BlogPost(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  return <article>Post: {slug}</article>;
}
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout(props: LayoutProps<"/dashboard">) {
  return (
    <div>
      {props.children}
      {props.analytics} {/* parallel slots are typed from the file tree */}
    </div>
  );
}
```

**Why good:** Params and slots are typed from the actual folder structure, so a renamed route is a
compile error rather than a 404 found in testing.

---

## Instrumentation

`instrumentation.ts` at the project root gets a startup hook and an error hook that fires for every
route type.

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerTracing } = await import("./lib/tracing");
    initServerTracing();
  }
}

export async function onRequestError(
  error: Error & { digest?: string },
  request: { path: string; method: string; headers: Record<string, string> },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    revalidateReason: "on-demand" | "stale" | undefined;
  },
) {
  await reportError({
    message: error.message,
    digest: error.digest,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
}
```

**Why good:** One hook covers pages, route handlers, Server Actions and middleware, and `digest` ties
the report back to the ID the user saw in `error.tsx`.

---

## `after()`

Run work once the response has finished streaming.

```tsx
// app/dashboard/page.tsx
import { after } from "next/server";

export default async function DashboardPage() {
  after(() => {
    trackPageView("/dashboard"); // runs after the response is sent
  });

  return <h1>Dashboard</h1>;
}
```

**Why good:** Analytics, logging and cleanup stop adding their latency to the user's page. Anything
whose result the response depends on still needs a plain `await`.

---

## Node.js Middleware

```typescript
// middleware.ts — proxy.ts on Next.js 16
import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: "nodejs", // stable from 15.5
  matcher: ["/dashboard/:path*"],
};

export async function middleware(request: NextRequest) {
  const session = await checkAuth(request); // full Node APIs and npm packages available

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
```

**Trade-off:** Higher latency than the Edge runtime, in exchange for the auth and database libraries
Edge cannot run.

---

## Next.js 16 migration

### `middleware.ts` becomes `proxy.ts`

```typescript
// v15 — middleware.ts
export function middleware(request: NextRequest) {}

// v16 — proxy.ts; the edge runtime is not supported here, use nodejs
export function proxy(request: NextRequest) {}
```

### `revalidateTag` takes a profile

```typescript
// v15
revalidateTag("blog-posts");

// v16 — a cacheLife profile is required
revalidateTag("blog-posts", "max"); // a cacheLife profile name
revalidateTag("products", { expire: 3600 }); // or an inline object
```

The preset profiles are `default`, `seconds`, `minutes`, `hours`, `days`, `weeks` and `max`. Only
the profile's `expire` is read here — it sets how long stale content may still be served.

### `updateTag` and `refresh`, both Server-Actions-only

```typescript
"use server";
import { refresh, updateTag } from "next/cache";

export async function updateProfile(userId: string, formData: FormData) {
  await saveProfile(userId, formData);
  updateTag(`user-${userId}`); // expire and re-read within this request
}

export async function markAsRead(id: string) {
  await markNotificationRead(id);
  refresh(); // re-render uncached data; leaves the cache alone
}
```

Reach for `updateTag` when the user expects to see their own write immediately, `revalidateTag` when
a short staleness window is acceptable, and `refresh` for data that was never cached.

### Cache Components

```typescript
// next.config.ts
const nextConfig = {
  cacheComponents: true, // replaces experimental.ppr and experimental.dynamicIO
};
```

```tsx
import { cacheLife } from "next/cache";

async function CachedStats() {
  "use cache";
  cacheLife("hours"); // one of the preset profiles listed above
  return <StatsDisplay stats={await fetchStats()} />;
}
```

**Why good:** Caching becomes something a component opts into and states a lifetime for, rather than
a default that has to be opted out of per fetch.

### Turbopack config moves out of `experimental`

```typescript
// v15
const nextConfig = { experimental: { turbopack: {} } };

// v16
const nextConfig = { turbopack: {} };
```

---

_See [core.md](core.md) for routing and layouts. The full removals list, version requirements and the
upgrade codemod are in [reference.md](../reference.md)._
