# Mongoose - Transactions & Advanced Examples

> Sessions, withTransaction, transactionAsyncLocalStorage, connection management, cursor pagination, and indexes. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand schema definition and CRUD from [core.md](core.md).

**Middleware:** See [middleware.md](middleware.md). **Population:** See [population.md](population.md).

---

## Pattern 1: Transactions with withTransaction()

### Good Example -- Transfer with Session

```typescript
import mongoose from "mongoose";

async function transferFunds(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
): Promise<void> {
  const session = await mongoose.startSession();

  try {
    // withTransaction handles commit, abort, and retry automatically
    await session.withTransaction(async () => {
      // Debit source account (atomic check + update)
      const source = await Account.findOneAndUpdate(
        { _id: fromAccountId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true, session }, // { session } on EVERY operation
      );

      if (!source) {
        throw new Error("Insufficient funds or account not found");
      }

      // Credit destination account
      const destination = await Account.findOneAndUpdate(
        { _id: toAccountId },
        { $inc: { balance: amount } },
        { new: true, session },
      );

      if (!destination) {
        throw new Error("Destination account not found");
      }

      // Record the transfer -- array syntax for create() with session
      await Transfer.create(
        [{ fromAccountId, toAccountId, amount, status: "completed" }],
        { session },
      );
    });
  } finally {
    await session.endSession(); // Always clean up
  }
}

export { transferFunds };
```

**Why good:** `withTransaction()` handles commit/abort/retry automatically, `{ session }` passed to every operation, balance check with `$gte` prevents overdraft atomically, `finally` ensures session cleanup, `create()` uses array syntax for session support

### Bad Example -- Missing Session on Some Operations

```typescript
// BAD: Not all operations have { session }
const session = await mongoose.startSession();
session.startTransaction();

await Account.findOneAndUpdate(
  { _id: fromId },
  { $inc: { balance: -amount } },
  // Missing { session } -- runs OUTSIDE the transaction!
);

await Account.findOneAndUpdate(
  { _id: toId },
  { $inc: { balance: amount } },
  { session }, // Only this one is in the transaction
);

await session.commitTransaction();
```

**Why bad:** First update runs outside the transaction and cannot be rolled back, inconsistent state if second update fails, no `endSession()` in finally block

### Bad Example -- Parallel Operations in Transaction

```typescript
// BAD: MongoDB does not support parallel operations in a single session
const session = await mongoose.startSession();
await session.withTransaction(async () => {
  await Promise.all([
    Account.findOneAndUpdate(
      { _id: fromId },
      { $inc: { balance: -100 } },
      { session },
    ),
    Account.findOneAndUpdate(
      { _id: toId },
      { $inc: { balance: 100 } },
      { session },
    ),
  ]);
  // Error: "Cannot run operation with session that has ended"
});
```

**Why bad:** MongoDB does not support parallel operations within a single transaction session. Operations must be sequential within a transaction.

---

## Pattern 2: transactionAsyncLocalStorage (Mongoose 8.4+)

### Good Example -- Automatic Session Propagation

```typescript
import mongoose from "mongoose";

// Enable once at startup -- session is automatically injected into all operations
mongoose.set("transactionAsyncLocalStorage", true);

async function createOrderWithTransaction(
  orderData: OrderInput,
): Promise<void> {
  // connection.transaction() wraps the callback in AsyncLocalStorage
  await mongoose.connection.transaction(async () => {
    // No { session } needed -- automatically propagated via AsyncLocalStorage
    const order = await Order.create(orderData);

    await Product.updateMany(
      { _id: { $in: orderData.items.map((i) => i.productId) } },
      { $inc: { stock: -1 } },
    );

    await Customer.findByIdAndUpdate(orderData.customerId, {
      $push: { orderIds: order._id },
    });
    // If anything throws, ALL operations are rolled back
  });
}

export { createOrderWithTransaction };
```

**Why good:** Eliminates manual `{ session }` passing (the biggest source of transaction bugs), cleaner code, no risk of forgetting session, automatic rollback on error

**When to use:** Mongoose 8.4+ projects. Especially valuable when operations span multiple functions/services where passing session through all parameters is cumbersome.

### Good Example -- Connection.transaction() with Automatic State Reset

```typescript
mongoose.set("transactionAsyncLocalStorage", true);

async function updateWithRollbackSafety(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  await mongoose.connection.transaction(async () => {
    user.name = "New Name";
    await user.save(); // Automatically uses the transaction session

    // If this throws, user.name reverts to the original value
    await AuditLog.create({ action: "name_change", userId });
  });
  // After successful transaction: user.name is "New Name"
  // After failed transaction: user.name is reverted by Mongoose
}

export { updateWithRollbackSafety };
```

**Why good:** `connection.transaction()` integrates with Mongoose change tracking -- if the transaction aborts, Mongoose automatically resets document state

---

## Pattern 3: create() Array Syntax for Transactions

### Important Gotcha

