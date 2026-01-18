# Cypress E2E Testing Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### When to Write E2E Tests

```
Is it a critical user workflow?
├─ YES → Write E2E test with Cypress
│   Examples: login, checkout, form submission, user registration
└─ NO → Is it a multi-page user journey?
    ├─ YES → Write E2E test with Cypress
    │   Examples: onboarding flow, multi-step wizard, search and filter
    └─ NO → Is it testing component behavior in isolation?
        ├─ YES → Use Cypress component testing (cy.mount)
        └─ NO → Is it a pure utility function?
            ├─ YES → Write unit test instead
            └─ NO → Is it testing API contracts?
                ├─ YES → Use cy.request() or dedicated API tests
                └─ NO → Evaluate based on risk and complexity
```

### Choosing Selector Strategy

```
Can you add a data-cy attribute?
├─ YES → Use data-cy (BEST)
│   Examples: [data-cy=submit-button], [data-cy=email-input]
└─ NO → Should text change fail the test?
    ├─ YES → Use cy.contains()
    │   Examples: cy.contains("Sign In"), cy.contains("button", "Submit")
    └─ NO → Is it a form element with a name?
        ├─ YES → Use input[name="..."]
        └─ NO → Is it a semantic element?
            ├─ YES → Use element type: button[type="submit"]
            └─ NO → Add data-cy attribute (go back to start)
                Note: CSS classes/IDs are last resort only
```

### Mocked vs Real API

```
Is it a third-party external API?
├─ YES → Mock it (unpredictable, rate limited, costs money)
└─ NO → Is it your own API?
    ├─ Testing specific error states?
    │   └─ YES → Mock the response with cy.intercept()
    ├─ Testing UI behavior only?
    │   └─ YES → Mock for speed and isolation
    └─ Testing true E2E integration?
        └─ YES → Use real API (one true E2E per feature)
```

### Test Isolation Strategy

```
Does the test need authenticated state?
├─ YES → Use cy.session() to cache login
│   Note: Cache is per-spec, not global
└─ NO → Does the test need specific database state?
    ├─ YES → Seed in beforeEach via cy.task() or API
    └─ NO → Does the test need specific UI state?
        ├─ YES → Set up in beforeEach via navigation/actions
        └─ NO → Start fresh with cy.visit()
```

---

## File Organization Reference

### Recommended Directory Structure

```
project/
├── cypress/
│   ├── e2e/                      # E2E test specs
│   │   ├── auth/                 # Tests by feature/journey
│   │   │   ├── login-flow.cy.ts
│   │   │   ├── registration.cy.ts
│   │   │   └── password-reset.cy.ts
│   │   ├── checkout/
│   │   │   ├── checkout-flow.cy.ts
│   │   │   ├── payment-errors.cy.ts
│   │   │   └── guest-checkout.cy.ts
│   │   └── search/
│   │       ├── product-search.cy.ts
│   │       └── filters.cy.ts
│   ├── fixtures/                 # Test data files
│   │   ├── users.json
│   │   ├── products.json
│   │   └── orders.json
│   ├── support/                  # Commands and setup
│   │   ├── commands.ts           # Custom commands
│   │   ├── e2e.ts                # E2E support file
│   │   ├── component.ts          # Component test support
│   │   └── index.d.ts            # TypeScript declarations
│   └── component/                # Component test specs
│       └── button.cy.tsx
├── cypress.config.ts
└── tsconfig.json
```

**Why this structure:** Tests organized by user journey (not by component), fixtures separated from specs, support files handle reusable setup

### File Naming Conventions

```
E2E tests:        *.cy.ts         (e.g., login-flow.cy.ts)
Component tests:  *.cy.tsx        (e.g., button.cy.tsx)
Fixtures:         *.json          (e.g., users.json)
Commands:         commands.ts     (single file recommended)
Types:            *.d.ts          (e.g., index.d.ts)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Arbitrary Waits

```typescript
// ANTI-PATTERN: Manual wait with arbitrary timeout
cy.get("[data-cy=submit-button]").click();
cy.wait(5000); // Arbitrary sleep!
cy.get("[data-cy=success-message]").should("be.visible");
```

**Why it's wrong:** Fixed timeouts are either too short (flaky tests) or too long (slow tests). They don't adapt to actual load times and hide real issues.

**What to do instead:** Use cy.intercept() aliases or rely on Cypress retry-ability:

```typescript
// CORRECT: Wait for specific request
cy.intercept("POST", "/api/submit").as("submitForm");
cy.get("[data-cy=submit-button]").click();
cy.wait("@submitForm");
cy.get("[data-cy=success-message]").should("be.visible");
```

---

### Anti-Pattern 2: Coupled Tests

```typescript
// ANTI-PATTERN: Tests depend on each other
let userId: string;

