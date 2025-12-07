# Testing Standards

> **Quick Guide:** E2E for user flows (Playwright). Unit for pure functions (Vitest). Integration tests okay but not primary (Vitest + RTL + MSW). Current app uses MSW integration tests.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST write E2E tests for ALL critical user workflows - NOT unit tests for React components)**

**(You MUST use Playwright for E2E tests and organize by user journey - NOT by component)**

**(You MUST only write unit tests for pure functions - NOT for components, hooks, or side effects)**

**(You MUST co-locate tests with code in feature-based structure - NOT in separate test directories)**

**(You MUST use MSW at network level for API mocking - NOT module-level mocks)**

</critical_requirements>

---

**Auto-detection:** E2E testing, Playwright, test-driven development (Tester), Vitest, React Testing Library, MSW, test organization

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

<philosophy>

## Testing Philosophy

**PRIMARY: E2E tests for most scenarios**

E2E tests verify actual user workflows through the entire stack. They test real user experience, catch integration issues, and provide highest confidence.

**SECONDARY: Unit tests for pure functions**

Pure utilities, business logic, algorithms, data transformations, edge cases.

**Integration tests acceptable but not primary**

React Testing Library + MSW useful for component behavior when E2E too slow. Don't replace E2E for user workflows.

**Testing Pyramid Inverted:**

```
        🔺 E2E Tests (Most) - Test real user workflows
        🔸 Integration Tests (Some, acceptable) - Component behavior
        🔹 Unit Tests (Pure functions only) - Utilities, algorithms
```

**When to use E2E tests:**

- All critical user-facing workflows (login, checkout, data entry)
- Multi-step user journeys (signup → verify email → complete profile)
- Cross-browser compatibility needs
- Testing real integration with backend APIs

**When NOT to use E2E tests:**

- Pure utility functions (use unit tests instead)
- Individual component variants in isolation (use Ladle stories for documentation)

**When to use unit tests:**

- Pure functions with clear input → output
- Business logic calculations (pricing, taxes, discounts)
- Data transformations and formatters
- Edge cases and boundary conditions

**When NOT to use unit tests:**

- React components (use E2E tests)
- Hooks with side effects (use E2E tests or integration tests)
- API calls or external integrations (use E2E tests)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: E2E Testing with Playwright (PRIMARY)

E2E tests verify complete user workflows through the entire application stack, providing the highest confidence that features work correctly.

#### Framework Setup

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

#### Test Organization

- `tests/e2e/` directory at root or in each app
- Test files: `*.spec.ts` or `*.e2e.ts`
- Group by user journey, not by component

#### Complete Checkout Flow

```typescript
// tests/e2e/checkout-flow.spec.ts
import { test, expect } from "@playwright/test";

const CARD_SUCCESS = "4242424242424242";
const CARD_DECLINED = "4000000000000002";
const EXPIRY_DATE = "12/25";
const CVC_CODE = "123";

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
  await page.getByLabel(/card number/i).fill(CARD_SUCCESS);
  await page.getByLabel(/expiry/i).fill(EXPIRY_DATE);
  await page.getByLabel(/cvc/i).fill(CVC_CODE);

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
  await page.getByLabel(/card number/i).fill(CARD_DECLINED);
  await page.getByLabel(/expiry/i).fill(EXPIRY_DATE);
  await page.getByLabel(/cvc/i).fill(CVC_CODE);

  await page.getByRole("button", { name: /place order/i }).click();

  // Verify error handling
  await expect(page.getByText(/payment failed/i)).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/); // Stays on checkout
});
```

**Why good:** Tests complete user workflow end-to-end covering happy path and error scenarios, uses named constants for test data preventing magic values, uses accessibility queries (getByRole, getByLabel) ensuring keyboard navigability, waits for expected state (toBeVisible) preventing flaky tests from race conditions

**When to use:** All critical user-facing workflows that span multiple components and require backend integration.

**When not to use:** Testing pure utility functions or component variants in isolation (use unit tests or Ladle stories instead).

---

### Pattern 2: Error Handling in E2E Tests

