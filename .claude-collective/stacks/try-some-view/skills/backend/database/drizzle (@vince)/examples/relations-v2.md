# Relational Queries v2 (RQB v2) Examples

RQB v2 introduces `defineRelations()` for centralized relation definitions and object-based `where`/`orderBy` syntax. Available in Drizzle ORM v1.0.0-beta.1+.

---

## Defining Relations with defineRelations()

The v2 API consolidates all relations into a single location using `defineRelations()`:

```typescript
// Good Example - RQB v2 with defineRelations()
import { defineRelations } from "drizzle-orm";
import { users, posts, comments, groups, usersToGroups } from "./schema";

// Define ALL relations in one centralized location
export const relations = defineRelations(
  { users, posts, comments, groups, usersToGroups },
  (r) => ({
    // Relations for the 'users' table
    users: {
      posts: r.many.posts({
        from: r.users.id,
        to: r.posts.authorId,
      }),
      comments: r.many.comments({
        from: r.users.id,
        to: r.comments.userId,
      }),
      // Many-to-many with .through() - eliminates junction table boilerplate
      groups: r.many.groups({
        from: r.users.id.through(r.usersToGroups.userId),
        to: r.groups.id.through(r.usersToGroups.groupId),
      }),
    },
    // Relations for the 'posts' table
    posts: {
      author: r.one.users({
        from: r.posts.authorId,
        to: r.users.id,
      }),
      comments: r.many.comments({
        from: r.posts.id,
        to: r.comments.postId,
      }),
    },
    // Relations for the 'comments' table
    comments: {
      user: r.one.users({
        from: r.comments.userId,
        to: r.users.id,
      }),
      post: r.one.posts({
        from: r.comments.postId,
        to: r.posts.id,
      }),
    },
    // Relations for the 'groups' table
    groups: {
      members: r.many.users({
        from: r.groups.id.through(r.usersToGroups.groupId),
        to: r.users.id.through(r.usersToGroups.userId),
      }),
    },
  }),
);
```

**Why good:** Single location for all relations enables full autocomplete through `r` parameter, `through()` handles many-to-many junction tables automatically, centralized definition prevents inconsistencies

```typescript
// Bad Example - Old v1 syntax (DEPRECATED)
import { relations } from "drizzle-orm";

// ❌ Per-table relations() calls are deprecated in RQB v2
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

**Why bad:** Scattered relation definitions across multiple files, harder to maintain, `fields`/`references` syntax replaced by `from`/`to` in v2

---

## Database Initialization (v2)

```typescript
// Good Example - v2 initialization with relations object
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { relations } from "./relations";

const sql = neon(process.env.DATABASE_URL!);

// Pass relations object (NOT schema)
export const db = drizzle(sql, {
  relations,
  casing: "snake_case",
});
```

**Why good:** v2 uses `relations` object instead of `schema`, enables RQB v2 query syntax

```typescript
// Bad Example - v1 initialization (still works but outdated)
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// ❌ v1 syntax - passing schema with mode
const db = drizzle(sql, { schema, mode: "default" });
```

**Why bad:** v1 syntax doesn't enable RQB v2 features, `mode` parameter removed for most dialects

---

## Object-Based Where Syntax

RQB v2 replaces callback-based `where` with simpler object syntax:

```typescript
// Good Example - v2 object-based where (simple equality)
const activeUsers = await db.query.users.findMany({
  where: {
    isActive: true,
    role: "admin",
  },
  with: {
    posts: true,
  },
});

// Good Example - v2 object-based where with operators
const filteredUsers = await db.query.users.findMany({
  where: {
    isActive: true,
    age: { gt: 18 }, // Greater than
    email: { like: "%@company.com" }, // LIKE pattern
    status: { in: ["active", "pending"] }, // IN array
    deletedAt: { isNull: true }, // NULL check
  },
  orderBy: { createdAt: "desc" },
});

// Available operators: eq, ne, gt, gte, lt, lte, in, notIn, like, ilike, isNull, isNotNull

// Complex conditions with logical operators
const complexQuery = await db.query.users.findMany({
  where: {
    OR: [{ role: "admin" }, { AND: [{ role: "user" }, { age: { gte: 21 } }] }],
    NOT: { status: "banned" },
  },
});
```

**Why good:** Object syntax is cleaner and more readable, still supports full operator set (AND, OR, NOT, gt, lt, like, etc.), orderBy uses object notation

```typescript
// Bad Example - v1 callback-based where (DEPRECATED)
const users = await db.query.users.findMany({
  // ❌ Callback syntax deprecated in RQB v2
  where: (users, { eq }) => eq(users.isActive, true),
  orderBy: (users, { desc }) => [desc(users.createdAt)],
});
```

**Why bad:** Callback syntax is verbose and deprecated, object syntax is cleaner and better typed

---

## Many-to-Many with through()

The `through()` method eliminates manual junction table mapping:

```typescript
// Good Example - Direct many-to-many access
// Define the relation with through()
groups: r.many.groups({
  from: r.users.id.through(r.usersToGroups.userId),
  to: r.groups.id.through(r.usersToGroups.groupId),
}),

