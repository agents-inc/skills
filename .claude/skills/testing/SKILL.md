# Testing Standards

**Auto-detection:** E2E testing, Playwright, test-driven development (TDD), Vitest, React Testing Library, MSW, test organization

**When to use:**

- Writing E2E tests for user workflows (primary approach with Playwright)
- Unit testing pure utility functions with Vitest
- Setting up MSW for integration tests (current codebase approach)
- Organizing tests in feature-based structure (co-located tests)

**Key patterns covered:**

- E2E tests for user workflows (primary - inverted testing pyramid)
- Unit tests for pure functions only (not components)
- Integration tests with Vitest + React Testing Library + MSW (acceptable, not ideal)
- Feature-based test organization (co-located with code)

---

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


---

# Testing Standards - Examples

---

## Testing Philosophy

**Testing Pyramid Inverted:**

```
        🔺 E2E Tests (Most) - Test real user workflows
        🔸 Integration Tests (Some, acceptable) - Component behavior
        🔹 Unit Tests (Pure functions only) - Utilities, algorithms
```

**Decision Tree:**

```typescript
// Is it a user-facing workflow?
// → YES: Write E2E test ✅

// Is it a pure function with no side effects?
// → YES: Write unit test ✅

// Is it component behavior in isolation?
// → MAYBE: Integration test acceptable but E2E preferred ✅

// Is it a React component?
// → Write E2E test, NOT unit test ✅
```

---

## E2E Testing (PRIMARY)

### ✅ Example: Integration Test with MSW (Current Pattern)

```typescript
// apps/client-react/src/home/__tests__/features.test.tsx
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { defaultFeatures } from "@repo/api-mocks/mocks";
import { serverWorker } from "@repo/api-mocks/serverWorker";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../testSetup/testUtils.local";

describe('Features', () => {
  it("should render empty state", async () => {
    serverWorker.use(getFeaturesHandlers.emptyHandler());
    renderApp();

    await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
  });

  it("should render error state", async () => {
    serverWorker.use(getFeaturesHandlers.errorHandler());
    renderApp();

    await expect(
      screen.findByText(/An error has occurred/i)
    ).resolves.toBeInTheDocument();
  });

  it("should render features", async () => {
    serverWorker.use(getFeaturesHandlers.defaultHandler());
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("feature")).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("feature")).toHaveLength(defaultFeatures.length);
  });

  it("should toggle feature", async () => {
    renderApp();

    const feature = await screen.findByTestId("feature");
    const switchElement = within(feature).getByRole("switch");

    expect(switchElement).toBeChecked();

    userEvent.click(switchElement);
    await waitFor(() => expect(switchElement).not.toBeChecked());
  });
});
```

**Current Pattern Benefits:**
- Tests component with API integration (via MSW)
- Tests all states: loading, empty, error, success
- Centralized mock handlers in `@repo/api-mocks`
- Shared between tests and development

**Limitations:**
- Doesn't test real API
- Mocks can drift from actual API
- Not testing full user workflow

---

### MSW Pattern Example

#### Handler Setup

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "John Doe",
      email: "john@example.com",
    });
  }),
];
```

#### Server Setup

```typescript
// src/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```typescript
// tests/e2e/checkout-flow.spec.ts
import { test, expect } from "@playwright/test";

test("complete checkout flow", async ({ page }) => {
  // Navigate to product
  await page.goto("/products/wireless-headphones");

  // Add to cart
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();

  // Go to cart
  await page.getByRole("link", { name: /cart/i }).click();
  await expect(page).toHaveURL(/\/cart/);

  // Verify product in cart
  await expect(page.getByText("Wireless Headphones")).toBeVisible();
  await expect(page.getByText("$99.99")).toBeVisible();

  // Proceed to checkout
  await page.getByRole("button", { name: /checkout/i }).click();

  // Fill shipping info
  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/full name/i).fill("John Doe");
  await page.getByLabel(/address/i).fill("123 Main St");
  await page.getByLabel(/city/i).fill("San Francisco");
  await page.getByLabel(/zip/i).fill("94102");

  // Fill payment info (test mode)
  await page.getByLabel(/card number/i).fill("4242424242424242");
  await page.getByLabel(/expiry/i).fill("12/25");
  await page.getByLabel(/cvc/i).fill("123");

  // Submit order
  await page.getByRole("button", { name: /place order/i }).click();

  // Verify success
  await expect(page.getByText(/order confirmed/i)).toBeVisible();
  await expect(page).toHaveURL(/\/order\/success/);
});

test("validates empty form fields", async ({ page }) => {
  await page.goto("/checkout");

  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page.getByText(/email is required/i)).toBeVisible();
  await expect(page.getByText(/name is required/i)).toBeVisible();
});

