---
name: mobile-storage-watermelondb
description: WatermelonDB reactive local database for React Native - schema, models, decorators, reactive queries, relations, writers/readers, batch operations, migrations, sync
---

# WatermelonDB Patterns

> **Quick Guide:** Use WatermelonDB for offline-first React Native apps with large local datasets. Define schemas with `appSchema`/`tableSchema`, models with decorators (`@field`, `@text`, `@date`, `@readonly`, `@relation`, `@children`). All writes MUST go through `@writer` methods or `database.write()`. Connect components reactively with `withObservables` from `@nozbe/watermelondb/react`. Use `batch()` for multi-record operations. Lazy loading means nothing is loaded until requested -- queries run on a native SQLite thread.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap ALL database modifications in `@writer` methods or `database.write()` -- writes outside a writer throw at runtime)**

**(You MUST keep schema version and migration `toVersion` in sync -- migrations cannot be newer than the schema version)**

**(You MUST use `@immutableRelation` for relations that never change after creation -- it provides extra safety and performance over `@relation`)**

**(You MUST use `prepareCreate`/`prepareUpdate`/`prepareMarkAsDeleted` inside `batch()` -- never `await` individual operations in a batch)**

</critical_requirements>

---

**Auto-detection:** WatermelonDB, @nozbe/watermelondb, appSchema, tableSchema, @field, @text, @date, @readonly, @json, @nochange, @writer, @reader, @relation, @immutableRelation, @children, @lazy, withObservables, useDatabase, DatabaseProvider, observe, observeWithColumns, synchronize, pullChanges, pushChanges, schemaMigrations, Q.where, Q.on, database.write, database.batch, markAsDeleted, destroyPermanently

**When to use:**

- Building offline-first React Native apps with large local datasets (thousands+ records)
- Defining relational data models with typed fields and relations
- Connecting React components to live-updating database queries
- Syncing local data with a remote server via `synchronize()`
- Migrating database schema across app versions
- Performing bulk operations with `batch()`

**Key patterns covered:**

- Schema definition with `appSchema`/`tableSchema` and column types
- Model classes with field decorators (`@field`, `@text`, `@date`, `@readonly`, `@json`)
- Relations (`@relation`, `@immutableRelation`, `@children`, `@lazy`)
- Writers/readers for safe database mutations and reads
- Reactive components with `withObservables` and `observe()`/`observeWithColumns()`
- Query API with `Q.where`, `Q.on`, `Q.sortBy`, `Q.like`, `Q.oneOf`
- Batch operations for multi-record create/update/delete
- Schema migrations with `schemaMigrations`/`addColumns`/`createTable`
- Sync protocol with `synchronize()`, `pullChanges`, `pushChanges`

**When NOT to use:**

- Simple key-value storage (use a key-value store)
- Apps with small datasets that fit comfortably in memory
- Data that only lives on the server with no offline requirement
- Non-relational storage needs (flat preferences, tokens)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Schema, models, decorators, CRUD, queries, reactive components
- [examples/sync.md](examples/sync.md) - Sync protocol, migrations, batch operations
- [reference.md](reference.md) - API tables, decision framework, decorator reference

---

<philosophy>

## Philosophy

WatermelonDB is a **reactive, lazy-loading** database built on SQLite for React Native apps that need to handle thousands of records without blocking the JS thread. The key insight: nothing is loaded until requested, and all querying runs on a separate native SQLite thread.

**Core principles:**

1. **Lazy by default** -- records are not loaded into JS memory until accessed. A collection with 10,000 records costs nothing until you query it.
2. **Reactive** -- `observe()` and `withObservables` push updates to components automatically when underlying data changes. No manual refetching.
3. **Schema-first** -- define your database structure with `appSchema`/`tableSchema`, then create Model classes that map to those tables via decorators.
4. **Writers enforce safety** -- all mutations must go through `@writer` or `database.write()`. This guarantees mutual exclusion -- only one writer runs at a time, preventing race conditions.
5. **Sync-ready** -- built-in `synchronize()` handles pull/push with conflict resolution, designed for offline-first architectures.

