# SvelteKit — Routing

> Pages, layouts, error boundaries, dynamic routes, route groups and parameter matchers. Loads are in
> [load-functions.md](load-functions.md), mutations in [form-actions.md](form-actions.md).

---

## Pattern 1: A Page and Its Data

### Good Example — page with a server load

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
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

**Why good:** The posts are in the HTML the server sends, so the page has content before any
JavaScript runs. `PageProps` is generated from this route's own load, so renaming `posts` is a
compile error rather than an empty list.

### Bad Example — fetching inside the component

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

**Why bad:** The server renders an empty list, then the browser downloads the JavaScript, then it
fetches — three sequential steps for something the server already had. A crawler sees the empty
version, and there is nowhere to put a loading or error state.

---

## Pattern 2: Layouts

### Good Example — nested layouts

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

**Why good:** Layouts nest, so the dashboard sidebar sits inside the site header without either file
knowing about the other. Only what `{@render children()}` renders changes on navigation, so the
sidebar keeps its scroll position.

---

## Pattern 3: Error Boundaries

### Good Example — an error boundary for one segment

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

**Why good:** Each status gets the recovery that actually helps — a 401 offers a login link, a 404
offers the dashboard. A single generic message offers neither. The boundary is inside `dashboard/`, so
the site header above it still renders.

---

## Pattern 4: Dynamic Routes

### Good Example — a blog post by slug

```
src/routes/blog/[slug]/
├── +page.svelte
└── +page.server.ts
```

```typescript
// src/routes/blog/[slug]/+page.server.ts
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
    include: { author: true },
  });

  if (!post) {
    error(404, "Post not found");
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

**Why good:** `error(404)` throws, so `data.post` is non-null in the component with no branch for the
missing case — and the response carries a real 404 status rather than a 200 with an empty page.

### Good Example — rest parameters

```
src/routes/docs/[...path]/
├── +page.svelte
└── +page.server.ts
```

```typescript
// src/routes/docs/[...path]/+page.server.ts
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  // params.path is "getting-started/installation" for /docs/getting-started/installation
  const segments = params.path.split("/");
  const doc = await loadDocument(segments);

  if (!doc) {
    error(404, "Documentation page not found");
  }

  return {
    doc,
    breadcrumbs: segments.map((s, i) => ({
      label: s.replace(/-/g, " "),
      href: "/docs/" + segments.slice(0, i + 1).join("/"),
    })),
  };
};
```

**Why good:** One route file serves every depth under `/docs`, and the breadcrumbs fall out of the
segments rather than being maintained separately.

---

## Pattern 5: Route Groups

### Good Example — a different layout per section

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

**Why good:** The parenthesised folder never reaches the URL — `/pricing`, not `/(marketing)/pricing`
— so two sections get different chrome without nesting the paths. `(app)/+layout.server.ts` then
guards every route in that group by existing.

---

## Pattern 6: Parameter Matchers

### Good Example — an integer-only id

```typescript
// src/params/integer.ts
import type { ParamMatcher } from "@sveltejs/kit";

export const match: ParamMatcher = (param) => {
  return /^\d+$/.test(param);
};
```

```
src/routes/users/[id=integer]/+page.svelte
```

**Why good:** The validation happens during route matching, so `/users/abc` never reaches the load
function at all — it 404s instead of the load parsing a non-numeric id and having to decide what to
do about it.

---

_Loads are in [load-functions.md](load-functions.md), mutations in
[form-actions.md](form-actions.md)._
