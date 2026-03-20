# SurrealDB Schema & Authentication Examples

> DEFINE TABLE, DEFINE FIELD, SCHEMAFULL mode, permissions, DEFINE ACCESS, authentication patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Graph patterns:** See [graph-relations.md](graph-relations.md). **Live queries:** See [live-queries.md](live-queries.md).

---

## Pattern 1: SCHEMAFULL Table Definition

### Good Example -- Complete Table Schema

```surql
-- Strict schema enforcement
DEFINE TABLE user SCHEMAFULL;

-- Field definitions with types, defaults, and validation
DEFINE FIELD name ON user TYPE string
  ASSERT string::len($value) >= 2 AND string::len($value) <= 100;

DEFINE FIELD email ON user TYPE string
  VALUE string::lowercase($value)
  ASSERT string::is::email($value);

DEFINE FIELD role ON user TYPE string
  DEFAULT "user"
  ASSERT $value IN ["admin", "user", "moderator"];

DEFINE FIELD age ON user TYPE option<int>
  ASSERT $value = NONE OR ($value >= 0 AND $value <= 150);

DEFINE FIELD tags ON user TYPE array<string>
  DEFAULT [];

DEFINE FIELD metadata ON user FLEXIBLE TYPE object;

DEFINE FIELD created_at ON user TYPE datetime
  VALUE time::now()
  READONLY;

DEFINE FIELD updated_at ON user TYPE datetime
  VALUE time::now();

-- Indexes
DEFINE INDEX email_idx ON user FIELDS email UNIQUE;
DEFINE INDEX role_idx ON user FIELDS role;
```

**Why good:** `SCHEMAFULL` enforces all fields, `ASSERT` for validation, `VALUE` with `string::lowercase` for transformation, `READONLY` prevents modification after creation, `FLEXIBLE TYPE object` for schemaless subtree within strict table, `option<int>` for nullable field, `DEFAULT` for sensible defaults

### Good Example -- Relation Table Schema

```surql
-- Typed relation table with constraints
DEFINE TABLE follows TYPE RELATION IN user OUT user SCHEMAFULL ENFORCED;

DEFINE FIELD followed_at ON follows TYPE datetime
  VALUE time::now()
  READONLY;

DEFINE FIELD notifications ON follows TYPE bool
  DEFAULT true;

DEFINE FIELD strength ON follows TYPE string
  DEFAULT "normal"
  ASSERT $value IN ["close", "normal", "acquaintance"];
```

**Why good:** `TYPE RELATION IN user OUT user` constrains endpoints, `ENFORCED` prevents edges to nonexistent records, metadata fields with defaults and validation

### Bad Example -- SCHEMALESS in Production

```surql
-- BAD: No field enforcement in production
DEFINE TABLE user SCHEMALESS;

-- Anyone can insert arbitrary fields
CREATE user SET
  name = "Alice",
  emal = "alice@example.com",  -- Typo goes undetected
  role = "superadmin",          -- Invalid role accepted
  _internal_notes = "hack";     -- Unintended field stored
```

**Why bad:** Typos in field names silently create new fields, no validation on values, arbitrary fields stored without restriction, data integrity impossible to guarantee

---

## Pattern 2: Computed and Derived Fields

### Good Example -- VALUE vs COMPUTED

```surql
DEFINE TABLE product SCHEMAFULL;

DEFINE FIELD name ON product TYPE string;
DEFINE FIELD price ON product TYPE float ASSERT $value >= 0;
DEFINE FIELD quantity ON product TYPE int ASSERT $value >= 0;
DEFINE FIELD discount_pct ON product TYPE float DEFAULT 0 ASSERT $value >= 0 AND $value <= 100;

-- VALUE: recalculated on CREATE and UPDATE
DEFINE FIELD updated_at ON product TYPE datetime
  VALUE time::now();

-- VALUE with field dependencies
DEFINE FIELD display_name ON product TYPE string
  VALUE string::uppercase(name);

-- COMPUTED (v3.0+): recalculated on every ACCESS (read)
DEFINE FIELD total_value ON product
  COMPUTED price * quantity;

DEFINE FIELD discounted_price ON product
  COMPUTED price * (1 - discount_pct / 100);

-- VALUE using $before for change tracking
DEFINE FIELD previous_price ON product TYPE option<float>
  VALUE $before.price;
```

