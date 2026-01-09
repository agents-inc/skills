## Example Research Output

Here's what a complete, high-quality backend research output looks like:

---

### Example: API Route Research for User Endpoints

```markdown
## Research Findings: User API Routes

**Research Type:** API Route Discovery
**Files Examined:** 12
**Verified:** All paths confirmed

---

### Route Inventory

| Method | Path | Handler Location | Auth Required | Description |
|--------|------|------------------|---------------|-------------|
| GET | /api/users/:id | `/apps/api/src/routes/users.ts:15` | Yes | Get user by ID |
| PATCH | /api/users/:id | `/apps/api/src/routes/users.ts:35` | Yes | Update user |
| GET | /api/users/me | `/apps/api/src/routes/users.ts:55` | Yes | Get current user |

---

### Existing Pattern: Route Handler with Validation

**File:** `/apps/api/src/routes/users.ts:15-33`

**Pattern:** Uses Zod validation with typed params and body

```typescript
// Lines 15-33
app.get(
  '/users/:id',
  zValidator('param', z.object({ id: z.string().uuid() })),
  authMiddleware,
  async (c) => {
    const { id } = c.req.valid('param');
    const user = await userService.findById(id);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json(user);
  }
);
```

**Why this pattern:** Zod validation provides type-safe params at runtime, authMiddleware enforces authentication, service layer separates business logic.

---

### Middleware Chain

**Auth middleware:** `/apps/api/src/middleware/auth.ts:8-25`
- Validates session token
- Attaches user to context
- Returns 401 if invalid

**Error middleware:** `/apps/api/src/middleware/error.ts:5-20`
- Catches all errors
- Logs to Pino
- Returns structured error response

---

### Files to Reference for New User Endpoints

1. `/apps/api/src/routes/users.ts` - Best example of user routes
2. `/apps/api/src/middleware/auth.ts` - Auth middleware pattern
3. `/apps/api/src/services/user-service.ts` - Service layer pattern
4. `/packages/database/src/schema.ts:users` - User table schema

---

### Recommended Implementation Approach

Based on patterns in users.ts:

1. **Define route** in appropriate router file with HTTP method and path
2. **Add validation** using zValidator for params, query, and body
3. **Apply middleware** (authMiddleware for protected routes)
4. **Call service layer** for business logic
5. **Return typed response** with appropriate status code

---

### Research Verification

| Finding | Verification Method | Status |
|---------|---------------------|--------|
| Users route uses Zod | Read `/apps/api/src/routes/users.ts` | Verified line 16 |
| Auth middleware exists | Read `/apps/api/src/middleware/auth.ts` | Verified |
| Service pattern used | Grep for userService | 8 calls found |
```

---

### Example: Database Schema Research

```markdown
## Research Findings: Database Schema for Posts

**Research Type:** Database Pattern Research
**Files Examined:** 6
**Verified:** All paths confirmed

---

### Schema Location

**File:** `/packages/database/src/schema.ts`

---

### Table Definition

**File:** `/packages/database/src/schema.ts:78-95`

```typescript
// Lines 78-95
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

### Relationships

| Relation | Type | Foreign Key | Target |
|----------|------|-------------|--------|
| author | many-to-one | authorId | users.id |
| comments | one-to-many | - | comments.postId |
| tags | many-to-many | - | posts_to_tags |

---

### Query Patterns

**Select with relations:**
- File: `/apps/api/src/services/post-service.ts:23-35`
- Pattern: Uses `db.query.posts.findMany({ with: { author: true } })`

**Insert with returning:**
- File: `/apps/api/src/services/post-service.ts:45-55`
- Pattern: Uses `db.insert(posts).values({...}).returning()`

---

### Migration Pattern

**Location:** `/packages/database/drizzle/`

**Naming convention:** `NNNN_description.sql` (e.g., `0001_add_posts_table.sql`)

**Generation command:** `npx drizzle-kit generate:pg`

---

### Files to Reference

1. `/packages/database/src/schema.ts` - All table definitions
2. `/apps/api/src/services/post-service.ts` - Query patterns
3. `/packages/database/drizzle/` - Migration examples

---

### Research Verification

| Finding | Verification Method | Status |
|---------|---------------------|--------|
| Posts table exists | Read schema.ts | Verified line 78 |
| Cascade delete on author | Read schema.ts | Verified line 84 |
| Drizzle Kit migrations | Glob drizzle/*.sql | 5 files found |
```
