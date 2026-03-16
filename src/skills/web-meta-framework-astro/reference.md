# Astro Framework Reference

> Decision frameworks, anti-patterns, and red flags for Astro development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Static vs On-Demand Rendering

```
Does this page need request-time data?
├─ NO → Static (default, no config needed)
│   Best for: blog posts, docs, marketing pages, portfolios
└─ YES → Does it need user-specific data (auth, cookies)?
    ├─ YES → On-demand (export const prerender = false)
    │   Requires: server adapter installed
    └─ NO → Does the data change frequently?
        ├─ YES → On-demand (export const prerender = false)
        └─ NO → Static with rebuild on content change
```

### Client Directive Selection

```
Does this component need interactivity?
├─ NO → No directive (renders to static HTML, zero JS)
└─ YES → Is it above the fold / immediately needed?
    ├─ YES → client:load (hydrates immediately)
    └─ NO → Is it below the fold?
        ├─ YES → client:visible (hydrates when scrolled into view)
        └─ NO → Is it low priority?
            ├─ YES → client:idle (hydrates when browser is idle)
            └─ NO → Does it depend on screen size?
                ├─ YES → client:media="(query)"
                └─ NO → Does it use browser-only APIs?
                    ├─ YES → client:only="react" (skips SSR)
                    └─ NO → client:load
```

### Astro Component vs Framework Component

```
Does this need client-side interactivity?
├─ NO → Use .astro component (zero JS, fastest)
└─ YES → Is the interactivity simple (toggle, show/hide)?
    ├─ YES → Use .astro + <script> tag (lighter than framework)
    └─ NO → Does it need React/Vue/Svelte state management?
        ├─ YES → Use framework component with client:* directive
        └─ NO → Use .astro + <script> tag
```

### Build-Time vs Live Collections

```
Does the data change between requests?
├─ NO → defineCollection (build-time, static, fast)
│   Best for: blog posts, docs, changelogs, author bios
└─ YES → Does it need to be fresh on every request?
    ├─ YES → defineLiveCollection (runtime, requires SSR)
    │   Best for: inventory, pricing, user-specific data
    └─ NO → defineCollection + periodic rebuilds
        Best for: content that changes hourly/daily
```

### Content Collection vs Manual Files

```
Do you have structured content (blog, docs, products)?
├─ YES → Use content collections
│   └─ Does the content come from local files?
│       ├─ YES → Use glob() or file() loader
│       └─ NO → Use custom loader (API, CMS, database)
└─ NO → Is it a single page?
    ├─ YES → Use a regular .astro page
    └─ NO → Is it dynamic data from an API?
        ├─ YES → Fetch in frontmatter or use on-demand rendering
        └─ NO → Regular .astro pages
```

### Output Mode Selection

```
How many pages need on-demand rendering?
├─ None → Default (no output config needed)
├─ A few → Default + export const prerender = false per page
├─ Most → output: 'server' + export const prerender = true for static pages
└─ All → output: 'server'
```

---

## RED FLAGS

### High Priority Issues

- **Adding `client:load` to every component** - Defeats the purpose of islands architecture; only hydrate components that genuinely need interactivity
- **Using framework components for static content** - Astro components render to zero-JS HTML; use `.astro` for non-interactive content
- **Missing `getStaticPaths()` on dynamic routes in static mode** - Build will fail with "getStaticPaths() is required"
- **Using `<ViewTransitions />`** - Removed in Astro 6; use `<ClientRouter />` from `astro:transitions`
- **No server adapter with `prerender = false`** - On-demand rendering requires an adapter; build will fail

### Medium Priority Issues

- **Fetching data in `<script>` tags instead of frontmatter** - Frontmatter runs server-side at build time; use it for data fetching
- **Using `client:only` when `client:load` would work** - `client:only` skips SSR, so no HTML is rendered for SEO
- **Not filtering drafts in content collection queries** - Published and draft content returned together
- **Missing Zod schema on content collections** - Loses type safety and build-time validation
- **Using `output: 'server'` for mostly static sites** - Default static mode with per-page SSR opt-in is more performant

### Common Mistakes

- **Importing `.astro` components in framework components** - Astro components can only be used in `.astro` files; framework components cannot import them
- **Using `Astro.props` outside frontmatter** - `Astro.props` is only available in the component script block
- **Forgetting `export const prerender = false` in API endpoints** - Endpoints default to static; they need explicit opt-out for dynamic behavior
- **Using CommonJS `astro.config.cjs`** - Astro 6 requires ESM (`astro.config.mjs` or `.ts`)
- **Passing non-serializable props to client components** - Props must be serializable (no functions, class instances, or symbols)

### Gotchas & Edge Cases

