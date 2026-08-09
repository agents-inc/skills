# WatermelonDB Quick Reference

> API reference, decision framework, and decorator cheat sheet. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Decorator Reference

| Decorator                       | Import       | Purpose                                  | Notes                             |
| ------------------------------- | ------------ | ---------------------------------------- | --------------------------------- |
| `@field(col)`                   | `decorators` | Raw column value (string/number/boolean) | Matches schema column type        |
| `@text(col)`                    | `decorators` | Text with auto-trim                      | Use for user-editable text        |
| `@date(col)`                    | `decorators` | Unix timestamp -> JS Date                | Column must be `number` type      |
| `@readonly`                     | `decorators` | Prevents any assignment                  | Use with `@date` for `updated_at` |
| `@nochange`                     | `decorators` | Set once in `create()` only              | Throws on `update()`              |
| `@json(col, sanitizer)`         | `decorators` | Parse JSON from string column            | Cannot query JSON contents        |
| `@relation(table, fk)`          | `decorators` | Mutable to-one relation                  | FK can be reassigned              |
| `@immutableRelation(table, fk)` | `decorators` | Immutable to-one relation                | FK set once, better perf          |
| `@children(table)`              | `decorators` | To-many relation (Query)                 | Returns Query, not array          |
| `@lazy`                         | `decorators` | Computed query property                  | For complex/M2M queries           |
| `@writer`                       | `decorators` | Method that modifies DB                  | Required for all writes           |
| `@reader`                       | `decorators` | Method for consistent reads              | Prevents writes during execution  |

All decorators import from `@nozbe/watermelondb/decorators`.

---

## Query Operators (Q.\*)

| Operator                  | Example                                        | Purpose                          |
| ------------------------- | ---------------------------------------------- | -------------------------------- |
| `Q.where(col, val)`       | `Q.where("is_pinned", true)`                   | Equality match                   |
| `Q.eq(val)`               | `Q.where("status", Q.eq("active"))`            | Explicit equality                |
| `Q.notEq(val)`            | `Q.where("status", Q.notEq("archived"))`       | Inequality                       |
| `Q.gt(val)`               | `Q.where("count", Q.gt(0))`                    | Greater than (excludes null)     |
| `Q.weakGt(val)`           | `Q.where("count", Q.weakGt(0))`                | Greater than (includes null)     |
| `Q.gte(val)`              | `Q.where("count", Q.gte(10))`                  | Greater than or equal            |
| `Q.lt(val)`               | `Q.where("count", Q.lt(100))`                  | Less than                        |
| `Q.lte(val)`              | `Q.where("count", Q.lte(100))`                 | Less than or equal               |
| `Q.between(a, b)`         | `Q.where("count", Q.between(10, 100))`         | Range                            |
| `Q.oneOf(arr)`            | `Q.where("status", Q.oneOf(["a", "b"]))`       | IN array                         |
| `Q.notIn(arr)`            | `Q.where("status", Q.notIn(["x"]))`            | NOT IN array                     |
| `Q.like(pat)`             | `Q.where("title", Q.like("%search%"))`         | Pattern match (case-insensitive) |
| `Q.notLike(pat)`          | `Q.where("title", Q.notLike("%spam%"))`        | Inverse pattern match            |
| `Q.includes(str)`         | `Q.where("body", Q.includes("keyword"))`       | Substring containment            |
| `Q.column(col)`           | `Q.where("likes", Q.gt(Q.column("dislikes")))` | Column-to-column comparison      |
| `Q.and(...)`              | `Q.and(Q.where(...), Q.where(...))`            | AND conditions                   |
| `Q.or(...)`               | `Q.or(Q.where(...), Q.where(...))`             | OR conditions                    |
| `Q.on(table, ...)`        | `Q.on("comments", "is_active", true)`          | JOIN condition                   |
| `Q.sortBy(col, dir)`      | `Q.sortBy("created_at", Q.desc)`               | Sort (Q.asc / Q.desc)            |
| `Q.take(n)`               | `Q.take(20)`                                   | Limit results                    |
| `Q.skip(n)`               | `Q.skip(10)`                                   | Skip first N                     |
| `Q.sanitizeLikeString(s)` | `Q.sanitizeLikeString(userInput)`              | Escape special chars for Q.like  |

