---
name: meta-reviewing-api-reviewing
description: Backend code review patterns. Use when reviewing API routes, database operations, auth middleware, and server utilities. Covers injection, boundary validation, authorization coverage, secret/PII exposure, error leakage, and query patterns.
---

# API Code Review Patterns

> **Quick Guide:** When a diff touches server code, trace every external input to where it is used - it must pass schema validation at the boundary and never reach a query or shell as a concatenated string. Verify every new route names its auth expectation and checks object-level access. Check what errors and logs expose. Security findings outrank everything else in the diff.

---

<critical_requirements>

## CRITICAL: Before Reviewing API Code

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST trace every external input in the diff - body, params, query, headers - to its use, verifying schema validation at the boundary)**

**(You MUST verify no user input is concatenated into SQL, shell commands, or file paths - parameterized queries and validated paths only)**

**(You MUST verify every route the diff adds declares its authentication requirement and checks authorization for the object it touches)**

**(You MUST check that secrets, tokens, passwords, and PII do not reach logs, error responses, or client payloads)**

**(You MUST verify error handling in the diff returns intentional messages - no stack traces or raw driver errors to the client)**

</critical_requirements>

---

**Auto-detection:** review API, backend PR review, route review, endpoint review, database query review, auth middleware review, server code review

**When to use:**

- Reviewing diffs containing API routes or handlers
- Reviewing database queries, schema changes, or ORM usage
- Reviewing authentication/authorization middleware or session handling
- Reviewing server utilities that touch external input, files, or child processes

**When NOT to use:**

- When implementing backend code (use the relevant API implementation skill)
- For UI components in the same diff (use the web reviewing skill)
- For CI/CD pipelines and deployment configs (use the infra reviewing skill)

**Key patterns covered:**

- Injection review: SQL, shell, and path traversal
- Boundary validation with schemas
- Authentication and object-level authorization coverage
- Secret and PII exposure in logs and responses
- Error responses that don't leak internals
- Query patterns: N+1 and unbounded reads the diff introduces

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Good/bad backend patterns to look for during review

---

<philosophy>

## Philosophy

**Server code is the trust boundary.** A UI bug annoys one user; an injection or authorization gap exposes every user's data. Review the diff's inputs and outputs before its style: what enters unvalidated, and what leaves that shouldn't.

**When reviewing API code:**

- Follow the data: entry point → validation → use → response, for each input the diff adds
- Assume every request is hostile until a schema says otherwise
- Ask "who may call this?" and "may they touch THIS row?" for every new route - the second question is the one that gets missed
- Read the error paths as carefully as the happy path; that is where internals leak

**When NOT to flag:**

- Don't demand rate limiting, caching, or pagination the spec never asked for on an internal or low-traffic endpoint
- Don't demand a repository/service layer around a query the codebase writes inline everywhere else
- Don't flag missing observability on code following the file's existing logging pattern
- Don't rank a hypothetical scale problem above a real correctness issue in the same diff

**Core principles:**

- **Validate at the boundary**: inside the handler, data is typed and trusted because the schema ran, not because the client is polite
- **Authorization is per-object**: authentication says who you are; the query must still scope to what you own
- **Errors are API surface**: what a failure returns is part of the contract
- **Performance findings need a workload**: an N+1 in a loop over user data is real; a missing index on a ten-row table is not

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Injection Review

No external input reaches an interpreter as a string fragment.

```markdown
## Injection Review

For EACH place the diff sends data to SQL, a shell, or the filesystem:

- [ ] SQL uses parameterized queries or the ORM's binding - no template literals with user input
- [ ] Shell commands use argument arrays (execFile/spawn), never string-built exec with input
- [ ] File paths derived from input are validated against a base directory (no ../ traversal)
- [ ] Dynamic column/table names come from an allowlist, not from the request
```

```typescript
// Must Fix: classic injection
const rows = await db.query(
  `SELECT * FROM users WHERE name = '${req.query.name}'`,
);

// Good: parameterized
const rows = await db.query("SELECT * FROM users WHERE name = $1", [
  req.query.name,
]);
```

