# TypeORM - Core Examples

> DataSource setup, entity definitions, CRUD operations, and repository patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: None - these are the foundational patterns.

---

## DataSource Initialization

### Good Example - Async Initialization with Graceful Shutdown

```typescript
// main.ts
import "reflect-metadata"; // MUST be first import
import { AppDataSource } from "./data-source";

const bootstrap = async () => {
  try {
    await AppDataSource.initialize();
    console.log("DataSource initialized");

    // Start your server here...
  } catch (error) {
    console.error("DataSource initialization failed:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log("DataSource destroyed");
  }
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

bootstrap();
```

**Why good:** `reflect-metadata` imported first (required for decorators), error handling on init, graceful shutdown prevents connection leaks, `isInitialized` check prevents double-destroy

### Bad Example - No Error Handling, No Shutdown

```typescript
// BAD
import { AppDataSource } from "./data-source";
AppDataSource.initialize(); // Unhandled promise, no shutdown
```

**Why bad:** Unhandled promise rejection crashes silently, leaked connections on process exit

---

## DataSource Configuration Variants

### Good Example - Environment-Aware Config

```typescript
// data-source.ts
import { DataSource } from "typeorm";
import type { DataSourceOptions } from "typeorm";
import { User } from "./entities/user.entity";
import { Post } from "./entities/post.entity";

const BASE_POOL_SIZE = 10;
const PRODUCTION_POOL_SIZE = 25;

const baseOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "myapp",
  entities: [User, Post],
  migrations: ["./src/migrations/*.ts"],
  synchronize: false,
  logging:
    process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  extra: {
    max:
      process.env.NODE_ENV === "production"
        ? PRODUCTION_POOL_SIZE
        : BASE_POOL_SIZE,
  },
};

export const AppDataSource = new DataSource(baseOptions);
```

**Why good:** Named constants for pool sizes, explicit entity imports (no globs), conditional logging, `synchronize: false` always, pool size tuned per environment

---

## Entity Definitions

### Good Example - Complete Entity with All Common Patterns

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { randomUUID } from "crypto";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: "enum",
    enum: ["user", "admin", "moderator"],
    default: "user",
  })
  role: string;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ select: false }) // Excluded from default SELECTs
  passwordHash: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn() // Enables soft delete
  deletedAt: Date | null;
}
```

**Why good:** `select: false` on sensitive columns, `DeleteDateColumn` for soft delete, nullable types match TypeScript, explicit column types and lengths, `uuid` primary key

### Good Example - Enum as TypeScript Enum

```typescript
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  MODERATOR = "moderator",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;
}
```

**Why good:** TypeScript enum gives type safety and autocomplete, matches DB enum values

---

## Read Operations

### Good Example - Find Variants

```typescript
const userRepo = AppDataSource.getRepository(User);

// Find by primary key
const user = await userRepo.findOneBy({ id: userId });
// Returns: User | null

// Find with conditions
const admin = await userRepo.findOne({
  where: { email: "admin@example.com", role: UserRole.ADMIN },
});

// Find or throw
const userOrThrow = await userRepo.findOneByOrFail({ id: userId });
// Throws EntityNotFoundError if not found

// Find many with options
const DEFAULT_PAGE_SIZE = 20;
const users = await userRepo.find({
  where: { isActive: true },
  order: { createdAt: "DESC" },
  take: DEFAULT_PAGE_SIZE,
  skip: 0,
  select: { id: true, name: true, email: true },
});

// Count
const activeCount = await userRepo.countBy({ isActive: true });

// Check existence (v0.3.12+)
const exists = await userRepo.existsBy({ email: "alice@example.com" });
```

**Why good:** `findOneBy` for simple lookups, `findOneByOrFail` when record must exist, `select` reduces payload, named constant for page size

### Good Example - Advanced Filtering with find()

```typescript
import { In, Like, Between, IsNull, Not, LessThan, MoreThan } from "typeorm";

// Multiple conditions (AND)
const users = await userRepo.find({
  where: {
    role: In([UserRole.ADMIN, UserRole.MODERATOR]),
    isActive: true,
    createdAt: MoreThan(new Date("2024-01-01")),
  },
});

// OR conditions (array of where objects)
const users = await userRepo.find({
  where: [{ email: Like("%@company.com") }, { role: UserRole.ADMIN }],
});

// Null checks
const usersWithBio = await userRepo.find({
  where: { bio: Not(IsNull()) },
});

// Range
const recentUsers = await userRepo.find({
  where: {
    createdAt: Between(startDate, endDate),
  },
});
```

**Why good:** TypeORM operators (`In`, `Like`, `Between`, etc.) are type-safe, array of `where` objects for OR conditions

---

## Write Operations

### Good Example - insert() vs save()

```typescript
const userRepo = AppDataSource.getRepository(User);

