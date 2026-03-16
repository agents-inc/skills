---
name: web-testing-playwright-e2e
description: Playwright E2E testing patterns - test structure, Page Object Model, locator strategies, assertions, network mocking, visual regression, parallel execution, fixtures, and configuration
---

# Playwright E2E Testing Patterns

> **Quick Guide:** Use Playwright for end-to-end tests that verify complete user workflows through the real browser. Focus on critical user journeys, use accessibility-based locators (`getByRole`), and leverage auto-waiting assertions -- never use manual sleeps. Isolate each test with its own browser context. Mock external APIs via route interception for reliability.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use getByRole() as your primary locator strategy - it mirrors how users interact with the page)**

**(You MUST test complete user workflows end-to-end - login flows, checkout processes, form submissions)**

**(You MUST use web-first assertions that auto-wait - toBeVisible(), toHaveText(), not manual sleeps)**

**(You MUST isolate tests - each test runs independently with its own browser context)**

**(You MUST use named constants for test data - no magic strings or numbers in test files)**

</critical_requirements>

---

**Auto-detection:** Playwright, E2E testing, end-to-end testing, browser automation, page.goto, test.describe, expect(page), getByRole, getByTestId, toBeVisible, toHaveScreenshot, toMatchAriaSnapshot

**When to use:**

- Testing critical user-facing workflows (login, checkout, form submission)
- Multi-step user journeys that span multiple pages
- Cross-browser compatibility testing
- Testing real integration with backend APIs
- Visual regression testing with screenshots
- Accessibility tree validation with ARIA snapshots

**When NOT to use:**

- Testing pure utility functions (use unit tests)
- Testing individual component variants in isolation (use component testing tools)
- API-only testing without UI (use API testing)

**Key patterns covered:**

- Test structure and organization (test.describe, test, hooks)
- Page Object Model pattern for maintainability
- Locator strategies prioritizing accessibility (getByRole, getByLabel, chaining, operators)
- Web-first assertions with auto-waiting (toBeVisible, toHaveText, soft assertions)
- Network mocking and interception (route.fulfill, route.abort, response modification)
- Visual regression testing (toHaveScreenshot, masking, thresholds)
- Custom and worker-scoped fixtures
- Clock API for time-dependent testing (v1.45+)
- ARIA snapshot testing for accessibility (v1.49+)
- Accessibility assertions (v1.44+): toHaveAccessibleName, toHaveRole

**Detailed Resources:**

- [examples/core.md](examples/core.md) - User flows, page objects, network mocking, config, auth fixtures
- [examples/page-objects.md](examples/page-objects.md) - Base page inheritance, hierarchy
- [examples/api-mocking.md](examples/api-mocking.md) - Response interception and modification
- [examples/visual-testing.md](examples/visual-testing.md) - Screenshot comparison, component visual testing
- [examples/fixtures.md](examples/fixtures.md) - Combined fixtures, database seeding, IndexedDB state
- [examples/advanced-features.md](examples/advanced-features.md) - Clock API, ARIA snapshots, worker fixtures, polling assertions, accessibility assertions
- [reference.md](reference.md) - Decision frameworks, locator/assertion tables, anti-patterns, CLI commands, configuration reference

---

<philosophy>

## Philosophy

Playwright E2E tests verify that your application works correctly from the user's perspective. They interact with the real browser, navigate through actual pages, and validate user-visible behavior.

**Core Principles:**

1. **Test user-visible behavior** - Focus on what end users see and interact with, not implementation details
2. **Use accessibility locators** - `getByRole` mirrors how screen readers and users interact with pages
3. **Isolate tests completely** - Each test has its own browser context, cookies, and storage
4. **Trust auto-waiting** - Playwright automatically waits for elements; no manual sleeps needed
5. **Mock external dependencies** - Use route interception for third-party APIs to ensure reliability

**When E2E tests provide the most value:**

- Critical business workflows (authentication, payments, core features)
- User journeys spanning multiple pages or components
- Testing real backend integration
- Cross-browser compatibility verification
- Catching integration bugs that unit tests miss

**When E2E tests may not be the best choice:**

- Testing pure utility functions (unit tests are faster and more precise)
- Testing component styling variants (use visual testing tools)
- Testing every edge case (balance with unit and integration tests)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Test Structure and Organization

Group related tests with `test.describe`, use `beforeEach` for common navigation, and name constants for all test data.

