---
name: api-cms-strapi
description: Open-source headless CMS — content type schemas, REST API, Document Service API, custom controllers, lifecycle hooks, authentication, TypeScript
---

# Strapi Patterns

> **Quick Guide:** Use Strapi as an open-source headless CMS with auto-generated REST/GraphQL APIs from content type schemas. In v5, use the Document Service API (`strapi.documents()`) for back-end data access instead of the deprecated Entity Service. REST API responses use a flat format (`data.fieldName`, not `data.attributes.fieldName`). Relations and media are NOT populated by default -- always pass `populate`. Use `qs` to build complex query strings. Content types are private by default; configure permissions via the Users & Permissions plugin or API tokens.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `strapi.documents('api::content-type.content-type')` (Document Service API) for all back-end data access in Strapi v5 -- the Entity Service API is removed)**

**(You MUST always pass `populate` when you need relations, media, components, or dynamic zones -- Strapi returns NO relations by default)**

**(You MUST use the `qs` library to build complex REST API query strings with filters, populate, and sort -- manual string construction breaks with nested params)**

**(You MUST sanitize and validate both input and output in custom controllers using `this.sanitizeQuery(ctx)`, `this.sanitizeOutput()`, and `this.validateQuery(ctx)`)**

**(You MUST set permissions for every content type endpoint via the admin panel or config -- all routes are private by default)**

</critical_requirements>

---

**Auto-detection:** Strapi, strapi, @strapi/strapi, createCoreController, createCoreService, createCoreRouter, Document Service, strapi.documents, content-type, schema.json, api::, plugin::, lifecycle hooks, Users & Permissions, /api/auth/local, populate, qs.stringify

**When to use:**

- Building content-managed applications with Strapi as the headless CMS
- Defining content type schemas (`schema.json`) with fields, relations, components, and dynamic zones
- Querying the REST API with filters, populate, sort, and pagination
- Creating custom controllers, services, routes, policies, or middlewares
- Using the Document Service API for back-end CRUD with draft/publish workflows
- Implementing JWT authentication with the Users & Permissions plugin
- Adding lifecycle hooks to content types for side effects
- Generating TypeScript types for content schemas

**Key patterns covered:**

- Content type schema definition (`schema.json`)
- REST API querying with `qs` (filters, populate, sort, pagination)
- Document Service API (`findMany`, `findOne`, `create`, `update`, `delete`, `publish`, `unpublish`)
- Custom controllers, services, routes, policies, and middlewares
- Lifecycle hooks (`beforeCreate`, `afterUpdate`, etc.)
- JWT authentication (register, login, authenticated requests)
- TypeScript type generation

**When NOT to use:**

- Non-Strapi CMS platforms (use the dedicated skill for your CMS)
- Direct database queries bypassing Strapi's API layer (use Strapi's Document Service)
- Complex transactional logic requiring raw SQL (Strapi abstracts the database)

**Detailed Resources:**

- For decision frameworks and quick-reference tables, see [reference.md](reference.md)

**Core & REST API:**

- [examples/core.md](examples/core.md) -- Content type schemas, REST API querying, Document Service API, error handling

**Backend Customization:**

- [examples/backend.md](examples/backend.md) -- Custom controllers, services, routes, policies, middlewares, lifecycle hooks, Document Service middleware

**Authentication:**

- [examples/auth.md](examples/auth.md) -- JWT authentication, registration, login, roles and permissions

---

<philosophy>

## Philosophy

Strapi is an open-source headless CMS built on Node.js (Koa) that auto-generates RESTful and GraphQL APIs from content type schemas. Content is defined via JSON schemas, managed through an admin panel, and consumed via generated API endpoints.

**Core principles:**

1. **Schema-driven content** -- Content types are defined in `schema.json` files that describe fields, relations, components, and dynamic zones. The admin panel Content-Type Builder provides a visual editor, but schemas are code that lives in your repository.
2. **Auto-generated APIs** -- Every content type automatically gets CRUD REST endpoints (`/api/:pluralApiId`) and optional GraphQL support. No manual route/controller creation needed for standard operations.
3. **Document Service API (v5)** -- The back-end API for accessing content from custom code, plugins, and lifecycle hooks. Replaces v4's Entity Service. Uses `documentId` (not database `id`) as the primary identifier.
4. **Draft & Publish** -- Content types can have draft/publish workflows. The Document Service defaults to `status: 'draft'`; published content requires `status: 'published'` or explicit `publish()` calls.
5. **Permission-first** -- All content type endpoints are private by default. Access must be explicitly granted via the admin panel (Users & Permissions plugin) or API tokens.
6. **Backend customization** -- Controllers, services, routes, policies, and middlewares can all be customized. Strapi follows an MVC-like pattern built on Koa.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Content Type Schema

