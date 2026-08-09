# MongoDB Advanced Patterns

> Transactions, bulk writes, change streams, schema evolution and serverless usage with the native driver. See [SKILL.md](../SKILL.md) for the decisions behind these.

**Core:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Indexes:** See [indexes.md](indexes.md).

---

## Pattern 1: Transactions

### Good Example -- Transfer with a Session

```typescript
import type { ClientSession, MongoClient, ObjectId } from "mongodb";

async function transfer(
  client: MongoClient,
  from: ObjectId,
  to: ObjectId,
  amount: number,
): Promise<void> {
  const session = client.startSession();

  try {
    await session.withTransaction(
      async () => {
        const accounts = client.db(DB_NAME).collection<AccountDoc>("accounts");

        const debited = await accounts.updateOne(
          { _id: from, balance: { $gte: amount } }, // the guard is in the filter
          { $inc: { balance: -amount } },
          { session },
        );

        // Throwing aborts the transaction: the credit below never happens,
        // and the debit above is rolled back.
        if (debited.matchedCount === 0) {
          throw new InsufficientFundsError(from);
        }

        await accounts.updateOne(
          { _id: to },
          { $inc: { balance: amount } },
          { session },
        );
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
}

export { transfer };
```

**Why good:** the balance check lives in the filter so it is evaluated atomically with the write rather than in a read-then-write race, `withTransaction` commits on return and aborts on throw, `w: "majority"` means a committed transfer survives a failover, and the `finally` releases the session on every path

### Bad Example -- A Missing Session

```typescript
// BAD
await session.withTransaction(async () => {
  await accounts.updateOne(
    { _id: from },
    { $inc: { balance: -amount } },
    { session },
  );
  await accounts.updateOne({ _id: to }, { $inc: { balance: amount } }); // no session
});
```

**Why bad:** the credit runs outside the transaction and commits on its own, so if the transaction aborts the debit is rolled back and the credit is not — money is created, no error is raised, and the two accounts disagree

### Bad Example -- Side Effects Inside the Callback

```typescript
// BAD
await session.withTransaction(async () => {
  await orders.insertOne(order, { session });
  await sendConfirmationEmail(order); // not transactional, and retried
});
```

**Why bad:** the driver re-runs the callback on transient errors, so a retry sends a second email for one order; nothing outside the database can be rolled back, so it must not be inside the callback. Record the intent in the transaction and act on it after the commit.

### Good Example -- Parallel Work Is Not Allowed on One Session

```typescript
// BAD: a session is single-threaded
await Promise.all([
  accounts.updateOne(a, updateA, { session }),
  accounts.updateOne(b, updateB, { session }),
]);

// GOOD: sequential within the transaction
await accounts.updateOne(a, updateA, { session });
await accounts.updateOne(b, updateB, { session });
```

**Why bad:** operations on one session must be ordered; issuing them concurrently produces errors that appear intermittently under load and not at all in a test

### Good Example -- Not Using a Transaction

```typescript
// A single-document write is already atomic. A transaction around it
// adds coordination cost and buys nothing.
await accounts.updateOne(
  { _id: id, balance: { $gte: amount } },
  { $inc: { balance: -amount }, $push: { history: entry } },
);
```

**Why good:** the guard, the decrement and the history append apply as one atomic document update, which is both cheaper than a transaction and available on a standalone server

**Transactions require a replica set or sharded cluster.** A standalone server rejects them, which is how a transaction passes in staging and fails on a single-node development machine.

---

## Pattern 2: Bulk Writes

### Good Example -- Batched Mixed Operations

```typescript
import type { AnyBulkWriteOperation } from "mongodb";

const BULK_BATCH_SIZE = 1_000;

async function syncProducts(
  products: Collection<ProductDoc>,
  incoming: ProductInput[],
): Promise<number> {
  let modified = 0;

  for (let start = 0; start < incoming.length; start += BULK_BATCH_SIZE) {
    const batch = incoming.slice(start, start + BULK_BATCH_SIZE);

    const operations: AnyBulkWriteOperation<ProductDoc>[] = batch.map(
      (item) => ({
        updateOne: {
          filter: { sku: item.sku },
          update: { $set: item, $setOnInsert: { createdAt: new Date() } },
          upsert: true,
        },
      }),
    );

    // ordered: false lets the server apply operations in parallel and keep
    // going past a failure, rather than stopping at the first one.
    const result = await products.bulkWrite(operations, { ordered: false });
    modified += result.modifiedCount + result.upsertedCount;
  }

  return modified;
}

export { syncProducts };
```

**Why good:** one round trip per thousand documents instead of one per document, explicit batching keeps a single request from growing past the server's limits, and `ordered: false` means one bad record does not abandon the rest of the batch

