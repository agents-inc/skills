# TypeORM Reference

Decision frameworks, anti-patterns, performance optimization, and checklists for TypeORM.

---

<decision_framework>

## Decision Framework

### Active Record vs Data Mapper?

```
What's the project size and complexity?
├─ Small app, rapid prototype, few entities
│   └─ Active Record (entities extend BaseEntity)
├─ Medium-large app, team collaboration
│   └─ Data Mapper (repositories, separation of concerns)
├─ Need to unit test business logic without DB
│   └─ Data Mapper (repositories are injectable/mockable)
└─ DI-based framework (dependency injection)
    └─ Data Mapper (repositories are injectable/mockable)
```

### Which Write Method?

```
Know the operation type?
├─ Definitely inserting new row(s)
│   ├─ Single row → insert()
│   └─ Multiple rows → insert([...]) (batch)
├─ Definitely updating existing row(s)
│   ├─ By condition → update(criteria, partialEntity)
│   └─ Increment/decrement → update(criteria, { count: () => "count + 1" })
├─ Insert or update (upsert)
│   └─ upsert(entity, conflictColumns)
├─ Don't know if inserting or updating
│   └─ save() (runs SELECT first - acceptable here)
└─ Need cascade saves (nested relations)
    └─ save() (only method that triggers cascades)
```

### Which Read Method?

```
What data do you need?
├─ Single record by primary key or unique field
│   ├─ May not exist → findOne({ where: { id } })
│   └─ Must exist (throw if missing) → findOneOrFail({ where: { id } })
├─ Multiple records
│   ├─ Simple filters → find({ where, order, take, skip })
│   └─ Complex joins/subqueries → createQueryBuilder()
├─ Count only
│   └─ count({ where })
├─ Check existence
│   └─ exists({ where }) or existsBy({ field })
└─ Aggregate (SUM, AVG, etc.)
    └─ createQueryBuilder().select("SUM(...)").getRawOne()
```

### QueryBuilder vs find\*?

```
What's the query complexity?
├─ Simple CRUD with filters
│   └─ find/findOne (cleaner, fully typed)
├─ Need joins with conditions
│   ├─ Eager relations (unconditional) → find with relations option
│   └─ Conditional joins → createQueryBuilder with leftJoinAndSelect
├─ Need subqueries
│   └─ createQueryBuilder with .subQuery()
├─ Need aggregations (GROUP BY, HAVING)
│   └─ createQueryBuilder with .groupBy().having()
├─ Need raw SQL fragments
│   └─ createQueryBuilder with .addSelect(() => subQuery)
└─ Need pagination with joins
    └─ createQueryBuilder with .take()/.skip() (NOT limit/offset)
```

### Which Transaction Approach?

```
What level of control do you need?
├─ Simple: all operations succeed or all fail
│   └─ DataSource.transaction(async (manager) => { ... })
├─ Need specific isolation level
│   └─ DataSource.manager.transaction("SERIALIZABLE", async (manager) => { ... })
├─ Need manual commit/rollback control
│   └─ QueryRunner (connect, startTransaction, commit/rollback, release)
├─ Need to reuse connection across operations
│   └─ QueryRunner (single connection instance)
└─ Nested transactions / savepoints
    └─ QueryRunner with createQueryRunner() per level
```

</decision_framework>

---

<performance>

## Performance Optimization

### Indexing Strategy

Add indexes for columns used in WHERE, ORDER BY, and JOIN conditions:

```typescript
@Entity("posts")
@Index(["authorId"]) // Single column - FK lookups
@Index(["authorId", "published"]) // Composite - common query pattern
@Index(["createdAt"]) // Sort by date
@Index(["title"], { fulltext: true }) // Full-text search (MySQL/PostgreSQL)
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  @Index({ unique: true }) // Inline unique index
  slug: string;

  @Column()
  authorId: string;

  @Column({ default: false })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Avoid save() for Known Operations

```typescript
// WRONG: save() for bulk inserts (2N queries)
for (const item of items) {
  await repo.save(item);
}

// CORRECT: insert() for bulk (1 query)
await repo.insert(items);

// WRONG: save() for updating one field (SELECT + UPDATE)
const user = await repo.findOneBy({ id: userId });
user.name = "New Name";
await repo.save(user);

