---
name: api-baas-supabase
description: Supabase backend-as-a-service — Auth, Database, Realtime, Storage, Edge Functions, RLS policies, typed client
---

# Supabase Patterns

> **Quick Guide:** Use Supabase as your backend-as-a-service for Postgres database, authentication, realtime subscriptions, file storage, and edge functions. Always use the typed client with `Database` generic, enable RLS on every table, and use `service_role` key only on the server.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable Row Level Security (RLS) on EVERY table in an exposed schema — no exceptions)**

**(You MUST use the `Database` generic type with `createClient<Database>()` for type-safe queries)**

**(You MUST NEVER expose the `service_role` key in client-side code — use `anon` key in browsers, `service_role` only on the server)**

**(You MUST use `(select auth.uid())` wrapped in a subquery inside RLS policies for performance)**

**(You MUST handle all Supabase responses with `{ data, error }` destructuring — never assume success)**

</critical_requirements>

---

**Auto-detection:** Supabase, createClient, @supabase/supabase-js, @supabase/ssr, supabase-js, auth.uid(), RLS, row level security, realtime, postgres_changes, supabase.auth, supabase.from, supabase.storage, supabase.functions, supabase.channel, edge function, Deno.serve

**When to use:**

- Setting up a Supabase client with TypeScript type safety
- Implementing authentication (email/password, OAuth, magic links, session management)
- Querying Postgres via the Supabase client (select, insert, update, delete, RPC)
- Writing Row Level Security policies for data access control
- Subscribing to database changes in real time
- Uploading and serving files from Supabase Storage
- Building serverless functions with Supabase Edge Functions (Deno)

**Key patterns covered:**

- Typed client setup with `Database` generic and environment variables
- Auth flows: sign up, sign in, OAuth, magic link, session refresh, `onAuthStateChange`
- Database queries with filters, joins, RPC calls, and error handling
- RLS policies: `USING` vs `WITH CHECK`, `auth.uid()`, role-based access
- Realtime subscriptions via `channel().on('postgres_changes')`
- Storage: upload, signed URLs, public URLs, bucket policies
- Edge Functions: `Deno.serve`, CORS headers, secrets, Supabase client in functions

**When NOT to use:**

- Direct Postgres connections (use a database driver skill instead)
- Complex server-side ORM patterns (use Drizzle/Prisma skills)
- Non-Supabase authentication providers (use dedicated auth skills)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Client & Queries:**

- [examples/core.md](examples/core.md) — Client setup, typed queries, error handling patterns

**Authentication:**

- [examples/auth.md](examples/auth.md) — Full auth flows, OAuth, magic links, session refresh, middleware protection

**Database:**

- [examples/database.md](examples/database.md) — Complex queries, joins, RPC, migrations, type generation

**Storage:**

- [examples/storage.md](examples/storage.md) — File upload, signed URLs, bucket policies, image transforms

**Edge Functions:**

- [examples/edge-functions.md](examples/edge-functions.md) — Deno edge functions, `Deno.serve()`, CORS, secrets

---

<philosophy>

## Philosophy

Supabase is an open-source Firebase alternative built on Postgres. It provides a complete backend through a combination of Postgres extensions, auto-generated REST/GraphQL APIs, authentication, realtime subscriptions, file storage, and edge functions.

**Core principles:**

1. **Postgres at the core** — Every feature is built on Postgres. RLS policies, auth, and realtime all leverage Postgres primitives. Understanding Postgres is understanding Supabase.
2. **Type safety end-to-end** — Generate TypeScript types from your database schema with `supabase gen types`. Pass the `Database` generic to `createClient` for fully typed queries.
3. **Security by default** — RLS must be enabled on every table. The `anon` key is safe for browsers (RLS enforces access). The `service_role` key bypasses RLS and must never leave the server.
4. **Error as values** — Every Supabase method returns `{ data, error }`. Never assume success. Always check `error` before using `data`.
5. **Realtime built in** — Postgres changes stream over WebSockets via channels. No separate pub/sub infrastructure needed.
6. **Edge-first functions** — Edge Functions run Deno at the edge, close to users. Design for short-lived, idempotent operations.

