# SurrealDB Core Examples

> Connection patterns, CRUD operations, TypeScript typing, and RecordId usage. See [SKILL.md](../SKILL.md) for core concepts.

**Graph patterns:** See [graph-relations.md](graph-relations.md). **Schema & auth:** See [schema-auth.md](schema-auth.md). **Live queries:** See [live-queries.md](live-queries.md).

---

## Pattern 1: Connection Setup

### Good Example -- Production Connection

```typescript
import Surreal from "surrealdb";

async function connectDatabase(): Promise<Surreal> {
  const url = process.env.SURREALDB_URL;
  if (!url) {
    throw new Error("SURREALDB_URL environment variable is required");
  }

  const namespace = process.env.SURREALDB_NAMESPACE;
  const database = process.env.SURREALDB_DATABASE;
  if (!namespace || !database) {
    throw new Error(
      "SURREALDB_NAMESPACE and SURREALDB_DATABASE environment variables are required",
    );
  }

  const db = new Surreal();

  try {
    await db.connect(url, {
      namespace,
      database,
    });

    // Authenticate (use DEFINE ACCESS for app users, root only for admin)
    await db.signin({
      username: process.env.SURREALDB_USER ?? "root",
      password: process.env.SURREALDB_PASS ?? "",
    });

    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export { connectDatabase };
```

**Why good:** Environment variables for all config, namespace/database set at connection time, error handling closes connection on failure, typed return

### Good Example -- Connection State Monitoring

```typescript
const db = new Surreal();

const unsubConnected = db.subscribe("connected", () => {
  console.log("SurrealDB connected");
});

const unsubDisconnected = db.subscribe("disconnected", () => {
  console.warn("SurrealDB disconnected");
});

const unsubError = db.subscribe("error", (error) => {
  console.error("SurrealDB error:", error);
});

// Cleanup subscriptions when done
function cleanup(): void {
  unsubConnected();
  unsubDisconnected();
  unsubError();
}

export { cleanup };
```

**Why good:** SDK v2 event subscriptions via `subscribe()`, returns unsubscribe functions for cleanup, different log levels for different events

### Good Example -- Graceful Shutdown

```typescript
async function disconnectDatabase(db: Surreal): Promise<void> {
  await db.close();
  console.log("SurrealDB connection closed");
}

process.on("SIGINT", async () => {
  await disconnectDatabase(db);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase(db);
  process.exit(0);
});

export { disconnectDatabase };
```

### Bad Example -- Missing Namespace/Database

```typescript
// BAD: No namespace or database selected
const db = new Surreal();
await db.connect("http://localhost:8000");
await db.signin({ username: "root", password: "root" });

// This query will fail silently or error -- no namespace/database context
const users = await db.query("SELECT * FROM user");
```

**Why bad:** No `namespace`/`database` in connect options or `use()` call, queries fail without context, uses `localhost` (IPv6 issues on Node.js 18+)

---

## Pattern 2: CRUD Operations

### Good Example -- Create Records

```typescript
import { RecordId, Table } from "surrealdb";

interface User {
  id: RecordId;
  name: string;
  email: string;
  role: "admin" | "user" | "moderator";
  created_at: string;
}

// Create with auto-generated ID
const newUser = await db.create<User>(new Table("user"), {
  name: "Alice",
  email: "alice@example.com",
  role: "user",
});
// Returns: { id: RecordId { table: "user", id: "abc123..." }, name: "Alice", ... }

// Create with specific ID
const admin = await db.create<User>(new RecordId("user", "admin-alice"), {
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
});

// Bulk insert with conflict handling (SurrealQL)
const BATCH_SIZE = 100;
const users = generateUsers(BATCH_SIZE);
await db.query(
  `INSERT INTO user $users ON DUPLICATE KEY UPDATE
    name = $input.name,
    email = $input.email`,
  { users },
);
```

