# Research Methodology - Practical Examples

> Progress tracking templates and real-world research examples.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [Core Examples](core.md) | [Reference](../reference.md)

---

## Progress Tracking Template

### For Complex Multi-Area Research

```markdown
## Research Progress

**Topic:** [area being researched]
**Status:** [In Progress | Complete]

**Files Examined:**
- [x] /path/to/file1.tsx - Pattern X found
- [x] /path/to/file2.tsx - No relevant patterns
- [ ] /path/to/file3.tsx - Not yet examined

**Patterns Found:**
1. [Pattern A] - 12 instances
2. [Pattern B] - 3 instances

**Gaps Identified:**
- Could not find [expected pattern]
- [Area] has inconsistent patterns
```

**When to use progress tracking:**
- Research spans multiple packages/directories
- Investigation reveals unexpected complexity
- You need to pause and resume research

---

## Real-World Example: Investigating Authentication Patterns

### Step 1: Glob for Auth Files

```bash
Glob("**/auth*.ts") -> Found:
- /packages/api/src/routes/auth.ts
- /packages/api/src/middleware/auth-middleware.ts
- /apps/web/src/lib/auth.ts
- /apps/web/src/hooks/use-auth.ts
```

### Step 2: Grep for Specific Patterns

```bash
Grep("session", "**/auth*.ts") -> 12 matches
Grep("jwt", "**/auth*.ts") -> 0 matches
```

**Finding:** Session-based auth, not JWT

### Step 3: Read Key Files

```markdown
Read("/packages/api/src/routes/auth.ts")

**Lines 12-30:** Session creation flow
**Lines 45-67:** Session validation middleware
**Lines 89-102:** Logout handler
```

### Final Output

```markdown
## Research Summary
- Topic: Authentication patterns
- Type: Implementation Research
- Files Examined: 4
- Paths Verified: Yes

## Patterns Found

### Session-Based Authentication
- File: `/packages/api/src/routes/auth.ts:12-30`
- Description: Uses server-side sessions with secure cookies
- Usage: All auth flows use this pattern

### Auth Middleware
- File: `/packages/api/src/middleware/auth-middleware.ts:15-40`
- Description: Validates session on protected routes
- Usage: Applied via route middleware

## Files to Reference
| Priority | File | Lines | Why Reference |
|----------|------|-------|---------------|
| 1 | /packages/api/src/routes/auth.ts | 12-102 | Complete auth implementation |
| 2 | /packages/api/src/middleware/auth-middleware.ts | 15-40 | Middleware pattern |

## Verification Checklist
| Finding | Verification | Status |
|---------|--------------|--------|
| Session-based auth | Read auth.ts:12-30 | Verified |
| No JWT usage | Grep "jwt" -> 0 results | Verified |
| Middleware pattern | Read auth-middleware.ts:15-40 | Verified |
```
