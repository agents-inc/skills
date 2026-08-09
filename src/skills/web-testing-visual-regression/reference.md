# Visual Regression Reference

> Option tables, defaults, and checklists. Decision guidance lives in [SKILL.md](SKILL.md); implementations live in [examples/](examples/core.md).

---

## Screenshot Assertion Options

Availability differs between the per-call form and the config-level `expect.toHaveScreenshot` block. Setting a per-call-only option in config is silently useless.

| Option              | Type                      | Default      | Per-call | In config | Notes                                                 |
| ------------------- | ------------------------- | ------------ | :------: | :-------: | ----------------------------------------------------- |
| `animations`        | `"disabled" \| "allow"`   | `"disabled"` |    ✓     |     ✓     | Already disabled — restating it per call is noise     |
| `caret`             | `"hide" \| "initial"`     | `"hide"`     |    ✓     |     ✓     | Blinking caret is hidden by default                   |
| `clip`              | `{ x, y, width, height }` | —            |    ✓     |     ✗     | **Page-level assertion only**                         |
| `fullPage`          | `boolean`                 | `false`      |    ✓     |     ✗     | **Page-level assertion only**                         |
| `mask`              | `Locator[]`               | —            |    ✓     |     ✗     | Overlays a flat box over each locator                 |
| `maskColor`         | CSS colour string         | `"#FF00FF"`  |    ✓     |     ✗     | Change it if the UI uses magenta                      |
| `maxDiffPixels`     | `number`                  | unset        |    ✓     |     ✓     | Absolute count of differing pixels tolerated          |
| `maxDiffPixelRatio` | `number` (0-1)            | unset        |    ✓     |     ✓     | Share of the image tolerated                          |
| `omitBackground`    | `boolean`                 | `false`      |    ✓     |     ✗     | Transparent background instead of white               |
| `scale`             | `"css" \| "device"`       | `"css"`      |    ✓     |     ✓     | `"css"` keeps one baseline across device pixel ratios |
| `stylePath`         | `string \| string[]`      | —            |    ✓     |     ✓     | Stylesheet injected at capture time                   |
| `threshold`         | `number` (0-1)            | `0.2`        |    ✓     |     ✓     | Per-pixel YIQ colour distance                         |
| `timeout`           | `number` (ms)             | from config  |    ✓     |     ✓     | Bounds the stabilization retries                      |
| `pathTemplate`      | `string`                  | —            |    ✗     |     ✓     | Baseline path layout for this assertion type          |

**Config-level block accepts exactly:** `animations`, `caret`, `maxDiffPixels`, `maxDiffPixelRatio`, `scale`, `stylePath`, `threshold`, `pathTemplate`.

**Stabilization:** the assertion re-captures until two consecutive frames are identical, then compares the last one. That removes render jitter — not application nondeterminism.

---

## Baseline Path Tokens

Used in `snapshotPathTemplate` (all snapshot types) or `expect.toHaveScreenshot.pathTemplate` (screenshots only).

| Token            | Expands to                           |
| ---------------- | ------------------------------------ |
| `{arg}`          | Snapshot name without extension      |
| `{ext}`          | File extension, including the dot    |
| `{testFilePath}` | Test file path relative to `testDir` |
| `{testFileName}` | Test file name with extension        |
| `{testDir}`      | Absolute test directory              |
| `{projectName}`  | Sanitized project name               |

Characters immediately preceding a token appear only when the token is non-empty, which makes optional segments possible. **The project name is part of the path** — renaming a project orphans every baseline beneath it.

---

## Snapshot Update Modes

| `updateSnapshots` | Behaviour                                                     | Use for                      |
| ----------------- | ------------------------------------------------------------- | ---------------------------- |
| `"missing"`       | Creates missing baselines only (**default**)                  | Local first run of a subject |
| `"changed"`       | Rewrites mismatched baselines, creates missing ones           | Deliberate, reviewed refresh |
| `"all"`           | Rewrites every executed baseline, **including matching ones** | Almost never                 |
| `"none"`          | Never writes; a missing baseline is a failure                 | CI                           |

CLI equivalent: `--update-snapshots=changed`. Bare `--update-snapshots` means `"all"`.

---

## Cloud Capture Parameters

Configurable at project, component, and subject level; later levels win, except modes, which stack.

