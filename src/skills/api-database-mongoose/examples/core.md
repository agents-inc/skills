# Mongoose - Core Examples

> Connection, schema definition, TypeScript typing, model creation, CRUD, and validation. See [SKILL.md](../SKILL.md) for core concepts.

**Middleware & lifecycle:** See [middleware.md](middleware.md). **Population & relationships:** See [population.md](population.md). **Transactions & advanced:** See [transactions.md](transactions.md).

---

## Pattern 1: Connection Setup

### Good Example -- Production Connection

```typescript
import mongoose from "mongoose";

const POOL_SIZE_MAX = 10;
const POOL_SIZE_MIN = 2;
const SERVER_SELECTION_TIMEOUT_MS = 5000;
const SOCKET_TIMEOUT_MS = 45000;

async function connectDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    const connection = await mongoose.connect(uri, {
      maxPoolSize: POOL_SIZE_MAX,
      minPoolSize: POOL_SIZE_MIN,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: SOCKET_TIMEOUT_MS,
      retryWrites: true,
      retryReads: true,
    });

    console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
    return connection;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export { connectDatabase };
```

**Why good:** Environment variable for URI, named constants for all numeric values, try/catch for initial connection, typed return

### Good Example -- Connection Events and Graceful Shutdown

```typescript
function setupConnectionEvents(): void {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
}

async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}

process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

export { setupConnectionEvents, disconnectDatabase };
```

**Why good:** Handles all critical lifecycle events, different log levels for severity, graceful shutdown on SIGINT

### Good Example -- Multiple Connections (Multi-Database)

```typescript
import mongoose from "mongoose";

// createConnection() returns a separate Connection object
// Each connection has its own pool, models, and middleware
const primaryDb = await mongoose
  .createConnection(process.env.PRIMARY_MONGODB_URI!)
  .asPromise();

const analyticsDb = await mongoose
  .createConnection(process.env.ANALYTICS_MONGODB_URI!)
  .asPromise();

// Models are bound to their specific connection
const User = primaryDb.model("User", userSchema);
const AnalyticsEvent = analyticsDb.model("AnalyticsEvent", eventSchema);

export { User, AnalyticsEvent };
```

**Why good:** Separate pools for different workloads, `.asPromise()` for await support, models explicitly bound to connections

### Bad Example -- Hardcoded Connection

```typescript
// BAD: Everything wrong
mongoose.connect("mongodb://admin:password123@localhost:27017/mydb");
```

**Why bad:** Hardcoded credentials in source code, `localhost` fails on Node.js 18+ (IPv6 preference), no pool configuration, no error handling

---

## Pattern 2: Schema Definition with Validation

### Good Example -- Complete Schema

```typescript
import { Schema, model } from "mongoose";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_PRICE = 0;
const SKU_PATTERN = /^[A-Z]{2}-\d{6}$/;

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      minlength: [
        MIN_NAME_LENGTH,
        `Name must be at least ${MIN_NAME_LENGTH} characters`,
      ],
      maxlength: [
        MAX_NAME_LENGTH,
        `Name must be at most ${MAX_NAME_LENGTH} characters`,
      ],
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      match: [SKU_PATTERN, "SKU must match format XX-000000"],
    },
    price: {
      type: Number,
      required: true,
      min: [MIN_PRICE, "Price cannot be negative"],
      validate: {
        validator: (v: number) => Number.isFinite(v),
        message: "Price must be a finite number",
      },
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: ["electronics", "clothing", "food", "books"] as const,
        message: "{VALUE} is not a valid category",
      },
    },
    tags: { type: [String], default: [] },
    specifications: { type: Map, of: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const Product = model("Product", productSchema);
export { Product, productSchema };
```

**Why good:** Named constants for validation limits, custom error messages on every validator, `as const` preserves enum literal types, trim/uppercase transforms, Map for flexible key-value data, schema options for timestamps and virtual serialization

### Good Example -- Subdocument Schema

