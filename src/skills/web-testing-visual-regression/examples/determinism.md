# Visual Regression - Determinism Examples

> Making a render a pure function of the code under test. See [core.md](core.md) for configuration and scoping.

**Prerequisites**: Understand Pattern 1 (Comparison Configuration) and Pattern 3 (Masking) from [core.md](core.md) first — masking neutralises regions you accept as volatile; determinism removes volatility you should not accept at all.

---

## Pattern: The Stabilizing Stylesheet

One stylesheet, wired once through `stylePath`, kills the four cheapest sources of noise for every capture in the suite.

```css
/* visual/stabilize.css - injected at capture time, never shipped */

/* JS-driven and CSS-driven motion alike, including infinite spinners */
*,
*::before,
*::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}

/* Scrollbar width differs by platform and shifts layout by ~15px */
html {
  scrollbar-width: none;
}
::-webkit-scrollbar {
  display: none;
}

/* Blinking text cursor lands in some frames and not others */
* {
  caret-color: transparent !important;
}

/* Regions with no stable locator to mask */
[data-visual-hide],
.live-chat-widget {
  visibility: hidden !important;
}
```

**Why good:** applies to every subject without a line of per-test code, and the file is a readable inventory of what the suite refuses to assert

**Why bad (the alternative):** injecting the same CSS with an `addStyleTag` call in a `beforeEach` means every new spec file must remember to do it, and the ones that forget produce intermittent diffs that look like product bugs

> The screenshot assertion already sets `animations: "disabled"`, which freezes CSS animations and transitions to their end state. The stylesheet above matters for JS-driven motion (`requestAnimationFrame` loops, animation libraries writing inline styles) and for the scrollbar/caret classes of noise.

---

## Pattern: Fonts

A web font that has not finished loading renders in a fallback face with different metrics — every text block shifts, and the diff is total.

### Good Example

```typescript
// playwright.config.ts - deny the network path that makes fonts async and flaky
use: {
  // Fonts are served by the app under test, not a third-party CDN
  baseURL: process.env.APP_URL,
},

// visual/fixtures.ts - one gate, applied before every capture
export async function settleFonts(page: Page): Promise<void> {
  // Resolves only once every face used by the document is usable
  await page.evaluate(() => document.fonts.ready);
}
```

```html
<!-- Self-host and preload the faces the first paint needs -->
<link
  rel="preload"
  href="/fonts/inter-variable.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

**Why good:** `document.fonts.ready` is a real signal rather than a guessed delay; self-hosting removes a third-party host from the critical path of every visual run

### Bad Example

```typescript
// BAD: hoping the font wins the race
await page.goto(URL);
await page.waitForTimeout(FONT_GUESS_MS);
await expect(page).toHaveScreenshot("typography.png");
```

**Why bad:** the delay is either too short on a loaded CI machine (baseline captured in the fallback face, then every clean run "fails") or long enough to add minutes across the suite — and it is silently wrong either way

---

## Pattern: Time and Locale

Relative timestamps, clocks, date-stamped rows, and locale-formatted numbers all re-render themselves into the diff.

### Good Example

```typescript
// playwright.config.ts - pin the formatting environment for every project
use: {
  locale: "en-US",
  timezoneId: "UTC",
},
```

```typescript
// visual/dashboard.spec.ts
const FIXED_NOW = new Date("2026-01-15T12:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW); // must precede navigation
  await page.goto(DASHBOARD_URL);
});
```

**Why good:** `setFixedTime` pins `Date.now()` while leaving timers alive, so components that poll still settle; pinning locale and timezone stops the same build rendering `1,234.50` on one agent and `1.234,50` on another

### Bad Example

```typescript
// BAD: advancing time to "get past" the loading state
await page.clock.fastForward("00:30");
await expect(page).toHaveScreenshot("dashboard.png");
```

**Why bad:** fast-forwarding runs timers and restarts animations and polling, so the captured frame depends on exactly where the run lands — the opposite of what the freeze was for. Freeze the clock and wait for the state you want with an assertion.

---

## Pattern: Randomness and Data

### Good Example - Seed the generator

```typescript
// visual/fixtures.ts
const SEED_STATE = {
  seed: 42,
  multiplier: 1103515245,
  increment: 12345,
  modulus: 2 ** 31,
};

