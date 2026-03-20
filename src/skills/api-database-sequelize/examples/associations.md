# Sequelize - Association Examples

> Association types, eager loading, alias patterns, and N+1 prevention. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand model definition patterns from [core.md](core.md) first.

---

## Association Setup

### Good Example - Complete Bidirectional Setup

```typescript
// models/index.ts - Define all associations in one place AFTER all models are imported
import { User } from "./user";
import { Post } from "./post";
import { Tag } from "./tag";
import { PostTag } from "./post-tag";
import { Profile } from "./profile";
import { Comment } from "./comment";

// One-to-One: User has one Profile
User.hasOne(Profile, { foreignKey: "userId", as: "profile" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

// One-to-Many: User has many Posts
User.hasMany(Post, { foreignKey: "authorId", as: "posts" });
Post.belongsTo(User, { foreignKey: "authorId", as: "author" });

// One-to-Many: Post has many Comments
Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });
Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });

// Many-to-Many: Post <-> Tag through PostTag
Post.belongsToMany(Tag, { through: PostTag, foreignKey: "postId", as: "tags" });
Tag.belongsToMany(Post, { through: PostTag, foreignKey: "tagId", as: "posts" });

export { User, Post, Tag, PostTag, Profile, Comment };
```

**Why good:** All associations in one file prevents circular import issues, explicit `foreignKey` on both sides, `as` alias on every association, both directions defined

### Bad Example - Partial Association

```typescript
// BAD: Only one side defined
User.hasMany(Post, { foreignKey: "authorId" });
// Missing: Post.belongsTo(User, ...)
// Now Post has no `getAuthor()` method and can't eager load User from Post
```

**Why bad:** Only `User` gets `getPosts()`, `addPost()` etc. `Post` has no `getAuthor()` accessor, and you can't include `User` when querying `Post`

---

## The Alias Contract

### Good Example - Alias Must Match Everywhere

```typescript
// Definition: as: "posts"
User.hasMany(Post, { foreignKey: "authorId", as: "posts" });

// Query: as: "posts" matches
const user = await User.findOne({
  where: { id: userId },
  include: [{ model: Post, as: "posts" }],
});

// Accessor methods also use the alias
const posts = await user.getPosts();
await user.addPost(newPost);
const count = await user.countPosts();
```

**Why good:** `as: "posts"` is consistent across definition, include, and accessor methods

### Bad Example - Alias Mismatch

```typescript
// Definition uses "posts"
User.hasMany(Post, { foreignKey: "authorId", as: "posts" });

// Query uses different alias - FAILS
const user = await User.findOne({
  include: [{ model: Post, as: "articles" }], // "articles" !== "posts"
  // Error: Post is not associated to User using alias "articles"
});

// Also fails: no alias when one was defined
const user = await User.findOne({
  include: [{ model: Post }], // Missing as: "posts"
  // Error: Post is associated to User using alias "posts"
  // You must specify the alias
});
```

**Why bad:** Once you define `as` in the association, ALL references (includes, accessors) must use the same alias

---

## Eager Loading Patterns

### Good Example - Basic Include

```typescript
// Single include
const user = await User.findByPk(userId, {
  include: [{ model: Profile, as: "profile" }],
});
// user.profile is Profile | null

// Multiple includes
const user = await User.findByPk(userId, {
  include: [
    { model: Profile, as: "profile" },
    { model: Post, as: "posts" },
  ],
});
// user.profile, user.posts both available
```

**Why good:** Single query with JOINs, typed results include association data

### Good Example - Nested Includes

```typescript
// Load post -> author -> profile
const post = await Post.findByPk(postId, {
  include: [
    {
      model: User,
      as: "author",
      include: [{ model: Profile, as: "profile" }],
    },
    {
      model: Comment,
      as: "comments",
      include: [{ model: User, as: "commenter" }],
    },
    { model: Tag, as: "tags" },
  ],
});
// post.author.profile, post.comments[0].commenter, post.tags all available
```

**Why good:** Deep relation loading in single query, each level specifies its alias

---

## Filtering Included Models

### Good Example - Where on Include

```typescript
// Filter included records (still LEFT JOIN by default)
const user = await User.findByPk(userId, {
  include: [
    {
      model: Post,
      as: "posts",
      where: { published: true }, // Only include published posts
      required: false, // LEFT JOIN - user returned even with 0 posts
    },
  ],
});
```

**Why good:** `where` filters the included records, `required: false` keeps it as LEFT JOIN

**Gotcha:** When you add `where` to an include, Sequelize changes the default to `required: true` (INNER JOIN). This means the parent record is excluded if no child matches. Explicitly set `required: false` to preserve LEFT JOIN behavior.

### Good Example - Required Include (INNER JOIN)

```typescript
// Only return users who HAVE at least one published post
const activeAuthors = await User.findAll({
  include: [
    {
      model: Post,
      as: "posts",
      where: { published: true },
      required: true, // INNER JOIN - users without published posts excluded
    },
  ],
});
```

**Why good:** `required: true` acts as existence filter on parent records

---

