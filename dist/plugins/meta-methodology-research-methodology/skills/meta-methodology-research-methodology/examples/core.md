# Research Methodology - Core Examples

> Full shapes for the patterns in [SKILL.md](../SKILL.md). What each search tool skips, and the pre-report checklist, are in [reference.md](../reference.md).

---

## Pattern 1: Locate, Narrow, Read

### Good Example - Each Step Feeds the Next

```text
Question: how does this codebase define its error types?

1. Locate by name
   Glob "src/**/*error*"                     → 6 files

2. Narrow by content
   Grep "class \w+ extends" in those files   → 5 files declare a class
   Grep "extends AppError" in src/ (count)   → 4 matches in 4 files

3. Read the file the others depend on
   Read src/errors/app-error.ts              → class AppError, lines 8–31
```

The same steps where the session has no Glob or Grep tool:

```bash
find src -name '*error*'
grep -rn 'extends AppError' src
```

The two do not filter alike — the Grep tool skips gitignored files, and a shell search follows its own defaults — so record which one produced a count.

**Why good:** each step narrows what the next one costs, and each leaves a result the reader can rerun.

### Bad Example - Speculation Without Investigation

```text
"Based on typical patterns, this codebase probably uses custom error classes..."
[no file was opened]
```

**Why bad:** it describes what codebases usually do. Nothing in it came from this one.

---

## Pattern 2: Evidence-Based Claims

### Good Example - One Claim, One Location

````markdown
## Pattern: AppError base class

**Location:** `src/errors/app-error.ts:8-31` — `class AppError`
**Usage:** 4 subclasses (Grep `extends AppError` in `src/`, count mode → 4)

```typescript
// src/errors/app-error.ts:8-31
[the code exactly as it reads at those lines]
```

**Verified:** read at the range above, in this session
````

**Why good:** the reader can open the range, see the code, and judge from the count whether this is a convention or a one-off. If an edit has moved the lines, `class AppError` finds them again.

### Bad Example - A Claim With Nothing to Check

```markdown
## Pattern: Error handling

The codebase uses custom error classes for handling errors.
```

**Why bad:** true or not, the reader has to redo the investigation to find out.

---

## Pattern 3: Structured Findings

Use this where the instructions you are working under give no report shape of their own.

```markdown
## Research Summary

- Question: [what was asked]
- Type: [Pattern Discovery | Inventory | Implementation Research]
- Files examined: [count, and how many were read in full]
- Paths verified: [Yes, or which were not]

## Patterns Found

### [Pattern name]

- Location: [path:lines] — [symbol]
- Description: [one line]
- Usage: [count, and the search that produced it]
- Code: [the lines as they read]

## Files to Reference

| Priority | File   | Lines   | Why read it          |
| -------- | ------ | ------- | -------------------- |
| 1        | [path] | [12-45] | Fullest example      |
| 2        | [path] | [8-30]  | Alternative approach |

## Recommended Approach

1. [A step, and the existing file to follow for it]
2. [The next step, and its file]

## Gaps

- [What the codebase did not settle, or "none"]

## Verification Checklist

| Finding | How verified                 | Status   |
| ------- | ---------------------------- | -------- |
| [claim] | [the read or search, as run] | Verified |
```

Recommended Approach names existing code to follow; it carries no new code. A claim that fails verification leaves Patterns Found and is listed under Gaps instead.

---

## Pattern 4: Verifying Paths and Absences

### Paths

```text
Read src/utils/formatDate.ts        → file not found
Glob "**/*date*"                   → src/lib/time/format-date.ts
Read src/lib/time/format-date.ts   → formatDate, lines 12–45
Finding cites: src/lib/time/format-date.ts:12-45
```

A file that cannot be found stays out of the findings and goes under Gaps as "Could not locate [the expected file]". The usual ways a wrong path gets in:

- the path was guessed from convention
- the line numbers were carried over from a similar file
- the directory layout was inferred rather than listed

### Absences

```text
Grep "jwt" -i in src/       → 0 matches
Grep "session" -i in src/   → 12 matches   (control: the same path and filters find text)
Finding: no JWT handling in src/ — gitignored files were not searched
```

