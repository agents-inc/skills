# Playwright E2E Testing Examples

> Core code examples for Playwright E2E patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [visual-testing.md](visual-testing.md) - Screenshot comparison, component visual testing
- [configuration.md](configuration.md) - Multi-environment config, staging/production setups
- [api-mocking.md](api-mocking.md) - Response interception and modification
- [page-objects.md](page-objects.md) - Page object hierarchy, base page inheritance
- [fixtures.md](fixtures.md) - Combined fixtures, database seeding
- [advanced-features.md](advanced-features.md) - Clock API, ARIA snapshots, worker fixtures, toPass polling (v1.50+)

---

## Pattern 1: Complete User Flow

### E-Commerce Checkout Flow

```typescript
// tests/e2e/checkout/checkout-flow.spec.ts
import { test, expect } from "@playwright/test";

// Test data constants
const PRODUCT_URL = "/products/wireless-headphones";
const CART_URL_PATTERN = /\/cart/;
const ORDER_SUCCESS_URL_PATTERN = /\/order\/success/;
const PRODUCT_NAME = "Wireless Headphones";
const PRODUCT_PRICE = "$99.99";

const TEST_EMAIL = "user@example.com";
const TEST_NAME = "John Doe";
const TEST_ADDRESS = "123 Main St";
const TEST_CITY = "San Francisco";
const TEST_ZIP = "94102";

// Stripe test card numbers
const CARD_SUCCESS = "4242424242424242";
const CARD_DECLINED = "4000000000000002";
const CARD_EXPIRY = "12/28";
const CARD_CVC = "123";

test.describe("Checkout Flow", () => {
  test("complete purchase with valid payment", async ({ page }) => {
    // Navigate to product
    await page.goto(PRODUCT_URL);

    // Add to cart
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    // Go to cart
    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page).toHaveURL(CART_URL_PATTERN);

    // Verify product in cart
    await expect(page.getByText(PRODUCT_NAME)).toBeVisible();
    await expect(page.getByText(PRODUCT_PRICE)).toBeVisible();

    // Proceed to checkout
    await page.getByRole("button", { name: /checkout/i }).click();

    // Fill shipping information
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/full name/i).fill(TEST_NAME);
    await page.getByLabel(/address/i).fill(TEST_ADDRESS);
    await page.getByLabel(/city/i).fill(TEST_CITY);
    await page.getByLabel(/zip/i).fill(TEST_ZIP);

    // Fill payment information
    await page.getByLabel(/card number/i).fill(CARD_SUCCESS);
    await page.getByLabel(/expiry/i).fill(CARD_EXPIRY);
    await page.getByLabel(/cvc/i).fill(CARD_CVC);

    // Submit order
    await page.getByRole("button", { name: /place order/i }).click();

    // Verify success
    await expect(page.getByText(/order confirmed/i)).toBeVisible();
    await expect(page).toHaveURL(ORDER_SUCCESS_URL_PATTERN);
  });

  test("handles payment decline gracefully", async ({ page }) => {
    await page.goto("/checkout");

    // Fill shipping information
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/full name/i).fill(TEST_NAME);
    await page.getByLabel(/address/i).fill(TEST_ADDRESS);
    await page.getByLabel(/city/i).fill(TEST_CITY);
    await page.getByLabel(/zip/i).fill(TEST_ZIP);

    // Use test card that declines
    await page.getByLabel(/card number/i).fill(CARD_DECLINED);
    await page.getByLabel(/expiry/i).fill(CARD_EXPIRY);
    await page.getByLabel(/cvc/i).fill(CARD_CVC);

    // Attempt to place order
    await page.getByRole("button", { name: /place order/i }).click();

    // Verify error handling
    await expect(page.getByText(/payment failed/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
  });
});
```

**Why good:** Tests complete user journey from product selection to order confirmation, covers happy path and error scenarios, uses named constants for all test data, uses accessibility locators (getByRole, getByLabel), verifies both visible feedback and URL changes

---

## Pattern 2: Page Object Model

### Basic Page Object

```typescript
// tests/e2e/pages/login-page.ts
import type { Page, Locator } from "@playwright/test";

const LOGIN_URL = "/login";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly createAccountLink: Locator;
  readonly errorAlert: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.signInButton = page.getByRole("button", { name: /sign in/i });
    this.forgotPasswordLink = page.getByRole("link", { name: /forgot password/i });
    this.createAccountLink = page.getByRole("link", { name: /create account/i });
    this.errorAlert = page.getByRole("alert");
    this.rememberMeCheckbox = page.getByRole("checkbox", { name: /remember me/i });
  }

  async goto() {
    await this.page.goto(LOGIN_URL);
  }

  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }

    await this.signInButton.click();
  }

  async expectError(errorText: string | RegExp) {
    const { expect } = await import("@playwright/test");
    await expect(this.errorAlert).toContainText(errorText);
  }
}
```

### Page Objects with Fixtures

```typescript
// tests/e2e/fixtures.ts
import { test as base, expect } from "@playwright/test";
import { LoginPage } from "./pages/login-page";

type PageFixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect };
```

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from "../fixtures";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePassword123!";

