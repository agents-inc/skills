# Prisma - Transaction Examples

> Atomic operations, nested writes, and interactive transactions. See [SKILL.md](../SKILL.md) for core concepts.

---

## Nested Writes (Implicit Transactions)

### Good Example - Create with Relations

```typescript
import { prisma } from "@/lib/db/client";

// All operations in a single atomic transaction
const user = await prisma.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
    role: "USER",
    profile: {
      create: { bio: "Software engineer" },
    },
    posts: {
      create: [
        { title: "First Post", content: "Hello world", published: true },
        { title: "Draft", content: "Work in progress" },
      ],
    },
  },
  include: {
    profile: true,
    posts: true,
  },
});
// If any part fails, ALL changes roll back
```

**Why good:** Implicit transaction wraps entire operation, no partial state possible, includes return created relations

### Good Example - Update with Nested Upsert

```typescript
// Update user and upsert profile atomically
const user = await prisma.user.update({
  where: { id: userId },
  data: {
    name: "Updated Name",
    profile: {
      upsert: {
        create: { bio: "New profile" },
        update: { bio: "Updated profile" },
      },
    },
  },
  include: { profile: true },
});
// Either both succeed or both fail
```

**Why good:** Upsert handles create-or-update, atomic with parent update

---

## Batch Transactions ($transaction array)

### Good Example - Multiple Independent Operations

```typescript
// Execute multiple queries in single transaction
const [users, posts, stats] = await prisma.$transaction([
  prisma.user.findMany({ where: { role: "ADMIN" } }),
  prisma.post.findMany({ where: { published: true } }),
  prisma.user.count(),
]);

// Consistent pagination (data and count at same point in time)
const DEFAULT_PAGE_SIZE = 20;

const [items, total] = await prisma.$transaction([
  prisma.post.findMany({
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
    orderBy: { createdAt: "desc" },
  }),
  prisma.post.count(),
]);

// Batch mutations
const [deletedDrafts, publishedCount] = await prisma.$transaction([
  prisma.post.deleteMany({
    where: { authorId: userId, published: false },
  }),
  prisma.post.updateMany({
    where: { authorId: userId, status: "PENDING" },
    data: { status: "PUBLISHED" },
  }),
]);
```

**Why good:** All queries see consistent database state, atomic batch mutations, returns typed array

---

## Interactive Transactions

### Good Example - Complex Business Logic

```typescript
const MINIMUM_BALANCE = 0;

interface TransferResult {
  sender: Account;
  recipient: Account;
  amount: number;
}

const transferFunds = async (
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<TransferResult> => {
  // CRITICAL: Use tx parameter, NOT prisma
  return await prisma.$transaction(async (tx) => {
    // 1. Decrement sender balance
    const sender = await tx.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });

    // 2. Validate business rule
    if (sender.balance < MINIMUM_BALANCE) {
      // Throwing rolls back the entire transaction
      throw new Error("Insufficient funds");
    }

    // 3. Increment recipient balance
    const recipient = await tx.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
    });

    // 4. Log the transfer
    await tx.transferLog.create({
      data: {
        fromAccountId,
        toAccountId,
        amount,
        timestamp: new Date(),
      },
    });

    return { sender, recipient, amount };
  });
};
```

**Why good:** tx parameter ensures all operations are in transaction, throwing rolls back, business logic validation inside transaction

### Bad Example - Using Wrong Client

```typescript
// WRONG - Using prisma instead of tx
await prisma.$transaction(async (tx) => {
  await prisma.post.create({ data: { title: "Post" } }); // WRONG: uses prisma
  await tx.user.update({ where: { id: "1" }, data: { name: "Updated" } });
});
// post.create is NOT in the transaction!
```

**Why bad:** Operations using `prisma` bypass transaction context, only `tx` operations will rollback on failure

---

## Transaction Options

### Good Example - Configuring Transaction Behavior

```typescript
const TRANSACTION_TIMEOUT_MS = 10000;
const MAX_WAIT_MS = 5000;
const ISOLATION_LEVEL = "Serializable";

const result = await prisma.$transaction(
  async (tx) => {
    // Long-running operations
    const users = await tx.user.findMany({ where: { role: "USER" } });

    for (const user of users) {
      await tx.notification.create({
        data: {
          userId: user.id,
          message: "System maintenance scheduled",
        },
      });
    }

    return { notified: users.length };
  },
  {
    maxWait: MAX_WAIT_MS, // Max time to wait for connection
    timeout: TRANSACTION_TIMEOUT_MS, // Max execution time
    isolationLevel: ISOLATION_LEVEL, // Strictest isolation
  }
);
```

**Why good:** Named constants for timeouts, isolationLevel for consistency requirements, maxWait prevents indefinite waiting

---

## Error Handling in Transactions

### Good Example - Typed Error Handling

```typescript
import { Prisma } from "@prisma/client";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";

const createUserSafely = async (email: string, name: string) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name },
      });

      await tx.profile.create({
        data: { userId: user.id },
      });

      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new Error("Email already registered");
      }
      if (error.code === RECORD_NOT_FOUND) {
        throw new Error("Record not found");
      }
    }
    throw error;
  }
};
```

**Why good:** Prisma error types for specific handling, named constants for error codes, rethrows unknown errors

---

## Optimistic Concurrency Control

### Good Example - Version-Based Updates

```typescript
// Schema:
// model Post {
//   id      String @id
//   title   String
//   version Int    @default(0)
// }

const updatePostOptimistic = async (
  postId: string,
  title: string,
  expectedVersion: number
) => {
  return await prisma.$transaction(async (tx) => {
    // Update only if version matches
    const result = await tx.post.updateMany({
      where: {
        id: postId,
        version: expectedVersion,
      },
      data: {
        title,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new Error("Concurrent modification detected");
    }

    return tx.post.findUnique({ where: { id: postId } });
  });
};
```

**Why good:** Version field prevents lost updates, updateMany doesn't throw on 0 matches, increment version atomically

---

## Quick Reference

| Transaction Type | Use When |
|-----------------|----------|
| Nested writes | Create/update with relations |
| `$transaction([...])` | Multiple independent operations |
| `$transaction(async (tx) => {...})` | Complex business logic with reads + writes |

| Option | Purpose | Default |
|--------|---------|---------|
| `maxWait` | Max wait for connection (ms) | 2000 |
| `timeout` | Max execution time (ms) | 5000 |
| `isolationLevel` | Transaction isolation | Database default |

| Isolation Level | Consistency | Performance |
|-----------------|-------------|-------------|
| `ReadUncommitted` | Lowest | Highest |
| `ReadCommitted` | Low | High |
| `RepeatableRead` | Medium | Medium |
| `Serializable` | Highest | Lowest |

| Critical Rule | Reason |
|---------------|--------|
| Use `tx` not `prisma` in interactive transactions | Operations outside tx bypass transaction |
| Throw to rollback | Any exception rolls back entire transaction |
| Keep transactions short | Long transactions lock resources |