Always test error states alongside happy paths. Users will encounter errors, so verify the application handles them gracefully.

#### Validation Errors

```typescript
// ✅ Good Example - Tests validation errors
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
  await page.route("/api/auth/login", (route) => route.abort("failed"));

  await page.goto("/login");

  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/network error/i)).toBeVisible();
});
```

**Why good:** Covers all error scenarios users will encounter (validation, authentication failure, network issues), uses page.route() to simulate network conditions enabling reliable error state testing, verifies user sees appropriate error feedback ensuring good UX

```typescript
// ❌ Bad Example - Only tests happy path
test("user can login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/dashboard");
  // Missing: validation errors, invalid credentials, network errors
});
```

**Why bad:** Only testing happy path means real-world error scenarios are untested, users will encounter errors but the app's error handling has no test coverage, production bugs in error states will go undetected until users report them

#### Key Patterns

- Test error states, not just happy paths
- Use `page.route()` to simulate network conditions
- Test validation, error messages, error recovery
- Verify user sees appropriate feedback

---

### Pattern 3: Unit Testing Pure Functions

Only write unit tests for pure functions with no side effects. Never unit test React components - use E2E tests instead.

#### Pure Utility Functions

```typescript
// ✅ Good Example - Unit testing pure functions
// utils/formatters.ts
const DEFAULT_CURRENCY = "USD";
const DEFAULT_LOCALE = "en-US";

export { formatCurrency, formatDate, slugify };

function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE).format(d);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

```typescript
// utils/__tests__/formatters.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, slugify } from "../formatters";

const EXPECTED_USD_FORMAT = "$1,234.56";
const EXPECTED_EUR_FORMAT = "€1,234.56";
const TEST_AMOUNT = 1234.56;
const ZERO_AMOUNT = 0;
const NEGATIVE_AMOUNT = -1234.56;
const TEST_DATE = "2024-03-15";
const EXPECTED_DATE_FORMAT = "3/15/2024";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(TEST_AMOUNT)).toBe(EXPECTED_USD_FORMAT);
  });

  it("formats different currencies", () => {
    expect(formatCurrency(TEST_AMOUNT, "EUR")).toBe(EXPECTED_EUR_FORMAT);
  });

  it("handles zero", () => {
    expect(formatCurrency(ZERO_AMOUNT)).toBe("$0.00");
  });

  it("handles negative amounts", () => {
    expect(formatCurrency(NEGATIVE_AMOUNT)).toBe("-$1,234.56");
  });
});

describe("formatDate", () => {
  it("formats Date object", () => {
    const date = new Date(TEST_DATE);
    expect(formatDate(date)).toBe(EXPECTED_DATE_FORMAT);
  });

  it("formats ISO string", () => {
    expect(formatDate(TEST_DATE)).toBe(EXPECTED_DATE_FORMAT);
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("Hello @World!")).toBe("hello-world");
  });

  it("handles multiple spaces", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });
});
```

**Why good:** Tests pure functions with clear input → output, fast to run with no setup or mocking needed, easy to test edge cases (zero, negative, empty), uses named constants preventing magic values, high confidence in utility correctness

```typescript
// ❌ Bad Example - Unit testing React component
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

**Why bad:** E2E tests provide more value by testing real user interaction, unit tests for components break easily on refactoring, doesn't test real integration with the rest of the app, testing implementation details instead of user behavior

**When to use:** Pure functions with no side effects (formatters, calculations, transformations, validators).

**When not to use:** React components, hooks with side effects, API calls, localStorage interactions.

---

### Pattern 4: Business Logic Pure Functions

Business logic calculations are critical to get right and have many edge cases. Unit test them thoroughly.

#### Cart Calculations

```typescript
// ✅ Good Example - Business logic pure functions
// utils/cart.ts
export interface CartItem {
  price: number;
  quantity: number;
  discountPercent?: number;
}

const ZERO_DISCOUNT = 0;
const HUNDRED_PERCENT = 100;

export { calculateSubtotal, calculateTax, calculateTotal };

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const discount = item.discountPercent || ZERO_DISCOUNT;
    const itemPrice = item.price * (1 - discount / HUNDRED_PERCENT);
    return sum + itemPrice * item.quantity;
  }, 0);
}

function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}

function calculateTotal(subtotal: number, tax: number, shipping: number): number {
  return subtotal + tax + shipping;
}
```

