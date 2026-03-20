# Gel (formerly EdgeDB) Reference

> Decision frameworks, quick reference, CLI commands, and scalar types. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.
>
> **CLI naming:** New projects use `gel` CLI commands. Legacy `edgedb` CLI commands still work via compatibility symlinks.

---

## Decision Framework

### Link vs Property

```
Does the field reference another object type?
|-- YES --> Use a link
|   |-- Is it exactly one related object?
|   |   |-- YES --> required link (or optional link if nullable)
|   |   '-- NO --> multi link
|   '-- Do you need to traverse it in reverse?
|       |-- YES --> Add a computed backlink on the target type
|       '-- NO --> Just the forward link is enough
'-- NO --> Use a property
    |-- Is it one of the built-in scalar types?
    |   |-- YES --> Use the scalar type directly (str, int64, float64, bool, etc.)
    |   '-- NO --> Define a custom scalar (enum, constrained str, etc.)
    '-- Is it a nested structure?
        |-- YES --> Consider a separate type with a link (EdgeDB has no embedded documents)
        '-- NO --> Property with appropriate scalar type
```

### EdgeQL vs Query Builder

```
Are you writing TypeScript?
|-- YES --> Do you want compile-time type safety?
|   |-- YES --> Use the query builder (e.select, e.insert, etc.)
|   '-- NO --> Raw EdgeQL strings with type parameters
'-- NO --> Raw EdgeQL strings (only option for non-TS)

Is the query dynamic (runtime-determined shape)?
|-- YES --> Query builder composes better for dynamic shapes
'-- NO --> Either approach works; query builder preferred for consistency
```

### required vs optional

```
Must this field always have a value?
|-- YES --> required (INSERT will fail without it)
'-- NO --> optional (default -- allows empty set)

For multi links:
|-- Must there be at least one? --> required multi link
'-- Can it be empty? --> multi link (no required)
```

---

## CLI Commands

```bash
# Project initialization
gel project init                   # Initialize project with gel.toml

# Instance management
gel instance create my_project     # Create a new instance
gel instance list                  # List instances
gel instance destroy my_project    # Destroy an instance

# Migration workflow
gel migration create               # Generate migration from .gel diff (interactive)
gel migrate                        # Apply pending migrations (idempotent)
gel migration status               # Show migration status
gel watch --migrate                # Auto-migrate on file change (prototyping)

# Interactive query shell
gel                                # Open EdgeQL REPL
gel query "select 1 + 1"          # Run a single query

# Schema introspection
gel describe type User            # Show type details
gel describe schema               # Dump full schema

# Branching (v5+)
gel branch create dev             # Create a branch
gel branch switch dev             # Switch to a branch
gel branch list                   # List branches

# Code generation
npx @gel/generate edgeql-js       # Generate query builder
npx @gel/generate queries         # Generate typed functions from .edgeql files
npx @gel/generate interfaces      # Generate TypeScript interfaces from schema

# UI
gel ui                            # Open the built-in web UI
```

---

## Scalar Types

| EdgeQL Type           | TypeScript Type | Description                         |
| --------------------- | --------------- | ----------------------------------- |
| `str`                 | `string`        | Unicode string                      |
| `bool`                | `boolean`       | Boolean                             |
| `int16`               | `number`        | 16-bit integer                      |
| `int32`               | `number`        | 32-bit integer                      |
| `int64`               | `number`        | 64-bit integer                      |
| `float32`             | `number`        | 32-bit float                        |
| `float64`             | `number`        | 64-bit float                        |
| `bigint`              | `bigint`        | Arbitrary precision integer         |
| `decimal`             | N/A (string)    | Arbitrary precision decimal         |
| `uuid`                | `string`        | UUID (auto-generated `id` property) |
| `datetime`            | `Date`          | Timezone-aware datetime             |
| `cal::local_datetime` | `LocalDateTime` | Timezone-naive datetime             |
| `cal::local_date`     | `LocalDate`     | Date without time                   |
| `cal::local_time`     | `LocalTime`     | Time without date                   |
| `duration`            | `Duration`      | Time span                           |
| `json`                | `unknown`       | Arbitrary JSON                      |
| `bytes`               | `Buffer`        | Binary data                         |
| `sequence`            | `number`        | Auto-incrementing integer           |

---

## EdgeQL Operators Quick Reference

