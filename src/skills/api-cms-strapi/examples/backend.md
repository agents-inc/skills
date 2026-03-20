# Strapi Backend Customization Examples

> Custom controllers, services, routes, policies, middlewares, and lifecycle hooks. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for REST API and Document Service patterns.

**Prerequisites**: Understand the Document Service API from core examples first.

---

## Pattern 1: Custom Controller with Sanitization

### Good Example -- Extending Core Controller

```typescript
// src/api/article/controllers/article.ts
import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::article.article",
  ({ strapi }) => ({
    // Override default find with additional logic
    async find(ctx) {
      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);

      const { results, pagination } = await strapi
        .service("api::article.article")
        .find(sanitizedQuery);

      const sanitizedResults = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitizedResults, { pagination });
    },

    // Custom action: find article by slug
    async findBySlug(ctx) {
      const { slug } = ctx.params;

      const article = await strapi.documents("api::article.article").findFirst({
        filters: { slug: { $eq: slug } },
        status: "published",
        populate: { author: true, categories: true, cover: true },
      });

      if (!article) {
        return ctx.notFound("Article not found");
      }

      const sanitized = await this.sanitizeOutput(article, ctx);
      return this.transformResponse(sanitized);
    },

    // Custom action: increment view count
    async incrementViews(ctx) {
      const { documentId } = ctx.params;
      const CONTENT_TYPE_UID = "api::article.article";

      const article = await strapi.documents(CONTENT_TYPE_UID).findOne({
        documentId,
        fields: ["viewCount"],
      });

      if (!article) {
        return ctx.notFound("Article not found");
      }

      const updated = await strapi.documents(CONTENT_TYPE_UID).update({
        documentId,
        data: { viewCount: (article.viewCount || 0) + 1 },
      });

      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    },
  }),
);
```

**Why good:** `validateQuery` throws on invalid query params, `sanitizeQuery` strips fields the user's role can't access, `sanitizeOutput` removes private fields from the response, `transformResponse` wraps output in the standard `{ data, meta }` envelope, `ctx.notFound()` returns proper 404

### Bad Example -- No Sanitization

```typescript
// BAD: Bypasses all permission checks
async find(ctx) {
  const articles = await strapi.documents("api::article.article").findMany({
    populate: "*",
  });
  return { data: articles }; // Exposes private fields, no permission enforcement
}
```

**Why bad:** Skips `sanitizeQuery`, `sanitizeOutput`, and `validateQuery`, which means private fields are exposed and role-based field restrictions are bypassed

---

## Pattern 2: Custom Controller for Non-CRUD Operations

### Good Example -- Custom Business Logic Controller

```typescript
// src/api/article/controllers/article.ts (continued)
import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::article.article",
  ({ strapi }) => ({
    // Custom: Search across multiple fields
    async search(ctx) {
      const { query: searchTerm } = ctx.request.query;

      if (!searchTerm || typeof searchTerm !== "string") {
        return ctx.badRequest("Query parameter 'query' is required");
      }

      const articles = await strapi.documents("api::article.article").findMany({
        status: "published",
        filters: {
          $or: [
            { title: { $containsi: searchTerm } },
            { body: { $containsi: searchTerm } },
          ],
        },
        populate: { author: { fields: ["name"] } },
        sort: [{ publishedAt: "desc" }],
        pagination: { page: 1, pageSize: 20 },
      });

      const sanitized = await this.sanitizeOutput(articles, ctx);
      return this.transformResponse(sanitized);
    },
  }),
);
```

**Why good:** Validates input before querying, `$containsi` for case-insensitive search, `$or` searches across multiple fields, pagination prevents unbounded results, output sanitized

---

## Pattern 3: Custom Routes

### Good Example -- Registering Custom Routes

```typescript
// src/api/article/routes/custom-article.ts
export default {
  routes: [
    {
      method: "GET",
      path: "/articles/slug/:slug",
      handler: "api::article.article.findBySlug",
      config: {
        auth: false, // Public route
      },
    },
    {
      method: "POST",
      path: "/articles/:documentId/views",
      handler: "api::article.article.incrementViews",
      config: {
        auth: false, // Public (no login needed to increment views)
      },
    },
    {
      method: "GET",
      path: "/articles/search",
      handler: "api::article.article.search",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
```

### Good Example -- Restricting Core Routes

```typescript
// src/api/article/routes/article.ts
import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::article.article", {
  // Only expose find and findOne (disable create/update/delete via REST)
  only: ["find", "findOne"],
  config: {
    find: {
      auth: false, // Public listing
      middlewares: ["api::article.populate-defaults"],
    },
    findOne: {
      auth: false, // Public detail
    },
  },
});
```

**Why good:** Core router with `only` limits exposed endpoints (disabling write operations via REST), per-action config applies middlewares and auth settings, custom routes in a separate file to avoid conflicts

---

## Pattern 4: Route Middleware

### Good Example -- Default Population Middleware

```typescript
// src/api/article/middlewares/populate-defaults.ts
export default (config, { strapi }) => {
  return async (ctx, next) => {
    // Set default population if none provided
    if (!ctx.query.populate) {
      ctx.query.populate = {
        author: { fields: ["name"] },
        categories: { fields: ["name", "slug"] },
        cover: { fields: ["url", "alternativeText"] },
      };
    }

    await next();
  };
};
```

