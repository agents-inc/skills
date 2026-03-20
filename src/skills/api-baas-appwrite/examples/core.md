# Appwrite Core Examples

> Client setup, TablesDB CRUD, error handling, and permissions patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Auth patterns:** See [auth.md](auth.md). **Storage patterns:** See [storage.md](storage.md). **Functions:** See [functions.md](functions.md). **Realtime:** See [realtime.md](realtime.md).

---

## Pattern 1: Client Setup — Browser

### Good Example — Shared Client with Service Exports

```typescript
// lib/appwrite.ts
import { Client, Account, TablesDB, Storage, Realtime } from "appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const realtime = new Realtime(client);
export { ID, Permission, Role, Query } from "appwrite";
```

**Why good:** Single `Client` instance shared across all services, named constants for configuration, re-exports SDK utilities for convenient import, environment variables keep secrets out of source

### Bad Example — Recreating Clients Per Service

```typescript
// BAD: Each file creates its own Client
import { Client, Account } from "appwrite";

export const account = new Account(
  new Client()
    .setEndpoint("https://cloud.appwrite.io/v1") // Hardcoded
    .setProject("abc123"), // Hardcoded project ID
);

// Another file
import { Client, TablesDB } from "appwrite";

export const db = new TablesDB(
  new Client()
    .setEndpoint("https://cloud.appwrite.io/v1") // Duplicated
    .setProject("abc123"), // Duplicated
);
```

**Why bad:** Multiple `Client` instances waste memory and prevent shared session state, hardcoded credentials, duplicated configuration

---

## Pattern 2: Server SDK Setup

### Good Example — API Key Authentication

```typescript
// lib/appwrite-server.ts
import { Client, TablesDB, Users, Storage } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

export const tablesDB = new TablesDB(client);
export const users = new Users(client);
export const storage = new Storage(client);
```

**Why good:** `.setKey()` authenticates with API key (admin access), `Users` service for admin operations (not available in client SDK), named exports for tree-shaking

**When to use:** API routes, admin scripts, webhooks, cron jobs. NEVER import this file from client-side code.

### Good Example — JWT-Scoped Server Client

```typescript
// For server routes that need to act as a specific user
import { Client, TablesDB } from "node-appwrite";

export function createUserScopedClient(jwt: string) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setJWT(jwt);

  return {
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
  };
}
```

**Why good:** `.setJWT()` scopes operations to a specific user's permissions, factory function creates per-request clients, no API key needed (uses user's session)

**When to use:** Server-side rendering where you need to fetch data as the logged-in user, or API routes that forward the user's JWT.

---

## Pattern 3: Error Handling

### Good Example — Typed AppwriteException

```typescript
import { AppwriteException } from "appwrite";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

async function safeGetRow<T>(
  databaseId: string,
  tableId: string,
  rowId: string,
) {
  try {
    return await tablesDB.getRow<T>({ databaseId, tableId, rowId });
  } catch (error) {
    if (error instanceof AppwriteException) {
      switch (error.code) {
        case HTTP_NOT_FOUND:
          return null; // Row doesn't exist
        case HTTP_UNAUTHORIZED:
          throw new Error("Not authorized to access this row");
        default:
          throw new Error(`Appwrite error [${error.code}]: ${error.message}`);
      }
    }
    throw error; // Re-throw non-Appwrite errors
  }
}
```

**Why good:** Named constants for HTTP codes, typed `AppwriteException` with `code`/`message`/`type`, 404 returns null instead of throwing, unknown errors re-thrown

### Bad Example — Assuming Tuple Returns

```typescript
// BAD: Appwrite does NOT return { data, error } tuples
async function getUser() {
  const { data, error } = await account.get(); // WRONG
  if (error) {
    console.log(error);
  }
  return data;
}
```

**Why bad:** Appwrite SDK methods return data directly or throw `AppwriteException`, destructuring as `{ data, error }` will not work and silently produces `undefined`

---

## Pattern 4: TablesDB — Typed CRUD

### Good Example — Full CRUD with TypeScript Generics

