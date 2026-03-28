---
name: api-database-surrealdb
description: SurrealDB multi-model database - SurrealQL queries, record links, graph relations, live queries, schema definitions, authentication, TypeScript SDK
---

# SurrealDB Patterns

> **Quick Guide:** Use the `surrealdb` SDK (v2+) with `new Surreal()` and `connect()`. Model relationships with record links for simple pointers and `RELATE` for graph edges with metadata. Use `SCHEMAFULL` tables in production with `DEFINE FIELD` constraints. Always use parameterized queries (`$variable`) to prevent injection. Record IDs are `table:id` -- they are immutable and first-class values in SurrealQL. Live queries push changes without polling.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use parameterized queries with `$variables` for ALL user input -- string interpolation in SurrealQL enables injection attacks)**

**(You MUST use `new RecordId("table", "id")` in SDK v2 -- plain `"table:id"` strings are NOT automatically parsed as record IDs)**

**(You MUST call `db.use({ namespace, database })` or pass namespace/database in `connect()` options BEFORE any queries -- queries without a selected namespace/database silently fail or error)**

**(You MUST NOT rely on `SCHEMALESS` tables in production -- use `SCHEMAFULL` with `DEFINE FIELD` to enforce data integrity at the database layer)**

**(You MUST NOT use `UPDATE`/`DELETE` with `WHERE` on large tables without indexes -- SurrealDB currently does not use indexes for UPDATE/DELETE WHERE clauses (use subquery workaround))**

</critical_requirements>

---

**Auto-detection:** SurrealDB, Surreal, surrealdb, SurrealQL, RELATE, RecordId, record link, LIVE SELECT, SCHEMAFULL, SCHEMALESS, DEFINE TABLE, DEFINE FIELD, DEFINE ACCESS, surql, graph traversal, ->relation->, <-relation<-

**When to use:**

- Connecting to SurrealDB and executing queries via the JavaScript SDK
- Modeling data with record links and graph edges (`RELATE`)
- Defining schemas with `SCHEMAFULL` tables and field constraints
- Building real-time features with live queries
- Implementing authentication with `DEFINE ACCESS` and record-level permissions
- Multi-tenant architectures using namespaces and databases

**Key patterns covered:**

- SDK connection setup (v2 API with `Surreal`, `connect`, `RecordId`, `Table`)
- CRUD operations with type-safe queries
- Record links vs graph edges (when to use each)
- Schema definitions (`DEFINE TABLE`, `DEFINE FIELD`, permissions)
- Live queries for real-time subscriptions

**When NOT to use:**

- Heavy analytical/OLAP workloads (use a columnar database)
- Simple key-value caching (use a dedicated cache)
- Mature relational schemas that require decades of SQL ecosystem tooling

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core Patterns:**

- [examples/core.md](examples/core.md) - SDK setup, connection, CRUD, TypeScript typing, RecordId

**Graph & Relations:**

- [examples/graph-relations.md](examples/graph-relations.md) - Record links, RELATE, graph traversal, edge metadata

**Schema & Auth:**

- [examples/schema-auth.md](examples/schema-auth.md) - DEFINE TABLE/FIELD, SCHEMAFULL, permissions, DEFINE ACCESS, authentication

**Live Queries & Transactions:**

- [examples/live-queries.md](examples/live-queries.md) - LIVE SELECT, subscriptions, transactions, events

---

<philosophy>

## Philosophy

SurrealDB is a multi-model database combining document, graph, and relational paradigms with a SQL-inspired query language (SurrealQL). The core principle: **model your data the way you think about it -- records link to records, relationships carry metadata, and schemas enforce integrity without separate migration tools.**

**Core principles:**

1. **Record IDs are first-class** -- Every record has a `table:id` identity that doubles as a direct pointer. SurrealDB fetches linked records from disk without table scans.
2. **Graph when you need metadata, link when you don't** -- Record links (`friends = [person:tobie]`) are lightweight pointers. Graph edges (`RELATE person:a->follows->person:b`) store relationship context (timestamps, weights, roles).
3. **Schema-full for production** -- `SCHEMAFULL` tables with `DEFINE FIELD` constraints enforce types, validation, and defaults at the database layer. Use `SCHEMALESS` only for rapid prototyping.
4. **Permissions at every level** -- Namespace, database, table, and field-level permissions. `DEFINE ACCESS` with `SIGNUP`/`SIGNIN` enables end-user authentication without a separate auth service.
5. **Real-time by default** -- `LIVE SELECT` pushes changes to subscribers as they commit. No polling, no message broker.
6. **Parameterize everything** -- SurrealQL variables (`$email`, `$limit`) prevent injection and improve query plan caching.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: SDK Connection

SDK v2 uses `new Surreal()` -- always set namespace/database at connection time and use `127.0.0.1` (not `localhost`, which can fail with IPv6 on Node.js 18+).

```typescript
import Surreal from "surrealdb";

const db = new Surreal();
await db.connect("http://127.0.0.1:8000", {
  namespace: "myapp",
  database: "production",
});
await db.signin({ username: "root", password: "root" });
```

Full connection patterns (production config, event monitoring, graceful shutdown): [examples/core.md](examples/core.md)

---

### Pattern 2: CRUD with RecordId

SDK v2 requires `RecordId` objects -- plain strings are NOT automatically parsed as record IDs. Use `Table` for table-scoped operations, `RecordId` for specific records.

```typescript
import { RecordId, Table } from "surrealdb";

const created = await db.create<User>(new Table("user"), {
  name: "Alice",
  role: "user",
});
const user = await db.select<User>(new RecordId("user", "alice"));
await db.merge(new RecordId("user", "alice"), { role: "admin" });
await db.delete(new RecordId("user", "alice"));
```