**Why good:** `VALUE` recalculates on write (good for timestamps, derived strings), `COMPUTED` recalculates on read (good for live calculations), `$before` captures previous value on update

### Important Gotcha

```surql
-- Fields with VALUE compute in ALPHABETICAL ORDER
-- Field "b_total" computes BEFORE "a_price" is processed in the same CREATE
-- If b_total depends on a_price, the dependency may not resolve correctly

-- SAFE: name dependencies so alphabetical order matches dependency order
DEFINE FIELD a_base_price ON product TYPE float;
DEFINE FIELD b_tax ON product TYPE float VALUE a_base_price * 0.1;
DEFINE FIELD c_total ON product TYPE float VALUE a_base_price + b_tax;
```

**Why good:** Named to respect alphabetical processing order, each field depends only on alphabetically-prior fields

---

## Pattern 3: Table and Field Permissions

### Good Example -- Record-Level Access Control

```surql
-- Users can read public data, modify only their own records
DEFINE TABLE post SCHEMAFULL
  PERMISSIONS
    FOR select WHERE published = true OR author = $auth.id
    FOR create WHERE $auth.id != NONE
    FOR update WHERE author = $auth.id
    FOR delete WHERE author = $auth.id OR $auth.role = "admin";

DEFINE FIELD title ON post TYPE string ASSERT string::len($value) >= 1;
DEFINE FIELD content ON post TYPE string;
DEFINE FIELD author ON post TYPE record<user> VALUE $auth.id READONLY;
DEFINE FIELD published ON post TYPE bool DEFAULT false;
DEFINE FIELD created_at ON post TYPE datetime VALUE time::now() READONLY;

-- Field-level permissions (restrict sensitive data)
DEFINE FIELD email ON user TYPE string
  PERMISSIONS
    FOR select WHERE id = $auth.id OR $auth.role = "admin"
    FOR update WHERE id = $auth.id;
```

**Why good:** Table permissions per operation type, `$auth.id` for ownership checks, `$auth.role` for admin access, `READONLY` author field set from auth context, field-level permissions for sensitive data like email

### Good Example -- Pre-Computed View Table

```surql
-- Materialized view that auto-updates
DEFINE TABLE post_stats TYPE NORMAL AS
  SELECT
    author,
    count() AS post_count,
    math::mean(<float> published) AS publish_rate
  FROM post
  GROUP BY author;

-- Query the view instead of aggregating on every request
SELECT * FROM post_stats WHERE author = user:alice;
```

**Why good:** `AS SELECT` creates an auto-updating materialized view, avoids running expensive aggregation on every read, `TYPE NORMAL` makes it queryable like a regular table

---

## Pattern 4: DEFINE ACCESS (Authentication)

### Good Example -- Record-Based Authentication

```surql
-- Define access method for application users
DEFINE ACCESS account ON DATABASE TYPE RECORD
  SIGNUP (
    CREATE user SET
      email = string::lowercase($email),
      password = crypto::argon2::generate($password),
      name = $name,
      role = "user",
      created_at = time::now()
  )
  SIGNIN (
    SELECT * FROM user
      WHERE email = string::lowercase($email)
      AND crypto::argon2::compare(password, $password)
  )
  WITH JWT ALGORITHM HS512 KEY "your-secret-key-min-64-chars-long-for-hs512-algorithm-security"
  WITH REFRESH
  DURATION FOR TOKEN 15m FOR SESSION 12h;
```

```typescript
// SDK usage -- signup
await db.signup({
  access: "account",
  variables: {
    email: "alice@example.com",
    password: "secure-password-123",
    name: "Alice",
  },
});

// SDK usage -- signin
const token = await db.signin({
  access: "account",
  variables: {
    email: "alice@example.com",
    password: "secure-password-123",
  },
});

// After signin, $auth is available in permissions
// $auth.id = user:xxx (the authenticated user's record ID)
```

**Why good:** `crypto::argon2` for password hashing (not MD5/SHA), `string::lowercase` normalizes email, short token duration (15m) limits token theft impact, refresh tokens for long sessions, `$auth` available in all subsequent permission checks

### Good Example -- JWT-Based Authentication (External Provider)

