---
name: api-database-mongoose
description: MongoDB ODM with schemas, validation, middleware, and TypeScript support
---

# Mongoose ODM Patterns

> **Quick Guide:** Use Mongoose as the ODM layer for MongoDB. Let TypeScript infer types from schema definitions instead of duplicating interfaces. Register all middleware before calling `model()` -- hooks added after compilation are silently ignored. Use `.lean()` for any read-only query. Pass `{ session }` to every operation inside a transaction or enable `transactionAsyncLocalStorage`. Prefer `session.withTransaction()` over manual commit/abort. Use `127.0.0.1` instead of `localhost` in connection strings (Node.js 18+ IPv6 preference causes timeouts).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define all middleware (pre/post hooks) BEFORE calling `model()` -- hooks registered after model compilation are silently ignored with no error)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- missing session causes that operation to run outside the transaction silently)**

**(You MUST use `.lean()` for read-only queries returning API responses -- skipping lean wastes 3x memory on hydration overhead)**

**(You MUST use `127.0.0.1` instead of `localhost` in connection strings -- Node.js 18+ prefers IPv6 and `localhost` causes connection timeouts)**

**(You MUST NOT use `findOneAndUpdate`/`updateOne` and expect `pre('save')` to fire -- only `save()` and `create()` trigger document middleware)**

**(You MUST NOT use `next()` callbacks in pre hooks on Mongoose 9 -- use async/await instead; `next()` was removed in v9)**

</critical_requirements>

---

**Auto-detection:** Mongoose, mongoose, mongoose.connect, Schema, model, ObjectId, populate, HydratedDocument, InferSchemaType, InferRawDocType, pre('save'), post('save'), lean, mongoose.startSession, withTransaction, discriminator, virtual, Schema.Types.ObjectId, Types.ObjectId

**When to use:**

- Defining MongoDB schemas and models with Mongoose
- TypeScript integration with schema type inference
- Middleware hooks (pre/post save, validate, find, delete)
- Population (resolving references between collections)
- Transactions with session management
- Virtuals and instance/static methods
- Discriminators (single collection inheritance)
- Connection management (single and multi-database)

**Key patterns covered:**

- Schema definition with automatic TypeScript inference
- TypeScript typing (HydratedDocument, InferSchemaType, methods/statics/virtuals generics)
- CRUD operations (create, find, update, delete, lean vs hydrated)
- Middleware hooks and their execution rules
- Population with field selection and limits
- Transactions (withTransaction, transactionAsyncLocalStorage)
- Validation (built-in validators, custom validators, error messages)
- Virtuals (computed, populate virtuals)
- Discriminators (inheritance pattern)
- Connection setup and multi-database

**When NOT to use:**

- Raw MongoDB driver queries without schema enforcement (use the native driver)
- Relational data with complex joins and foreign key constraints (use a relational database)
- Simple key-value storage (use a dedicated key-value store)

**Detailed Resources:**

- For decision frameworks, quick reference tables, and migration notes, see [reference.md](reference.md)

**Core Patterns:**

- [examples/core.md](examples/core.md) -- Connection, schema definition, TypeScript typing, model creation, CRUD, validation

**Middleware & Lifecycle:**

- [examples/middleware.md](examples/middleware.md) -- Pre/post hooks, error handling middleware, query middleware, soft delete

**Relationships & Population:**

- [examples/population.md](examples/population.md) -- Populate, virtual populate, discriminators, embedding vs referencing

**Transactions & Advanced:**

- [examples/transactions.md](examples/transactions.md) -- Sessions, withTransaction, transactionAsyncLocalStorage, connection management

---

<philosophy>

## Philosophy

Mongoose provides schema-based modeling for MongoDB. Its value is the **application-layer enforcement** of structure, validation, middleware, and type safety on top of MongoDB's flexible document model.

**Core principles:**

