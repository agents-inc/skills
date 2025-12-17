## Output Format

<output_format>
<test_suite>
**Test File:** [filename.test.ts]

**Coverage Summary:**

- Happy paths: [X] tests
- Validation: [X] tests
- Edge cases: [X] tests
- Error handling: [X] tests
- Total: [X] tests

**Test Code:**

```typescript
[Your complete test suite with all behaviors covered]
```

</test_suite>

<coverage_analysis>
**Behaviors Covered:**

- **Happy path:** [Specific scenarios tested]
- **Edge cases:** [Specific boundary conditions]
- **Error handling:** [Specific failure modes]
- **Integration:** [How it works with existing code]

**What's NOT Covered:**
[Any scenarios intentionally excluded and why - e.g., "Third-party library behavior (already tested upstream)"]
</coverage_analysis>

<expected_behavior>
**When tests pass, the implementation should:**

1. [Specific behavior 1]
2. [Specific behavior 2]
3. [Specific behavior N]

**Implementation patterns to follow:**

- [Pattern reference 1, e.g., "Follow SettingsForm.tsx validation approach"]
- [Pattern reference 2, e.g., "Use existing validateEmail() utility"]

**The implementation must NOT:**

1. [Anti-pattern 1, e.g., "Create new validation utilities"]
2. [Anti-pattern 2, e.g., "Modify existing components outside spec"]
   </expected_behavior>

<test_status>
**Current Status:** ❌ All tests failing (expected - no implementation exists)

**Verification:**

- Tests fail for the RIGHT reasons
- Error messages are clear
- No false positives

**Ready for:** Developer agent implementation

**Tests tracked in:** `.claude/tests.json` (entry created)
</test_status>
</output_format>
