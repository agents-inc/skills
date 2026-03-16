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

### When to Use Server Actions

```
Is this a mutation (create, update, delete)?
├─ YES → Is it triggered by user action (form, button)?
│   ├─ YES → Use Server Action
│   └─ NO → Is it a scheduled job or webhook?
│       ├─ YES → Use Route Handler or separate service
│       └─ NO → Consider Server Action or Route Handler
└─ NO → Is it data fetching?
    ├─ YES → Use Server Components or your data fetching solution
    └─ NO → Consider if Server Action is appropriate
```

### Server Action vs Route Handler

```
Do external clients need to call this endpoint?
├─ YES → Use Route Handler (API Route)
└─ NO → Is this a form submission or button action?
    ├─ YES → Use Server Action
    └─ NO → Do you need parallel operations?
        ├─ YES → Use Route Handler (actions queue sequentially)
        └─ NO → Either works, Server Action is simpler
```

### Form Action vs Event Handler

```
Is there a form with inputs?
├─ YES → Does it need to work without JavaScript?
│   ├─ YES → Use form action (progressive enhancement)
│   └─ NO → Form action still preferred, or event handler if complex logic needed
└─ NO → Is it a simple toggle/click?
    ├─ YES → Use event handler with startTransition
    └─ NO → Consider if form wrapper makes sense
```

### When to Use useOptimistic

```
Does the action have high success rate (>99%)?
├─ YES → Does immediate feedback improve UX significantly?
│   ├─ YES → Use useOptimistic
│   └─ NO → Standard pending state is sufficient
└─ NO → Don't use optimistic updates (rollbacks confuse users)
```

### revalidatePath vs revalidateTag

```
Do you know all specific paths that need updating?
├─ YES → Are there few paths (<5)?
│   ├─ YES → Use revalidatePath for each
│   └─ NO → Use revalidateTag for broader invalidation
└─ NO → Is the data tagged during fetch?
    ├─ YES → Use revalidateTag
    └─ NO → Consider adding tags to fetches, or revalidate route segments
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
- **Missing `'use server'` directive** - Action runs on client, exposing secrets
- **No authorization check in Server Actions** - Anyone can invoke the action
- **No input validation in Server Actions** - Accepts any data, security risk
- **Missing `revalidatePath`/`revalidateTag` after mutation** - Stale UI
- **`redirect()` inside try/catch** - Redirect won't work, throws internally

### Medium Priority Issues

- **Large Client Components with minimal interactivity** - Split into Server parent + small Client child
- **Not using generateStaticParams for known dynamic routes** - Missing build-time optimization
- **Fetching same data in generateMetadata and page** - Fetch is auto-memoized, but structure could be cleaner
- **Using template.tsx when layout.tsx would work** - template.tsx re-renders on navigation; use only when needed
- **Missing default.tsx in parallel routes** - Can cause 404s on hard refresh
- **Using Server Actions for data fetching** - Use Server Components instead
- **`useFormStatus` in same component as form** - Won't work, must be nested
- **Throwing errors for validation failures** - Clears form state, use return values
- **Missing pending/loading states** - Poor UX
- **Not using `startTransition` with event handler invocations** - Blocks UI

### Common Mistakes

- **Using router.push() in Client Component to close modal** - Use router.back() for proper modal dismissal
- **Wrapping entire app in Context Provider at wrong level** - Place providers inside `<body>` not around `<html>`
- **Using `dynamic` export without understanding implications** - Can disable caching unexpectedly
- **Not handling notFound() case in dynamic routes** - Returns generic 404 instead of contextual error
- **Mixing static metadata export with generateMetadata** - Choose one approach per route segment
- **Assuming Server Actions are private** - They're public HTTP endpoints
- **Not handling errors gracefully in Server Actions** - Crashes propagate to error boundary
- **Magic numbers for limits** - Use named constants
- **Calling `redirect()` before `revalidatePath()`** - Destination shows stale data
- **Parallel Server Action calls expecting parallelism** - They queue sequentially

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
- **Server Actions queue sequentially when called in parallel from client**
- **`redirect()` throws a special exception caught by Next.js** - Don't catch it
- **Setting/deleting cookies in actions triggers server re-render**
- **`useFormStatus` only works in components NESTED within the form**
- **FormData values are always strings (or File)** - Parse numbers explicitly
- **Server Actions create encrypted IDs recalculated between builds**
- **Dead code elimination removes unused actions from client bundle**
- **CSRF protection is built-in via POST-only and Origin header checking**
- **Next.js 16:** `revalidateTag()` requires a `cacheLife` profile as second argument (e.g. `revalidateTag("posts", "max")`)
- **Next.js 16:** New `updateTag()` API for read-your-writes semantics in Server Actions
- **Next.js 16:** New `refresh()` API for uncached data (vs revalidatePath for cached)
- **Next.js 16:** `middleware.ts` renamed to `proxy.ts`, export renamed from `middleware` to `proxy`
- **Next.js 16:** `experimental_ppr` route config removed; use `cacheComponents: true` in next.config
- **Next.js 16:** Turbopack is default bundler (opt out: `next build --webpack`)
- **Next.js 16:** Parallel routes require explicit `default.js` in all slots (builds fail without them)

---

## Version-Specific Changes

### Next.js 15 Breaking Changes from v14

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

#### `after()` (Stable - 15.1+)

Execute code after response finishes streaming (useful for logging, analytics):

```tsx
import { after } from "next/server";

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