1. **Schema-first** -- Define schemas before models. Schemas enforce structure, validation, defaults, and middleware at the application layer.
2. **Infer, don't duplicate** -- Let Mongoose infer TypeScript types from schema definitions. Only define explicit interfaces when adding methods, statics, or virtuals.
3. **Middleware before model** -- All pre/post hooks must be registered before `model()`. This is the single most common Mongoose bug -- hooks added after compilation are silently ignored.
4. **Lean for reads** -- `.lean()` returns plain JavaScript objects (3x less memory). Use it for every read-only query. Only skip lean when you need Mongoose document methods.
5. **Session discipline** -- Every operation inside a transaction must receive `{ session }`. One missed session means that operation runs outside the transaction with no error.
6. **Validate at the schema** -- Push validation into schema definitions (required, min, max, enum, custom validators with error messages). Don't validate in application code what the schema can enforce.

**When to use Mongoose:**

- You want schema enforcement and validation on MongoDB documents
- You need middleware hooks (pre/post save, validate, find)
- You want automatic TypeScript type inference from schemas
- You need population (reference resolution between collections)
- You want computed properties (virtuals) and instance methods

**When NOT to use Mongoose:**

- Performance-critical bulk operations where the ODM overhead matters (use native driver)
- You only need raw MongoDB queries without schema enforcement
- You're doing heavy aggregation-only workloads (aggregation pipelines bypass most Mongoose features)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Connection Setup

Establish a single connection at application startup. Use environment variables for credentials. Never hardcode connection strings. Use `127.0.0.1` instead of `localhost` (Node.js 18+ IPv6 preference causes timeouts).

```typescript
// Named constants for pool/timeout, env var for URI, typed return
const connection = await mongoose.connect(process.env.MONGODB_URI!, {
  maxPoolSize: POOL_SIZE_MAX,
  serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
});
```

See [examples/core.md](examples/core.md) Pattern 1 for production connection setup, event handling, graceful shutdown, and multi-database connections.

---

### Pattern 2: Schema Definition with TypeScript Inference

Let Mongoose infer types from the schema definition. Only use explicit interfaces when adding methods, statics, or virtuals. Use `as const` on enum arrays to preserve literal types.

```typescript
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ["admin", "user"] as const, default: "user" },
  },
  { timestamps: true },
);
const User = model("User", userSchema); // TypeScript infers types from schema
```

See [examples/core.md](examples/core.md) Patterns 2-3 for complete schemas with validation, subdocuments, `InferSchemaType`, and full generic typing with methods/statics/virtuals.

---

### Pattern 3: Explicit Typing (Methods, Statics, Virtuals)

When a model has instance methods, statics, or virtuals, use the full generic parameter set. Define separate interfaces for `IDoc`, `IDocMethods`, `IDocVirtuals`, and `IDocStatics`. Export `HydratedDocument<IDoc, IDocMethods & IDocVirtuals>` for consumers.

```typescript
type UserModel = Model<IUser, {}, IUserMethods, IUserVirtuals> & IUserStatics;
type UserDocument = HydratedDocument<IUser, IUserMethods & IUserVirtuals>;
const userSchema = new Schema<
  IUser,
  UserModel,
  IUserMethods,
  {},
  IUserVirtuals
>(
  {
    /* fields */
  },
  { toJSON: { virtuals: true } },
);
```

See [examples/core.md](examples/core.md) Pattern 3 for the complete implementation with all interfaces, generic parameters, methods, virtuals, statics, and middleware ordering.

---

### Pattern 4: CRUD Operations

Key rules: use `.lean()` for read-only queries (3x memory savings), `save()` when middleware must fire, `{ new: true, runValidators: true }` on direct updates. Never call `.save()` on a lean result (plain object, no methods).

```typescript
const users = await User.find({ isActive: true }).select("name email").lean();
await User.findByIdAndUpdate(
  id,
  { $set: { name: "New" } },
  { new: true, runValidators: true },
);
```

See [examples/core.md](examples/core.md) Pattern 5 for create, read, update, delete, bulk operations, and common mistakes.

---

### Pattern 5: Schema Validation

Push validation into schema definitions: use `required` with messages, `min`/`max`/`minlength`/`maxlength` with messages, `match` for regex, `enum` with `as const` and `{VALUE}` message template, and custom `validate` functions. Use named constants for all numeric limits.

