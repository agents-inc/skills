# Strapi Core Examples

> Content type schemas, REST API querying, Document Service API, and error handling. See [SKILL.md](../SKILL.md) for core concepts.

**Backend customization:** See [backend.md](backend.md). **Authentication:** See [auth.md](auth.md).

---

## Pattern 1: Content Type Schemas

### Good Example -- Collection Type

```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article",
    "description": "Blog articles"
  },
  "options": {
    "draftAndPublish": true
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "maxLength": 120
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    },
    "body": {
      "type": "richtext"
    },
    "cover": {
      "type": "media",
      "allowedTypes": ["images"],
      "multiple": false
    },
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::author.author",
      "inversedBy": "articles"
    },
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "inversedBy": "articles"
    },
    "seo": {
      "type": "component",
      "component": "shared.seo",
      "required": false
    },
    "blocks": {
      "type": "dynamiczone",
      "components": ["blocks.hero", "blocks.rich-text", "blocks.gallery"]
    }
  }
}
```

**Why good:** `draftAndPublish: true` enables draft/publish workflow, `uid` auto-generates slugs from `targetField`, `media` restricts to images, relation types define cardinality with `inversedBy`, component and dynamic zone fields compose reusable blocks

### Good Example -- Single Type

```json
{
  "kind": "singleType",
  "collectionName": "site_settings",
  "info": {
    "singularName": "site-setting",
    "pluralName": "site-settings",
    "displayName": "Site Settings"
  },
  "attributes": {
    "siteName": {
      "type": "string",
      "required": true
    },
    "logo": {
      "type": "media",
      "allowedTypes": ["images"]
    },
    "defaultSeo": {
      "type": "component",
      "component": "shared.seo"
    }
  }
}
```

**Why good:** `singleType` creates a single-document endpoint (`GET /api/site-setting`) for global config like site settings, navigation, or footer content

---

## Pattern 2: REST API -- Fetching with qs

### Good Example -- Typed Fetch with Filters, Populate, and Pagination

```typescript
import qs from "qs";

const STRAPI_URL = process.env.STRAPI_URL;
const DEFAULT_PAGE_SIZE = 25;

interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

interface Article {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  author?: { id: number; documentId: string; name: string };
  categories?: Array<{
    id: number;
    documentId: string;
    name: string;
    slug: string;
  }>;
  cover?: {
    url: string;
    alternativeText: string;
    width: number;
    height: number;
  };
}

async function fetchArticles(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<StrapiResponse<Article[]>> {
  const query = qs.stringify(
    {
      filters: {
        publishedAt: { $notNull: true },
      },
      populate: {
        author: { fields: ["name"] },
        categories: { fields: ["name", "slug"] },
        cover: { fields: ["url", "alternativeText", "width", "height"] },
      },
      sort: ["publishedAt:desc"],
      pagination: { page, pageSize },
    },
    { encodeValuesOnly: true },
  );

  const response = await fetch(`${STRAPI_URL}/api/articles?${query}`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch articles: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
```

**Why good:** `qs.stringify` with `encodeValuesOnly` handles nested params correctly, targeted populate with field selection avoids over-fetching, named constant for page size, typed response interface matches v5 flat format, error handling for non-OK responses

### Bad Example -- Manual Query String

```typescript
// BAD: Manual query string construction
const url = `/api/articles?populate=*&filters[title][$contains]=${userInput}`;
const data = await fetch(url).then((r) => r.json());
```

**Why bad:** `populate=*` over-fetches all relations (security risk), user input not encoded (XSS/injection), no error handling, missing pagination leads to unbounded result sets

---

## Pattern 3: REST API -- Complex Filters

### Good Example -- Logical Operators with qs

```typescript
// Find articles in "tech" OR "science" categories, published after a date
const MIN_DATE = "2025-01-01";

const query = qs.stringify(
  {
    filters: {
      $and: [
        { publishedAt: { $gte: MIN_DATE } },
        {
          $or: [
            { categories: { slug: { $eq: "technology" } } },
            { categories: { slug: { $eq: "science" } } },
          ],
        },
      ],
    },
    populate: {
      categories: { fields: ["name", "slug"] },
    },
    sort: ["publishedAt:desc"],
    pagination: { page: 1, pageSize: 10 },
  },
  { encodeValuesOnly: true },
);
```

**Why good:** `$and` and `$or` compose complex queries, relation fields can be filtered directly, named constant for the date threshold, pagination prevents unbounded results

---

## Pattern 4: REST API -- Fetching Single Document by Slug

### Good Example -- Find by Slug with Deep Population