#### `use cache` Directive (Stable in v16)

Explicit opt-in caching with `cacheComponents` flag enabled:

```tsx
// next.config.ts
const nextConfig = {
  cacheComponents: true, // v15: experimental.dynamicIO
};

// app/page.tsx
import { cacheLife } from "next/cache";

export default async function Page() {
  "use cache";
  cacheLife("hours"); // Built-in profile: 'max', 'hours', 'days'
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

### Next.js 16 Changes (Released October 2025)

**Removals in v16:**

- AMP support - all AMP APIs and configs removed
- `next lint` command - use ESLint or Biome directly
- `serverRuntimeConfig`, `publicRuntimeConfig` - use env variables
- `devIndicators` options (`appIsrStatus`, `buildActivity`, `buildActivityPosition`)
- Synchronous access to `params`, `searchParams`, `cookies()`, `headers()` - must await

**Breaking changes in v16:**

- `middleware.ts` -> `proxy.ts` (file + export rename, `edge` runtime not supported in proxy)
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
- **Turbopack** is default bundler (opt out: `next build --webpack`)
- **React Compiler** support stable (`reactCompiler: true` in config, not in `experimental`)
- Node.js 20.9+ required (18 no longer supported)
- TypeScript 5.1.0+ required
- Parallel routes require explicit `default.js` in all slots (builds fail without them)
- `experimental.turbopack` moved to top-level `turbopack` config
- `experimental.dynamicIO` renamed to `cacheComponents`
- `next/image` defaults changed (minimumCacheTTL 60s -> 4h, imageSizes removed 16px, qualities restricted to [75])

**New features in v16:**

- **React 19.2**: View Transitions, `useEffectEvent`, `<Activity>`
- **Cache Components**: `"use cache"` directive for explicit opt-in caching
- **`cacheLife` and `cacheTag`**: Stable (no `unstable_` prefix needed)
- **Enhanced routing**: Layout deduplication, incremental prefetching
- **Build Adapters API** (alpha): Custom adapters for deployment platforms
- **Next.js DevTools MCP**: AI-assisted debugging via Model Context Protocol

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

### Missing Authorization Check in Server Actions

Server Actions are public HTTP endpoints. Even if not imported elsewhere, they can be invoked if the ID is discovered.

```typescript
// WRONG - No authorization
"use server";

export async function deletePost(postId: string) {
  await db.post.delete({ where: { id: postId } }); // Anyone can delete!
}

