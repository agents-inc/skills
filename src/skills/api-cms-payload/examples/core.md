# Payload CMS Core Examples

> Config setup, collection definitions, field types, access control, and hooks. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See [advanced.md](advanced.md) for globals, versions/drafts, uploads, auth, and API usage.

---

## Pattern 1: payload.config.ts — Postgres Adapter

### Good Example — Production Config

```typescript
// payload.config.ts
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { Pages } from "./collections/pages";
import { Posts } from "./collections/posts";
import { Users } from "./collections/users";
import { Media } from "./collections/media";
import { SiteSettings } from "./globals/site-settings";
import { Navigation } from "./globals/navigation";

const config = buildConfig({
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  editor: lexicalEditor(),
  collections: [Pages, Posts, Users, Media],
  globals: [SiteSettings, Navigation],
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " — My CMS",
    },
  },
  typescript: {
    outputFile: "./src/payload-types.ts",
  },
  secret: process.env.PAYLOAD_SECRET!,
});

export { config as default };
```

**Why good:** Database URL from env var, collections in separate files, editor declared once, TypeScript output path specified, admin user collection set, secret from env var

### Good Example — MongoDB Adapter

```typescript
// payload.config.ts
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { Posts } from "./collections/posts";
import { Users } from "./collections/users";

const config = buildConfig({
  db: mongooseAdapter({
    url: process.env.DATABASE_URI!,
  }),
  editor: lexicalEditor(),
  collections: [Posts, Users],
  admin: {
    user: Users.slug,
  },
  secret: process.env.PAYLOAD_SECRET!,
});

export { config as default };
```

**Why good:** Same config structure regardless of database, only the adapter import and options change

### Bad Example — Hardcoded Credentials

```typescript
// BAD: Hardcoded values, inline collections
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";

export default buildConfig({
  db: postgresAdapter({
    pool: { connectionString: "postgres://user:pass@localhost/mydb" }, // BAD
  }),
  secret: "not-a-real-secret", // BAD: hardcoded
  collections: [
    { slug: "posts", fields: [{ name: "title", type: "text" }] }, // Inline
  ],
});
```

**Why bad:** Hardcoded credentials leak in source control, inline collections become unmaintainable, no TypeScript output, no admin user

---

## Pattern 2: Collection with Full Config

### Good Example — Blog Posts Collection

```typescript
// collections/posts.ts
import type { CollectionConfig } from "payload";
import { isAdmin, isAdminOrAuthor } from "../access";
import { setAuthorOnCreate } from "../hooks/set-author";
import { revalidatePostCache } from "../hooks/revalidate-cache";

const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "author", "createdAt"],
    group: "Content",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: isAdminOrAuthor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [setAuthorOnCreate],
    afterChange: [revalidatePostCache],
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "content",
      type: "richText",
    },
    {
      name: "excerpt",
      type: "textarea",
      maxLength: 300,
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "tags",
      type: "array",
      fields: [
        {
          name: "tag",
          type: "text",
          required: true,
        },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "SEO",
          fields: [
            { name: "metaTitle", type: "text" },
            { name: "metaDescription", type: "textarea" },
          ],
        },
      ],
    },
  ],
};

export { Posts };
```

**Why good:** Hooks and access imported from separate files, `useAsTitle` for admin list display, `admin.position: "sidebar"` for fields that belong in the sidebar, versions with drafts enabled, `group: "Content"` organizes admin navigation, SEO fields in a tab for clean admin UI

---

## Pattern 3: Access Control Patterns

### Good Example — Reusable Access Functions

```typescript
// access/index.ts
import type { Access, FieldAccess } from "payload";

// Anyone
const isPublic: Access = () => true;

// Any authenticated user
const isLoggedIn: Access = ({ req: { user } }) => Boolean(user);

// Admin role only
const isAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  return user.role === "admin";
};

// Admin or document author (returns Where query for scoped access)
const isAdminOrAuthor: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === "admin") return true;

  return {
    author: {
      equals: user.id,
    },
  };
};

// Field-level: admin only
const adminFieldAccess: FieldAccess = ({ req: { user } }) => {
  return user?.role === "admin";
};

export { isPublic, isLoggedIn, isAdmin, isAdminOrAuthor, adminFieldAccess };
```

**Why good:** Reusable across collections, `isAdminOrAuthor` returns a `Where` query to scope results (users only see their own documents, admins see all), field-level access uses `FieldAccess` type, clear naming

### Bad Example — Inline Unscoped Access

```typescript
// BAD: No access control defined
const Posts: CollectionConfig = {
  slug: "posts",
  // access: not specified — authenticated users get FULL access
  fields: [{ name: "title", type: "text" }],
};

// BAD: Overly permissive
const Posts: CollectionConfig = {
  slug: "posts",
  access: {
    read: () => true,
    create: () => true, // Anyone can create, including unauthenticated!
    update: () => true, // Anyone can update anything!
    delete: () => true, // Anyone can delete anything!
  },
  fields: [{ name: "title", type: "text" }],
};
```

