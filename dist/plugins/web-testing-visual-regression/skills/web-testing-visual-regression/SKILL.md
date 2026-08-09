---
name: web-testing-visual-regression
description: Visual regression testing - screenshot baselines, determinism, diff review workflow, baseline custody, and CI wiring for catching unintended UI changes
---

# Visual Regression Testing

> **Quick Guide:** A visual test asserts that a rendered subject still looks the way a human approved it. The assertion is trivial; everything hard is around it — making the render deterministic, scoping the subject tightly, generating baselines in the same environment that will diff them, and reviewing every diff before accepting a new baseline. A baseline accepted without looking at it turns the suite into a machine that asserts the bug.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST look at the diff before accepting any baseline — an unreviewed baseline permanently encodes whatever was on screen, including the regression)**

**(You MUST make the render deterministic before capturing — fonts loaded, animations stopped, time frozen, data fixed — or the diff reports noise instead of regressions)**

**(You MUST generate and compare baselines in the same environment — same pinned container image, same browser build — never commit baselines rendered on a developer machine)**

**(You MUST scope the capture to the subject under test — an element or a clip — and reserve full-page captures for cases where the page itself is the subject)**

**(You MUST mask dynamic regions rather than loosening the comparison threshold — a threshold wide enough to absorb a live timestamp is wide enough to absorb a broken layout)**

</critical_requirements>

---

**Auto-detection:** visual regression, visual testing, screenshot testing, snapshot image, baseline image, toHaveScreenshot, pixel diff, maxDiffPixels, maxDiffPixelRatio, diffThreshold, Chromatic, TurboSnap, accept baseline, update snapshots, golden image, UI diff

**When to use:**

- Catching unintended visual changes in components, pages, or design-system primitives
- Protecting a shared component library where one CSS change fans out across consumers
- Verifying theme/viewport matrices (light and dark, mobile and desktop) render as designed
- Guarding states that are hard to assert semantically — spacing, overflow, z-order, focus rings, truncation
- Locking down a marketing or print-style page where the layout _is_ the requirement

**When NOT to use:**

- Asserting text content, ARIA structure, or behaviour — a text or role assertion fails with a readable message; a pixel diff makes a human squint at two images
- Guarding a surface that legitimately changes every render (live feeds, ad slots, animated canvases) unless those regions are masked
- Substituting for missing functional coverage — a screenshot proves the pixels moved, never that the feature works

**Explicitly out of scope (owned by sibling skills):**

- Writing stories, story args/decorators, and workshop setup — `web-tooling-storybook`
- Functional end-to-end flows, locator strategy, and network interception mechanics — `web-testing-playwright-e2e`
- Unit and component-level assertions — `web-testing-vitest`, `web-testing-react-testing-library`

**Key patterns covered:**

- Harness choice: self-hosted image comparison vs cloud change-detection service
- Configuration-driven comparison — tolerances and the baseline matrix live in config, not in assertions
- Determinism checklist — fonts, motion, time, randomness, data, scrollbars, environment
- Story-driven coverage — a story catalog as the visual corpus, modes, interaction states
- Baseline lifecycle — proposing, reviewing, and accepting a new approved image
- CI wiring — when the visual job runs, what artifacts it emits, how cost stays bounded

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Config defaults, project matrix, masking, subject scoping
- [examples/determinism.md](examples/determinism.md) - Fonts, motion, frozen clocks, seeded randomness, scrollbars, container parity
- [examples/story-driven.md](examples/story-driven.md) - Story corpus, modes, interaction states, change detection
- [examples/ci.md](examples/ci.md) - Visual job wiring, diff artifacts, baseline-update workflow, cost control
- [reference.md](reference.md) - Option tables, harness comparison matrix, determinism checklist, CLI flags

---

<philosophy>

## Philosophy

Every other kind of test states its intent in code: `expect(total).toBe(42)` says what correct means. A visual test states its intent in a **file** — an approved image somebody looked at once. That single difference drives everything.

**Three consequences follow:**

1. **The baseline is a review artifact, not a build artifact.** It is the recorded judgement of a human who decided the UI was right. Regenerating it without looking destroys the only thing the test knows.
2. **Nondeterminism is not flake, it is a false requirement.** A pixel that varies between runs is being asserted as if it were part of the design. Either pin it or mask it — never widen the tolerance until it stops complaining.
3. **The diff is the output.** A visual suite that fails without producing a viewable expected/actual/diff triplet is unactionable, and unactionable suites get disabled within two sprints.