test("handles payment failure", async ({ page }) => {
  await page.goto("/checkout");

  // Fill form with valid data
  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/full name/i).fill("John Doe");
  // ... fill other fields

  // Use test card that will fail
  await page.getByLabel(/card number/i).fill("4000000000000002");
  await page.getByLabel(/expiry/i).fill("12/25");
  await page.getByLabel(/cvc/i).fill("123");

  await page.getByRole("button", { name: /place order/i }).click();

  // Verify error handling
  await expect(page.getByText(/payment failed/i)).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/); // Stays on checkout
});
```

**Why E2E tests are primary:**
- Tests real user experience end-to-end
- Catches integration issues between frontend, backend, database
- Most confidence that features actually work
- Tests against real API, real database (in test environment)
- Catches bugs that unit/integration tests miss

**What makes a good E2E test:**
- ✅ Tests actual user workflow (not individual components)
- ✅ Tests both happy and error paths
- ✅ Uses accessibility queries (getByRole, getByLabel)
- ✅ Waits for expected state (toBeVisible, not just exists)
- ✅ Organized by user journey, not technical layer

### ✅ Example: Error Handling E2E

```typescript
// tests/e2e/login-flow.spec.ts
import { test, expect } from "@playwright/test";

test("shows validation errors", async ({ page }) => {
  await page.goto("/login");

  // Try to submit without filling form
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/email is required/i)).toBeVisible();
  await expect(page.getByText(/password is required/i)).toBeVisible();
});

test("shows error for invalid credentials", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill("wrong@example.com");
  await page.getByLabel(/password/i).fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
});

test("shows error for network failure", async ({ page }) => {
  // Simulate network failure
  await page.route("/api/auth/login", (route) =>
    route.abort("failed")
  );

  await page.goto("/login");

  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/network error/i)).toBeVisible();
});
```

**Key Patterns:**
- Test error states, not just happy paths
- Use `page.route()` to simulate network conditions
- Test validation, error messages, error recovery
- Verify user sees appropriate feedback

---

## Unit Testing (Pure Functions Only)

### ✅ Example: Pure Utility Functions

```typescript
// utils/formatters.ts
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US').format(d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

```typescript
// utils/__tests__/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, slugify } from '../formatters';

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats different currencies', () => {
    expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });
});

describe('formatDate', () => {
  it('formats Date object', () => {
    const date = new Date('2024-03-15');
    expect(formatDate(date)).toBe('3/15/2024');
  });

  it('formats ISO string', () => {
    expect(formatDate('2024-03-15')).toBe('3/15/2024');
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello @World!')).toBe('hello-world');
  });

  it('handles multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });
});
```

**Why unit test pure functions:**
- Fast to run (no setup, no mocking)
- Easy to test edge cases
- Clear input → output
- High confidence in utilities

### ✅ Example: Business Logic Pure Functions

```typescript
// utils/cart.ts
export interface CartItem {
  price: number;
  quantity: number;
  discountPercent?: number;
}

export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const discount = item.discountPercent || 0;
    const itemPrice = item.price * (1 - discount / 100);
    return sum + itemPrice * item.quantity;
  }, 0);
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}

export function calculateTotal(subtotal: number, tax: number, shipping: number): number {
  return subtotal + tax + shipping;
}
```

```typescript
// utils/__tests__/cart.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSubtotal, calculateTax, calculateTotal } from '../cart';

describe('calculateSubtotal', () => {
  it('calculates subtotal for multiple items', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 },
    ];
    expect(calculateSubtotal(items)).toBe(250);
  });

  it('applies discount', () => {
    const items = [
      { price: 100, quantity: 1, discountPercent: 10 },
    ];
    expect(calculateSubtotal(items)).toBe(90);
  });

  it('returns 0 for empty cart', () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

describe('calculateTax', () => {
  it('calculates tax', () => {
    expect(calculateTax(100, 0.08)).toBe(8);
  });

  it('handles 0 tax rate', () => {
    expect(calculateTax(100, 0)).toBe(0);
  });
});

describe('calculateTotal', () => {
  it('adds subtotal, tax, and shipping', () => {
    expect(calculateTotal(100, 8, 10)).toBe(118);
  });
});
```

**Why unit test business logic:**
- Critical to get right (money calculations)
- Many edge cases to test
- Pure functions = easy to test
- Fast feedback during development

### ❌ Example: DON'T Unit Test React Components

```typescript
// ❌ BAD: Unit testing React component
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});

// ✅ GOOD: E2E test for user interaction
test('clicking buy now adds to cart', async ({ page }) => {
  await page.goto('/products/headphones');
  await page.getByRole('button', { name: /buy now/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible();
});
```

