# Next.js App Router Reference

> Decision frameworks, anti-patterns, and red flags for Next.js App Router development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Server Component vs Client Component

```
Does the component need interactivity?
├─ YES → Does it need state (useState, useReducer)?
│   ├─ YES → Client Component ("use client")
│   └─ NO → Does it need event handlers (onClick, onChange)?
│       ├─ YES → Client Component ("use client")
│       └─ NO → Does it need browser APIs (localStorage, window)?
│           ├─ YES → Client Component ("use client")
│           └─ NO → Does it need lifecycle effects (useEffect)?
│               ├─ YES → Client Component ("use client")
│               └─ NO → Server Component (default)
└─ NO → Server Component (default)
```

### When to Use loading.tsx vs Suspense

```
What granularity of loading state do you need?
├─ Entire route should show loading state → loading.tsx
├─ Multiple independent sections → <Suspense> around each
├─ Single slow component → <Suspense> around that component
└─ Mix of both → loading.tsx for initial, Suspense for granular
```

### Static vs Dynamic Metadata

```
Does metadata depend on runtime data?
├─ NO → Use static `metadata` object
└─ YES → Does it depend on route params?
    ├─ YES → Use generateMetadata with params
    └─ NO → Does it depend on external data (DB, API)?
        ├─ YES → Use generateMetadata with fetch
        └─ NO → Use static `metadata` object
```

### Route Group vs Nested Route

```
Should the folder affect the URL?
├─ NO → Use route group: (groupName)/
└─ YES → Use regular folder: folderName/
```

### Parallel Routes vs Regular Routes

```
Do you need multiple views rendered simultaneously?
├─ YES → Is it for modals with deep linking?
│   ├─ YES → Parallel routes + intercepting routes
│   └─ NO → Is it for dashboard-style layouts?
│       ├─ YES → Parallel routes with @slot folders
│       └─ NO → Is it for conditional rendering (admin/user)?
│           ├─ YES → Parallel routes with conditional layout
│           └─ NO → Regular routes probably sufficient
└─ NO → Regular routes
```

### Data Fetching Location

```
Where should data be fetched?
├─ Is data needed for SEO? → Server Component
├─ Is data shared across multiple components? → Parent Server Component, pass as props
├─ Is data user-specific and changes frequently? → Server Component with revalidation
├─ Is data needed only on client interaction? → Client Component with API call
└─ Default → Server Component (closest to where data is used)
```

### Rendering Strategy

```
How should this page be rendered?
├─ Content is completely static → SSG (default, or force-static)
├─ Content changes on every request → SSR (force-dynamic)
├─ Content changes periodically → ISR (revalidate: seconds)
├─ Content is personalized per user → SSR with caching headers
└─ Mixed: some static, some dynamic → PPR (Partial Prerendering) if available
```

---

## RED FLAGS

### High Priority Issues

- **"use client" at the top of page.tsx** - Pages should be Server Components by default; push interactivity to child components
- **Client Component fetching data with useEffect** - Use Server Components for data fetching to avoid waterfalls
- **Manual `<head>` or `<title>` tags** - Use Metadata API for SEO; manual tags may conflict or be duplicated
- **Missing loading.tsx in data-heavy routes** - Users see blank pages while data loads
- **Importing server-only code in Client Components** - Use `server-only` package to prevent accidental exposure
- **Secrets/API keys in Client Components** - Any code in Client Components is exposed to the browser

### Medium Priority Issues

- **Large Client Components with minimal interactivity** - Split into Server parent + small Client child
- **Not using generateStaticParams for known dynamic routes** - Missing build-time optimization
- **Fetching same data in generateMetadata and page** - Fetch is auto-memoized, but structure could be cleaner
- **Using template.tsx when layout.tsx would work** - template.tsx re-renders on navigation; use only when needed
- **Missing default.tsx in parallel routes** - Can cause 404s on hard refresh

### Common Mistakes