### Bad Example -- A Round Trip per Document

```typescript
// BAD
for (const item of incoming) {
  await products.updateOne({ sku: item.sku }, { $set: item }, { upsert: true });
}
```

**Why bad:** network latency is paid once per document, so 10,000 items at 2 ms each spend 20 seconds waiting rather than working — the database is not the bottleneck, the round trips are

**Reading bulk errors:** with `ordered: false` a partial failure throws `MongoBulkWriteError`, whose `result` holds what did succeed and whose `writeErrors` names each failure by index. Discarding the error discards the record of what already applied.

---

## Pattern 3: Change Streams

### Good Example -- Reacting to Writes

```typescript
const changeStream = orders.watch([{ $match: { operationType: "insert" } }], {
  fullDocument: "updateLookup",
});

try {
  for await (const change of changeStream) {
    if (change.operationType === "insert") {
      await onOrderCreated(change.fullDocument);
    }
  }
} finally {
  await changeStream.close();
}
```

**Why good:** the pipeline filters server-side so uninteresting events never cross the network, and the `finally` closes the stream rather than leaving it open against the server

### Good Example -- Resuming After a Restart

```typescript
// Persist the resume token with the work it corresponds to, so a restart
// continues from the last processed change instead of replaying or skipping.
const resumeAfter = await loadResumeToken();
const stream = orders.watch([], resumeAfter ? { resumeAfter } : {});

for await (const change of stream) {
  await handle(change);
  await saveResumeToken(change._id);
}
```

**Why good:** without a stored token a restart resumes from now, silently losing every change that occurred while the process was down

**Change streams need a replica set,** and resumability is bounded by the oplog window — a process down longer than the oplog retains cannot resume and must fall back to a reconciliation pass.

---

## Pattern 4: Schema Evolution Without a Schema

### Good Example -- Versioned Documents

```typescript
const CURRENT_SCHEMA_VERSION = 2;

type UserDocV2 = {
  _id: ObjectId;
  schemaVersion: number;
  email: string;
  name: { first: string; last: string }; // v1 had a single `fullName`
};

// Read path tolerates both shapes; the migration runs in the background.
function normalizeUser(doc: WithId<Document>): UserDocV2 {
  if (doc.schemaVersion === CURRENT_SCHEMA_VERSION) return doc as UserDocV2;

  const [first = "", ...rest] = String(doc.fullName ?? "").split(" ");
  return {
    _id: doc._id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    email: String(doc.email),
    name: { first, last: rest.join(" ") },
  };
}

export { CURRENT_SCHEMA_VERSION, normalizeUser };
```

**Why good:** a stored version field makes "which shape is this?" answerable rather than inferred from which fields happen to be present, and the tolerant read path means the migration does not have to complete before the new code ships

### Good Example -- Server-Side Validation

```typescript
// MongoDB can enforce a schema even though the driver does not.
await db.command({
  collMod: "users",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "schemaVersion"],
      properties: {
        email: { bsonType: "string" },
        schemaVersion: { bsonType: "int" },
      },
    },
  },
  validationLevel: "moderate", // existing invalid documents are left alone
});
```

**Why good:** the guarantee lives with the data, so it holds for every writer including scripts and other services, and `moderate` applies it to new and valid-existing documents without rejecting a backlog that has not been migrated

---

## Pattern 5: Serverless and Edge

### Good Example -- Reusing the Client Across Invocations

```typescript
const SERVERLESS_POOL_SIZE = 5;
const MAX_IDLE_TIME_MS = 30_000;

let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
  // Caching the promise rather than the client means concurrent cold
  // invocations share one connect() instead of racing several.
  clientPromise ??= new MongoClient(requireEnv("MONGODB_URI"), {
    maxPoolSize: SERVERLESS_POOL_SIZE,
    minPoolSize: 0,
    maxIdleTimeMS: MAX_IDLE_TIME_MS,
  }).connect();

  return clientPromise;
}

export { getClient };
```

**Why good:** warm invocations reuse the pool and skip the handshake, caching the promise removes the race between simultaneous cold starts, and a small pool with `minPoolSize: 0` keeps total connections bounded when the platform scales out to many instances

### Bad Example -- Closing the Client per Invocation

```typescript
// BAD
export async function handler() {
  const client = await getClient();
  try {
    return await doWork(client);
  } finally {
    await client.close(); // discards the pool the next invocation would reuse
  }
}
```

**Why bad:** every invocation becomes a cold connect, so the platform's reuse of the process buys nothing and each request pays the full TLS and auth handshake

**Connection limits are the real constraint here.** Instances × `maxPoolSize` is the ceiling, and a platform that scales to 200 instances with a pool of 100 asks for 20,000 connections from a cluster that permits far fewer.
