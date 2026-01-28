## Output Format

<output_format>
Provide your implementation in this structure:

<summary>
**Task:** [Brief description of what was implemented]
**Status:** [Complete | Partial | Blocked]
**Files Changed:** [count] files ([+additions] / [-deletions] lines)
</summary>

<investigation>
**Files Examined:**

| File            | Lines | What Was Learned             |
| --------------- | ----- | ---------------------------- |
| [/path/to/file] | [X-Y] | [Pattern/utility discovered] |

**Patterns Identified:**

- **Component structure:** [How components are organized - from /path:lines]
- **State approach:** [How state is managed - from /path:lines]
- **Styling method:** [How styling is applied - from /path:lines]

**Existing Code Reused:**

- [Utility/component] from [/path] - [Why reused instead of creating new]
  </investigation>

<approach>
**Summary:** [1-2 sentences describing the implementation approach]

**Files:**

| File            | Action             | Purpose               |
| --------------- | ------------------ | --------------------- |
| [/path/to/file] | [created/modified] | [What change and why] |

**Key Decisions:**

- [Decision]: [Rationale based on existing patterns from /path:lines]
  </approach>

<implementation>

### [filename.tsx]

**Location:** `/absolute/path/to/file.tsx`
**Changes:** [Brief description - e.g., "New component" or "Added prop handling"]

```tsx
// [Description of this code block]
[Your implementation code]
```

**Design Notes:**

- [Why this approach was chosen]
- [How it matches existing patterns]

### [filename2.module.scss] (if applicable)

[Same structure...]

</implementation>

<tests>

### [filename.test.tsx]

**Location:** `/absolute/path/to/file.test.tsx`

```tsx
[Test code covering the implementation]
```

**Coverage:**

- [x] Happy path: [scenario]
- [x] Edge cases: [scenarios]
- [x] Error handling: [scenarios]

</tests>

<verification>

## Success Criteria

| Criterion            | Status    | Evidence                                       |
| -------------------- | --------- | ---------------------------------------------- |
| [From specification] | PASS/FAIL | [How verified - test name, manual check, etc.] |

## Universal Quality Checks

**Accessibility:**

- [ ] Semantic HTML elements used (not div soup)
- [ ] Interactive elements keyboard accessible
- [ ] Focus management handled (if applicable)
- [ ] ARIA attributes present where needed
- [ ] Color not sole means of conveying information

**Performance:**

- [ ] No unnecessary re-renders introduced
- [ ] Large lists virtualized (if applicable)
- [ ] Images optimized/lazy-loaded (if applicable)
- [ ] Heavy computations memoized (if applicable)

**Error Handling:**

- [ ] Loading states handled
- [ ] Error states handled with user feedback
- [ ] Empty states handled (if applicable)
- [ ] Form validation feedback (if applicable)

**Code Quality:**

- [ ] No magic numbers (named constants used)
- [ ] No `any` types without justification
- [ ] Follows existing naming conventions
- [ ] Follows existing file/folder structure
- [ ] No hardcoded strings (uses i18n if available)

## Build & Test Status

- [ ] Existing tests pass
- [ ] New tests pass (if added)
- [ ] Build succeeds
- [ ] No type errors
- [ ] No lint errors

</verification>

<notes>

## For Reviewer

- [Areas to focus review on]
- [Decisions that may need discussion]
- [Alternative approaches considered]

## Scope Control

**Added only what was specified:**

- [Feature implemented as requested]

**Did NOT add:**

- [Unrequested feature avoided - why it was tempting but wrong]

## Known Limitations

- [Any scope reductions from spec]
- [Technical debt incurred and why]

## Dependencies

- [New packages added: none / list with justification]
- [Breaking changes: none / description]

</notes>

</output_format>

---

## Section Guidelines

### When to Include Each Section

| Section            | When Required                     |
| ------------------ | --------------------------------- |
| `<summary>`        | Always                            |
| `<investigation>`  | Always - proves research was done |
| `<approach>`       | Always - shows planning           |
| `<implementation>` | Always - the actual code          |
| `<tests>`          | When tests are part of the task   |
| `<verification>`   | Always - proves completion        |
| `<notes>`          | When there's context for reviewer |

### Accessibility Checks (Framework-Agnostic)

These apply regardless of React, Vue, Svelte, or any framework:

- **Semantic HTML:** Use `<button>` not `<div onClick>`, `<nav>` not `<div class="nav">`
- **Keyboard access:** Tab order logical, Enter/Space activate controls
- **Focus visible:** Focus indicators present and visible
- **ARIA:** Only when HTML semantics insufficient

### Performance Checks (Framework-Agnostic)

- **Re-renders:** Don't cause parent re-renders unnecessarily
- **Virtualization:** Lists over ~100 items should virtualize
- **Lazy loading:** Images below fold, heavy components
- **Memoization:** Only for measured bottlenecks

### Error Handling States (Framework-Agnostic)

Every async operation needs:

1. **Loading:** User knows something is happening
2. **Error:** User knows what went wrong + can retry
3. **Empty:** User knows there's no data (not broken)
4. **Success:** User sees the result

### Code Quality (Framework-Agnostic)

- **Constants:** `const MAX_ITEMS = 10` not `items.slice(0, 10)`
- **Types:** Explicit interfaces, no implicit any
- **Naming:** Match codebase conventions exactly
- **Structure:** Match existing file organization
