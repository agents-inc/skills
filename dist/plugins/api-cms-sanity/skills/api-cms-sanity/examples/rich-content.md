# Sanity Rich Content Examples

> Portable Text rendering with @portabletext/react and image URL builder with @sanity/image-url. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for client setup.

**Prerequisites**: Understand client setup and GROQ queries from core examples first.

---

## Pattern 1: Basic Portable Text Rendering

### Good Example — PortableText with Custom Components

```tsx
import { PortableText } from "@portabletext/react";
import type {
  PortableTextComponents,
  PortableTextBlock,
} from "@portabletext/react";
import { urlFor } from "../lib/sanity-image";

const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure>
          <img
            src={urlFor(value).width(800).auto("format").url()}
            alt={value.alt || ""}
            loading="lazy"
          />
          {value.caption && <figcaption>{value.caption}</figcaption>}
        </figure>
      );
    },
    code: ({ value }) => (
      <pre data-language={value.language}>
        <code>{value.code}</code>
      </pre>
    ),
    callout: ({ value }) => (
      <aside data-tone={value.tone}>
        <PortableText value={value.text} />
      </aside>
    ),
  },
  marks: {
    link: ({ children, value }) => {
      const isExternal = value.href && !value.href.startsWith("/");
      return (
        <a
          href={value.href}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {children}
        </a>
      );
    },
    highlight: ({ children }) => <mark>{children}</mark>,
    inlineCode: ({ children }) => <code>{children}</code>,
  },
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    normal: ({ children }) => <p>{children}</p>,
  },
  list: {
    bullet: ({ children }) => <ul>{children}</ul>,
    number: ({ children }) => <ol>{children}</ol>,
  },
};

function ArticleBody({ body }: { body: PortableTextBlock[] }) {
  return <PortableText value={body} components={components} />;
}
export { ArticleBody };
```

**Why good:** Custom renderers for image, code, and callout block types; external links get security attributes; images use `urlFor` for optimized delivery; null check for missing image assets; lazy loading for performance; named export

### Bad Example — Using Deprecated Package

```tsx
// BAD: @sanity/block-content-to-react is deprecated
import BlockContent from "@sanity/block-content-to-react";

// Uses old "serializers" API, unmaintained
<BlockContent blocks={body} serializers={serializers} />;
```

**Why bad:** `@sanity/block-content-to-react` is deprecated and unmaintained, replaced by `@portabletext/react` which uses "components" instead of "serializers"

---

## Pattern 2: Image URL Builder Setup

### Good Example — Reusable urlFor Helper

```typescript
// lib/sanity-image.ts
import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { client } from "./sanity-client";

const builder = createImageUrlBuilder(client);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
```

**Why good:** `createImageUrlBuilder` reads projectId and dataset from the client config, `urlFor` returns a chainable builder, `SanityImageSource` type handles all image input formats (asset ref, full image object, URL)

### Bad Example — Manual URL Construction

```typescript
// BAD: Manually constructing image URLs
function getImageUrl(ref: string) {
  const [, id, dimensions, format] = ref.split("-");
  return `https://cdn.sanity.io/images/projectId/dataset/${id}-${dimensions}.${format}`;
}
```

**Why bad:** Hardcoded project/dataset, ignores crop and hotspot metadata, no format optimization, no responsive sizing, breaks if Sanity changes CDN URL format

---

## Pattern 3: Responsive Images

### Good Example — Responsive srcSet with Auto Format

```tsx
import { urlFor } from "../lib/sanity-image";
import type { SanityImageSource } from "@sanity/image-url";

const WIDTHS = [400, 800, 1200, 1600] as const;
const DEFAULT_WIDTH = 800;

function ResponsiveImage({
  image,
  alt,
  sizes = "(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px",
}: {
  image: SanityImageSource;
  alt: string;
  sizes?: string;
}) {
  return (
    <img
      src={urlFor(image).width(DEFAULT_WIDTH).auto("format").url()}
      srcSet={WIDTHS.map(
        (w) => `${urlFor(image).width(w).auto("format").url()} ${w}w`,
      ).join(", ")}
      sizes={sizes}
      alt={alt}
      loading="lazy"
    />
  );
}
export { ResponsiveImage };
```

**Why good:** Named constants for widths, `.auto("format")` serves WebP/AVIF when the browser supports it, `srcSet` with width descriptors for responsive delivery, `sizes` attribute guides browser selection, lazy loading, crop and hotspot metadata automatically applied when passing the full image field

---

## Pattern 4: Image Transformations

### Good Example — Common Transformation Patterns

```typescript
import { urlFor } from "../lib/sanity-image";

// Fixed-size thumbnail
const thumbnailUrl = urlFor(image).width(150).height(150).fit("crop").url();

// Aspect ratio crop
const heroUrl = urlFor(image)
  .width(1200)
  .height(400)
  .fit("crop")
  .auto("format")
  .url();

// Blur placeholder (for progressive loading)
const blurUrl = urlFor(image).width(20).blur(50).url();

// Specific format
const pngUrl = urlFor(image).width(800).format("png").url();

// Quality control
const compressedUrl = urlFor(image).width(800).quality(75).auto("format").url();
```

**Why good:** `.fit("crop")` respects hotspot when cropping, low-res blur for placeholder loading patterns, `.auto("format")` for automatic format selection, `.quality()` for size/quality tradeoff

---

## Pattern 5: Querying Portable Text as Plain Text

### Good Example — Using pt::text() in GROQ

```typescript
import { defineQuery } from "groq";

// Extract plain text from Portable Text for excerpts and search
const POSTS_WITH_EXCERPT_QUERY = defineQuery(`
  *[_type == "post" && published == true]{
    _id,
    title,
    "slug": slug.current,
    "excerpt": pt::text(body)[0...200],
    publishedAt
  } | order(publishedAt desc)
`);

// Full-text search across Portable Text content
const SEARCH_POSTS_QUERY = defineQuery(`
  *[_type == "post" && pt::text(body) match $searchTerm]{
    _id,
    title,
    "slug": slug.current,
    "excerpt": pt::text(body)[0...200]
  }
`);

const results = await client.fetch(SEARCH_POSTS_QUERY, {
  searchTerm: "typescript*",
});
```

**Why good:** `pt::text()` converts Portable Text to plain text within GROQ (no client-side processing), string slicing `[0...200]` creates excerpts server-side, `match` operator for full-text search with wildcard support, parameterized search term prevents injection

---

_For schema definitions, see [schemas.md](schemas.md). For mutations and real-time, see [mutations.md](mutations.md)._
