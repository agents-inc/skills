---
name: web-meta-framework-nuxt
description: Nuxt patterns - file-based routing, data fetching (useFetch/useAsyncData), useState, server routes, middleware, auto-imports, layouts, SEO
---

# Nuxt Framework Patterns

> **Quick Guide:** `useFetch` for an API call in a component, `useAsyncData` for a custom source or
> several fetches combined — both transfer the server's result to the client so nothing is fetched
> twice. Server routes live in `server/api/`, shared state in `useState`, and composables and
> components are auto-imported. Two facts change the answers below: `data` is a `shallowRef`, so
> replace the object rather than mutating into it (or pass `deep: true`), and `data` and `error`
> default to `undefined` rather than `null`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — pages, layouts, error handling, SEO composables, plugins, runtime config
- [examples/data-fetching.md](examples/data-fetching.md) — typed responses, transforms, lazy and server-only fetching
- [examples/server-routes.md](examples/server-routes.md) — CRUD handlers, validation, server middleware, error utilities
- [examples/middleware.md](examples/middleware.md) — auth guards, role checks, global and inline middleware
- [examples/state-management.md](examples/state-management.md) — `useState` composables, cookie persistence, server-initialised state
- [reference.md](reference.md) — decision trees, directory conventions, per-area checklists

---

## Which path applies

- **Rendering a page** — routing, layouts and SEO are file conventions plus two composables; follow
  [examples/core.md](examples/core.md).
- **Getting data into a page** — the choice is `useFetch` versus `useAsyncData`, and everything else
  is options on them; follow [examples/data-fetching.md](examples/data-fetching.md).
- **Writing the API the page calls** — `server/api/` handlers run under Nitro with their own
  utilities; follow [examples/server-routes.md](examples/server-routes.md).
- **Guarding navigation** — route middleware runs on both server and client; follow
  [examples/middleware.md](examples/middleware.md).

---

<critical_requirements>

## Before writing Nuxt code

**Fetch through `useFetch` or `useAsyncData` rather than a bare `$fetch` in `<script setup>`.** Both
carry the server's payload into hydration; a bare `$fetch` there runs twice, once per environment.

**Put API routes in `server/api/` and export a `defineEventHandler()` as the default.** The file
suffix (`.get.ts`, `.post.ts`) is what restricts the method, and the directory is what adds the
`/api` prefix.

**Attach middleware and page options through `definePageMeta`.** It is a compile-time macro, so its
argument has to be statically analysable — no variables, no computed keys.

**Set metadata with `useHead` or `useSeoMeta`.** Both render server-side and merge with the defaults
in `nuxt.config.ts`, which hand-written `<head>` markup does not.

**Keep `useState` values JSON-serializable.** The value is serialised into the HTML and revived on
the client, so a function, class instance or Symbol breaks hydration.

**Read `to` and `from` inside route middleware rather than calling `useRoute()`.** The route object
has not been committed yet at that point, so `useRoute()` answers with the previous route.

</critical_requirements>

---

**Auto-detection:** nuxt.config.ts, defineNuxtConfig, useFetch, useAsyncData, useState, useCookie,
useRuntimeConfig, useNuxtApp, defineEventHandler, definePageMeta, defineNuxtRouteMiddleware,
defineNuxtPlugin, navigateTo, abortNavigation, createError, clearError, showError, useHead,
useSeoMeta, NuxtLayout, NuxtPage, NuxtLink, NuxtErrorBoundary, server/api, $fetch, h3,
import.meta.client, import.meta.server

**Applies to:**

- File-based routing over `pages/`, with layouts, dynamic segments and catch-all routes
- SSR-safe data fetching, and the transform, lazy and pick options that shape the payload
- Server routes and server middleware in the same project as the pages
- Shared reactive state that survives the server-to-client boundary
- Navigation guards for authentication, authorization and feature flags
- SEO metadata, plugins, and public versus private runtime configuration

**Handled elsewhere:**

- Vue component authoring itself — reactivity, template syntax and component composition
- Persistence — a server route calls a data layer; neither the client nor the query shape is settled
  here
