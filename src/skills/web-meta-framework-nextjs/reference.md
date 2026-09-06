# Next.js App Router Reference

> Decision trees, lookup tables, anti-patterns with code, and the version-by-version changes. See
> [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/](examples/) for working code.

---

## Decision Trees

### loading.tsx vs Suspense

```
What granularity of loading state do you need?
├─ The whole route → loading.tsx
├─ Several independent sections → <Suspense> around each
├─ One slow component → <Suspense> around that component
└─ Both → loading.tsx for the initial paint, Suspense for the sections
```

### Static vs dynamic metadata

```
Does the metadata depend on runtime data?
├─ NO → the static `metadata` object
└─ YES → does it come from the route params?
    ├─ YES → generateMetadata reading params
    └─ NO  → does it come from a database or API?
        ├─ YES → generateMetadata with the fetch (memoised with the page's)
        └─ NO  → the static `metadata` object
```

### Parallel routes vs regular routes

```
Do you need more than one view rendered at once in the same layout?
├─ NO → regular routes
└─ YES → what for?
    ├─ A modal with a shareable URL → parallel routes + intercepting routes
    ├─ A dashboard of independent panels → parallel routes with @slot folders
    └─ Showing different content per role → parallel routes with a conditional layout
```

### Where to fetch

```
Where should this data be fetched?
├─ Needed for SEO → Server Component
├─ Shared by several components → the parent Server Component, passed as props
├─ User-specific and frequently changing → Server Component with revalidation
├─ Only needed after a user interaction → Client Component, through a route handler
└─ Otherwise → the Server Component closest to where it is used
```

### Rendering strategy

```
How should this page be rendered?
├─ Entirely static → SSG (the default, or force-static)
├─ Different on every request → SSR (force-dynamic)
├─ Changes periodically → ISR (revalidate: seconds)
├─ Personalised per user → SSR
└─ Static shell with dynamic islands → PPR on 15.x, Cache Components on 16
```

### Server Action vs Route Handler

```
Do external clients call this endpoint?
├─ YES → Route Handler
└─ NO → is it a form submission or a button action?
    ├─ YES → Server Action
    └─ NO → does the work need to run in parallel?
        ├─ YES → Route Handler — client-invoked actions queue
        └─ NO → either works; the Server Action is less code
```

### revalidatePath vs revalidateTag

```
Do you know every path that shows this data?
├─ YES → are there fewer than about five?
│   ├─ YES → revalidatePath for each
│   └─ NO  → revalidateTag
└─ NO → is the data tagged at fetch time?
    ├─ YES → revalidateTag
    └─ NO  → add tags to the fetch, or revalidate the route segment
```

---

## Lookup Tables

### Route files

| File            | Purpose                                                    | Required |
| --------------- | ---------------------------------------------------------- | -------- |
| `page.tsx`      | The route's UI — without it the URL is not reachable       | Yes      |
| `layout.tsx`    | Shared UI for a segment; persists across navigations       | No       |
| `loading.tsx`   | Loading UI; wraps the page in Suspense automatically       | No       |
| `error.tsx`     | Error boundary for the segment; must be a Client Component | No       |
| `not-found.tsx` | UI for `notFound()`                                        | No       |
| `template.tsx`  | A layout that remounts on every navigation                 | No       |
| `default.tsx`   | What a parallel slot renders when nothing matches          | No       |
| `route.ts`      | An HTTP endpoint rather than a page                        | No       |

### Route segment config

| Option            | Values                                                                                                                    | Purpose                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `dynamic`         | `'auto'`, `'force-dynamic'`, `'error'`, `'force-static'`                                                                  | Control dynamic rendering                                 |
| `revalidate`      | `false`, `0`, number                                                                                                      | Cache revalidation time in seconds                        |
| `fetchCache`      | `'auto'`, `'default-cache'`, `'only-cache'`, `'force-cache'`, `'force-no-store'`, `'default-no-store'`, `'only-no-store'` | Default caching for `fetch` in the segment                |
| `runtime`         | `'nodejs'`, `'edge'`                                                                                                      | Runtime environment (`'experimental-edge'` is deprecated) |
| `preferredRegion` | `'auto'`, `'global'`, `'home'`, `string[]`                                                                                | Deployment region preference                              |

```tsx
export const dynamic = "force-dynamic";
export const revalidate = 60; // ISR: rebuild at most once a minute
export const runtime = "edge";
```

### React 19 hook signatures