**What visual tests are good at:** whole-appearance properties that no reasonable assertion expresses — a shadow that vanished, a 3px shift that broke alignment, a font that failed to load, a dark-theme token that resolved to white-on-white, a container that stopped clipping overflow.

**What they are bad at:** anything you could name. If you can write `toBeVisible()`, `toHaveText()`, or an accessibility-tree assertion, write that instead. Those fail with a sentence; a pixel diff fails with homework.

**The economic model matters more than the API.** Self-hosted comparison is free per run and expensive per human hour — baselines live in the repository, review happens in code review, and every environment mismatch is your problem. Cloud change detection inverts that: pay per snapshot, get parallel capture, hosted review UI, and a shared, environment-controlled renderer. Choose deliberately; retrofitting is a migration, not a flag.

</philosophy>

---

<decision_framework>

## Choosing a Harness

Two families exist. They differ in where the baseline lives, who accepts a change, and who owns the render environment.

```
Do you already maintain a browsing test suite and a container image for CI?
├─ NO  → Do you have a story catalog covering component states?
│        ├─ YES → Cloud change-detection service (story-driven)
│        └─ NO  → Build the state coverage first; a harness cannot invent subjects
└─ YES → Is baseline review expected to happen in code review?
         ├─ YES → Self-hosted image comparison (baselines committed to the repo)
         └─ NO  → Is a hosted review UI with per-change accept/deny required
                  by designers or non-engineers?
                  ├─ YES → Cloud change-detection service
                  └─ NO  → Self-hosted image comparison
```

| Dimension            | Self-hosted comparison (`toHaveScreenshot`)                        | Cloud change detection (Chromatic)                                    |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Baseline custody     | PNG/WebP files committed to the repo, versioned with the code      | Stored per branch in the service; merge resolves to the base branch   |
| Who accepts a change | A code reviewer approving the PR containing the new images         | A named human clicking accept in the review UI; recorded per change   |
| Review surface       | Whatever your report renders + the image diff in the PR            | Hosted side-by-side/onion-skin diff, comment threads, designer access |
| Render environment   | Yours — you pin the image and eat every mismatch                   | Theirs — one controlled renderer, no dev-vs-CI drift                  |
| Cost shape           | Free per snapshot; CI minutes + engineer hours on environment work | Billed per snapshot; near-zero environment maintenance                |
| Parallelism          | Bounded by your CI workers and shards                              | Fanned out cloud-side; wall-clock roughly independent of corpus size  |
| Repo impact          | Images inflate clone size; every matrix cell multiplies files      | No images in the repo                                                 |
| Matrix cost          | One baseline file per project × subject; you maintain all of them  | One snapshot per mode × subject; billed, but not maintained by you    |
| Best fit             | App-level pages, teams already running browser tests, no budget    | Design systems, large state catalogs, cross-functional review         |

**Hybrid is legitimate and common:** cloud change detection over the component/state catalog (where breadth and designer review matter) and a handful of self-hosted full-page checks for critical app routes. What is _not_ legitimate is two harnesses covering the same subjects — you get two baselines, two review flows, and two chances to accept the wrong one.

</decision_framework>

---

<patterns>

## Core Patterns

### Pattern 1: Configuration-Driven Comparison

Tolerances, path layout, and the baseline matrix belong in configuration. Per-assertion options are for what genuinely varies by subject — the mask list, the clip box.

#### Defaults live in config

```typescript
// playwright.config.ts
const PIXEL_THRESHOLD = 0.2; // per-pixel YIQ distance, 0-1; library default
const MAX_DIFF_PIXEL_RATIO = 0.01; // share of the image allowed to differ

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      threshold: PIXEL_THRESHOLD,
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
      stylePath: "./visual/stabilize.css",
    },
  },
});
```

**Why good:** one place to tune sensitivity, no drifting per-file magic numbers, `stylePath` applies stabilizing CSS to every capture without touching a test

**Why the two knobs are not interchangeable:** `threshold` decides whether a _single pixel_ counts as different; `maxDiffPixels`/`maxDiffPixelRatio` decide how many differing pixels are tolerated. Anti-aliasing needs the first; nothing needs the second set above ~1% except a subject you should have masked.

#### The matrix comes from projects, not duplicated tests

