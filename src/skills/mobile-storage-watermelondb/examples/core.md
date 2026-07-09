# WatermelonDB - Core Patterns

> Schema, models, decorators, CRUD, queries, and reactive components. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** React Native 0.74+, `@nozbe/watermelondb` v0.27+, decorator support (Babel plugin `@nozbe/watermelondb/babel/plugin`).

---

## Pattern 1: Database Setup

```typescript
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { schema } from "./schema";
import { migrations } from "./migrations";
import { Post } from "./models/post";
import { Comment } from "./models/comment";
import { User } from "./models/user";

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, // Recommended for iOS; enables synchronous native bridge
  // dbName: "myapp",       // Custom database name (optional)
  // onSetUpError: (error) => { /* handle DB load failure */ },
});

export const database = new Database({
  adapter,
  modelClasses: [Post, Comment, User],
});
```

**Why good:** JSI mode enables synchronous bridge for faster operations on iOS, migrations are passed to adapter for automatic schema evolution, model classes are registered centrally

```typescript
// BAD: Creating database inside a component
function App() {
  const db = new Database({ adapter, modelClasses: [Post] }); // New DB every render
  return <DatabaseProvider database={db}>...</DatabaseProvider>;
}
```

**Why bad:** Creates a new database connection on every render, leaking native resources. Database must be a module-level singleton.

---

## Pattern 2: Schema Definition with All Column Types

```typescript
import { appSchema, tableSchema } from "@nozbe/watermelondb";

const SCHEMA_VERSION = 3;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    tableSchema({
      name: "posts",
      columns: [
        { name: "title", type: "string" },
        { name: "body", type: "string" },
        { name: "subtitle", type: "string", isOptional: true },
        { name: "is_pinned", type: "boolean" },
        { name: "is_published", type: "boolean" },
        { name: "like_count", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
        { name: "author_id", type: "string", isIndexed: true },
      ],
    }),
    tableSchema({
      name: "comments",
      columns: [
        { name: "body", type: "string" },
        { name: "is_active", type: "boolean" },
        { name: "post_id", type: "string", isIndexed: true },
        { name: "author_id", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "users",
      columns: [
        { name: "username", type: "string" },
        { name: "email", type: "string" },
        { name: "avatar_url", type: "string", isOptional: true },
        { name: "is_admin", type: "boolean" },
      ],
    }),
  ],
});
```

**Naming conventions:**

- Tables: plural snake_case (`posts`, `blog_comments`)
- Columns: snake_case (`created_at`, `author_id`)
- Foreign keys: `_id` suffix (`post_id`, `author_id`)
- Booleans: `is_` prefix (`is_pinned`, `is_active`)
- Dates: `_at` suffix with `number` type (`created_at`, `updated_at`)
- `id` column is auto-generated -- never declare it

**Column defaults:** `string` defaults to `""`, `number` to `0`, `boolean` to `false`. Use `isOptional: true` to allow `null`.

---

## Pattern 3: Model with All Decorator Types

```typescript
import { Model } from "@nozbe/watermelondb";
import {
  field,
  text,
  date,
  readonly,
  nochange,
  json,
  relation,
  immutableRelation,
  children,
  writer,
  reader,
} from "@nozbe/watermelondb/decorators";
import { Q } from "@nozbe/watermelondb";
import type { Query, Relation } from "@nozbe/watermelondb";

const sanitizeTags = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(String) : [];

export class Post extends Model {
  static table = "posts";

  // Declare associations for relations and Q.on queries
  static associations = {
    comments: { type: "has_many" as const, foreignKey: "post_id" },
  } as const;

  // --- Field decorators ---
  @text("title") title!: string; // Trims whitespace
  @text("body") body!: string;
  @field("is_pinned") isPinned!: boolean; // Raw column value
  @field("is_published") isPublished!: boolean;
  @field("like_count") likeCount!: number;

  // --- Date decorators ---
  @date("created_at") createdAt!: Date; // Converts timestamp -> Date
  @readonly @date("updated_at") updatedAt!: Date; // Cannot be set at all

  // --- Constraint decorators ---
  @nochange @field("author_id") authorId!: string; // Set once in create()

  // --- JSON decorator ---
  @json("tags", sanitizeTags) tags!: string[]; // Parses JSON from string column

  // --- Relations ---
  @immutableRelation("users", "author_id") author!: Relation<User>; // Never changes
  @children("comments") comments!: Query<Comment>; // To-many

  // --- Actions ---
  @writer async togglePin() {
    await this.update((post) => {
      post.isPinned = !post.isPinned;
    });
  }

  @writer async addComment(body: string, author: User) {
    return await this.collections.get<Comment>("comments").create((comment) => {
      comment.post.set(this);
      comment.author.set(author);
      comment.body = body;
    });
  }

  @writer async softDelete() {
    await this.markAsDeleted();
  }

  @reader async fetchCommentCount() {
    return await this.comments.fetchCount();
  }
}
```