| Operator         | Description                | Example                            |
| ---------------- | -------------------------- | ---------------------------------- |
| `:=`             | Assignment                 | `set { name := 'Alice' }`          |
| `=` / `!=`       | Equality / inequality      | `filter .name = 'Alice'`           |
| `?=` / `?!=`     | Optional equality          | `filter .name ?= 'Alice'`          |
| `++`             | String/array concatenation | `'Hello' ++ ' ' ++ 'World'`        |
| `+` `-` `*` `/`  | Arithmetic                 | `.price * .quantity`               |
| `and` `or` `not` | Logical                    | `.age > 18 and .active = true`     |
| `in`             | Set membership             | `.status in {'active', 'pending'}` |
| `like` / `ilike` | Pattern matching           | `.name ilike '%alice%'`            |
| `exists`         | Non-empty set test         | `filter exists .email`             |
| `??`             | Coalesce (first non-empty) | `.nickname ?? .name`               |
| `[is Type]`      | Type filter                | `.<author[is Post]`                |
| `if..else`       | Conditional                | `'Yes' if .active else 'No'`       |
| `distinct`       | Deduplicate set            | `select distinct .tags`            |
| `detached`       | Escape current scope       | `detached User` in subqueries      |

---

## Set Operations

| Operation         | Description          | Example                              |
| ----------------- | -------------------- | ------------------------------------ |
| `union` / `UNION` | Set union            | `{1, 2} union {2, 3}` => `{1, 2, 3}` |
| `intersect`       | Set intersection     | Not built-in; use filter + in        |
| `except`          | Set difference       | `{1, 2, 3} except {2}` => `{1, 3}`   |
| `count()`         | Count elements       | `select count(User)`                 |
| `exists`          | Test non-empty       | `select exists (select User)`        |
| `array_agg()`     | Convert set to array | `select array_agg(User.name)`        |
| `array_unpack()`  | Convert array to set | `select array_unpack([1, 2, 3])`     |

---

## Common Constraints

| Constraint             | Description               | Example Usage                              |
| ---------------------- | ------------------------- | ------------------------------------------ |
| `exclusive`            | Unique value              | `constraint exclusive;`                    |
| `exclusive on (expr)`  | Compound unique           | `constraint exclusive on ((.email, .org))` |
| `min_value(n)`         | Minimum numeric value     | `constraint min_value(0);`                 |
| `max_value(n)`         | Maximum numeric value     | `constraint max_value(1000);`              |
| `min_len_value(n)`     | Minimum string length     | `constraint min_len_value(1);`             |
| `max_len_value(n)`     | Maximum string length     | `constraint max_len_value(200);`           |
| `regexp(r'pattern')`   | Regex validation          | `constraint regexp(r'^[a-z]+$');`          |
| `expression on (expr)` | Custom boolean expression | `constraint expression on (.start < .end)` |

---

## Link Modification Operators (UPDATE)

| Operator | Description            | Example                            |
| -------- | ---------------------- | ---------------------------------- |
| `:=`     | Replace entire set     | `set { tags := ... }`              |
| `+=`     | Add to multi link      | `set { tags += (select Tag ...) }` |
| `-=`     | Remove from multi link | `set { tags -= (select Tag ...) }` |

---

## Environment Variables

Both `GEL_*` and `EDGEDB_*` prefixes are supported. New projects should prefer `GEL_*`.

| Variable (new / legacy)                          | Description                     |
| ------------------------------------------------ | ------------------------------- |
| `GEL_DSN` / `EDGEDB_DSN`                         | Full connection string          |
| `GEL_INSTANCE` / `EDGEDB_INSTANCE`               | Instance name                   |
| `GEL_HOST` / `EDGEDB_HOST`                       | Server hostname                 |
| `GEL_PORT` / `EDGEDB_PORT`                       | Server port (default: 5656)     |
| `GEL_DATABASE` / `EDGEDB_DATABASE`               | Database name                   |
| `GEL_BRANCH` / `EDGEDB_BRANCH`                   | Branch name (v5+)               |
| `GEL_USER` / `EDGEDB_USER`                       | Username                        |
| `GEL_PASSWORD` / `EDGEDB_PASSWORD`               | Password                        |
| `GEL_SECRET_KEY` / `EDGEDB_SECRET_KEY`           | Secret key for Gel Cloud        |
| `GEL_CLIENT_SECURITY` / `EDGEDB_CLIENT_SECURITY` | `insecure_dev_mode` or `strict` |

---

## Naming Migration (Feb 2025)

EdgeDB was rebranded to **Gel** in February 2025. All old names continue to work via compatibility shims.

| Old Name            | New Name         | Status                    |
| ------------------- | ---------------- | ------------------------- |
| `edgedb` (npm)      | `gel`            | Shim available, both work |
| `@edgedb/generate`  | `@gel/generate`  | Shim available, both work |
| `edgedb` CLI        | `gel` CLI        | Symlinks available        |
| `edgedb.toml`       | `gel.toml`       | Both supported            |
| `.esdl` files       | `.gel` files     | Both supported            |
| `EDGEDB_*` env vars | `GEL_*` env vars | Both supported            |

An automated codemod tool is available for migration: see the [official blog post](https://www.geldata.com/blog/edgedb-is-now-gel-and-postgres-is-the-future) for details.