```typescript
async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  const query = qs.stringify(
    {
      filters: { slug: { $eq: slug } },
      populate: {
        author: { fields: ["name", "email"] },
        categories: { fields: ["name", "slug"] },
        cover: { fields: ["url", "alternativeText", "width", "height"] },
        seo: { populate: "*" }, // Component population
        blocks: {
          on: {
            "blocks.hero": { populate: { background: { fields: ["url"] } } },
            "blocks.rich-text": { populate: "*" },
            "blocks.gallery": {
              populate: { images: { fields: ["url", "alternativeText"] } },
            },
          },
        },
      },
    },
    { encodeValuesOnly: true },
  );

  const response = await fetch(`${STRAPI_URL}/api/articles?${query}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const { data } = await response.json();
  return data.length > 0 ? data[0] : null;
}
```

**Why good:** Filters by slug to get a specific article, component populated via nested populate, dynamic zone uses `on` syntax to populate per-component type, returns `null` when not found instead of crashing, separate field selection per relation

---

## Pattern 5: REST API -- Creating and Updating

### Good Example -- Create a Document

```typescript
async function createArticle(
  articleData: { title: string; body: string; slug: string },
  token: string,
): Promise<Article> {
  const response = await fetch(`${STRAPI_URL}/api/articles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: articleData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to create article: ${error.error?.message || response.statusText}`,
    );
  }

  const { data } = await response.json();
  return data;
}
```

### Good Example -- Update a Document

```typescript
async function updateArticle(
  documentId: string,
  updates: Partial<{ title: string; body: string }>,
  token: string,
): Promise<Article> {
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: updates }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to update article: ${error.error?.message || response.statusText}`,
    );
  }

  const { data } = await response.json();
  return data;
}
```

**Why good:** Request body wraps fields in `data` (required by Strapi), `Authorization: Bearer` header for JWT, error response parsed for descriptive error messages, `PUT` for updates uses `documentId` in the URL path

### Bad Example -- Missing Data Wrapper

```typescript
// BAD: Fields not wrapped in data object
await fetch(`${STRAPI_URL}/api/articles`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "New Article", body: "Content..." }),
  // Missing: { data: { title: "...", body: "..." } }
});
```

**Why bad:** Strapi expects request body in `{ data: { ...fields } }` format, sending fields at the top level results in empty document creation

---

## Pattern 6: REST API -- Delete and Media Upload

### Good Example -- Delete Document

```typescript
async function deleteArticle(documentId: string, token: string): Promise<void> {
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete article: ${response.statusText}`);
  }
}
```

### Good Example -- Upload Media

```typescript
async function uploadMedia(file: File, token: string) {
  const formData = new FormData();
  formData.append("files", file);

  const response = await fetch(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    // No Content-Type header -- FormData sets it with boundary
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload: ${response.statusText}`);
  }

  const uploadedFiles = await response.json();
  return uploadedFiles[0]; // Returns array of uploaded files
}

// Link uploaded media to a document
async function setArticleCover(
  documentId: string,
  mediaId: number,
  token: string,
) {
  await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: { cover: mediaId } }),
  });
}
```

**Why good:** DELETE returns 204 with no body (handle accordingly), media upload uses FormData without explicit Content-Type header, uploaded file ID used to link media to a content field

---

## Pattern 7: Document Service API -- Server-Side CRUD

### Good Example -- Service with Document Service API

```typescript
// src/api/article/services/article.ts
import { factories } from "@strapi/strapi";

const CONTENT_TYPE_UID = "api::article.article";

export default factories.createCoreService(CONTENT_TYPE_UID, ({ strapi }) => ({
  async findPublished(filters = {}) {
    return strapi.documents(CONTENT_TYPE_UID).findMany({
      status: "published",
      filters,
      populate: { author: true, categories: true },
      sort: [{ publishedAt: "desc" }],
    });
  },

  async findBySlug(slug: string) {
    const article = await strapi.documents(CONTENT_TYPE_UID).findFirst({
      filters: { slug: { $eq: slug } },
      status: "published",
      populate: { author: true, categories: true, cover: true },
    });

    return article; // null if not found
  },

  async publishArticle(documentId: string) {
    return strapi.documents(CONTENT_TYPE_UID).publish({ documentId });
  },
}));
```

**Why good:** `createCoreService` inherits default CRUD methods, custom methods use Document Service for type-safe access, `status: 'published'` explicitly requests published content, `findFirst()` returns single document or null

### Bad Example -- Using Entity Service (v4 API)

```typescript
// BAD: Entity Service is removed in Strapi v5
const articles = await strapi.entityService.findMany("api::article.article", {
  filters: { publishedAt: { $notNull: true } },
  populate: { author: true },
});
```

**Why bad:** `strapi.entityService` does not exist in Strapi v5, use `strapi.documents()` instead

---

## Pattern 8: Error Handling

### Good Example -- Consistent Error Handling for REST API

```typescript
class StrapiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "StrapiError";
    this.status = status;
    this.details = details;
  }
}

async function strapiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<StrapiResponse<T>> {
  const url = `${STRAPI_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new StrapiError(
      errorBody?.error?.message || `Request failed: ${response.statusText}`,
      response.status,
      errorBody?.error?.details,
    );
  }

  // DELETE returns 204 with no body
  if (response.status === 204) {
    return { data: null as T, meta: {} };
  }

  return response.json();
}
```

**Why good:** Custom error class preserves HTTP status and Strapi error details, handles 204 (no body) from DELETE operations, reusable for all REST API calls, Strapi error format (`error.message`, `error.details`) extracted

---

_For backend customization patterns, see [backend.md](backend.md). For authentication, see [auth.md](auth.md)._