Content types are defined in `schema.json` files at `./src/api/[api-name]/content-types/[content-type-name]/schema.json`. Use `collectionType` for multi-document content (articles, products) and `singleType` for single-document content (site settings, homepage).

```json
{
  "kind": "collectionType",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article"
  },
  "options": { "draftAndPublish": true },
  "attributes": {
    "title": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "title" },
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::author.author",
      "inversedBy": "articles"
    },
    "blocks": {
      "type": "dynamiczone",
      "components": ["blocks.hero", "blocks.rich-text"]
    }
  }
}
```

**Key fields:** `uid` auto-generates slugs from `targetField`, `relation` types define cardinality with `inversedBy`/`mappedBy`, `component` embeds reusable blocks, `dynamiczone` allows mixed component types. See [examples/core.md](examples/core.md) for full collection and single type examples.

---

### Pattern 2: REST API Querying with `qs`

The REST API accepts complex query parameters for filtering, population, sorting, and pagination. Always use the `qs` library to build query strings.

```typescript
import qs from "qs";

const query = qs.stringify(
  {
    filters: { publishedAt: { $notNull: true } },
    populate: {
      author: { fields: ["name"] },
      categories: { fields: ["name", "slug"] },
    },
    sort: ["publishedAt:desc"],
    pagination: { page: 1, pageSize: 25 },
  },
  { encodeValuesOnly: true },
);
const response = await fetch(`${STRAPI_URL}/api/articles?${query}`);
const { data, meta } = await response.json();
```

**Key points:** `encodeValuesOnly` prevents bracket encoding issues, filters use operators (`$eq`, `$notNull`, `$containsi`, `$or`, `$and`), targeted `populate` with `fields` avoids over-fetching (never use `populate=*` in production), dynamic zone components use `on` syntax. See [examples/core.md](examples/core.md) for full filtering, population, and pagination examples.

---

### Pattern 3: Document Service API (Back-End)

The Document Service API is used in custom controllers, services, lifecycle hooks, and plugins to access content from the server side. It replaces v4's Entity Service (removed in v5).

```typescript
const CONTENT_TYPE_UID = "api::article.article";

// Find published content (default is 'draft')
const articles = await strapi.documents(CONTENT_TYPE_UID).findMany({
  status: "published",
  filters: { categories: { slug: { $eq: "news" } } },
  populate: { author: true },
});

// CRUD uses documentId (not database id)
const article = await strapi
  .documents(CONTENT_TYPE_UID)
  .findOne({ documentId });
const created = await strapi
  .documents(CONTENT_TYPE_UID)
  .create({ data: { title: "New" } });
await strapi.documents(CONTENT_TYPE_UID).publish({ documentId });
```

**Key points:** `strapi.documents(uid)` replaces `strapi.entityService` (removed in v5), `documentId` is the persistent identifier across locales and draft/published versions, default status is `'draft'` (pass `status: 'published'` explicitly), dedicated `publish()`/`unpublish()`/`discardDraft()` methods. See [examples/core.md](examples/core.md) for full CRUD and publish/unpublish examples.

---

### Pattern 4: Custom Controllers

Extend or replace auto-generated controller actions. Controllers handle request/response logic and delegate to services. Use `createCoreController` from `factories` to inherit sanitization helpers.

```typescript
// src/api/article/controllers/article.ts
export default factories.createCoreController(
  "api::article.article",
  ({ strapi }) => ({
    async find(ctx) {
      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const { results, pagination } = await strapi
        .service("api::article.article")
        .find(sanitizedQuery);
      const sanitizedResults = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitizedResults, { pagination });
    },
  }),
);
```

**Why good:** `validateQuery` + `sanitizeQuery` + `sanitizeOutput` enforce role-based field access, `transformResponse()` wraps output in `{ data, meta }` envelope

See [examples/backend.md](examples/backend.md) for full controller examples including custom actions (`findBySlug`, `incrementViews`, `search`).

---

### Pattern 5: Custom Routes

Define custom routes to expose custom controller actions. Custom route files sit alongside the core router.

```typescript
// src/api/article/routes/custom-article.ts
export default {
  routes: [
    {
      method: "GET",
      path: "/articles/slug/:slug",
      handler: "api::article.article.findBySlug",
      config: { auth: false },
    },
  ],
};
```

