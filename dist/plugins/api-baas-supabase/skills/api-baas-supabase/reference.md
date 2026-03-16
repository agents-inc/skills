# Supabase Reference

> Supabase CLI commands, environment setup, type generation, and quick lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Supabase CLI Commands

### Project Setup

```bash
# Install CLI
npm i supabase --save-dev

# Login and initialize
npx supabase login
npx supabase init

# Start local development environment (Docker required)
npx supabase start

# Stop local services
npx supabase stop
```

### Type Generation

```bash
# Generate types from remote project
npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > database.types.ts

# Generate types from local dev database
npx supabase gen types typescript --local > database.types.ts

# Generate types from direct connection
npx supabase gen types typescript --db-url "postgres://..." > database.types.ts
```

### Database Migrations

```bash
# Create a new migration file
npx supabase migration new <migration_name>
# Creates: supabase/migrations/<timestamp>_<migration_name>.sql

# Push local migrations to remote database
npx supabase db push

# Preview migration changes without applying
npx supabase db push --dry-run

# Reset local database (reapplies all migrations + seed.sql)
npx supabase db reset

# List migration status (local vs remote)
npx supabase migration list
```

### Edge Functions

```bash
# Create a new edge function
npx supabase functions new <function_name>
# Creates: supabase/functions/<function_name>/index.ts

# Serve functions locally (with hot reload)
npx supabase functions serve

# Serve with debug inspector
npx supabase functions serve --inspect-mode brk

# Deploy a specific function
npx supabase functions deploy <function_name>

# Deploy all functions
npx supabase functions deploy

# Set a secret for edge functions
npx supabase secrets set MY_SECRET=my_value

# List secrets
npx supabase secrets list
```

---

## Environment Variables

```bash
# .env.local
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...                  # Safe for client-side
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # SERVER ONLY — never expose to client
```

---

## Type Helper Shortcuts

```typescript
import type { Database, Tables, Enums } from "./database.types";

// Full table row type
type Post = Tables<"posts">;
// Equivalent to: Database['public']['Tables']['posts']['Row']

// Insert type (omits auto-generated columns)
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

// Update type (all columns optional)
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

// Enum type
type PostStatus = Enums<"post_status">;
```

---

## Query Builder Quick Reference

| Operation          | Code                                       |
| ------------------ | ------------------------------------------ |
| Select all columns | `.select("*")`                             |
| Select specific    | `.select("id, title, created_at")`         |
| Select with join   | `.select("id, author:profiles(username)")` |
| Equality filter    | `.eq("column", value)`                     |
| Not equal          | `.neq("column", value)`                    |
| Greater than       | `.gt("column", value)`                     |
| Less than          | `.lt("column", value)`                     |
| In array           | `.in("column", [val1, val2])`              |
| Pattern match      | `.like("column", "%pattern%")`             |
| Case-insensitive   | `.ilike("column", "%pattern%")`            |
| Is null            | `.is("column", null)`                      |
| Contains (array)   | `.contains("tags", ["supabase"])`          |
| Full-text search   | `.textSearch("column", "query")`           |
| Order by           | `.order("column", { ascending: false })`   |
| Limit rows         | `.limit(10)`                               |
| Pagination         | `.range(0, 9)`                             |
| Single row         | `.single()`                                |
| Maybe single       | `.maybeSingle()`                           |
| Return data        | `.select()` (after insert/update)          |

---

## Auth Events Reference

| Event               | When Fired                                                    |
| ------------------- | ------------------------------------------------------------- |
| `INITIAL_SESSION`   | After client initializes and loads stored session             |
| `SIGNED_IN`         | User session confirmed, re-established, or tab focus regained |
| `SIGNED_OUT`        | User signs out or session expires                             |
| `TOKEN_REFRESHED`   | New access and refresh tokens generated                       |
| `USER_UPDATED`      | After `supabase.auth.updateUser()` completes                  |
| `PASSWORD_RECOVERY` | User lands on a password reset page                           |

---

## RLS Policy Quick Reference

| Clause                   | Used For                               | Operations                            |
| ------------------------ | -------------------------------------- | ------------------------------------- |
| `USING (condition)`      | Filter which rows are visible/affected | SELECT, UPDATE (existing row), DELETE |
| `WITH CHECK (condition)` | Validate new/modified data             | INSERT, UPDATE (new row values)       |

| Role            | Description                           |
| --------------- | ------------------------------------- |
| `anon`          | Unauthenticated requests (public API) |
| `authenticated` | Logged-in users                       |
| `service_role`  | Server-side admin (bypasses all RLS)  |

---

## Realtime Filter Operators

| Operator | Example                      | Description              |
| -------- | ---------------------------- | ------------------------ |
| `eq`     | `id=eq.5`                    | Equals                   |
| `neq`    | `status=neq.draft`           | Not equals               |
| `gt`     | `age=gt.18`                  | Greater than             |
| `gte`    | `age=gte.18`                 | Greater than or equal    |
| `lt`     | `price=lt.100`               | Less than                |
| `lte`    | `price=lte.100`              | Less than or equal       |
| `in`     | `status=in.(active,pending)` | In list (max 100 values) |

**Note:** DELETE events cannot be filtered.

---

## Storage Methods Quick Reference

| Method                              | Description                                                |
| ----------------------------------- | ---------------------------------------------------------- |
| `.upload(path, file, options)`      | Upload a file (options: cacheControl, contentType, upsert) |
| `.download(path)`                   | Download a file as Blob                                    |
| `.getPublicUrl(path)`               | Get permanent public URL (public buckets only)             |
| `.createSignedUrl(path, expiresIn)` | Get temporary signed URL                                   |
| `.createSignedUploadUrl(path)`      | Get a URL for client-side upload (expires in 2h)           |
| `.remove([path1, path2])`           | Delete files                                               |
| `.list(folder, options)`            | List files in a folder                                     |
| `.move(from, to)`                   | Move/rename a file                                         |
| `.copy(from, to)`                   | Copy a file                                                |

---

## Edge Function Project Structure

```
supabase/
├── functions/
│   ├── _shared/           # Shared utilities (import via relative path)
│   │   ├── cors.ts        # Reusable CORS headers
│   │   └── supabase.ts    # Shared client setup
│   ├── hello-world/
│   │   └── index.ts       # Function entry point
│   └── process-webhook/
│       └── index.ts
├── migrations/
│   ├── 20240101_create_posts.sql
│   └── 20240102_add_rls.sql
├── seed.sql               # Test data for local dev
└── config.toml            # Supabase project config
```
