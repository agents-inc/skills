# Visual Regression - CI and Baseline Lifecycle

> Pipeline wiring, diff artifacts, the baseline-update workflow, and cost control. See [core.md](core.md) for configuration and [determinism.md](determinism.md) for the container-parity requirement this file depends on.

**Prerequisites**: Baselines are generated in the same pinned image the pipeline uses — see "Environment Parity" in [determinism.md](determinism.md). Everything below assumes that is already true.

---

## Pattern: The Visual Job (Self-Hosted)

Run visual checks in their own job, in the pinned image, and always publish the diffs.

```yaml
# .github/workflows/visual.yml
name: Visual

on:
  pull_request:
    paths-ignore: ["docs/**", "**/*.md"] # a copy edit cannot move a pixel
  push:
    branches: [main] # trunk builds keep baselines valid through merges

jobs:
  visual:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.62.0-noble # same tag used to generate baselines
      options: --ipc=host
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test --project=desktop-light --project=desktop-dark

      - name: Upload diffs
        if: ${{ !cancelled() }} # failure is precisely when these are needed
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

**Why good:** the container guarantees the render matches the baselines; `paths-ignore` keeps the job off changes that cannot affect pixels; `!cancelled()` publishes artifacts on failure _and_ on timeout, which `if: failure()` alone misses; every failure ships an expected/actual/diff triplet the reviewer can open

**Why bad (the alternative):** a visual job on a bare runner with no artifacts produces "1 failed" and a stack trace. The reviewer cannot see what changed, cannot reproduce the container's render locally, and regenerates the baseline to make it stop — which is the failure mode this whole skill exists to prevent.

### Never update in an automated job

```yaml
# BAD: the pipeline approving its own output
- run: npx playwright test --update-snapshots
- run: git commit -am "update baselines" && git push
```

**Why bad:** the suite now records whatever the build rendered, forever, with no human in the loop. The job is green by construction and asserts nothing.

Set `updateSnapshots: "none"` in the config when `CI` is set (see [core.md](core.md) Pattern 1) so a missing baseline is a hard failure rather than a silently created "approval".

---

## Pattern: The Baseline Refresh Workflow

When an intended redesign changes many subjects, refreshing by hand is impractical — but the review step must survive. Run the refresh in the pinned image and land it as a **pull request**, not a push.

```yaml
# .github/workflows/visual-refresh.yml
name: Refresh visual baselines

on:
  workflow_dispatch: # human-triggered only
    inputs:
      reason:
        description: "What visual change is expected?"
        required: true

jobs:
  refresh:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.62.0-noble
      options: --ipc=host
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test --update-snapshots=changed || true
      - uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/refresh-visual-baselines
          title: "chore: refresh visual baselines"
          body: ${{ inputs.reason }}
```

**Why good:** the images are rendered in the CI environment, the stated reason travels with them, and the diff lands in a pull request where a human compares old and new before anything is approved

**Why `--update-snapshots=changed`, not `all`:** `changed` rewrites only mismatched images and creates missing ones; `all` rewrites every baseline it executes, including matching ones, silently resetting subjects nobody inspected.

---

## Pattern: Reviewing a Visual Change

The review is the test. A protocol that fits in a checklist:

1. **Open every diff.** Not the count — the images. The diff view shows what moved; the actual view shows whether the result is right.
2. **Match each change to a stated intention.** The PR description says "the card gained 8px of padding". A changed subject with no matching intention is a regression until proven otherwise.
3. **Interrogate collateral changes.** A component change that also moved three unrelated pages means a global token changed. That is either the point or the bug.
4. **Reject noise.** A diff caused by a timestamp, a font race, or a container mismatch is not a baseline decision — it is a determinism defect. Fix it in the test, do not approve the noise.
5. **Someone other than the author accepts.** Approving the PR (self-hosted) or accepting in the review UI (cloud). Author self-acceptance removes the only human judgement in the loop.

**Anti-pattern — bulk accept:** accepting a whole build because "it's all the redesign" is the same act as a blind regenerate, performed in a nicer interface.

---

## Pattern: The Cloud Job

```yaml
jobs:
  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # change-based targeting needs real git history
      - run: npm ci
      - run: npx chromatic --only-changed --exit-zero-on-changes
        env:
          CHROMATIC_PROJECT_TOKEN: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

**Why good:** `--only-changed` captures only subjects reachable from the changed files and carries the rest forward at a fraction of the cost; `fetch-depth: 0` is what makes that analysis possible

**Why `--exit-zero-on-changes` is conditional:** it keeps the job green while changes wait for review. That is correct **only** when the service's own status check is a required check that blocks merge until every change is accepted. Without that required check, the flag is an off switch with extra steps — use the default failing behaviour instead.

### Flags with sharp edges

| Flag                     | Effect                                     | Safe use                                       |
| ------------------------ | ------------------------------------------ | ---------------------------------------------- |
| `--only-changed`         | Capture only subjects affected by the diff | PR builds with full git history                |
| `--exit-zero-on-changes` | Job passes despite unaccepted changes      | Only with a required status check on the build |
| `--auto-accept-changes`  | Accepts every change with no human review  | Trunk/release branch at most — never on a PR   |
| `--exit-once-uploaded`   | Returns before results exist               | Fire-and-forget branches you do not gate on    |
| `--force-rebuild`        | Recaptures everything for this commit      | After infrastructure or renderer changes       |
| `--skip`                 | Skips builds for matching branches         | Bot branches you never review visually         |

**Targeting is history-sensitive.** Change-based analysis needs a lockfile in sync with the manifest and an intact commit history; rebases, squashes, and force pushes make previous commits unreachable and fall back to full rebuilds. Configuration and global-preview changes also trigger a full rebuild by design — they can affect every subject.

---

## Pattern: Cost and Time Control

| Lever                              | Self-hosted                                                 | Cloud                                           |
| ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Skip irrelevant runs               | `paths-ignore` on docs/config-only changes                  | `--skip` for bot branches                       |
| Capture less                       | Element captures over full-page; fewer, sharper subjects    | Fewer modes; `disableSnapshot` on dead subjects |
| Narrow the browser/project set     | `ignoreSnapshots: true` on functional-only projects         | N/A (one controlled renderer)                   |
| Only test what changed             | Shard the visual project; run it separately from functional | `--only-changed`                                |
| Keep the artifact/repository small | `.webp` baselines; short artifact retention                 | No images in the repository                     |

**The matrix is a budget, not a setting.** Every mode or project multiplies the entire corpus — its capture time, its review surface, and (in the cloud) its bill. Add a cell when a real class of bug lives there, and be willing to delete one that has never caught anything.

---

_Back to [core.md](core.md) for configuration, or [reference.md](../reference.md) for the option tables._