**When to use Supabase:**

- Rapid backend development with Postgres, auth, and storage out of the box
- Projects needing realtime features (chat, notifications, live dashboards)
- Teams wanting to avoid managing separate auth, database, and storage services
- Applications that benefit from Row Level Security for multi-tenant data isolation

**When NOT to use:**

- Complex server-side business logic requiring a full application server (use Edge Functions for simple cases, a dedicated API for complex ones)
- Applications needing an ORM with advanced query building (Supabase query builder is powerful but not a full ORM)
- Offline-first applications requiring complex sync protocols

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Typed Client Setup

Create a Supabase client with the generated `Database` type for full type safety across all queries.

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Why good:** `Database` generic enables autocomplete for table names, column names, and return types; environment variables keep secrets out of code; named constants for clarity

```typescript
// BAD: Untyped client
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://abc.supabase.co",
  "eyJ..." // Hardcoded key
);

// No autocomplete, no type checking on queries
const { data } = await supabase.from("tabel_name").select("*"); // Typo not caught
```

**Why bad:** No `Database` generic loses all type safety, hardcoded URL and key are security risks, typos in table/column names not caught at compile time

---

### Pattern 2: Error Handling with { data, error }

Every Supabase method returns `{ data, error }`. Always destructure and check the error.

```typescript
// Good: Always check error before using data
async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
}
```

**Why good:** Error checked before data access, `.single()` returns one row or error, descriptive error message with context

```typescript
// BAD: Ignoring errors
async function getProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return data!; // Dangerous non-null assertion
}
```

**Why bad:** Error silently ignored, `data` could be `null` on failure, non-null assertion hides the problem, `select("*")` fetches unnecessary columns

---

### Pattern 3: Authentication Flows

Use Supabase Auth for email/password, OAuth, and magic link authentication. Listen to auth state changes with `onAuthStateChange`.

#### Sign Up and Sign In

```typescript
// Sign up with email and password
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "secure-password-123",
  options: {
    data: {
      full_name: "Alice Smith",
    },
  },
});

if (error) {
  throw new Error(`Sign up failed: ${error.message}`);
}

// Sign in with email and password
const { data: session, error: signInError } =
  await supabase.auth.signInWithPassword({
    email: "user@example.com",
    password: "secure-password-123",
  });

if (signInError) {
  throw new Error(`Sign in failed: ${signInError.message}`);
}
```

#### OAuth (Social Login)

```typescript
// Redirect to OAuth provider
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "github",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

#### Auth State Listener

```typescript
// Listen to auth state changes — register early in app lifecycle
const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((event, session) => {
  // IMPORTANT: Do NOT call other Supabase methods directly in this callback.
  // Use setTimeout(..., 0) to defer if needed.
  if (event === "SIGNED_IN") {
    // Handle sign in
  }
  if (event === "SIGNED_OUT") {
    // Handle sign out
  }
  if (event === "TOKEN_REFRESHED") {
    // Token was refreshed
  }
});

// Cleanup when done
subscription.unsubscribe();
```

**Why good:** Separate error handling for each operation, OAuth uses `redirectTo` for callback URL, auth listener registered early, cleanup via `unsubscribe()`

**When to use:** Every app that needs user authentication. Prefer `signInWithPassword` for email/password, `signInWithOAuth` for social providers, `signInWithOtp` for passwordless magic links.

---

### Pattern 4: Database Queries

Use the Supabase query builder for type-safe database operations with filters, ordering, pagination, and joins.

#### Select with Filters

```typescript
const PAGE_SIZE = 20;

// Fetch paginated, filtered results
const { data: posts, error } = await supabase
  .from("posts")
  .select("id, title, content, created_at, author:profiles(username)")
  .eq("published", true)
  .order("created_at", { ascending: false })
  .range(0, PAGE_SIZE - 1);

