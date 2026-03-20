---
name: shared-meta-research-methodology
description: Investigation flow (Glob -> Grep -> Read), evidence-based research with file:line references, structured output format for AI consumption. Use for pattern discovery, implementation research, and codebase investigation.
---

# Research Methodology

> **Quick Guide:** Investigation flow is Glob -> Grep -> Read. All claims require file:line evidence. Structured output format for AI consumption. Read-only operations only. Verify every path before reporting.

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Investigation templates, output formats, progress tracking
- [reference.md](reference.md) - Decision frameworks, anti-patterns, quality checklist

---

<critical_requirements>

## CRITICAL: Before Any Research

> **All research must be evidence-based with file:line references**

**(You MUST read actual code files before making any claims - never speculate about patterns)**

**(You MUST verify every file path exists using Read tool before including it in findings)**

**(You MUST include file:line references for all pattern claims)**

**(You MUST NOT attempt to write or edit any files - you are read-only)**

**(You MUST produce structured, AI-consumable findings that downstream agents can act on)**

</critical_requirements>

---

**Auto-detection:** Pattern research, implementation discovery, architecture investigation, API cataloging

**When to use:**

- Discovering how patterns are implemented in a codebase
- Cataloging components, APIs, or architectural decisions
- Finding similar implementations to reference for new features
- Understanding existing conventions before implementation

**Key patterns covered:**

- Investigation flow (Glob -> Grep -> Read)
- Evidence-based claims with file:line references
- Structured output format for AI consumption
- Self-correction triggers for research quality
- Progress tracking for complex research

**When NOT to use:**

- When you need to implement code (research informs, doesn't replace implementation)
- When you need to create specifications (research feeds into specs, but doesn't produce them)
- When you need to review existing code for quality (research discovers patterns, doesn't judge them)

---

<philosophy>

## Philosophy

Research is investigation, not speculation. Every claim must be backed by evidence from actual code files. The output format is designed for consumption by other AI agents, not humans - this means structured sections, explicit file paths, and actionable recommendations.

**Core Research Principles:**

1. **Evidence First** - Never claim a pattern exists without reading the file
2. **Verify Paths** - Every file path in findings must be confirmed with Read
3. **Be Specific** - Line numbers, not vague references
4. **Be Actionable** - Tell developers exactly which files to reference
5. **Be Honest** - If you can't find something, say so

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Investigation Flow (Glob -> Grep -> Read)

The three-step investigation flow ensures thorough and efficient research.

#### Flow Structure

```
1. GLOB - Find candidate files
   ├── Use file patterns (*.tsx, *store*, *auth*)
   ├── Target specific directories when known
   └── Cast wide net initially, narrow later

2. GREP - Search for keywords/patterns
   ├── Use content patterns (useQuery, export const)
   ├── Narrow down to relevant files
   └── Note frequency of pattern usage

3. READ - Examine key files completely
   ├── Don't skim - read files that matter
   ├── Note line numbers for key patterns
   └── Understand the full context
```

**Why this flow:** Glob finds files efficiently, Grep narrows to relevant content, Read provides complete understanding. This prevents speculation and ensures evidence-based claims.

For detailed code examples, see [examples/core.md](examples/core.md#pattern-1-investigation-flow).

---

### Pattern 2: Evidence-Based Claims

Every claim in research findings must have supporting evidence with file paths and line numbers.

#### Claim Structure

````markdown
## Pattern: [Pattern Name]

**File:** `/path/to/file.tsx:12-45`
**Usage Count:** X instances found via Grep

**Code Example:**

```typescript
// From /path/to/file.tsx:15-25
[Actual code from the file]
```

**Verification:** Read file confirmed pattern exists at stated location
````

**Why this matters:** Downstream agents will use your research to implement features. Inaccurate or unverified claims will lead them astray.

For good/bad comparison examples, see [examples/core.md](examples/core.md#pattern-2-evidence-based-claims).

---

### Pattern 3: Structured Output Format

Research findings follow a consistent structure for AI consumption. Every output includes: Research Summary, Patterns Found (with file:line evidence), Files to Reference table, Recommended Approach, and Verification Checklist.

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
  ...
```

**Why structured:** Other AI agents parse this output. Consistent structure enables reliable extraction of relevant information.

For the complete output template, see [examples/core.md - Pattern 3](examples/core.md#pattern-3-structured-output-format).

</patterns>

---

<self_correction_triggers>

## Self-Correction Checkpoints

**If you notice yourself:**

- **Reporting patterns without reading files first** -> STOP. Use Read to verify the pattern exists.
- **Making claims about architecture without evidence** -> STOP. Find specific file:line references.
- **Attempting to write or edit files** -> STOP. You are read-only. Produce findings instead.
- **Providing generic advice instead of specific paths** -> STOP. Replace with concrete file references.
- **Assuming APIs without reading source** -> STOP. Read the actual source file.
- **Skipping file path verification** -> STOP. Use Read to confirm every path you report.
- **Expanding scope beyond the research question** -> STOP. Answer what was asked, no more.
- **Giving implementation opinions when asked for research** -> STOP. Report findings, not recommendations.

</self_correction_triggers>

---

<post_action_reflection>

## Post-Action Reflection

**After each research action, evaluate:**

1. Did I verify all file paths exist before including them?
2. Are my pattern claims backed by specific code examples?
3. Have I included line numbers for key references?
4. Is this research actionable for the consuming agent?
5. Did I stay within the scope of the research question?
6. Did I miss any obvious related patterns?

Only report findings when you have verified evidence for all claims.

</post_action_reflection>

---

<progress_tracking>

## Progress Tracking

For complex research spanning multiple areas, use the progress tracking template to maintain orientation. Track files examined, patterns found, and gaps identified.

See [examples/core.md - Pattern 6](examples/core.md#pattern-6-progress-tracking-for-complex-research) for the full template.

</progress_tracking>

---

<integration>

## Integration Guide

**Research is read-only.** Never write or edit files during research. Produce structured findings that other agents can act on.

**Output consumers:** Any agent that needs to understand codebase patterns before implementing, specifying, or reviewing code.

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Claiming patterns without file:line evidence
- Including file paths that weren't verified with Read
- Speculating about code structure without investigation
- Providing implementation advice when asked for research
- Missing verification checklist in output

**Medium Priority Issues:**

- Vague line references ("around line 50" instead of "lines 45-67")
- Not reporting usage counts when available
- Skipping the Files to Reference section
- Not noting gaps or inconsistencies found

**Common Mistakes:**

- Assuming file locations from convention without checking
- Inferring patterns from file names without reading content
- Mixing research findings with opinions
- Expanding scope without asking

**Gotchas & Edge Cases:**

- Some patterns exist but are deprecated (check for `@deprecated` comments)
- Tests may show patterns that differ from production code
- Config files may override patterns in source code
- Monorepo patterns may vary by package

See [reference.md](reference.md) for anti-pattern code examples and the quality checklist.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All research must be evidence-based with file:line references**

**(You MUST read actual code files before making any claims - never speculate about patterns)**

**(You MUST verify every file path exists using Read tool before including it in findings)**

**(You MUST include file:line references for all pattern claims)**

**(You MUST NOT attempt to write or edit any files - you are read-only)**

**(You MUST produce structured, AI-consumable findings that downstream agents can act on)**

**Failure to follow these rules will produce inaccurate research that misleads downstream agents.**

</critical_reminders>
