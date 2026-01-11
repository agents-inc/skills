# Testing Examples

> Code examples for all testing patterns. Reference from [skill.md](skill.md).

---

## E2E Testing Examples

### Complete Checkout Flow

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

### Error Handling in E2E Tests

```typescript
// Good Example - Tests validation errors
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
// Bad Example - Only tests happy path
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

---

## Unit Testing Examples

### Pure Utility Functions

```typescript
// Good Example - Unit testing pure functions
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

**Why good:** Tests pure functions with clear input -> output, fast to run with no setup or mocking needed, easy to test edge cases (zero, negative, empty), uses named constants preventing magic values, high confidence in utility correctness

```typescript
// Bad Example - Unit testing React component
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

**Why bad:** E2E tests provide more value by testing real user interaction, unit tests for components break easily on refactoring, doesn't test real integration with the rest of the app, testing implementation details instead of user behavior

---

### Business Logic Pure Functions

```typescript
// Good Example - Business logic pure functions
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

---

## Integration Testing Examples

### Integration Test with Network-Level Mocking

```typescript
// Good Example - Integration test with network-level mocking
// apps/client-react/src/home/__tests__/features.test.tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../testSetup/testUtils.local";
// Import your network mocking handlers (implementation varies by mocking library)
import { featuresHandlers, mockServer } from "../test-utils/mock-server";

const EXPECTED_FEATURE_COUNT = 3;

describe("Features", () => {
  it("should render empty state", async () => {
    // Override default handler with empty response
    mockServer.use(featuresHandlers.empty());
    renderApp();

    await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
  });

  it("should render error state", async () => {
    // Override default handler with error response
    mockServer.use(featuresHandlers.error());
    renderApp();

    await expect(screen.findByText(/An error has occurred/i)).resolves.toBeInTheDocument();
  });

  it("should render features", async () => {
    // Use default handler (returns feature list)
    mockServer.use(featuresHandlers.default());
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("feature")).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("feature")).toHaveLength(EXPECTED_FEATURE_COUNT);
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

**Why good:** Tests component with API integration via network-level mocking, tests all states (loading, empty, error, success) ensuring robustness, centralized mock handlers prevent duplication, shared between tests and development for consistency

```typescript
// Bad Example - Module-level mocking
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

---

### Network Mock Setup Pattern

```typescript
// Good Example - Network mock handler setup
// src/mocks/handlers.ts
// Note: Implementation varies by your chosen mocking library

const API_USER_ENDPOINT = "/api/users/:id";

export const userHandlers = {
  default: () => ({
    method: "GET",
    path: API_USER_ENDPOINT,
    response: {
      id: "123",
      name: "John Doe",
      email: "john@example.com",
    },
  }),
  error: () => ({
    method: "GET",
    path: API_USER_ENDPOINT,
    status: 500,
    response: { error: "Internal server error" },
  }),
};
```

```typescript
// src/mocks/server.ts
// Setup varies by mocking library - this is conceptual
import { handlers } from "./handlers";

export const mockServer = createMockServer(handlers);
```

**Why good:** Network-level mocking matches real API behavior, handlers are reusable across tests and development, easy to override per-test for different scenarios

---

### Test Setup

```typescript
// Good Example - Network mock setup for tests
// setupTests.ts
import { mockServer } from "./test-utils/mock-server";

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

**Why good:** Network-level mocking intercepts HTTP requests matching real API behavior, resetHandlers() after each test prevents test pollution, centralized mock server enables reuse across tests

---

### Per-Test Overrides

```typescript
// Good Example - Test-specific handler overrides
import { featuresHandlers, mockServer } from "./test-utils/mock-server";

it("should handle empty state", async () => {
  mockServer.use(featuresHandlers.empty());
  renderApp();
  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});
```

**Why good:** Easy to test different scenarios (empty, error, success), handlers are reusable across tests, doesn't pollute global state with per-test overrides

---

## What NOT to Test Examples

### Don't Test Third-Party Libraries

```typescript
// Bad Example - Testing data fetching library behavior
test("data fetching hook returns data", () => {
  const { result } = renderHook(() => useDataFetchingHook(["key"], fetchFn));
  // Testing the library, not your code
});
```

```typescript
// Good Example - Test YOUR behavior
test('displays user data when loaded', async () => {
  render(<UserProfile />);
  expect(await screen.findByText('John Doe')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing library code wastes time, library already has tests, doesn't verify your application logic

**Why good (second example):** Tests your component's behavior with the library, verifies actual user-facing outcome, focuses on application logic not library internals

---

### Don't Test TypeScript Guarantees

```typescript
// Bad Example - TypeScript already prevents this
test('Button requires children prop', () => {
  // @ts-expect-error
  render(<Button />);
});
```

**Why bad:** TypeScript already enforces this at compile time, test adds no value, wastes execution time

---

### Don't Test Implementation Details

```typescript
// Bad Example - Testing internal state
test("counter state increments", () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(1); // Internal detail
});
```

```typescript
// Good Example - Test observable behavior
test('displays incremented count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing internal state breaks when refactoring, not testing what users see, fragile and coupled to implementation

**Why good (second example):** Tests what users observe and interact with, resilient to refactoring, verifies actual behavior not implementation

---

## Ladle Story Examples

### Design System Component Story

```typescript
// Good Example - Design system component stories
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
    <Button size="icon">Icon</Button>
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
// Bad Example - Creating stories for app-specific features
// apps/client-next/app/features.stories.tsx  <- DON'T DO THIS
export const FeaturesPage = () => { ... };
```

**Why bad:** App-specific features aren't reusable design system components, stories are for shared component libraries not one-off pages, wastes time documenting non-reusable code
