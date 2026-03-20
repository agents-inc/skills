# Sequelize - Advanced Examples

> Scopes, hooks, paranoid mode, raw queries, operators, and migrations. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand model definitions from [core.md](core.md) and associations from [associations.md](associations.md) first.

---

## Scopes

### Good Example - Default and Named Scopes

```typescript
import { Op } from "sequelize";

const RECENT_DAYS = 30;

Post.init(
  {
    /* attributes */
  },
  {
    sequelize,
    tableName: "posts",
    defaultScope: {
      where: { published: true }, // Applied to ALL queries by default
    },
    scopes: {
      // Static scope
      drafts: {
        where: { published: false },
      },
      // Function scope with parameter
      byAuthor(authorId: number) {
        return { where: { authorId } };
      },
      // Scope with includes
      withAuthor: {
        include: [{ model: User, as: "author" }],
      },
      // Dynamic scope
      recent: {
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        order: [["createdAt", "DESC"]],
      },
    },
  },
);

// Usage:
const published = await Post.findAll(); // defaultScope applies
const drafts = await Post.scope("drafts").findAll(); // Named scope
const both = await Post.scope("drafts", "withAuthor").findAll(); // Combined
const unscoped = await Post.unscoped().findAll(); // No scope at all

// Function scope with arguments
const authorPosts = await Post.scope({
  method: ["byAuthor", userId],
}).findAll();
```

**Why good:** `defaultScope` for common filters, named scopes for reusable query presets, function scopes for dynamic parameters, `unscoped()` escape hatch

### Scope Gotchas

```typescript
// GOTCHA 1: defaultScope applies to findByPk too!
const post = await Post.findByPk(123);
// This only returns the post if published: true!
// To get any post by PK:
const post = await Post.unscoped().findByPk(123);

// GOTCHA 2: Same-field where clauses OVERWRITE, not AND
Post.init(
  {},
  {
    sequelize,
    scopes: {
      published: { where: { status: "published" } },
      featured: { where: { status: "featured" } }, // This REPLACES status, not ANDs
    },
  },
);
const posts = await Post.scope("published", "featured").findAll();
// WHERE status = 'featured' --- NOT WHERE status = 'published' AND status = 'featured'

// Fix: Use whereMergeStrategy (v6.18+)
Post.init(
  {},
  {
    sequelize,
    whereMergeStrategy: "and",
    scopes: {
      /* same scopes */
    },
  },
);
// Now: WHERE status = 'published' AND status = 'featured'
```

---

## Hooks (Lifecycle Events)

### Good Example - Common Hook Patterns

```typescript
User.init(
  {
    /* attributes */
  },
  {
    sequelize,
    tableName: "users",
    hooks: {
      // Hash password before create/update
      beforeCreate: async (user) => {
        if (user.changed("password")) {
          user.password = await hashPassword(user.password);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await hashPassword(user.password);
        }
      },
      // Normalize email
      beforeValidate: (user) => {
        if (user.email) {
          user.email = user.email.toLowerCase().trim();
        }
      },
    },
  },
);
```

**Why good:** `changed("field")` prevents unnecessary re-hashing, `beforeValidate` for normalization, `beforeCreate`/`beforeUpdate` for transforms

### Good Example - Hooks with Transactions

```typescript
Post.addHook("afterCreate", async (post, options) => {
  // CRITICAL: Pass the transaction from options
  await AuditLog.create(
    {
      action: "post_created",
      entityId: post.id,
      entityType: "Post",
    },
    { transaction: options.transaction }, // Use the caller's transaction!
  );
});
```

**Why good:** `options.transaction` ensures audit log is part of the same transaction --- rolls back together if something fails

**Gotcha:** If you omit `{ transaction: options.transaction }`, the audit log runs on a separate connection. If the parent transaction rolls back, the audit log persists as orphan data.

### Bulk Operations and Hooks

```typescript
// By default, bulkCreate does NOT fire individual hooks
await User.bulkCreate(users); // Only fires beforeBulkCreate / afterBulkCreate

// Enable individual hooks (performance cost: loads all into memory)
await User.bulkCreate(users, { individualHooks: true });
// Now fires: beforeValidate, afterValidate, beforeCreate, afterCreate for EACH record

// Same for update/destroy
await User.update(
  { role: "user" },
  {
    where: { role: "guest" },
    individualHooks: true, // Fires beforeUpdate/afterUpdate per record
  },
);
```

