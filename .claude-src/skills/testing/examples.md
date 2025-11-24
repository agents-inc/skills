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
