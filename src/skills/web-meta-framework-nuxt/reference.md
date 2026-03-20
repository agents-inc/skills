# Nuxt Reference

> Decision frameworks and checklists for Nuxt development. See [SKILL.md](SKILL.md) for core concepts and red flags, and [examples/](examples/) for code examples.

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

## Quick Reference

### File Conventions

| Directory            | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `pages/`             | File-based routing (auto-generates routes)    |
| `server/api/`        | API routes (prefixed with `/api`)             |
| `server/routes/`     | Server routes (no prefix)                     |
| `server/middleware/` | Server middleware (runs on every request)     |
| `middleware/`        | Route middleware (client + server navigation) |
| `layouts/`           | Page layouts (wrap pages)                     |
| `components/`        | Vue components (auto-imported)                |
| `composables/`       | Composables (auto-imported, `use*` prefix)    |
| `plugins/`           | Nuxt plugins (run before app creation)        |
| `utils/`             | Utility functions (auto-imported)             |
| `assets/`            | Build-processed assets (styles, images)       |
| `public/`            | Static assets (served as-is)                  |

### Route Patterns

| Pattern   | File                         | URL                      |
| --------- | ---------------------------- | ------------------------ |
| Static    | `pages/about.vue`            | `/about`                 |
| Dynamic   | `pages/users/[id].vue`       | `/users/:id`             |
| Catch-all | `pages/docs/[...slug].vue`   | `/docs/*`                |
| Optional  | `pages/posts/[[id]].vue`     | `/posts` or `/posts/:id` |
| Nested    | `pages/users/[id]/posts.vue` | `/users/:id/posts`       |

### Server Route Patterns

| Pattern    | File                       | URL               |
| ---------- | -------------------------- | ----------------- |
| GET        | `server/api/users.get.ts`  | `GET /api/users`  |
| POST       | `server/api/users.post.ts` | `POST /api/users` |
| Any method | `server/api/users.ts`      | `* /api/users`    |
| Dynamic    | `server/api/users/[id].ts` | `/api/users/:id`  |
| Catch-all  | `server/api/[...path].ts`  | `/api/*`          |
| No prefix  | `server/routes/health.ts`  | `/health`         |

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
