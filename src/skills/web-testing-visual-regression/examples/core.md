# Visual Regression - Core Examples

> Configuration, the baseline matrix, masking, and subject scoping for a self-hosted image-comparison harness. See [determinism.md](determinism.md) for making the render stable, [story-driven.md](story-driven.md) for catalog-driven coverage, and [ci.md](ci.md) for pipeline wiring.

---

## Pattern 1: Comparison Configuration

All tolerance and layout decisions live in one file. Assertions carry only what varies per subject.

### Good Example - Config owns the tolerances

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const PIXEL_THRESHOLD = 0.2; // per-pixel YIQ colour distance, 0-1 (library default)
const MAX_DIFF_PIXEL_RATIO = 0.01; // 1% of the image may differ before failing
const ASSERTION_TIMEOUT_MS = 10_000;

export default defineConfig({
  testDir: "./visual",
  expect: {
    timeout: ASSERTION_TIMEOUT_MS,
    toHaveScreenshot: {
      threshold: PIXEL_THRESHOLD,
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      stylePath: "./visual/stabilize.css",
      // Flat, project-scoped layout instead of the default *-snapshots sibling folders
      pathTemplate:
        "{testDir}/__baselines__/{projectName}/{testFileName}/{arg}{ext}",
    },
  },
  // A missing baseline is a hard failure in CI; locally it is created on first run
  updateSnapshots: process.env.CI ? "none" : "missing",
});
```

**Why good:** one place to tune sensitivity; `stylePath` applies stabilizing CSS to every capture without editing tests; `updateSnapshots: "none"` in CI prevents a run from inventing a baseline nobody approved

### Bad Example - Tolerances scattered across assertions

```typescript
// BAD: every test invents its own idea of "close enough"
await expect(page).toHaveScreenshot("a.png", { maxDiffPixels: 100 });
await expect(page).toHaveScreenshot("b.png", {
  maxDiffPixels: 4000,
  threshold: 0.6,
});
await expect(page).toHaveScreenshot("c.png", { maxDiffPixelRatio: 0.15 });
```

**Why bad:** the numbers were each tuned to silence one flaky run, so nobody knows what the suite actually enforces; `threshold: 0.6` makes a mid-grey pixel and a mid-blue pixel equal, and `maxDiffPixelRatio: 0.15` hides a collapsed sidebar

### The two knobs are not interchangeable

| Option              | Question it answers                         | Raise it when                                   |
| ------------------- | ------------------------------------------- | ----------------------------------------------- |
| `threshold`         | Is _this pixel_ different?                  | Anti-aliasing/subpixel noise on text and curves |
| `maxDiffPixels`     | Are _too many_ pixels different?            | A small, bounded region legitimately varies     |
| `maxDiffPixelRatio` | Is _too large a share_ of pixels different? | Subjects differ wildly in size                  |

A pixel is only counted against `maxDiffPixels`/`maxDiffPixelRatio` if it already exceeded `threshold`. Reach for `threshold` first; reaching for the counters usually means the subject needs a mask.

---

## Pattern 2: The Baseline Matrix from Projects

One test, N approved images. The project name becomes part of the baseline path, so each cell of the matrix is independently approved.

### Good Example - Matrix declared once

```typescript
// playwright.config.ts
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export default defineConfig({
  projects: [
    {
      name: "desktop-light",
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP_VIEWPORT,
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark",
      use: {
        ...devices["Desktop Chrome"],
        viewport: DESKTOP_VIEWPORT,
        colorScheme: "dark",
      },
      // Dark mode tends to expose token bugs as large flat areas - tighten this cell
      expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
    },
    {
      name: "mobile-light",
      use: {
        ...devices["Desktop Chrome"],
        viewport: MOBILE_VIEWPORT,
        colorScheme: "light",
      },
    },
    {
      name: "firefox-functional",
      use: { ...devices["Desktop Firefox"] },
      ignoreSnapshots: true, // runs the same specs for behaviour, keeps no baselines
    },
  ],
});
```

**Why good:** adding dark mode costs one config block, not a duplicated test file; `colorScheme` drives `prefers-color-scheme` so the app's own theming decides the render; per-project `expect` overrides let one cell be stricter than the rest; `ignoreSnapshots` keeps a browser in the functional run without doubling the images you maintain

### Bad Example - Matrix by copy-paste

```typescript
// BAD: one file per theme
test("dashboard light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page).toHaveScreenshot("dashboard-light.png");
});