**Why this matters:** String-built queries and commands turn any input field into an execution vector. This is always a blocking finding, regardless of how internal the endpoint seems.

---

### Pattern 2: Boundary Validation

Every input the diff reads gets a schema before it gets used.

```markdown
## Validation Review

For EACH route or handler in the diff:

- [ ] Body, params, and query are parsed through a schema (Zod or the codebase's equivalent) before use
- [ ] Validation failures return 400 with a safe message - not a 500 from downstream
- [ ] The schema is as narrow as the contract: enums for enums, bounds on numbers, formats on ids
- [ ] Handler code reads the schema's OUTPUT type, not the raw request
```

```typescript
// Should Fix: trusts the wire shape
const { limit } = req.query;
const items = await listItems(Number(limit));

// Good: contract enforced at the edge
const { limit } = listQuerySchema.parse(req.query); // z.coerce.number().int().min(1).max(100)
const items = await listItems(limit);
```

**Why this matters:** Unvalidated input surfaces as NaN limits, negative offsets, and type confusion deep in the stack, where the error message no longer names the cause.

---

### Pattern 3: Authentication and Object-Level Authorization

Who may call this - and may they touch this row?

```markdown
## Auth Review

For EACH route the diff adds or changes:

- [ ] The route's auth requirement is explicit (middleware or guard) - public routes are deliberately public
- [ ] Queries for user-owned resources scope by the session's user id, not by an id the client sent
- [ ] Mutations verify the resource belongs to the caller before writing (IDOR check)
- [ ] Role/permission checks happen server-side even when the UI hides the action
```

```typescript
// Must Fix: any authenticated user can read any invoice (IDOR)
const invoice = await db.invoice.findUnique({ where: { id: req.params.id } });

// Good: ownership is part of the query
const invoice = await db.invoice.findFirst({
  where: { id: req.params.id, userId: session.userId },
});
```

**Why this matters:** Object-level authorization is the most common real-world API vulnerability. Authentication middleware passing does not mean the caller owns the row.

---

### Pattern 4: Secret and PII Exposure

What leaves the server is as important as what enters it.

```markdown
## Exposure Review

- [ ] No credentials, API keys, or connection strings hardcoded in the diff
- [ ] Logs added by the diff exclude passwords, tokens, session ids, and PII
- [ ] Response payloads select fields explicitly - no serializing whole DB entities with hash/token columns
- [ ] Env vars are read through the codebase's config module, not scattered process.env reads
```

```typescript
// Must Fix: password hash and reset token ride along to the client
return res.json(user);

// Good: explicit projection
return res.json({ id: user.id, name: user.name, email: user.email });
```

**Why this matters:** Serialize-the-entity is how hashes, tokens, and internal flags end up in browser devtools. Logging the request body "for debugging" is how credentials end up in log aggregators.

---

### Pattern 5: Error Handling Without Leakage

Errors are caught, mapped, and intentional.

```markdown
## Error Path Review

- [ ] Async handlers cannot reject unhandled - errors reach the error middleware or a catch
- [ ] Client-facing messages are written for the client; internals (stack, SQL, paths) stay in server logs
- [ ] Status codes match semantics: 400 invalid, 401 unauthenticated, 403 forbidden, 404 absent, 409 conflict
- [ ] Failures the caller can act on (duplicate email) are distinguished from failures they cannot (DB down)
```

```typescript
// Should Fix: raw driver error to the client - leaks schema and dialect
catch (error) {
  res.status(500).json({ error: String(error) });
}

// Good: intentional message out, full detail logged
catch (error) {
  logger.error({ err: error }, "createUser failed");
  res.status(500).json({ error: "Could not create user" });
}
```

**Why this matters:** Raw errors hand attackers a map of the schema and stack, and hand legitimate clients a message they can't act on.

---

