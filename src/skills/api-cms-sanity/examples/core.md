# Sanity Core Examples

> Client setup, GROQ queries, error handling, and TypeGen patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Schemas:** See [schemas.md](schemas.md). **Rich content:** See [rich-content.md](rich-content.md). **Mutations:** See [mutations.md](mutations.md).

---

## Pattern 1: Client Setup — Public Reads

### Good Example — Typed Client with API Version

```typescript
// lib/sanity-client.ts
import { createClient } from "@sanity/client";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const DATASET = process.env.SANITY_DATASET!;
const API_VERSION = "2025-02-19";

export const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: true, // Edge-cached for public reads
});
```

**Why good:** `apiVersion` pins API behavior to a known date, `useCdn: true` serves cached responses from CDN edge, named constants for config values, named export

### Bad Example — Missing API Version

```typescript
import { createClient } from "@sanity/client";

// BAD: No apiVersion, hardcoded values
const client = createClient({
  projectId: "abc123",
  dataset: "production",
});
```

**Why bad:** Missing `apiVersion` uses legacy API behavior that may change without warning, hardcoded project ID prevents environment switching, no `useCdn` defaults to `false` (always hitting origin)

---

## Pattern 2: Client Setup — Authenticated / Preview

### Good Example — Token-Based Client for Preview Mode

```typescript
// lib/sanity-preview-client.ts
import { createClient } from "@sanity/client";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const DATASET = process.env.SANITY_DATASET!;
const API_VERSION = "2025-02-19";
const API_TOKEN = process.env.SANITY_API_TOKEN!;

// Preview client: sees drafts, no CDN cache
export const previewClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: false, // Must be false when using token
  token: API_TOKEN,
  perspective: "previewDrafts", // Include draft documents
});
```

**Why good:** `useCdn: false` required with tokens (CDN ignores auth), `perspective: 'previewDrafts'` returns draft documents overlaid on published, server-only token kept in environment variable

### Good Example — Dual Client Pattern

```typescript
// lib/sanity-clients.ts
import { createClient } from "@sanity/client";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const DATASET = process.env.SANITY_DATASET!;
const API_VERSION = "2025-02-19";

// Public reads — CDN cached
export const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: true,
});

// Preview reads — fresh, includes drafts (server-only)
export const previewClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN!,
  perspective: "previewDrafts",
});

// Choose client based on preview mode
export function getClient(preview = false) {
  return preview ? previewClient : client;
}
```

**Why good:** Separate clients for public and preview, factory function selects the right client, preview token never sent to CDN, shared config for consistency

---

## Pattern 3: GROQ Queries — Filters and Projections

### Good Example — Parameterized Query with defineQuery

```typescript
import { defineQuery } from "groq";

// List query: multiple documents
const POSTS_QUERY = defineQuery(`
  *[_type == "post" && published == true]{
    _id,
    title,
    "slug": slug.current,
    "authorName": author->name,
    "excerpt": pt::text(body)[0...200],
    publishedAt
  } | order(publishedAt desc) [0...10]
`);

// Detail query: single document by slug
const POST_BY_SLUG_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    body,
    publishedAt,
    "author": author->{
      name,
      "imageUrl": image.asset->url
    },
    "categories": categories[]->{ _id, title },
    "relatedPosts": *[
      _type == "post"
      && _id != ^._id
      && count(categories[@._ref in ^.^.categories[]._ref]) > 0
    ][0...3]{ _id, title, "slug": slug.current }
  }
`);

// Fetch with parameters
const post = await client.fetch(POST_BY_SLUG_QUERY, { slug: "my-post" });
```

**Why good:** `defineQuery()` enables TypeGen type inference, `$slug` parameter prevents injection, `[0]` returns single object (not array), `->` dereferences references, `pt::text()` extracts plain text from Portable Text, `^` references parent scope in subqueries

### Bad Example — String Interpolation

```typescript
// BAD: GROQ injection vulnerability
async function getPostBySlug(slug: string) {
  const query = `*[_type == "post" && slug.current == "${slug}"][0]`;
  return client.fetch(query);
}
```

**Why bad:** User-controlled `slug` value interpolated directly into GROQ string, enables GROQ injection attacks (e.g., `" || true] | order(_createdAt desc)[0]{"token": identity()}//`), always use `$param` parameters instead

---

## Pattern 4: GROQ Queries — Advanced Patterns

### Good Example — Combined Query (Multiple Results in One Fetch)

