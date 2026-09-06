---
name: web-meta-framework-nextjs
description: Next.js App Router patterns (15-16) - file-based routing, Server/Client Components, streaming, Suspense, metadata API, parallel routes, Server Actions, mutations, revalidation, Cache Components
---

# Next.js App Router Patterns

> **Quick Guide:** Server Components are the default and `"use client"` is opt-in, so keep client
> components small and at the leaves of the tree. Reads happen in Server Components; writes happen in
> Server Actions, which are public HTTP endpoints and revalidate the cache themselves. Two version
> facts change the answers below: from 15, `params`, `searchParams`, `cookies()` and `headers()` are
> Promises; in 16, `middleware.ts` became `proxy.ts`, `revalidateTag()` takes a `cacheLife` profile,
> and `experimental_ppr` became `cacheComponents`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — file conventions, dynamic routes, layouts, error and not-found UI, server-only code
- [examples/server-components.md](examples/server-components.md) — the Server/Client boundary, composition, streaming with Suspense
- [examples/metadata.md](examples/metadata.md) — title templates, `generateMetadata`, Open Graph and Twitter cards
- [examples/parallel-routes.md](examples/parallel-routes.md) — `@slot` folders, intercepting routes, the modal pattern
- [examples/route-groups.md](examples/route-groups.md) — one layout per section without changing URLs
- [examples/versions.md](examples/versions.md) — PPR, Turbopack, typed routes, `after()`, instrumentation, and the v16 migration
- [examples/server-actions.md](examples/server-actions.md) — action definition, form actions, validation, authorization, pending states
- [examples/mutations.md](examples/mutations.md) — running independent actions together
- [examples/revalidation.md](examples/revalidation.md) — path versus tag invalidation, tagging fetches
- [examples/optimistic.md](examples/optimistic.md) — `useOptimistic` for instant feedback
- [examples/event-handlers.md](examples/event-handlers.md) — invoking actions from click handlers with `useTransition`
- [examples/streaming.md](examples/streaming.md) — progress updates from long-running actions
- [examples/cookies.md](examples/cookies.md) — reading and writing cookies inside actions
- [reference.md](reference.md) — decision trees, route segment config, hook signatures, version-by-version changes

---

## Which path applies

- **On Next.js 16** — caching is opt-in and several APIs were renamed; read the migration half of
  [examples/versions.md](examples/versions.md) before copying any cache,
  middleware or parallel-route pattern.
- **On the Pages Router (`pages/`)** — a different set of conventions applies and none of the files
  above describe it.

---

<critical_requirements>

## Before writing Next.js code

**Write components as Server Components, and add `"use client"` only for state, effects or event
handlers.** The directive is what decides whether the code ships to the browser, so keeping it at the
leaves keeps the bundle small and secrets on the server.

**Import `server-only` in any module that touches a secret.** The build then fails at the offending
import instead of shipping the key to the browser.

**Give data-heavy routes a `loading.tsx`, and independent sections their own `<Suspense>`.**
`loading.tsx` wraps the page in a boundary automatically; a boundary per section stops the slowest
fetch blocking the fastest.

**Set SEO through the `metadata` object or `generateMetadata`.** Next.js deduplicates and orders
those tags, which manual `<head>` markup does not.

**Mark Server Actions with `'use server'` — at the top of the file, or at the top of the async
function.** Without it the function is bundled for the client.

**Validate the input and check authorization inside every Server Action.** An action is a public HTTP
endpoint reachable by its ID, so both the caller's identity and the payload's shape are unverified
until the action verifies them.

**Call `revalidatePath()` or `revalidateTag()` after a mutation, and before any `redirect()`.** The
cache is what the next render reads, and `redirect()` throws, so nothing after it runs.

**Await `params`, `searchParams`, `cookies()` and `headers()`.** All four are Promises from 15
onward.

</critical_requirements>

---

**Auto-detection:** page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx, default.tsx,
template.tsx, "use client", "use server", "use cache", App Router, Server Components, Client
Components, generateMetadata, generateStaticParams, parallel routes, intercepting routes,
revalidatePath, revalidateTag, updateTag, useActionState, useFormStatus, useOptimistic, next/form,
next/cache, next/navigation, cacheComponents, cacheLife, cacheTag, PPR, Turbopack, typedRoutes,
instrumentation.ts, proxy.ts, after()

**Applies to:**

