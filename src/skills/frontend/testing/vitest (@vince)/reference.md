# Testing Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [skill.md](skill.md).

---

## Decision Framework

```
Is it a user-facing workflow?
├─ YES → Write E2E test
└─ NO → Is it a pure function with no side effects?
    ├─ YES → Write unit test
    └─ NO → Is it component behavior in isolation?
        ├─ MAYBE → Integration test acceptable but E2E preferred
        └─ NO → Is it a React component?
            └─ YES → Write E2E test, NOT unit test

Test organization decision:
├─ Is it an integration/unit test?
│   └─ YES → Co-locate with code (direct or __tests__ subdirectory)
└─ Is it an E2E test?
    └─ YES → Place in tests/e2e/ organized by user journey

Component documentation decision:
├─ Is it in packages/ui/src/ (design system)?
│   └─ YES → MUST have .stories.tsx file
└─ Is it in apps/*/ (app-specific)?
    └─ NO → Stories not needed
```

**Migration Path for Existing Codebases:**

1. Keep integration tests for component behavior
2. Add E2E tests for user workflows
3. Eventually: E2E tests primary, integration tests secondary

---

## File Organization Reference

### Direct Co-location (Recommended)

```
apps/client-react/src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── LoginForm.test.tsx        # Test next to component
│   │   │   ├── RegisterForm.tsx
│   │   │   └── RegisterForm.test.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useAuth.test.ts           # Test next to hook
│   │   └── services/
│   │       ├── auth-service.ts
│   │       └── auth-service.test.ts      # Test next to service
│   ├── products/
│   │   ├── components/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductCard.test.tsx
│   │   │   ├── ProductList.tsx
│   │   │   └── ProductList.test.tsx
│   │   ├── hooks/
│   │   │   ├── useProducts.ts
│   │   │   └── useProducts.test.ts
│   │   └── utils/
│   │       ├── formatPrice.ts
│   │       └── formatPrice.test.ts
├── components/                             # Shared components
│   ├── ErrorBoundary.tsx
│   ├── ErrorBoundary.test.tsx
│   ├── PageLoader.tsx
│   └── PageLoader.test.tsx
├── hooks/                                  # Global hooks
│   ├── useDebounce.ts
│   ├── useDebounce.test.ts
│   ├── useLocalStorage.ts
│   └── useLocalStorage.test.ts
└── lib/                                    # Utilities
    ├── utils.ts
    ├── utils.test.ts
    ├── cn.ts
    └── cn.test.ts
```

**Why good:** Test is always next to the code it tests making it easy to find, refactoring moves test with code preventing orphaned tests, clear 1:1 relationship between test and implementation, mirrors application structure for consistency

### Alternative: `__tests__/` Subdirectories

```
apps/client-react/src/features/auth/
├── components/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── __tests__/
│       ├── LoginForm.test.tsx
│       └── RegisterForm.test.tsx
├── hooks/
│   ├── useAuth.ts
│   └── __tests__/
│       └── useAuth.test.ts
└── services/
    ├── auth-service.ts
    └── __tests__/
        └── auth-service.test.ts
```

**Why acceptable:** Separates tests from implementation files, groups all tests together per directory, some teams prefer this organization, still co-located within feature

### E2E Test Organization

```
apps/client-react/
├── src/
│   └── features/
├── tests/
│   └── e2e/
│       ├── auth/
│       │   ├── login-flow.spec.ts
│       │   ├── register-flow.spec.ts
│       │   └── password-reset.spec.ts
│       ├── checkout/
│       │   ├── checkout-flow.spec.ts
│       │   ├── payment-errors.spec.ts
│       │   └── guest-checkout.spec.ts
│       ├── products/
│       │   ├── product-search.spec.ts
│       │   ├── product-filters.spec.ts
│       │   └── product-details.spec.ts
│       └── shared/
│           └── navigation.spec.ts
└── playwright.config.ts
```

**Why separate E2E directory:** E2E tests span multiple features (user journeys), organized by workflow not technical structure, easy to run E2E suite independently, clear separation from unit/integration tests

### File Naming Convention

```
LoginForm.tsx           → LoginForm.test.tsx        (integration test)
useAuth.ts              → useAuth.test.ts           (integration test)
formatPrice.ts          → formatPrice.test.ts       (unit test)
auth-service.ts         → auth-service.test.ts      (integration test with MSW)

login-flow.spec.ts      (E2E test)
checkout-flow.spec.ts   (E2E test)
```

**Pattern:**

- `*.test.tsx` / `*.test.ts` for unit and integration tests (Vitest)
- `*.spec.ts` for E2E tests (Playwright)
- Test file mirrors implementation filename

