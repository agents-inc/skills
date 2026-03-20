# Payload CMS - Advanced Examples

> Globals, versions/drafts, uploads/media, auth collections, Local API, and REST API. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand collection config, fields, access control, and hooks from core examples first.

---

## Pattern 7: Globals — Singleton Documents

Globals are single documents (not collections) used for site-wide settings like navigation, footer, or SEO defaults.

### Good Example — Site Settings Global

```typescript
// globals/site-settings.ts
import type { GlobalConfig } from "payload";
import { isAdmin } from "../access";

const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      required: true,
    },
    {
      name: "siteDescription",
      type: "textarea",
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "socialLinks",
      type: "array",
      fields: [
        {
          name: "platform",
          type: "select",
          options: [
            { label: "Twitter", value: "twitter" },
            { label: "GitHub", value: "github" },
            { label: "LinkedIn", value: "linkedin" },
          ],
        },
        { name: "url", type: "text", required: true },
      ],
    },
  ],
};

export { SiteSettings };
```

### Good Example — Navigation Global

```typescript
// globals/navigation.ts
import type { GlobalConfig } from "payload";

const Navigation: GlobalConfig = {
  slug: "navigation",
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: "items",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
        {
          name: "children",
          type: "array",
          fields: [
            { name: "label", type: "text", required: true },
            { name: "url", type: "text", required: true },
          ],
        },
      ],
    },
  ],
};

export { Navigation };
```

**Why good:** Globals for site-wide singleton data, separate access for read vs update, nested arrays for navigation hierarchy, public read with authenticated update

### Reading Globals via Local API

```typescript
import { getPayload } from "payload";
import config from "@payload-config";

async function getSiteSettings() {
  const payload = await getPayload({ config });

  const settings = await payload.findGlobal({
    slug: "site-settings",
    depth: 1,
  });

  return settings;
}

async function updateSiteSettings(data: { siteName: string }) {
  const payload = await getPayload({ config });

  const settings = await payload.updateGlobal({
    slug: "site-settings",
    data,
    overrideAccess: false,
  });

  return settings;
}
```

---

## Pattern 8: Versions and Drafts

Enable versioning to track document history and support draft/publish workflows.

### Good Example — Collection with Drafts

```typescript
// collections/pages.ts
import type { CollectionConfig } from "payload";

const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
  },
  versions: {
    drafts: true,
    maxPerDoc: 10, // Keep last 10 versions per document
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) return true;
      // Public users only see published versions
      return {
        _status: {
          equals: "published",
        },
      };
    },
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "content", type: "richText" },
    // _status field is auto-added when drafts: true
    // Values: "draft" | "published"
  ],
};

export { Pages };
```

**Why good:** `maxPerDoc` prevents unbounded version growth, access control returns `Where` query to filter drafts from public users, `_status` field is auto-added by Payload when `drafts: true`

### Publishing via Local API

```typescript
import { getPayload } from "payload";
import config from "@payload-config";

// Create as draft (default when drafts enabled)
async function createDraftPage(title: string, content: object) {
  const payload = await getPayload({ config });

  return payload.create({
    collection: "pages",
    data: { title, content },
    draft: true, // Explicitly save as draft
    overrideAccess: false,
  });
}

// Publish a draft
async function publishPage(id: string) {
  const payload = await getPayload({ config });

  return payload.update({
    collection: "pages",
    id,
    data: {
      _status: "published",
    },
    overrideAccess: false,
  });
}

// Restore a previous version
async function restoreVersion(versionId: string) {
  const payload = await getPayload({ config });

  return payload.restoreVersion({
    collection: "pages",
    id: versionId,
    overrideAccess: false,
  });
}
```

**Why good:** `draft: true` creates without publishing, publishing is just updating `_status`, version restore via dedicated API method, all with `overrideAccess: false`

---

## Pattern 9: Upload / Media Collection

Upload collections handle file storage with automatic image resizing.

### Good Example — Media Collection with Image Sizes

