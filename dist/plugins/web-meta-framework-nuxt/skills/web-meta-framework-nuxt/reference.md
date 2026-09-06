# Nuxt Reference

> Decision trees, directory and route lookups, and per-area checklists. See [SKILL.md](SKILL.md) for
> the patterns and red flags, and [examples/](examples/) for code.

---

## Decision Trees

### Which fetching composable

```
What is the data source?
├─ One HTTP endpoint → useFetch
├─ Several endpoints combined → useAsyncData with Promise.all
├─ Something other than HTTP (SDK, filesystem, direct query) → useAsyncData
└─ Triggered by a user action rather than page load → useFetch with immediate: false,
   or $fetch inside the event handler
```

`$fetch` on its own is correct in an event handler and in a server route; it is only in
`<script setup>` that it double-fetches.

### Which options to reach for

```
What is the problem?
├─ Blocking navigation on data nobody needs yet → lazy: true, with a default
├─ Payload larger than the page uses → transform, or pick
├─ Sensitive fields reaching the client → server: true plus pick
├─ Two calls colliding on one URL → key
├─ Refetching when something changes → watch, with reactive sources
└─ Nested mutations not rendering → replace the object, or deep: true
```

### What middleware should return

```
What should happen next?
├─ Go somewhere else → return navigateTo('/path')
├─ Stay where we are → return abortNavigation()
├─ Stay, with an error page → return abortNavigation(createError({ ... }))
└─ Carry on → return nothing
```

### Where state belongs

```
What kind of state is it?
├─ Server data with loading and error states → useFetch / useAsyncData
├─ Shared across components and needed after hydration → useState, keyed
├─ Local to one component → ref / reactive
├─ Surviving a page reload → useCookie, synced into useState
└─ Needing devtools, time travel or cross-store dependencies → outside this skill's scope;
   useState is deliberately a keyed ref rather than a store
```

### Where the error should surface

```
Where did it go wrong?
├─ A server route → throw createError({ statusCode, statusMessage })
├─ A page's own data → check error.value from useFetch, then throw createError
├─ One component, and the rest of the page should survive → NuxtErrorBoundary
└─ Anywhere else → the root error.vue

How does the user recover?
├─ Try again → refresh() for data, clearError() for the error page
├─ Go elsewhere → clearError({ redirect: '/path' })
└─ Read what happened → render the message
```

---

## Lookup Tables

### Directories

| Directory            | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `pages/`             | File-based routing                             |
| `server/api/`        | API routes, prefixed with `/api`               |
| `server/routes/`     | Server routes, no prefix                       |
| `server/middleware/` | Runs on every server request                   |
| `middleware/`        | Route middleware, client and server navigation |
| `layouts/`           | Page layouts                                   |
| `components/`        | Vue components, auto-imported                  |
| `composables/`       | Composables, auto-imported                     |
| `plugins/`           | Run before the Vue app is created              |
| `utils/`             | Utility functions, auto-imported               |
| `assets/`            | Build-processed assets                         |
| `public/`            | Served as-is                                   |

### Server route files

| Pattern    | File                              | URL                     |
| ---------- | --------------------------------- | ----------------------- |
| GET        | `server/api/users.get.ts`         | `GET /api/users`        |
| POST       | `server/api/users.post.ts`        | `POST /api/users`       |
| PUT        | `server/api/users/[id].put.ts`    | `PUT /api/users/:id`    |
| DELETE     | `server/api/users/[id].delete.ts` | `DELETE /api/users/:id` |
| Any method | `server/api/users.ts`             | `* /api/users`          |
| Dynamic    | `server/api/users/[id].ts`        | `/api/users/:id`        |
| Catch-all  | `server/api/[...path].ts`         | `/api/*`                |
| No prefix  | `server/routes/health.ts`         | `/health`               |

### Request utilities

| Utility                            | Purpose                 |
| ---------------------------------- | ----------------------- |
| `getQuery(event)`                  | Parse query parameters  |
| `readBody(event)`                  | Parse the request body  |
| `getRouterParam(event, 'name')`    | Read a route parameter  |
| `getHeader(event, 'name')`         | Read a request header   |
| `setResponseStatus(event, code)`   | Set the response status |
| `createError({ statusCode, ... })` | Throw an HTTP error     |

### useFetch options

| Option      | Purpose                 | Reach for it when          |
| ----------- | ----------------------- | -------------------------- |
| `query`     | Query parameters        | Filtering, pagination      |
| `watch`     | Refetch triggers        | Reactive dependencies      |
| `key`       | Cache identity          | Two calls share a URL      |
| `lazy`      | Do not block navigation | The data is not critical   |
| `immediate` | Auto-execute            | `false` for user-triggered |
| `transform` | Reshape the response    | Reduce the payload         |
| `pick`      | Select fields           | Keep fields off the client |
| `default`   | Value while loading     | Avoid null checks          |
| `server`    | Server-only fetch       | Sensitive or SEO-only data |
| `deep`      | Deep reactivity         | Mutating nested properties |

---

## Checklists

### A server route

- [ ] `defineEventHandler` as the default export
- [ ] Body parsed through a schema before anything uses it
- [ ] Query parameters bounded — a `limit` with no cap is a denial-of-service
- [ ] `createError` for failures, with a status code that matches
- [ ] `setResponseStatus` where the success code is not 200

### A `useState` composable

- [ ] Every value JSON-serializable
- [ ] A unique key, since the key is the identity
- [ ] Mutations wrapped in functions the composable exports
- [ ] `readonly()` on the exported ref
- [ ] `computed` for anything derived

### Middleware

- [ ] `to` and `from` used instead of `useRoute()`
- [ ] `navigateTo()` returned, not just called
- [ ] `.global.ts` only where it genuinely runs everywhere — a numeric prefix orders them
- [ ] `import.meta.client` / `import.meta.server` around environment-specific work

### SEO

- [ ] `useHead` or `useSeoMeta`, never hand-written `<head>` markup
- [ ] Getter functions for anything that depends on fetched data
- [ ] A canonical URL where the same content is reachable by more than one path
- [ ] Defaults set once in `nuxt.config.ts` under `app.head`
