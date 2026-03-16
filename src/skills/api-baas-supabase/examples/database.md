# Supabase Database Examples

> Complex queries, joins, RPC, migrations, and type generation. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Select with Filters and Joins

### Good Example — Paginated Query with Foreign Key Join

```typescript
const PAGE_SIZE = 20;

interface PostWithAuthor {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: { username: string; avatar_url: string };
}

async function getPublishedPosts(page: number): Promise<PostWithAuthor[]> {
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, content, created_at, author:profiles(username, avatar_url)")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return data;
}
```

**Why good:** Named constant for page size, join syntax via foreign key reference (`author:profiles(...)`), only selected columns (not `*`), range-based pagination, ordered results

### Good Example — Multiple Filters

```typescript
async function searchPosts(filters: {
  query?: string;
  category?: string;
  authorId?: string;
  minDate?: string;
}) {
  let query = supabase
    .from("posts")
    .select("id, title, content, created_at, category")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (filters.query) {
    query = query.ilike("title", `%${filters.query}%`);
  }

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.authorId) {
    query = query.eq("author_id", filters.authorId);
  }

  if (filters.minDate) {
    query = query.gte("created_at", filters.minDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return data;
}
```

**Why good:** Composable query builder (conditionally chains filters), `ilike` for case-insensitive search, `gte` for date filtering, typed filter object

---

## Pattern 2: Insert, Update, Delete

### Good Example — Insert with Return Data

```typescript
import type { Database } from "./database.types";

type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

async function createPost(post: PostInsert) {
  const { data, error } = await supabase
    .from("posts")
    .insert(post)
    .select("id, title, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return data;
}
```

### Good Example — Upsert (Insert or Update)