**Why good:** Explicit about when individual hooks fire, `individualHooks: true` when you need per-record behavior

**Gotcha:** `individualHooks: true` fetches ALL matching records into memory, then processes each one. On large datasets this can be very slow and memory-intensive.

---

## Paranoid Mode (Soft Deletes)

### Good Example - Setup and Usage

```typescript
Post.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT },
  },
  {
    sequelize,
    tableName: "posts",
    paranoid: true, // Enables soft delete
    timestamps: true, // REQUIRED for paranoid to work
    // deletedAt column is auto-created
  },
);

// Soft delete - sets deletedAt to current timestamp
await post.destroy();

// Hard delete - actually removes the row
await post.destroy({ force: true });

// Restore soft-deleted record
await post.restore();

// Static restore with conditions
await Post.restore({ where: { authorId: userId } });

// Normal queries exclude soft-deleted records
const posts = await Post.findAll(); // Only non-deleted

// Include soft-deleted records
const allPosts = await Post.findAll({ paranoid: false });
```

**Why good:** `paranoid: true` for soft deletes, `force: true` escape hatch, `restore()` to undo, `paranoid: false` in queries to see deleted records

### Paranoid Gotchas

```typescript
// GOTCHA 1: paranoid requires timestamps
Post.init(
  {},
  {
    sequelize,
    paranoid: true,
    timestamps: false, // Silently breaks paranoid!
  },
);
// destroy() will actually DELETE the row, not soft-delete

// GOTCHA 2: Eager loading paranoid models
const user = await User.findByPk(userId, {
  include: [
    {
      model: Post,
      as: "posts",
      // By default, soft-deleted posts are excluded from include too
      // To include them:
      paranoid: false,
    },
  ],
});

// GOTCHA 3: where on included paranoid models may return deleted records
// This is a known Sequelize issue --- test carefully when combining
// where clauses with paranoid includes
```

---

## Raw Queries

### Good Example - When ORM Isn't Enough

```typescript
import { QueryTypes } from "sequelize";

// SELECT with typed results
interface UserStats {
  authorId: number;
  postCount: number;
  avgLength: number;
}

const stats = await sequelize.query<UserStats>(
  `SELECT author_id AS "authorId",
          COUNT(*) AS "postCount",
          AVG(LENGTH(content)) AS "avgLength"
   FROM posts
   WHERE published = true
   GROUP BY author_id
   HAVING COUNT(*) > :minPosts
   ORDER BY "postCount" DESC`,
  {
    replacements: { minPosts: 5 },
    type: QueryTypes.SELECT,
  },
);
```

**Why good:** Complex aggregation not easily expressed in ORM, `replacements` for SQL injection prevention, `QueryTypes.SELECT` returns typed array

### Good Example - Bind Parameters vs Replacements

```typescript
// Replacements: Escaped and inserted into query string
const users = await sequelize.query(
  "SELECT * FROM users WHERE email = :email AND role = :role",
  {
    replacements: { email: "alice@example.com", role: "admin" },
    type: QueryTypes.SELECT,
  },
);

// Bind parameters: Sent separately to database (more secure, better for repeated queries)
const users = await sequelize.query(
  "SELECT * FROM users WHERE email = $email AND role = $role",
  {
    bind: { email: "alice@example.com", role: "admin" },
    type: QueryTypes.SELECT,
  },
);
```

**Why good:** Both prevent SQL injection, bind parameters are sent separately from query (better for prepared statements)

---

## Operators (Op)

### Good Example - Complex Where Clauses

```typescript
import { Op } from "sequelize";

const SEARCH_LIMIT = 50;

// Combined AND/OR
const posts = await Post.findAll({
  where: {
    [Op.and]: [
      { published: true },
      {
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { content: { [Op.iLike]: `%${search}%` } },
        ],
      },
    ],
  },
  limit: SEARCH_LIMIT,
});

// Range queries
const recentPosts = await Post.findAll({
  where: {
    createdAt: { [Op.between]: [startDate, endDate] },
    viewCount: { [Op.gte]: 100 },
  },
});

// NOT and NULL handling
const activePosts = await Post.findAll({
  where: {
    deletedAt: { [Op.is]: null },
    status: { [Op.notIn]: ["draft", "archived"] },
  },
});

// Subquery
const popularAuthors = await User.findAll({
  where: {
    id: {
      [Op.in]: sequelize.literal(
        "(SELECT DISTINCT author_id FROM posts WHERE view_count > 1000)",
      ),
    },
  },
});
```