```typescript
// collections/media.ts
import type { CollectionConfig } from "payload";

const THUMBNAIL_WIDTH = 400;
const CARD_WIDTH = 768;
const DESKTOP_WIDTH = 1920;

const Media: CollectionConfig = {
  slug: "media",
  admin: {
    useAsTitle: "alt",
    group: "Media",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  upload: {
    mimeTypes: ["image/*", "application/pdf"],
    imageSizes: [
      {
        name: "thumbnail",
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_WIDTH,
        position: "centre",
      },
      {
        name: "card",
        width: CARD_WIDTH,
        height: undefined, // Retains aspect ratio
        position: "centre",
      },
      {
        name: "desktop",
        width: DESKTOP_WIDTH,
        height: undefined,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
    },
    {
      name: "caption",
      type: "textarea",
    },
  ],
};

export { Media };
```

**Why good:** Named constants for image dimensions, `mimeTypes` restricts uploads to images and PDFs, `height: undefined` preserves aspect ratio, `alt` text required for accessibility, `useAsTitle` set to alt for admin display, separate access for delete (admin only)

### Bad Example — No Restrictions

```typescript
// BAD: No access control, no mime type restrictions
const Media: CollectionConfig = {
  slug: "media",
  upload: true, // Default config — accepts ANY file type
  fields: [],
};
```

**Why bad:** No access control (any authenticated user can delete files), no mime type restriction (users can upload executables), no alt text field, no image size variants

---

## Pattern 10: Authentication Collection

Collections with `auth: true` automatically get email, password, login, and JWT functionality.

### Good Example — Users with Roles

```typescript
// collections/users.ts
import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

const Users: CollectionConfig = {
  slug: "users",
  auth: true, // Adds email, hash, salt, login, JWT
  admin: {
    useAsTitle: "email",
    group: "Admin",
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      // Non-admins can only read their own profile
      return { id: { equals: user.id } };
    },
    create: isAdmin,
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return { id: { equals: user.id } };
    },
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Author", value: "author" },
      ],
      access: {
        update: ({ req: { user } }) => user?.role === "admin",
      },
    },
    {
      name: "firstName",
      type: "text",
    },
    {
      name: "lastName",
      type: "text",
    },
  ],
};

export { Users };
```

**Why good:** `auth: true` handles email/password/JWT automatically, role field with field-level access (only admins can change roles), `admin` access function controls who sees the admin panel, scoped read/update for non-admins (own profile only)

### Auth with Login by Username

```typescript
const Users: CollectionConfig = {
  slug: "users",
  auth: {
    loginWithUsername: {
      allowEmailLogin: true, // Users can log in with email OR username
      requireUsername: true,
    },
    tokenExpiration: 7200, // 2 hours in seconds
  },
  fields: [{ name: "role", type: "select", options: ["admin", "editor"] }],
};
```

**Why good:** Allows username-based login while keeping email as fallback, explicit token expiration

---

## Pattern 11: Local API — Complete Operations

### Good Example — CRUD with Access Control

```typescript
import { getPayload } from "payload";
import config from "@payload-config";

const PAGE_SIZE = 20;

// Find with filters, pagination, and sorting
async function getPublishedPosts(page: number) {
  const payload = await getPayload({ config });

  return payload.find({
    collection: "posts",
    where: {
      status: { equals: "published" },
    },
    sort: "-createdAt",
    page,
    limit: PAGE_SIZE,
    depth: 1,
    overrideAccess: false,
  });
  // Returns: { docs: Post[], totalDocs, totalPages, page, ... }
}

// Find by ID
async function getPostById(id: string) {
  const payload = await getPayload({ config });

  return payload.findByID({
    collection: "posts",
    id,
    depth: 1,
    overrideAccess: false,
  });
}

// Create
async function createPost(data: {
  title: string;
  content: object;
  author: string;
}) {
  const payload = await getPayload({ config });

  return payload.create({
    collection: "posts",
    data,
    overrideAccess: false,
  });
}

// Update by ID
async function updatePost(
  id: string,
  data: Partial<{ title: string; status: string }>,
) {
  const payload = await getPayload({ config });

  return payload.update({
    collection: "posts",
    id,
    data,
    overrideAccess: false,
  });
}

// Bulk update with Where query
async function publishAllDrafts() {
  const payload = await getPayload({ config });

  return payload.update({
    collection: "posts",
    where: {
      status: { equals: "draft" },
    },
    data: {
      status: "published",
    },
    overrideAccess: false,
  });
}

// Delete by ID
async function deletePost(id: string) {
  const payload = await getPayload({ config });

  return payload.delete({
    collection: "posts",
    id,
    overrideAccess: false,
  });
}

// Count documents
async function countPublishedPosts() {
  const payload = await getPayload({ config });

  const result = await payload.count({
    collection: "posts",
    where: {
      status: { equals: "published" },
    },
  });

  return result.totalDocs;
}
```

