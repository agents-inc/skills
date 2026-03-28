---
name: api-cms-payload
description: Payload CMS v3 — TypeScript-native headless CMS with code-first collections, hooks, access control, Local/REST/GraphQL APIs, admin panel, and database adapter pattern
---

# Payload CMS Patterns

> **Quick Guide:** Use Payload for code-first content management with TypeScript. Define collections and globals as config objects with typed fields, hooks, and access control functions. Prefer the Local API (`payload.find`, `payload.create`) for server-side operations. Always generate TypeScript types from your config. Use database adapters (Postgres or MongoDB) and never hardcode credentials. Access control functions receive `{ req }` with the authenticated user. Hooks run at the document lifecycle level (beforeChange, afterChange, etc.) and must not have side effects that block the request unless intentional.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define access control on every collection — open collections are a security risk)**

**(You MUST use the Local API (`payload.find`, `payload.create`) for server-side data operations — it is zero-latency and fully typed)**

**(You MUST generate TypeScript types with `payload generate:types` after every schema change)**

**(You MUST keep JSX/React component imports OUT of the Payload config file — separate config and UI concerns)**

**(You MUST use `overrideAccess: false` when calling the Local API on behalf of a user — the default is `true` which bypasses all access control)**

</critical_requirements>

---

**Auto-detection:** Payload, payload, payloadcms, @payloadcms, buildConfig, CollectionConfig, GlobalConfig, payload.config.ts, payload.find, payload.create, payload.update, payload.delete, payload.findByID, lexicalEditor, richText, beforeChange, afterChange, afterRead, beforeValidate, access control payload, upload collection, imageSizes, versions drafts

**When to use:**

- Configuring `payload.config.ts` with database adapter, collections, and globals
- Defining collection schemas with typed fields (text, richText, relationship, blocks, array, group, upload, select)
- Implementing access control functions (role-based, ownership-based, field-level)
- Writing collection hooks (beforeChange, afterChange, beforeRead, afterRead, beforeValidate, beforeDelete, afterDelete)
- Querying data via Local API, REST API, or GraphQL
- Setting up authentication collections with login, roles, and JWT
- Configuring uploads/media with image sizes and mime type restrictions
- Enabling versions and drafts on collections or globals
- Customizing the admin panel (groups, hidden collections, custom components)

**Key patterns covered:**

- `payload.config.ts` setup with `buildConfig`, database adapters, editor config
- Collection config: slug, fields, hooks, access, auth, upload, versions, admin
- Field types: text, richText, relationship, upload, blocks, array, group, select, tabs, checkbox, date, number, email, code, json, point, radio, textarea, row, collapsible
- Access control: collection-level and field-level, returning boolean or Where query
- Hooks: beforeChange, afterChange, beforeRead, afterRead, beforeValidate, beforeDelete, afterDelete, beforeOperation, afterOperation
- Local API: `payload.find`, `payload.findByID`, `payload.create`, `payload.update`, `payload.delete`, `payload.count`
- REST API: auto-generated endpoints at `/api/{collection-slug}`
- Globals: singleton documents for site settings, navigation, footer
- Auth collections: `auth: true`, roles, login strategies
- Uploads: imageSizes, mimeTypes, media collections
- Versions and drafts: `versions: { drafts: true }`
- TypeScript type generation

**When NOT to use:**

