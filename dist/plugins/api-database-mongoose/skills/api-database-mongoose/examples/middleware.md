# Mongoose - Middleware & Lifecycle Examples

> Pre/post hooks, error handling middleware, query middleware, soft delete, and middleware ordering. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand schema definition and model creation from [core.md](core.md).

**Population:** See [population.md](population.md). **Transactions:** See [transactions.md](transactions.md).

---

## Pattern 1: Document Middleware (Pre/Post Save)

### Good Example -- Pre-Save with Conditional Logic

```typescript
import { Schema, model } from "mongoose";

const SALT_ROUNDS = 12;

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  slug: { type: String, unique: true },
});

// Hash password only when modified -- Mongoose 9: async, no next()
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    // this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  }
});

// Generate slug from name when name changes
userSchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, "-");
  }
});

// MUST register all middleware BEFORE model()
const User = model("User", userSchema);
export { User };
```

**Why good:** `isModified()` check prevents re-hashing on every save, Mongoose 9 async pattern (no `next()` callback), middleware defined before `model()` call

### Good Example -- Capturing isNew in Post-Save

```typescript
// isNew is ALWAYS false in post('save') hooks
// Mongoose sets it to false after successful save
// Capture it in pre('save') via $locals

userSchema.pre("save", function () {
  this.$locals.wasNew = this.isNew;
});

userSchema.post("save", function (doc) {
  if (doc.$locals.wasNew) {
    // Send welcome email only for new users
    console.log(`New user created: ${doc.email}`);
  }
});
```

**Why good:** `$locals` persists data between pre and post hooks on the same operation, solves the `isNew` gotcha where it's always false in post-save

### Bad Example -- Middleware After model()

```typescript
const User = model("User", userSchema);

// BAD: Registered AFTER model() -- SILENTLY IGNORED
userSchema.pre("save", function () {
  this.updatedAt = new Date();
});
// No error thrown -- this hook will never execute
```

**Why bad:** Middleware registered after `model()` compilation is silently ignored. No error, no warning -- data integrity silently broken.

### Bad Example -- Using next() on Mongoose 9

```typescript
// BAD: next() removed in Mongoose 9
userSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    // ... hash password
  }
  next(); // TypeError in Mongoose 9
});
```

**Why bad:** Mongoose 9 removed `next()` callback from pre hooks. Use async/await or return a Promise instead.

---

## Pattern 2: Error Handling Middleware

### Good Example -- Transform Duplicate Key Errors

```typescript
const DUPLICATE_KEY_ERROR = 11000;

userSchema.post("save", function (error: any, _doc: any, next: Function) {
  if (error.name === "MongoServerError" && error.code === DUPLICATE_KEY_ERROR) {
    next(new Error("A user with this email already exists"));
  } else {
    next(error);
  }
});
```

**Why good:** Named constant for error code, transforms cryptic MongoDB duplicate key error into user-friendly message, passes through other errors unchanged

### Good Example -- Validation Error Formatting

```typescript
userSchema.post("validate", function (error: any, _doc: any, next: Function) {
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    next(new Error(`Validation failed: ${messages.join(", ")}`));
  } else {
    next(error);
  }
});
```

**Why good:** Collects all validation error messages into a single readable string, preserves original error for non-validation errors

---

## Pattern 3: Query Middleware

### Good Example -- Soft Delete Filter

```typescript
// Automatically exclude soft-deleted documents from all find queries
userSchema.pre("find", function () {
  this.where({ deletedAt: { $exists: false } });
});

userSchema.pre("findOne", function () {
  this.where({ deletedAt: { $exists: false } });
});

userSchema.pre("countDocuments", function () {
  this.where({ deletedAt: { $exists: false } });
});
```

**Why good:** Consistent soft-delete filtering across all read operations, no application code needed to remember the filter

### Good Example -- Query Logging

```typescript
const SLOW_QUERY_THRESHOLD_MS = 100;

userSchema.pre("find", function () {
  this.set("startTime", Date.now());
});

userSchema.post("find", function (docs) {
  const startTime = this.get("startTime") as number;
  const duration = Date.now() - startTime;
  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`Slow query (${duration}ms):`, this.getFilter());
  }
});
```

**Why good:** Named constant for threshold, measures actual query execution time, logs only slow queries with their filters

---

## Pattern 4: Complete Soft Delete Plugin

### Good Example -- Reusable Soft Delete

```typescript
import { Schema, type Query } from "mongoose";

interface ISoftDeletable {
  deletedAt?: Date;
  deletedBy?: string;
}

function applySoftDelete<T>(schema: Schema<T & ISoftDeletable>): void {
  // Add soft-delete fields to the schema
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  });

  // Filter deleted documents from all queries by default
  schema.pre("find", function () {
    if (!this.getOptions().includeDeleted) {
      this.where({ deletedAt: null });
    }
  });

  schema.pre("findOne", function () {
    if (!this.getOptions().includeDeleted) {
      this.where({ deletedAt: null });
    }
  });

  schema.pre("countDocuments", function () {
    if (!this.getOptions().includeDeleted) {
      this.where({ deletedAt: null });
    }
  });

  // Add softDelete instance method
  schema.methods.softDelete = async function (deletedBy?: string) {
    this.deletedAt = new Date();
    this.deletedBy = deletedBy ?? null;
    return this.save();
  };

  // Add restore instance method
  schema.methods.restore = async function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}

export { applySoftDelete };
export type { ISoftDeletable };

// Usage:
// const postSchema = new Schema({ title: String, content: String });
// applySoftDelete(postSchema);
// const Post = model("Post", postSchema);
//
// Normal queries auto-exclude deleted:
//   await Post.find();
// Include deleted with escape hatch:
//   await Post.find().setOptions({ includeDeleted: true });
```

**Why good:** Reusable plugin function, automatic filtering on all query types, escape hatch with `includeDeleted` option, `softDelete` and `restore` methods on documents, uses `save()` so middleware fires on soft-delete

---

## Pattern 5: Middleware Ordering and Stacking

### Important: Middleware Stacks, Not Replaces

```typescript
// Multiple pre('save') hooks ALL run -- they don't replace each other
userSchema.pre("save", function () {
  console.log("Hook 1 runs");
});

userSchema.pre("save", function () {
  console.log("Hook 2 also runs");
});

// Both hooks execute in registration order
```

### Execution Order for save()

```
1. pre('validate')  -- schema validation hasn't run yet
2. post('validate') -- schema validation passed
3. pre('save')      -- document about to be written
4. post('save')     -- document successfully written
```

**Key insight:** `save()` automatically triggers `validate()` first. All `pre('validate')` and `post('validate')` hooks run before any `pre('save')` hook.

---

## Middleware Type Reference

See [reference.md](../reference.md#middleware-execution-matrix) for the complete middleware execution matrix showing which operations trigger which hooks.

---

_For core patterns, see [core.md](core.md). For population, see [population.md](population.md). For transactions, see [transactions.md](transactions.md)._