```typescript
import { Schema, model } from "mongoose";

const addressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true, match: /^\d{5}(-\d{4})?$/ },
    country: { type: String, default: "US" },
  },
  { _id: false }, // No separate _id for embedded subdocuments
);

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    shippingAddress: { type: addressSchema, required: true },
    billingAddress: { type: addressSchema },
    addresses: {
      type: [addressSchema],
      validate: {
        validator: (v: unknown[]) => v.length <= 10,
        message: "Maximum 10 addresses allowed",
      },
    },
  },
  { timestamps: true },
);

const Customer = model("Customer", customerSchema);
export { Customer, customerSchema, addressSchema };
```

**Why good:** Reusable subdocument schema, `{ _id: false }` avoids unnecessary ObjectIds on embedded documents, array-level validation to bound the array size, schema reused for both shipping and billing

### Bad Example -- No Validation

```typescript
// BAD: No validation, no types, no constraints
const userSchema = new Schema({
  name: String,
  email: String,
  age: Number,
  role: String,
});
```

**Why bad:** No `required` constraints (all fields optional), no validation rules, no enum for role, no custom error messages, no trim/lowercase transforms

---

## Pattern 3: TypeScript -- Automatic Inference

### Good Example -- Simple Model (Preferred)

```typescript
import { Schema, model, type InferSchemaType } from "mongoose";

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// TypeScript automatically infers the document type
const BlogPost = model("BlogPost", blogPostSchema);

// Extract the inferred type for use in other files
type BlogPostDoc = InferSchemaType<typeof blogPostSchema>;

export { BlogPost, blogPostSchema };
export type { BlogPostDoc };
```

**Why good:** No manual interface duplication, TypeScript infers types from schema, `InferSchemaType` exports the shape for consumers, named exports

### Good Example -- Full Typing with Methods, Statics, and Virtuals

```typescript
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

const SALT_ROUNDS = 12;

// 1. Raw document interface (what's stored in MongoDB)
interface IUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "moderator";
  lastLoginAt?: Date;
}

// 2. Instance methods interface
interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  updateLastLogin(): Promise<void>;
}

// 3. Virtuals interface
interface IUserVirtuals {
  fullName: string;
}

// 4. Static methods interface
interface IUserStatics {
  findByEmail(email: string): Promise<UserDocument | null>;
}

// 5. Composed model type = Model + Statics
type UserModel = Model<IUser, {}, IUserMethods, IUserVirtuals> & IUserStatics;

// 6. Hydrated document type for external consumers
type UserDocument = HydratedDocument<IUser, IUserMethods & IUserVirtuals>;

// 7. Schema with all generic parameters
const userSchema = new Schema<
  IUser,
  UserModel,
  IUserMethods,
  {},
  IUserVirtuals
>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "user", "moderator"],
      default: "user",
    },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash; // Never expose password hash
        return ret;
      },
    },
  },
);

// Instance methods
userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  // Use bcrypt.compare(candidate, this.passwordHash) in production
  return candidate === this.passwordHash;
};

userSchema.methods.updateLastLogin = async function (): Promise<void> {
  this.lastLoginAt = new Date();
  await this.save();
};

// Virtuals
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Static methods
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Middleware -- MUST be defined BEFORE model()
userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    // Hash password here (e.g., bcrypt.hash(this.passwordHash, SALT_ROUNDS))
  }
});

// model() -- AFTER all middleware, methods, virtuals, and statics
const User = model<IUser, UserModel>("User", userSchema);

export { User, userSchema };
export type { IUser, IUserMethods, UserDocument };
```

**Why good:** Separate interfaces for document/methods/virtuals/statics, correct generic parameter order on Schema and model, `HydratedDocument` type exported for consumers, password excluded from JSON, middleware registered before `model()`, named constants

### Bad Example -- Type Duplication

```typescript
// BAD: Interface duplicates schema -- they drift apart
interface IProduct {
  name: string; // says required
  price: number; // says required
}

const productSchema = new Schema({
  name: String, // actually optional -- no 'required'
  price: Number, // no validation
});

// Interface says name is always string, but schema allows undefined
const Product = model<IProduct>("Product", productSchema);
```

**Why bad:** Interface and schema define different constraints, they will drift out of sync, TypeScript thinks `name` is always defined but MongoDB allows undefined

---

## Pattern 4: ObjectId References

### Good Example -- Typed References