```typescript
async function upsertUserPreferences(
  userId: string,
  preferences: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: userId, preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save preferences: ${error.message}`);
  }

  return data;
}
```

### Good Example — Update with Conditions

```typescript
async function publishPost(postId: string, userId: string) {
  const { data, error } = await supabase
    .from("posts")
    .update({ published: true, published_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", userId) // Ensure user owns the post
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish post: ${error.message}`);
  }

  return data;
}
```

### Good Example — Delete

```typescript
async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}
```

**Why good:** `.select()` after insert/upsert/update returns the affected row, `.single()` for single-row operations, upsert with `onConflict` for idempotent writes, multiple `.eq()` filters for ownership checks

### Bad Example — Missing .select() After Insert

```typescript
// BAD: Insert without .select() returns null data
const { data } = await supabase.from("posts").insert({ title: "Hello" });
console.log(data); // null — no data returned!
```

**Why bad:** Without `.select()`, insert/update return `null` for `data`, common source of confusion

---

## Pattern 3: RPC (Remote Procedure Calls)

### Good Example — Calling Postgres Functions

```sql
-- migration: create the function first
create or replace function search_posts(
  search_query text,
  result_limit int default 10
)
returns setof posts
language sql
security definer
set search_path = public
as $$
  select *
  from posts
  where
    published = true
    and (
      title ilike '%' || search_query || '%'
      or content ilike '%' || search_query || '%'
    )
  order by created_at desc
  limit result_limit;
$$;
```

```typescript
const DEFAULT_SEARCH_LIMIT = 10;

async function searchPosts(query: string, limit = DEFAULT_SEARCH_LIMIT) {
  const { data, error } = await supabase.rpc("search_posts", {
    search_query: query,
    result_limit: limit,
  });

  if (error) {
    throw new Error(`Search RPC failed: ${error.message}`);
  }

  return data;
}
```

**Why good:** `security definer` runs with function owner's permissions (useful for bypassing RLS in controlled ways), `set search_path` prevents search path attacks, named constant for default limit, typed RPC parameters via `Database` generic

**When to use:** Complex queries that benefit from Postgres execution (full-text search, aggregations, multi-step operations), queries requiring elevated permissions via `security definer`, or operations that need transactional guarantees.

---

## Pattern 4: Counting Rows

### Good Example — Count with Filters

```typescript
async function countPublishedPosts(authorId: string) {
  const { count, error } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", authorId)
    .eq("published", true);

  if (error) {
    throw new Error(`Count failed: ${error.message}`);
  }

  return count ?? 0;
}
```

**Why good:** `{ count: "exact", head: true }` returns only the count (no row data transferred), filters still apply, efficient for pagination totals

---

## Pattern 5: RLS Policy Patterns

### Good Example — User-Owned Data

```sql
-- Enable RLS
alter table public.posts enable row level security;

-- SELECT: Users see their own posts or published posts
create policy "posts_select_policy"
on public.posts for select
to authenticated, anon
using (
  published = true
  or (select auth.uid()) = author_id
);

-- INSERT: Users can only create posts as themselves
create policy "posts_insert_policy"
on public.posts for insert
to authenticated
with check (
  (select auth.uid()) = author_id
);

-- UPDATE: Users can only update their own posts
create policy "posts_update_policy"
on public.posts for update
to authenticated
using ( (select auth.uid()) = author_id )
with check ( (select auth.uid()) = author_id );

-- DELETE: Users can only delete their own posts
create policy "posts_delete_policy"
on public.posts for delete
to authenticated
using ( (select auth.uid()) = author_id );
```

### Good Example — Team-Based Access with Helper Function

```sql
-- Helper function for checking team membership
create or replace function is_team_member(team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_members.team_id = is_team_member.team_id
    and team_members.user_id = (select auth.uid())
  );
$$;

-- Team documents policy
alter table public.documents enable row level security;

create policy "documents_select_team"
on public.documents for select
to authenticated
using ( is_team_member(team_id) );

create policy "documents_insert_team"
on public.documents for insert
to authenticated
with check ( is_team_member(team_id) );
```

**Why good:** Separate policies per operation, `(select auth.uid())` in subquery for performance, helper function for complex access checks, `security definer` on helper function, `set search_path` prevents attacks, roles specified with `to`

### Bad Example — Insecure RLS Policies

```sql
-- BAD: FOR ALL is less auditable
create policy "bad_policy" on public.posts for all
using (auth.uid() = author_id); -- No subquery wrapper

-- BAD: Trusting user-modifiable metadata
create policy "admin_check" on public.posts for select
using (
  auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
  -- user_metadata can be modified by users via updateUser()!
);

-- BAD: Missing role specification
create policy "too_open" on public.posts for select
using (true); -- Applies to ALL roles including anon!
```

**Why bad:** `FOR ALL` mixes read/write logic, bare `auth.uid()` hurts performance, `user_metadata` is user-modifiable (insecure for access control), missing `to` clause applies to all roles

---

## Pattern 6: Type Generation Workflow

### Good Example — CLI Type Generation

```bash
# Initial setup
npm i supabase --save-dev
npx supabase login
npx supabase init

# Generate types from remote project
npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > src/lib/database.types.ts

# Generate types from local dev database
npx supabase gen types typescript --local > src/lib/database.types.ts

# Add to package.json scripts
# "gen:types": "supabase gen types typescript --local > src/lib/database.types.ts"
```

### Good Example — Using Generated Type Helpers

```typescript
import type { Database, Tables, Enums } from "./database.types";

// Row type (what you get back from SELECT)
type Post = Tables<"posts">;

// Insert type (omits auto-generated columns like id, created_at)
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

// Update type (all columns optional)
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

// Enum type
type PostStatus = Enums<"post_status">;

// Use in function signatures
async function updatePost(id: string, updates: PostUpdate): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Update failed: ${error.message}`);
  }

  return data;
}
```

**Why good:** Generated types give full autocomplete and type checking, `Tables<"posts">` shortcut avoids deep path access, separate Insert/Update types handle optional columns correctly, regenerate after schema changes

---

## Pattern 7: Migration Best Practices

### Good Example — Migration with RLS

```sql
-- supabase/migrations/20240315_create_posts.sql

-- Create table
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  published boolean default false not null,
  published_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS immediately
alter table public.posts enable row level security;

-- Create policies
create policy "posts_select"
on public.posts for select
to authenticated, anon
using (
  published = true
  or (select auth.uid()) = author_id
);

create policy "posts_insert"
on public.posts for insert
to authenticated
with check ( (select auth.uid()) = author_id );

create policy "posts_update"
on public.posts for update
to authenticated
using ( (select auth.uid()) = author_id )
with check ( (select auth.uid()) = author_id );

create policy "posts_delete"
on public.posts for delete
to authenticated
using ( (select auth.uid()) = author_id );

-- Add indexes for columns used in policies
create index if not exists idx_posts_author_id on public.posts(author_id);
create index if not exists idx_posts_published on public.posts(published);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
```

**Why good:** RLS enabled in the same migration as table creation (never forgotten), indexes on columns used in policies and queries, `on delete cascade` for referential integrity, `gen_random_uuid()` for primary key generation

---

_For auth patterns, see [auth.md](auth.md). For storage patterns, see [storage.md](storage.md). For edge functions, see [edge-functions.md](edge-functions.md)._
