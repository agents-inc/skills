# Visual Regression - CI and Baseline Lifecycle

> Pipeline wiring, diff artifacts, the baseline-update workflow and cost control. See [core.md](core.md) for configuration and [determinism.md](determinism.md) for the environment-parity requirement this file depends on.

**Prerequisites**: baselines are generated in the same pinned image the pipeline uses — see "Environment Parity" in [determinism.md](determinism.md). Everything below assumes that is already true.

> The pipeline blocks below are written in one common YAML dialect. The syntax varies by provider; the shape — when the job runs, what it publishes, what it must never do — does not.

---

## The Visual Job

Run visual checks in their own job, in the pinned image, and always publish the diffs.

```yaml
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
      image: <the browser image and tag used to generate the baselines>
      options: --ipc=host # without it, the browser can OOM on the default shm size
    steps:
      - name: Check out
      - name: Install dependencies from the lockfile
      - name: Run visual tests
        run: npm run test:visual

      - name: Publish diffs
        # Must also fire on timeout and cancellation, not on failure alone
        if: ${{ !cancelled() }}
        # Upload the report and results directories as a build artifact,
        # with a short retention - they are large and only useful while the PR is open
```

**Why good:** the container guarantees the render matches the baselines. `paths-ignore` keeps the job off changes that cannot affect pixels. Publishing on anything-but-clean-success means a timeout still produces artifacts, which a failure-only condition misses. Every failure ships an expected/actual/diff triplet the reviewer can open.

**Why bad (the alternative):** a visual job on a bare runner with no artifacts produces "1 failed" and a stack trace. The reviewer cannot see what changed, cannot reproduce the container's render locally, and regenerates the baseline to make it stop — which is the failure this whole skill exists to prevent.

### Never update in an automated job

```yaml
# BAD: the pipeline approving its own output
- run: npm run test:visual -- --update-all
- run: git commit -am "update baselines" && git push
```

**Why bad:** the suite now records whatever the build rendered, forever, with no human in the loop. The job is green by construction and asserts nothing.

Configure the harness to refuse to write baselines when `CI` is set — see [core.md](core.md) Pattern 1 — so a missing baseline is a hard failure rather than a silently created "approval".

---

## The Baseline Refresh Workflow

When an intended redesign changes many subjects, refreshing by hand is impractical — but the review step must survive. Run the refresh in the pinned image and land it as a **pull request**, not a push.

```yaml
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
      image: <the same pinned browser image>
      options: --ipc=host
    steps:
      - name: Check out
      - name: Install dependencies from the lockfile
      - name: Rewrite only the mismatched baselines
        run: npm run test:visual -- --update-changed
        continue-on-error: true # the run "fails" by design; the images are the output
      - name: Open a pull request carrying the new images and the stated reason
```

**Why good:** the images are rendered in the CI environment, the stated reason travels with them, and the diff lands in a pull request where a human compares old and new before anything is approved.

**Why "changed" rather than "all":** the changed mode rewrites only mismatched images and creates missing ones. The blanket mode rewrites every baseline it executes, including matching ones, silently resetting subjects nobody inspected.

---

## Reviewing a Visual Change

The review is the test. A protocol that fits in a checklist:

1. **Open every diff.** Not the count — the images. The diff view shows what moved; the actual view shows whether the result is right.
2. **Match each change to a stated intention.** The description says "the card gained 8px of padding". A changed subject with no matching intention is a regression until proven otherwise.
3. **Interrogate collateral changes.** A component change that also moved three unrelated pages means a global token changed. That is either the point or the bug.
4. **Reject noise.** A diff caused by a timestamp, a font race or a container mismatch is not a baseline decision — it is a determinism defect. Fix it in the test; do not approve the noise.
5. **Someone other than the author accepts.** Author self-acceptance removes the only human judgement in the loop.

**Anti-pattern — bulk accept:** accepting a whole build because "it's all the redesign" is the same act as a blind regenerate, performed in a nicer interface.

---

## The Hosted-Service Job

```yaml
jobs:
  visual:
    runs-on: ubuntu-latest
    steps:
      - name: Check out with full history
        # Change-based targeting needs real git history, not a shallow clone
        with: { fetch-depth: 0 }
      - name: Install dependencies from the lockfile
      - name: Upload the corpus
        # Capture only subjects reachable from the changed files, and pass the
        # project token from the pipeline's secret store rather than the config
```

### Flags with sharp edges

Spellings differ by service; these six behaviours are the ones worth knowing before enabling any of them.

| Behaviour                         | Effect                                     | Safe use                                        |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Change-based targeting            | Capture only subjects affected by the diff | PR builds with full git history                 |
| Exit zero despite pending changes | Job passes with changes unaccepted         | Only with a required status check on the build  |
| Auto-accept every change          | Accepts with no human review               | Trunk or release branch at most — never on a PR |
| Return before results exist       | Fire-and-forget upload                     | Branches you do not gate on                     |
| Force a full rebuild              | Recaptures everything for this commit      | After infrastructure or renderer changes        |
| Skip matching branches            | No build at all                            | Bot branches you never review visually          |

**Exit-code policy is a decision, not a default.** Failing the job on detected change forces review before merge. Passing it keeps the pipeline green while changes wait in the review UI — acceptable **only** with a required status check that blocks merge on unaccepted changes. Without that check it is an off switch with extra steps.

**Targeting is history-sensitive.** Change-based analysis needs a lockfile in sync with the manifest and an intact commit history; rebases, squashes and force pushes make previous commits unreachable and fall back to full rebuilds. Configuration and global-preview changes also trigger a full rebuild by design — they can affect every subject.

---

## Cost and Time Control

| Lever                              | Baselines in the repository                               | Hosted service                                |
| ---------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Skip irrelevant runs               | `paths-ignore` on docs- and config-only changes           | Skip bot branches                             |
| Capture less                       | Element captures over full-page; fewer, sharper subjects  | Fewer modes; opt dead subjects out of capture |
| Narrow the browser set             | Keep snapshots off functional-only cells                  | N/A — one controlled renderer                 |
| Only test what changed             | Shard the visual job separately from the functional suite | Change-based targeting                        |
| Keep the artifact/repository small | WebP baselines; short artifact retention                  | No images in the repository                   |

**The matrix is a budget, not a setting.** Every mode or cell multiplies the entire corpus — its capture time, its review surface and its bill. Add a cell when a real class of bug lives there, and be willing to delete one that has never caught anything.

---

_Back to [core.md](core.md) for configuration, or [reference.md](../reference.md) for the option semantics._
