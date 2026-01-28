## Output Format

<output_format>
Provide your review in this structure:

<review_summary>
**Files Reviewed:** [count] files ([total lines] lines)
**Overall Assessment:** [APPROVE | REQUEST CHANGES | MAJOR REVISIONS NEEDED]
**Key Findings:** [2-3 sentence summary of most important issues/observations]
</review_summary>

<files_reviewed>

| File                     | Lines | Review Focus        |
| ------------------------ | ----- | ------------------- |
| [/path/to/component.tsx] | [X-Y] | [What was examined] |

</files_reviewed>

<must_fix>

## Critical Issues (Blocks Approval)

### Issue #1: [Descriptive Title]

**Location:** `/path/to/file.tsx:45`
**Category:** [Hooks | Accessibility | Performance | Correctness | TypeScript]

**Problem:** [What's wrong - one sentence]

**Current code:**

```tsx
// The problematic code
```

**Recommended fix:**

```tsx
// The corrected code
```

**Impact:** [Why this matters - a11y violation, bug, perf issue]

**Pattern reference:** [/path/to/similar/file:lines] (if applicable)

</must_fix>

<should_fix>

## Important Issues (Recommended Before Merge)

### Issue #1: [Title]

**Location:** `/path/to/file.tsx:67`
**Category:** [Performance | Patterns | Types | Structure]

**Issue:** [What could be better]

**Suggestion:**

```tsx
// How to improve
```

**Benefit:** [Why this helps]

</should_fix>

<nice_to_have>

## Minor Suggestions (Optional)

- **[Title]** at `/path:line` - [Brief suggestion with rationale]
- **[Title]** at `/path:line` - [Brief suggestion with rationale]

</nice_to_have>

<react_quality>

## React Quality Checks

### Component Structure

- [ ] Follows existing component patterns
- [ ] Appropriate decomposition (not a God component)
- [ ] Named exports (no default exports in libraries)
- [ ] Props destructured with defaults where appropriate

### Hooks Compliance

- [ ] Called at top level (not conditional/nested)
- [ ] Dependency arrays complete and correct
- [ ] Effects have cleanup where needed
- [ ] Custom hooks extracted for reusable logic

### Props & Types

- [ ] Props interface defined as `[Component]Props`
- [ ] No untyped `any` without justification
- [ ] Proper null/undefined handling
- [ ] Ref forwarding for interactive components

### State Management

- [ ] Appropriate state location (local vs store)
- [ ] No unnecessary state (derivable values)
- [ ] State updates are immutable

**Issues Found:** [count] ([count] critical)

</react_quality>

<accessibility>

## Accessibility Review

### Semantic HTML

- [ ] Semantic elements used (`<button>`, `<nav>`, `<main>`, not `<div>` soup)
- [ ] Heading hierarchy correct (`h1` → `h2` → `h3`)
- [ ] Lists use `<ul>`/`<ol>` with `<li>`

### Keyboard Navigation

- [ ] All interactive elements focusable
- [ ] Tab order logical
- [ ] Enter/Space activate controls
- [ ] Focus visible when focused

### ARIA & Labels

- [ ] Form inputs have labels
- [ ] Icons have accessible names
- [ ] ARIA used only when HTML semantics insufficient
- [ ] Live regions for dynamic content

### Visual

- [ ] Color not sole means of conveying information
- [ ] Focus indicators visible
- [ ] Text resizable without breaking layout

**A11y Issues Found:** [count] ([count] critical)

</accessibility>

<performance>

## Performance Review

### Rendering

- [ ] No unnecessary re-renders introduced
- [ ] Keys stable and unique in lists
- [ ] Expensive computations memoized appropriately
- [ ] Large components split for targeted updates

### Loading

- [ ] Images optimized / lazy-loaded (if applicable)
- [ ] Code splitting for heavy components (if applicable)
- [ ] Suspense boundaries for async content

### Bundle

- [ ] No large dependencies added unnecessarily
- [ ] Tree-shaking friendly imports

**Performance Issues Found:** [count]

</performance>

<styling>

## Styling Review

### Design System

- [ ] Design tokens used (no hardcoded colors/spacing)
- [ ] Follows existing styling patterns
- [ ] Responsive design considered

### CSS Quality

- [ ] No inline styles (unless dynamic values)
- [ ] Class names follow conventions
- [ ] No conflicting styles

</styling>

<positive_feedback>

## What Was Done Well

- [Specific positive observation and why it's good practice]
- [Another positive observation with pattern reference]
- [Reinforces patterns to continue using]

</positive_feedback>

<approval_status>

## Final Recommendation

**Decision:** [APPROVE | REQUEST CHANGES | REJECT]

**Blocking Issues:** [count]
**Recommended Fixes:** [count]
**Suggestions:** [count]

**Next Steps:**

1. [Action item - e.g., "Fix hook dependency array at line 45"]
2. [Action item]

</approval_status>

</output_format>

---

## Section Guidelines

### Severity Levels

| Level     | Label          | Criteria                                        | Blocks Approval? |
| --------- | -------------- | ----------------------------------------------- | ---------------- |
| Critical  | `Must Fix`     | Bugs, a11y violations, hook errors, type errors | Yes              |
| Important | `Should Fix`   | Performance, patterns, maintainability          | No (recommended) |
| Minor     | `Nice to Have` | Style preferences, minor optimizations          | No               |

### Issue Categories (Frontend-Specific)

| Category          | Examples                                      |
| ----------------- | --------------------------------------------- |
| **Hooks**         | Dependency arrays, conditional calls, cleanup |
| **Accessibility** | ARIA, keyboard nav, semantic HTML, focus      |
| **Performance**   | Re-renders, memoization, keys, bundle size    |
| **Correctness**   | Logic errors, edge cases, type safety         |
| **TypeScript**    | Any types, null handling, interface design    |
| **Patterns**      | Component structure, state location, naming   |
| **Styling**       | Tokens, responsiveness, conventions           |

### Issue Format Requirements

Every issue must include:

1. **Specific file:line location**
2. **Current code snippet** (what's wrong)
3. **Fixed code snippet** (how to fix)
4. **Impact explanation** (why it matters)
5. **Pattern reference** (where to see correct example, if applicable)
