---
name: web-meta-framework-sveltekit
description: SvelteKit full-stack framework - file-based routing, load functions, form actions, server hooks, SSR/SSG, API routes, streaming, progressive enhancement
---

# SvelteKit Patterns

> **Quick Guide:** Load functions fetch, form actions mutate, `+server.ts` serves external clients,
> and hooks handle what applies to every request. Data reaches a component as the `data` prop and an
> action's result as the `form` prop, both typed from the generated `$types`. Two facts change most
> answers below: `+page.server.ts` runs only on the server while `+page.ts` also runs in the browser,
> and `fail()` returns while `error()` and `redirect()` throw.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — file conventions, dynamic routes, route groups, parameter matchers, error boundaries
- [examples/load-functions.md](examples/load-functions.md) — server and universal loads, layout data, streaming, `parent()`, invalidation
- [examples/form-actions.md](examples/form-actions.md) — default and named actions, `fail()`, `use:enhance`, redirect ordering
- [examples/hooks.md](examples/hooks.md) — `handle`, `handleFetch`, `handleError`, `init`, `reroute`, `transport`, `sequence`
- [examples/api-routes.md](examples/api-routes.md) — `+server.ts` verbs, streaming responses, uploads, content negotiation
- [reference.md](reference.md) — decision trees, load-function inputs, the import surface, page options

---

## Which path applies

- **Reading data for a page** — the choice is `+page.server.ts` versus `+page.ts`, and it turns on
  whether the code may run in the browser; follow
  [examples/load-functions.md](examples/load-functions.md).
- **Writing data from a page** — a form action, not an API route; follow
  [examples/form-actions.md](examples/form-actions.md).
- **Serving something that is not a page** — a `+server.ts` route with one export per HTTP verb;
  follow [examples/api-routes.md](examples/api-routes.md).
- **Anything that applies to every request** — auth, headers, logging, URL rewriting; follow
  [examples/hooks.md](examples/hooks.md).

---

<critical_requirements>

## Before writing SvelteKit code

**Put anything touching a database, a secret or a cookie in `+page.server.ts`.** A `+page.ts` load
also runs in the browser, so whatever it imports is in the client bundle.

**Handle mutations with form actions rather than API routes.** An action gets progressive
enhancement, CSRF protection and automatic revalidation; a `fetch` to a `+server.ts` route gets none
of them for free.

**Return `fail(status, data)` for a validation failure, and put the values the user typed in it.**
`fail` populates the `form` prop, so the page re-renders with the input intact — `error()` throws to
`+error.svelte` and the form is gone.

**Validate on the server even where the browser already checked.** `required` and `type="email"` are
a courtesy to the user; a POST can arrive without passing through the form at all.

**Type load functions and page props from the generated `./$types`.** `PageServerLoad`, `PageProps`
and `LayoutProps` are derived from the route's own files, so a renamed parameter becomes a compile
error.

**Add `use:enhance` to every form.** Without it a submission is a full page reload, which still works
and is much slower.

**Call `redirect()` outside any `try`.** It signals by throwing, so a surrounding `catch` swallows
the navigation and reports a failure that did not happen.

</critical_requirements>

---

**Auto-detection:** +page.svelte, +page.ts, +page.server.ts, +layout.svelte, +layout.ts,
+layout.server.ts, +error.svelte, +server.ts, hooks.server.ts, hooks.client.ts, hooks.ts, load
function, form actions, use:enhance, handle, handleFetch, handleError, handleValidationError, init,
reroute, transport, sequence, $app/navigation, $app/forms, $app/state, $env/static/private,
$env/dynamic/public, PageServerLoad, PageLoad, LayoutServerLoad, RequestHandler, PageProps,
LayoutProps, fail, redirect, error, invalidate, invalidateAll, depends, event.locals, .remote.ts

**Applies to:**

