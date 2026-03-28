---
name: api-database-mongodb
description: MongoDB with Mongoose ODM - schemas, models, queries, aggregation, indexes, TypeScript typing, connection management
---

# MongoDB / Mongoose Patterns

> **Quick Guide:** Use Mongoose as the ODM for MongoDB. Define schemas with automatic TypeScript inference, use `lean()` for read-only queries, prefer embedding over referencing for co-accessed data, place `$match` early in aggregation pipelines, and always define indexes to match your query patterns.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define Mongoose middleware (pre/post hooks) BEFORE calling `model()` -- hooks registered after model compilation are silently ignored)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- missing session causes operations to run outside the transaction)**

**(You MUST use `.lean()` for read-only queries that send results directly to API responses -- skipping lean wastes 3x memory on hydration overhead)**

**(You MUST use `127.0.0.1` instead of `localhost` in connection strings -- Node.js 18+ prefers IPv6 and `localhost` can cause connection timeouts)**

**(You MUST NOT use `findOneAndUpdate` / `updateOne` and expect `save` middleware to fire -- only `save()` and `create()` trigger document middleware)**

</critical_requirements>

---

**Auto-detection:** MongoDB, Mongoose, mongoose.connect, Schema, model, ObjectId, populate, aggregate, $match, $group, $lookup, lean, HydratedDocument, InferSchemaType, MongoClient, Atlas

**When to use:**

- Defining MongoDB schemas and models with Mongoose
- Building CRUD operations and complex queries
- Designing aggregation pipelines for analytics and reporting
- Managing indexes for query performance
- Connecting to MongoDB Atlas or local instances
- Modeling document relationships (embedding vs referencing)

**Key patterns covered:**

- Connection setup (Atlas URI, pooling, error handling)
- Schema definition (types, validation, defaults, enums)
- Models with TypeScript (automatic inference, methods, statics, virtuals)
- CRUD operations (create, find, update, delete, lean)
- Query building (filters, projection, sort, limit, populate)

**When NOT to use:**

- Highly relational data with complex joins and foreign key constraints (use a relational database)
- Strong ACID guarantees across many collections as a primary pattern (use a relational database)
- Simple key-value storage (use a dedicated key-value store)
- Fixed schemas where relational constraints are critical
- Time-series data at scale (use a dedicated time-series database)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core Patterns:**

- [examples/core.md](examples/core.md) - Connection, schema definition, model creation, TypeScript typing

**Query Patterns:**

- [examples/queries.md](examples/queries.md) - Complex queries, populate, lean, cursor, pagination

**Aggregation:**

- [examples/aggregation.md](examples/aggregation.md) - Aggregation pipeline, $match, $group, $lookup, $project

**Advanced Patterns:**

- [examples/patterns.md](examples/patterns.md) - Schema design (embedding vs referencing), transactions, middleware hooks, virtuals

**Indexing:**

- [examples/indexes.md](examples/indexes.md) - Index types, compound indexes, text search, geospatial, TTL, performance

---

<philosophy>

## Philosophy

MongoDB is a document database. Mongoose provides schema-based modeling on top of it. The core principle: **data that is accessed together should be stored together.**

**Core principles:**

1. **Schema-first design** -- Define schemas before models. Schemas enforce structure, validation, and defaults at the application layer.
2. **Embed by default** -- Co-accessed data belongs in the same document. Only reference when data is shared across many documents, grows unbounded, or is frequently updated independently.
3. **Lean for reads** -- Use `.lean()` for read-only queries. It returns plain objects (3x less memory) instead of full Mongoose documents.
4. **Index your queries** -- Every query pattern needs a supporting index. Compound indexes follow the Equality-Sort-Range (ESR) rule.
5. **Aggregation over application logic** -- Push data transformation to the database with aggregation pipelines instead of processing in application code.
6. **TypeScript inference** -- Let Mongoose infer types from schema definitions. Avoid manually duplicating interfaces unless you need methods/statics/virtuals.

**When to use MongoDB / Mongoose:**

- Document-oriented data (user profiles, product catalogs, content)
- Flexible schemas that evolve over time
- Hierarchical or nested data structures
- High read throughput with embedding
- Geospatial queries and full-text search

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Connection Setup

Establish a single connection at startup with named constants for pool/timeout config and environment variables for credentials. See [examples/core.md](examples/core.md) for full examples including connection events and graceful shutdown.

```typescript
const connection = await mongoose.connect(process.env.MONGODB_URI!, {
  maxPoolSize: POOL_SIZE_MAX,
  minPoolSize: POOL_SIZE_MIN,
  serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  socketTimeoutMS: SOCKET_TIMEOUT_MS,
  retryWrites: true,
  retryReads: true,
});
```

---

### Pattern 2: Schema Definition with TypeScript

Let Mongoose infer types from the schema definition. Use explicit interfaces only when adding methods, statics, or virtuals. See [examples/core.md](examples/core.md) for full typing examples with `HydratedDocument`, `InferSchemaType`, and generic parameters.

```typescript
// Preferred: automatic type inference
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: {
      type: String,
      enum: ["admin", "user", "moderator"] as const,
      default: "user",
    },
  },
  { timestamps: true },
);
const User = model("User", userSchema);
```

