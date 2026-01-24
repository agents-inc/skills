# Playwright E2E Testing - Visual Testing

> Visual regression testing patterns with screenshot comparison. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand Complete User Flow and Basic Page Objects from core examples first.

---

## Pattern: Screenshot Comparison

### Full Page Screenshots

```typescript
// tests/e2e/visual/homepage.spec.ts
import { test, expect } from "@playwright/test";

const MAX_DIFF_PIXELS = 100;

test.describe("Homepage Visual Regression", () => {
  test("homepage matches baseline", async ({ page }) => {
    await page.goto("/");

    // Wait for all images to load
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("homepage.png");
  });

  test("homepage hero section", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("region", { name: /hero/i });
    await expect(hero).toHaveScreenshot("hero-section.png");
  });

  test("homepage with masked dynamic content", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveScreenshot("homepage-masked.png", {
      mask: [
        page.getByTestId("current-date"),
        page.getByTestId("live-counter"),
        page.getByRole("img", { name: /advertisement/i }),
      ],
    });
  });

  test("homepage with fuzzy comparison", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveScreenshot("homepage-fuzzy.png", {
      maxDiffPixels: MAX_DIFF_PIXELS,
    });
  });
});
```

**Why good:** Waits for network idle to ensure images loaded, masks dynamic content to prevent false positives, uses fuzzy comparison for minor variations

---

## Pattern: Component Visual Testing

### Button States

```typescript
// tests/e2e/visual/buttons.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Button Component Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/buttons");
  });

  test("primary button states", async ({ page }) => {
    const primaryButton = page.getByRole("button", { name: /primary/i });

    // Default state
    await expect(primaryButton).toHaveScreenshot("button-primary-default.png");

    // Hover state
    await primaryButton.hover();
    await expect(primaryButton).toHaveScreenshot("button-primary-hover.png");

    // Focus state
    await primaryButton.focus();
    await expect(primaryButton).toHaveScreenshot("button-primary-focus.png");
  });

  test("button sizes", async ({ page }) => {
    const buttonsContainer = page.getByTestId("button-sizes");

    await expect(buttonsContainer).toHaveScreenshot("button-sizes.png");
  });

  test("button with disabled animations", async ({ page }) => {
    const animatedButton = page.getByRole("button", { name: /animated/i });

    await expect(animatedButton).toHaveScreenshot("button-animated.png", {
      animations: "disabled",
    });
  });
});
```

**Why good:** Tests visual states (hover, focus) that are hard to test otherwise, disables animations for deterministic screenshots, element-specific screenshots reduce noise

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Configuration._
