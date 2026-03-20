# Payload CMS Reference

> Quick lookup tables, CLI commands, type generation, and decision frameworks. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## CLI Commands

### Project Setup

```bash
# Create a new Payload project
npx create-payload-app@latest

# Start development server
pnpm dev

# Generate TypeScript types from your config
pnpm payload generate:types
```

### Database Migrations (Postgres/SQLite)

```bash
# Create a new migration
pnpm payload migrate:create

# Run pending migrations
pnpm payload migrate

# Check migration status
pnpm payload migrate:status

# Reset database (drops all tables, re-runs migrations)
pnpm payload migrate:reset

# Push schema directly (dev only — NOT for production)
pnpm payload migrate:fresh
```

---

## Environment Variables

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/mydb
# or
DATABASE_URI=mongodb://localhost:27017/mydb

PAYLOAD_SECRET=your-secret-key-min-32-chars
```

---

## Field Types Quick Reference

| Type           | Data Shape         | Use For                                    |
| -------------- | ------------------ | ------------------------------------------ |
| `text`         | `string`           | Short text, titles, slugs                  |
| `textarea`     | `string`           | Multi-line text, excerpts                  |
| `richText`     | `object` (Lexical) | Rich content with formatting               |
| `number`       | `number`           | Prices, quantities, ratings                |
| `email`        | `string`           | Email addresses (validated)                |
| `checkbox`     | `boolean`          | Toggle flags                               |
| `date`         | `string` (ISO)     | Dates and timestamps                       |
| `select`       | `string`           | Dropdown single choice                     |
| `radio`        | `string`           | Radio button single choice                 |
| `json`         | `object`           | Arbitrary JSON data                        |
| `code`         | `string`           | Code snippets with syntax highlighting     |
| `point`        | `[number, number]` | Geographic coordinates                     |
| `relationship` | `string` (ID)      | Reference to another document              |
| `upload`       | `string` (ID)      | Reference to a media/file document         |
| `group`        | `object`           | Nested object with sub-fields              |
| `array`        | `object[]`         | Repeatable rows of same-shape fields       |
| `blocks`       | `object[]`         | Flexible content with multiple block types |
| `tabs`         | _(layout only)_    | Tabbed sections in admin UI                |
| `row`          | _(layout only)_    | Side-by-side fields in admin UI            |
| `collapsible`  | _(layout only)_    | Collapsible section in admin UI            |

---

## Collection Hook Execution Order

```
CREATE:
  beforeOperation → beforeValidate → beforeChange → [DB write] → afterChange → afterOperation

UPDATE:
  beforeOperation → beforeValidate → beforeChange → [DB write] → afterChange → afterOperation

DELETE:
  beforeOperation → beforeDelete → [DB delete] → afterDelete → afterOperation

READ:
  beforeOperation → beforeRead → [DB read] → afterRead → afterOperation
```

---

## Hook Arguments Quick Reference

| Hook              | Key Arguments                                    | Returns  |
| ----------------- | ------------------------------------------------ | -------- |
| `beforeValidate`  | `data`, `operation`, `originalDoc`, `req`        | `data`   |
| `beforeChange`    | `data`, `operation`, `originalDoc`, `req`        | `data`   |
| `afterChange`     | `doc`, `data`, `previousDoc`, `operation`, `req` | `doc`    |
| `beforeRead`      | `doc`, `query`, `req`                            | `doc`    |
| `afterRead`       | `doc`, `query`, `req`                            | `doc`    |
| `beforeDelete`    | `id`, `req`                                      | _(void)_ |
| `afterDelete`     | `doc`, `id`, `req`                               | _(void)_ |
| `beforeOperation` | `collection`, `operation`, `req`                 | _(void)_ |
| `afterOperation`  | `result`, `args`, `operation`, `req`             | `result` |

**Auth-only hooks:** `beforeLogin`, `afterLogin`, `afterLogout`, `afterRefresh`, `afterMe`, `afterForgotPassword`

---

## Access Control Function Signatures

| Operation | Arguments           | Returns            |
| --------- | ------------------- | ------------------ |
| `create`  | `{ req, data }`     | `boolean`          |
| `read`    | `{ req, id }`       | `boolean \| Where` |
| `update`  | `{ req, id, data }` | `boolean \| Where` |
| `delete`  | `{ req, id }`       | `boolean \| Where` |
| `admin`   | `{ req }`           | `boolean`          |
| `unlock`  | `{ req }`           | `boolean`          |

**Field access:** `create`, `read`, `update` — same pattern but on individual fields.

**Where query return:** When an access function returns a `Where` query instead of a boolean, Payload appends it to the database query, scoping results without denying access entirely.

---

## Local API Operations

| Operation          | Method                     | Returns                    |
| ------------------ | -------------------------- | -------------------------- |
| Find (paginated)   | `payload.find()`           | `{ docs, totalDocs, ... }` |
| Find by ID         | `payload.findByID()`       | Single document            |
| Create             | `payload.create()`         | Created document           |
| Update by ID/where | `payload.update()`         | Updated document(s)        |
| Delete by ID/where | `payload.delete()`         | Deleted document(s)        |
| Count              | `payload.count()`          | `{ totalDocs }`            |
| Read global        | `payload.findGlobal()`     | Global document            |
| Update global      | `payload.updateGlobal()`   | Updated global             |
| Login              | `payload.login()`          | `{ token, user, exp }`     |
| Auth check         | `payload.auth()`           | `{ user, permissions }`    |
| Restore version    | `payload.restoreVersion()` | Restored document          |

**Common options:** `overrideAccess` (default: `true`), `depth`, `locale`, `select`, `where`, `sort`, `limit`, `page`

---

## REST API Endpoints

| Method   | Endpoint                           | Operation        |
| -------- | ---------------------------------- | ---------------- |
| `GET`    | `/api/{slug}`                      | Find (paginated) |
| `GET`    | `/api/{slug}/:id`                  | Find by ID       |
| `POST`   | `/api/{slug}`                      | Create           |
| `PATCH`  | `/api/{slug}/:id`                  | Update           |
| `DELETE` | `/api/{slug}/:id`                  | Delete           |
| `GET`    | `/api/{slug}/count`                | Count            |
| `GET`    | `/api/globals/{slug}`              | Read global      |
| `POST`   | `/api/globals/{slug}`              | Update global    |
| `POST`   | `/api/{auth-slug}/login`           | Login            |
| `POST`   | `/api/{auth-slug}/logout`          | Logout           |
| `GET`    | `/api/{auth-slug}/me`              | Current user     |
| `POST`   | `/api/{auth-slug}/forgot-password` | Forgot password  |
| `POST`   | `/api/{auth-slug}/reset-password`  | Reset password   |

---

## TypeScript Type Generation

```bash
# Generate types from your Payload config
pnpm payload generate:types
# Output: src/payload-types.ts (or path in config)
```

```typescript
// Usage in your code
import type { Post, User, Media } from "./payload-types";

// Types are auto-generated from your collection configs
// They update when you change fields and re-run generate:types
```

---

## Project Structure

```
my-app/
  payload.config.ts          # Main Payload config
  src/
    payload-types.ts         # Auto-generated TypeScript types
    collections/
      posts.ts               # Collection config
      users.ts               # Auth collection config
      media.ts               # Upload collection config
    globals/
      site-settings.ts       # Global config
      navigation.ts          # Global config
    access/
      index.ts               # Reusable access control functions
    hooks/
      set-author.ts          # Hook: auto-set author
      revalidate-cache.ts    # Hook: cache invalidation
    fields/
      layout-blocks.ts       # Reusable block definitions
```