- Routing an app through the `app/` directory, with layouts, loading states and error boundaries
- Deciding which components run on the server and which ship to the browser
- Streaming and progressive rendering with Suspense
- SEO through the Metadata API, and static generation with `generateStaticParams`
- Parallel and intercepting routes, including modals with shareable URLs
- Creating, updating and deleting data in Server Actions, and invalidating the cache afterwards

**Handled elsewhere:**

- Persistence — an action calls a data layer; neither the client nor the query shape is settled here
- Authentication and session retrieval — the action asks who the caller is and acts on the answer
- Schema validation — an action parses `FormData` through a schema; which schema library defines it
  is a separate choice
- Component styling — components take a `className`, and the styling approach is someone else's
- Client state that outlives a single component tree — Client Components receive data as props

---

<philosophy>

## Philosophy

The App Router inverts React's default: components run on the server unless they say otherwise, and
client-side JavaScript is opt-in. That removes the client-server fetch waterfall, because a component
can await its own data, and it keeps the bundle proportional to the interactivity a page actually
has.

Four consequences shape every pattern here:

1. **Streaming** — HTML reaches the browser as it becomes available rather than when the slowest
   query finishes
2. **Colocation** — data fetching, metadata and UI live in the same segment
3. **Nested layouts** — a layout persists across navigations inside its segment, so its state and its
   DOM survive
4. **Server-side mutations** — a Server Action runs on the server and revalidates the cache in the
   same round trip, so the UI and the data refresh together

Server Actions suit form submissions and mutations coupled to UI. Route Handlers suit external API
consumers, webhooks, and work that has to run in parallel — actions invoked from the client queue.

`useActionState`, `useFormStatus` and `useOptimistic` are React 19 hooks rather than Next.js APIs;
`useActionState` replaces the Canary-era `ReactDOM.useFormState`.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: The Server/Client boundary

Fetch in a Server Component and pass the result down; the Client Component owns only the
interaction.

```tsx
// app/dashboard/page.tsx — a Server Component, no directive needed
export default async function DashboardPage() {
  const user = await getUser(); // runs on the server, ships no JavaScript
  return <UserProfile user={user} />; // Client Component, receives data as props
}
```

A Client Component can still wrap Server Components, as long as they arrive through `children`
rather than being imported inside it.

Full code: [examples/server-components.md](examples/server-components.md)

### Pattern 2: Streaming with `loading.tsx` and Suspense

`loading.tsx` covers a whole route; a `<Suspense>` per section lets each one arrive on its own.

```tsx
<Suspense fallback={<ChartSkeleton />}>
  <RevenueChart /> {/* slow query — streams in independently */}
</Suspense>
<Suspense fallback={<InvoicesSkeleton />}>
  <LatestInvoices />
</Suspense>
```

Full code: [examples/server-components.md](examples/server-components.md)

### Pattern 3: Route file conventions

Folders define routes; the special files define behaviour for the segment and everything under it.

```
app/dashboard/
├── layout.tsx      persists across navigations within the segment
├── page.tsx        the route itself — without it the URL is not reachable
├── loading.tsx     wraps page.tsx in a Suspense boundary automatically
├── error.tsx       "use client"; receives { error, reset }
└── not-found.tsx   rendered when the segment calls notFound()
```

Full code: [examples/core.md](examples/core.md). The complete file table is in
[reference.md](reference.md).

### Pattern 4: Dynamic segments

Bracket depth chooses between one segment, many, and optionally none.

```tsx
// app/users/[id]/page.tsx       → /users/1          params: { id: string }
// app/docs/[...slug]/page.tsx   → /docs/a/b         params: { slug: string[] }
// app/shop/[[...slug]]/page.tsx → /shop, /shop/a    params: { slug?: string[] }

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
}
```

Pair with `generateStaticParams` to pre-render the known values at build time.

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Route groups, parallel routes and interception

Three folder conventions that change layout and rendering without changing the URL.

```
app/
├── (marketing)/layout.tsx      route group — one layout per section, no URL segment
├── dashboard/@analytics/       parallel slot — arrives as a prop on dashboard/layout.tsx
├── @modal/(.)photo/[id]/       intercepts /photo/[id] on soft navigation only
└── @modal/default.tsx          what a slot renders when nothing matches
```

Every slot needs a `default.tsx`; on Next.js 16 the build fails without one.

Full code: [examples/route-groups.md](examples/route-groups.md) and
[examples/parallel-routes.md](examples/parallel-routes.md)

