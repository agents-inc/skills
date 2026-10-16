# API Planning - Per-Artifact Spec Sections

> The section templates behind the patterns in [SKILL.md](../SKILL.md), one per artifact class, then a worked specification built from them. A spec includes a section only for the artifact classes it touches.

---

## API Contract section

One block per endpoint the spec adds or changes (Patterns 1–3).

````markdown
<api_contract>

## API Contract

### [METHOD] [/api/path]

**Pattern source:** [route file:lines whose naming, pagination and envelope this follows]
**Consumers:** [who calls this, and what breaks for each if the shape changes]
**Auth:** [middleware + permission or ownership rule | public]
**Rate limit:** [limit, and what it is keyed by | none]

**Request:**

| Parameter | Location          | Type              | Required | Description  |
| --------- | ----------------- | ----------------- | -------- | ------------ |
| [name]    | [path/query/body] | [type and limits] | [yes/no] | [what it is] |

**Success response:** [status code]

```
{
  // Response shape with field types
}
```

**Error responses:**

| Status | Condition            | Response Body                       |
| ------ | -------------------- | ----------------------------------- |
| 400    | [Validation failure] | `{ error: string, details: [...] }` |
| 401    | [Auth failure]       | `{ error: string }`                 |
| 403    | [Permission failure] | `{ error: string }`                 |
| 404    | [Resource not found] | `{ error: string }`                 |
| 429    | [Rate limited]       | `{ error: string }` + `Retry-After` |

</api_contract>
````

---

## Database Schema section

One block per table the spec adds or changes (Patterns 4–5).

```markdown
<database_schema>

## Database Schema

### Table: [table_name]

**Pattern source:** [/path/to/similar/schema.ts:lines]

| Column    | Type      | Constraints                  | Purpose            |
| --------- | --------- | ---------------------------- | ------------------ |
| id        | uuid      | PK, generated                | Primary identifier |
| [name]    | [type]    | [nullable, unique, FK, etc.] | [Why needed]       |
| createdAt | timestamp | NOT NULL, default now()      | Audit trail        |
| updatedAt | timestamp | NOT NULL, default now()      | Audit trail        |
| deletedAt | timestamp | nullable                     | Soft delete        |

**Relationships:**

- [one-to-many / many-to-many] with [other_table] via [FK / join table]

**Indexes:**

| Columns      | Kind                              | Unique   | Rows indexed                    | Serves                               |
| ------------ | --------------------------------- | -------- | ------------------------------- | ------------------------------------ |
| [col1, col2] | [ordinary / full-text / inverted] | [yes/no] | [all / where deletedAt is null] | [the query, or the rule it enforces] |

**Queries:** [every read, update and delete filters on deletedAt is null | the exceptions, and why]

**Migration strategy:**

- Reversible: [Yes — how / No — why that is acceptable]
- Data migration: [None / the source of the backfilled values, and the batch plan]
- Downtime: [None — including whether index builds run online / Yes — why, and the window]

</database_schema>
```

---

## Middleware Requirements section

One section when the spec adds middleware or changes pipeline order (Pattern 6).

```markdown
<middleware_requirements>

## Middleware Requirements

**Request pipeline order:**

1. [Rate limit keyed by IP — if applicable]
2. [Auth middleware — which one]
3. [Rate limit keyed by user or API key — if applicable]
4. [Input validation — schema reference]
5. [Handler]
6. [Response serialization]

**New middleware needed:** [None — reuse existing | what is needed, and why existing middleware cannot cover it]

**Existing middleware to reuse:**

- [middleware name] from [/path:lines] — [purpose]

**Transaction boundaries:** [which steps commit together | none — every operation is a single write]

</middleware_requirements>
```

---

## Worked example — user profile API

The API sections of a specification for reading and editing user profiles. The goal, scope fence and success criteria around them come from the planning process and are left out.

````markdown
# User Profile API

<api_contract>

## API Contract

### GET /api/v1/profiles/:userId

**Pattern source:** `routes/jobs.ts:12-67` — route registration and response envelope
**Consumers:** the dashboard's new profile page; nothing calls these endpoints today
**Auth:** authMiddleware — any authenticated user; every field below is public
**Rate limit:** 60/min, keyed by user

**Request:**

| Parameter | Location | Type | Required | Description    |
| --------- | -------- | ---- | -------- | -------------- |
| userId    | path     | uuid | yes      | Target user ID |

