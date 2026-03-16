---
name: web-framework-sveltekit
description: SvelteKit full-stack framework - file-based routing, load functions, form actions, server hooks, SSR/SSG, API routes, streaming, progressive enhancement
---

# SvelteKit Patterns

> **Quick Guide:** SvelteKit is the full-stack framework for Svelte. Use `+page.server.ts` load functions for server-side data, form actions for mutations with progressive enhancement, and `+server.ts` for API routes. Data flows from load functions to components via the `data` prop. Use `use:enhance` on forms for client-side progressive enhancement.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use server load functions (`+page.server.ts`) for data requiring database access, secrets, or cookies)**

**(You MUST use form actions for mutations — NOT API routes for form submissions)**

**(You MUST use `fail()` from `@sveltejs/kit` for validation errors — NEVER throw errors for validation)**

**(You MUST validate all input data on the server — client-side validation is NOT sufficient for security)**

**(You MUST use the auto-generated `$types` for type-safe load functions and page props)**

**(You MUST use `use:enhance` on forms for progressive enhancement — forms should work without JavaScript)**

**(You MUST NOT catch `redirect()` in try/catch — it throws a special exception SvelteKit handles)**

</critical_requirements>

---

**Auto-detection:** SvelteKit, +page.svelte, +page.ts, +page.server.ts, +layout.svelte, +layout.ts, +layout.server.ts, +error.svelte, +server.ts, load function, form actions, use:enhance, hooks.server.ts, hooks.client.ts, handle hook, handleFetch, handleError, $app/navigation, $app/forms, $app/state, PageLoad, PageServerLoad, LayoutLoad, LayoutServerLoad, RequestHandler, fail, redirect, error

**When to use:**

- Building SvelteKit applications with file-based routing
- Loading data for pages with server or universal load functions
- Handling form submissions with form actions and progressive enhancement
- Creating API endpoints with `+server.ts` routes
- Implementing server hooks for auth, logging, or request modification
- Configuring SSR, SSG, or prerendering strategies

**Key patterns covered:**

- File-based routing (`+page.svelte`, `+layout.svelte`, `+error.svelte`)
- Server load functions (`+page.server.ts`, `+layout.server.ts`)
- Universal load functions (`+page.ts`, `+layout.ts`)
- Form actions with validation and progressive enhancement
- Server hooks (`handle`, `handleFetch`, `handleError`)
- API routes (`+server.ts`) and streaming responses
- Page options (`prerender`, `ssr`, `csr`)
- Data invalidation and rerunning load functions

**When NOT to use:**

- Svelte 5 component patterns (Runes, snippets, events) — use web-framework-svelte
- Pure client-side Svelte without SvelteKit routing
- General React/Next.js patterns — use web-framework-react or web-framework-nextjs

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Routing & Data:**

- [examples/core.md](examples/core.md) - File-based routing, `+page.svelte`, `+layout.svelte`, `+error.svelte`, dynamic routes
- [examples/load-functions.md](examples/load-functions.md) - Server load, universal load, streaming, parent data, invalidation

**Mutations & Forms:**

- [examples/form-actions.md](examples/form-actions.md) - Form actions, `use:enhance`, validation with `fail()`, redirects

**Server:**

- [examples/hooks.md](examples/hooks.md) - `handle`, `handleFetch`, `handleError`, `sequence`, auth patterns
- [examples/api-routes.md](examples/api-routes.md) - `+server.ts` API routes, streaming, content negotiation

---

<philosophy>

## Philosophy

SvelteKit is a **full-stack framework** built on Svelte that handles routing, server-side rendering, data loading, and form handling. It embraces web platform standards — using native `Request`/`Response`, `FormData`, and progressive enhancement.

**Core principles:**

1. **File-based routing** — Directory structure defines URL structure. Special files (`+page.svelte`, `+layout.svelte`, etc.) define behavior.
2. **Server-first data loading** — Load functions run on the server for initial requests, providing data before rendering.
3. **Progressive enhancement** — Forms work without JavaScript. `use:enhance` adds client-side behavior on top.
4. **Separation of concerns** — Load functions fetch data, form actions handle mutations, hooks handle cross-cutting concerns.
5. **Type safety** — Auto-generated `$types` provide type-safe load functions, page props, and form data.
6. **Web standards** — Built on `Request`, `Response`, `URL`, `Headers`, `FormData` — standard web APIs.

**Data flow in SvelteKit:**