- Schema validation — a handler parses `readBody` through a schema; which library defines it is a
  separate choice
- Styling — components take classes, and the styling approach is someone else's
- Application state that needs devtools, time-travel or cross-store dependencies, which `useState`
  deliberately does not provide

---

<philosophy>

## Philosophy

Nuxt is a meta-framework for Vue 3: file-based routing, automatic code splitting, server-side
rendering, and a data-fetching layer that knows about hydration. It runs on the Nitro server engine,
so API routes live in the same project as the pages that call them.

Five ideas explain most of the API surface:

1. **Universal rendering by default** — a page renders on the server first, then hydrates
2. **Auto-imports** — composables, components and utilities are available without an import line, so
   an unfamiliar `useX` is usually Nuxt's own
3. **File-based conventions** — `pages/`, `server/`, `layouts/`, `middleware/` each mean something
4. **Hydration-aware fetching** — the composables exist because the naive fetch runs twice
5. **Shallow reactivity** — `data` is a `shallowRef`; deep tracking is a cost Nuxt does not pay by
   default

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: File-Based Routing

File names in `pages/` become URL paths, and bracket depth chooses the kind of segment.

| File                         | URL                      |
| ---------------------------- | ------------------------ |
| `pages/index.vue`            | `/`                      |
| `pages/about.vue`            | `/about`                 |
| `pages/blog/[slug].vue`      | `/blog/:slug`            |
| `pages/users/[...slug].vue`  | `/users/*`               |
| `pages/posts/[[id]].vue`     | `/posts` or `/posts/:id` |
| `pages/users/[id]/posts.vue` | `/users/:id/posts`       |

```vue
<!-- pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute();
const { data: post, error } = await useFetch(`/api/posts/${route.params.slug}`);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "Post not found" });
}
</script>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Data Fetching

`useFetch` is `useAsyncData` plus `$fetch`, with the URL as the cache key.

```typescript
// URL is the cache key; pass `key` when two calls share a URL
const { data, error, status, refresh, clear } = await useFetch("/api/users");

// Reactive query params, refetched when `page` changes
const page = ref(1);
const { data: users } = await useFetch("/api/users", {
  query: { page, limit: 20 },
  watch: [page],
});

// A POST the user triggers, rather than one that fires on mount
const { execute, status } = useFetch("/api/users", {
  method: "POST",
  body: form,
  immediate: false,
  watch: false,
});
```

Reach for `useAsyncData` when the source is not a single HTTP call:

```typescript
const { data } = await useAsyncData("dashboard", async () => {
  const [users, stats] = await Promise.all([
    $fetch("/api/users"),
    $fetch("/api/stats"),
  ]);
  return { users, stats };
});
```

Full code: [examples/data-fetching.md](examples/data-fetching.md)

### Pattern 3: Server Routes

`server/api/` prefixes the URL with `/api`; `server/routes/` does not. The file suffix restricts the
method.

```typescript
// server/api/users.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return listUsers({ page: Number(query.page) || 1 });
});

// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  setResponseStatus(event, 201);
  return createUser(body);
});
```

Full code: [examples/server-routes.md](examples/server-routes.md). The full file-to-URL table is in
[reference.md](reference.md).

### Pattern 4: useState for Shared State

An SSR-friendly ref keyed by a string, so every caller of the same key gets the same state.

```typescript
// composables/use-user.ts
export function useUser() {
  const user = useState<User | null>("user", () => null);
  const isLoggedIn = computed(() => user.value !== null);

  async function login(credentials: Credentials) {
    user.value = await $fetch<User>("/api/auth/login", {
      method: "POST",
      body: credentials,
    });
  }

  return { user: readonly(user), isLoggedIn, login };
}
```

The initializer runs once per key, so wrapping mutations in the composable is what keeps them in one
place. Export `readonly(user)` so callers change it through `login` rather than by assignment.

Full code: [examples/state-management.md](examples/state-management.md)

### Pattern 5: Route Middleware

Middleware runs before navigation commits, which is what makes it the right place for an auth check.

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUser();
  if (!isLoggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
```

