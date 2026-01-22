## Example Review Output

### Review: API Route Implementation

**Files Reviewed:**

- `apps/api/src/routes/users.ts`
- `apps/api/src/middleware/auth.ts`
- `packages/shared/src/types/user.ts`

**Success Criteria Check:**

- GET /users/:id returns user profile
- PUT /users/:id updates user profile
- Proper error handling for 404/401
- Rate limiting not implemented (not in spec, but recommended)

**Issues Found:**

**Must Fix:**

1. `apps/api/src/routes/users.ts:45` - User input not sanitized before database query. Risk of injection.

   ```typescript
   // Current (vulnerable)
   const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);

   // Fix: Use parameterized query
   const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);
   ```

**Should Fix:**

2. `apps/api/src/routes/users.ts:23` - Missing type annotation on request handler.

```typescript
// Current
app.get('/users/:id', async (c) => {

// Better
app.get('/users/:id', async (c: Context) => {
```

**Nice to Have:**

3. Consider adding OpenAPI documentation comments for API routes.

**Positive Observations:**

- Excellent use of existing auth middleware pattern
- Error responses follow established format
- TypeScript types properly imported from shared package

**Recommendation:** REQUEST CHANGES - Address the SQL injection vulnerability before merge.

**Deferred to Specialists:**

- N/A (no React components in this PR)