- File-based routing with layouts, error boundaries, route groups and parameter matchers
- Loading data on the server, universally, or streamed in behind the first paint
- Form submissions that work before hydration and better after it
- API endpoints, streaming responses and file uploads through `+server.ts`
- Cross-cutting request handling in hooks: sessions, headers, URL rewriting, error reporting
- Choosing per route between prerendering, server rendering and client-only rendering

**Handled elsewhere:**

- Svelte component authoring itself — runes, snippets, event handling and reactivity
- Persistence — a load function reads and an action writes; neither the client nor the query shape
  is settled here
- Session issuance and password handling — this skill's examples call an auth layer and read
  `locals`
- Schema validation — an action parses `FormData`; which library defines the schema is a separate
  choice
- Styling, beyond where a stylesheet is imported

---

<philosophy>

## Philosophy

SvelteKit is built on web platform objects rather than framework abstractions: `Request`, `Response`,
`URL`, `Headers` and `FormData` are the whole vocabulary. That is why a form works without
JavaScript, why caching is a `Cache-Control` header, and why an error is a status code.

The framework's shape is four roles, each with one job:

```
Request → hooks.server.ts (handle) → +layout.server.ts (load) → +page.server.ts (load) → +page.svelte
                                                                ← form actions (POST)
```

1. **Hooks** own what is true of every request
2. **Load functions** own reads, and run in parallel with each other rather than down the tree
3. **Form actions** own writes, and revalidate the loads afterwards
4. **Components** own rendering, and receive `data` and `form` as props

Type safety is generated rather than declared: `$types` is derived from the file tree, so the types
follow a renamed route without anyone updating them.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: File Conventions

Directories under `src/routes/` are URL segments; the `+` files decide what each segment does.

| File                | Purpose                            | Runs on               |
| ------------------- | ---------------------------------- | --------------------- |
| `+page.svelte`      | The page itself                    | Server (SSR) + client |
| `+page.ts`          | Universal load                     | Server + client       |
| `+page.server.ts`   | Server load and form actions       | Server only           |
| `+layout.svelte`    | Wrapper for the segment and below  | Server (SSR) + client |
| `+layout.ts`        | Universal layout load              | Server + client       |
| `+layout.server.ts` | Server layout load                 | Server only           |
| `+error.svelte`     | Error boundary for the segment     | Server (SSR) + client |
| `+server.ts`        | HTTP endpoint, one export per verb | Server only           |

Bracket depth chooses the segment kind — `[slug]`, `[...path]`, `[[lang]]` — and `(name)` groups
routes under a shared layout without appearing in the URL.

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Server Load Functions

The default choice: it can read the database, the cookies and the private environment, because
nothing in it reaches the browser.

```typescript
// src/routes/blog/+page.server.ts
export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) error(401, "Not authenticated");

  const page = Number(url.searchParams.get("page") ?? "1");
  const [posts, total] = await Promise.all([listPosts(page), countPosts()]);

  return { posts, pagination: { page, total } };
};
```

Full code: [examples/load-functions.md](examples/load-functions.md)

### Pattern 3: Universal Load Functions

`+page.ts` runs on the server for the first request and in the browser for every navigation after,
so it suits a public API and nothing that needs a secret.

