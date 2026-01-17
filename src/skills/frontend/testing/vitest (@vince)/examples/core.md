# Testing - Core Examples

> E2E and Unit testing essentials. Reference from [SKILL.md](../SKILL.md).

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

_For more patterns, see:_
- [integration.md](integration.md) - Integration tests with network mocking
- [anti-patterns.md](anti-patterns.md) - What NOT to test
- [ladle-stories.md](ladle-stories.md) - Component documentation stories
