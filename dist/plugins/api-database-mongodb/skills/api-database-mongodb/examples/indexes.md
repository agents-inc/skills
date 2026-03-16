# MongoDB Index Examples

> Index types, compound indexes, text search, geospatial, TTL, Atlas Search, and performance patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Aggregation:** See [aggregation.md](aggregation.md). **Advanced:** See [patterns.md](patterns.md).

---

## Pattern 1: Single-Field Indexes

### Good Example -- Common Query Fields

```typescript
import { Schema, model } from "mongoose";

const userSchema = new Schema({
  email: { type: String, required: true, unique: true }, // unique creates index
  role: { type: String, index: true }, // simple index
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
});

// Explicit index definition (equivalent to inline `index: true`)
userSchema.index({ lastLoginAt: -1 }); // Descending for "most recent" queries

const User = model("User", userSchema);
export { User };
```

**Why good:** `unique: true` creates a unique index, inline `index: true` for frequently queried fields, explicit index for sort order control, descending for recency queries

### Bad Example -- Index on Low-Cardinality Field

```typescript
// BAD: Boolean fields have only 2 values -- index provides minimal benefit
const schema = new Schema({
  isActive: { type: Boolean, index: true }, // Only true/false -- poor selectivity
  status: { type: String },
});
```

**Why bad:** Boolean fields have very low cardinality (2 values), the index doesn't significantly narrow results, wastes storage and slows writes; use compound index with higher-cardinality field first

---

## Pattern 2: Compound Indexes (ESR Rule)

Follow the **Equality-Sort-Range** rule for compound index field order.

### Good Example -- ESR Compound Index

```typescript
const orderSchema = new Schema({
  status: { type: String, enum: ["pending", "shipped", "delivered"] as const },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  total: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

// Query: Find orders by status, sorted by date, with total > threshold
// Filter: { status: "shipped", total: { $gte: 100 } }, sort: { createdAt: -1 }
//
// ESR Rule:
// 1. Equality: status (exact match)
// 2. Sort: createdAt (sort order)
// 3. Range: total (range comparison)
orderSchema.index({ status: 1, createdAt: -1, total: 1 });

// Query: Find customer orders sorted by date
// Filter: { customerId }, sort: { createdAt: -1 }
orderSchema.index({ customerId: 1, createdAt: -1 });

const Order = model("Order", orderSchema);
export { Order };
```

**Why good:** ESR rule maximizes index efficiency, equality fields first for exact matches, sort field in the middle for in-order traversal, range field last

### Good Example -- Partial Index

```typescript
// Index only active users -- smaller index, faster writes for inactive users
userSchema.index(
  { email: 1 },
  {
    partialFilterExpression: { isActive: true },
    unique: true, // Unique among active users only
  },
);
```

**Why good:** Partial index is smaller and faster, uniqueness enforced only for active records, inactive users can share email addresses (useful for soft-delete patterns)

### Bad Example -- Wrong Field Order

```typescript
// BAD: Range field before sort field
orderSchema.index({ status: 1, total: 1, createdAt: -1 });
// Query: { status: "shipped", total: { $gte: 100 } }, sort: { createdAt: -1 }
// MongoDB can't use index for sort because range field (total) comes before sort field
// Results in an in-memory sort (SORT stage in explain)
```

**Why bad:** Range field (`total`) before sort field (`createdAt`) prevents index-based sorting, MongoDB falls back to in-memory sort which is slow for large result sets

---

## Pattern 3: Text Indexes

### Good Example -- Full-Text Search

```typescript
const articleSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  tags: [{ type: String }],
  authorId: { type: Schema.Types.ObjectId, ref: "User" },
});

// Text index with weights -- title matches are more relevant
articleSchema.index(
  { title: "text", content: "text", summary: "text", tags: "text" },
  {
    weights: {
      title: 10,
      tags: 5,
      summary: 3,
      content: 1,
    },
    name: "article_text_search",
    default_language: "english",
  },
);

const Article = model("Article", articleSchema);

// Search with text score
const results = await Article.find(
  { $text: { $search: "mongodb best practices" } },
  { score: { $meta: "textScore" } },
)
  .sort({ score: { $meta: "textScore" } })
  .limit(20)
  .lean();

export { Article };
```

**Why good:** Weighted text index prioritizes title matches, named index for management, text score for relevance ranking, limited results

**When to use:** Basic full-text search without Atlas. For advanced search (fuzzy, autocomplete, facets), use Atlas Search.

### Important Limitation

```typescript
// A collection can have only ONE text index
// BAD: Trying to create a second text index
articleSchema.index({ title: "text" }); // First text index
articleSchema.index({ content: "text" }); // ERROR -- only one text index allowed

// GOOD: Include all searchable fields in one text index
articleSchema.index({ title: "text", content: "text" });
```

---

## Pattern 4: Geospatial Indexes

### Good Example -- 2dsphere Index

