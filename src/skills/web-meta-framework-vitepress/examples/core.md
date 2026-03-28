# VitePress -- Core Pattern Examples

> Configuration, sidebar, data loaders, theme extension, markdown features, Vue in markdown, build hooks, and deployment. Reference from [SKILL.md](../SKILL.md).

**Other resources:**

- [reference.md](../reference.md) -- Config option tables, frontmatter fields, layout slots, CSS variables

---

## Site Configuration

Full production-ready config showing all commonly-used options:

```ts
// .vitepress/config.ts
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Project Docs",
  description: "Documentation for the project",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,

  // Subdirectory deployment — must start and end with /
  // base: '/docs/',

  // Source directory (relative to project root)
  // srcDir: 'docs',

  // Auto-generate sitemap.xml
  sitemap: { hostname: "https://docs.example.com" },

  // Extra <head> tags for all pages
  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { name: "theme-color", content: "#3c8772" }],
  ],

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    // math: true,  // LaTeX math support
  },

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API", link: "/api/" },
      {
        text: "v1.6",
        items: [
          { text: "Changelog", link: "/changelog" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Configuration", link: "/guide/configuration" },
          ],
        },
        {
          text: "Advanced",
          collapsed: true,
          items: [
            { text: "Data Loaders", link: "/guide/data-loaders" },
            { text: "Custom Theme", link: "/guide/custom-theme" },
            { text: "Deployment", link: "/guide/deployment" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Config", link: "/api/config" },
            { text: "Runtime", link: "/api/runtime" },
            { text: "Node API", link: "/api/node" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/org/repo" }],

    editLink: {
      pattern: "https://github.com/org/repo/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright 2024-present",
    },

    search: { provider: "local" },

    outline: { level: [2, 3], label: "On this page" },

    lastUpdated: {
      text: "Last updated",
      formatOptions: { dateStyle: "medium", timeStyle: "short" },
    },
  },
});
```

---

## Multi-Sidebar

Object-keyed sidebar gives different navigation per URL prefix. The key is a path prefix — the first matching prefix wins.

```ts
sidebar: {
  // Matches all pages under /guide/
  '/guide/': [
    {
      text: 'Essentials',
      items: [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Quick Start', link: '/guide/quick-start' },
      ],
    },
    {
      text: 'Advanced Topics',
      collapsed: true,
      items: [
        { text: 'Plugins', link: '/guide/plugins' },
        { text: 'Internationalization', link: '/guide/i18n' },
      ],
    },
  ],
  // Matches all pages under /reference/
  '/reference/': [
    {
      text: 'Reference',
      items: [
        { text: 'Site Config', link: '/reference/site-config' },
        { text: 'Theme Config', link: '/reference/theme-config' },
        { text: 'Frontmatter', link: '/reference/frontmatter' },
        { text: 'Runtime API', link: '/reference/runtime-api' },
      ],
    },
  ],
}
```

**Key details:**

- `collapsed: undefined` (omitted) = section is always expanded, not collapsible
- `collapsed: false` = section is collapsible, starts expanded
- `collapsed: true` = section is collapsible, starts collapsed
- Use `base` on a group to prefix all child links: `{ text: 'Guide', base: '/guide/', items: [{ text: 'Intro', link: 'intro' }] }`

---

## Data Loaders

### Content Loader (Markdown Collections)

`createContentLoader` builds indexes from markdown files at build time. Glob paths are relative to the project source root.

```ts
// blog/posts.data.ts
import { createContentLoader } from "vitepress";

export interface PostData {
  title: string;
  url: string;
  date: string;
  excerpt: string | undefined;
  tags: string[];
}

declare const data: PostData[];
export { data };

export default createContentLoader("blog/posts/*.md", {
  excerpt: true,
  // includeSrc: true,  // raw markdown — rarely needed on client
  // render: true,       // full HTML — WARNING: inflates bundle for large collections
  transform(rawData): PostData[] {
    return rawData
      .sort(
        (a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date),
      )
      .map(({ url, frontmatter, excerpt }) => ({
        title: frontmatter.title,
        url,
        date: frontmatter.date,
        excerpt,
        tags: frontmatter.tags ?? [],
      }));
  },
});
```

