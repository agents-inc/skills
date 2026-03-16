---
name: web-framework-astro
description: Astro content-first framework - islands architecture, content collections, file-based routing, SSR/SSG hybrid rendering, View Transitions, server islands, multi-framework component support
---

# Astro Framework Patterns

> **Quick Guide:** Astro renders pages to static HTML by default with zero client-side JavaScript. Use `.astro` components for all static content, add `client:*` directives only on interactive framework components (React/Vue/Svelte). Use content collections for type-safe structured content. Choose between static (default) and on-demand (SSR) rendering per-page with `export const prerender`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST keep pages static by default - only add `export const prerender = false` when the page genuinely needs request-time data)**

**(You MUST use `client:*` directives on framework components that need interactivity - without a directive, components render to static HTML with zero JavaScript)**

**(You MUST define content collections in `src/content.config.ts` with Zod schemas for type-safe frontmatter)**

**(You MUST use `<ClientRouter />` from `astro:transitions` for View Transitions - the old `<ViewTransitions />` component is removed in Astro 6)**

**(You MUST install a server adapter (@astrojs/node, @astrojs/vercel, etc.) before using on-demand rendering)**

**(You MUST use `getStaticPaths()` for dynamic routes in static mode - it is not needed for on-demand (SSR) routes)**

</critical_requirements>

---

**Auto-detection:** Astro, .astro files, astro.config, islands architecture, client:load, client:visible, client:idle, client:only, client:media, server:defer, content collections, defineCollection, getCollection, getEntry, astro:content, astro:transitions, ClientRouter, getStaticPaths, Astro.props, Astro.params, Astro.cookies, Astro.redirect, prerender, astro add, @astrojs/react, @astrojs/vue, @astrojs/svelte, Starlight

**When to use:**

- Building content-driven websites (blogs, docs, marketing, portfolios)
- Sites where most pages are static with selective interactivity (islands)
- Projects using content collections for structured Markdown/MDX/YAML content
- Multi-framework projects mixing React, Vue, Svelte, or Solid components
- Sites needing hybrid rendering (static pages + some server-rendered pages)

**When NOT to use:**

- Highly interactive web applications (dashboards, real-time collaboration) - use Next.js or SPA frameworks
- Apps where every page requires user authentication and dynamic data - consider Next.js App Router
- Projects that need React Server Components or Server Actions - use Next.js

**Key patterns covered:**

- Astro component syntax (.astro files, frontmatter, template expressions, slots)
- Islands architecture (client directives, server islands, selective hydration)
- Content collections (schemas, querying, rendering, references)
- File-based routing (static routes, dynamic routes, rest parameters, pagination)
- Rendering modes (static, on-demand/SSR, hybrid with prerender control)
- View Transitions (ClientRouter, transition directives, persist state)
- Framework integrations (React, Vue, Svelte, Solid islands)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core patterns:**

- [examples/core.md](examples/core.md) - Astro components, props, slots, expressions, layouts
- [examples/islands.md](examples/islands.md) - Client directives, server islands, multi-framework islands
- [examples/content.md](examples/content.md) - Content collections, schemas, querying, rendering
- [examples/routing.md](examples/routing.md) - File-based routing, dynamic routes, SSR/SSG modes
- [examples/integrations.md](examples/integrations.md) - React/Vue/Svelte islands, View Transitions

---

<philosophy>

## Philosophy

Astro is a **content-first web framework** that ships zero JavaScript by default. It pioneered the **islands architecture** where most of the page is fast static HTML, with small interactive "islands" of JavaScript hydrated only where needed.

**Core principles:**

1. **Content-first** - Optimized for content-driven sites (blogs, docs, marketing, e-commerce)
2. **Zero JS by default** - Components render to static HTML unless explicitly hydrated
3. **Islands architecture** - Interactive components hydrate independently, reducing JavaScript payloads
4. **UI-agnostic** - Use React, Vue, Svelte, Solid, Preact, or plain Astro components
5. **File-based routing** - `src/pages/` directory structure maps directly to URLs
6. **Type-safe content** - Content collections with Zod schemas enforce structure and provide TypeScript types
7. **Hybrid rendering** - Mix static (SSG) and on-demand (SSR) pages in the same project

