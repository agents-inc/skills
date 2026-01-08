---
name: Reviewing
description: Code review patterns, feedback principles
---

# Reviewing Patterns

> **Quick Guide:** Read ALL files completely before commenting. Provide specific file:line references for every issue. Distinguish severity (Must Fix vs Should Fix vs Nice to Have). Explain WHY, not just WHAT. Suggest solutions following existing patterns. Acknowledge good work - positive reinforcement teaches what to repeat.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Any Review

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST read ALL files mentioned in the PR/spec completely before providing feedback)**

**(You MUST provide specific file:line references for every issue found)**

**(You MUST distinguish severity: Must Fix vs Should Fix vs Nice to Have)**

**(You MUST explain WHY something is an issue, not just WHAT is wrong)**

**(You MUST verify success criteria are met with evidence before approving)**

**(You MUST acknowledge what was done well - not just issues)**

</critical_requirements>

---

**Auto-detection:** code review, PR review, pull request, review code, check implementation, verify changes

**When to use:**

- Reviewing any code changes (PRs, implementations, specs)
- Providing structured feedback on code quality
- Making approval/rejection decisions
- Ensuring codebase standards are maintained

**When NOT to use:**

- When implementing code (use developer skills instead)
- For automated linting/type-checking (use tooling, CI/CD)
- For security audits (use security/security skill for deep security analysis)
- For high-level architecture decisions (use planning tools instead)

**Key patterns covered:**

- Self-correction checkpoints for reviewers
- Post-action reflection after reviews
- Progress tracking for multi-file reviews
- Retrieval strategy for reviewing unfamiliar code
- Feedback principles (specific, explain why, suggest solutions, severity, acknowledge good)
- Decision framework for approval/rejection
- Review-specific anti-patterns (scope creep, refactoring, not using utilities)

---

<philosophy>

## Philosophy

Code review is about **improving code quality while teaching good patterns**. Every piece of feedback should help the author become a better developer. Be direct but constructive.

**When reviewing code:**

- Always read the full context before commenting
- Base feedback on facts, not assumptions
- Distinguish blocking issues from improvements
- Teach through your feedback - explain the "why"
- Recognize good work to reinforce patterns

**When NOT to be harsh:**

- Don't nitpick style when code is functionally correct
- Don't request changes for personal preference
- Don't block PRs for minor issues that can be follow-ups
- Don't forget that the author worked hard on this

**Core principles:**

- **Evidence-based**: Base all feedback on what you actually read
- **Actionable**: Every issue should have a clear path to resolution
- **Proportional**: Match feedback severity to actual impact
- **Educational**: Help authors understand WHY, not just WHAT
- **Balanced**: Acknowledge good work alongside issues

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Self-Correction Triggers

These checkpoints prevent review drift and ensure thorough analysis. Check yourself throughout the review process.

**Self-Correction Checkpoints:**

| Trigger                                           | Correction                                 |
| ------------------------------------------------- | ------------------------------------------ |
| Providing feedback without reading full file      | Stop. Read the complete file first.        |
| Saying "this needs improvement" without specifics | Stop. Provide file:line references.        |
| Approving without checking success criteria       | Stop. Verify each criterion with evidence. |
| Focusing only on issues                           | Stop. Add positive feedback.               |
| Making assumptions about code behavior            | Stop. Read the actual implementation.      |
| Flagging issues without explaining WHY            | Stop. Add rationale for each issue.        |
| Reviewing code outside your domain                | Stop. Defer to specialist reviewer.        |

**Why this matters:** Self-correction prevents incomplete reviews, missed issues, and unfair feedback. Checking yourself throughout the review leads to higher quality, more actionable feedback.

---

### Pattern 2: Post-Action Reflection

After completing your review, verify quality before finalizing.

**Reflection Questions:**

1. Did I read all relevant files completely before commenting?
2. Did I check against all success criteria in the spec?
3. Are my issues specific (file:line) and actionable?
4. Did I distinguish severity correctly (blocker vs improvement)?
5. Did I acknowledge what was done well?
6. Should any part go to a specialist reviewer?
7. Is my recommendation (approve/request changes) justified?

**Only finalize review when you can answer "yes" to all applicable questions.**

**Why this matters:** Reflection catches oversights before they affect the author. A review that misses context or lacks specificity wastes everyone's time.

---

### Pattern 3: Progress Tracking

For multi-file reviews, track your progress to maintain orientation.

**Track These Elements:**

1. **Files Examined:** [list of files read completely]
2. **Success Criteria Status:** [checked/unchecked for each criterion]
3. **Issues Found:** [categorized by severity]
4. **Positive Patterns Noted:** [what was done well]
5. **Deferred Items:** [what needs specialist review]

**Example:**

