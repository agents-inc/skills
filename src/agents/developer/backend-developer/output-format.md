## Output Format

<output_format>
Provide your implementation in this structure:

<summary>
**Task:** [Brief description of what was implemented]
**Status:** [Complete | Partial | Blocked]
**Files Changed:** [count] files ([+additions] / [-deletions] lines)
</summary>

<investigation>
**Files Examined:**

| File            | Lines | What Was Learned             |
| --------------- | ----- | ---------------------------- |
| [/path/to/file] | [X-Y] | [Pattern/utility discovered] |

**Patterns Identified:**

- **Route structure:** [How routes are organized - from /path:lines]
- **Validation approach:** [How input is validated - from /path:lines]
- **Error handling:** [How errors are managed - from /path:lines]
- **Database access:** [Query patterns used - from /path:lines]

**Existing Code Reused:**

- [Utility/middleware] from [/path] - [Why reused instead of creating new]
  </investigation>

<approach>
**Summary:** [1-2 sentences describing the implementation approach]

**Files:**

| File            | Action             | Purpose               |
| --------------- | ------------------ | --------------------- |
| [/path/to/file] | [created/modified] | [What change and why] |

**Key Decisions:**

- [Decision]: [Rationale based on existing patterns from /path:lines]
  </approach>

<implementation>

### [filename.ts]

**Location:** `/absolute/path/to/file.ts`
**Changes:** [Brief description - e.g., "New route handler" or "Added validation"]

```typescript
// [Description of this code block]
[Your implementation code]
```

**Design Notes:**

- [Why this approach was chosen]
- [How it matches existing patterns]

### [filename2.ts]

[Same structure...]

</implementation>

<api_changes>

## Endpoints Added/Modified

### [METHOD] [/api/path]

**Handler:** `/path/to/route.ts:lines`
**Auth Required:** [Yes - middleware name / No]

**Request:**

```typescript
// Path params / Query params / Body schema
{
  // Schema definition or description
}
```

**Success Response:** [status code]

```typescript
{
  // Response shape
}
```

**Error Responses:**

| Status | Condition          | Response Shape                       |
| ------ | ------------------ | ------------------------------------ |
| 400    | Validation failed  | `{ error: string, details?: [...] }` |
| 401    | Not authenticated  | `{ error: string }`                  |
| 403    | Not authorized     | `{ error: string }`                  |
| 404    | Resource not found | `{ error: string }`                  |
| 500    | Server error       | `{ error: string }`                  |

</api_changes>

<database_changes>

## Schema Changes (if applicable)

### Table: [table_name]

**File:** `/path/to/schema.ts:lines`

**Columns Added/Modified:**

| Column | Type   | Constraints                       | Purpose      |
| ------ | ------ | --------------------------------- | ------------ |
| [name] | [type] | [nullable, default, unique, etc.] | [Why needed] |

**Relationships:**

- [one-to-many / many-to-many] with [other_table] via [foreign key]

**Indexes:**

- [Index on columns] for [query optimization reason]

## Migrations (if applicable)

**File:** `/path/to/migration.sql`
**Reversible:** [Yes / No - why not]

```sql
-- Migration SQL
```

</database_changes>

<security>

## Security Verification

**Input Validation:**

- [ ] All user inputs validated before use
- [ ] SQL injection prevented (parameterized queries / ORM)
- [ ] Path traversal prevented (if file operations)
- [ ] Request size limits enforced

**Authentication/Authorization:**

- [ ] Auth middleware applied to protected routes
- [ ] Permission/role checks where needed
- [ ] Resource ownership verified (user can only access their data)

**Sensitive Data:**

- [ ] No secrets hardcoded (using env vars)
- [ ] No PII in logs
- [ ] Sensitive fields excluded from API responses
- [ ] Passwords hashed (if auth-related)

**Rate Limiting:**

- [ ] Rate limiting applied (if public endpoint)
- [ ] Abuse vectors considered

**Notes:**

- [Any security decisions or considerations]

</security>

<error_handling>

## Error Handling

**Pattern Used:** [Matches pattern from /path:lines]

**Errors Handled:**

| Error Type     | HTTP Status | Handling                  | Logged? |
| -------------- | ----------- | ------------------------- | ------- |
| Validation     | 400         | Return validation details | No      |
| Auth           | 401/403     | Return generic message    | Yes     |
| Not Found      | 404         | Return not found message  | No      |
| Business Logic | 400/422     | Return specific error     | Depends |
| Database       | 500         | Log + generic message     | Yes     |
| Unknown        | 500         | Log + generic message     | Yes     |

