# Appwrite Reference

> CLI commands, Query class methods, Permission/Role syntax, and quick lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Appwrite CLI Commands

### Project Setup

```bash
# Install CLI globally
npm install -g appwrite-cli

# Login to Appwrite
appwrite login

# Initialize project in current directory
appwrite init project

# Initialize functions
appwrite init function
```

### Type Generation

```bash
# Generate TypeScript types from your project schema
appwrite types

# Output: generates interfaces for all tables and their columns
```

### Functions

```bash
# Create a new function
appwrite init function

# Deploy functions
appwrite deploy function

# Execute a function
appwrite functions createExecution --functionId <FUNCTION_ID> --body '{"key":"value"}'
```

---

## Environment Variables

```bash
# .env.local
APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key          # SERVER ONLY — never expose to client
```

---

## Query Class Reference

| Method                             | Example                                | Description                         |
| ---------------------------------- | -------------------------------------- | ----------------------------------- |
| `Query.equal(col, val)`            | `Query.equal("status", "active")`      | Exact match (also accepts arrays)   |
| `Query.notEqual(col, val)`         | `Query.notEqual("status", "archived")` | Exclude value                       |
| `Query.greaterThan(col, val)`      | `Query.greaterThan("age", 18)`         | Greater than                        |
| `Query.greaterThanEqual(col, val)` | `Query.greaterThanEqual("age", 18)`    | Greater than or equal               |
| `Query.lessThan(col, val)`         | `Query.lessThan("price", 100)`         | Less than                           |
| `Query.lessThanEqual(col, val)`    | `Query.lessThanEqual("price", 100)`    | Less than or equal                  |
| `Query.between(col, start, end)`   | `Query.between("age", 18, 65)`         | Inclusive range                     |
| `Query.isNull(col)`                | `Query.isNull("deletedAt")`            | Column is null                      |
| `Query.isNotNull(col)`             | `Query.isNotNull("email")`             | Column is not null                  |
| `Query.startsWith(col, str)`       | `Query.startsWith("name", "Al")`       | String prefix match                 |
| `Query.endsWith(col, str)`         | `Query.endsWith("email", ".com")`      | String suffix match                 |
| `Query.contains(col, val)`         | `Query.contains("tags", ["urgent"])`   | Array/substring contains            |
| `Query.search(col, keywords)`      | `Query.search("title", "appwrite")`    | Full-text search (requires index)   |
| `Query.orderAsc(col)`              | `Query.orderAsc("createdAt")`          | Sort ascending                      |
| `Query.orderDesc(col)`             | `Query.orderDesc("$createdAt")`        | Sort descending                     |
| `Query.limit(n)`                   | `Query.limit(25)`                      | Max rows returned (max 100)         |
| `Query.offset(n)`                  | `Query.offset(25)`                     | Skip rows (offset-based pagination) |
| `Query.cursorAfter(id)`            | `Query.cursorAfter("row_abc")`         | Cursor-based pagination (after ID)  |
| `Query.cursorBefore(id)`           | `Query.cursorBefore("row_xyz")`        | Cursor-based pagination (before ID) |
| `Query.select(fields)`             | `Query.select(["title", "status"])`    | Return only specific columns        |
| `Query.and(queries)`               | `Query.and([q1, q2])`                  | All conditions must match           |
| `Query.or(queries)`                | `Query.or([q1, q2])`                   | Any condition can match             |

---

## Permission + Role Quick Reference

### Permission Methods

| Method                    | Description                        |
| ------------------------- | ---------------------------------- |
| `Permission.read(role)`   | Can read the resource              |
| `Permission.create(role)` | Can create child resources         |
| `Permission.update(role)` | Can modify the resource            |
| `Permission.delete(role)` | Can remove the resource            |
| `Permission.write(role)`  | Alias for create + update + delete |

### Role Methods

| Method                          | Description                        |
| ------------------------------- | ---------------------------------- |
| `Role.any()`                    | Anyone (including unauthenticated) |
| `Role.guests()`                 | Unauthenticated users only         |
| `Role.users()`                  | All authenticated users            |
| `Role.users("verified")`        | Verified authenticated users       |
| `Role.user(userId)`             | Specific user                      |
| `Role.user(userId, "verified")` | Specific verified user             |
| `Role.team(teamId)`             | All team members                   |
| `Role.team(teamId, "admin")`    | Team members with role             |
| `Role.member(membershipId)`     | Specific team membership           |
| `Role.label("premium")`         | Users with label (server-set only) |

---

## Realtime Channel Helpers

