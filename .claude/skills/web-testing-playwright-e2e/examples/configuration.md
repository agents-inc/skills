# Playwright E2E Testing - Configuration

> Multi-environment configuration patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 4: Development Configuration](core.md#pattern-4-development-configuration) from core examples first.

---

## Pattern: Multi-Environment Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const LOCAL_URL = "http://localhost:3000";
const STAGING_URL = "https://staging.example.com";
const PRODUCTION_URL = "https://example.com";

const CI_WORKERS = 4;
const DEFAULT_TIMEOUT_MS = 30000;
const PRODUCTION_TIMEOUT_MS = 60000;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? CI_WORKERS : undefined,
  timeout: DEFAULT_TIMEOUT_MS,

  use: {
    baseURL: process.env.BASE_URL || LOCAL_URL,
    trace: "on-first-retry",
  },

  projects: [
    // Local development
    {
      name: "local",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: LOCAL_URL,
      },
      testMatch: /.*\.spec\.ts/,
    },

    // Staging - full test suite
    {
      name: "staging",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: STAGING_URL,
      },
      testMatch: /.*\.spec\.ts/,
    },

    // Production - smoke tests only
    {
      name: "production",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PRODUCTION_URL,
      },
      testMatch: /.*\.smoke\.ts/,
      timeout: PRODUCTION_TIMEOUT_MS,
    },

    // Mobile testing
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        baseURL: STAGING_URL,
      },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: LOCAL_URL,
        reuseExistingServer: true,
      },
});
```

**Why good:** Separate projects for different environments and devices, production limited to smoke tests for safety, CI-specific settings (workers, retries), webServer only for local development

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Development Configuration._
