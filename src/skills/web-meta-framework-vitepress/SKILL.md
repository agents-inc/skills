---
name: web-meta-framework-vitepress
description: VitePress 1.x — Vue-powered static site generator for documentation sites, built on Vite
---

# VitePress Patterns

> **Quick Guide:** VitePress is a Vue-powered static site generator for documentation, configured
> entirely in `.vitepress/config.ts`. The sidebar is either an array (one sidebar everywhere) or an
> object keyed by URL path prefix (a sidebar per section). Data loaders — files ending `.data.ts` — run
> at build time and ship only their serialized result to the client. Vue components work directly inside
> Markdown through `<script setup>`. Every page is pre-rendered at build time, which is the constraint
> behind most of the red flags below.
>
> **Version:** VitePress 1.6.x, on Vite 6+ and Vue 3.5+.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — full config, multi-sidebar, content and custom data loaders, theme extension and CSS variables, Vue in Markdown, markdown extensions, build hooks, home page, i18n, markdown-it plugins, dynamic routes, rewrites, deployment
- [reference.md](reference.md) — CLI commands, site and theme config tables, frontmatter fields, runtime API, CSS variable categories, layout slots, markdown syntax

---

<critical_requirements>

## Before writing VitePress code

**Put site configuration in `.vitepress/config.ts` and wrap it in `defineConfig()`.** That path is where
the build looks, and the wrapper is what gives the option names type checking.

**Load data through a `*.data.ts` loader rather than fetching in a component.** The loader runs at build
time and the client receives only the serialized result, which is both faster and SSR-safe.

**Guard browser APIs with `<ClientOnly>` or `onMounted`.** Every page is pre-rendered at build time, so a
bare `window` or `document` reference crashes the build rather than the browser.

**Extend the default theme with `extends: DefaultTheme` plus layout slots.** A fork is a copy that stops
tracking upstream, and the slot list is broad enough that forking is rarely the shorter route.

**Build Markdown collection pages with `createContentLoader()`.** It already handles the glob, the
frontmatter extraction, mtime caching and dev-mode watching.

</critical_requirements>

---

**Auto-detection:** VitePress, vitepress, .vitepress/config, defineConfig vitepress, createContentLoader, vitepress/theme, DefaultTheme, useData, useSidebar, markdown-it plugin vitepress, vitepress deploy

**Applies to:**

- Site and theme configuration in `.vitepress/config.ts`
- Navigation: nav bar, single and multi-sidebar, outline, edit links
- Data loaders — `createContentLoader` for Markdown collections, custom `load()` for anything else
- Vue components in Markdown, page-scoped and globally registered
- Theme extension through layout slots, custom layouts and CSS variables
- Markdown extensions: containers, code groups, line highlighting and annotations, snippets, includes
- Build hooks: `transformPageData`, `transformHead`, `transformHtml`, `buildEnd`
- markdown-it plugin integration, dynamic routes, URL rewrites, i18n, deployment

**Handled elsewhere:**

- Vue component authoring itself — this skill covers where a component may go and what the SSR boundary demands of it, not the component model.
- Request-time behaviour — the build emits static files, so anything needing a server at request time lives outside the site.
- Content from a CMS or database at request time; a loader can read one at build time, which is a different thing.
- Design decisions behind the CSS variables — those variables are the seam, and what you set them to is not this skill's call.
- API reference generated from a machine-readable spec — that generation is upstream of the Markdown VitePress reads.

---

<patterns>

## Core patterns

### Pattern 1: Site configuration

One file, wrapped for type checking. `cleanUrls` drops `.html` from URLs, `sitemap.hostname` generates
`sitemap.xml`, `lastUpdated` reads git timestamps, and `search.provider: "local"` is search with no
service to sign up for.

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "My Docs",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://docs.example.com" },
  themeConfig: {
    nav: [{ text: "Guide", link: "/guide/" }],
    sidebar: {
      /* Pattern 2 */
    },
    search: { provider: "local" },
    editLink: { pattern: "https://github.com/org/repo/edit/main/docs/:path" },
  },
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Multi-sidebar

An array gives one sidebar for the whole site. An object keyed by path prefix gives a different sidebar
per section, and the first matching prefix wins.

```ts
sidebar: {
  "/guide/": [
    { text: "Getting Started", collapsed: false, items: [{ text: "Introduction", link: "/guide/introduction" }] },
    { text: "Advanced", collapsed: true, items: [{ text: "Data Loaders", link: "/guide/data-loading" }] },
  ],
  "/api/": [{ text: "API Reference", items: [{ text: "Config", link: "/api/config" }] }],
}
```

The trailing slash matters: `/guide` also matches `/guidelines`. Omitting `collapsed` makes a group
permanently expanded rather than collapsible.

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Data loaders

A `*.data.ts` file runs at build time and exports `data`. `createContentLoader` covers Markdown
collections; a plain object with `watch` and `load()` covers everything else.