**Why not unit test components:**
- E2E tests provide more value
- Tests implementation details, not user behavior
- Fragile (breaks on refactoring)
- Doesn't test real integration

---

## Test Organization (Feature-Based Structure)

### ✅ Example: Feature-Based Test Structure

**Pattern 1: Direct co-location (Recommended)**

```
apps/client-react/src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── LoginForm.test.tsx        # ✅ Test next to component
│   │   │   ├── RegisterForm.tsx
│   │   │   └── RegisterForm.test.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useAuth.test.ts           # ✅ Test next to hook
│   │   └── services/
│   │       ├── auth-service.ts
│   │       └── auth-service.test.ts      # ✅ Test next to service
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
│   └── checkout/
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

**Why direct co-location:**
- Test is always next to the code it tests
- Easy to find (no hunting in `__tests__/`)
- Refactoring moves test with code
- Clear 1:1 relationship

---

**Pattern 2: `__tests__/` subdirectories (Alternative)**

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

**Why `__tests__/` subdirectories:**
- Separates tests from implementation files
- Groups all tests together per directory
- Some teams prefer this organization
- Still co-located within feature

**Choose one pattern and be consistent across the codebase.**

---

### ✅ Example: E2E Test Organization

**E2E tests in `tests/e2e/` organized by user journey:**

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

**Example E2E test:**

```typescript
// tests/e2e/auth/login-flow.spec.ts
import { test, expect } from "@playwright/test";

test("user can login successfully", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText(/welcome back/i)).toBeVisible();
});
```

**Why separate E2E directory:**
- E2E tests span multiple features (user journeys)
- Organized by workflow, not technical structure
- Easy to run E2E suite independently
- Clear separation from unit/integration tests

---

### ✅ Example: Test File Naming Convention

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

### ✅ Example: Vitest Config

```typescript
// packages/vitest-config/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export const baseViteConfig = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [], // override this in consumer
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/node_modules/**",
      ],
    },
  },
});
```

**App-specific config:**

```typescript
// apps/client-react/vitest.config.ts
import { baseViteConfig } from "@repo/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseViteConfig,
  test: {
    ...baseViteConfig.test,
    setupFiles: ["./src/testSetup/setup.ts"],
  },
});
```

---

### ✅ Example: Pre-push Hook

```bash
# .husky/pre-push
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests before push
cd apps/client-react && bun run test --watch=false
```

**Why:**
- Prevents pushing broken code
- Fast feedback on test failures
- Enforces test discipline

---

## Mock Data Patterns (Current Approach)

### ✅ Example: Centralized MSW Handlers

```typescript
// packages/api-mocks/src/handlers/features/getFeatures.ts
import { http, HttpResponse } from "msw";
import { mockVariantsByEndpoint } from "../../mockVariants";
import { defaultFeatures } from "../../mocks/features";

const BASE_URL = "http://localhost:5173/api/v1";
const URL = `${BASE_URL}/features`;

const defaultHandler = () =>
  http.get(URL, async () => {
    switch (mockVariantsByEndpoint.features) {
      case "empty": {
        return emptyResponse();
      }
      case "error": {
        return errorResponse();
      }
      default: {
        return defaultResponse();
      }
    }
  });

const defaultResponse = () =>
  HttpResponse.json({
    features: defaultFeatures,
  });

const emptyResponse = () =>
  HttpResponse.json({
    features: [],
  });

const errorResponse = () =>
  new HttpResponse("Internal Server Error", {
    status: 500,
  });

const emptyHandler = () =>
  http.get(URL, async () => {
    return emptyResponse();
  });

const errorHandler = () =>
  http.get(URL, async () => {
    return errorResponse();
  });

export const getFeaturesHandlers = {
  defaultHandler,
  emptyHandler,
  errorHandler,
};
```

**Benefits:**
- Multiple response variants (default, empty, error)
- Centralized in `@repo/api-mocks`
- Shared between tests and development
- Easy to test different scenarios

**Usage in Tests:**

```typescript
import { serverWorker } from "@repo/api-mocks/serverWorker";
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";

it("should handle empty state", async () => {
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();

  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});
```

---

## Summary

**Testing Strategy:**

| Test Type | When to Use | Framework |
|-----------|-------------|-----------|
| **E2E** | **User workflows (PRIMARY)** | **Playwright** |
| Unit | Pure functions only | Vitest |
| Integration | Acceptable, not primary | Vitest + RTL + MSW (current) |

**Key Principles:**

1. ✅ E2E tests for all critical user flows
2. ✅ Unit tests for pure utility/business logic functions
3. ✅ Integration tests acceptable but not replacement for E2E
4. ❌ Don't unit test React components
5. ❌ Don't chase coverage metrics
6. ✅ Test errors, not just happy paths
7. ✅ Tests should give deployment confidence