- **Using router.push() in Client Component to close modal** - Use router.back() for proper modal dismissal
- **Wrapping entire app in Context Provider at wrong level** - Place providers inside `<body>` not around `<html>`
- **Using `dynamic` export without understanding implications** - Can disable caching unexpectedly
- **Not handling notFound() case in dynamic routes** - Returns generic 404 instead of contextual error
- **Mixing static metadata export with generateMetadata** - Choose one approach per route segment

### Gotchas & Edge Cases

- **error.tsx must be a Client Component** - Requires "use client" directive for reset functionality
- **global-error.tsx must define own `<html>` and `<body>`** - Replaces root layout when triggered
- **Parallel route slots don't affect URL** - `@modal/photo` is accessed via `/photo`, not `/@modal/photo`
- **Intercepting routes use file-system conventions** - `(.)` for same level, `(..)` for parent, etc.
- **params and searchParams are Promises in Next.js 15** - Must await them: `const { id } = await params`
- **Layout components don't re-render on navigation** - Use template.tsx if you need re-render
- **In Next.js 15, fetch requests are NOT cached by default for dynamic rendering** - Use `cache: 'force-cache'` to opt into caching
- **generateMetadata blocks HTML streaming** - Metadata included in first streamed chunk
- **Route groups can have their own root layouts** - Multiple `(group)/layout.tsx` files act as separate roots
- **GET Route Handlers are NOT cached by default in Next.js 15** - Opt-in with `export const dynamic = 'force-static'`
- **Client Router Cache doesn't cache Page components by default in Next.js 15** - Use `staleTimes.dynamic` config to restore old behavior

---

## Next.js 15 Specific Changes

### Breaking Changes from v14

| Change                          | Impact                                                             | Migration                                                        |
| ------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Async Request APIs**          | `cookies()`, `headers()`, `params`, `searchParams` must be awaited | Use codemod: `npx @next/codemod@canary next-async-request-api .` |
| **GET Routes uncached**         | Route Handlers no longer cached by default                         | Opt-in with `export const dynamic = 'force-static'`              |
| **Client Router Cache**         | Page components not cached (staleTime: 0)                          | Use `staleTimes.dynamic` config if needed                        |
| **`experimental-edge` removed** | Runtime value deprecated                                           | Switch to `runtime = 'edge'`                                     |
| **React 19 required**           | App Router requires React 19                                       | Update `react` and `react-dom` to v19                            |

### New Features in Next.js 15.0+

#### `<Form>` Component

Enhanced HTML forms with prefetching and client-side navigation:

```tsx
import Form from "next/form";

export default function SearchPage() {
  return (
    <Form action="/search">
      <input name="query" />
      <button type="submit">Search</button>
    </Form>
  );
}
```

#### `unstable_after()` (Experimental)

Execute code after response finishes streaming (useful for logging, analytics):

```tsx
import { unstable_after as after } from "next/server";

export default function Layout({ children }: { children: React.ReactNode }) {
  after(() => {
    // Logging, analytics, cleanup - runs after response is sent
    logPageView();
  });
  return <>{children}</>;
}
```

#### Turbopack (Stable for Dev)

Use `next dev --turbo` for faster development:

- 76.7% faster local server startup
- 96.3% faster code updates with Fast Refresh
- 45.8% faster initial route compilation

#### `use cache` Directive (Experimental)

Explicit caching with `dynamicIO` flag enabled:

```tsx
// next.config.ts
const nextConfig = {
  experimental: {
    dynamicIO: true,
  },
};

// app/page.tsx
import { cacheLife } from "next/cache";

export default async function Page() {
  "use cache";
  cacheLife("hours"); // Built-in profile
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### New Features in Next.js 15.5+

| Feature                 | Description                                             | Status |
| ----------------------- | ------------------------------------------------------- | ------ |
| **Turbopack Builds**    | `next build --turbopack` for 2x-5x faster builds        | Beta   |
| **Node.js Middleware**  | `runtime: 'nodejs'` in middleware config                | Stable |
| **Typed Routes**        | `typedRoutes: true` for compile-time route validation   | Stable |
| **Route Props Helpers** | Global `PageProps`, `LayoutProps`, `RouteContext` types | Stable |
| **`next typegen`**      | Manual type generation command                          | Stable |

### Next.js 16 Migration Preview

**Deprecation warnings in 15.5+:**

- `legacyBehavior` on `<Link>` - remove wrapper `<a>` tags
- AMP support - remove all AMP code
- `next lint` - use ESLint or Biome directly (codemod: `npx @next/codemod@latest next-lint-to-eslint-cli .`)
- `devIndicators` config options
- `serverRuntimeConfig`, `publicRuntimeConfig` - use env variables

**Breaking changes coming in v16:**

- `middleware.ts` → `proxy.ts` (file rename + export rename)
- `revalidateTag()` requires `cacheLife` profile as second argument:

  ```tsx
  // v15 (deprecated)
  revalidateTag("blog-posts");

  // v16 (required)
  revalidateTag("blog-posts", "max");
  ```

- New `updateTag()` for Server Actions (read-your-writes semantics):

  ```tsx
  "use server";
  import { updateTag } from "next/cache";

  export async function updateProfile(userId: string) {
    await db.users.update(userId, data);
    updateTag(`user-${userId}`); // Expires cache & refreshes immediately
  }
  ```

- New `refresh()` for uncached data revalidation (Server Actions only)
- **Cache Components** replace `experimental.ppr` flag (enable with `cacheComponents: true`)
- **Turbopack** becomes default bundler (opt out: `next build --webpack`)
- Node.js 20.9+ required (18 no longer supported)
- TypeScript 5.1.0+ required
- Parallel routes require explicit `default.js` in all slots

For detailed examples, see [examples/nextjs-15-features.md](examples/nextjs-15-features.md).

---

## Anti-Patterns

### Making Everything a Client Component

The App Router's power comes from Server Components. Defaulting to Client Components throws away the benefits.

```tsx
// WRONG - Entire page is Client Component
"use client";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch("/api/products").then(/* ... */);
  }, []);
  // ...
}

// CORRECT - Server Component with Client child
// page.tsx (Server Component)
export default async function ProductsPage() {
  const products = await getProducts(); // Server-side fetch
  return <ProductList products={products} />;
}

// product-list.tsx (Client Component - only if needed)
("use client");
export function ProductList({ products }) {
  // Interactive features only
}
```

### Exposing Secrets in Client Components

Client Components ship to the browser. Any code in them is visible to users.

```tsx
// WRONG - Secret exposed to client
"use client";

const API_KEY = process.env.API_KEY; // Exposed!

