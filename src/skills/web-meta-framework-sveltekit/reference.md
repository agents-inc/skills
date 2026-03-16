# SvelteKit Reference

> Decision frameworks, anti-patterns, and red flags for SvelteKit development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Server Load vs Universal Load

```
Does the load function need server-only resources?
├─ YES → Does it access a database directly?
│   ├─ YES → +page.server.ts (server load)
│   └─ NO → Does it need private environment variables?
│       ├─ YES → +page.server.ts (server load)
│       └─ NO → Does it need cookies or request headers?
│           ├─ YES → +page.server.ts (server load)
│           └─ NO → +page.ts (universal load)
└─ NO → Does it fetch from an external API?
    ├─ YES → +page.ts (universal load — runs on client during navigation)
    └─ NO → Does it need to return non-serializable data (classes, components)?
        ├─ YES → +page.ts (universal load)
        └─ NO → Either works — prefer server load for security
```

### Form Action vs API Route

```
Is this handling a form submission / mutation?
├─ YES → Does it need progressive enhancement (work without JS)?
│   ├─ YES → Form action (+page.server.ts actions)
│   └─ NO → Is it triggered by a form?
│       ├─ YES → Form action (still best pattern)
│       └─ NO → Is it a simple toggle/button click?
│           ├─ YES → Form action with hidden inputs
│           └─ NO → API route may be simpler
└─ NO → Is this consumed by external clients?
    ├─ YES → API route (+server.ts)
    └─ NO → Is it data fetching?
        ├─ YES → Load function (not form action or API route)
        └─ NO → API route (+server.ts)
```

### Page Options: prerender vs ssr vs csr

```
Is the page content the same for every user?
├─ YES → Does it change infrequently?
│   ├─ YES → prerender = true (static HTML at build time)
│   └─ NO → SSR (default — render fresh on each request)
└─ NO → Is the page personalized?
    ├─ YES → SSR (default — server renders per request)
    └─ NO → Does the page use browser-only APIs?
        ├─ YES → ssr = false (client-only rendering)
        └─ NO → Default SSR is fine

Does the page need interactivity?
├─ YES → csr = true (default)
└─ NO → Is it pure static content (docs, legal)?
    ├─ YES → csr = false (zero JavaScript shipped)
    └─ NO → csr = true (default)
```

### Where to Put Auth Checks

```
Does every route in the app need auth?
├─ YES → hooks.server.ts handle function
└─ NO → Does a group of routes need auth?
    ├─ YES → +layout.server.ts load in that group
    └─ NO → Does a single page need auth?
        ├─ YES → +page.server.ts load function
        └─ NO → No auth needed
```

### Data Invalidation Strategy

```
When should the data refresh?
├─ After a form submission → Automatic (SvelteKit invalidates after actions)
├─ After a programmatic event → invalidate('app:custom-key')
├─ When a URL dependency changes → Automatic (SvelteKit tracks url/params)
├─ Everything should refresh → invalidateAll()
└─ On a timer or external event → Custom invalidation with depends()
```

### Streaming Decision

```
Does the load function fetch multiple data sources?
├─ YES → Are some significantly slower than others?
│   ├─ YES → Await fast data, stream slow data (return promises)
│   └─ NO → Await all (parallel with Promise.all)
└─ NO → Single data source?
    ├─ YES → Await it (standard pattern)
    └─ NO → Static page (no load function needed)
```

---

## RED FLAGS

### High Priority Issues

- **Using API routes for form submissions** — Use form actions for mutations; API routes are for external clients
- **Throwing errors for validation** — Use `fail()` to return errors without clearing form state
- **Catching `redirect()` in try/catch** — `redirect()` throws a special exception; don't catch it
- **Missing auth checks in form actions** — Actions are public POST endpoints
- **Using `+page.ts` for database access** — Universal loads run on client; use `+page.server.ts`
- **Missing `use:enhance` on forms** — Forms reload the page without it
- **Accessing `event.locals` without type declaration** — Define `App.Locals` in `app.d.ts`

### Medium Priority Issues

- **Not using `$types` for load function typing** — Lose automatic type inference
- **Fetching data in components instead of load functions** — Creates waterfalls
- **Using `goto()` instead of `<a>` links** — Lose prefetching and progressive enhancement
- **Not handling error states in `{#await}` blocks** — Streamed data can fail
- **Missing `+error.svelte` in route segments** — Errors bubble to root error page
- **Using `event.url.searchParams` in hooks for routing** — Use `reroute` hook instead
- **Calling `parent()` before independent fetches** — Creates waterfalls

### Common Mistakes

