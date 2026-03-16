---
name: web-meta-framework-nextjs
description: Next.js App Router patterns (15-16) - file-based routing, Server/Client Components, streaming, Suspense, metadata API, parallel routes, Server Actions, mutations, revalidation, Cache Components
---

# Next.js App Router Patterns

> **Quick Guide:** Use Server Components by default, add `"use client"` only for interactivity. Use `loading.tsx` for route-level loading states, `<Suspense>` for granular streaming. Keep Client Components small and leaf-level. Use Server Actions for mutations with `'use server'` directive, revalidate cache after every mutation.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use Server Components by default - add `"use client"` ONLY when you need state, effects, or event handlers)**

**(You MUST keep `"use client"` components small and push them to the leaves of your component tree)**

**(You MUST use `loading.tsx` for route-level loading states and `<Suspense>` for granular streaming)**

**(You MUST use the Metadata API (`metadata` object or `generateMetadata`) for SEO - never manual `<head>` tags)**

**(You MUST use `server-only` package for code with secrets to prevent accidental client exposure)**

**(You MUST add `'use server'` directive at the top of the file OR at the top of the async function for Server Actions)**

**(You MUST revalidate the cache after mutations using `revalidatePath()` or `revalidateTag()`)**

**(You MUST validate all input data on the server - client-side validation is NOT sufficient for security)**

**(You MUST perform authorization checks inside EVERY Server Action - they are public HTTP endpoints)**

**(You MUST call `revalidatePath()` BEFORE `redirect()` to ensure fresh data)**

</critical_requirements>

---

**Auto-detection:** Next.js App Router, page.tsx, layout.tsx, loading.tsx, error.tsx, Server Components, Client Components, "use client", streaming, Suspense, parallel routes, intercepting routes, generateMetadata, generateStaticParams, Turbopack, next/form, use cache, cacheComponents, cacheLife, cacheTag, PPR, instrumentation.ts, after(), typedRoutes, proxy.ts, updateTag, refresh, Server Actions, use server directive, revalidatePath, revalidateTag, formAction, useActionState, useFormStatus, useOptimistic, server mutation

**When to use:**

- Building Next.js applications with the App Router (`app/` directory)
- Implementing file-based routing with layouts, loading states, and error boundaries
- Deciding when to use Server Components vs Client Components
- Implementing streaming and progressive rendering with Suspense
- Setting up SEO with the Metadata API
- Building advanced routing patterns (parallel routes, intercepting routes, modals)
- Creating, updating, or deleting data with Server Actions
- Performing server-side mutations triggered by user actions
- Invalidating cached data after state changes

**Key patterns covered:**

- File conventions (page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx)
- Server Components vs Client Components boundary decisions
- Streaming with Suspense and loading.tsx
- Parallel Routes and Intercepting Routes for modals
- Route Groups and Dynamic Routes
- Metadata API for SEO optimization
- generateStaticParams for static generation
- Next.js 15.5+ features (PPR, Turbopack builds, typed routes, after() API)
- Next.js 16 features (Cache Components, proxy.ts, updateTag, refresh, React 19.2)
- Server Action definition (`'use server'` directive)
- Form actions with progressive enhancement
- Cache revalidation patterns (revalidatePath, revalidateTag)
- Pending states (useActionState, useFormStatus)
- Optimistic updates (useOptimistic)
- Error handling and validation in Server Actions

**When NOT to use:**

- Pages Router (`pages/` directory) - different patterns apply
- Pure React without Next.js framework
- Non-App Router Next.js projects

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**App Router patterns:**

- [examples/core.md](examples/core.md) - File conventions, dynamic routes, layouts, error handling, server-only code
- [examples/server-components.md](examples/server-components.md) - Server vs Client Components, composition patterns, streaming with Suspense
- [examples/metadata.md](examples/metadata.md) - Static metadata, dynamic generateMetadata, Open Graph, SEO
- [examples/parallel-routes.md](examples/parallel-routes.md) - Parallel routes, intercepting routes, modal patterns
- [examples/route-groups.md](examples/route-groups.md) - Route groups for different layouts per section
- [examples/nextjs-15-features.md](examples/nextjs-15-features.md) - PPR, Turbopack builds, typed routes, after() API, instrumentation, Next.js 16 migration