// CORRECT - Authorization check
("use server");

export async function deletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const post = await getPost(postId);
  if (post?.authorId !== user.id) throw new Error("Forbidden");

  await db.post.delete({ where: { id: postId } });
}
```

### Redirect Inside Try/Catch

`redirect()` throws a special exception that Next.js catches. Wrapping it in try/catch prevents the redirect.

```typescript
// WRONG - Redirect won't work
"use server";

export async function createPost(formData: FormData) {
  try {
    await db.post.create({ data });
    revalidatePath("/posts");
    redirect("/posts"); // Caught by try/catch!
  } catch (error) {
    return { error: "Failed" };
  }
}

// CORRECT - Redirect outside try/catch
("use server");

export async function createPost(formData: FormData) {
  try {
    await db.post.create({ data });
  } catch (error) {
    return { error: "Failed" };
  }

  revalidatePath("/posts");
  redirect("/posts"); // Works correctly
}
```

### Forgetting to Revalidate Cache

After mutations, the UI shows stale data unless cache is revalidated.

```typescript
// WRONG - No revalidation
"use server";

export async function updatePost(postId: string, formData: FormData) {
  await db.post.update({ where: { id: postId }, data });
  // UI still shows old data!
}

// CORRECT - Cache revalidated
("use server");

import { revalidatePath } from "next/cache";

export async function updatePost(postId: string, formData: FormData) {
  await db.post.update({ where: { id: postId }, data });
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}
```

### useFormStatus in Wrong Component

`useFormStatus` must be called in a component that is a CHILD of the form, not in the component that renders the form.

```typescript
// WRONG - useFormStatus in form component
'use client'

export function PostForm() {
  const { pending } = useFormStatus() // Always false!

  return (
    <form action={createPost}>
      <button disabled={pending}>Submit</button>
    </form>
  )
}

// CORRECT - useFormStatus in nested component
'use client'

function SubmitButton() {
  const { pending } = useFormStatus() // Works!
  return <button disabled={pending}>Submit</button>
}

export function PostForm() {
  return (
    <form action={createPost}>
      <SubmitButton />
    </form>
  )
}
```

### Throwing Errors for Validation

Throwing errors triggers error boundaries and clears form state. Use return values for validation errors.

```typescript
// WRONG - Throws for validation
"use server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email.includes("@")) {
    throw new Error("Invalid email"); // Clears form!
  }
}

// CORRECT - Returns validation errors
("use server");

export async function signup(prevState: State, formData: FormData) {
  const email = formData.get("email") as string;
  if (!email.includes("@")) {
    return { errors: { email: ["Invalid email format"] } };
  }
  // ...
}
```

### Using Server Actions for Data Fetching

Server Actions are for mutations, not data fetching. Use Server Components for reads.

```typescript
// WRONG - Fetching in Server Action
'use server'

export async function getPosts() {
  return await db.post.findMany()
}

// In client component
const posts = await getPosts() // Anti-pattern

// CORRECT - Fetch in Server Component
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await db.post.findMany()
  return <PostList posts={posts} />
}
```

### Expecting Parallel Execution

Server Actions called in parallel from the client still execute sequentially (they queue).

```typescript
// WRONG - Expecting parallel execution
"use client";

export function BatchActions() {
  const handleAll = async () => {
    // These run SEQUENTIALLY, not in parallel
    await updateItem1();
    await updateItem2();
    await updateItem3();
  };
}

// CORRECT - Use Route Handler for true parallelism
// Or combine into single Server Action
("use server");

