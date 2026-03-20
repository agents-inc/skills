# TypeORM - Transaction Examples

> EntityManager callback, QueryRunner manual control, and isolation levels. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand DataSource and repository patterns from [core.md](core.md).

---

## EntityManager Callback (Simple Approach)

### Good Example - Automatic Commit/Rollback

```typescript
// All operations in callback succeed or fail together
await AppDataSource.transaction(async (manager) => {
  const user = manager.create(User, {
    email: "alice@example.com",
    name: "Alice",
  });
  await manager.save(user);

  const post = manager.create(Post, {
    title: "First Post",
    authorId: user.id,
    published: true,
  });
  await manager.save(post);

  // If this throws, both user and post are rolled back
  await manager.insert(AuditLog, {
    action: "user_created",
    entityId: user.id,
  });
});
```

**Why good:** Auto-commits on success, auto-rollbacks on any throw, no manual cleanup needed, concise

### Bad Example - Using Global Manager in Transaction

```typescript
// BAD: Global manager bypasses transaction!
await AppDataSource.transaction(async (manager) => {
  await manager.save(User, userData); // In transaction

  // WRONG: This runs outside the transaction
  await AppDataSource.manager.save(Post, postData);
  // If manager.save(User) above fails, this Post is STILL saved
});
```

**Why bad:** `AppDataSource.manager` is the global entity manager - it doesn't participate in the transaction. Only the callback's `manager` parameter is transactional.

---

## EntityManager with Isolation Level

### Good Example - Serializable Transaction

```typescript
// Specify isolation level as first parameter
await AppDataSource.manager.transaction("SERIALIZABLE", async (manager) => {
  const account = await manager.findOneBy(Account, { id: fromAccountId });

  if (!account || account.balance < amount) {
    throw new Error("Insufficient funds");
  }

  await manager.update(
    Account,
    { id: fromAccountId },
    {
      balance: () => `balance - ${amount}`, // Raw SQL for atomic decrement
    },
  );

  await manager.update(
    Account,
    { id: toAccountId },
    {
      balance: () => `balance + ${amount}`,
    },
  );

  await manager.insert(Transfer, {
    fromAccountId,
    toAccountId,
    amount,
    timestamp: new Date(),
  });
});
```

**Why good:** `SERIALIZABLE` prevents concurrent modification of same accounts, atomic balance operations via raw SQL expression, business logic validated inside transaction

---

## QueryRunner (Full Control)

### Good Example - Manual Transaction Lifecycle

```typescript
const MINIMUM_BALANCE = 0;

const transferFunds = async (fromId: string, toId: string, amount: number) => {
  const queryRunner = AppDataSource.createQueryRunner();

  // Establish real database connection
  await queryRunner.connect();

  // Start transaction
  await queryRunner.startTransaction();

  try {
    // All operations use queryRunner.manager
    const sender = await queryRunner.manager.findOneBy(Account, { id: fromId });
    if (!sender || sender.balance - amount < MINIMUM_BALANCE) {
      throw new Error("Insufficient funds");
    }

    await queryRunner.manager.update(
      Account,
      { id: fromId },
      {
        balance: () => `balance - ${amount}`,
      },
    );

    await queryRunner.manager.update(
      Account,
      { id: toId },
      {
        balance: () => `balance + ${amount}`,
      },
    );

    await queryRunner.manager.insert(Transfer, {
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
    });

    // Explicitly commit
    await queryRunner.commitTransaction();

    return { success: true };
  } catch (error) {
    // Explicitly rollback
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    // ALWAYS release - returns connection to pool
    await queryRunner.release();
  }
};
```

**Why good:** Explicit commit/rollback control, `finally` block guarantees `release()`, all operations use `queryRunner.manager`, named constant for business rule

### Bad Example - Missing release()

```typescript
// BAD: Connection leaked if exception occurs between connect and try block
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  await queryRunner.manager.save(User, userData);
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
}
// Missing queryRunner.release() - connection never returned to pool!
```

**Why bad:** Without `release()` in `finally`, the connection is permanently leaked. After enough transactions, the pool is exhausted and all queries block indefinitely.

---

## QueryRunner with Raw Queries

### Good Example - Using QueryRunner for Raw SQL in Transaction

