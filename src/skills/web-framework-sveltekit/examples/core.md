# SvelteKit Routing Examples

> Complete code examples for SvelteKit routing patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See [load-functions.md](load-functions.md), [form-actions.md](form-actions.md), [hooks.md](hooks.md), and [api-routes.md](api-routes.md).

---

## Pattern 1: Basic Page with Data

### Good Example — Page with Server Load

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return { posts };
};
```

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<h1>Latest Posts</h1>

{#each data.posts as post}
  <article>
    <h2><a href="/blog/{post.slug}">{post.title}</a></h2>
    <time datetime={post.createdAt.toISOString()}>
      {post.createdAt.toLocaleDateString()}
    </time>
  </article>
{/each}
```

**Why good:** Server load fetches data before render (no waterfalls), `PageProps` from `$types` provides type safety, `$props()` receives data (Svelte 5 pattern)

### Bad Example — Fetching in Component

```svelte
<!-- BAD: Client-side fetch in component -->
<script lang="ts">
  let posts = $state([]);

  $effect(() => {
    // BAD: Creates waterfall, no SSR, no streaming
    fetch('/api/posts')
      .then(r => r.json())
      .then(data => posts = data);
  });
</script>
```

**Why bad:** Data fetches after component renders (waterfall), no SSR for SEO, no loading state management, no error handling

---

## Pattern 2: Layouts

### Good Example — Nested Layout with Navigation

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();
</script>

<header>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/about">About</a>
  </nav>
</header>

<main>
  {@render children()}
</main>

<footer>
  <p>&copy; 2025</p>
</footer>
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();
</script>

<div class="dashboard-layout">
  <aside>
    <nav>
      <a href="/dashboard">Overview</a>
      <a href="/dashboard/analytics">Analytics</a>
      <a href="/dashboard/settings">Settings</a>
    </nav>
    <p>{data.user.name}</p>
  </aside>

  <div class="content">
    {@render children()}
  </div>
</div>
```

**Why good:** Root layout provides global navigation, dashboard layout nests with sidebar, `{@render children()}` is Svelte 5 syntax for layout content, layout persists across child page navigations

---

## Pattern 3: Error Boundaries

### Good Example — Segment Error Boundary

```svelte
<!-- src/routes/dashboard/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="error-container" role="alert">
  <h2>Dashboard Error</h2>

  {#if page.status === 404}
    <p>This dashboard page doesn't exist.</p>
    <a href="/dashboard">Back to Dashboard</a>
  {:else if page.status === 401}
    <p>You need to be logged in to view this.</p>
    <a href="/login">Log in</a>
  {:else if page.status === 403}
    <p>You don't have permission to view this.</p>
    <a href="/dashboard">Back to Dashboard</a>
  {:else}
    <p>Something went wrong: {page.error?.message}</p>
    <button onclick={() => location.reload()}>Try again</button>
  {/if}
</div>
```

**Why good:** Uses `$app/state` (Svelte 5 pattern, not `$app/stores`), handles different status codes, provides navigation back, role="alert" for accessibility

---

## Pattern 4: Dynamic Routes

### Good Example — Blog Post with Slug

```
src/routes/blog/[slug]/
├── +page.svelte
└── +page.server.ts
```

```typescript
// src/routes/blog/[slug]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
    include: { author: true },
  });

  if (!post) {
    error(404, 'Post not found');
  }

  return { post };
};
```

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.post.title}</title>
  <meta name="description" content={data.post.excerpt} />
</svelte:head>

<article>
  <h1>{data.post.title}</h1>
  <p class="author">By {data.post.author.name}</p>
  <div class="content">
    {@html data.post.content}
  </div>
</article>
```

**Why good:** `params.slug` is type-safe from `$types`, `error(404)` renders `+error.svelte` with proper status, `<svelte:head>` for SEO metadata

### Good Example — Rest Parameters for Docs

```
src/routes/docs/[...path]/
├── +page.svelte
└── +page.server.ts
```

```typescript
// src/routes/docs/[...path]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  // params.path is "getting-started/installation" for /docs/getting-started/installation
  const segments = params.path.split('/');
  const doc = await loadDocument(segments);

  if (!doc) {
    error(404, 'Documentation page not found');
  }

  return {
    doc,
    breadcrumbs: segments.map((s, i) => ({
      label: s.replace(/-/g, ' '),
      href: '/docs/' + segments.slice(0, i + 1).join('/'),
    })),
  };
};
```

**Why good:** Rest parameter captures entire path, breadcrumbs generated from segments, fallback to 404 for missing docs

---

## Pattern 5: Route Groups

Route groups organize routes with shared layouts without affecting the URL.

### Good Example — Different Layouts for Marketing vs App

```
src/routes/
├── (marketing)/
│   ├── +layout.svelte       # Marketing layout (landing page style)
│   ├── +page.svelte          # / (home)
│   ├── pricing/
│   │   └── +page.svelte      # /pricing
│   └── about/
│       └── +page.svelte      # /about
├── (app)/
│   ├── +layout.svelte        # App layout (sidebar, auth required)
│   ├── +layout.server.ts     # Auth check for all app routes
│   ├── dashboard/
│   │   └── +page.svelte      # /dashboard
│   └── settings/
│       └── +page.svelte      # /settings
└── +layout.svelte            # Root layout (shared by all)
```

```svelte
<!-- src/routes/(marketing)/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<div class="marketing-layout">
  <nav class="marketing-nav">
    <a href="/">Home</a>
    <a href="/pricing">Pricing</a>
    <a href="/about">About</a>
    <a href="/dashboard" class="cta">Get Started</a>
  </nav>
  {@render children()}
</div>
```

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();
</script>

<div class="app-layout">
  <aside class="sidebar">
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/settings">Settings</a>
    </nav>
    <p>{data.user.name}</p>
  </aside>
  <main>
    {@render children()}
  </main>
</div>
```

**Why good:** Route groups don't affect URLs (`/pricing`, not `/(marketing)/pricing`), different layouts for different sections, auth check scoped to app group

---

## Pattern 6: Parameter Matchers

Validate route parameters with custom matchers.

### Good Example — Integer ID Matcher

```typescript
// src/params/integer.ts
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => {
  return /^\d+$/.test(param);
};
```

```
src/routes/users/[id=integer]/+page.svelte
```

**Why good:** Route only matches numeric IDs, `/users/abc` falls through to 404, type-safe parameter validation at the routing level

---

_For load function patterns, see [load-functions.md](load-functions.md). For form actions, see [form-actions.md](form-actions.md)._
