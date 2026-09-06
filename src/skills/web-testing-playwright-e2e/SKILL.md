---
name: web-testing-playwright-e2e
description: Playwright E2E testing patterns - test structure, Page Object Model, locator strategies, assertions, network mocking, visual regression, parallel execution, fixtures, and configuration
---

# Playwright E2E Testing Patterns

> **Quick Guide:** Playwright drives a real browser through complete user journeys. Locators are
> lazy queries re-resolved on every use and `expect(locator)` matchers retry until they pass, so a
> correct test needs no sleeps and no stale-handle handling. Each test gets its own browser context;
> shared setup arrives through fixtures rather than module-level variables, because tests run in
> parallel workers.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — user flows, page objects, network mocking, config, auth
  fixtures
- [examples/page-objects.md](examples/page-objects.md) — base-page inheritance and hierarchy
- [examples/api-mocking.md](examples/api-mocking.md) — intercepting and modifying real responses
- [examples/visual-testing.md](examples/visual-testing.md) — screenshot comparison, masking, states
- [examples/fixtures.md](examples/fixtures.md) — fixture composition, seeded data, storage state
- [examples/advanced-features.md](examples/advanced-features.md) — Clock API, ARIA snapshots,
  worker-scoped fixtures, polling assertions, accessibility assertions
- [reference.md](reference.md) — locator and assertion tables, config and CLI lookup, version
  changes, troubleshooting

---

<critical_requirements>

## Before writing Playwright code

**Reach for `getByRole()` first.** It selects the element the way a user and a screen reader find
it, so it survives markup changes and validates the accessible name as a side effect.

**Assert with `expect(locator)` matchers.** They retry until the condition holds or the timeout
expires, which is what removes the reason to sleep at all — a fixed wait is either too short or too
slow.

**Register a route before the navigation that triggers the request.** Routes are attached to the
context and only affect requests made after they are set, so a `page.route()` after `page.goto()`
never sees the call it was meant to intercept.

**Give each test its own state through a fixture.** Workers run in parallel and a module-level
variable is shared inside one worker and absent from the next, so setup that lives in a fixture is
the only setup that behaves the same in both.

</critical_requirements>

---

**Auto-detection:** Playwright, @playwright/test, playwright.config, page.goto, test.describe,
test.extend, expect(page), getByRole, getByLabel, getByTestId, toBeVisible, toHaveURL,
toHaveScreenshot, toMatchAriaSnapshot, page.route, route.fulfill, page.clock, toPass, devices

**Applies to:**

- User journeys through a real browser, across pages and origins
- Locator strategy, web-first assertions and soft assertions
- Intercepting, stubbing and modifying network traffic for a test
- Screenshot comparison and ARIA-tree assertions
- Fixtures, worker scoping, parallelism and the test config

**Handled elsewhere:**

- Unit-level checks on pure functions — a browser adds nothing to an input/output assertion
- Mounting a single component and poking at its props — a different granularity, settled by
  whatever owns component testing
- The application's own accessibility remediation — this skill asserts the accessible tree, it does
  not decide what that tree should be
- Baseline custody and review workflow for screenshots across a whole suite

---

<philosophy>

A locator is a query, not a handle. `page.getByRole("button")` resolves nothing until it is used,
and resolves again on every use — so there is no stale element to guard against, and no reason to
capture one early. Assertions inherit the same model: `expect(locator).toBeVisible()` polls until
the timeout.

Everything else follows: the sleep, the CSS selector and the shared variable each throw away
something the model already gives for free.

</philosophy>

---

<decision_framework>

**Hooks or fixtures for setup:**

- Used by one `describe` block → `beforeEach`, which keeps the setup where it is read.
- Used across files, or needing teardown → a fixture, which carries both halves and composes.
- Needed once for the whole run → `globalSetup` in the config. `beforeAll` runs once per _worker_,
  not once per run.
- Expensive and safe to share within a worker → a worker-scoped fixture.

**Stub the network or hit it:**

- Third-party API → stub it. Rate limits, cost and their downtime are not your test's subject.
- Your own API, testing an error path → stub it; some statuses cannot be provoked on demand.
- Your own API, testing that the integration is correct → let it through, against a test database,
  and keep one such test per feature.
- Your own API, testing UI behaviour only → stub it, for speed and determinism.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Test structure

`test.describe` groups, `beforeEach` handles the navigation every test in the group repeats.

```typescript
test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("successful login lands on the dashboard", async ({ page }) => {
    await page.getByLabel(/email/i).fill(VALID_EMAIL);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/dashboard");
  });
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Page Object Model

Locators in the constructor, domain methods on the class. Worth it once several tests touch the same
page; inline locators stay clearer for a one-off.

```typescript
export class LoginPage {
  readonly emailInput: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.emailInput = page.getByLabel(/email/i);
    this.signInButton = page.getByRole("button", { name: /sign in/i });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    // ...
  }
}
```

Full code: [examples/core.md](examples/core.md) — inheritance in
[examples/page-objects.md](examples/page-objects.md)

### Pattern 3: Locator strategy

Prefer the query that names what the element _is_; fall back to a test id only where no role or
label exists.

```typescript
await page.getByRole("button", { name: /submit/i });
await page.getByLabel(/email address/i);
await page.getByTestId("user-avatar"); // no semantic role available