```typescript
name: { type: String, required: [true, "Name is required"], minlength: [MIN_LEN, "Too short"] },
status: { type: String, enum: { values: ["draft", "active"] as const, message: "{VALUE} invalid" } },
```

See [examples/core.md](examples/core.md) Pattern 2 for complete validation schemas, subdocuments, and array validation.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Registering middleware after `model()` call -- hooks are silently ignored, no error thrown
- Running operations in parallel inside a transaction (`Promise.all()`) -- MongoDB does not support parallel operations within a single transaction session
- Missing `{ session }` on any operation inside a transaction -- that operation runs outside the transaction silently
- Using `localhost` in connection strings on Node.js 18+ -- IPv6 preference causes connection timeouts, use `127.0.0.1`
- Mutating a document fetched with `.lean()` and calling `.save()` -- lean returns plain objects without Mongoose methods

**Medium Priority Issues:**

- Using `findOneAndUpdate`/`updateOne` and expecting `pre('save')` to fire -- only `save()` and `create()` trigger document middleware
- Unbounded `.populate()` without `limit` or field selection -- can return thousands of documents per populate call, each is a separate DB round-trip
- Not passing `runValidators: true` on `findOneAndUpdate` -- schema validation is skipped by default on direct updates
- Using `Schema.Types.ObjectId` in TypeScript interfaces -- use `Types.ObjectId` for interfaces, `Schema.Types.ObjectId` for schema definitions only
- Creating indexes in production application code instead of migration scripts -- index builds can lock the collection

**Common Mistakes:**

- Forgetting `{ new: true }` on `findOneAndUpdate` -- returns the old document by default, not the updated one
- Using `next()` callbacks in pre hooks on Mongoose 9 -- `next()` was removed in v9, use async/await
- Not handling duplicate key errors (error code 11000) from unique indexes
- Using `.lean()` on write operations -- lean is for reads only
- Checking `doc.isNew` in `post('save')` hooks -- always `false` after save; capture in `pre('save')` via `this.$locals.wasNew`
- Defining the same middleware hook multiple times without realizing they stack (all run, not just the last one)
- Using `extends Document` on interfaces -- deprecated pattern that breaks type inference for lean documents and query filters

**Gotchas & Edge Cases:**

- MongoDB has a 16 MB document size limit -- deeply embedded arrays can silently hit this
- Mongoose buffers all operations until connected -- queries queue silently if connection fails, which can mask connection issues in development
- `deleteOne`/`deleteMany` on the Model do not trigger document `pre('deleteOne')` middleware -- they trigger query middleware instead; use `doc.deleteOne()` for document middleware
- Virtual properties are excluded from `toJSON()`/`toObject()` by default -- set `{ toJSON: { virtuals: true } }` in schema options or they disappear in API responses
- `insertMany()` does not trigger `save` middleware -- it triggers `insertMany` model middleware only
- Mongoose 9 renamed `FilterQuery` to `QueryFilter` -- update TypeScript imports if upgrading
- Mongoose 9 disallows pipeline-style updates by default -- pass `{ updatePipeline: true }` or they throw
- `create()` with an array requires array syntax for `{ session }`: `Model.create([data], { session })` -- the non-array form `Model.create(data, { session })` does not work in transactions

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define all middleware (pre/post hooks) BEFORE calling `model()` -- hooks registered after model compilation are silently ignored with no error)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- missing session causes that operation to run outside the transaction silently)**

**(You MUST use `.lean()` for read-only queries returning API responses -- skipping lean wastes 3x memory on hydration overhead)**

**(You MUST use `127.0.0.1` instead of `localhost` in connection strings -- Node.js 18+ prefers IPv6 and `localhost` causes connection timeouts)**

**(You MUST NOT use `findOneAndUpdate`/`updateOne` and expect `pre('save')` to fire -- only `save()` and `create()` trigger document middleware)**

**(You MUST NOT use `next()` callbacks in pre hooks on Mongoose 9 -- use async/await instead; `next()` was removed in v9)**

**Failure to follow these rules will cause silent middleware bypass, transaction isolation failures, or connection timeouts.**

</critical_reminders>
