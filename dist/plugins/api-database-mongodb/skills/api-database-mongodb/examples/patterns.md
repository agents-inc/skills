# MongoDB Advanced Patterns

> Schema design (embedding vs referencing), transactions, middleware hooks, and virtuals. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Indexes:** See [indexes.md](indexes.md).

---

## Pattern 1: Embedding vs Referencing

### Good Example -- Embedding (Co-Accessed Data)

```typescript
import { Schema, model } from "mongoose";

// Embed addresses directly in the user document
// Addresses are always accessed with the user and are bounded (few per user)
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    addresses: [
      {
        label: { type: String, required: true }, // "home", "work", "shipping"
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark"] as const,
        default: "light",
      },
      language: { type: String, default: "en" },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true },
);

const User = model("User", userSchema);
export { User };
```

**Why good:** Addresses are always accessed with the user, bounded (few per user), and never shared between users; preferences are a one-to-one relationship; single read fetches everything needed

### Good Example -- Referencing (Independent Data)

```typescript
import { Schema, model } from "mongoose";

// Reference posts from user -- posts are independent, unbounded, and accessed separately
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // Do NOT embed posts array -- it grows unbounded
});

const postSchema = new Schema(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"] as const,
      default: "draft",
    },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

const User = model("User", userSchema);
const Post = model("Post", postSchema);

export { User, Post };
```

**Why good:** Posts grow unbounded, are accessed independently, and can be queried/paginated without loading the user; index on `authorId` for efficient lookups

### Bad Example -- Embedding Unbounded Data

```typescript
// BAD: Embedding an unbounded array
const userSchema = new Schema({
  name: String,
  email: String,
  // Posts array grows without limit -- will hit 16 MB document limit
  posts: [
    {
      title: String,
      content: String, // Large text per post
      comments: [{ content: String, authorId: Schema.Types.ObjectId }],
    },
  ],
});
```

**Why bad:** Posts grow unbounded and hit the 16 MB document size limit, deeply nested comments make querying difficult, updating one post requires reading/writing the entire user document

### Good Example -- Hybrid Pattern (Denormalization)

```typescript
// Store frequently-accessed subset in the parent, full data in separate collection
const orderSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    // Denormalized customer info for display (avoids populate on every read)
    customerSnapshot: {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        // Denormalized product info (price at time of order)
        name: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "shipped", "delivered"] as const,
    },
  },
  { timestamps: true },
);

export { orderSchema };
```

**Why good:** Customer snapshot avoids populate on every order read, product price captured at order time (immutable), full customer data still available via `customerId` when needed

---

