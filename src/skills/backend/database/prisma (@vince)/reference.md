# Prisma Reference

Decision frameworks, anti-patterns, red flags, and performance optimization for Prisma ORM.

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
└─ Multiple with return values → createManyAndReturn() (PostgreSQL/SQLite)

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
  }))
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

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Creating PrismaClient on every import** - Exhausts database connections during hot reload, causes "10 Prisma Clients running" warning
- ❌ **Using `prisma` instead of `tx` in interactive transactions** - Bypasses transaction context, operations won't rollback together
- ❌ **N+1 queries in loops** - Multiple queries for related data instead of using `include`, extremely slow at scale
- ❌ **Missing `@relation` attributes** - Ambiguous foreign keys cause migration errors and unclear schema

**Medium Priority Issues:**

- ⚠️ **No indexes on frequently filtered columns** - Slow queries as data grows
- ⚠️ **Offset pagination on large tables** - Performance degrades linearly with offset
- ⚠️ **Missing `onDelete` cascade** - Orphaned records when parent deleted
- ⚠️ **No `@@map` for table names** - PascalCase tables in database (convention is snake_case)
- ⚠️ **Fetching all fields with `include`** - Larger payloads than needed, use `select`

**Common Mistakes:**

- Forgetting `skipDuplicates` on `createMany` - Fails on unique constraint violations
- Not handling `null` from `findUnique` - Runtime errors when record doesn't exist
- Using `delete` without cascade - Foreign key violations
- Hardcoding pagination limits - No protection against large page sizes
- Missing `@updatedAt` on models - Can't track when records changed
- Using `findFirst` when `findUnique` is appropriate - Less predictable, no guarantee of uniqueness

**Gotchas & Edge Cases:**

- `createMany` doesn't return created records (use `createManyAndReturn` on PostgreSQL/SQLite)
- `updateMany` and `deleteMany` don't trigger `@updatedAt` hooks
- `findFirst` with `orderBy` different from `findUnique` behavior
- Prisma uses implicit many-to-many tables - you can't add extra fields without explicit join table
- `@db.Uuid` requires valid UUID format - will error on invalid strings
- Enum changes require migration - adding/removing values
- `Json` fields are typed as `JsonValue` - need to cast or use Zod for validation
- `Decimal` fields return `Prisma.Decimal` type - convert with `.toNumber()` for calculations
- Transactions have default 5s timeout - increase with `timeout` option for slow operations
- Interactive transactions hold connections - keep them short

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Creating PrismaClient on Every Import

```typescript
// ❌ ANTI-PATTERN: New client every import
// lib/db.ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

**Why it's wrong:** During development hot reloading, each reload creates a new client instance with its own connection pool. After 10+ reloads, you'll exhaust database connections.

**What to do instead:** Use the singleton pattern with `globalThis`.

---

### N+1 Queries for Relations

```typescript
// ❌ ANTI-PATTERN: Fetching relations in a loop
const users = await prisma.user.findMany();

for (const user of users) {
  // N additional queries!
  user.posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
}
```

**Why it's wrong:** If you have 100 users, this executes 101 queries (1 for users + 100 for posts). This doesn't scale.

**What to do instead:** Use `include` to fetch relations in a single query.

---

### Using `prisma` Instead of `tx` in Transactions

```typescript
// ❌ ANTI-PATTERN: Using global prisma in transaction
await prisma.$transaction(async (tx) => {
  const user = await prisma.user.create({ data: { name: "Alice" } }); // Using prisma!
  await tx.profile.create({ data: { userId: user.id, bio: "..." } });
});
```

**Why it's wrong:** The `prisma.user.create` runs outside the transaction context. If `tx.profile.create` fails, the user is still created, leaving inconsistent data.

**What to do instead:** Always use the `tx` parameter for all operations within the transaction.

---

### Unbounded Pagination

```typescript
// ❌ ANTI-PATTERN: No limit on page size
const getUsers = async (page: number, pageSize: number) => {
  return prisma.user.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize, // Could be 1,000,000
  });
};
```

**Why it's wrong:** Malicious or buggy clients could request huge page sizes, overwhelming your database and server.

**What to do instead:** Always clamp page size to a maximum value.

---

### Missing Error Handling on findUnique

```typescript
// ❌ ANTI-PATTERN: Assuming record exists
const user = await prisma.user.findUnique({ where: { id: userId } });
console.log(user.name); // TypeError if user is null!
```

**Why it's wrong:** `findUnique` returns `null` when no record matches. Accessing properties on `null` crashes your app.

**What to do instead:** Always check for `null` or use `findUniqueOrThrow`.

---

### Implicit Many-to-Many with Extra Fields

```prisma
// ❌ ANTI-PATTERN: Trying to add fields to implicit join
model Post {
  id         String     @id
  categories Category[] // Implicit many-to-many
}

model Category {
  id    String @id
  posts Post[]
}

// Can't add "assignedAt" or "weight" to the relationship!
```

**Why it's wrong:** Prisma's implicit many-to-many creates a hidden join table you can't customize.

**What to do instead:** Create an explicit join model when you need extra fields on the relationship.

```prisma
// CORRECT: Explicit join model
model PostCategory {
  post       Post     @relation(fields: [postId], references: [id])
  postId     String
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId String
  assignedAt DateTime @default(now())
  weight     Int      @default(0)

  @@id([postId, categoryId])
}
```

</anti_patterns>

---

## Quick Reference Tables

### Common Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `{ email: { equals: "a@b.com" } }` |
| `not` | Not equal | `{ status: { not: "DELETED" } }` |
| `in` | In array | `{ role: { in: ["USER", "ADMIN"] } }` |
| `notIn` | Not in array | `{ id: { notIn: excludedIds } }` |
| `lt`, `lte`, `gt`, `gte` | Comparisons | `{ age: { gte: 18 } }` |
| `contains` | Substring | `{ title: { contains: "prisma" } }` |
| `startsWith` | Prefix | `{ email: { startsWith: "admin" } }` |
| `endsWith` | Suffix | `{ email: { endsWith: "@company.com" } }` |
| `mode` | Case sensitivity | `{ name: { contains: "john", mode: "insensitive" } }` |

### Relation Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `some` | At least one matches | `{ posts: { some: { published: true } } }` |
| `every` | All match | `{ posts: { every: { published: true } } }` |
| `none` | None match | `{ posts: { none: { published: true } } }` |
| `is` | Related record matches | `{ author: { is: { role: "ADMIN" } } }` |
| `isNot` | Related record doesn't match | `{ author: { isNot: { role: "BANNED" } } }` |

### Relation Operations in Writes

| Operation | Description | Use Case |
|-----------|-------------|----------|
| `create` | Create new related record | New user with new profile |
| `connect` | Link existing record | Assign existing category to post |
| `connectOrCreate` | Link or create | Ensure tag exists and link |
| `disconnect` | Unlink record | Remove category from post |
| `set` | Replace all connections | Update post's categories |
| `update` | Update related record | Modify user's profile |
| `upsert` | Update or create related | Ensure profile exists and update |
| `delete` | Delete related record | Remove user's profile |

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