Full CRUD patterns (create, select, update, delete, bulk operations): [examples/core.md](examples/core.md)

---

### Pattern 3: Parameterized Queries

Always bind user input as `$parameters` -- never interpolate strings into SurrealQL. Multi-statement queries return typed tuples.

```typescript
const users = await db.query<[User[]]>(
  `SELECT * FROM user WHERE role = $role LIMIT $limit`,
  { role: "admin", limit: 20 },
);

// BAD: enables SurrealQL injection
await db.query(`SELECT * FROM user WHERE email = '${userInput}'`);
```

Full query patterns (pagination, multi-statement, RecordId parameters): [examples/core.md](examples/core.md)

---

### Pattern 4: Record Links (Lightweight Pointers)

Record links are field-level pointers fetched via dot notation -- no JOINs required. Use for simple, unidirectional references without relationship metadata.

```surql
CREATE person:alice SET best_friend = person:bob, friends = [person:bob, person:carol];
SELECT best_friend.name AS friend_name FROM person:alice;
```

**When NOT to use:** When you need relationship metadata, bidirectional traversal, or relationship-level permissions -- use graph edges instead.

Full record link patterns: [examples/graph-relations.md](examples/graph-relations.md)

---

### Pattern 5: Graph Edges with RELATE

Graph edges are full records in a relation table, supporting metadata, bidirectional traversal (`<->`), and schema constraints via `DEFINE TABLE TYPE RELATION`.

```surql
RELATE person:alice->follows->person:bob SET followed_at = time::now(), strength = "close";
SELECT ->follows->person.name AS following FROM person:alice;  -- forward
SELECT <-follows<-person.name AS followers FROM person:bob;    -- reverse
```

**When to use:** Relationships needing metadata, bidirectional queries, social graphs, access control graphs.

Full graph patterns (typed relations, edge metadata, recursive traversal): [examples/graph-relations.md](examples/graph-relations.md)

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using string interpolation instead of `$parameters` in SurrealQL queries -- enables injection attacks
- Using `"table:id"` strings instead of `new RecordId("table", "id")` in SDK v2 -- strings are not auto-parsed as record IDs
- Running queries without selecting namespace/database -- queries silently fail or return errors
- Using `SCHEMALESS` tables in production without explicit field definitions -- data integrity not enforced

**Medium Priority Issues:**

- `UPDATE table SET ... WHERE condition` on large tables without indexes -- SurrealDB does not use indexes for UPDATE/DELETE WHERE (use `UPDATE (SELECT id FROM table WHERE condition) SET ...` as workaround)
- Using `UPSERT` without a unique index -- `UPSERT` is much more performant with unique indexes (avoids table scan)
- Embedding unbounded arrays as record links -- arrays can grow without limit; use graph edges for unbounded relationships
- Not setting `DURATION FOR TOKEN` and `DURATION FOR SESSION` on `DEFINE ACCESS` -- tokens/sessions without expiry are a security risk

**Common Mistakes:**

- Creating duplicate record IDs silently fails or errors depending on context -- use `INSERT ... ON DUPLICATE KEY UPDATE` or `UPSERT` for idempotent operations
- Expecting `record:id` strings to sort numerically -- `record:1`, `record:10`, `record:2` sorts lexicographically; use numeric IDs (`record:1`, `record:2`, `record:10`) or ULID/UUID for temporal sorting
- Forgetting that record IDs are immutable -- you cannot change a record's ID after creation; you must create a new record and delete the old one
- Using `rand()`, `ulid()`, or `uuid()` in `DEFINE FUNCTION` bodies -- these generate the same value per function call, causing duplicate key errors on subsequent calls
- Confusing `DEFINE FIELD ... VALUE` (recalculated on create/update) with `DEFINE FIELD ... COMPUTED` (recalculated on access, v3.0+)
- Setting `id` field in `CREATE table:specific_id SET id = "other"` -- the explicit record ID takes precedence and the `id` in SET is silently discarded

**Gotchas & Edge Cases:**

- Fields defined with `VALUE` are recalculated alphabetically -- if field `b` depends on field `a`, naming matters
- `FLEXIBLE TYPE` on a `SCHEMAFULL` table allows schemaless nested objects -- useful for JSON metadata but bypasses type checking on that subtree
- `LIVE SELECT` with complex `WHERE` filters may not fire for all edge cases -- test your filters thoroughly
- `localhost` in connection strings can fail on Node.js 18+ due to IPv6 preference -- use `127.0.0.1`
- Numeric string IDs (`"10"`) display as backtick-escaped (`table:\`10\``) to differentiate from numeric IDs (`table:10`)
- Record References (`DEFINE FIELD ... REFERENCE`) are experimental (require `--allow-experimental record_references`) -- do not use in production

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use parameterized queries with `$variables` for ALL user input -- string interpolation in SurrealQL enables injection attacks)**

**(You MUST use `new RecordId("table", "id")` in SDK v2 -- plain `"table:id"` strings are NOT automatically parsed as record IDs)**

**(You MUST call `db.use({ namespace, database })` or pass namespace/database in `connect()` options BEFORE any queries -- queries without a selected namespace/database silently fail or error)**

**(You MUST NOT rely on `SCHEMALESS` tables in production -- use `SCHEMAFULL` with `DEFINE FIELD` to enforce data integrity at the database layer)**

**(You MUST NOT use `UPDATE`/`DELETE` with `WHERE` on large tables without indexes -- SurrealDB currently does not use indexes for UPDATE/DELETE WHERE clauses (use subquery workaround))**

**Failure to follow these rules will cause injection vulnerabilities, silent query failures, or data integrity issues.**

</critical_reminders>