```
Request → hooks.server.ts (handle) → +layout.server.ts (load) → +page.server.ts (load) → +page.svelte (render)
                                                                                         ← form actions (POST)
```

**When to use SvelteKit:**

- Full-stack web applications with routing
- Server-rendered pages with SEO requirements
- Form-heavy applications with progressive enhancement
- API backends alongside page rendering
- Static site generation (SSG) with prerendering

**When NOT to use:**

- Client-only single-page apps without routing (use Svelte directly)
- Pure API servers (use Hono, Express, or similar)
- Micro-frontends embedded in other frameworks

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: File-Based Routing

SvelteKit uses filesystem-based routing where directories in `src/routes/` define URL paths and special files define behavior.

#### File Conventions

| File | Purpose | Runs On |
|------|---------|---------|
| `+page.svelte` | Page component (UI) | Server (SSR) + Client |
| `+page.ts` | Universal load function | Server + Client |
| `+page.server.ts` | Server load function + form actions | Server only |
| `+layout.svelte` | Shared layout wrapper | Server (SSR) + Client |
| `+layout.ts` | Universal layout load | Server + Client |
| `+layout.server.ts` | Server layout load | Server only |
| `+error.svelte` | Error boundary | Server (SSR) + Client |
| `+server.ts` | API route (GET, POST, etc.) | Server only |

#### Route Structure

```
src/routes/
├── +layout.svelte          # Root layout
├── +page.svelte            # Home page (/)
├── +error.svelte           # Root error boundary
├── about/
│   └── +page.svelte        # /about
├── blog/
│   ├── +page.svelte        # /blog (list)
│   ├── +page.server.ts     # Load blog posts
│   └── [slug]/
│       ├── +page.svelte    # /blog/:slug (detail)
│       └── +page.server.ts # Load single post
├── dashboard/
│   ├── +layout.svelte      # Dashboard layout (sidebar)
│   ├── +layout.server.ts   # Auth check for all dashboard pages
│   ├── +page.svelte        # /dashboard
│   └── settings/
│       └── +page.svelte    # /dashboard/settings
├── (marketing)/             # Route group (no URL segment)
│   ├── +layout.svelte      # Marketing-specific layout
│   ├── pricing/
│   │   └── +page.svelte    # /pricing
│   └── features/
│       └── +page.svelte    # /features
└── api/
    └── health/
        └── +server.ts      # GET /api/health
```

**Why this works:** File conventions eliminate routing configuration, layouts nest automatically, route groups organize without affecting URLs

---

### Pattern 2: Server Load Functions

Server load functions (`+page.server.ts`) run only on the server. Use for database access, secrets, and cookie-based auth.

```typescript
// src/routes/blog/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const POSTS_PER_PAGE = 10;

export const load: PageServerLoad = async ({ url, locals }) => {
  // Access query params
  const page = Number(url.searchParams.get('page') ?? '1');

  // Access server-only data (locals set in hooks)
  if (!locals.user) {
    error(401, 'Not authenticated');
  }

  // Fetch from database (server-only)
  const offset = (page - 1) * POSTS_PER_PAGE;
  const [posts, total] = await Promise.all([
    db.post.findMany({
      take: POSTS_PER_PAGE,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    }),
    db.post.count(),
  ]);

  return {
    posts,
    pagination: {
      page,
      totalPages: Math.ceil(total / POSTS_PER_PAGE),
    },
  };
};
```

```svelte
<!-- src/routes/blog/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<h1>Blog</h1>

{#each data.posts as post}
  <article>
    <h2><a href="/blog/{post.slug}">{post.title}</a></h2>
    <p>{post.excerpt}</p>
  </article>
{/each}

<nav>
  {#if data.pagination.page > 1}
    <a href="?page={data.pagination.page - 1}">Previous</a>
  {/if}
  {#if data.pagination.page < data.pagination.totalPages}
    <a href="?page={data.pagination.page + 1}">Next</a>
  {/if}
</nav>
```

**Why good:** Server-only code (database access), type-safe with auto-generated `$types`, named constant for pagination, parallel data fetching with `Promise.all`

---

### Pattern 3: Universal Load Functions

Universal load functions (`+page.ts`) run on both server and client. Use for external APIs that don't need secrets.