## Separate Queries (Large Has-Many)

### Good Example - separate: true

```typescript
// When users have many posts, JOIN creates a cartesian product
// separate: true runs 2 queries instead
const users = await User.findAll({
  include: [
    {
      model: Post,
      as: "posts",
      separate: true, // 2 queries instead of JOIN
      order: [["createdAt", "DESC"]], // Order within the separate query
      limit: 10, // Limit per user
    },
  ],
  limit: 50,
});
```

**Why good:** Avoids cartesian product from large JOIN, allows per-user limit and ordering, much faster for large has-many relationships

**When to use:** When a parent has hundreds/thousands of child records. JOIN would return parent_count \* child_count rows.

---

## Many-to-Many Patterns

### Good Example - Through Table Operations

```typescript
// Add tags to post (connect existing records)
await post.addTags([tag1.id, tag2.id]);

// Remove a tag
await post.removeTag(tag1.id);

// Replace all tags
await post.setTags([tag3.id, tag4.id]); // Removes old, adds new

// Get tags
const tags = await post.getTags();

// Check existence
const hasTag = await post.hasTag(tag1.id);
```

**Why good:** Mixin methods handle junction table automatically, `setTags` atomically replaces all associations

### Good Example - Through Table with Extra Fields

```typescript
// Junction model with extra fields
export class PostTag extends Model<
  InferAttributes<PostTag>,
  InferCreationAttributes<PostTag>
> {
  declare postId: ForeignKey<Post["id"]>;
  declare tagId: ForeignKey<Tag["id"]>;
  declare assignedAt: CreationOptional<Date>;
  declare assignedBy: string | null;
}

PostTag.init(
  {
    assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    assignedBy: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, tableName: "post_tags", timestamps: false },
);

// Access junction data in queries
const post = await Post.findByPk(postId, {
  include: [
    {
      model: Tag,
      as: "tags",
      through: { attributes: ["assignedAt", "assignedBy"] },
    },
  ],
});

// Junction data is on tag.PostTag (the through model)
for (const tag of post.tags) {
  console.log(tag.name, tag.PostTag.assignedAt);
}
```

**Why good:** Explicit junction model when join table needs extra fields, `through.attributes` controls which junction fields to fetch

---

## Self-Referencing Associations

### Good Example - Hierarchical Data

```typescript
export class Category extends Model<
  InferAttributes<Category>,
  InferCreationAttributes<Category>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare parentId: ForeignKey<Category["id"]> | null;
  declare parent?: NonAttribute<Category>;
  declare children?: NonAttribute<Category[]>;
}

// Self-referencing: a category can have a parent and children
Category.hasMany(Category, { foreignKey: "parentId", as: "children" });
Category.belongsTo(Category, { foreignKey: "parentId", as: "parent" });

// Query tree
const roots = await Category.findAll({
  where: { parentId: null },
  include: [
    {
      model: Category,
      as: "children",
      include: [{ model: Category, as: "children" }], // Grandchildren
    },
  ],
});
```

**Why good:** Self-relation for hierarchies, filter `parentId: null` for roots, nested includes for tree depth

---

## Attributes Control

### Good Example - Select Specific Fields

```typescript
// Only fetch specific columns
const users = await User.findAll({
  attributes: ["id", "name", "email"],
  // Does NOT fetch: role, createdAt, updatedAt, etc.
});

// Exclude specific columns
const users = await User.findAll({
  attributes: { exclude: ["password", "secretToken"] },
});

// Aggregations
const stats = await Post.findAll({
  attributes: [
    "authorId",
    [sequelize.fn("COUNT", sequelize.col("id")), "postCount"],
    [sequelize.fn("MAX", sequelize.col("created_at")), "latestPost"],
  ],
  group: ["authorId"],
});
```

**Why good:** `attributes` limits columns fetched, `exclude` for hiding sensitive fields, `fn`/`col` for aggregations

---

## Quick Reference

| Pattern                                 | SQL Equivalent       | Use When                   |
| --------------------------------------- | -------------------- | -------------------------- |
| `include: [{ model: X, as: "a" }]`      | LEFT JOIN            | Load related data          |
| `include: [{ ..., required: true }]`    | INNER JOIN           | Only parents with children |
| `include: [{ ..., where: {...} }]`      | LEFT JOIN + WHERE    | Filter included records    |
| `include: [{ ..., separate: true }]`    | 2 separate queries   | Large has-many sets        |
| `include: [{ ..., attributes: [...] }]` | SELECT specific cols | Limit payload              |
| `through: { attributes: [...] }`        | Junction table cols  | M:N with extra fields      |

| Association Method                | What It Does             |
| --------------------------------- | ------------------------ |
| `getX()` / `getXs()`              | Lazy load association    |
| `setX(instance)` / `setXs([...])` | Replace association(s)   |
| `addX(instance)` / `addXs([...])` | Add to association       |
| `removeX(instance)`               | Remove from association  |
| `hasX(instance)`                  | Check if associated      |
| `countXs()`                       | Count associated records |
| `createX(data)`                   | Create and associate     |
