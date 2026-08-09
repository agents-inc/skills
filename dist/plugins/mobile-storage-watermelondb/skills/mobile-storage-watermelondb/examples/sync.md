# WatermelonDB - Sync, Migrations, and Batch Operations

> Sync protocol, schema migrations, and bulk data operations. See [SKILL.md](../SKILL.md) for decision guidance and red flags. See [core.md](core.md) for schema, model, and query patterns.

---

## Pattern 1: Schema Migrations

Migrations evolve your database schema across app versions. Each migration step has a `toVersion` and an array of `steps`.

```typescript
import {
  schemaMigrations,
  addColumns,
  createTable,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      // v1 -> v2: Add subtitle to posts
      toVersion: 2,
      steps: [
        addColumns({
          table: "posts",
          columns: [{ name: "subtitle", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      // v2 -> v3: Add tags table and is_featured to posts
      toVersion: 3,
      steps: [
        createTable({
          name: "tags",
          columns: [
            { name: "name", type: "string" },
            { name: "color", type: "string" },
            { name: "post_id", type: "string", isIndexed: true },
          ],
        }),
        addColumns({
          table: "posts",
          columns: [{ name: "is_featured", type: "boolean" }],
        }),
      ],
    },
  ],
});
```

**Critical rules:**

- Schema `version` must match the highest migration `toVersion` -- if you add `toVersion: 3`, set schema `version: 3`
- Migrations cannot be newer than schema -- the adapter checks this on startup
- Migrations are run sequentially from the user's current version to the latest
- You can never remove or modify past migrations -- they are permanent history
- Each `toVersion` must be exactly one more than the previous

```typescript
// BAD: Schema version doesn't match migrations
const schema = appSchema({ version: 2, tables: [...] });  // version 2
const migrations = schemaMigrations({
  migrations: [{ toVersion: 3, steps: [...] }],  // migration to version 3!
});
```

**Why bad:** Migration `toVersion: 3` exceeds schema `version: 2`. The adapter will throw on startup. Always bump schema version to match the highest migration.

---

## Pattern 2: Batch Operations

Use `batch()` to group multiple operations into a single native SQLite transaction. Always use `prepare*` methods (without `await`) inside batch.

### Batch Create

```typescript
import type { Database } from "@nozbe/watermelondb";

async function importPosts(
  database: Database,
  rawPosts: RawPost[],
  author: User,
) {
  await database.write(async () => {
    const postsCollection = database.get<Post>("posts");
    const prepared = rawPosts.map((raw) =>
      postsCollection.prepareCreate((post) => {
        post.title = raw.title;
        post.body = raw.body;
        post.author.set(author);
      }),
    );
    await database.batch(...prepared);
  });
}
```

### Mixed Batch (Create + Update + Delete)

```typescript
@writer async reorganizeCategory(
  newPosts: RawPost[],
  outdatedPosts: Post[],
  stalePosts: Post[],
) {
  const postsCollection = this.collections.get<Post>("posts");

  const creates = newPosts.map((raw) =>
    postsCollection.prepareCreate((post) => {
      post.title = raw.title;
      post.body = raw.body;
    }),
  );

  const updates = outdatedPosts.map((post) =>
    post.prepareUpdate((p) => {
      p.isPublished = false;
    }),
  );

  const deletes = stalePosts.map((post) => post.prepareMarkAsDeleted());

  await this.batch(...creates, ...updates, ...deletes);
}
```

**Why good:** Single native transaction is atomic (all or nothing), much faster than individual awaited operations, and falsy values in `batch()` are safely ignored.

```typescript
// BAD: Awaiting individual operations in a loop
@writer async importPosts(rawPosts: RawPost[]) {
  for (const raw of rawPosts) {
    await this.collections.get<Post>("posts").create((post) => {
      post.title = raw.title;
    });
  }
}
```

**Why bad:** Each `create` is a separate native transaction. For 100 records, that's 100 round-trips to native instead of 1 with `batch()`.

### Conditional Batch Items