```typescript
// The action's first parameter is the previous state when used with useActionState
export async function action(
  prevState: State,
  formData: FormData,
): Promise<State> {}

const [state, formAction, isPending] = useActionState(
  serverAction,
  initialState,
);

// Only meaningful in a component nested inside the form
const { pending, data, method, action } = useFormStatus();

const [optimisticState, addOptimistic] = useOptimistic(
  state,
  (current, value) => [...current, value],
);
```

`useActionState` replaces the Canary-era `ReactDOM.useFormState`. On React 18 `useFormStatus`
returned only `pending`; `data`, `method` and `action` arrived in 19.

### Next.js 16 caching APIs

| API                           | Purpose                                 | Where it can be called |
| ----------------------------- | --------------------------------------- | ---------------------- |
| `revalidatePath(path)`        | Invalidate a specific route's cache     | Any server context     |
| `revalidateTag(tag, profile)` | Stale-while-revalidate for tagged cache | Any server context     |
| `updateTag(tag)`              | Expire and re-read within this request  | Server Actions only    |
| `refresh()`                   | Re-render uncached data                 | Server Actions only    |

Code for all four is in [examples/versions.md](examples/versions.md).

---

## Anti-Patterns

### Making everything a Client Component

```tsx
// WRONG — the whole page is client-side
"use client";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch("/api/products").then(/* ... */);
  }, []);
}

// CORRECT — Server Component with a Client child where the interaction is
export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

### Exposing secrets in Client Components

```tsx
// WRONG — the key is in the browser bundle
"use client";
const API_KEY = process.env.API_KEY;

// CORRECT — a server-only module holds it
// lib/data.ts
import "server-only";