**Why good:** `Op.and`/`Op.or` for composable conditions, `Op.iLike` for case-insensitive (PostgreSQL), `Op.is` for NULL checks, `sequelize.literal` for subqueries

---

## Migrations with queryInterface

### Good Example - Creating a Table

```typescript
// migrations/20240101-create-users.ts
import type { QueryInterface } from "sequelize";
import { DataTypes } from "sequelize";

export const up = async (queryInterface: QueryInterface) => {
  await queryInterface.createTable("users", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("user", "admin", "moderator"),
      allowNull: false,
      defaultValue: "user",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex("users", ["email"], { unique: true });
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.dropTable("users");
};
```

**Why good:** Explicit column types, snake_case column names in migration, separate index creation, reversible with `down`

### Good Example - Adding Columns and Indexes

```typescript
export const up = async (queryInterface: QueryInterface) => {
  // Add column
  await queryInterface.addColumn("posts", "slug", {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  });

  // Backfill data
  await queryInterface.sequelize.query(
    `UPDATE posts SET slug = LOWER(REPLACE(title, ' ', '-')) WHERE slug IS NULL`,
  );

  // Make non-nullable after backfill
  await queryInterface.changeColumn("posts", "slug", {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  });

  // Add composite index
  await queryInterface.addIndex(
    "posts",
    ["author_id", "published", "created_at"],
    {
      name: "idx_posts_author_published_date",
    },
  );
};

export const down = async (queryInterface: QueryInterface) => {
  await queryInterface.removeIndex("posts", "idx_posts_author_published_date");
  await queryInterface.removeColumn("posts", "slug");
};
```

**Why good:** Add nullable, backfill, then make non-nullable prevents migration failure on existing data, named indexes for clear down path

### Migration Gotchas

```typescript
// GOTCHA: queryInterface does NOT fire model hooks
// If your beforeCreate hook hashes passwords, manually hash in the migration:
await queryInterface.bulkInsert("users", [
  { email: "admin@example.com", password: await hashPassword("admin123") },
]);

// GOTCHA: ENUM changes require raw SQL on PostgreSQL
await queryInterface.sequelize.query(
  `ALTER TYPE "enum_users_role" ADD VALUE 'editor'`,
);
// sequelize-cli cannot add/remove enum values with queryInterface alone

// GOTCHA: sequelize-cli uses CommonJS --- if your project is ESM,
// you may need a separate tsconfig or .cjs migration files
```

---

## Quick Reference

### Scope API

| Method                                   | What It Does                        |
| ---------------------------------------- | ----------------------------------- |
| `Model.scope("name")`                    | Apply named scope                   |
| `Model.scope("a", "b")`                  | Combine scopes                      |
| `Model.scope({ method: ["name", arg] })` | Function scope with args            |
| `Model.unscoped()`                       | Remove all scopes                   |
| `Model.scope("defaultScope", "other")`   | Re-add default scope after override |

### Hook Execution

| Hook                                     | Fires On                  | Bulk Default                |
| ---------------------------------------- | ------------------------- | --------------------------- |
| `beforeValidate` / `afterValidate`       | create, update (instance) | Only with `individualHooks` |
| `beforeCreate` / `afterCreate`           | create (instance)         | Only with `individualHooks` |
| `beforeUpdate` / `afterUpdate`           | update (instance)         | Only with `individualHooks` |
| `beforeDestroy` / `afterDestroy`         | destroy (instance)        | Only with `individualHooks` |
| `beforeBulkCreate` / `afterBulkCreate`   | bulkCreate                | Always                      |
| `beforeBulkUpdate` / `afterBulkUpdate`   | Model.update (static)     | Always                      |
| `beforeBulkDestroy` / `afterBulkDestroy` | Model.destroy (static)    | Always                      |

### queryInterface Methods

| Method                              | Use When                      |
| ----------------------------------- | ----------------------------- |
| `createTable(name, columns)`        | New table                     |
| `dropTable(name)`                   | Remove table                  |
| `addColumn(table, column, type)`    | New column                    |
| `removeColumn(table, column)`       | Remove column                 |
| `changeColumn(table, column, type)` | Alter column type/constraints |
| `renameColumn(table, old, new)`     | Rename column                 |
| `addIndex(table, fields, opts)`     | New index                     |
| `removeIndex(table, name)`          | Remove index                  |
| `bulkInsert(table, data)`           | Seed data                     |
| `bulkDelete(table, where)`          | Remove data                   |
