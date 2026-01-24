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
// ❌ Regular <form> - Full page reload
<form action="/search/results">
  <input name="query" />
  <button type="submit">Search</button>
</form>;

// ✅ next/form - Client-side navigation with prefetching
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

Execute code after response finishes streaming. Useful for logging, analytics, cleanup.

### Configuration (15.0 only - stable in 15.1+)

```typescript
// next.config.ts (only needed in 15.0)
const nextConfig = {
  experimental: {
    after: true,
  },
};
```

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

## Next.js 16 Preview: Migration Notes

Prepare for upcoming Next.js 16 changes:

### Deprecation Warnings (15.5+)

| Feature                    | Deprecated | Replacement               |
| -------------------------- | ---------- | ------------------------- |
| `legacyBehavior` on `Link` | 15.5       | Remove wrapper `<a>` tag  |
| AMP support                | 15.5       | Remove AMP code           |
| `next lint` command        | 15.5       | Use ESLint/Biome directly |
| `devIndicators` options    | 15.5       | Remove from config        |

### Breaking Changes (Next.js 16)

```typescript
// middleware.ts → proxy.ts (v16)
// Before (v15)
export default function middleware(request) {}

// After (v16)
export default function proxy(request) {}
```

```typescript
// revalidateTag requires cacheLife (v16)
// Before (v15 - deprecated)
revalidateTag("blog-posts");

// After (v16)
revalidateTag("blog-posts", "max");

// Or for Server Actions use updateTag()
import { updateTag } from "next/cache";
updateTag("user-123"); // For read-your-writes
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

Cache Components replace `experimental.ppr` flag. Enable with `cacheComponents: true`:

```typescript
// next.config.ts (v16)
const nextConfig = {
  cacheComponents: true, // Replaces experimental.ppr
};
```

The `"use cache"` directive provides explicit, opt-in caching:

```tsx
// app/dashboard/page.tsx (v16 pattern)
import { Suspense } from "react";

// Static shell is prerendered, dynamic content streams in
export default function Dashboard() {
  return (
    <>
      <StaticHeader />
      <Suspense fallback={<Loading />}>
        <DynamicUserData />
      </Suspense>
    </>
  );
}

// Explicitly cached component
async function CachedStats() {
  "use cache";
  // Cache key generated automatically by compiler
  const stats = await fetchStats();
  return <StatsDisplay stats={stats} />;
}
```

### Version Requirements (v16)

- Node.js 20.9+ required (18 no longer supported)
- TypeScript 5.1.0+ required
- Turbopack becomes default bundler (opt out: `next build --webpack`)
- Parallel routes require explicit `default.js` in all slots

### Migration Codemod

```bash
# Run automated migration
npx @next/codemod@canary upgrade latest
```

---

_See [core.md](core.md) for Server/Client Components, Streaming, Layouts, and Error Handling patterns._
