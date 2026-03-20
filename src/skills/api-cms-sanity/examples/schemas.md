# Sanity Schema Examples

> Schema definitions with defineType, defineField, defineArrayMember. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for client setup.

**Prerequisites**: Understand client setup from core examples first.

---

## Pattern 1: Document Type with Validation

### Good Example — Complete Document Schema

```typescript
// schemas/post.ts
import { defineType, defineField, defineArrayMember } from "sanity";

export const postType = defineType({
  name: "post",
  title: "Blog Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required().min(5).max(120),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "author" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "mainImage",
      title: "Main Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt Text",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "categories",
      title: "Categories",
      type: "array",
      of: [
        defineArrayMember({ type: "reference", to: [{ type: "category" }] }),
      ],
    }),
    defineField({
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt Text",
              type: "string",
            }),
            defineField({
              name: "caption",
              title: "Caption",
              type: "string",
            }),
          ],
        }),
        defineArrayMember({
          type: "object",
          name: "code",
          title: "Code Block",
          fields: [
            defineField({
              name: "language",
              title: "Language",
              type: "string",
            }),
            defineField({ name: "code", title: "Code", type: "text" }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: "title",
      author: "author.name",
      media: "mainImage",
    },
    prepare(selection) {
      const { author } = selection;
      return {
        ...selection,
        subtitle: author ? `by ${author}` : "No author",
      };
    },
  },
  orderings: [
    {
      title: "Published Date, New",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
});
```

**Why good:** `defineType`/`defineField`/`defineArrayMember` provide IDE autocomplete, validation rules enforce content quality, `hotspot: true` enables focal point cropping, alt text required on images for accessibility, body supports blocks (rich text), images, and custom code blocks, preview customizes Studio list appearance, orderings define sort options in Studio

---

## Pattern 2: Object Types (Reusable, Non-Document)

### Good Example — Reusable Object Schema

```typescript
// schemas/objects/seo.ts
import { defineType, defineField } from "sanity";

const SEO_TITLE_MAX_LENGTH = 60;
const SEO_DESCRIPTION_MAX_LENGTH = 160;

export const seoType = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  fields: [
    defineField({
      name: "metaTitle",
      title: "Meta Title",
      type: "string",
      validation: (rule) => rule.max(SEO_TITLE_MAX_LENGTH),
      description: `Max ${SEO_TITLE_MAX_LENGTH} characters for search engines`,
    }),
    defineField({
      name: "metaDescription",
      title: "Meta Description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(SEO_DESCRIPTION_MAX_LENGTH),
      description: `Max ${SEO_DESCRIPTION_MAX_LENGTH} characters`,
    }),
    defineField({
      name: "ogImage",
      title: "Open Graph Image",
      type: "image",
      description: "Recommended: 1200x630px",
    }),
  ],
});
```

**Why good:** Object type (not document) — can be embedded in any document via `type: "seo"`, named constants for magic numbers, `description` guides editors, `rows: 3` on text field improves Studio UX

### Usage in a Document

```typescript
// In a page document
defineField({
  name: "seo",
  title: "SEO Settings",
  type: "seo", // References the object type defined above
}),
```

---

## Pattern 3: Reference Fields

### Good Example — Reference with Filtering

```typescript
defineField({
  name: "author",
  title: "Author",
  type: "reference",
  to: [{ type: "author" }],
  validation: (rule) => rule.required(),
}),

// Reference to multiple types (polymorphic)
defineField({
  name: "relatedContent",
  title: "Related Content",
  type: "array",
  of: [
    defineArrayMember({
      type: "reference",
      to: [{ type: "post" }, { type: "page" }, { type: "product" }],
    }),
  ],
}),

// Reference with filter (only show published authors)
defineField({
  name: "reviewer",
  title: "Reviewer",
  type: "reference",
  to: [{ type: "author" }],
  options: {
    filter: "active == true",
    filterParams: {},
  },
}),
```

**Why good:** Single reference with validation, polymorphic reference allows multiple target types, `options.filter` limits reference picker in Studio to matching documents

---

## Pattern 4: Image and File Fields

### Good Example — Image with Metadata

```typescript
defineField({
  name: "mainImage",
  title: "Main Image",
  type: "image",
  options: {
    hotspot: true, // Enables focal point selection in Studio
  },
  fields: [
    defineField({
      name: "alt",
      title: "Alternative Text",
      type: "string",
      validation: (rule) =>
        rule.custom((alt, context) => {
          // Require alt text when an image is set
          const parent = context.parent as { asset?: { _ref?: string } };
          if (parent?.asset?._ref && !alt) {
            return "Alt text is required when an image is set";
          }
          return true;
        }),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
    }),
  ],
}),

// File field for downloads
defineField({
  name: "attachment",
  title: "Attachment",
  type: "file",
  options: {
    accept: ".pdf,.doc,.docx",
  },
  fields: [
    defineField({
      name: "description",
      title: "Description",
      type: "string",
    }),
  ],
}),
```

**Why good:** `hotspot: true` lets editors choose a focal point that `@sanity/image-url` respects during cropping, custom validation requires alt text only when an image is actually uploaded, file field restricts upload types with `accept`

---

## Pattern 5: Array Fields with Constraints

### Good Example — Array with Min/Max and Unique Items

```typescript
defineField({
  name: "tags",
  title: "Tags",
  type: "array",
  of: [defineArrayMember({ type: "string" })],
  validation: (rule) => rule.unique().min(1).max(10),
  options: {
    layout: "tags", // Renders as tag chips in Studio
  },
}),

// Array of objects with constrained block types
defineField({
  name: "content",
  title: "Content",
  type: "array",
  of: [
    defineArrayMember({ type: "block" }),
    defineArrayMember({
      type: "image",
      options: { hotspot: true },
    }),
    defineArrayMember({
      type: "object",
      name: "callout",
      title: "Callout",
      fields: [
        defineField({
          name: "tone",
          title: "Tone",
          type: "string",
          options: {
            list: [
              { title: "Info", value: "info" },
              { title: "Warning", value: "warning" },
              { title: "Tip", value: "tip" },
            ],
          },
        }),
        defineField({
          name: "text",
          title: "Text",
          type: "array",
          of: [defineArrayMember({ type: "block" })],
        }),
      ],
      preview: {
        select: { tone: "tone" },
        prepare({ tone }) {
          return { title: `Callout: ${tone || "default"}` };
        },
      },
    }),
  ],
}),
```

**Why good:** `.unique()` prevents duplicate tags, `layout: "tags"` improves Studio editing UX, custom inline objects (callout) have their own preview, content array mixes blocks, images, and custom types for flexible editorial experiences

---

## Pattern 6: Schema Registration

### Good Example — Registering Schemas in sanity.config.ts

```typescript
// sanity.config.ts
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { postType } from "./schemas/post";
import { authorType } from "./schemas/author";
import { categoryType } from "./schemas/category";
import { seoType } from "./schemas/objects/seo";

// NOTE: default export required by Sanity Studio
export default defineConfig({
  name: "default",
  title: "My Project",
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  plugins: [structureTool()],
  schema: {
    types: [postType, authorType, categoryType, seoType],
  },
});
```

**Why good:** Each schema in its own file, imported and registered in config, `structureTool()` provides the default document editor, schema types array includes both document types and reusable object types

---

_For client and GROQ patterns, see [core.md](core.md). For Portable Text and images, see [rich-content.md](rich-content.md)._
