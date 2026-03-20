# Sequelize - Core Examples

> Instance setup, model definitions, TypeScript patterns, and CRUD operations. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: None - these are the foundational patterns.

---

## Sequelize Instance Setup

### Good Example - Full Configuration

```typescript
import { Sequelize } from "sequelize";

const MIN_POOL_SIZE = 0;
const MAX_POOL_SIZE = 10;
const POOL_ACQUIRE_TIMEOUT_MS = 30000;
const POOL_IDLE_TIMEOUT_MS = 10000;

export const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  pool: {
    min: MIN_POOL_SIZE,
    max: MAX_POOL_SIZE,
    acquire: POOL_ACQUIRE_TIMEOUT_MS,
    idle: POOL_IDLE_TIMEOUT_MS,
  },
  define: {
    underscored: true, // snake_case column names in DB
  },
});
```

**Why good:** Named constants for pool config, conditional logging, `underscored: true` for DB convention, explicit pool sizing

### Good Example - Connection URI

```typescript
export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl:
      process.env.NODE_ENV === "production"
        ? { require: true, rejectUnauthorized: false }
        : false,
  },
});
```

**Why good:** URI-based for deployment platforms, SSL for production, logging off in prod

### Good Example - Graceful Shutdown

```typescript
const shutdown = async () => {
  await sequelize.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

**Why good:** Drains connection pool, prevents leaked connections on restart

---

## Model Definition with TypeScript (v6)

### Good Example - Complete Model

```typescript
import {
  Model,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type NonAttribute,
  type ForeignKey,
} from "sequelize";
import { sequelize } from "./connection";

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  // CreationOptional = not required in create()
  declare id: CreationOptional<number>;
  declare email: string;
  declare name: string | null; // nullable fields are automatically optional in create()
  declare role: CreationOptional<string>;

  // Timestamps - always CreationOptional
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Association fields - NonAttribute to exclude from InferAttributes
  declare posts?: NonAttribute<Post[]>;

  // Association mixin methods
  declare getPosts: HasManyGetAssociationsMixin<Post>;
  declare addPost: HasManyAddAssociationMixin<Post, number>;
  declare createPost: HasManyCreateAssociationMixin<Post, "authorId">;
  declare countPosts: HasManyCountAssociationsMixin;

  // Custom instance methods
  get fullDisplayName(): NonAttribute<string> {
    return `${this.name} (${this.role})`;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
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
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "users", // Explicit - avoids pluralization guessing
    timestamps: true, // createdAt + updatedAt
    underscored: true, // created_at, updated_at in DB
  },
);
```

**Why good:** `declare` on every property, `CreationOptional` for auto-fields, `NonAttribute` for associations and getters, explicit `tableName`, typed mixin methods, inline validation

### Bad Example - Missing declare

```typescript
// BAD: TypeScript emits class fields
export class User extends Model {
  id!: number; // Non-null assertion, no declare
  email!: string; // These override Sequelize's getters
  name!: string;
}
```

**Why bad:** Without `declare`, TS emits JavaScript class field declarations that override Sequelize's internal property descriptors, causing `user.email` to return `undefined` even when the database has data

---

## Model Definition with TypeScript (v7 Alpha)

### Good Example - Decorator-Based (v7)

```typescript
import {
  Model,
  Sequelize,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from "@sequelize/core";
import {
  Attribute,
  PrimaryKey,
  AutoIncrement,
  NotNull,
  Default,
} from "@sequelize/core/decorators-legacy";
import { SqliteDialect } from "@sequelize/sqlite3";

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  @Attribute(DataTypes.INTEGER)
  @PrimaryKey
  @AutoIncrement
  declare id: CreationOptional<number>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare email: string;

  @Attribute(DataTypes.STRING)
  declare name: string | null;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Default("user")
  declare role: CreationOptional<string>;
}

// v7: Register models in Sequelize constructor, dialect is a class not a string
const sequelize = new Sequelize({
  dialect: SqliteDialect,
  models: [User],
});
```

**Why good:** Decorators co-locate type and schema info, scoped imports from `@sequelize/core`, models registered in constructor

**When to use:** Only in v7 alpha projects. v6 stable uses `Model.init()`.

---

## ForeignKey Typing

### Good Example - ForeignKey Brand Type

```typescript
import { type ForeignKey } from "sequelize";

export class Post extends Model<
  InferAttributes<Post>,
  InferCreationAttributes<Post>
> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare content: string | null;
  declare published: CreationOptional<boolean>;

  // ForeignKey<T> tells Sequelize this is managed by associations
  declare authorId: ForeignKey<User["id"]>;

  // Association property
  declare author?: NonAttribute<User>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Post.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: true },
    published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // authorId does NOT need to be in init() --- it's added by the association
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: "posts" },
);
```

**Why good:** `ForeignKey<T>` brands the field so `InferAttributes` knows it's managed by the association, not by `init()`

---

## Read Operations

### Good Example - findByPk and findOne

```typescript
// Find by primary key - returns Model | null
const user = await User.findByPk(userId);
if (!user) throw new Error("User not found");

