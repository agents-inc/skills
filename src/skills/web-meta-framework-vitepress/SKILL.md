---
name: web-meta-framework-vitepress
description: VitePress 1.x — Vue-powered static site generator for documentation sites, built on Vite
---

# VitePress

> **Quick Guide:** VitePress is a Vue-powered static site generator built on Vite, designed for documentation. All config lives in `.vitepress/config.ts`. Use `defineConfig()` for type safety. Sidebar accepts arrays (single) or objects keyed by path prefix (multi-sidebar). Data loaders (`*.data.ts`) run at build time and ship only serialized results to the client. Vue components work directly in Markdown via `<script setup>`. Extend the default theme through layout slots and CSS variables rather than forking it.
>
> **Current stable version:** VitePress 1.6.x (2026). Uses Vite 6+ and Vue 3.5+.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `.vitepress/config.ts` with `defineConfig()` for all site configuration — VitePress does not support config outside `.vitepress/`)**

**(You MUST use data loader files (`*.data.ts`) for build-time data — never fetch data at runtime in SSR-unsafe ways)**

**(You MUST handle SSR compatibility — no bare `window`, `document`, or browser APIs outside `onMounted` or `<ClientOnly>`)**

**(You MUST extend the default theme via `extends: DefaultTheme` and layout slots — do not fork the entire theme)**

**(You MUST use `createContentLoader()` for markdown collection pages — it handles caching, watching, and frontmatter extraction)**

</critical_requirements>

---

**Auto-detection:** VitePress, vitepress, .vitepress/config, defineConfig vitepress, createContentLoader, vitepress/theme, DefaultTheme, useData, useSidebar, markdown-it plugin vitepress, vitepress deploy

**When to use:**

- Building documentation sites from Markdown files
- Creating blog index/archive pages with `createContentLoader`
- Customizing the default theme (nav, sidebar, layout slots, CSS variables)
- Adding Vue components to Markdown pages
- Configuring markdown-it plugins for extended syntax
- Setting up multi-sidebar navigation by path prefix
- Generating sitemaps and other build artifacts with build hooks
- Internationalization (i18n) with multi-locale routing

**When NOT to use:**

- Full web applications with complex client-side routing (use a web framework)
- Sites requiring server-side runtime logic (VitePress is static output)
- Projects already using Docusaurus, Nextra, or Starlight (those are separate ecosystems)
- Content that needs a CMS backend (VitePress reads Markdown files at build time)
- API documentation from OpenAPI specs (use a dedicated OpenAPI tool)

---

<patterns>

## Core Patterns

### Pattern 1: Site Configuration

All configuration lives in `.vitepress/config.ts`. Use `defineConfig()` for type checking and autocompletion.

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "My Docs",
  description: "Documentation site",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://docs.example.com" },

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API", link: "/api/" },
    ],
    sidebar: {
      /* see Pattern 2 */
    },
    socialLinks: [{ icon: "github", link: "https://github.com/org/repo" }],
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/org/repo/edit/main/docs/:path",
    },
  },
});
```

**Why good:** `cleanUrls: true` removes `.html` extensions, `sitemap` auto-generates sitemap.xml, `lastUpdated` reads git timestamps, `search.provider: 'local'` enables built-in search with zero config

> **Full examples:** See [examples/core.md](examples/core.md) for complete config, multi-sidebar, i18n, and markdown config.

---

### Pattern 2: Multi-Sidebar

Sidebar can be an array (global) or an object keyed by URL path prefix (multi-sidebar). Each section supports `collapsed` for expandable groups.

```ts
sidebar: {
  '/guide/': [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Introduction', link: '/guide/introduction' },
        { text: 'Installation', link: '/guide/installation' },
      ],
    },
    {
      text: 'Advanced',
      collapsed: true,
      items: [
        { text: 'Data Loaders', link: '/guide/data-loading' },
        { text: 'Deployment', link: '/guide/deploy' },
      ],
    },
  ],
  '/api/': [
    {
      text: 'API Reference',
      items: [
        { text: 'Config', link: '/api/config' },
        { text: 'Runtime API', link: '/api/runtime' },
      ],
    },
  ],
}
```

**Why good:** Each path prefix gets its own sidebar navigation, `collapsed: true` keeps dense sidebars scannable

**Common mistake:** Using `/guide` without trailing slash — VitePress matches path prefixes, so `/guide/` is more precise than `/guide` (which would also match `/guidelines`)

---

### Pattern 3: Data Loaders

Data loaders (`*.data.ts` files) execute at build time. Results are serialized and shipped to client components. Use `createContentLoader` for Markdown collections, custom `load()` for arbitrary data.

```ts
// posts.data.ts
import { createContentLoader } from "vitepress";