export async function seedRandomness(page: Page): Promise<void> {
  await page.addInitScript((lcg) => {
    let state = lcg.seed;
    Math.random = () => {
      state = (state * lcg.multiplier + lcg.increment) % lcg.modulus;
      return state / lcg.modulus;
    };
  }, SEED_STATE);
}
```

**Why good:** runs before any application script, so ids, shuffles, and placeholder pickers are identical on every run and on every machine

### Good Example - Fixed, ordered fixture data

```typescript
// visual/fixtures/users.ts - the corpus a visual subject renders
export const VISUAL_USERS = [
  {
    id: "usr_0001",
    name: "Ada Lovelace",
    joinedAt: "2025-03-04T00:00:00Z",
    plan: "pro",
  },
  {
    id: "usr_0002",
    name: "Grace Hopper",
    joinedAt: "2025-03-05T00:00:00Z",
    plan: "free",
  },
  {
    id: "usr_0003",
    name: "Karen Spärck Jones",
    joinedAt: "2025-03-06T00:00:00Z",
    plan: "pro",
  },
] as const;
```

**Why good:** fixed identifiers, deterministic ordering, absolute dates, and one deliberately long name that exercises truncation — the same three rows render identically forever

**Why bad (the alternative):** pointing a visual subject at a shared staging database means the row count, the sort order, and the avatar set drift under you; the suite fails on days nobody touched the UI

> The mechanics of intercepting requests to serve these fixtures belong to the end-to-end testing skill. What matters here is only that the bytes the subject renders are fixed and ordered.

---

## Pattern: Rasterization and Viewport

```typescript
// playwright.config.ts
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

use: {
  viewport: DESKTOP_VIEWPORT,
  deviceScaleFactor: 1, // 2 doubles image size and re-rasterizes text
},
expect: {
  toHaveScreenshot: { scale: "css" }, // CSS pixels, so a HiDPI agent matches a 1x agent
},
```

`scale: "css"` (the default) captures in CSS pixels rather than device pixels — the same baseline then holds across agents with different device pixel ratios. Switch to `"device"` only when the physical rasterization is the thing under test, and accept that the baseline is then tied to that DPR.

---

## Pattern: Environment Parity

Font rasterization, subpixel antialiasing, and emoji glyphs differ between operating systems and between container images. A baseline generated anywhere other than the environment that will diff it is noise from the first run.

### Good Example - Generate baselines inside the CI image

```bash
# Same image tag CI uses; --ipc=host prevents Chromium OOM crashes
docker run --rm --ipc=host \
  -v "$(pwd)":/work -w /work \
  mcr.microsoft.com/playwright:v1.62.0-noble \
  npx playwright test --update-snapshots=changed
```

**Why good:** the image pins the OS, the font stack, and the browser build, so the images committed are byte-comparable with what CI renders; pinning the tag to the same version as the project dependency keeps the browser binaries in step

### Bad Example

```bash
# BAD: baselines from a laptop
npx playwright test --update-snapshots
git add visual/__baselines__
```

**Why bad:** macOS renders text differently from the Linux container, so CI reports a full-frame diff on every subject; the team concludes visual testing "does not work here" and either regenerates on CI blindly or deletes the job

### Prove determinism before committing a baseline

```bash
# A new or updated subject must survive repeated runs against its own baseline
npx playwright test --project=desktop-light --repeat-each=3
```

If three consecutive runs pass, the subject is deterministic. If they do not, the fix is in this file — not in the tolerance.

---

_Next: [story-driven.md](story-driven.md) for catalog-based coverage, or [ci.md](ci.md) for pipeline wiring._
