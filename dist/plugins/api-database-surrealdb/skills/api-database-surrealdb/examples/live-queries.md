# SurrealDB Live Queries & Transactions Examples

> Live queries, real-time subscriptions, transactions, events, and custom functions. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Graph patterns:** See [graph-relations.md](graph-relations.md). **Schema & auth:** See [schema-auth.md](schema-auth.md).

---

## Pattern 1: Live Queries (Real-Time Subscriptions)

### Good Example -- Table Subscription (SDK v2)

```typescript
import Surreal, { Table } from "surrealdb";

interface ChatMessage {
  id: RecordId;
  channel: string;
  author: RecordId;
  content: string;
  created_at: string;
}

// Subscribe to all changes on a table
const live = await db.live(new Table("chat_message"));

// Callback-based subscription
live.subscribe((message) => {
  switch (message.action) {
    case "CREATE":
      console.log("New message:", message.value);
      break;
    case "UPDATE":
      console.log("Message updated:", message.value);
      break;
    case "DELETE":
      console.log("Message deleted, id:", message.recordId);
      break;
  }
});

// Cleanup when done
await live.kill();
```

**Why good:** SDK v2 `live()` returns a subscription object, callback receives `LiveMessage` with `action`/`value`/`recordId`, `kill()` for cleanup, action-based switch for different event types

### Good Example -- Filtered Live Query (SurrealQL)

```typescript
// Subscribe to specific records only (server-side filtering via SurrealQL)
const [liveId] = await db.query<[string]>(
  `LIVE SELECT * FROM chat_message WHERE channel = $channel`,
  { channel: "general" },
);

// Async iterator pattern (preferred in SDK v2)
const liveFeed = await db.live(new Table("notification"));
for await (const { action, value } of liveFeed) {
  if (action === "CREATE") {
    showNotification(value);
  }
}
```

**Why good:** Server-side WHERE filtering reduces network traffic, async iterator for stream processing, `for await` pattern integrates naturally with TypeScript control flow

### Good Example -- Live Query Cleanup Pattern

```typescript
class RealtimeManager {
  private subscriptions: Array<{ kill: () => Promise<void> }> = [];

  async subscribe(
    db: Surreal,
    table: string,
    callback: (message: LiveMessage) => void,
  ): Promise<void> {
    const live = await db.live(new Table(table));
    live.subscribe(callback);
    this.subscriptions.push(live);
  }

  async cleanup(): Promise<void> {
    await Promise.all(this.subscriptions.map((sub) => sub.kill()));
    this.subscriptions = [];
  }
}

export { RealtimeManager };
```

**Why good:** Centralized subscription management, `cleanup()` kills all live queries on disconnect, prevents subscription leaks

### Bad Example -- Unfiltered Live Query on Large Table

```typescript
// BAD: Subscribing to ALL changes on a high-traffic table
const live = await db.live(new Table("audit_log"));
live.subscribe((message) => {
  // Fires for EVERY insert into audit_log -- could be thousands per second
  console.log(message.action, message.value);
});
// No cleanup -- subscription leaks on disconnect
```

**Why bad:** No WHERE filter means every change triggers the callback (high-traffic tables can overwhelm the client), no `kill()` call causes subscription leak

---

## Pattern 2: Transactions

### Good Example -- Multi-Statement Transaction (SurrealQL)

```surql
BEGIN TRANSACTION;

-- Transfer funds between accounts
LET $source = (SELECT * FROM account:alice);
LET $dest = (SELECT * FROM account:bob);

IF $source.balance < $amount {
  THROW "Insufficient funds";
};

UPDATE account:alice SET balance -= $amount;
UPDATE account:bob SET balance += $amount;

CREATE transfer SET
  from = account:alice,
  to = account:bob,
  amount = $amount,
  transferred_at = time::now();

COMMIT TRANSACTION;
```

**Why good:** `BEGIN`/`COMMIT` wraps multiple operations atomically, `THROW` rolls back the transaction on error, `LET` for intermediate values, all operations succeed or all fail

### Good Example -- Transaction via SDK

```typescript
const TRANSFER_AMOUNT = 50.0;

async function transferFunds(
  db: Surreal,
  fromId: string,
  toId: string,
  amount: number,
): Promise<void> {
  await db.query(
    `BEGIN TRANSACTION;

    LET $source = (SELECT balance FROM account:$from_id);
    IF $source.balance < $amount {
      THROW "Insufficient funds in source account";
    };

    UPDATE account:$from_id SET balance -= $amount;
    UPDATE account:$to_id SET balance += $amount;

    CREATE transfer SET
      from_account = type::record("account", $from_id),
      to_account = type::record("account", $to_id),
      amount = $amount,
      transferred_at = time::now();

    COMMIT TRANSACTION;`,
    {
      from_id: fromId,
      to_id: toId,
      amount,
    },
  );
}

export { transferFunds };
```