// PREFERRED: insert() for new records - single INSERT query
const result = await userRepo.insert({
  email: "alice@example.com",
  name: "Alice",
  role: UserRole.USER,
});
// result.identifiers[0].id contains the generated ID
// result.generatedMaps[0] contains generated column values

// PREFERRED: update() for existing records - single UPDATE query
await userRepo.update(
  { id: userId },
  { name: "Alice Updated", role: UserRole.ADMIN },
);

// PREFERRED: upsert() for insert-or-update - single query
await userRepo.upsert(
  { email: "alice@example.com", name: "Alice", role: UserRole.USER },
  ["email"], // Conflict columns (must be unique/PK)
);

// save() - only when you need cascade saves or don't know the operation
const user = userRepo.create({ email: "bob@example.com", name: "Bob" });
const savedUser = await userRepo.save(user);
```

**Why good:** `insert()` and `update()` each run 1 query, `save()` runs 2 (SELECT + INSERT/UPDATE); use `save()` only when cascades or ambiguity require it

### Good Example - Bulk Operations

```typescript
// Bulk insert
await userRepo.insert([
  { email: "user1@example.com", name: "User 1" },
  { email: "user2@example.com", name: "User 2" },
  { email: "user3@example.com", name: "User 3" },
]);

// Bulk update
await userRepo.update({ isActive: false }, { deletedAt: new Date() });

// Bulk delete
await userRepo.delete({ isActive: false });
// Or by IDs:
await userRepo.delete([id1, id2, id3]);
```

**Why good:** Single query for batch operations, `delete` accepts array of IDs

---

## Soft Delete

### Good Example - Using @DeleteDateColumn

```typescript
// Entity must have @DeleteDateColumn (see entity definition above)

const userRepo = AppDataSource.getRepository(User);

// Soft delete - sets deletedAt, doesn't remove row
await userRepo.softDelete({ id: userId });

// Restore - sets deletedAt back to null
await userRepo.restore({ id: userId });

// Find includes soft-deleted
const allUsers = await userRepo.find({ withDeleted: true });

// Find only soft-deleted
const deletedUsers = await userRepo.find({
  where: { deletedAt: Not(IsNull()) },
  withDeleted: true,
});
```

**Why good:** `softDelete`/`restore` are built-in, `withDeleted: true` to include deleted records, `@DeleteDateColumn` works automatically

---

## Pagination

### Good Example - Offset Pagination with Total Count

```typescript
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const getUsers = async ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginationParams) => {
  const take = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const [users, total] = await AppDataSource.getRepository(User).findAndCount({
    where: { isActive: true },
    order: { createdAt: "DESC" },
    take,
    skip,
  });

  return {
    data: users,
    pagination: {
      page,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};
```

**Why good:** `findAndCount` returns data + total in one call, `Math.min` caps page size, named constants for limits

### Good Example - Cursor Pagination

```typescript
const DEFAULT_PAGE_SIZE = 20;

interface CursorParams {
  cursor?: string;
  take?: number;
}

const getPostsCursor = async ({
  cursor,
  take = DEFAULT_PAGE_SIZE,
}: CursorParams) => {
  const qb = AppDataSource.getRepository(Post)
    .createQueryBuilder("post")
    .where("post.published = :pub", { pub: true })
    .orderBy("post.createdAt", "DESC")
    .take(take + 1); // Fetch one extra to detect next page

  if (cursor) {
    qb.andWhere("post.createdAt < :cursor", { cursor });
  }

  const posts = await qb.getMany();
  const hasNextPage = posts.length > take;
  const data = hasNextPage ? posts.slice(0, -1) : posts;

  return {
    data,
    nextCursor: hasNextPage
      ? data[data.length - 1]?.createdAt.toISOString()
      : undefined,
  };
};
```

**Why good:** Cursor-based scales to large datasets, `take + 1` pattern detects next page without extra count query

---

## Quick Reference

| Operation         | Returns         | Throws on Not Found |
| ----------------- | --------------- | ------------------- |
| `findOneBy`       | `T \| null`     | No                  |
| `findOneByOrFail` | `T`             | Yes                 |
| `findOne`         | `T \| null`     | No                  |
| `findOneOrFail`   | `T`             | Yes                 |
| `find`            | `T[]`           | No (empty array)    |
| `findAndCount`    | `[T[], number]` | No                  |
| `insert`          | `InsertResult`  | N/A                 |
| `update`          | `UpdateResult`  | No                  |
| `upsert`          | `InsertResult`  | N/A                 |
| `save`            | `T` or `T[]`    | N/A                 |
| `delete`          | `DeleteResult`  | No                  |
| `softDelete`      | `UpdateResult`  | No                  |
| `restore`         | `UpdateResult`  | No                  |
| `count`/`countBy` | `number`        | No                  |
| `existsBy`        | `boolean`       | No                  |