**Performance characteristics:**

| Scenario                  | Behavior                                            |
| ------------------------- | --------------------------------------------------- |
| 10,000 records in a table | Zero JS cost until queried                          |
| Complex query             | Runs on native SQLite thread, resolves instantly    |
| List re-rendering         | `observe()` emits only when matching records change |
| Bulk operations           | `batch()` groups into single native transaction     |

**v0.27+ architecture:** All React helpers consolidated under `@nozbe/watermelondb/react` (replaces `@nozbe/with-observables`, `@nozbe/watermelondb/DatabaseProvider`, `@nozbe/watermelondb/hooks`). v0.28 requires React Native 0.74+ and Node.js 18+.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Schema Definition

Schemas define the database structure. Column types are `string`, `number`, or `boolean`. Use `isOptional: true` for nullable columns and `isIndexed: true` for query-heavy columns.

```typescript
import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "posts",
      columns: [
        { name: "title", type: "string" },
        { name: "body", type: "string" },
        { name: "subtitle", type: "string", isOptional: true },
        { name: "is_pinned", type: "boolean" },
        { name: "created_at", type: "number" }, // dates stored as timestamps
        { name: "author_id", type: "string", isIndexed: true }, // FK
      ],
    }),
    tableSchema({
      name: "comments",
      columns: [
        { name: "body", type: "string" },
        { name: "post_id", type: "string", isIndexed: true },
        { name: "author_id", type: "string", isIndexed: true },
      ],
    }),
  ],
});
```

**Why good:** `isIndexed` on foreign keys speeds up relation queries, dates use `number` type (unix timestamps), snake_case naming follows convention

**Naming conventions:** Tables are plural snake*case (`posts`, `blog_comments`). Columns are snake_case. FKs use `_id` suffix. Booleans use `is*`prefix. Date columns use`\_at` suffix.

See [examples/core.md](examples/core.md) for full schema with all column types.

---

### Pattern 2: Model with Field Decorators

Models are classes extending `Model` that map to schema tables. Decorators bind properties to columns.

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  readonly,
  json,
  nochange,
  relation,
  children,
  immutableRelation,
} from "@nozbe/watermelondb/decorators";

const sanitizeTags = (raw: unknown) =>
  Array.isArray(raw) ? raw.map(String) : [];

class Post extends Model {
  static table = "posts";
  static associations = {
    comments: { type: "has_many" as const, foreignKey: "post_id" },
  };

  @text("title") title!: string;
  @text("body") body!: string;
  @field("is_pinned") isPinned!: boolean;
  @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
  @json("tags", sanitizeTags) tags!: string[];
  @nochange @field("author_id") authorId!: string;

  @immutableRelation("users", "author_id") author!: Relation<User>;
  @children("comments") comments!: Query<Comment>;
}
```

**Why good:** `@text` trims whitespace (for user input), `@date` converts timestamps to Date objects, `@readonly` prevents any assignment, `@nochange` prevents modification after creation, `@json` with sanitizer validates parsed data

**Key decorator rules:**

- `@field` -- raw column value (string/number/boolean), guaranteed to match schema type
- `@text` -- like `@field` but trims whitespace, use for user-editable text
- `@date` -- converts stored unix timestamp to JS `Date` object
- `@readonly` -- cannot be set at all (server-set fields in sync)
- `@nochange` -- can be set in `create()` but not in `update()`
- `@json(column, sanitizer)` -- parses JSON from string column, sanitizer validates the parsed output

See [examples/core.md](examples/core.md) for the complete decorator reference with good/bad examples.

---

### Pattern 3: Relations

Use `@relation` for mutable to-one relationships, `@immutableRelation` for to-one that never changes, and `@children` for to-many (returns a `Query`).

```typescript
class Comment extends Model {
  static table = "comments";