```typescript
const LOGIN_URL = "/login";
const VALID_EMAIL = "user@example.com";

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL);
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.getByLabel(/email/i).fill(VALID_EMAIL);
    // ... fill password, click sign in
    await expect(page).toHaveURL("/dashboard");
  });
});
```

**Why good:** Groups related tests logically, `beforeEach` maintains isolation, named constants prevent magic strings

See [examples/core.md](examples/core.md) Pattern 1 for complete user flow with error scenarios.

---

### Pattern 2: Page Object Model

Encapsulate page structure and interactions in reusable classes. Define locators in the constructor, expose domain-specific methods.

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

**Why good:** Centralizes locators -- UI changes update one place, methods encapsulate interactions

**When to use:** Tests spanning multiple interactions on the same page, reusable flows across test files.

**When not to use:** Simple one-off tests where inline locators are clearer.

See [examples/core.md](examples/core.md) Pattern 2 for full page objects with fixtures, [examples/page-objects.md](examples/page-objects.md) for base page inheritance.

---

### Pattern 3: Locator Strategies

Prioritize accessibility-based locators that mirror how users interact with the application.

```typescript
// BEST: Accessibility-based
await page.getByRole("button", { name: /submit/i });
await page.getByLabel(/email address/i);
await page.getByText(/welcome back/i);

// ACCEPTABLE: Test IDs for complex cases
await page.getByTestId("user-avatar"); // When no semantic role exists

// AVOID: Implementation-dependent
await page.locator("#submit-btn"); // Fragile
await page.locator(".btn-primary"); // CSS class can change
```

**Chaining and filtering** narrow down to specific elements without fragile selectors:

```typescript
await page
  .getByRole("listitem")
  .filter({ hasText: "Product A" })
  .getByRole("button", { name: /add to cart/i })
  .click();

// Exclude elements (v1.33+)
await page
  .getByRole("listitem")
  .filter({ hasNot: page.getByText("Out of stock") })
  .first()
  .click();

// Combine conditions (v1.33+)
const btn = page.getByRole("button").and(page.getByTitle("Subscribe"));
```

**Why good:** `getByRole` validates accessibility as a side effect, survives UI refactoring, chaining handles dynamic lists

See [reference.md](reference.md) for locator priority table and common ARIA role mappings.

---

### Pattern 4: Web-First Assertions

Use assertions that automatically wait and retry until the condition is met.

```typescript
// Auto-waits for element visibility
await expect(page.getByText("Welcome")).toBeVisible();
// Auto-waits for URL
await expect(page).toHaveURL(/\/dashboard/);
// Negated assertions also auto-wait
await expect(page.getByRole("progressbar")).not.toBeVisible();
```

**Why good:** Eliminates flaky tests from race conditions, no manual sleeps needed

```typescript
// BAD: Manual waiting
await page.waitForTimeout(2000); // Arbitrary sleep!
const text = await page.textContent(".result");
expect(text).toBe("Success"); // Non-waiting assertion
```

**Why bad:** Fixed timeouts are either too short (flaky) or too long (slow), doesn't adapt to actual page load time

**Soft assertions** collect all failures in one run:

```typescript
await expect.soft(page.getByTestId("avatar")).toBeVisible();
await expect.soft(page.getByText("Premium")).toBeVisible();
// Test continues, all failures reported at end
```

See [reference.md](reference.md) for complete assertion table, polling assertions, and accessibility assertions (v1.44+).

---

### Pattern 5: Network Mocking and Interception

Mock external APIs for reliable, isolated tests. Use `page.route()` to intercept and fulfill requests.

```typescript
const API_USERS = "**/api/users";

await page.route(API_USERS, (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "user-123", name: "John Doe" }),
  }),
);

// Error simulation
await page.route(API_USERS, (route) => route.abort("failed")); // Network failure
```

**Why good:** Eliminates third-party flakiness, enables testing error states, controls exact data

**Modifying real responses** (hybrid approach):

```typescript
await page.route("**/api/products", async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  json.products = json.products.map((p: { price: number }) => ({
    ...p,
    price: p.price * 0.9,
  }));
  await route.fulfill({ response, json });
});
```

See [examples/core.md](examples/core.md) Pattern 3 for complete mocking with error states, [examples/api-mocking.md](examples/api-mocking.md) for response modification.

---

### Pattern 6: Visual Regression Testing

Capture and compare screenshots to detect unintended visual changes.

```typescript
await expect(page).toHaveScreenshot("homepage.png");

// Mask dynamic content
await expect(page).toHaveScreenshot("dashboard.png", {
  mask: [page.getByTestId("current-time"), page.getByTestId("random-ad")],
});

// Disable animations for deterministic screenshots
await expect(page).toHaveScreenshot("stable.png", { animations: "disabled" });
```