```ts
// posts.data.ts
import { createContentLoader } from "vitepress";

export default createContentLoader("blog/posts/*.md", {
  excerpt: true,
  transform: (raw) =>
    raw
      .sort(
        (a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date),
      )
      .map(({ url, frontmatter, excerpt }) => ({
        title: frontmatter.title,
        url,
        excerpt,
      })),
});
```

```vue
<script setup>
import { data as posts } from "./posts.data";
</script>
```

`transform` is where you drop what the client does not need, which is why `includeSrc` and `render`
are opt-in.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Vue components in Markdown

`<script setup>` at the top of a `.md` file makes its imports available to that page, and page-scoped
imports code-split. Register a component globally only when many pages use it.

```markdown
<script setup>
import StatusBadge from '../components/StatusBadge.vue'
</script>

# API Reference

<StatusBadge status="stable" /> This API is production-ready.
```

```ts
// .vitepress/theme/index.ts — global registration
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("StatusBadge", StatusBadge);
  },
};
```

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Theme extension

Wrap `DefaultTheme`'s `Layout` and fill its named slots. The slot list is long enough that most
customization needs no fork.

```vue
<script setup>
import DefaultTheme from "vitepress/theme";
const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #doc-before><div class="author-banner">...</div></template>
    <template #doc-footer-before
      ><div class="feedback-widget">...</div></template
    >
  </Layout>
</template>
```

The full slot list is in [reference.md](reference.md#layout-slots).

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Build hooks

Four hooks in config, running in order: `transformPageData` per page during render,
`transformHead` per page after render, `transformHtml` per page on the final HTML string, and `buildEnd`
once, for generating extra files into `siteConfig.outDir`.

```ts
export default defineConfig({
  transformPageData(pageData) {
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      "meta",
      { property: "og:title", content: pageData.title },
    ]);
  },
  async buildEnd(siteConfig) {
    const posts = await createContentLoader("blog/*.md").load();
    // write an RSS feed or redirect map into siteConfig.outDir
  },
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 7: Markdown extensions

Containers, tabbed code groups, line highlighting and annotations, file snippets and partial includes,
all on top of standard Markdown.

````markdown
::: tip RECOMMENDATION
Containers are `info`, `tip`, `warning`, `danger` and `details`; the word after the type is the title.
:::

::: code-group

```ts [config.ts]
export default defineConfig({ title: "Docs" });
```

```js [config.js]
export default { title: "Docs" };
```

:::

<<< @/snippets/example.ts

<!--@include: ./shared/header.md-->
````

Line ranges highlight with a brace suffix on the language (`ts{2-3}`), and in-code annotations are
`// [!code focus]`, `// [!code ++]`, `// [!code --]`, `// [!code warning]` and `// [!code error]`.

Full code: [examples/core.md](examples/core.md)

### Pattern 8: markdown-it plugins

`markdown.config` receives the fully-configured markdown-it instance, with VitePress's own plugins
already registered — which is why plugins go here rather than into an instance of your own.

```ts
export default defineConfig({
  markdown: {
    lineNumbers: true,
    toc: { level: [1, 2, 3] },
    config: (md) => {
      md.use(markdownItFootnote);
    },
  },
});
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `window`, `document` or a browser-only library reached outside `onMounted` or `<ClientOnly>` — the build pre-renders every page and crashes there.
- Config anywhere but `.vitepress/config.ts` — it is not found, and nothing reports that it was looked for.
- `base` without a leading and trailing slash (`"/docs/"`) — VitePress errors.
- A loader file not ending in `.data.ts`, `.data.js`, `.data.mts` or `.data.mjs` — the `.data` suffix is what makes it a loader.
- A dead link anywhere — builds fail on them by default, and `ignoreDeadLinks: true` is a migration crutch rather than a setting to keep.
- `useData()` called outside a Vue setup context — it is a composable, not a global.
- Frontmatter `outline` given a bare number where the field takes `[2, 3]` or `'deep'`.

**Surprising behaviour:**

- `render: true` on a large `createContentLoader` collection puts every page's full HTML in the client bundle.
- Forking the default theme layout instead of filling its slots turns every VitePress upgrade into a merge.
- Fetching at runtime what a data loader could have resolved at build time pays for the same data on every visit.
- A sidebar path prefix without its trailing slash matches more than intended (`"/guide"` also matches `/guidelines`).
- Without `cleanUrls: true`, every URL carries `.html`.
- `sitemap` without `hostname` generates a sitemap of empty URLs, and `lastUpdated` needs both the config flag and real git history — in CI that means an unshallow checkout.
- A flat sidebar array where sections need different navigation gives every page the same sidebar; the object form is keyed by prefix for that reason.
- A heavy import in a globally registered component loads on every page, which is what page-scoped imports avoid.
- `<script setup>` placed after Markdown content parses unreliably — put it first.
- Dynamic routes are resolved at build time by `paths()` in a `[param].paths.ts` file; they are not request-time routes.
- Subdirectory deployments need the matching `--base` at build time.
- `createContentLoader` silently skips non-Markdown files that match its glob.

</red_flags>
