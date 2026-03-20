# Prisma Reference

Decision frameworks, performance optimization, and quick reference tables for Prisma ORM.

---

<decision_framework>

## Decision Framework

### When to Use Which Query Method?

```
Need to fetch a record?
├─ By unique field (id, email)? → findUnique()
├─ First matching with conditions? → findFirst()
├─ Multiple records? → findMany()
└─ Need count only? → count()

Need to fetch related data?
├─ All fields of relation? → include: { relation: true }
├─ Specific fields only? → select: { field: true, relation: { select: {...} } }
└─ Filter related records? → include: { relation: { where: {...} } }
```

### When to Use Which Write Method?

```
Creating records?
├─ Single record → create()
├─ Single with relations → create() with nested writes
├─ Multiple records → createMany()
└─ Multiple with return values → createManyAndReturn() (PostgreSQL/CockroachDB/SQLite)

Updating records?
├─ Single by unique field → update()
├─ Multiple matching → updateMany()
└─ Create if not exists → upsert()

Deleting records?
├─ Single by unique field → delete()
├─ Multiple matching → deleteMany()
└─ Soft delete (recommended) → update() with deletedAt field
```

### When to Use Which Transaction Type?

```
What type of operation?
├─ Creating parent + children together
│   └─ Nested writes (implicit transaction)
├─ Multiple independent operations atomically
│   └─ Batch $transaction([...])
├─ Need reads, logic, then conditional writes
│   └─ Interactive $transaction(async (tx) => {...})
└─ Single operation
    └─ No transaction needed
```

### Offset vs Cursor Pagination?

```
What's the use case?
├─ Traditional page navigation (Page 1, 2, 3...)
│   └─ Offset pagination (skip/take)
├─ Infinite scroll or "Load more"
│   └─ Cursor pagination
├─ Large dataset (100k+ rows)
│   └─ Cursor pagination (offset is slow)
├─ Need random page access
│   └─ Offset pagination
└─ Real-time data that changes frequently
    └─ Cursor pagination (stable references)
```

</decision_framework>

---

<performance>

## Performance Optimization

### Indexing Strategy

Add indexes for frequently queried fields:

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  authorId  String
  published Boolean  @default(false)
  createdAt DateTime @default(now())

  author User @relation(fields: [authorId], references: [id])

  // Single column indexes
  @@index([authorId])        // Foreign key lookups
  @@index([published])       // Filter by status
  @@index([createdAt])       // Sort by date

  // Composite index for common query patterns
  @@index([authorId, published, createdAt])
}
```

### Avoid N+1 Queries

```typescript
// WRONG: N+1 queries
const users = await prisma.user.findMany();
const usersWithPosts = await Promise.all(
  users.map(async (user) => ({
    ...user,
    posts: await prisma.post.findMany({ where: { authorId: user.id } }),
  })),
);

// CORRECT: Single query with include
const usersWithPosts = await prisma.user.findMany({
  include: { posts: true },
});
```

### Use Select for Large Relations

```typescript
// WRONG: Fetching all fields when only need some
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true }, // Returns all post fields
});

// CORRECT: Select only needed fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    posts: {
      select: { id: true, title: true },
    },
  },
});
```

### Batch Operations

```typescript
// WRONG: Individual creates in a loop
for (const data of items) {
  await prisma.item.create({ data });
}

// CORRECT: Batch create
await prisma.item.createMany({
  data: items,
  skipDuplicates: true,
});
```

### Connection Pooling

Configure connection pool for your workload:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// In DATABASE_URL, add pool parameters:
// ?connection_limit=5&pool_timeout=20
```

For serverless, use a connection pooler like PgBouncer or Prisma Accelerate.

</performance>

---

> See [SKILL.md](SKILL.md) for red flags, anti-patterns, and gotchas.

---

## Quick Reference Tables

### Common Filter Operators

| Operator                 | Description      | Example                                               |
| ------------------------ | ---------------- | ----------------------------------------------------- |
| `equals`                 | Exact match      | `{ email: { equals: "a@b.com" } }`                    |
| `not`                    | Not equal        | `{ status: { not: "DELETED" } }`                      |
| `in`                     | In array         | `{ role: { in: ["USER", "ADMIN"] } }`                 |
| `notIn`                  | Not in array     | `{ id: { notIn: excludedIds } }`                      |
| `lt`, `lte`, `gt`, `gte` | Comparisons      | `{ age: { gte: 18 } }`                                |
| `contains`               | Substring        | `{ title: { contains: "prisma" } }`                   |
| `startsWith`             | Prefix           | `{ email: { startsWith: "admin" } }`                  |
| `endsWith`               | Suffix           | `{ email: { endsWith: "@company.com" } }`             |
| `mode`                   | Case sensitivity | `{ name: { contains: "john", mode: "insensitive" } }` |

### Relation Filter Operators

| Operator | Description                  | Example                                     |
| -------- | ---------------------------- | ------------------------------------------- |
| `some`   | At least one matches         | `{ posts: { some: { published: true } } }`  |
| `every`  | All match                    | `{ posts: { every: { published: true } } }` |
| `none`   | None match                   | `{ posts: { none: { published: true } } }`  |
| `is`     | Related record matches       | `{ author: { is: { role: "ADMIN" } } }`     |
| `isNot`  | Related record doesn't match | `{ author: { isNot: { role: "BANNED" } } }` |

### Relation Operations in Writes

| Operation         | Description               | Use Case                         |
| ----------------- | ------------------------- | -------------------------------- |
| `create`          | Create new related record | New user with new profile        |
| `connect`         | Link existing record      | Assign existing category to post |
| `connectOrCreate` | Link or create            | Ensure tag exists and link       |
| `disconnect`      | Unlink record             | Remove category from post        |
| `set`             | Replace all connections   | Update post's categories         |
| `update`          | Update related record     | Modify user's profile            |
| `upsert`          | Update or create related  | Ensure profile exists and update |
| `delete`          | Delete related record     | Remove user's profile            |

---

## Checklist

### Before Deploying

- [ ] Singleton pattern for PrismaClient (or using framework integration)
- [ ] Indexes on frequently filtered columns
- [ ] `onDelete` cascade configured for child relations
- [ ] Pagination with max page size limits
- [ ] Connection pooler configured for serverless
- [ ] `@updatedAt` on models that need change tracking
- [ ] `@@map` for snake_case table names
- [ ] Transaction timeout increased if needed

### Code Review Checklist

- [ ] No N+1 queries (use `include` or `select` for relations)
- [ ] Using `tx` not `prisma` in interactive transactions
- [ ] Handling `null` from `findUnique`
- [ ] Named constants for limits and defaults
- [ ] Error handling for constraint violations
- [ ] No unbounded pagination