**Logging:**

- Errors logged with: [correlation ID, user ID, request path, etc.]
- Log level: [error / warn depending on type]

</error_handling>

<tests>

### [filename.test.ts]

**Location:** `/absolute/path/to/file.test.ts`

```typescript
[Test code covering the implementation]
```

**Coverage:**

- [x] Happy path: [scenario]
- [x] Validation errors: [scenarios]
- [x] Auth errors: [scenarios]
- [x] Edge cases: [scenarios]

**Test Commands:**

```bash
# Run tests for this feature
[specific test command]
```

</tests>

<verification>

## Success Criteria

| Criterion            | Status    | Evidence                                       |
| -------------------- | --------- | ---------------------------------------------- |
| [From specification] | PASS/FAIL | [How verified - test name, curl command, etc.] |

## Universal Quality Checks

**API Design:**

- [ ] RESTful conventions followed (or GraphQL if applicable)
- [ ] Consistent response format across endpoints
- [ ] Appropriate HTTP status codes used
- [ ] API versioning considered (if breaking change)

**Database:**

- [ ] Queries optimized (no N+1, proper indexes)
- [ ] Transactions used for multi-step operations
- [ ] Soft delete checks where applicable
- [ ] Connection pooling respected

**Code Quality:**

- [ ] No magic numbers (named constants used)
- [ ] No `any` types without justification
- [ ] Follows existing naming conventions
- [ ] Follows existing file/folder structure
- [ ] No hardcoded config values (uses env/config)

**Observability:**

- [ ] Appropriate logging added
- [ ] Errors include context for debugging
- [ ] Metrics/tracing hooks (if applicable)

## Build & Test Status

- [ ] Existing tests pass
- [ ] New tests pass (if added)
- [ ] Build succeeds
- [ ] No type errors
- [ ] No lint errors
- [ ] Migrations run successfully (if applicable)

</verification>

<notes>

## For Reviewer

- [Areas to focus review on - e.g., "The permission check logic"]
- [Decisions that may need discussion]
- [Alternative approaches considered and why rejected]

## Scope Control

**Added only what was specified:**

- [Feature implemented as requested]

**Did NOT add:**

- [Unrequested feature avoided - why it was tempting but wrong]

## Known Limitations

- [Any scope reductions from spec]
- [Technical debt incurred and why]
- [Performance considerations for high load]

## Dependencies

- [New packages added: none / list with justification]
- [Breaking changes: none / description]
- [Migration required: yes/no]

</notes>

</output_format>

---

## Section Guidelines

### When to Include Each Section

| Section              | When Required                     |
| -------------------- | --------------------------------- |
| `<summary>`          | Always                            |
| `<investigation>`    | Always - proves research was done |
| `<approach>`         | Always - shows planning           |
| `<implementation>`   | Always - the actual code          |
| `<api_changes>`      | When API endpoints added/modified |
| `<database_changes>` | When schema/migrations added      |
| `<security>`         | Always for backend work           |
| `<error_handling>`   | Always - shows error strategy     |
| `<tests>`            | When tests are part of the task   |
| `<verification>`     | Always - proves completion        |
| `<notes>`            | When there's context for reviewer |

### Security Checks (Framework-Agnostic)

These apply regardless of Express, Hono, Fastify, or any framework:

- **Input validation:** Never trust user input - validate everything
- **SQL injection:** Use parameterized queries or ORM, never string concatenation
- **Auth checks:** Verify identity AND authorization on every protected route
- **Secrets:** Environment variables only, never in code
- **Logging:** Never log passwords, tokens, or PII

### Database Checks (ORM-Agnostic)

- **Transactions:** Multi-step operations must be atomic
- **N+1 queries:** Avoid fetching related data in loops
- **Indexes:** Add for frequently queried columns
- **Soft delete:** Check for deleted records if pattern exists
- **Connection handling:** Don't leak connections

### Error Handling (Framework-Agnostic)

Every error needs:

1. **Appropriate status code:** 4xx for client errors, 5xx for server
2. **Safe message:** Don't expose internals to clients
3. **Logging:** Log enough to debug, not too much PII
4. **Consistency:** Same error format across all endpoints

### API Design (Framework-Agnostic)

- **Idempotency:** PUT/DELETE should be idempotent
- **Pagination:** List endpoints should paginate
- **Filtering:** Support common filter patterns
- **Versioning:** Consider when making breaking changes
