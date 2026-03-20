# Mongoose - Population & Relationships Examples

> Populate, virtual populate, discriminators, and embedding vs referencing. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand schema definition and ObjectId references from [core.md](core.md).

**Middleware:** See [middleware.md](middleware.md). **Transactions:** See [transactions.md](transactions.md).

---

## Pattern 1: Populate with Field Selection

### Good Example -- Selective Population

```typescript
const MAX_COMMENTS = 50;

const post = await BlogPost.findById(id)
  .populate("authorId", "name email avatar") // Only these fields from author
  .populate({
    path: "comments",
    select: "content authorId createdAt",
    options: {
      sort: { createdAt: -1 },
      limit: MAX_COMMENTS,
    },
    populate: {
      path: "authorId",
      select: "name avatar", // Nested populate for comment authors
    },
  })
  .lean();
```

**Why good:** Field selection on every populate call reduces data transfer, limit on nested array prevents unbounded results, nested populate for deep references, sorted by recency

### Good Example -- Conditional Population

```typescript
interface PopulateConfig {
  includeAuthor?: boolean;
  includeComments?: boolean;
}

async function getPost(id: string, config: PopulateConfig = {}) {
  let query = BlogPost.findById(id);

  if (config.includeAuthor) {
    query = query.populate("authorId", "name email");
  }

  if (config.includeComments) {
    query = query.populate({
      path: "comments",
      select: "content createdAt",
      options: { limit: 20, sort: { createdAt: -1 } },
    });
  }

  return query.lean();
}

export { getPost };
```

**Why good:** Populate only when needed (each populate is a separate DB query), chainable query builder, avoids unnecessary round-trips

### Bad Example -- Unbounded Populate

```typescript
// BAD: Populating all fields, no limits
const post = await BlogPost.findById(id)
  .populate("authorId") // ALL author fields
  .populate("comments") // ALL comments -- could be thousands
  .populate("relatedPosts"); // ALL related posts

// Each populate is a separate DB query with no bounds
```

**Why bad:** No field selection wastes bandwidth and memory, no limit on comments could return thousands of documents, each populate adds a database round-trip

---

## Pattern 2: Virtual Populate (Reverse References)

### Good Example -- Populate Virtual

```typescript
import { Schema, model } from "mongoose";

const authorSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual populate -- look up posts where Post.authorId matches Author._id
// No array stored on the author document
authorSchema.virtual("posts", {
  ref: "Post",
  localField: "_id",
  foreignField: "authorId",
  options: { sort: { createdAt: -1 } },
});

// Virtual with count only (more efficient when you just need the count)
authorSchema.virtual("postCount", {
  ref: "Post",
  localField: "_id",
  foreignField: "authorId",
  count: true, // Only returns the count, not the documents
});

const Author = model("Author", authorSchema);

// Usage
const author = await Author.findById(id)
  .populate("posts")
  .populate("postCount");
// author.posts = Post[] (array of post documents)
// author.postCount = number

export { Author };
```

**Why good:** Virtual populate for reverse relationships without storing an array on the parent, `count: true` for efficient counts, sort option for consistent ordering, schema options to include virtuals in serialization

---

## Pattern 3: Virtuals (Computed Properties)

### Good Example -- Getter and Setter Virtuals

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

// Virtual with getter AND setter
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

// Computed virtual from another field
userSchema.virtual("emailDomain").get(function () {
  return this.email.slice(this.email.indexOf("@") + 1);
});

const User = model("User", userSchema);
export { User };
```

**Why good:** Schema options enable virtuals in JSON/object serialization (otherwise they're invisible in API responses), getter + setter for two-way virtual, multiple computed virtuals

### Important Gotcha

```typescript
// BAD: Forgetting toJSON option -- virtuals disappear in API responses
const schema = new Schema({ firstName: String, lastName: String });
schema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const doc = await Model.findById(id);
JSON.stringify(doc); // { firstName: "John", lastName: "Doe" } -- no fullName!
```

**Why bad:** Virtual properties are excluded from `toJSON()`/`toObject()` by default. Must set `{ toJSON: { virtuals: true } }` in schema options.

---

## Pattern 4: Discriminators (Single Collection Inheritance)

### Good Example -- Event System with Discriminators

```typescript
import { Schema, model } from "mongoose";

// Base event schema
const eventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    discriminatorKey: "eventType",
    timestamps: true,
  },
);

const Event = model("Event", eventSchema);

// Discriminator for page views -- adds type-specific fields
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

// Query all events (returns mixed types)
const allEvents = await Event.find({ userId: someUserId });

// Query only purchases (returns only PurchaseEvent documents)
const MIN_PURCHASE_AMOUNT = 100;
const purchases = await PurchaseEvent.find({
  userId: someUserId,
  amount: { $gte: MIN_PURCHASE_AMOUNT },
});

export { Event, PageViewEvent, PurchaseEvent };
```

**Why good:** Single collection for all events (efficient indexing on shared fields), `discriminatorKey` specifies which field stores the type, each subtype has its own schema and validation, can query base type for all events or specific type for filtered results

---

## Pattern 5: Embedding vs Referencing

### Good Example -- Embedding (Co-Accessed, Bounded Data)

```typescript
import { Schema, model } from "mongoose";

// Addresses are always accessed with the user and bounded (few per user)
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    addresses: [
      {
        label: { type: String, required: true }, // "home", "work"
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
    },
  },
  { timestamps: true },
);

const User = model("User", userSchema);
export { User };
```

**Why good:** Addresses always accessed with user, bounded (few per user), never shared between users, single read fetches everything

### Good Example -- Referencing (Independent, Unbounded Data)

```typescript
// Posts are independent, unbounded, and accessed separately from the user
const postSchema = new Schema(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index on foreign key for efficient lookups
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

const Post = model("Post", postSchema);
export { Post };
```

**Why good:** Posts grow without limit, accessed independently, can be queried/paginated without loading the user, index on `authorId` for efficient lookups

### Good Example -- Denormalization (Hybrid Pattern)

```typescript
// Store snapshot of frequently-accessed data in the parent
const orderSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    // Denormalized snapshot avoids populate on every read
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
        // Price at time of order (immutable -- not current price)
        name: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    total: { type: Number, required: true },
  },
  { timestamps: true },
);

export { orderSchema };
```

**Why good:** Customer snapshot avoids populate on every order read, product price captured at order time (won't change if product price changes later), full customer data available via `customerId` when needed

### Bad Example -- Embedding Unbounded Data

```typescript
// BAD: Embedding an unbounded array
const userSchema = new Schema({
  name: String,
  posts: [
    {
      title: String,
      content: String, // Large text per post
      comments: [{ content: String, authorId: Schema.Types.ObjectId }],
    },
  ],
});
```

**Why bad:** Posts grow unbounded and hit 16 MB document size limit, deeply nested comments make querying impossible, updating one post requires reading/writing the entire user document

---

_For core patterns, see [core.md](core.md). For middleware, see [middleware.md](middleware.md). For transactions, see [transactions.md](transactions.md)._