### Pattern 6: Query Patterns the Diff Introduces

Review the shape of data access the change creates.

```markdown
## Query Review

When the diff adds queries or loops around them:

- [ ] No query inside a loop over records that a join/include or IN-list would satisfy (N+1)
- [ ] List endpoints the diff adds bound their result set when the table grows with usage
- [ ] Multi-write operations that must succeed together run in a transaction
- [ ] When the diff adds a WHERE on a new column of a large, growing table, an index accompanies it
```

```typescript
// Should Fix: one query per order - N+1
const orders = await db.order.findMany({ where: { userId } });
for (const order of orders) {
  order.items = await db.item.findMany({ where: { orderId: order.id } });
}

// Good: one round trip
const orders = await db.order.findMany({
  where: { userId },
  include: { items: true },
});
```

**Why this matters:** N+1s and unbounded reads pass every test on seed data and fall over on production volume - the review is the last place the shape is visible.

</patterns>

---

<decision_framework>

## Decision Framework

### Severity Classification for API Issues

```
Is this a security defect the diff introduces?
├─ User input concatenated into SQL/shell/path → MUST FIX
├─ Route missing auth, or query missing ownership scoping (IDOR) → MUST FIX
├─ Secrets/PII in logs, responses, or hardcoded in source → MUST FIX
├─ External input used with no boundary validation → MUST FIX
└─ NO → Is it a correctness or robustness gap?
    ├─ Raw internals in client-facing errors → SHOULD FIX
    ├─ N+1 or unbounded query on a growth path → SHOULD FIX
    ├─ Related writes without a transaction → SHOULD FIX
    ├─ Wrong status code for the failure's semantics → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Narrowing an already-safe schema further → NICE TO HAVE
        ├─ Rate limiting/caching the spec never asked for → DON'T MENTION
        ├─ Layer/abstraction preference over working inline code → DON'T MENTION
        └─ Hypothetical scale concerns on internal tooling → DON'T MENTION
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (Must Fix):**

- Template literals or string concatenation building SQL with request data
- `exec(userInput)` or string-built shell commands
- Route handlers reading `req.body`/params with no schema parse
- `findUnique({ where: { id: params.id } })` on user-owned resources with no ownership check
- `res.json(entity)` where the entity carries hash/token/internal columns
- Hardcoded credentials, tokens, or connection strings

**Medium Priority Issues (Should Fix):**

- `catch` blocks that stringify the error into the response
- Queries inside loops over query results
- New list endpoints with no bound on a growing table
- Sequential dependent writes with no transaction
- `console.log` of request bodies on auth or payment paths

**Common Mistakes:**

- Validating the body but not params or query
- Checking authentication and calling it authorization
- Trusting an id because it "comes from our own frontend"
- Returning 200 with an error object in the body
- Catch-and-continue that swallows the failure and corrupts later state

**Gotchas & Edge Cases:**

- ORM raw-query escape hatches (`$queryRawUnsafe`, `sequelize.query`) reintroduce injection the ORM normally prevents
- Zod `.parse` throws - a handler without the codebase's error boundary turns validation into a 500
- Middleware order matters: a validator after the handler runs never
- Soft-deleted rows still satisfy ownership checks unless the query filters them
- JSON.stringify on circular DB entities throws at serialization, after the status was already sent

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST trace every external input in the diff - body, params, query, headers - to its use, verifying schema validation at the boundary)**

**(You MUST verify no user input is concatenated into SQL, shell commands, or file paths - parameterized queries and validated paths only)**

**(You MUST verify every route the diff adds declares its authentication requirement and checks authorization for the object it touches)**

**(You MUST check that secrets, tokens, passwords, and PII do not reach logs, error responses, or client payloads)**

**(You MUST verify error handling in the diff returns intentional messages - no stack traces or raw driver errors to the client)**

**Failure to catch these issues will result in APIs with injection vectors, cross-tenant data access, and credentials sitting in logs and client payloads.**

</critical_reminders>
