# MongoDB / Mongoose Reference

> Decision frameworks, quick reference, Atlas setup, migration strategies, and common connection options. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Schema Design: Embed vs Reference

```
Is the related data always accessed with the parent?
├─ YES → Is the related data bounded (won't grow unbounded)?
│   ├─ YES → Is the related data small (< 100 items)?
│   │   ├─ YES → EMBED in the parent document
│   │   └─ NO → Consider EMBED with pagination or REFERENCE
│   └─ NO → REFERENCE (unbounded arrays hit 16 MB limit)
└─ NO → Is the related data shared across many parents?
    ├─ YES → REFERENCE with ObjectId
    └─ NO → Is it updated independently from the parent?
        ├─ YES → REFERENCE with ObjectId
        └─ NO → EMBED in the parent document
```

### Query Strategy

```
Are you reading data to send as an API response?
├─ YES → Will you modify the documents before sending?
│   ├─ YES → Use normal query (need Mongoose document features)
│   └─ NO → Use .lean() for 3x memory savings
└─ NO → Are you updating data?
    ├─ YES → Do you need middleware (pre/post save) to fire?
    │   ├─ YES → Use findById() + .save()
    │   └─ NO → Use findByIdAndUpdate() with runValidators: true
    └─ NO → Are you aggregating/analyzing data?
        ├─ YES → Use aggregation pipeline
        └─ NO → Use find() with appropriate projection
```

### Index Strategy

```
What does your query filter on?
├─ Single field → Single-field index
├─ Multiple fields → Compound index (follow ESR rule)
├─ Text search → Text index (one per collection)
├─ Location queries → 2dsphere index
└─ Expiring data → TTL index on date field

ESR Rule for compound indexes:
1. Equality fields first ($eq, $in)
2. Sort fields second
3. Range fields last ($gt, $lt, $gte, $lte)
```

### Populate vs Aggregation $lookup

```
Do you need to resolve references?
├─ YES → Is it a simple parent-child relationship?
│   ├─ YES → Use .populate() with field selection
│   └─ NO → Do you need filtering/sorting on the joined data?
│       ├─ YES → Use aggregation $lookup + $match
│       └─ NO → Use .populate() with match option
└─ NO → Skip population, use IDs directly
```

---

## Atlas Setup

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

**Steps:**

1. Create cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create database user (Database Access)
3. Whitelist IP addresses (Network Access) -- use `0.0.0.0/0` for development only
4. Get connection string (Connect > Drivers > Node.js)
5. Store in environment variable as `MONGODB_URI`

### Atlas Search (Full-Text)

Atlas Search uses Apache Lucene indexes, separate from standard MongoDB indexes. Configure via Atlas UI or API:

```typescript
// Atlas Search aggregation stage
const results = await Product.aggregate([
  {
    $search: {
      index: "product_search",
      text: {
        query: searchTerm,
        path: ["name", "description"],
        fuzzy: { maxEdits: 1 },
      },
    },
  },
  { $limit: 20 },
  { $project: { name: 1, description: 1, score: { $meta: "searchScore" } } },
]);
```

---

## Migration Strategies

### Schema Changes

MongoDB is schema-flexible, but Mongoose enforces structure at the application layer.

**Adding a field:**

```typescript
// Add with default -- existing documents get default on next read/write
const userSchema = new Schema({
  // ... existing fields
  preferences: { type: Schema.Types.Mixed, default: {} },
});
```

**Renaming a field:**

```typescript
// Migration script -- run once
await User.updateMany({}, { $rename: { oldField: "newField" } });
```

**Removing a field:**

```typescript
// Migration script -- run once
await User.updateMany({}, { $unset: { deprecatedField: "" } });
```

### Data Migration Pattern

```typescript
const BATCH_SIZE = 500;

async function migrateUsers(): Promise<void> {
  let processed = 0;
  const total = await User.countDocuments({ migratedAt: { $exists: false } });

  const cursor = User.find({ migratedAt: { $exists: false } })
    .batchSize(BATCH_SIZE)
    .cursor();

  for await (const user of cursor) {
    user.displayName = `${user.firstName} ${user.lastName}`;
    user.migratedAt = new Date();
    await user.save();
    processed += 1;

    if (processed % BATCH_SIZE === 0) {
      console.log(`Migrated ${processed}/${total}`);
    }
  }

  console.log(`Migration complete: ${processed} documents`);
}

export { migrateUsers };
```

---

## Common Connection Options

| Option                     | Default    | Description                             |
| -------------------------- | ---------- | --------------------------------------- |
| `maxPoolSize`              | 100        | Maximum sockets in the connection pool  |
| `minPoolSize`              | 0          | Minimum sockets maintained              |
| `serverSelectionTimeoutMS` | 30000      | Time to find an available server        |
| `socketTimeoutMS`          | 0          | Time before killing inactive sockets    |
| `heartbeatFrequencyMS`     | 10000      | Interval for server status checks       |
| `retryWrites`              | true       | Automatically retry failed writes       |
| `retryReads`               | true       | Automatically retry failed reads        |
| `family`                   | 0          | Force IPv4 (4) or IPv6 (6)              |
| `authSource`               | -          | Database for user credentials           |
| `w`                        | "majority" | Write concern (majority for durability) |
| `bufferCommands`           | true       | Queue operations before connection      |

