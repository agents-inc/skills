# Testing Standards

> **Quick Guide:** E2E for user flows (Playwright). Unit for pure functions (Vitest). Integration tests okay but not primary (Vitest + RTL + MSW). Current app uses MSW integration tests.

---

## Testing Philosophy

**PRIMARY: E2E tests for most scenarios**

E2E tests verify actual user workflows through the entire stack. They test real user experience, catch integration issues, and provide highest confidence.

**SECONDARY: Unit tests for pure functions**

Pure utilities, business logic, algorithms, data transformations, edge cases.

**Integration tests acceptable but not primary**

React Testing Library + MSW useful for component behavior when E2E too slow. Don't replace E2E for user workflows.

**Testing Pyramid Inverted:**

```
        🔺 E2E Tests (Most)
        🔸 Integration Tests (Some, acceptable)
        🔹 Unit Tests (Pure functions only)
```

---

## E2E Testing (PRIMARY)

**Framework:** Playwright (recommended) or Cypress

**What to test end-to-end:**

- ✅ **ALL critical user flows** (login, checkout, data entry)
- ✅ **ALL user-facing features** (forms, navigation, interactions)
- ✅ Multi-step workflows (signup → verify email → complete profile)
- ✅ Error states users will encounter
- ✅ Happy paths AND error paths
- ✅ Cross-browser compatibility (Playwright makes this easy)

**What NOT to test end-to-end:**

- ❌ Pure utility functions (use unit tests)
- ❌ Individual component variants in isolation (not user-facing)

**E2E Test Organization:**

- `tests/e2e/` directory at root or in each app
- Test files: `*.spec.ts` or `*.e2e.ts`
- Group by user journey, not by component

**RED FLAGS:**

- ❌ No E2E tests for critical user flows
- ❌ Only testing happy paths (test errors too!)
- ❌ E2E tests that are flaky (fix the test, don't skip it)
- ❌ Running E2E tests only in CI (run locally too)

---

## Unit Testing (Pure Functions Only)

**Framework:** Vitest (fast, Vite-native)

**ONLY test pure functions:**

- ✅ Utility functions (formatDate, calculateTotal, parseQuery)
- ✅ Business logic functions (validateEmail, calculateDiscount)
- ✅ Data transformations (mapApiResponse, filterItems)
- ✅ Pure algorithms (sort, search, filter)

**DO NOT unit test:**

- ❌ React components (use E2E tests instead)
- ❌ Hooks that interact with external state
- ❌ Functions with side effects (API calls, localStorage)
- ❌ UI behavior (buttons, forms - use E2E)

**Pattern:**

```typescript
// utils/calculateTotal.ts
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// utils/__tests__/calculateTotal.test.ts
import { describe, it, expect } from "vitest";
import { calculateTotal } from "../calculateTotal";

describe("calculateTotal", () => {
  it("calculates total for multiple items", () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3 },
    ];
    expect(calculateTotal(items)).toBe(35);
  });

  it("returns 0 for empty array", () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

**RED FLAGS:**

- ❌ Unit testing React components (use E2E instead)
- ❌ Complex mocking setup (sign you should use E2E)
- ❌ Testing implementation details
- ❌ Unit tests for non-pure functions

---

## What NOT to Test

**Don't waste time testing things that don't add value:**

**❌ Third-party libraries**

```typescript
// ❌ BAD: Testing React Query behavior
test('useQuery returns data', () => {
  const { result } = renderHook(() => useQuery(['key'], fetchFn));
  // Testing React Query, not your code
});

// ✅ GOOD: Test YOUR behavior
test('displays user data when loaded', async () => {
  render(<UserProfile />);
  expect(await screen.findByText('John Doe')).toBeInTheDocument();
});
```

**❌ TypeScript guarantees**

```typescript
// ❌ BAD: TypeScript already prevents this
test('Button requires children prop', () => {
  // @ts-expect-error
  render(<Button />);
});
```

**❌ Implementation details**

```typescript
// ❌ BAD: Testing internal state
test('counter state increments', () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(1); // Internal detail
});

