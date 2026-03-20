# Gel (formerly EdgeDB) Query Builder Examples

> TypeScript query builder patterns using `e.select`, `e.insert`, `e.update`, `e.delete`, and `e.params`. See [SKILL.md](../SKILL.md) for core concepts.
>
> **Package names:** New projects use `gel` and `@gel/generate`. Legacy `edgedb` and `@edgedb/generate` packages still work via compatibility shims.

**Core patterns:** See [core.md](core.md). **Advanced schema:** See [advanced-schema.md](advanced-schema.md).

---

## Pattern 1: Query Builder Setup

### Good Example -- Standard Setup

```typescript
import { createClient } from "gel";
import e from "./dbschema/edgeql-js";

const client = createClient();

export { client, e };
```

**Why good:** Query builder imported from generated directory, `e` is the conventional name for the query builder module, named exports

### Generating the Query Builder

```bash
# Requires a running Gel instance (it introspects the live schema)
npx @gel/generate edgeql-js

# Output: generates files in ./dbschema/edgeql-js/
# Re-run after every `gel migrate`
```

**Why good:** Generator introspects the actual database schema (not just .gel files), ensuring generated types exactly match the database

---

## Pattern 2: e.select -- Querying Data

### Good Example -- Basic Select with Shape

```typescript
import { createClient } from "gel";
import e from "./dbschema/edgeql-js";

const client = createClient();

// Select all users with specific fields
const allUsersQuery = e.select(e.User, () => ({
  id: true,
  name: true,
  email: true,
}));

// Result type is automatically inferred:
// Array<{ id: string; name: string; email: string }>
const users = await allUsersQuery.run(client);

export { users };
```

**Why good:** Shape expression specifies exactly which fields to return, result type is automatically inferred by TypeScript, `.run(client)` executes the query

### Good Example -- Nested Shapes and Filtering

```typescript
import e from "./dbschema/edgeql-js";

const PAGE_SIZE = 20;

const publishedPostsQuery = e.select(e.Post, (post) => ({
  id: true,
  title: true,
  excerpt: true,
  author: {
    name: true,
    email: true,
  },
  tags: {
    name: true,
  },
  comment_count: e.count(post.comments),
  filter: e.op(post.status, "=", e.Status.published),
  order_by: {
    expression: post.published_at,
    direction: e.DESC,
  },
  limit: PAGE_SIZE,
}));

export { publishedPostsQuery };
```

**Why good:** Nested shapes for links, computed field (comment_count) using `e.count`, filter/order_by/limit as shape properties, named constant for limit, status compared with generated enum `e.Status.published`

### Good Example -- Filter on Exclusive Constraint (Singleton)

```typescript
import e from "./dbschema/edgeql-js";

// Filtering on .id (exclusive) makes the query return a singleton
const userByIdQuery = e.select(e.User, (user) => ({
  id: true,
  name: true,
  email: true,
  role: true,
  posts: {
    title: true,
    status: true,
  },
  filter_single: e.op(user.id, "=", e.uuid("a1b2c3d4-...")),
}));

// Result type: { id: string; name: string; ... } | null
// (not an array -- filter_single changes cardinality)
```

**Why good:** `filter_single` tells the query builder this returns zero or one result (not an array), filtering on `id` (exclusive constraint) is semantically correct for singleton

### Bad Example -- Missing Filter on Delete-All

```typescript
// BAD: No filter -- selects ALL users
const allQuery = e.select(e.User, () => ({
  id: true,
  name: true,
}));
// This returns every user in the database -- intentional?
// If you want all users, be explicit about it.
```

**Why bad:** No filter returns the entire table -- make sure this is intentional, especially in production with large datasets

---

## Pattern 3: e.insert -- Creating Data

### Good Example -- Insert with Link Resolution

```typescript
import e from "./dbschema/edgeql-js";

const insertPostQuery = e.insert(e.Post, {
  title: "Getting Started with EdgeDB",
  body: "EdgeDB is a graph-relational database...",
  status: e.Status.draft,
  author: e.select(e.User, (user) => ({
    filter_single: e.op(user.email, "=", "alice@example.com"),
  })),
  tags: e.select(e.Tag, (tag) => ({
    filter: e.op(tag.name, "in", e.set("edgedb", "tutorial")),
  })),
});

// Select the inserted post to get its fields back
const insertAndReturnQuery = e.select(insertPostQuery, () => ({
  id: true,
  title: true,
  author: { name: true },
}));

export { insertAndReturnQuery };
```

