## Example: Improvement Proposal

Here's what a complete, high-quality improvement proposal looks like:

````xml
<improvement_analysis>
**Agent:** example-agent
**File:** .claude-src/agents/example-agent.src.md
**Current State:** Needs work - missing critical techniques, structure issues
</improvement_analysis>

<technique_audit>
| Technique | Present? | Correct? | Notes |
|-----------|----------|----------|-------|
| Self-reminder loop | ✅ | ❌ | Has core-principles but missing final reminder |
| Investigation-first | ✅ | ✅ | Properly included |
| Anti-over-engineering | ❌ | N/A | Missing entirely |
| XML semantic tags | ✅ | ❌ | Uses generic names like <section1> |
| Emphatic repetition | ❌ | N/A | Critical rule not repeated |
</technique_audit>

<structure_audit>
**Present:** Frontmatter, Introduction, Core principles, Investigation, Workflow, Output format
**Missing:** Anti-over-engineering, Improvement protocol, Final reminder
**Out of Order:** Output format appears before workflow
</structure_audit>

<tonality_audit>
**Issues Found:**
- Line 45: Hedging language "You might want to consider..."
- Line 78: Motivational fluff "You've got this!"
- Average sentence length: 22 words (target: 12-15)

**Samples Needing Revision:**
- Line 45: "You might want to consider reading the file first" → "Read the file first"
- Line 78: "You've got this! Just follow the pattern" → "Follow the pattern"
</tonality_audit>

<findings>
| # | Finding | Category | Impact | Effort |
|---|---------|----------|--------|--------|
| 1 | Missing final reminder | Technique | High | Low |
| 2 | No anti-over-engineering | Technique | High | Low |
| 3 | Generic XML tags | Technique | Medium | Medium |
| 4 | Critical rule not repeated | Technique | High | Low |
| 5 | Verbose sentences | Tonality | Low | Medium |
</findings>

<improvement_proposal>
**Priority 1: High impact, low effort**

<change id="1">
**Location:** End of file
**Category:** Technique
**Impact:** High - 60-70% reduction in off-task behavior

**Current:**
```markdown
[File ends without final reminder]
````

**Proposed:**

```markdown
---

**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE TO MAINTAIN INSTRUCTION CONTINUITY.**
```

**Rationale:** Closes the self-reminder loop. Without this, agents drift off-task after 10-20 messages. With it, they maintain focus for 30+ hours.
</change>

<change id="2">
**Location:** After Investigation Requirement section
**Category:** Technique
**Impact:** High - 70% reduction in scope creep

**Current:**

```markdown
[No anti-over-engineering section]
```

**Proposed:**

```markdown
---

`@include(../core prompts/anti-over-engineering.md)`

---
```

**Rationale:** Implementation agents without anti-over-engineering guards over-engineer 70% more frequently.
</change>

<change id="3">
**Location:** After main workflow, before output format
**Category:** Technique
**Impact:** High - 40-50% better rule compliance

**Current:**

```markdown
## Workflow

[workflow content without emphatic repetition]
```

**Proposed:**

```markdown
## Workflow

[workflow content]

---

**CRITICAL: Always read pattern files before implementing. This prevents 80% of hallucination issues.**

---
```

**Rationale:** Emphatic repetition of critical rules increases compliance by 40-50%.
</change>

**Priority 2: High impact, high effort**

- None identified

**Priority 3: Low impact, low effort**

- Tighten sentence length throughout (22 → 15 words average)
- Remove hedging language on lines 45, 67, 89

**Deferred: Low impact, high effort**

- Rename all XML tags to semantic names: Would require restructuring multiple sections
  </improvement_proposal>

<summary>
**Total Changes:** 3 priority changes + 2 minor tonality fixes
**Expected Impact:**
- Off-task behavior: 60-70% reduction (from self-reminder loop closure)
- Scope creep: 70% reduction (from anti-over-engineering)
- Rule compliance: 40-50% improvement (from emphatic repetition)

**Recommendation:** Apply all priority 1 changes immediately. Tonality fixes optional.

</summary>
```

This example demonstrates:

- ✅ Complete audit of all dimensions
- ✅ Findings categorized with impact/effort
- ✅ Exact before/after text for each change
- ✅ Metrics-backed rationale
- ✅ Clear prioritization
- ✅ Actionable summary