```typescript
// One test, four baselines - never four copy-pasted tests
projects: [
  {
    name: "desktop-light",
    use: { ...devices["Desktop Chrome"], colorScheme: "light" },
  },
  {
    name: "desktop-dark",
    use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
  },
  {
    name: "mobile-light",
    use: { viewport: MOBILE_VIEWPORT, colorScheme: "light" },
  },
  { name: "firefox", use: devices["Desktop Firefox"], ignoreSnapshots: true },
];
```

**Why good:** the project name enters the baseline filename, so each cell gets its own approved image; `ignoreSnapshots: true` keeps a browser in the functional run without a second baseline set to maintain

**Why bad (the alternative):** duplicating a test per theme means the day the subject changes you update N tests, and the day one is forgotten it silently stops covering anything.

#### Mask what moves; do not widen the threshold

```typescript
await expect(page).toHaveScreenshot("dashboard.png", {
  mask: [
    page.getByTestId("last-updated"),
    page.getByTestId("live-visitor-count"),
  ],
  maskColor: "#000000", // per-call only - not accepted in the config-level expect block
});
```

**Why good:** the volatile region is replaced by a flat block, so the rest of the frame stays under strict comparison

**Why bad:** raising `maxDiffPixelRatio` until the timestamp stops failing also buys enough slack to hide a collapsed column.

See [examples/core.md](examples/core.md) for the full config, the mobile/dark matrix, WebP baselines, and `pathTemplate` layout.

---

### Pattern 2: Determinism Before Assertion

Six sources of nondeterminism account for nearly every flaky visual test. Each has a fix that is cheaper than the flake.

| Source               | Symptom in the diff                             | Fix                                                             |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Web fonts            | Whole blocks of text shift; fallback metrics    | Self-host and preload, then await `document.fonts.ready`        |
| Animation/transition | Random intermediate frames                      | Assertion default disables CSS animation; kill JS motion too    |
| Time                 | "2 minutes ago", clocks, date-stamped rows      | Freeze the clock to a fixed instant before navigating           |
| Randomness           | Shuffled lists, random ids, placeholder avatars | Seed the generator via an init script                           |
| Data                 | Row order and counts vary per run               | Serve fixed fixtures with stable ordering and fixed identifiers |
| Scrollbars / DPR     | 15px width shift, blurry text at 2×             | Hide scrollbars in stabilizing CSS; pin `scale` and viewport    |

```typescript
const FIXED_NOW = new Date("2026-01-15T12:00:00Z");

await page.clock.setFixedTime(FIXED_NOW); // freeze - do not fast-forward, that resumes motion
await page.goto(DASHBOARD_URL);
await page.evaluate(() => document.fonts.ready); // resolves only once every face is usable
await expect(page.getByRole("region", { name: /summary/i })).toHaveScreenshot(
  "summary.png",
);
```

**Why good:** the frame is a pure function of the code under test — rerunning it a hundred times produces one image

**Why bad (the alternative):** `waitForTimeout(1000)` before the capture is a bet that the slowest machine in the fleet finishes in under a second, and it is a bet you lose on the day a reviewer is watching.

**The seventh source is the machine itself.** Font rasterization and subpixel rendering differ between macOS, Windows, and Linux, and between container images. Baselines generated on a laptop and diffed against CI produce a permanent full-frame difference on every subject — which trains the team to regenerate blindly, which destroys the suite. Generate baselines inside the same pinned image CI uses.

See [examples/determinism.md](examples/determinism.md) for the stabilizing stylesheet, seeded-random init script, font preloading, and the containerized baseline-generation command.

---

### Pattern 3: Story-Driven Coverage

A story catalog is a ready-made visual corpus: every meaningful state already has an addressable, isolated, prop-controlled render. Visual coverage then becomes a question of state enumeration rather than test authoring.

#### One story per meaningful state

The unit of visual coverage is a state, not a component. `Button` needs one subject; `Button` in loading, disabled, destructive, icon-only, and long-label states needs five. States that differ only by a prop the eye cannot see do not need their own subject.

#### Interaction-produced states are capturable

A cloud change-detection service waits for the whole interaction script attached to a story to finish before capturing, so open menus, expanded rows, and post-submit validation states become subjects without hand-written fixtures. Interaction failures fail the build rather than producing a snapshot.

#### Modes multiply subjects deliberately

