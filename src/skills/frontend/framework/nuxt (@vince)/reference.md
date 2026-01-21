# Nuxt 3 Reference

> Decision frameworks, anti-patterns, and red flags for Nuxt 3 development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Frameworks

### Data Fetching Method Selection

```
What kind of data operation is this?
├─ Initial page data (SSR needed)?
│   ├─ YES → Is it a simple API call?
│   │   ├─ YES → useFetch('/api/...')
│   │   └─ NO → useAsyncData with custom logic
│   └─ NO → Is it triggered by user action?
│       ├─ YES → $fetch (in event handler)
│       └─ NO → Is it client-only data?
│           ├─ YES → useFetch with server: false
│           └─ NO → useFetch (default SSR)
└─ Multiple parallel requests?
    ├─ YES → useAsyncData with Promise.all
    └─ NO → useFetch for single request
```

### useFetch vs useAsyncData

```
What's the data source?
├─ Simple HTTP endpoint → useFetch (simpler API)
├─ Multiple endpoints combined → useAsyncData with Promise.all
├─ Non-HTTP source (SDK, DB) → useAsyncData
├─ Need custom cache key → useAsyncData (or useFetch with key option)
└─ Need to transform data → Either works (both have transform option)
```

### Server Route Location

```
Does the route need /api prefix?
├─ YES → server/api/
└─ NO → server/routes/

What HTTP method?
├─ Multiple methods same route → server/api/[resource].ts (check event.method)
└─ Single method → server/api/[resource].[method].ts
```

### Middleware Type Selection

```
When should middleware run?
├─ Every route → Global middleware (.global.ts suffix)
├─ Specific pages → Named middleware (definePageMeta)
└─ One page only → Inline middleware (definePageMeta function)

What should middleware do?
├─ Redirect → return navigateTo('/path')
├─ Block navigation → return abortNavigation()
├─ Continue → return nothing (undefined)
└─ Show error → return abortNavigation(createError({ ... }))
```

### State Management Choice

```
What kind of state?
├─ Server data → useFetch/useAsyncData (manages loading/error)
├─ Shared UI state → useState (SSR-safe, simple)
├─ Component-local state → ref/reactive (Vue standard)
├─ Complex app state → External library via plugin
└─ Form state → reactive() or form library
```

### Layout Selection

```
Does page need different layout than default?
├─ NO → Don't specify (uses default.vue)
└─ YES → definePageMeta({ layout: 'layout-name' })

Does layout change dynamically?
├─ YES → setPageLayout('layout-name') in script
└─ NO → Static definePageMeta
```

### Error Handling Strategy

```
Where is the error?
├─ Server route → throw createError({ statusCode, message })
├─ Page data fetch → Check error from useFetch, throw createError
├─ Component → NuxtErrorBoundary wrapper
└─ Global → error.vue at root

What recovery?
├─ Retry → clearError() or refresh()
├─ Redirect → clearError({ redirect: '/path' })
└─ Show message → Display error in UI
```

---

## RED FLAGS

### High Priority Issues

- **Using `$fetch` directly in `<script setup>` for initial data** - Causes double-fetching (server + client); use `useFetch` or `useAsyncData` instead
- **Non-serializable values in `useState`** - Functions, classes, Symbols cause hydration errors; only use JSON-serializable values
- **Missing `key` in `useAsyncData` for dynamic data** - Leads to stale data and caching issues; always provide unique keys
- **`useRoute()` in middleware** - Use `to` and `from` parameters instead; useRoute may have stale values
- **Secrets in client-side code** - Use `runtimeConfig` with `private` keys for server-only secrets

### Medium Priority Issues

- **Blocking data fetches without `lazy: true`** - Slows navigation; use lazy loading for non-critical data
- **Not handling error state from useFetch** - Silent failures confuse users; always check and display error.value
- **Using `onMounted` for data that should be in useFetch** - Misses SSR benefits; move data fetching to composables
- **Inline styles instead of CSS classes** - Harder to maintain; use styling solution via class attribute
- **Missing `<NuxtLink>` prefetching** - Use `NuxtLink` instead of `<a>` for automatic prefetching

### Common Mistakes

- **Forgetting `await` before `useFetch` in setup** - Component renders before data is ready
- **Mutating `useState` value directly from multiple components** - Use composables to encapsulate mutations
- **Using `window` or `document` without checking `import.meta.client`** - SSR errors; wrap browser APIs
- **Not using `navigateTo` for programmatic navigation** - `router.push` works but `navigateTo` is recommended
- **Hardcoded API URLs** - Use `runtimeConfig` or relative paths

### Gotchas & Edge Cases