- **Styles in `.astro` are scoped by default** - Use `<style is:global>` for global styles or `:global()` selector
- **`<script>` tags are bundled and deduped** - Use `<script is:inline>` to prevent bundling
- **`client:visible` uses IntersectionObserver** - Component won't hydrate if it's always off-screen
- **Content collection IDs are derived from filenames** - Override with a `slug` property in frontmatter
- **`Astro.redirect()` only works in on-demand rendered pages** - Static pages cannot redirect at request time
- **Multiple framework components on one page share no state** - Each island is independent; use shared stores or events for communication
- **`transition:persist` requires matching `transition:name`** - Elements must have the same name on both pages to persist
- **Astro 6 requires Node.js 22.12.0+** - Earlier Node versions are not supported
- **Live collections (`defineLiveCollection`) have no MDX support** - MDX cannot be rendered at runtime
- **`Astro.glob()` is removed in Astro 6** - Use `import.meta.glob()` instead
- **`z` from `astro:content` is deprecated in Astro 6** - Import `z` from `astro/zod` instead
- **Rest parameter routes (`[...slug]`) can match the root** - Pass `undefined` as param to match the base path

---

## Anti-Patterns

### Making Everything a Client Island

The performance advantage of Astro comes from shipping zero JavaScript by default. Adding `client:load` to everything recreates a traditional SPA.

```astro
<!-- WRONG - Everything is a client island -->
<Header client:load />
<Navigation client:load />
<Footer client:load />
<StaticContent client:load />

<!-- CORRECT - Only interactive parts are islands -->
<Header />
<Navigation />
<SearchBar client:load />
<Footer />
<StaticContent />
```

### Using Framework Components for Static Content

Astro components render to zero JavaScript. Using React for static content adds unnecessary framework overhead.

```astro
<!-- WRONG - React component for static content -->
<StaticCard client:load title="Hello" description="World" />

<!-- CORRECT - Astro component for static content -->
<Card title="Hello" description="World" />
```

### Fetching Data Client-Side When Server-Side Works

Astro's frontmatter runs server-side. Fetching in `<script>` creates client-server waterfalls.

```astro
<!-- WRONG - Client-side fetch -->
<div id="data"></div>
<script>
  const res = await fetch("/api/data");
  const data = await res.json();
  document.getElementById("data").innerHTML = data.title;
</script>

<!-- CORRECT - Server-side fetch in frontmatter -->
---
const res = await fetch("https://api.example.com/data");
const data = await res.json();
---
<div>{data.title}</div>
```

### Missing Error Handling in getStaticPaths

If getStaticPaths returns invalid data, the build fails with unhelpful errors.

```astro
---
// WRONG - No error handling
export async function getStaticPaths() {
  const res = await fetch("https://api.example.com/posts");
  const posts = await res.json(); // Could fail silently
  return posts.map((post) => ({ params: { id: post.id } }));
}

// CORRECT - Validate data
export async function getStaticPaths() {
  const res = await fetch("https://api.example.com/posts");
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.status}`);
  }
  const posts = await res.json();
  return posts
    .filter((post) => post.id != null)
    .map((post) => ({
      params: { id: String(post.id) },
      props: { post },
    }));
}
---
```

---

## Quick Reference

### Project Structure

```
src/
├── components/      # Astro and framework components
├── content/         # Content collection files (Markdown, JSON, etc.)
├── content.config.ts # Collection definitions with schemas
├── layouts/         # Layout components
├── pages/           # File-based routing (page = route)
│   └── api/         # API endpoints (.ts files)
├── styles/          # Global styles
└── assets/          # Optimized images and assets
astro.config.mjs     # Astro configuration
```

### Route Priority Order

1. Static routes (most specific)
2. Dynamic routes with named parameters `[param]`
3. Rest parameter routes `[...slug]`
4. Endpoints over pages
5. File-based routes over configured redirects

### Content Collection API

```typescript
// Query collections
import { getCollection, getEntry, render } from "astro:content";

const all = await getCollection("blog");
const filtered = await getCollection("blog", ({ data }) => !data.draft);
const one = await getEntry("blog", "my-post-id");
const { Content, headings } = await render(entry);
```

### Rendering Mode Checklist

- [ ] Default: All pages static (SSG)
- [ ] Install adapter if ANY page needs SSR
- [ ] Use `export const prerender = false` for SSR pages
- [ ] Use `output: 'server'` only if MOST pages need SSR
- [ ] API endpoints need `export const prerender = false`

### Client Directive Checklist

- [ ] No directive = zero JavaScript (static HTML)
- [ ] `client:load` for immediately interactive components
- [ ] `client:idle` for deferred, non-critical interactivity
- [ ] `client:visible` for below-the-fold components
- [ ] `client:media` for responsive interactivity
- [ ] `client:only` only when SSR is impossible (browser APIs in render)
