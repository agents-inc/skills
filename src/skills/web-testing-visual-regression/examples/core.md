# Visual Regression - Configuration, Matrix, Masking and Scoping

> For a harness you run yourself, with baselines committed to the repository. See [determinism.md](determinism.md) for making the render stable, [catalog-driven.md](catalog-driven.md) for catalog-driven coverage, and [ci.md](ci.md) for pipeline wiring.

> **These are portable shapes, not runnable code.** `matchScreenshot(subject, name, options)` stands for your harness's screenshot assertion and `visual.config.ts` for its configuration file; `goto`, `setColorScheme`, `byTestId`, `byRole` and the bare `page` stand for its navigation, emulation and locator controls. The option names are the ones the common pixel comparators share; confirm every spelling against yours.

---

## Pattern 1: The Configuration Owns the Tolerances

### Good Example

```typescript
// visual.config.ts
const PIXEL_THRESHOLD = 0.2; // per-pixel colour distance, 0-1
const MAX_DIFF_PIXEL_RATIO = 0.01; // 1% of the image may differ before failing
const ASSERTION_TIMEOUT_MS = 10_000;

export default {
  testDir: "./visual",
  expect: {
    timeout: ASSERTION_TIMEOUT_MS,
    screenshots: {
      threshold: PIXEL_THRESHOLD,
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      stylePath: "./visual/stabilize.css", // applied to every capture
      // Flat, cell-scoped layout instead of sibling folders next to each spec
      pathTemplate:
        "{testDir}/__baselines__/{projectName}/{testFileName}/{arg}{ext}",
    },
  },
  // A missing baseline is a hard failure in CI; locally it is created on first run
  updateSnapshots: process.env.CI ? "none" : "missing",
};
```

**Why good:** one place to tune sensitivity, so nobody has to read every spec to learn what the suite enforces. `stylePath` applies the stabilizing CSS without editing a test. Refusing to create baselines in CI stops a run inventing an approval nobody gave.

### Bad Example

```typescript
// BAD: every test invents its own idea of "close enough"
await matchScreenshot(page, "a.png", { maxDiffPixels: 100 });
await matchScreenshot(page, "b.png", { maxDiffPixels: 4000, threshold: 0.6 });
await matchScreenshot(page, "c.png", { maxDiffPixelRatio: 0.15 });
```

**Why bad:** each number was tuned to silence one flaky run, so the suite's actual guarantee is unknowable. `threshold: 0.6` makes a mid-grey pixel and a mid-blue pixel equal; `maxDiffPixelRatio: 0.15` hides a collapsed sidebar.

### The two knobs answer different questions

| Option              | Question it answers                         | Raise it when                                   |
| ------------------- | ------------------------------------------- | ----------------------------------------------- |
| `threshold`         | Is _this pixel_ different?                  | Anti-aliasing/subpixel noise on text and curves |
| `maxDiffPixels`     | Are _too many_ pixels different?            | A small, bounded region legitimately varies     |
| `maxDiffPixelRatio` | Is _too large a share_ of pixels different? | Subjects differ wildly in size                  |

A pixel counts against the two counters only once it has already exceeded `threshold`. Reach for `threshold` first; reaching for the counters usually means the subject needs a mask.

---

## Pattern 2: The Matrix Comes From Configuration Cells

One test, N approved images. The cell's name becomes part of the baseline path, so each cell is approved on its own.

### Good Example

```typescript
// visual.config.ts
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export default {
  projects: [
    {
      name: "desktop-light",
      use: { viewport: DESKTOP_VIEWPORT, colorScheme: "light" },
    },
    {
      name: "desktop-dark",
      use: { viewport: DESKTOP_VIEWPORT, colorScheme: "dark" },
      // Dark mode surfaces token bugs as large flat areas - tighten this cell alone
      expect: { screenshots: { maxDiffPixelRatio: 0.002 } },
    },
    {
      name: "mobile-light",
      use: { viewport: MOBILE_VIEWPORT, colorScheme: "light" },
    },
    {
      name: "second-browser",
      use: { browser: "firefox" },
      ignoreSnapshots: true, // same specs for behaviour, no baselines to maintain
    },
  ],
};
```