  // Immutable -- a comment's post never changes
  @immutableRelation("posts", "post_id") post!: Relation<Post>;

  // Mutable -- assignee can be reassigned
  @relation("users", "assignee_id") assignee!: Relation<User>;

  // To-many -- all replies to this comment
  @children("replies") replies!: Query<Reply>;
}
```

**When to use `@immutableRelation`:** When the FK is set once at creation and never changes (comment belongs to post, order belongs to user). Provides extra protection and performance.

**When to use `@relation`:** When the FK can be reassigned (task assignee, category).

See [examples/core.md](examples/core.md) for relation API methods (`.set()`, `.id`, `.fetch()`, `.observe()`) and many-to-many via pivot tables.

---

### Pattern 4: Writers, Readers, and Actions

All database modifications MUST go through a `@writer` or `database.write()`. Readers ensure consistent reads with mutual exclusion.

```typescript
class Post extends Model {
  static table = "posts";

  @writer async addComment(body: string, author: User) {
    return await this.collections.get<Comment>("comments").create((comment) => {
      comment.post.set(this);
      comment.author.set(author);
      comment.body = body;
    });
  }

  @writer async markAsPinned() {
    await this.update((post) => {
      post.isPinned = true;
    });
  }

  @writer async softDelete() {
    await this.markAsDeleted(); // Marks for sync, keeps in DB
  }

  @reader async fetchActiveComments() {
    return await this.comments.extend(Q.where("is_active", true)).fetch();
  }
}
```

**Why good:** `@writer` guarantees mutual exclusion (only one writer at a time), `@reader` prevents writes during multi-step reads, `markAsDeleted` preserves record for sync

**Key rules:**

- `@writer` methods can create, update, delete records
- `@reader` methods can only read (fetch, count)
- Writers/readers are async and return Promises
- Only one writer runs at a time -- others queue
- Use `callWriter()`/`callReader()` to call other action methods from within a writer/reader

See [examples/core.md](examples/core.md) for `database.write()` standalone usage and nesting rules.

---

### Pattern 5: Reactive Components with withObservables

Connect components to live database data using `withObservables` from `@nozbe/watermelondb/react`. Components re-render automatically when observed data changes.

```tsx
import { withObservables } from "@nozbe/watermelondb/react";

interface PostItemProps {
  post: Post;
  commentCount: number;
}

function PostItem({ post, commentCount }: PostItemProps) {
  return (
    <View>
      <Text>{post.title}</Text>
      <Text>{commentCount} comments</Text>
    </View>
  );
}

const enhance = withObservables(["post"], ({ post }: { post: Post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount(),
}));

const EnhancedPostItem = enhance(PostItem);
```

**Why good:** Component re-renders only when the specific post or its comment count changes, not on any database change

**`observe()` vs `observeWithColumns()`:**

- `observe()` -- emits when the record itself changes, or when query results add/remove records
- `observeWithColumns(["column_a", "column_b"])` -- also emits when matched records change specified columns (use for sorted lists)

See [examples/core.md](examples/core.md) for `DatabaseProvider`, `useDatabase`, sorted lists with `observeWithColumns`, and composition patterns.

---

### Pattern 6: Query API

Queries are built with `Q` conditions and executed with `fetch()`, `observe()`, `fetchCount()`, or `observeCount()`.

```typescript
import { Q } from "@nozbe/watermelondb";

const RECENT_DAYS = 7;
const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

// Basic conditions
const recentPosts = await database
  .get<Post>("posts")
  .query(
    Q.where("created_at", Q.gt(cutoff)),
    Q.where("is_pinned", true),
    Q.sortBy("created_at", Q.desc),
    Q.take(20),
  )
  .fetch();

// Cross-table JOIN with Q.on
const postsWithActiveComments = await database
  .get<Post>("posts")
  .query(Q.on("comments", "is_active", true))
  .fetch();
