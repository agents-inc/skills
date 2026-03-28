# Supabase Core Examples

> Client setup, typed queries, and error handling patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Auth patterns:** See [auth.md](auth.md). **Database patterns:** See [database.md](database.md). **Storage patterns:** See [storage.md](storage.md). **Edge Functions:** See [edge-functions.md](edge-functions.md).

---

## Pattern 1: Client Setup — Browser

### Good Example — Typed Client with Database Generic

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);
```

**Why good:** `Database` generic enables autocomplete for all table names, column names, and return types; publishable key is safe for browsers (RLS enforces access); named constants for environment variables

### Bad Example — Untyped Client with Hardcoded Credentials

```typescript
import { createClient } from "@supabase/supabase-js";

// BAD: No Database generic, hardcoded secrets
const supabase = createClient(
  "https://abc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
);
```

**Why bad:** No type safety on queries, hardcoded URL and key leak in source control, no way to switch between environments

---

## Pattern 2: Client Setup — Server-Side (SSR)

### Good Example — Server Client with User Context

```typescript
// lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

// Create a server-side client that respects RLS using the user's JWT
export function createServerClient(accessToken: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
```

**Why good:** Passes user JWT for RLS enforcement on server, still uses publishable key (not secret key), factory function creates per-request clients

### Good Example — Admin Client (Bypasses RLS)

```typescript
// lib/supabase-admin.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

// ONLY use on the server — bypasses all RLS policies
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
);
```

**Why good:** Explicit naming (`supabaseAdmin`) signals this bypasses RLS, server-only secret key, typed with `Database` generic

**When to use:** Admin operations, migrations, seeding data, webhook handlers that need full access. NEVER import this in client-side code.

---

## Pattern 3: Error Handling — Standard Pattern

### Good Example — Consistent Error Handling

```typescript
import type { PostgrestError } from "@supabase/supabase-js";

// Reusable error handler
function handleSupabaseError(error: PostgrestError, context: string): never {
  throw new Error(`[Supabase] ${context}: ${error.message} (${error.code})`);
}

async function getPostById(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, content, created_at")
    .eq("id", postId)
    .single();

  if (error) {
    handleSupabaseError(error, `Failed to fetch post ${postId}`);
  }

  return data;
}

async function createPost(post: {
  title: string;
  content: string;
  author_id: string;
}) {
  const { data, error } = await supabase
    .from("posts")
    .insert(post)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "Failed to create post");
  }

  return data;
}
```

**Why good:** Consistent error handling pattern, error includes context and Supabase error code, `.single()` for expected single-row results, `.select()` after insert to return the created row

### Bad Example — Swallowing Errors

```typescript
// BAD: Silent error handling
async function getPost(id: string) {
  try {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null; // Error silently swallowed
  }
}
```

**Why bad:** Supabase errors are returned in `error` field (not thrown), try/catch doesn't help, `select("*")` fetches unnecessary columns, null return hides the actual problem

---

## Pattern 4: Type-Safe Query Results

### Good Example — Using Generated Types

```typescript
import type { Database, Tables } from "./database.types";

// Full row type
type Post = Tables<"posts">;

// Insert type (auto-generated columns like id, created_at are optional)
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

// Update type (all columns optional)
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

// Function with typed return
async function getRecentPosts(): Promise<Post[]> {
  const PAGE_SIZE = 10;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    throw new Error(`Failed to fetch recent posts: ${error.message}`);
  }

  return data;
}

// Typed insert
async function createPost(post: PostInsert): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .insert(post)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  return data;
}
```

**Why good:** Type aliases from generated types, `PostInsert` allows omitting auto-generated columns, return types are explicit, named constant for page size

---

## Pattern 5: Singleton vs Per-Request Client

### Good Example — When to Use Which

```typescript
// SINGLETON (browser): One client for the entire app
// lib/supabase.ts
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

// PER-REQUEST (server): New client per request with user's token
// api/route.ts
export async function GET(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data, error } = await supabase.from("posts").select("id, title");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify(data));
}
```

**Why good:** Browser uses singleton (auth state shared), server creates per-request client with user JWT for RLS, proper authorization header extraction

**When to use:** Singleton in browser apps. Per-request in API routes, server components, and Edge Functions where each request may have a different user.

---

_For auth patterns, see [auth.md](auth.md). For database queries, see [database.md](database.md)._
