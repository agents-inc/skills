# Gel (formerly EdgeDB) Core Examples

> Client setup, schema definition, EdgeQL queries, and migration workflow. See [SKILL.md](../SKILL.md) for core concepts.
>
> **Package names:** New projects use `gel` and `@gel/generate`. Legacy `edgedb` and `@edgedb/generate` packages still work via compatibility shims.

**Query builder:** See [query-builder.md](query-builder.md). **Advanced schema:** See [advanced-schema.md](advanced-schema.md).

---

## Pattern 1: Client Setup

### Good Example -- Auto-Discovery Connection

```typescript
import { createClient } from "gel";

// Reads connection info from gel.toml (or edgedb.toml) in the project root
// This is the standard development workflow
const client = createClient();

export { client };
```

**Why good:** Zero-config for development, `createClient()` auto-discovers from project directory, named export

### Good Example -- Production with Environment Variable

```typescript
import { createClient } from "gel";

// In production, set GEL_DSN (or EDGEDB_DSN) environment variable:
// gel://user:password@hostname:5656/dbname
const client = createClient();

// Or with explicit concurrency control
const MAX_CONCURRENCY = 10;
const clientWithPool = createClient({
  concurrency: MAX_CONCURRENCY,
});

export { client, clientWithPool };
```

**Why good:** `createClient()` automatically reads `GEL_DSN` (or `EDGEDB_DSN`) env var, named constant for concurrency, no credentials in code

### Good Example -- Client with Globals

```typescript
import { createClient } from "gel";

const baseClient = createClient();

// Derive a client with global variables set (for access policies)
function getAuthenticatedClient(userId: string) {
  return baseClient.withGlobals({
    current_user_id: userId,
  });
}

export { baseClient, getAuthenticatedClient };
```

**Why good:** `withGlobals` creates a derived client with global variables set, used with access policies for row-level security, does not modify the original client

### Bad Example -- Hardcoded Credentials

```typescript
import { createClient } from "gel";

// BAD: Credentials in source code, no auto-discovery
const client = createClient({
  dsn: "gel://admin:p@ssw0rd@db.example.com:5656/production",
});
export default client;
```

**Why bad:** Hardcoded credentials, DSN will be committed to version control, default export

---

## Pattern 2: Query Methods

### Good Example -- Choosing the Right Method

```typescript
import { createClient } from "gel";

const client = createClient();

// .query() -- returns an array (zero or more results)
const users = await client.query<{ name: string; email: string }>(
  `select User { name, email } filter .is_active = true`,
);

// .querySingle() -- returns one result or null
const user = await client.querySingle<{ name: string; email: string }>(
  `select User { name, email } filter .id = <uuid>$id`,
  { id: "a1b2c3d4-..." },
);

// .queryRequiredSingle() -- returns exactly one or throws NoDataError
const totalUsers =
  await client.queryRequiredSingle<number>(`select count(User)`);

// .execute() -- runs a statement, returns nothing
await client.execute(
  `delete User filter .is_deactivated = true and .deactivated_at < <datetime>$cutoff`,
  { cutoff: cutoffDate },
);

export { users, user, totalUsers };
```

**Why good:** Method matches expected cardinality, type parameter for result shape, parameterized queries prevent injection

### Bad Example -- Wrong Cardinality Method

```typescript
// BAD: Using query() when you expect exactly one result
const allUsers = await client.query(`select count(User)`);
const count = allUsers[0]; // Awkward -- count() always returns exactly one value

// BAD: Using queryRequiredSingle() when result might not exist
const maybeUser = await client.queryRequiredSingle(
  `select User filter .email = <str>$email`,
  { email: "unknown@example.com" },
);
// Throws NoDataError if user doesn't exist!
```

**Why bad:** `query()` for a guaranteed-single result adds unnecessary array unwrapping, `queryRequiredSingle()` throws when result is absent -- use `querySingle()` for optional results

---

## Pattern 3: Parameterized Queries