| Channel                                            | Subscribe To                       |
| -------------------------------------------------- | ---------------------------------- |
| `Channel.account()`                                | Current user's account changes     |
| `Channel.files()`                                  | All file events across all buckets |
| `Channel.tablesdb(dbId).table(tableId)`            | All row events in a table          |
| `Channel.tablesdb(dbId).table(tableId).row(rowId)` | Specific row events                |

### Event String Patterns

| Pattern                             | Description   |
| ----------------------------------- | ------------- |
| `tablesdb.*.tables.*.rows.*.create` | Row created   |
| `tablesdb.*.tables.*.rows.*.update` | Row updated   |
| `tablesdb.*.tables.*.rows.*.delete` | Row deleted   |
| `buckets.*.files.*.create`          | File uploaded |
| `buckets.*.files.*.update`          | File updated  |
| `buckets.*.files.*.delete`          | File deleted  |

---

## Storage Methods Quick Reference

| Method                                                               | Description                           |
| -------------------------------------------------------------------- | ------------------------------------- |
| `storage.createFile({ bucketId, fileId, file, permissions? })`       | Upload a file                         |
| `storage.getFile({ bucketId, fileId })`                              | Get file metadata                     |
| `storage.listFiles({ bucketId, queries? })`                          | List files in bucket                  |
| `storage.updateFile({ bucketId, fileId, name?, permissions? })`      | Update file metadata/permissions      |
| `storage.deleteFile({ bucketId, fileId })`                           | Delete a file                         |
| `storage.getFilePreview({ bucketId, fileId, width?, height?, ... })` | Image preview with transforms         |
| `storage.getFileDownload({ bucketId, fileId })`                      | Download URL (attachment header)      |
| `storage.getFileView({ bucketId, fileId })`                          | View URL (inline, no download header) |

---

## Auth Methods Quick Reference

| Method                                                                   | Description                             |
| ------------------------------------------------------------------------ | --------------------------------------- |
| `account.create({ userId, email, password, name? })`                     | Create new user account                 |
| `account.createEmailPasswordSession({ email, password })`                | Sign in with email/password             |
| `account.createOAuth2Session({ provider, success?, failure?, scopes? })` | OAuth redirect (`OAuthProvider` enum)   |
| `account.createMagicURLToken({ userId, email, url?, phrase? })`          | Send magic link email                   |
| `account.createPhoneToken({ userId, phone })`                            | Send SMS OTP                            |
| `account.createAnonymousSession()`                                       | Guest session                           |
| `account.get()`                                                          | Get current user (throws if no session) |
| `account.updatePrefs({ prefs })`                                         | Update user preferences                 |
| `account.updateName({ name })`                                           | Update user display name                |
| `account.updatePassword({ password, oldPassword? })`                     | Change password                         |
| `account.createEmailVerification({ url })`                               | Send verification email                 |
| `account.updateEmailVerification({ userId, secret })`                    | Confirm email verification              |
| `account.deleteSession({ sessionId: "current" })`                        | Sign out current device                 |
| `account.deleteSessions()`                                               | Sign out all devices                    |

---

## System Fields on Rows

All rows include these system-managed fields (prefixed with `$`):

| Field                        | Type     | Description                    |
| ---------------------------- | -------- | ------------------------------ |
| `$id`                        | string   | Unique row identifier          |
| `$createdAt`                 | string   | ISO 8601 creation timestamp    |
| `$updatedAt`                 | string   | ISO 8601 last update timestamp |
| `$permissions`               | string[] | Row-level permission strings   |
| `$databaseId`                | string   | Parent database ID             |
| `$collectionId` / `$tableId` | string   | Parent table ID                |

Use `$createdAt` and `$updatedAt` in queries: `Query.orderDesc("$createdAt")`

---

## Function Context Object

```typescript
export default async ({ req, res, log, error }) => {
  req.method; // GET, POST, PUT, DELETE, etc.
  req.path; // URL path
  req.query; // Parsed query parameters
  req.bodyText; // Raw text body
  req.bodyJson; // Parsed JSON body
  req.headers; // All headers (lowercase keys)
  req.headers["x-appwrite-key"]; // Dynamic API key (admin access)
  req.headers["x-appwrite-user-jwt"]; // User JWT (user-scoped access)

  res.text("ok"); // Plain text response
  res.json({ key: "value" }); // JSON response
  res.empty(); // 204 No Content
  res.redirect("https://..."); // 301 Redirect

  log("debug info"); // Developer-only logging
  error("something went wrong"); // Developer-only error logging
};
```
