## Output Format

<output_format>
Provide your pattern critique in this structure:

<critique_summary>
**Codebase:** [Name/path of patterns analyzed]
**Patterns Reviewed:** [Count] patterns across [X] categories
**Overall Assessment:** [One sentence summary]

**Strengths:** [Key things done well]
**Issue Counts:** [X] Critical | [Y] Important | [Z] Suggestions
</critique_summary>

<critical_issues>

## Critical Issues (Must Fix)

These patterns violate fundamental best practices and should be addressed immediately.

### Issue #1: [Pattern Name]

**Current Pattern:**

```typescript
// From /path/to/file.ts:lines
[Code showing the problematic pattern]
```

**Why This Is Wrong:**
[Explanation grounded in fundamental principles - not just opinion]

**Industry Standard:**

```typescript
// How Airbnb/Stripe/Meta/Vercel would do this
[Correct pattern with code]
```

**Impact:**

- [Specific consequence: performance, maintainability, security, etc.]
- [Specific consequence]

**Refactoring Strategy:**

1. [Step 1 - what to change first]
2. [Step 2 - subsequent changes]
3. [Step 3 - verification]

**Estimated Effort:** [Hours/days]

**References:**

- [Source: Airbnb style guide, React docs, etc.]

</critical_issues>

<important_improvements>

## Important Improvements (Should Fix)

These patterns work but could be significantly better.

### Improvement #1: [Pattern Name]

**Current Pattern:**

```typescript
// From /path/to/file.ts:lines
[Current code]
```

**Recommended Pattern:**

```typescript
// Industry standard approach
[Better code]
```

**Benefits:**

- [Benefit 1: e.g., "50% reduction in re-renders"]
- [Benefit 2: e.g., "Easier testing"]

**Migration Path:**

1. [Step 1]
2. [Step 2]

**Estimated Effort:** [Hours/days]

</important_improvements>

<suggestions>

## Suggestions (Nice to Have)

Minor optimizations and enhancements.

| Pattern | Current         | Enhancement         | Benefit         |
| ------- | --------------- | ------------------- | --------------- |
| [Name]  | [Brief current] | [Brief improvement] | [Brief benefit] |
| [Name]  | [Brief current] | [Brief improvement] | [Brief benefit] |

</suggestions>

<positive_patterns>

## Excellent Patterns (Keep Doing This)

These patterns demonstrate industry best practices.

- **[Pattern name]:** [Why it's good] - Aligns with [Airbnb/Stripe/Meta/Vercel approach]
- **[Pattern name]:** [Why it's good] - Follows [Kent C. Dodds / Tanner Linsley / etc.] recommendations
- **[Pattern name]:** [Why it's good] - [Principle demonstrated]

</positive_patterns>

<category_analysis>

## Analysis by Category

### State Management

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

### Component Architecture

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

### Error Handling

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

### Testing

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

### Performance

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

### Security

**Score:** [Good | Needs Work | Critical Issues]
**Key Finding:** [Summary]

</category_analysis>

<migration_priorities>

## Recommended Migration Order

| Priority | Issue        | Estimated Effort | Rationale                                           |
| -------- | ------------ | ---------------- | --------------------------------------------------- |
| 1        | [Issue name] | [X hours/days]   | [Why first - blocking others, highest impact, etc.] |
| 2        | [Issue name] | [X hours/days]   | [Why second]                                        |
| 3        | [Issue name] | [X hours/days]   | [Why third]                                         |

**Total Estimated Effort:** [X hours/days]

**Dependencies:**

- [Issue A] must complete before [Issue B]
- [Issue C] and [Issue D] can be done in parallel

</migration_priorities>

<trade_offs>

## Trade-Off Considerations

**Pragmatism vs Perfection:**

- [Area where current approach is "good enough" given constraints]
- [Area where improvement ROI may not justify effort]

**Team Context:**

- [Consideration based on team size/experience]
- [Consideration based on project phase]

**Technical Debt Accepted:**

- [Debt item] - [Why acceptable for now] - [When to revisit]

</trade_offs>

<next_iteration>

## For Next Review

**Areas to Monitor:**

- [Pattern that may drift]
- [Area needing ongoing attention]

**Questions to Consider:**

- [Thought-provoking question about architecture]
- [Trade-off decision to revisit]

</next_iteration>

</output_format>

---

## Section Guidelines

### Severity Levels

| Level      | Icon | Criteria                            | Action       |
| ---------- | ---- | ----------------------------------- | ------------ |
| Critical   | 🔴   | Violates fundamental best practices | Must fix     |
| Important  | 🟠   | Significant improvement opportunity | Should fix   |
| Suggestion | 🟡   | Minor enhancement                   | Nice to have |
| Excellent  | ✅   | Industry best practice              | Keep doing   |

### Issue Format Requirements

Every issue must include:

1. **Current pattern** with actual code from the codebase
2. **Why it's wrong** - grounded in principles, not opinion
3. **Industry standard** - how recognized leaders do it
4. **Impact** - specific consequences
5. **Refactoring strategy** - step-by-step migration
6. **Effort estimate** - realistic time investment
7. **References** - authoritative sources

### Industry Standard Sources

| Source             | Domain                          |
| ------------------ | ------------------------------- |
| Airbnb Style Guide | JavaScript/React conventions    |
| Stripe Engineering | API design, reliability         |
| Meta/Facebook      | React patterns, performance     |
| Vercel             | Next.js, edge computing         |
| Kent C. Dodds      | Testing, React patterns         |
| Tanner Linsley     | Data fetching, state management |
| Google Engineering | System design, SRE              |

### Difference from Pattern-Scout

| Pattern-Scout                 | Pattern-Critique                    |
| ----------------------------- | ----------------------------------- |
| Documents what patterns exist | Evaluates if patterns are good      |
| Neutral, observational        | Prescriptive, educational           |
| Catalog with counts           | Issues with recommendations         |
| Feeds data to critique        | Feeds recommendations to developers |
