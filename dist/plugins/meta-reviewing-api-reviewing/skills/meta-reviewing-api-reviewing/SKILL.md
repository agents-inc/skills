---
name: meta-reviewing-api-reviewing
description: Backend code review — injection and SSRF, boundary validation, object-level authorization, mass assignment and data exposure, error leakage, N+1 and unbounded queries. Use when a diff touches API routes or handlers, database access, auth middleware, or server code that reads files, starts processes or fetches URLs.
---

# API Code Review Patterns

> **Quick Guide:** Review a backend diff's inputs and outputs before anything else in it: what enters without a schema, what reaches an interpreter or an outbound request as part of a string, which route answers without checking whose row it returns, and which fields leave in a response, a log or an error. Those are Must Fix and block approval; error text and query shape are Should Fix, addressed before merge without blocking it; the rest of the codebase's habits are not this diff's findings. Two facts change the verdict often enough to hold up front: a tagged `sql` template binds its interpolated values, so the injection is the untagged template literal; and an argument array keeps the shell out but not the program's own option parser.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — before-and-after code for each pattern below, under the same headings

---

<critical_requirements>

## Before reviewing API code

**Follow every value the diff reads from a request — body, params, query, headers, cookies — to the line that uses it.** The defect lives at the use: a handler that parses its body and then reads `limit` raw from the query string is unvalidated exactly where it matters.

**Treat request data reaching SQL, a shell, a file path or an outbound URL as Must Fix unless it arrives as a bound parameter, an argument-array element that cannot start with `-`, a path confirmed inside its base directory, or an allowlisted value.** Spliced into a string something else parses, data becomes instructions, and nothing downstream can tell the two apart.

**For every route the diff adds or changes, find the guard that authenticates the caller and the condition that ties the row to them.** Authentication says who is asking; without the ownership condition, changing the id in the URL returns someone else's row.

**Read each response body, write, log line and error message the diff adds field by field.** A serialized row carries every column, a write bound to the request body accepts every column, and a logged request carries its credentials to everyone who reads the logs.

</critical_requirements>

---

**Auto-detection:** API review, backend PR review, endpoint review, route handler review, SQL injection, command injection, argument injection, path traversal, SSRF, IDOR, BOLA, broken object level authorization, mass assignment, excessive data exposure, error leakage, secrets in logs, N+1 query, unbounded query

**Applies to:**

- A diff that adds or changes route handlers, middleware, the queries behind them, database schema changes, or ORM usage
- Authentication, role checks and row ownership
- Server code that reads files, starts processes or fetches URLs using request data
- What responses, log lines and error messages carry out of the server

**Handled elsewhere:**

- Severity vocabulary, the cost gate and the approval decision — the general review discipline; this skill only places API defects on it.
- UI in the same diff — rendering, client state and accessibility.
- Pipelines, container images and deployment configuration, including the secrets they hold.
- Model calls, prompt assembly and handling of model output.
- How the config module itself loads and validates the environment.
- Throughput work the diff's workload does not call for — caching layers, rate limits, query plans on tables that stay small.

---

<philosophy>

## Philosophy

A UI defect reaches the user who triggers it; a server defect reaches every row the server can read. So a backend diff's inputs and outputs are reviewed before its structure, and each route gets two questions asked separately — who may call this, and may they touch this row — because the second is the one that goes missing. Error paths get the same reading as the happy path: what a failure returns is part of the contract, and it is where internals leak.

</philosophy>

---

<decision_framework>

## Severity for API findings

```
Does request data reach an interpreter, an outbound request, or another user's data —
or can a failure escape the error handler?
├─ Spliced into SQL, a shell command, a file path or a fetched URL → Must Fix
├─ A route with no guard, or a query with no ownership condition → Must Fix
├─ A write bound to the request body rather than to named fields → Must Fix
├─ Secrets, tokens or personal data in a response, a log line or source → Must Fix
├─ Request data used with no schema at the boundary → Must Fix
├─ A promise the handler neither awaits, returns nor gives its own .catch → Must Fix
│     (a task detached on purpose with its own .catch, or through the
│      codebase's documented fire-and-forget helper, is fine)
└─ NO → Does it fail under real input or real volume?
    ├─ Stack, SQL or driver text in a client-facing error → Should Fix
    ├─ A query per row in a loop over records that grow with usage → Should Fix
    ├─ A list endpoint with no bound on a growing table → Should Fix
    ├─ Writes that must land together, outside a transaction → Should Fix
    ├─ A status that contradicts the failure (200 wrapping an error, 500 for bad input) → Should Fix
    └─ NO → Is it an improvement the diff's purpose supports?
        ├─ Narrowing a schema that is already safe → Nice to Have
        └─ Rate limits, caching, a repository layer, an index on a table that stays small → don't write it
```

