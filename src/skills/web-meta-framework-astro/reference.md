# Astro Reference

> Project layout, route priority, collection API and adapter lookup. See [SKILL.md](SKILL.md) for the
> decisions, patterns and red flags, and [examples/](examples/) for full code.

---

## Project Structure

```
src/
├── components/       # Astro and framework components
├── content/          # Content collection files (Markdown, JSON, ...)
├── content.config.ts # Build-time collection definitions
├── live.config.ts    # Live collection definitions (separate file, on-demand only)
├── layouts/          # Layout components
├── pages/            # File-based routing (a page is a route)
│   └── api/          # Endpoints (.ts files)
├── styles/           # Global styles
└── assets/           # Optimized images and assets
astro.config.mjs      # Configuration (ESM only)
```

---

## Route Priority Order

1. Static routes (most specific)
2. Dynamic routes with a named parameter, `[param]`
3. Rest parameter routes, `[...slug]`
4. Endpoints over pages
5. File-based routes over configured redirects

---

## Content Collection API

```typescript
import { getCollection, getEntry, render } from "astro:content";

const all = await getCollection("blog");
const filtered = await getCollection("blog", ({ data }) => !data.draft);
const one = await getEntry("blog", "my-post-id");
const { Content, headings } = await render(entry);
```

Live collections use the parallel API — `getLiveCollection()` and `getLiveEntry()`, both returning
`{ entries | entry, error }` — and are available only where `prerender = false`.

---

## Loaders

| Loader                    | Source                            | Runs       |
| ------------------------- | --------------------------------- | ---------- |
| `glob({ pattern, base })` | Files matching a glob             | Build time |
| `file(path)`              | One JSON/YAML file of entries     | Build time |
| custom `async () => []`   | Anything, returning `{ id, ... }` | Build time |
| a live loader             | Anything, per request             | Request    |

---

## Deployment Adapters

An adapter is required for any project containing a page with `prerender = false`, and for
`output: "server"`.

| Adapter               | Target                                               |
| --------------------- | ---------------------------------------------------- |
| `@astrojs/node`       | Self-hosted Node (`standalone` or `middleware` mode) |
| `@astrojs/vercel`     | Vercel serverless and edge                           |
| `@astrojs/netlify`    | Netlify Functions and Edge                           |
| `@astrojs/cloudflare` | Cloudflare Workers and Pages                         |

---

## Rendering Mode Checklist

- [ ] Default: every page static
- [ ] An adapter is installed if any page needs request-time rendering
- [ ] `export const prerender = false` on each such page
- [ ] `output: "server"` only where most pages need it, with `prerender = true` on the static ones
- [ ] Endpoints carry `export const prerender = false` too — they default to static like pages