The control rules out a pattern the tool rejected, a path it could not read, and a scope that holds nothing; the closing note says what the search could not see. [reference.md](../reference.md#what-each-search-skips) lists what each tool skips.

---

## Pattern 5: Scope to the Question

### Good Example - The Answer and Nothing Around It

```text
Question: How does the API authenticate requests?
Answer:   the session flow, the route guard, the two files to read first
Gaps:     the client's login form matched the name search and was not read — the question is about the API
```

### Bad Example - Scope Creep

```text
Question: How does the API authenticate requests?
Answer:   [the auth flow, then the database schema, deployment, test setup, ...]
```

**Why bad:** the reader has to find the answer inside the survey, and the survey filled the context the work needs.

### Bad Example - Implementation Instead of Research

```text
"Here's how to implement the feature:
export const NewComponent = () => { ... }"
```

### Good Example - The Code to Follow

```text
Similar implementations:
1. src/features/invoices/invoice-list.ts:12-45 — closest match
2. src/features/orders/order-list.ts:8-30 — same shape, paginated on the server
```

**Why good:** the implementer starts from code the codebase already accepted, with the context to adapt it.

The scope failures to watch for:

- researching topics next to the question rather than the question
- offering architecture opinions nobody asked for
- turning a simple question into an audit
- recommending changes when the task was research

---

## Pattern 6: Progress Notes for Long Research

Keep this note when the research spans several packages, when it turns out more complex than expected, or when it may be paused, compacted or handed over.

```markdown
## Research Progress

**Question:** [what is being researched]
**Status:** [In Progress | Complete]

**Files examined:**

- [x] src/auth/session.ts — session creation found
- [x] src/auth/tokens.ts — nothing relevant
- [ ] src/auth/oauth.ts — not yet read

**Patterns found:**

1. [Pattern A] — 12 instances (Grep "...", count mode)
2. [Pattern B] — 3 instances

**Gaps:**

- Could not find [the expected pattern]
- [Area] follows two inconsistent patterns
```

---

## Worked Example: Authentication Research

The full sequence, from question to findings.

### Investigation

```text
Question: how does the API authenticate requests?

1. Locate
   Glob "**/*auth*.ts" → packages/api/src/routes/auth.ts
                         packages/api/src/middleware/auth-middleware.ts
                         apps/web/src/lib/auth.ts
                         apps/web/src/lib/auth-client.ts

2. Narrow
   Grep "session" -i in those files (count) → 12 matches in 3 files
   Grep "jwt" -i in those files             → 0 matches

3. Read
   Read packages/api/src/routes/auth.ts
     → createSession 12–30, endSession 89–102
   Read packages/api/src/middleware/auth-middleware.ts
     → requireSession 15–40
   Grep "requireSession" in packages/api/src/routes/ (count) → 9 matches
```

### Findings

```markdown
## Research Summary

- Question: how does the API authenticate requests?
- Type: Implementation Research
- Files examined: 4 located, 2 read in full
- Paths verified: Yes

## Patterns Found

### Session-based authentication

- Location: `packages/api/src/routes/auth.ts:12-30` — `createSession`
- Description: a server-side session, referenced from a secure cookie
- Usage: the login and signup routes both call it (Grep `createSession` → 3 matches: the definition and 2 calls)

### Session check on protected routes

- Location: `packages/api/src/middleware/auth-middleware.ts:15-40` — `requireSession`
- Description: rejects a request without a valid session before its handler runs
- Usage: 9 routes (Grep `requireSession` in `packages/api/src/routes/`, count mode → 9)

## Files to Reference

| Priority | File                                           | Lines  | Why read it                   |
| -------- | ---------------------------------------------- | ------ | ----------------------------- |
| 1        | packages/api/src/routes/auth.ts                | 12-102 | Creating and ending a session |
| 2        | packages/api/src/middleware/auth-middleware.ts | 15-40  | How a route is protected      |

## Gaps

- `apps/web/src/lib/auth.ts` and `apps/web/src/lib/auth-client.ts` matched the name search and were not read; the question is about the API.

## Verification Checklist

| Finding            | How verified                     | Status   |
| ------------------ | -------------------------------- | -------- |
| Session-based auth | Read auth.ts:12-30               | Verified |
| No JWT handling    | Grep jwt 0, session 12 (control) | Verified |
| Route protection   | Read auth-middleware.ts:15-40    | Verified |
| 9 protected routes | Grep requireSession, count mode  | Verified |
```
