# MongoDB Core Examples

> Connection patterns, schema definition, model creation, and TypeScript typing. See [SKILL.md](../SKILL.md) for core concepts.

**Query patterns:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Advanced:** See [patterns.md](patterns.md). **Indexes:** See [indexes.md](indexes.md).

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

**Why good:** Environment variable for URI, named constants for all numeric values, try/catch for initial connection errors, typed return

### Good Example -- Connection Event Handling

```typescript
function setupConnectionEvents(): void {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected -- attempting reconnect");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
}

export { setupConnectionEvents };
```

**Why good:** Handles all critical connection lifecycle events, different log levels for different events

### Good Example -- Graceful Shutdown

```typescript
async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}

process.on("SIGINT", async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDatabase();
  process.exit(0);
});

export { disconnectDatabase };
```

### Bad Example -- Hardcoded Connection

```typescript
// BAD: Everything wrong
mongoose.connect("mongodb://admin:password123@localhost:27017/mydb");
```

**Why bad:** Hardcoded credentials in source code, `localhost` fails on Node.js 18+ (IPv6 preference), no pool configuration, no error handling, no connection options

### Good Example -- Multiple Connections

```typescript
import mongoose from "mongoose";

const primaryConnection = await mongoose
  .createConnection(process.env.PRIMARY_MONGODB_URI!)
  .asPromise();

const analyticsConnection = await mongoose
  .createConnection(process.env.ANALYTICS_MONGODB_URI!)
  .asPromise();

// Models bound to specific connections
const User = primaryConnection.model("User", userSchema);
const AnalyticsEvent = analyticsConnection.model("AnalyticsEvent", eventSchema);

export { User, AnalyticsEvent };
```

**Why good:** Separate connection pools for different workloads, `asPromise()` for await, models explicitly bound to connections

---

## Pattern 2: Schema Definition

### Good Example -- Complete Schema with Validation

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
    description: {
      type: String,
      maxlength: 2000,
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
    tags: {
      type: [String],
      default: [],
    },
    specifications: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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

**Why good:** Named constants for validation limits, custom error messages on every validator, enum with `as const`, schema options for timestamps and virtual serialization, trim/uppercase transformations, Map type for flexible key-value data

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
  { _id: false }, // No separate _id for subdocuments
);

const orderSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
      },
    ],
    shippingAddress: { type: addressSchema, required: true },
    billingAddress: { type: addressSchema, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ] as const,
      default: "pending",
    },
    total: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

const Order = model("Order", orderSchema);
export { Order, orderSchema, addressSchema };
```

**Why good:** Reusable subdocument schema, `{ _id: false }` avoids unnecessary ObjectIds on embedded documents, ref fields for population, array of subdocuments for order items

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

**Why bad:** No `required` constraints, no validation rules, no enum for role, no custom error messages, no trim/lowercase transforms on strings

---

## Pattern 3: TypeScript Model Typing

### Good Example -- Automatic Inference (Simple Models)

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
    publishedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// TypeScript automatically infers the document type
const BlogPost = model("BlogPost", blogPostSchema);

// Extract the inferred type for use in other files
type BlogPostDocument = InferSchemaType<typeof blogPostSchema>;

export { BlogPost, blogPostSchema };
export type { BlogPostDocument };
```

**Why good:** No manual interface duplication, TypeScript infers types from schema, `InferSchemaType` exports the inferred type, named exports

### Good Example -- Full Typing with Methods, Statics, Virtuals

```typescript
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// Raw document interface
interface IUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "moderator";
  lastLoginAt?: Date;
}

// Instance methods
interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  updateLastLogin(): Promise<void>;
}

// Virtuals
interface IUserVirtuals {
  fullName: string;
}

// Static methods
interface IUserStatics {
  findByEmail(email: string): Promise<UserDocument | null>;
  findAdmins(): Promise<UserDocument[]>;
}

// Composed model type
type UserModel = Model<IUser, {}, IUserMethods, IUserVirtuals> & IUserStatics;

// Hydrated document type for external use
type UserDocument = HydratedDocument<IUser, IUserMethods & IUserVirtuals>;

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
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

// Instance methods
userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
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

userSchema.statics.findAdmins = function () {
  return this.find({ role: "admin" });
};

// Middleware -- MUST be defined before model()
userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  }
});

// Model -- AFTER middleware registration
const User = model<IUser, UserModel>("User", userSchema);

export { User, userSchema };
export type { IUser, IUserMethods, UserDocument };
```

**Why good:** Separate interfaces for document, methods, virtuals, statics; generic parameters in correct order; `HydratedDocument` type for external consumers; password excluded from JSON; middleware registered before `model()`; named constants for salt rounds

### Bad Example -- Type Duplication

```typescript
// BAD: Interface duplicates schema -- they can drift apart
interface IProduct {
  name: string;
  price: number;
  category: string;
}

const productSchema = new Schema({
  name: String, // No 'required' -- schema allows undefined
  price: Number, // No validation
  category: String, // No enum -- interface says string, could be anything
});

// Interface says name is always string, but schema allows it to be undefined
const Product = model<IProduct>("Product", productSchema);
```

**Why bad:** Interface and schema define different constraints, interface claims `name` is always `string` but schema allows undefined, no validation, types will drift apart over time

---

## Pattern 4: ObjectId References

### Good Example -- Typed References

```typescript
import { Schema, model, type Types } from "mongoose";

const commentSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
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
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null }, // Self-reference for threads
    content: { type: String, required: true, maxlength: 5000 },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index for efficient lookups
commentSchema.index({ postId: 1, createdAt: -1 });

const Comment = model("Comment", commentSchema);
export { Comment, commentSchema };
```

**Why good:** `Schema.Types.ObjectId` in schema definition (not `Types.ObjectId`), `ref` for populate support, indexes on foreign keys, compound index for common query pattern

### Bad Example -- Wrong ObjectId Type

```typescript
import { Types } from "mongoose";

// BAD: Using Types.ObjectId in schema definition
const schema = new Schema({
  userId: { type: Types.ObjectId, ref: "User" }, // WRONG -- use Schema.Types.ObjectId
});
```

**Why bad:** `Types.ObjectId` is for TypeScript interfaces and runtime values; `Schema.Types.ObjectId` is the correct schema type declaration

---

## Pattern 5: Schema Options

### Good Example -- Comprehensive Schema Options

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
    // Include virtuals in JSON and object conversion
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true },
    // Optimistic concurrency control
    optimisticConcurrency: true,
    // Collection name override (default: lowercase plural of model name)
    collection: "audit_logs",
    // Disable automatic index creation in production
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

export { auditLogSchema };
```

**Why good:** Virtuals included in serialization, version key hidden from JSON, optimistic concurrency for safe updates, explicit collection name, autoIndex disabled in production

---

_For query patterns, see [queries.md](queries.md). For aggregation, see [aggregation.md](aggregation.md). For advanced patterns, see [patterns.md](patterns.md). For indexes, see [indexes.md](indexes.md)._
