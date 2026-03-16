# Next.js 15 Advanced Features

> New features in Next.js 15.x including PPR, Turbopack builds, typed routes, Form component, instrumentation, and after() API. See [core.md](core.md) for foundational patterns.

---

## Feature: Partial Prerendering (PPR) - Experimental

Combine static and dynamic content in the same route. Static shell is prerendered, dynamic components stream in.

### Configuration

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: "incremental", // Enable opt-in per route
  },
};

export default nextConfig;
```

### Good Example - PPR Page

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { StaticHeader } from "./static-header";
import { DynamicStats } from "./dynamic-stats";
import { StatsSkeleton } from "./skeletons";

// Enable PPR for this route
export const experimental_ppr = true;

export default function DashboardPage() {
  return (
    <div>
      {/* Static: Prerendered at build time */}
      <StaticHeader />

      {/* Dynamic: Streams in at request time */}
      <Suspense fallback={<StatsSkeleton />}>
        <DynamicStats />
      </Suspense>
    </div>
  );
}
```

```tsx
// app/dashboard/dynamic-stats.tsx
import { cookies } from "next/headers";

export async function DynamicStats() {
  // Using dynamic APIs makes this component dynamic
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  const stats = await fetchUserStats(userId);
  return <StatsDisplay stats={stats} />;
}
```

**Why good:** Static shell loads instantly, dynamic parts stream in separately, best of both SSG and SSR in one page

**When to use:** Dashboard pages with static layouts but personalized content, product pages with static info + user-specific pricing

**When NOT to use:** Fully static pages (no benefit), fully dynamic pages (use SSR), small projects (adds complexity)

**Note:** In Next.js 16, `experimental.ppr` and `experimental_ppr` are removed. Use `cacheComponents: true` with `"use cache"` directive instead. See the v16 migration section below.

---

## Feature: Enhanced Form Component (`next/form`)

HTML forms with automatic prefetching, client-side navigation, and progressive enhancement.

### Good Example - Search Form with Prefetching

```tsx
// app/search/page.tsx
import Form from "next/form";

export default function SearchPage() {
  return (
    <Form action="/search/results">
      <label htmlFor="query">Search</label>
      <input
        type="text"
        id="query"
        name="query"
        placeholder="Search products..."
        required
      />
      <button type="submit">Search</button>
    </Form>
  );
}
```

```tsx
// app/search/results/page.tsx
interface PageProps {
  searchParams: Promise<{ query?: string }>;
}

export default async function SearchResultsPage({ searchParams }: PageProps) {
  const { query } = await searchParams;

  if (!query) {
    return <p>Enter a search term</p>;
  }

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

**Why good:** Prefetches destination route while user types, client-side navigation on submit, works without JavaScript (progressive enhancement)

### Difference from Regular Form

```tsx
// Regular <form> - Full page reload
<form action="/search/results">
  <input name="query" />
  <button type="submit">Search</button>
</form>;

// next/form - Client-side navigation with prefetching
import Form from "next/form";

<Form action="/search/results">
  <input name="query" />
  <button type="submit">Search</button>
</Form>;
```

---

## Feature: Turbopack Builds (Beta - 15.5+)

Production builds with Turbopack for faster build times.

### Usage

```bash
# Development (stable since 15.0)
next dev --turbo

# Production builds (beta in 15.5+)
next build --turbopack
```

### Performance Gains

| Metric                    | Turbopack vs Webpack |
| ------------------------- | -------------------- |
| Local server startup      | 76.7% faster         |
| Fast Refresh              | 96.3% faster         |
| Initial route compilation | 45.8% faster         |
| Production builds (beta)  | 2x-5x faster         |

**Known limitations (15.5):**

- Smaller projects may see marginal gains
- Some bundle optimization differences vs Webpack
- CSS ordering may differ in edge cases

---

## Feature: Typed Routes (Stable - 15.5+)

Compile-time type safety for route paths.

### Configuration

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
};

export default nextConfig;
```

### Good Example - Type-Safe Links

```tsx
// app/components/nav.tsx
import Link from "next/link";

export function Navigation() {
  return (
    <nav>
      {/* Type-checked: "/dashboard" must exist */}
      <Link href="/dashboard">Dashboard</Link>

      {/* Type-checked: "/users/[id]" pattern must exist */}
      <Link href="/users/123">User Profile</Link>

      {/* TypeScript error if route doesn't exist */}
      <Link href="/nonexistent-route">Invalid</Link>
    </nav>
  );
}
```

### Manual Type Generation

```bash
# Generate types without running dev/build
next typegen

# Useful in CI for type validation
next typegen && tsc --noEmit
```

### Route Props Helpers (15.5+)

Globally available `PageProps`, `LayoutProps`, and `RouteContext` types - no imports needed.

```tsx
// app/blog/[slug]/page.tsx
// PageProps is globally available - no import required
export default async function BlogPost(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const query = await props.searchParams;

  return <article>Post: {slug}</article>;
}
```

```tsx
// app/dashboard/layout.tsx
// LayoutProps includes typed children and parallel route slots
export default function DashboardLayout(props: LayoutProps<"/dashboard">) {
  return (
    <div>
      {props.children}
      {/* Parallel route slots are fully typed */}
      {props.analytics}
      {props.team}
    </div>
  );
}
```

**Why good:** Full parameter typing with no boilerplate, parallel route slots automatically typed, generated from actual file structure

---

## Feature: Instrumentation (`instrumentation.js` - Stable)

Server lifecycle observability with error hooks.

### Good Example - Error Tracking Setup

