# TypeORM - Advanced Examples

> Subscribers, listeners, tree entities, embedded entities. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand entity definitions and DataSource from [core.md](core.md).

---

## Entity Listeners

### Good Example - Lifecycle Hooks on Entity

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
} from "typeorm";
import { createHash } from "crypto";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  normalizedEmail: string | null;

  tempFullName: string; // Not a column - computed on load

  @BeforeInsert()
  normalizeEmailOnInsert() {
    this.normalizedEmail = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  normalizeEmailOnUpdate() {
    if (this.email) {
      this.normalizedEmail = this.email.toLowerCase().trim();
    }
  }

  @AfterLoad()
  computeFullName() {
    this.tempFullName = this.name; // Compute derived properties on load
  }
}
```

**Why good:** Listeners keep entity logic self-contained, `@BeforeInsert`/`@BeforeUpdate` for data normalization, `@AfterLoad` for computed properties

**Critical caveat:** `@BeforeUpdate` and `@AfterUpdate` only fire when using `save()`, NOT with `update()` or `insert()`. If you use `update()` (recommended for performance), listeners won't trigger.

### Available Listener Decorators

| Decorator           | Fires When                  | Works With            |
| ------------------- | --------------------------- | --------------------- |
| `@BeforeInsert`     | Before entity inserted      | `save()` (new)        |
| `@AfterInsert`      | After entity inserted       | `save()` (new)        |
| `@BeforeUpdate`     | Before entity updated       | `save()` (existing)   |
| `@AfterUpdate`      | After entity updated        | `save()` (existing)   |
| `@BeforeRemove`     | Before entity removed       | `remove()`            |
| `@AfterRemove`      | After entity removed        | `remove()`            |
| `@BeforeSoftRemove` | Before soft delete          | `softRemove()`        |
| `@AfterSoftRemove`  | After soft delete           | `softRemove()`        |
| `@AfterLoad`        | After entity loaded from DB | `find*`, QueryBuilder |

**Important:** Do NOT make database calls inside entity listeners. Use subscribers instead.

---

## Subscribers

### Good Example - Audit Log Subscriber

```typescript
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from "typeorm";
import { User } from "../entities/user.entity";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  // Listen only to User entity events
  listenTo() {
    return User;
  }

  async afterInsert(event: InsertEvent<User>): Promise<void> {
    await event.manager.insert("audit_logs", {
      action: "user_created",
      entityId: event.entity.id,
      data: JSON.stringify({ email: event.entity.email }),
      createdAt: new Date(),
    });
  }

  async afterUpdate(event: UpdateEvent<User>): Promise<void> {
    if (!event.entity) return; // entity may be undefined for bulk updates
    await event.manager.insert("audit_logs", {
      action: "user_updated",
      entityId: event.entity.id,
      data: JSON.stringify(event.updatedColumns.map((c) => c.propertyName)),
      createdAt: new Date(),
    });
  }

  async afterRemove(event: RemoveEvent<User>): Promise<void> {
    if (!event.entityId) return;
    await event.manager.insert("audit_logs", {
      action: "user_deleted",
      entityId: event.entityId,
      createdAt: new Date(),
    });
  }
}
```

**Why good:** Subscribers can make DB calls (unlike listeners), `event.manager` participates in the same transaction, `listenTo()` scopes to specific entity, null checks for bulk operations where entity may be undefined

**Registration:** Add subscriber to DataSource config:

```typescript
export const AppDataSource = new DataSource({
  // ...
  subscribers: [UserSubscriber],
});
```

### Good Example - Global Subscriber (All Entities)

```typescript
@EventSubscriber()
export class TimestampSubscriber implements EntitySubscriberInterface {
  // No listenTo() = listens to ALL entities

  beforeInsert(event: InsertEvent<any>): void {
    // Set createdAt/updatedAt on any entity that has these properties
    if ("createdAt" in event.entity) {
      event.entity.createdAt = new Date();
    }
    if ("updatedAt" in event.entity) {
      event.entity.updatedAt = new Date();
    }
  }
}
```

**Why good:** Global subscribers apply cross-cutting logic to all entities without modifying each entity

---

## Embedded Entities

### Good Example - Reusable Column Groups

```typescript
import { Column } from "typeorm";

// Embeddable - not an @Entity, just a column group
export class Address {
  @Column({ length: 255 })
  street: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 10 })
  postalCode: string;

  @Column({ length: 100 })
  country: string;
}

@Entity("companies")
export class Company {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  // Embeds Address columns with prefix
  @Column(() => Address, { prefix: "billing" })
  billingAddress: Address;
  // Creates: billing_street, billing_city, billing_postalCode, billing_country