A performance finding names the workload that makes it real: a query per row over a user's orders grows with every order, and a missing index on a twelve-row lookup table never will.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Injection and Server-Side Requests

Nothing that parses — the database, a shell, a program's option parser, the filesystem, an HTTP client — receives request data as part of its instructions.

- SQL binds request values: placeholders, the data layer's query builder, or a tagged `sql` template. An untagged template literal or `+` produces one string, and the database parses all of it.
- Methods named `raw`, `unsafe` or `literal` receive no request data; they hand their string to the database verbatim, by design.
- Column names, table names and sort directions come from an allowlist, because a placeholder binds values and cannot bind an identifier.
- A process starts from an executable and an argument array, with no `shell: true`. A request value in that array is refused if it starts with `-`, or placed after `--` where the program honours it.
- A file path built from request data is resolved against its base directory and checked to start with that base plus a separator. Stripping `../` misses encoded and nested forms.
- A URL the server fetches on the client's behalf matches an allowlist of hosts, and redirects are refused.

```typescript
// Must Fix: the search term is parsed as SQL
await db.query(`SELECT id FROM posts WHERE title = '${query.q}'`);

// Bound: the value travels separately from the statement
await db.query("SELECT id FROM posts WHERE title = $1", [query.q]);
await sql`SELECT id FROM posts WHERE title = ${query.q}`;
```