it("creates a user", () => {
  cy.request("POST", "/api/users", { name: "John" }).then((res) => {
    userId = res.body.id; // Stored for next test!
  });
});

it("updates the user", () => {
  // FAILS when run alone or in different order!
  cy.request("PUT", `/api/users/${userId}`, { name: "Jane" });
});
```

**Why it's wrong:** Tests fail when run in isolation, parallel execution causes race conditions, test order dependencies are fragile.

**What to do instead:** Each test should be completely independent:

```typescript
// CORRECT: Independent tests
it("updates a user", () => {
  // Create test data within the test
  cy.request("POST", "/api/users", { name: "John" }).then((res) => {
    const userId = res.body.id;
    cy.request("PUT", `/api/users/${userId}`, { name: "Jane" });
    // Cleanup in afterEach or next test's beforeEach
  });
});
```

---

### Anti-Pattern 3: Fragile CSS/ID Selectors

```typescript
// ANTI-PATTERN: Implementation-dependent selectors
cy.get("#submit-btn").click();
cy.get(".btn-primary").click();
cy.get("div.container > form > button:nth-child(2)").click();
```

**Why it's wrong:** CSS classes change during styling updates, IDs are implementation details, DOM structure selectors break on markup changes.

**What to do instead:** Use data-cy attributes:

```typescript
// CORRECT: Test-specific selectors
cy.get("[data-cy=submit-button]").click();

// Or custom command
cy.getBySel("submit-button").click();
```

---

### Anti-Pattern 4: Testing Implementation Details

```typescript
// ANTI-PATTERN: Testing internal state
cy.window().then((win) => {
  // Testing Redux state directly - implementation detail!
  expect(win.__REDUX_STATE__.user.isLoggedIn).to.be.true;
});
```

**Why it's wrong:** Tests break when internal state structure changes, doesn't verify what users see, couples tests to implementation.

**What to do instead:** Test user-visible behavior:

```typescript
// CORRECT: Test visible behavior
cy.get("[data-cy=user-avatar]").should("be.visible");
cy.get("[data-cy=logout-button]").should("exist");
```

---

### Anti-Pattern 5: Using const for Async Values

```typescript
// ANTI-PATTERN: Assigning command result to const
const button = cy.get("[data-cy=submit-button]");
cy.visit("/");
button.click(); // FAILS - button is not a Promise
```

**Why it's wrong:** Cypress commands are async but don't return Promises. The chain is queued, not executed immediately.

**What to do instead:** Use aliases:

```typescript
// CORRECT: Use aliases
cy.get("[data-cy=submit-button]").as("submitBtn");
cy.visit("/");
cy.get("@submitBtn").click();
```

---

### Anti-Pattern 6: Cleanup in afterEach

```typescript
// ANTI-PATTERN: Cleanup in after hooks
afterEach(() => {
  cy.request("DELETE", "/api/test-data");
});
```

**Why it's wrong:** No guarantee execution occurs if test crashes or is stopped mid-run. Removes debuggability.

**What to do instead:** Put cleanup in beforeEach:

```typescript
// CORRECT: Cleanup in beforeEach
beforeEach(() => {
  cy.request("DELETE", "/api/test-data"); // Clean before each test
  cy.visit("/");
});
```

---

## Selector Priority Reference

| Priority | Selector Type | Example | Use When |
|----------|--------------|---------|----------|
| 1 | `data-cy` | `[data-cy=submit]` | ALWAYS - default choice |
| 2 | `cy.contains()` | `cy.contains("Submit")` | Text change should fail test |
| 3 | `name` attribute | `input[name="email"]` | Form elements |
| 4 | Semantic elements | `button[type="submit"]` | No data-cy, semantic meaning |
| 5 | CSS class | `.btn-primary` | AVOID - coupled to styling |
| 6 | ID | `#submit-btn` | AVOID - implementation detail |
| 7 | DOM structure | `div > button:first` | NEVER - extremely fragile |

---

## Assertion Best Practices Reference

### Common Assertions

| Assertion | Use For | Example |
|-----------|---------|---------|
| `should("be.visible")` | Element is visible | `cy.getBySel("modal").should("be.visible")` |
| `should("not.exist")` | Element not in DOM | `cy.getBySel("error").should("not.exist")` |
| `should("be.disabled")` | Disabled state | `cy.getBySel("submit").should("be.disabled")` |
| `should("have.value")` | Input value | `cy.getBySel("email").should("have.value", "test@example.com")` |
| `should("contain")` | Contains text | `cy.getBySel("message").should("contain", "Success")` |
| `should("have.length")` | List count | `cy.getBySel("item").should("have.length", 5)` |
| `should("have.class")` | Has CSS class | `cy.getBySel("tab").should("have.class", "active")` |
| `should("have.attr")` | Has attribute | `cy.getBySel("link").should("have.attr", "href", "/home")` |

