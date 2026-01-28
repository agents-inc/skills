## Output Format

<output_format>
Provide your test output in this structure:

<test_summary>
**Feature:** [What's being tested]
**Test File:** [/path/to/feature.test.ts]
**Test Count:** [X] tests across [Y] categories
**Status:** [All tests failing - ready for implementation]
</test_summary>

<test_suite>

## Test Coverage Summary

| Category       | Count   | Description                    |
| -------------- | ------- | ------------------------------ |
| Happy Path     | [X]     | [Core functionality scenarios] |
| Validation     | [X]     | [Input validation scenarios]   |
| Error Handling | [X]     | [Error/failure scenarios]      |
| Edge Cases     | [X]     | [Boundary conditions]          |
| Integration    | [X]     | [Interaction with other code]  |
| **Total**      | **[X]** |                                |

</test_suite>

<test_code>

## Test File

**File:** `/path/to/feature.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
// ... other imports

describe("[Feature/Component Name]", () => {
  // Setup
  beforeEach(() => {
    // Reset mocks, setup test state
  });

  describe("Happy Path", () => {
    it("should [expected behavior when normal input]", () => {
      // Test implementation
    });

    it("should [another expected behavior]", () => {
      // Test implementation
    });
  });

  describe("Validation", () => {
    it("should [reject/show error when invalid input]", () => {
      // Test implementation
    });
  });

  describe("Error Handling", () => {
    it("should [handle error gracefully]", () => {
      // Test implementation
    });
  });

  describe("Edge Cases", () => {
    it("should [handle boundary condition]", () => {
      // Test implementation
    });
  });
});
```

</test_code>

<coverage_analysis>

## Behaviors Covered

### Happy Path

- [Specific scenario 1 - e.g., "User submits valid form"]
- [Specific scenario 2 - e.g., "API returns success response"]
- [Specific scenario 3]

### Validation

- [Validation scenario 1 - e.g., "Empty email shows error"]
- [Validation scenario 2 - e.g., "Invalid format rejected"]

### Error Handling

- [Error scenario 1 - e.g., "API timeout shows retry option"]
- [Error scenario 2 - e.g., "Network error shows offline message"]

### Edge Cases

- [Edge case 1 - e.g., "Empty list shows empty state"]
- [Edge case 2 - e.g., "Maximum length input accepted"]

### Integration

- [Integration point 1 - e.g., "Updates store on success"]
- [Integration point 2 - e.g., "Triggers analytics event"]

## What's NOT Covered (Intentionally)

- [Excluded scenario] - [Reason: e.g., "Third-party library behavior"]
- [Excluded scenario] - [Reason: e.g., "Covered by E2E tests"]

</coverage_analysis>

<expected_behavior>

## Implementation Contract

**When all tests pass, the implementation should:**

1. [Specific behavior 1 - user-visible outcome]
2. [Specific behavior 2 - user-visible outcome]
3. [Specific behavior 3 - user-visible outcome]

**Implementation patterns to follow:**

| Pattern        | Reference                         |
| -------------- | --------------------------------- |
| [Pattern type] | [/path/to/similar/file.tsx:lines] |
| [Pattern type] | [/path/to/utility.ts:lines]       |

**The implementation must NOT:**

1. [Anti-pattern 1] - [Why it's wrong]
2. [Anti-pattern 2] - [Why it's wrong]
3. [Create new utilities when existing ones available] - See [/path/to/existing/util.ts]

</expected_behavior>

<mocking_setup>

## Mock Configuration

**Mocked Dependencies:**

| Dependency         | Mock Setup                 | Why Mocked           |
| ------------------ | -------------------------- | -------------------- |
| [API client]       | `vi.mock('@/lib/api')`     | Isolate from network |
| [Store]            | `vi.mock('@/stores/user')` | Control state        |
| [External service] | `vi.mock('external-lib')`  | Avoid side effects   |

**Mock Responses:**

```typescript
// Example mock setup
const mockApi = {
  success: { data: { id: 1, name: "Test" } },
  error: { error: { message: "Failed" } },
  timeout: new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 100),
  ),
};
```

</mocking_setup>

<test_status>

## Current Status

**All Tests:** ❌ FAILING (Expected - no implementation exists)

**Verification:**

- [ ] Tests fail for the RIGHT reasons (not syntax errors)
- [ ] Error messages are clear and actionable
- [ ] No false positives (tests don't accidentally pass)

**Ready for:** Developer agent implementation

**Test Commands:**

```bash
# Run these tests
bun test [path/to/feature.test.ts]

# Run with coverage
bun test [path/to/feature.test.ts] --coverage

# Run in watch mode during development
bun test [path/to/feature.test.ts] --watch
```

</test_status>

<developer_guidance>

## For Developer

**Implementation Approach:**

1. Read the test file to understand expected behaviors
2. Implement minimum code to make first test pass
3. Iterate: implement, test, refactor
4. All tests green = implementation complete

**Common Pitfalls:**

- Don't modify tests to make them pass - fix implementation
- If a test seems wrong, discuss before changing
- Ensure cleanup in tests doesn't mask real bugs

**Pattern References:**

- See [/path/to/similar/implementation.tsx] for correct approach
- Reuse utilities from [/path/to/utils/]

</developer_guidance>

</output_format>

---

## Section Guidelines

### Test Quality Requirements

| Requirement                      | Description                                                |
| -------------------------------- | ---------------------------------------------------------- |
| **Minimum 3 tests per function** | Happy path + edge case + error case                        |
| **Behavior-focused names**       | "displays error when email invalid" not "sets error state" |
| **Isolated tests**               | Each test can run independently                            |
| **Clear assertions**             | One concept per test                                       |
| **Comprehensive mocking**        | All external dependencies mocked                           |

### Test Naming Convention

```typescript
// Good - describes user-visible behavior
it("displays error message when email format is invalid", () => {});
it("disables submit button while loading", () => {});
it("calls onSuccess callback after successful submission", () => {});

// Bad - describes implementation details
it("sets isError to true", () => {});
it("updates state", () => {});
it("triggers effect", () => {});
```

### Red-Green-Refactor Contract

1. **RED:** All tests fail initially (this output)
2. **GREEN:** Developer implements until tests pass
3. **REFACTOR:** Developer cleans up while keeping tests green

The tester's job is to provide the RED phase - comprehensive, failing tests that define the contract.
