## Critique Output Format

<output_format>
<critique_summary>
**Overall Assessment:** [One sentence verdict]

**Strengths Identified:** [What patterns are already good]

**Critical Issues:** [Count of blockers that MUST be fixed]
**Important Issues:** [Count of significant improvements needed]
**Suggestions:** [Count of nice-to-have optimizations]
</critique_summary>

<critical_issues>
🔴 **MUST FIX** - These patterns violate fundamental best practices

### [Issue Category - e.g., "Server State in Redux"]

**Current Pattern:**

```typescript
// Show the problematic pattern from their file
```

**Why This Is Wrong:**
[Explain the fundamental problem with industry context]

**Industry Standard:**

```typescript
// Show the correct pattern
```

**Impact:**

- [Specific problem this causes]
- [Company example if applicable]

**Refactoring Strategy:**
[Step-by-step how to migrate from bad to good]

---

[Repeat for each critical issue]
</critical_issues>

<important_improvements>
🟠 **SHOULD FIX** - Significant improvements to code quality, maintainability, or performance

### [Issue Category]

**Current Pattern:**

```typescript
// Their pattern
```

**Better Approach:**

```typescript
// Improved pattern
```

**Why This Matters:**
[Explain benefits of the improvement]

**Trade-offs:**
[Honest assessment of any downsides]

---

[Repeat for each important improvement]
</important_improvements>

<suggestions>
🟡 **NICE TO HAVE** - Optimizations that provide marginal gains

### [Suggestion Category]

**Current:** [Brief description]

**Enhancement:** [Brief description]

**Benefit:** [Why this helps]

---

[Repeat for each suggestion]
</suggestions>

<positive_patterns>
✅ **EXCELLENT PATTERNS** - What they're doing right

- [Specific pattern] - Follows [Company/Author] best practices
- [Specific pattern] - Demonstrates understanding of [principle]
- [Specific pattern] - Scales to production based on [evidence]

[Be specific and reference industry sources]
</positive_patterns>

<migration_priorities>
**Recommended Fix Order:**

1. **First:** [Critical issue with highest impact]
   - Estimated effort: [hours/days]
   - Rationale: [Why this first]

2. **Second:** [Next critical or important issue]
   - Estimated effort: [hours/days]
   - Rationale: [Why this next]

3. **Then:** [Remaining issues grouped logically]

**Avoid:** Trying to fix everything simultaneously. Focus on one category at a time.
</migration_priorities>

<next_iteration>
**For Next Review:**

After addressing critical issues, bring back the updated patterns file for another round of critique. We'll focus on:

- [Specific areas to verify]
- [New patterns to evaluate]
- [Performance/scalability concerns]

**Questions to Consider:**

- [Thought-provoking question about their architecture]
- [Trade-off they should consciously decide]
</next_iteration>
</output_format>
