# Playwright E2E Testing — Visual Comparison

> Screenshot baselines with `toHaveScreenshot()`. See [core.md](core.md) for the foundations.

The first run writes the baseline; later runs compare against it. `npx playwright test
--update-snapshots` accepts a change deliberately.

---

## Page and element screenshots

```typescript
// tests/e2e/visual/homepage.spec.ts
import { test, expect } from "@playwright/test";

const MAX_DIFF_PIXELS = 100;

test.describe("Homepage", () => {
  test("matches the baseline", async ({ page }) => {
    await page.goto("/");
    // Assert on something visible first: the assertion's own retry is the wait.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(page).toHaveScreenshot("homepage.png", {
      // Anything that changes on its own would fail on content rather than layout.
      mask: [
        page.getByTestId("current-date"),
        page.getByTestId("live-counter"),
        page.getByRole("img", { name: /advertisement/i }),
      ],
      maxDiffPixels: MAX_DIFF_PIXELS,
    });
  });

  test("hero section only", async ({ page }) => {
    await page.goto("/");
    // A narrower shot has fewer reasons to change than a full page.
    await expect(page.getByRole("region", { name: /hero/i })).toHaveScreenshot(
      "hero.png",
    );
  });
});
```

**Why good:** masking is what separates a real regression from a timestamp, and an element-scoped
screenshot fails only when that element changes.

---

## Interaction states

```typescript
test("primary button states", async ({ page }) => {
  await page.goto("/components/buttons");
  const button = page.getByRole("button", { name: /primary/i });

  await expect(button).toHaveScreenshot("button-default.png", {
    animations: "disabled",
  });

  await button.hover();
  await expect(button).toHaveScreenshot("button-hover.png", {
    animations: "disabled",
  });

  await button.focus();
  await expect(button).toHaveScreenshot("button-focus.png", {
    animations: "disabled",
  });
});
```

**Why good:** hover and focus styling is otherwise only checked by eye. `animations: "disabled"`
freezes transitions so the capture is deterministic.

**Environment:** baselines are byte-comparable only against the same OS, browser build and font
rendering — generate and update them in the same environment CI runs, not on a developer machine.