test.describe("Login with Page Objects", () => {
  test("successful login", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL, VALID_PASSWORD);

    await expect(loginPage.page).toHaveURL(/dashboard/);
  });

  test("invalid credentials show error", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login("wrong@example.com", "wrongpassword");

    await loginPage.expectError(/invalid credentials/i);
  });
});
```

**Why good:** Page objects encapsulate all locators and actions, fixtures inject page objects automatically, tests are clean and focused on behavior, locators are defined once and reused

> **Extended pattern:** See [page-objects.md](page-objects.md) for base page inheritance and combined fixtures.

---

## Pattern 3: Network Mocking

### Mocking REST API Responses

```typescript
// tests/e2e/api-mocking/user-profile.spec.ts
import { test, expect } from "@playwright/test";

const API_USER_PROFILE = "**/api/users/me";

const MOCK_USER = {
  id: "user-123",
  name: "Jane Doe",
  email: "jane@example.com",
  avatar: "https://example.com/avatar.jpg",
  role: "admin",
};

test.describe("User Profile with Mocked API", () => {
  test.beforeEach(async ({ page }) => {
    // Setup default mock
    await page.route(API_USER_PROFILE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      })
    );
  });

  test("displays user profile information", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByText(MOCK_USER.name)).toBeVisible();
    await expect(page.getByText(MOCK_USER.email)).toBeVisible();
  });

  test("hides admin badge for regular users", async ({ page }) => {
    // Override mock for this specific test
    await page.route(API_USER_PROFILE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_USER, role: "user" }),
      })
    );

    await page.goto("/profile");

    await expect(page.getByText(/admin/i)).not.toBeVisible();
  });
});
```

### Testing Error States

```typescript
// tests/e2e/api-mocking/error-handling.spec.ts
import { test, expect } from "@playwright/test";

const API_PRODUCTS = "**/api/products";
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAUTHORIZED = 401;

test.describe("API Error Handling", () => {
  test("shows error message on server error", async ({ page }) => {
    await page.route(API_PRODUCTS, (route) =>
      route.fulfill({
        status: HTTP_SERVER_ERROR,
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/products");

    await expect(page.getByText(/something went wrong/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  test("redirects to login on unauthorized", async ({ page }) => {
    await page.route(API_PRODUCTS, (route) =>
      route.fulfill({
        status: HTTP_UNAUTHORIZED,
        body: JSON.stringify({ error: "Unauthorized" }),
      })
    );

    await page.goto("/products");

    await expect(page).toHaveURL(/\/login/);
  });

  test("shows network error on connection failure", async ({ page }) => {
    await page.route(API_PRODUCTS, (route) => route.abort("failed"));

    await page.goto("/products");

    await expect(page.getByText(/network error/i)).toBeVisible();
  });
});
```

**Why good:** beforeEach sets up default happy path mocks, individual tests can override for specific scenarios, mock data is clearly defined as constants, tests are isolated and deterministic

> **Extended pattern:** See [api-mocking.md](api-mocking.md) for response modification.

---

## Pattern 4: Development Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 30000;
const EXPECT_TIMEOUT_MS = 5000;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
    ...(process.env.CI ? [["github" as const]] : []),
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  timeout: DEFAULT_TIMEOUT_MS,
  expect: {
    timeout: EXPECT_TIMEOUT_MS,
    toHaveScreenshot: {
      maxDiffPixels: 50,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Why good:** CI-specific settings for retries and workers, captures trace/screenshot/video on failure, webServer auto-starts dev server, timeout constants are named

> **Extended pattern:** See [configuration.md](configuration.md) for staging/production configs.

---

## Pattern 5: Authentication Fixture

```typescript
// tests/e2e/fixtures/auth.ts
import { test as base, expect } from "@playwright/test";

const AUTH_COOKIE_NAME = "session";
const AUTH_COOKIE_VALUE = "test-session-token";
const COOKIE_DOMAIN = "localhost";

type AuthFixtures = {
  authenticatedContext: void;
};

export const test = base.extend<AuthFixtures>({
  authenticatedContext: [
    async ({ context }, use) => {
      // Setup: Add authentication cookie
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: AUTH_COOKIE_VALUE,
          domain: COOKIE_DOMAIN,
          path: "/",
          httpOnly: true,
          secure: false,
        },
      ]);

      await use();

      // Teardown: Clear cookies
      await context.clearCookies();
    },
    { auto: true },
  ],
});

export { expect };
```

**Why good:** Fixtures encapsulate authentication setup, auto fixtures run automatically for all tests in suite, teardown ensures clean state between tests

> **Extended pattern:** See [fixtures.md](fixtures.md) for combined fixtures and database seeding.

---

_Extended examples: [visual-testing.md](visual-testing.md) | [configuration.md](configuration.md) | [api-mocking.md](api-mocking.md) | [page-objects.md](page-objects.md) | [fixtures.md](fixtures.md) | [advanced-features.md](advanced-features.md)_
