# SurrealDB Reference

> Decision frameworks, quick reference, SurrealQL operators, and ID generation strategies. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Data Relationship: Link vs Edge vs Embed

```
Does the relationship need metadata (timestamp, weight, role)?
├─ YES → Use graph edges (RELATE)
└─ NO → Is the relationship bidirectional?
    ├─ YES → Use graph edges (RELATE with <->)
    └─ NO → Is the related data always accessed with the parent?
        ├─ YES → Is it bounded (won't grow unbounded)?
        │   ├─ YES → Embed as nested object or record link field
        │   └─ NO → Use graph edges (unbounded arrays hit performance limits)
        └─ NO → Use record links (field = record:id)
```

### Schema Mode: SCHEMAFULL vs SCHEMALESS

```
Are you in production?
├─ YES → SCHEMAFULL with DEFINE FIELD constraints
└─ NO → Are you prototyping?
    ├─ YES → SCHEMALESS (fast iteration)
    └─ NO → Need some flexibility within strict schema?
        └─ SCHEMAFULL + FLEXIBLE TYPE on specific fields
```

### Record ID Strategy

```
Do you need temporal sorting?
├─ YES → ULID (CREATE table:ulid())
└─ NO → Do you need globally unique IDs?
    ├─ YES → UUID v7 (CREATE table:uuid())
    └─ NO → Do you need composite range queries?
        ├─ YES → Array-based IDs (table:['region', timestamp])
        └─ NO → Do you need human-readable IDs?
            ├─ YES → String IDs (user:alice, product:widget-pro)
            └─ NO → Default random IDs (CREATE table)
```

### Query Strategy

```
Are you reading data?
├─ YES → Do you know the exact record ID?
│   ├─ YES → SELECT * FROM record:id (fastest -- direct lookup)
│   └─ NO → Do you need to filter?
│       ├─ YES → Is there an index on the filter field?
│       │   ├─ YES → SELECT with WHERE (uses index)
│       │   └─ NO → Add index or use full table scan (slow on large tables)
│       └─ NO → SELECT * FROM table LIMIT $n
└─ NO → Are you updating?
    ├─ YES → Is it a single record by ID?
    │   ├─ YES → UPDATE record:id SET ... (fast)
    │   └─ NO → UPDATE (SELECT id FROM table WHERE ...) SET ... (workaround for index use)
    └─ NO → Are you creating relationships?
        ├─ YES → Need metadata? → RELATE a->edge->b SET ...
        └─ NO → CREATE or INSERT
```

---

## SurrealQL Quick Reference

### CRUD Statements

| Statement | Description                   | Example                                                                         |
| --------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `CREATE`  | Create record(s)              | `CREATE user SET name = "Alice"`                                                |
| `INSERT`  | Insert with conflict handling | `INSERT INTO user { name: "Alice" } ON DUPLICATE KEY UPDATE name = $input.name` |
| `SELECT`  | Query records                 | `SELECT * FROM user WHERE active = true`                                        |
| `UPDATE`  | Replace all fields            | `UPDATE user:alice SET name = "Alice B."`                                       |
| `UPSERT`  | Create or update              | `UPSERT user:alice SET name = "Alice", email = "a@b.com"`                       |
| `DELETE`  | Remove records                | `DELETE user:alice`                                                             |
| `RELATE`  | Create graph edge             | `RELATE user:a->follows->user:b`                                                |

### Record ID Formats

| Format           | Example                                     | Use Case                    |
| ---------------- | ------------------------------------------- | --------------------------- |
| Random (default) | `user:a1b2c3d4e5f6g7h8i9j0`                 | General purpose             |
| String           | `user:alice`                                | Human-readable              |
| Numeric          | `user:42`                                   | Sequential, integer sorting |
| ULID             | `user:ulid()`                               | Temporally sortable         |
| UUID v7          | `user:uuid()`                               | Globally unique, sortable   |
| Array-based      | `weather:['London', d'2025-01-01']`         | Composite range queries     |
| Object-based     | `log:{ ts: d'2025-01-01', level: 'error' }` | Multi-key lookups           |

### Comparison Operators

| Operator        | Description             | Example                             |
| --------------- | ----------------------- | ----------------------------------- |
| `=` / `==`      | Equal                   | `WHERE age = 25`                    |
| `!=`            | Not equal               | `WHERE status != "deleted"`         |
| `>` / `>=`      | Greater than (or equal) | `WHERE age >= 18`                   |
| `<` / `<=`      | Less than (or equal)    | `WHERE price < 100`                 |
| `IN` / `NOT IN` | In set                  | `WHERE role IN ["admin", "mod"]`    |
| `CONTAINS`      | Array contains value    | `WHERE tags CONTAINS "typescript"`  |
| `CONTAINSALL`   | Array contains all      | `WHERE tags CONTAINSALL ["a", "b"]` |
| `CONTAINSANY`   | Array contains any      | `WHERE tags CONTAINSANY ["a", "b"]` |
| `~` / `!~`      | Regex match             | `WHERE email ~ "^admin@"`           |
| `@@`            | Full-text search match  | `WHERE content @@ "search term"`    |

