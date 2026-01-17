# Testing Examples - Playwright Configuration

> Playwright E2E configuration and auth fixtures. See [core.md](core.md) for unit testing patterns.

**Prerequisites**: This file covers E2E testing setup. For E2E test structure and Page Object Model, see [page-objects.md](page-objects.md).

---

## Pattern 1: Playwright E2E Configuration

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const TIMEOUT_3_MINUTES = 3 * 60 * 1000;
const TIMEOUT_60_SECONDS = 60 * 1000;
const SCREENSHOT_THRESHOLD = 0.25;
const SCREENSHOT_DIFF_RATIO = 0.05;
const WORKER_PERCENTAGE = "30%";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/,

  // Timeouts
  timeout: TIMEOUT_3_MINUTES,
  expect: {
    timeout: TIMEOUT_60_SECONDS,
    toHaveScreenshot: {
      threshold: SCREENSHOT_THRESHOLD,
      maxDiffPixelRatio: SCREENSHOT_DIFF_RATIO,
    },
  },

  // Parallelization
  workers: WORKER_PERCENTAGE,
  fullyParallel: true,

  // CI-specific settings
  maxFailures: process.env.CI ? 1 : 0,
  retries: process.env.CI ? 1 : 0,

  // Reporter
  reporter: process.env.CI ? "github" : "html",

  // Projects (browsers)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Base URL
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
```

**Why good:** Named constants for magic numbers, CI-specific retry and failure behavior, screenshot thresholds for visual regression, parallel execution with worker limits, trace on failure for debugging

---

## Pattern 2: Custom Auth Fixtures

### Auth Fixtures

```typescript
// e2e/fixtures/auth.ts
import { test as base, type Page, type BrowserContext } from "@playwright/test";

// Path to stored auth state files
const getAuthFilePath = (userType: "pro" | "free" | "anonymous") => {
  return `./e2e/.auth/${userType}.json`;
};

type AuthFixtures = {
  proContext: BrowserContext;
  proPage: Page;
  freeContext: BrowserContext;
  freePage: Page;
};

export const test = base.extend<AuthFixtures>({
  // Pro user context with stored auth state
  proContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthFilePath("pro"),
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await use(context);
    await context.close();
  },

  // Pro user page
  proPage: async ({ proContext }, use) => {
    const page = await proContext.newPage();
    await use(page);
    await page.close();
  },

  // Free user context
  freeContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthFilePath("free"),
    });
    await use(context);
    await context.close();
  },

  // Free user page
  freePage: async ({ freeContext }, use) => {
    const page = await freeContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from "@playwright/test";
```

**Why good:** Reusable auth contexts for different user types, clipboard permissions for export tests, proper cleanup with context.close(), exports both `test` and `expect` for use in test files

### Fixtures Index

```typescript
// e2e/fixtures/index.ts
export { test, expect } from "./auth";
```

**Why good:** Single import point for all fixtures, clean API for test files

---

_See [page-objects.md](page-objects.md) for E2E test structure and Page Object Model implementation._
