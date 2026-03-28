# Strapi Reference

> CLI commands, REST API operators, filter cheat sheet, and quick-lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Strapi CLI Commands

### Project Setup

```bash
# Create a new Strapi project
npx create-strapi-app@latest my-project

# Create with TypeScript (default in v5)
npx create-strapi-app@latest my-project --typescript

# Start development server (default: http://localhost:1337)
npm run develop

# Start production server
npm run start

# Build admin panel
npm run build
```

### Type Generation

```bash
# Generate TypeScript types from content schemas
npm run strapi ts:generate-types

# With debug output
npm run strapi ts:generate-types --debug
```

### Content Management

```bash
# Interactive generator (select api, controller, service, content-type, policy, middleware, or migration)
npm run strapi generate
```

---

## Environment Variables

```bash
# .env
HOST=0.0.0.0
PORT=1337
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret

# Database (default: SQLite)
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
DATABASE_SSL=false
```

---

## REST API Endpoints

### Collection Types

| Method | URL                             | Purpose          |
| ------ | ------------------------------- | ---------------- |
| GET    | `/api/:pluralApiId`             | List documents   |
| POST   | `/api/:pluralApiId`             | Create document  |
| GET    | `/api/:pluralApiId/:documentId` | Get one document |
| PUT    | `/api/:pluralApiId/:documentId` | Update document  |
| DELETE | `/api/:pluralApiId/:documentId` | Delete document  |

### Single Types

| Method | URL                   | Purpose             |
| ------ | --------------------- | ------------------- |
| GET    | `/api/:singularApiId` | Get the document    |
| PUT    | `/api/:singularApiId` | Update the document |
| DELETE | `/api/:singularApiId` | Delete the document |

### Authentication (Users & Permissions)

| Method | URL                            | Purpose                |
| ------ | ------------------------------ | ---------------------- |
| POST   | `/api/auth/local`              | Login (JWT)            |
| POST   | `/api/auth/local/register`     | Register user          |
| POST   | `/api/auth/forgot-password`    | Request password reset |
| POST   | `/api/auth/reset-password`     | Reset with token       |
| GET    | `/api/auth/email-confirmation` | Confirm email          |
| POST   | `/api/auth/refresh`            | Refresh JWT \*         |
| POST   | `/api/auth/logout`             | Revoke session \*      |
| GET    | `/api/users/me`                | Get current user       |

\* Requires `jwtManagement: 'refresh'` in Users & Permissions plugin config (session management mode).

### Media Upload

| Method | URL                     | Purpose        |
| ------ | ----------------------- | -------------- |
| POST   | `/api/upload`           | Upload file(s) |
| GET    | `/api/upload/files`     | List files     |
| GET    | `/api/upload/files/:id` | Get file       |
| DELETE | `/api/upload/files/:id` | Delete file    |

---

## REST API Response Format (v5)

```json
{
  "data": {
    "id": 1,
    "documentId": "a1b2c3d4e5f6g7h8i9j0klm",
    "title": "Article Title",
    "slug": "article-title",
    "publishedAt": "2025-01-15T10:00:00.000Z",
    "createdAt": "2025-01-14T08:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  },
  "meta": {}
}
```

**v5 change:** Fields are at the top level of `data`, NOT nested under `data.attributes` like in v4.

---

## Filter Operators

### Comparison

| Operator | Description              | Example                      |
| -------- | ------------------------ | ---------------------------- |
| `$eq`    | Equal                    | `filters[title][$eq]=Hello`  |
| `$eqi`   | Equal (case-insensitive) | `filters[title][$eqi]=hello` |
| `$ne`    | Not equal                | `filters[title][$ne]=Hello`  |
| `$nei`   | Not equal (case-insens.) | `filters[title][$nei]=hello` |
| `$lt`    | Less than                | `filters[rating][$lt]=5`     |
| `$lte`   | Less than or equal       | `filters[rating][$lte]=5`    |
| `$gt`    | Greater than             | `filters[rating][$gt]=3`     |
| `$gte`   | Greater than or equal    | `filters[rating][$gte]=3`    |

### String

| Operator        | Description                  | Example                               |
| --------------- | ---------------------------- | ------------------------------------- |
| `$contains`     | Contains substring           | `filters[title][$contains]=strapi`    |
| `$notContains`  | Does not contain             | `filters[title][$notContains]=draft`  |
| `$containsi`    | Contains (case-insensitive)  | `filters[title][$containsi]=Strapi`   |
| `$notContainsi` | Not contains (case-insens.)  | `filters[title][$notContainsi]=Draft` |
| `$startsWith`   | Starts with                  | `filters[title][$startsWith]=How`     |
| `$startsWithi`  | Starts with (case-insens.)   | `filters[title][$startsWithi]=how`    |
| `$endsWith`     | Ends with                    | `filters[slug][$endsWith]=-guide`     |
| `$endsWithi`    | Ends with (case-insensitive) | `filters[slug][$endsWithi]=-Guide`    |

### Array and Null

| Operator   | Description   | Example                                          |
| ---------- | ------------- | ------------------------------------------------ |
| `$in`      | In array      | `filters[status][$in][0]=draft&...[1]=published` |
| `$notIn`   | Not in array  | `filters[status][$notIn][0]=archived`            |
| `$null`    | Is null       | `filters[publishedAt][$null]=true`               |
| `$notNull` | Is not null   | `filters[publishedAt][$notNull]=true`            |
| `$between` | Between range | `filters[rating][$between][0]=3&...[1]=5`        |

### Logical