```typescript
// Falsy values are ignored -- useful for conditional operations
await this.batch(
  postsCollection.prepareCreate((p) => {
    p.title = "Always created";
  }),
  shouldPin
    ? existingPost.prepareUpdate((p) => {
        p.isPinned = true;
      })
    : null,
  shouldDeleteOld ? oldPost.prepareMarkAsDeleted() : null,
);
```

---

## Pattern 3: Sync Protocol with synchronize()

The built-in sync engine handles bidirectional data synchronization. Implement `pullChanges` to fetch server changes and `pushChanges` to send local changes.

### Basic Sync Setup

```typescript
import { synchronize } from "@nozbe/watermelondb/sync";
import type { Database } from "@nozbe/watermelondb";

const API_BASE_URL = "https://api.example.com";

async function syncDatabase(database: Database) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const params = new URLSearchParams({
        last_pulled_at: String(lastPulledAt ?? 0),
        schema_version: String(schemaVersion),
      });

      if (migration) {
        params.set("migration_from", String(migration.from));
        params.set("migration_tables", migration.tables.join(","));
        params.set("migration_columns", JSON.stringify(migration.columns));
      }

      const response = await fetch(`${API_BASE_URL}/sync/pull?${params}`);

      if (!response.ok) {
        throw new Error(`Pull failed: ${response.status}`);
      }

      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`${API_BASE_URL}/sync/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, lastPulledAt }),
      });

      if (!response.ok) {
        throw new Error(`Push failed: ${response.status}`);
      }
    },
    migrationsEnabledAtVersion: 1,
  });
}
```

### Changes Format

The sync protocol uses a specific changes format per table:

```typescript
// pullChanges must return this shape:
interface SyncPullResult {
  changes: {
    [tableName: string]: {
      created: RawRecord[]; // New records from server
      updated: RawRecord[]; // Modified records from server
      deleted: string[]; // IDs of deleted records
    };
  };
  timestamp: number; // Server's current time (for next sync)
}

// pushChanges receives this shape:
interface SyncPushChanges {
  changes: {
    [tableName: string]: {
      created: RawRecord[]; // Locally created records
      updated: RawRecord[]; // Locally modified records
      deleted: string[]; // Locally deleted record IDs
    };
  };
  lastPulledAt: number;
}
```

**Key constraints:**

- `pullChanges` must return ALL changes since `lastPulledAt` for ALL synced tables
- Raw records use column names (snake_case), not model property names
- The server must provide a consistent snapshot (use database transactions or read locks)
- If `pushChanges` fails, the server must revert all changes (atomic)
- `lastPulledAt` is `null` on first sync

### Sync Configuration Options

```typescript
await synchronize({
  database,
  pullChanges,
  pushChanges,
  migrationsEnabledAtVersion: 1, // Enable schema-aware sync
  sendCreatedAsUpdated: false, // If true, created records go in `updated` array
  // conflictResolver: customResolver,    // Custom conflict resolution
  // log: syncLog,                        // Diagnostic logging object
  // onDidPullChanges: async () => {},    // Callback after pull applied
  // onWillApplyRemoteChanges: async () => {},  // Callback before applying
});
```

### Error Handling in Sync

```typescript
async function syncWithRetry(database: Database) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await syncDatabase(database);
      return; // Success
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error; // Final attempt failed
      }
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt),
      );
    }
  }
}
```

---

## Pattern 4: Diagnostics (v0.27+)

WatermelonDB v0.27 added diagnostic utilities for debugging sync and data integrity issues.

```typescript
import {
  diagnoseDatabaseStructure,
  diagnoseSyncConsistency,
  censorRaw,
} from "@nozbe/watermelondb/diagnostics";

// Find orphaned records and schema inconsistencies
const structureReport = await diagnoseDatabaseStructure(database);

// Compare local vs server state (pass your pull endpoint)
const syncReport = await diagnoseSyncConsistency(database, pullEndpoint);

// Censor raw records for logging (masks values, preserves IDs)
const safeRecord = censorRaw(rawRecord);
```

**When to use:** Debugging sync failures, identifying orphaned records after failed migrations, logging raw records without exposing user data.