```typescript
// utils/__tests__/cart.test.ts
import { describe, it, expect } from "vitest";
import { calculateSubtotal, calculateTax, calculateTotal } from "../cart";

const ITEM_PRICE_100 = 100;
const ITEM_PRICE_50 = 50;
const QUANTITY_2 = 2;
const QUANTITY_1 = 1;
const DISCOUNT_10_PERCENT = 10;
const TAX_RATE_8_PERCENT = 0.08;
const ZERO_TAX_RATE = 0;
const SHIPPING_COST = 10;

describe("calculateSubtotal", () => {
  it("calculates subtotal for multiple items", () => {
    const items = [
      { price: ITEM_PRICE_100, quantity: QUANTITY_2 },
      { price: ITEM_PRICE_50, quantity: QUANTITY_1 },
    ];
    expect(calculateSubtotal(items)).toBe(250);
  });

  it("applies discount", () => {
    const items = [
      { price: ITEM_PRICE_100, quantity: QUANTITY_1, discountPercent: DISCOUNT_10_PERCENT },
    ];
    expect(calculateSubtotal(items)).toBe(90);
  });

  it("returns 0 for empty cart", () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

describe("calculateTax", () => {
  it("calculates tax", () => {
    expect(calculateTax(ITEM_PRICE_100, TAX_RATE_8_PERCENT)).toBe(8);
  });

  it("handles 0 tax rate", () => {
    expect(calculateTax(ITEM_PRICE_100, ZERO_TAX_RATE)).toBe(0);
  });
});

describe("calculateTotal", () => {
  it("adds subtotal, tax, and shipping", () => {
    expect(calculateTotal(ITEM_PRICE_100, 8, SHIPPING_COST)).toBe(118);
  });
});
```

**Why good:** Critical business logic tested thoroughly, uses named constants for all values preventing magic numbers, many edge cases covered (empty cart, zero tax, discounts), pure functions are fast to test with high confidence

**Why unit test business logic:** Critical to get right (money calculations can't have bugs), many edge cases to test comprehensively, pure functions are easy to test, fast feedback during development

---

### Pattern 5: Integration Testing with MSW (Current Approach)

The current codebase uses Vitest + React Testing Library + MSW for integration tests. This is acceptable but not ideal compared to E2E tests.

#### When Integration Tests Make Sense

- Component behavior in isolation (form validation, UI state)
- When E2E tests are too slow for rapid feedback
- Testing edge cases that are hard to reproduce in E2E
- Development workflow (faster than spinning up full stack)

#### Current Pattern

- Tests in `__tests__/` directories co-located with code
- MSW for API mocking at network level
- Centralized mock data in `@repo/api-mocks`
- Test all states: loading, empty, error, success

```typescript
// ✅ Good Example - Integration test with MSW
// apps/client-react/src/home/__tests__/features.test.tsx
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { defaultFeatures } from "@repo/api-mocks/mocks";
import { serverWorker } from "@repo/api-mocks/serverWorker";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../testSetup/testUtils.local";

describe("Features", () => {
  it("should render empty state", async () => {
    serverWorker.use(getFeaturesHandlers.emptyHandler());
    renderApp();

    await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
  });

  it("should render error state", async () => {
    serverWorker.use(getFeaturesHandlers.errorHandler());
    renderApp();

    await expect(screen.findByText(/An error has occurred/i)).resolves.toBeInTheDocument();
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

**Why good:** Tests component with API integration via MSW at network level, tests all states (loading, empty, error, success) ensuring robustness, centralized mock handlers in @repo/api-mocks prevent duplication, shared between tests and development for consistency

```typescript
// ❌ Bad Example - Module-level mocking
import { vi } from "vitest";
import { getFeatures } from "../api";

vi.mock("../api", () => ({
  getFeatures: vi.fn(),
}));

test("renders features", async () => {
  (getFeatures as any).mockResolvedValue({ features: [] });
  // Module mocking breaks at runtime, hard to maintain
});
```

**Why bad:** Module-level mocks break when import structure changes, mocking at wrong level defeats purpose of integration testing, doesn't test network layer or serialization, maintenance nightmare when refactoring

#### MSW Setup Pattern

```typescript
// ✅ Good Example - MSW handler setup
// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";

const API_USER_ENDPOINT = "/api/users/:id";

export const handlers = [
  http.get(API_USER_ENDPOINT, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "John Doe",
      email: "john@example.com",
    });
  }),
];
```

```typescript
// src/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

