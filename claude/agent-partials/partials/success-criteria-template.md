<success_criteria_template>
## Defining Clear Success Criteria

Every task needs explicit, measurable criteria that define "done." This prevents agents from stopping too early or continuing unnecessarily.

**Template Structure:**

```xml
<success_criteria>
Your implementation must meet these criteria:

**Functional Requirements:**
1. [Specific behavior that must work]
2. [Another specific behavior]

**Technical Requirements:**
3. All existing tests continue to pass
4. New functionality is covered by tests with >80% coverage
5. Code follows existing patterns in [specific files]

**Constraints:**
6. No new dependencies are introduced
7. Changes are limited to [specific files/modules]
8. Performance is equivalent to or better than [baseline]

**After Implementation:**
- Run the test suite and report results
- Verify each criterion is met
- Report any criteria that aren't met and explain why
</success_criteria>
```

## Good vs. Bad Success Criteria

### ❌ Bad (Too Vague)
```
Success Criteria:
- Feature works
- Code is good quality
- Tests pass
```

**Problem:** No specific, measurable targets. What does "works" mean? Which tests?

### ✅ Good (Specific and Measurable)
```
Success Criteria:
1. User can click "Edit Profile" button and see modal with current values
2. Changing name and clicking "Save" updates profile display within 2 seconds
3. Invalid email shows error message "Please enter valid email"
4. Network errors show retry option with "Try Again" button
5. All tests in profile-editor.test.ts pass
6. New tests cover: happy path, validation errors, network errors
7. No modifications to authentication system (auth.py unchanged)
8. Follows form pattern from SettingsForm.tsx (lines 45-89)
```

**Why better:** Each criterion can be verified with a simple yes/no check.

## Verification Process

After completing work, systematically verify:

```xml
<verification_checklist>
For each success criterion:
1. State the criterion
2. Describe how you verified it
3. Provide evidence (test output, behavior observed, file comparison)
4. Mark as ✅ (met) or ❌ (not met)

If any criterion is ❌:
- Explain why it's not met
- Indicate if it's a blocker or acceptable deviation
- Suggest what's needed to meet it
</verification_checklist>
```

**Example Verification:**

```
Criterion 1: User can click "Edit Profile" and see modal with current values
✅ Verified: Tested in browser, modal opens with user's current name, email, bio
Evidence: Screenshot attached, manual test passed

Criterion 5: All tests in profile-editor.test.ts pass
✅ Verified: Ran `npm test profile-editor.test.ts`
Evidence: All 12 tests passing, 0 failures

Criterion 7: No modifications to authentication system
✅ Verified: git diff shows no changes to auth.py or related files
Evidence: `git diff main...feature-branch -- auth.py` returns empty
```

## For Different Agent Types

### Developer Agent
Focus on functional behavior and technical implementation:
- Features work as specified
- Tests pass
- Patterns followed
- No unintended changes

### TDD Agent
Focus on test coverage and quality:
- All specified behaviors have tests
- Edge cases are covered
- Tests fail before implementation (red)
- Tests pass after implementation (green)

### Reviewer Agent
Focus on quality gates:
- Code follows conventions
- No security issues
- Performance is acceptable
- Patterns are consistent

### PM Agent (Auggie)
Focus on completeness and clarity:
- Requirements are clear and actionable
- Patterns are referenced with specific files
- Constraints are explicit
- Success criteria are measurable

</success_criteria_template>

## Integration with Workflow

Success criteria should be:
1. **Defined by PM/Auggie** in the initial specification
2. **Understood by Developer** before starting implementation
3. **Verified by Developer** after implementation
4. **Confirmed by Reviewer** during code review
5. **Tracked in progress.md** as tasks complete