```typescript
const storeSchema = new Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ["Point"] as const,
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  isOpen: { type: Boolean, default: true },
});

// 2dsphere index for geospatial queries
storeSchema.index({ location: "2dsphere" });

const Store = model("Store", storeSchema);

// Find stores near a location
const METERS_PER_MILE = 1609.34;
const MAX_DISTANCE_MILES = 10;

const nearbyStores = await Store.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9857, 40.7484], // [longitude, latitude]
      },
      $maxDistance: MAX_DISTANCE_MILES * METERS_PER_MILE,
    },
  },
  isOpen: true,
}).lean();

// Find stores within a polygon (e.g., delivery zone)
const deliveryZone = await Store.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7], // Close the polygon
          ],
        ],
      },
    },
  },
}).lean();

export { Store };
```

**Why good:** GeoJSON format with `Point` type, 2dsphere index for earth-like sphere calculations, named constants for distance, `$near` for proximity queries, `$geoWithin` for area queries

---

## Pattern 5: TTL (Time-to-Live) Indexes

### Good Example -- Auto-Expiring Documents

```typescript
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours
const OTP_EXPIRY_SECONDS = 60 * 5; // 5 minutes

// Session tokens -- expire after 24 hours
const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

sessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SESSION_EXPIRY_SECONDS },
);

// OTP codes -- expire after 5 minutes
const otpSchema = new Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: OTP_EXPIRY_SECONDS });

const Session = model("Session", sessionSchema);
const OTP = model("OTP", otpSchema);

export { Session, OTP };
```

**Why good:** Named constants for expiry durations, TTL index on `createdAt` for automatic cleanup, MongoDB background thread removes expired documents, no application-level cleanup code needed

### Good Example -- Custom Expiry per Document

```typescript
// Each document can have its own expiry time
const cacheSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});

// TTL index with expireAfterSeconds: 0 means "expire at the date in the field"
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Cache = model("Cache", cacheSchema);

// Usage -- set custom TTL per entry
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

await Cache.create({
  key: "user:123:profile",
  value: { name: "Alice" },
  expiresAt: new Date(Date.now() + ONE_HOUR_MS),
});

await Cache.create({
  key: "config:features",
  value: { darkMode: true },
  expiresAt: new Date(Date.now() + ONE_DAY_MS),
});

export { Cache };
```

**Why good:** `expireAfterSeconds: 0` with date field allows per-document TTL, named constants for duration, useful for caching with variable lifetimes

---

## Pattern 6: Unique and Sparse Indexes

### Good Example -- Conditional Uniqueness

```typescript
const userSchema = new Schema({
  email: { type: String, required: true },
  googleId: { type: String },
  githubId: { type: String },
});

// Unique email
userSchema.index({ email: 1 }, { unique: true });

// Sparse unique -- only indexed when field exists
// Multiple users can have no googleId (null/undefined not indexed)
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ githubId: 1 }, { unique: true, sparse: true });
```

**Why good:** Sparse index allows multiple documents without the field (null/undefined are not indexed), unique constraint only enforced for documents with the field present, useful for optional OAuth IDs

---

## Pattern 7: Wildcard Indexes

### Good Example -- Dynamic Fields

```typescript
const eventSchema = new Schema({
  eventType: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  properties: { type: Schema.Types.Mixed },
});

// Wildcard index on dynamic properties
eventSchema.index({ "properties.$**": 1 });

// Query any nested property
const results = await Event.find({
  "properties.userId": "abc123",
  "properties.action": "click",
}).lean();
```

**Why good:** Wildcard index supports queries on any field within `properties` without knowing field names in advance, useful for event tracking with variable payloads

**When to use:** Collections with dynamic or unpredictable field names. Not for production-critical queries (compound indexes are faster for known patterns).

---

## Index Management Best Practices

### Monitor Index Usage

```typescript
// Check index usage stats (in mongosh or via admin API)
// db.users.aggregate([{ $indexStats: {} }])

// Explain query to verify index usage
const explanation = await User.find({ role: "admin", isActive: true }).explain(
  "executionStats",
);

// Check: explanation.executionStats.executionStages.stage should be "IXSCAN", not "COLLSCAN"
```

### Index Creation in Production

```typescript
// Create indexes with { background: true } in production (MongoDB 4.2+ default)
// NOTE: In Mongoose, autoIndex should be disabled in production

const schema = new Schema(
  {
    /* fields */
  },
  { autoIndex: process.env.NODE_ENV !== "production" },
);

// Use createIndexes() explicitly during deployment/migration
async function ensureIndexes(): Promise<void> {
  await User.createIndexes();
  await Order.createIndexes();
  await Product.createIndexes();
  console.log("All indexes created");
}

export { ensureIndexes };
```

### Rules of Thumb

1. **Every query pattern needs a supporting index** -- `COLLSCAN` in explain means missing index
2. **Follow ESR rule** for compound indexes -- Equality, Sort, Range
3. **Remove unused indexes** -- they slow writes and consume storage
4. **One text index per collection** -- include all searchable fields
5. **Use partial indexes** when queries consistently filter on a condition
6. **Limit to ~10 indexes per collection** -- more indexes slow writes
7. **Monitor with `$indexStats`** -- remove indexes with zero usage
8. **Use `explain("executionStats")`** to verify index usage on slow queries

---

_For core patterns, see [core.md](core.md). For query patterns, see [queries.md](queries.md). For aggregation, see [aggregation.md](aggregation.md). For schema design, see [patterns.md](patterns.md)._
