# SvelteKit Reference

> Decision trees, the load-function input matrix, the import surface, and the long tail of gotchas.
> See [SKILL.md](SKILL.md) for the patterns and red flags, and [examples/](examples/) for code.

---

## Decision Trees

### Server load or universal load

```
Does the load need something only the server has?
├─ A database, a private env var, cookies or request headers → +page.server.ts
└─ NO → does it fetch from an external public API?
    ├─ YES → +page.ts — it then re-runs in the browser on navigation, without a round trip
    └─ NO → does it need to return something non-serialisable (a class, a component)?
        ├─ YES → +page.ts, or a transport hook with +page.server.ts
        └─ NO → either works; prefer the server load, since nothing leaks by default
```

### Form action or API route

```
Is this a mutation the user triggers from a page?
├─ YES → a form action — progressive enhancement, CSRF protection and revalidation come with it
└─ NO → who is calling?
    ├─ An external client, a webhook, a mobile app → +server.ts
    └─ This app, for a read → a load function, not either of the above
```

### prerender, ssr, csr

```
Is the page identical for every visitor?
├─ YES → does it change rarely?
│   ├─ YES → prerender = true
│   └─ NO  → the default SSR
└─ NO → is it personalised?
    ├─ YES → the default SSR
    └─ NO  → does it need browser APIs before first paint?
        ├─ YES → ssr = false
        └─ NO  → the default SSR

Does the page need any interactivity at all?
├─ YES → csr stays true
└─ NO  → csr = false ships no JavaScript
```

### Where an auth check belongs

```
How much of the app needs it?
├─ Everything → hooks.server.ts handle
├─ A group of routes → +layout.server.ts inside that group
└─ One page → its own +page.server.ts load
```

A check in a load protects reads. An action is a separate entry point and needs its own.

### When data should refresh

```
What should trigger it?
├─ A form submission → automatic; SvelteKit reruns the loads after an action
├─ A URL or param change → automatic; SvelteKit tracks what the load read
├─ A specific event in your code → invalidate('app:custom-key'), against a depends() call
├─ Everything → invalidateAll()
└─ A timer → invalidate on an interval, with cleanup
```

---

## Load Function Inputs

| Property        | Server load | Universal load | What it is                         |
| --------------- | :---------: | :------------: | ---------------------------------- |
| `params`        |     Yes     |      Yes       | Route parameters                   |
| `url`           |     Yes     |      Yes       | A `URL` instance                   |
| `route`         |     Yes     |      Yes       | The matched route id               |
| `fetch`         |     Yes     |      Yes       | SvelteKit's enhanced fetch         |
| `depends`       |     Yes     |      Yes       | Register a custom invalidation key |
| `parent`        |     Yes     |      Yes       | The parent load's data             |
| `untrack`       |     Yes     |      Yes       | Read without creating a dependency |
| `setHeaders`    |     Yes     |      Yes       | Set response headers               |
| `data`          |     No      |      Yes       | The server load's output           |
| `cookies`       |     Yes     |       No       | Read and write cookies             |
| `locals`        |     Yes     |       No       | Whatever `handle` put there        |
| `request`       |     Yes     |       No       | The raw `Request`                  |
| `platform`      |     Yes     |       No       | Adapter-specific extras            |
| `clientAddress` |     Yes     |       No       | The client IP                      |

---

## Import Surface

```typescript
// Kit utilities
import { error, fail, redirect, json, text } from "@sveltejs/kit";

// Hook composition
import { sequence } from "@sveltejs/kit/hooks";

// Client navigation
import {
  goto,
  invalidate,
  invalidateAll,
  beforeNavigate,
  afterNavigate,
  pushState,
  replaceState,
} from "$app/navigation";

// Forms
import { enhance, applyAction, deserialize } from "$app/forms";

// State — the Svelte 5 form, replacing $app/stores
import { page, navigating, updated } from "$app/state";

// Environment
import { env } from "$env/dynamic/private"; // server only, runtime
import { env } from "$env/dynamic/public"; // both, runtime
import { SECRET_KEY } from "$env/static/private"; // server only, build time
import { PUBLIC_API_URL } from "$env/static/public"; // both, build time

// Generated types, per route
import type {
  PageServerLoad,
  PageLoad,
  LayoutServerLoad,
  Actions,
} from "./$types";
import type { RequestHandler, PageProps, LayoutProps } from "./$types";

// Hook types
import type {
  Handle,
  HandleFetch,
  HandleServerError,
  HandleClientError,
} from "@sveltejs/kit";
import type {
  HandleValidationError,
  ServerInit,
  Reroute,
  Transport,
} from "@sveltejs/kit";
```

