# Sequelize - Transaction Examples

> Managed and unmanaged transactions, CLS, isolation levels, and error handling. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand model definitions and CRUD from [core.md](core.md) first.

---

## Managed Transactions (Recommended)

### Good Example - Auto Commit/Rollback

```typescript
import { sequelize } from "./connection";
import { User } from "./models/user";
import { Profile } from "./models/profile";

// Managed: auto-commits on success, auto-rolls back on throw
const user = await sequelize.transaction(async (t) => {
  const newUser = await User.create(
    { email: "alice@example.com", name: "Alice" },
    { transaction: t },
  );

  await Profile.create(
    { userId: newUser.id, bio: "Developer" },
    { transaction: t },
  );

  return newUser; // Return value is passed through
});
// user is the created User instance
```

**Why good:** Auto-commit/rollback, clean error propagation, return value flows through

### Bad Example - Missing transaction Pass-Through

```typescript
// BAD: Forgetting { transaction: t }
await sequelize.transaction(async (t) => {
  // This runs OUTSIDE the transaction!
  const user = await User.create({ email: "a@b.com" });

  // This is inside the transaction
  await Profile.create({ userId: user.id }, { transaction: t });

  // If this throws, Profile rolls back but User persists!
  throw new Error("Something failed");
});
```

**Why bad:** `User.create` without `{ transaction: t }` runs on a separate connection outside the transaction, won't roll back

---

## Unmanaged Transactions

### Good Example - Manual Commit/Rollback

```typescript
// Unmanaged: you control commit/rollback
const t = await sequelize.transaction();

try {
  const user = await User.create(
    { email: "bob@example.com", name: "Bob" },
    { transaction: t },
  );

  await Profile.create(
    { userId: user.id, bio: "Engineer" },
    { transaction: t },
  );

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

**Why good:** Full control over commit timing, explicit error handling with rollback

**When to use:** When you need to commit/rollback based on external conditions (not just thrown errors), or when integrating with non-Sequelize systems.

### Bad Example - Unmanaged Without Rollback

```typescript
// BAD: No rollback on error
const t = await sequelize.transaction();
const user = await User.create({ email: "a@b.com" }, { transaction: t });
await Profile.create({ userId: user.id }, { transaction: t });
await t.commit();
// If Profile.create throws, transaction is left open!
// Connection is leaked, and DB may deadlock
```

**Why bad:** No try/catch means no rollback on error, transaction stays open holding a connection from the pool

---

## CLS (Continuation Local Storage) - Auto Transaction Passing

### Good Example - CLS in v6

```typescript
import cls from "cls-hooked";
import { Sequelize } from "sequelize";

const namespace = cls.createNamespace("sequelize-transaction");
Sequelize.useCLS(namespace);

// Now all queries inside transaction() automatically use the transaction
// No need to pass { transaction: t }
const user = await sequelize.transaction(async () => {
  // These automatically use the transaction from CLS context
  const newUser = await User.create({ email: "a@b.com", name: "Alice" });
  await Profile.create({ userId: newUser.id, bio: "Dev" });
  return newUser;
});
```

**Why good:** Eliminates `{ transaction: t }` boilerplate, impossible to forget passing transaction, all queries in callback scope automatically join the transaction

**Gotcha (v6):** Requires `cls-hooked` package. Also, CLS only works for queries within the same async context --- if you spawn detached async work (fire-and-forget), those queries won't see the transaction.

### v7 Difference

```typescript
// v7: CLS is enabled by default using Node's AsyncLocalStorage
// No setup needed --- all queries inside transaction() auto-use the transaction
const user = await sequelize.transaction(async () => {
  const newUser = await User.create({ email: "a@b.com", name: "Alice" });
  await Profile.create({ userId: newUser.id, bio: "Dev" });
  return newUser;
});

// v7: Unmanaged transactions use startUnmanagedTransaction()
const t = await sequelize.startUnmanagedTransaction();
```

---

## Isolation Levels

### Good Example - Configuring Isolation

```typescript
import { Transaction } from "sequelize";

const MINIMUM_BALANCE = 0;