## Pattern 2: Transactions

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
    await session.withTransaction(async () => {
      // Debit source account
      const source = await Account.findOneAndUpdate(
        { _id: fromAccountId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true, session },
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

      // Record the transfer
      await Transfer.create(
        [
          {
            fromAccountId,
            toAccountId,
            amount,
            status: "completed",
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

export { transferFunds };
```

**Why good:** `withTransaction` handles commit/abort/retry automatically, `{ session }` passed to every operation, balance check with `$gte` prevents overdraft atomically, `finally` ensures session cleanup

### Bad Example -- Missing Session

```typescript
// BAD: Operations outside the transaction
const session = await mongoose.startSession();
session.startTransaction();

await Account.findOneAndUpdate(
  { _id: fromId },
  { $inc: { balance: -amount } },
  // Missing { session } -- this runs OUTSIDE the transaction!
);

await Account.findOneAndUpdate(
  { _id: toId },
  { $inc: { balance: amount } },
  { session }, // Only this one is in the transaction
);

await session.commitTransaction();
```

**Why bad:** First update runs outside the transaction and cannot be rolled back, inconsistent state if second update fails, must pass `{ session }` to EVERY operation

### Good Example -- AsyncLocalStorage (Mongoose 8.4+)

```typescript
// Enable automatic session propagation
mongoose.set("transactionAsyncLocalStorage", true);

async function createOrderWithTransaction(
  orderData: OrderInput,
): Promise<void> {
  await mongoose.connection.transaction(async () => {
    // No { session } needed -- automatically propagated
    const order = await Order.create(orderData);

    await Product.updateMany(
      { _id: { $in: orderData.items.map((i) => i.productId) } },
      { $inc: { stock: -1 } },
    );

    await Customer.findByIdAndUpdate(orderData.customerId, {
      $push: { orderIds: order._id },
    });
  });
}

export { createOrderWithTransaction };
```

**Why good:** `transactionAsyncLocalStorage` eliminates manual session passing, cleaner code, no risk of forgetting `{ session }`

**When to use:** Mongoose 8.4+ projects where all operations within a request flow through the same async context

---

## Pattern 3: Middleware Hooks

### Good Example -- Pre-Save Middleware

```typescript
import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import slugify from "slugify";

const SALT_ROUNDS = 12;

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  slug: { type: String, unique: true },
});

// Hash password before saving -- only if modified
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  }
});

// Generate slug from name
userSchema.pre("save", function () {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

// MUST register middleware BEFORE model()
const User = model("User", userSchema);
export { User };
```

**Why good:** `isModified` check prevents re-hashing on every save, named constant for salt rounds, middleware defined before `model()` call, slug auto-generated from name

### Good Example -- Post-Save for Side Effects

```typescript
userSchema.post("save", function (doc) {
  // Send welcome email for new users
  if (doc.isNew) {
    emailService.sendWelcome(doc.email, doc.name);
  }
});
```

### Good Example -- Error Handling Middleware

```typescript
const DUPLICATE_KEY_ERROR = 11000;

userSchema.post("save", function (error: any, _doc: any, next: Function) {
  if (error.name === "MongoServerError" && error.code === DUPLICATE_KEY_ERROR) {
    next(new Error("Email already exists"));
  } else {
    next(error);
  }
});
```

**Why good:** Named constant for error code, transforms cryptic MongoDB error into user-friendly message, passes through other errors unchanged

### Good Example -- Query Middleware

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

**Why good:** Soft-delete filter applied automatically to all read queries, consistent across find/findOne/countDocuments

### Bad Example -- Middleware After Model

```typescript
const User = model("User", userSchema);

// BAD: Registered AFTER model() -- this hook is SILENTLY IGNORED
userSchema.pre("save", function () {
  this.updatedAt = new Date();
});
```

**Why bad:** Middleware registered after `model()` is silently ignored, no error thrown, data integrity silently broken

---

## Pattern 4: Virtuals

### Good Example -- Computed Properties

```typescript
import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Read-only virtual
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual with getter and setter
userSchema
  .virtual("displayName")
  .get(function () {
    return `${this.firstName} ${this.lastName}`;
  })
  .set(function (fullName: string) {
    const parts = fullName.split(" ");
    this.firstName = parts[0] ?? "";
    this.lastName = parts.slice(1).join(" ");
  });

// Virtual for domain extraction
userSchema.virtual("emailDomain").get(function () {
  return this.email.slice(this.email.indexOf("@") + 1);
});

const User = model("User", userSchema);
export { User };
```

**Why good:** Schema options enable virtuals in JSON/object conversion, getter + setter for two-way virtual, multiple virtuals for different computed values

### Good Example -- Populate Virtual (Foreign Key on Other Collection)

```typescript
const authorSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
});

// Virtual populate -- look up posts where Post.authorId matches Author._id
authorSchema.virtual("posts", {
  ref: "Post",
  localField: "_id",
  foreignField: "authorId",
  options: { sort: { createdAt: -1 } },
});

// Usage
const author = await Author.findById(id).populate("posts");
// author.posts is an array of Post documents
```

**Why good:** Virtual populate for reverse relationships, no array stored on author document, sort option for consistent ordering, avoids embedding posts in the author

---

## Pattern 5: Soft Delete Pattern

### Good Example -- Soft Delete with Middleware

```typescript
import { Schema, model, type Query } from "mongoose";

interface ISoftDeletable {
  deletedAt?: Date;
  deletedBy?: string;
}

function applySoftDelete<T>(schema: Schema<T & ISoftDeletable>): void {
  // Add fields
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  });

  // Filter deleted documents from all queries
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

  // Add soft delete method
  schema.methods.softDelete = async function (deletedBy?: string) {
    this.deletedAt = new Date();
    this.deletedBy = deletedBy ?? null;
    return this.save();
  };

  // Add restore method
  schema.methods.restore = async function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}

// Usage
const postSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
});

applySoftDelete(postSchema);

const Post = model("Post", postSchema);

// Normal queries automatically exclude deleted
const posts = await Post.find(); // Only non-deleted

// Include deleted with option
const allPosts = await Post.find().setOptions({ includeDeleted: true });

export { Post, applySoftDelete };
```

**Why good:** Reusable plugin function, automatic filtering on all queries, escape hatch with `includeDeleted` option, `softDelete` and `restore` methods on documents

---

## Pattern 6: Discriminators (Single Collection Inheritance)

### Good Example -- Event System

```typescript
import { Schema, model } from "mongoose";

// Base event schema
const eventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    discriminatorKey: "eventType",
    timestamps: true,
  },
);

const Event = model("Event", eventSchema);

// Discriminator for page views
const PageViewEvent = Event.discriminator(
  "PageView",
  new Schema({
    url: { type: String, required: true },
    referrer: { type: String },
    duration: { type: Number }, // seconds
  }),
);

// Discriminator for purchases
const PurchaseEvent = Event.discriminator(
  "Purchase",
  new Schema({
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
  }),
);

// Query all events
const allEvents = await Event.find({ userId });

// Query only purchases
const purchases = await PurchaseEvent.find({ userId, amount: { $gte: 100 } });

export { Event, PageViewEvent, PurchaseEvent };
```

**Why good:** Single collection for all events (efficient indexing), discriminator key for type differentiation, each subtype has its own validation, can query base or specific types

---

_For core patterns, see [core.md](core.md). For query patterns, see [queries.md](queries.md). For aggregation, see [aggregation.md](aggregation.md). For indexes, see [indexes.md](indexes.md)._