### Good Example -- Type-Safe Parameters

```edgeql
# Parameters are declared with <type>$name syntax
select User {
  name,
  email,
  posts: {
    title,
    status,
  } filter .status = <Status>$status,
} filter .email = <str>$email;
```

```typescript
const result = await client.querySingle(
  `select User {
    name,
    email,
    posts: {
      title,
      status,
    } filter .status = <Status>$status,
  } filter .email = <str>$email`,
  { email: "alice@example.com", status: "published" },
);
```

**Why good:** Parameters are type-annotated (`<str>`, `<uuid>`, `<int64>`), preventing injection and ensuring type safety at the database level

### Bad Example -- String Interpolation

```typescript
// BAD: SQL injection vulnerability
const email = userInput;
const result = await client.query(
  `select User filter .email = '${email}'`, // NEVER DO THIS
);
```

**Why bad:** String interpolation allows injection attacks, bypasses type checking, no parameterization

---

## Pattern 4: Schema Definition

### Good Example -- Complete Type with Constraints

```
# dbschema/default.gel
module default {
  scalar type Role extending enum<admin, moderator, user>;

  type Organization {
    required name: str {
      constraint exclusive;
      constraint min_len_value(1);
      constraint max_len_value(100);
    };
    description: str;
    created_at: datetime {
      default := datetime_of_statement();
      readonly := true;
    };

    multi members := .<organization[is User];  # computed backlink

    index on (.name);
  }

  type User {
    required name: str {
      constraint min_len_value(1);
    };
    required email: str {
      constraint exclusive;
      constraint regexp(r'^[^@]+@[^@]+\.[^@]+$');
    };
    required role: Role {
      default := Role.user;
    };
    required organization: Organization;
    is_active: bool {
      default := true;
    };
    last_login_at: datetime;

    # Computed properties
    display_name := .name ++ ' (' ++ <str>.role ++ ')';

    index on (.email);
  }
}
```

**Why good:** `required` enforces non-null, `constraint exclusive` for uniqueness, enum as scalar type, `readonly` for immutable timestamps, computed backlinks for bidirectional traversal, computed property for derived data, indexes on frequently filtered fields, `default` values for optional fields

### Good Example -- Multi Links and Constraints

```
type Course {
  required title: str {
    constraint exclusive;
  };
  required instructor: User;
  multi students: User;
  multi prerequisites: Course;
  max_enrollment: int32 {
    constraint min_value(1);
  };

  # Compound constraint -- same student can't enroll twice
  # (handled automatically by multi link set semantics)

  # Cross-field constraint
  constraint expression on (
    count(.students) <= .max_enrollment ?? 999
  );
}
```

**Why good:** Multi links for many-to-many (students) and self-referential (prerequisites), cross-field constraint using expression, coalesce operator `??` handles null max_enrollment

### Bad Example -- No Constraints or Links

```
# BAD: No constraints, no links, storing IDs manually
type User {
  name: str;
  email: str;
  org_id: uuid;  # Should be a link!
}
```

**Why bad:** No `required` makes everything nullable, no uniqueness on email, raw `uuid` instead of `link` -- no referential integrity, no traversal, no cascading deletes

---

## Pattern 5: EdgeQL SELECT Patterns

### Good Example -- Nested Shapes with Filtering

```edgeql
select Post {
  title,
  status,
  excerpt := .body[0:200],  # inline computed
  author: {
    name,
    email,
  },
  tags: {
    name,
  } order by .name,
  comment_count := count(.comments),
}
filter .status = Status.published
order by .published_at desc
limit 20
offset 40;
```

**Why good:** Nested shapes for related objects, inline computed field (excerpt), aggregation in shape (comment_count), filtering/ordering/pagination at top level, ordering on nested link

### Good Example -- Conditional Selection

```edgeql
# Select with conditional computed field
select User {
  name,
  email,
  status := 'admin' if .role = Role.admin else 'regular',
  post_count := count(.posts),
  recent_post := (
    select .posts
    order by .created_at desc
    limit 1
  ) { title, created_at },
}
filter .is_active = true;
```