const transferFunds = async (fromId: number, toId: number, amount: number) => {
  return await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const sender = await Account.findByPk(fromId, {
        transaction: t,
        lock: t.LOCK.UPDATE, // Row-level lock
      });

      if (!sender || sender.balance - amount < MINIMUM_BALANCE) {
        throw new Error("Insufficient funds");
      }

      await sender.decrement("balance", { by: amount, transaction: t });

      const recipient = await Account.findByPk(toId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!recipient) throw new Error("Recipient not found");

      await recipient.increment("balance", { by: amount, transaction: t });

      return { sender, recipient, amount };
    },
  );
};
```

**Why good:** `SERIALIZABLE` for financial operations, row-level locking prevents concurrent modification, business logic validation inside transaction

### Isolation Level Reference

| Level              | Dirty Read | Non-Repeatable Read | Phantom Read | Use When                   |
| ------------------ | ---------- | ------------------- | ------------ | -------------------------- |
| `READ_UNCOMMITTED` | Yes        | Yes                 | Yes          | Rarely --- analytics only  |
| `READ_COMMITTED`   | No         | Yes                 | Yes          | Default for most databases |
| `REPEATABLE_READ`  | No         | No                  | Yes          | MySQL default              |
| `SERIALIZABLE`     | No         | No                  | No           | Financial operations       |

---

## Transaction Error Handling

### Good Example - Catching Specific Errors

```typescript
import {
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ValidationError,
  TimeoutError,
} from "sequelize";

const createUserWithProfile = async (email: string, name: string) => {
  try {
    return await sequelize.transaction(async (t) => {
      const user = await User.create({ email, name }, { transaction: t });

      await Profile.create({ userId: user.id }, { transaction: t });

      return user;
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new Error("Email already registered");
    }
    if (error instanceof ForeignKeyConstraintError) {
      throw new Error("Referenced record does not exist");
    }
    if (error instanceof ValidationError) {
      const messages = error.errors.map((e) => e.message).join(", ");
      throw new Error(`Validation failed: ${messages}`);
    }
    if (error instanceof TimeoutError) {
      throw new Error("Transaction timed out --- try again");
    }
    throw error; // Rethrow unknown errors
  }
};
```

**Why good:** Specific Sequelize error types for clean error mapping, validation messages extracted, unknown errors rethrown

---

## afterCommit Hook

### Good Example - Post-Transaction Side Effects

```typescript
await sequelize.transaction(async (t) => {
  const order = await Order.create(
    { userId: user.id, total: amount },
    { transaction: t },
  );

  await OrderItem.bulkCreate(
    items.map((item) => ({ orderId: order.id, ...item })),
    { transaction: t },
  );

  // Runs ONLY after successful commit
  t.afterCommit(async () => {
    // Safe to send notifications, update caches, etc.
    await sendOrderConfirmation(order.id);
  });

  return order;
});
```

**Why good:** Side effects only fire after successful commit, never on rollback

**Gotcha:** `afterCommit` does NOT fire if the transaction rolls back. Don't use it for cleanup that must always run --- use `finally` for that.

---

## Optimistic Concurrency Control

### Good Example - Version-Based Updates

```typescript
// Assuming: Post model has a `version` INTEGER column

const updatePostOptimistic = async (
  postId: number,
  title: string,
  expectedVersion: number,
) => {
  return await sequelize.transaction(async (t) => {
    const [affectedCount] = await Post.update(
      { title, version: expectedVersion + 1 },
      {
        where: { id: postId, version: expectedVersion },
        transaction: t,
      },
    );

    if (affectedCount === 0) {
      throw new Error("Concurrent modification detected --- retry");
    }

    return Post.findByPk(postId, { transaction: t });
  });
};
```

**Why good:** Version field prevents lost updates, `affectedCount === 0` detects concurrent modification, atomic version increment

---

## Quick Reference

| Transaction Type | Use When                  | Boilerplate                               |
| ---------------- | ------------------------- | ----------------------------------------- |
| Managed          | Default choice            | Low --- auto commit/rollback              |
| Unmanaged        | Need manual commit timing | High --- try/catch/rollback               |
| CLS-enabled      | Large codebases           | Lowest --- no `{ transaction: t }` needed |

| Option           | Purpose                                         | Default          |
| ---------------- | ----------------------------------------------- | ---------------- |
| `isolationLevel` | Transaction isolation                           | Database default |
| `type`           | `DEFERRED` / `IMMEDIATE` / `EXCLUSIVE` (SQLite) | Database default |
| `lock`           | Row-level locking                               | None             |
| `lock.of`        | Lock specific table in JOIN                     | N/A              |

| Error Type                  | When It Happens                  |
| --------------------------- | -------------------------------- |
| `UniqueConstraintError`     | Duplicate value on unique column |
| `ForeignKeyConstraintError` | Referenced record missing        |
| `ValidationError`           | Model validation failed          |
| `TimeoutError`              | Transaction or query timed out   |
| `DatabaseError`             | Generic database-level error     |
| `ConnectionError`           | Cannot connect to database       |