**Server Actions & Mutations:**

- [examples/server-actions.md](examples/server-actions.md) - Server Action definition, form actions, validation, authorization, pending states
- [examples/mutations.md](examples/mutations.md) - Parallel mutations, running independent actions concurrently
- [examples/revalidation.md](examples/revalidation.md) - Cache invalidation strategies, path vs tag revalidation
- [examples/optimistic.md](examples/optimistic.md) - useOptimistic for instant UI feedback
- [examples/event-handlers.md](examples/event-handlers.md) - Calling Server Actions from click handlers, useTransition
- [examples/streaming.md](examples/streaming.md) - Streaming progress updates for long-running operations
- [examples/cookies.md](examples/cookies.md) - Cookie manipulation in Server Actions

---

<philosophy>

## Philosophy

The App Router represents a paradigm shift from traditional React: **Server Components are the default**, and client-side JavaScript is opt-in. This reduces bundle size, improves initial load performance, and allows data fetching directly in components without client-server waterfalls.

**Core principles:**

1. **Server-first rendering** - Components run on the server by default, shipping zero JavaScript to the client
2. **Streaming and progressive rendering** - HTML streams to the browser as it becomes available
3. **Colocation** - Data fetching, styling, and metadata live alongside the components that need them
4. **Nested layouts** - Layouts persist across navigations, preserving state and avoiding re-renders
5. **File-based conventions** - Special files define behavior (page.tsx, layout.tsx, loading.tsx, error.tsx)
6. **Server-side mutations** - Server Actions execute on the server with integrated cache revalidation
7. **Progressive enhancement** - Form-based actions work without JavaScript enabled

**Server Actions are asynchronous functions that execute on the server**, invoked via network requests from the client. They integrate with Next.js caching and revalidation, enabling single-roundtrip updates where both UI and data refresh together. Server Actions are ideal for form submissions and mutations tightly coupled to UI. Use Route Handlers for external API consumers, webhooks, or complex multi-step operations requiring parallel execution.

**React 19 Integration:**

- `useActionState`, `useFormStatus`, and `useOptimistic` are React 19 hooks (not Next.js-specific)
- `useActionState` replaces the deprecated `ReactDOM.useFormState` from React Canary
- These hooks work with Server Actions for form state management

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: File-Based Routing Conventions

The App Router uses a file-system based router where folders define routes and special files define UI and behavior.

#### File Conventions

