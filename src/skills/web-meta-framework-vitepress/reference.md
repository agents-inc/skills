# VitePress Quick Reference

> CLI commands, config options, frontmatter fields, CSS variables, and layout slots for VitePress 1.6.x. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for practical examples.

---

## CLI Commands

| Command             | Purpose                            | Key Flags                    |
| ------------------- | ---------------------------------- | ---------------------------- |
| `vitepress dev`     | Start dev server                   | `--port`, `--host`, `--open` |
| `vitepress build`   | Build for production               | `--base`, `--outDir`         |
| `vitepress preview` | Preview production build locally   | `--port`, `--host`           |
| `vitepress init`    | Scaffold new project interactively |                              |

---

## Site Config Options

| Option            | Type                                                | Default           | Purpose                                     |
| ----------------- | --------------------------------------------------- | ----------------- | ------------------------------------------- |
| `title`           | `string`                                            | `'VitePress'`     | Site title (nav bar + `<title>` suffix)     |
| `description`     | `string`                                            | `''`              | Site meta description                       |
| `base`            | `string`                                            | `'/'`             | Base URL path (must start and end with `/`) |
| `cleanUrls`       | `boolean`                                           | `false`           | Remove `.html` from URLs                    |
| `srcDir`          | `string`                                            | `'.'`             | Source directory relative to project root   |
| `outDir`          | `string`                                            | `.vitepress/dist` | Build output directory                      |
| `lang`            | `string`                                            | `'en-US'`         | HTML `lang` attribute                       |
| `lastUpdated`     | `boolean`                                           | `false`           | Enable git-based last updated timestamps    |
| `head`            | `HeadConfig[]`                                      | `[]`              | Extra `<head>` tags for all pages           |
| `ignoreDeadLinks` | `boolean \| 'localhostLinks'`                       | `false`           | Suppress dead link build errors             |
| `appearance`      | `boolean \| 'dark' \| 'force-dark' \| 'force-auto'` | `true`            | Dark mode toggle behavior                   |
| `markdown`        | `MarkdownOptions`                                   | `{}`              | markdown-it and extension config            |
| `vite`            | `UserConfig`                                        | `{}`              | Raw Vite config (merged)                    |
| `vue`             | `Options`                                           | `{}`              | `@vitejs/plugin-vue` options                |
| `sitemap`         | `{ hostname: string }`                              | `undefined`       | Auto-generate sitemap.xml                   |
| `mpa`             | `boolean`                                           | `false`           | MPA mode (no client-side hydration)         |
| `metaChunk`       | `boolean`                                           | `false`           | Extract page metadata to separate chunk     |
| `rewrites`        | `Record<string, string>`                            | `{}`              | Source-to-URL path rewriting                |

---

## Theme Config Options (`themeConfig`)

| Option             | Type                                                            | Purpose                                           |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------- |
| `logo`             | `string \| { src: string; alt?: string }`                       | Nav bar logo                                      |
| `siteTitle`        | `string \| false`                                               | Override site title in nav (false hides it)       |
| `nav`              | `NavItem[]`                                                     | Top navigation links and dropdowns                |
| `sidebar`          | `Sidebar`                                                       | Sidebar config — array (global) or object (multi) |
| `aside`            | `boolean \| 'left'`                                             | Show aside (outline) container                    |
| `outline`          | `Outline \| number \| [number, number] \| 'deep' \| false`      | Table of contents heading levels                  |
| `socialLinks`      | `SocialLink[]`                                                  | Social icons in nav bar                           |
| `footer`           | `{ message?: string; copyright?: string }`                      | Site footer                                       |
| `editLink`         | `{ pattern: string; text?: string }`                            | "Edit this page" link (`:path` placeholder)       |
| `lastUpdated`      | `{ text?: string; formatOptions?: Intl.DateTimeFormatOptions }` | Last updated label formatting                     |
| `search`           | `{ provider: 'local' \| 'algolia'; options?: object }`          | Search configuration                              |
| `docFooter`        | `{ prev?: string; next?: string }`                              | Prev/next navigation labels                       |
| `carbonAds`        | `{ code: string; placement: string }`                           | Carbon ads integration                            |
| `externalLinkIcon` | `boolean`                                                       | Show icon on external links                       |
| `i18nRouting`      | `boolean`                                                       | Enable locale-based routing                       |
| `returnToTopLabel` | `string`                                                        | Mobile "return to top" button text                |

