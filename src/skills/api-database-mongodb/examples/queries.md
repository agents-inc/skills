# MongoDB Query Examples

> Complex queries, populate, lean, cursor, and pagination patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Aggregation:** See [aggregation.md](aggregation.md). **Advanced:** See [patterns.md](patterns.md). **Indexes:** See [indexes.md](indexes.md).

---

## Pattern 1: Lean Queries for Read-Only Responses

### Good Example -- API Response

```typescript
import type { Request, Response } from "express";

const PAGE_SIZE = 20;

async function getUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const users = await User.find({ isActive: true })
    .select("name email role createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .lean();

  const total = await User.countDocuments({ isActive: true });

  res.json({
    data: users,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}

export { getUsers };
```

**Why good:** `.lean()` for read-only response (3x memory savings), `.select()` for minimal projection, named constant for page size, paginated with total count

### Bad Example -- Lean Misuse

```typescript
// BAD: Using lean() then trying to save
const user = await User.findById(id).lean();
user.name = "Updated";
await user.save(); // TypeError: user.save is not a function
```

**Why bad:** Lean returns plain objects without Mongoose methods, `.save()` does not exist on lean results

---

## Pattern 2: Populate with Field Selection

### Good Example -- Selective Population

```typescript
const MAX_COMMENTS = 50;

const post = await BlogPost.findById(id)
  .populate("authorId", "name email avatar")
  .populate({
    path: "comments",
    select: "content authorId createdAt",
    options: {
      sort: { createdAt: -1 },
      limit: MAX_COMMENTS,
    },
    populate: {
      path: "authorId",
      select: "name avatar",
    },
  })
  .lean();
```

**Why good:** Field selection on every populate call, limit on nested array to prevent unbounded results, nested populate for comment authors, sorted by recency

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

**Why good:** Populate only when needed, avoids unnecessary database queries, chainable query builder pattern

### Bad Example -- Unbounded Populate

```typescript
// BAD: Populating all fields, no limits
const post = await BlogPost.findById(id)
  .populate("authorId") // All author fields
  .populate("comments") // ALL comments, could be thousands
  .populate("relatedPosts"); // ALL related posts

// Each populate is a separate DB query with no bounds
```

**Why bad:** No field selection wastes bandwidth, no limit on comments could return thousands of documents, each populate adds a database round-trip

---

## Pattern 3: Complex Query Filters

### Good Example -- Dynamic Query Builder

```typescript
interface UserFilters {
  role?: string;
  isActive?: boolean;
  searchTerm?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  tags?: string[];
}

function buildUserQuery(filters: UserFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  if (filters.searchTerm) {
    query.$or = [
      { name: { $regex: filters.searchTerm, $options: "i" } },
      { email: { $regex: filters.searchTerm, $options: "i" } },
    ];
  }

  if (filters.createdAfter || filters.createdBefore) {
    query.createdAt = {};
    if (filters.createdAfter) {
      (query.createdAt as Record<string, Date>).$gte = filters.createdAfter;
    }
    if (filters.createdBefore) {
      (query.createdAt as Record<string, Date>).$lte = filters.createdBefore;
    }
  }

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $all: filters.tags };
  }

  return query;
}

const PAGE_SIZE = 20;

async function searchUsers(filters: UserFilters, page: number = 1) {
  const query = buildUserQuery(filters);

  const [users, total] = await Promise.all([
    User.find(query)
      .select("name email role tags createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(query),
  ]);

  return { users, total, page, pageSize: PAGE_SIZE };
}

export { searchUsers, buildUserQuery };
```

**Why good:** Type-safe filter builder, only applies filters when values present, `$or` for multi-field search, `$all` for tag intersection, parallel count query

---

## Pattern 4: Cursor-Based Iteration

### Good Example -- Processing Large Datasets