**Why good:** Links resolved via subqueries (not raw IDs), multi link assigned with `e.set()` for tag names, `e.select()` wrapping insert to return specific fields, enum value via `e.Status.draft`

### Good Example -- Upsert (Insert Unless Conflict)

```typescript
import e from "./dbschema/edgeql-js";

const upsertUserQuery = e
  .insert(e.User, {
    name: "Alice",
    email: "alice@example.com",
    role: e.Role.admin,
    organization: e.select(e.Organization, (org) => ({
      filter_single: e.op(org.name, "=", "Acme"),
    })),
  })
  .unlessConflict((user) => ({
    on: user.email,
    else: e.update(user, () => ({
      set: {
        name: "Alice",
        role: e.Role.admin,
      },
    })),
  }));

export { upsertUserQuery };
```

**Why good:** `.unlessConflict()` handles duplicate key gracefully, `on: user.email` targets the exclusive constraint, `else` clause updates on conflict

---

## Pattern 4: e.update -- Modifying Data

### Good Example -- Update with Multi Link Manipulation

```typescript
import e from "./dbschema/edgeql-js";

// Add tags (+=)
const addTagsQuery = e.update(e.Post, (post) => ({
  filter_single: e.op(post.id, "=", e.uuid(postId)),
  set: {
    tags: {
      "+=": e.select(e.Tag, (tag) => ({
        filter: e.op(tag.name, "in", e.set("featured", "trending")),
      })),
    },
  },
}));

// Remove tags (-=)
const removeTagQuery = e.update(e.Post, (post) => ({
  filter_single: e.op(post.id, "=", e.uuid(postId)),
  set: {
    tags: {
      "-=": e.select(e.Tag, (tag) => ({
        filter_single: e.op(tag.name, "=", "draft"),
      })),
    },
  },
}));

// Replace all tags (:=)
const replaceTagsQuery = e.update(e.Post, (post) => ({
  filter_single: e.op(post.id, "=", e.uuid(postId)),
  set: {
    tags: e.select(e.Tag, (tag) => ({
      filter: e.op(tag.name, "in", e.set("final", "reviewed")),
    })),
  },
}));

export { addTagsQuery, removeTagQuery, replaceTagsQuery };
```

**Why good:** Three distinct operations -- `+=` adds, `-=` removes, plain assignment replaces, each corresponds to EdgeQL's set manipulation operators

### Good Example -- Self-Referential Update

```typescript
import e from "./dbschema/edgeql-js";

const incrementViewsQuery = e.update(e.Post, (post) => ({
  filter_single: e.op(post.id, "=", e.uuid(postId)),
  set: {
    view_count: e.op(post.view_count, "+", 1),
  },
}));

export { incrementViewsQuery };
```

**Why good:** `e.op(post.view_count, '+', 1)` references the current value, update is atomic

---

## Pattern 5: e.delete -- Removing Data

### Good Example -- Delete with Filter

```typescript
import e from "./dbschema/edgeql-js";

// Delete specific post
const deletePostQuery = e.delete(e.Post, (post) => ({
  filter_single: e.op(post.id, "=", e.uuid(postId)),
}));

// Delete returns the deleted objects -- select to get fields
const deleteAndReturnQuery = e.select(deletePostQuery, () => ({
  id: true,
  title: true,
}));

// Bulk delete with condition
const DAYS_CUTOFF = 30;
const cleanupQuery = e.delete(e.Post, (post) => ({
  filter: e.op(
    e.op(post.status, "=", e.Status.draft),
    "and",
    e.op(
      post.created_at,
      "<",
      e.op(e.datetime_of_statement(), "-", e.duration(`P${DAYS_CUTOFF}D`)),
    ),
  ),
}));

export { deleteAndReturnQuery, cleanupQuery };
```

**Why good:** `filter_single` for deleting one object, `e.select` wrapping delete to return deleted fields, compound filter for bulk cleanup, named constant for cutoff

---

## Pattern 6: e.params -- Parameterized Queries

### Good Example -- Reusable Parameterized Query