```typescript
export const allModes = {
  "light desktop": { theme: "light", viewport: "large" },
  "dark mobile": { theme: "dark", viewport: "small" },
} as const;

// Applied at project, component, or story level - levels stack, they do not override
parameters: { chromatic: { modes: { "dark mobile": allModes["dark mobile"] } } }
```

**Why good:** the theme/viewport matrix is declared once and reused, and each mode keeps an independent baseline

**Why bad:** applying every mode at project level multiplies the entire corpus — snapshots are billed per mode per subject, and a 400-story catalog at four modes is 1,600 snapshots per build.

**Change detection, not pixel policing:** the service groups differing snapshots into a reviewable change set per build, tracks accept/deny per snapshot, and carries approvals forward so an accepted change stops reappearing on later builds of the same branch.

See [examples/story-driven.md](examples/story-driven.md) for state enumeration, mode definitions, per-subject tolerance parameters, and opting subjects out.

---

### Pattern 4: Baseline Lifecycle

The lifecycle has exactly three legitimate events: **create** (a new subject appears), **accept** (an intended change is reviewed and approved), and **retire** (the subject is deleted, and its images go with it). Anything else is drift.

#### Never regenerate blind

```bash
# WRONG - "the visual tests are failing" reflex
npx playwright test --update-snapshots

# RIGHT - look first
npx playwright test --project=desktop-light   # emits expected/actual/diff per failure
npx playwright show-report                    # inspect every diff
npx playwright test --update-snapshots=changed  # only after each one is understood
```

**Why bad:** a wholesale regenerate rewrites every baseline, including ones that were matching. From that commit forward, the suite asserts the current appearance — bugs included — and it cannot tell you it stopped working.

**Why `changed` over `all`:** `changed` rewrites only mismatched images and creates missing ones; `all` rewrites everything it executes, including matching baselines, quietly resetting subjects you never inspected.

#### The update travels with the change

New or updated images belong in the **same pull request** as the code that changed the appearance, with the diff visible to the reviewer. A "update baselines" commit landed separately is unreviewable: nobody can tell an intended redesign from a regression once the two are in different diffs.

#### Ownership is explicit

- The author who changed the UI **proposes** baselines and states in the PR description what should have changed.
- A second person **accepts** — by approving the PR (self-hosted) or by accepting in the review UI (cloud). Author self-acceptance defeats the whole mechanism.
- Auto-accept belongs on a trunk/release branch at most, never on pull requests, and never as a way to clear a red build.

See [examples/ci.md](examples/ci.md) for the human-triggered baseline-refresh workflow that opens a PR instead of pushing to the branch.

---

### Pattern 5: CI Wiring and Cost Control

#### When the job runs

Visual checks run on pull requests against the merge base and on every trunk build (trunk builds are what keep baselines valid through merges). They do **not** run on documentation-only or config-only changes, and they never run with `--update-snapshots` in an automated job.

#### Failure output must be actionable

```yaml
- name: Visual tests
  run: npx playwright test --project=desktop-light --project=desktop-dark
- name: Upload diffs
  if: ${{ !cancelled() }} # failure is exactly when the artifacts matter
  uses: actions/upload-artifact@v4
  with:
    name: visual-diffs
    path: |
      playwright-report/
      test-results/
```

**Why good:** the reviewer downloads one artifact containing expected/actual/diff for every failure and decides in seconds

**Why bad:** `if: failure()` alone skips artifacts on cancellation and timeout, and a job whose only output is "1 failed" forces a local reproduction of a container-specific render.

#### Bound the cost on purpose

- **Self-hosted:** restrict snapshot projects (`ignoreSnapshots: true` elsewhere), shard the visual project separately from the functional suite, and prefer element captures — smaller images compare faster and diff more clearly.
- **Cloud:** enable change-based targeting (`--only-changed`), which uses git history plus the dependency graph to capture only subjects affected by the diff and copies the rest forward at a fraction of the snapshot cost.
- **Both:** treat the matrix as a budget. Every new mode multiplies the whole corpus; add one only when a real bug class lives in that cell.

#### Exit-code policy is a decision, not a default

Failing the job on detected change forces review before merge. Passing the job on change (`--exit-zero-on-changes`) keeps the pipeline green while changes wait in the review UI — acceptable **only** with a required status check that blocks merge on unaccepted changes. Without that check it is an off switch with extra steps.