**Why bad:** First example relies on defaults (authenticated users get full access), second example gives full write access to unauthenticated users, no ownership scoping, no role checks

---

## Pattern 4: Hooks — beforeChange and afterChange

### Good Example — Auto-Set Author and Revalidate Cache

```typescript
// hooks/set-author.ts
import type { CollectionBeforeChangeHook } from "payload";

const setAuthorOnCreate: CollectionBeforeChangeHook = ({
  data,
  operation,
  req,
}) => {
  if (operation === "create" && req.user) {
    data.author = req.user.id;
  }
  return data;
};

export { setAuthorOnCreate };
```

```typescript
// hooks/revalidate-cache.ts
import type { CollectionAfterChangeHook } from "payload";

const revalidatePostCache: CollectionAfterChangeHook = ({
  doc,
  operation,
  req,
  context,
}) => {
  // Use context to prevent infinite loops when hooks trigger other operations
  if (context.skipRevalidation) return;

  if (operation === "create" || operation === "update") {
    // Non-blocking side effect — does not block the response
    req.payload.logger.info(`Cache revalidation triggered for post: ${doc.id}`);
    // Use your cache invalidation strategy here
  }
};

export { revalidatePostCache };
```

**Why good:** `beforeChange` returns modified `data` to pass changes forward, `operation` check prevents overwriting author on updates, `afterChange` for non-blocking side effects, `context` prevents infinite loops when hooks trigger each other, each hook in a separate file for testability

### Good Example — beforeValidate for Computed Fields

```typescript
// hooks/generate-slug.ts
import type { CollectionBeforeValidateHook } from "payload";

const generateSlug: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (data?.title && (operation === "create" || !data.slug)) {
    data.slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  return data;
};

export { generateSlug };
```

**Why good:** Generates slug from title on create or when slug is empty, uses `beforeValidate` so the generated slug passes validation, idempotent logic

### Bad Example — Blocking External Call in beforeChange

```typescript
// BAD: External API in beforeChange
const syncToExternalSystem: CollectionBeforeChangeHook = async ({ data }) => {
  // If external API is slow or down, EVERY save operation is blocked
  const response = await fetch("https://external-api.com/sync", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("External sync failed"); // Prevents save!
  }

  return data;
};
```

**Why bad:** Blocks every save operation on external API availability, network failures prevent all document saves, should use `afterChange` for non-critical syncs or queue for reliability

---

## Pattern 5: Field Types — Blocks for Flexible Layouts

### Good Example — Page Builder with Blocks

```typescript
// fields/layout-blocks.ts
import type { Block } from "payload";

const HeroBlock: Block = {
  slug: "hero",
  interfaceName: "HeroBlock", // Custom TypeScript interface name for generated types
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "subheading", type: "textarea" },
    { name: "backgroundImage", type: "upload", relationTo: "media" },
    {
      name: "cta",
      type: "group",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
      ],
    },
  ],
};

const ContentBlock: Block = {
  slug: "content",
  fields: [{ name: "richText", type: "richText" }],
};

const CallToActionBlock: Block = {
  slug: "cta",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "description", type: "textarea" },
    {
      name: "buttons",
      type: "array",
      minRows: 1,
      maxRows: 3,
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
        {
          name: "variant",
          type: "select",
          defaultValue: "primary",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
          ],
        },
      ],
    },
  ],
};

export { HeroBlock, ContentBlock, CallToActionBlock };
```

```typescript
// Usage in a collection
import {
  HeroBlock,
  ContentBlock,
  CallToActionBlock,
} from "../fields/layout-blocks";

const Pages: CollectionConfig = {
  slug: "pages",
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "layout",
      type: "blocks",
      blocks: [HeroBlock, ContentBlock, CallToActionBlock],
    },
  ],
};
```

**Why good:** Blocks defined in separate files for reuse across collections, each block has a clear `slug` for identification, CTA block uses array for multiple buttons with constraints, blocks compose together for flexible page building

---

## Pattern 6: Relationship Fields — Polymorphic and Has-Many

### Good Example — Polymorphic Relationship

```typescript
// A "related content" field that can reference posts OR pages
{
  name: "relatedContent",
  type: "relationship",
  relationTo: ["posts", "pages"], // Polymorphic — multiple collection targets
  hasMany: true,
}
```

### Good Example — Has-Many with Max

```typescript
// Featured posts — limited to 5
{
  name: "featuredPosts",
  type: "relationship",
  relationTo: "posts",
  hasMany: true,
  maxRows: 5,
  admin: {
    description: "Select up to 5 featured posts",
  },
}
```

### Good Example — Self-Referencing Relationship

```typescript
// Category hierarchy
const Categories: CollectionConfig = {
  slug: "categories",
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories", // Self-reference
    },
  ],
};
```

**Why good:** Polymorphic relationships reference multiple collections, `hasMany` with `maxRows` for bounded lists, self-referencing for hierarchical data, `admin.description` helps content editors

---

_For globals, versions, uploads, auth, and API patterns, see [advanced.md](advanced.md)._