// ✅ GOOD: Test observable behavior
test('displays incremented count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**Focus on:** User-facing behavior, business logic, edge cases

---

## Integration Testing (Current Approach)

**Current codebase uses:** Vitest + React Testing Library + MSW

**This approach is acceptable but not ideal:**

- ✅ Better than no tests
- ✅ Faster than E2E tests
- ✅ Good for testing component behavior with mocked APIs
- ❌ Doesn't test real API integration
- ❌ Doesn't test full user workflows
- ❌ Requires maintaining MSW mocks

**When integration tests make sense:**

- Component behavior in isolation (form validation, UI state)
- When E2E tests are too slow for rapid feedback
- Testing edge cases that are hard to reproduce in E2E
- Development workflow (faster than spinning up full stack)

**Current Pattern:**

- Tests in `__tests__/` directories co-located with code
- MSW for API mocking at network level
- Centralized mock data in `@repo/api-mocks`
- Test all states: loading, empty, error, success

**Migration Path:**

1. Keep integration tests for component behavior
2. Add E2E tests for user workflows
3. Eventually: E2E tests primary, integration tests secondary

**RED FLAGS:**

- ❌ Only having integration tests (need E2E for user flows)
- ❌ Mocking at module level instead of network level
- ❌ Mocks that don't match real API
- ❌ No tests for critical user paths

---

## Test Organization (Feature-Based Structure)

**MANDATORY: Follow feature-based folder pattern from core patterns package-architecture**

**Structure:** Co-located tests within feature directories

```
apps/client-react/src/
├── app/                        # Next.js App Router (routes)
│   ├── (auth)/
│   │   └── login/
│   └── dashboard/
├── features/                   # Feature slices with co-located tests
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── LoginForm.test.tsx       # Co-located with component
│   │   │   └── RegisterForm/
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useAuth.test.ts
│   │   ├── services/
│   │   │   ├── auth-service.ts
│   │   │   └── auth-service.test.ts
│   │   └── types/
│   │       └── auth.types.ts
│   ├── products/
│   │   ├── components/
│   │   │   └── ProductCard/
│   │   │       ├── ProductCard.tsx
│   │   │       └── ProductCard.test.tsx
│   │   ├── hooks/
│   │   └── services/
│   └── checkout/
├── components/                 # Shared components with tests
│   ├── ErrorBoundary/
│   │   ├── ErrorBoundary.tsx
│   │   └── ErrorBoundary.test.tsx
│   └── PageLoader/
├── hooks/                      # Global hooks with tests
│   ├── useDebounce.ts
│   └── useDebounce.test.ts
├── lib/                        # Utilities with tests
│   ├── utils.ts
│   └── utils.test.ts
└── types/
```

**E2E Tests:** Top-level `tests/e2e/` directory organized by user journey

```
apps/client-react/
├── src/
├── tests/
│   └── e2e/
│       ├── auth/
│       │   ├── login-flow.spec.ts
│       │   └── register-flow.spec.ts
│       ├── checkout/
│       │   └── checkout-flow.spec.ts
│       └── products/
│           └── product-search.spec.ts
└── playwright.config.ts
```

**Naming:** `*.test.tsx` for integration/unit tests, `*.spec.ts` for E2E tests

**Framework:**

- Vitest + React Testing Library for integration/unit tests
- Playwright for E2E tests (recommended)

**Shared Config:** `@repo/vitest-config` for base configuration

**Pre-push Hook:** Tests run automatically before git push

```bash
# .husky/pre-push
cd apps/client-react && bun run test --watch=false
```

**Rationale:**

- Feature-based organization mirrors application structure
- Co-location makes tests easy to find and maintain
- Clear separation between integration tests (in features) and E2E tests (in tests/e2e/)
- Features never import each other - same applies to tests
- Tests for shared code (components/, hooks/, lib/) follow same co-location pattern

---

## Mock Data Patterns (Current Approach)

**CURRENT: Centralized MSW mocks in `@repo/api-mocks`**

**Pattern:**

- Mock handlers in `packages/api-mocks/src/handlers/`
- Mock data in `packages/api-mocks/src/mocks/`
- Shared between tests and development
- Multiple response variants (default, empty, error)

**Example Structure:**

```
packages/api-mocks/src/
├── handlers/
│   └── features/
│       └── getFeatures.ts      # MSW handlers with variants
├── mocks/
│   └── features.ts             # Mock data
├── serverWorker.ts             # Node.js MSW server
└── browserWorker.ts            # Browser MSW worker
```

**Benefits:**

- Centralized mock data (single source of truth)
- Shared between apps and tests
- Easy to test different scenarios (empty, error, success)
- Synced with OpenAPI schema

**Limitations:**

- Mocks can drift from real API
- Need to maintain mock data
- Doesn't catch real API issues

**Future: Replace with E2E tests against real APIs in test environment**

---

## Coverage Requirements

**Philosophy: Coverage is NOT a goal**

- E2E tests don't show up in coverage metrics (that's okay!)
- 100% coverage with bad tests is worthless
- Focus on testing critical user flows, not hitting coverage numbers

**If you must have coverage requirements:**

- Critical utility functions: 100% (they're pure, easy to test)
- Overall codebase: Don't set arbitrary thresholds
- Use coverage to find gaps, not as a goal

**RED FLAGS:**

- ❌ Setting coverage requirements without E2E tests
- ❌ Writing tests just to hit coverage numbers
- ❌ 100% coverage requirement (leads to bad tests)
- ❌ Using coverage as primary quality metric

**Better metrics:**

- ✅ Do all critical user flows have E2E tests?
- ✅ Can we deploy with confidence?
- ✅ Do tests catch real bugs?
- ✅ Are tests reliable (not flaky)?