```
Files Examined:
- [x] src/components/user-profile.tsx (complete)
- [x] src/hooks/use-user.ts (complete)
- [ ] src/api/users.ts (deferred to backend-reviewer)

Success Criteria:
- [x] User profile displays correctly
- [x] Edit form validates input
- [ ] Tests pass (need to verify)

Issues Found:
- 1x Must Fix (missing error handling)
- 2x Should Fix (performance optimizations)

Positive Patterns:
- Clean component structure
- Good TypeScript usage
```

**Why this matters:** Multi-file reviews are complex. Tracking progress prevents missed files, forgotten criteria, and lost context.

---

### Pattern 4: Retrieval Strategy

When reviewing unfamiliar code, use this systematic approach.

**Just-in-Time Loading:**

1. **Glob** - Find files by pattern
   - `**/*.ts` for TypeScript files
   - `**/*.config.*` for config files
   - `**/components/**` for components

2. **Grep** - Search for patterns
   - Function definitions
   - Import statements
   - Error handling patterns

3. **Read** - Examine full content
   - Always read complete files before commenting
   - Never assume based on file names

**Load patterns just-in-time** - Don't read everything upfront; load when relevant.

**Why this matters:** Efficient retrieval preserves context window and prevents information overload. Load what you need when you need it.

---

### Pattern 5: Feedback Principles

All feedback should follow these principles for maximum effectiveness.

#### Be Specific

Every issue needs a precise location.

```markdown
Bad: "This code needs improvement"
Good: "ProfileEditModal.tsx line 45: This validation logic duplicates
validateEmail() from validation.ts. Use the existing utility instead."
```

**Why:** Vague feedback wastes time. Specific feedback can be acted on immediately.

#### Explain Why

Don't just say what's wrong - explain the impact.

```markdown
Bad: "Don't use any types"
Good: "Line 23: Replace `any` with `UserProfile` type. This provides type
safety and catches errors at compile time. The type is already
defined in types/user.ts."
```

**Why:** Understanding impact helps authors learn and prevents repeat mistakes.

#### Suggest Solutions

Point to existing patterns when possible.

```markdown
Bad: "This is wrong"
Good: "Line 67: Instead of creating a new error handler, follow the pattern
in SettingsForm.tsx (lines 78-82) which handles this scenario."
```

**Why:** Solutions (especially referencing existing code) make fixes faster and maintain consistency.

#### Distinguish Severity

Use clear markers to communicate priority.

| Marker           | Category                              | Examples                                                                                                |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Must Fix**     | Blockers - cannot approve until fixed | Security vulnerabilities, breaks functionality, missing required criteria, major convention violations  |
| **Should Fix**   | Improvements - strongly recommended   | Performance optimizations, minor convention deviations, missing edge case handling, code simplification |
| **Nice to Have** | Suggestions - optional enhancements   | Further refactoring, additional tests, documentation, future enhancements                               |

**Why:** Severity helps authors prioritize and prevents blocking PRs for minor issues.

#### Acknowledge Good Work

Always include positive feedback.

```markdown
- "Excellent use of the existing validation pattern"
- "Good error handling following our conventions"
- "Tests are comprehensive and well-structured"
- "Clean implementation matching the pattern"
```

**Why:** Positive reinforcement teaches what to repeat. Reviews that only criticize demotivate and miss teaching opportunities.

---

### Pattern 6: Decision Framework for Approval

Use consistent criteria for approval decisions.

**APPROVE when:**

- All success criteria are met with evidence
- Code follows existing conventions
- No critical security or performance issues
- Tests are adequate and passing
- Changes are within scope
- Quality meets codebase standards

**REQUEST CHANGES when:**

- Success criteria not fully met
- Convention violations exist
- Quality issues need addressing
- Minor security concerns
- Test coverage inadequate

**MAJOR REVISIONS NEEDED when:**

- Critical security vulnerabilities
- Breaks existing functionality
- Major convention violations
- Significantly out of scope
- Fundamental approach issues

**When uncertain:** Request changes with specific questions rather than blocking indefinitely.

**Why this matters:** Consistent approval criteria create predictable, fair reviews. Authors know what to expect.

---

### Pattern 7: Review-Specific Anti-Patterns

Watch for these common issues in reviewed code.

#### Scope Creep

Code adds features not in the specification.

```typescript
// Spec requested: Email validation, Name/bio editing, Save functionality

// FLAGGED - Added unrequested features:
- Phone validation (not in spec)
- Avatar upload (not in spec)
- Password change (not in spec)
```

**Flag when:** Features not in original specification are implemented.

#### Refactoring Existing Code

Working code was changed without being in scope.

```diff
- // Existing working code was changed
+ // "Improved" version that wasn't requested
```

**Flag when:** Changes beyond specified scope, "improvements" not requested.

#### Not Using Existing Utilities

New code duplicates functionality that already exists.

```typescript
// FLAGGED - Reinvented the wheel
function validateEmail(email: string) {
  // Custom regex validation
}

// Should use existing utility
import { validateEmail } from "@/lib/validation";
```

