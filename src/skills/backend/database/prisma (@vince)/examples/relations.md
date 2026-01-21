# Prisma - Relations Examples

> Relational queries, includes, and N+1 prevention. See [SKILL.md](../SKILL.md) for core concepts.

---

## Include Pattern

### Good Example - Eager Loading Relations

```typescript
import { prisma } from "@/lib/db/client";

// Include single relation
const userWithProfile = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    profile: true, // Include 1-to-1 relation
  },
});
// Type: User & { profile: Profile | null }

// Include multiple relations
const userWithRelations = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    profile: true,
    posts: true, // Include 1-to-many
  },
});
// Type: User & { profile: Profile | null; posts: Post[] }

// Nested includes
const postWithAuthorProfile = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: {
      include: {
        profile: true, // Include author's profile
      },
    },
    categories: true,
  },
});
```

**Why good:** Single query loads all relations, type includes relation fields, nested includes for deep relations

### Bad Example - N+1 Query Problem

```typescript
// WRONG - N+1 queries
const users = await prisma.user.findMany();

// This creates N additional queries!
for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
  console.log(`${user.name} has ${posts.length} posts`);
}
```

**Why bad:** 1 query for users + N queries for posts = N+1 queries, extremely slow with large datasets

### Good Example - Fixed N+1

```typescript
// CORRECT - Single query with include
const users = await prisma.user.findMany({
  include: {
    posts: true,
  },
});

for (const user of users) {
  console.log(`${user.name} has ${user.posts.length} posts`);
}
```

---

## Include with Filtering

### Good Example - Filtered Relation Data

```typescript
// Include only published posts
const userWithPublishedPosts = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 10, // Limit to 10 posts
    },
  },
});

// Include with nested filtering
const authorWithRecentPosts = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: {
      where: {
        published: true,
        createdAt: { gte: new Date("2024-01-01") },
      },
      include: {
        categories: {
          where: { active: true },
        },
      },
      orderBy: { createdAt: "desc" },
    },
  },
});
```

**Why good:** Filter relations in same query, orderBy and take for sorted/limited results, nested filtering for deep relations

---

## Select Pattern (Optimized)

### Good Example - Select Specific Fields

```typescript
// Select only needed fields
const userSummary = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true,
    // profile not included - smaller payload
  },
});
// Type: { id: string; name: string; email: string }

// Select with nested relation fields
const postSummary = await prisma.post.findUnique({
  where: { id: postId },
  select: {
    id: true,
    title: true,
    author: {
      select: {
        id: true,
        name: true,
        // Only id and name, not email, profile, etc.
      },
    },
  },
});
// Type: { id: string; title: string; author: { id: string; name: string } }
```

**Why good:** Smaller payload over network, reduced memory usage, type reflects actual data shape

### Include vs Select

```typescript
// include: Adds relations to full model
const userWithPosts = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true },
});
// Returns: All User fields + posts array

// select: Only specified fields (cannot mix with include at top level)
const userPartial = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    posts: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});
// Returns: Only id, name, and posts with only id, title
```

---

## Relation Filtering (on Parent)

### Good Example - Filter by Relation Data

```typescript
// Find users who have at least one published post
const usersWithPublishedPosts = await prisma.user.findMany({
  where: {
    posts: {
      some: { published: true },
    },
  },
});

// Find users where ALL posts are published
const usersWithAllPublished = await prisma.user.findMany({
  where: {
    posts: {
      every: { published: true },
    },
  },
});

// Find users with NO posts
const usersWithNoPosts = await prisma.user.findMany({
  where: {
    posts: {
      none: {},
    },
  },
});

// Complex relation filter
const activeAuthors = await prisma.user.findMany({
  where: {
    AND: [
      { role: "AUTHOR" },
      {
        posts: {
          some: {
            published: true,
            createdAt: { gte: new Date("2024-01-01") },
          },
        },
      },
    ],
  },
});
```

**Why good:** some/every/none filter on relation existence and data, combine with AND/OR for complex filters

---

## Many-to-Many Relations

### Good Example - Working with Join Tables

```typescript
// Schema reference:
// model Post {
//   categories Category[]
// }
// model Category {
//   posts Post[]
// }

// Find posts in specific categories
const postsInCategory = await prisma.post.findMany({
  where: {
    categories: {
      some: { name: "Technology" },
    },
  },
  include: {
    categories: true,
  },
});

// Add categories to post
const updatedPost = await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      connect: [
        { id: categoryId1 },
        { id: categoryId2 },
      ],
    },
  },
});

// Remove category from post
const postWithoutCategory = await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      disconnect: { id: categoryId },
    },
  },
});

// Replace all categories
const postNewCategories = await prisma.post.update({
  where: { id: postId },
  data: {
    categories: {
      set: [{ id: newCategoryId }], // Removes all existing, adds new
    },
  },
});
```

**Why good:** connect/disconnect for adding/removing, set for replacing all, Prisma handles join table automatically

---

## Self-Relations

### Good Example - Hierarchical Data

```typescript
// Schema:
// model Category {
//   id       String     @id
//   name     String
//   parentId String?
//   parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
//   children Category[] @relation("CategoryHierarchy")
// }

// Get category with parent and children
const categoryTree = await prisma.category.findUnique({
  where: { id: categoryId },
  include: {
    parent: true,
    children: {
      include: {
        children: true, // Grandchildren
      },
    },
  },
});

// Find root categories
const rootCategories = await prisma.category.findMany({
  where: { parentId: null },
  include: { children: true },
});
```

**Why good:** Self-relations for hierarchies, recursive includes for tree depth, filter parentId: null for roots

---

## Quick Reference

| Operation | Use When |
|-----------|----------|
| `include: { relation: true }` | Load all fields of relation |
| `include: { relation: { where, take, orderBy } }` | Filter/limit relation data |
| `select: { field: true }` | Load only specific fields |
| `select: { relation: { select } }` | Nested field selection |
| `where: { relation: { some } }` | Filter parent by relation existence |
| `where: { relation: { every } }` | Filter parent where all relations match |
| `where: { relation: { none } }` | Filter parent with no matching relations |
| `connect: { id }` | Link existing relation |
| `disconnect: { id }` | Unlink relation |
| `set: [{ id }]` | Replace all relations |
| `create: { data }` | Create new relation |
