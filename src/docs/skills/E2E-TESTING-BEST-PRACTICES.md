# E2E Testing Best Practices - Research Document

> **Purpose**: Comprehensive patterns for creating atomic E2E testing skills
> **Last Updated**: 2026-01-15
> **Sources**: Playwright docs, Cypress docs, BrowserStack, Chromatic, industry best practices

---

## Table of Contents

1. [Playwright Patterns](#1-playwright-patterns)
2. [Cypress Patterns](#2-cypress-patterns)
3. [Test Organization Patterns](#3-test-organization-patterns)
4. [Visual Regression Testing](#4-visual-regression-testing)
5. [Cross-Browser Testing Strategies](#5-cross-browser-testing-strategies)
6. [CI/CD Integration](#6-cicd-integration-for-e2e-tests)
7. [Accessibility Testing](#7-accessibility-testing-in-e2e)
8. [Performance Testing](#8-performance-testing-in-e2e)
9. [Mobile/Responsive Testing](#9-mobileresponsive-testing)
10. [Test Data Management](#10-test-data-management)

---

## 1. Playwright Patterns

### 1.1 Page Object Model (POM)

**Core Pattern**: Encapsulate page structure and interactions within dedicated classes.

```typescript
// pages/login.page.ts
import { type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage() {
    return this.errorMessage.textContent();
  }
}
```

```typescript
// pages/base.page.ts - Base class for common functionality
import { type Page, type Locator } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly header: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('banner');
    this.footer = page.getByRole('contentinfo');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}
```

**Anti-patterns to Avoid**:
- Putting assertions in page objects (keep them in tests)
- Creating page objects that are too granular (one per component)
- Using CSS/XPath selectors instead of semantic locators
- Not using async/await properly with Playwright actions

**When to Use**:
- Multi-page applications with shared UI elements
- Tests that navigate through multiple screens
- When multiple tests interact with the same page

**When NOT to Use**:
- Simple single-page tests
- Tests that only verify API responses
- Component-level testing

### 1.2 Custom Fixtures

**Core Pattern**: Extend Playwright's test object with custom fixtures for reusable setup.

```typescript
// fixtures/test-fixtures.ts
import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

// Declare fixture types
type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  // Page object fixtures
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  // Authenticated page fixture - handles login once
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASSWORD!
    );
    await page.waitForURL('/dashboard');
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

```typescript
// fixtures/auth.fixture.ts - Worker-scoped authentication
import { test as base } from '@playwright/test';
import path from 'path';

const STORAGE_STATE = path.join(__dirname, '../.auth/user.json');

export const test = base.extend<{}, { workerStorageState: string }>({
  // Worker-scoped fixture - runs once per worker
  workerStorageState: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Perform authentication
      await page.goto('/login');
      await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
      await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('/dashboard');

      // Save storage state
      await context.storageState({ path: STORAGE_STATE });
      await context.close();

      await use(STORAGE_STATE);
    },
    { scope: 'worker' },
  ],

  // Use the stored state for all tests
  storageState: async ({ workerStorageState }, use) => {
    await use(workerStorageState);
  },
});
```

```typescript
// fixtures/multi-user.fixture.ts - Multiple users in same test
import { test as base, type BrowserContext, type Page } from '@playwright/test';

type MultiUserFixtures = {
  adminContext: BrowserContext;
  adminPage: Page;
  userContext: BrowserContext;
  userPage: Page;
};

export const test = base.extend<MultiUserFixtures>({
  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/admin.json',
    });
    await use(context);
    await context.close();
  },

  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    await use(page);
  },

  userContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/user.json',
    });
    await use(context);
    await context.close();
  },

  userPage: async ({ userContext }, use) => {
    const page = await userContext.newPage();
    await use(page);
  },
});
```

**Anti-patterns to Avoid**:
- Using test-scoped fixtures for expensive operations (use worker-scoped)
- Creating circular fixture dependencies
- Not cleaning up resources in fixture teardown
- Overlapping fixture names with Playwright built-ins

**When to Use**:
- Shared setup across multiple test files
- Authentication state management
- Database seeding and cleanup
- Multi-user/multi-role testing scenarios

**When NOT to Use**:
- One-off test setup
- Simple tests that don't need shared state

### 1.3 Test Isolation

**Core Pattern**: Each test should be independent and not rely on other tests.

```typescript
// tests/cart.spec.ts - Isolated test example
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Shopping Cart', () => {
  // Each test gets a fresh browser context
  test.beforeEach(async ({ page }) => {
    // API-based setup instead of UI navigation
    await page.request.post('/api/test/seed', {
      data: { products: ['product-1', 'product-2'] },
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await page.request.delete('/api/test/cleanup');
  });

  test('should add item to cart', async ({ page }) => {
    await page.goto('/products/product-1');
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('should remove item from cart', async ({ page }) => {
    // Setup: Add item via API (not dependent on previous test)
    await page.request.post('/api/cart/add', {
      data: { productId: 'product-1' },
    });

    await page.goto('/cart');
    await page.getByRole('button', { name: 'Remove' }).click();

    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });
});
```

```typescript
// playwright.config.ts - Isolation configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Each test gets a new browser context
  use: {
    // Fresh context per test (default)
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },

  // Parallel execution - tests don't share state
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,

  // Prevent test interdependencies
  forbidOnly: !!process.env.CI,

  // Retry flaky tests
  retries: process.env.CI ? 2 : 0,
});
```

**Anti-patterns to Avoid**:
- Tests that depend on execution order
- Shared mutable state between tests
- Using `test.only` or `test.skip` without reason
- Not cleaning up after tests

**When to Use**:
- Always - isolation should be the default

---

## 2. Cypress Patterns

### 2.1 Custom Commands

**Core Pattern**: Create reusable commands that extend Cypress's `cy` object.

```typescript
// cypress/support/commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      dataCy(selector: string): Chainable<JQuery<HTMLElement>>;
      interceptApi(method: string, url: string, fixture?: string): Chainable<void>;
    }
  }
}

