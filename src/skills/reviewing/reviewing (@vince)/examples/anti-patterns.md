# Reviewing Patterns - Anti-Patterns

[Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [feedback-patterns.md](feedback-patterns.md) | [reference.md](../reference.md)

> Common issues to flag in reviewed code, and reviewer behaviors to avoid.

---

## Code Anti-Patterns (What to Flag)

Watch for these common issues in reviewed code.

### Scope Creep

Code adds features not in the specification.

```typescript
// Spec requested: Email validation, Name/bio editing, Save functionality

// FLAGGED - Added unrequested features:
- Phone validation (not in spec)
- Avatar upload (not in spec)
- Password change (not in spec)
```

**Flag when:** Features not in original specification are implemented.

---

### Refactoring Existing Code

Working code was changed without being in scope.

```diff
- // Existing working code was changed
+ // "Improved" version that wasn't requested
```

**Flag when:** Changes beyond specified scope, "improvements" not requested.

---

### Not Using Existing Utilities

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

---

### Modifying Out of Scope Files

Files changed that weren't mentioned in specification.

```typescript
// FLAGGED - Changed file not mentioned in spec
// auth.py was modified
// Spec said: "Do not modify authentication system"
```

**Flag when:** Files changed that weren't mentioned in specification.

---

### Missing Error Handling

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

---

## Reviewer Anti-Patterns (What to Avoid)

### Reviewing Without Reading Full Files

```markdown
# ANTI-PATTERN: Feedback based on partial reading

"The validation logic seems incomplete" <- Didn't read the whole file

# Later in file (line 145):

const { validateEmail, validatePhone } = useValidation(); <- Missed this
```

**Why it's wrong:** Incomplete context leads to incorrect feedback, wastes author time addressing non-issues.

**What to do instead:** Read ALL files completely before providing any feedback.

---

### Vague Feedback Without References

```markdown
# ANTI-PATTERN: No specific location

"This code needs improvement"
"There are some issues with the types"
"The error handling could be better"
```

**Why it's wrong:** Author doesn't know what to fix, feedback is not actionable.

**What to do instead:** Provide specific file:line references for every issue.

---

### All Issues Same Severity

```markdown
# ANTI-PATTERN: Everything treated as blocker

- Fix the typo in comment
- Add security validation <- Critical!
- Use more descriptive variable name
- Fix XSS vulnerability <- Critical!
```

**Why it's wrong:** Critical issues get lost among trivial ones, PR blocked by minor issues.

**What to do instead:** Clearly distinguish Must Fix vs Should Fix vs Nice to Have.

---

### Only Negative Feedback

```markdown
# ANTI-PATTERN: No acknowledgment of good work

- Fix line 23
- Fix line 45
- Fix line 67
- LGTM (after author fixes everything)
```

**Why it's wrong:** Demotivates author, misses teaching opportunity about what to repeat.

**What to do instead:** Acknowledge what was done well alongside issues.