Import: `import { Q } from "@nozbe/watermelondb"`

---

## Query Execution Methods

| Method                      | Returns               | Reactive?                          |
| --------------------------- | --------------------- | ---------------------------------- |
| `.fetch()`                  | `Promise<Model[]>`    | No                                 |
| `.fetchCount()`             | `Promise<number>`     | No                                 |
| `.fetchIds()`               | `Promise<string[]>`   | No                                 |
| `.observe()`                | `Observable<Model[]>` | Yes -- add/remove                  |
| `.observeWithColumns(cols)` | `Observable<Model[]>` | Yes -- add/remove + column changes |
| `.observeCount()`           | `Observable<number>`  | Yes (throttled 250ms)              |

---

## Model Instance Methods

| Method                               | Context   | Purpose                       |
| ------------------------------------ | --------- | ----------------------------- |
| `record.update(builder)`             | `@writer` | Modify record fields          |
| `record.prepareUpdate(builder)`      | `batch()` | Prepare update for batch      |
| `record.markAsDeleted()`             | `@writer` | Soft delete (sync-aware)      |
| `record.prepareMarkAsDeleted()`      | `batch()` | Prepare soft delete for batch |
| `record.destroyPermanently()`        | `@writer` | Hard delete (permanent)       |
| `record.prepareDestroyPermanently()` | `batch()` | Prepare hard delete for batch |
| `record.observe()`                   | any       | Observable of record changes  |
| `collection.create(builder)`         | `@writer` | Create new record             |
| `collection.prepareCreate(builder)`  | `batch()` | Prepare create for batch      |
| `database.get(table)`                | any       | Get collection by table name  |
| `database.batch(...)`                | `@writer` | Execute batch operations      |

---

## Schema Column Types

| Type      | Default | JS Type   | Use For                     |
| --------- | ------- | --------- | --------------------------- |
| `string`  | `""`    | `string`  | Text, IDs, JSON strings     |
| `number`  | `0`     | `number`  | Counts, timestamps, amounts |
| `boolean` | `false` | `boolean` | Flags, toggles              |

Add `isOptional: true` to allow `null`. Add `isIndexed: true` for query-heavy columns (especially FKs).

---

## Migration Steps

| Function        | Purpose                       | Parameters                                  |
| --------------- | ----------------------------- | ------------------------------------------- |
| `addColumns()`  | Add columns to existing table | `{ table, columns }`                        |
| `createTable()` | Create new table              | `{ name, columns }` (same as `tableSchema`) |

Import: `import { schemaMigrations, addColumns, createTable } from "@nozbe/watermelondb/Schema/migrations"`

---

## Sync API

| Parameter                    | Type                                                                           | Required | Purpose                            |
| ---------------------------- | ------------------------------------------------------------------------------ | -------- | ---------------------------------- |
| `database`                   | `Database`                                                                     | Yes      | WatermelonDB instance              |
| `pullChanges`                | `async ({ lastPulledAt, schemaVersion, migration }) => { changes, timestamp }` | Yes      | Fetch server changes               |
| `pushChanges`                | `async ({ changes, lastPulledAt }) => void`                                    | No       | Send local changes                 |
| `migrationsEnabledAtVersion` | `number`                                                                       | No       | Enable schema-aware sync           |
| `sendCreatedAsUpdated`       | `boolean`                                                                      | No       | Created records in `updated` array |
| `conflictResolver`           | `function`                                                                     | No       | Custom conflict resolution         |
| `log`                        | `object`                                                                       | No       | Diagnostic logging                 |

Import: `import { synchronize } from "@nozbe/watermelondb/sync"`

---

## React Helpers

All from `@nozbe/watermelondb/react`:

| Export                          | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `DatabaseProvider`              | Context provider for database instance        |
| `useDatabase()`                 | Hook to access database from context          |
| `withObservables(deps, mapper)` | HOC for reactive component data               |
| `compose(...enhancers)`         | Combine multiple HOCs                         |
| `withDatabase`                  | HOC that injects `database` prop from context |

---

## Version History

| Version | Key Changes                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| v0.27   | React helpers consolidated to `@nozbe/watermelondb/react`, diagnostics API, removed `@nozbe/with-observables` |
| v0.28   | Requires RN 0.74+, Node 18+, iOS 12+ deployment target                                                        |