```vue
<!-- blog/index.md -->
<script setup>
import { data as posts } from "./posts.data";
</script>

<ul>
  <li v-for="post in posts" :key="post.url">
    <a :href="post.url">{{ post.title }}</a>
    <time>{{ post.date }}</time>
    <div v-html="post.excerpt" />
  </li>
</ul>
```

### Custom Data Loader (Arbitrary Data)

For non-markdown data sources (JSON, APIs, file system):

```ts
// data/team.data.ts
import fs from "node:fs";

export interface TeamMember {
  name: string;
  role: string;
  avatar: string;
}

declare const data: TeamMember[];
export { data };

export default {
  // Watch these paths for HMR in dev
  watch: ["./data/team.json"],
  async load(): Promise<TeamMember[]> {
    const raw = fs.readFileSync("./data/team.json", "utf-8");
    return JSON.parse(raw);
  },
};
```

**Key details:**

- The `watch` array takes glob patterns — data re-loads on file changes during `vitepress dev`
- Return value is serialized to JSON — only serializable data (no functions, no circular refs)
- Loader files MUST end in `.data.ts` (or `.data.js`, `.data.mts`, `.data.mjs`)
- `createContentLoader` glob paths are relative to source root, NOT the loader file

---

## Theme Extension

### Basic Extension with Global Components

```ts
// .vitepress/theme/index.ts
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import StatusBadge from "./components/StatusBadge.vue";
import ApiTable from "./components/ApiTable.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Globally registered — no import needed in .md files
    app.component("StatusBadge", StatusBadge);
    app.component("ApiTable", ApiTable);
  },
} satisfies Theme;
```

### Layout with Slots

```vue
<!-- .vitepress/theme/MyLayout.vue -->
<script setup>
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";

const { Layout } = DefaultTheme;
const { frontmatter, isDark } = useData();
</script>

<template>
  <Layout>
    <!-- Banner above doc content -->
    <template #doc-before>
      <div v-if="frontmatter.beta" class="beta-banner">
        This page documents a beta feature.
      </div>
    </template>

    <!-- Custom aside content -->
    <template #aside-outline-before>
      <div class="sponsor-banner">
        <a href="/sponsors">Support this project</a>
      </div>
    </template>

    <!-- Footer widget -->
    <template #doc-footer-before>
      <div class="page-feedback">
        Was this page helpful?
        <button>Yes</button>
        <button>No</button>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.beta-banner {
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
  margin-bottom: 16px;
}
</style>
```

Register the custom layout in the theme:

```ts
// .vitepress/theme/index.ts
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import MyLayout from "./MyLayout.vue";

export default {
  extends: DefaultTheme,
  Layout: MyLayout,
} satisfies Theme;
```

### CSS Variable Overrides

```css
/* .vitepress/theme/custom.css */

/* Brand colors */
:root {
  --vp-c-brand-1: #5b8dff;
  --vp-c-brand-2: #3a6eef;
  --vp-c-brand-3: #2557d6;
  --vp-c-brand-soft: rgba(91, 141, 255, 0.14);
}

/* Dark mode overrides */
.dark {
  --vp-c-brand-1: #7aa2ff;
  --vp-c-brand-2: #5b8dff;
  --vp-c-brand-3: #3a6eef;
}

/* Home page hero gradient */
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #5b8dff, #22d3ee);
}

/* Custom code block background */
:root {
  --vp-code-block-bg: #f8f9fa;
}
.dark {
  --vp-code-block-bg: #1e1e2e;
}
```

---

## Vue in Markdown

### Page-Scoped Components

```markdown
---
title: Feature Comparison
---

<script setup>
import { ref, computed } from 'vue'
import ComparisonTable from '../components/ComparisonTable.vue'

const showAdvanced = ref(false)
const features = computed(() =>
  showAdvanced.value ? allFeatures : allFeatures.filter(f => f.basic)
)
</script>

# {{ $frontmatter.title }}

<label>
  <input type="checkbox" v-model="showAdvanced" />
  Show advanced features
</label>

<ComparisonTable :features="features" />
```

### Using `useData()` Composable