```typescript
import { Schema, model } from "mongoose";

const commentSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId, // Schema.Types.ObjectId in schema definition
      ref: "BlogPost",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    }, // Self-reference for threads
    content: { type: String, required: true, maxlength: 5000 },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Compound index for common query pattern
commentSchema.index({ postId: 1, createdAt: -1 });

const Comment = model("Comment", commentSchema);
export { Comment, commentSchema };
```

**Why good:** `Schema.Types.ObjectId` in schema (not `Types.ObjectId`), `ref` for populate support, indexes on foreign keys, compound index for common query

### Bad Example -- Wrong ObjectId Type

```typescript
import { Types } from "mongoose";

// BAD: Using Types.ObjectId in schema definition
const schema = new Schema({
  userId: { type: Types.ObjectId, ref: "User" }, // WRONG type for schema
});
```

**Why bad:** `Types.ObjectId` is for TypeScript interfaces and runtime values. `Schema.Types.ObjectId` is the correct type for schema definitions.

---

## Pattern 5: CRUD Operations

### Good Example -- Create

```typescript
// Single document -- triggers pre('save') middleware
const user = await User.create({
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
});

// Bulk insert -- triggers insertMany middleware, NOT save middleware
const BATCH_SIZE = 1000;
const users = generateUsers(BATCH_SIZE);
await User.insertMany(users, { ordered: false });
// ordered: false continues inserting after errors (skips duplicates)
```

### Good Example -- Read with Lean

```typescript
const PAGE_SIZE = 20;

// Read-only response -- use lean()
const user = await User.findById(id).lean();

// Paginated list
const activeAdmins = await User.find({ role: "admin", isActive: true })
  .select("name email role")
  .sort({ name: 1 })
  .limit(PAGE_SIZE)
  .lean();
```

**Why good:** `.lean()` for read-only responses (3x memory savings), `.select()` for projection, named constant for page size

### Good Example -- Update

```typescript
// Update with save() -- triggers pre('save') middleware
const user = await User.findById(id);
if (!user) {
  throw new Error(`User not found: ${id}`);
}
user.name = "Updated Name";
await user.save();

// Direct update -- does NOT trigger save middleware
await User.findByIdAndUpdate(
  id,
  { $set: { name: "Updated" } },
  { new: true, runValidators: true },
);

// Bulk update
await User.updateMany(
  { isActive: false },
  { $set: { archivedAt: new Date() } },
);
```

**Why good:** `save()` when middleware matters, `{ new: true }` returns updated document, `{ runValidators: true }` enforces schema validation on direct updates

### Good Example -- Delete

```typescript
await User.findByIdAndDelete(id);

const DAYS_TO_KEEP = 30;
const cutoffDate = new Date(Date.now() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
await User.deleteMany({ isActive: false, archivedAt: { $lt: cutoffDate } });
```

### Bad Example -- Lean Then Save

```typescript
// BAD: lean() returns plain objects -- no Mongoose methods
const user = await User.findById(id).lean();
user.name = "Updated";
await user.save(); // TypeError: user.save is not a function
```

**Why bad:** `.lean()` returns plain JavaScript objects without Mongoose methods. Cannot call `.save()`, `.populate()`, or any instance method.

### Bad Example -- Missing runValidators

```typescript
// BAD: Schema validation skipped on direct updates by default
await User.findByIdAndUpdate(id, {
  $set: { email: "not-an-email" }, // No validation! Saves invalid data
});
```

**Why bad:** `findByIdAndUpdate` skips schema validation by default. Always pass `{ runValidators: true }` to enforce validation on direct updates.

---

## Pattern 6: Schema Options

### Good Example -- Comprehensive Options

```typescript
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resource: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    // Include virtuals in JSON and object output
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true },
    // Optimistic concurrency control (uses __v)
    optimisticConcurrency: true,
    // Explicit collection name (default: lowercase plural of model name)
    collection: "audit_logs",
    // Disable automatic index creation in production
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

export { auditLogSchema };
```

**Why good:** Virtuals in serialization, version key hidden from JSON, optimistic concurrency for safe concurrent updates, explicit collection name, autoIndex disabled in production (create indexes via migration scripts instead)

---

_For middleware patterns, see [middleware.md](middleware.md). For population, see [population.md](population.md). For transactions, see [transactions.md](transactions.md)._