```typescript
const BATCH_LOG_INTERVAL = 1000;

async function processAllOrders(): Promise<number> {
  let processed = 0;

  const cursor = Order.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .cursor();

  for await (const order of cursor) {
    await processOrder(order);
    processed += 1;

    if (processed % BATCH_LOG_INTERVAL === 0) {
      console.log(`Processed ${processed} orders`);
    }
  }

  return processed;
}

export { processAllOrders };
```

**Why good:** Cursor-based iteration keeps memory constant regardless of result size, `for await...of` for clean async iteration, progress logging at intervals

### Bad Example -- Loading All Documents into Memory

```typescript
// BAD: Loads ALL matching documents into memory at once
const orders = await Order.find({ status: "pending" });
// If there are 1 million pending orders, this crashes with OOM

for (const order of orders) {
  await processOrder(order);
}
```

**Why bad:** Loads entire result set into memory, can cause out-of-memory crashes for large collections, no progress feedback

---

## Pattern 5: Cursor-Based Pagination (Keyset)

### Good Example -- Efficient Pagination with Cursor

```typescript
const PAGE_SIZE = 20;

interface PaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function getUsersWithCursor(
  cursor?: string,
): Promise<PaginationResult<Record<string, unknown>>> {
  const query: Record<string, unknown> = { isActive: true };

  if (cursor) {
    query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
  }

  const users = await User.find(query)
    .select("name email role createdAt")
    .sort({ _id: 1 })
    .limit(PAGE_SIZE + 1) // Fetch one extra to check hasMore
    .lean();

  const hasMore = users.length > PAGE_SIZE;
  const data = hasMore ? users.slice(0, PAGE_SIZE) : users;
  const nextCursor = hasMore ? String(data[data.length - 1]._id) : null;

  return { data, nextCursor, hasMore };
}

export { getUsersWithCursor };
```

**Why good:** Cursor-based pagination avoids skip/limit performance issues on large collections, fetch one extra to determine hasMore without separate count query, consistent performance regardless of page depth

### Bad Example -- Deep Offset Pagination

```typescript
// BAD: Deep offset pagination is slow on large collections
const PAGE_SIZE = 20;
const page = 5000; // Page 5000

const users = await User.find({ isActive: true })
  .skip((page - 1) * PAGE_SIZE) // Skip 99,980 documents -- SLOW
  .limit(PAGE_SIZE);
```

**Why bad:** MongoDB must scan and discard all skipped documents, performance degrades linearly with page depth, page 5000 requires scanning ~100k documents

---

## Pattern 6: Distinct and Count Queries

### Good Example -- Efficient Counting and Distinct Values

```typescript
// Count with filter -- uses index when available
const activeCount = await User.countDocuments({ isActive: true });

// Estimated total count -- fast, uses collection metadata
const estimatedTotal = await User.estimatedDocumentCount();

// Distinct values for a field
const uniqueRoles = await User.distinct("role", { isActive: true });

// Check existence efficiently
const exists = await User.exists({ email: "admin@example.com" });
```

**Why good:** `countDocuments` for filtered counts, `estimatedDocumentCount` for fast total counts (no filter), `distinct` for unique values with optional filter, `exists` returns only `_id` or `null` (faster than `findOne`)

---

## Pattern 7: Projection and Field Selection

### Good Example -- Selective Fields

```typescript
// Include specific fields (projection)
const users = await User.find({ role: "admin" })
  .select("name email role")
  .lean();

// Exclude specific fields
const usersWithoutPassword = await User.find()
  .select("-passwordHash -__v")
  .lean();

// Object syntax (equivalent)
const result = await User.find()
  .select({ name: 1, email: 1, role: 1, _id: 0 })
  .lean();
```

**Why good:** Field selection reduces network transfer and memory usage, exclude syntax for removing sensitive fields, `_id: 0` to exclude the default `_id` field

---

_For aggregation patterns, see [aggregation.md](aggregation.md). For schema design patterns, see [patterns.md](patterns.md). For index strategies, see [indexes.md](indexes.md)._
