# Visual Regression Reference

> Option semantics, update modes, the pre-commit checklist and a troubleshooting table. Decisions and red flags live in [SKILL.md](SKILL.md); implementations live in [examples/](examples/core.md).

---

## Where an Option Belongs

Comparison options split cleanly by what they describe, and the split decides where they can be set. **Setting a per-capture option in configuration is silently useless** — it is accepted and ignored, so the suite runs unmasked while the configuration says otherwise.

**Per-capture — describes _this_ subject, so it cannot be a default:**

| Option           | Effect                                                   |
| ---------------- | -------------------------------------------------------- |
| `clip`           | Capture a rectangle of the page. Page-level capture only |
| `fullPage`       | Capture past the viewport. Page-level capture only       |
| `mask`           | Overlay a flat box over each located region              |
| `maskColor`      | The fill colour used for masks                           |
| `omitBackground` | Transparent background instead of an opaque one          |

**Configuration — describes the comparison, so it should be a default:**

| Option              | Effect                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `threshold`         | Per-pixel colour distance before a pixel counts as different (commonly `0.2`) |
| `maxDiffPixels`     | Absolute count of differing pixels tolerated                                  |
| `maxDiffPixelRatio` | Share of the image tolerated, 0–1                                             |
| `scale`             | Capture in CSS pixels or device pixels; CSS keeps one baseline across ratios  |
| `stylePath`         | Stylesheet injected at capture time                                           |
| `animations`        | Whether CSS motion runs; commonly disabled by default                         |
| `caret`             | Whether the text cursor is drawn; commonly hidden by default                  |
| `pathTemplate`      | Baseline path layout, including the matrix-cell name                          |
| `timeout`           | Bounds the stabilization retries                                              |

**Stabilization:** comparators typically re-capture until two consecutive frames are identical, then compare the last one. That removes render jitter — not application nondeterminism.

---

## Update Modes

Every harness has these four under some spelling, and picking the wrong one is how a suite quietly stops asserting.

| Mode      | Behaviour                                                     | Use for                      |
| --------- | ------------------------------------------------------------- | ---------------------------- |
| `missing` | Creates missing baselines only                                | Local first run of a subject |
| `changed` | Rewrites mismatched baselines, creates missing ones           | Deliberate, reviewed refresh |
| `all`     | Rewrites every executed baseline, **including matching ones** | Almost never                 |
| `none`    | Never writes; a missing baseline is a failure                 | CI                           |

A bare "update" flag with no mode usually means `all`. Spell the mode.

---

## Hosted-Service Capture Parameters

Configurable at project, component and subject level. Later levels win — **except modes, which stack**.

| Parameter                 | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `modes`                   | Named theme/viewport/locale combinations; one snapshot each      |
| `diffThreshold`           | Change sensitivity; lower is stricter                            |
| `diffIncludeAntiAliasing` | Whether anti-aliased pixels count; commonly ignored by default   |
| `delay`                   | Fixed wait before capture; last resort for motion with no signal |
| `pauseAnimationAtEnd`     | Capture the last frame of an animation rather than the first     |
| `disableSnapshot`         | Excludes the subject from capture entirely                       |

**Default motion handling** in hosted services is usually: CSS animations and transitions paused at their end frame, videos and animated images paused at their first, and JavaScript-driven motion not handled at all — that last one is the test's job to stop.

**Do not port tolerance numbers between harnesses.** A hosted service's change sensitivity and a self-hosted comparator's per-pixel threshold are different algorithms on different scales, so a number copied across carries no meaning.

---

## Before Committing a New Baseline

- [ ] The subject is scoped to what is under test — element or clip, not the whole page by default
- [ ] Fonts are self-hosted and the capture waits on `document.fonts.ready`
- [ ] JS-driven motion is stopped by the stabilizing stylesheet, not merely waited out
- [ ] The clock is frozen; locale and timezone are pinned
- [ ] Randomness is seeded before any application script runs
- [ ] Fixture data is fixed and ordered, with absolute dates and stable identifiers
- [ ] Scrollbars are hidden, and device scale factor and capture scale are pinned
- [ ] Volatile regions are masked, not absorbed by a raised tolerance
- [ ] The baseline was generated inside the same pinned image CI uses
- [ ] Three repeated runs pass against the new baseline
- [ ] The image is in the same pull request as the change that caused it
- [ ] Someone other than the author will accept it

---

## Troubleshooting

| Symptom                                               | Likely cause                                          | Fix                                                              |
| ----------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| Every subject differs across the whole frame          | Baseline rendered on a different OS or image          | Regenerate inside the pinned CI image                            |
| Text blocks shift by a few pixels, intermittently     | Font not loaded at capture time                       | Self-host and preload; await `document.fonts.ready`              |
| A thin outline or curve differs on every run          | Anti-aliasing                                         | Keep `threshold` at its default; do not raise the pixel counters |
| One region differs every run, the rest is stable      | Live data, a timestamp, or a third-party asset        | Mask it, or hide it in the stabilizing stylesheet                |
| Diffs appear only on the first run of the day         | Cache-dependent asset or relative-date rendering      | Freeze the clock; serve fixtures instead of live data            |
| Layout shifts by ~15px horizontally                   | A scrollbar present in one environment only           | Hide scrollbars in the stabilizing stylesheet                    |
| Text is sharp locally and blurry in CI, or vice versa | Differing device pixel ratio                          | Pin the device scale factor; capture in CSS pixels               |
| A masked area is invisible in the diff                | The UI legitimately contains the default mask fill    | Set the mask colour explicitly                                   |
| Baselines "disappeared" after a config change         | A matrix cell was renamed — its name is in the path   | Restore the name, or move the files deliberately                 |
| The whole hosted corpus recaptured unexpectedly       | Config or global-preview change, or rewritten history | Expected after those; avoid force-pushing gated branches         |
| A mode change did not produce a new baseline          | Baselines key on mode **name**, not its values        | Rename the mode to start a fresh baseline                        |
| The suite is green but the UI is visibly wrong        | A baseline was accepted without review                | Find the accepting commit, restore, re-review                    |