```surql
-- Validate tokens from external auth provider
DEFINE ACCESS external_auth ON DATABASE TYPE JWT
  ALGORITHM RS256
  URL "https://auth.example.com/.well-known/jwks.json";

-- Or with a static key
DEFINE ACCESS api_auth ON DATABASE TYPE JWT
  ALGORITHM HS256
  KEY "your-shared-secret";
```

**Why good:** `URL` for JWKS-based dynamic key rotation (production), RS256 asymmetric algorithm prevents key exposure, static key option for simpler setups

### Bad Example -- Weak Authentication

```surql
-- BAD: Multiple security issues
DEFINE ACCESS account ON DATABASE TYPE RECORD
  SIGNUP (
    CREATE user SET
      email = $email,                          -- Not normalized
      password = $password,                     -- Stored in PLAINTEXT
      role = $role                              -- User can set their own role!
  )
  SIGNIN (
    SELECT * FROM user WHERE email = $email AND password = $password
  )
  WITH JWT ALGORITHM HS256 KEY "secret"
  DURATION FOR TOKEN 30d;                       -- Token valid for 30 days
```

**Why bad:** Password stored in plaintext (must use `crypto::argon2::generate`), user controls their own role (privilege escalation), email not normalized, weak JWT key, excessively long token duration

---

## Pattern 5: Indexes and Performance

### Good Example -- Index Definitions

```surql
-- Unique index
DEFINE INDEX email_unique ON user FIELDS email UNIQUE;

-- Standard index for frequent queries
DEFINE INDEX role_idx ON user FIELDS role;

-- Composite index
DEFINE INDEX user_role_created ON user FIELDS role, created_at;

-- Full-text search index
DEFINE ANALYZER custom_analyzer TOKENIZERS blank, class FILTERS lowercase, snowball(english);
DEFINE INDEX post_search ON post FIELDS title, content SEARCH ANALYZER custom_analyzer BM25;

-- Vector index for embeddings
DEFINE INDEX embedding_idx ON document FIELDS embedding MTREE DIMENSION 1536;
```

**Why good:** `UNIQUE` for constraints, composite index for multi-field queries, BM25 full-text search with custom analyzer, MTREE for vector similarity search

### Good Example -- Full-Text Search Query

```surql
-- Search with BM25 scoring
SELECT *, search::score(1) AS relevance
  FROM post
  WHERE title @1@ "surrealdb tutorial"
  ORDER BY relevance DESC
  LIMIT 20;

-- Highlight matching terms
SELECT *, search::highlight("<b>", "</b>", 1) AS highlighted
  FROM post
  WHERE content @1@ "graph database"
  LIMIT 10;
```

**Why good:** `@1@` binds to index reference 1, `search::score` for relevance ranking, `search::highlight` for result snippets, `LIMIT` prevents unbounded results

---

## Pattern 6: Multi-Tenancy with Namespaces

### Good Example -- Tenant Isolation

```surql
-- Root-level: create tenant namespaces
DEFINE NAMESPACE tenant_acme;
DEFINE NAMESPACE tenant_globex;

-- Within each namespace, create identical schema
-- (run for each tenant namespace)
USE NS tenant_acme DB production;

DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD name ON user TYPE string;
DEFINE FIELD email ON user TYPE string;
DEFINE INDEX email_idx ON user FIELDS email UNIQUE;
```

```typescript
// Switch tenant context at runtime
async function switchTenant(db: Surreal, tenantId: string): Promise<void> {
  await db.use({
    namespace: `tenant_${tenantId}`,
    database: "production",
  });
}

// Tenant-scoped queries -- data is fully isolated
await switchTenant(db, "acme");
const acmeUsers = await db.query<[User[]]>("SELECT * FROM user");

await switchTenant(db, "globex");
const globexUsers = await db.query<[User[]]>("SELECT * FROM user");
// acmeUsers and globexUsers are completely separate datasets
```

**Why good:** Namespace-level isolation guarantees data separation, identical schema per tenant, runtime context switching, no cross-tenant data leakage possible at the database level

---

_For core patterns, see [core.md](core.md). For graph patterns, see [graph-relations.md](graph-relations.md). For live queries, see [live-queries.md](live-queries.md)._
