# TypeORM - QueryBuilder Examples

> Joins, subqueries, pagination, aggregation, and raw queries. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand entity definitions and repository patterns from [core.md](core.md).

---

## Basic QueryBuilder

### Good Example - Select with Conditions

```typescript
const DEFAULT_PAGE_SIZE = 20;

const users = await AppDataSource.getRepository(User)
  .createQueryBuilder("user")
  .select(["user.id", "user.name", "user.email"])
  .where("user.isActive = :active", { active: true })
  .andWhere("user.role = :role", { role: "admin" })
  .orderBy("user.createdAt", "DESC")
  .take(DEFAULT_PAGE_SIZE)
  .getMany();
```

**Why good:** Parameterized queries prevent SQL injection, `select` reduces payload, `take` for entity-safe pagination

### Bad Example - String Interpolation

```typescript
// BAD: SQL injection vulnerability
const email = req.body.email;
const user = await userRepo
  .createQueryBuilder("user")
  .where(`user.email = '${email}'`) // INJECTION!
  .getOne();
```

**Why bad:** Attacker can pass `' OR 1=1 --` as email; always use `:paramName` with parameter objects

---

## Joins

### Good Example - Left Join and Select

```typescript
// Load relation data (like find with relations, but with conditions)
const usersWithPosts = await userRepo
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post")
  .where("user.isActive = :active", { active: true })
  .getMany();
// Returns User[] with posts array populated

// Conditional join - only load published posts
const usersWithPublishedPosts = await userRepo
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post", "post.published = :pub", {
    pub: true,
  })
  .getMany();
// Users without published posts still returned (left join), but posts array empty

// Inner join - only users who HAVE published posts
const activeAuthors = await userRepo
  .createQueryBuilder("user")
  .innerJoinAndSelect("user.posts", "post", "post.published = :pub", {
    pub: true,
  })
  .getMany();
// Only users with at least one published post returned
```

**Why good:** `leftJoinAndSelect` loads relations with optional condition, `innerJoinAndSelect` filters parent by relation existence, third parameter adds JOIN condition

### Good Example - Join Without Select (Filter Only)

```typescript
// Filter by relation without loading it
const usersWithRecentPosts = await userRepo
  .createQueryBuilder("user")
  .innerJoin("user.posts", "post") // Join but don't select post columns
  .where("post.createdAt > :date", { date: new Date("2024-01-01") })
  .getMany();
// Returns User[] without posts populated (smaller payload)
```

**Why good:** `innerJoin` without Select uses the relation for filtering without loading relation data - smaller payload

---

## Pagination with Joins

### Good Example - take/skip (Correct)

```typescript
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const getPaginatedPosts = async (page: number, pageSize: number) => {
  const take = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const [posts, total] = await postRepo
    .createQueryBuilder("post")
    .leftJoinAndSelect("post.tags", "tag")
    .leftJoinAndSelect("post.author", "author")
    .where("post.published = :pub", { pub: true })
    .orderBy("post.createdAt", "DESC")
    .take(take) // Paginates on ENTITIES, not rows
    .skip(skip)
    .getManyAndCount();

  return { data: posts, total, page, pageSize: take };
};
```

**Why good:** `take`/`skip` handles pagination correctly with joins (paginates entities, not joined rows), `getManyAndCount` returns total in same query, `Math.min` caps page size

### Bad Example - limit/offset with Joins

```typescript
// BAD: limit/offset counts joined rows, not entities
const posts = await postRepo
  .createQueryBuilder("post")
  .leftJoinAndSelect("post.comments", "comment")
  .limit(10) // If a post has 5 comments, that's 5 rows for 1 post
  .offset(0) // You might get only 2-3 posts instead of 10
  .getMany();
```

**Why bad:** `limit`/`offset` operate on SQL rows, not entities. A post with 5 comments counts as 5 rows, so `limit(10)` might return only 2 posts. Use `take`/`skip` instead.

---

## Subqueries

### Good Example - Subquery in WHERE

```typescript
// Find users whose post count exceeds a threshold
const MINIMUM_POST_COUNT = 5;

const prolificAuthors = await userRepo
  .createQueryBuilder("user")
  .where((qb) => {
    const subQuery = qb
      .subQuery()
      .select("post.authorId")
      .from(Post, "post")
      .groupBy("post.authorId")
      .having("COUNT(post.id) >= :minPosts", { minPosts: MINIMUM_POST_COUNT })
      .getQuery();
    return `user.id IN ${subQuery}`;
  })
  .getMany();
```

**Why good:** Subquery runs in DB (not in JS), named constant for threshold, parameters flow through correctly

### Good Example - Subquery in SELECT

```typescript
// Add computed column via subquery
const usersWithPostCount = await userRepo
  .createQueryBuilder("user")
  .addSelect((qb) => {
    return qb
      .subQuery()
      .select("COUNT(post.id)")
      .from(Post, "post")
      .where("post.authorId = user.id")
      .getQuery();
  }, "postCount")
  .getRawMany();
// Returns raw objects: { user_id, user_name, ..., postCount }
```

