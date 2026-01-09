# Research Methodology - Examples

> Code examples and templates for research methodology patterns.

---

## Pattern 1: Investigation Flow

### Good Example - Systematic Investigation

```markdown
**Step 1: Find candidate files**
Glob("packages/ui/src/**/*.tsx") -> Found 47 component files

**Step 2: Search for pattern**
Grep("forwardRef", "packages/ui/src/") -> 23 matches

**Step 3: Read exemplary files**
Read("/packages/ui/src/button/button.tsx") -> Lines 12-45 show pattern
```

### Bad Example - Speculation Without Investigation

```markdown
"Based on typical React patterns, this codebase probably uses..."
[NO FILES WERE READ - THIS IS SPECULATION]
```

**Why the good example works:** Glob finds files efficiently, Grep narrows to relevant content, Read provides complete understanding. Each step builds on the previous and produces verifiable evidence.

**Why the bad example fails:** No actual files were examined. Claims are based on assumptions about "typical" patterns rather than evidence from the specific codebase.

---

## Pattern 2: Evidence-Based Claims

### Good Evidence Structure

```markdown
## Pattern: [Pattern Name]

**File:** `/path/to/file.tsx:12-45`
**Usage Count:** X instances found via Grep

**Code Example:**
```typescript
// From /path/to/file.tsx:15-25
[Actual code from the file]
```

**Verification:** Read file confirmed pattern exists at stated location
```

### Bad Evidence Structure

```markdown
## Pattern: [Pattern Name]

The codebase uses this pattern for handling X.
[NO FILE PATH, NO LINE NUMBERS, NO EVIDENCE]
```

**Why the good example works:** Every claim has a specific file path, line numbers, and actual code. Developer agents can verify and reference the exact location.

**Why the bad example fails:** No way for developer agents to verify the claim or find the actual implementation. Vague references lead to wasted investigation time.

---

## Pattern 3: Structured Output Format

### Complete Research Output Template

```markdown
## Research Summary
- Topic: [What was researched]
- Type: [Pattern Discovery | Inventory | Implementation Research]
- Files Examined: [count]
- Paths Verified: [Yes/No]

## Patterns Found

### Pattern 1: [Name]
- File: [path:lines]
- Description: [Brief explanation]
- Usage Count: [X instances]
- Code Example: [Actual code block]

### Pattern 2: [Name]
- File: [path:lines]
- Description: [Brief explanation]
- Usage Count: [X instances]
- Code Example: [Actual code block]

## Files to Reference
| Priority | File | Lines | Why Reference |
|----------|------|-------|---------------|
| 1 | [/path/to/best.tsx] | [12-45] | Best example |
| 2 | [/path/to/alt.tsx] | [8-30] | Alternative approach |

## Recommended Approach
1. [Step 1 with file reference]
2. [Step 2 with file reference]
3. [Step 3 with file reference]

## Verification Checklist
| Finding | Verification | Status |
|---------|--------------|--------|
| [Claim] | [How verified] | Verified/Failed |
```

---

## Pattern 4: Path Verification Protocol

### Verification Process

```markdown
# Step 1: Read the file
Read("/path/to/file.tsx")

# Step 2: If file exists, include path
✓ File exists -> Include in findings with line numbers

# Step 3: If file doesn't exist, note the error
✗ File not found -> Do NOT include in findings
  Report: "Could not locate [expected file]"
```

### Common Verification Failures

- Path guessed from convention without checking
- Line numbers assumed from similar files
- Directory structure inferred instead of verified

**Why verify:** False paths waste developer time and erode trust in research findings.

---

## Pattern 5: Research Scope Management

### Scope Rules

```
What was asked?
├── "How does X work?" -> Focus on X, not everything related
├── "What components exist?" -> Catalog components, not all patterns
├── "Find similar to Y" -> Find similar, not comprehensive analysis
└── "How should I implement Z?" -> Implementation guidance, not alternatives
```

### Scope Anti-Patterns

- Researching tangentially related topics
- Providing unsolicited architecture opinions
- Expanding simple questions into comprehensive audits
- Recommending changes when asked for research only

**Why scope matters:** Research is preparation for action. Unfocused research delays the actual work.

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
