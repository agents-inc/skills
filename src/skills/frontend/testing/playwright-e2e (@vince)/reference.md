# Playwright E2E Testing Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### When to Write E2E Tests

```
Is it a critical user workflow?
├─ YES → Write E2E test with Playwright
│   Examples: login, checkout, form submission, user registration
└─ NO → Is it a multi-page user journey?
    ├─ YES → Write E2E test with Playwright
    │   Examples: onboarding flow, multi-step wizard, search and filter
    └─ NO → Is it testing real backend integration?
        ├─ YES → Consider E2E test or integration test
        └─ NO → Is it a pure utility function?
            ├─ YES → Write unit test instead
            └─ NO → Is it component rendering logic?
                ├─ YES → Consider component testing or integration test
                └─ NO → Evaluate based on risk and complexity
```

### Choosing Locator Strategy

```
Can you identify the element by its role?
├─ YES → Use getByRole() (BEST)
│   Examples: button, link, heading, textbox, checkbox
└─ NO → Does it have an accessible label?
    ├─ YES → Use getByLabel() (form elements)
    └─ NO → Does it have visible text?
        ├─ YES → Use getByText()
        └─ NO → Does it have a placeholder?
            ├─ YES → Use getByPlaceholder()
            └─ NO → Does it have alt text (images)?
                ├─ YES → Use getByAltText()
                └─ NO → Add data-testid and use getByTestId()
                    Note: Only as last resort
```

### Choosing Between Hooks and Fixtures

```
Is the setup reusable across multiple test files?
├─ YES → Use fixtures
│   Benefits: Encapsulation, reusability, composition
└─ NO → Is it setup for a single describe block?
    ├─ YES → Use beforeEach/beforeAll hooks
    │   Benefits: Simpler, more explicit
    └─ NO → Is it one-time global setup?
        ├─ YES → Use globalSetup in playwright.config.ts
        └─ NO → Inline setup in individual tests
```

### Mocking vs Real API

```
Is it a third-party external API?
├─ YES → Mock it (unpredictable, rate limited, costs money)
└─ NO → Is it your own API?
    ├─ Testing specific error states?
    │   └─ YES → Mock the response
    ├─ Testing integration correctness?
    │   └─ YES → Use real API (with test database)
    └─ Testing UI behavior only?
        └─ YES → Mock for speed and isolation
```

---

## File Organization Reference

### Recommended Directory Structure

```
project/
├── tests/
│   └── e2e/
│       ├── fixtures/              # Custom fixtures
│       │   ├── auth.ts
│       │   ├── database.ts
│       │   └── index.ts           # Combined exports
│       ├── pages/                 # Page Object Models
│       │   ├── base-page.ts
│       │   ├── login-page.ts
│       │   ├── dashboard-page.ts
│       │   └── checkout-page.ts
│       ├── auth/                  # Tests by feature/journey
│       │   ├── login-flow.spec.ts
│       │   ├── registration.spec.ts
│       │   └── password-reset.spec.ts
│       ├── checkout/
│       │   ├── checkout-flow.spec.ts
│       │   ├── payment-errors.spec.ts
│       │   └── guest-checkout.spec.ts
│       ├── search/
│       │   ├── product-search.spec.ts
│       │   └── filters.spec.ts
│       └── visual/                # Visual regression tests
│           ├── homepage.spec.ts
│           └── components.spec.ts
├── playwright.config.ts
└── playwright-report/             # Generated reports (gitignored)
```

**Why this structure:** Tests organized by user journey (not by component), page objects separated from tests, fixtures are reusable across all tests, visual tests in dedicated directory

### File Naming Conventions

