# MongoDB Core Examples

> Client lifecycle, typed collections, CRUD and the result shapes each operation returns, and error handling. See [SKILL.md](../SKILL.md) for the decisions behind these.

**Query patterns:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Indexes:** See [indexes.md](indexes.md). **Advanced:** See [patterns.md](patterns.md).

---

## Pattern 1: Client and Pool Lifecycle

### Good Example -- One Client per Process

```typescript
import { MongoClient, ServerApiVersion } from "mongodb";
import type { Db } from "mongodb";

const POOL_SIZE_MAX = 20;
const POOL_SIZE_MIN = 2;
const SERVER_SELECTION_TIMEOUT_MS = 5_000;
const MAX_IDLE_TIME_MS = 60_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  maxPoolSize: POOL_SIZE_MAX,
  minPoolSize: POOL_SIZE_MIN,
  serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  maxIdleTimeMS: MAX_IDLE_TIME_MS,
  retryWrites: true,
  retryReads: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database: Db | undefined;

async function connectDatabase(): Promise<Db> {
  if (database) return database;

  // Operations auto-connect, so this call is optional. It exists to turn bad
  // credentials and DNS failures into a startup error instead of a runtime one.
  await client.connect();
  database = client.db(requireEnv("MONGODB_DB"));
  return database;
}

export { client, connectDatabase };
```

**Why good:** one client and one pool for the whole process, every numeric option is a named constant, the Stable API pins server behaviour across upgrades, `strict: true` rejects commands outside the versioned API rather than letting them break silently later

### Good Example -- Graceful Shutdown

```typescript
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

function registerShutdown(): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, async () => {
      // Waits for checked-out connections to return before closing the pool.
      await client.close();
      process.exit(0);
    });
  }
}

export { registerShutdown };
```

**Why good:** `close()` drains in-flight operations rather than severing them, and `once` avoids stacking a second handler if the signal repeats

### Bad Example -- A Client per Request

```typescript
// BAD: a new pool on every call
export async function getUser(id: string) {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const user = await client.db("app").collection("users").findOne({ _id: id });
  await client.close();
  return user;
}
```

**Why bad:** each `MongoClient` opens its own pool, so 100 concurrent requests open 100 pools and the server hits its connection limit; the TLS and auth handshake is also paid per request, adding latency that profiling attributes to the query rather than to the connection

### Good Example -- Serverless Client Reuse

```typescript
// Serverless runtimes freeze and thaw the same process, so a client cached
// outside the handler survives between invocations and its pool is reused.
const SERVERLESS_POOL_SIZE = 5;

let cached: MongoClient | undefined;

async function getClient(): Promise<MongoClient> {
  if (cached) return cached;

  cached = new MongoClient(requireEnv("MONGODB_URI"), {
    maxPoolSize: SERVERLESS_POOL_SIZE,
    minPoolSize: 0,
    maxIdleTimeMS: MAX_IDLE_TIME_MS,
  });
  await cached.connect();
  return cached;
}

export { getClient };
```

**Why good:** module scope outlives the handler so warm invocations skip the handshake entirely, a small pool keeps total connections bounded when the platform scales to many instances, and `minPoolSize: 0` lets idle instances release sockets instead of holding them

**Why not `client.close()` here:** closing at the end of a handler discards the pool the next invocation would have reused, which turns every request back into a cold connect.

---

## Pattern 2: Typed Collections

### Good Example -- Document Types and the Driver's Helpers

```typescript
import type {
  Collection,
  ObjectId,
  OptionalUnlessRequiredId,
  WithId,
} from "mongodb";

type UserDoc = {
  _id: ObjectId;
  email: string;
  displayName: string;
  roles: string[];
  createdAt: Date;
};

function usersCollection(db: Db): Collection<UserDoc> {
  return db.collection<UserDoc>("users");
}

// Reads carry _id: WithId<UserDoc> is UserDoc with _id guaranteed present.
async function findByEmail(
  db: Db,
  email: string,
): Promise<WithId<UserDoc> | null> {
  return usersCollection(db).findOne({ email });
}

// Inserts may omit _id and let the server generate one. That is what
// OptionalUnlessRequiredId expresses, and insertOne accepts it directly.
async function createUser(
  db: Db,
  input: OptionalUnlessRequiredId<UserDoc>,
): Promise<ObjectId> {
  const { insertedId } = await usersCollection(db).insertOne(input);
  return insertedId;
}

export { createUser, findByEmail, usersCollection };
```

**Why good:** the generic checks filters, updates and projections against `UserDoc` so a misspelled field is a compile error rather than a query matching nothing, and the two helpers express the real difference between a document you read and one you are about to insert

### Good Example -- Typed Projections

```typescript
type UserSummary = { email: string; displayName: string };

// The projection changes the result shape, so the generic on project()
// re-types the cursor to match what actually comes back.
async function listSummaries(db: Db): Promise<UserSummary[]> {
  return usersCollection(db)
    .find({})
    .project<UserSummary>({ email: 1, displayName: 1, _id: 0 })
    .toArray();
}

export { listSummaries };
```

**Why good:** without the generic the results are still typed as full `UserDoc`, so code reads `createdAt` off an object that never contained it and gets `undefined` at runtime with no type error

### Bad Example -- Trusting the Generic as Validation