**When to use Astro:**

- Content-driven websites (blogs, documentation, portfolios, marketing)
- Sites with mostly static content and occasional interactivity
- Documentation sites (Starlight integration)
- E-commerce product pages with interactive carts
- Multi-framework projects where teams use different UI libraries

**When NOT to use Astro:**

- Fully interactive web applications (use Next.js, Remix, or SPA frameworks)
- Real-time collaborative apps (use dedicated SPA with WebSocket support)
- Projects requiring React Server Components or Server Actions (use Next.js)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Astro Component Structure

Astro components (`.astro` files) have two parts: a frontmatter script block (between `---` fences) and an HTML template.

#### Component Anatomy

```astro
---
// Component Script (frontmatter) - runs on the server only
import Layout from "../layouts/Layout.astro";
import { getCollection } from "astro:content";

// Props accessed via Astro.props
interface Props {
  title: string;
  description?: string;
}

const { title, description = "Default description" } = Astro.props;

// Server-side data fetching
const posts = await getCollection("blog");
---

<!-- Component Template - HTML with expressions -->
<Layout title={title}>
  <h1>{title}</h1>
  <p>{description}</p>

  <ul>
    {posts.map((post) => (
      <li>
        <a href={`/blog/${post.id}`}>{post.data.title}</a>
      </li>
    ))}
  </ul>
</Layout>

<style>
  /* Scoped to this component by default */
  h1 {
    color: navy;
    font-size: 2rem;
  }
</style>
```

**Why good:** Frontmatter runs server-only (no JavaScript shipped), type-safe props with interface, scoped styles prevent leakage, expressions use JSX-like syntax

---

### Pattern 2: Slots for Composition

Slots allow parent components to inject content into child component templates.

#### Default and Named Slots

```astro
---
// src/components/Card.astro
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<article class="card">
  <header>
    <slot name="header">
      <h2>{title}</h2>
    </slot>
  </header>

  <div class="body">
    <slot />  <!-- Default slot -->
  </div>

  <footer>
    <slot name="footer">
      <p>Default footer</p>
    </slot>
  </footer>
</article>
```

```astro
---
// Usage in a page
import Card from "../components/Card.astro";
---

<Card title="My Card">
  <span slot="header"><h2>Custom Header</h2></span>

  <p>This goes in the default slot.</p>

  <div slot="footer">
    <a href="/more">Read more</a>
  </div>
</Card>
```

**Why good:** Named slots provide flexible composition, fallback content renders when no slot content is provided, matches Web Component slot semantics

---

### Pattern 3: Layouts

Layouts are Astro components that wrap page content with shared UI (header, footer, navigation).

#### Base Layout with Metadata

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
}

const { title, description = "My Astro Site" } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/about">About</a>
    </nav>

    <main>
      <slot />
    </main>

    <footer>
      <p>&copy; {new Date().getFullYear()} My Site</p>
    </footer>
  </body>
</html>
```

```astro
---
// src/pages/about.astro
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="About Us" description="Learn about our team">
  <h1>About Us</h1>
  <p>We build great things with Astro.</p>
</BaseLayout>
```

**Why good:** Shared layout reduces duplication, metadata props ensure SEO per-page, slot injects page content

---

### Pattern 4: Islands Architecture (Client Directives)

By default, framework components (React, Vue, Svelte) render to static HTML. Add a `client:*` directive to hydrate them as interactive islands.

#### Client Directive Reference

| Directive        | When it hydrates                        | Use for                         |
| ---------------- | --------------------------------------- | ------------------------------- |
| `client:load`    | Immediately on page load                | Critical interactive UI         |
| `client:idle`    | When browser is idle                    | Lower-priority interactivity    |
| `client:visible` | When component scrolls into viewport    | Below-the-fold content          |
| `client:media`   | When media query matches                | Responsive interactivity        |
| `client:only`    | Skips server render, client-only        | Browser-dependent components    |

```astro
---
// src/pages/index.astro
import Header from "../components/Header.astro"; // Static - no JS
import SearchBar from "../components/SearchBar"; // React component
import Newsletter from "../components/Newsletter"; // React component
import Comments from "../components/Comments"; // React component
import Analytics from "../components/Analytics"; // React component
---