| Type   | File                           | Runs                          |
| ------ | ------------------------------ | ----------------------------- |
| Named  | `middleware/auth.ts`           | When `definePageMeta` opts in |
| Global | `middleware/auth.global.ts`    | On every navigation           |
| Inline | A function in `definePageMeta` | For that page only            |

Attach with `definePageMeta({ middleware: "auth" })`, or an array to run several in order.

Full code: [examples/middleware.md](examples/middleware.md)

### Pattern 6: Layouts

A layout wraps pages and renders them through `<slot />`. `layouts/default.vue` applies with no
opt-in.

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <header>
      <nav><!-- navigation --></nav>
    </header>
    <main><slot /></main>
  </div>
</template>
```

Choose per page with `definePageMeta({ layout: "admin" })`. `definePageMeta` is static, so a layout
that depends on runtime values needs either `setPageLayout("admin")` from a script or
`<NuxtLayout :name="computedLayout">` in `app.vue`.

Full code: [examples/core.md](examples/core.md)

### Pattern 7: SEO

`useSeoMeta` takes flat, type-checked property names; pass getters so the values track the data.

```vue
<script setup lang="ts">
useSeoMeta({
  title: () => post.value?.title ?? "Blog Post",
  description: () => post.value?.excerpt ?? "",
  ogImage: () => post.value?.coverImage ?? "/default-og.png",
  twitterCard: "summary_large_image",
});
</script>
```

`useHead` is the lower-level form, and `app.head` in `nuxt.config.ts` sets the defaults these
override.

Full code: [examples/core.md](examples/core.md)

### Pattern 8: Plugins

A plugin runs before the Vue app is created — the place to build a configured client once.

```typescript
// plugins/api.client.ts  — .client = browser only, .server = server only, no suffix = both
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const api = $fetch.create({ baseURL: config.public.apiBase });
  return { provide: { api } };
});
```

Reach it as `useNuxtApp().$api`.

Full code: [examples/core.md](examples/core.md)

### Pattern 9: Error Handling

`createError` works on both sides of the boundary; where the error surfaces depends on where it is
thrown.

```typescript
// A server route, or a page that checks useFetch's error
throw createError({
  statusCode: 404,
  statusMessage: "Not found",
  data: { id },
});
```

`NuxtErrorBoundary` with an `#error` slot isolates one component's failure; a root `error.vue`
catches everything else, and `clearError({ redirect: "/" })` is how the user gets out.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A bare `$fetch` in `<script setup>` for initial data — the request fires on the server and again on
  the client
- A function, class or Symbol inside `useState` — it cannot be serialised, so hydration mismatches
- `useRoute()` inside middleware — the navigation has not committed, so the values are the previous
  route's
- A missing `key` on `useAsyncData` for data that varies — two routes share one cache entry
- A secret read outside `runtimeConfig`'s private keys — anything under `public` reaches the browser
- A composable called after an `await` in setup — the component instance is no longer current

**Surprising behaviour:**

- `data` from `useFetch` and `useAsyncData` is a `shallowRef`, so mutating a nested property changes
  nothing on screen — replace the object, or pass `deep: true`
- `data` and `error` default to `undefined`, not `null`, so a `=== null` check never fires
- The URL is the cache key, so two components fetching the same URL share one result until you pass
  `key`
- `useState`'s initializer runs once per key; later calls return the existing value and ignore the
  function they were given
- Middleware runs on the server and again on the client — split with `import.meta.server` /
  `import.meta.client`
- `definePageMeta` is a macro rather than a function call, so a variable in its argument fails to
  compile
- `NuxtLink` needs the `external` prop for an off-site URL
- `watch` on `useFetch` only reacts to reactive sources; a plain variable never triggers a refetch
- Omitting `await` before `useFetch` renders the component before the data exists
- Fetching page data in `onMounted` instead of a composable runs it only in the browser, so the
  server renders the empty state and that is what a crawler indexes

</red_flags>