**Flag when:** Code duplicates existing functionality instead of reusing.

#### Modifying Out of Scope Files

Files changed that weren't mentioned in specification.

```typescript
// FLAGGED - Changed file not mentioned in spec
// auth.py was modified
// Spec said: "Do not modify authentication system"
```

**Flag when:** Files changed that weren't mentioned in specification.

#### Missing Error Handling

API calls and async operations lack error handling.

```typescript
// FLAGGED - No error handling
const data = await apiClient.put("/users/123", formData);

// Should include error handling
try {
  const data = await apiClient.put("/users/123", formData);
  showSuccessMessage("Profile updated");
} catch (error) {
  showErrorMessage(error.message);
}
```

**Flag when:** API calls, async operations lack error handling.

</patterns>

---

<decision_framework>

## Decision Framework

```
Is this a blocking issue?
├─ YES → Does it affect security, functionality, or required criteria?
│   ├─ Security vulnerability → MUST FIX
│   ├─ Breaks existing functionality → MUST FIX
│   ├─ Missing required success criteria → MUST FIX
│   └─ Major convention violation → MUST FIX
└─ NO → Could this code be improved?
    ├─ YES → Is it worth the author's time?
    │   ├─ Performance impact → SHOULD FIX
    │   ├─ Maintainability impact → SHOULD FIX
    │   ├─ Minor convention deviation → SHOULD FIX
    │   └─ Missing edge case → SHOULD FIX
    └─ NO → Is it a nice enhancement?
        ├─ Better documentation → NICE TO HAVE
        ├─ Additional tests → NICE TO HAVE
        ├─ Future improvement → NICE TO HAVE
        └─ Style preference → DON'T MENTION
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Providing feedback without reading the full file
- No file:line references in issue descriptions
- Approving without verifying success criteria
- Only negative feedback, no acknowledgment of good work
- Reviewing code outside your domain expertise
- Blocking PRs for personal style preferences

**Medium Priority Issues:**

- Missing severity distinctions (all issues look equal)
- No suggested solutions for identified issues
- Vague feedback ("this needs improvement")
- Not checking for existing patterns before flagging "new code"
- Incomplete review (not all files examined)

**Common Mistakes:**

- Assuming code behavior without reading implementation
- Flagging valid patterns as "wrong" because unfamiliar
- Missing obvious issues while focusing on minor ones
- Not acknowledging improvement over previous versions
- Providing contradictory feedback (fix X, but also don't change Y)

**Gotchas & Edge Cases:**

- Some "duplication" is intentional for clarity - verify before flagging
- Performance optimizations may not be needed for low-traffic code
- "Convention violations" may be new patterns not yet documented
- Test coverage percentages don't guarantee quality tests
- "Out of scope" changes may be necessary dependencies

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Reviewing Without Reading Full Files

```markdown
# ❌ ANTI-PATTERN: Feedback based on partial reading
"The validation logic seems incomplete"  ← Didn't read the whole file

# Later in file (line 145):
const { validateEmail, validatePhone } = useValidation();  ← Missed this
```

**Why it's wrong:** Incomplete context leads to incorrect feedback, wastes author time addressing non-issues.

**What to do instead:** Read ALL files completely before providing any feedback.

---

### Vague Feedback Without References

```markdown
# ❌ ANTI-PATTERN: No specific location
"This code needs improvement"
"There are some issues with the types"
"The error handling could be better"
```

**Why it's wrong:** Author doesn't know what to fix, feedback is not actionable.

**What to do instead:** Provide specific file:line references for every issue.

---

### All Issues Same Severity

```markdown
# ❌ ANTI-PATTERN: Everything treated as blocker
- Fix the typo in comment
- Add security validation  ← Critical!
- Use more descriptive variable name
- Fix XSS vulnerability  ← Critical!
```

**Why it's wrong:** Critical issues get lost among trivial ones, PR blocked by minor issues.

**What to do instead:** Clearly distinguish Must Fix vs Should Fix vs Nice to Have.

---

### Only Negative Feedback

```markdown
# ❌ ANTI-PATTERN: No acknowledgment of good work
- Fix line 23
- Fix line 45
- Fix line 67
- LGTM (after author fixes everything)
```

**Why it's wrong:** Demotivates author, misses teaching opportunity about what to repeat.

**What to do instead:** Acknowledge what was done well alongside issues.

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST read ALL files mentioned in the PR/spec completely before providing feedback)**

**(You MUST provide specific file:line references for every issue found)**

**(You MUST distinguish severity: Must Fix vs Should Fix vs Nice to Have)**

**(You MUST explain WHY something is an issue, not just WHAT is wrong)**

**(You MUST verify success criteria are met with evidence before approving)**

**(You MUST acknowledge what was done well - not just issues)**

**Failure to follow these rules will produce low-quality reviews that waste author time and miss important issues.**

</critical_reminders>