```

**Key operators:** `Q.eq`, `Q.notEq`, `Q.gt`, `Q.gte`, `Q.lt`, `Q.lte`, `Q.between`, `Q.oneOf`, `Q.notIn`, `Q.like`, `Q.notLike`, `Q.and`, `Q.or`, `Q.on`, `Q.sortBy`, `Q.take`, `Q.skip`

**Gotcha:** `Q.like` uses `%` for wildcards and is case-insensitive. Always use `Q.sanitizeLikeString()` on user input to escape special characters.

See [examples/core.md](examples/core.md) for the full query API with complex conditions and text search.

---

### Pattern 7: Batch Operations

Use `batch()` to group multiple operations into a single native transaction. Use `prepare*` methods (not `await`ed individual operations).

```typescript
@writer async importPosts(rawPosts: RawPost[]) {
  const postsCollection = this.collections.get<Post>("posts");
  const prepared = rawPosts.map((raw) =>
    postsCollection.prepareCreate((post) => {
      post.title = raw.title;
      post.body = raw.body;
    }),
  );
  await this.batch(...prepared);
}
```

**Why good:** Single native transaction is atomic and much faster than individual creates. Falsy values in `batch()` are ignored (useful for conditional operations).

**Prepare methods:** `collection.prepareCreate()`, `record.prepareUpdate()`, `record.prepareMarkAsDeleted()`, `record.prepareDestroyPermanently()`

See [examples/sync.md](examples/sync.md) for batch patterns with mixed create/update/delete.

---

### Pattern 8: Schema Migrations

Evolve your database schema across app versions. Each migration step increments `toVersion` and applies changes.

```typescript
import {
  schemaMigrations,
  addColumns,
  createTable,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "posts",
          columns: [{ name: "subtitle", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "tags",
          columns: [
            { name: "name", type: "string" },
            { name: "post_id", type: "string", isIndexed: true },
          ],
        }),
      ],
    },
  ],
});
```

**Critical rule:** Schema `version` must equal the highest migration `toVersion`. If schema is version 3, you need migrations up to `toVersion: 3`.

See [examples/sync.md](examples/sync.md) for migration strategies and the relationship between schema version and sync.

---

### Pattern 9: Sync with synchronize()

Built-in sync engine for offline-first architectures. Implement `pullChanges` and `pushChanges` to connect to your backend.

```typescript
import { synchronize } from "@nozbe/watermelondb/sync";

async function syncDatabase(database: Database) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const response = await fetch(
        `https://api.example.com/sync/pull?last=${lastPulledAt}&schema=${schemaVersion}`,
      );
      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      await fetch("https://api.example.com/sync/push", {
        method: "POST",
        body: JSON.stringify({ changes, lastPulledAt }),
      });
    },
    migrationsEnabledAtVersion: 1,
  });
}
```

**Key constraints:**

- `pullChanges` returns `{ changes, timestamp }` where `changes` has `{ created: [], updated: [], deleted: [] }` per table
- `pushChanges` receives local changes in the same format
- Server must provide a consistent snapshot (use transactions or read locks)
- `migrationsEnabledAtVersion` enables schema-aware sync

See [examples/sync.md](examples/sync.md) for the complete sync protocol, conflict resolution, and error handling.

</patterns>

---

<decision_framework>

## Decision Framework

```
What kind of local data do you need?
|
+-> Simple key-value pairs (preferences, tokens)?
|   +-> Use a key-value store (not WatermelonDB)
|
+-> Relational data with queries?
|   +-> Small dataset (<100 records) with no offline sync?
|   |   +-> Consider simpler storage first
|   +-> Large dataset (1000+ records) or offline-first?
|       +-> WatermelonDB
|
+-> Need offline sync with a server?
|   +-> WatermelonDB with synchronize()
|
+-> Only server data, always online?
    +-> Use your data fetching solution (not WatermelonDB)