```vue
<!-- .vitepress/theme/PageMeta.vue -->
<script setup>
import { useData } from "vitepress";

const { page, frontmatter } = useData();
</script>

<template>
  <div class="page-meta">
    <span v-if="page.lastUpdated">
      Updated: {{ new Date(page.lastUpdated).toLocaleDateString() }}
    </span>
    <span v-if="frontmatter.author"> Author: {{ frontmatter.author }} </span>
  </div>
</template>
```

### Browser-Only Components with `<ClientOnly>`

```markdown
<script setup>
import HeavyChart from '../components/HeavyChart.vue'
</script>

# Analytics Dashboard

This chart uses a browser-only charting library:

<ClientOnly>
  <HeavyChart :data="chartData" />
</ClientOnly>
```

**Why `<ClientOnly>`:** VitePress pre-renders pages at build time (SSR). Components that access `window`, `document`, `localStorage`, or browser-only libraries will crash during build without this wrapper.

---

## Markdown Extensions

### Custom Containers

```markdown
::: info
General information for the reader.
:::

::: tip BEST PRACTICE
Recommended approach with a custom title.
:::

::: warning
Something the reader should be cautious about.
:::

::: danger DO NOT
Critical warning — this will cause problems.
:::

::: details Click to see implementation
Hidden content that expands on click.

Supports **full markdown** inside, including code blocks.
:::
```

### Code Groups (Tabbed)

````markdown
::: code-group

```ts [composable.ts]
import { ref } from "vue";

export function useCounter() {
  const count = ref(0);
  const increment = () => count.value++;
  return { count, increment };
}
```

```ts [usage.vue]
<script setup>
import { useCounter } from './composable'
const { count, increment } = useCounter()
</script>
```

:::
````

### Code Block Annotations

````ts
// Line highlighting: ```ts{1,3-5}
// Focus: single line draws attention
const important = true; // [!code focus]

// Diff annotations
const old = "removed"; // [!code --]
const updated = "added"; // [!code ++]

// Diagnostic annotations
const risky = eval("code"); // [!code warning]
const broken = undefined.prop; // [!code error]
````

### File Includes and Snippets

```markdown
<!-- Include entire markdown file -->
<!--@include: ./shared/prerequisites.md-->

<!-- Include specific line range (lines 5-15) -->
<!--@include: ./shared/setup.md{5,15}-->

<!-- Import code snippet from file -->

<<< @/snippets/config-example.ts

<!-- Import with line highlighting -->

<<< @/snippets/config-example.ts{2-4}

<!-- Import specific region (marked with #region in source) -->

<<< @/snippets/config-example.ts#setup
```

---

## Build Hooks

### OG Meta Tags via `transformPageData`

```ts
// .vitepress/config.ts
export default defineConfig({
  transformPageData(pageData) {
    pageData.frontmatter.head ??= [];

    pageData.frontmatter.head.push(
      ["meta", { property: "og:title", content: pageData.title }],
      ["meta", { property: "og:description", content: pageData.description }],
      [
        "meta",
        {
          property: "og:url",
          content: `https://docs.example.com/${pageData.relativePath.replace(/\.md$/, "")}`,
        },
      ],
    );
  },
});
```

### Generating Files at Build Time

```ts
import { defineConfig, createContentLoader } from "vitepress";
import { writeFileSync } from "node:fs";
import path from "node:path";

export default defineConfig({
  async buildEnd(siteConfig) {
    // Generate RSS feed, redirect map, or other files
    const posts = await createContentLoader("blog/posts/*.md").load();

    const feed = posts.map((post) => ({
      title: post.frontmatter.title,
      url: `https://docs.example.com${post.url}`,
      date: post.frontmatter.date,
    }));

    writeFileSync(
      path.join(siteConfig.outDir, "feed.json"),
      JSON.stringify(feed, null, 2),
    );
  },
});
```

**Hook execution order:**

1. `transformPageData` -- per page, during render (access/modify page data and frontmatter)
2. `transformHead` -- per page, after render (return additional head tag arrays)
3. `transformHtml` -- per page, final HTML string (last-chance string manipulation)
4. `buildEnd` -- once, after all pages built (generate extra files in `siteConfig.outDir`)

---

## Home Page

```markdown
---
layout: home

hero:
  name: "Project Name"
  text: "A VitePress-powered docs site"
  tagline: Fast, flexible documentation
  image:
    src: /logo-large.svg
    alt: Project Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/org/repo

