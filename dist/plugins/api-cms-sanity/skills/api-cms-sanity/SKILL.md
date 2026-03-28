---
name: api-cms-sanity
description: Structured content platform — GROQ queries, schema definitions, @sanity/client, Portable Text, image handling, real-time listeners, mutations, TypeGen
---

# Sanity Patterns

> **Quick Guide:** Use Sanity for structured content management with GROQ queries, typed schemas via `defineType`/`defineField`, and `@sanity/client` for data fetching. Always set `apiVersion` to a dated string, use `useCdn: true` for public reads, handle draft documents explicitly, use `@sanity/image-url` for image transformations, and render rich text with `@portabletext/react`. Generate TypeScript types with `sanity typegen generate`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always set `apiVersion` on `createClient` to a dated string like `'2025-02-19'` — omitting it uses a legacy API that may break)**

**(You MUST use `useCdn: true` for public read queries and `useCdn: false` when using a token or needing fresh data)**

**(You MUST use parameterized GROQ queries (`$param`) for any dynamic values — never interpolate user input into GROQ strings)**

**(You MUST handle drafts explicitly — draft documents have `_id` prefixed with `drafts.` and are not returned by default with `perspective: 'published'`)**

**(You MUST use `defineQuery()` from `groq` and assign queries to named variables for TypeGen type generation)**

</critical_requirements>

---

**Auto-detection:** Sanity, sanity, @sanity/client, createClient, GROQ, groq, defineType, defineField, defineArrayMember, @sanity/image-url, urlFor, @portabletext/react, PortableText, portable text, block content, sanity.config, sanity.cli, typegen, sanity studio, content lake

**When to use:**

- Setting up `@sanity/client` with `createClient` for data fetching
- Writing GROQ queries (filters, projections, joins, ordering, slicing)
- Defining content schemas with `defineType`, `defineField`, `defineArrayMember`
- Rendering Portable Text (block content) with `@portabletext/react`
- Generating image URLs with `@sanity/image-url` (responsive images, crops, hotspots)
- Performing mutations (create, patch, delete, transactions)
- Setting up real-time listeners with `client.listen()`
- Generating TypeScript types with Sanity TypeGen

**Key patterns covered:**

- Client setup with `createClient` and `apiVersion` configuration
- GROQ query language: filters, projections, ordering, slicing, joins, references
- Schema definitions: document types, object types, arrays, references, images
- Portable Text rendering with custom components
- Image URL builder with responsive images and transformations
- Mutations: create, createOrReplace, patch, delete, transactions
- Real-time listeners via `client.listen()`
- TypeGen for type-safe GROQ queries with `defineQuery()`

**When NOT to use:**

- GraphQL-only APIs (Sanity supports GROQ primarily; use GraphQL skill if needed)
- Direct database access (Sanity is a hosted content lake, not a database)
- Non-Sanity CMS platforms (use the dedicated skill for your CMS)

**Detailed Resources:**

- For decision frameworks and quick-reference tables, see [reference.md](reference.md)

**Client & GROQ:**

- [examples/core.md](examples/core.md) — Client setup, GROQ queries, error handling, TypeGen

**Schemas:**

- [examples/schemas.md](examples/schemas.md) — defineType, defineField, document types, object types, references, images

**Rich Content:**

- [examples/rich-content.md](examples/rich-content.md) — Portable Text rendering, image URL builder, responsive images

**Mutations & Real-time:**

- [examples/mutations.md](examples/mutations.md) — Create, patch, delete, transactions, real-time listeners

---

<philosophy>

## Philosophy

Sanity is a structured content platform built around a real-time content lake, GROQ (Graph-Relational Object Queries) as its query language, and Sanity Studio as a customizable editing environment.

**Core principles:**

1. **Structured content** — Content is defined by schemas (`defineType`, `defineField`) that describe shape, validation, and editorial UI. Schemas are code, not configuration files.
2. **GROQ-first querying** — GROQ lets you filter, project, join, and reshape data in a single query. Unlike REST or GraphQL, GROQ queries return exactly the shape you define in the projection.
3. **Content as data** — Rich text is stored as Portable Text (a JSON-based specification), making it renderable in any frontend framework without vendor lock-in.
4. **API versioning** — Every client must specify an `apiVersion` date string. This pins your code to a specific API behavior, preventing breaking changes from affecting production.
5. **CDN caching** — Public read queries use `useCdn: true` for edge-cached responses. Mutations and authenticated reads use `useCdn: false` for fresh data.
6. **Type generation** — Sanity TypeGen generates TypeScript types from both your schemas and GROQ queries, enabling end-to-end type safety from content model to frontend.

**When to use Sanity:**

- Content-driven websites and applications (blogs, marketing sites, documentation)
- Projects needing real-time collaborative editing in a customizable studio
- Multi-channel content delivery (web, mobile, IoT) from a single content source
- Teams wanting type-safe content queries with GROQ and TypeGen

**When NOT to use:**

