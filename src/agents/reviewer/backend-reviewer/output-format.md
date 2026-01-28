## Output Format

<output_format>
Provide your review in this structure:

<review_summary>
**Files Reviewed:** [count] files ([total lines] lines)
**Overall Assessment:** [APPROVE | REQUEST CHANGES | MAJOR REVISIONS NEEDED]
**Key Findings:** [2-3 sentence summary of most important issues/observations]
</review_summary>

<files_reviewed>

| File                | Lines | Review Focus        |
| ------------------- | ----- | ------------------- |
| [/path/to/route.ts] | [X-Y] | [What was examined] |

</files_reviewed>

<security_audit>

## Security Review

### Input Validation

- [ ] All user inputs validated before use
- [ ] Request body validated with schema
- [ ] Query/path params validated
- [ ] File uploads restricted (type, size) if applicable

### Injection Prevention

- [ ] SQL injection: Parameterized queries / ORM used
- [ ] Command injection: No shell exec with user input
- [ ] Path traversal: File paths validated
- [ ] XSS: Output encoded where needed

### Authentication / Authorization

- [ ] Auth middleware on protected routes
- [ ] Permission checks implemented
- [ ] Resource ownership verified (users access only their data)
- [ ] Tokens handled securely

### Sensitive Data

- [ ] No secrets hardcoded (using env vars)
- [ ] No PII in logs or error responses
- [ ] Passwords properly hashed
- [ ] Sensitive fields excluded from API responses

### Rate Limiting

- [ ] Rate limiting on public/auth endpoints
- [ ] Brute force protection where needed

**Security Issues Found:**

| Finding | Location    | Severity               | Impact |
| ------- | ----------- | ---------------------- | ------ |
| [Issue] | [file:line] | [Critical/High/Medium] | [Risk] |

</security_audit>

<must_fix>

## Critical Issues (Blocks Approval)

### Issue #1: [Descriptive Title]

**Location:** `/path/to/file.ts:45`
**Category:** [Security | Correctness | Validation | Error Handling]

**Problem:** [What's wrong - one sentence]

**Current code:**

```typescript
// The problematic code
```

**Recommended fix:**

```typescript
// The corrected code
```

**Impact:** [Why this matters - security risk, data integrity, etc.]

**Pattern reference:** [/path/to/similar/file:lines] (if applicable)

</must_fix>

<should_fix>

## Important Issues (Recommended Before Merge)

### Issue #1: [Title]

**Location:** `/path/to/file.ts:67`
**Category:** [Performance | Convention | Error Handling | Types]

**Issue:** [What could be better]

**Suggestion:**

```typescript
// How to improve
```

**Benefit:** [Why this helps]

</should_fix>

<nice_to_have>

## Minor Suggestions (Optional)

- **[Title]** at `/path:line` - [Brief suggestion with rationale]

</nice_to_have>

<api_quality>

## API Design Review

### REST Conventions

- [ ] Appropriate HTTP methods (GET/POST/PUT/DELETE)
- [ ] Correct status codes (2xx/4xx/5xx)
- [ ] Consistent response format
- [ ] Proper resource naming

### Error Handling

- [ ] Validation errors return 400 with details
- [ ] Auth errors return 401/403 appropriately
- [ ] Not found returns 404
- [ ] Server errors logged, generic response to client

### Performance

- [ ] No N+1 queries
- [ ] Proper pagination on list endpoints
- [ ] Indexes used for frequent queries
- [ ] Transactions for multi-step operations

### Documentation

- [ ] OpenAPI/schema annotations present (if applicable)
- [ ] Request/response types documented

**API Issues Found:** [count]

</api_quality>

<database_review>

## Database Review

### Query Quality

- [ ] Parameterized queries (no string concatenation)
- [ ] Proper JOINs (no N+1 patterns)
- [ ] Soft delete checks where applicable
- [ ] Transactions used for atomicity

### Schema

- [ ] Appropriate column types
- [ ] Indexes on frequently queried columns
- [ ] Foreign keys for relationships
- [ ] Nullable fields intentional

### Connection Handling

- [ ] Connection pooling respected
- [ ] No connection leaks
- [ ] Proper error handling on DB operations

**Database Issues Found:** [count]

</database_review>

<convention_check>

## Convention Adherence

| Dimension                    | Status         | Notes                 |
| ---------------------------- | -------------- | --------------------- |
| Naming conventions           | PASS/WARN/FAIL | [Details if not PASS] |
| File structure               | PASS/WARN/FAIL | [Details if not PASS] |
| Error handling pattern       | PASS/WARN/FAIL | [Details if not PASS] |
| Logging pattern              | PASS/WARN/FAIL | [Details if not PASS] |
| TypeScript strictness        | PASS/WARN/FAIL | [Details if not PASS] |
| Constants (no magic numbers) | PASS/WARN/FAIL | [Details if not PASS] |

</convention_check>

<positive_feedback>

## What Was Done Well

- [Specific positive observation with why it's good practice]
- [Another positive observation with pattern reference]
- [Reinforces patterns to continue using]

</positive_feedback>

<deferred>

## Deferred to Specialists

**Frontend Reviewer:**

- [React component X needs review]

**Tester Agent:**

- [Need test coverage for edge case Y]

**Security Specialist:**

- [Complex auth flow needs deeper review]

</deferred>

<approval_status>

## Final Recommendation

**Decision:** [APPROVE | REQUEST CHANGES | REJECT]

**Blocking Issues:** [count] ([count] security-related)
**Recommended Fixes:** [count]
**Suggestions:** [count]

**Next Steps:**

1. [Action item - e.g., "Add input validation at line 45"]
2. [Action item]

</approval_status>

</output_format>

---

## Section Guidelines

### Severity Levels

| Level     | Label          | Criteria                                     | Blocks Approval? |
| --------- | -------------- | -------------------------------------------- | ---------------- |
| Critical  | `Must Fix`     | Security issues, data integrity, correctness | Yes              |
| Important | `Should Fix`   | Performance, conventions, maintainability    | No (recommended) |
| Minor     | `Nice to Have` | Style, documentation, minor optimizations    | No               |

### Issue Categories (Backend-Specific)

| Category           | Examples                                                    |
| ------------------ | ----------------------------------------------------------- |
| **Security**       | Injection, auth bypass, exposed secrets, missing validation |
| **Correctness**    | Logic errors, race conditions, edge cases                   |
| **Validation**     | Missing input checks, improper schemas                      |
| **Error Handling** | Unhandled exceptions, poor error messages                   |
| **Performance**    | N+1 queries, missing indexes, blocking operations           |
| **Convention**     | Naming, structure, patterns, typing                         |
| **Database**       | Query quality, transaction handling, schema design          |

### Security Review Priority

Security issues are ALWAYS reviewed first. The security audit section:

1. Uses a checklist format for systematic coverage
2. Documents findings in a table with severity
3. Provides specific file:line references
4. Explains the risk/impact of each finding

### Issue Format Requirements

Every issue must include:

1. **Specific file:line location**
2. **Current code snippet** (what's wrong)
3. **Fixed code snippet** (how to fix)
4. **Impact explanation** (why it matters)
5. **Pattern reference** (where to see correct example, if applicable)
