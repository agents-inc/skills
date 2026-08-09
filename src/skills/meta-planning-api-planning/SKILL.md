---
name: meta-planning-api-planning
description: Backend specification planning frameworks. Use when a spec touches API endpoints, database schema, middleware, or auth. Covers endpoint contracts with request/response shapes, error catalogs, auth per endpoint, schema design with constraints and indexes, migration strategy, and middleware pipeline ordering.
---

# API Planning Frameworks

> **Quick Guide:** Specify every endpoint as a complete contract — method, path, auth requirement, request shape, success response, and an error catalog with a status per condition. Specify schema as exact columns with constraints, relationships, indexes, and a migration strategy. Order the middleware pipeline explicitly. Apply a framework only when the spec touches its artifact class — an endpoint-only change needs no schema section.

---

<critical_requirements>

## CRITICAL: Before Specifying Backend Contracts

> **All specifications must be grounded in the codebase's real routes, schemas, and middleware** — reference specific files with line numbers

**(You MUST give every endpoint a complete contract: method, path, auth requirement, request shape, success response shape, and an error catalog)**

**(You MUST state the auth requirement per endpoint — which middleware, which permission — never "endpoints should be protected")**

**(You MUST specify schema as exact columns with types, constraints, relationships, indexes, and a migration strategy)**

**(You MUST catalog error responses per endpoint — a status code per condition with its response body shape)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled)**

</critical_requirements>

---

**Auto-detection:** API spec, endpoint design, REST contract, request response shape, database schema spec, migration plan, middleware ordering, auth requirements, error catalog

**When to use:**

- Specifying new or changed API endpoints (request/response contracts)
- Specifying database tables, columns, relationships, or indexes
- Specifying auth and permission requirements per endpoint
- Specifying middleware pipelines and their ordering
- Specifying error response catalogs
- Planning migrations (reversibility, data migration, downtime)

**When NOT to use:**

- When implementing backend code (use the relevant API implementation skill)
- For the frontend that consumes the API (use the web planning skill)
- For model-calling capabilities behind an endpoint (use the ai planning skill)
- For the planning PROCESS itself — research, scope fencing, success criteria — which the PM agent carries

**Key patterns covered:**

- Endpoint contract completeness (method, path, auth, shapes, errors)
- Auth specification per endpoint
- Error response catalogs
- Database schema design (columns, constraints, relationships, indexes)
- Migration strategy
- Middleware pipeline ordering
- Consumer-contract awareness (who breaks on change)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Per-artifact spec section templates and a worked example specification

---

<philosophy>

## Philosophy

**An API contract is a promise to consumers you cannot see.** Frontends, other services, and external clients all code against the shapes and status codes the spec defines. An ambiguous contract does not stay ambiguous — it gets resolved differently by the implementer and each consumer.

**When specifying backend work:**

- Read the closest existing route first; its naming, middleware chain, and response envelope are the vocabulary the spec must reuse
- Name the downstream consumers of every contract, and what breaks for each if the shape changes
- Specify the error catalog with the same care as the success path — consumers branch on status codes
- Treat the schema as a contract too: a column without constraints is a decision deferred to whoever writes the migration

**When NOT to specify:**

- Don't add endpoints beyond the smallest set that achieves the goal
- Don't design schema columns for data no requirement names
- Don't invent new middleware when an existing chain covers the requirement
- Don't specify implementation (handler bodies, ORM calls) — contracts and schemas, not code

**Core principles:**

- **Auth is per endpoint**: "protected" is not a specification; the middleware and permission are
- **Errors are a catalog**: every condition a consumer can hit has a status code and a body shape
- **Schema constraints are requirements**: nullable, unique, and FK decisions belong in the spec
- **Migrations are planned, not improvised**: reversibility, data migration, and downtime are stated up front

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Endpoint Contract Completeness

Every endpoint the spec introduces or changes carries all six parts.

```markdown
## Endpoint Contract

For EACH endpoint:

- [ ] Method and exact path, with path parameters named (`GET /api/v1/users/:userId`)
- [ ] Auth requirement: middleware name + permission/role, or explicitly public
- [ ] Rate limit, or explicitly none
- [ ] Request shape: every parameter with location (path/query/body), type, required flag, constraints
- [ ] Success response: status code and exact body shape with field types
- [ ] Error catalog: a row per condition (see Pattern 3)
```

```
BAD:  "Create an endpoint for user management"
GOOD: "GET /api/v1/users — paginated list with cursor-based pagination following
       routes/jobs.ts:45-67. Response shape matches JobListResponse."
```

**Why this matters:** each missing part becomes an invention. An invented pagination style or response envelope diverges from the codebase's own, and consumers inherit the inconsistency permanently.

---

### Pattern 2: Auth Per Endpoint

State the requirement per endpoint, naming real middleware.

```
BAD:  "Endpoints should be protected"
GOOD: "GET /api/v1/users requires authMiddleware. DELETE /api/v1/users/:id requires
       authMiddleware + adminGuard. Public: POST /api/v1/auth/login."
```

**Rules the spec must state:**

- Which middleware, from which file, applied to which route group or individual route
- The permission model: role, ownership (`ownerGuard` — user edits own resource only), or tenancy
- Which fields are private (returned only to the owner or an admin) versus public
- What an unauthorized versus a forbidden request returns — 401 and 403 are different promises

---

### Pattern 3: Error Response Catalog

Every endpoint's failure surface, as a table consumers can branch on.

