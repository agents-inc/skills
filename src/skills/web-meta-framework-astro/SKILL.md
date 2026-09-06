---
name: web-meta-framework-astro
description: Astro content-first framework - islands architecture, content collections, file-based routing, SSR/SSG hybrid rendering, View Transitions, server islands, multi-framework component support
---

# Astro Patterns

> **Quick Guide:** Astro renders pages to static HTML with zero client JavaScript by default. `.astro`
> components carry static content; framework components become interactive islands only when given a
> `client:*` directive. Content collections give structured Markdown type-safe frontmatter through Zod
> schemas. Rendering mode is per page: static unless `export const prerender = false`. Astro 6 replaced
> `<ViewTransitions />` with `<ClientRouter />`, replaced `Astro.glob()` with `import.meta.glob()`, moved
> `z` from `astro:content` to `astro/zod` (now Zod 4), requires string `getStaticPaths()` params, and
> requires Node 22.12.0+.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — typed props, expressions, nested layouts, scoped vs global styles, script handling
- [examples/islands.md](examples/islands.md) — directive selection, `client:only`, multi-framework islands, server islands, cross-island state
- [examples/content.md](examples/content.md) — collection schemas, querying, rendering, references, custom loaders, live collections
- [examples/routing.md](examples/routing.md) — static and dynamic routes, rest params, pagination, on-demand routes, endpoints, 404
- [examples/integrations.md](examples/integrations.md) — framework integrations, View Transitions, persistence, animations, Starlight
- [reference.md](reference.md) — project layout, route priority, collection API, adapters, rendering checklist

---

## Which path applies

- **Every page is static** — the default. No `output` setting and no adapter; dynamic routes need
  `getStaticPaths()`. Follow [examples/routing.md](examples/routing.md).
- **A few pages need request-time data** — keep the default, add `export const prerender = false` to
  those pages, and install a server adapter. Same file, plus the adapter table in [reference.md](reference.md).
- **Most pages need request-time data** — set `output: "server"` and opt individual pages back to
  static with `export const prerender = true`.

---

<critical_requirements>

## Before writing Astro code

**Leave pages static and add `export const prerender = false` only where the page reads request-time
data.** Static is the default and is where the framework's speed comes from.

**Install a server adapter before any page opts out of prerendering.** Without one, a build containing
`prerender = false` fails.

**Give a framework component a `client:*` directive when it needs to be interactive.** Without a
directive it renders to static HTML and its event handlers never run.

**Define collections in `src/content.config.ts` with a Zod schema.** The schema validates frontmatter at
build time and generates the types the queries return.

**Use `getStaticPaths()` for dynamic routes in static mode.** On-demand routes read `Astro.params`
directly and need no such export.

</critical_requirements>

---

**Auto-detection:** Astro, .astro files, astro.config, islands architecture, client:load, client:visible, client:idle, client:only, client:media, server:defer, content collections, defineCollection, defineLiveCollection, getCollection, getLiveCollection, getEntry, getLiveEntry, render, astro:content, astro:transitions, ClientRouter, getStaticPaths, Astro.props, Astro.params, Astro.cookies, Astro.redirect, prerender, astro add, @astrojs/react, @astrojs/vue, @astrojs/svelte, Starlight

**Applies to:**

- `.astro` component syntax — frontmatter, template expressions, slots, layouts, scoped styles
- Islands: client directives, hydration timing, server islands, mixing UI frameworks on one page
- Content collections: schemas, loaders, querying, rendering, cross-collection references
- File-based routing: static, dynamic, rest parameters, pagination, API endpoints
- Rendering mode: static, on-demand, and per-page `prerender` control
- View Transitions: `<ClientRouter />`, transition directives, persisted elements

**Handled elsewhere:**

- What an island renders internally — a hydrated component follows the conventions of whichever UI
  library wrote it, and Astro settles only the boundary.
- Which CSS approach fills a `<style>` block — the scoping rules here are Astro's; the styling system is not.
- Which store library fills the cross-island seam — that islands share no tree, and that a module-scoped store is the way across, is settled in [examples/islands.md](examples/islands.md); which store you reach for is not.
- Fully interactive applications where every route is user-specific — that shape wants a framework
  whose default is on-demand rendering rather than one whose default is static output.

---