**Why good:** Each decorator communicates intent clearly -- `@text` for user-editable fields, `@readonly` for server-controlled timestamps, `@nochange` for create-once FKs, `@json` with sanitizer for validated complex data

```typescript
// BAD: Using @field for user-editable text
class Post extends Model {
  @field("title") title!: string; // Does NOT trim whitespace
  @field("body") body!: string;
}
```

**Why bad:** `@field` does not trim whitespace -- user input with leading/trailing spaces gets stored as-is. Use `@text` for user-editable fields.

```typescript
// BAD: Using @relation for a fixed FK
class Comment extends Model {
  @relation("posts", "post_id") post!: Relation<Post>; // Mutable -- but it never changes
}
```

**Why bad:** A comment's post never changes. Using `@relation` loses the immutability guarantee and performance optimization of `@immutableRelation`.

---

## Pattern 4: Relation API Methods

```typescript
// --- Reading relations ---
// .fetch() returns a Promise of the related record
const author = await comment.author.fetch();

// .observe() returns an Observable for reactive UI
const author$ = comment.author.observe();

// .id returns just the FK value (no database lookup)
const authorId = comment.author.id;

// --- Setting relations (inside create/update only) ---
@writer async reassignComment(newAuthor: User) {
  await comment.update(() => {
    comment.assignee.set(newAuthor);    // Set by record
    // OR: comment.assignee.id = newAuthor.id;  // Set by ID
  });
}
```

### Many-to-Many via Pivot Table

```typescript
// Pivot model
class PostTag extends Model {
  static table = "post_tags";
  static associations = {
    posts: { type: "belongs_to" as const, key: "post_id" },
    tags: { type: "belongs_to" as const, key: "tag_id" },
  } as const;

  @immutableRelation("posts", "post_id") post!: Relation<Post>;
  @immutableRelation("tags", "tag_id") tag!: Relation<Tag>;
}

// On Post model -- query tags through pivot
class Post extends Model {
  @lazy tags = this.collections
    .get<PostTag>("post_tags")
    .query(Q.where("post_id", this.id))
    .extend(Q.on("tags", Q.where("is_active", true)));
}
```

**Why good:** `@immutableRelation` on both sides of pivot enforces that tagging relationships are permanent. `@lazy` creates a computed query property that is only evaluated when accessed.

---

## Pattern 5: Writers, Readers, and database.write()

### Standalone database.write()

When actions don't belong on a model class:

```typescript
import type { Database } from "@nozbe/watermelondb";

async function createPostWithComments(
  database: Database,
  title: string,
  commentBodies: string[],
  author: User,
) {
  await database.write(async () => {
    const post = await database.get<Post>("posts").create((p) => {
      p.title = title;
      p.author.set(author);
    });

    // Create all comments in the same writer -- one transaction
    for (const body of commentBodies) {
      await database.get<Comment>("comments").create((c) => {
        c.post.set(post);
        c.author.set(author);
        c.body = body;
      });
    }
  });
}
```

### Nesting Writers with callWriter

```typescript
class Post extends Model {
  @writer async publishWithNotification() {
    await this.update((post) => {
      post.isPublished = true;
    });
    // Call another @writer from within this writer
    await this.callWriter(() => this.addComment("Auto-published", systemUser));
  }
}
```

**Gotcha:** Calling a `@writer` method directly from within another writer throws. You MUST use `this.callWriter()` or `this.callReader()` for nesting.

### database.read() for Consistent Reads

```typescript
const stats = await database.read(async () => {
  // No writes can happen during this block
  const postCount = await database.get<Post>("posts").query().fetchCount();
  const commentCount = await database
    .get<Comment>("comments")
    .query()
    .fetchCount();
  return { postCount, commentCount }; // Consistent snapshot
});
```

---

## Pattern 6: Query API

### Basic Conditions

```typescript
import { Q } from "@nozbe/watermelondb";

// Equality (shorthand)
const pinnedPosts = await postsCollection
  .query(Q.where("is_pinned", true))
  .fetch();

// Comparison operators
const popularPosts = await postsCollection
  .query(Q.where("like_count", Q.gt(100)))
  .fetch();

// Multiple conditions (implicitly AND)
const recentPopular = await postsCollection
  .query(
    Q.where("like_count", Q.gte(50)),
    Q.where("created_at", Q.gt(cutoffTimestamp)),
  )
  .fetch();

// OR conditions
const flagged = await postsCollection
  .query(Q.or(Q.where("is_pinned", true), Q.where("like_count", Q.gt(1000))))
  .fetch();
```

### Text Search with Q.like

```typescript
const searchTerm = Q.sanitizeLikeString(userInput); // Escape special chars
const results = await postsCollection
  .query(Q.where("title", Q.like(`%${searchTerm}%`)))
  .fetch();
```