| Parameter                 | Type / values     | Default | Purpose                                                       |
| ------------------------- | ----------------- | ------- | ------------------------------------------------------------- |
| `modes`                   | record of globals | —       | Named theme/viewport/locale combinations; one snapshot each   |
| `diffThreshold`           | `number` (0-1)    | `0.063` | Change sensitivity; lower is stricter                         |
| `diffIncludeAntiAliasing` | `boolean`         | `false` | `true` stops ignoring anti-aliased pixels                     |
| `delay`                   | `number` (ms)     | `0`     | Fixed wait before capture; last resort for signal-less motion |
| `pauseAnimationAtEnd`     | `boolean`         | `true`  | `true` = last frame, `false` = first frame                    |
| `disableSnapshot`         | `boolean`         | `false` | Excludes the subject from capture entirely                    |

**Default motion handling:** CSS animations and transitions are paused (last frame); videos and animated images are paused at the first frame; JavaScript-driven motion is not handled and must be stopped by the test.

**Do not port tolerance numbers between harnesses** — `diffThreshold` (`0.063`) and the self-hosted `threshold` (`0.2`) are different algorithms on different scales.

Flag-level behaviour for the cloud CLI is in [examples/ci.md](examples/ci.md).

---

## Before Committing a New Baseline

- [ ] The subject is scoped to what is under test (element or clip, not the whole page by default)
- [ ] Fonts are self-hosted and the capture waits on `document.fonts.ready`
- [ ] JS-driven motion is stopped (stabilizing stylesheet), not merely waited out
- [ ] The clock is frozen; locale and timezone are pinned
- [ ] Randomness is seeded before application scripts run
- [ ] Fixture data is fixed, ordered, and uses absolute dates and stable identifiers
- [ ] Scrollbars are hidden and `deviceScaleFactor` / `scale` are pinned
- [ ] Volatile regions are masked, not absorbed by a raised tolerance
- [ ] The baseline was generated inside the same pinned image CI uses
- [ ] `--repeat-each=3` passes against the new baseline
- [ ] The image is in the same pull request as the change that caused it
- [ ] Someone other than the author will accept it

---

## Troubleshooting

| Symptom                                             | Likely cause                                       | Fix                                                              |
| --------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Every subject differs across the whole frame        | Baseline rendered on a different OS/image          | Regenerate inside the pinned CI image                            |
| Text blocks shift by a few pixels, intermittently   | Font not loaded at capture time                    | Self-host + preload; await `document.fonts.ready`                |
| A thin outline or curve differs on every run        | Anti-aliasing                                      | Keep `threshold` at its default; do not raise the pixel counters |
| One region differs every run, the rest is stable    | Live data, timestamp, or third-party asset         | Mask it, or hide it in the stabilizing stylesheet                |
| Diffs appear only on the first run of the day       | Cache-dependent asset or relative-date rendering   | Freeze the clock; serve fixtures instead of live data            |
| Layout shifts by ~15px horizontally                 | Scrollbar present in one environment               | Hide scrollbars in the stabilizing stylesheet                    |
| Text is sharp locally, blurry in CI (or vice versa) | Differing device pixel ratio                       | Pin `deviceScaleFactor`; keep `scale: "css"`                     |
| A masked area is invisible in the diff              | Subject legitimately contains `#FF00FF`            | Set `maskColor` explicitly                                       |
| Baselines "disappeared" after a config change       | Project renamed — the name is in the path          | Restore the name or move the files deliberately                  |
| The whole cloud corpus recaptured unexpectedly      | Config/global-preview change, or history rewritten | Expected after those; avoid force-pushing gated branches         |
| A cloud mode change did not produce a new baseline  | Baselines key on mode **name**, not its values     | Rename the mode to start a fresh baseline                        |
| Suite is green but the UI is visibly wrong          | A baseline was accepted without review             | Find the accepting commit, restore, re-review                    |

---

## Scope Boundaries

| Concern                                            | Owned by                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| Story authoring, args, decorators, workshop config | `web-tooling-storybook`                                   |
| Functional flows, locators, network interception   | `web-testing-playwright-e2e`                              |
| Unit and component assertions                      | `web-testing-vitest`, `web-testing-react-testing-library` |
| Screenshot baselines, determinism, diff review, CI | This skill                                                |
