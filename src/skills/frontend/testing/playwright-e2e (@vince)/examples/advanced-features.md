# Playwright E2E Testing - Advanced Features (v1.45+)

> Modern Playwright features including Clock API (v1.45+), ARIA snapshots (v1.49+), and worker fixtures. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand Complete User Flow and Basic Fixtures from core examples first.

---

## Pattern: Clock API for Time-Dependent Testing (v1.45+)

Control and manipulate time within tests for time-dependent features like countdowns, session timeouts, and scheduled events.

**CRITICAL:** `clock.install()` MUST be called before any other clock methods in your test.

### Basic Clock Control

```typescript
// tests/e2e/time-features/session-timeout.spec.ts
import { test, expect } from "@playwright/test";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DATE = "2024-02-02T08:00:00";
const TIMEOUT_DATE = "2024-02-02T08:30:00";

test.describe("Session Timeout", () => {
  test("shows warning before session expires", async ({ page }) => {
    // Initialize clock at a specific time
    await page.clock.install({ time: new Date(INITIAL_DATE) });
    await page.goto("/dashboard");

    // Verify user is logged in
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    // Fast forward to just before timeout
    await page.clock.fastForward("25:00"); // 25 minutes

    // Verify warning is shown
    await expect(page.getByText(/session expires in 5 minutes/i)).toBeVisible();
  });

  test("logs out user after session timeout", async ({ page }) => {
    await page.clock.install({ time: new Date(INITIAL_DATE) });
    await page.goto("/dashboard");

    // Pause time at the exact timeout moment
    await page.clock.pauseAt(new Date(TIMEOUT_DATE));

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/session expired/i)).toBeVisible();
  });
});
```

**Why good:** Tests time-dependent behavior without real waits, pauseAt allows precise verification at specific moments, fast-forward simulates time passage efficiently

### Countdown Timer Testing

```typescript
// tests/e2e/time-features/countdown.spec.ts
import { test, expect } from "@playwright/test";

const SALE_START = "2024-03-01T00:00:00";
const SALE_COUNTDOWN_START = "2024-02-28T23:59:00";

test("countdown timer shows correct time remaining", async ({ page }) => {
  await page.clock.install({ time: new Date(SALE_COUNTDOWN_START) });
  await page.goto("/upcoming-sale");

  // Verify initial countdown
  await expect(page.getByTestId("countdown")).toContainText("1 day");

  // Fast forward by 23 hours
  await page.clock.fastForward("23:00:00");
  await expect(page.getByTestId("countdown")).toContainText("1 hour");

  // Fast forward to sale start
  await page.clock.fastForward("01:00:00");
  await expect(page.getByText(/sale is live/i)).toBeVisible();
});
```

---

## Pattern: ARIA Snapshot Testing (v1.49+)

Validate accessibility tree structure with toMatchAriaSnapshot for accessibility compliance.

### Basic ARIA Snapshot

```typescript
// tests/e2e/accessibility/navigation.spec.ts
import { test, expect } from "@playwright/test";

test("navigation has correct accessibility structure", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
    - navigation:
      - link "Home"
      - link "Products"
      - link "About"
      - link "Contact"
  `);
});

test("form has accessible labels", async ({ page }) => {
  await page.goto("/contact");

  await expect(page.getByRole("form")).toMatchAriaSnapshot(`
    - form "Contact Form":
      - textbox "Name"
      - textbox "Email"
      - textbox "Message"
      - button "Send Message"
  `);
});
```

**Why good:** Validates accessibility tree structure programmatically, catches ARIA issues before production, documents expected accessibility behavior

### Complex Component ARIA Snapshots

```typescript
// tests/e2e/accessibility/data-table.spec.ts
import { test, expect } from "@playwright/test";

test("data table has correct ARIA structure", async ({ page }) => {
  await page.goto("/users");

  await expect(page.getByRole("table")).toMatchAriaSnapshot(`
    - table "Users":
      - rowgroup:
        - row:
          - columnheader "Name"
          - columnheader "Email"
          - columnheader "Role"
          - columnheader "Actions"
      - rowgroup:
        - row:
          - cell "John Doe"
          - cell "john@example.com"
          - cell "Admin"
          - cell:
            - button "Edit"
            - button "Delete"
  `);
});
```

---

## Pattern: Worker-Scoped Fixtures

Share expensive setup across tests in the same worker for improved performance.

### Database User Per Worker

```typescript
// tests/e2e/fixtures/worker-fixtures.ts
import { test as base, expect } from "@playwright/test";

type WorkerFixtures = {
  dbUserName: string;
};