```typescript
// CORRECT: Array syntax for create() with session
await User.create([{ name: "Alice", email: "alice@test.com" }], { session });

// WRONG: Non-array syntax ignores the session option
await User.create({ name: "Alice", email: "alice@test.com" }, { session });
// The { session } is treated as a second document, NOT as options
```

**Why this matters:** `Model.create(doc, options)` only accepts options when the first argument is an array. With a single object, the second argument is interpreted as another document to create. This is a common transaction bug where the operation appears to work but runs outside the transaction.

---

## Pattern 4: Cursor-Based Pagination

### Good Example -- Keyset Pagination (Efficient)

```typescript
import mongoose from "mongoose";

const PAGE_SIZE = 20;

interface PaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function getUsersWithCursor(
  cursor?: string,
): Promise<PaginationResult<Record<string, unknown>>> {
  const query: Record<string, unknown> = { isActive: true };

  if (cursor) {
    query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
  }

  // Fetch one extra to determine hasMore without a separate count query
  const users = await User.find(query)
    .select("name email role createdAt")
    .sort({ _id: 1 })
    .limit(PAGE_SIZE + 1)
    .lean();

  const hasMore = users.length > PAGE_SIZE;
  const data = hasMore ? users.slice(0, PAGE_SIZE) : users;
  const nextCursor = hasMore ? String(data[data.length - 1]._id) : null;

  return { data, nextCursor, hasMore };
}

export { getUsersWithCursor };
```

**Why good:** Cursor-based pagination avoids skip/limit performance issues on large collections, fetch one extra to determine hasMore without separate count query, consistent performance regardless of page depth

### Bad Example -- Deep Offset Pagination

```typescript
// BAD: skip/limit degrades with page depth
const PAGE_SIZE = 20;
const page = 5000;

const users = await User.find({ isActive: true })
  .skip((page - 1) * PAGE_SIZE) // Scans and discards 99,980 documents
  .limit(PAGE_SIZE);
```

**Why bad:** MongoDB scans and discards all skipped documents, performance degrades linearly with page depth, page 5000 requires scanning ~100k documents

---

## Pattern 5: Cursor-Based Iteration for Large Datasets

### Good Example -- Processing Large Collections

```typescript
const BATCH_LOG_INTERVAL = 1000;

async function processAllOrders(): Promise<number> {
  let processed = 0;

  const cursor = Order.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .cursor();

  for await (const order of cursor) {
    await processOrder(order);
    processed += 1;

    if (processed % BATCH_LOG_INTERVAL === 0) {
      console.log(`Processed ${processed} orders`);
    }
  }

  return processed;
}

export { processAllOrders };
```

**Why good:** Cursor-based iteration keeps memory constant regardless of result size, `for await...of` for clean async iteration, progress logging at intervals

### Bad Example -- Loading Everything into Memory

```typescript
// BAD: Loads ALL matching documents into memory at once
const orders = await Order.find({ status: "pending" });
// 1 million pending orders? Out of memory crash
```

**Why bad:** Loads entire result set into memory, can crash with OOM for large collections

---

## Pattern 6: Indexes

### Good Example -- Compound Index (ESR Rule)

```typescript
const orderSchema = new Schema({
  status: { type: String, enum: ["pending", "shipped", "delivered"] as const },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  total: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

// Query: { status: "shipped", total: { $gte: 100 } }, sort: { createdAt: -1 }
// ESR Rule: Equality first, Sort second, Range last
orderSchema.index({ status: 1, createdAt: -1, total: 1 });

// Query: { customerId }, sort: { createdAt: -1 }
orderSchema.index({ customerId: 1, createdAt: -1 });

const Order = model("Order", orderSchema);
export { Order };
```

**Why good:** ESR (Equality-Sort-Range) rule maximizes index efficiency, separate compound index per query pattern

### Good Example -- TTL Index (Auto-Expiring Documents)

```typescript
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

sessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SESSION_EXPIRY_SECONDS },
);

const Session = model("Session", sessionSchema);
export { Session };
```

**Why good:** Named constant for expiry, TTL index for automatic cleanup by MongoDB background thread, no application-level cleanup needed

### Good Example -- Partial and Sparse Indexes

```typescript
// Partial index: smaller, only indexes active records
userSchema.index(
  { email: 1 },
  {
    partialFilterExpression: { isActive: true },
    unique: true, // Unique among active users only
  },
);

// Sparse index: allows multiple null/undefined values
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
```

**Why good:** Partial index is smaller and faster, uniqueness enforced only for active records, sparse index allows multiple users without googleId

### Index Best Practices

1. **Disable autoIndex in production** -- set `{ autoIndex: false }` in schema options, create indexes via migration scripts
2. **Follow ESR rule** for compound indexes -- Equality, Sort, Range
3. **One text index per collection** -- include all searchable fields in one index
4. **Use `explain("executionStats")`** to verify index usage -- look for `IXSCAN` not `COLLSCAN`
5. **Remove unused indexes** -- they slow writes and consume storage
6. **Limit to ~10 indexes per collection** -- more indexes slow write operations

---

_For core patterns, see [core.md](core.md). For middleware, see [middleware.md](middleware.md). For population, see [population.md](population.md)._
