# Docusaurus -- MDX & Content

> MDX features, admonitions, tabs, code blocks, assets, and blog plugin configuration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Site configuration, sidebars, navbar, custom pages
- [customization.md](customization.md) -- Swizzling, CSS variables, versioning, i18n, deployment

---

## MDX Fundamentals

Docusaurus uses MDX v3 — Markdown that supports JSX. By default, both `.md` and `.mdx` files are processed with MDX (JSX works in both). Use `.mdx` for clarity when a file uses JSX imports or components.

### Importing Components in MDX

```mdx
---
title: My Guide
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme/CodeBlock";

Imports must be at the top of the file, after front matter, with a blank line separating them from the content.
```

**Key gotcha:** MDX v3 is strict about syntax. These will cause build errors:

```mdx
<!-- BAD: bare curly braces -->

The function returns {value}.

<!-- GOOD: escape curly braces -->

The function returns \{value\}.

<!-- BAD: unclosed HTML tag -->

Use the <br> tag for line breaks.

<!-- GOOD: self-closing HTML tag -->

Use the <br /> tag for line breaks.

<!-- BAD: HTML comment in MDX -->
<!-- This is a comment -->

<!-- GOOD: use JSX comments or remove -->

{/* This is a comment */}
```

---

## Admonitions

```mdx
:::note
Supplementary information the reader might want to know.
:::

:::tip[Performance Tip]
Admonitions support custom titles using bracket syntax.
:::

:::info
Background context or additional detail.
:::

:::warning
Potential issues, gotchas, or deprecation notices.
:::

:::danger
Breaking changes, security issues, or critical errors.
:::
```

### Nested Admonitions

```mdx
:::warning
Watch out for this issue.

:::tip
But here is a workaround.
:::

:::
```

Use additional colons for nesting depth: `::::warning` wrapping `:::tip`.

---

## Tabs

### Basic Tabs

````mdx
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash npm install my-package ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash yarn add my-package ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash pnpm add my-package ```
  </TabItem>
</Tabs>
````

### Synced Tabs

Use `groupId` to sync tab selection across all `<Tabs>` instances on the page:

```mdx
<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm">
    npm install
  </TabItem>
  <TabItem value="yarn" label="yarn">
    yarn add
  </TabItem>
</Tabs>

<!-- Later on the same page, this stays in sync -->

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm">
    npm run build
  </TabItem>
  <TabItem value="yarn" label="yarn">
    yarn build
  </TabItem>
</Tabs>
```

**Key gotcha:** `groupId` syncs tabs within a page load. Cross-page persistence requires `localStorage` and is not built in — the `queryString` option can persist via URL parameters.

---

## Code Blocks

### Title and Line Highlighting

````mdx
```javascript title="docusaurus.config.js"
export default {
  // highlight-next-line
  title: "My Site",
  tagline: "Important tagline",
};
```
````

### Line Range Highlighting

````mdx
```javascript title="config.js"
export default {
  // highlight-start
  title: "My Site",
  url: "https://example.com",
  // highlight-end
  baseUrl: "/",
};
```
````

### Magic Comments

| Comment                  | Effect                   |
| ------------------------ | ------------------------ |
| `// highlight-next-line` | Highlights the next line |
| `// highlight-start`     | Start highlighted block  |
| `// highlight-end`       | End highlighted block    |

### Interactive Code Blocks

````mdx
```jsx live
function Clock() {
  const [date, setDate] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <p>Current time: {date.toLocaleTimeString()}</p>;
}
```
````

````

**Requires:** `@docusaurus/theme-live-codeblock` plugin.

---

## Assets and Images

### Static Assets

Files in `static/` are served at the site root. Reference them with absolute paths:

```mdx
![Logo](/img/logo.png)
````

### Co-located Assets (Recommended)

Place images alongside the docs that use them and use `require()`:

```mdx
![Architecture diagram](./architecture.png)
```

Or use the `require()` syntax for dynamic resolution:

```mdx
<img
  src={require("./architecture.png").default}
  alt="Architecture"
  width="600"
/>
```

**Why co-located is better:** Assets move with docs during versioning, broken references cause build errors instead of silent 404s, and images are optimized by the build pipeline.

### SVGs as Components

```mdx
import MyDiagram from "./my-diagram.svg";

<MyDiagram title="System Architecture" width="100%" />
```

Requires `@docusaurus/plugin-svgr` (included in preset-classic by default).

---

## Blog Plugin Configuration

### Blog Setup in Preset

```javascript
// In preset-classic options
blog: {
  path: 'blog',
  routeBasePath: 'blog',
  showReadingTime: true,
  blogSidebarCount: 'ALL',
  blogSidebarTitle: 'All Posts',
  editUrl: 'https://github.com/my-org/my-project/edit/main/docs-site/',
  postsPerPage: 10,
  blogListComponent: '@theme/BlogListPage',
  blogPostComponent: '@theme/BlogPostPage',
  blogTagsListComponent: '@theme/BlogTagsListPage',
  blogTagsPostsComponent: '@theme/BlogTagsPostsPage',
  feedOptions: {
    type: 'all',
    copyright: `Copyright ${new Date().getFullYear()} My Org`,
  },
},
```

### Blog Authors

Define authors in `blog/authors.yml` (not in `docusaurus.config.js`):

```yaml
# blog/authors.yml
alice:
  name: Alice
  title: Lead Developer
  url: https://github.com/alice
  image_url: https://github.com/alice.png
  socials:
    github: alice
    twitter: alice_dev

bob:
  name: Bob
  title: Documentation Lead
  url: https://github.com/bob
  image_url: https://github.com/bob.png
```

Reference in blog post front matter:

```markdown
---
title: Our New Feature
authors: [alice, bob]
tags: [release, feature]
date: 2026-03-15
---

Blog content here.

<!-- truncate -->

Content after truncate appears only on the full post page, not in listings.
```

### Blog Post File Naming

Blog posts can use date-based naming or front matter dates:

```
blog/
  2026-03-15-new-feature.md        # Date from filename
  2026-03-20-announcement/         # Date from directory name
    index.md
    screenshot.png                  # Co-located asset
  future-roadmap.md                 # Date from front matter
```

---

## Remark and Rehype Plugins

Extend MDX processing with custom plugins:

```javascript
// docusaurus.config.js
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default {
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
      },
    ],
  ],
  stylesheets: [
    {
      href: "https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css",
      type: "text/css",
    },
  ],
};
```

Then in MDX:

```mdx
The formula $E = mc^2$ renders inline, and display math works too:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

---

## Linking Between Docs

### Relative File Links (Recommended)

```mdx
See the [Configuration Guide](./configuration.md) for details.
See the [API section](../api/overview.md) for the full reference.
```

**Why relative links:** Docusaurus validates them at build time — broken links cause build failures. URL-based links (`/docs/configuration`) are not validated.

### Named Anchors

```mdx
## My Section {#custom-anchor-id}

Link to it: [Jump to section](#custom-anchor-id)
```

Use `{#id}` syntax to set explicit heading IDs. Without it, Docusaurus auto-generates IDs from heading text (which can break when you rename headings).