| Status | Condition                                 | Response Body                       |
| ------ | ----------------------------------------- | ----------------------------------- |
| 400    | Validation failure (schema parse error)   | `{ error: string, details: [...] }` |
| 401    | Missing or expired token                  | `{ error: string }`                 |
| 403    | Authenticated but insufficient permission | `{ error: string }`                 |
| 404    | Resource not found                        | `{ error: string }`                 |
| 409    | Unique constraint violation               | `{ error: string }`                 |
| 422    | Business rule violation                   | `{ error: string }`                 |

**Rules the spec must state:**

- Reuse the codebase's error envelope — one error shape per API, not per endpoint
- One status per condition class a consumer handles differently; two conditions handled identically share a status
- Validation failures name the offending fields in `details`, in the shape the existing error handler emits
- Whether 404 is returned for a resource that exists but is not visible to the caller (existence leakage is a decision)

---

### Pattern 4: Database Schema Design

Specify tables as exact columns, never as prose.

```markdown
## Schema Review Checklist

For EACH table the spec adds or changes:

- [ ] Every column: name, type (with length/precision), constraints (NOT NULL, UNIQUE, FK, default)
- [ ] Pattern source: the existing schema file whose conventions it follows
- [ ] Audit columns per the codebase convention (createdAt, updatedAt)
- [ ] Soft delete per the codebase convention (deletedAt), and the isNull check on every query
- [ ] Relationships: cardinality and the FK or join table that carries each
- [ ] Indexes: columns, type, and the query each index serves
```

```
BAD:  "Add a users table"
GOOD: "Add users table following db/schema/jobs.ts:12-45. Soft delete (deletedAt),
       audit columns, composite unique index on (email, deletedAt)."
```

**Why this matters:** a column that arrives without constraints gets its NOT NULL, uniqueness, and FK decisions made by whoever types the migration — and changed later at the cost of a second migration against production data.

---

### Pattern 5: Migration Strategy

Every schema change states three things before implementation starts:

| Concern        | State                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Reversibility  | Reversible (and how), or irreversible and why that is acceptable       |
| Data migration | None, or describe: source of the backfilled values, and the batch plan |
| Downtime       | None, or why it is required and the window                             |

**Rules the spec must state:**

- New NOT NULL columns on existing tables need a default or a backfill step — state which
- Renames are two deploys (add + dual-write, then remove), or a breaking change named as such
- Which environments the migration has been sized against, when tables are large

---

### Pattern 6: Middleware Pipeline

Order is behavior. State the pipeline explicitly per route group.

```markdown
## Request Pipeline Order

1. Rate limiting — if applicable
2. Auth middleware — which one
3. Input validation — schema reference
4. Business logic handler
5. Response serialization
```

**Rules the spec must state:**

- New middleware only when existing middleware cannot cover the requirement — name what was checked
- Which existing middleware is reused, from which file
- Where validation happens (before the handler, with which schema) so handlers never see unvalidated input
- Transaction boundaries for multi-step operations — which steps commit together

</patterns>

---

<decision_framework>

## Decision Framework

### Which Spec Sections Does This Feature Need?

Apply a framework only when the spec touches its artifact class. The per-artifact section templates live in [examples/core.md](examples/core.md).

```
Does the spec add or change an endpoint?
├─ YES → API Contract section (Patterns 1-3), one block per endpoint
└─ Does it add or change tables, columns, or indexes?
    ├─ YES → Database Schema section (Patterns 4-5), one block per table
    └─ Does it add or reorder middleware?
        ├─ YES → Middleware Requirements section (Pattern 6)
        └─ NO  → None of these frameworks applies; do not force one in
```

### Common Spec Failures

| Failure                                  | Consequence                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| "User data" instead of an exact shape    | The implementer and each consumer resolve the ambiguity differently |
| "Protected" instead of named middleware  | Auth drifts per endpoint; a route ships public that should not be   |
| No error catalog                         | Consumers cannot branch; every client wraps calls in generic catch  |
| Schema as prose                          | Constraint decisions deferred to the migration author               |
| No migration strategy                    | Irreversible change discovered during deploy                        |
| Endpoint set larger than the requirement | Unused surface to secure, test, and maintain                        |
| No named consumers                       | A shape change ships without knowing who breaks                     |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (a spec with one of these is incomplete):**

- An endpoint without a request shape, response shape, or error catalog
- Auth stated as "protected" without naming middleware and permission
- A schema change without column constraints or a migration strategy
- A new NOT NULL column on an existing table with no default and no backfill plan
- Validation placement unstated — handlers seeing unvalidated input

**Medium Priority Issues:**

- A response envelope that differs from the codebase's existing one
- An index without the query it serves
- Soft-delete tables without the isNull convention stated for queries
- Multi-step operations without a transaction boundary decision
- 401 vs 403 conflated

**Common Mistakes:**

- Designing pagination differently from the sibling endpoints
- Specifying a join table where the codebase uses an FK convention (or vice versa)
- Leaving rate limits unstated on public endpoints
- Forgetting the "not visible vs not found" existence-leakage decision

**Gotchas & Edge Cases:**

- A unique constraint on a soft-delete table usually needs the deletedAt column in the index
- Renames are two deploys; a spec that renames in one is specifying a breaking change
- An endpoint that returns different fields to owners and strangers is two response shapes — specify both

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All specifications must be grounded in the codebase's real routes, schemas, and middleware**

**(You MUST give every endpoint a complete contract: method, path, auth requirement, request shape, success response shape, and an error catalog)**

**(You MUST state the auth requirement per endpoint — which middleware, which permission)**

**(You MUST specify schema as exact columns with types, constraints, relationships, indexes, and a migration strategy)**

**(You MUST catalog error responses per endpoint — a status code per condition with its response body shape)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled)**

**Failure to specify these contracts produces APIs whose implementers invent shapes, whose consumers break on drift, whose auth gaps ship silently, and whose migrations cannot be rolled back.**

</critical_reminders>
