# Playwright E2E Testing — Fixtures

> Composition, seeded data and storage state. See [core.md](core.md) for the basic fixture shape
> ([Pattern 5](core.md#pattern-5-authentication-fixture)).

---

## Composing several fixtures

```typescript
// tests/e2e/fixtures/index.ts
import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { DashboardPage } from "../pages/dashboard-page";
import { CheckoutPage } from "../pages/checkout-page";

const AUTH_COOKIE = {
  name: "session",
  value: "authenticated-user-token",
  domain: "localhost",
  path: "/",
};

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  checkoutPage: CheckoutPage;
  authenticatedUser: void;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),

  authenticatedUser: [
    async ({ context }, use) => {
      await context.addCookies([AUTH_COOKIE]);
      await use();
    },
    { auto: false }, // opt in by naming it in the test's arguments
  ],
});

export { expect };
```

```typescript
// tests/e2e/checkout.spec.ts
import { test, expect } from "./fixtures";

// Naming authenticatedUser is what activates it.
test("can reach checkout when signed in", async ({
  checkoutPage,
  page,
  authenticatedUser,
}) => {
  await checkoutPage.goto();
  await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
});

test("products are public", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /products/i })).toBeVisible();
});
```

**Why good:** a fixture is constructed only for the tests that name it, so the public-page test pays
nothing for the authentication machinery. `auto: false` makes the opt-in visible in the test
signature.

---

## Seeding data through the API

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
      await request.post("/api/test/seed", {
        data: { userId: TEST_USER_ID, products: 5, orders: 3 },
      });
      await use();
      await request.delete(`/api/test/cleanup/${TEST_USER_ID}`);
    },
    { auto: true },
  ],
});
```

**Why good:** the `request` fixture reaches the API without a browser, so setup costs a request
rather than a page load, and the teardown half runs even when the test failed.

---

## Reusing authenticated storage state

```typescript
// Save once — including IndexedDB, where the token does not live in a cookie (v1.51+)
await context.storageState({ path: "auth.json", indexedDB: true });

// Reuse in any later context
const context = await browser.newContext({ storageState: "auth.json" });
```

**Why good:** signing in once and restoring the state is the difference between a suite that logs in
per test and one that does not. The `indexedDB` option covers token storage that a cookie-only
snapshot would miss.