- **`useFetch` URL is the cache key** - Same URL = same cached data; use `key` option to differentiate
- **`useState` runs initializer only once per key** - Subsequent calls return existing state
- **Middleware runs on both server and client** - Use `import.meta.server/client` to conditionally execute
- **`server/api/` routes are auto-prefixed with `/api`** - `server/api/users.ts` → `/api/users`
- **`definePageMeta` is macro - not runtime** - Values must be statically analyzable
- **`NuxtLink` with external URLs** - Use `external` prop or regular `<a>` for external links
- **Layout changes don't trigger transitions by default** - Add `<NuxtLayout>` with transition props
- **Composables must be called synchronously in setup** - No `await` before first composable call
- **`watch` in `useFetch` requires reactive values** - Plain variables won't trigger refetch

---

## Anti-Patterns

### Using $fetch Directly in Setup

Raw `$fetch` in `<script setup>` fetches on both server and client.

```vue
<!-- WRONG - Double fetching -->
<script setup lang="ts">
const users = ref([])

// This runs on server AND client = 2 requests
const response = await $fetch('/api/users')
users.value = response
</script>

<!-- CORRECT - useFetch handles SSR -->
<script setup lang="ts">
const { data: users } = await useFetch('/api/users')
</script>
```

### Non-Serializable useState

Functions and classes cannot transfer from server to client.

```typescript
// WRONG - Function is not serializable
const state = useState('counter', () => ({
  count: 0,
  increment: () => count++ // Error during hydration
}))

// CORRECT - Separate state from logic
const count = useState('counter', () => 0)

// Use composable for logic
function useCounter() {
  const count = useState('counter', () => 0)

  function increment() {
    count.value++
  }

  return { count: readonly(count), increment }
}
```

### Blocking Navigation with Heavy Data

All data loads before page renders.

```vue
<!-- WRONG - All requests block navigation -->
<script setup lang="ts">
const { data: users } = await useFetch('/api/users')       // 500ms
const { data: posts } = await useFetch('/api/posts')       // 800ms
const { data: analytics } = await useFetch('/api/stats')   // 1200ms
// Total: 2500ms before page shows
</script>

<!-- CORRECT - Lazy load non-critical data -->
<script setup lang="ts">
// Critical data - block
const { data: users } = await useFetch('/api/users')

// Non-critical - load after navigation
const { data: posts, pending: postsLoading } = useFetch('/api/posts', {
  lazy: true
})
const { data: analytics, pending: analyticsLoading } = useFetch('/api/stats', {
  lazy: true
})
</script>

<template>
  <UserList :users="users" />

  <div v-if="postsLoading">Loading posts...</div>
  <PostList v-else :posts="posts" />

  <div v-if="analyticsLoading">Loading analytics...</div>
  <Analytics v-else :data="analytics" />
</template>
```

### Exposing Secrets in Client Code

Environment variables without `private` are exposed.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // WRONG - apiKey exposed to client
    // apiKey: process.env.API_KEY, // Don't do this at root level

    // CORRECT - Private (server-only)
    apiKey: process.env.API_KEY,

    // Public (available in client)
    public: {
      apiBase: process.env.API_BASE_URL
    }
  }
})

// server/api/data.ts - CORRECT usage
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  // Safe - server-only
  const response = await $fetch('https://api.example.com', {
    headers: { Authorization: `Bearer ${config.apiKey}` }
  })

  return response
})

// components/Example.vue - WRONG usage
const config = useRuntimeConfig()
// config.apiKey is undefined in client (correct behavior, but don't try to use it)
```

### Using useRoute in Middleware

Middleware receives route objects as parameters.

```typescript
// WRONG - useRoute may have stale data
export default defineNuxtRouteMiddleware(() => {
  const route = useRoute()
  if (route.meta.requiresAuth) {
    // ...
  }
})

// CORRECT - Use to/from parameters
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.meta.requiresAuth) {
    const { isLoggedIn } = useUser()
    if (!isLoggedIn.value) {
      return navigateTo('/login')
    }
  }
})
```

### Ignoring Error State

Silent failures leave users confused.

```vue
<!-- WRONG - No error handling -->
<script setup lang="ts">
const { data: users } = await useFetch('/api/users')
</script>

<template>
  <ul>
    <li v-for="user in users" :key="user.id">{{ user.name }}</li>
  </ul>
</template>

<!-- CORRECT - Handle all states -->
<script setup lang="ts">
const { data: users, error, pending, refresh } = await useFetch('/api/users')
</script>

<template>
  <div v-if="pending">Loading users...</div>

  <div v-else-if="error" class="error">
    <p>Failed to load users: {{ error.message }}</p>
    <button @click="refresh()">Retry</button>
  </div>

  <ul v-else>
    <li v-for="user in users" :key="user.id">{{ user.name }}</li>
  </ul>