The `$env` split is a security boundary: anything under `static/private` or `dynamic/private` fails
to build if a client-reachable module imports it.

---

## Page Options

```typescript
// In +page.ts, +page.server.ts, +layout.ts or +layout.server.ts
export const prerender = true; // static HTML at build time
export const ssr = false; // client-only rendering
export const csr = false; // no JavaScript shipped
```

| Option      | Values                    | Effect                             |
| ----------- | ------------------------- | ---------------------------------- |
| `prerender` | `true`, `false`, `'auto'` | Generate static HTML at build time |
| `ssr`       | `true`, `false`           | Render on the server               |
| `csr`       | `true`, `false`           | Hydrate in the browser             |

Set on a layout, they apply to every route beneath it. `prerender` needs `ssr` to stay true.

---

## Adapters

The adapter is what turns the build into something a host can run, and it decides which page options
are even available — `adapter-static` requires every route to prerender.

| Adapter                                                   | Target                                  |
| --------------------------------------------------------- | --------------------------------------- |
| `adapter-auto`                                            | Detects the platform at build time      |
| `adapter-node`                                            | A Node server you run yourself          |
| `adapter-static`                                          | A fully prerendered site, no server     |
| `adapter-vercel`, `adapter-netlify`, `adapter-cloudflare` | That platform's own runtime and adapter |

`event.platform` carries whatever the adapter exposes, which is why its contents are
adapter-specific rather than part of SvelteKit's own API.

---

## Further Gotchas

The ones that change a decision are in [SKILL.md](SKILL.md); these are the long tail.

- `handleValidationError` fires when a remote function's arguments fail their schema — return a
  generic `App.Error`, since these are frequently security scans rather than users
- `init` runs once at server startup, so a throw there stops the server from starting: the right
  place to validate configuration
- `reroute` runs before `handle` and rewrites the URL before route matching — useful for locale
  prefixes. From 2.18 it also receives `fetch` and may be async
- `transport` lets a class survive a server load's serialisation, encode and decode both
- `goto()` in place of an `<a href>` loses link prefetching and leaves the navigation broken without
  JavaScript — reach for it only when there is no element to click
- `depends()` keys conventionally use an `app:` prefix, to distinguish them from URLs
- A universal load may return anything, including class instances and component constructors; a
  server load may not
- `event.url.searchParams` in a hook is the wrong tool for routing decisions — `reroute` is the one
  that runs before matching
- `+page.server.ts` and `+server.ts` may coexist in one directory: form posts go to the actions, and
  requests asking for JSON go to the server route
- A page with named actions cannot also have a `default` action
- Not handling the `{:catch}` branch of an `{#await}` leaves a streamed failure rendering nothing
- A route segment with no `+error.svelte` bubbles its errors to the root error page

---

## Checklists

### A form action

- [ ] Auth checked before the mutation
- [ ] Every field validated server-side
- [ ] The submitted values returned inside `fail()`, so the form refills
- [ ] `fail(400, { ... })` for validation, `error()` only for something the user cannot fix
- [ ] `redirect(303, '/path')` on success — 303 rather than 302, so the browser switches to GET
- [ ] The mutation inside a `try`, the redirect outside it

### A `+server.ts` route

- [ ] One export per verb, plus `fallback` for a 405 on the rest
- [ ] `locals.user` checked on everything that writes
- [ ] Pagination bounded — an uncapped `limit` is a denial-of-service
- [ ] `json()` for JSON, a raw `Response` for anything else
- [ ] The status code chosen deliberately: 201 with a body, 204 without one