// Narrow within a list instead of writing a fragile selector
await page
  .getByRole("listitem")
  .filter({ hasText: "Product A" })
  .getByRole("button", { name: /add to cart/i })
  .click();

// Exclude and combine (v1.33+)
page.getByRole("listitem").filter({ hasNot: page.getByText("Out of stock") });
page.getByRole("button").and(page.getByTitle("Subscribe"));
```

Priority table and role mappings: [reference.md](reference.md)

### Pattern 4: Web-first assertions

Every `expect(locator)` matcher retries, including negated ones.

```typescript
await expect(page.getByText("Welcome")).toBeVisible();
await expect(page).toHaveURL(/\/dashboard/);
await expect(page.getByRole("progressbar")).not.toBeVisible();

// Soft assertions collect every failure in one run instead of stopping at the first
await expect.soft(page.getByTestId("avatar")).toBeVisible();
await expect.soft(page.getByText("Premium")).toBeVisible();
```

Full assertion table: [reference.md](reference.md)

### Pattern 5: Network mocking

`page.route()` intercepts by URL pattern; `route.fulfill()` answers, `route.abort()` fails the
request.

```typescript
await page.route("**/api/users", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-123", name: "Jane Doe" }),
  }),
);

await page.route("**/api/users", (route) => route.abort("failed")); // network failure
```

Full code: [examples/core.md](examples/core.md) — modifying a real response in
[examples/api-mocking.md](examples/api-mocking.md)

### Pattern 6: Visual regression

`toHaveScreenshot()` writes a baseline on first run and compares afterwards. Mask what changes on
its own.

```typescript
await expect(page).toHaveScreenshot("dashboard.png", {
  mask: [page.getByTestId("current-time")],
  animations: "disabled",
});
```

Full code: [examples/visual-testing.md](examples/visual-testing.md)

### Pattern 7: Custom fixtures

`base.extend` adds fixtures for page objects and setup. An `auto` fixture runs without being named
by the test.

```typescript
export const test = base.extend<{ loginPage: LoginPage; authenticated: void }>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  authenticated: [
    async ({ context }, use) => {
      await context.addCookies([SESSION_COOKIE]);
      await use();
      await context.clearCookies();
    },
    { auto: true },
  ],
});
```

Full code: [examples/core.md](examples/core.md) — composition and seeding in
[examples/fixtures.md](examples/fixtures.md)

### Pattern 8: Clock control (v1.45+)

Move time instead of waiting for it. `clock.install()` comes before every other clock call.

```typescript
await page.clock.install({ time: new Date("2024-02-02T08:00:00") });
await page.goto("/dashboard");
await page.clock.fastForward("25:00");
await expect(page.getByText(/session expires/i)).toBeVisible();
```

Full code: [examples/advanced-features.md](examples/advanced-features.md)

### Pattern 9: ARIA snapshots (v1.49+)

Assert the accessible tree as a whole, in one readable block.

```typescript
await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Products"
`);
```

Full code: [examples/advanced-features.md](examples/advanced-features.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `page.waitForTimeout()` before an assertion — either too short and flaky or too long and slow;
  the retrying matcher already covers it.
- A `page.route()` registered after the navigation that fires the request — the route never
  matches; set it up before `goto`, in `beforeEach` or in a fixture.
- CSS or id selectors (`.btn-primary`, `#submit-btn`) — they change with styling and markup; a role
  or label query does not.
- Module-level variables shared between tests — absent in the next worker, and racy inside one;
  use a fixture.
- Glob patterns using `?` or `[]` in `page.route()` — unsupported since v1.52; use a regex.
- `route.continue()` overriding the `Cookie` header — refused since v1.52; use
  `context.addCookies()`.
- `_react` / `_vue` selector engines — removed in v1.58; use a role query or a test id.

**Surprising behaviour:**

- `beforeAll` runs once per **worker**, not once per run — one-time setup belongs in `globalSetup`.
- `toBeVisible()` waits for visibility while `toBeAttached()` only checks the DOM; a hidden element
  satisfies the second.
- `toBeEditable()` throws on a non-editable element since v1.50 rather than returning false.
- Screenshots differ by OS, browser build and font rendering — compare only against baselines
  produced in the same environment as CI.
- A screenshot of unmasked dynamic content (timestamps, ads, avatars) fails on content rather than
  on layout.
- Assertions inherit `expect.timeout` from the config, not the test timeout — a slow page fails the
  assertion first.

</red_flags>