```typescript
const PAGE_QUERY = defineQuery(`{
  "settings": *[_type == "siteSettings"][0]{
    title,
    description,
    "logoUrl": logo.asset->url
  },
  "featuredPosts": *[_type == "post" && featured == true] | order(publishedAt desc) [0...3]{
    _id,
    title,
    "slug": slug.current,
    publishedAt
  },
  "categories": *[_type == "category"] | order(title asc){
    _id,
    title,
    "postCount": count(*[_type == "post" && references(^._id)])
  }
}`);

// Single fetch returns all three datasets
const pageData = await client.fetch(PAGE_QUERY);
// pageData.settings, pageData.featuredPosts, pageData.categories
```

**Why good:** Single network request for multiple related datasets, each sub-query independently filtered and projected, `count()` with subquery for computed fields, reduces page load time

### Good Example — Conditional Projections

```typescript
const CONTENT_BLOCKS_QUERY = defineQuery(`
  *[_type == "page" && slug.current == $slug][0]{
    title,
    "content": content[]{
      _type == "hero" => {
        _type,
        heading,
        "backgroundUrl": background.asset->url
      },
      _type == "textBlock" => {
        _type,
        body
      },
      _type == "gallery" => {
        _type,
        "images": images[]{
          "url": asset->url,
          alt,
          caption
        }
      }
    }
  }
`);
```

**Why good:** Conditional projections return different fields based on `_type`, polymorphic content blocks handled in a single query, each block type gets only its relevant fields

---

## Pattern 5: Error Handling

### Good Example — Consistent Fetch Error Handling

```typescript
async function fetchPosts() {
  try {
    const posts = await client.fetch(POSTS_QUERY);
    return posts;
  } catch (error) {
    // Sanity client throws on network errors and GROQ syntax errors
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch posts: ${message}`);
  }
}

// For single documents that might not exist
async function fetchPostBySlug(slug: string) {
  const post = await client.fetch(POST_BY_SLUG_QUERY, { slug });

  if (!post) {
    // [0] returns null when no documents match
    throw new Error(`Post not found: ${slug}`);
  }

  return post;
}
```

**Why good:** `client.fetch` throws on network/GROQ errors (unlike Supabase's `{ data, error }` pattern), null check for `[0]` queries that may return no results, descriptive error messages with context

### Bad Example — No Null Handling

```typescript
// BAD: Assumes document always exists
async function getPost(slug: string) {
  const post = await client.fetch(POST_BY_SLUG_QUERY, { slug });
  return post.title; // TypeError if post is null!
}
```

**Why bad:** GROQ `[0]` returns `null` if no documents match, accessing `.title` on `null` throws at runtime, must check for `null` before accessing properties

---

## Pattern 6: TypeGen Integration

### Good Example — Full TypeGen Workflow

```typescript
// sanity.cli.ts
import { defineCliConfig } from "sanity/cli";

// NOTE: default export required by Sanity CLI tooling
export default defineCliConfig({
  api: {
    projectId: "your-project-id",
    dataset: "production",
  },
  typegen: {
    enabled: true,
    path: "./src/**/*.{ts,tsx}",
    schema: "schema.json",
    generates: "./sanity.types.ts",
    overloadClientMethods: true,
  },
});
```

```typescript
// queries/post-queries.ts
import { defineQuery } from "groq";

// TypeGen finds these and generates result types
export const allPostsQuery = defineQuery(`
  *[_type == "post"]{
    _id,
    title,
    "slug": slug.current,
    publishedAt
  } | order(publishedAt desc)
`);

export const postBySlugQuery = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    body,
    "author": author->{name, "imageUrl": image.asset->url}
  }
`);
```

```typescript
// lib/fetchers.ts
import type {
  AllPostsQueryResult,
  PostBySlugQueryResult,
} from "../sanity.types";
import { allPostsQuery, postBySlugQuery } from "../queries/post-queries";
import { client } from "./sanity-client";

// With overloadClientMethods: true, return types are inferred
export async function getAllPosts(): Promise<AllPostsQueryResult> {
  return client.fetch(allPostsQuery);
}

export async function getPostBySlug(
  slug: string,
): Promise<PostBySlugQueryResult> {
  return client.fetch(postBySlugQuery, { slug });
}
```

**Why good:** `overloadClientMethods: true` makes `client.fetch` aware of query types, generated types match the exact shape of GROQ projections, queries in dedicated files for organization, explicit return types for clarity

### Bad Example — Inline Queries Without defineQuery

```typescript
// BAD: TypeGen cannot type inline queries
const posts = await client.fetch(`*[_type == "post"]{ title }`);
// posts is typed as 'any' — no type safety
```

**Why bad:** TypeGen only generates types for queries assigned to named variables using `defineQuery()` or the `groq` template literal, inline strings produce `any` return type, no type safety on the result

---

_For schema definitions, see [schemas.md](schemas.md). For Portable Text and images, see [rich-content.md](rich-content.md). For mutations and real-time, see [mutations.md](mutations.md)._