  @Column(() => Address, { prefix: "shipping" })
  shippingAddress: Address;
  // Creates: shipping_street, shipping_city, shipping_postalCode, shipping_country
}
```

**Why good:** Reusable column groups without extra tables, prefix prevents column name collisions, same `Address` structure used for billing and shipping

**Usage:**

```typescript
const company = new Company();
company.name = "Acme";
company.billingAddress = new Address();
company.billingAddress.street = "123 Main St";
company.billingAddress.city = "Springfield";
// ...
await companyRepo.save(company);
```

---

## Tree Entities

### Good Example - Closure Table (Best for Read and Write)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Tree,
  TreeChildren,
  TreeParent,
} from "typeorm";

@Entity("categories")
@Tree("closure-table") // Stores parent-child in separate closure table
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @TreeChildren()
  children: Category[];

  @TreeParent()
  parent: Category | null;
}
```

**Why good:** Closure table is efficient for both reads and writes, TypeORM manages the closure table automatically

**Usage with TreeRepository:**

```typescript
const categoryRepo = AppDataSource.getTreeRepository(Category);

// Get full tree
const trees = await categoryRepo.findTrees();

// Get ancestors of a node
const ancestors = await categoryRepo.findAncestors(category);

// Get descendants of a node
const descendants = await categoryRepo.findDescendants(category);

// Get roots (no parent)
const roots = await categoryRepo.findRoots();

// Count descendants
const count = await categoryRepo.countDescendants(category);
```

### Tree Strategy Comparison

| Strategy          | Decorator                     | Read Speed       | Write Speed | Multiple Roots |
| ----------------- | ----------------------------- | ---------------- | ----------- | -------------- |
| Adjacency List    | Self-referencing `@ManyToOne` | Slow (recursive) | Fast        | Yes            |
| Closure Table     | `@Tree("closure-table")`      | Fast             | Medium      | Yes            |
| Materialized Path | `@Tree("materialized-path")`  | Fast             | Medium      | Yes            |
| Nested Set        | `@Tree("nested-set")`         | Very Fast        | Slow        | No             |

**Recommendation:** Use Closure Table for general-purpose trees. Use Materialized Path when simplicity matters. Avoid Nested Set unless reads vastly outnumber writes.

---

## Column with select: false

### Good Example - Sensitive Data Exclusion

```typescript
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column({ select: false }) // Excluded from default SELECTs
  passwordHash: string;

  @Column({ select: false })
  twoFactorSecret: string | null;
}

// Default find - passwordHash NOT included
const user = await userRepo.findOneBy({ id: userId });
// user.passwordHash is undefined

// Explicitly select hidden column when needed
const userWithPassword = await userRepo
  .createQueryBuilder("user")
  .addSelect("user.passwordHash")
  .where("user.id = :id", { id: userId })
  .getOne();
// user.passwordHash is now available
```

**Why good:** Sensitive columns excluded by default, must be explicitly requested, prevents accidental exposure in API responses

---

## Virtual/Computed Columns

### Good Example - Using @VirtualColumn (v0.3.17+)

```typescript
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @VirtualColumn({
    query: (alias) =>
      `SELECT COUNT(*) FROM "posts" WHERE "posts"."author_id" = ${alias}.id`,
  })
  postCount: number;
}

// postCount computed by DB on every query
const user = await userRepo.findOneBy({ id: userId });
// user.postCount is a number computed from the subquery
```

**Why good:** DB-computed column, no application-level calculation, always up-to-date, available on standard find queries

---

## Custom Repository (Data Mapper Pattern)

### Good Example - Encapsulated Query Logic

```typescript
// user.repository.ts
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/user.entity";

const DEFAULT_PAGE_SIZE = 20;

export const UserRepository = AppDataSource.getRepository(User).extend({
  findByEmail(email: string) {
    return this.findOneBy({ email });
  },

  findActiveAdmins() {
    return this.find({
      where: { role: UserRole.ADMIN, isActive: true },
      order: { name: "ASC" },
    });
  },

  async findPaginated(page: number, pageSize = DEFAULT_PAGE_SIZE) {
    return this.findAndCount({
      order: { createdAt: "DESC" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  },

  findWithPosts(userId: string) {
    return this.findOne({
      where: { id: userId },
      relations: { posts: true },
    });
  },
});
```

**Why good:** Query logic encapsulated in repository, `extend()` adds custom methods to standard repository, named constants for defaults, reusable across the application

**Usage:**

```typescript
const user = await UserRepository.findByEmail("alice@example.com");
const admins = await UserRepository.findActiveAdmins();
const [users, total] = await UserRepository.findPaginated(1);
```

---

## Quick Reference

| Feature           | Approach              | Use When                                 |
| ----------------- | --------------------- | ---------------------------------------- |
| Entity Listeners  | Decorators on entity  | Simple sync logic (normalize, validate)  |
| Subscribers       | Separate class        | Async logic, DB calls, cross-cutting     |
| Embedded Entities | `@Column(() => Type)` | Reusable column groups without join      |
| Tree Entities     | `@Tree("strategy")`   | Hierarchical data (categories, comments) |
| Custom Repository | `repo.extend({})`     | Encapsulated query logic (Data Mapper)   |
| Virtual Columns   | `@VirtualColumn`      | DB-computed values (counts, aggregates)  |