| File            | Purpose                                                        | Required |
| --------------- | -------------------------------------------------------------- | -------- |
| `page.tsx`      | Unique UI for a route, makes the route publicly accessible     | Yes      |
| `layout.tsx`    | Shared UI for a segment and its children, preserves state      | No       |
| `loading.tsx`   | Loading UI for a segment, automatically wraps page in Suspense | No       |
| `error.tsx`     | Error UI for a segment, catches runtime errors                 | No       |
| `not-found.tsx` | Not found UI, triggered by `notFound()` function               | No       |
| `template.tsx`  | Re-rendered layout (doesn't preserve state)                    | No       |
| `default.tsx`   | Fallback UI for parallel routes when no match                  | No       |

#### Route Segment Structure

```
app/
├── layout.tsx           # Root layout (required)
├── page.tsx             # Home page (/)
├── loading.tsx          # Loading state for /
├── error.tsx            # Error boundary for /
├── not-found.tsx        # 404 page
├── dashboard/
│   ├── layout.tsx       # Dashboard layout (nested)
│   ├── page.tsx         # /dashboard
│   ├── loading.tsx      # Loading state for /dashboard
│   ├── settings/
│   │   └── page.tsx     # /dashboard/settings
│   └── [id]/
│       └── page.tsx     # /dashboard/:id (dynamic)
└── (marketing)/         # Route group (no URL impact)
    ├── about/
    │   └── page.tsx     # /about
    └── blog/
        └── page.tsx     # /blog
```

**Why this works:** File conventions eliminate boilerplate routing configuration, layouts automatically nest, and special files provide consistent behavior patterns across the app.

---

### Pattern 2: Server Components vs Client Components

Server Components are the default in the App Router. Use `"use client"` directive only when necessary.

#### When to Use Server Components (Default)

- Fetching data from databases or APIs
- Accessing backend resources (file system, environment variables)
- Keeping sensitive information on the server (API keys, tokens)
- Reducing client-side JavaScript bundle
- Rendering static content

#### When to Use Client Components (`"use client"`)

- Adding interactivity with event handlers (`onClick`, `onChange`)
- Using React state (`useState`, `useReducer`)
- Using lifecycle effects (`useEffect`, `useLayoutEffect`)
- Using browser-only APIs (`localStorage`, `window`, `navigator`)
- Using custom hooks that depend on state or effects

#### Composition Pattern: Server Wrapping Client

```tsx
// app/dashboard/page.tsx (Server Component - default)
import { getUser } from "@/lib/data";
import { UserProfile } from "./user-profile";

export default async function DashboardPage() {
  const user = await getUser(); // Server-side data fetch

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Pass data as props to Client Component */}
      <UserProfile user={user} />
    </div>
  );
}
```

```tsx
// app/dashboard/user-profile.tsx (Client Component)
"use client";

import { useState } from "react";
import type { User } from "@/lib/types";

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      <p>{user.name}</p>
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? "Cancel" : "Edit"}
      </button>
    </div>
  );
}
```

**Why good:** Server Component fetches data without client-side JavaScript, Client Component handles only the interactive parts, minimal JavaScript shipped to browser

---

### Pattern 3: Streaming with Suspense and loading.tsx

Streaming allows progressive rendering by sending HTML chunks as they become available.

#### Route-Level Loading with loading.tsx

```tsx
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}
```

**Why good:** Automatically wraps page in Suspense boundary, shows loading state immediately while data fetches, no manual Suspense setup needed

#### Granular Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { RevenueChart, RevenueChartSkeleton } from "./revenue-chart";
import { LatestInvoices, InvoicesSkeleton } from "./latest-invoices";

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Each section streams independently */}
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<InvoicesSkeleton />}>
        <LatestInvoices />
      </Suspense>
    </div>
  );
}
```

**Why good:** Slow data fetches don't block fast ones, users see content progressively, each section loads independently improving perceived performance

---

### Pattern 4: Layouts and Nested Layouts

Layouts wrap page content and persist across navigations within their segment.

#### Root Layout (Required)

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Acme",
    default: "Acme",
  },
  description: "The React Framework for the Web",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

#### Nested Layout with Navigation

```tsx
// app/dashboard/layout.tsx
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <DashboardNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

**Why good:** Navigation state persists when switching between dashboard pages, layout doesn't re-render on navigation, shared UI defined once

---

### Pattern 5: Error Handling with error.tsx

Error boundaries catch runtime errors and display fallback UI.

#### Error Boundary Component

```tsx
// app/dashboard/error.tsx
"use client"; // Error components must be Client Components

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div role="alert" className="p-6 text-center">
      <h2>Something went wrong!</h2>
      <p className="text-red-600">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

**Why good:** Errors are contained to the segment (rest of app remains functional), reset function allows retry without full page reload, digest provides server-side error reference

#### Global Error Handler

```tsx
// app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

**Note:** global-error.tsx must define its own `<html>` and `<body>` tags as it replaces the root layout when triggered.

---

### Pattern 6: Metadata API for SEO

Use static `metadata` object or dynamic `generateMetadata` function for SEO.

#### Static Metadata

```tsx
// app/about/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn more about our company",
  openGraph: {
    title: "About Us | Acme",
    description: "Learn more about our company",
    images: ["/og-about.png"],
  },
};

export default function AboutPage() {
  return <h1>About Us</h1>;
}
```