**Success response:** 200

```json
{
  "id": "uuid",
  "displayName": "string",
  "bio": "string | null",
  "avatarUrl": "string | null",
  "createdAt": "ISO 8601"
}
```

**Error responses:**

| Status | Condition           | Response                                    |
| ------ | ------------------- | ------------------------------------------- |
| 401    | No/expired token    | `{ error: "Unauthorized" }`                 |
| 404    | No live profile     | `{ error: "Not found" }`                    |
| 429    | Rate limit exceeded | `{ error: "Rate limited" }` + `Retry-After` |

### PATCH /api/v1/profiles/:userId

**Pattern source:** `routes/jobs.ts:12-67`
**Consumers:** the dashboard's new profile page
**Auth:** authMiddleware + ownerGuard — the caller's own profile only
**Rate limit:** 20/min, keyed by user

**Request:** every body field is optional, and a field left out keeps its value.

| Parameter   | Location | Type           | Required | Description      |
| ----------- | -------- | -------------- | -------- | ---------------- |
| userId      | path     | uuid           | yes      | Target user ID   |
| displayName | body     | string (3-100) | no       | Display name     |
| bio         | body     | string (0-500) | no       | Bio text         |
| avatarUrl   | body     | url (max 500)  | no       | Avatar image URL |

**Success response:** 200, the updated profile in the GET shape

**Error responses:**

| Status | Condition           | Response                                    |
| ------ | ------------------- | ------------------------------------------- |
| 400    | Validation failure  | `{ error: string, details: [...] }`         |
| 401    | No/expired token    | `{ error: "Unauthorized" }`                 |
| 403    | Not profile owner   | `{ error: "Forbidden" }`                    |
| 404    | No live profile     | `{ error: "Not found" }`                    |
| 429    | Rate limit exceeded | `{ error: "Rate limited" }` + `Retry-After` |

Every signed-in user can already read any profile, so answering 403 to a non-owner reveals nothing.

</api_contract>

<database_schema>

## Database Schema

### Table: profiles

**Pattern source:** `db/schema/jobs.ts:1-45`

| Column      | Type         | Constraints              | Purpose          |
| ----------- | ------------ | ------------------------ | ---------------- |
| id          | uuid         | PK, generated            | Primary key      |
| userId      | uuid         | NOT NULL, FK -> users.id | Owner reference  |
| displayName | varchar(100) | NOT NULL                 | Public name      |
| bio         | text         | nullable                 | Bio text         |
| avatarUrl   | varchar(500) | nullable                 | Avatar image URL |
| createdAt   | timestamp    | NOT NULL, default now()  | Audit            |
| updatedAt   | timestamp    | NOT NULL, default now()  | Audit            |
| deletedAt   | timestamp    | nullable                 | Soft delete      |

**Relationships:**

- one live profile per user, via the userId FK
- rows for new users: registration creates the profile in the same transaction as the user row; the data migration below covers users who already exist

**Indexes:**

| Columns | Kind     | Unique | Rows indexed            | Serves                                      |
| ------- | -------- | ------ | ----------------------- | ------------------------------------------- |
| userId  | ordinary | yes    | where deletedAt is null | One live profile per user; lookup by userId |

**Queries:** every read, update and delete filters on deletedAt is null

**Migration strategy:**

- Reversible: Yes — drop the table. Profiles edited after release are lost on rollback, so the down migration is for the release window only
- Data migration: one profile per existing user, displayName from the email's local part, in batches of 1,000 users
- Downtime: No — the table and its index are new, so nothing waits on the build

</database_schema>

<middleware_requirements>

## Middleware Requirements

**Request pipeline order** for `/api/v1/profiles`:

1. Auth — authMiddleware, then ownerGuard on PATCH
2. Rate limit keyed by user — 60/min on GET, 20/min on PATCH
3. Input validation — the profile update schema, on PATCH
4. Handler
5. Response serialization

**New middleware needed:** ownerGuard — answers 403 unless the path's userId is the caller's; authMiddleware establishes who the caller is, not what they own

**Existing middleware to reuse:**

- authMiddleware from `middleware/auth.ts:12-45` — validates the token and sets the caller's id

**Transaction boundaries:** none — each endpoint is a single read or a single write

</middleware_requirements>
````