```typescript
// instrumentation.ts (root of project)
export async function register() {
  // Initialize observability provider on server start
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerTracing } = await import("./lib/tracing");
    initServerTracing();
  }
}

export async function onRequestError(
  error: Error & { digest?: string },
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    revalidateReason: "on-demand" | "stale" | undefined;
  },
) {
  // Report error to monitoring service
  await fetch("https://monitoring.example.com/errors", {
    method: "POST",
    body: JSON.stringify({
      message: error.message,
      digest: error.digest,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
    headers: { "Content-Type": "application/json" },
  });
}
```

**Why good:** Catches errors across all route types (pages, routes, actions, middleware), provides request context, runs on server startup

---

## Feature: `after()` API (Stable - 15.1+)

Execute code after response finishes streaming. Useful for logging, analytics, cleanup. Stable since 15.1 - no experimental config needed.

### Good Example - Analytics After Response

```tsx
// app/dashboard/page.tsx
import { after } from "next/server";
import { trackPageView } from "@/lib/analytics";

export default async function DashboardPage() {
  // Response starts streaming immediately
  after(() => {
    // Runs AFTER response is sent to client
    // Does not block the response
    trackPageView("/dashboard");
  });

  return <h1>Dashboard</h1>;
}
```

### Good Example - Cleanup in Layout

```tsx
// app/layout.tsx
import { after } from "next/server";
import { flushLogs, closeConnections } from "@/lib/cleanup";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  after(async () => {
    // Cleanup tasks that shouldn't block response
    await flushLogs();
    await closeConnections();
  });

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Why good:** Non-blocking operations run after response, user sees page faster, perfect for analytics/logging

**When to use:** Analytics, logging, cleanup, background jobs that shouldn't delay response

**When NOT to use:** Operations that must complete before response (use regular await), client-side operations

---

## Feature: Node.js Middleware (Stable - 15.5+)

Full Node.js runtime support in middleware.

### Configuration

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export const config = {
  runtime: "nodejs", // Stable in 15.5+
  matcher: ["/dashboard/:path*"],
};

export async function middleware(request: NextRequest) {
  // Can use full Node.js APIs, npm packages, file system
  const session = await checkAuth(request);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
```

**Why good:** Full Node.js APIs available (file system, npm packages), replaces Edge runtime limitations for auth/DB middleware

**Trade-off:** Slightly higher latency than Edge, but more capability

---

## Next.js 16 Migration Notes (Released October 2025)

### Removals (v16)

| Feature                                                     | Replacement                        |
| ----------------------------------------------------------- | ---------------------------------- |
| AMP support                                                 | All AMP APIs and configs removed   |
| `next lint` command                                         | Use ESLint or Biome directly       |
| `serverRuntimeConfig`, `publicRuntimeConfig`                | Use environment variables          |
| `devIndicators` options                                     | Options removed, indicator remains |
| Synchronous `params`/`searchParams`/`cookies()`/`headers()` | Must await (sync compat removed)   |
| `experimental.ppr` and `experimental_ppr`                   | Use `cacheComponents: true`        |
| `experimental.dynamicIO`                                    | Use `cacheComponents: true`        |

### Breaking Changes (Next.js 16)

```typescript
// middleware.ts -> proxy.ts (v16)
// Before (v15)
// middleware.ts
export function middleware(request: NextRequest) {}

// After (v16)
// proxy.ts
export function proxy(request: NextRequest) {}
// Note: edge runtime NOT supported in proxy.ts, use nodejs runtime
```

```typescript
// revalidateTag requires cacheLife profile (v16)
// Before (v15 - deprecated single argument)
revalidateTag("blog-posts");

// After (v16) - requires cacheLife profile as second argument
revalidateTag("blog-posts", "max");
// Built-in profiles: 'max', 'hours', 'days'
revalidateTag("news-feed", "hours");

// For Server Actions, use updateTag() for read-your-writes semantics
import { updateTag } from "next/cache";
updateTag("user-123"); // Expire + immediate refresh
```

```typescript
// New refresh() for uncached data (v16)
"use server";
import { refresh } from "next/cache";

export async function markAsRead(id: string) {
  await db.notifications.markAsRead(id);
  refresh(); // Refreshes uncached data without touching cache
}
```

### Cache Components (Next.js 16)

Cache Components replace `experimental.ppr`. All caching is opt-in via `"use cache"` directive:

```typescript
// next.config.ts (v16)
const nextConfig = {
  cacheComponents: true, // Replaces experimental.ppr
};
```

```tsx
// Explicitly cached component
async function CachedStats() {
  "use cache";
  // Cache key generated automatically by compiler
  const stats = await fetchStats();
  return <StatsDisplay stats={stats} />;
}
```

### Turbopack Config Changes (v16)

```typescript
// next.config.ts
// Before (v15) - under experimental
const nextConfig = {
  experimental: {
    turbopack: {
      /* options */
    },
  },
};

// After (v16) - top-level
const nextConfig = {
  turbopack: {
    /* options */
  },
};
```

### New Features (v16)

- **React 19.2**: View Transitions, `useEffectEvent`, `<Activity>`
- **React Compiler** support stable (`reactCompiler: true` at config root)
- **`cacheLife` and `cacheTag`**: Stable (no `unstable_` prefix)
- **Enhanced routing**: Layout deduplication, incremental prefetching
- **Build Adapters API** (alpha): Custom build integrations
- **Next.js DevTools MCP**: AI-assisted debugging

### Version Requirements (v16)

- Node.js 20.9+ required (18 no longer supported)
- TypeScript 5.1.0+ required
- Turbopack is default bundler (opt out: `next build --webpack`)
- Parallel routes require explicit `default.js` in all slots (builds fail without them)
- Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+

### Migration Codemod

```bash
# Run automated migration
npx @next/codemod@canary upgrade latest
```

---

_See [core.md](core.md) for Server/Client Components, Streaming, Layouts, and Error Handling patterns._