if (error) {
  throw new Error(`Failed to fetch posts: ${error.message}`);
}
```

#### Insert

```typescript
const { data, error } = await supabase
  .from("posts")
  .insert({
    title: "New Post",
    content: "Post content here",
    author_id: userId,
  })
  .select()
  .single();

if (error) {
  throw new Error(`Failed to create post: ${error.message}`);
}
```

#### Update

```typescript
const { data, error } = await supabase
  .from("posts")
  .update({ title: "Updated Title" })
  .eq("id", postId)
  .select()
  .single();

if (error) {
  throw new Error(`Failed to update post: ${error.message}`);
}
```

#### Delete

```typescript
const { error } = await supabase.from("posts").delete().eq("id", postId);

if (error) {
  throw new Error(`Failed to delete post: ${error.message}`);
}
```

#### RPC (Remote Procedure Call)

```typescript
// Call a Postgres function
const { data, error } = await supabase.rpc("search_posts", {
  search_query: "supabase",
  result_limit: 10,
});

if (error) {
  throw new Error(`Search failed: ${error.message}`);
}
```

**Why good:** Named constants for page size, `.select()` after insert/update returns the created/updated row, joins via foreign key reference (`author:profiles(username)`), `.single()` for single-row operations, RPC for complex queries

---

### Pattern 5: Row Level Security (RLS) Policies

RLS is the primary security mechanism in Supabase. Every table in an exposed schema must have RLS enabled with appropriate policies.

#### Enable RLS and Create Policies

```sql
-- ALWAYS enable RLS on every table
alter table public.posts enable row level security;

-- SELECT: Users can read published posts or their own drafts
create policy "Users can read published posts or own drafts"
on public.posts for select
to authenticated
using (
  published = true
  or (select auth.uid()) = author_id
);

-- INSERT: Users can only create posts as themselves
create policy "Users can create their own posts"
on public.posts for insert
to authenticated
with check (
  (select auth.uid()) = author_id
);

-- UPDATE: Users can only update their own posts
create policy "Users can update their own posts"
on public.posts for update
to authenticated
using ( (select auth.uid()) = author_id )
with check ( (select auth.uid()) = author_id );

-- DELETE: Users can only delete their own posts
create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using ( (select auth.uid()) = author_id );
```

**Why good:** RLS enabled first, separate policies per operation (not `FOR ALL`), `(select auth.uid())` wrapped in subquery for performance, `to authenticated` limits to logged-in users, `USING` for read filtering, `WITH CHECK` for write validation

```sql
-- BAD: Common RLS mistakes

-- Forgetting to enable RLS (table is wide open!)
-- alter table public.posts enable row level security;  -- MISSING!

-- Using FOR ALL instead of separate policies
create policy "bad_policy" on public.posts for all
using (auth.uid() = author_id);  -- No subquery wrapper, no WITH CHECK

-- Trusting JWT metadata for access control
create policy "bad_role_check" on public.posts for select
using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
-- BAD: user_metadata is modifiable by users!
```

**Why bad:** Missing `enable row level security` leaves table exposed, `FOR ALL` is less clear and harder to audit, bare `auth.uid()` without subquery hurts performance, `user_metadata` in JWT is user-modifiable and insecure for access control

---

### Pattern 6: Realtime Subscriptions

Subscribe to database changes using channels with `postgres_changes`.

```typescript
// Subscribe to new messages in a chat room
const CHANNEL_NAME = "room-messages";

const channel = supabase
  .channel(CHANNEL_NAME)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      const newMessage = payload.new;
      // Handle new message
    }
  )
  .subscribe();

// Cleanup: unsubscribe when leaving the room
channel.unsubscribe();
```

#### Multiple Event Listeners

```typescript
const channel = supabase
  .channel("post-changes")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "posts" },
    (payload) => {
      // Handle new post
    }
  )
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "posts" },
    (payload) => {
      // Handle updated post — payload.old requires replica identity full
    }
  )
  .on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "posts" },
    (payload) => {
      // Handle deleted post
    }
  )
  .subscribe();