<Header />

<!-- Hydrate immediately - user interacts with search right away -->
<SearchBar client:load />

<!-- Hydrate when browser is idle - not urgent -->
<Newsletter client:idle />

<!-- Hydrate only when scrolled into view -->
<Comments client:visible />

<!-- Hydrate only on mobile screens -->
<Analytics client:media="(max-width: 768px)" />
```

**Why good:** Only interactive components ship JavaScript, hydration is deferred to optimal timing, static components render as zero-JS HTML

#### Server Islands

Server islands defer rendering of dynamic content on the server, allowing static shell to cache while dynamic parts render per-request.

```astro
---
// src/pages/product.astro
import ProductInfo from "../components/ProductInfo.astro"; // Static
import UserReviews from "../components/UserReviews.astro"; // Dynamic
---

<!-- Static product info - cached -->
<ProductInfo product={product} />

<!-- Server island - rendered per-request, placeholder shown while loading -->
<UserReviews server:defer>
  <div slot="fallback">Loading reviews...</div>
</UserReviews>
```

**Why good:** Static page shell caches and serves instantly, dynamic portions render per-request without blocking the page, fallback content prevents layout shift

---

### Pattern 5: Content Collections

Content collections provide type-safe management of structured content (blog posts, docs, product data).

#### Defining Collections

```typescript
// src/content.config.ts
import { defineCollection } from "astro:content";
import { glob, file } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

const authors = defineCollection({
  loader: file("src/data/authors.json"),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
  }),
});

export const collections = { blog, authors };
```

#### Querying and Rendering Collections

```astro
---
// src/pages/blog/index.astro
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";

const allPosts = await getCollection("blog", ({ data }) => {
  return data.draft !== true; // Filter out drafts
});

// Sort by date descending
const sortedPosts = allPosts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
---

<BaseLayout title="Blog">
  <h1>Blog</h1>
  <ul>
    {sortedPosts.map((post) => (
      <li>
        <a href={`/blog/${post.id}`}>
          <h2>{post.data.title}</h2>
          <time datetime={post.data.pubDate.toISOString()}>
            {post.data.pubDate.toLocaleDateString()}
          </time>
        </a>
      </li>
    ))}
  </ul>
</BaseLayout>
```

```astro
---
// src/pages/blog/[id].astro
import { getCollection, getEntry, render } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<BaseLayout title={post.data.title}>
  <article>
    <h1>{post.data.title}</h1>
    <time datetime={post.data.pubDate.toISOString()}>
      {post.data.pubDate.toLocaleDateString()}
    </time>
    <Content />
  </article>