**Why good:** Catches unintended visual changes, masking prevents false positives from timestamps

See [examples/visual-testing.md](examples/visual-testing.md) for component visual testing with state variations.

---

### Pattern 7: Custom Fixtures

Extend the base test with reusable fixtures for page objects, authentication, and shared setup.

```typescript
export const test = base.extend<{
  loginPage: LoginPage;
  authenticatedPage: void;
}>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  authenticatedPage: [
    async ({ context }, use) => {
      await context.addCookies([
        { name: "session", value: "token", domain: "localhost", path: "/" },
      ]);
      await use();
      await context.clearCookies();
    },
    { auto: true },
  ],
});
```

**Why good:** Encapsulates setup + teardown, auto fixtures eliminate repetitive auth, composable

See [examples/core.md](examples/core.md) Pattern 5 for auth fixtures, [examples/fixtures.md](examples/fixtures.md) for combined fixtures and database seeding, [examples/advanced-features.md](examples/advanced-features.md) for worker-scoped fixtures.

---

### Pattern 8: Clock API (v1.45+)

Control time for testing countdowns, session timeouts, and scheduled events.

```typescript
await page.clock.install({ time: new Date("2024-02-02T08:00:00") });
await page.goto("/dashboard");

await page.clock.fastForward("25:00"); // Jump 25 minutes
await expect(page.getByText(/session expires/i)).toBeVisible();
```

**CRITICAL:** `clock.install()` MUST be called before any other clock methods.

See [examples/advanced-features.md](examples/advanced-features.md) for countdown testing and session timeout patterns.

---

### Pattern 9: ARIA Snapshot Testing (v1.49+)

Validate accessibility tree structure programmatically.

```typescript
await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Products"
    - link "About"
`);
```

**Why good:** Catches ARIA issues before production, documents expected accessibility behavior

See [examples/advanced-features.md](examples/advanced-features.md) for complex component ARIA snapshots.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `page.waitForTimeout()` with fixed delays -- causes flaky or slow tests, use auto-waiting assertions instead
- Using CSS selectors like `.btn-primary` or `#submit-btn` -- fragile and break on refactoring, use `getByRole`
- Not testing error states -- only happy paths leaves error handling untested
- Tests sharing state or data -- causes flaky failures in parallel execution, isolate each test completely

**Medium Priority Issues:**

- Using `getByTestId` as primary locator -- misses accessibility validation, prioritize `getByRole`
- No network mocking for external APIs -- third-party flakiness affects your tests
- Running E2E tests only on one browser -- cross-browser issues go undetected
- Screenshots without masking dynamic content -- timestamps and ads cause false positives

**Common Mistakes:**

- Hardcoded test data scattered throughout files -- use named constants
- Testing implementation details (e.g., Redux state via `window.__REDUX_STATE__`) instead of user behavior
- Not using `beforeEach` for common setup -- leads to duplicated code
- Mixing E2E tests with unit tests in the same directory

**Gotchas & Edge Cases:**

- `toBeVisible()` auto-waits for the element; `toBeAttached()` checks DOM presence without visibility -- prefer visibility checks for most cases
- Screenshots vary by OS and browser -- run visual tests in consistent CI environment
- `beforeAll` runs once per **worker**, not once globally -- use `globalSetup` in config for true one-time setup
- Network routes are global to context -- routes set in `beforeEach` override previous; always set up fresh per test
- Parallel tests cannot share state -- use fixtures for per-test setup, not shared variables
- `toBeEditable()` throws on non-editable elements (v1.50+) -- verify element type first
- Glob URL patterns in `page.route()` no longer support `?` and `[]` (v1.52+) -- use regex instead
- `route.continue()` cannot override Cookie header (v1.52+) -- use `context.addCookies()` instead
- `_react` and `_vue` selectors removed (v1.58) -- use data-testid or role-based locators

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use getByRole() as your primary locator strategy - it mirrors how users interact with the page)**

**(You MUST test complete user workflows end-to-end - login flows, checkout processes, form submissions)**

**(You MUST use web-first assertions that auto-wait - toBeVisible(), toHaveText(), not manual sleeps)**

**(You MUST isolate tests - each test runs independently with its own browser context)**

**(You MUST use named constants for test data - no magic strings or numbers in test files)**

**Failure to follow these rules will result in flaky tests, false positives, and maintenance nightmares.**

</critical_reminders>