```typescript
// For methods/statics/virtuals: explicit interfaces with Schema generics
const userSchema = new Schema<IUser, UserModel, IUserMethods, {}, IUserVirtuals>({ ... });
```

---

### Pattern 3: CRUD Operations

Use `.lean()` for read-only queries, `save()` when middleware must fire, `findByIdAndUpdate` with `{ runValidators: true }` for direct updates. See [examples/core.md](examples/core.md) for full CRUD examples.

```typescript
const user = await User.findById(id).lean(); // read-only, 3x less memory
await User.insertMany(users, { ordered: false }); // bulk insert
await User.findByIdAndUpdate(id, update, { new: true, runValidators: true }); // direct update
```

---

### Pattern 4: Query Building

Use comparison/logical operators for filters, `.populate()` with field selection and limits. See [examples/queries.md](examples/queries.md) for dynamic query builders, cursor-based pagination, and populate patterns.

```typescript
const post = await Post.findById(id)
  .populate("author", "name email")
  .populate({
    path: "comments",
    options: { sort: { createdAt: -1 }, limit: 10 },
  })
  .lean();
```

---

### Pattern 5: Schema Validation

Add custom error messages, regex validation, and array-level validators. See [examples/core.md](examples/core.md) for complete validation examples.

```typescript
price: {
  type: Number,
  required: true,
  min: [0, "Price cannot be negative"],
  validate: { validator: (v: number) => Number.isFinite(v), message: "Price must be finite" },
},
sku: {
  type: String,
  required: true,
  unique: true,
  match: [/^[A-Z]{2}-\d{6}$/, "SKU must match format XX-000000"],
},
```

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Mutating a document fetched with `.lean()` and expecting `.save()` to work -- lean returns plain objects without Mongoose methods
- Registering middleware after `model()` call -- hooks are silently ignored
- Running operations in parallel inside a transaction (`Promise.all()`) -- MongoDB does not support parallel operations within a single transaction
- Using `localhost` in connection strings on Node.js 18+ -- IPv6 preference causes connection timeouts, use `127.0.0.1`
- Missing `{ session }` on any operation inside a transaction -- that operation runs outside the transaction

**Medium Priority Issues:**

- Using `findOneAndUpdate` / `updateOne` and expecting `pre('save')` hooks to fire -- only `save()` and `create()` trigger document middleware
- Unbounded `.populate()` without `limit` or field selection -- can return thousands of documents per query
- Not calling `runValidators: true` on `findOneAndUpdate` -- schema validation is skipped by default on updates
- Creating indexes in production code instead of migration scripts -- index builds lock the collection
- Using `$where` or JavaScript expressions in queries -- disables indexes and enables injection

**Common Mistakes:**

- Forgetting `{ new: true }` on `findOneAndUpdate` -- returns the old document by default
- Using `Schema.Types.ObjectId` in TypeScript interfaces instead of `Types.ObjectId` -- `Schema.Types.ObjectId` is for schema definitions, `Types.ObjectId` is for interfaces
- Not handling duplicate key errors (code 11000) from unique indexes
- Calling `.lean()` on write operations -- lean is for reads only
- Checking `doc.isNew` in `post('save')` hooks -- always `false` after save, use `this.$locals.wasNew` set in a `pre('save')` hook

**Gotchas & Edge Cases:**

- MongoDB has a 16 MB document size limit -- deeply embedded arrays can hit this
- Mongoose buffers operations before connection is established -- queries queue silently if connection fails
- `deleteOne` / `deleteMany` do not trigger `pre('remove')` middleware -- use `findOneAndDelete` or document `.deleteOne()` if you need middleware
- Virtual properties are excluded from `toJSON()` / `toObject()` by default -- set `{ toJSON: { virtuals: true } }` in schema options
- `remove()` was completely removed in Mongoose 7+ -- use `deleteOne()` or `deleteMany()` instead
- Mongoose 9 dropped callback-based `next()` in pre hooks -- use async/await instead
- Mongoose 9 renamed `FilterQuery` to `QueryFilter` -- update TypeScript imports if upgrading
- Mongoose 9 requires `updatePipeline: true` for pipeline-style updates -- they throw by default
- Mongoose 9 removed the `background` index option -- MongoDB 4.2+ builds all indexes in the background by default

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define Mongoose middleware (pre/post hooks) BEFORE calling `model()` -- hooks registered after model compilation are silently ignored)**

**(You MUST pass `{ session }` to EVERY operation inside a transaction -- missing session causes operations to run outside the transaction)**

**(You MUST use `.lean()` for read-only queries that send results directly to API responses -- skipping lean wastes 3x memory on hydration overhead)**

**(You MUST use `127.0.0.1` instead of `localhost` in connection strings -- Node.js 18+ prefers IPv6 and `localhost` can cause connection timeouts)**

**(You MUST NOT use `findOneAndUpdate` / `updateOne` and expect `save` middleware to fire -- only `save()` and `create()` trigger document middleware)**

**Failure to follow these rules will cause silent data corruption, middleware bypass, or transaction isolation failures.**

</critical_reminders>