**Why good:** Middleware sets sensible default population so consumers don't need to specify it every time, only applies when no populate is explicitly provided, passes through to the next middleware/controller via `await next()`

---

## Pattern 5: Policies

### Good Example -- Owner-Only Policy

```typescript
// src/api/article/policies/is-owner.ts
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;

  if (!user) {
    return false; // Not authenticated
  }

  const { documentId } = policyContext.params;

  const article = await strapi.documents("api::article.article").findOne({
    documentId,
    populate: { author: true },
  });

  if (!article) {
    return false; // Document not found
  }

  // Only allow if the authenticated user is the author
  return article.author?.documentId === user.documentId;
};
```

### Good Example -- Rate Limit Policy

```typescript
// src/policies/rate-limit.ts
const MAX_REQUESTS_PER_MINUTE = 60;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export default async (policyContext, config) => {
  const ip = policyContext.request.ip;
  const now = Date.now();
  const limit = config?.limit || MAX_REQUESTS_PER_MINUTE;
  const windowMs = config?.windowMs || 60_000;

  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false; // Rate limited
  }

  entry.count += 1;
  return true;
};
```

### Applying Policies to Routes

```typescript
// In core router config
export default factories.createCoreRouter("api::article.article", {
  config: {
    update: {
      policies: ["api::article.is-owner"],
    },
    delete: {
      policies: ["api::article.is-owner"],
    },
  },
});

// In custom routes
{
  method: "POST",
  path: "/articles/:documentId/publish",
  handler: "api::article.article.publishArticle",
  config: {
    policies: [
      "api::article.is-owner",
      { name: "global::rate-limit", config: { limit: 10 } },
    ],
  },
}
```

**Why good:** Policies return `true`/`false` (read-only, cannot modify request), inline config passed to configurable policies, multiple policies chain together (all must pass)

---

## Pattern 6: Lifecycle Hooks

### Good Example -- Content Type Lifecycle

```typescript
// src/api/article/content-types/article/lifecycles.ts
export default {
  async beforeCreate(event) {
    const { data } = event.params;

    // Auto-generate slug if not provided
    if (data.title && !data.slug) {
      data.slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  },

  async afterCreate(event) {
    const { result } = event;
    strapi.log.info(
      `Article created: ${result.documentId} - "${result.title}"`,
    );
  },

  async beforeUpdate(event) {
    const { data } = event.params;

    // Trim title whitespace
    if (data.title) {
      data.title = data.title.trim();
    }
  },

  async afterDelete(event) {
    const { result } = event;
    strapi.log.info(`Article deleted: ${result.documentId}`);
    // Cleanup: remove from search index, invalidate cache, etc.
  },
};
```

**Why good:** `beforeCreate` can mutate `event.params.data` to transform input, `afterCreate` has access to `event.result` (the created document), lifecycle hooks run for both REST API and Document Service operations, logging for audit trail

### Good Example -- Programmatic Lifecycle Subscription

```typescript
// src/index.ts -- Register in bootstrap
export default {
  async bootstrap({ strapi }) {
    strapi.db.lifecycles.subscribe({
      models: ["api::article.article"],

      async afterCreate(event) {
        const { result } = event;
        // Send notification, update analytics, etc.
      },
    });
  },
};
```

**Why good:** Programmatic subscription allows subscribing to multiple content types from a single location, useful for cross-cutting concerns like audit logging or search indexing

---

## Pattern 7: Custom Services

### Good Example -- Service with Complex Business Logic

```typescript
// src/api/article/services/article.ts
import { factories } from "@strapi/strapi";

const CONTENT_TYPE_UID = "api::article.article";
const MAX_RELATED_ARTICLES = 5;

export default factories.createCoreService(CONTENT_TYPE_UID, ({ strapi }) => ({
  async findRelated(documentId: string) {
    const article = await strapi.documents(CONTENT_TYPE_UID).findOne({
      documentId,
      populate: { categories: true },
    });

    if (!article?.categories?.length) {
      return [];
    }

    const categoryIds = article.categories.map((c) => c.documentId);

    return strapi.documents(CONTENT_TYPE_UID).findMany({
      status: "published",
      filters: {
        documentId: { $ne: documentId }, // Exclude current article
        categories: { documentId: { $in: categoryIds } },
      },
      sort: [{ publishedAt: "desc" }],
      pagination: { page: 1, pageSize: MAX_RELATED_ARTICLES },
      populate: { cover: { fields: ["url", "alternativeText"] } },
    });
  },

  async publishAndNotify(documentId: string) {
    const result = await strapi.documents(CONTENT_TYPE_UID).publish({
      documentId,
    });

    // Trigger side effects after publishing
    const article = await strapi.documents(CONTENT_TYPE_UID).findOne({
      documentId,
      status: "published",
      populate: { author: true },
    });

    strapi.log.info(`Article published: ${article?.title}`);

    return result;
  },
}));
```

**Why good:** Service encapsulates reusable business logic, named constant for limit, `$ne` filter excludes the current document, `$in` matches any of the category IDs, called from controllers via `strapi.service('api::article.article').findRelated(id)`

---

_For REST API and Document Service patterns, see [core.md](core.md). For authentication, see [auth.md](auth.md)._
