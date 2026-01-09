# Reviewing Patterns - Examples

> Code examples and comparisons for the reviewing skill.

---

## Progress Tracking Example

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

---

## Retrieval Strategy

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

## Feedback Principles Examples

### Be Specific

```markdown
Bad: "This code needs improvement"
Good: "ProfileEditModal.tsx line 45: This validation logic duplicates
validateEmail() from validation.ts. Use the existing utility instead."
```

**Why:** Vague feedback wastes time. Specific feedback can be acted on immediately.

---

### Explain Why

```markdown
Bad: "Don't use any types"
Good: "Line 23: Replace `any` with `UserProfile` type. This provides type
safety and catches errors at compile time. The type is already
defined in types/user.ts."
```

**Why:** Understanding impact helps authors learn and prevents repeat mistakes.

---

### Suggest Solutions

```markdown
Bad: "This is wrong"
Good: "Line 67: Instead of creating a new error handler, follow the pattern
in SettingsForm.tsx (lines 78-82) which handles this scenario."
```

**Why:** Solutions (especially referencing existing code) make fixes faster and maintain consistency.

---

### Acknowledge Good Work

```markdown
- "Excellent use of the existing validation pattern"
- "Good error handling following our conventions"
- "Tests are comprehensive and well-structured"
- "Clean implementation matching the pattern"
```

**Why:** Positive reinforcement teaches what to repeat. Reviews that only criticize demotivate and miss teaching opportunities.

---

## Review-Specific Anti-Patterns

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

## Anti-Patterns to Avoid (as a Reviewer)

### Reviewing Without Reading Full Files

```markdown
# ANTI-PATTERN: Feedback based on partial reading
"The validation logic seems incomplete"  <- Didn't read the whole file

# Later in file (line 145):
const { validateEmail, validatePhone } = useValidation();  <- Missed this
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
- Add security validation  <- Critical!
- Use more descriptive variable name
- Fix XSS vulnerability  <- Critical!
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
