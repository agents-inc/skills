# Playwright E2E Testing — Advanced Features

> Clock API (v1.45+), ARIA snapshots (v1.49+), worker-scoped fixtures, polling assertions and
> accessibility assertions (v1.44+). See [core.md](core.md) for the foundations.

---

## Clock API (v1.45+)

`clock.install()` comes before every other clock call. After that, time only moves when the test
moves it.

```typescript
// tests/e2e/time-features/session-timeout.spec.ts
import { test, expect } from "@playwright/test";

const INITIAL_DATE = "2024-02-02T08:00:00";

test("warns before the session expires", async ({ page }) => {
  await page.clock.install({ time: new Date(INITIAL_DATE) });
  await page.goto("/dashboard");

  await page.clock.fastForward("25:00"); // mm:ss — 25 minutes
  await expect(page.getByText(/session expires in 5 minutes/i)).toBeVisible();
});

test("logs out at the timeout instant", async ({ page }) => {
  await page.clock.install({ time: new Date(INITIAL_DATE) });
  await page.goto("/dashboard");

  // pauseAt stops at an exact moment, so the assertion is not racing a tick.
  await page.clock.pauseAt(new Date("2024-02-02T08:30:00"));

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/session expired/i)).toBeVisible();
});
```

**Why good:** a 30-minute timeout is verified in milliseconds, and `pauseAt` removes the ambiguity
about which side of the boundary the assertion ran on.

Method table: [reference.md](../reference.md).

---

## ARIA snapshots (v1.49+)

```typescript
test("the data table exposes a correct accessible tree", async ({ page }) => {
  await page.goto("/users");

  await expect(page.getByRole("table")).toMatchAriaSnapshot(`
    - table "Users":
      - rowgroup:
        - row:
          - columnheader "Name"
          - columnheader "Email"
      - rowgroup:
        - row:
          - cell "John Doe"
          - cell "john@example.com"
  `);
});
```

**Why good:** one assertion covers structure, roles and accessible names together, and the failure
diff reads as a tree rather than as a list of separate expectations.

---

## Worker-scoped fixtures

Expensive setup that can be shared by every test in a worker, rather than repeated per test.

```typescript
// tests/e2e/fixtures/worker-fixtures.ts
import { test as base, expect } from "@playwright/test";

type WorkerFixtures = { dbUserName: string };

// A worker-scoped fixture cannot ask for `request`, which is test-scoped, so it
// builds its own context — and an absolute URL, since `baseURL` is not applied here.
const API = process.env.BASE_URL ?? "http://localhost:3000";

export const test = base.extend<{}, WorkerFixtures>({
  dbUserName: [
    async ({}, use, workerInfo) => {
      // Unique per worker, so parallel workers never collide on the same row.
      const userName = `test-user-${workerInfo.workerIndex}`;

      await fetch(`${API}/api/test/users`, {
        method: "POST",
        body: JSON.stringify({ username: userName }),
      });

      await use(userName);

      await fetch(`${API}/api/test/users/${userName}`, { method: "DELETE" });
    },
    { scope: "worker" },
  ],
});

export { expect };
```

**Why good:** the setup cost is paid once per worker instead of once per test, and the worker index
in the name is what keeps parallel workers from sharing a record.

---

## Polling with `toPass`

For conditions no built-in matcher covers — a background job, an eventually-consistent read.

```typescript
const POLLING_TIMEOUT_MS = 30_000;

test("waits for the background job", async ({ page }) => {
  await page.goto("/jobs");
  await page.getByRole("button", { name: /start job/i }).click();

  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("job-status")).toHaveText("Completed");
  }).toPass({
    timeout: POLLING_TIMEOUT_MS,
    intervals: [500, 1_000, 2_000, 5_000], // back off instead of hammering
  });
});
```

**Why good:** the whole block retries, so a reload can be part of the polled condition — something a
single retrying matcher cannot express.

---

## Accessibility assertions (v1.44+)

```typescript
test("the signup form is announced correctly", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByRole("button")).toHaveAccessibleName("Submit Form");
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(
    /at least 8 characters/i,
  );
  await expect(page.getByTestId("alert-banner")).toHaveRole("alert");

  await page.getByRole("button").click();
  // v1.50+
  await expect(page.getByLabel("Email")).toHaveAccessibleErrorMessage(
    /email is required/i,
  );
});
```

**Why good:** these assert the computed accessibility properties rather than the attributes that
produce them, so a valid alternative markup still passes.

---

## URL assertions that ignore case

```typescript
// The server may normalise /Profile, /profile or /PROFILE
await expect(page).toHaveURL("/products/abc123", { ignoreCase: true });
```

**Why good:** the option states that the case-insensitivity is deliberate, where a loose regex would
leave a reader guessing.