```typescript
// src/routes/weather/+page.ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
  // SvelteKit's fetch: works on server and client, inherits cookies
  const response = await fetch(`https://api.weather.com/forecast?city=london`);

  if (!response.ok) {
    error(response.status, 'Failed to load weather data');
  }

  const forecast = await response.json();

  return { forecast };
};
```

**Why good:** `fetch` from SvelteKit works on both server (SSR) and client (navigation), auto-deduplicates on the client, inherits cookies for authenticated APIs

**When to use:** External public APIs, data that doesn't require server secrets

**When not to use:** Database access, private environment variables, cookie manipulation — use `+page.server.ts`

---

### Pattern 4: Layout Load Functions

Layout load functions provide data to all child pages in the route segment.

```typescript
// src/routes/dashboard/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
  // Auth check for all dashboard routes
  if (!locals.user) {
    redirect(303, '/login');
  }

  // Data available to all dashboard pages
  const notifications = await db.notification.findMany({
    where: { userId: locals.user.id, read: false },
  });

  return {
    user: locals.user,
    notifications,
  };
};
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();
</script>

<div class="dashboard">
  <aside class="sidebar">
    <nav>
      <a href="/dashboard">Overview</a>
      <a href="/dashboard/settings">Settings</a>
    </nav>
    <p>Welcome, {data.user.name}</p>
    <span class="badge">{data.notifications.length} unread</span>
  </aside>

  <main>
    {@render children()}
  </main>