#### Dynamic Metadata with generateMetadata

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { getPost } from "@/lib/data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: "Post Not Found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  // ...
}
```

**Why good:** Type-safe metadata, automatic deduplication, fetch requests memoized across generateMetadata and page component

---

### Pattern 7: Static Generation with generateStaticParams

Pre-render dynamic routes at build time for performance.

```tsx
// app/blog/[slug]/page.tsx
import { getAllPosts, getPost } from "@/lib/data";

// Generate static params at build time
export async function generateStaticParams() {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
```

**Why good:** Pages pre-rendered at build time for instant loading, combined with generateMetadata for complete static optimization, new posts added via ISR

---

### Pattern 8: Dynamic Routes

Use folder naming conventions for dynamic segments.

#### Single Dynamic Segment

```tsx
// app/users/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
  return <h1>User: {id}</h1>;
}
```

#### Catch-All Segments

```tsx
// app/docs/[...slug]/page.tsx
// Matches /docs/a, /docs/a/b, /docs/a/b/c, etc.

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  // slug is an array: ["a", "b", "c"]
  return <h1>Docs: {slug.join("/")}</h1>;
}
```

#### Optional Catch-All Segments

```tsx
// app/shop/[[...slug]]/page.tsx
// Matches /shop, /shop/a, /shop/a/b, etc.

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function ShopPage({ params }: PageProps) {
  const { slug } = await params;
  // slug is undefined for /shop, or an array for nested paths
  return <h1>Shop: {slug?.join("/") ?? "All Products"}</h1>;
}
```

---

### Pattern 9: Route Groups

Organize routes without affecting URL structure using `(groupName)` folders.

```
app/
├── (marketing)/
│   ├── layout.tsx      # Marketing-specific layout
│   ├── about/
│   │   └── page.tsx    # /about (not /marketing/about)
│   └── blog/
│       └── page.tsx    # /blog
├── (shop)/
│   ├── layout.tsx      # Shop-specific layout
│   └── products/
│       └── page.tsx    # /products
└── layout.tsx          # Root layout
```

**Why good:** Different layouts for different sections without URL nesting, logical grouping of related routes, multiple root layouts possible

---

### Pattern 10: Parallel Routes and Slots

Render multiple pages simultaneously in the same layout using `@slot` folders.

#### Dashboard with Multiple Slots

```
app/
└── dashboard/
    ├── @analytics/
    │   ├── page.tsx       # Analytics slot content
    │   └── default.tsx    # Fallback when no match
    ├── @team/
    │   ├── page.tsx       # Team slot content
    │   └── default.tsx
    ├── layout.tsx         # Receives slots as props
    └── page.tsx           # Main dashboard content
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">{children}</div>
      <div>{analytics}</div>
      <div>{team}</div>
    </div>
  );
}
```

**Why good:** Independent loading states per slot, parallel data fetching, conditional rendering based on user role

---

### Pattern 11: Intercepting Routes for Modals

Intercept navigation to show content in a modal while preserving the original route.

#### Modal Pattern Structure

```
app/
├── @modal/
│   ├── (.)photo/[id]/
│   │   └── page.tsx      # Intercepted route (modal)
│   └── default.tsx       # Returns null when no modal
├── photo/[id]/
│   └── page.tsx          # Full page (direct navigation)
└── layout.tsx
```

#### Intercepting Convention

| Convention | Description         |
| ---------- | ------------------- |
| `(.)`      | Match same level    |
| `(..)`     | Match one level up  |
| `(..)(..)` | Match two levels up |
| `(...)`    | Match from root     |

```tsx
// app/@modal/(.)photo/[id]/page.tsx
import { Modal } from "@/components/modal";
import { getPhoto } from "@/lib/data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotoModal({ params }: PageProps) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <Modal>
      <img src={photo.url} alt={photo.title} />
      <p>{photo.title}</p>
    </Modal>
  );
}
```

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

**Why good:** Modal shows on soft navigation with shareable URL, full page renders on hard refresh or direct link, back button closes modal

---

### Pattern 12: Defining Server Actions

Define Server Actions using the `'use server'` directive. Place it at the file level (recommended for Client Component imports) or function level (for Server Components).

#### File-Level Directive (Recommended)

```typescript
// app/actions.ts
"use server";