### Pattern 6: Metadata

Export a static object where the values are known, and a function where they come from the route's
own data.

```tsx
export const metadata: Metadata = {
  title: { template: "%s | Acme", default: "Acme" },
};

// or, when the title depends on the route's data:
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const post = await getPost((await params).slug); // memoised with the page's own fetch
  return {
    title: post.title,
    openGraph: { title: post.title, type: "article" },
  };
}
```

Full code: [examples/metadata.md](examples/metadata.md)

### Pattern 7: Defining and invoking a Server Action

A file-level `'use server'` marks every export as an action, which is what lets a Client Component
import one.

```tsx
// app/actions.ts
"use server";
export async function createPost(formData: FormData) {
  /* ... */
}

// app/posts/new/page.tsx — a plain form, so it submits without JavaScript
<form action={createPost}>...</form>;
```

`action.bind(null, id)` passes arguments beyond the `FormData`, and keeps the form working
unenhanced. For a non-form trigger, call the action inside `startTransition` so the click does not
block the UI.

Full code: [examples/server-actions.md](examples/server-actions.md) and
[examples/event-handlers.md](examples/event-handlers.md)

### Pattern 8: Validation and authorization inside the action

Both checks belong in the action body, because that is the only code path an attacker cannot skip.

```ts
"use server";
export async function deletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const post = await getPost(postId);
  if (post?.authorId !== user.id) throw new Error("Forbidden");

  await deletePostRecord(postId);
  revalidatePath("/posts");
}
```

Return validation failures rather than throwing them — a throw reaches the error boundary and clears
the form.

Full code: [examples/server-actions.md](examples/server-actions.md)

### Pattern 9: Revalidation, then redirect

`revalidatePath` targets known routes; `revalidateTag` targets data wherever it is displayed.

```ts
"use server";
export async function createPost(formData: FormData) {
  // ...mutate
  revalidatePath("/posts"); // v16: revalidateTag("posts", "max")
  redirect("/posts"); // throws — nothing below this line runs
}
```

Full code: [examples/revalidation.md](examples/revalidation.md)

### Pattern 10: Pending and optimistic state

Three React 19 hooks cover the wait: one for form state, one for a nested submit button, one for
showing the result before it lands.

```tsx
const [state, formAction, isPending] = useActionState(createPost, initialState);

// useFormStatus() reads the same pending flag, but only from a component *inside* the form
const [optimisticMessages, addOptimistic] = useOptimistic(
  messages,
  (state, content: string) => [
    ...state,
    { id: `temp-${Date.now()}`, content, pending: true },
  ],
);
```

Full code: [examples/optimistic.md](examples/optimistic.md) and
[examples/server-actions.md](examples/server-actions.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `'use server'` missing from an action file — the function is bundled for the client, taking its
  imports and any secret they reach with it
- No authorization check inside an action — the action ID is discoverable, so anyone can invoke it
- No input validation inside an action — `FormData` arrives unparsed and untyped from an
  unauthenticated caller
- `redirect()` inside `try`/`catch` — it signals by throwing, so the `catch` swallows the navigation
- Reading `params`, `searchParams`, `cookies()` or `headers()` without `await` — all four are
  Promises from 15 onward
- `error.tsx` without `"use client"` — the `reset` callback needs a client boundary
- A secret read in a `"use client"` module — the value is in the browser bundle
- On Next.js 16: a parallel route slot with no `default.tsx` — the build fails
- On Next.js 16: `revalidateTag("tag")` with one argument — a `cacheLife` profile is now required

**Surprising behaviour:**

- `useFormStatus()` returns `pending: false` forever when called in the component that renders the
  form; it only reads a form it is nested inside
- Missing `revalidatePath`/`revalidateTag` after a mutation leaves the UI showing the pre-mutation
  cache with no error anywhere
- Server Actions invoked in parallel from the client queue and run one at a time
- Throwing for a validation failure clears the user's form — return the errors instead
- `"use client"` on `page.tsx` makes the whole subtree client-side, which is legal and quietly
  discards every server-rendering benefit
- From 15, `fetch` is not cached by default under dynamic rendering, and GET Route Handlers are not
  cached either
- Setting or deleting a cookie inside an action triggers a server re-render

More gotchas, the full anti-pattern set and the version-by-version changes are in
[reference.md](reference.md).

</red_flags>