test("dashboard dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page).toHaveScreenshot("dashboard-dark.png");
});
```

**Why bad:** every new subject must be written twice and every change must be applied twice; when someone adds a third theme only the subjects they remembered get covered, and the gap is invisible because nothing fails

### Keeping the repository small

```typescript
// WebP baselines are markedly smaller than PNG for UI screenshots
await expect(page).toHaveScreenshot("pricing-table.webp");
```

The extension in the baseline name selects the encoding. On a large matrix this is the difference between a repository that clones in seconds and one that does not.

---

## Pattern 3: Masking Dynamic Regions

Mask the pixels that legitimately vary; keep the rest under strict comparison.

### Good Example - Targeted masks

```typescript
// visual/dashboard.spec.ts
const MASK_FILL = "#000000";

test("dashboard shell", async ({ page }) => {
  await page.goto(DASHBOARD_URL);

  await expect(page).toHaveScreenshot("dashboard.png", {
    mask: [
      page.getByTestId("last-synced-at"), // live relative timestamp
      page.getByTestId("session-sparkline"), // streams new points
      page.getByRole("img", { name: /gravatar/i }), // third-party image host
    ],
    maskColor: MASK_FILL, // per-call only; default #FF00FF collides with brand magenta
  });
});
```

**Why good:** three known-volatile regions are neutralised while the layout around them stays pixel-strict; the mask list documents exactly which parts of the UI are not covered

### Bad Example - Tolerance instead of masking

```typescript
// BAD: "the timestamp keeps failing, bump the tolerance"
await expect(page).toHaveScreenshot("dashboard.png", {
  maxDiffPixelRatio: 0.2,
});
```

**Why bad:** 20% of a 1280×800 frame is roughly 205,000 pixels — an entire missing card, a wrong theme on a panel, or a column that stopped wrapping all fit comfortably inside that budget and will never fail

### When the region cannot be located

If a volatile region has no stable handle, hide it in the stabilizing stylesheet instead — see [determinism.md](determinism.md). Masking requires a locator; `stylePath` requires only a selector and applies to every capture.

---

## Pattern 4: Scoping the Subject

The smallest capture that proves the point produces the clearest diff and the least churn.

### Good Example - Capture the subject

```typescript
// The component is the subject: capture the component
const pricingCard = page.getByRole("region", { name: /pro plan/i });
await expect(pricingCard).toHaveScreenshot("pricing-card-pro.png");

// A geometric band with no single owning element: clip (page-level assertion only)
const HEADER_BOX = { x: 0, y: 0, width: 1280, height: 96 };
await expect(page).toHaveScreenshot("header-band.png", { clip: HEADER_BOX });

// The page itself is the subject (marketing/print layouts): full page
await expect(page).toHaveScreenshot("landing.png", { fullPage: true });
```

**Why good:** an element capture fails only when that element changes, so the failure names the culprit; `clip` covers bands that span components; `fullPage` is reserved for the case where whole-page composition is the requirement

### Bad Example - Full page for a component

```typescript
// BAD: proving the button changed by photographing the entire route
await page.goto("/settings");
await expect(page).toHaveScreenshot("settings-full.png", { fullPage: true });
```

**Why bad:** a copy edit in the navigation fails this baseline and every other full-page baseline in the suite at once; the reviewer sees dozens of red subjects and no signal about the button, and the fastest way out is a blanket regenerate

### Scoping rules of thumb

| Subject                                   | Capture                          |
| ----------------------------------------- | -------------------------------- |
| A component or one of its states          | Element assertion                |
| A band or region spanning components      | Page assertion with `clip`       |
| Whole-page composition (landing, invoice) | Page assertion with `fullPage`   |
| Anything above the fold only              | Page assertion, default viewport |

`clip` and `fullPage` exist only on the page-level assertion. For an element, capture the element — do not compute its bounding box and clip the page to it.

---

_Next: [determinism.md](determinism.md) for the stabilizing stylesheet, frozen clocks, seeded randomness, and container parity._