// Find by unique field
const userByEmail = await User.findOne({
  where: { email: "alice@example.com" },
});

// Throw if not found (rejectOnEmpty)
const user = await User.findByPk(userId, {
  rejectOnEmpty: true, // throws EmptyResultError
});
```

**Why good:** `findByPk` for primary key lookups, `findOne` for unique fields, `rejectOnEmpty` for guaranteed existence

### Good Example - findAll with Filters and Pagination

```typescript
import { Op } from "sequelize";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

const getUsers = async ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  search,
}: PaginationParams) => {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const { rows, count } = await User.findAndCountAll({
    where: search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : undefined,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: {
      page,
      pageSize: limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};
```

**Why good:** `findAndCountAll` for paginated lists, `Math.min` caps page size, `Op.iLike` for case-insensitive search, named constants for limits

---

## Create Operations

### Good Example - create and bulkCreate

```typescript
// Single create
const user = await User.create({
  email: "bob@example.com",
  name: "Bob",
  // role and id are CreationOptional --- defaults apply
});

// Bulk create with validation
const users = await User.bulkCreate(
  [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
    { email: "user3@example.com", name: "User 3" },
  ],
  {
    validate: true, // Run model validations on each record
    ignoreDuplicates: true, // Skip records that violate unique constraints
  },
);
```

**Why good:** `validate: true` on bulkCreate (off by default), `ignoreDuplicates` for idempotent inserts

### Good Example - findOrCreate

```typescript
const [user, created] = await User.findOrCreate({
  where: { email: "alice@example.com" },
  defaults: { name: "Alice", role: "user" },
});

if (created) {
  // New user was created
} else {
  // Existing user was found
}
```

**Why good:** Atomic find-or-create, `created` boolean indicates which path was taken

---

## Update Operations

### Good Example - Instance and Static Updates

```typescript
// Instance update (fires hooks)
const user = await User.findByPk(userId);
if (!user) throw new Error("User not found");
await user.update({ name: "New Name", role: "admin" });

// Static update (fires bulk hooks only)
const [affectedCount] = await User.update(
  { role: "user" },
  { where: { role: "guest" } },
);

// Increment/decrement
await post.increment("viewCount", { by: 1 });
await account.decrement("balance", { by: amount });
```

**Why good:** Instance `update()` fires per-record hooks, static `update()` for batch, `increment`/`decrement` are atomic

---

## Delete Operations

### Good Example - destroy Patterns

```typescript
// Instance destroy
const user = await User.findByPk(userId);
if (!user) throw new Error("User not found");
await user.destroy(); // Soft delete if paranoid, hard delete otherwise

// Static destroy
const deletedCount = await User.destroy({
  where: { role: "guest", createdAt: { [Op.lt]: cutoffDate } },
});

// Force hard delete on paranoid model
await user.destroy({ force: true });

// Restore soft-deleted record
await user.restore();
```

**Why good:** Instance and static destroy, `force: true` for hard delete escape hatch, `restore()` for undo

---

## Upsert

### Good Example - Create or Update

```typescript
// Upsert - creates if not exists, updates if exists
// Returns [instance, created] but `created` is unreliable on some dialects
const [user] = await User.upsert({
  email: "alice@example.com",
  name: "Alice Updated",
  role: "admin",
});
```

**Why good:** Atomic create-or-update based on primary key or unique constraint

**Gotcha:** The `created` boolean (second element) is only reliable on PostgreSQL. On MySQL/SQLite it may always be `true` or `null`. Don't depend on it for logic.

---

## Quick Reference

| Operation                 | Returns                        | Throws if Not Found         |
| ------------------------- | ------------------------------ | --------------------------- |
| `findByPk(id)`            | `T \| null`                    | No (unless `rejectOnEmpty`) |
| `findOne({ where })`      | `T \| null`                    | No (unless `rejectOnEmpty`) |
| `findAll({ where })`      | `T[]`                          | No (empty array)            |
| `findAndCountAll`         | `{ rows: T[], count: number }` | No                          |
| `findOrCreate`            | `[T, boolean]`                 | No                          |
| `create(data)`            | `T`                            | N/A                         |
| `bulkCreate(data[])`      | `T[]`                          | N/A                         |
| `update(data, { where })` | `[affectedCount]`              | No                          |
| `destroy({ where })`      | `number` (deleted count)       | No                          |
| `upsert(data)`            | `[T, boolean \| null]`         | N/A                         |
| `count({ where })`        | `number`                       | No                          |