// Login command - handles authentication
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-cy="email-input"]').type(email);
    cy.get('[data-cy="password-input"]').type(password);
    cy.get('[data-cy="submit-button"]').click();
    cy.url().should('include', '/dashboard');
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="user-menu"]').click();
  cy.get('[data-cy="logout-button"]').click();
  cy.url().should('include', '/login');
});

// Data attribute selector shorthand
Cypress.Commands.add('dataCy', (selector: string) => {
  return cy.get(`[data-cy="${selector}"]`);
});

// API interception helper
Cypress.Commands.add('interceptApi', (method: string, url: string, fixture?: string) => {
  if (fixture) {
    cy.intercept(method, url, { fixture }).as(url.replace(/\//g, '_'));
  } else {
    cy.intercept(method, url).as(url.replace(/\//g, '_'));
  }
});

export {};
```

```typescript
// cypress/support/commands/api.commands.ts - Organized by domain
declare global {
  namespace Cypress {
    interface Chainable {
      apiLogin(email: string, password: string): Chainable<void>;
      apiCreateUser(userData: UserData): Chainable<{ id: string }>;
      apiDeleteUser(userId: string): Chainable<void>;
    }
  }
}

interface UserData {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

// API-based login (faster than UI)
Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  }).then((response) => {
    window.localStorage.setItem('token', response.body.token);
  });
});

// Create user via API for test setup
Cypress.Commands.add('apiCreateUser', (userData: UserData) => {
  return cy.request({
    method: 'POST',
    url: '/api/test/users',
    body: userData,
    headers: {
      Authorization: `Bearer ${Cypress.env('ADMIN_TOKEN')}`,
    },
  }).then((response) => response.body);
});

// Delete user for cleanup
Cypress.Commands.add('apiDeleteUser', (userId: string) => {
  return cy.request({
    method: 'DELETE',
    url: `/api/test/users/${userId}`,
    headers: {
      Authorization: `Bearer ${Cypress.env('ADMIN_TOKEN')}`,
    },
  });
});

export {};
```

**Anti-patterns to Avoid**:
- Creating commands for single-use operations
- Not adding TypeScript type declarations
- Overly complex commands that should be broken into smaller ones
- Using commands when a simple function would suffice

**When to Use**:
- Repeated interactions across multiple tests
- Domain-specific language for your application
- Complex multi-step operations

**When NOT to Use**:
- Single-use test logic
- Simple operations that Cypress already handles
- When a utility function is more appropriate

### 2.2 Network Interception (cy.intercept)

**Core Pattern**: Control and mock network requests for reliable testing.

```typescript
// cypress/e2e/api-mocking.cy.ts
describe('API Mocking Patterns', () => {
  // Basic interception with fixture
  it('should display users from fixture', () => {
    cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');

    cy.visit('/users');
    cy.wait('@getUsers');

    cy.dataCy('user-list').should('have.length', 3);
  });

  // Dynamic response based on request
  it('should handle search with dynamic response', () => {
    cy.intercept('GET', '/api/users/search*', (req) => {
      const searchTerm = req.query.q;
      req.reply({
        body: [
          { id: 1, name: `Result for ${searchTerm}` },
        ],
      });
    }).as('searchUsers');

    cy.visit('/users');
    cy.dataCy('search-input').type('john');
    cy.wait('@searchUsers');

    cy.dataCy('user-item').should('contain', 'Result for john');
  });

  // Error handling
  it('should handle API errors gracefully', () => {
    cy.intercept('GET', '/api/users', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getUsersError');

    cy.visit('/users');
    cy.wait('@getUsersError');

    cy.dataCy('error-message').should('be.visible');
    cy.dataCy('retry-button').should('be.visible');
  });

  // Network delay simulation
  it('should show loading state during slow requests', () => {
    cy.intercept('GET', '/api/users', {
      fixture: 'users.json',
      delay: 2000,
    }).as('getUsers');

    cy.visit('/users');
    cy.dataCy('loading-spinner').should('be.visible');
    cy.wait('@getUsers');
    cy.dataCy('loading-spinner').should('not.exist');
  });

  // Modify real responses
  it('should modify response data', () => {
    cy.intercept('GET', '/api/users', (req) => {
      req.continue((res) => {
        // Add a test user to the real response
        res.body.push({ id: 999, name: 'Test User' });
      });
    }).as('getUsers');

    cy.visit('/users');
    cy.wait('@getUsers');

    cy.dataCy('user-item').should('contain', 'Test User');
  });
});
```

```typescript
// cypress/support/intercepts.ts - Reusable intercept configurations
export const mockUserApi = () => {
  cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');
  cy.intercept('GET', '/api/users/*', { fixture: 'user-detail.json' }).as('getUser');
  cy.intercept('POST', '/api/users', { statusCode: 201, body: { id: 1 } }).as('createUser');
  cy.intercept('PUT', '/api/users/*', { statusCode: 200 }).as('updateUser');
  cy.intercept('DELETE', '/api/users/*', { statusCode: 204 }).as('deleteUser');
};

export const mockAuthApi = () => {
  cy.intercept('POST', '/api/auth/login', { fixture: 'auth/login.json' }).as('login');
  cy.intercept('POST', '/api/auth/logout', { statusCode: 200 }).as('logout');
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth/current-user.json' }).as('getCurrentUser');
};

// Usage in tests
describe('User Management', () => {
  beforeEach(() => {
    mockUserApi();
    mockAuthApi();
  });

  it('should create a new user', () => {
    cy.visit('/users/new');
    // ... test logic
  });
});
```

**Anti-patterns to Avoid**:
- Not using `.as()` aliases for waiting
- Intercepting too broadly (e.g., all GET requests)
- Forgetting that cached requests bypass interception
- Not handling all possible response scenarios

**When to Use**:
- Testing error states and edge cases
- Avoiding flaky tests due to real API variability
- Testing loading states with delays
- Isolating frontend from backend issues

**When NOT to Use**:
- When you specifically need to test real API integration
- Smoke tests against production

### 2.3 Cypress Fixtures

**Core Pattern**: External data files for consistent test data.

```typescript
// cypress/fixtures/users.json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  },
  {
    "id": 2,
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user"
  }
]
```

```typescript
// cypress/e2e/fixtures-usage.cy.ts
describe('Fixture Patterns', () => {
  // Load fixture in beforeEach
  beforeEach(function () {
    cy.fixture('users.json').as('users');
  });

  it('should use fixture data', function () {
    // Access via this context (must use function(), not arrow)
    cy.intercept('GET', '/api/users', this.users);
    cy.visit('/users');
    cy.dataCy('user-item').should('have.length', this.users.length);
  });

  // Load and modify fixture
  it('should use modified fixture', () => {
    cy.fixture('users.json').then((users) => {
      const modifiedUsers = users.map((user) => ({
        ...user,
        name: `Modified: ${user.name}`,
      }));

      cy.intercept('GET', '/api/users', modifiedUsers);
      cy.visit('/users');
      cy.dataCy('user-item').first().should('contain', 'Modified:');
    });
  });

  // Dynamic fixture based on test
  it('should handle empty state', () => {
    cy.intercept('GET', '/api/users', []);
    cy.visit('/users');
    cy.dataCy('empty-state').should('be.visible');
  });
});
```

---

## 3. Test Organization Patterns

### 3.1 Folder Structure

**Core Pattern**: Organize tests by feature/domain, not by type.

```
e2e/
├── fixtures/                    # Test data
│   ├── users/
│   │   ├── admin.json
│   │   └── regular-user.json
│   └── products/
│       └── catalog.json
├── pages/                       # Page objects (Playwright)
│   ├── base.page.ts
│   ├── login.page.ts
│   └── dashboard.page.ts
├── support/                     # Helpers and utilities
│   ├── commands/               # Custom commands (Cypress)
│   │   ├── auth.commands.ts
│   │   └── api.commands.ts
│   ├── fixtures/               # Custom fixtures (Playwright)
│   │   ├── auth.fixture.ts
│   │   └── db.fixture.ts
│   └── utils/
│       ├── test-data.ts
│       └── api-helpers.ts
├── tests/                       # Test files organized by feature
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── password-reset.spec.ts
│   ├── users/
│   │   ├── user-list.spec.ts
│   │   └── user-profile.spec.ts
│   └── products/
│       ├── product-catalog.spec.ts
│       └── product-search.spec.ts
├── playwright.config.ts         # or cypress.config.ts
└── tsconfig.json
```

### 3.2 Test File Organization

**Core Pattern**: Group related tests logically with clear naming.

```typescript
// tests/auth/login.spec.ts
import { test, expect } from '../../support/fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';

test.describe('Login Page', () => {
  test.describe('Valid Credentials', () => {
    test('should login with valid email and password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@example.com', 'password123');

      await expect(page).toHaveURL('/dashboard');
    });

    test('should persist session after page refresh', async ({ authenticatedPage }) => {
      await authenticatedPage.reload();
      await expect(authenticatedPage).toHaveURL('/dashboard');
    });
  });

  test.describe('Invalid Credentials', () => {
    test('should show error for invalid email', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('invalid@example.com', 'password123');

      await expect(loginPage.errorMessage).toContainText('Invalid credentials');
    });

    test('should show error for invalid password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@example.com', 'wrongpassword');

      await expect(loginPage.errorMessage).toContainText('Invalid credentials');
    });
  });

  test.describe('Form Validation', () => {
    test('should require email field', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.submitButton.click();

      await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should validate email format', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.emailInput.fill('not-an-email');
      await loginPage.submitButton.click();

      await expect(loginPage.errorMessage).toContainText('Invalid email format');
    });
  });
});
```

### 3.3 Naming Conventions

**Core Pattern**: Use descriptive, consistent naming.

```typescript
// File naming: kebab-case
// login.spec.ts, user-profile.spec.ts, product-catalog.spec.ts