See [examples/ci.md](examples/ci.md) for the full workflow, container-parity job, and targeted-run configuration.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Running a blanket baseline update to clear a red build — the suite now asserts whatever was on screen, including the regression, and it will never report it again
- Capturing while the page is still settling (in-flight requests, entrance animations, unloaded fonts) — produces intermittent diffs that get "fixed" by regenerating, which is how blind regeneration becomes a habit
- Committing baselines rendered on a developer machine — font rasterization differs from the CI container, so every subject shows a full-frame diff, the suite is declared broken, and it gets disabled
- Loosening tolerance until the noise stops — a `maxDiffPixelRatio` wide enough to absorb a live counter is wide enough to absorb a missing sidebar
- Full-page captures for single-component subjects — an unrelated header change fails every page baseline at once, and the real component regression is invisible inside the churn
- The author accepting their own baselines — the review step that gives the baseline its meaning never happens

**Medium Priority Issues:**

- No `expected/actual/diff` artifact on failure — reviewers cannot judge, so they regenerate
- Visual assertions mixed into functional test files — one flaky image blocks feedback on unrelated behaviour
- Matrix growth without justification — each mode multiplies the corpus, its maintenance, and (in cloud harnesses) the bill
- Masking so much of the frame that the remaining pixels prove nothing — at that point delete the test
- Trunk never runs the visual job — branch baselines have nothing valid to merge into

**Common Mistakes:**

- Using a screenshot to assert text or presence — use a text/role assertion; it fails with a sentence instead of an image
- Setting `animations: "disabled"` on every call when the screenshot assertion already defaults to disabled
- Naming baselines after test order (`step-3.png`) — reordering silently reassigns approved images to different subjects
- Treating an image diff as "flaky" without identifying which of fonts/motion/time/randomness/data/scrollbars caused it
- Storing baselines outside the repo for a self-hosted harness — the approved image must move with the code that produced it

**Gotchas & Edge Cases:**

- `mask` and `maskColor` are **per-call only**; the config-level `expect.toHaveScreenshot` block accepts `animations`, `caret`, `maxDiffPixels`, `maxDiffPixelRatio`, `scale`, `stylePath`, `threshold`, and `pathTemplate` — nothing else
- The screenshot assertion defaults to `animations: "disabled"`, `caret: "hide"`, `scale: "css"`, `threshold: 0.2` — most per-call option noise is restating defaults
- Masked regions are filled with `#FF00FF` by default; if the UI legitimately contains that colour the mask is invisible in the diff — set `maskColor` explicitly
- `clip` and `fullPage` exist only on the page-level assertion; the element-level assertion has neither — capture the element directly instead
- The assertion self-stabilizes by re-capturing until two consecutive frames match, then diffing the last one — that removes render jitter, not application nondeterminism
- `updateSnapshots` defaults to `'missing'`; `'all'` rewrites matching baselines too, and `'none'` makes a missing baseline a hard failure (useful in CI)
- The project name is part of the baseline path — renaming a project orphans every image under it and the next run happily creates fresh "baselines"
- Cloud modes are keyed by **name**: changing a mode's viewport under the same name keeps comparing against the old baseline, while renaming a mode starts a brand-new one
- Cloud animation handling pauses CSS animations at the **last** frame by default (`pauseAnimationAtEnd: true`) — pre-2024 guidance describing first-frame capture is stale
- The cloud default diff sensitivity (`diffThreshold`, default `0.063`) is a different scale and a different algorithm from the self-hosted `threshold` (`0.2`) — do not port numbers between harnesses
- Change-based targeting depends on a lockfile in sync with the manifest and on intact git history; rebases, squashes, and force pushes fall back to full rebuilds
- `.webp` baselines cut repository growth substantially versus PNG when the corpus is large

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST look at the diff before accepting any baseline — an unreviewed baseline permanently encodes whatever was on screen, including the regression)**

**(You MUST make the render deterministic before capturing — fonts loaded, animations stopped, time frozen, data fixed — or the diff reports noise instead of regressions)**

**(You MUST generate and compare baselines in the same environment — same pinned container image, same browser build — never commit baselines rendered on a developer machine)**

**(You MUST scope the capture to the subject under test — an element or a clip — and reserve full-page captures for cases where the page itself is the subject)**

**(You MUST mask dynamic regions rather than loosening the comparison threshold — a threshold wide enough to absorb a live timestamp is wide enough to absorb a broken layout)**

**Failure to follow these rules will produce a suite that asserts the current bugs, fails at random, and gets deleted by the next person who owns it.**

</critical_reminders>