**Why good:** adding dark mode costs one configuration block rather than a duplicated test file. Driving `colorScheme` lets the application's own theming decide the render, so the test covers the real mechanism. The per-cell override lets one cell be stricter than the rest without loosening or tightening the whole suite.

### Bad Example

```typescript
// BAD: one test per theme
test("dashboard light", async () => {
  await setColorScheme("light");
  await matchScreenshot(page, "dashboard-light.png");
});

test("dashboard dark", async () => {
  await setColorScheme("dark");
  await matchScreenshot(page, "dashboard-dark.png");
});
```

**Why bad:** every new subject must be written twice and every change applied twice. When someone adds a third theme, only the subjects they remembered get covered — and the gap is invisible, because nothing fails.

### Keeping the repository small

```typescript
// The extension in the baseline name selects the encoding
await matchScreenshot(page, "pricing-table.webp");
```

WebP is markedly smaller than PNG for UI screenshots. Across a large matrix that is the difference between a repository that clones in seconds and one that does not.

---

## Pattern 3: Masking Dynamic Regions

### Good Example

```typescript
// visual/dashboard.spec.ts
const MASK_FILL = "#000000";

test("dashboard shell", async () => {
  await goto(DASHBOARD_URL);

  await matchScreenshot(page, "dashboard.png", {
    mask: [
      byTestId("last-synced-at"), // live relative timestamp
      byTestId("session-sparkline"), // streams new points
      byRole("img", { name: /avatar/i }), // third-party image host
    ],
    maskColor: MASK_FILL, // the default fill is often magenta, which brand palettes use
  });
});
```

**Why good:** three known-volatile regions are neutralised while the rest of the frame stays pixel-strict, and the mask list is a readable inventory of exactly what the test does not cover.

### Bad Example

```typescript
// BAD: "the timestamp keeps failing, bump the tolerance"
await matchScreenshot(page, "dashboard.png", { maxDiffPixelRatio: 0.2 });
```

**Why bad:** 20% of a 1280×800 frame is roughly 205,000 pixels. An entire missing card, a wrong theme on a panel, or a column that stopped wrapping all fit comfortably inside that budget and will never fail.

### When the region cannot be located

Masking needs a locator. A volatile region with no stable handle is hidden in the stabilizing stylesheet instead, which needs only a selector and applies to every capture — see [determinism.md](determinism.md).

---

## Pattern 4: Scoping the Subject

The smallest capture that proves the point produces the clearest diff and the least churn.

### Good Example

```typescript
// The component is the subject: capture the component
await matchScreenshot(
  byRole("region", { name: /pro plan/i }),
  "pricing-card-pro.png",
);

// A geometric band owned by no single element: clip (page-level capture only)
const HEADER_BOX = { x: 0, y: 0, width: 1280, height: 96 };
await matchScreenshot(page, "header-band.png", { clip: HEADER_BOX });

// The page itself is the subject - marketing and print layouts: full page
await matchScreenshot(page, "landing.png", { fullPage: true });
```

**Why good:** an element capture fails only when that element changes, so the failure names the culprit. `clip` covers bands that span components, and `fullPage` is reserved for the case where whole-page composition _is_ the requirement.

### Bad Example

```typescript
// BAD: proving the button changed by photographing the entire route
await goto("/settings");
await matchScreenshot(page, "settings-full.png", { fullPage: true });
```

**Why bad:** a copy edit in the navigation fails this baseline and every other full-page baseline at once. The reviewer sees dozens of red subjects and no signal about the button, and the fastest way out is a blanket regenerate.

### Scoping rules of thumb

| Subject                                   | Capture                        |
| ----------------------------------------- | ------------------------------ |
| A component or one of its states          | Element capture                |
| A band or region spanning components      | Page capture with `clip`       |
| Whole-page composition (landing, invoice) | Page capture with `fullPage`   |
| Anything above the fold only              | Page capture, default viewport |

`clip` and `fullPage` exist on the page-level capture only. For an element, capture the element — do not compute its bounding box and clip the page to it.

---

_Next: [determinism.md](determinism.md) for the stabilizing stylesheet, frozen clocks, seeded randomness and environment parity._