```typescript
// src/routes/weather/+page.ts
export const load: PageLoad = async ({ fetch, params }) => {
  const response = await fetch(
    `https://api.example.com/forecast/${params.city}`,
  );
  if (!response.ok) error(response.status, "Failed to load forecast");
  return { forecast: await response.json() };
};
```

That `fetch` is SvelteKit's own: it inherits cookies, deduplicates, and calls an internal
`+server.ts` route directly on the server rather than over HTTP.

Full code: [examples/load-functions.md](examples/load-functions.md)

### Pattern 4: Layout Loads

Data returned from a layout load is available to every page beneath it, which makes a layout the
natural place for an auth check.

```typescript
// src/routes/dashboard/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, "/login");
  return { user: locals.user, notifications: await unreadFor(locals.user.id) };
};
```

A child reaches it with `await parent()` — called after its own independent queries have started,
since `parent()` blocks.

Full code: [examples/load-functions.md](examples/load-functions.md)

### Pattern 5: Form Actions

Actions live beside the load in `+page.server.ts`. A page has either one `default` action or any
number of named ones.

```typescript
export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";

    if (!email) return fail(400, { email, message: "Email is required" });

    cookies.set("session", await createSession(email), { path: "/" });
    redirect(303, "/dashboard"); // outside any try — it throws
  },
};
```

```svelte
<form method="POST" action="?/login" use:enhance>
```

`?/login` targets the named action; the returned `fail` payload arrives as the `form` prop, which is
what refills the inputs.

Full code: [examples/form-actions.md](examples/form-actions.md)

### Pattern 6: Streaming

Await what the page cannot render without and return the rest unawaited; `{#await}` covers the three
states in the markup.

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const user = await getUser(locals.user.id); // blocks the first paint
  return {
    user,
    analytics: getAnalytics(locals.user.id), // streams in later
  };
};
```

```svelte
{#await data.analytics}
  <div class="skeleton">Loading…</div>
{:then analytics}
  <p>Views: {analytics.views}</p>
{:catch error}
  <p role="alert">Failed to load analytics</p>
{/await}
```

Only a server load can stream — the values have to be serialisable.

Full code: [examples/load-functions.md](examples/load-functions.md)

### Pattern 7: Errors

`error(status, message)` throws to the nearest `+error.svelte`, which reads `page` from `$app/state`.

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p>{page.error?.message ?? 'Something went wrong'}</p>
```

The boundary walks up the tree, so an `+error.svelte` in a segment keeps the failure inside it.

Full code: [examples/core.md](examples/core.md)

### Pattern 8: Hooks

`hooks.server.ts` runs for every request — the single place to establish who the caller is.

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get("session");
  event.locals.user = sessionId ? await getUserFromSession(sessionId) : null;
  return resolve(event);
};
```

`event.locals` is request-scoped, so every load function and action downstream reads the same user.
`sequence()` composes several hooks; `handleFetch`, `handleError`, `init`, `reroute` and `transport`
cover the rest.

Full code: [examples/hooks.md](examples/hooks.md)

### Pattern 9: Page Options

Three exports decide how a route is rendered, and they apply to the segment and everything under it.

```typescript
export const prerender = true; // static HTML at build time
export const ssr = false; // client-only rendering
export const csr = false; // no JavaScript shipped at all
```

Prerender static content, disable SSR for a page that needs browser APIs at first render, and
disable CSR for pages with no interactivity.

Full code: [reference.md](reference.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Database access or a private environment variable in `+page.ts` — the module is bundled for the
  browser
- `redirect()` inside a `try` — it throws, so the `catch` reports a failure instead of navigating
- `fail(...)` called without `return` — it produces a value rather than throwing, so execution
  continues
- A form with no `method="POST"` — a GET reaches the load function, and the action never runs
- A mutation reachable without an auth check — actions and `+server.ts` routes are public endpoints
- Non-serialisable data returned from a server load — a class or function cannot cross the boundary
  unless a `transport` hook encodes it
- `event.locals` accessed without an `App.Locals` declaration in `app.d.ts` — the property is
  untyped

**Surprising behaviour:**

- `error()` renders `+error.svelte` instead of the page, so the page component never runs at all
- `redirect()` after a POST should use 303, or the browser repeats the POST at the new URL
- Load functions for a route run concurrently, so an ordering assumption between two of them is
  unfounded
- `await parent()` before an independent query serialises what could have been parallel
- Layout and page data merge rather than replace, and the page wins on a shared key
- A form without `use:enhance` reloads the whole page, which is correct behaviour rather than a bug
- `page` from `$app/stores` still works and is the pre-Svelte-5 form; `$app/state` is the current one
- A cookie set without `path: '/'` may not be sent back on the next request
- Remote functions (`.remote.ts`) are experimental behind `kit.experimental.remoteFunctions`

More gotchas, the load-function input matrix and the import surface are in
[reference.md](reference.md).

</red_flags>