```

**Why good:** Named constant for channel name, filter scopes subscription to relevant rows, separate handlers per event type, cleanup via `unsubscribe()`

**When to use:** Chat apps, live dashboards, collaborative editing, notification feeds. Avoid for high-frequency data (use polling or batch updates instead).

---

### Pattern 7: Storage Operations

Upload, download, and serve files from Supabase Storage with bucket policies.

```typescript
const BUCKET_NAME = "avatars";
const SIGNED_URL_EXPIRY_SECONDS = 3600;

// Upload a file
const { data, error } = await supabase.storage
  .from(BUCKET_NAME)
  .upload(`${userId}/avatar.png`, file, {
    cacheControl: "3600",
    upsert: true,
  });

if (error) {
  throw new Error(`Upload failed: ${error.message}`);
}

// Get a signed URL (temporary, expiring)
const { data: signedUrl, error: signError } = await supabase.storage
  .from(BUCKET_NAME)
  .createSignedUrl(`${userId}/avatar.png`, SIGNED_URL_EXPIRY_SECONDS);

// Get a public URL (permanent, for public buckets only)
const {
  data: { publicUrl },
} = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${userId}/avatar.png`);
```

**Why good:** Named constants for bucket name and expiry, `upsert: true` replaces existing file, separate methods for signed (private) vs public URLs, error handling on upload

---

### Pattern 8: Edge Functions

Supabase Edge Functions run on Deno at the edge. Use `Deno.serve()` for the HTTP handler.

```typescript
// supabase/functions/hello-world/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with the user's JWT for RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data, error } = await supabase.from("posts").select("*").limit(10);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
```

**Why good:** CORS headers handled for browser requests, user JWT forwarded for RLS enforcement, `Deno.env.get()` for secrets (never hardcode), proper error handling with try/catch, `npm:` prefix for Deno package imports

```typescript
// BAD: Edge function mistakes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Deprecated
import { createClient } from "@supabase/supabase-js"; // Missing npm: prefix

serve(async (req) => {
  const supabase = createClient(
    "https://abc.supabase.co", // Hardcoded URL
    "eyJ..." // Hardcoded service_role key in edge function
  );
  // ...
});
```

**Why bad:** `serve` from deno.land is deprecated (use `Deno.serve`), bare specifier without `npm:` prefix fails in Deno, hardcoded credentials are insecure, service_role key in edge function bypasses all RLS

</patterns>

---

<decision_framework>

## Decision Framework

### Which Supabase Key to Use

```
Where is the code running?
├─ Browser / Client-side → anon key (RLS enforced)
├─ Server / API route → anon key + user JWT (RLS enforced per user)
└─ Admin / Migration script → service_role key (bypasses RLS)
    └─ NEVER expose service_role in client bundles
```

### Auth Method Selection

```
What auth flow does the user need?
├─ Email + Password → signInWithPassword
├─ Social login (GitHub, Google, etc.) → signInWithOAuth
├─ Passwordless email → signInWithOtp (magic link)
├─ Phone + SMS → signInWithOtp (phone)
└─ SSO / SAML → signInWithSSO (enterprise)
```

### Realtime vs Polling

```
How fresh must the data be?
├─ Instant (< 1 second) → Realtime subscription (postgres_changes)
├─ Near-instant (1-5 seconds) → Realtime subscription
├─ Periodic (> 5 seconds ok) → Polling with setInterval
└─ On-demand (user refresh) → Re-fetch on action
    └─ High-frequency updates (> 100/sec)?
        ├─ YES → Polling or batch (Realtime has per-subscriber checks)
        └─ NO → Realtime is fine
```

### Storage: Public vs Private Buckets

```
Who should access the files?
├─ Anyone (public assets, avatars) → Public bucket + getPublicUrl()
├─ Authenticated users only → Private bucket + createSignedUrl()
├─ Specific users (own files) → Private bucket + RLS on storage.objects
└─ Server-only processing → service_role key for upload/download
```

### Edge Functions vs Client Queries