---

## RED FLAGS

**High Priority Issues:**

- **No E2E tests for critical user flows** - Critical user journeys untested means production bugs will reach users before you discover them
- **Unit testing React components** - Wastes time testing implementation details instead of user behavior, breaks easily on refactoring
- **Only testing happy paths** - Users will encounter errors but you haven't verified the app handles them gracefully
- **E2E tests that are flaky** - Flaky tests erode confidence and waste time, fix the test don't skip it
- **Setting coverage requirements without E2E tests** - Coverage metrics don't capture E2E test value, leads to false sense of security

**Medium Priority Issues:**

- **Only having integration tests** - Need E2E for user flows, integration tests alone miss real integration bugs
- **Mocking at module level instead of network level** - Module mocks break on refactoring and don't test serialization/network layer
- **Mocks that don't match real API** - Tests pass but production fails because mocks drifted from reality
- **Complex mocking setup** - Sign you should use E2E tests instead of fighting with mocks
- **Running E2E tests only in CI** - Need to run locally too for fast feedback during development

**Common Mistakes:**

- Testing implementation details instead of user behavior - leads to brittle tests that break on refactoring
- Unit tests for non-pure functions - impossible to test reliably without mocking everything
- No tests for critical user paths - critical flows break in production before you discover them
- Writing tests just to hit coverage numbers - leads to low-value tests that don't catch real bugs
- Design system components without story files - missing documentation and visual regression testing baseline

**Gotchas & Edge Cases:**

- E2E tests don't show up in coverage metrics (that's okay - they provide more value than coverage numbers suggest)
- Playwright's `toBeVisible()` waits for element but `toBeInTheDocument()` doesn't - always use visibility checks to avoid flaky tests
- MSW handlers are global - always `resetHandlers()` after each test to prevent test pollution
- Async updates in React require `waitFor()` or `findBy*` queries - using `getBy*` queries immediately will cause flaky failures
- Test files named `*.test.ts` run with Vitest, `*.spec.ts` run with Playwright - mixing these up causes wrong test runner to execute tests

---

## Anti-Patterns to Avoid

### Unit Testing React Components

```typescript
// ANTI-PATTERN: Unit testing component rendering
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

test("renders button with text", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText("Click me")).toBeInTheDocument();
});
```

**Why it's wrong:** E2E tests provide more value by testing real user interaction, unit tests for components break easily on refactoring, doesn't test real integration with the rest of the app.

**What to do instead:** Write E2E tests that verify user workflows involving the component.

---

### Module-Level Mocking

```typescript
// ANTI-PATTERN: Mocking at module level
import { vi } from "vitest";
vi.mock("../api", () => ({
  getFeatures: vi.fn().mockResolvedValue({ features: [] }),
}));
```

**Why it's wrong:** Module mocks break when import structure changes, defeats purpose of integration testing, doesn't test network layer or serialization.

**What to do instead:** Use MSW to mock at network level.

---

### Testing Implementation Details

```typescript
// ANTI-PATTERN: Testing internal state
test("counter state increments", () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(1);
});
```

**Why it's wrong:** Testing internal state breaks when refactoring, not testing what users see, fragile and coupled to implementation.

**What to do instead:** Test observable user behavior through E2E or integration tests.

---

### Only Happy Path Testing

```typescript
// ANTI-PATTERN: No error state testing
test("user can login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/dashboard");
  // Missing: validation errors, invalid credentials, network errors
});
```

**Why it's wrong:** Users will encounter errors but the app's error handling has no test coverage, production bugs in error states will go undetected.

**What to do instead:** Test error states alongside happy paths - validation, authentication failure, network issues.

---

## Key Testing Patterns

**E2E Test Patterns:**

- Test error states, not just happy paths
- Use `page.route()` to simulate network conditions
- Test validation, error messages, error recovery
- Verify user sees appropriate feedback

**MSW Pattern Benefits:**

- Tests component with API integration (via MSW)
- Tests all states: loading, empty, error, success
- Centralized mock handlers in `@repo/api-mocks`
- Shared between tests and development

**MSW Pattern Limitations:**

- Doesn't test real API (mocks can drift)
- Doesn't test full user workflow
- Requires maintaining mock parity with API

**Ladle Story Requirements:**

- Stories required for: `packages/ui/src/` (primitives, components, patterns, templates)
- Stories NOT needed for: `apps/*/` (app-specific features, pages, layouts)
- One story per variant or use case
- Show all possible states
- Include edge cases (disabled, loading, error states)

**Focus on:** User-facing behavior, business logic, edge cases