export async function updateAllItems(ids: string[]) {
  // Run in parallel within single action
  await Promise.all(ids.map((id) => updateItem(id)));
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

### Security Checklist (Server Actions)

- [ ] Every Server Action has `'use server'` directive
- [ ] Every Server Action validates input (Zod, etc.)
- [ ] Every Server Action checks authentication
- [ ] Every Server Action checks authorization (user can perform this action)
- [ ] No sensitive data in client-accessible code
- [ ] Error messages don't leak internal details
- [ ] Rate limiting considered for public-facing actions

### Performance Checklist (Server Actions)

- [ ] Cache revalidated after mutations (`revalidatePath` or `revalidateTag`)
- [ ] `redirect()` called AFTER `revalidatePath()`
- [ ] Pending states shown during action execution
- [ ] Optimistic updates used where appropriate (high-confidence actions)
- [ ] Related paths revalidated (list and detail pages)

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

### Server Action Quick Reference

#### Server Action Signature with useActionState

```typescript
// Action receives prevState as first parameter when used with useActionState
export async function action(
  prevState: StateType,
  formData: FormData,
): Promise<StateType> {
  // ...
}
```

#### useActionState Hook (React 19)

```typescript
const [state, formAction, isPending] = useActionState(
  serverAction,
  initialState,
);
// state: Current state returned from action
// formAction: Function to pass to form's action attribute
// isPending: Boolean indicating if action is running
```

**React 19 Note:** Replaces deprecated `ReactDOM.useFormState` from React Canary. Now part of core React package.

#### useFormStatus Hook (React 19)

```typescript
// Must be in component NESTED within form
const { pending, data, method, action } = useFormStatus();
// pending: Boolean, true while form is submitting
// data: FormData being submitted (React 19+)
// method: HTTP method (always 'POST' for Server Actions, React 19+)
// action: The action function (React 19+)
```

**React 19 Note:** In React 18, only `pending` is available. In React 19, `data`, `method`, and `action` are also returned.

#### useOptimistic Hook (React 19)

```typescript
const [optimisticState, addOptimistic] = useOptimistic(
  state,
  (currentState, optimisticValue) => {
    // Return new state with optimistic value merged
    return [...currentState, optimisticValue];
  },
);
```

**React 19 Note:** New hook for optimistic UI updates during async operations.

---

## Next.js 16 Caching APIs

### revalidateTag() (Updated in v16)

```typescript
// v15 (deprecated single argument)
revalidateTag("blog-posts");

// v16 - requires cacheLife profile as second argument
revalidateTag("blog-posts", "max");
// Built-in profiles: 'max', 'hours', 'days'
revalidateTag("news-feed", "hours");
// Or inline object:
revalidateTag("products", { expire: 3600 });
```

Use for content where slight delay is acceptable (blog posts, product catalogs). Users receive cached data while fresh data loads in background.

### updateTag() (New in v16)

Server Actions-only API with read-your-writes semantics - expires cache and immediately refreshes within the same request:

```typescript
"use server";

import { updateTag } from "next/cache";

export async function updateUserProfile(userId: string, formData: FormData) {
  await db.users.update(userId, formData);

  // Expire cache and refresh immediately - user sees changes right away
  updateTag(`user-${userId}`);
}
```

Use for forms, user settings, and workflows where users expect to see their updates instantly.

### refresh() (New in v16)

Server Actions-only API for refreshing uncached data. Does not touch the cache:

```typescript
"use server";

import { refresh } from "next/cache";

export async function markNotificationAsRead(notificationId: string) {
  await db.notifications.markAsRead(notificationId);

  // Refresh uncached data displayed elsewhere on the page
  refresh();
}
```

Use when you need to refresh uncached data (notification counts, live metrics) after performing an action.

### When to Use Each

| API                           | Purpose                                 | Scope               |
| ----------------------------- | --------------------------------------- | ------------------- |
| `revalidateTag(tag, profile)` | Stale-while-revalidate for tagged cache | Any server context  |
| `updateTag(tag)`              | Read-your-writes for tagged cache       | Server Actions only |
| `refresh()`                   | Refresh uncached data                   | Server Actions only |
| `revalidatePath(path)`        | Invalidate specific route cache         | Any server context  |

### Migration Codemod

```bash
# Automated migration to v16
npx @next/codemod@canary upgrade latest
```