Full code: [examples/core.md](examples/core.md#pattern-1-injection-and-server-side-requests)

### Pattern 2: Boundary Validation

Every value the handler uses has passed a schema, and the handler reads what the schema returned.

- Body, params, query and headers each pass a schema; validating the body leaves the rest raw.
- The handler reads the parse result. Going back to the raw request discards what the schema guaranteed.
- The schema is as narrow as the contract — enums, bounds on numbers, a format on ids. A `limit` with no maximum turns a list endpoint into a full-table read.
- A failed parse answers 400 or 422, whichever the codebase uses. A throwing parse that no error handler maps answers 500.

```typescript
// Must Fix: "abc" becomes NaN, and nothing caps the page size
const items = await listItems(Number(query.limit));

// The handler reads the parsed output: an integer from 1 to 100
const { limit } = listQuerySchema.parse(query);
const items = await listItems(limit);
```

Full code: [examples/core.md](examples/core.md#pattern-2-boundary-validation)

### Pattern 3: Authentication and Object-Level Authorization

Who may call this, and may they touch this row. OWASP's API Security Top 10 (2023) ranks broken object-level authorization first.

- The route's auth requirement is explicit; a public route is public by a decision visible in the diff.
- Reads and writes of user-owned rows carry an ownership condition taken from the session, never from an id the client sent.
- Role-gated functions check the role on the server; hiding the button in the UI checks nothing.
- A row the caller may not see answers like a missing one. RFC 9110 permits 404 in place of 403, and the difference between them lets a caller probe which ids exist.

```typescript
// Must Fix: any signed-in user reads any invoice by changing the id
await db.query("SELECT id, total FROM invoices WHERE id = $1", [params.id]);

// Ownership is part of the query
await db.query(
  "SELECT id, total FROM invoices WHERE id = $1 AND owner_id = $2",
  [params.id, session.userId],
);
```

Full code: [examples/core.md](examples/core.md#pattern-3-authentication-and-object-level-authorization)

### Pattern 4: Property-Level Exposure

Fields leave and enter by name. OWASP's API3:2023 merges excessive data exposure and mass assignment into one category, because both are an entity's shape crossing the boundary unfiltered.

- Responses name their fields. A whole row ships every column — password hashes, reset tokens, internal flags.
- Writes name their fields. A write bound to the request body lets the caller set `role`, `ownerId` or `verified`. Where the body passed a schema, check its unknown-key mode: some libraries strip undeclared keys by default, some keep them, and every loose or passthrough mode keeps them.
- Log lines the diff adds leave out passwords, tokens, session ids, connection strings and personal data; logs are read by more people, and kept longer, than the rows they describe.
- Credentials, keys and connection strings stay out of source.
- Environment values are read through the codebase's config module, not through scattered `process.env` reads in handlers. A direct read skips whatever validation the module does, so a missing or malformed value surfaces as a failed request rather than a failed start.

```typescript
// Must Fix: sending { "role": "admin" } promotes the caller
await users.update(session.userId, body);

// The write names what a user may change
const { name, email } = profileSchema.parse(body);
await users.update(session.userId, { name, email });
```

Full code: [examples/core.md](examples/core.md#pattern-4-property-level-exposure)

### Pattern 5: Error Paths

What a failure returns is part of the contract.

- Every promise a handler starts is awaited, returned, or given its own `.catch`; one that is none of these is Must Fix. The framework's error handler never sees its rejection, so the client gets no error response, and under Node's default `--unhandled-rejections=throw` (since v15) the rejection becomes an uncaught exception that ends the process. A task detached on purpose — with its own `.catch`, or through the codebase's documented fire-and-forget helper — is fine.
- Client-facing messages are written for the client; stacks, SQL, file paths and driver text stay in the server log.
- Status codes carry what callers branch on: 400 or 422 for bad input, 401 for missing or invalid credentials, 403 for refused, 404 for absent, 409 for a conflict with current state. A 200 wrapping an error, or a 500 for bad input, sends callers down the wrong branch.
- A failure the caller can act on — the email is taken — is told apart from one they cannot — the database is down.
- No catch swallows a failure, logged or not, and lets later code run as if it had succeeded — that code then works on state that was never written or never read.

```typescript
// Should Fix: dialect, table names and stack frames reach the client
return { status: 500, body: { error: String(error) } };

// The log gets the detail; the client gets a message written for it
logServerError("signup failed", error);
return { status: 500, body: { error: "Could not create account" } };
```

Full code: [examples/core.md](examples/core.md#pattern-5-error-paths)

### Pattern 6: Query Shape

Read the data access at production volume; seed data hides every one of these.

- No query runs inside a loop over rows that one join, one query over all their ids, or one multi-row write would answer.
- A list endpoint the diff adds bounds its result set when the table grows with usage.
- Writes that must land together share a transaction; a failure between them leaves half the change.
- A new filter on a large, growing table has an index, in this diff or already.

```typescript
// Should Fix: one round trip per order
for (const order of orders) {
  order.items = await db.query(
    "SELECT sku, quantity FROM order_items WHERE order_id = $1",
    [order.id],
  );
}
```

Full code: [examples/core.md](examples/core.md#pattern-6-query-shape)

</patterns>

---

<red_flags>

## Red flags

**Grep the diff for these, then read each hit against its pattern:**

- A template literal or `+` around `SELECT`, `INSERT`, `UPDATE`, `DELETE` or `WHERE` (Pattern 1)
- Query methods named `raw`, `unsafe` or `literal` (Pattern 1)
- `exec(`, `execSync(` and `shell: true` (Pattern 1)
- `readFile`, `createReadStream`, `unlink` or `path.join` given request data (Pattern 1)
- `fetch(` or another HTTP client given a URL from the request (Pattern 1)
- The request body, or a spread of it, passed to a write (Pattern 4)
- A loaded row or entity returned as the response body (Pattern 4)
- A log call given the request, its body or its headers (Pattern 4)
- `String(error)`, `error.message` or `.stack` in a response body (Pattern 5)
- A promise-returning call with no `await`, `return` or `.catch` in a handler — Must Fix; a detached task with its own `.catch`, or the codebase's documented fire-and-forget helper, is fine (Pattern 5)
- `await` inside a `for` over the results of another query (Pattern 6)

**Looks safe, isn't:**

- An argument array — git still reads `--upload-pack=…` as an option when the request value starts with `-`. Refuse option-shaped values, or put `--` before the positionals.
- `resolved.startsWith(base)` — with no trailing separator it also admits the sibling directory `uploads-old`.
- A schema on the body — params and query stay raw unless they get their own.
- Authentication middleware on the router — it identifies the caller and says nothing about whose row the query returns.
- A guard or validator registered after a route — where middleware runs in registration order, it never runs for that route, so the request arrives unauthenticated or unvalidated.
- An ownership check on a soft-deleting table — deleted rows still pass unless the query filters them out.
- An id that comes from "our own frontend" — it arrives in a request like any other input.
- A denylist of private addresses for outbound requests — alternate IP spellings and a redirect from an allowed host both get past it.

**Looks unsafe, isn't:**

- A tagged `sql` template interpolating a request value — the tag binds it as a parameter. The same text with no tag in front is the injection.
- 422 for a validation failure — RFC 9110 defines it and frameworks use it. The finding is a 5xx for bad input, not the choice between 400 and 422.
- A query written inline where the codebase writes queries inline — a missing repository layer is not this diff's defect.

</red_flags>