features:
  - icon: "\u26A1"
    title: Fast
    details: Built on Vite — instant dev server and lightning builds.
  - icon: "\u270F\uFE0F"
    title: Markdown-First
    details: Write content in Markdown with Vue component support.
    link: /guide/markdown
    linkText: Learn more
  - icon: "\uD83C\uDFA8"
    title: Customizable
    details: Extend the default theme or build your own from scratch.
---
```

**Key details:**

- `layout: home` activates the hero + features layout
- `hero.actions[].theme` accepts `'brand'` (primary color) or `'alt'` (secondary style)
- `features[].link` makes the entire card clickable
- Content below the frontmatter appears after the features section

---

## Internationalization (i18n)

```ts
export default defineConfig({
  locales: {
    root: {
      label: "English",
      lang: "en-US",
    },
    zh: {
      label: "Chinese",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: {
        nav: [{ text: "Guide", link: "/zh/guide/" }],
        sidebar: {
          "/zh/guide/": [
            {
              text: "Introduction",
              items: [{ text: "What is VitePress", link: "/zh/guide/" }],
            },
          ],
        },
      },
    },
  },
});
```

**Directory structure for i18n:**

```
docs/
├── guide/
│   └── index.md          # English
├── zh/
│   └── guide/
│       └── index.md      # Chinese
└── .vitepress/
    └── config.ts
```

**Key details:**

- `root` locale serves from `/`, other locales from `/{locale}/`
- Each locale can override `themeConfig` (nav, sidebar, labels)
- `lang` sets the HTML `lang` attribute for that locale's pages

---

## markdown-it Plugin Integration

```ts
import { defineConfig } from "vitepress";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";

export default defineConfig({
  markdown: {
    lineNumbers: true,
    image: { lazyLoading: true },
    toc: { level: [1, 2, 3] },
    config: (md) => {
      // md is the fully-configured markdown-it instance
      // VitePress plugins are already registered at this point
      md.use(markdownItFootnote);
      md.use(markdownItTaskLists, { enabled: true });
    },
  },
});
```

**Key detail:** The `md` instance passed to `config()` already has VitePress's own plugins registered (containers, code groups, line highlighting, etc.). Add your plugins here — do not create a separate markdown-it instance.

---

## Dynamic Routes

Dynamic routes generate pages from data at build time. They use bracket syntax in filenames.

```
docs/
├── packages/
│   └── [pkg].md          # Template
│   └── [pkg].paths.ts    # Data source
```

```ts
// packages/[pkg].paths.ts
export default {
  async paths() {
    return [
      { params: { pkg: "core" }, content: "# Core Package\n\nCore utilities." },
      {
        params: { pkg: "cli" },
        content: "# CLI Package\n\nCommand-line tool.",
      },
    ];
  },
};
```

```markdown
## <!-- packages/[pkg].md -->

## title: "Package: {{ $params.pkg }}"

# {{ $params.pkg }}

This page was generated dynamically.
```

**Key details:**

- `paths()` runs at build time only — this produces static pages, not server routes
- `content` property in path objects injects raw markdown into the template
- Access params via `$params` in markdown or `useData().params` in Vue
- Multiple params supported: `[org]-[repo].md` with `{ params: { org: 'vue', repo: 'core' } }`

---

## URL Rewrites

Remap source file paths to different URL paths without changing directory structure:

```ts
export default defineConfig({
  rewrites: {
    // packages/pkg-a/docs/guide.md -> /pkg-a/guide
    "packages/:pkg/docs/:page": ":pkg/:page",
    // Move a page without breaking old structure
    "old-section/:page": "new-section/:page",
  },
});
```

**Key details:**

- Rewrites affect the generated URL, not the source file location
- Sidebar and nav links should use the rewritten (output) paths
- `:param` syntax in rewrite keys acts as a wildcard

---

## Deployment

### Package.json Scripts

```jsonc
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs",
  },
  "devDependencies": {
    "vitepress": "^1.6.3",
    "vue": "^3.5.13",
  },
}
```

### GitHub Pages (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy Docs
on:
  push:
    branches: [main]

permissions:
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for lastUpdated
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Key detail:** `fetch-depth: 0` is required for git-based `lastUpdated` timestamps to work correctly. Without it, all pages show the CI run time.