```typescript
import e from "./dbschema/edgeql-js";

// Define a reusable parameterized query
const getUserByEmailQuery = e.params({ email: e.str }, ($) =>
  e.select(e.User, (user) => ({
    id: true,
    name: true,
    email: true,
    role: true,
    organization: { name: true },
    filter_single: e.op(user.email, "=", $.email),
  })),
);

// Usage -- pass params to .run()
const user = await getUserByEmailQuery.run(client, {
  email: "alice@example.com",
});

export { getUserByEmailQuery };
```

**Why good:** `e.params` declares parameter types, query is reusable with different values, parameters are validated at runtime and compile time

### Good Example -- Multiple Parameters with Optional

```typescript
import e from "./dbschema/edgeql-js";

const PAGE_SIZE = 20;

const searchPostsQuery = e.params(
  {
    search_term: e.str,
    status: e.optional(e.str),
    page: e.int64,
  },
  ($) =>
    e.select(e.Post, (post) => ({
      id: true,
      title: true,
      excerpt: true,
      author: { name: true },
      filter: e.op(
        e.op(post.title, "ilike", e.op("%", "++", $.search_term, "++", "%")),
        "and",
        e.op(
          e.op($.status, "is", e.set()), // null check
          "or",
          e.op(post.status, "=", $.status),
        ),
      ),
      order_by: {
        expression: post.published_at,
        direction: e.DESC,
      },
      limit: PAGE_SIZE,
      offset: e.op($.page, "*", PAGE_SIZE),
    })),
);

export { searchPostsQuery };
```

**Why good:** `e.optional()` for nullable parameters, pagination with offset calculation, ilike for case-insensitive search, null check pattern for optional filter

---

## Pattern 7: Query Composition

### Good Example -- Composing Queries

```typescript
import e from "./dbschema/edgeql-js";

// Create a tag, then use it in an insert
const newTag = e.insert(e.Tag, { name: "edgedb-v6" });

const newPost = e.insert(e.Post, {
  title: "What's New in EdgeDB 6",
  body: "EdgeDB 6 adds SQL support...",
  status: e.Status.published,
  published_at: e.datetime_of_statement(),
  author: e.select(e.User, (user) => ({
    filter_single: e.op(user.email, "=", "alice@example.com"),
  })),
  tags: newTag, // Reference the insert expression directly
});

// Select the final result
const query = e.select(newPost, () => ({
  id: true,
  title: true,
  tags: { name: true },
}));

// The query builder automatically hoists composed expressions into WITH blocks
const result = await query.run(client);

export { result };
```

**Why good:** Query expressions are composable -- reference one expression inside another, query builder auto-generates `WITH` blocks, no intermediate variables needed for the actual EdgeQL

---

## Pattern 8: Transactions with Query Builder

### Good Example -- Transaction with Query Builder

```typescript
import { createClient } from "gel";
import e from "./dbschema/edgeql-js";

const client = createClient();
const TRANSFER_AMOUNT = 100;

async function transferCredits(fromUserId: string, toUserId: string) {
  await client.transaction(async (tx) => {
    // CRITICAL: pass tx (not client) to .run()
    const debitQuery = e.update(e.Account, (account) => ({
      filter_single: e.op(account.user.id, "=", e.uuid(fromUserId)),
      set: {
        balance: e.op(account.balance, "-", TRANSFER_AMOUNT),
      },
    }));

    const result = await e
      .select(debitQuery, () => ({ balance: true }))
      .run(tx); // tx, not client!

    if (result && result.balance < 0) {
      throw new Error("Insufficient balance");
    }

    await e
      .update(e.Account, (account) => ({
        filter_single: e.op(account.user.id, "=", e.uuid(toUserId)),
        set: {
          balance: e.op(account.balance, "+", TRANSFER_AMOUNT),
        },
      }))
      .run(tx); // tx, not client!
  });
}

export { transferCredits };
```

**Why good:** `client.transaction()` handles commit/abort/retry, `tx` passed to every `.run()` call, error inside callback triggers rollback, named constant for amount

### Bad Example -- Using Client Inside Transaction

```typescript
// BAD: Using client instead of tx
await client.transaction(async (tx) => {
  await someQuery.run(client); // WRONG -- runs outside the transaction!
  await anotherQuery.run(tx); // Only this one is transactional
});
```

**Why bad:** `client` inside transaction runs outside it -- will not roll back on error, data inconsistency

---

_For core patterns, see [core.md](core.md). For advanced schema, see [advanced-schema.md](advanced-schema.md)._