import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  // Mutation logic here (defer to your database solution)
  // ...

  revalidatePath("/posts");
}
```

**Why good:** File-level directive marks all exports as Server Actions, clear separation of server code, can be imported into Client Components

#### Function-Level Directive (Server Components Only)

```typescript
// app/page.tsx - Server Component
export default function Page() {
  async function createPost(formData: FormData) {
    'use server'
    // Server Action logic
  }

  return <form action={createPost}>...</form>
}
```

**Why good:** Inline definition when action is only used in one place, directive at function level keeps action close to usage

---

### Pattern 13: Form Actions with Progressive Enhancement

Invoke Server Actions via the `action` attribute on forms. This enables progressive enhancement - forms work even without JavaScript.

```typescript
// app/posts/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input type="text" name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

**Why good:** Form works without JavaScript (progressive enhancement), FormData automatically passed to action, native browser form validation works

**When to use:** Any form that performs a mutation - this is the primary invocation pattern for Server Actions.

---

### Pattern 14: Cache Revalidation

After mutations, revalidate the cache to reflect changes in the UI. Use `revalidatePath()` for specific routes or `revalidateTag()` for tagged data.

#### revalidatePath - Refresh Specific Routes

```typescript
"use server";

import { revalidatePath } from "next/cache";

export async function updatePost(id: string, formData: FormData) {
  // Update in database...

  // Revalidate the posts list page
  revalidatePath("/posts");

  // Revalidate the specific post page
  revalidatePath(`/posts/${id}`);
}
```

**Why good:** Invalidates cached data for specific routes, UI shows fresh data after mutation

#### revalidateTag - Invalidate Tagged Cache

```typescript
"use server";

import { revalidateTag } from "next/cache";

export async function createPost(formData: FormData) {
  // Create in database...

  // Invalidate all data tagged with 'posts'
  revalidateTag("posts");
}
```

**Why good:** Invalidates all cached data with a specific tag, useful when multiple routes display the same data

**When to use:** Use `revalidatePath()` for route-specific invalidation, `revalidateTag()` for cross-route invalidation of tagged data.

---

### Pattern 15: Post-Mutation Redirect

Redirect users after successful mutations. Call `revalidatePath()` BEFORE `redirect()` to ensure the destination shows fresh data.

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPost(formData: FormData) {
  // Create in database...

  // Revalidate BEFORE redirect
  revalidatePath("/posts");

  // Redirect to posts list
  redirect("/posts");
}
```

**Why good:** Ensures destination page shows updated data, `redirect()` throws internally so nothing runs after it

---

### Pattern 16: Passing Additional Arguments with bind()

Pass arguments beyond FormData using JavaScript's `bind()` method.

```typescript
// actions.ts
"use server";

export async function updateUser(userId: string, formData: FormData) {
  const name = formData.get("name") as string;
  // Update user with userId...
}
```

```typescript
// components/user-form.tsx
'use client'

import { updateUser } from '@/app/actions'

export function UserForm({ userId }: { userId: string }) {
  const updateUserWithId = updateUser.bind(null, userId)

  return (
    <form action={updateUserWithId}>
      <input type="text" name="name" />
      <button type="submit">Update</button>
    </form>
  )
}
```

**Why good:** Passes additional context (IDs, etc.) to Server Actions, works with progressive enhancement, type-safe with TypeScript

---

### Pattern 17: Event Handler Invocation

Invoke Server Actions from event handlers when not using forms.

```typescript
// components/like-button.tsx
'use client'

import { useState, useTransition } from 'react'
import { incrementLike } from '@/app/actions'