**Why good:** Separate file from core router, `handler` uses full UID, `auth: false` for public access, policies/middlewares attachable per-route

See [examples/backend.md](examples/backend.md) for route restriction with `only`, middleware attachment, and policy configuration.

---

### Pattern 6: Lifecycle Hooks

Register side effects on content type operations. Hooks are defined in `lifecycles.ts` files alongside the content type schema.

```typescript
// src/api/article/content-types/article/lifecycles.ts
export default {
  async beforeCreate(event) {
    /* event.params.data -- mutate to transform input */
  },
  async afterCreate(event) {
    /* event.result -- the created document */
  },
  async beforeUpdate(event) {
    /* event.params.data -- mutate before save */
  },
  async afterDelete(event) {
    /* event.result -- cleanup related resources */
  },
};
```

**Why good:** Hooks fire automatically on Document Service operations, `beforeXxx` can mutate `event.params.data`, `afterXxx` has `event.result`

**Note:** For cross-cutting concerns in v5 (audit logging, cache invalidation), prefer Document Service middleware (`strapi.documents.use((ctx, next) => { ... })`) registered in `src/index.ts`. Lifecycle hooks are still available for content-type-specific side effects.

See [examples/backend.md](examples/backend.md) for full lifecycle examples including slug generation, programmatic subscription, and audit logging.

---

### Pattern 7: Services

Services contain reusable business logic called by controllers. Use `createCoreService` to inherit default CRUD and add custom methods.

```typescript
export default factories.createCoreService(
  "api::article.article",
  ({ strapi }) => ({
    async findPublished(filters = {}) {
      return strapi
        .documents("api::article.article")
        .findMany({ status: "published", filters });
    },
  }),
);
// Called via: strapi.service("api::article.article").findPublished()
```

**Why good:** Inherits default CRUD, custom methods encapsulate reusable query logic, called from controllers via `strapi.service(uid)`

See [examples/backend.md](examples/backend.md) for complex service examples including related-article queries and publish-with-notification patterns.

---

### Pattern 8: Policies

Policies are read-only functions that allow or deny access to a route. They return `true` (allow) or `false` (deny) and cannot modify the request.

```typescript
// src/api/article/policies/is-owner.ts
export default async (policyContext, config, { strapi }) => {
  const article = await strapi.documents("api::article.article").findOne({
    documentId: policyContext.params.documentId,
    populate: { author: true },
  });
  return article?.author?.documentId === policyContext.state.user?.documentId;
};
```

**Why good:** Read-only check (no request mutation), applied per-action on core router config

See [examples/backend.md](examples/backend.md) for policy application to routes, rate limiting policies, and multi-policy chaining.

</patterns>

---

<decision_framework>

## Decision Framework

### REST API vs Document Service API

```
Where is your code running?
+-- Client-side (browser, frontend app)
|   +-- Use REST API (fetch /api/:pluralApiId)
+-- Server-side (custom controller, service, plugin, lifecycle hook)
    +-- Use Document Service API (strapi.documents(uid))
```

### Population Strategy

```
Do you need related data?
+-- NO --> Don't pass populate (leaner response)
+-- YES --> What level of control?
    +-- All relations, 1 level --> populate: '*' (convenient but over-fetches)
    +-- Specific relations --> populate: { relation: { fields: [...] } }
    +-- Nested relations --> populate: { relation: { populate: { nested: true } } }
    +-- Filtered relations --> populate: { relation: { filters: { ... } } }
```

### Content Type Kind

```
How many documents of this type exist?
+-- Many (articles, products, users) --> collectionType
+-- One (site settings, homepage, footer) --> singleType
```

### Custom Controller vs Default

```
Do default CRUD endpoints meet your needs?
+-- YES --> Use auto-generated routes (no custom controller needed)
+-- NO --> What do you need?
    +-- Modified default behavior --> Override find/findOne/create/update/delete in createCoreController
    +-- Entirely new endpoint --> Add custom action + custom route
    +-- Access control logic --> Add a policy to the route config
    +-- Request transformation --> Add a route middleware
```

### Draft & Publish

```
Does content need editorial review before going live?
+-- YES --> Enable draftAndPublish: true in schema
|   +-- Document Service defaults to status: 'draft'
|   +-- Use publish()/unpublish() to manage lifecycle
|   +-- REST API returns published content by default
+-- NO --> Disable draftAndPublish (content is always live)
```

### Authentication Method