// Test naming: "should [action] [expected result]"
test('should display error message for invalid credentials', ...);
test('should redirect to dashboard after successful login', ...);
test('should disable submit button when form is invalid', ...);

// Describe blocks: noun phrases
test.describe('Login Page', () => {
  test.describe('Form Validation', () => {
    test.describe('Email Field', () => {
      // tests...
    });
  });
});
```

**Anti-patterns to Avoid**:
- Organizing tests by page type (all "page" tests together)
- Deeply nested describe blocks (more than 3 levels)
- Generic test names ("test 1", "test 2", "it works")
- Mixing test types (unit/integration/e2e) in same folder

**When to Use**:
- Feature-based organization for all but smallest projects
- Consistent naming conventions across team

---

## 4. Visual Regression Testing

### 4.1 Playwright Built-in Screenshots

**Core Pattern**: Use Playwright's native screenshot comparison.

```typescript
// tests/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Full page screenshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01, // Allow 1% difference
    });
  });

  test('header component should match snapshot', async ({ page }) => {
    await page.goto('/');

    // Element-specific screenshot
    const header = page.getByRole('banner');
    await expect(header).toHaveScreenshot('header.png');
  });

  test('should handle different viewport sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto('/');

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
    });
  });

  // Mask dynamic content
  test('should mask dynamic elements', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveScreenshot('dashboard.png', {
      mask: [
        page.getByTestId('timestamp'),
        page.getByTestId('user-avatar'),
        page.getByTestId('dynamic-chart'),
      ],
    });
  });
});
```

```typescript
// playwright.config.ts - Visual testing configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      // Threshold for pixel difference
      maxDiffPixelRatio: 0.01,
      // Animation handling
      animations: 'disabled',
      // Consistent rendering
      scale: 'css',
    },
  },

  // Update snapshots with: npx playwright test --update-snapshots
  updateSnapshots: 'missing',

  // Different snapshots per platform
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{-projectName}{ext}',
});
```

### 4.2 Chromatic Integration

**Core Pattern**: Cloud-based visual testing with Chromatic.

```typescript
// playwright.config.ts - Chromatic setup
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Chromatic captures snapshots automatically
    trace: 'on',
  },
});
```

```yaml
# .github/workflows/chromatic.yml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run Playwright tests
        run: npx playwright test

      - name: Publish to Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          playwright: true
