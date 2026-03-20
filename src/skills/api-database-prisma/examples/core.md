# Prisma - Core Examples

> Singleton setup, CRUD operations, filtering, and pagination. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: None - these are the foundational patterns.

---

## PrismaClient Singleton

### Good Example - Development-Safe Client

```typescript
// lib/db/client.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why good:** `globalThis` persists across hot reloads preventing "10 Prisma Clients running" warning, conditional logging avoids production noise, factory function allows configuration changes

### Bad Example - New Client Every Import

```typescript
// BAD: Creates new instance on every hot reload
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

**Why bad:** Each hot reload creates a new PrismaClient with its own connection pool, exhausts database connections (PostgreSQL default is 100)

---

## Serverless Connection Management

### Good Example - Connection Pooler

```typescript
// lib/db/serverless-client.ts
import { PrismaClient } from "@prisma/client";

// Serverless environments create new instances per invocation
// Use connection pooler (PgBouncer, Prisma Accelerate) for production
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_WITH_POOLER,
    },
  },
});
```

**Why good:** Connection pooler manages connections across serverless invocations, separate URL keeps local development simple

### Good Example - Graceful Shutdown

```typescript
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
```

**Why good:** Prevents connection leaks on process termination

---

## Read Operations

### Good Example - Find Unique

```typescript
// Find by unique field (id, email, etc.)
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Find by compound unique (multiple fields)
const membership = await prisma.membership.findUnique({
  where: {
    userId_organizationId: {
      userId: "user-123",
      organizationId: "org-456",
    },
  },
});

// findUniqueOrThrow - throws if not found
try {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });
  // user is guaranteed to exist
} catch (error) {
  // Handle Prisma.PrismaClientKnownRequestError with code P2025
}
```

**Why good:** `findUnique` returns `T | null` forcing null handling, compound unique for multi-field keys, `OrThrow` variant for guaranteed existence

### Good Example - Find First

```typescript
// Find first matching record
const latestAdmin = await prisma.user.findFirst({
  where: { role: "ADMIN" },
  orderBy: { createdAt: "desc" },
});

// Find first with multiple conditions
const activeSubscription = await prisma.subscription.findFirst({
  where: {
    userId,
    status: "ACTIVE",
    expiresAt: { gt: new Date() },
  },
});
```

**Why good:** `findFirst` for single record with filters, `orderBy` ensures deterministic results

---

## Filtering

### Good Example - Logical Operators

```typescript
// OR conditions
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: { endsWith: "@gmail.com" } },
      { email: { endsWith: "@outlook.com" } },
    ],
  },
});

// Combined AND, OR, NOT
const posts = await prisma.post.findMany({
  where: {
    AND: [
      { published: true },
      {
        OR: [
          { title: { contains: "prisma", mode: "insensitive" } },
          { content: { contains: "prisma", mode: "insensitive" } },
        ],
      },
    ],
    NOT: { authorId: excludedUserId },
  },
});
```

**Why good:** `mode: "insensitive"` for case-insensitive search, composable logical operators, type inference catches invalid field names

### Good Example - Relation Filters

```typescript
// Find users with at least one published post
const usersWithPublishedPosts = await prisma.user.findMany({
  where: {
    posts: {
      some: { published: true },
    },
  },
});

// Find users where ALL posts are published
const usersWithAllPublished = await prisma.user.findMany({
  where: {
    posts: {
      every: { published: true },
    },
  },
});
```

**Why good:** Relation filters (`some`, `every`, `none`) eliminate manual joins, all at database level

---

## Pagination

### Good Example - Offset Pagination

```typescript
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const getUsers = async ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginationParams) => {
  const take = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      page,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};
```

**Why good:** Named constants for limits, `$transaction` ensures consistent count, `Math.min` caps page size

**When to use:** Small datasets, need random page access, traditional page navigation UI

### Good Example - Cursor Pagination

```typescript
const DEFAULT_PAGE_SIZE = 20;

interface CursorPaginationParams {
  cursor?: string;
  take?: number;
}

const getCursorPaginatedPosts = async ({
  cursor,
  take = DEFAULT_PAGE_SIZE,
}: CursorPaginationParams) => {
  const posts = await prisma.post.findMany({
    take: take + 1, // Fetch one extra to detect next page
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
    orderBy: { id: "asc" },
    where: { published: true },
  });

  const hasNextPage = posts.length > take;
  const data = hasNextPage ? posts.slice(0, -1) : posts;

  return {
    data,
    nextCursor: hasNextPage ? data[data.length - 1]?.id : undefined,
  };
};
```

