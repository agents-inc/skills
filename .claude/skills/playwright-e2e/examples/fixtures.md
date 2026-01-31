# Playwright E2E Testing - Fixtures

> Advanced fixture patterns including composition and database seeding. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand Basic Page Objects and [Pattern 5: Authentication Fixture](core.md#pattern-5-authentication-fixture) from core examples first.

---

## Pattern: Combined Fixtures

### Fixture Composition

```typescript
// tests/e2e/fixtures/index.ts
import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { DashboardPage } from "../pages/dashboard-page";
import { CheckoutPage } from "../pages/checkout-page";

type AllFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  checkoutPage: CheckoutPage;
  authenticatedUser: void;
};

const AUTH_COOKIE = {
  name: "session",
  value: "authenticated-user-token",
  domain: "localhost",
  path: "/",
};

export const test = base.extend<AllFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  authenticatedUser: [
    async ({ context }, use) => {
      await context.addCookies([AUTH_COOKIE]);
      await use();
    },
    { auto: false }, // Opt-in, not automatic
  ],
});

export { expect };
```

### Using Combined Fixtures

```typescript
// tests/e2e/checkout.spec.ts
import { test, expect } from "./fixtures";

test.describe("Checkout (requires auth)", () => {
  // This test uses the authenticatedUser fixture
  test("can proceed to checkout", async ({
    page,
    checkoutPage,
    authenticatedUser,
  }) => {
    await checkoutPage.goto();
    await expect(
      page.getByRole("heading", { name: /checkout/i }),
    ).toBeVisible();
  });
});

test.describe("Public pages", () => {
  // This test does NOT use authenticatedUser
  test("can view products without login", async ({ page }) => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: /products/i }),
    ).toBeVisible();
  });
});
```

**Why good:** Fixtures encapsulate setup and teardown, auto fixtures run automatically when needed, opt-in fixtures give control per test, combined fixtures provide full toolkit

---

## Pattern: Database Seeding Fixture

```typescript
// tests/e2e/fixtures/database.ts
import { test as base } from "@playwright/test";

type DatabaseFixtures = {
  seedDatabase: void;
  testUserId: string;
};

const TEST_USER_ID = `test-user-${Date.now()}`;

export const test = base.extend<DatabaseFixtures>({
  testUserId: TEST_USER_ID,

  seedDatabase: [
    async ({ request }, use) => {
      // Setup: Seed test data via API
      await request.post("/api/test/seed", {
        data: {
          userId: TEST_USER_ID,
          products: 5,
          orders: 3,
        },
      });

      await use();

      // Teardown: Clean up test data
      await request.delete(`/api/test/cleanup/${TEST_USER_ID}`);
    },
    { auto: true },
  ],
});
```

**Why good:** Provides predictable test data state, automatic cleanup prevents test pollution, exposes testUserId for assertions

---

## Pattern: IndexedDB Storage State (v1.51+)

Save and restore IndexedDB contents for authentication tokens (useful for Firebase Auth, etc.).

```typescript
// Save storage state including IndexedDB
await context.storageState({
  path: "auth.json",
  indexedDB: true, // v1.51+ feature
});

// Restore in another context
const context = await browser.newContext({
  storageState: "auth.json",
});
```

**Why good:** Handles modern auth systems that store tokens in IndexedDB, eliminates re-authentication between tests, works with Firebase and similar platforms

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Configuration._
