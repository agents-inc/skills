# Playwright E2E Testing — Core Examples

> Full code for the core patterns. Referenced from [SKILL.md](../SKILL.md).

**Extended examples:**

- [page-objects.md](page-objects.md) — base-page inheritance
- [api-mocking.md](api-mocking.md) — modifying real responses
- [visual-testing.md](visual-testing.md) — screenshot comparison
- [fixtures.md](fixtures.md) — composition, seeded data, storage state
- [advanced-features.md](advanced-features.md) — Clock API, ARIA snapshots, worker fixtures,
  polling assertions

---

## Pattern 1: Complete user flow

```typescript
// tests/e2e/checkout/checkout-flow.spec.ts
import { test, expect, type Page } from "@playwright/test";

const PRODUCT_URL = "/products/wireless-headphones";
const SHIPPING = {
  email: "user@example.com",
  name: "John Doe",
  address: "123 Main St",
  city: "San Francisco",
  zip: "94102",
};
// Sandbox card numbers the payment provider always accepts / always declines.
const CARD_ACCEPTED = "4242424242424242";
const CARD_DECLINED = "4000000000000002";

async function fillCheckout(page: Page, cardNumber: string) {
  await page.getByLabel(/email/i).fill(SHIPPING.email);
  await page.getByLabel(/full name/i).fill(SHIPPING.name);
  await page.getByLabel(/address/i).fill(SHIPPING.address);
  await page.getByLabel(/city/i).fill(SHIPPING.city);
  await page.getByLabel(/zip/i).fill(SHIPPING.zip);
  await page.getByLabel(/card number/i).fill(cardNumber);
  await page.getByLabel(/expiry/i).fill("12/28");
  await page.getByLabel(/cvc/i).fill("123");
}

test.describe("Checkout", () => {
  test("completes a purchase with an accepted card", async ({ page }) => {
    await page.goto(PRODUCT_URL);

    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    await page.getByRole("link", { name: /cart/i }).click();
    await expect(page.getByText("Wireless Headphones")).toBeVisible();
    await page.getByRole("button", { name: /checkout/i }).click();

    await fillCheckout(page, CARD_ACCEPTED);
    await page.getByRole("button", { name: /place order/i }).click();

    await expect(page.getByText(/order confirmed/i)).toBeVisible();
    await expect(page).toHaveURL(/\/order\/success/);
  });

  test("keeps the user on checkout when the card is declined", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await fillCheckout(page, CARD_DECLINED);
    await page.getByRole("button", { name: /place order/i }).click();

    await expect(page.getByText(/payment failed/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
  });
});
```

**Why good:** both the happy path and the failure path are covered, every step asserts something the
user can see, and the shared form filling is a helper rather than a copied block — so a new field
changes one place.

---

## Pattern 2: Page Object Model

```typescript
// tests/e2e/pages/login-page.ts
import { expect, type Locator, type Page } from "@playwright/test";

const LOGIN_URL = "/login";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly errorAlert: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.signInButton = page.getByRole("button", { name: /sign in/i });
    this.rememberMeCheckbox = page.getByRole("checkbox", {
      name: /remember me/i,
    });
    this.errorAlert = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto(LOGIN_URL);
  }

  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (rememberMe) await this.rememberMeCheckbox.check();
    await this.signInButton.click();
  }

  async expectError(text: string | RegExp) {
    await expect(this.errorAlert).toContainText(text);
  }
}
```

```typescript
// tests/e2e/fixtures.ts
import { test as base, expect } from "@playwright/test";
import { LoginPage } from "./pages/login-page";

export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect };
```

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from "../fixtures";

test("invalid credentials show an error", async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login("wrong@example.com", "wrongpassword");
  await loginPage.expectError(/invalid credentials/i);
});
```

**Why good:** locators are defined once, so a markup change is a one-line edit. The fixture
constructs the page object, so no test repeats `new LoginPage(page)`.

> Inheritance across several pages: [page-objects.md](page-objects.md).

---

## Pattern 3: Network mocking

```typescript
// tests/e2e/api-mocking/user-profile.spec.ts
import { test, expect } from "@playwright/test";

const API_USER_PROFILE = "**/api/users/me";
const MOCK_USER = {
  id: "user-123",
  name: "Jane Doe",
  email: "jane@example.com",
  role: "admin",
};

test.describe("Profile", () => {
  // Registered before every goto in this block, so the first request is already covered.
  test.beforeEach(async ({ page }) => {
    await page.route(API_USER_PROFILE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      }),
    );
  });

  test("shows the profile", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText(MOCK_USER.name)).toBeVisible();
  });

  test("hides the admin badge for a regular user", async ({ page }) => {
    // A later route for the same pattern takes precedence over the one above.
    await page.route(API_USER_PROFILE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_USER, role: "user" }),
      }),
    );

    await page.goto("/profile");
    await expect(page.getByText(/admin/i)).not.toBeVisible();
  });
});
```

```typescript
// Error paths, which are the reason to stub at all
test("shows the error state on 500", async ({ page }) => {
  await page.route("**/api/products", (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: "boom" }) }),
  );
  await page.goto("/products");
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
});

test("redirects to login on 401", async ({ page }) => {
  await page.route("**/api/products", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login/);
});

test("shows a network error when the request fails outright", async ({
  page,
}) => {
  await page.route("**/api/products", (route) => route.abort("failed"));
  await page.goto("/products");
  await expect(page.getByText(/network error/i)).toBeVisible();
});
```

**Why good:** `beforeEach` establishes the happy path once and each test overrides only what it is
about, so the intent of a test is the two lines that differ from the default.

> Modifying a real response instead of replacing it: [api-mocking.md](api-mocking.md).

---

## Pattern 4: Configuration decisions

`npm init playwright@latest` writes the config; what follows are the keys that carry a decision
rather than a default.

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray test.only must not narrow a CI run to one test
  retries: process.env.CI ? 2 : 0, // retry only where a human is not watching
  workers: process.env.CI ? 2 : undefined,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry", // full timeline for the failure, no cost on green runs
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  expect: {
    timeout: 5_000, // assertion retry budget, separate from the test timeout
    toHaveScreenshot: { maxDiffPixels: 50 },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Why good:** `trace: "on-first-retry"` is the setting that turns a CI failure into something
debuggable without slowing every passing run. `reuseExistingServer` keeps the local loop attached to
the dev server already running.

**Targeting several environments:** add a project per environment with its own `baseURL`, and give
the production one `testMatch: /.*\.smoke\.ts/` so only the safe subset runs there.

---

## Pattern 5: Authentication fixture

```typescript
// tests/e2e/fixtures/auth.ts
import { test as base, expect } from "@playwright/test";

const SESSION_COOKIE = {
  name: "session",
  value: "test-session-token",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  secure: false,
};

export const test = base.extend<{ authenticatedContext: void }>({
  authenticatedContext: [
    async ({ context }, use) => {
      await context.addCookies([SESSION_COOKIE]);
      await use();
      await context.clearCookies();
    },
    { auto: true }, // every test in files importing this fixture is authenticated
  ],
});

export { expect };
```

**Why good:** setup and teardown live in one place, and `auto: true` means no test has to remember
to ask for authentication.

> Opt-in fixtures, seeded data and storage state: [fixtures.md](fixtures.md).