### URL Assertions

```typescript
cy.url().should("include", "/dashboard");
cy.url().should("eq", "http://localhost:3000/dashboard");
cy.location("pathname").should("eq", "/dashboard");
```

### Chained Assertions

```typescript
cy.getBySel("email-input")
  .should("be.visible")
  .and("have.attr", "type", "email")
  .and("have.value", "");
```

---

## Cypress 14+ Requirements

### cy.origin() for Multi-Origin Tests

Cypress 14 requires `cy.origin()` for any test that navigates across different origins (scheme + hostname + port).

```typescript
// Required for OAuth, SSO, or any cross-origin navigation
cy.visit("/login");
cy.getBySel("oauth-button").click();

cy.origin("https://auth.provider.com", { args: { email, password } }, ({ email, password }) => {
  cy.get("#email").type(email);
  cy.get("#password").type(password);
  cy.get("#submit").click();
});

// Back on original origin
cy.url().should("include", "/dashboard");
```

**Why required:** Chrome deprecated `document.domain`, which Cypress previously used for cross-origin testing.

### Deprecated in Cypress 14

| Deprecated | Replacement | Notes |
|------------|-------------|-------|
| `resourceType` on `cy.intercept()` | Use route matching instead | Deprecated in v14.0.0, may be removed in future |
| `injectDocumentDomain` config | Use `cy.origin()` for multi-origin tests | Chrome deprecated document.domain |
| `Cypress.Commands.overwrite()` for queries | Use `Cypress.Commands.overwriteQuery()` | Queries include .get(), .find(), .contains(), cy.location(), cy.window() |
| Vue 2 support | Use `@cypress/vue2` package | Component testing only |
| React < 18 support | Use `@cypress/react@8.x.x` package | Component testing only |
| Angular < 17.2.0 support | Use `@cypress/angular@2.x.x` package | Component testing only |

### Minimum Requirements (Cypress 14)

- Node.js 18+
- macOS 11 (Big Sur)+
- React 18.0.0+ (for component testing)
- Angular 17.2.0+ (for component testing)
- Vue 3+ (for component testing)

---

## Configuration Quick Reference

### Essential Configuration Options

| Option | Description | Recommended Value |
|--------|-------------|-------------------|
| `baseUrl` | Base URL for cy.visit() | `"http://localhost:3000"` |
| `defaultCommandTimeout` | Command timeout (ms) | `4000` |
| `pageLoadTimeout` | Page load timeout (ms) | `10000` |
| `retries.runMode` | Retries in CI | `2` |
| `retries.openMode` | Retries in interactive | `0` |
| `video` | Record video | `false` (enable in CI if needed) |
| `screenshotOnRunFailure` | Screenshot on failure | `true` |

### CLI Commands

```bash
# Open interactive test runner
npx cypress open

# Run all tests headlessly
npx cypress run

# Run specific spec file
npx cypress run --spec "cypress/e2e/auth/**/*.cy.ts"

# Run in specific browser
npx cypress run --browser chrome

# Run with environment variables
npx cypress run --env apiUrl=http://localhost:4000

# Run component tests
npx cypress run --component
```

---

## Troubleshooting Common Issues

### Issue: Tests Are Flaky

**Symptoms:** Tests pass sometimes and fail other times without code changes.

**Common Causes:**
1. Using `cy.wait(ms)` with fixed delays
2. Race conditions in async operations
3. Tests sharing state via variables
4. External API reliability issues

**Solutions:**
- Replace `cy.wait(ms)` with `cy.wait("@alias")` using cy.intercept()
- Use `should()` assertions that retry automatically
- Ensure test isolation (each it() independent)
- Mock external APIs with cy.intercept()

### Issue: Selectors Not Finding Elements

**Symptoms:** `Timed out retrying: Expected to find element` errors.

**Common Causes:**
1. Element not visible (hidden, loading)
2. Element inside iframe
3. Wrong selector strategy
4. Element rendered conditionally

**Solutions:**
- Verify element exists with Cypress Test Runner
- For iframes, use `cy.iframe()` plugin
- Check if element is conditionally rendered
- Use more specific selectors with data-cy

### Issue: CI Tests Fail But Local Pass

**Symptoms:** Tests work locally but fail in GitHub Actions.

**Common Causes:**
1. Timing differences (CI is slower)
2. Missing environment variables
3. Browser differences
4. Database/API state differences

**Solutions:**
- Increase timeouts for CI: `defaultCommandTimeout: 10000`
- Use retries: `retries: { runMode: 2, openMode: 0 }`
- Mock APIs in CI for determinism
- Seed database in beforeEach