export default createContentLoader("blog/posts/*.md", {
  excerpt: true,
  transform(rawData) {
    return rawData
      .sort(
        (a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date),
      )
      .map(({ url, frontmatter, excerpt }) => ({
        title: frontmatter.title,
        url,
        date: frontmatter.date,
        excerpt,
      }));
  },
});
```

```vue
<!-- blog/index.md — consume in Vue -->
<script setup>
import { data as posts } from "./posts.data";
</script>

<template>
  <article v-for="post in posts" :key="post.url">
    <h2>
      <a :href="post.url">{{ post.title }}</a>
    </h2>
    <time>{{ post.date }}</time>
    <div v-html="post.excerpt" />
  </article>
</template>
```

**Why good:** `createContentLoader` handles file watching in dev, caching by mtime, frontmatter extraction, and optional HTML rendering. The `transform` strips unnecessary data so only what's needed reaches the client bundle.

**Key options:** `includeSrc` (raw markdown), `render` (full HTML), `excerpt` (content above first `---`). Only enable what you need — `render: true` on hundreds of pages inflates the client bundle.

> **Full examples:** See [examples/core.md](examples/core.md#data-loaders) for custom loaders and `buildEnd` usage.

---

### Pattern 4: Vue Components in Markdown

Vue components work directly in `.md` files. Use `<script setup>` for page-scoped imports. Register global components in the theme for cross-page reuse.

```markdown
<script setup>
import StatusBadge from '../components/StatusBadge.vue'
</script>

# API Reference

<StatusBadge status="stable" /> This API is production-ready.
```

```ts
// .vitepress/theme/index.ts — global registration
import DefaultTheme from "vitepress/theme";
import StatusBadge from "../components/StatusBadge.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("StatusBadge", StatusBadge);
  },
};
```

**Why good:** Page-scoped imports enable code-splitting (only loaded on pages that use them). Global registration is for components used across many pages.

**SSR rule:** Components that access browser APIs must be wrapped in `<ClientOnly>` or guarded with `onMounted`. VitePress pre-renders all pages at build time.

---

### Pattern 5: Theme Extension

Extend the default theme through layout slots and CSS variables. Do not fork the entire layout.

```vue
<!-- .vitepress/theme/MyLayout.vue -->
<script setup>
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
</script>

<template>
  <Layout>
    <template #doc-before>
      <div v-if="frontmatter.author" class="author-banner">
        By {{ frontmatter.author }}
      </div>
    </template>
    <template #doc-footer-before>
      <div class="feedback-widget">Was this page helpful?</div>
    </template>
  </Layout>
</template>
```

**Available layout slots:** `nav-bar-title-before`, `nav-bar-title-after`, `nav-bar-content-before`, `nav-bar-content-after`, `nav-screen-content-before`, `nav-screen-content-after`, `sidebar-nav-before`, `sidebar-nav-after`, `aside-top`, `aside-bottom`, `aside-outline-before`, `aside-outline-after`, `doc-before`, `doc-after`, `doc-footer-before`, `doc-top`, `doc-bottom`, `home-hero-before`, `home-hero-after`, `home-features-before`, `home-features-after`, `not-found`

> **Full examples:** See [examples/core.md](examples/core.md#theme-extension) for CSS variable overrides and custom theme setup.

---

### Pattern 6: Build Hooks

Build hooks in config transform page data, inject head tags, or generate files at build time.

```ts
export default defineConfig({
  async transformPageData(pageData) {
    // Add computed data available via useData()
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      "meta",
      { property: "og:title", content: pageData.title },
    ]);
  },

  async buildEnd(siteConfig) {
    // Generate files after build — RSS feeds, redirects, etc.
    const posts = await createContentLoader("blog/*.md").load();
    // write to siteConfig.outDir
  },
});
```

**Available hooks:** `transformPageData` (per-page, access frontmatter + route), `transformHead` (per-page, return head tags array), `transformHtml` (per-page, modify rendered HTML string), `buildEnd` (once after build, generate extra files)

---

### Pattern 7: Markdown Extensions

VitePress extends standard Markdown with containers, code groups, line highlighting, and code snippets.

````markdown
::: tip RECOMMENDATION
Use `createContentLoader` for blog index pages.
:::

::: code-group

```ts [config.ts]
export default defineConfig({ title: "Docs" });
```
````

```js [config.js]
export default { title: "Docs" };
```

:::

<!-- Line highlighting -->

```ts{2-3}
export default {
  title: 'Highlighted',    // highlighted
  description: 'Also',     // highlighted
}
```

<!-- Import code from file -->

<<< @/snippets/example.ts

<!-- Include partial markdown -->
<!--@include: ./shared/header.md-->

````

**Container types:** `info`, `tip`, `warning`, `danger`, `details` (expandable). Customize labels in `markdown.container` config.

**Code annotations:** `// [!code focus]`, `// [!code ++]`, `// [!code --]`, `// [!code warning]`, `// [!code error]`