</template>
```

### Browser APIs Without SSR Check

Direct browser API calls fail during SSR.

```vue
<!-- WRONG - Fails on server -->
<script setup lang="ts">
const width = ref(window.innerWidth) // ReferenceError: window is not defined
</script>

<!-- CORRECT - Check environment -->
<script setup lang="ts">
const width = ref(0)

onMounted(() => {
  // Only runs in browser
  width.value = window.innerWidth

  window.addEventListener('resize', () => {
    width.value = window.innerWidth
  })
})

// OR use import.meta.client
if (import.meta.client) {
  // Browser-only code
}
</script>
```

---

## Quick Reference

### File Conventions

| Directory | Purpose |
|-----------|---------|
| `pages/` | File-based routing (auto-generates routes) |
| `server/api/` | API routes (prefixed with `/api`) |
| `server/routes/` | Server routes (no prefix) |
| `server/middleware/` | Server middleware (runs on every request) |
| `middleware/` | Route middleware (client + server navigation) |
| `layouts/` | Page layouts (wrap pages) |
| `components/` | Vue components (auto-imported) |
| `composables/` | Composables (auto-imported, `use*` prefix) |
| `plugins/` | Nuxt plugins (run before app creation) |
| `utils/` | Utility functions (auto-imported) |
| `assets/` | Build-processed assets (styles, images) |
| `public/` | Static assets (served as-is) |

### Route Patterns

| Pattern | File | URL |
|---------|------|-----|
| Static | `pages/about.vue` | `/about` |
| Dynamic | `pages/users/[id].vue` | `/users/:id` |
| Catch-all | `pages/docs/[...slug].vue` | `/docs/*` |
| Optional | `pages/posts/[[id]].vue` | `/posts` or `/posts/:id` |
| Nested | `pages/users/[id]/posts.vue` | `/users/:id/posts` |

### Server Route Patterns

| Pattern | File | URL |
|---------|------|-----|
| GET | `server/api/users.get.ts` | `GET /api/users` |
| POST | `server/api/users.post.ts` | `POST /api/users` |
| Any method | `server/api/users.ts` | `* /api/users` |
| Dynamic | `server/api/users/[id].ts` | `/api/users/:id` |
| Catch-all | `server/api/[...path].ts` | `/api/*` |
| No prefix | `server/routes/health.ts` | `/health` |

### Data Fetching Checklist

- [ ] Using `useFetch` or `useAsyncData` (not raw `$fetch` in setup)
- [ ] Handling `pending` state for loading UI
- [ ] Handling `error` state with user feedback
- [ ] Using `lazy: true` for non-critical data
- [ ] Providing unique `key` for dynamic routes
- [ ] Using `watch` option for reactive dependencies
- [ ] Using `pick` or `transform` to minimize payload

### Server Route Checklist

- [ ] Using `defineEventHandler` wrapper
- [ ] Validating request body with schema (Zod recommended)
- [ ] Using `createError` for error responses
- [ ] Setting appropriate status codes with `setResponseStatus`
- [ ] Using `getQuery` for query parameters
- [ ] Using `getRouterParam` for route parameters
- [ ] Using `readBody` for POST/PUT body

### useState Checklist

- [ ] Values are JSON-serializable (no functions, classes, Symbols)
- [ ] Using unique string keys
- [ ] Wrapping mutations in composables
- [ ] Using `readonly()` when exposing to prevent external mutation
- [ ] Providing initializer function (not direct value)

### Middleware Checklist

- [ ] Using `to` and `from` parameters (not `useRoute()`)
- [ ] Returning `navigateTo()` for redirects
- [ ] Returning `abortNavigation()` to block
- [ ] Using `.global.ts` suffix for global middleware
- [ ] Using `import.meta.client/server` for environment-specific code
- [ ] Attaching via `definePageMeta({ middleware: 'name' })`

### SEO Checklist

- [ ] Using `useHead` or `useSeoMeta` (not manual head tags)
- [ ] Setting `title` and `description` on all pages
- [ ] Including Open Graph tags for social sharing
- [ ] Using reactive values (functions) for dynamic metadata
- [ ] Setting `canonical` URL for duplicate content prevention
- [ ] Configuring default meta in `nuxt.config.ts`

### Plugin Checklist

- [ ] Using `defineNuxtPlugin` wrapper
- [ ] Using `.client.ts` suffix for browser-only plugins
- [ ] Using `.server.ts` suffix for server-only plugins
- [ ] Using `provide` to expose utilities
- [ ] Accessing via `useNuxtApp()` in components

### Error Handling Checklist

- [ ] `error.vue` at root level for global error page
- [ ] `NuxtErrorBoundary` for component-level errors
- [ ] Using `createError` in server routes and pages
- [ ] Checking `error.value` from `useFetch`/`useAsyncData`
- [ ] Providing retry functionality with `refresh()` or `clearError()`
- [ ] Logging errors to tracking service