**Why good:** Every call uses `overrideAccess: false` to enforce access control, pagination with named constant, `depth: 1` to control relationship population, bulk update via `where` query, count for efficient totals without loading documents

---

## Pattern 12: REST API — Auto-Generated Endpoints

Payload auto-generates REST endpoints at `/api/{collection-slug}`. These are useful for external clients.

### Endpoint Reference

```
GET    /api/posts                    — Find (paginated)
GET    /api/posts/:id                — Find by ID
POST   /api/posts                    — Create
PATCH  /api/posts/:id                — Update by ID
DELETE /api/posts/:id                — Delete by ID
GET    /api/posts/count              — Count
GET    /api/globals/site-settings    — Read global
POST   /api/globals/site-settings    — Update global
POST   /api/users/login              — Login (auth collections)
POST   /api/users/logout             — Logout
GET    /api/users/me                 — Current user
POST   /api/users/forgot-password    — Forgot password
POST   /api/users/reset-password     — Reset password
```

### Query Parameters

```
?where[status][equals]=published     — Filter
?sort=-createdAt                     — Sort descending
?limit=20                            — Pagination limit
?page=2                              — Pagination page
?depth=1                             — Relationship depth
?locale=en                           — Locale
?select[title]=true&select[slug]=true — Select specific fields
```

### Example — Fetch Published Posts

```typescript
const API_URL = process.env.API_URL;
const PAGE_SIZE = 20;

async function fetchPublishedPosts(page: number) {
  const params = new URLSearchParams({
    "where[status][equals]": "published",
    sort: "-createdAt",
    limit: String(PAGE_SIZE),
    page: String(page),
    depth: "1",
  });

  const response = await fetch(`${API_URL}/api/posts?${params}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

**Why good:** REST API is fully auto-generated from collection config, query parameters mirror Local API options, no separate route definitions needed

---

## Pattern 13: Hooks — Using payload Inside Hooks

Hooks receive `req.payload` which gives access to the Local API. This is the correct way to perform cross-collection operations within hooks.

### Good Example — Create Related Document in afterChange

```typescript
// hooks/create-audit-log.ts
import type { CollectionAfterChangeHook } from "payload";

const createAuditLog: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  // Use req.payload to access the Local API within hooks
  await req.payload.create({
    collection: "audit-logs",
    data: {
      action: operation,
      documentId: doc.id,
      collection: "posts",
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    },
    // overrideAccess: true (default) — hooks run in system context
  });
};

export { createAuditLog };
```

**Why good:** `req.payload` provides the Local API within hooks, `overrideAccess: true` (default) is correct here because this is a system-level operation, runs after the primary operation so it does not block saves

### Good Example — Validate with Cross-Collection Lookup

```typescript
// hooks/validate-unique-slug.ts
import type { CollectionBeforeValidateHook } from "payload";

const validateUniqueSlug: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  if (!data?.slug) return data;

  const existing = await req.payload.find({
    collection: "posts",
    where: {
      slug: { equals: data.slug },
      ...(operation === "update" && originalDoc?.id
        ? { id: { not_equals: originalDoc.id } }
        : {}),
    },
    limit: 1,
  });

  if (existing.docs.length > 0) {
    throw new Error(`Slug "${data.slug}" is already in use`);
  }

  return data;
};

export { validateUniqueSlug };
```

**Why good:** Cross-collection lookup to validate uniqueness, excludes current document on update, throws to prevent save with clear error message, `limit: 1` for efficient check

---

_For core patterns (config, collections, fields, access), see [core.md](core.md)._