// Query directly - no junction table in results
const userWithGroups = await db.query.users.findFirst({
  where: { id: userId },
  with: {
    groups: true, // Returns Group[] directly, not UsersToGroups[]
  },
});

console.log(userWithGroups.groups); // Group[] - junction table is abstracted away
```

**Why good:** `through()` abstracts junction table completely, query returns `Group[]` directly instead of `{ groupId, userId, group: Group }[]`

```typescript
// Bad Example - v1 manual junction table mapping
// ❌ v1 required selecting through junction table
const userWithGroups = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    usersToGroups: {
      with: {
        group: true,
      },
    },
  },
});

// Then manually map the results
const groups = userWithGroups.usersToGroups.map((utg) => utg.group);
```

**Why bad:** Requires manual mapping, junction table pollutes type, more verbose queries

---

## Filtering on Relations

Filter parent records based on related entities:

```typescript
// Good Example - Filter by related entity
const usersWithRecentPosts = await db.query.users.findMany({
  where: {
    posts: {
      // Filter users who have posts created in last 7 days
      createdAt: gt(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    },
  },
  with: {
    posts: {
      limit: 5,
      orderBy: { createdAt: "desc" },
    },
  },
});
```

**Why good:** Can filter parent by related entity attributes, nested limit/orderBy on relations

---

## Predefined Where in Relations

Add default filters directly in relation definitions:

```typescript
// Good Example - Predefined filter in relation definition
const relations = defineRelations({ users, posts }, (r) => ({
  users: {
    // Only return published posts by default
    publishedPosts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
      where: {
        status: "published",
        deletedAt: null,
      },
    }),
    // Separate relation for drafts
    draftPosts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
      where: {
        status: "draft",
      },
    }),
  },
}));

// Query uses the predefined filter automatically
const user = await db.query.users.findFirst({
  where: { id: userId },
  with: {
    publishedPosts: true, // Already filtered to status='published'
  },
});
```

**Why good:** Encapsulates common filtering logic, prevents accidental exposure of unpublished/deleted content

**Note:** Predefined `where` can only filter on the target (`to`) table, not the source table.

---

## Optional Relations

Control nullability of one-to-one relations:

```typescript
// Good Example - Required vs optional relations
const relations = defineRelations({ users, profiles, settings }, (r) => ({
  users: {
    // Optional (default) - user may not have a profile
    profile: r.one.profiles({
      from: r.users.id,
      to: r.profiles.userId,
      optional: true, // This is the default
    }),
    // Required - throws if user doesn't have settings
    settings: r.one.settings({
      from: r.users.id,
      to: r.settings.userId,
      optional: false, // TypeScript type is non-nullable
    }),
  },
}));
```

**Why good:** `optional: false` provides non-nullable types when relation is guaranteed to exist

---

## Splitting Relations with defineRelationsPart

For large schemas, split relations across files:

```typescript
// Good Example - Split relations across files
// relations/users.ts
import { defineRelationsPart } from "drizzle-orm";
import * as schema from "../schema";

export const userRelations = defineRelationsPart(schema, (r) => ({
  users: {
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
  },
}));

// relations/posts.ts
export const postRelations = defineRelationsPart(schema, (r) => ({
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
  },
}));

// relations/index.ts - Combine all parts
import { defineRelations } from "drizzle-orm";
import * as schema from "../schema";
import { userRelations } from "./users";
import { postRelations } from "./posts";

// CRITICAL: Main relations must spread FIRST for TypeScript inference
export const relations = defineRelations(schema, (r) => ({
  ...userRelations,
  ...postRelations,
}));
```

**Why good:** Keeps large codebases organized, each domain owns its relations

**Critical:** Main `defineRelations()` must spread first to ensure proper TypeScript inference.

---

## Migration from v1 to v2

Quick migration steps:

1. Run `npx drizzle-kit pull` to auto-generate v2 relations (optional)
2. Create `relations.ts` with `defineRelations()` consolidating all relations
3. Replace `drizzle(url, { schema })` with `drizzle(url, { relations })`
4. Update queries: convert callback `where`/`orderBy` to object syntax
5. Update field references: `fields` → `from`, `references` → `to`
6. Update relation names: `relationName` → `alias`

| v1 Syntax                                 | v2 Syntax                                      |
| ----------------------------------------- | ---------------------------------------------- |
| `relations(table, ...)` per table         | `defineRelations({ tables }, ...)` centralized |
| `fields: [table.column]`                  | `from: r.table.column`                         |
| `references: [other.id]`                  | `to: r.other.id`                               |
| `relationName: "author"`                  | `alias: "author"`                              |
| `where: (t, { eq }) => eq(t.col, val)`    | `where: { col: val }`                          |
| `orderBy: (t, { desc }) => [desc(t.col)]` | `orderBy: { col: "desc" }`                     |
| Manual junction table mapping             | `through()` for many-to-many                   |

---

## See Also

- [core.md](core.md) - Database connection and schema definition
- [queries.md](queries.md) - Query builder patterns (still valid for complex queries)
- [Drizzle Relations v2 Docs](https://orm.drizzle.team/docs/relations-v2)
- [RQB v2 Docs](https://orm.drizzle.team/docs/rqb-v2)
- [v1 to v2 Migration](https://orm.drizzle.team/docs/relations-v1-v2)
