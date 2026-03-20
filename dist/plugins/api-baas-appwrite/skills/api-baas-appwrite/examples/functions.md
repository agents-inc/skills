# Appwrite Functions Examples

> Serverless functions, triggers, SDK usage inside functions, and common patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Basic Function

### Good Example — HTTP Handler with Appwrite SDK

```typescript
// functions/get-todos/src/main.ts
import { Client, TablesDB, Query } from "node-appwrite";

const DATABASE_ID = "main";
const TABLE_ID = "todos";
const PAGE_SIZE = 25;

export default async ({ req, res, log, error }) => {
  // Initialize Appwrite client with the dynamic API key
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setKey(req.headers["x-appwrite-key"]);

  const tablesDB = new TablesDB(client);

  try {
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [Query.orderDesc("$createdAt"), Query.limit(PAGE_SIZE)],
    });

    return res.json({ rows: result.rows, total: result.total });
  } catch (err) {
    error(`Failed to list todos: ${err.message}`);
    return res.json({ error: "Internal error" }, 500);
  }
};
```

**Why good:** Uses `req.headers["x-appwrite-key"]` for dynamic API key (auto-injected by Appwrite), `node-appwrite` server SDK, named constants, `log()`/`error()` for developer-only logging, JSON response with status code

### Bad Example — Hardcoded Credentials in Function

```typescript
// BAD: Hardcoded API key
export default async ({ req, res }) => {
  const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1") // Hardcoded
    .setProject("abc123") // Hardcoded
    .setKey("secret-api-key-here"); // Hardcoded — exposed in source

  // ...
};
```

**Why bad:** Hardcoded credentials exposed in source control, should use `process.env` or `req.headers["x-appwrite-key"]` for the dynamic key

---

## Pattern 2: User-Scoped Function

### Good Example — Acting as the Calling User

```typescript
// functions/create-post/src/main.ts
import { Client, TablesDB, ID, Permission, Role } from "node-appwrite";

const DATABASE_ID = "main";
const TABLE_ID = "posts";

export default async ({ req, res, log, error }) => {
  // Check if the user is authenticated
  const jwt = req.headers["x-appwrite-user-jwt"];
  if (!jwt) {
    return res.json({ error: "Authentication required" }, 401);
  }

  // Use JWT for user-scoped access (respects permissions)
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setJWT(jwt);

  const tablesDB = new TablesDB(client);

  try {
    const { title, content } = req.bodyJson;
    const userId = req.headers["x-appwrite-user-id"];

    const row = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: ID.unique(),
      data: { title, content, authorId: userId },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
    });

    return res.json({ post: row }, 201);
  } catch (err) {
    error(`Create post failed: ${err.message}`);
    return res.json({ error: "Failed to create post" }, 500);
  }
};
```

**Why good:** JWT-based auth scopes operations to the calling user's permissions, user ID from `x-appwrite-user-id` header, `req.bodyJson` for parsed body, permissions set on creation, 201 status for created resource

---

## Pattern 3: Admin Function (Bypasses Permissions)

### Good Example — Cleanup Script with API Key

```typescript
// functions/cleanup-stale/src/main.ts
import { Client, TablesDB, Query } from "node-appwrite";

const DATABASE_ID = "main";
const TABLE_ID = "temp-files";
const STALE_DAYS = 30;

export default async ({ req, res, log, error }) => {
  // Admin client — uses API key, bypasses all permissions
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setKey(req.headers["x-appwrite-key"]);

  const tablesDB = new TablesDB(client);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);

  try {
    const staleRows = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [
        Query.lessThan("$createdAt", cutoffDate.toISOString()),
        Query.limit(100),
      ],
    });

    let deletedCount = 0;
    for (const row of staleRows.rows) {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        rowId: row.$id,
      });
      deletedCount++;
    }

    log(`Cleaned up ${deletedCount} stale rows`);
    return res.json({ deleted: deletedCount });
  } catch (err) {
    error(`Cleanup failed: ${err.message}`);
    return res.json({ error: "Cleanup failed" }, 500);
  }
};
```

**Why good:** API key from `x-appwrite-key` for admin access, named constant for stale threshold, date-based query filtering, counts deleted rows, developer-only logging

**When to use:** Scheduled cleanup, data migrations, admin operations, background processing. Functions using the dynamic API key have full admin access — they bypass all permissions.

---

## Pattern 4: Event-Triggered Function

### Good Example — Handle Row Creation Event

```typescript
// functions/on-user-created/src/main.ts
import { Client, TablesDB, ID, Permission, Role } from "node-appwrite";

const DATABASE_ID = "main";
const PROFILES_TABLE = "profiles";

export default async ({ req, res, log, error }) => {
  // Check trigger type
  const trigger = req.headers["x-appwrite-trigger"];

  if (trigger !== "event") {
    return res.json({ error: "Not an event trigger" }, 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setKey(req.headers["x-appwrite-key"]);

  const tablesDB = new TablesDB(client);

  try {
    // req.bodyJson contains the event payload (the created user)
    const user = req.bodyJson;

    // Create a profile row for the new user
    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: PROFILES_TABLE,
      rowId: ID.unique(),
      data: {
        userId: user.$id,
        displayName: user.name || "Anonymous",
        bio: "",
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(user.$id)),
      ],
    });

    log(`Profile created for user ${user.$id}`);
    return res.json({ success: true });
  } catch (err) {
    error(`Profile creation failed: ${err.message}`);
    return res.json({ error: "Failed to create profile" }, 500);
  }
};
```

**Why good:** Checks `x-appwrite-trigger` header to verify event source, event payload in `req.bodyJson`, creates related data automatically on user creation, appropriate permissions on the new profile

**When to use:** Configure event triggers in the Appwrite console (e.g., `users.*.create` triggers this function when any user is created). Useful for creating default data, sending welcome emails, or syncing to external services.

---

## Pattern 5: Scheduled Function (Cron)

### Good Example — Daily Report

```typescript
// functions/daily-report/src/main.ts
import { Client, TablesDB, Query } from "node-appwrite";

const DATABASE_ID = "main";
const ORDERS_TABLE = "orders";
const HOURS_IN_DAY = 24;

export default async ({ req, res, log }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setKey(req.headers["x-appwrite-key"]);

  const tablesDB = new TablesDB(client);

  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - HOURS_IN_DAY);

  const recentOrders = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: ORDERS_TABLE,
    queries: [Query.greaterThan("$createdAt", yesterday.toISOString())],
  });

  log(`Orders in last 24h: ${recentOrders.total}`);

  // Send report to external service, store summary, etc.

  return res.json({
    period: "24h",
    orderCount: recentOrders.total,
  });
};
```

**Why good:** Named constant for time period, date arithmetic for range query, scheduled via Appwrite console cron expression (e.g., `0 9 * * *` for 9 AM daily)

---

_For auth patterns, see [auth.md](auth.md). For database patterns, see [core.md](core.md). For storage, see [storage.md](storage.md)._