**Why good:** TypeScript generics for return type, `Table` for auto-ID creation, `RecordId` for specific IDs, `INSERT ... ON DUPLICATE KEY UPDATE` for idempotent bulk operations, named constant for batch size

### Good Example -- Select and Query

```typescript
const PAGE_SIZE = 20;

// Select by ID (fastest -- direct record lookup)
const user = await db.select<User>(new RecordId("user", "alice"));

// Select all from table
const allUsers = await db.select<User[]>(new Table("user"));

// Parameterized query with pagination
async function getUsers(
  page: number = 1,
  role?: string,
): Promise<{ data: User[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;

  const [data, countResult] = await db.query<[User[], [{ count: number }]]>(
    `SELECT * FROM user
      WHERE ($role = NONE OR role = $role)
      ORDER BY created_at DESC
      LIMIT $limit
      START $offset;
     SELECT count() AS count FROM user
      WHERE ($role = NONE OR role = $role)
      GROUP ALL;`,
    { role: role ?? null, limit: PAGE_SIZE, offset },
  );

  return {
    data,
    total: countResult[0]?.count ?? 0,
  };
}

export { getUsers };
```

**Why good:** Direct `select()` for known IDs (fastest path), parameterized queries prevent injection, parallel count query, `NONE` check for optional filters, named constant for page size

### Good Example -- Update and Merge

```typescript
// Full replacement (v2 chainable) -- all fields must be provided
await db.update(new RecordId("user", "alice")).content({
  name: "Alice B.",
  email: "alice-b@example.com",
  role: "admin",
  created_at: "2025-01-01T00:00:00Z",
});

// Partial update (merge) -- only specified fields change
await db.merge(new RecordId("user", "alice"), {
  role: "moderator",
});
// Or via chainable: await db.update(new RecordId("user", "alice")).merge({ role: "moderator" });

// Conditional update via SurrealQL with index workaround for large tables
await db.query(
  `UPDATE (SELECT id FROM user WHERE role = $old_role) SET role = $new_role`,
  { old_role: "moderator", new_role: "user" },
);
```

**Why good:** `update().content()` for full replacement (v2 chainable API), `merge()` for partial updates, subquery pattern for bulk conditional updates (workaround for UPDATE WHERE not using indexes)

### Good Example -- Delete

```typescript
// Delete by ID
await db.delete(new RecordId("user", "alice"));

// Bulk delete via SurrealQL with subquery (index-aware)
const DAYS_INACTIVE = 90;
await db.query(
  `DELETE (SELECT id FROM user WHERE last_active < time::now() - $days + "d")`,
  { days: DAYS_INACTIVE },
);
```

**Why good:** Direct delete by `RecordId`, subquery pattern for bulk deletes to use indexes, named constant for threshold

### Bad Example -- String Interpolation

```typescript
// BAD: Injection risk with every line
const email = userInput.email;
const users = await db.query(`SELECT * FROM user WHERE email = '${email}'`);
await db.query(`DELETE user:${userInput.id}`);
await db.query(
  `UPDATE user SET name = '${userInput.name}' WHERE id = user:${userInput.id}`,
);
```

**Why bad:** Every line is vulnerable to SurrealQL injection, attacker can escape string and execute arbitrary statements (DROP TABLE, DEFINE ACCESS)

---

## Pattern 3: TypeScript Integration

### Good Example -- Typed Query Results

```typescript
import type { RecordId } from "surrealdb";

// Define interfaces matching your SurrealDB schema
interface Post {
  id: RecordId;
  title: string;
  content: string;
  author: RecordId; // Record link to user table
  tags: string[];
  published: boolean;
  created_at: string;
}

interface PostWithAuthor {
  id: RecordId;
  title: string;
  author_name: string;
  author_email: string;
}

// Type-safe query with result typing
const posts = await db.query<[PostWithAuthor[]]>(
  `SELECT
    id, title,
    author.name AS author_name,
    author.email AS author_email
  FROM post
  WHERE published = true
  ORDER BY created_at DESC
  LIMIT $limit`,
  { limit: 10 },
);

// Multi-statement with tuple typing
const [recentPosts, topAuthors] = await db.query<
  [Post[], { author: RecordId; post_count: number }[]]
>(
  `SELECT * FROM post WHERE published = true ORDER BY created_at DESC LIMIT 10;
   SELECT author, count() AS post_count FROM post GROUP BY author ORDER BY post_count DESC LIMIT 5;`,
);
```

