# Content Collections

> Code examples for Astro content collections - schemas, querying, rendering, references. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Defining Collections with Schemas

### Good Example - Blog Collection with Full Schema

```typescript
// src/content.config.ts
import { defineCollection, reference } from "astro:content";
import { glob, file } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().max(160), // SEO-friendly length
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    author: reference("authors"), // Cross-collection reference
  }),
});

const authors = defineCollection({
  loader: file("src/data/authors.json"),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
    website: z.string().url().optional(),
  }),
});

const changelog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/changelog" }),
  schema: z.object({
    version: z.string(),
    date: z.coerce.date(),
    breaking: z.boolean().default(false),
  }),
});

export const collections = { blog, authors, changelog };
```

**Why good:** Zod schemas validate content at build time, cross-collection references link authors to posts, coerce handles date string parsing, defaults prevent undefined fields

### Bad Example - No Schema

```typescript
// BAD: No schema means no type safety
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  // Missing schema - frontmatter is unvalidated
});
```

**Why bad:** No build-time validation, no TypeScript types, typos in frontmatter go undetected, missing required fields cause runtime errors

---

## Pattern 2: Querying Collections

### Good Example - Filtering, Sorting, and Pagination

```astro
---
// src/pages/blog/index.astro
import { getCollection } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import PostCard from "../../components/PostCard.astro";

const POSTS_PER_PAGE = 10;

// Filter out drafts in production
const allPosts = await getCollection("blog", ({ data }) => {
  return import.meta.env.PROD ? data.draft !== true : true;
});

// Sort by date descending
const sortedPosts = allPosts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);

// Get unique tags for sidebar
const allTags = [...new Set(sortedPosts.flatMap((post) => post.data.tags))];
---

<BaseLayout title="Blog">
  <h1>Blog</h1>

  <aside>
    <h2>Tags</h2>
    <ul>
      {allTags.map((tag) => (
        <li><a href={`/tags/${tag}`}>{tag}</a></li>
      ))}
    </ul>
  </aside>

  <div class="posts">
    {sortedPosts.slice(0, POSTS_PER_PAGE).map((post) => (
      <PostCard post={post} />
    ))}
  </div>
</BaseLayout>
```

**Why good:** Drafts filtered in production but visible in dev, named constant for page size, sorted by date, tags extracted from collection

---

## Pattern 3: Rendering Markdown Content

### Good Example - Blog Post Page with Content Rendering

```astro
---
// src/pages/blog/[id].astro
import { getCollection, getEntry, render } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);

// Resolve the author reference
const author = await getEntry(post.data.author);
---

<BaseLayout title={post.data.title} description={post.data.description}>
  <article>
    <header>
      <h1>{post.data.title}</h1>
      <div class="meta">
        <span>By {author.data.name}</span>
        <time datetime={post.data.pubDate.toISOString()}>
          {post.data.pubDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        {post.data.updatedDate && (
          <span>
            (Updated: {post.data.updatedDate.toLocaleDateString()})
          </span>
        )}
      </div>
      <div class="tags">
        {post.data.tags.map((tag) => (
          <a href={`/tags/${tag}`} class="tag">{tag}</a>
        ))}
      </div>
    </header>

    {post.data.heroImage && (
      <img src={post.data.heroImage} alt="" class="hero" />
    )}

    <!-- Table of Contents from headings -->
    {headings.length > 0 && (
      <nav class="toc">
        <h2>Table of Contents</h2>
        <ul>
          {headings
            .filter((h) => h.depth <= 3)
            .map((heading) => (
              <li class={`toc-${heading.depth}`}>
                <a href={`#${heading.slug}`}>{heading.text}</a>
              </li>
            ))}
        </ul>
      </nav>
    )}

    <!-- Rendered Markdown content -->
    <div class="prose">
      <Content />
    </div>
  </article>
</BaseLayout>
```

**Why good:** `render()` converts Markdown to a component, headings extracted for TOC, author resolved from cross-collection reference, complete metadata display

---

## Pattern 4: Collection References

### Good Example - Cross-Collection References

```typescript
// src/content.config.ts
import { defineCollection, reference } from "astro:content";
import { glob, file } from "astro/loaders";
import { z } from "astro/zod";

const authors = defineCollection({
  loader: file("src/data/authors.json"),
  schema: z.object({
    name: z.string(),
    role: z.string(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    author: reference("authors"), // Single reference
    relatedPosts: z.array(reference("blog")).default([]), // Array of references
  }),
});

export const collections = { authors, blog };
```

```astro
---
// Resolving references in a page
import { getEntry, render } from "astro:content";

const post = await getEntry("blog", "my-post");

// Resolve single reference
const author = await getEntry(post.data.author);

// Resolve array of references
const relatedPosts = await Promise.all(
  post.data.relatedPosts.map((ref) => getEntry(ref))
);
---

<p>By {author.data.name}</p>

{relatedPosts.length > 0 && (
  <aside>
    <h3>Related Posts</h3>
    <ul>
      {relatedPosts.map((related) => (
        <li><a href={`/blog/${related.id}`}>{related.data.title}</a></li>
      ))}
    </ul>
  </aside>
)}
```

**Why good:** Type-safe cross-collection references, validated at build time, resolved with `getEntry()`, arrays of references for many-to-many relationships

---

## Pattern 5: Custom Loaders

### Good Example - API-Based Collection

```typescript
// src/content.config.ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const products = defineCollection({
  loader: async () => {
    const response = await fetch("https://api.example.com/products");
    const data = await response.json();

    // Loader must return array of objects with `id` property
    return data.map(
      (product: {
        slug: string;
        name: string;
        price: number;
        description: string;
        category: string;
      }) => ({
        id: product.slug,
        ...product,
      }),
    );
  },
  schema: z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
  }),
});

export const collections = { products };
```

**Why good:** Fetches from external API at build time, maps to required `id` property, validated with same Zod schema as file-based collections

---

## Pattern 6: Live Collections (Astro 6+)

### Good Example - Runtime Data Fetching

```typescript
// src/content.config.ts
import { defineCollection, defineLiveCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Build-time collection (standard)
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({ title: z.string(), pubDate: z.coerce.date() }),
});

// Live collection - fetched at runtime per-request
const products = defineLiveCollection({
  loader: myStoreLoader({ apiKey: import.meta.env.STORE_API_KEY }),
  schema: z.object({
    name: z.string(),
    price: z.number(),
    inStock: z.boolean(),
  }),
});

export const collections = { blog, products };
```

```astro
---
// src/pages/products.astro - must be SSR
export const prerender = false;

import { getLiveCollection, getLiveEntry } from "astro:content";

// Get all products (fresh on every request)
const { entries, error } = await getLiveCollection("products");

if (error) {
  return new Response("Failed to load products", { status: 500 });
}
---

<h1>Products</h1>
<ul>
  {entries.map((product) => (
    <li>
      {product.data.name} - ${product.data.price}
      {!product.data.inStock && <span>(Out of stock)</span>}
    </li>
  ))}
</ul>
```

**Why good:** Fresh data on every request without rebuilds, explicit error handling, same familiar collection API, requires SSR (`prerender = false`)

### Bad Example - Using Live Collections for Static Content

```typescript
// BAD: Blog posts don't change between requests - use defineCollection instead
const blog = defineLiveCollection({
  loader: myBlogLoader(),
  schema: z.object({ title: z.string() }),
});
```

**Why bad:** Static content should use build-time collections for better performance - live collections add per-request overhead that isn't needed for content that rarely changes

---

_See [routing.md](routing.md) for dynamic route generation from collections and [islands.md](islands.md) for interactive component patterns._
