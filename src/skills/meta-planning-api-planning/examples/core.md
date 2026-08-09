# API Planning - Per-Artifact Spec Sections

> Section templates for backend specifications, one per artifact class. Include a section only when the spec touches that artifact class — an endpoint-only change carries no schema section, a schema-only change no endpoint contract. See [../SKILL.md](../SKILL.md) for the frameworks behind each.

---

## API Contract section

Use when the spec adds or changes endpoints. One block per endpoint.

````markdown
<api_contract>

## API Contract

### [METHOD] [/api/path]

**Auth:** [middleware name + permission/role | public]
**Rate Limit:** [limit | none]

**Request:**

| Parameter | Location          | Type   | Required | Description  |
| --------- | ----------------- | ------ | -------- | ------------ |
| [name]    | [path/query/body] | [type] | [yes/no] | [what it is] |

**Success Response:** [status code]

```
{
  // Response shape with field types and descriptions
}
```

**Error Responses:**

| Status | Condition            | Response Body                       |
| ------ | -------------------- | ----------------------------------- |
| 400    | [Validation failure] | `{ error: string, details: [...] }` |
| 401    | [Auth failure]       | `{ error: string }`                 |
| 403    | [Permission failure] | `{ error: string }`                 |
| 404    | [Resource not found] | `{ error: string }`                 |

</api_contract>
````

---

## Database Schema section

Use when the spec adds or changes tables, columns, or indexes. One block per table.

```markdown
<database_schema>

## Database Schema

### Table: [table_name]

**Pattern Source:** [/path/to/similar/schema.ts:lines]

| Column    | Type      | Constraints                   | Purpose            |
| --------- | --------- | ----------------------------- | ------------------ |
| id        | uuid      | PK, default gen_random_uuid() | Primary identifier |
| [name]    | [type]    | [nullable, unique, FK, etc.]  | [Why needed]       |
| createdAt | timestamp | NOT NULL, default now()       | Audit trail        |
| updatedAt | timestamp | NOT NULL, default now()       | Audit trail        |
| deletedAt | timestamp | nullable                      | Soft delete        |

**Relationships:**

- [one-to-many / many-to-many] with [other_table] via [FK / join table]

**Indexes:**

| Columns      | Type               | Purpose                     |
| ------------ | ------------------ | --------------------------- |
| [col1, col2] | [btree/unique/gin] | [Query optimization reason] |

**Migration Strategy:**

- Reversible: [Yes / No — why not]
- Data migration needed: [Yes — describe / No]
- Downtime required: [Yes — why / No]

</database_schema>
```

---

## Middleware Requirements section

Use when the spec adds middleware or changes pipeline order.

```markdown
<middleware_requirements>

## Middleware Requirements

**Request Pipeline Order:**

1. [Rate limiting — if applicable]
2. [Auth middleware — which one]
3. [Input validation — schema reference]
4. [Business logic handler]
5. [Response serialization]

**New Middleware Needed:** [None — reuse existing | Description of what's needed and why existing won't work]

**Existing Middleware to Reuse:**

- [middleware name] from [/path:lines] — [purpose]

</middleware_requirements>
```

---

## Worked example — user profile API

A complete specification using the sections above.

````markdown
# User Profile API

## Goal

Add CRUD endpoints for user profiles so the frontend can display and edit user information.

## Context