- **`redirect()` inside try/catch** — Redirect throws internally; wrap only the mutation in try/catch
- **Using `page` from `$app/stores` instead of `$app/state`** — `$app/state` is the Svelte 5 pattern
- **Forgetting `method="POST"` on forms** — Form actions only handle POST; GET hits the load function
- **Not returning from `fail()`** — `fail()` doesn't throw; you must `return fail(...)`
- **Using default action with named actions** — A page with named actions can't also have a default action
- **Setting cookies without `path: '/'`** — Cookie may not be sent on subsequent requests
- **Not passing `email` back in `fail()` response** — User loses their input on validation error

### Gotchas & Edge Cases

- **Load functions run in parallel** — All load functions for a route run concurrently by default
- **Layout data merges, not replaces** — If layout and page return same key, page wins
- **`redirect()` uses 303 for form actions** — Always use 303 (See Other) after POST to prevent resubmission
- **`error()` renders `+error.svelte`, not the page** — The page component doesn't render at all
- **Server load must return serializable data** — No classes, functions, or component instances
- **Universal load can return anything** — Classes, component constructors, non-serializable data
- **`fetch` in load functions is special** — Auto-deduplicates, inherits cookies, works server-side
- **Forms without `use:enhance` cause full-page reload** — This is intentional (progressive enhancement)
- **`event.locals` is request-scoped** — Safe for per-request data (auth), not for global state
- **Content negotiation** — `+page.server.ts` and `+server.ts` in the same directory: forms go to actions, API calls go to server routes
- **SvelteKit uses `$app/state` in Svelte 5** — Replace `$app/stores` (`$page`, `$navigating`) with `$app/state` (`page`, `navigating`)
- **`depends()` creates custom invalidation keys** — Use `app:` prefix for custom keys

---

## Quick Reference

### File Conventions Checklist

- [ ] `+page.svelte` — Page UI (required for route to be accessible)
- [ ] `+page.ts` — Universal load (server + client)
- [ ] `+page.server.ts` — Server load + form actions
- [ ] `+layout.svelte` — Shared layout (renders `{@render children()}`)
- [ ] `+layout.ts` — Universal layout load
- [ ] `+layout.server.ts` — Server layout load
- [ ] `+error.svelte` — Error boundary
- [ ] `+server.ts` — API route

### Load Function Inputs

| Property        | Server Load | Universal Load | Description            |
| --------------- | :---------: | :------------: | ---------------------- |
| `params`        |     Yes     |      Yes       | Route parameters       |
| `url`           |     Yes     |      Yes       | URL instance           |
| `route`         |     Yes     |      Yes       | Route info             |
| `fetch`         |     Yes     |      Yes       | Enhanced fetch         |
| `depends`       |     Yes     |      Yes       | Custom invalidation    |
| `parent`        |     Yes     |      Yes       | Parent load data       |
| `untrack`       |     Yes     |      Yes       | Exclude from tracking  |
| `setHeaders`    |     Yes     |      Yes       | Set response headers   |
| `cookies`       |     Yes     |       No       | Cookie access          |
| `locals`        |     Yes     |       No       | Request-local data     |
| `request`       |     Yes     |       No       | Raw Request object     |
| `platform`      |     Yes     |       No       | Platform-specific data |
| `clientAddress` |     Yes     |       No       | Client IP address      |

### Form Action Response Checklist

- [ ] Validate all input fields
- [ ] Return field values in `fail()` (so form preserves input)
- [ ] Use `fail(400, { ... })` for validation errors
- [ ] Use `redirect(303, '/path')` for success redirects
- [ ] Auth check before mutation
- [ ] `redirect()` OUTSIDE try/catch
- [ ] Mutation INSIDE try/catch

### SvelteKit Imports

```typescript
// Kit utilities
import { error, fail, redirect, json, text } from "@sveltejs/kit";

// Client navigation
import {
  goto,
  invalidate,
  invalidateAll,
  beforeNavigate,
  afterNavigate,
} from "$app/navigation";

// Forms
import { enhance, applyAction, deserialize } from "$app/forms";

// State (Svelte 5 — replaces $app/stores)
import { page, navigating, updated } from "$app/state";

// Environment
import { env } from "$env/dynamic/private"; // Server only
import { env } from "$env/dynamic/public"; // Both
import { SECRET_KEY } from "$env/static/private"; // Server only, build-time
import { PUBLIC_API_URL } from "$env/static/public"; // Both, build-time

// Auto-generated types
import type { PageServerLoad, Actions } from "./$types";
import type { PageLoad } from "./$types";
import type { LayoutServerLoad } from "./$types";
import type { RequestHandler } from "./$types";
import type { PageProps, LayoutProps } from "./$types";
```

### Page Options

```typescript
// In +page.ts, +page.server.ts, +layout.ts, or +layout.server.ts
export const prerender = true; // Static HTML at build time
export const ssr = false; // Client-only rendering
export const csr = false; // No JavaScript (static page)

// Combined patterns
export const prerender = true; // Pre-render
export const ssr = true; // Required for prerender
export const csr = false; // Pure static (no JS)
```