```
Feature tests:     *.spec.ts        (e.g., login-flow.spec.ts)
Smoke tests:       *.smoke.ts       (e.g., critical-paths.smoke.ts)
Mobile tests:      *.mobile.spec.ts (e.g., navigation.mobile.spec.ts)
Visual tests:      *.visual.spec.ts (e.g., buttons.visual.spec.ts)
Page objects:      *-page.ts        (e.g., login-page.ts)
Fixtures:          *.ts             (e.g., auth.ts, database.ts)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Fixed Timeouts

```typescript
// ANTI-PATTERN: Manual wait with arbitrary timeout
test("bad: uses waitForTimeout", async ({ page }) => {
  await page.click("button");
  await page.waitForTimeout(3000); // Arbitrary sleep!
  await expect(page.locator(".result")).toBeVisible();
});
```

**Why it's wrong:** Fixed timeouts are either too short (flaky tests) or too long (slow tests), they don't adapt to actual page load times, and they hide actual issues with page responsiveness.

**What to do instead:** Use auto-waiting assertions that retry until success or timeout:

```typescript
// CORRECT: Auto-waiting assertion
test("good: uses auto-waiting assertion", async ({ page }) => {
  await page.getByRole("button").click();
  await expect(page.getByText("Success")).toBeVisible();
});
```

---

### Anti-Pattern 2: Fragile CSS/ID Selectors

```typescript
// ANTI-PATTERN: Implementation-dependent selectors
test("bad: fragile selectors", async ({ page }) => {
  await page.locator("#submit-btn").click();
  await page.locator(".form-field-email").fill("test@example.com");
  await page.locator("div.container > form > button:nth-child(3)").click();
});
```

**Why it's wrong:** CSS classes change during styling updates, IDs are implementation details that refactoring might change, DOM structure selectors break when markup changes.

**What to do instead:** Use accessibility-based locators:

```typescript
// CORRECT: Accessibility-based locators
test("good: semantic locators", async ({ page }) => {
  await page.getByRole("button", { name: /submit/i }).click();
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByRole("button", { name: /confirm/i }).click();
});
```

---

### Anti-Pattern 3: Tests That Share State

```typescript
// ANTI-PATTERN: Tests depend on each other
let userId: string;

test("create user", async ({ page }) => {
  // Creates user and stores ID
  userId = await createUser(page);
});