```typescript
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Mix ORM and raw queries in same transaction
  await queryRunner.manager.save(User, userData);

  // Raw query on same transactional connection
  await queryRunner.query(
    `INSERT INTO "audit_logs" ("action", "entity_id", "created_at")
     VALUES ($1, $2, NOW())`,
    ["user_created", userData.id],
  );

  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

**Why good:** `queryRunner.query()` runs on the same transactional connection, can mix ORM operations with raw SQL, parameterized query prevents injection

---

## Transaction with Repository

### Good Example - Getting Transactional Repository

```typescript
await AppDataSource.transaction(async (manager) => {
  // Get repository scoped to this transaction
  const userRepo = manager.getRepository(User);
  const postRepo = manager.getRepository(Post);

  const user = await userRepo.findOneBy({ id: userId });
  if (!user) throw new Error("User not found");

  // These operations all use the transactional connection
  await userRepo.update({ id: userId }, { role: "admin" });
  await postRepo.update({ authorId: userId }, { published: true });
});
```

**Why good:** `manager.getRepository()` returns a repository scoped to the transaction - all operations through it participate in the transaction

### Bad Example - Using AppDataSource.getRepository in Transaction

```typescript
// BAD: Global repository, not transactional
await AppDataSource.transaction(async (manager) => {
  const userRepo = AppDataSource.getRepository(User); // WRONG!
  await userRepo.save(userData); // Runs outside transaction
});
```

**Why bad:** `AppDataSource.getRepository()` returns the global repository which operates outside the transaction context

---

## Error Handling in Transactions

### Good Example - Typed Error Handling

```typescript
import { EntityNotFoundError, QueryFailedError } from "typeorm";

const UNIQUE_VIOLATION_CODE = "23505"; // PostgreSQL
const FK_VIOLATION_CODE = "23503"; // PostgreSQL

const createUserWithProfile = async (email: string, name: string) => {
  try {
    return await AppDataSource.transaction(async (manager) => {
      const user = await manager.save(User, { email, name });
      await manager.save(Profile, { userId: user.id, bio: "" });
      return user;
    });
  } catch (error) {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };
      if (driverError.code === UNIQUE_VIOLATION_CODE) {
        throw new Error("Email already registered");
      }
      if (driverError.code === FK_VIOLATION_CODE) {
        throw new Error("Referenced record not found");
      }
    }
    if (error instanceof EntityNotFoundError) {
      throw new Error("Required entity not found");
    }
    throw error;
  }
};
```

**Why good:** TypeORM error types for specific handling, PostgreSQL error codes as named constants, rethrows unknown errors

---

## Quick Reference

| Approach                 | Auto Commit/Rollback | Isolation Level                        | Raw SQL Access            |
| ------------------------ | -------------------- | -------------------------------------- | ------------------------- |
| `DataSource.transaction` | Yes                  | Via first param                        | Via `manager.query()`     |
| `manager.transaction`    | Yes                  | Via first param                        | Via `manager.query()`     |
| `QueryRunner`            | No (manual)          | Via `startTransaction("SERIALIZABLE")` | Via `queryRunner.query()` |

| Isolation Level    | Dirty Read | Non-Repeatable Read | Phantom Read | Use When                                |
| ------------------ | ---------- | ------------------- | ------------ | --------------------------------------- |
| `READ UNCOMMITTED` | Yes        | Yes                 | Yes          | Never (debugging only)                  |
| `READ COMMITTED`   | No         | Yes                 | Yes          | Default for most operations             |
| `REPEATABLE READ`  | No         | No                  | Yes          | Reports, consistent reads               |
| `SERIALIZABLE`     | No         | No                  | No           | Financial transactions, critical writes |

| Critical Rule                                                      | Reason                              |
| ------------------------------------------------------------------ | ----------------------------------- |
| Use `manager` param, not `AppDataSource.manager`                   | Global manager bypasses transaction |
| Use `manager.getRepository()`, not `AppDataSource.getRepository()` | Same reason                         |
| `queryRunner.release()` in `finally`                               | Prevents connection pool exhaustion |
| Keep transactions short                                            | Long transactions lock rows/tables  |
| Throw to rollback in callback transactions                         | Any exception triggers rollback     |