```
Does the operation need server-side logic?
├─ Simple CRUD → Client query with RLS (no edge function needed)
├─ Multi-step / transactional → Edge function or Postgres function (RPC)
├─ Third-party API call → Edge function
├─ Webhook receiver → Edge function
└─ Heavy computation → Edge function with EdgeRuntime.waitUntil() for background work
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing RLS on tables** — Any table without RLS in an exposed schema is completely open to the public. In January 2025, 170+ apps were found with exposed databases due to missing RLS (CVE-2025-48757).
- **service_role key in client code** — The service_role key bypasses all RLS. Exposing it in browser bundles gives every user full admin database access.
- **Ignoring `{ data, error }` returns** — Accessing `data` without checking `error` leads to runtime crashes when operations fail.
- **Using `auth.jwt() ->> 'user_metadata'` in RLS policies** — `user_metadata` is modifiable by authenticated users via `updateUser()`. Never use it for access control decisions.

**Medium Priority Issues:**

- **Using `FOR ALL` in RLS policies** — Separate into `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies for clarity and auditability.
- **Bare `auth.uid()` in policies without subquery** — Wrap in `(select auth.uid())` for up to 94-99% performance improvement per Supabase benchmarks.
- **Not specifying `to authenticated` or `to anon` in policies** — Without a role, policies apply to all roles, which may expose data unintentionally.
- **Using `select("*")` everywhere** — Fetches all columns including sensitive data. Select only the columns you need.
- **Deprecated `serve` import in Edge Functions** — `import { serve } from "https://deno.land/std/http/server.ts"` is deprecated. Use `Deno.serve()`.

**Common Mistakes:**

- **Not adding `.select()` after `.insert()` or `.update()`** — Without `.select()`, these methods return no data (only `null`).
- **Missing CORS headers in Edge Functions** — Browser requests fail without proper CORS headers and OPTIONS handling.
- **Not unsubscribing from Realtime channels** — Leaks WebSocket connections and can cause memory issues.
- **Using bare specifiers in Edge Functions** — `import { createClient } from "@supabase/supabase-js"` fails in Deno. Use `npm:@supabase/supabase-js@2`.
- **Using `getSession()` to verify auth** — `getSession()` reads from local storage and can be tampered with. Use `getUser()` for secure server-side verification.

**Gotchas & Edge Cases:**

- **Realtime DELETE events cannot be filtered** — All deletes for a subscribed table are received regardless of filter.
- **Realtime requires `replica identity full` for old record data** — By default, UPDATE and DELETE payloads only include the new record. Set `alter table X replica identity full` to access `payload.old`.
- **RLS policies are not applied to Realtime DELETE events** — Be cautious about what information DELETE events expose.
- **`onAuthStateChange` fires on tab focus** — `SIGNED_IN` events fire when a browser tab regains focus, not just on actual sign-in.
- **Do NOT call Supabase methods inside `onAuthStateChange` callback** — This can cause deadlocks. Use `setTimeout(..., 0)` to defer.
- **Signed URLs expire** — `createSignedUrl()` URLs expire after the specified duration. Signed upload URLs expire after 2 hours.
- **Public bucket URLs bypass RLS** — Files in public buckets are accessible to anyone with the URL, regardless of policies.
- **Edge Function cold starts** — First invocation after idle period has additional latency. Design "fat functions" (fewer, larger functions) to minimize cold starts.
- **Edge Functions: file writes only on `/tmp`** — The `/tmp` directory is the only writable path in edge functions.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable Row Level Security (RLS) on EVERY table in an exposed schema — no exceptions)**

**(You MUST use the `Database` generic type with `createClient<Database>()` for type-safe queries)**

**(You MUST NEVER expose the `service_role` key in client-side code — use `anon` key in browsers, `service_role` only on the server)**

**(You MUST use `(select auth.uid())` wrapped in a subquery inside RLS policies for performance)**

**(You MUST handle all Supabase responses with `{ data, error }` destructuring — never assume success)**

**Failure to follow these rules will create security vulnerabilities, type-unsafe queries, and silent runtime failures.**

</critical_reminders>