```typescript
// BAD: treating a compile-time type as a runtime guarantee
const user = await usersCollection(db).findOne({ _id: id });
sendEmail(user!.email.toLowerCase()); // throws if email is missing or not a string
```

**Why bad:** the driver never validates documents against the generic, so a record written by an older schema version, a migration, or another service can be missing `email` entirely; the type says otherwise and the failure is a runtime `TypeError`

### Good Example -- Validating at the Trust Boundary

```typescript
function toUserSummary(doc: WithId<UserDoc>): UserSummary {
  if (typeof doc.email !== "string" || typeof doc.displayName !== "string") {
    throw new Error(`User ${doc._id.toHexString()} is missing required fields`);
  }
  return { email: doc.email, displayName: doc.displayName };
}

export { toUserSummary };
```

**Why good:** the check runs once where documents enter application code, so downstream consumers get a type that has actually been verified, and a malformed record names itself in the error instead of surfacing as `undefined` three call frames away

---

## Pattern 3: CRUD and Result Shapes

### Good Example -- Insert

```typescript
const insertResult = await users.insertOne({
  email: "a@example.com",
  displayName: "A",
  roles: [],
  createdAt: new Date(),
});
// { acknowledged: true, insertedId: ObjectId(...) }

const manyResult = await users.insertMany(docs, { ordered: false });
// { acknowledged: true, insertedCount: n, insertedIds: { 0: ObjectId(...) } }
```

**Why good:** `ordered: false` lets the remaining documents insert when one fails, instead of stopping at the first error -- the right default for bulk imports where partial progress is useful

### Good Example -- Update, and Reading the Counts Correctly

```typescript
const result = await users.updateOne({ _id: id }, { $set: { displayName } });

if (result.matchedCount === 0) {
  throw new NotFoundError(`No user with id ${id.toHexString()}`);
}
// matchedCount 1 with modifiedCount 0 means the value was already correct.
// That is a successful update, not a missing document.
```

**Why good:** the not-found check uses `matchedCount`, which is the count that actually answers it, so re-submitting an unchanged form does not produce a spurious 404

### Good Example -- Returning the Updated Document

```typescript
// The findOneAnd* family is the only one that returns a document.
const updated = await users.findOneAndUpdate(
  { _id: id },
  { $set: { displayName }, $currentDate: { updatedAt: true } },
  { returnDocument: "after" },
);

if (!updated) throw new NotFoundError(`No user with id ${id.toHexString()}`);
```

**Why good:** one round trip instead of an update followed by a read, `returnDocument: "after"` returns the new state rather than the default pre-update state, and `$currentDate` timestamps from the server clock so it does not drift between application hosts

### Good Example -- Upsert

```typescript
const result = await counters.updateOne(
  { name: "signups" },
  { $inc: { value: 1 }, $setOnInsert: { createdAt: new Date() } },
  { upsert: true },
);

const wasCreated = result.upsertedCount === 1;
```

**Why good:** `$setOnInsert` applies only when the document is created, so `createdAt` is not overwritten on subsequent increments, and `upsertedCount` distinguishes creation from update without a second query

### Bad Example -- Expecting a Document Back

```typescript
// BAD
const user = await users.insertOne(doc);
console.log(user.email); // undefined
const updated = await users.updateOne(filter, update);
return updated.displayName; // undefined
```

**Why bad:** both return acknowledgements, so these reads are `undefined` rather than errors; the value flows onward and fails at whatever finally uses it, which is usually a serializer or a template far from the query

### Good Example -- Delete

```typescript
const { deletedCount } = await users.deleteOne({ _id: id });
if (deletedCount === 0) throw new NotFoundError(`No user with id ${id}`);

const { deletedCount: purged } = await sessions.deleteMany({
  expiresAt: { $lt: new Date() },
});
```

---

## Pattern 4: Error Handling

### Good Example -- Duplicate Key as an Expected Outcome

```typescript
import { MongoServerError } from "mongodb";

const DUPLICATE_KEY_CODE = 11000;

async function registerUser(db: Db, input: OptionalUnlessRequiredId<UserDoc>) {
  try {
    return await usersCollection(db).insertOne(input);
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.code === DUPLICATE_KEY_CODE
    ) {
      throw new ConflictError(`Email ${input.email} is already registered`);
    }
    throw error;
  }
}

export { registerUser };
```

**Why good:** two concurrent registrations are a race the unique index is there to settle, so the duplicate is an expected result to translate rather than a crash, and unrecognised errors rethrow instead of being swallowed

### Good Example -- Distinguishing Connectivity from Query Errors

```typescript
import { MongoServerSelectionError } from "mongodb";

try {
  await connectDatabase();
} catch (error) {
  if (error instanceof MongoServerSelectionError) {
    // No reachable server within serverSelectionTimeoutMS: wrong URI, network,
    // firewall, or an IP not on the cluster's allow list.
    throw new Error(
      "Database unreachable — check MONGODB_URI and network access",
    );
  }
  throw error;
}
```

**Why good:** server selection failures are infrastructure problems with completely different remedies from query errors, and naming them stops an operator debugging a query that was never sent

### Bad Example -- Catching Everything

```typescript
// BAD
try {
  await users.insertOne(doc);
} catch {
  return null; // duplicate key, validation failure and network partition, indistinguishable
}
```

**Why bad:** unrelated failures collapse into one silent `null`, so a network partition looks exactly like a duplicate email and the caller cannot act correctly on either