**Gotcha:** Always use `Q.sanitizeLikeString()` on user input. `Q.like` uses `%` for wildcards and is case-insensitive.

### Sorting and Pagination

```typescript
const TOP_POSTS_LIMIT = 10;

const topPosts = await postsCollection
  .query(
    Q.where("is_published", true),
    Q.sortBy("like_count", Q.desc),
    Q.take(TOP_POSTS_LIMIT),
  )
  .fetch();
```

### Cross-Table Queries with Q.on

```typescript
// Posts that have at least one active comment
const postsWithActiveComments = await postsCollection
  .query(Q.on("comments", "is_active", true))
  .fetch();

// Posts with comments containing a specific word
const postsWithKeyword = await postsCollection
  .query(
    Q.on(
      "comments",
      Q.where("body", Q.like(`%${Q.sanitizeLikeString(keyword)}%`)),
    ),
  )
  .fetch();
```

### Execution Methods

```typescript
const posts = await query.fetch(); // Model[]
const count = await query.fetchCount(); // number
const ids = await query.fetchIds(); // string[]
const stream$ = query.observe(); // Observable<Model[]>
const count$ = query.observeCount(); // Observable<number> (throttled 250ms)
const sorted$ = query.observeWithColumns(["like_count"]); // Re-emits on column change
```

---

## Pattern 7: Reactive Components

### DatabaseProvider and useDatabase

```tsx
import { DatabaseProvider, useDatabase } from "@nozbe/watermelondb/react";
import { database } from "./database";

// Wrap app in provider
function App() {
  return (
    <DatabaseProvider database={database}>
      <Root />
    </DatabaseProvider>
  );
}

// Access database in any descendant
function CreatePostButton() {
  const database = useDatabase();

  const handlePress = async () => {
    await database.write(async () => {
      await database.get<Post>("posts").create((post) => {
        post.title = "New Post";
      });
    });
  };

  return <Button onPress={handlePress} title="Create Post" />;
}
```

### withObservables for Reactive Lists

```tsx
import { withObservables } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import type { Database } from "@nozbe/watermelondb";

interface PostListProps {
  posts: Post[];
}

function PostList({ posts }: PostListProps) {
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <EnhancedPostItem post={item} />}
    />
  );
}

const enhance = withObservables([], ({ database }: { database: Database }) => ({
  posts: database
    .get<Post>("posts")
    .query(Q.where("is_published", true), Q.sortBy("created_at", Q.desc))
    .observe(),
}));

export const EnhancedPostList = enhance(PostList);
```

### observeWithColumns for Sorted Lists

```tsx
// If the list is sorted by a field that can change, use observeWithColumns
const enhance = withObservables([], ({ database }: { database: Database }) => ({
  posts: database
    .get<Post>("posts")
    .query(Q.sortBy("like_count", Q.desc))
    .observeWithColumns(["like_count"]), // Re-emits when like_count changes
}));
```

**Why this matters:** `observe()` only emits when records are added or removed from query results. If a record's `like_count` changes (affecting sort order), `observe()` won't emit -- but `observeWithColumns(["like_count"])` will.

### Composing withObservables for Deep Relations

```tsx
import { compose } from "@nozbe/watermelondb/react";

// First level: observe the post and its author relation
const enhanceComment = compose(
  withObservables(["comment"], ({ comment }: { comment: Comment }) => ({
    comment: comment.observe(),
    author: comment.author.observe(),
  })),
);

// For 2nd-level relations, use RxJS switchMap:
import { switchMap } from "rxjs/operators";

const enhance = withObservables(["post"], ({ post }: { post: Post }) => ({
  post: post.observe(),
  authorContact: post.author
    .observe()
    .pipe(switchMap((author) => author.contact.observe())),
}));
```

---

## Pattern 8: CRUD Operations Summary

### Create

```typescript
@writer async createPost(title: string, body: string, author: User) {
  return await this.collections.get<Post>("posts").create((post) => {
    post.title = title;
    post.body = body;
    post.author.set(author);
  });
}
```

### Read

```typescript
// By ID
const post = await database.get<Post>("posts").find("some-id");

// By query
const posts = await database
  .get<Post>("posts")
  .query(Q.where("is_pinned", true))
  .fetch();
```

### Update

```typescript
@writer async updateTitle(newTitle: string) {
  await this.update((post) => {
    post.title = newTitle;
  });
}
```

### Delete

```typescript
// For synced databases -- marks for sync, keeps locally
@writer async softDelete() {
  await this.markAsDeleted();
}

// For local-only databases -- permanently removes
@writer async hardDelete() {
  await this.destroyPermanently();
}
```

**Key distinction:** `markAsDeleted()` flags the record with `_status: 'deleted'` so the sync engine can push the deletion to the server. `destroyPermanently()` removes the record from SQLite entirely.
