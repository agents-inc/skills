# TypeORM - Relations Examples

> All relation types, eager/lazy loading, cascades, and relation gotchas. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand entity definitions and repository patterns from [core.md](core.md).

---

## One-to-One Relations

### Good Example - Profile Relation

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";

@Entity("profiles")
export class Profile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ nullable: true })
  avatarUrl: string | null;

  // Owning side - MUST have @JoinColumn
  @OneToOne(() => User, (user) => user.profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column()
  userId: string; // Expose FK for direct queries
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Inverse side - no @JoinColumn
  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;
}
```

**Why good:** `@JoinColumn` on owning side (Profile) with explicit column name, FK exposed as `userId`, `onDelete: CASCADE` cleans up profile when user deleted, inverse side for bidirectional navigation

### Bad Example - Missing JoinColumn

```typescript
// BAD: @JoinColumn missing on @OneToOne
@Entity()
export class Profile {
  @OneToOne(() => User) // No @JoinColumn - TypeORM won't create FK column!
  user: User;
}
```

**Why bad:** `@OneToOne` requires `@JoinColumn` on the owning side - without it, no FK column is created and the relation won't persist

---

## Many-to-One / One-to-Many

### Good Example - Posts Belong to Author

```typescript
@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  content: string | null;

  @Column({ default: false })
  published: boolean;

  // Many posts belong to one user (owning side - holds FK)
  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "author_id" })
  author: User;

  @Column({ name: "author_id" })
  authorId: string; // Direct FK access without join

  @CreateDateColumn()
  createdAt: Date;
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  // One user has many posts (inverse side)
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
```

**Why good:** FK on Many side (Post), `authorId` exposed for queries without joining, `nullable: false` enforces required author, `onDelete: CASCADE` prevents orphaned posts

---

## Many-to-Many

### Good Example - Implicit Join Table

```typescript
@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  // @JoinTable on owning side (only one side)
  @ManyToMany(() => Tag, (tag) => tag.posts)
  @JoinTable({
    name: "posts_tags", // Explicit join table name
    joinColumn: { name: "post_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tag_id", referencedColumnName: "id" },
  })
  tags: Tag[];
}

@Entity("tags")
export class Tag {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  // Inverse side - no @JoinTable
  @ManyToMany(() => Post, (post) => post.tags)
  posts: Post[];
}
```

**Why good:** `@JoinTable` on one side only with explicit names, bidirectional for querying from either side

### Good Example - Explicit Join Entity (Extra Fields on Relation)

```typescript
// When you need extra columns on the many-to-many relationship
@Entity("post_categories")
export class PostCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Post, (post) => post.postCategories, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: Post;

  @Column()
  postId: string;

  @ManyToOne(() => Category, (category) => category.postCategories, { onDelete: "CASCADE" })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @Column()
  categoryId: string;

  @Column({ default: 0 })
  sortOrder: number; // Extra field on the relationship!

  @CreateDateColumn()
  assignedAt: Date; // Extra field!
}

// Post entity
@OneToMany(() => PostCategory, (pc) => pc.post)
postCategories: PostCategory[];

// Category entity
@OneToMany(() => PostCategory, (pc) => pc.category)
postCategories: PostCategory[];
```

**Why good:** Explicit join entity allows extra columns (`sortOrder`, `assignedAt`), standard ManyToOne/OneToMany patterns, can query the join entity directly

---

## Loading Relations

### Good Example - Explicit Loading with find()

```typescript
const userRepo = AppDataSource.getRepository(User);

// Load specific relations
const userWithPosts = await userRepo.findOne({
  where: { id: userId },
  relations: { posts: true, profile: true },
});

// Nested relation loading
const userWithPostTags = await userRepo.findOne({
  where: { id: userId },
  relations: {
    posts: {
      tags: true, // Load tags on each post
    },
  },
});

// Load relations with field selection
const userSummary = await userRepo.findOne({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    posts: { id: true, title: true },
  },
  relations: { posts: true },
});
```

**Why good:** Explicit relation loading prevents N+1, nested relations loaded in a single query, `select` reduces payload

### Bad Example - N+1 Query Problem

```typescript
// BAD: Loading relations in a loop
const users = await userRepo.find();
for (const user of users) {
  user.posts = await postRepo.findBy({ authorId: user.id }); // N extra queries!
}
```

**Why bad:** 1 query for users + N queries for posts = N+1 queries, use `relations` option or QueryBuilder joins instead

---

## Eager vs Lazy Loading

### Good Example - Eager Relations (Automatic with find\*)

```typescript
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Eager: always loaded with find* methods
  @OneToOne(() => Profile, (profile) => profile.user, { eager: true })
  profile: Profile;

  // NOT eager: loaded only when explicitly requested
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}

// Profile is automatically included
const user = await userRepo.findOneBy({ id: userId });
// user.profile is loaded (eager)
// user.posts is undefined (not loaded)

// GOTCHA: eager does NOT work with QueryBuilder!
const user = await userRepo
  .createQueryBuilder("user")
  .where("user.id = :id", { id: userId })
  .getOne();
