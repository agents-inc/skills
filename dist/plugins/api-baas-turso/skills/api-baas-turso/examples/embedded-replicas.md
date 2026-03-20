# Turso -- Embedded Replica Examples

> Local SQLite replicas synced from a remote Turso primary. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites:** Understand client setup and execute/batch patterns from [core.md](core.md) first.

---

## Pattern 1: Basic Embedded Replica Setup

### Good Example -- Auto-Syncing Replica

```typescript
import { createClient } from "@libsql/client";

const SYNC_INTERVAL_SECONDS = 60;

const client = createClient({
  url: "file:data/replica.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: SYNC_INTERVAL_SECONDS,
});

// Populate local replica on startup
await client.sync();

// All reads are local -- microsecond latency
const users = await client.execute("SELECT * FROM users LIMIT 10");

// Writes forward to remote primary (15-50ms)
// Local replica auto-updates after write returns
await client.execute({
  sql: "INSERT INTO users (name) VALUES (?)",
  args: ["Alice"],
});
```

**Why good:** Named constant for sync interval, initial `sync()` ensures data is available before first read, local file path for replica, credentials from env vars

### Bad Example -- No Initial Sync

```typescript
const client = createClient({
  url: "file:replica.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// BAD: Reading before any sync -- replica may be empty or stale
const users = await client.execute("SELECT * FROM users");
// Returns empty results on first run, stale data on subsequent runs
```

**Why bad:** Without an initial `sync()` or `syncInterval`, the local replica may be empty (first run) or arbitrarily stale (subsequent runs with no sync)

---

## Pattern 2: Manual Sync Control

### Good Example -- Sync Before Critical Reads

```typescript
import { createClient } from "@libsql/client";

// No syncInterval -- manual sync only
const client = createClient({
  url: "file:data/replica.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Sync before reads that need fresh data
async function getFreshUserCount(): Promise<number> {
  await client.sync();
  const result = await client.execute("SELECT count(*) as total FROM users");
  return result.rows[0].total as number;
}

// Skip sync for reads that tolerate staleness
async function getCachedPosts() {
  // No sync -- reads from whatever the local replica has
  return await client.execute(
    "SELECT id, title FROM posts ORDER BY created_at DESC LIMIT 10",
  );
}
```

**Why good:** Manual sync gives control over when to pay the sync cost, fresh reads sync first, stale-tolerant reads skip sync, no background sync interval consuming resources

**When to use:** When you need fine-grained control over sync timing. Useful when some reads must be fresh and others can tolerate staleness.

---

## Pattern 3: Offline Mode

### Good Example -- Local-Only Writes

```typescript
import { createClient } from "@libsql/client";

const SYNC_INTERVAL_SECONDS = 300; // 5 minutes

const client = createClient({
  url: "file:data/offline.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: SYNC_INTERVAL_SECONDS,
  offline: true, // Writes go to local database, not forwarded to remote
});

// Writes are local-only -- no network latency
await client.execute({
  sql: "INSERT INTO events (type, data) VALUES (?, ?)",
  args: ["page_view", JSON.stringify({ url: "/home" })],
});

// Sync pushes local writes to remote when called
await client.sync();
```

**Why good:** `offline: true` enables local writes for scenarios like event logging, field data collection, or unreliable connectivity, named constant for sync interval, explicit sync to push changes

**When to use:** Applications that must work without connectivity (mobile apps, field devices, intermittent networks). Local writes accumulate and sync when connectivity is available.

---

## Pattern 4: Encryption at Rest

### Good Example -- Encrypted Local Replica

```typescript
import { createClient } from "@libsql/client";

const SYNC_INTERVAL_SECONDS = 120;

const client = createClient({
  url: "file:data/encrypted-replica.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: SYNC_INTERVAL_SECONDS,
  encryptionKey: process.env.TURSO_ENCRYPTION_KEY, // You generate and manage this key
});

await client.sync();
```

**Why good:** Encryption key from environment variable (not hardcoded), protects data at rest on the local filesystem, transparent to queries

**When to use:** When the local replica stores sensitive data and the filesystem is shared or the device could be compromised. You are responsible for generating, storing, and rotating the encryption key.

---

## Pattern 5: Read-Your-Writes Semantics

### Good Example -- Write Then Read Consistency

```typescript
// With embedded replicas, the client that performed a write
// always sees that write immediately -- no need to sync

async function createAndVerifyUser(name: string, email: string) {
  // Write forwards to remote primary
  const insertResult = await client.execute({
    sql: "INSERT INTO users (name, email) VALUES (?, ?)",
    args: [name, email],
  });

  const newId = Number(insertResult.lastInsertRowid);

  // Read-your-writes: this read sees the new user immediately
  // even though it reads from the local replica
  const verifyResult = await client.execute({
    sql: "SELECT id, name, email FROM users WHERE id = ?",
    args: [newId],
  });

  // verifyResult.rows[0] will contain the newly inserted user
  return verifyResult.rows[0];
}
```

**Why good:** Demonstrates that the writing client sees its own writes immediately without calling `sync()`, no stale-read risk for the writer, natural programming model

#### Important Caveat

Read-your-writes is guaranteed only for the client that performed the write. Other clients (on other machines or in other processes) will only see the write after their next `sync()` call or `syncInterval` tick. This is eventual consistency for readers other than the writer.

---

## Pattern 6: Graceful Startup with Fallback

### Good Example -- Handle First-Run Sync Failure

```typescript
import { createClient } from "@libsql/client";

const SYNC_INTERVAL_SECONDS = 60;

async function createReplicaClient() {
  const client = createClient({
    url: "file:data/replica.db",
    syncUrl: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncInterval: SYNC_INTERVAL_SECONDS,
  });

  try {
    await client.sync();
  } catch (error) {
    // First sync failed -- local file may be empty or stale
    // Log but don't crash: the replica will sync on next interval
    console.error("Initial sync failed, will retry on interval:", error);
  }

  return client;
}
```

**Why good:** First sync failure does not crash the application, subsequent `syncInterval` ticks will retry, useful for deployment scenarios where remote may be temporarily unreachable

**When to use:** Production services where a transient network issue during startup should not prevent the service from starting. The service starts with stale data and catches up on next successful sync.

---

_For client setup and query patterns, see [core.md](core.md)._
