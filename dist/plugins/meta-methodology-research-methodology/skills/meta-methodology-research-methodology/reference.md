# Research Methodology - Reference

> Decision frameworks, anti-patterns, and quality checklist for research methodology.

**Navigation:** [Back to SKILL.md](SKILL.md) | [Core Examples](examples/core.md)

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

## Anti-Patterns

### Speculation Without Investigation

Research must be grounded in actual file contents, not assumptions.

```markdown
# WRONG - Speculation

"Based on typical data-fetching patterns, this codebase likely uses..."

# CORRECT - Investigation

Read("/packages/api/src/queries/posts.ts")
"Based on /packages/api/src/queries/posts.ts:12-30, this codebase uses..."
```

**Why this matters:** Downstream agents trust research findings. Speculation leads them down wrong paths.

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

Research produces findings, not implementation code.

```markdown
# WRONG - Implementation in research

"Here's how to implement the feature:
export const NewComponent = () => { ... }"

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