// user.profile is NOT loaded! Must use leftJoinAndSelect:
const user = await userRepo
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.profile", "profile")
  .where("user.id = :id", { id: userId })
  .getOne();
```

**Why good:** Eager loading is convenient for always-needed relations, but the key gotcha is documented: it only works with `find*`, not QueryBuilder

### Good Example - Lazy Relations (Promise-Based)

```typescript
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Lazy: returns Promise, loads on access
  @OneToMany(() => Post, (post) => post.author)
  posts: Promise<Post[]>; // MUST be Promise type

  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Promise<Profile>; // MUST be Promise type
}

// Usage - triggers a query when awaited
const user = await userRepo.findOneBy({ id: userId });
const posts = await user.posts; // Triggers SELECT query here
```

**Why good:** Lazy loading defers queries until needed

**Caveat:** Each `await user.posts` triggers a separate query. If accessed in a loop, this creates N+1 problems. Prefer explicit loading with `relations` for predictable performance.

---

## Cascade Operations

### Good Example - Selective Cascades

```typescript
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Cascade only inserts - not updates or removes
  @OneToMany(() => Post, (post) => post.author, {
    cascade: ["insert"], // Only cascade new post creation
  })
  posts: Post[];

  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true, // All cascades - use only when intentional
    onDelete: "CASCADE",
  })
  profile: Profile;
}

// Cascade insert: creating user also creates profile
const user = new User();
user.name = "Alice";
user.profile = new Profile();
user.profile.bio = "Developer";
await userRepo.save(user); // Saves user AND profile

// Cascade insert for posts
user.posts = [new Post()];
user.posts[0].title = "First Post";
await userRepo.save(user); // Also inserts the new post
```

**Why good:** `cascade: ["insert"]` is explicit about what cascades, prevents accidental updates/deletes of relations, `cascade: true` only for tightly coupled entities like User-Profile

### Bad Example - Unintended Cascade

```typescript
// BAD: cascade: true saves anything attached to the entity
@OneToMany(() => Post, (post) => post.author, { cascade: true })
posts: Post[];

// Loading user with posts, modifying a post accidentally, then saving
const user = await userRepo.findOne({
  where: { id: userId },
  relations: { posts: true },
});
user.name = "Updated Name";
// Oops - some code modified user.posts[0].title
await userRepo.save(user); // Also updates the post! Unintended side effect
```

**Why bad:** `cascade: true` propagates all operations including updates - any modification to loaded relations gets saved, risking unintended data changes

---

## Relation Queries with find()

### Good Example - Filter by Relation Data

```typescript
// Find users who have published posts
const usersWithPublishedPosts = await userRepo.find({
  where: {
    posts: {
      published: true,
    },
  },
  relations: { posts: true },
});

// Find posts by author role
const adminPosts = await postRepo.find({
  where: {
    author: {
      role: UserRole.ADMIN,
    },
  },
  relations: { author: true },
});
```

**Why good:** Relation filters in `where` generate efficient JOINs, `relations` loads the matched data

---

## Working with Many-to-Many Relations

### Good Example - Add/Remove/Replace

```typescript
const postRepo = AppDataSource.getRepository(Post);
const tagRepo = AppDataSource.getRepository(Tag);

// Add tags to post
const post = await postRepo.findOne({
  where: { id: postId },
  relations: { tags: true },
});

const newTag = await tagRepo.findOneBy({ id: tagId });
post.tags.push(newTag);
await postRepo.save(post); // Updates join table

// Remove a tag
post.tags = post.tags.filter((t) => t.id !== removeTagId);
await postRepo.save(post); // Updates join table

// Replace all tags
const newTags = await tagRepo.findBy({ id: In(newTagIds) });
post.tags = newTags;
await postRepo.save(post); // Replaces all in join table
```

**Why good:** Push to add, filter to remove, assign to replace - TypeORM manages the join table

**Caveat:** This requires loading existing relations first. For large datasets, use QueryBuilder to manipulate the join table directly.

---

## Quick Reference

| Relation Type   | Decorator       | FK Location  | @JoinColumn | @JoinTable |
| --------------- | --------------- | ------------ | ----------- | ---------- |
| One-to-One      | `@OneToOne`     | Owning side  | Required    | No         |
| Many-to-One     | `@ManyToOne`    | Many side    | Optional    | No         |
| One-to-Many     | `@OneToMany`    | Inverse side | No          | No         |
| Many-to-Many    | `@ManyToMany`   | Join table   | No          | Required   |
| Explicit M-to-M | 2x `@ManyToOne` | Join entity  | Yes         | No         |

| Loading Strategy | Pros                          | Cons                                | Use When                |
| ---------------- | ----------------------------- | ----------------------------------- | ----------------------- |
| Explicit         | Predictable, no extra queries | Must specify each time              | Default choice          |
| Eager            | Automatic with find\*         | Not with QueryBuilder, always loads | Tightly coupled 1:1     |
| Lazy             | Loads on demand               | N+1 risk, Promise syntax awkward    | Rarely used in practice |