test("edit user profile", async ({ page }) => {
  // FAILS if run alone or in different order!
  await page.goto(`/users/${userId}/edit`);
});
```

**Why it's wrong:** Tests fail when run in isolation, parallel execution causes race conditions, test order dependencies are fragile and confusing.

**What to do instead:** Each test should be completely independent:

```typescript
// CORRECT: Independent tests
test("edit user profile", async ({ page }) => {
  // Create test data within the test
  const userId = await createTestUser();

  await page.goto(`/users/${userId}/edit`);
  // ... rest of test

  // Cleanup
  await deleteTestUser(userId);
});
```

---

### Anti-Pattern 4: Testing Implementation Details

```typescript
// ANTI-PATTERN: Testing internal state
test("bad: tests implementation details", async ({ page }) => {
  await page.goto("/counter");
  await page.getByRole("button", { name: /increment/i }).click();

  // Testing internal state object
  const state = await page.evaluate(() => window.__REDUX_STATE__);
  expect(state.counter).toBe(1); // Implementation detail!
});
```

**Why it's wrong:** Tests break when internal state structure changes, doesn't verify what users actually see, couples tests to implementation rather than behavior.

**What to do instead:** Test user-visible behavior:

```typescript
// CORRECT: Test visible behavior
test("good: tests what user sees", async ({ page }) => {
  await page.goto("/counter");
  await page.getByRole("button", { name: /increment/i }).click();

  await expect(page.getByText("Count: 1")).toBeVisible();
});
```

---

### Anti-Pattern 5: Only Testing Happy Paths

```typescript
// ANTI-PATTERN: Only happy path
test("user can login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("user@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/dashboard");
  // Missing: validation errors, invalid credentials, network errors
});
```

**Why it's wrong:** Real users encounter errors, error handling code goes untested, production bugs in error states go undetected until users report them.

**What to do instead:** Test error scenarios alongside happy paths:

```typescript
// CORRECT: Comprehensive error testing
test.describe("Login", () => {
  test("successful login", async ({ page }) => {
    // Happy path...
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid/i);
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test("handles network failure", async ({ page }) => {
    await page.route("**/api/auth/**", (route) => route.abort("failed"));
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("user@example.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/network error/i)).toBeVisible();
  });
});
```

---

### Anti-Pattern 6: Overusing data-testid

```typescript
// ANTI-PATTERN: data-testid everywhere
test("bad: relies on testids", async ({ page }) => {
  await page.getByTestId("login-form").click();
  await page.getByTestId("email-input").fill("test@example.com");
  await page.getByTestId("password-input").fill("password");
  await page.getByTestId("submit-button").click();
  await page.getByTestId("welcome-message").toBeVisible();
});
```

**Why it's wrong:** Misses accessibility validation (getByRole validates ARIA roles), reduces test readability (testids don't convey meaning), creates maintenance burden (testids added everywhere).

**What to do instead:** Prioritize semantic locators, use testid only when necessary:

```typescript
// CORRECT: Semantic locators with testid fallback
test("good: semantic locators", async ({ page }) => {
  await page.getByRole("form", { name: /login/i }).click();
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

  // testid only for elements without semantic meaning
  const avatar = page.getByTestId("user-avatar"); // No semantic role exists
});
```

---

### Anti-Pattern 7: Not Cleaning Up Test Data

```typescript
// ANTI-PATTERN: Tests leave data behind
test("creates new order", async ({ page }) => {
  await page.goto("/checkout");
  // ... creates order
  // Order stays in database forever!
});
```

**Why it's wrong:** Database fills with test data, subsequent tests may fail due to data conflicts, staging environments become polluted.

**What to do instead:** Clean up in afterEach or use fixtures with teardown:

```typescript
// CORRECT: Cleanup with fixtures
const test = base.extend<{ orderId: string }>({
  orderId: async ({ request }, use) => {
    // Setup: Create order
    const response = await request.post("/api/test/orders");
    const { id } = await response.json();

    await use(id);

    // Teardown: Delete order
    await request.delete(`/api/test/orders/${id}`);
  },
});

test("can view order details", async ({ page, orderId }) => {
  await page.goto(`/orders/${orderId}`);
  // Order will be cleaned up automatically
});
```

---

## Locator Best Practices Reference

### Priority Order (Best to Worst)

| Priority | Locator | Use When | Example |
|----------|---------|----------|---------|
| 1 | `getByRole()` | Element has semantic role | `getByRole('button', { name: /submit/i })` |
| 2 | `getByLabel()` | Form elements with labels | `getByLabel(/email address/i)` |
| 3 | `getByText()` | Unique visible text | `getByText(/welcome back/i)` |
| 4 | `getByPlaceholder()` | Input with placeholder | `getByPlaceholder('Search...')` |
| 5 | `getByAltText()` | Images with alt text | `getByAltText('Company logo')` |
| 6 | `getByTitle()` | Element with title attribute | `getByTitle('Close dialog')` |
| 7 | `getByTestId()` | No semantic role available | `getByTestId('user-avatar')` |
| 8 | CSS/XPath | Legacy, avoid | `locator('.btn-primary')` |

### Common Role Mappings

| HTML Element | ARIA Role | Example Locator |
|--------------|-----------|-----------------|
| `<button>` | button | `getByRole('button', { name: /submit/i })` |
| `<a>` | link | `getByRole('link', { name: /home/i })` |
| `<h1>-<h6>` | heading | `getByRole('heading', { name: /title/i })` |
| `<input type="text">` | textbox | `getByRole('textbox', { name: /email/i })` |
| `<input type="checkbox">` | checkbox | `getByRole('checkbox', { name: /agree/i })` |
| `<select>` | combobox | `getByRole('combobox', { name: /country/i })` |
| `<table>` | table | `getByRole('table', { name: /users/i })` |
| `<tr>` | row | `getByRole('row')` |
| `<nav>` | navigation | `getByRole('navigation')` |
| `<main>` | main | `getByRole('main')` |
| `<aside>` | complementary | `getByRole('complementary')` |
| `<header>` | banner | `getByRole('banner')` |
| `<footer>` | contentinfo | `getByRole('contentinfo')` |
| `<dialog>` | dialog | `getByRole('dialog')` |
| `<ul>`, `<ol>` | list | `getByRole('list')` |
| `<li>` | listitem | `getByRole('listitem')` |

---

## Assertion Best Practices Reference

### Auto-Waiting Assertions (Recommended)

| Assertion | Use For | Example |
|-----------|---------|---------|
| `toBeVisible()` | Element is visible | `await expect(button).toBeVisible()` |
| `toBeHidden()` | Element is hidden | `await expect(modal).toBeHidden()` |
| `toBeEnabled()` | Element is enabled | `await expect(button).toBeEnabled()` |
| `toBeDisabled()` | Element is disabled | `await expect(button).toBeDisabled()` |
| `toBeChecked()` | Checkbox/radio checked | `await expect(checkbox).toBeChecked()` |
| `toHaveText()` | Text content matches | `await expect(heading).toHaveText('Title')` |
| `toContainText()` | Contains text | `await expect(paragraph).toContainText('hello')` |
| `toHaveValue()` | Input value | `await expect(input).toHaveValue('test')` |
| `toHaveAttribute()` | Attribute exists/matches | `await expect(link).toHaveAttribute('href', '/home')` |
| `toHaveClass()` | Has CSS class | `await expect(button).toHaveClass('active')` |
| `toHaveCount()` | Number of elements | `await expect(items).toHaveCount(5)` |
| `toHaveURL()` | Page URL matches | `await expect(page).toHaveURL('/dashboard')` |
| `toHaveTitle()` | Page title | `await expect(page).toHaveTitle('Home')` |
| `toHaveScreenshot()` | Visual match | `await expect(page).toHaveScreenshot('home.png')` |

### Negated Assertions

```typescript
// All assertions can be negated with .not
await expect(element).not.toBeVisible();
await expect(page).not.toHaveURL('/login');
await expect(button).not.toBeDisabled();
```

### Soft Assertions

```typescript
// Continue test after failure, report all at end
await expect.soft(element1).toBeVisible();
await expect.soft(element2).toHaveText('Expected');
await expect.soft(element3).toBeEnabled();
// Test continues even if above fail
```

---

## Configuration Quick Reference

### Essential Configuration Options

| Option | Description | Recommended Value |
|--------|-------------|-------------------|
| `testDir` | Test files location | `'./tests/e2e'` |
| `fullyParallel` | Run all tests in parallel | `true` |
| `forbidOnly` | Fail if test.only in CI | `!!process.env.CI` |
| `retries` | Retry failed tests | `process.env.CI ? 2 : 0` |
| `workers` | Parallel worker count | `process.env.CI ? 2 : undefined` |
| `timeout` | Test timeout (ms) | `30000` |
| `expect.timeout` | Assertion timeout (ms) | `5000` |
| `use.baseURL` | Base URL for navigation | `'http://localhost:3000'` |
| `use.trace` | When to capture trace | `'on-first-retry'` |
| `use.screenshot` | When to capture screenshot | `'only-on-failure'` |
| `use.video` | When to capture video | `'retain-on-failure'` |

### CLI Commands

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/auth/login.spec.ts

# Run tests matching pattern
npx playwright test -g "login"

# Run in headed mode (see browser)
npx playwright test --headed

# Run in UI mode (interactive)
npx playwright test --ui

# Run in debug mode
npx playwright test --debug

# Run specific project
npx playwright test --project=chromium

# Run with specific workers
npx playwright test --workers=4

# Run with sharding (CI)
npx playwright test --shard=1/4

# Update snapshots
npx playwright test --update-snapshots

# Generate test code
npx playwright codegen http://localhost:3000

# Show HTML report
npx playwright show-report

# View trace file
npx playwright show-trace trace.zip
```

---

## Troubleshooting Common Issues

### Issue: Tests Are Flaky

**Symptoms:** Tests pass sometimes and fail other times without code changes.

**Common Causes:**
1. Using `waitForTimeout()` with fixed delays
2. Race conditions in async operations
3. Tests sharing state
4. Network timing issues

**Solutions:**
- Replace `waitForTimeout()` with auto-waiting assertions
- Use `await expect().toBeVisible()` instead of checking immediately
- Ensure test isolation (each test gets fresh context)
- Mock external APIs for deterministic behavior

### Issue: Locators Not Finding Elements

**Symptoms:** `Timeout waiting for locator` errors.

**Common Causes:**
1. Element not visible (hidden, loading)
2. Element inside iframe or shadow DOM
3. Wrong locator strategy

**Solutions:**
- Verify element exists with browser DevTools
- Check if element is in iframe: `page.frameLocator()`
- Check if element is in shadow DOM: `page.locator('my-component').locator('internal-element')`
- Use more specific locators with filtering

### Issue: Visual Tests Fail on CI

**Symptoms:** Screenshots differ between local and CI.

**Common Causes:**
1. Different browser versions
2. Different operating systems
3. Different font rendering
4. Dynamic content (timestamps, ads)

**Solutions:**
- Run tests in Docker for consistent environment
- Update baseline screenshots on CI
- Mask dynamic content: `toHaveScreenshot({ mask: [...] })`
- Use `maxDiffPixels` for acceptable variation

### Issue: Tests Run Slowly

**Symptoms:** Test suite takes too long to complete.

**Common Causes:**
1. Sequential execution when parallel is possible
2. Unnecessary `waitForTimeout()` calls
3. Loading full pages for small checks
4. Not reusing authentication

**Solutions:**
- Enable `fullyParallel: true`
- Remove all `waitForTimeout()` calls
- Use API calls for setup instead of UI
- Store authenticated state and reuse