<philosophy>

Astro is a **content-first framework that ships zero JavaScript by default**. Most of a page is static
HTML; small interactive "islands" hydrate independently, each paying only for itself.

Four consequences follow, and they explain most of the API:

1. **A component is static until told otherwise** — `client:*` is the opt-in, so the cost of
   interactivity is always visible at the call site.
2. **The UI library is a detail** — React, Vue, Svelte, Solid and Preact components are all just island
   contents, and one page can carry several.
3. **Content is typed data** — collections put a Zod schema between Markdown frontmatter and the code
   that reads it, so a typo in a post fails the build rather than the page.
4. **Rendering mode is per page** — static and on-demand pages coexist in one project, which is why
   `prerender` is an export rather than a global setting.

</philosophy>

---

<decision_framework>

**Static or on-demand?** A page needs on-demand rendering when it reads cookies, headers or
user-specific data at request time, or when its data changes faster than you are willing to rebuild.
Everything else is static — including data that changes hourly, which a rebuild handles more cheaply
than an adapter does.

**`.astro` or a framework component?** No client-side interactivity means `.astro` — zero JavaScript.
Simple interactivity (a toggle, a show/hide) is `.astro` plus a `<script>` tag, which is lighter than a
framework. Reach for a framework component when the interaction needs that framework's own state model.

**Which client directive?** The table in Pattern 4 maps each one to what it is for. `client:only` is
the last resort, for a component that cannot server-render at all.

**Build-time or live collection?** `defineCollection` for anything that is the same on every request —
posts, docs, changelogs, author bios. `defineLiveCollection` only when the data must be fresh per
request (inventory, pricing), which also forces that page into on-demand rendering.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Astro component structure

An `.astro` file is a server-only script between `---` fences followed by an HTML template. The script
never reaches the browser, so data fetching belongs there.

```astro
---
interface Props { title: string; description?: string }
const { title, description = "Default" } = Astro.props;
const posts = await getCollection("blog");
---

<h1>{title}</h1>
{posts.map((post) => <a href={`/blog/${post.id}`}>{post.data.title}</a>)}

<style>h1 { color: navy; }</style>
```

Styles in a `<style>` block are scoped to the component unless marked `is:global`.

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Slots for composition

A `<slot />` receives content from the parent. Named slots take a matching `slot="name"` attribute, and
anything inside the `<slot>` element is fallback content when nothing is passed.

```astro
<article>
  <header><slot name="header"><h2>{title}</h2></slot></header>
  <slot />
  <footer><slot name="footer" /></footer>
</article>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Layouts

A layout is an ordinary component that wraps page content through its default slot, and layouts nest —
a blog layout wrapping a base layout wrapping the page.

```astro
---
const { title } = Astro.props;
---
<html lang="en">
  <head><title>{title}</title></head>
  <body><main><slot /></main></body>
</html>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Islands and client directives

Framework components render to static HTML until a `client:*` directive hydrates them. The directive
chooses _when_ hydration happens.

| Directive        | Hydrates                                | Use for                      |
| ---------------- | --------------------------------------- | ---------------------------- |
| `client:load`    | Immediately on page load                | Critical interactive UI      |
| `client:idle`    | When the browser is idle                | Lower-priority interactivity |
| `client:visible` | When it scrolls into the viewport       | Below-the-fold content       |
| `client:media`   | When a media query matches              | Responsive interactivity     |
| `client:only`    | Client only, skipping the server render | Browser-dependent components |

```astro
<Header />                                   <!-- static, zero JS -->
<SearchBar client:load />
<Comments client:visible />
<Analytics client:media="(max-width: 768px)" />
```

Full code: [examples/islands.md](examples/islands.md)

### Pattern 5: Server islands

`server:defer` renders a component per request while the rest of the page stays cacheable. The
`fallback` slot holds its place until it arrives.

```astro
<ProductInfo product={product} />

<UserReviews server:defer>
  <div slot="fallback">Loading reviews...</div>
</UserReviews>
```

Full code: [examples/islands.md](examples/islands.md)

### Pattern 6: Content collections

A collection pairs a loader with a Zod schema. `getCollection` queries it with an optional filter, and
`render()` turns an entry's Markdown into a component.

```typescript
// src/content.config.ts
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});
export const collections = { blog };
```