**Why good:** MSW mocks at network level matching real API behavior, handlers are reusable across tests and development, easy to override per-test for different scenarios

#### Current Pattern Benefits and Limitations

**Benefits:**

- Tests component with API integration (via MSW)
- Tests all states: loading, empty, error, success
- Centralized mock handlers in `@repo/api-mocks`
- Shared between tests and development

**Limitations:**

- Doesn't test real API (mocks can drift)
- Doesn't test full user workflow
- Requires maintaining mock parity with API

---

### Pattern 6: What NOT to Test

Don't waste time testing things that don't add value.

#### Don't Test Third-Party Libraries

```typescript
// ❌ Bad Example - Testing React Query behavior
test("useQuery returns data", () => {
  const { result } = renderHook(() => useQuery(["key"], fetchFn));
  // Testing React Query, not your code
});
```

```typescript
// ✅ Good Example - Test YOUR behavior
test('displays user data when loaded', async () => {
  render(<UserProfile />);
  expect(await screen.findByText('John Doe')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing library code wastes time, library already has tests, doesn't verify your application logic

**Why good (second example):** Tests your component's behavior with the library, verifies actual user-facing outcome, focuses on application logic not library internals

#### Don't Test TypeScript Guarantees

```typescript
// ❌ Bad Example - TypeScript already prevents this
test('Button requires children prop', () => {
  // @ts-expect-error
  render(<Button />);
});
```

**Why bad:** TypeScript already enforces this at compile time, test adds no value, wastes execution time

#### Don't Test Implementation Details

```typescript
// ❌ Bad Example - Testing internal state
test("counter state increments", () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(1); // Internal detail
});
```

```typescript
// ✅ Good Example - Test observable behavior
test('displays incremented count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing internal state breaks when refactoring, not testing what users see, fragile and coupled to implementation

**Why good (second example):** Tests what users observe and interact with, resilient to refactoring, verifies actual behavior not implementation

**Focus on:** User-facing behavior, business logic, edge cases

---

### Pattern 7: Feature-Based Test Organization

Co-locate tests with code in feature-based structure. Tests live next to what they test.

#### Direct Co-location (Recommended)

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

#### Alternative: `__tests__/` Subdirectories

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

**Choose one pattern and be consistent across the codebase.**

#### E2E Test Organization

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

#### File Naming Convention

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

### Pattern 8: Mock Data Patterns

Use MSW with centralized handlers for API mocking during tests.

#### Test Setup

```typescript
// ✅ Good Example - MSW setup for tests
// setupTests.ts
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterEach(() => serverWorker.resetHandlers());
afterAll(() => serverWorker.close());
```

**Why good:** MSW intercepts at network level matching real API behavior, resetHandlers() after each test prevents test pollution, centralized in @repo/api-mocks enables reuse across apps

#### Per-Test Overrides

```typescript
// ✅ Good Example - Test-specific handler overrides
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { serverWorker } from "@repo/api-mocks/serverWorker";

it("should handle empty state", async () => {
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();
  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});
```

**Why good:** Easy to test different scenarios (empty, error, success), handlers are reusable across tests, doesn't pollute global state with per-test use()

**Future: Replace with E2E tests against real APIs in test environment**

---

### Pattern 9: Component Documentation with Ladle

Design system components MUST have `.stories.tsx` files. App-specific features do NOT need stories.

#### Where Stories are REQUIRED

```
packages/ui/src/
├── primitives/     # ✅ Stories required
├── components/     # ✅ Stories required
├── patterns/       # ✅ Stories required
└── templates/      # ✅ Stories required
```

#### Where Stories are OPTIONAL

```
apps/client-next/
apps/client-react/
  # ❌ App-specific features don't need stories
```

#### Design System Component Story

```typescript
// ✅ Good Example - Design system component stories
// packages/ui/src/components/button/button.stories.tsx
import type { Story } from "@ladle/react";
import { Button, type ButtonProps } from "./button";

export const Default: Story<ButtonProps> = () => (
  <Button>Default Button</Button>
);

export const Variants: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
    <Button variant="default">Default</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
  </div>
);

export const Sizes: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
    <Button size="default">Default Size</Button>
    <Button size="large">Large Size</Button>
    <Button size="icon">📌</Button>
  </div>
);

export const Disabled: Story<ButtonProps> = () => (
  <Button disabled>Disabled Button</Button>
);

export const AsChild: Story<ButtonProps> = () => (
  <Button asChild>
    <a href="/link">Link styled as Button</a>
  </Button>
);
```

**Why good:** Shows all variants and states for design system components, helps designers and developers understand component capabilities, serves as visual regression testing base, demonstrates common use cases

```typescript
// ❌ Bad Example - Creating stories for app-specific features
// apps/client-next/app/features.stories.tsx  ← DON'T DO THIS
export const FeaturesPage = () => { ... };
```

**Why bad:** App-specific features aren't reusable design system components, stories are for shared component libraries not one-off pages, wastes time documenting non-reusable code

**Key Patterns:**

- ✅ Stories required for: `packages/ui/src/` (primitives, components, patterns, templates)
- ❌ Stories NOT needed for: `apps/*/` (app-specific features, pages, layouts)
- ✅ One story per variant or use case
- ✅ Show all possible states
- ✅ Include edge cases (disabled, loading, error states)

</patterns>

---

<decision_framework>

## Decision Framework

```
Is it a user-facing workflow?
├─ YES → Write E2E test ✅
└─ NO → Is it a pure function with no side effects?
    ├─ YES → Write unit test ✅
    └─ NO → Is it component behavior in isolation?
        ├─ MAYBE → Integration test acceptable but E2E preferred ✅
        └─ NO → Is it a React component?
            └─ YES → Write E2E test, NOT unit test ✅

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

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **No E2E tests for critical user flows** - Critical user journeys untested means production bugs will reach users before you discover them
- ❌ **Unit testing React components** - Wastes time testing implementation details instead of user behavior, breaks easily on refactoring
- ❌ **Only testing happy paths** - Users will encounter errors but you haven't verified the app handles them gracefully
- ❌ **E2E tests that are flaky** - Flaky tests erode confidence and waste time, fix the test don't skip it
- ❌ **Setting coverage requirements without E2E tests** - Coverage metrics don't capture E2E test value, leads to false sense of security

**Medium Priority Issues:**

- ⚠️ **Only having integration tests** - Need E2E for user flows, integration tests alone miss real integration bugs
- ⚠️ **Mocking at module level instead of network level** - Module mocks break on refactoring and don't test serialization/network layer
- ⚠️ **Mocks that don't match real API** - Tests pass but production fails because mocks drifted from reality
- ⚠️ **Complex mocking setup** - Sign you should use E2E tests instead of fighting with mocks
- ⚠️ **Running E2E tests only in CI** - Need to run locally too for fast feedback during development

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

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST write E2E tests for ALL critical user workflows - NOT unit tests for React components)**

**(You MUST use Playwright for E2E tests and organize by user journey - NOT by component)**

**(You MUST only write unit tests for pure functions - NOT for components, hooks, or side effects)**

**(You MUST co-locate tests with code in feature-based structure - NOT in separate test directories)**

**(You MUST use MSW at network level for API mocking - NOT module-level mocks)**

**Failure to follow these rules will result in fragile tests that break on refactoring, untested critical user paths, and false confidence from high coverage of low-value tests.**

</critical_reminders>