```

### 4.3 Percy Integration

**Core Pattern**: BrowserStack Percy for cross-browser visual testing.

```typescript
// tests/visual/percy.spec.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Percy Visual Tests', () => {
  test('homepage visual test', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Percy snapshot
    await percySnapshot(page, 'Homepage');
  });

  test('responsive visual test', async ({ page }) => {
    await page.goto('/');

    // Percy handles multiple widths automatically
    await percySnapshot(page, 'Homepage Responsive', {
      widths: [375, 768, 1280],
    });
  });
});
```

**Anti-patterns to Avoid**:
- Not masking dynamic content (timestamps, ads, user data)
- Testing visual regression on every commit (too slow)
- Using visual tests for functional verification
- Ignoring platform differences in rendering

**When to Use**:
- Design system components
- Marketing/landing pages where design is critical
- After major UI refactoring
- Before releases

**When NOT to Use**:
- For every test (too slow, too brittle)
- Early in development when UI is changing rapidly
- For purely functional tests

---

## 5. Cross-Browser Testing Strategies

### 5.1 Playwright Multi-Browser Configuration

**Core Pattern**: Configure projects for each browser.

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Branded browsers
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
```

### 5.2 Browser-Specific Tests

**Core Pattern**: Run certain tests only on specific browsers.

```typescript
// tests/browser-specific.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Cross-Browser Tests', () => {
  // Run on all browsers
  test('should work on all browsers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  // Chromium only
  test('should handle clipboard (Chromium only)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard API only works in Chromium');

    await page.goto('/editor');
    await page.getByRole('textbox').fill('test content');
    await page.keyboard.press('Control+C');
    // ... clipboard test
  });

  // Skip on WebKit
  test('should handle specific feature', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Feature not supported in Safari');

    // ... test implementation
  });
});
```

### 5.3 CI Matrix Strategy

```yaml
# .github/workflows/cross-browser.yml
name: Cross-Browser Tests

on: [push, pull_request]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        os: [ubuntu-latest, macos-latest, windows-latest]
        exclude:
          # WebKit on Windows is not supported
          - os: windows-latest
            browser: webkit

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run Tests
        run: npx playwright test --project=${{ matrix.browser }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-${{ matrix.os }}-${{ matrix.browser }}
          path: test-results/
```

**Anti-patterns to Avoid**:
- Running all browsers on every commit (too slow)
- Not accounting for browser-specific behaviors
- Ignoring mobile browsers
- Testing old browser versions unless required

**When to Use**:
- Before releases
- For critical user flows
- When browser-specific bugs are reported

