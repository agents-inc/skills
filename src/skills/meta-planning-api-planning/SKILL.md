---
name: meta-planning-api-planning
description: Backend specification frameworks — endpoint contracts, error catalogs, auth per endpoint, schema with constraints and indexes, migration strategy, middleware order. Load when a spec adds or changes an API endpoint, a database table, or a request pipeline.
---

# API Planning Frameworks

> **Quick Guide:** Specify each endpoint as a contract a consumer can code against without asking: method, path, auth, rate limit, request, success response, and a status for every failure. Specify each table as typed, constrained columns, indexes with the query each serves, and a migration strategy, and state the middleware order. Three facts change the answer more often than expected: a partial update is `PATCH`, not `PUT`; a unique index that includes a nullable `deletedAt` does not stop duplicate live rows in most SQL databases; and renaming a column without an outage takes three phases, not one migration.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the API Contract, Database Schema and Middleware Requirements section templates, and a worked specification built from them

---

## Which path applies

Ask each question on its own; a spec that adds an endpoint and a table carries both sections. A section with nothing to say is left out rather than filled.

- **It adds or changes an endpoint** — one API Contract block per endpoint (Patterns 1–3), from the [API Contract template](examples/core.md#api-contract-section).
- **It adds or changes a table, column or index** — one Database Schema block per table (Patterns 4–5), from the [Database Schema template](examples/core.md#database-schema-section).
- **It adds middleware or reorders a pipeline** — a Middleware Requirements section (Pattern 6), from the [Middleware Requirements template](examples/core.md#middleware-requirements-section).
- **None of the three** — nothing in this skill applies, and none of its sections belongs in the spec.

---

<critical_requirements>

## Before writing a backend specification

**Read the closest existing route, schema file and middleware chain, and cite each by file and line range.** Their naming, pagination, response envelope and auth wiring are the vocabulary the spec reuses; a shape invented beside them diverges, and every consumer inherits the inconsistency.

**Give every endpoint its whole contract — method and path, auth, rate limit, request, success response and error catalog.** A part the spec leaves out is decided by the implementer, and decided again, differently, by each consumer.

**Name the consumers of every contract the spec changes, and what breaks for each.** Frontends, other services and external clients code against these shapes and status codes, and a change that names none ships without knowing who it breaks.

**Write schema as typed columns with their constraints, indexes with the query each serves, and a migration strategy.** A nullable, unique or foreign-key decision the spec omits is made by whoever writes the migration, and reversing it later is a second migration against production data.

</critical_requirements>

---

**Auto-detection:** `<api_contract>`, `<database_schema>`, `<middleware_requirements>`, API spec, endpoint contract, request and response shape, error catalog, status code per condition, auth per endpoint, rate limit, schema spec, soft delete, unique index, migration strategy, backfill, expand and contract, middleware order

**Applies to:**

- A new or changed endpoint's request, response, status codes, auth and rate limit
- Tables, columns, relationships and indexes, and the migration that delivers them
- The order of a request pipeline, and where validation and transactions sit in it

**Handled elsewhere:**

- Implementation — handler bodies, query code and migration files follow from the spec, which states contracts rather than code
- The interface that consumes the API — its states, forms and client state are specified separately; this skill names it as a consumer and stops there
- Model calls behind an endpoint — prompts, model choice and evaluation are specified separately; this skill covers the endpoint that exposes them
- The specification around these sections — goal, scope fence, out-of-scope list and success criteria belong to the planning process that loads this skill

---

<philosophy>

An API contract is a promise to consumers you cannot see. An ambiguous one does not stay ambiguous: the implementer resolves it one way and each consumer another, and the mismatch surfaces later as a bug in someone else's code.

So a backend spec is as much about what it leaves out:

- **The smallest set of endpoints that meets the goal** — each extra one is surface to secure, test and keep compatible
- **No columns for data no requirement names** — a speculative column still needs a constraint decision and a migration

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Endpoint contract

Every endpoint the spec adds or changes carries all six parts.

```markdown
- [ ] Method and exact path, with path parameters named (`GET /api/v1/users/:userId`)
- [ ] Auth: middleware and permission, or explicitly public (Pattern 2)
- [ ] Rate limit, or explicitly none
- [ ] Request: each parameter's location (path/query/body), type, required flag, constraints
- [ ] Success response: status code and body shape with field types
- [ ] Error catalog: a row per condition (Pattern 3)
```

```
BAD:  "Create an endpoint for user management"
GOOD: "GET /api/v1/users — cursor pagination as in routes/jobs.ts:45-67, at most 50
       per page. Response shape matches JobListResponse."
```

A list endpoint's constraints include its maximum page size; without one, a client can ask for the whole table in a single request.

Where the codebase generates a machine-readable API description from its routes — an OpenAPI document, say — the changed endpoint appears in it, and the spec's success criteria include that the description still generates. Consumers and client generators read that document, not the spec.

Full template: [examples/core.md](examples/core.md#api-contract-section)

### Pattern 2: Auth per endpoint

Name the middleware and the permission for each endpoint. "Protected" leaves each route to decide for itself, and one ships public.

```
BAD:  "Endpoints should be protected"
GOOD: "GET /api/v1/users requires authMiddleware. DELETE /api/v1/users/:id requires
       authMiddleware + adminGuard. Public: POST /api/v1/auth/login."
```

- **Which middleware, from which file**, on which route group or route.
- **The permission model on every endpoint** — role, ownership (`ownerGuard`: the caller's own resource only) or tenancy: the object-level rule where the endpoint takes an id, and the row scope (whose rows the caller sees) where it returns a collection. Authentication alone lets any signed-in caller reach any object by changing the id, which is the first entry in OWASP's API Security Top 10 (2023), and a collection with no stated scope returns every caller's rows.
- **Which fields are private** to the owner or an admin. An endpoint whose fields differ by caller has two response shapes, and the spec gives both.
- **What 401 and 403 each mean.** 401 says the credentials are missing or invalid, so the client signs in again, and it carries a `WWW-Authenticate` header; 403 says the caller is known and refused, so signing in again changes nothing.

### Pattern 3: Error catalog

Every condition a consumer can hit gets a status and a body, in a table the consumer branches on. Without one, every client wraps every call in a generic catch.

| Status | Condition                             | Body                                    |
| ------ | ------------------------------------- | --------------------------------------- |
| 400    | Request fails schema validation       | `{ error: string, details: [...] }`     |
| 401    | Missing or expired credentials        | `{ error: string }`                     |
| 403    | Authenticated, but not permitted      | `{ error: string }`                     |
| 404    | Resource not found                    | `{ error: string }`                     |
| 409    | Duplicates an existing resource       | `{ error: string }`                     |
| 422    | Valid request a business rule refuses | `{ error: string }`                     |
| 429    | Rate limit exceeded                   | `{ error: string }`, with `Retry-After` |

- **One envelope for the whole API**, reused from the codebase. Where there is none yet, RFC 9457 Problem Details (`application/problem+json`, with `type`, `title`, `status`, `detail` and `instance`) is the standard shape to adopt.
- **One status per condition the consumer handles differently.** Two conditions handled identically share a status.
- **Validation failures name the offending fields**, in the shape the existing error handler emits.
- **404 or 403 for an object that exists but is not the caller's.** 403 confirms it exists, and RFC 9110 lets a server answer 404 to hide it. Decide per resource.
- **Every row is a test case** — the spec's success criteria can name the request that produces each one.

Full template: [examples/core.md](examples/core.md#api-contract-section)

### Pattern 4: Schema as columns

Specify each table as exact columns, never as prose.

```markdown
- [ ] Each column: name, type with length or precision, NOT NULL / UNIQUE / FK / default
- [ ] Pattern source: the existing schema file whose conventions it follows
- [ ] Audit and soft-delete columns per that convention, and the `deletedAt is null` filter every query applies — reads, updates and deletes alike
- [ ] Relationships: cardinality, and the FK or join table that carries each
- [ ] Indexes: columns, kind (ordinary, or the full-text / inverted kind a search or containment query needs), unique or not, which rows, and the query or rule each serves
```

```
BAD:  "Add a users table"
GOOD: "Add users following db/schema/jobs.ts:12-45: audit columns, soft delete
       (deletedAt), email unique among live rows — a unique index on email
       restricted to rows where deletedAt is null."
```

Full template: [examples/core.md](examples/core.md#database-schema-section)

### Pattern 5: Migration strategy

Every schema change states three things before implementation starts, so an irreversible step is a decision rather than something found during the deploy.

| Concern        | State                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Reversibility  | Reversible (and how), or irreversible and why that is acceptable       |
| Data migration | None, or describe: source of the backfilled values, and the batch plan |
| Downtime       | None, or why it is required and the window                             |

- **A new NOT NULL column on a populated table names its default or its backfill**, since the existing rows have no value to satisfy it.
- **A rename or type change states its expand, migrate and contract steps** — add the new column and write to both; backfill and move every read; drop the old column once no running version reads it.
- **Reversible means the data survives the round trip, and it is shown rather than asserted** — the spec's success criteria name a run of the migration down and up again. A down migration that drops a table or column also drops whatever was written to it after the up migration ran.
- **A migration that touches a large table states the environment it was sized against, and whether it runs online** — a backfill, a type change or other table rewrite, and an index or constraint alike. One timed against a small table can lock or rewrite the production table for far longer.

Full template: [examples/core.md](examples/core.md#database-schema-section)

### Pattern 6: Middleware pipeline

Order is behaviour, so the spec states the pipeline for each route group it touches.

```markdown
1. Rate limit keyed by IP — if the group has one
2. Auth — which middleware
3. Rate limit keyed by user or API key — if the group has one
4. Input validation — which schema
5. Handler
6. Response serialization
```

- **Reuse before adding.** New middleware appears only where existing middleware cannot cover the requirement; the spec names what was checked, and the file each reused piece comes from.
- **Validation runs before the handler, against a named schema**, so no handler sees unvalidated input.
- **Multi-step operations name their transaction boundary** — which steps commit together, so a failure halfway leaves nothing half-written.

Full template: [examples/core.md](examples/core.md#middleware-requirements-section)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A unique index on `(email, deletedAt)` meant to keep emails unique among live rows — most SQL databases treat NULLs as distinct in a unique index, so two live rows with the same email both insert. Specify the rule as "unique among rows where `deletedAt` is null" and how the database enforces it: a partial (filtered) unique index, where it has one.
- A `PUT` whose body fields are all optional — `PUT` replaces the resource with the body, so a client that omits a field expects it cleared while the server keeps it. Partial updates are `PATCH`.
- A column renamed in one migration — instances still running the previous release query a column that no longer exists, for as long as the deploy takes. Specify the expand, migrate and contract steps (Pattern 5).
- A `POST` that creates or charges with no retry rule — `POST` is not idempotent, so a client that times out and retries creates a second one. Specify how a retry is recognised, usually by a client-sent idempotency key.
- A public endpoint whose rate limit is "none" — nothing stops a client calling it in a loop, and sign-in and sign-up endpoints are where they do.

**Surprising behaviour:**

- A rate limit keyed by user but placed before auth keys by client IP instead, without an error, because there is no identity yet — everyone behind one address shares one allowance.
- Whether an index build blocks writes depends on the database and on how the index is built, so "Downtime: none" for a new index on a large table is a claim to check against the database the project runs.

</red_flags>
