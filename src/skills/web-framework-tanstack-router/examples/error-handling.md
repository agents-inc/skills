# TanStack Router -- Error Handling & Code Splitting Examples

> Error boundaries, pending/loading indicators, not-found handling, and code splitting strategies. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Data Loading](data-loading.md) -- loaders that may throw errors
- [Routes & Layouts](routes.md) -- route definitions with error/pending components
- [Setup & Configuration](setup.md) -- router-level defaults, devtools

---

## Error and Pending Components

```typescript
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";

const PENDING_DELAY_MS = 200;
const PENDING_MIN_DISPLAY_MS = 300;

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    return { post };
  },
  // Show loading UI after 200ms (avoids flash for fast loads)
  pendingMs: PENDING_DELAY_MS,
  // Keep loading UI visible for at least 300ms (avoids flicker)
  pendingMinMs: PENDING_MIN_DISPLAY_MS,
  pendingComponent: () => <div>Loading post...</div>,
  errorComponent: ({ error, reset }) => (
    <div role="alert">
      <p>Failed to load post</p>
      <pre>{error.message}</pre>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </div>
  ),
  component: PostDetail,
});
```

**Why:** `pendingMs` prevents loading flash for fast navigations. `pendingMinMs` prevents loading flicker for near-threshold loads. `errorComponent` receives `reset` function for retry capability. Named constants for timing values prevent magic numbers.

---

## Not-Found Handling: Route-Level

```typescript
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) {
      // Triggers the route's notFoundComponent
      throw notFound();
    }
    return { post };
  },
  notFoundComponent: () => (
    <div>
      <h2>Post not found</h2>
      <p>The post you are looking for does not exist.</p>
    </div>
  ),
  component: PostDetail,
});
```

**Why:** `notFound()` in loaders handles data-level not-found (valid route, missing data). `notFoundComponent` on route handles that specific route's not-found.

**Critical:** `notFound()` must be **thrown**, not returned. `throw notFound()` is correct.

---

## Not-Found Handling: Router-Level Default

```typescript
// Catches unmatched URLs (no route matches the path)
const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div>
      <h1>404</h1>
      <p>Page not found</p>
    </div>
  ),
});
```

---

## Router-Level Error and Pending Defaults

```typescript
const GLOBAL_PENDING_MS = 1000;
const GLOBAL_PENDING_MIN_MS = 500;

const router = createRouter({
  routeTree,
  defaultPendingMs: GLOBAL_PENDING_MS,
  defaultPendingMinMs: GLOBAL_PENDING_MIN_MS,
  defaultErrorComponent: ({ error, reset }) => (
    <div role="alert">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button type="button" onClick={reset}>
        Try Again
      </button>
    </div>
  ),
  defaultNotFoundComponent: () => (
    <div>
      <h1>404 - Not Found</h1>
    </div>
  ),
});
```

**Why:** Router-level defaults apply to all routes that don't define their own components. Per-route components override the defaults.

---

## Code Splitting: Automatic (Recommended)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true, // Splits component + loader per route
    }),
    react(),
  ],
});
```

**Why:** No manual `lazy()` calls needed. The plugin automatically extracts `component`, `loader`, `pendingComponent`, and `errorComponent` into separate chunks. Each route only loads its code when navigated to.

---

## Code Splitting: Manual (When Needed)

```typescript
// src/routes/posts.lazy.tsx - Lazy-loaded route component
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/posts")({
  component: PostsPage,
});

function PostsPage() {
  return <div>Posts content loaded lazily</div>;
}
```

```typescript
// src/routes/posts.tsx - Critical route config (always loaded)
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  // loader, beforeLoad, validateSearch stay in the main bundle
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  // component is defined in posts.lazy.tsx
});
```

**Why:** `.lazy.tsx` files are only loaded when the route is navigated to. Critical route config (loaders, search validation) stays in the main bundle for preloading. Manual splitting gives fine-grained control when auto splitting is insufficient.

**When to use:** Prefer `autoCodeSplitting: true` for most projects. Manual splitting is useful when you need specific bundling behavior or when not using the router plugin.

---

## Preloading Strategies

```typescript
// Router-level preloading defaults
const router = createRouter({
  routeTree,
  defaultPreload: "intent", // Preload on hover/focus
});

// Per-link preloading override
<Link to="/posts/$postId" params={{ postId: "1" }} preload="intent">
  View Post
</Link>
```

| Strategy     | Behavior                                      |
| ------------ | --------------------------------------------- |
| `"intent"`   | Preloads on hover/focus (recommended default) |
| `"viewport"` | Preloads when link enters viewport            |
| `"render"`   | Preloads immediately on render                |
| `false`      | No preloading                                 |