export function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const updatedLikes = await incrementLike()
      setLikes(updatedLikes)
    })
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Liking...' : `Likes: ${likes}`}
    </button>
  )
}
```

**Why good:** `startTransition` prevents UI blocking during action execution, pending state provides user feedback, works for non-form interactions

**When to use:** Toggle buttons, quick actions, any mutation not tied to a form submission.

---

### Pattern 18: Server-Side Validation

Validate all input data on the server. Use a validation library for type-safe parsing.

```typescript
// app/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
});

export async function createPost(formData: FormData) {
  const rawData = {
    title: formData.get("title"),
    content: formData.get("content"),
  };

  const validatedFields = CreatePostSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Proceed with mutation using validatedFields.data
  // ...

  revalidatePath("/posts");
  return { success: true };
}
```

**Why good:** Server-side validation cannot be bypassed, type-safe data after validation, structured error response for UI feedback

---

### Pattern 19: Authorization in Server Actions

Server Actions are public HTTP endpoints. Perform authorization checks inside EVERY action.

```typescript
// app/actions.ts
"use server";

import { revalidatePath } from "next/cache";

export async function deletePost(postId: string) {
  // Defer to your authentication solution for user/session retrieval
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized: Not authenticated");
  }

  // Defer to your database solution for fetching the post
  const post = await getPost(postId);

  if (!post) {
    throw new Error("Not found");
  }

  if (post.authorId !== user.id) {
    throw new Error("Forbidden: Not the author");
  }

  // Proceed with deletion
  // ...

  revalidatePath("/posts");
}
```

**Why good:** Every action verifies identity and permissions, prevents unauthorized access even if action ID is discovered, follows defense-in-depth principle

</patterns>

---

<integration>

## Integration Guide

**Next.js App Router is the framework foundation.** It handles routing, rendering strategies, and data fetching patterns. Other skills build on top of it.

**Styling integration:**

- Apply styles via `className` prop on components
- Global styles imported in root layout
- CSS Modules work with both Server and Client Components

**Data fetching integration:**

- Server Components fetch data directly (no client-side fetching library needed for server data)
- Client Components use your data fetching solution for client-side state

**State integration:**

- Server state: fetch in Server Components, pass as props
- Client state: use your state management solution in Client Components only

**Server Actions integration:**

- Server Actions are framework-agnostic for business logic - they receive data, perform mutations, and revalidate cache
- **Forms**: Native HTML forms with `action` attribute
- **React hooks**: `useActionState`, `useFormStatus`, `useOptimistic` for UI states
- **Cache**: Next.js cache system via `revalidatePath()` and `revalidateTag()`
- **Navigation**: `redirect()` for post-mutation navigation

**Defers to:**

- **Database operations**: Use your database/ORM solution for queries and mutations
- **Authentication**: Use your auth solution for user/session retrieval
- **Form UI components**: Use your component library for form elements
- **Validation libraries**: Use Zod, Valibot, or similar for schema validation

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Server Components by default - add `"use client"` ONLY when you need state, effects, or event handlers)**

**(You MUST keep `"use client"` components small and push them to the leaves of your component tree)**

**(You MUST use `loading.tsx` for route-level loading states and `<Suspense>` for granular streaming)**

**(You MUST use the Metadata API (`metadata` object or `generateMetadata`) for SEO - never manual `<head>` tags)**

**(You MUST use `server-only` package for code with secrets to prevent accidental client exposure)**

**(You MUST add `'use server'` directive at the top of the file OR at the top of the async function for Server Actions)**

**(You MUST revalidate the cache after mutations using `revalidatePath()` or `revalidateTag()`)**

**(You MUST validate all input data on the server - client-side validation is NOT sufficient for security)**

**(You MUST perform authorization checks inside EVERY Server Action - they are public HTTP endpoints)**

**(You MUST call `revalidatePath()` BEFORE `redirect()` to ensure fresh data)**

**Failure to follow these rules will ship unnecessary JavaScript to the client, break SEO, expose secrets, cause stale UI, create security vulnerabilities, or break redirects.**

</critical_reminders>