**Why good:** Scales to millions of rows, `take + 1` pattern efficiently detects next page

**When to use:** Large datasets, infinite scroll UI, real-time data where offset would shift

---

## Create Operations

### Good Example - Create with Nested Relations

```typescript
// Create with nested relation (one-to-one)
const userWithProfile = await prisma.user.create({
  data: {
    email: "bob@example.com",
    name: "Bob",
    profile: {
      create: { bio: "Software engineer" },
    },
  },
  include: { profile: true },
});

// Create with connect (existing relation)
const post = await prisma.post.create({
  data: {
    title: "New Post",
    content: "Content here",
    author: {
      connect: { id: existingUserId },
    },
    categories: {
      connect: [{ id: categoryId1 }, { id: categoryId2 }],
    },
  },
});
```

**Why good:** Nested `create` for new relations, `connect` for existing relations, `include` to return created relations

### Good Example - Create Many

```typescript
// Bulk create (returns count only)
const result = await prisma.user.createMany({
  data: [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
  ],
  skipDuplicates: true, // Ignore unique constraint violations
});
```

**Why good:** Efficient bulk insert, `skipDuplicates` handles conflicts gracefully

---

## Update Operations

### Good Example - Update with Nested Relations

```typescript
// Update with nested relation upsert
const userWithProfile = await prisma.user.update({
  where: { id: userId },
  data: {
    profile: {
      upsert: {
        create: { bio: "New bio" },
        update: { bio: "Updated bio" },
      },
    },
  },
  include: { profile: true },
});

// Replace all many-to-many relations
const postWithCategories = await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      set: [{ id: newCategoryId }], // Removes all existing, adds new
    },
  },
});
```

**Why good:** Nested `upsert` for create-or-update, `set` for replacing many-to-many

---

## Delete Operations

### Good Example - Safe Deletion

```typescript
// Delete many (silent if none match)
const result = await prisma.post.deleteMany({
  where: {
    authorId: userId,
    published: false,
  },
});

// Soft delete pattern
const softDeleted = await prisma.user.update({
  where: { id: userId },
  data: {
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.local`, // Free up unique constraint
  },
});
```

**Why good:** `deleteMany` is silent when no records match, soft delete preserves data and frees unique constraints

---

## Upsert Operations

### Good Example - Atomic Create or Update

```typescript
// Upsert with compound unique
const membership = await prisma.membership.upsert({
  where: {
    userId_organizationId: {
      userId,
      organizationId,
    },
  },
  create: {
    userId,
    organizationId,
    role: "MEMBER",
    joinedAt: new Date(),
  },
  update: {
    role: "MEMBER",
    joinedAt: new Date(),
  },
});
```

**Why good:** Atomic operation avoids race conditions, compound unique in where clause

---

## Type Reuse

### Good Example - Using Prisma Generated Types

```typescript
import type { Prisma } from "@prisma/client";

// Input types for creating/updating
type CreateUserInput = Prisma.UserCreateInput;

// Payload types with relations
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true };
}>;

// Select-based types
type UserSummary = Prisma.UserGetPayload<{
  select: { id: true; name: true; email: true };
}>;
```

**Why good:** Types stay in sync with schema, no manual type maintenance

---

## Quick Reference

| Operation           | Returns     | Throws if Not Found |
| ------------------- | ----------- | ------------------- |
| `findUnique`        | `T \| null` | No                  |
| `findUniqueOrThrow` | `T`         | Yes                 |
| `findFirst`         | `T \| null` | No                  |
| `findFirstOrThrow`  | `T`         | Yes                 |
| `findMany`          | `T[]`       | No (empty array)    |
| `create`            | `T`         | N/A                 |
| `createMany`        | `{ count }` | N/A                 |
| `update`            | `T`         | Yes                 |
| `updateMany`        | `{ count }` | No                  |
| `upsert`            | `T`         | N/A                 |
| `delete`            | `T`         | Yes                 |
| `deleteMany`        | `{ count }` | No                  |

> See [reference.md](../reference.md) for filter operators, relation filter operators, and relation write operations.