</div>
```

**Why good:** Auth check runs for all dashboard child pages, layout data cascades to children, `redirect` throws for unauthenticated users, Svelte 5 `{@render children()}` for layout slot

---

### Pattern 5: Form Actions

Form actions handle `POST` requests in `+page.server.ts`. They enable progressive enhancement — forms work without JavaScript.

```typescript
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    redirect(303, '/dashboard');
  }
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString() ?? '';
    const password = data.get('password')?.toString() ?? '';

    // Validation
    if (!email) {
      return fail(400, { email, missing: true, message: 'Email is required' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return fail(400, {
        email,
        invalid: true,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // Authentication (defer to your auth solution)
    const user = await authenticateUser(email, password);

    if (!user) {
      return fail(400, { email, invalid: true, message: 'Invalid credentials' });
    }

    // Set session cookie
    cookies.set('session', user.sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    redirect(303, '/dashboard');
  },

  register: async ({ request }) => {
    // Named action for registration
    const data = await request.formData();
    // ... registration logic
  },
};
```

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
</script>

<h1>Login</h1>

{#if form?.message}
  <p class="error" role="alert">{form.message}</p>
{/if}

<form method="POST" action="?/login" use:enhance>
  <label>
    Email
    <input
      type="email"
      name="email"
      value={form?.email ?? ''}
      required
    />
  </label>

  <label>
    Password
    <input
      type="password"
      name="password"
      required
    />
  </label>

  <button type="submit">Log in</button>
  <button type="submit" formaction="?/register">Register</button>
</form>
```

**Why good:** `fail()` returns validation errors without clearing form data, `form` prop shows returned data, `use:enhance` for client-side enhancement, `action="?/login"` targets named action, `redirect` after successful auth, named constant for password length

---

### Pattern 6: Error Handling

SvelteKit uses `+error.svelte` components as error boundaries and the `error()` helper for controlled errors.

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-page">
  <h1>{page.status}</h1>

  {#if page.status === 404}
    <p>Page not found</p>
    <a href="/">Go home</a>
  {:else if page.status === 401}
    <p>You need to log in to access this page.</p>
    <a href="/login">Log in</a>
  {:else}
    <p>{page.error?.message ?? 'Something went wrong'}</p>
  {/if}
</div>
```

```typescript
// In a load function
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
  });

  if (!post) {
    error(404, 'Post not found');
  }

  return { post };
};
```

**Why good:** `error()` throws a controlled error that renders `+error.svelte`, `page` from `$app/state` provides status and error info (Svelte 5 pattern), error boundary walks up the tree to find nearest `+error.svelte`

---

### Pattern 7: Streaming with Load Functions

Return unawaited promises from load functions to stream data — fast data renders immediately, slow data streams in.

```typescript
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Fast query - awaited (blocks render until ready)
  const user = await db.user.findUnique({
    where: { id: locals.user.id },
  });

  // Slow queries - NOT awaited (streamed after initial render)
  const analyticsPromise = fetchAnalytics(locals.user.id);
  const recommendationsPromise = fetchRecommendations(locals.user.id);

  return {
    user,
    analytics: analyticsPromise,      // Streams when ready
    recommendations: recommendationsPromise,  // Streams when ready
  };
};
```

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<h1>Welcome, {data.user.name}</h1>

{#await data.analytics}
  <div class="skeleton">Loading analytics...</div>
{:then analytics}
  <div class="analytics">
    <p>Views: {analytics.views}</p>
    <p>Revenue: ${analytics.revenue}</p>
  </div>
{:catch error}
  <p class="error">Failed to load analytics: {error.message}</p>
{/await}

{#await data.recommendations}
  <div class="skeleton">Loading recommendations...</div>
{:then recommendations}
  <ul>
    {#each recommendations as rec}
      <li>{rec.title}</li>
    {/each}
  </ul>
{:catch error}
  <p class="error">Failed to load recommendations</p>
{/await}
```

**Why good:** User sees fast data immediately, slow data streams in progressively, each section handles loading and error states independently, `{#await}` blocks handle all three states

---

### Pattern 8: Dynamic Routes

Use bracket notation for dynamic route segments.

#### Single Parameter

```typescript
// src/routes/blog/[slug]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
  });

  if (!post) {
    error(404, 'Post not found');
  }

  return { post };
};
```

#### Rest Parameters

```typescript
// src/routes/docs/[...path]/+page.server.ts
// Matches /docs/a, /docs/a/b, /docs/a/b/c
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  // params.path is "a/b/c" for /docs/a/b/c
  const segments = params.path.split('/');
  const doc = await loadDocument(segments);

  return { doc, breadcrumbs: segments };
};
```

#### Optional Parameters

```typescript
// src/routes/[[lang]]/about/+page.svelte
// Matches /about and /en/about, /fr/about, etc.
```

---

### Pattern 9: Page Options

Control rendering behavior per-page or per-layout.

```typescript
// src/routes/blog/+page.ts
// Prerender blog listing at build time
export const prerender = true;

// src/routes/dashboard/+page.ts
// Disable SSR for client-only dashboard
export const ssr = false;

// src/routes/marketing/+layout.ts
// Prerender all marketing pages
export const prerender = true;

// src/routes/api/realtime/+server.ts
// Force dynamic rendering (no caching)
export const prerender = false;
```

| Option | Values | Effect |
|--------|--------|--------|
| `prerender` | `true`, `false`, `'auto'` | Generate static HTML at build time |
| `ssr` | `true`, `false` | Enable/disable server-side rendering |
| `csr` | `true`, `false` | Enable/disable client-side rendering (hydration) |

**When to use:**

- `prerender = true` — Static content (blog posts, marketing pages)
- `ssr = false` — Client-only pages with browser APIs (dashboards with charts)
- `csr = false` — Zero JavaScript pages (legal text, documentation)

</patterns>

---

<integration>

## Integration Guide

**SvelteKit is the full-stack framework.** It builds on Svelte for routing, data loading, and server-side concerns.

**Svelte component integration:**

- All Svelte 5 patterns (Runes, snippets, events) work in SvelteKit pages and layouts
- Page components receive `data` prop from load functions via `$props()`
- Use `PageProps`, `LayoutProps` from auto-generated `$types`

**Data fetching integration:**

- Server load functions fetch data before rendering (no waterfalls)
- Layout load data cascades to all child pages
- `invalidate()` and `invalidateAll()` for programmatic data refresh

**Form handling integration:**

- Form actions handle POST requests with progressive enhancement
- `use:enhance` adds client-side behavior (no page reload)
- `fail()` returns validation errors to the `form` prop

**Auth integration:**

- `hooks.server.ts` handle hook for session verification
- `event.locals` for passing auth data to load functions and actions
- Layout server load for protecting route groups

**Deployment:**

- `adapter-auto` — Auto-detects deployment platform
- `adapter-node` — Node.js server
- `adapter-static` — Static site generation
- `adapter-vercel`, `adapter-netlify`, `adapter-cloudflare` — Platform-specific

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use server load functions (`+page.server.ts`) for data requiring database access, secrets, or cookies)**

**(You MUST use form actions for mutations — NOT API routes for form submissions)**

**(You MUST use `fail()` from `@sveltejs/kit` for validation errors — NEVER throw errors for validation)**

**(You MUST validate all input data on the server — client-side validation is NOT sufficient for security)**

**(You MUST use the auto-generated `$types` for type-safe load functions and page props)**

**(You MUST use `use:enhance` on forms for progressive enhancement — forms should work without JavaScript)**

**(You MUST NOT catch `redirect()` in try/catch — it throws a special exception SvelteKit handles)**

**Failure to follow these rules will break data loading, create security vulnerabilities, lose progressive enhancement, or cause redirect failures.**

</critical_reminders>