**When NOT to Use**:
- Every commit during development
- For backend/API tests
- For simple, browser-agnostic features

---

## 6. CI/CD Integration for E2E Tests

### 6.1 GitHub Actions Configuration

**Core Pattern**: Efficient CI setup with caching and parallelization.

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CI: true

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests (shard ${{ matrix.shard }}/4)
        run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.shard }}
          path: |
            test-results/
            playwright-report/
          retention-days: 7

  merge-reports:
    needs: e2e
    runs-on: ubuntu-latest
    if: always()

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          merge-multiple: true
          path: all-results/

      - name: Merge reports
        run: npx playwright merge-reports --reporter=html ./all-results

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

### 6.2 Efficient Test Splitting

**Core Pattern**: Smart test distribution across workers.

```typescript
// playwright.config.ts - Sharding configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Worker configuration
  workers: process.env.CI ? 1 : undefined, // 1 worker per shard in CI
  fullyParallel: true,

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration for CI
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['github'], // GitHub Actions annotations
      ]
    : [['html', { open: 'on-failure' }]],
});
```

### 6.3 Cypress Cloud Parallelization

```yaml
# .github/workflows/cypress.yml
name: Cypress E2E

on: [push, pull_request]

jobs:
  cypress:
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        containers: [1, 2, 3, 4]

    steps:
      - uses: actions/checkout@v4

      - uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm run start
          wait-on: 'http://localhost:3000'
          record: true
          parallel: true
          group: 'E2E Tests'
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Anti-patterns to Avoid**:
- Running full test suite on every commit
- Not caching browser installations
- Too many shards (orchestration overhead)
- Not using fail-fast: false for parallel jobs

**When to Use**:
- Always in CI/CD pipelines
- Sharding for suites > 10 minutes

---

## 7. Accessibility Testing in E2E

### 7.1 Playwright + axe-core

**Core Pattern**: Automated accessibility checks during E2E tests.

```typescript
// support/fixtures/a11y.fixture.ts
import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type A11yFixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<A11yFixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeBuilder = () => new AxeBuilder({ page });
    await use(makeBuilder);
  },
});

export { expect } from '@playwright/test';
```

```typescript
// tests/a11y/accessibility.spec.ts
import { test, expect } from '../../support/fixtures/a11y.fixture';