### Recommended Production Configuration

```typescript
const PRODUCTION_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
  family: 4,
} as const;
```

### Recommended Test Configuration

```typescript
const TEST_OPTIONS = {
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 3000,
  bufferCommands: false,
} as const;
```

---

## Mongoose CLI Commands

```bash
# No official Mongoose CLI -- use mongosh for database operations:

# Connect to Atlas
mongosh "mongodb+srv://cluster.mongodb.net/mydb" --username admin

# Show databases
show dbs

# Switch database
use mydb

# Show collections
show collections

# Query documents
db.users.find({ role: "admin" }).pretty()

# Create index
db.users.createIndex({ email: 1 }, { unique: true })

# Explain query plan
db.users.find({ role: "admin" }).explain("executionStats")

# Drop index
db.users.dropIndex("email_1")
```

---

## Quick Reference

### Schema Types

| Mongoose Type           | TypeScript Type  | Example                                  |
| ----------------------- | ---------------- | ---------------------------------------- |
| `String`                | `string`         | `name: { type: String }`                 |
| `Number`                | `number`         | `age: { type: Number }`                  |
| `Boolean`               | `boolean`        | `isActive: { type: Boolean }`            |
| `Date`                  | `Date`           | `createdAt: { type: Date }`              |
| `Buffer`                | `Buffer`         | `data: { type: Buffer }`                 |
| `Schema.Types.ObjectId` | `Types.ObjectId` | `ref: { type: Schema.Types.ObjectId }`   |
| `Schema.Types.Mixed`    | `any`            | `metadata: { type: Schema.Types.Mixed }` |
| `[String]`              | `string[]`       | `tags: [{ type: String }]`               |
| `Map`                   | `Map<string, V>` | `meta: { type: Map, of: String }`        |
| `Schema.Types.UUID`     | `string`         | `uuid: { type: Schema.Types.UUID }`      |

### Common Query Operators

| Operator       | Description             | Example                                   |
| -------------- | ----------------------- | ----------------------------------------- |
| `$eq`          | Equal                   | `{ age: { $eq: 25 } }`                    |
| `$ne`          | Not equal               | `{ status: { $ne: "deleted" } }`          |
| `$gt` / `$gte` | Greater than (or equal) | `{ age: { $gte: 18 } }`                   |
| `$lt` / `$lte` | Less than (or equal)    | `{ price: { $lt: 100 } }`                 |
| `$in` / `$nin` | In / not in array       | `{ role: { $in: ["admin", "mod"] } }`     |
| `$exists`      | Field exists            | `{ avatar: { $exists: true } }`           |
| `$regex`       | Regular expression      | `{ name: { $regex: /^A/i } }`             |
| `$or`          | Logical OR              | `{ $or: [{ a: 1 }, { b: 2 }] }`           |
| `$and`         | Logical AND             | `{ $and: [{ a: 1 }, { b: 2 }] }`          |
| `$elemMatch`   | Array element match     | `{ tags: { $elemMatch: { $eq: "js" } } }` |

### Common Update Operators

| Operator        | Description            | Example                             |
| --------------- | ---------------------- | ----------------------------------- |
| `$set`          | Set field value        | `{ $set: { name: "New" } }`         |
| `$unset`        | Remove field           | `{ $unset: { temp: "" } }`          |
| `$inc`          | Increment              | `{ $inc: { count: 1 } }`            |
| `$push`         | Add to array           | `{ $push: { tags: "new" } }`        |
| `$pull`         | Remove from array      | `{ $pull: { tags: "old" } }`        |
| `$addToSet`     | Add unique to array    | `{ $addToSet: { tags: "unique" } }` |
| `$rename`       | Rename field           | `{ $rename: { old: "new" } }`       |
| `$min` / `$max` | Update if less/greater | `{ $min: { low: 5 } }`              |

### Aggregation Stages

| Stage              | Description         | Example                                                                                     |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------- |
| `$match`           | Filter documents    | `{ $match: { status: "active" } }`                                                          |
| `$group`           | Group and aggregate | `{ $group: { _id: "$category", count: { $sum: 1 } } }`                                      |
| `$project`         | Shape output fields | `{ $project: { name: 1, total: { $multiply: ["$price", "$qty"] } } }`                       |
| `$sort`            | Order documents     | `{ $sort: { createdAt: -1 } }`                                                              |
| `$limit` / `$skip` | Pagination          | `{ $limit: 20 }`                                                                            |
| `$lookup`          | Join collections    | `{ $lookup: { from: "users", localField: "authorId", foreignField: "_id", as: "author" } }` |
| `$unwind`          | Flatten arrays      | `{ $unwind: "$tags" }`                                                                      |
| `$facet`           | Multiple pipelines  | `{ $facet: { data: [...], count: [...] } }`                                                 |
| `$merge`           | Write to collection | `{ $merge: { into: "reports" } }`                                                           |