> **Full reference:** See [examples/core.md](examples/core.md#markdown-extensions) for all code block features and custom container labels.

---

### Pattern 8: markdown-it Plugin Integration

VitePress uses markdown-it internally. Add plugins via `markdown.config`.

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  markdown: {
    // Built-in options
    lineNumbers: true,
    toc: { level: [1, 2, 3] },
    // Add custom plugins
    config: (md) => {
      md.use(require('markdown-it-footnote'))
    },
  },
})
````

**Why this matters:** Plugins added via `markdown.config` get the fully-configured markdown-it instance with VitePress's own plugins already registered. Do not create a separate markdown-it instance.

</patterns>

---

## Examples

- [Core Patterns](examples/core.md) -- Config, sidebar, data loaders, theme extension, markdown features, frontmatter, deployment

**Other resources:**

- [Quick Reference](reference.md) -- Config options, frontmatter fields, CLI commands, CSS variables, layout slots

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Accessing `window`, `document`, or browser-only APIs outside `onMounted` or `<ClientOnly>` (SSR will crash at build time)
- Using `render: true` in `createContentLoader` for large collections (inflates client bundle with full HTML of every page)
- Forking the default theme layout instead of using layout slots (breaks on VitePress upgrades)
- Placing config outside `.vitepress/config.ts` (VitePress will not find it)
- Using runtime data fetching (`fetch` in components) for data that should be loaded at build time via data loaders

**Medium Priority Issues:**

- Sidebar path prefix without trailing slash (`'/guide'` matches `/guidelines` too)
- Not enabling `cleanUrls: true` (results in `.html` extensions in all URLs)
- Forgetting `sitemap.hostname` (sitemap generates with empty URLs)
- Not setting `lastUpdated: true` in site config AND having git history (feature is opt-in)
- Importing heavy libraries in global components when they are only used on one page (defeats code-splitting)

**Common Mistakes:**

- Using `themeConfig.sidebar` as a flat array when different sections need different sidebars (use object keyed by path prefix)
- Not running `vitepress build` with the correct `--base` for subdirectory deployments
- Expecting dynamic routes to work like a web framework — VitePress generates static pages, dynamic routes are resolved at build time via `paths()` in `[param].paths.ts`
- Putting `<script setup>` after content in Markdown (must be before any Markdown content for reliable parsing)
- Using `useData()` outside of Vue setup context (it is a composable, not a global function)

**Gotchas & Edge Cases:**

- `createContentLoader` only processes Markdown files — non-`.md` files matching the glob are silently skipped
- Data loader files must end in `.data.ts` (or `.data.js`, `.data.mts`, `.data.mjs`) — the `.data` suffix is required
- Frontmatter `outline` accepts `[2, 3]` (array) or `'deep'` (string) — numbers alone are invalid
- `base` config must start and end with `/` (e.g., `'/docs/'`) or VitePress will error
- Dead links cause build failures by default — use `ignoreDeadLinks: true` only temporarily during migration

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `.vitepress/config.ts` with `defineConfig()` for all site configuration)**

**(You MUST use data loader files (`*.data.ts`) for build-time data — never fetch data at runtime in SSR-unsafe ways)**

**(You MUST handle SSR compatibility — no bare `window`, `document`, or browser APIs outside `onMounted` or `<ClientOnly>`)**

**(You MUST extend the default theme via `extends: DefaultTheme` and layout slots — do not fork the entire theme)**

**(You MUST use `createContentLoader()` for markdown collection pages — it handles caching, watching, and frontmatter extraction)**

**Failure to follow these rules will cause SSR build failures, bloated bundles, and broken upgrades.**

</critical_reminders>