</BaseLayout>
```

**Why good:** Zod schemas validate frontmatter at build time, TypeScript types are auto-generated, querying with filters is type-safe, `render()` converts Markdown to a component

---

### Pattern 6: File-Based Routing

The `src/pages/` directory structure directly maps to URL paths.

#### Static Routes

```
src/pages/
├── index.astro          → /
├── about.astro          → /about
├── blog/
│   ├── index.astro      → /blog
│   └── [id].astro       → /blog/:id (dynamic)
├── docs/
│   └── [...slug].astro  → /docs/* (rest parameter)
└── _helpers.ts          → excluded (underscore prefix)
```

#### Dynamic Routes with getStaticPaths

```astro
---
// src/pages/tags/[tag].astro
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  const tags = [...new Set(posts.flatMap((post) => post.data.tags))];

  return tags.map((tag) => ({
    params: { tag },
    props: {
      posts: posts.filter((post) => post.data.tags.includes(tag)),
    },
  }));
}

const { tag } = Astro.params;
const { posts } = Astro.props;
---

<h1>Posts tagged: {tag}</h1>
<ul>
  {posts.map((post) => (
    <li><a href={`/blog/${post.id}`}>{post.data.title}</a></li>
  ))}
</ul>
```

#### Rest Parameters

```astro
---
// src/pages/docs/[...slug].astro
export async function getStaticPaths() {
  return [
    { params: { slug: "getting-started" } },
    { params: { slug: "guides/installation" } },
    { params: { slug: "api/reference" } },
    { params: { slug: undefined } }, // matches /docs
  ];
}

const { slug } = Astro.params;
---

<h1>Docs: {slug ?? "Index"}</h1>
```

**Why good:** File structure mirrors URL structure, dynamic params are type-safe via getStaticPaths, rest parameters handle arbitrary depth

---

### Pattern 7: On-Demand Rendering (SSR)

Opt individual pages into server-side rendering while keeping the rest static.

#### Per-Page SSR

```astro
---
// src/pages/dashboard.astro
export const prerender = false; // Render on every request

const cookie = Astro.cookies.get("session");
if (!cookie) {
  return Astro.redirect("/login");
}

const user = await getUserFromSession(cookie.value);
---

<h1>Welcome, {user.name}</h1>
```

#### Server Output Mode

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server", // All pages server-rendered by default
  adapter: node({ mode: "standalone" }),
});
```

```astro
---
// src/pages/about.astro
export const prerender = true; // Opt this page back to static
---

<h1>About Us</h1>
```

#### API Endpoints

```typescript
// src/pages/api/search.ts
export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q");
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await searchDatabase(query);
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};
```

**Why good:** Static by default for performance, opt into SSR per-page as needed, API endpoints support full request/response control

---

### Pattern 8: View Transitions

Astro provides smooth page transitions using the browser's View Transition API via the `<ClientRouter />` component.

#### Enabling View Transitions

```astro
---
// src/layouts/BaseLayout.astro
import { ClientRouter } from "astro:transitions";
---

<html lang="en">
  <head>
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

#### Transition Directives

```astro
---
// src/pages/blog/[id].astro
---

<!-- Name pairs elements across pages for smooth morphing -->
<img
  src={post.data.heroImage}
  transition:name={`hero-${post.id}`}
  transition:animate="slide"
/>

<h1 transition:name={`title-${post.id}`}>
  {post.data.title}
</h1>

<!-- Persist interactive elements across navigations -->
<audio controls transition:persist>
  <source src="/music.mp3" type="audio/mp3" />
</audio>
```

**Why good:** Smooth transitions between pages without SPA framework, paired elements morph naturally, persistent elements maintain state across navigation

</patterns>

---

<integration>

## Integration Guide

**Astro is the top-level framework.** It handles routing, rendering, and content management. UI framework components (React, Vue, Svelte) are used as islands within Astro pages.

**Adding framework support:**

```bash
# Add React support
npx astro add react

# Add Vue support
npx astro add vue

# Add multiple at once
npx astro add react tailwind sitemap
```

**Works with:**

- **React/Vue/Svelte/Solid** - Used as interactive islands within Astro pages
- **Tailwind CSS** - Via `@astrojs/tailwind` integration
- **MDX** - Via `@astrojs/mdx` for components in Markdown
- **Starlight** - Astro's documentation theme, built on content collections

**Deployment adapters:**

- **@astrojs/vercel** - Vercel deployment with edge/serverless
- **@astrojs/netlify** - Netlify Functions/Edge
- **@astrojs/cloudflare** - Cloudflare Workers/Pages
- **@astrojs/node** - Self-hosted Node.js server

**Does NOT replace:**

- **Next.js** - For highly interactive, full-stack React applications
- **SPA frameworks** - For real-time, fully client-rendered apps

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST keep pages static by default - only add `export const prerender = false` when the page genuinely needs request-time data)**

**(You MUST use `client:*` directives on framework components that need interactivity - without a directive, components render to static HTML with zero JavaScript)**

**(You MUST define content collections in `src/content.config.ts` with Zod schemas for type-safe frontmatter)**

**(You MUST use `<ClientRouter />` from `astro:transitions` for View Transitions - the old `<ViewTransitions />` component is removed in Astro 6)**

**(You MUST install a server adapter (@astrojs/node, @astrojs/vercel, etc.) before using on-demand rendering)**

**(You MUST use `getStaticPaths()` for dynamic routes in static mode - it is not needed for on-demand (SSR) routes)**

**Failure to follow these rules will ship unnecessary JavaScript, break builds, cause missing pages, or produce type errors.**

</critical_reminders>