```astro
const posts = await getCollection("blog", ({ data }) => !data.draft);
const { Content, headings } = await render(post);
```

Live collections are a separate mechanism: `defineLiveCollection` in `src/live.config.ts` (not
`content.config.ts`), queried with `getLiveCollection()` / `getLiveEntry()`, and only from on-demand
pages.

Full code: [examples/content.md](examples/content.md)

### Pattern 7: File-based routing

`src/pages/` maps to URLs. `[param]` is a single dynamic segment, `[...rest]` matches any depth, and a
leading underscore excludes a file from routing.

```
src/pages/
├── index.astro          → /
├── blog/[id].astro      → /blog/:id
├── docs/[...slug].astro → /docs and /docs/*
└── _helpers.ts          → not a route
```

In static mode each dynamic route exports `getStaticPaths()` returning `{ params, props }` pairs;
`paginate()` inside it generates numbered pages.

Full code: [examples/routing.md](examples/routing.md)

### Pattern 8: On-demand rendering and endpoints

`export const prerender = false` moves a page to request time, where `Astro.cookies`, `Astro.redirect()`
and a `Response` return value all become available. API endpoints are `.ts` files exporting one handler
per HTTP method, and they default to static like everything else.

```typescript
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q");
  if (!query)
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
    });
  return new Response(JSON.stringify(await searchDatabase(query)));
};
```

Full code: [examples/routing.md](examples/routing.md)

### Pattern 9: View Transitions

`<ClientRouter />` in the document head enables cross-page transitions. `transition:name` pairs elements
so they morph, and `transition:persist` keeps an element alive across a navigation.

```astro
<head><ClientRouter /></head>

<img src={post.data.heroImage} transition:name={`hero-${post.id}`} transition:animate="slide" />
<audio controls transition:persist><source src="/music.mp3" type="audio/mp3" /></audio>
```

Full code: [examples/integrations.md](examples/integrations.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A dynamic route in static mode with no `getStaticPaths()` — the build fails with "getStaticPaths() is required".
- `prerender = false` with no server adapter installed — the build fails.
- `<ViewTransitions />` — removed in Astro 6; import `<ClientRouter />` from `astro:transitions`.
- `Astro.glob()` — removed in Astro 6; use `import.meta.glob()`.
- `import { z } from "astro:content"` — removed in Astro 6; import `z` from `astro/zod`, which is Zod 4, so `z.string().email()` is now `z.email()`.
- Numeric `getStaticPaths()` params — Astro 6 requires strings; wrap with `String(id)`.
- `astro.config.cjs` — Astro 6 requires ESM (`.mjs` or `.ts`).
- Functions, class instances or symbols passed as props to a hydrated component — island props must be serializable.
- `Astro.props` read outside the frontmatter fence, or an `.astro` component imported into a framework component — neither is available there.
- Astro 6 on Node below 22.12.0 — unsupported.

**Surprising behaviour:**

- `client:load` on everything defeats the architecture; a component with no interactivity wants no directive at all.
- `client:only` skips the server render, so nothing is in the HTML for crawlers — prefer `client:load` wherever the component can render on the server.
- Data fetched in a `<script>` tag creates a client waterfall; frontmatter runs server-side and has no such cost.
- A collection with no schema loses both build-time validation and generated types.
- `output: "server"` on a mostly-static site gives up the default's caching for pages that did not need it.
- Unfiltered `getCollection` returns drafts alongside published entries.
- `<style>` is scoped by default — reach for `<style is:global>` or the `:global()` selector deliberately.
- `<script>` is bundled and deduped; `is:inline` opts out, which is what makes a script re-run on every View Transitions navigation.
- `client:visible` waits on IntersectionObserver, so a component that is never on screen never hydrates.
- `Astro.redirect()` works only on on-demand pages; a static page cannot redirect at request time.
- Islands share no state — cross-island communication needs a store or events you bring.
- `transition:persist` needs the same `transition:name` on both pages, or the element is recreated.
- Collection entry ids come from filenames unless frontmatter overrides them.
- Live collections cannot render MDX, and `import.meta.env` is inlined at build time — read runtime secrets from `process.env`.
- A `[...slug]` route matches its own base path when a params entry passes `undefined`.

</red_flags>