**Why good:** Parameterized transaction, `THROW` for validation, `type::record()` to construct record IDs from parameters, atomic commit/rollback

### Good Example -- Transaction with RETURN

```surql
BEGIN TRANSACTION;

LET $order = CREATE order SET
  customer = $customer_id,
  items = $items,
  status = "pending",
  total = $total;

-- Decrement stock for each item
FOR $item IN $items {
  LET $product = (SELECT stock FROM product WHERE id = $item.product_id);
  IF $product.stock < $item.quantity {
    THROW "Insufficient stock for " + <string> $item.product_id;
  };
  UPDATE $item.product_id SET stock -= $item.quantity;
};

RETURN $order;

COMMIT TRANSACTION;
```

**Why good:** `RETURN` provides the created order back to the caller from within the transaction, `FOR` loop processes items, stock validation prevents overselling

### Bad Example -- No Transaction for Related Operations

```surql
-- BAD: Two operations that should be atomic but aren't
UPDATE account:alice SET balance -= 100;
-- If the server crashes here, Alice lost money and Bob didn't receive it
UPDATE account:bob SET balance += 100;
```

**Why bad:** No transaction wrapper means partial failure leaves data inconsistent, use `BEGIN TRANSACTION` / `COMMIT TRANSACTION` for atomic operations

---

## Pattern 3: Events (Database Triggers)

### Good Example -- Audit Logging with Events

```surql
-- Trigger on any change to the user table
DEFINE EVENT user_audit ON user WHEN $event IN ["CREATE", "UPDATE", "DELETE"] THEN {
  CREATE audit_log SET
    table_name = "user",
    record_id = $value.id,
    event_type = $event,
    timestamp = time::now(),
    before = $before,
    after = $after;
};

-- Trigger only on specific conditions
DEFINE EVENT price_alert ON product
  WHEN $event = "UPDATE" AND $before.price != $after.price
  THEN {
    CREATE notification SET
      message = "Price changed for " + <string> $value.id,
      old_price = $before.price,
      new_price = $after.price,
      created_at = time::now();
  };
```

**Why good:** `$event` is the action type, `$before`/`$after` capture old and new values, conditional triggers with `WHEN`, events fire within the same transaction as the triggering operation

---

## Pattern 4: Custom Functions

### Good Example -- Reusable Business Logic

```surql
-- Custom function for full-text search with pagination
DEFINE FUNCTION fn::search_posts($term: string, $page: int, $limit: int) {
  LET $offset = ($page - 1) * $limit;

  RETURN SELECT
    id, title, content,
    search::score(1) AS relevance
  FROM post
  WHERE title @1@ $term OR content @1@ $term
  ORDER BY relevance DESC
  LIMIT $limit
  START $offset;
};

-- Usage
SELECT * FROM fn::search_posts("surrealdb tutorial", 1, 20);
```

**Why good:** Encapsulates query logic, parameterized for reuse, returns structured results, pagination built in

### Gotcha -- Random ID in Functions

```surql
-- BAD: rand()/ulid()/uuid() generate the SAME value per function call
DEFINE FUNCTION fn::create_with_id() {
  -- This generates the same ULID on every call, causing duplicate key errors
  CREATE thing:ulid() SET data = "test";
  CREATE thing:ulid() SET data = "test2";
  -- Both get the SAME ulid!
};

-- WORKAROUND: Pass the ID as a parameter
DEFINE FUNCTION fn::create_with_param($id: string) {
  CREATE type::record("thing", $id) SET data = "test";
};
```

**Why bad:** Random ID functions (`rand()`, `ulid()`, `uuid()`) in custom function bodies generate the same value per function invocation, causing duplicate key errors on subsequent creates within the same function

---

## Pattern 5: Change Feeds

### Good Example -- Change Data Capture

```surql
-- Enable change feed on a table (retain 7 days of changes)
DEFINE TABLE order CHANGEFEED 7d INCLUDE ORIGINAL;

-- Query changes since a timestamp
SHOW CHANGES FOR TABLE order SINCE d"2025-01-01T00:00:00Z" LIMIT 100;
```

**Why good:** `CHANGEFEED` retains history for replay/sync, `INCLUDE ORIGINAL` preserves pre-change values, `SHOW CHANGES` for consuming changes, useful for CDC pipelines and event sourcing

**When to use:** Event sourcing, audit trails, data sync between services, replaying state changes. When you need the change history itself, not just the current state.

---

_For core patterns, see [core.md](core.md). For graph patterns, see [graph-relations.md](graph-relations.md). For schema definitions, see [schema-auth.md](schema-auth.md)._