```

### When to Use Each API

| Scenario                      | API                                              |
| ----------------------------- | ------------------------------------------------ |
| Define database structure     | `appSchema`/`tableSchema`                        |
| Map columns to properties     | `@field`, `@text`, `@date`, `@json`              |
| Prevent field modification    | `@readonly` (never set), `@nochange` (set once)  |
| One-to-one relation (fixed)   | `@immutableRelation`                             |
| One-to-one relation (mutable) | `@relation`                                      |
| One-to-many relation          | `@children`                                      |
| Create/update/delete records  | `@writer` method or `database.write()`           |
| Consistent multi-step reads   | `@reader` method or `database.read()`            |
| Bulk create/update/delete     | `batch()` with `prepare*` methods                |
| Reactive component data       | `withObservables` + `observe()`                  |
| Reactive sorted list          | `observeWithColumns(["sort_column"])`            |
| Access database in component  | `useDatabase()` from `@nozbe/watermelondb/react` |
| Evolve schema across versions | `schemaMigrations` + `addColumns`/`createTable`  |
| Sync with remote server       | `synchronize()` with `pullChanges`/`pushChanges` |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Modifying records outside a `@writer` or `database.write()` -- throws at runtime, all mutations require a writer context
- Schema version and migration `toVersion` out of sync -- causes database corruption or failed migrations
- Using `await collection.create()` inside `batch()` -- use `collection.prepareCreate()` (no await) for batch operations
- Missing `static associations` on Model classes -- relations and `Q.on` queries will not work without declared associations
- Importing from `@nozbe/with-observables` (v0.27+ moved everything to `@nozbe/watermelondb/react`)

**Medium Priority Issues:**

- Using `@relation` when the FK never changes after creation -- use `@immutableRelation` for safety and performance
- Not indexing foreign key columns (`isIndexed: true`) -- relation queries become slow on large tables
- Calling `destroyPermanently()` on synced records -- use `markAsDeleted()` so deletions sync to the server
- Storing large blobs (>1MB) in WatermelonDB -- SQLite is not optimized for large binary data, use the filesystem
- Not using `Q.sanitizeLikeString()` on user input in `Q.like()` queries -- special characters break the query

**Gotchas & Edge Cases:**

- Column defaults: string defaults to `""`, number to `0`, boolean to `false` -- use `isOptional: true` if `null` is a valid state
- `@json` fields cannot be queried or counted by their contents -- they are opaque string columns
- `@date` stores unix timestamps (milliseconds) in a `number` column but returns a JS `Date` object -- schema column must be `number` type
- `observe()` on a query emits when records are added/removed but NOT when existing records change fields -- use `observeWithColumns()` for field-level reactivity
- `markAsDeleted()` keeps the record in the local database (flagged for sync) -- `destroyPermanently()` actually removes it
- `callWriter()`/`callReader()` are required to call other `@writer`/`@reader` methods from within a writer/reader -- direct calls throw
- Many-to-many relationships require a pivot table with `@immutableRelation` on both sides
- `Q.gt(0)` excludes `null` values -- use `Q.weakGt(0)` if nulls should be included
- The `id` column is auto-generated (string UUID) -- never declare it in your schema
- `_status` and `_changed` columns are reserved for the sync engine -- never use these names
- v0.28 requires React Native 0.74+ and Node.js 18+

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap ALL database modifications in `@writer` methods or `database.write()` -- writes outside a writer throw at runtime)**

**(You MUST keep schema version and migration `toVersion` in sync -- migrations cannot be newer than the schema version)**

**(You MUST use `@immutableRelation` for relations that never change after creation -- it provides extra safety and performance over `@relation`)**

**(You MUST use `prepareCreate`/`prepareUpdate`/`prepareMarkAsDeleted` inside `batch()` -- never `await` individual operations in a batch)**

**Failure to follow these rules will cause runtime crashes, data corruption, or silent sync failures.**

</critical_reminders>