- Simple key-value storage (use a database directly)
- Static site generation without content editing needs
- Applications that only need a REST API without an admin panel (use a plain API framework)
- Client-side data fetching patterns (Payload's Local API is server-only)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core Setup & Collections:**

- [examples/core.md](examples/core.md) — Config setup, collection definitions, field types, access control, hooks

**Advanced Patterns:**

- [examples/advanced.md](examples/advanced.md) — Globals, versions/drafts, uploads/media, auth collections, Local API, REST API

---

<philosophy>

## Philosophy

Payload is a TypeScript-native headless CMS that treats your schema as code. Instead of clicking through a GUI to build content models, you define collections and globals as TypeScript config objects. Payload auto-generates an admin panel, REST API, GraphQL API, and a fully typed Local API from your config.

**Core principles:**

1. **Config-as-code** -- Collections, globals, fields, hooks, and access control are all defined in TypeScript. Your schema is version-controlled, reviewable, and deployable like any other code.
2. **Three APIs from one config** -- Every collection automatically gets a Local API (server-only, zero-latency), REST API (`/api/{slug}`), and GraphQL API. The Local API is the primary interface for server-side operations.
3. **Access control is mandatory** -- Every collection should have explicit `access` functions. By default, Payload denies access to unauthenticated users, but you must define who can do what. Access functions can return a boolean or a `Where` query to scope results.
4. **Hooks for side effects** -- Lifecycle hooks (beforeChange, afterChange, etc.) let you run logic at specific points in the document lifecycle. Keep hooks focused and avoid blocking operations unnecessarily.
5. **Database-agnostic** -- Payload uses database adapters (Postgres or MongoDB). Your collections and fields are defined once and work with any supported database.
6. **Type generation** -- Run `payload generate:types` to produce TypeScript interfaces from your config. This gives you end-to-end type safety from config to API responses.

**When to use Payload:**

- Content-managed applications (blogs, e-commerce, marketing sites)
- Applications needing an admin panel with role-based access
- Projects requiring a typed CMS with version control over the schema
- Multi-tenant applications using access control to scope data per tenant
- Headless CMS backing a frontend framework

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: payload.config.ts Setup

The config is the entry point. It defines the database adapter, collections, globals, editor, and admin settings. Always use env vars for credentials.

```typescript
const config = buildConfig({
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),
  editor: lexicalEditor(),
  collections: [Posts, Users, Media],
  globals: [SiteSettings],
  admin: { user: Users.slug },
  typescript: { outputFile: "./src/payload-types.ts" },
  secret: process.env.PAYLOAD_SECRET!,
});
```

Never hardcode database URLs or secrets. Import collections from separate files. See [examples/core.md](examples/core.md) for full Postgres and MongoDB adapter configs.

---

### Pattern 2: Collection Config

Collections are the primary data model. Each generates a database table, admin UI, and API endpoints. Define access control per operation, use `useAsTitle` for admin display, and keep each collection in its own file.

```typescript
const Posts: CollectionConfig = {
  slug: "posts",
  admin: { useAsTitle: "title" },
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
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "content", type: "richText" },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
  ],
};
```

See [examples/core.md](examples/core.md) for full collection config with all field types, sidebar positioning, and SEO tabs.

---

### Pattern 3: Access Control

Access functions receive `{ req }` with the authenticated user. They return `true`/`false` or a `Where` query to scope results. Define reusable functions in a shared `access/` directory.

```typescript
// Return boolean for simple checks
const isAdmin: Access = ({ req: { user } }) => user?.role === "admin";

// Return Where query for scoped access — users see only their own documents
const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return { author: { equals: user.id } };
};
```

Field-level access uses the same pattern on individual fields. See [examples/core.md](examples/core.md) for reusable access functions and field-level access examples.

---

### Pattern 4: Collection Hooks

Hooks run at specific points in the document lifecycle. `beforeChange` returns modified `data`, `afterChange` is for non-blocking side effects. Use `req.payload` to access the Local API within hooks. Hooks receive a `context` object to prevent infinite loops when hooks trigger other operations.

```typescript
beforeChange: [
  ({ data, operation, req }) => {
    if (operation === "create" && req.user) data.author = req.user.id;
    return data;
  },
],
afterChange: [
  ({ doc, operation, req, context }) => {
    if (context.skipRevalidation) return;
    if (operation === "create") req.payload.logger.info(`Post created: ${doc.title}`);
  },
],
```

Never put blocking external API calls in `beforeChange` -- use `afterChange` for non-critical side effects. See [examples/core.md](examples/core.md) for hook patterns and [examples/advanced.md](examples/advanced.md) for cross-collection hooks.

---

### Pattern 5: Field Types

Payload provides typed fields: `text`, `richText`, `number`, `select`, `checkbox`, `date`, `email`, `textarea`, `relationship`, `upload`, `json`, `code`, `point`, `radio`. Structural fields compose to model any content shape:

- **group** -- nested object with sub-fields
- **array** -- repeatable rows of same-shape fields
- **blocks** -- flexible content with multiple block types (use `interfaceName` for custom TypeScript interface names)
- **tabs**, **row**, **collapsible** -- admin-only layout helpers that do not affect data shape

Use **blocks** when editors choose from multiple block types for flexible page layouts. Use **array** when every row has the same fields. See [examples/core.md](examples/core.md) for block definitions and [reference.md](reference.md) for the complete field type table.

---

### Pattern 6: Local API

The Local API is the primary server-side interface -- zero-latency, fully typed, and executes hooks and access control. Always pass `overrideAccess: false` when operating on behalf of a user.

```typescript
const payload = await getPayload({ config });
const result = await payload.find({
  collection: "posts",
  where: { status: { equals: "published" } },
  sort: "-createdAt",
  limit: 20,
  depth: 1,
  overrideAccess: false,
});
```

Without `overrideAccess: false`, access control is completely bypassed (the default is `true`). See [examples/advanced.md](examples/advanced.md) for full CRUD operations, bulk updates, and globals API.

</patterns>

---

<decision_framework>

## Decision Framework

### Which API to Use

```
Where is the code running?
+-- Server-side (API route, server component, script)
|   +-- Local API (zero-latency, fully typed, preferred)
+-- External client (browser, mobile app, third-party)
|   +-- REST API (/api/{collection-slug})
+-- GraphQL client
    +-- GraphQL API (/api/graphql)
```

### Field Type Selection

```
What kind of data?
+-- Single value
|   +-- Short text --> text
|   +-- Long text --> textarea
|   +-- Rich content --> richText
|   +-- Number --> number
|   +-- Boolean --> checkbox
|   +-- Date/time --> date
|   +-- Email --> email
|   +-- Coordinates --> point
|   +-- Code snippet --> code
|   +-- Arbitrary JSON --> json
+-- Choice from options
|   +-- Single choice (dropdown) --> select
|   +-- Single choice (visible) --> radio
|   +-- Linked document --> relationship
|   +-- File/image --> upload
+-- Nested structure
|   +-- Fixed group of fields --> group
|   +-- Repeatable rows (same shape) --> array
|   +-- Flexible content (multiple block types) --> blocks
+-- Admin layout only (no data effect)
    +-- Tabbed sections --> tabs
    +-- Side-by-side fields --> row
    +-- Collapsible section --> collapsible
```

### Access Control Strategy

```
Who should access this data?
+-- Public (anyone) --> read: () => true
+-- Authenticated users only --> read: ({ req: { user } }) => Boolean(user)
+-- Admin only --> read: ({ req: { user } }) => user?.role === 'admin'
+-- Owner only --> read: return Where query matching user.id
+-- Mixed (public read, auth write) --> Different function per operation
+-- Field-level restriction --> access on individual field config
```

### Hooks vs Access Control

```
What do you need to do?
+-- Control WHO can do something --> Access control
+-- Control WHAT happens when they do it --> Hooks
+-- Validate data before saving --> beforeValidate hook or field validation
+-- Transform data before saving --> beforeChange hook
+-- Trigger side effects after saving --> afterChange hook
+-- Filter/transform output --> afterRead hook
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing access control on collections** -- Without explicit `access` functions, Payload denies all access to unauthenticated users but grants full access to any authenticated user. Always define explicit access rules.
- **`overrideAccess` default is `true` in Local API** -- Every `payload.find()`, `payload.create()`, etc. call bypasses access control by default. Always pass `overrideAccess: false` when operating on behalf of a user.
- **Importing JSX/React components in payload.config.ts** -- Payload config runs in a Node context. Importing React components (even transitively) causes bundling errors. Keep config and UI imports completely separate.
- **Hardcoded `secret` or database URL** -- Use environment variables. The Payload secret is used to sign JWTs; hardcoding it is a security vulnerability.

**Medium Priority Issues:**

- **Using `select("*")` equivalent** -- In the Local API, not specifying `select` returns all fields. Use the `select` option to fetch only needed fields for performance.
- **Deep `depth` values** -- Default depth is 2. High depth values cause cascading relationship queries. Set `depth: 0` or `depth: 1` unless you need deeply nested relationships.
- **Blocking hooks with external calls** -- `beforeChange` and `beforeValidate` hooks block the save operation. Move non-critical external API calls to `afterChange` or use background processing.
- **Not running `payload generate:types` after schema changes** -- Stale types lead to runtime errors that TypeScript should have caught at compile time.

**Common Mistakes:**

- **Deep-cloning collection configs** -- `JSON.parse(JSON.stringify(config))` strips hooks and access functions (they are functions, not serializable data). Use spread or Object.assign instead.
- **Forgetting `.select()` equivalent after create/update** -- In the Local API, `payload.create` and `payload.update` return the full document by default. Use the `select` option if you need specific fields.
- **Using `FOR ALL` style access** -- Define separate access functions for `create`, `read`, `update`, `delete` instead of a single function. Different operations have different security requirements.
- **Monorepo version mismatches** -- All packages in a monorepo must use the same version of `payload`, `@payloadcms/*`, `next`, `react`, and `react-dom`. Mismatches cause subtle bundling errors.

**Gotchas & Edge Cases:**

- **`beforeChange` data is a partial on update** -- On `update` operations, `data` contains only the changed fields, not the full document. Use `originalDoc` to access existing values.
- **`beforeChange` has no `id` on create** -- The document ID is not available during `beforeChange` on create operations. If you need the ID, use `afterChange`.
- **`overrideAccess` defaults** -- Local API defaults to `true` (bypass access control). REST and GraphQL always enforce access control. This asymmetry is intentional but catches people off guard.
- **Tabs, rows, and collapsibles do not affect data shape** -- These are admin-only layout fields. A field inside a `tab` is stored at the top level of the document, not nested.
- **Relationship depth cascading** -- Setting `depth: 3` on a collection with circular relationships can cause exponential query growth. Keep depth as low as possible.
- **Auth collections auto-inject fields** -- Collections with `auth: true` automatically get `email`, `hash`, `salt`, `loginAttempts`, and `lockUntil` fields. Do not redefine them.
- **Versions create a separate table** -- Enabling `versions: true` creates a `_posts_versions` table (or equivalent). This can significantly increase storage for high-traffic collections.
- **Access control `Where` queries run as SQL** -- When an access function returns a `Where` query instead of a boolean, it is appended to the database query. Complex `Where` queries can impact database performance.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define access control on every collection — open collections are a security risk)**

**(You MUST use the Local API (`payload.find`, `payload.create`) for server-side data operations — it is zero-latency and fully typed)**

**(You MUST generate TypeScript types with `payload generate:types` after every schema change)**

**(You MUST keep JSX/React component imports OUT of the Payload config file — separate config and UI concerns)**

**(You MUST use `overrideAccess: false` when calling the Local API on behalf of a user — the default is `true` which bypasses all access control)**

**Failure to follow these rules will create security vulnerabilities, type-unsafe operations, and bundling errors.**

</critical_reminders>