test.describe('Accessibility Tests', () => {
  test('homepage should have no accessibility violations', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityResults = await makeAxeBuilder()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']) // WCAG 2.1 AA
      .analyze();

    expect(accessibilityResults.violations).toEqual([]);
  });

  test('should check specific component accessibility', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/forms');

    // Check only the form section
    const results = await makeAxeBuilder()
      .include('[data-testid="signup-form"]')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('should exclude known issues', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/legacy-page');

    const results = await makeAxeBuilder()
      .exclude('[data-legacy-component]') // Known issue in legacy code
      .disableRules(['color-contrast']) // Temporarily disabled
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // Test keyboard navigation
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBe('A'); // First focusable element

    // Check skip link
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
```

### 7.2 Cypress + cypress-axe

```typescript
// cypress/support/e2e.ts
import 'cypress-axe';

// cypress/e2e/accessibility.cy.ts
describe('Accessibility Tests', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  it('should have no accessibility violations', () => {
    cy.checkA11y();
  });

  it('should check accessibility on specific element', () => {
    cy.checkA11y('[data-cy="main-content"]');
  });

  it('should check accessibility with specific rules', () => {
    cy.checkA11y(null, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
  });

  it('should exclude elements with known issues', () => {
    cy.checkA11y(null, {
      exclude: ['.legacy-component'],
    });
  });

  it('should handle violations with custom callback', () => {
    cy.checkA11y(null, null, (violations) => {
      violations.forEach((violation) => {
        cy.log(`Violation: ${violation.id}`);
        cy.log(`Description: ${violation.description}`);
        violation.nodes.forEach((node) => {
          cy.log(`Element: ${node.target}`);
        });
      });
    });
  });
});
```

**Anti-patterns to Avoid**:
- Only running accessibility tests in isolation
- Ignoring violations without justification
- Not testing interactive states (focused, expanded)
- Relying solely on automated testing

**When to Use**:
- Every page/component test
- After UI changes
- Before releases

**When NOT to Use**:
- As the only accessibility testing (need manual testing too)

---

## 8. Performance Testing in E2E

### 8.1 Playwright + Lighthouse

**Core Pattern**: Performance audits during E2E tests.

```typescript
// tests/performance/lighthouse.spec.ts
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import { chromium } from 'playwright';

test.describe('Performance Tests', () => {
  test('should meet performance thresholds', async () => {
    const browser = await chromium.launch({
      args: ['--remote-debugging-port=9222'],
    });
    const page = await browser.newPage();
    await page.goto('/');

    const result = await playAudit({
      page,
      port: 9222,
      thresholds: {
        performance: 80,
        accessibility: 90,
        'best-practices': 80,
        seo: 80,
      },
    });

    expect(result.lhr.categories.performance.score * 100).toBeGreaterThanOrEqual(80);

    await browser.close();
  });
});
```

### 8.2 Web Vitals Measurement

```typescript
// tests/performance/web-vitals.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Web Vitals', () => {
  test('should measure Core Web Vitals', async ({ page }) => {
    // Inject web-vitals library
    await page.addInitScript(() => {
      (window as any).webVitals = {};
    });

    await page.goto('/');

    // Measure LCP
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    });

    expect(lcp).toBeLessThan(2500); // Good LCP < 2.5s

    // Measure CLS
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          resolve(clsValue);
        }).observe({ type: 'layout-shift', buffered: true });

        // Resolve after a delay to capture all shifts
        setTimeout(() => resolve(clsValue), 3000);
      });
    });

    expect(cls).toBeLessThan(0.1); // Good CLS < 0.1
  });

  test('should measure page load timing', async ({ page }) => {
    await page.goto('/');

    const timing = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        dns: perf.domainLookupEnd - perf.domainLookupStart,
        connection: perf.connectEnd - perf.connectStart,
        ttfb: perf.responseStart - perf.requestStart,
        download: perf.responseEnd - perf.responseStart,
        domInteractive: perf.domInteractive - perf.fetchStart,
        domComplete: perf.domComplete - perf.fetchStart,
        loadComplete: perf.loadEventEnd - perf.fetchStart,
      };
    });

    expect(timing.ttfb).toBeLessThan(600); // TTFB < 600ms
    expect(timing.domInteractive).toBeLessThan(3000); // Interactive < 3s
    expect(timing.loadComplete).toBeLessThan(5000); // Full load < 5s
  });
});
```

### 8.3 Network Performance

```typescript
// tests/performance/network.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Network Performance', () => {
  test('should track network requests', async ({ page }) => {
    const requests: { url: string; duration: number; size: number }[] = [];

    page.on('requestfinished', async (request) => {
      const response = await request.response();
      if (response) {
        const timing = request.timing();
        requests.push({
          url: request.url(),
          duration: timing.responseEnd - timing.requestStart,
          size: parseInt(response.headers()['content-length'] || '0'),
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Assert no slow requests
    const slowRequests = requests.filter((r) => r.duration > 1000);
    expect(slowRequests).toHaveLength(0);

    // Assert total payload size
    const totalSize = requests.reduce((sum, r) => sum + r.size, 0);
    expect(totalSize).toBeLessThan(5 * 1024 * 1024); // < 5MB total
  });
});
```

**Anti-patterns to Avoid**:
- Running performance tests on every commit
- Not accounting for network variability
- Testing performance in development mode
- Ignoring mobile performance

**When to Use**:
- Before releases
- After major changes
- On CI nightly builds

**When NOT to Use**:
- Every commit (too slow)
- On unstable environments

---

## 9. Mobile/Responsive Testing

### 9.1 Viewport Emulation

**Core Pattern**: Test responsive layouts with viewport emulation.

```typescript
// playwright.config.ts - Device configurations
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Common mobile viewports
    {
      name: 'mobile-portrait',
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-landscape',
      use: {
        viewport: { width: 812, height: 375 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },

    // Specific devices
    {
      name: 'iphone-12',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'pixel-5',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
});
```

### 9.2 Responsive Test Patterns

```typescript
// tests/responsive/navigation.spec.ts
import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe('Responsive Navigation', () => {
  test('should show hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');

    // Desktop nav should be hidden
    await expect(page.getByTestId('desktop-nav')).toBeHidden();

    // Mobile menu button should be visible
    await expect(page.getByTestId('mobile-menu-button')).toBeVisible();

    // Open mobile menu
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-nav')).toBeVisible();
  });

  test('should show full navigation on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto('/');

    // Desktop nav should be visible
    await expect(page.getByTestId('desktop-nav')).toBeVisible();

    // Mobile menu button should be hidden
    await expect(page.getByTestId('mobile-menu-button')).toBeHidden();
  });

  test('should handle orientation change', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const portraitLayout = await page.getByTestId('content-grid').boundingBox();

    // Switch to landscape
    await page.setViewportSize({ width: 812, height: 375 });

    const landscapeLayout = await page.getByTestId('content-grid').boundingBox();

    // Layout should adapt
    expect(landscapeLayout?.width).toBeGreaterThan(portraitLayout?.width || 0);
  });
});
```

### 9.3 Touch Interaction Testing

```typescript
// tests/responsive/touch.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Touch Interactions', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });

  test('should handle swipe gestures', async ({ page }) => {
    await page.goto('/carousel');

    const carousel = page.getByTestId('image-carousel');
    const box = await carousel.boundingBox();

    if (box) {
      // Swipe left
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();

      await expect(page.getByTestId('slide-indicator-2')).toHaveClass(/active/);
    }
  });

  test('should handle tap interactions', async ({ page }) => {
    await page.goto('/');

    // Tap (not click) on mobile
    await page.tap('[data-testid="cta-button"]');

    await expect(page).toHaveURL('/signup');
  });

  test('should handle long press', async ({ page }) => {
    await page.goto('/items');

    const item = page.getByTestId('list-item').first();

    // Long press to show context menu
    await item.click({ delay: 1000 });

    await expect(page.getByTestId('context-menu')).toBeVisible();
  });
});
```

### 9.4 Cypress Viewport Testing

```typescript
// cypress/e2e/responsive.cy.ts
describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ] as const;

  viewports.forEach(({ name, width, height }) => {
    describe(`${name} viewport (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        cy.visit('/');
      });

      it('should display correctly', () => {
        cy.dataCy('main-content').should('be.visible');

        if (name === 'mobile') {
          cy.dataCy('mobile-menu-button').should('be.visible');
          cy.dataCy('desktop-nav').should('not.be.visible');
        } else {
          cy.dataCy('desktop-nav').should('be.visible');
        }
      });
    });
  });

  it('should handle dynamic viewport changes', () => {
    cy.viewport('iphone-x');
    cy.visit('/');
    cy.dataCy('mobile-menu-button').should('be.visible');

    cy.viewport('macbook-15');
    cy.dataCy('desktop-nav').should('be.visible');
  });
});
```

**Anti-patterns to Avoid**:
- Only testing one mobile device
- Not testing orientation changes
- Ignoring touch-specific interactions
- Using emulation for all mobile testing (need real devices too)

**When to Use**:
- For all user-facing features
- Before releases
- When responsive bugs are reported

**When NOT to Use**:
- For backend/API tests
- When feature is desktop-only

---

## 10. Test Data Management

### 10.1 API-Based Seeding

**Core Pattern**: Use API calls for fast, reliable test setup.

```typescript
// support/utils/test-data.ts
import { APIRequestContext } from '@playwright/test';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export class TestDataManager {
  constructor(private request: APIRequestContext) {}

  async createUser(data: Partial<TestUser> = {}): Promise<TestUser> {
    const response = await this.request.post('/api/test/users', {
      data: {
        email: data.email || `test-${Date.now()}@example.com`,
        name: data.name || 'Test User',
        role: data.role || 'user',
        password: 'testpassword123',
      },
    });

    return response.json();
  }

  async createProduct(data: { name: string; price: number }) {
    const response = await this.request.post('/api/test/products', {
      data,
    });

    return response.json();
  }

  async cleanup(userId: string) {
    await this.request.delete(`/api/test/users/${userId}`);
  }

  async cleanupAll() {
    await this.request.post('/api/test/cleanup');
  }
}
```

```typescript
// support/fixtures/data.fixture.ts
import { test as base } from '@playwright/test';
import { TestDataManager, TestUser } from '../utils/test-data';

type DataFixtures = {
  testData: TestDataManager;
  testUser: TestUser;
};

export const test = base.extend<DataFixtures>({
  testData: async ({ request }, use) => {
    const manager = new TestDataManager(request);
    await use(manager);
    await manager.cleanupAll();
  },

  testUser: async ({ testData }, use) => {
    const user = await testData.createUser();
    await use(user);
    await testData.cleanup(user.id);
  },
});

export { expect } from '@playwright/test';
```

### 10.2 Factory Pattern

**Core Pattern**: Generate consistent, customizable test data.

```typescript
// support/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export interface UserAttributes {
  email: string;
  name: string;
  role: 'admin' | 'user';
  company?: string;
}

export const userFactory = {
  build(overrides: Partial<UserAttributes> = {}): UserAttributes {
    return {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'user',
      ...overrides,
    };
  },

  buildAdmin(overrides: Partial<UserAttributes> = {}): UserAttributes {
    return this.build({ role: 'admin', ...overrides });
  },

  buildMany(count: number, overrides: Partial<UserAttributes> = []): UserAttributes[] {
    return Array.from({ length: count }, () => this.build(overrides));
  },
};

// support/factories/product.factory.ts
export interface ProductAttributes {
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

export const productFactory = {
  build(overrides: Partial<ProductAttributes> = {}): ProductAttributes {
    return {
      name: faker.commerce.productName(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      inStock: true,
      ...overrides,
    };
  },

  buildOutOfStock(overrides: Partial<ProductAttributes> = {}): ProductAttributes {
    return this.build({ inStock: false, ...overrides });
  },
};
```

### 10.3 Database Seeding with Fixtures

```typescript
// support/fixtures/db.fixture.ts
import { test as base } from '@playwright/test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../db/schema';

type DbFixtures = {
  db: ReturnType<typeof drizzle>;
  seedDatabase: (data: SeedData) => Promise<void>;
};

interface SeedData {
  users?: schema.NewUser[];
  products?: schema.NewProduct[];
}

export const test = base.extend<DbFixtures>({
  db: async ({}, use) => {
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const db = drizzle(pool, { schema });

    await use(db);

    await pool.end();
  },

  seedDatabase: async ({ db }, use) => {
    const seededIds: { users: string[]; products: string[] } = {
      users: [],
      products: [],
    };

    const seed = async (data: SeedData) => {
      if (data.users) {
        const inserted = await db.insert(schema.users).values(data.users).returning();
        seededIds.users.push(...inserted.map((u) => u.id));
      }

      if (data.products) {
        const inserted = await db.insert(schema.products).values(data.products).returning();
        seededIds.products.push(...inserted.map((p) => p.id));
      }
    };

    await use(seed);

    // Cleanup seeded data
    if (seededIds.products.length) {
      await db.delete(schema.products).where(
        schema.products.id.in(seededIds.products)
      );
    }
    if (seededIds.users.length) {
      await db.delete(schema.users).where(
        schema.users.id.in(seededIds.users)
      );
    }
  },
});
```

### 10.4 Transaction Rollback Pattern

```typescript
// support/fixtures/transaction.fixture.ts
import { test as base } from '@playwright/test';
import { db } from '../../db';

export const test = base.extend({
  // Each test runs in a transaction that gets rolled back
  isolatedDb: async ({}, use) => {
    await db.transaction(async (tx) => {
      // Provide transaction to test
      await use(tx);

      // Rollback after test (throw to trigger rollback)
      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  },
});
```

### 10.5 Cypress Test Data Management

```typescript
// cypress/support/commands/data.commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      seedDatabase(data: SeedData): Chainable<void>;
      cleanupDatabase(): Chainable<void>;
    }
  }
}

interface SeedData {
  users?: Array<{ email: string; name: string }>;
  products?: Array<{ name: string; price: number }>;
}

Cypress.Commands.add('seedDatabase', (data: SeedData) => {
  return cy.request({
    method: 'POST',
    url: '/api/test/seed',
    body: data,
    headers: {
      'X-Test-Key': Cypress.env('TEST_API_KEY'),
    },
  });
});

Cypress.Commands.add('cleanupDatabase', () => {
  return cy.request({
    method: 'POST',
    url: '/api/test/cleanup',
    headers: {
      'X-Test-Key': Cypress.env('TEST_API_KEY'),
    },
  });
});

export {};
```

```typescript
// cypress/e2e/with-data.cy.ts
describe('User Management', () => {
  beforeEach(() => {
    cy.seedDatabase({
      users: [
        { email: 'admin@test.com', name: 'Admin' },
        { email: 'user@test.com', name: 'User' },
      ],
    });
  });

  afterEach(() => {
    cy.cleanupDatabase();
  });

  it('should list seeded users', () => {
    cy.login('admin@test.com', 'password');
    cy.visit('/users');
    cy.dataCy('user-row').should('have.length', 2);
  });
});
```

**Anti-patterns to Avoid**:
- Creating data through UI (too slow)
- Sharing data between tests
- Not cleaning up test data
- Using production database for tests
- Hardcoding test data IDs

**When to Use**:
- Every E2E test needs isolated data
- API seeding for speed
- Factories for consistent data generation

**When NOT to Use**:
- Simple tests that don't need database state
- When testing data creation flows themselves

---

## Summary: Decision Matrix

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| **Page Object Model** | Multi-page apps, shared UI elements | Simple single-page tests |
| **Custom Fixtures** | Shared setup, auth, multi-user | One-off test setup |
| **Network Interception** | Error states, loading states, isolation | Testing real API integration |
| **Visual Regression** | Design systems, before releases | Every commit, early development |
| **Cross-Browser Testing** | Before releases, critical flows | Every commit, API tests |
| **Accessibility Testing** | Every page, after UI changes | As sole a11y testing method |
| **Performance Testing** | Before releases, after major changes | Every commit |
| **Mobile/Responsive** | All user-facing features | Desktop-only features |
| **API Data Seeding** | Fast setup, reliable tests | Testing data creation flows |

---

## Sources

- [Playwright Page Object Model](https://playwright.dev/docs/pom)
- [Playwright Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Best Practices - BrowserStack](https://www.browserstack.com/guide/playwright-best-practices)
- [Cypress Custom Commands](https://docs.cypress.io/api/cypress-api/custom-commands)
- [Cypress Intercept](https://docs.cypress.io/api/commands/intercept)
- [Chromatic Visual Testing](https://www.chromatic.com/blog/how-to-visual-test-ui-using-playwright/)
- [Percy Visual Testing](https://medium.com/@dipenc245/advanced-visual-testing-with-playwright-ec7ee84b91a0)
- [E2E Test Organization - Medium](https://adequatica.medium.com/ways-to-organize-end-to-end-tests-76439c2fdebb)
- [Cross-Browser Testing with Playwright](https://thinksys.com/qa-testing/cross-browser-testing-with-playwright/)
- [Playwright CI Integration](https://playwright.dev/docs/ci)
- [GitHub Actions Sharding](https://www.warpbuild.com/blog/concurrent-tests)
- [Accessibility Testing with Playwright and Axe](https://dev.to/leading-edje/automating-accessibility-testing-with-playwright-3el7)
- [cypress-axe](https://github.com/component-driven/cypress-axe)
- [Playwright Lighthouse Integration](https://testingplus.me/how-to-integrate-lighthouse-playwright-performance-testing-2025-guide/)
- [Mobile E2E Testing Frameworks 2025](https://www.qawolf.com/blog/the-best-mobile-e2e-testing-frameworks-in-2025-strengths-tradeoffs-and-use-cases)
- [E2E Test Data Management](https://www.bunnyshell.com/blog/best-practices-for-end-to-end-testing-in-2025/)
- [Modern E2E Test Architecture](https://www.thunders.ai/articles/modern-e2e-test-architecture-patterns-and-anti-patterns-for-a-maintainable-test-suite)
- [Cypress Component vs E2E Testing](https://momentic.ai/resources/cypress-component-testing-vs-e2e-testing-a-deep-dive-for-modern-developers)