| Operator | Description        | Usage                                                  |
| -------- | ------------------ | ------------------------------------------------------ |
| `$and`   | All must match     | `filters[$and][0][title][$eq]=A&...[1][rating][$gt]=3` |
| `$or`    | At least one match | `filters[$or][0][title][$eq]=A&...[1][title][$eq]=B`   |
| `$not`   | Negate condition   | `filters[$not][0][title][$eq]=Hidden`                  |

---

## Sort and Pagination

### Sorting

| Pattern           | Syntax                                       |
| ----------------- | -------------------------------------------- |
| Single ascending  | `sort=title` or `sort=title:asc`             |
| Single descending | `sort=title:desc`                            |
| Multiple fields   | `sort[0]=title:asc&sort[1]=publishedAt:desc` |

### Pagination (Page-Based)

| Parameter               | Type    | Default |
| ----------------------- | ------- | ------- |
| `pagination[page]`      | Integer | 1       |
| `pagination[pageSize]`  | Integer | 25      |
| `pagination[withCount]` | Boolean | true    |

### Pagination (Offset-Based)

| Parameter               | Type    | Default |
| ----------------------- | ------- | ------- |
| `pagination[start]`     | Integer | 0       |
| `pagination[limit]`     | Integer | 25      |
| `pagination[withCount]` | Boolean | true    |

**Note:** Never mix page-based and offset-based pagination in the same query.

---

## Document Service API Methods

| Method           | Signature                                                | Description                 |
| ---------------- | -------------------------------------------------------- | --------------------------- |
| `findMany()`     | `(params) => Document[]`                                 | List documents with filters |
| `findOne()`      | `({ documentId, ...params }) => Document`                | Get one by documentId       |
| `findFirst()`    | `(params) => Document`                                   | First matching document     |
| `create()`       | `({ data, ...params }) => Document`                      | Create draft document       |
| `update()`       | `({ documentId, data, ...params }) => Document`          | Update draft version        |
| `delete()`       | `({ documentId, ...params }) => { documentId, entries }` | Delete document             |
| `publish()`      | `({ documentId, ...params }) => { documentId, entries }` | Publish draft               |
| `unpublish()`    | `({ documentId, ...params }) => { documentId, entries }` | Unpublish to draft          |
| `discardDraft()` | `({ documentId, ...params }) => { documentId, entries }` | Revert draft to published   |
| `count()`        | `(params) => number`                                     | Count matching documents    |

**Common params:** `locale`, `status`, `filters`, `fields`, `populate`, `sort`, `pagination`

---

## Content Type Schema Field Types

| Type          | Description                             |
| ------------- | --------------------------------------- |
| `string`      | Short text (up to 255 characters)       |
| `text`        | Long text (no character limit)          |
| `richtext`    | Rich text with Markdown support         |
| `blocks`      | Block-based rich text editor (v5)       |
| `integer`     | Whole number                            |
| `biginteger`  | Large whole number                      |
| `float`       | Decimal number (float)                  |
| `decimal`     | Decimal number (precise)                |
| `boolean`     | True/false                              |
| `date`        | Date without time                       |
| `time`        | Time without date                       |
| `datetime`    | Date and time                           |
| `email`       | Validated email string                  |
| `password`    | Hashed password (never returned in API) |
| `uid`         | URL-safe unique identifier (slug)       |
| `enumeration` | Predefined set of string values         |
| `json`        | Arbitrary JSON data                     |
| `media`       | File upload (images, videos, documents) |
| `relation`    | Reference to another content type       |
| `component`   | Embedded reusable component             |
| `dynamiczone` | Array of mixed component types          |

---

## Relation Types

| Relation     | Description                 | Schema syntax              |
| ------------ | --------------------------- | -------------------------- |
| `oneToOne`   | One document links to one   | `"relation": "oneToOne"`   |
| `oneToMany`  | One document links to many  | `"relation": "oneToMany"`  |
| `manyToOne`  | Many documents link to one  | `"relation": "manyToOne"`  |
| `manyToMany` | Many documents link to many | `"relation": "manyToMany"` |

Use `inversedBy` / `mappedBy` to define bidirectional relations.

---

## Lifecycle Hook Events

| Hook             | Trigger                        |
| ---------------- | ------------------------------ |
| `beforeCreate`   | Before a document is created   |
| `afterCreate`    | After a document is created    |
| `beforeUpdate`   | Before a document is updated   |
| `afterUpdate`    | After a document is updated    |
| `beforeDelete`   | Before a document is deleted   |
| `afterDelete`    | After a document is deleted    |
| `beforeFindOne`  | Before a single document query |
| `afterFindOne`   | After a single document query  |
| `beforeFindMany` | Before a list query            |
| `afterFindMany`  | After a list query             |
| `beforeCount`    | Before a count query           |
| `afterCount`     | After a count query            |

**Event object properties:** `action`, `params` (`data`, `where`, `select`, `populate`, `orderBy`, `limit`, `offset`), `result` (after hooks only), `state` (shared between before/after)

---

## File Structure

```
src/
  api/
    article/
      content-types/
        article/
          schema.json         # Content type definition
          lifecycles.ts       # Lifecycle hooks
      controllers/
        article.ts            # Core + custom controller
      services/
        article.ts            # Core + custom service
      routes/
        article.ts            # Core router
        custom-article.ts     # Custom routes
      policies/
        is-owner.ts           # Custom policy
      middlewares/
        analytics.ts          # Route middleware
  components/
    shared/
      seo.json                # Reusable component schema
    blocks/
      hero.json               # Dynamic zone component
  extensions/                 # Plugin customizations
config/
  api.ts                      # API config (pagination defaults)
  database.ts                 # Database connection
  middlewares.ts              # Global middleware config
  plugins.ts                  # Plugin config
  server.ts                   # Server config (host, port)
```
