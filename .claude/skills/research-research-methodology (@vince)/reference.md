# Research Methodology - Reference

> Decision frameworks, anti-patterns, and red flags for research methodology.

---

## Decision Framework

### Which Investigation Tool First?

```
Do you know which directory to search?
├─ YES → Do you know what content to find?
│   ├─ YES → Grep in that directory
│   └─ NO → Glob to list files, then Read key ones
└─ NO → Start with broad Glob, narrow with Grep
```

### How Deep to Investigate?

```
What's the research request?
├─ "How does X work?" → Read 2-3 exemplary files deeply
├─ "What exists for X?" → Catalog with counts, sample 1-2 files
├─ "Find similar to Y" → Find best match, read it completely
└─ "Patterns for X?" → Find multiple instances, document variations
```

### When to Stop Researching?

```
Have you answered the specific question?
├─ YES → Have you verified all claims?
│   ├─ YES → Report findings
│   └─ NO → Verify before reporting
└─ NO → Continue investigation (but don't expand scope)
```

### Research vs Implementation

```
Is this a research task?
├─ "Find how..." → Research (produce findings)
├─ "Discover patterns..." → Research (produce findings)
├─ "Understand..." → Research (produce findings)
├─ "Implement..." → NOT research (defer to developer)
├─ "Create..." → NOT research (defer to developer)
└─ "Fix..." → NOT research (defer to developer)
```

---

## Red Flags

### High Priority Issues

- Claiming patterns without file:line evidence
- Including file paths that weren't verified with Read
- Speculating about code structure without investigation
- Providing implementation advice when asked for research
- Missing verification checklist in output

### Medium Priority Issues

- Vague line references ("around line 50" instead of "lines 45-67")
- Not reporting usage counts when available
- Skipping the Files to Reference section
- Not noting gaps or inconsistencies found

### Common Mistakes

- Assuming file locations from convention without checking
- Inferring patterns from file names without reading content
- Mixing research findings with opinions
- Expanding scope without asking

### Gotchas and Edge Cases

- Some patterns exist but are deprecated (check for // @deprecated comments)
- Tests may show patterns that differ from production code
- Config files may override patterns in source code
- Monorepo patterns may vary by package

---

## Anti-Patterns

### Speculation Without Investigation

Research must be grounded in actual file contents, not assumptions.

```markdown
# WRONG - Speculation
"Based on typical React Query patterns, this codebase likely uses..."

# CORRECT - Investigation
Read("/packages/api/src/queries/posts.ts")
"Based on /packages/api/src/queries/posts.ts:12-30, this codebase uses..."
```

**Why this matters:** Developer agents trust research findings. Speculation leads them down wrong paths.

---

### Unverified File Paths

Every path in findings must be confirmed to exist.

```markdown
# WRONG - Assumed path
"Reference: /packages/ui/components/Button.tsx"
[Never actually read this file]

# CORRECT - Verified path
Read("/packages/ui/src/button/button.tsx") -> Success
"Reference: /packages/ui/src/button/button.tsx"
```

**Why this matters:** False paths waste developer time and erode trust.

---

### Scope Creep

Stay focused on what was asked.

```markdown
# WRONG - Scope creep
Question: "How does authentication work?"
Answer: [10 pages about auth, database schema, deployment, testing, ...]

# CORRECT - Focused response
Question: "How does authentication work?"
Answer: [Auth flow, session handling, key files - nothing more]
```

**Why this matters:** Unfocused research delays actual implementation.

---

### Implementation Instead of Research

Research produces findings. Implementation is for developer agents.

```markdown
# WRONG - Implementation in research
"Here's how to implement the feature:
```typescript
export const NewComponent = () => { ... }
```"

# CORRECT - Research findings
"Similar implementations exist at:
1. /path/to/similar.tsx:12-45 - Best reference
2. /path/to/variant.tsx:8-30 - Alternative approach"
```

**Why this matters:** Research informs implementation; it doesn't replace it.

---

## Quality Checklist

Before finalizing research findings:

- [ ] All file paths verified with Read tool
- [ ] All claims have file:line references
- [ ] No speculation or assumptions
- [ ] Structured output format followed
- [ ] Scope matches original question
- [ ] Verification checklist included
- [ ] Files to Reference table populated
- [ ] Usage counts provided where applicable
- [ ] Gaps and inconsistencies noted
- [ ] No implementation code (findings only)

---

## Tool Reference

### Glob - File Discovery

```bash
# Find by extension
Glob("**/*.tsx")

# Find by name pattern
Glob("**/auth*.ts")

# Find in specific directory
Glob("packages/ui/src/**/*.tsx")
```

### Grep - Content Search

```bash
# Search for pattern
Grep("useQuery", "packages/api/")

# Count occurrences
Grep("forwardRef", "packages/ui/") -> X matches

# Search specific file types
Grep("export const", "**/*.ts")
```

### Read - File Examination

```bash
# Read entire file
Read("/path/to/file.tsx")

# Note specific lines
# Lines 12-45: Pattern implementation
# Lines 67-89: Error handling
```

### Bash - Read-Only Commands

```bash
# Count files
find packages/ui -name "*.tsx" | wc -l

# List directory structure
ls -la packages/api/src/routes/

# Check file existence
test -f /path/to/file.tsx && echo "exists"
```

---

## Output Templates

### Pattern Discovery

```markdown
## Pattern: [Name]

**Location:** `/path/to/file.tsx:12-45`
**Frequency:** X instances in Y files
**Description:** [What the pattern does]

**Implementation:**
```typescript
// From /path/to/file.tsx:15-25
[Actual code]
```

**Variations:**
- Variation A: `/path/to/alt1.tsx:8-20`
- Variation B: `/path/to/alt2.tsx:30-45`
```

### Inventory Report

```markdown
## [Category] Inventory

| Item | Location | Lines | Description |
|------|----------|-------|-------------|
| [Name] | [/path] | [X-Y] | [Brief] |
| [Name] | [/path] | [X-Y] | [Brief] |

**Total:** X items in Y files
**Verified:** Yes
```

### Implementation Research

```markdown
## How [Feature] Works

### Entry Point
**File:** `/path/to/entry.tsx:12-30`
**Description:** [What happens first]

### Core Logic
**File:** `/path/to/logic.ts:45-89`
**Description:** [Main processing]

### Output
**File:** `/path/to/output.tsx:100-120`
**Description:** [Final result]

### Files to Reference
1. `/path/to/entry.tsx` - Start here
2. `/path/to/logic.ts` - Core implementation
3. `/path/to/output.tsx` - Output handling
```