export async function getData() {
  const response = await fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${process.env.API_KEY}` },
  });
  return response.json();
}
```

### Ignoring streaming opportunities

```tsx
// WRONG — six seconds before anything renders
export default async function Dashboard() {
  const revenue = await getRevenue(); // 3s
  const invoices = await getInvoices(); // 1s
  const customers = await getCustomers(); // 2s
  // ...
}

// CORRECT — each section arrives when it is ready
export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <InvoicesList />
      </Suspense>
    </div>
  );
}
```

### Manual head tags instead of the Metadata API

```tsx
// WRONG — duplicated or reordered tags, and no type checking
export default function Page() {
  return (
    <>
      <head>
        <title>My Page</title>
      </head>
      <main>Content</main>
    </>
  );
}

// CORRECT
export const metadata: Metadata = { title: "My Page", description: "..." };
```

### Shipping a heavy Client Component eagerly

```tsx
// WRONG — 350KB blocks hydration
"use client";
import { HeavyChartLibrary } from "heavy-charts";
import { DataTable } from "data-table";

// CORRECT — loaded on demand, with a placeholder meanwhile
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./heavy-chart"), {
  loading: () => <ChartSkeleton />,
});
```

### `redirect()` inside try/catch

```typescript
// WRONG — redirect signals by throwing, so the catch swallows it
export async function createPost(formData: FormData) {
  try {
    await createPostRecord(formData);
    revalidatePath("/posts");
    redirect("/posts");
  } catch (error) {
    return { error: "Failed" };
  }
}

// CORRECT — only the fallible work is inside the try
export async function createPost(formData: FormData) {
  try {
    await createPostRecord(formData);
  } catch (error) {
    return { error: "Failed" };
  }

  revalidatePath("/posts");
  redirect("/posts");
}
```

### Expecting parallel execution from the client

```typescript
// WRONG — these queue and run one at a time
export function BatchActions() {
  const handleAll = async () => {
    await updateItem1();
    await updateItem2();
    await updateItem3();
  };
}

// CORRECT — one action that parallelises on the server
("use server");

export async function updateAllItems(ids: string[]) {
  await Promise.all(ids.map((id) => updateItem(id)));
}
```

---

## Further Gotchas

The ones that change a decision are in [SKILL.md](SKILL.md); these are the long tail.

- `router.push()` does not dismiss an intercepted modal correctly — `router.back()` does
- Providers belong inside `<body>`, not wrapped around `<html>`
- A static `metadata` export and `generateMetadata` in the same segment conflict — pick one
- `notFound()` unhandled in a dynamic route gives a generic 404 rather than a contextual one
- `generateMetadata` blocks HTML streaming; its output is part of the first chunk
- A route group may carry its own root layout, which then acts as a separate root
- Layouts do not re-render on navigation — `template.tsx` is the version that does
- Parallel slots are absent from the URL: `@modal/photo` is reached at `/photo`
- The Client Router Cache does not cache Page components from 15; `staleTimes.dynamic` restores the
  old behaviour
- `FormData` values are always `string` or `File` — parse numbers explicitly
- Server Action IDs are encrypted and recalculated between builds, and unused actions are removed
  from the client bundle by dead-code elimination
- CSRF protection is built in: actions are POST-only and the Origin header is checked

---

## Version-Specific Changes

### 15.0 breaking changes from 14

| Change                          | Impact                                                             | Migration                                                  |
| ------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Async request APIs**          | `cookies()`, `headers()`, `params`, `searchParams` must be awaited | `npx @next/codemod@canary next-async-request-api .`        |
| **GET routes uncached**         | Route Handlers are no longer cached by default                     | Opt in with `export const dynamic = 'force-static'`        |
| **Client Router Cache**         | Page components are not cached (staleTime 0)                       | `staleTimes.dynamic` config if the old behaviour is wanted |
| **`experimental-edge` removed** | The runtime value is gone                                          | `runtime = 'edge'`                                         |
| **React 19 required**           | The App Router needs React 19                                      | Update `react` and `react-dom`                             |

### Added in 15.x

| Feature             | Description                                         | Status from |
| ------------------- | --------------------------------------------------- | ----------- |
| `next/form`         | Forms with prefetching and client-side navigation   | 15.0        |
| `after()`           | Work that runs once the response has streamed       | 15.1        |
| Turbopack builds    | `next build --turbopack`                            | 15.5 (beta) |
| Node.js middleware  | `runtime: 'nodejs'` in the middleware config        | 15.5        |
| Typed routes        | `typedRoutes: true` for compile-time route checking | 15.5        |
| Route props helpers | Global `PageProps`, `LayoutProps`, `RouteContext`   | 15.5        |
| `next typegen`      | Type generation without a dev server or build       | 15.5        |

Turbopack in development reports 76.7% faster server startup, 96.3% faster Fast Refresh and 45.8%
faster initial route compilation; production builds are 2x–5x faster.

### Removed in 16

| Feature                                                           | Replacement                           |
| ----------------------------------------------------------------- | ------------------------------------- |
| AMP support                                                       | Removed outright                      |
| `next lint`                                                       | Run the linter directly               |
| `serverRuntimeConfig`, `publicRuntimeConfig`                      | Environment variables                 |
| `devIndicators` options                                           | Removed; the indicator itself remains |
| Synchronous `params` / `searchParams` / `cookies()` / `headers()` | Await them                            |
| `experimental.ppr`, `experimental_ppr`                            | `cacheComponents: true`               |
| `experimental.dynamicIO`                                          | `cacheComponents: true`               |

### Breaking changes in 16

- `middleware.ts` → `proxy.ts`, and the export renames with it; the edge runtime is unsupported there
- `revalidateTag()` requires a `cacheLife` profile as its second argument
- Turbopack is the default bundler — opt out with `next build --webpack`
- Every parallel route slot needs an explicit `default.js` or the build fails
- `experimental.turbopack` moved to a top-level `turbopack` key
- `next/image` defaults changed: `minimumCacheTTL` 60s → 4h, 16px dropped from `imageSizes`,
  `qualities` restricted to `[75]`
- Node.js 20.9+ and TypeScript 5.1+ required; Chrome/Edge/Firefox 111+, Safari 16.4+

### Added in 16

- React 19.2: View Transitions, `useEffectEvent`, `<Activity>`
- Cache Components — `"use cache"` for explicit opt-in caching
- `cacheLife` and `cacheTag` are stable, with no `unstable_` prefix
- `updateTag()` and `refresh()` for Server Actions
- React Compiler support is stable (`reactCompiler: true`, no longer under `experimental`)
- Layout deduplication and incremental prefetching
- Build Adapters API (alpha), and a DevTools MCP server

```bash
npx @next/codemod@canary upgrade latest
```

---

## Server Action Checklists

### Security

- [ ] `'use server'` on the file or the function
- [ ] Input parsed through a schema before it reaches anything else
- [ ] Authentication checked
- [ ] Authorization checked — this caller may perform this action on this record
- [ ] Error messages carry no internal detail
- [ ] Rate limiting considered for anything reachable without a session

### Performance

- [ ] `revalidatePath` or `revalidateTag` after every mutation
- [ ] `redirect()` after `revalidatePath()`, and outside any `try`
- [ ] A pending state shown while the action runs
- [ ] Optimistic updates where the action rarely fails
- [ ] Both the list and the detail path revalidated, not just the one you were on