### Graph Traversal Syntax

| Pattern          | Direction                    | Example                                           |
| ---------------- | ---------------------------- | ------------------------------------------------- |
| `->edge->target` | Forward                      | `SELECT ->follows->person.name FROM person:alice` |
| `<-edge<-source` | Reverse                      | `SELECT <-follows<-person.name FROM person:bob`   |
| `<->edge<->any`  | Bidirectional                | `SELECT <->knows<->person.name FROM person:alice` |
| `->?->?`         | Any outgoing edge and target | `SELECT ->?->? FROM person:alice`                 |

### DEFINE Statements

| Statement          | Purpose                      | Example                                                    |
| ------------------ | ---------------------------- | ---------------------------------------------------------- |
| `DEFINE NAMESPACE` | Create namespace             | `DEFINE NAMESPACE myapp`                                   |
| `DEFINE DATABASE`  | Create database              | `DEFINE DATABASE production`                               |
| `DEFINE TABLE`     | Define table schema          | `DEFINE TABLE user SCHEMAFULL`                             |
| `DEFINE FIELD`     | Define field type/validation | `DEFINE FIELD email ON user TYPE string`                   |
| `DEFINE INDEX`     | Create index                 | `DEFINE INDEX email_idx ON user FIELDS email UNIQUE`       |
| `DEFINE ACCESS`    | Auth method                  | `DEFINE ACCESS account ON DATABASE TYPE RECORD ...`        |
| `DEFINE EVENT`     | Table trigger                | `DEFINE EVENT log ON user WHEN $event = "CREATE" THEN ...` |
| `DEFINE FUNCTION`  | Custom function              | `DEFINE FUNCTION fn::greet($name: string) { ... }`         |
| `DEFINE PARAM`     | Global parameter             | `DEFINE PARAM $env VALUE "production"`                     |

### Built-in Functions (Common)

| Category | Function                                | Description                  |
| -------- | --------------------------------------- | ---------------------------- |
| Time     | `time::now()`                           | Current datetime             |
| Time     | `time::format($dt, $fmt)`               | Format datetime              |
| Crypto   | `crypto::argon2::generate($pass)`       | Hash password                |
| Crypto   | `crypto::argon2::compare($hash, $pass)` | Verify password              |
| String   | `string::lowercase($s)`                 | Lowercase                    |
| String   | `string::is::email($s)`                 | Validate email               |
| String   | `string::html::encode($s)`              | HTML encode (XSS prevention) |
| Math     | `math::mean($arr)`                      | Average                      |
| Array    | `array::len($arr)`                      | Array length                 |
| Type     | `type::record($table, $id)`             | Create record ID from parts  |
| Count    | `count()`                               | Count in GROUP BY            |

---

## Connection Options

### Development

```typescript
await db.connect("http://127.0.0.1:8000", {
  namespace: "myapp",
  database: "development",
});

await db.signin({ username: "root", password: "root" });
```

### Production

```typescript
await db.connect("https://your-instance.surrealdb.com", {
  namespace: "myapp",
  database: "production",
  renewAccess: true,
  authentication: () => ({
    access: "account",
    variables: { email: userEmail, pass: userPassword },
  }),
});
```

---

## Multi-Tenancy Pattern

```
Root level
├─ Namespace: "tenant_acme"
│   ├─ Database: "production"
│   └─ Database: "staging"
├─ Namespace: "tenant_globex"
│   ├─ Database: "production"
│   └─ Database: "staging"
└─ Namespace: "shared"
    └─ Database: "config"
```

Each namespace is fully isolated -- users, tables, and data cannot cross namespace boundaries without root-level access. Use `db.use({ namespace, database })` to switch context.

---

## Index Types

| Type      | Syntax                                                                 | Use Case               |
| --------- | ---------------------------------------------------------------------- | ---------------------- |
| Standard  | `DEFINE INDEX idx ON table FIELDS field`                               | Equality/range queries |
| Unique    | `DEFINE INDEX idx ON table FIELDS field UNIQUE`                        | Unique constraints     |
| Composite | `DEFINE INDEX idx ON table FIELDS a, b`                                | Multi-field queries    |
| Full-text | `DEFINE INDEX idx ON table FIELDS field SEARCH ANALYZER analyzer BM25` | Text search            |
| Vector    | `DEFINE INDEX idx ON table FIELDS field MTREE DIMENSION 3`             | Vector similarity      |

### Index Limitations (Current)

- Indexes are **not used** for `UPDATE ... WHERE` or `DELETE ... WHERE` -- use subquery pattern: `UPDATE (SELECT id FROM table WHERE condition) SET ...`
- Query planner automatically selects indexes for `SELECT ... WHERE`
- `UPSERT` is significantly faster with a unique index (index lookup vs table scan)