```
Who is consuming the API?
+-- End users (login/register) --> Users & Permissions plugin (JWT)
+-- External services/scripts --> API tokens (admin panel > Settings > API Tokens)
+-- Admin panel users --> Admin API tokens (separate from content API)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Using `strapi.entityService` in v5** -- Entity Service is removed. Use `strapi.documents()` (Document Service API) for all back-end data access.
- **Not populating relations** -- Strapi returns NO relations, media, components, or dynamic zones by default. Forgetting `populate` results in null/missing fields that look like data loss.
- **Using `populate=*` in production** -- Fetches all relations one level deep, including data the user may not have permission to see. Use targeted population with field selection.
- **Manual query string construction** -- Building complex filter/populate URLs by hand breaks with special characters and nested params. Use the `qs` library.
- **Missing sanitization in custom controllers** -- Skipping `sanitizeQuery()`, `sanitizeOutput()`, and `validateQuery()` bypasses permission checks and exposes private fields.

**Medium Priority Issues:**

- **Confusing `documentId` with `id`** -- In v5, `documentId` is the persistent identifier across locales and draft/published versions. The database `id` is an internal integer. REST API and Document Service use `documentId`.
- **Not setting permissions** -- All content type endpoints are private by default. Without configuring permissions in the admin panel, API requests return 403.
- **Assuming default status is published** -- Document Service API defaults to `status: 'draft'`. You must explicitly pass `status: 'published'` to get published content.
- **Using `publicationState` parameter (v4 syntax)** -- Replaced in v5 by `status` parameter and dedicated `publish()`/`unpublish()` methods.
- **Forgetting `encodeValuesOnly: true` in `qs.stringify`** -- Without this option, `qs` encodes array bracket indices, which Strapi's parser may not handle correctly.

**Common Mistakes:**

- **Not awaiting `.commit()` equivalent** -- Document Service methods return promises. Always `await` them.
- **Missing `_type` or `_key` in components** -- Dynamic zone and component fields need `__component` identifiers when creating/updating via the API.
- **Hardcoded Strapi URL** -- Use environment variables (`STRAPI_URL`) for the API base URL; hardcoded `localhost:1337` breaks in production.
- **Mixing pagination methods** -- Use either `page`/`pageSize` OR `start`/`limit`, never both in the same query.

**Gotchas & Edge Cases:**

- **v5 response format is flat** -- v4 nested data in `data.attributes`; v5 puts fields directly on the data object. Existing frontend code from v4 will break.
- **`uid` field type stores slugs** -- The `uid` field type auto-generates URL-safe slugs from a target field. Query slug fields directly as top-level attributes (no nested accessor needed).
- **Bulk lifecycle hooks never fire from Document Service** -- `beforeCreateMany`, `afterDeleteMany`, etc. are database-level hooks. Document Service operations trigger single-document hooks only.
- **Lifecycle hooks are database-level in v5** -- Lifecycle hooks fire on the database layer, so a single Document Service operation (e.g., `publish()`) may trigger multiple database-level hooks. For cross-cutting concerns like logging, validation, and cache invalidation, prefer Document Service middleware (`strapi.documents.use()`) which operates at the Document Service abstraction level.
- **Dynamic zone `populate` uses `on` syntax** -- To populate specific components in a dynamic zone, use `populate: { blocks: { on: { 'blocks.hero': { populate: '*' } } } }`.
- **Media fields are relations internally** -- Media uploads are stored in the `upload` plugin and referenced via relations. They follow the same populate rules as other relations.
- **Draft changes are invisible to REST API by default** -- The REST API returns published content. To see drafts, you need a token with appropriate permissions and the `status=draft` parameter.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `strapi.documents('api::content-type.content-type')` (Document Service API) for all back-end data access in Strapi v5 -- the Entity Service API is removed)**

**(You MUST always pass `populate` when you need relations, media, components, or dynamic zones -- Strapi returns NO relations by default)**

**(You MUST use the `qs` library to build complex REST API query strings with filters, populate, and sort -- manual string construction breaks with nested params)**

**(You MUST sanitize and validate both input and output in custom controllers using `this.sanitizeQuery(ctx)`, `this.sanitizeOutput()`, and `this.validateQuery(ctx)`)**

**(You MUST set permissions for every content type endpoint via the admin panel or config -- all routes are private by default)**

**Failure to follow these rules will cause missing data (no populate), security vulnerabilities (no sanitization), broken queries (no qs), and 403 errors (no permissions).**

</critical_reminders>
