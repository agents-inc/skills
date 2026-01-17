# Research Methodology - Core Examples

> Essential patterns and templates for research methodology. Always loaded.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [Practical Examples](practical.md) | [Reference](../reference.md)

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
Yes File exists -> Include in findings with line numbers

# Step 3: If file doesn't exist, note the error
No File not found -> Do NOT include in findings
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
+-- "How does X work?" -> Focus on X, not everything related
+-- "What components exist?" -> Catalog components, not all patterns
+-- "Find similar to Y" -> Find similar, not comprehensive analysis
+-- "How should I implement Z?" -> Implementation guidance, not alternatives
```

### Scope Anti-Patterns

- Researching tangentially related topics
- Providing unsolicited architecture opinions
- Expanding simple questions into comprehensive audits
- Recommending changes when asked for research only

**Why scope matters:** Research is preparation for action. Unfocused research delays the actual work.
