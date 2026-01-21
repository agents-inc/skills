# Prisma - Query Examples

> CRUD operations, filtering, and sorting. See [SKILL.md](../SKILL.md) for core concepts.

---

## Read Operations

### Good Example - Find Unique

```typescript
import { prisma } from "@/lib/db/client";

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

**Why good:** findUnique returns `T | null` forcing null handling, compound unique for multi-field keys, OrThrow variant for guaranteed existence

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

**Why good:** findFirst for single record with filters, orderBy ensures consistent results, returns null if none found

### Good Example - Find Many with Pagination

```typescript
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const getUsers = async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE }: PaginationParams) => {
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

**Why good:** Named constants for limits, $transaction ensures consistent count, Math.min caps page size, calculates pagination metadata

---

## Create Operations

### Good Example - Create with Nested Relations

```typescript
// Create single record
const user = await prisma.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
    role: "USER",
  },
});

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

// Create with nested relations (one-to-many)
const userWithPosts = await prisma.user.create({
  data: {
    email: "carol@example.com",
    name: "Carol",
    posts: {
      create: [
        { title: "First Post", published: true },
        { title: "Draft Post", published: false },
      ],
    },
  },
  include: { posts: true },
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
      connect: [
        { id: categoryId1 },
        { id: categoryId2 },
      ],
    },
  },
});
```

**Why good:** Nested create for new relations, connect for existing relations, include to return created relations

### Good Example - Create Many

```typescript
// Bulk create (returns count only)
const result = await prisma.user.createMany({
  data: [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
    { email: "user3@example.com", name: "User 3" },
  ],
  skipDuplicates: true, // Ignore unique constraint violations
});

console.log(`Created ${result.count} users`);
```

**Why good:** Efficient bulk insert, skipDuplicates handles conflicts gracefully, returns count

---

## Update Operations

### Good Example - Update with Nested Relations

```typescript
// Simple update
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: "Updated Name" },
});

// Update with nested relation
const updatedWithProfile = await prisma.user.update({
  where: { id: userId },
  data: {
    name: "Updated Name",
    profile: {
      update: { bio: "Updated bio" },
    },
  },
  include: { profile: true },
});

// Upsert nested relation (create if doesn't exist)
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

// Update many-to-many relations
const postWithCategories = await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      set: [{ id: newCategoryId }], // Replace all
      // Or: connect, disconnect, connectOrCreate
    },
  },
});
```

**Why good:** Nested update for relations, upsert for create-or-update, set for replacing many-to-many

### Good Example - Update Many

```typescript
// Bulk update
const result = await prisma.post.updateMany({
  where: {
    authorId: userId,
    published: false,
  },
  data: {
    published: true,
  },
});

console.log(`Published ${result.count} posts`);
```

**Why good:** Efficient bulk update, returns count of affected rows

---

## Upsert Operations

### Good Example - Atomic Create or Update

```typescript
// Upsert single record
const user = await prisma.user.upsert({
  where: { email: "alice@example.com" },
  create: {
    email: "alice@example.com",
    name: "Alice",
    role: "USER",
  },
  update: {
    name: "Alice (Updated)",
  },
});

// Upsert with relation handling
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
    role: "MEMBER", // Reset role on re-join
    joinedAt: new Date(),
  },
});
```

**Why good:** Atomic operation avoids race conditions, handles unique constraint gracefully, compound unique in where clause

---

## Delete Operations

### Good Example - Safe Deletion

```typescript
// Delete single record
const deleted = await prisma.user.delete({
  where: { id: userId },
});

// Delete many
const result = await prisma.post.deleteMany({
  where: {
    authorId: userId,
    published: false,
  },
});

console.log(`Deleted ${result.count} draft posts`);

// Soft delete pattern (using update)
const softDeleted = await prisma.user.update({
  where: { id: userId },
  data: {
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.local`, // Free up unique constraint
  },
});
```

**Why good:** delete throws if not found (use deleteMany for silent), soft delete preserves data, frees unique constraints on soft delete

---

## Quick Reference

| Operation | Returns | Throws if Not Found |
|-----------|---------|-------------------|
| `findUnique` | `T \| null` | No |
| `findUniqueOrThrow` | `T` | Yes |
| `findFirst` | `T \| null` | No |
| `findFirstOrThrow` | `T` | Yes |
| `findMany` | `T[]` | No (empty array) |
| `create` | `T` | N/A |
| `createMany` | `{ count }` | N/A |
| `update` | `T` | Yes |
| `updateMany` | `{ count }` | No |
| `upsert` | `T` | N/A |
| `delete` | `T` | Yes |
| `deleteMany` | `{ count }` | No |
