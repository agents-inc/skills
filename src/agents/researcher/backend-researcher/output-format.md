## Output Format

<output_format>
Provide your research findings in this structure:

<research_summary>
**Research Topic:** [What was researched]
**Confidence:** [High | Medium | Low]
**Files Examined:** [count]
</research_summary>

<route_patterns>

## API Route Patterns

### Route: [METHOD /path]

**Handler:** `/path/to/route.ts:lines`
**Middleware Chain:** `[middleware1] → [middleware2] → handler`

**Request Validation:**

```typescript
// From /path/to/route.ts:lines
const schema = z.object({...})
```

**Response Format:**

```typescript
// Successful response structure
{ data: T, meta?: {...} }
```

**Error Handling:**

```typescript
// From /path/to/route.ts:lines
// How errors are thrown/caught
```

</route_patterns>

<database_patterns>

## Database Patterns

### Schema: [TableName]

**Location:** `/path/to/schema.ts:lines`

```typescript
// Actual schema definition
export const users = pgTable('users', {...})
```

**Relationships:**

- `users` → `posts` (one-to-many)
- `users` → `organizations` (many-to-many via `user_orgs`)

### Query Patterns

| Operation         | Location      | Pattern                               |
| ----------------- | ------------- | ------------------------------------- |
| Select with joins | `/path:lines` | `db.select().from(x).leftJoin(y)`     |
| Transaction       | `/path:lines` | `db.transaction(async (tx) => {...})` |
| Soft delete       | `/path:lines` | `update().set({ deletedAt })`         |

</database_patterns>

<auth_patterns>

## Authentication Patterns

**Session Handling:** `/path/to/auth.ts`
**Permission Check Pattern:**

```typescript
// From /path:lines
const requireRole = (role: Role) => {...}
```

**Protected Route Pattern:**

```typescript
// From /path:lines
```

</auth_patterns>

<middleware_patterns>

## Middleware Patterns

| Middleware | Location      | Purpose        | Applies To     |
| ---------- | ------------- | -------------- | -------------- |
| [name]     | [/path:lines] | [what it does] | [which routes] |

**Error Middleware:**

```typescript
// From /path:lines
// How errors are transformed to responses
```

**Logging Pattern:**

```typescript
// From /path:lines
logger.info({ ... }, 'message')
```

</middleware_patterns>

<implementation_guidance>

## For Backend Developer

**Must Follow:**

1. [Pattern] - see `/path:lines`
2. [Pattern] - see `/path:lines`

**Must Avoid:**

1. [Anti-pattern] - why

**Files to Read First:**
| Priority | File | Why |
|----------|------|-----|
| 1 | [/path] | Best example of [pattern] |
| 2 | [/path] | Shows [specific thing] |
</implementation_guidance>
</output_format>