---

## Sidebar Types

```ts
// Global sidebar — same for all pages
type Sidebar = SidebarItem[];

// Multi-sidebar — different sidebar per path prefix
type Sidebar = { [path: string]: SidebarItem[] };

interface SidebarItem {
  text?: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean; // undefined = not collapsible, true/false = collapsible
  base?: string; // prepend to all child links
  rel?: string; // link rel attribute
  target?: string; // link target attribute
  docFooterText?: string; // custom footer text for this item
}
```

---

## Frontmatter Options

| Field           | Type                                                | Default              | Purpose                                 |
| --------------- | --------------------------------------------------- | -------------------- | --------------------------------------- |
| `title`         | `string`                                            | First `# heading`    | Page title                              |
| `titleTemplate` | `string \| boolean`                                 | Site `titleTemplate` | `<title>` format (`:title` placeholder) |
| `description`   | `string`                                            | Site description     | Page meta description                   |
| `layout`        | `'doc' \| 'home' \| 'page'`                         | `'doc'`              | Page layout                             |
| `navbar`        | `boolean`                                           | `true`               | Show navigation bar                     |
| `sidebar`       | `boolean`                                           | `true`               | Show sidebar                            |
| `aside`         | `boolean \| 'left'`                                 | `true`               | Show aside (outline)                    |
| `outline`       | `number \| [number, number] \| 'deep' \| false`     | Site config          | Override outline levels                 |
| `lastUpdated`   | `boolean \| Date`                                   | Site config          | Show/override last updated              |
| `editLink`      | `boolean`                                           | Site config          | Show edit link                          |
| `footer`        | `boolean`                                           | `true`               | Show footer                             |
| `pageClass`     | `string`                                            | `undefined`          | Add class to `.vp-doc` div              |
| `search`        | `boolean`                                           | `true`               | Include page in search index            |
| `head`          | `HeadConfig[]`                                      | `[]`                 | Extra `<head>` tags for this page       |
| `prev`          | `string \| { text: string; link: string } \| false` | Auto                 | Previous page link                      |
| `next`          | `string \| { text: string; link: string } \| false` | Auto                 | Next page link                          |

### Home Page Frontmatter

| Field          | Type                                                                 | Purpose           |
| -------------- | -------------------------------------------------------------------- | ----------------- |
| `hero.name`    | `string`                                                             | Main hero heading |
| `hero.text`    | `string`                                                             | Hero subtitle     |
| `hero.tagline` | `string`                                                             | Hero description  |
| `hero.image`   | `{ src: string; alt?: string }`                                      | Hero image        |
| `hero.actions` | `{ text: string; link: string; theme?: 'brand' \| 'alt' }[]`         | CTA buttons       |
| `features`     | `{ title: string; details: string; icon?: string; link?: string }[]` | Feature cards     |

---

## Runtime API

| API              | Purpose                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `useData()`      | Access `site`, `page`, `theme`, `frontmatter`, `title`, `description`, `lang`, `isDark`, `localeIndex` |
| `useRoute()`     | Access current route (`path`, `data`, `component`)                                                     |
| `useRouter()`    | Programmatic navigation (`go`, `onBeforeRouteChange`, `onAfterRouteChanged`)                           |
| `withBase(path)` | Prepend `base` to a path                                                                               |
| `<Content />`    | Render page content in custom layouts                                                                  |
| `<ClientOnly>`   | Render children only on client side (skip SSR)                                                         |

---

## Data Loader API

```ts
// createContentLoader — for Markdown file collections
createContentLoader(pattern: string, options?: {
  includeSrc?: boolean   // include raw markdown
  render?: boolean       // include rendered HTML
  excerpt?: boolean      // include excerpt (above first ---)
  globOptions?: object   // fast-glob options
  transform?: (data: ContentData[]) => any  // post-process
})

// Custom loader — for arbitrary data
export default defineLoader({
  watch: string[]    // glob patterns to watch in dev
  async load() {     // runs at build time
    return data      // serialized to client
  }
})
```

---

## CSS Variable Categories

Override in `.vitepress/theme/custom.css` under `:root`.