export const test = base.extend<{}, WorkerFixtures>({
  // Worker-scoped fixture runs once per worker process
  dbUserName: [
    async ({}, use, workerInfo) => {
      // Create unique user for this worker
      const userName = `test-user-${workerInfo.workerIndex}`;

      // Setup: Create user in database
      const response = await fetch("/api/test/users", {
        method: "POST",
        body: JSON.stringify({ username: userName }),
      });

      await use(userName);

      // Teardown: Clean up user after all tests in worker complete
      await fetch(`/api/test/users/${userName}`, {
        method: "DELETE",
      });
    },
    { scope: "worker" },
  ],
});

export { expect };
```

### Using Worker Fixtures

```typescript
// tests/e2e/user-features/profile.spec.ts
import { test, expect } from "../fixtures/worker-fixtures";

test.describe("User Profile", () => {
  test("can view profile", async ({ page, dbUserName }) => {
    await page.goto(`/users/${dbUserName}/profile`);
    await expect(page.getByRole("heading", { name: dbUserName })).toBeVisible();
  });

  test("can edit profile", async ({ page, dbUserName }) => {
    await page.goto(`/users/${dbUserName}/edit`);
    await page.getByLabel(/bio/i).fill("Updated bio");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/profile updated/i)).toBeVisible();
  });
});
```

**Why good:** Expensive setup (database, external services) runs once per worker, tests in same worker share the fixture, cleanup happens after all worker tests complete

---

## Pattern: Polling Assertions with toPass

Use toPass for custom polling conditions that built-in assertions do not cover.

### Custom Polling Assertion

```typescript
// tests/e2e/async/background-job.spec.ts
import { test, expect } from "@playwright/test";

const POLLING_TIMEOUT_MS = 30000;
const POLLING_INTERVALS_MS = [500, 1000, 2000, 5000];

test("waits for background job to complete", async ({ page }) => {
  await page.goto("/jobs");

  // Start a background job
  await page.getByRole("button", { name: /start job/i }).click();

  // Poll until job completes with custom intervals
  await expect(async () => {
    const status = await page.getByTestId("job-status").textContent();
    expect(status).toBe("Completed");
  }).toPass({
    timeout: POLLING_TIMEOUT_MS,
    intervals: POLLING_INTERVALS_MS,
  });
});

test("waits for data synchronization", async ({ page }) => {
  await page.goto("/sync");

  // Trigger sync
  await page.getByRole("button", { name: /sync now/i }).click();

  // Poll for sync completion
  await expect(async () => {
    await page.reload();
    const syncStatus = page.getByTestId("sync-status");
    await expect(syncStatus).toHaveText("Synced");
  }).toPass({
    timeout: POLLING_TIMEOUT_MS,
  });
});
```

**Why good:** Handles complex async conditions built-in assertions cannot, configurable intervals prevent hammering the server, explicit timeout prevents infinite waits

---

## Pattern: Accessibility Assertions (v1.44+)

Validate accessible names, descriptions, and roles programmatically.

```typescript
// tests/e2e/accessibility/form-validation.spec.ts
import { test, expect } from "@playwright/test";

test("form inputs have proper accessibility attributes", async ({ page }) => {
  await page.goto("/signup");

  // Validate accessible name (v1.44+)
  await expect(page.getByRole("button")).toHaveAccessibleName("Submit Form");

  // Validate accessible description (v1.44+)
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(
    /at least 8 characters/i
  );

  // Validate ARIA role (v1.44+)
  await expect(page.getByTestId("alert-banner")).toHaveRole("alert");

  // Validate error message (v1.50+)
  await page.getByRole("button").click(); // Trigger validation
  await expect(page.getByLabel("Email")).toHaveAccessibleErrorMessage(
    /email is required/i
  );
});
```

**Why good:** Validates accessibility tree directly without manual DOM inspection, catches ARIA issues before users encounter them, complements ARIA snapshot testing for specific checks

---

## Pattern: Case-Insensitive URL Assertions

Use ignoreCase option for URL matching when URL casing may vary.

```typescript
// tests/e2e/navigation/routing.spec.ts
import { test, expect } from "@playwright/test";

test("navigates to user profile regardless of URL case", async ({ page }) => {
  await page.goto("/dashboard");

  // Click on user profile link
  await page.getByRole("link", { name: /profile/i }).click();

  // URL may be /Profile, /profile, or /PROFILE
  await expect(page).toHaveURL(/\/profile/i, { ignoreCase: true });
});

test("handles mixed case route parameters", async ({ page }) => {
  await page.goto("/products/ABC123");

  // Product ID in URL may be normalized differently
  await expect(page).toHaveURL("/products/abc123", { ignoreCase: true });
});
```

**Why good:** Handles servers that normalize URL case differently, prevents false failures from case mismatches, explicit option documents intentional case-insensitivity

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Configuration._