// CORRECT: update() directly (1 query)
await repo.update({ id: userId }, { name: "New Name" });
```

### Use select to Reduce Payload

```typescript
// WRONG: Loading all columns when you need two
const users = await userRepo.find();

// CORRECT: Select only needed columns
const users = await userRepo.find({
  select: { id: true, name: true },
});
```

### take/skip vs limit/offset in QueryBuilder

```typescript
// WRONG: limit/offset with joins returns wrong count
const posts = await postRepo
  .createQueryBuilder("post")
  .leftJoinAndSelect("post.comments", "comment")
  .limit(10) // Limits total ROWS including joined rows
  .offset(0)
  .getMany();

// CORRECT: take/skip works on entities, not rows
const posts = await postRepo
  .createQueryBuilder("post")
  .leftJoinAndSelect("post.comments", "comment")
  .take(10) // Returns 10 posts (regardless of comment count)
  .skip(0)
  .getMany();
```

### Batch Operations

```typescript
// WRONG: Individual operations in a loop
for (const id of deleteIds) {
  await repo.delete(id);
}

// CORRECT: Batch delete
await repo.delete(deleteIds);

// CORRECT: Batch update with QueryBuilder
await repo
  .createQueryBuilder()
  .update(Post)
  .set({ published: true })
  .where("authorId = :authorId", { authorId })
  .andWhere("status = :status", { status: "reviewed" })
  .execute();
```

### Connection Management

```typescript
// Pool configuration in DataSource options
const AppDataSource = new DataSource({
  type: "postgres",
  extra: {
    max: 20, // Max connections in pool
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
  },
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await AppDataSource.destroy();
  process.exit(0);
});
```

</performance>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Using synchronize in Production

```typescript
// ANTI-PATTERN
const AppDataSource = new DataSource({
  synchronize: true, // NEVER in production
});
```

**Why it's wrong:** `synchronize` compares entities to DB schema and alters tables on every startup. Renaming a column creates a new column and drops the old one - losing all data in that column.

**What to do instead:** Use migrations: `migration:generate` to create, `migration:run` to apply.

---

### save() for Everything

```typescript
// ANTI-PATTERN: Always using save()
const newUser = repo.create({ email, name });
await repo.save(newUser); // SELECT + INSERT = 2 queries

const existingUser = await repo.findOneBy({ id });
existingUser.name = "Updated";
await repo.save(existingUser); // SELECT + UPDATE = 2 queries
```

**Why it's wrong:** `save()` runs a SELECT before every INSERT or UPDATE to determine which to execute. For known operations, this doubles query count. The SELECT includes a subquery that is slow on large tables.

**What to do instead:** Use `insert()` for creates, `update()` for updates, `upsert()` for upsert.

---

### Global Manager in Transactions

```typescript
// ANTI-PATTERN
await AppDataSource.transaction(async (manager) => {
  // WRONG: using global repository/manager
  await AppDataSource.getRepository(User).save(userData);
  // WRONG: using global manager
  await AppDataSource.manager.save(Post, postData);
  // Only this is correct:
  await manager.save(Post, otherData);
});
```

**Why it's wrong:** Global manager/repositories execute outside the transaction. If `manager.save(Post)` fails, the `User` save won't roll back.

**What to do instead:** All operations inside the callback must use the `manager` parameter (or `queryRunner.manager` for QueryRunner transactions).

---

### Eager Loading on Both Sides

```typescript
// ANTI-PATTERN
@Entity()
export class User {
  @OneToMany(() => Post, (post) => post.author, { eager: true })
  posts: Post[];
}