- Transactional data requiring ACID guarantees (use a database)
- User-generated content at massive scale (Sanity is optimized for editorial content)
- Projects needing a self-hosted CMS (Sanity's content lake is hosted, though the Studio is open source)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup with createClient

Configure `@sanity/client` with project ID, dataset, API version, and CDN preference. Always set `apiVersion` to a dated string and `useCdn` explicitly.

```typescript
import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2025-02-19", // Pin to a specific API version date
  useCdn: true, // true for public reads, false for authenticated/fresh data
});
```

For dual client setup (public + preview with token), see [examples/core.md](examples/core.md).

---

### Pattern 2: GROQ Queries with Filters and Projections

GROQ queries combine filters, projections, ordering, and slicing. Always use `defineQuery()` for TypeGen and `$param` for dynamic values.

```typescript
import { defineQuery } from "groq";

const POST_BY_SLUG_QUERY = defineQuery(`
  *[_type == "post" && slug.current == $slug][0]{
    _id, title, body, "author": author->{name, image}
  }
`);
const post = await client.fetch(POST_BY_SLUG_QUERY, { slug: "my-post" });
```

Never interpolate user input into GROQ strings -- always use `$param` parameters to prevent GROQ injection. For advanced queries (combined queries, conditional projections), see [examples/core.md](examples/core.md).

---

### Pattern 3: Schema Definitions with defineType and defineField

Define content structure with `defineType`, `defineField`, and `defineArrayMember` from `"sanity"` for type safety and Studio UI.

```typescript
import { defineType, defineField } from "sanity";

export const postType = defineType({
  name: "post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({ name: "slug", type: "slug", options: { source: "title" } }),
  ],
});
```

For complete schemas (images with hotspot, arrays, references, previews, object types), see [examples/schemas.md](examples/schemas.md).

---

### Pattern 4: Portable Text Rendering

Render block content with `@portabletext/react`. Define custom `PortableTextComponents` for non-standard blocks (images, code) and marks (links, highlights).

```tsx
import { PortableText } from "@portabletext/react";
<PortableText value={body} components={components} />;
```

Do not use the deprecated `@sanity/block-content-to-react` package. For full component examples, see [examples/rich-content.md](examples/rich-content.md).

---

### Pattern 5: Image URL Builder

Use `@sanity/image-url` to generate optimized, responsive image URLs with crop and hotspot support.

```typescript
import { createImageUrlBuilder } from "@sanity/image-url";
const builder = createImageUrlBuilder(client);
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
// Usage: urlFor(image).width(800).auto("format").url()
```

For responsive `srcSet` patterns and image transformations, see [examples/rich-content.md](examples/rich-content.md).

---

### Pattern 6: Mutations (Create, Patch, Delete)

Use `@sanity/client` methods for document mutations. Always call `.commit()` on patches and transactions.

```typescript
await client.create({ _type: "post", title: "New Post" });
await client.patch("post-123").set({ title: "Updated" }).commit();
await client.delete("post-123");
```

For `createOrReplace`, `createIfNotExists`, transactions, array inserts, and visibility options, see [examples/mutations.md](examples/mutations.md).

---

### Pattern 7: Real-Time Listeners

Subscribe to document changes with `client.listen()`. The listener only uses the filter portion of GROQ -- projections and ordering are ignored.

```typescript
const subscription = client.listen(`*[_type == "post"]`).subscribe({
  next: (update) => {
    /* update.transition: 'update' | 'appear' | 'disappear' */
  },
  error: (err) => console.error(err),
});
subscription.unsubscribe(); // Cleanup when done
```

For production frontends, evaluate the newer Live Content API as a simpler alternative. For listener options and caveats, see [examples/mutations.md](examples/mutations.md).

---

### Pattern 8: TypeGen for Type-Safe GROQ

Configure TypeGen in `sanity.cli.ts` with `overloadClientMethods: true` for typed `client.fetch` results. Use `defineQuery()` from `"groq"` to make queries discoverable by TypeGen.

```typescript
// sanity.cli.ts — set typegen.overloadClientMethods: true
// queries/post-queries.ts — wrap queries with defineQuery()
// sanity.types.ts — auto-generated result types
const posts = await client.fetch(allPostsQuery); // Typed result
```

Inline query strings without `defineQuery()` produce untyped (`any`) results. For full TypeGen configuration and workflow, see [examples/core.md](examples/core.md).

</patterns>

---

<decision_framework>

## Decision Framework

### useCdn: true vs false

```
Is the data public and non-personalized?
├─ YES → useCdn: true (edge-cached, fast)
└─ NO →
    ├─ Using a token for authenticated reads? → useCdn: false
    ├─ Need real-time fresh data (preview)? → useCdn: false
    └─ Performing mutations? → useCdn: false
```

### Draft Handling

```
Do you need draft documents?
├─ YES → Use perspective: 'previewDrafts' (requires token)
├─ NO → Use perspective: 'published' (default since API v2025-02-19)
└─ Mixed (preview mode toggle)?
    └─ Create two clients: one public (useCdn: true), one preview (token + useCdn: false)
```

### GROQ Query Return Shape

```
How many documents do you expect?
├─ One (by ID, slug, singleton) → Add [0] at end (returns object or null)
├─ Many (list, feed) → No slice suffix (returns array)
└─ Paginated → Add [start...end] slice
```

### Image Handling

```
How should images be delivered?
├─ Fixed size (thumbnails, avatars) → urlFor(img).width(W).height(H).url()
├─ Responsive (article images) → srcSet with multiple widths
├─ Format optimization → .auto('format') for WebP/AVIF
└─ Cropped to aspect ratio → .width(W).height(H).fit('crop')
```

### Mutation Method Selection

```
What operation do you need?
├─ Create new document → client.create()
├─ Create or fully replace → client.createOrReplace() (for singletons)
├─ Create only if missing → client.createIfNotExists()
├─ Update specific fields → client.patch(id).set({...}).commit()
├─ Remove fields → client.patch(id).unset([...]).commit()
├─ Multiple related changes → client.transaction()...commit()
└─ Delete document → client.delete(id)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing `apiVersion` on client** — Omitting `apiVersion` uses legacy API behavior that may change without notice. Always pin to a date string.
- **String interpolation in GROQ queries** — Interpolating user input into GROQ strings enables GROQ injection. Always use `$param` parameters.
- **Using `useCdn: true` with a token** — CDN-cached responses ignore authentication tokens. Authenticated queries must use `useCdn: false`.
- **Accessing draft documents without a token** — Drafts (`drafts.*` documents) require an API token and `perspective: 'previewDrafts'`. Without a token, drafts are invisible.

**Medium Priority Issues:**

- **Fetching all fields with `{...}` when only a few are needed** — Over-fetching wastes bandwidth and CDN cache efficiency. Project only the fields you need.
- **Missing `.commit()` on patches** — `client.patch(id).set({...})` without `.commit()` does nothing — the mutation is never sent.
- **Not using `defineQuery()` for GROQ queries** — TypeGen cannot generate types for queries that aren't wrapped in `defineQuery()` or assigned to named variables.
- **Hardcoded project ID or dataset** — Use environment variables; hardcoded values prevent environment switching and leak project details.
- **Using deprecated `@sanity/block-content-to-react`** — Replaced by `@portabletext/react`. The old package is unmaintained.

**Common Mistakes:**

- **Forgetting `_key` on array items in mutations** — Every item in a Sanity array must have a unique `_key` field. Mutations without `_key` will fail.
- **Using `_id` with `client.create()`** — `create()` generates a random `_id`. If you specify `_id` and the document exists, it errors. Use `createOrReplace()` or `createIfNotExists()` for idempotent operations.
- **Not handling the case where `[0]` returns `null`** — A GROQ query ending in `[0]` returns `null` if no documents match, not an empty object.
- **Expecting `client.listen()` to work with projections** — The listener only uses the filter portion of a GROQ query. Projections, ordering, and slicing are ignored.

**Gotchas & Edge Cases:**

- **API version `2025-02-19` changed default perspective** — Before this version, the default perspective was `raw` (includes drafts). After, it defaults to `published`. Existing code may break if you update `apiVersion` without accounting for this.
- **CDN cache is eventual** — After a mutation, CDN-cached queries (`useCdn: true`) may return stale data for a few seconds. Use `useCdn: false` or add a small delay for consistency-critical reads after writes.
- **Slug fields store value in `.current`** — Query `slug.current`, not `slug` directly. `*[slug == "my-slug"]` will never match.
- **Image fields require the full object for crop/hotspot** — Passing only `asset._ref` to `urlFor()` works for basic URLs but loses crop and hotspot metadata. Pass the entire image field object.
- **Portable Text arrays need `_key` on every block** — When creating Portable Text content programmatically, every block and inline object needs a unique `_key`.
- **`client.listen()` reconnects automatically** — But there's no built-in guarantee against missed events during reconnection. For critical use cases, combine with periodic re-fetching.
- **TypeGen requires `schema.json` extraction first** — Run `npx sanity schema extract` before `npx sanity typegen generate`. The extract step reads your Studio schemas and outputs a JSON representation.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always set `apiVersion` on `createClient` to a dated string like `'2025-02-19'` — omitting it uses a legacy API that may break)**

**(You MUST use `useCdn: true` for public read queries and `useCdn: false` when using a token or needing fresh data)**

**(You MUST use parameterized GROQ queries (`$param`) for any dynamic values — never interpolate user input into GROQ strings)**

**(You MUST handle drafts explicitly — draft documents have `_id` prefixed with `drafts.` and are not returned by default with `perspective: 'published'`)**

**(You MUST use `defineQuery()` from `groq` and assign queries to named variables for TypeGen type generation)**

**Failure to follow these rules will cause unpredictable API behavior, GROQ injection vulnerabilities, and untyped query results.**

</critical_reminders>