**Why good:** Separate interfaces for different query shapes, `RecordId` type for record links, tuple typing for multi-statement queries, dot notation traverses record links in SELECT

### Good Example -- RecordId Handling

```typescript
import { RecordId, Table } from "surrealdb";

// Create RecordId instances
const userId = new RecordId("user", "alice");
const postId = new RecordId("post", "first-post");

// RecordId properties
console.log(userId.table); // Table { name: "user" }
console.log(userId.id); // "alice"

// Use in queries as parameters
const result = await db.query<[Post[]]>(
  `SELECT * FROM post WHERE author = $author`,
  { author: userId },
);

// Create dynamic RecordId from user input (safely)
function toRecordId(table: string, id: string): RecordId {
  return new RecordId(table, id);
}

// Array-based IDs for composite keys
const weatherId = new RecordId("weather", ["London", "2025-01-15T08:00:00Z"]);
```

**Why good:** `RecordId` class for type-safe record references, access `.table` and `.id` properties, parameterized use in queries, array-based IDs for composite keys

---

## Pattern 4: Range Queries with Record IDs

### Good Example -- ID Range Scanning

```typescript
// Numeric ID ranges -- no table scan needed
const batch = await db.query<[User[]]>(`SELECT * FROM user:1..=1000`);

// Array-based ID ranges for time-series data
const londonWeather = await db.query<[WeatherReading[]]>(
  `SELECT * FROM weather:['London', NONE]..=['London', time::now()]`,
);

// Parameterized range query
const readings = await db.query<[WeatherReading[]]>(
  `SELECT * FROM weather:[$city, $start]..=[$city, $end]`,
  {
    city: "London",
    start: "2025-01-01T00:00:00Z",
    end: "2025-01-31T23:59:59Z",
  },
);
```

**Why good:** Record ID ranges avoid table scans entirely, array-based IDs enable efficient time-series queries partitioned by key, parameterized for safety

### Bad Example -- Full Table Scan for Range Data

```typescript
// BAD: Full table scan when record ID ranges would be more efficient
const readings = await db.query<[WeatherReading[]]>(
  `SELECT * FROM weather WHERE city = $city AND timestamp >= $start AND timestamp <= $end`,
  { city: "London", start: "2025-01-01", end: "2025-01-31" },
);
// Requires indexes on city + timestamp to be efficient
// With array-based IDs, the range scan is free
```

**Why bad:** Requires composite index to avoid full table scan, array-based record IDs provide free range scanning by design

---

## Pattern 5: Upsert and Idempotent Operations

### Good Example -- Upsert Pattern

```typescript
// Upsert by specific record ID -- create if missing, update if exists
await db.query(
  `UPSERT user:alice SET
    name = "Alice",
    email = "alice@example.com",
    role = "admin",
    updated_at = time::now()`,
);

// Insert with conflict resolution
await db.query(
  `INSERT INTO user {
    id: user:alice,
    name: "Alice",
    email: "alice@example.com"
  } ON DUPLICATE KEY UPDATE
    name = $input.name,
    updated_at = time::now()`,
);
```

**Why good:** `UPSERT` for single-record idempotency, `INSERT ... ON DUPLICATE KEY UPDATE` for bulk operations with conflict handling, `time::now()` for automatic timestamps

---

_For graph patterns, see [graph-relations.md](graph-relations.md). For schema definitions, see [schema-auth.md](schema-auth.md). For live queries, see [live-queries.md](live-queries.md)._