@Entity()
export class Post {
  @ManyToOne(() => User, (user) => user.posts, { eager: true }) // ERROR
  author: User;
}
```

**Why it's wrong:** TypeORM forbids `eager: true` on both sides of a relation - it would cause infinite recursion. This throws an error at runtime.

**What to do instead:** Set `eager: true` on only one side, or omit it entirely and load relations explicitly.

---

### Initializing Relation Arrays

```typescript
// ANTI-PATTERN
@Entity()
export class Question {
  @ManyToMany(() => Category)
  @JoinTable()
  categories: Category[] = []; // Initializing to empty array
}
```

**Why it's wrong:** When you `save()` a Question loaded from the DB, TypeORM sees the empty array and detaches all existing categories. The initialization overwrites the loaded relation data.

**What to do instead:** Don't initialize relation properties. Let TypeORM manage them.

---

### Missing QueryRunner Release

```typescript
// ANTI-PATTERN
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  await queryRunner.manager.save(User, userData);
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
}
// Missing queryRunner.release() - connection leaked!
```

**Why it's wrong:** Without `release()` in a `finally` block, the connection is never returned to the pool. After enough leaked connections, the pool is exhausted and all queries block.

**What to do instead:** Always call `queryRunner.release()` in a `finally` block.

</anti_patterns>

---

## Quick Reference Tables

### Column Type Mapping

| TypeScript Type | TypeORM Column            | PostgreSQL     | MySQL          |
| --------------- | ------------------------- | -------------- | -------------- |
| `string`        | `@Column()`               | `varchar(255)` | `varchar(255)` |
| `string`        | `@Column("text")`         | `text`         | `text`         |
| `number`        | `@Column("int")`          | `integer`      | `int`          |
| `number`        | `@Column("decimal")`      | `numeric`      | `decimal`      |
| `boolean`       | `@Column()`               | `boolean`      | `tinyint(1)`   |
| `Date`          | `@Column("timestamp")`    | `timestamp`    | `datetime`     |
| `object`        | `@Column("jsonb")`        | `jsonb`        | `json`         |
| `string[]`      | `@Column("simple-array")` | `text`         | `text`         |
| `object`        | `@Column("simple-json")`  | `text`         | `text`         |

### Relation Decorator Rules

| Relation     | Decorator     | @JoinColumn            | @JoinTable          | FK Column On |
| ------------ | ------------- | ---------------------- | ------------------- | ------------ |
| One-to-One   | `@OneToOne`   | Required (owning side) | No                  | Owning side  |
| Many-to-One  | `@ManyToOne`  | Optional               | No                  | Many side    |
| One-to-Many  | `@OneToMany`  | No                     | No                  | Other side   |
| Many-to-Many | `@ManyToMany` | No                     | Required (one side) | Join table   |

### find\* Options

| Option        | Purpose                    | Example                    |
| ------------- | -------------------------- | -------------------------- |
| `where`       | Filter conditions          | `{ role: "admin" }`        |
| `relations`   | Load relations             | `{ posts: true }`          |
| `select`      | Pick columns               | `{ id: true, name: true }` |
| `order`       | Sort results               | `{ createdAt: "DESC" }`    |
| `take`        | Limit count                | `20`                       |
| `skip`        | Offset                     | `0`                        |
| `withDeleted` | Include soft-deleted       | `true`                     |
| `cache`       | Cache results (ms or bool) | `60000`                    |

### Migration Commands

| Command                             | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `migration:generate <path> -d <ds>` | Auto-generate from entity diff |
| `migration:create <path>`           | Create empty migration file    |
| `migration:run -d <ds>`             | Execute pending migrations     |
| `migration:revert -d <ds>`          | Revert last executed migration |
| `migration:show -d <ds>`            | Show all migrations and status |

---

## Checklists

### Before Deploying

- [ ] `synchronize: false` in production DataSource
- [ ] All entity changes captured in migrations
- [ ] Indexes on frequently filtered/sorted columns
- [ ] `onDelete` cascade configured on child relations
- [ ] Connection pool limits configured for environment
- [ ] Graceful shutdown calls `AppDataSource.destroy()`
- [ ] `reflect-metadata` imported at application entry point

### Code Review Checklist

- [ ] `insert()`/`update()` used instead of `save()` where operation is known
- [ ] No string interpolation in QueryBuilder `.where()` - parameterized queries only
- [ ] `take()`/`skip()` used instead of `limit()`/`offset()` with joins
- [ ] QueryRunner always released in `finally` block
- [ ] Transaction callback uses provided `manager`, not global one
- [ ] Relation properties NOT initialized with `= []`
- [ ] FK columns exposed alongside relation properties for simple lookups
- [ ] Named constants for pagination limits and timeouts