```typescript
import { ID, Query, Permission, Role, type Models } from "appwrite";

// Define your row shape (extends Appwrite's base row model)
interface Todo {
  title: string;
  completed: boolean;
  priority: number;
}

const DATABASE_ID = "main";
const TABLE_ID = "todos";
const PAGE_SIZE = 25;

// CREATE
async function createTodo(
  userId: string,
  data: Pick<Todo, "title" | "priority">,
) {
  return await tablesDB.createRow<Todo>({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId: ID.unique(),
    data: {
      ...data,
      completed: false,
    },
    permissions: [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  });
}

// READ (single)
async function getTodo(rowId: string) {
  return await tablesDB.getRow<Todo>({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId,
  });
}

// READ (list with filters)
async function listTodos(page: number, completed?: boolean) {
  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    Query.limit(PAGE_SIZE),
    Query.offset(page * PAGE_SIZE),
  ];

  if (completed !== undefined) {
    queries.push(Query.equal("completed", completed));
  }

  return await tablesDB.listRows<Todo>({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    queries,
  });
}

// UPDATE
async function updateTodo(rowId: string, data: Partial<Todo>) {
  return await tablesDB.updateRow<Todo>({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId,
    data,
  });
}

// DELETE
async function deleteTodo(rowId: string) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    rowId,
  });
}
```

**Why good:** Generic type `<Todo>` on all methods for type-safe results, `ID.unique()` for auto-generated IDs, named constants for database/table/page size, permissions set on create, composable query array, `Partial<Todo>` for updates

### Bad Example — Missing Permissions and No Types

```typescript
// BAD: No permissions, no types, hardcoded IDs
async function createTodo(title: string) {
  return await tablesDB.createRow({
    databaseId: "main",
    tableId: "todos",
    rowId: "my-todo", // Custom ID — not unique!
    data: { title },
    // NO permissions — row will be invisible!
  });
}
```

**Why bad:** No generic type parameter loses type safety, hardcoded string for `rowId` creates a custom ID (not auto-generated, will conflict on second call), no permissions means the row is inaccessible to everyone

---

## Pattern 5: Cursor-Based Pagination

### Good Example — Efficient Pagination for Large Datasets

```typescript
const PAGE_SIZE = 25;

async function loadNextPage<T>(
  databaseId: string,
  tableId: string,
  lastRowId: string | null,
) {
  const queries: string[] = [
    Query.orderDesc("$createdAt"),
    Query.limit(PAGE_SIZE),
  ];

  if (lastRowId) {
    queries.push(Query.cursorAfter(lastRowId));
  }

  const result = await tablesDB.listRows<T>({
    databaseId,
    tableId,
    queries,
  });

  return {
    rows: result.rows,
    hasMore: result.rows.length === PAGE_SIZE,
    lastId: result.rows.at(-1)?.$id ?? null,
  };
}
```

**Why good:** `Query.cursorAfter()` for efficient cursor pagination (better than offset for large datasets), tracks whether more pages exist, returns last ID for next page call

**When to use:** Prefer cursor-based pagination (`cursorAfter`/`cursorBefore`) over offset-based (`Query.offset()`) for datasets with more than a few hundred rows. Offset pagination degrades as the offset increases.

---

## Pattern 6: Permissions — Common Patterns

### Good Example — Owner-Only Access

```typescript
// Only the creator can read, update, and delete
function ownerPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}
```

### Good Example — Public Read, Owner Write

```typescript
// Anyone can read, only owner can modify
function publicReadOwnerWrite(userId: string) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}
```

### Good Example — Team Collaboration

```typescript
// All team members can read, admins can edit, owners can delete
function teamPermissions(teamId: string, ownerId: string) {
  return [
    Permission.read(Role.team(teamId)),
    Permission.update(Role.team(teamId, "admin")),
    Permission.delete(Role.user(ownerId)),
  ];
}
```

### Good Example — Updating Permissions on Existing Row

```typescript
// Grant access to a new team member
async function shareWithUser(
  databaseId: string,
  tableId: string,
  rowId: string,
  targetUserId: string,
) {
  const row = await tablesDB.getRow({ databaseId, tableId, rowId });
  const currentPermissions = row.$permissions;

  await tablesDB.updateRow({
    databaseId,
    tableId,
    rowId,
    permissions: [
      ...currentPermissions,
      Permission.read(Role.user(targetUserId)),
    ],
  });
}
```

**Why good:** Preserves existing permissions, adds new user read access, reads current state before modifying

---

_For auth patterns, see [auth.md](auth.md). For storage, see [storage.md](storage.md). For functions, see [functions.md](functions.md). For realtime, see [realtime.md](realtime.md)._