**Why:** Frontend team needs profile data for the new dashboard (Issue #456). Currently no profile endpoints exist.

**Current State:**

- Auth: `middleware/auth.ts:12-45` — JWT validation middleware exists
- Users table: `db/schema/users.ts:1-34` — has id, email, passwordHash, createdAt
- Route pattern: `routes/jobs.ts:1-89` — Hono route with OpenAPI registration

**Desired State:** Full profile CRUD with avatar URL support. Frontend calls these endpoints from the dashboard.

## Patterns to Follow

api-developer MUST read these files before implementation:

1. **Route structure:** `routes/jobs.ts:12-67` — Hono createRoute with OpenAPI, response shapes
2. **Schema pattern:** `db/schema/jobs.ts:1-45` — Column naming, soft delete, audit columns
3. **Auth middleware:** `middleware/auth.ts:12-45` — How auth is applied to route groups
4. **Validation:** `lib/validation.ts:1-30` — Zod schema pattern for request validation

## API Contract

### GET /api/v1/profiles/:userId

**Auth:** authMiddleware (any authenticated user, but only own profile returns private fields)
**Rate Limit:** 60/min

**Request:**

| Parameter | Location | Type | Required | Description    |
| --------- | -------- | ---- | -------- | -------------- |
| userId    | path     | uuid | yes      | Target user ID |

**Success Response:** 200

```json
{
  "id": "uuid",
  "displayName": "string",
  "bio": "string | null",
  "avatarUrl": "string | null",
  "createdAt": "ISO 8601"
}
```

**Error Responses:**

| Status | Condition        | Response                    |
| ------ | ---------------- | --------------------------- |
| 401    | No/expired token | `{ error: "Unauthorized" }` |
| 404    | User not found   | `{ error: "Not found" }`    |

### PUT /api/v1/profiles/:userId

**Auth:** authMiddleware + ownerGuard (user can only edit own profile)
**Rate Limit:** 20/min

**Request:**

| Parameter   | Location | Type           | Required | Description      |
| ----------- | -------- | -------------- | -------- | ---------------- |
| userId      | path     | uuid           | yes      | Target user ID   |
| displayName | body     | string (3-100) | no       | Display name     |
| bio         | body     | string (0-500) | no       | Bio text         |
| avatarUrl   | body     | url            | no       | Avatar image URL |

**Success Response:** 200 (updated profile object, same shape as GET)

**Error Responses:**

| Status | Condition          | Response                            |
| ------ | ------------------ | ----------------------------------- |
| 400    | Validation failure | `{ error: string, details: [...] }` |
| 401    | No/expired token   | `{ error: "Unauthorized" }`         |
| 403    | Not profile owner  | `{ error: "Forbidden" }`            |
| 404    | User not found     | `{ error: "Not found" }`            |

## Database Schema

### Table: profiles

**Pattern Source:** `db/schema/jobs.ts:1-45`

| Column      | Type         | Constraints                   | Purpose          |
| ----------- | ------------ | ----------------------------- | ---------------- |
| id          | uuid         | PK, default gen_random_uuid() | Primary key      |
| userId      | uuid         | FK -> users.id, UNIQUE        | Owner reference  |
| displayName | varchar(100) | NOT NULL                      | Public name      |
| bio         | text         | nullable                      | Bio text         |
| avatarUrl   | varchar(500) | nullable                      | Avatar image URL |
| createdAt   | timestamp    | NOT NULL, default now()       | Audit            |
| updatedAt   | timestamp    | NOT NULL, default now()       | Audit            |
| deletedAt   | timestamp    | nullable                      | Soft delete      |

**Relationships:**

- one-to-one with users via userId FK

**Indexes:**

| Columns             | Type   | Purpose                             |
| ------------------- | ------ | ----------------------------------- |
| (userId, deletedAt) | unique | Fast lookup + soft delete filtering |

**Migration Strategy:**

- Reversible: Yes (DROP TABLE profiles)
- Data migration: Create profile row for each existing user with displayName = email prefix
- Downtime: No

## Requirements

**Must Have:**

1. GET /api/v1/profiles/:userId returns profile for any authenticated user
2. PUT /api/v1/profiles/:userId allows owner to update own profile
3. Profile created automatically on user registration (event hook or migration seed)
4. Soft delete check on all queries (isNull(deletedAt))

**Must NOT Have:**

- Avatar upload (separate spec) — only URL storage
- Profile search/listing — not needed for dashboard MVP
- Admin profile editing — separate admin spec

## Success Criteria

**Functional:**

1. GET /api/v1/profiles/:userId returns 200 with profile data for valid user
2. GET /api/v1/profiles/:invalidId returns 404
3. PUT /api/v1/profiles/:userId with valid body returns 200 with updated profile
4. PUT /api/v1/profiles/:userId by non-owner returns 403
5. PUT /api/v1/profiles/:userId with invalid body returns 400 with validation details

**Technical:**

1. All tests pass (`npm test routes/profiles`)
2. OpenAPI spec generates correctly
3. Migration runs and rolls back cleanly
4. Follows route pattern from routes/jobs.ts
5. No changes outside routes/, db/schema/, middleware/
````