**Why good:** Computed column calculated in DB, correlated subquery references outer query, `getRawMany` for non-entity results

---

## Aggregation

### Good Example - Group By with Having

```typescript
// Posts per author with minimum count filter
const MINIMUM_POSTS = 3;

const authorStats = await postRepo
  .createQueryBuilder("post")
  .select("post.authorId", "authorId")
  .addSelect("COUNT(post.id)", "postCount")
  .addSelect("MAX(post.createdAt)", "latestPost")
  .groupBy("post.authorId")
  .having("COUNT(post.id) >= :min", { min: MINIMUM_POSTS })
  .orderBy("postCount", "DESC")
  .getRawMany();
// Returns: [{ authorId: "...", postCount: "5", latestPost: "..." }, ...]
```

**Why good:** Aggregations run in DB, `HAVING` filters after grouping, `getRawMany` for aggregate results (not entity-shaped)

**Note:** `getRawMany` returns raw objects with column aliases, not entity instances. Numeric aggregates may come back as strings depending on the driver.

---

## Raw Queries

### Good Example - Parameterized Raw Query

```typescript
// When QueryBuilder is too limiting
const result = await AppDataSource.query(
  `SELECT u.id, u.name, COUNT(p.id) as "postCount"
   FROM users u
   LEFT JOIN posts p ON p.author_id = u.id AND p.published = $1
   GROUP BY u.id, u.name
   HAVING COUNT(p.id) >= $2
   ORDER BY "postCount" DESC`,
  [true, 5], // Parameterized - safe from injection
);
// Returns raw rows: [{ id, name, postCount }, ...]
```

**Why good:** Parameterized even in raw queries (no string interpolation), useful for complex queries that don't map well to QueryBuilder

### Bad Example - Unparameterized Raw Query

```typescript
// BAD: String interpolation in raw query
const result = await AppDataSource.query(
  `SELECT * FROM users WHERE email = '${email}'`, // SQL INJECTION!
);
```

**Why bad:** Same injection risk as QueryBuilder - always use parameter placeholders (`$1, $2` for PostgreSQL, `?, ?` for MySQL)

---

## Advanced Patterns

### Good Example - Conditional Query Building

```typescript
interface PostFilterParams {
  authorId?: string;
  published?: boolean;
  search?: string;
  tags?: string[];
}

const DEFAULT_PAGE_SIZE = 20;

const filterPosts = async (filters: PostFilterParams, page = 1) => {
  const qb = postRepo
    .createQueryBuilder("post")
    .leftJoinAndSelect("post.author", "author")
    .leftJoinAndSelect("post.tags", "tag");

  if (filters.authorId) {
    qb.andWhere("post.authorId = :authorId", { authorId: filters.authorId });
  }

  if (filters.published !== undefined) {
    qb.andWhere("post.published = :published", {
      published: filters.published,
    });
  }

  if (filters.search) {
    qb.andWhere("post.title ILIKE :search", { search: `%${filters.search}%` });
  }

  if (filters.tags?.length) {
    qb.andWhere("tag.name IN (:...tagNames)", { tagNames: filters.tags });
  }

  return qb
    .orderBy("post.createdAt", "DESC")
    .take(DEFAULT_PAGE_SIZE)
    .skip((page - 1) * DEFAULT_PAGE_SIZE)
    .getManyAndCount();
};
```

**Why good:** Conditions appended only when filters present, `:...param` spreads arrays into `IN` clause, QueryBuilder is mutable so conditions chain naturally

### Good Example - Locking

```typescript
// Pessimistic lock - prevents concurrent reads/writes
const user = await userRepo
  .createQueryBuilder("user")
  .setLock("pessimistic_write")
  .where("user.id = :id", { id: userId })
  .getOne();
// Row locked until transaction commits/rolls back

// Optimistic lock with version column
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @VersionColumn()
  version: number;
}

// Throws OptimisticLockVersionMismatchError if version changed
await userRepo
  .createQueryBuilder()
  .update(User)
  .set({ name: "Updated" })
  .where("id = :id AND version = :version", {
    id: userId,
    version: expectedVersion,
  })
  .execute();
```

**Why good:** Pessimistic lock for critical sections, optimistic lock via `@VersionColumn` for low-contention updates

---

## Quick Reference

| Method            | Returns Entities | Use When                        |
| ----------------- | ---------------- | ------------------------------- |
| `getOne`          | Yes              | Single entity by condition      |
| `getMany`         | Yes              | Multiple entities               |
| `getManyAndCount` | Yes + count      | Paginated results               |
| `getRawOne`       | No (raw)         | Single aggregate/computed value |
| `getRawMany`      | No (raw)         | Multiple aggregates             |
| `getCount`        | No (number)      | Count without loading entities  |
| `execute`         | UpdateResult     | INSERT/UPDATE/DELETE via QB     |
