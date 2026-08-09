# API Reviewing - Core Examples

> Good/bad backend patterns to look for during API code reviews. See [../SKILL.md](../SKILL.md) for checklists and the severity framework.

---

## Parameterized Queries vs String Building

```typescript
// Must Fix: injection via the search box
const results = await db.query(
  `SELECT id, title FROM posts WHERE title LIKE '%${req.query.q}%'`,
);

// Good: input travels as data, never as SQL
const results = await db.query(
  "SELECT id, title FROM posts WHERE title LIKE $1",
  [`%${req.query.q}%`],
);
```

The same rule for shells: `execFile("git", ["clone", repoUrl])` passes the URL as one argument; ``exec(`git clone ${repoUrl}`)`` hands the request shell metacharacters.

---

## Boundary Validation With a Schema

```typescript
// Must Fix: NaN page sizes, negative offsets, and arbitrary sort columns all flow through
app.get("/items", async (c) => {
  const { limit, offset, sort } = c.req.query();
  return c.json(await listItems(Number(limit), Number(offset), sort));
});

// Good: the contract is explicit, and the handler reads the parsed output
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["createdAt", "title"]).default("createdAt"),
});

app.get("/items", zValidator("query", listQuery), async (c) => {
  const { limit, offset, sort } = c.req.valid("query");
  return c.json(await listItems(limit, offset, sort));
});
```

Note the `sort` enum: dynamic column names come from an allowlist, never from the wire.

---

## Object-Level Authorization (IDOR)

```typescript
// Must Fix: authenticated ≠ authorized - any logged-in user reads any document
app.get("/documents/:id", requireAuth, async (c) => {
  const doc = await db.document.findUnique({
    where: { id: c.req.param("id") },
  });
  return c.json(doc);
});

// Good: ownership is part of the query, and absence looks identical to forbidden
app.get("/documents/:id", requireAuth, async (c) => {
  const doc = await db.document.findFirst({
    where: { id: c.req.param("id"), ownerId: c.get("userId") },
  });
  if (!doc) return c.json({ error: "Not found" }, 404);
  return c.json(doc);
});
```

---

## Explicit Response Projection

```typescript
// Must Fix: passwordHash, resetToken, and internal flags ship to the browser
const user = await db.user.findFirst({ where: { id: session.userId } });
return c.json(user);

// Good: the response shape is chosen, not inherited from the table
return c.json({ id: user.id, name: user.name, email: user.email });
```

---

## Error Mapping Without Leakage

```typescript
// Should Fix: dialect, table names, and stack frames reach the client
catch (error) {
  return c.json({ error: (error as Error).stack }, 500);
}

// Good: the client gets an actionable message; the log gets the truth
catch (error) {
  if (isUniqueViolation(error)) {
    return c.json({ error: "That email is already registered" }, 409);
  }
  logger.error({ err: error }, "signup failed");
  return c.json({ error: "Could not create account" }, 500);
}
```

---

## N+1 and Transactional Writes

```typescript
// Should Fix: 1 + N round trips, and a partial failure strands the order
const order = await db.order.create({ data: orderData });
for (const line of lines) {
  await db.orderLine.create({ data: { ...line, orderId: order.id } });
}

// Good: one transaction, one shape
const order = await db.$transaction(async (tx) => {
  const created = await tx.order.create({ data: orderData });
  await tx.orderLine.createMany({
    data: lines.map((line) => ({ ...line, orderId: created.id })),
  });
  return created;
});
```