export function DataFetcher() {
  const fetchData = () => {
    fetch("https://api.example.com", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
  };
}

// CORRECT - Use server-only code
// lib/data.ts
import "server-only";

export async function getData() {
  const response = await fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${process.env.API_KEY}` },
  });
  return response.json();
}

// page.tsx (Server Component)
export default async function Page() {
  const data = await getData(); // Safe
  return <ClientComponent data={data} />;
}
```

### Ignoring Streaming Opportunities

Without Suspense boundaries, slow data blocks the entire page.

```tsx
// WRONG - Everything waits for slowest fetch
export default async function Dashboard() {
  const revenue = await getRevenue(); // 3 seconds
  const invoices = await getInvoices(); // 1 second
  const customers = await getCustomers(); // 2 seconds

  return (
    <div>
      <RevenueChart data={revenue} />
      <InvoicesList data={invoices} />
      <CustomerList data={customers} />
    </div>
  );
}

// CORRECT - Each section streams independently
export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <InvoicesList />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <CustomerList />
      </Suspense>
    </div>
  );
}
```

### Manual Head Tags Instead of Metadata API

The Metadata API handles deduplication, ordering, and type safety.

```tsx
// WRONG - Manual head manipulation
export default function Page() {
  return (
    <>
      <head>
        <title>My Page</title>
        <meta name="description" content="..." />
      </head>
      <main>Content</main>
    </>
  );
}

// CORRECT - Metadata API
export const metadata: Metadata = {
  title: "My Page",
  description: "...",
};

export default function Page() {
  return <main>Content</main>;
}
```

### Blocking Navigation with Heavy Client Components

Large Client Components delay hydration and interactivity.

```tsx
// WRONG - Heavy Client Component
"use client";

import { HeavyChartLibrary } from "heavy-charts"; // 200KB
import { DataTable } from "data-table"; // 150KB

export default function AnalyticsPage() {
  return (
    <div>
      <HeavyChartLibrary />
      <DataTable />
    </div>
  );
}

// CORRECT - Dynamic imports for heavy components
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./heavy-chart"), {
  loading: () => <ChartSkeleton />,
});

const DataTable = dynamic(() => import("./data-table"), {
  loading: () => <TableSkeleton />,
});

export default function AnalyticsPage() {
  return (
    <div>
      <HeavyChart />
      <DataTable />
    </div>
  );
}
```

### Missing Error Boundaries

Without error.tsx, errors crash entire route segments.

```tsx
// WRONG - No error handling
// app/dashboard/page.tsx
export default async function Dashboard() {
  const data = await riskyFetch(); // If this fails, entire page crashes
  return <div>{data}</div>;
}

// CORRECT - Error boundary in place
// app/dashboard/error.tsx
("use client");

export default function DashboardError({ error, reset }) {
  return (
    <div>
      <h2>Dashboard failed to load</h2>
      <button onClick={reset}>Retry</button>
    </div>
  );
}
```

---

## Quick Reference

### File Conventions Checklist

- [ ] `page.tsx` - Route UI (required for route to be accessible)
- [ ] `layout.tsx` - Shared wrapper (persists across navigations)
- [ ] `loading.tsx` - Loading state (auto-wrapped in Suspense)
- [ ] `error.tsx` - Error boundary (must be Client Component)
- [ ] `not-found.tsx` - 404 UI (triggered by notFound())
- [ ] `default.tsx` - Parallel route fallback
- [ ] `template.tsx` - Re-rendering layout (use sparingly)
- [ ] `route.ts` - API endpoint

### Server Component Checklist

- [ ] No "use client" directive (default)
- [ ] Can use async/await directly
- [ ] Can access database, file system, secrets
- [ ] Cannot use useState, useEffect, or event handlers
- [ ] Cannot use browser APIs

### Client Component Checklist

- [ ] Has "use client" directive at top of file
- [ ] Only used when interactivity is needed
- [ ] Receives data via props (not fetching itself)
- [ ] Located at leaf of component tree
- [ ] No sensitive data or secrets

### Metadata Checklist

- [ ] Using Metadata API (not manual head tags)
- [ ] Title template in root layout
- [ ] Open Graph images configured
- [ ] metadataBase set for URL composition
- [ ] Dynamic metadata uses generateMetadata
- [ ] generateStaticParams for known dynamic routes

### Streaming Checklist

- [ ] loading.tsx for route-level loading
- [ ] Suspense boundaries for independent sections
- [ ] Skeleton components match final layout
- [ ] Slow fetches wrapped in Suspense
- [ ] No sequential fetches in same component

### Route Segment Config Options

| Option            | Values                                                                                                                    | Purpose                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `dynamic`         | `'auto'`, `'force-dynamic'`, `'error'`, `'force-static'`                                                                  | Control dynamic rendering                                       |
| `revalidate`      | `false`, `0`, number                                                                                                      | Cache revalidation time                                         |
| `fetchCache`      | `'auto'`, `'default-cache'`, `'only-cache'`, `'force-cache'`, `'force-no-store'`, `'default-no-store'`, `'only-no-store'` | Default fetch caching                                           |
| `runtime`         | `'nodejs'`, `'edge'`                                                                                                      | Runtime environment (note: `'experimental-edge'` is deprecated) |
| `preferredRegion` | `'auto'`, `'global'`, `'home'`, string[]                                                                                  | Deployment region preference                                    |

```tsx
// Example: Force dynamic rendering
export const dynamic = "force-dynamic";

// Example: ISR with 60 second revalidation
export const revalidate = 60;

// Example: Edge runtime
export const runtime = "edge";
```