| Category            | Example Variables                                     | Purpose                |
| ------------------- | ----------------------------------------------------- | ---------------------- |
| Colors - Brand      | `--vp-c-brand-1`, `--vp-c-brand-2`, `--vp-c-brand-3`  | Primary accent color   |
| Colors - Background | `--vp-c-bg`, `--vp-c-bg-soft`, `--vp-c-bg-alt`        | Page backgrounds       |
| Colors - Text       | `--vp-c-text-1`, `--vp-c-text-2`, `--vp-c-text-3`     | Text hierarchy         |
| Colors - Semantic   | `--vp-c-tip-1`, `--vp-c-warning-1`, `--vp-c-danger-1` | Container/badge colors |
| Layout              | `--vp-layout-max-width`, `--vp-sidebar-width`         | Page dimensions        |
| Code                | `--vp-code-block-bg`, `--vp-code-color`               | Code block styling     |
| Nav                 | `--vp-nav-height`                                     | Navigation bar height  |
| Home                | `--vp-home-hero-name-color`                           | Home page hero styling |

**Dark mode:** Variables under `.dark` selector override light-mode values automatically.

---

## Layout Slots

Available when using `<Layout>` from `DefaultTheme` in a custom layout:

| Slot                        | Location                   |
| --------------------------- | -------------------------- |
| `layout-top`                | Above everything           |
| `layout-bottom`             | Below everything           |
| `nav-bar-title-before`      | Before nav title           |
| `nav-bar-title-after`       | After nav title            |
| `nav-bar-content-before`    | Before nav content area    |
| `nav-bar-content-after`     | After nav content area     |
| `nav-screen-content-before` | Before mobile nav content  |
| `nav-screen-content-after`  | After mobile nav content   |
| `sidebar-nav-before`        | Before sidebar navigation  |
| `sidebar-nav-after`         | After sidebar navigation   |
| `aside-top`                 | Top of aside container     |
| `aside-bottom`              | Bottom of aside container  |
| `aside-outline-before`      | Before outline in aside    |
| `aside-outline-after`       | After outline in aside     |
| `doc-before`                | Before doc content         |
| `doc-after`                 | After doc content          |
| `doc-top`                   | Top of doc content area    |
| `doc-bottom`                | Bottom of doc content area |
| `doc-footer-before`         | Before doc footer          |
| `home-hero-before`          | Before home hero           |
| `home-hero-after`           | After home hero            |
| `home-hero-image`           | Inside hero image slot     |
| `home-hero-info-before`     | Before hero info           |
| `home-hero-info`            | Inside hero info           |
| `home-hero-info-after`      | After hero info            |
| `home-hero-actions-after`   | After hero action buttons  |
| `home-features-before`      | Before features section    |
| `home-features-after`       | After features section     |
| `not-found`                 | Custom 404 content         |

---

## Markdown Extension Syntax

| Feature           | Syntax                                    | Purpose                               |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| Custom container  | `::: tip TITLE`                           | Info/tip/warning/danger/details boxes |
| Code group        | `::: code-group`                          | Tabbed code blocks                    |
| Line highlight    | ` ```ts{1,3-5} `                          | Highlight specific lines              |
| Line focus        | `// [!code focus]`                        | Focus annotation                      |
| Line diff         | `// [!code ++]` / `// [!code --]`         | Diff annotation                       |
| Line warning      | `// [!code warning]` / `// [!code error]` | Warning/error annotation              |
| Code snippet      | `<<< @/path/to/file`                      | Import code from file                 |
| Markdown include  | `<!--@include: ./file.md-->`              | Include markdown partial              |
| Emoji             | `:tada:`                                  | GitHub-style shortcodes               |
| Table of contents | `[[toc]]`                                 | Auto-generated from headings          |
| Math (LaTeX)      | `$inline$` / `$$block$$`                  | Requires `markdown.math: true`        |

---

## See Also

- [examples/core.md](examples/core.md) for complete config, data loaders, theme, and markdown examples
- [SKILL.md](SKILL.md) for patterns, decision guidance, and red flags

**Official Documentation:**

- [VitePress Guide](https://vitepress.dev/guide/what-is-vitepress)
- [VitePress Config Reference](https://vitepress.dev/reference/site-config)
- [VitePress Theme Reference](https://vitepress.dev/reference/default-theme-config)
- [VitePress Frontmatter Reference](https://vitepress.dev/reference/frontmatter-config)
- [VitePress Runtime API](https://vitepress.dev/reference/runtime-api)