**Why good:** Inline conditional with `if..else`, subquery for latest post with its own shape, aggregation alongside scalar fields

---

## Pattern 6: EdgeQL INSERT Patterns

### Good Example -- Insert with Link Resolution

```edgeql
# Insert resolving links via subqueries
insert Post {
  title := 'Getting Started with EdgeDB',
  body := 'EdgeDB is a graph-relational database...',
  status := Status.draft,
  author := (
    select User filter .email = 'alice@example.com'
  ),
  tags := {
    (select Tag filter .name = 'edgedb'),
    (select Tag filter .name = 'tutorial'),
  },
};
```

**Why good:** Links assigned via subqueries (not raw IDs), set literal `{ ... }` for multi link, author resolved by business key (email)

### Good Example -- Insert or Update (Upsert)

```edgeql
# Insert unless conflict, then update
insert User {
  name := 'Alice',
  email := 'alice@example.com',
  role := Role.admin,
  organization := (select Organization filter .name = 'Acme'),
}
unless conflict on .email
else (
  update User set {
    name := 'Alice',
    role := Role.admin,
  }
);
```

**Why good:** `unless conflict on` targets the exclusive constraint, `else` clause performs update on conflict, avoids race conditions between check-then-insert

---

## Pattern 7: EdgeQL UPDATE Patterns

### Good Example -- Multi Link Manipulation

```edgeql
# Add tags without removing existing ones
update Post
filter .id = <uuid>$post_id
set {
  tags += (select Tag filter .name in {'featured', 'trending'}),
};

# Remove specific tags
update Post
filter .id = <uuid>$post_id
set {
  tags -= (select Tag filter .name = 'draft'),
};

# Replace all tags entirely
update Post
filter .id = <uuid>$post_id
set {
  tags := (select Tag filter .name in {'final', 'reviewed'}),
};
```

**Why good:** `+=` adds to set, `-=` removes from set, `:=` replaces entire set -- three distinct operations for multi link manipulation

### Good Example -- Self-Referential Update

```edgeql
# Increment a counter using current value
update Post
filter .id = <uuid>$post_id
set {
  view_count := .view_count + 1,
};
```

**Why good:** `.view_count` refers to the current value, update is atomic

---

## Pattern 8: Migration Workflow

### Good Example -- Standard Development Workflow

```bash
# 1. Start with a clean state
gel migration status
# Shows: Database is up to date. No migrations pending.

# 2. Edit schema files
# vim dbschema/default.gel
# Add: required phone: str; to User type

# 3. Generate migration (interactive)
gel migration create
# Gel will prompt:
# "did you add property 'phone' to object type 'default::User'?"
# Type 'y' to confirm

# 4. Review generated migration file (optional but recommended)
# cat dbschema/migrations/00002-m1abc123.edgeql

# 5. Apply migration
gel migrate

# 6. Regenerate TypeScript types
npx @gel/generate edgeql-js

# 7. Update your TypeScript code to use the new field
```

**Why good:** Schema-first workflow, interactive migration creation with human review, separate create and apply steps, TypeScript code generation after migration

### Prototyping with Watch Mode

```bash
# Auto-create and apply migrations on file change (prototyping only)
gel watch --migrate
```

**Why good:** Rapid iteration during development -- Gel monitors `.gel` files and automatically creates and applies migrations in the background. Not for production use.

### Handling Migration Conflicts

```bash
# If migration create fails due to schema issues:
# 1. Fix the .gel files
# 2. Re-run migration create
gel migration create

# If you need to see what changed:
gel migration status
gel describe schema  # current database schema

# If you need to start over (development only):
gel migration create --allow-empty  # create empty migration to reset state
```

---

_For query builder patterns, see [query-builder.md](query-builder.md). For advanced schema, see [advanced-schema.md](advanced-schema.md)._
