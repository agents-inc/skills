---
name: meta-reviewing-infra-reviewing
description: Infrastructure code review — supply-chain pinning, secret exposure, workflow triggers and untrusted input, container hygiene, deployment safety. Load when reviewing a diff that touches CI/CD workflows, Dockerfiles, deployment configs or IaC.
---

# Infrastructure Code Review Patterns

> **Quick Guide:** Review operational code for what it can leak and what it lets a stranger run. Secrets, mutable third-party references and outsider input reaching a privileged job block the merge in any diff, at any scale; deployment ceremony scales with what the diff actually deploys. Recent facts that change the answer: `actions/checkout` v7 refuses fork-PR code under `pull_request_target` and `workflow_run` unless told otherwise; since December 2025 `pull_request_target` always runs the default branch's copy of the workflow; an organisation can enforce SHA pinning so a tag-pinned action fails at job setup; and GitHub's workflow dependency lockfile (public preview) pins what a `uses:` tag resolves to.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a good/bad pair for each pattern below: pinned actions and installs, secret mounts and log hygiene, permissions, privileged triggers and script injection, the non-root Dockerfile, deploy ordering, signal-safe startup

---

<critical_requirements>

## Before reviewing infrastructure code

**Grep the diff for credentials before reading it for anything else.** A pushed secret stays reachable through clones, forks and the pull request's own refs, so the fix to ask for is revocation, not a follow-up commit — and the check takes seconds.

**Resolve every external reference to something immutable.** A tag or branch on an action, base image, provider or module runs whatever its owner — or whoever holds the owner's token — points it at next, with this pipeline's secrets in scope.

**Trace each secret from its store to the one process that needs it.** A build arg lands in image history, a job-level `env:` reaches every step including third-party actions, and log masking matches only the exact registered string — each hop the diff adds is a place it leaks.

**Read a workflow's trigger and `permissions:` before its steps.** Under `pull_request_target` and `workflow_run` the job holds the base repository's secrets and token while handling fork-controlled input, and a missing `permissions:` block inherits a default set in settings the diff never shows.

**Treat every value an outsider can set as code.** A PR title, branch name or comment body written as `${{ }}` inside `run:` is spliced into the script before the shell parses it, so a quote in that value ends the string and the rest runs as commands.

**Check that a production image ends on a non-root `USER`.** Without one the process runs as root, and an application compromise starts one container-escape bug away from the host.

</critical_requirements>

---

**Auto-detection:** `.github/workflows`, `uses:`, `permissions:`, `pull_request_target`, `workflow_run`, `GITHUB_TOKEN`, `secrets.`, `allow-unsafe-pr-checkout`, `concurrency:`, `.gitlab-ci.yml`, `Dockerfile`, `.dockerignore`, `compose.yaml`, `FROM`, `USER`, `ARG`, `RUN --mount=type=secret`, Kubernetes manifest, Helm chart, `readinessProbe`, `terraform`, `.terraform.lock.hcl`, Pulumi, CI review, Dockerfile review, IaC review

**Applies to:**

- Diffs touching CI/CD workflow files — triggers, permissions, pinned references, secrets, job ordering
- Dockerfiles, `.dockerignore` and compose files
- Deployment manifests and platform configs — readiness, resources, shutdown, per-environment config
- IaC — provider and module pinning, state, plan and apply in CI
- Release and build scripts — what they publish, sign and tag, and which credentials they read
- Lockfile and package-manager changes with supply-chain reach

**Handled elsewhere:**

- Application code in the same diff — reviewed against its own layer's conventions; this skill reviews what builds, ships and runs it.
- Severity vocabulary, comment format and the approve-or-request-changes call — the general review practice, which this skill's severities slot into.
- Designing or restructuring a pipeline — a review names the defect and its fix; the platform's shape belongs to whoever owns it.
- Incident response and live operations — a review gates a diff, not a running system.

---

<philosophy>

## Philosophy

Operational code fails in production only. No unit test catches an unpinned action's compromise or a leaked deploy key, so the review is often the one gate this code passes — and a finding costs a line before merge and a rotation after.

Ceremony scales with blast radius: a production deploy path earns strictness, a lint workflow that deploys nothing does not. Read the diff against what it reaches —

- A new env var must exist in every environment the app runs in; a renamed job or output must change everywhere that `needs` or reads it.
- Ask what the pipeline does on a fork PR, on a re-run, and on two branches at once.

**Don't flag:**

- Probes, resource limits or rollback strategy on a docs site or a workflow that deploys nothing
- A multi-stage build for a CI-only image whose size nothing depends on
- Missing caching in a job that runs in seconds
- A vault migration in a diff that consumes an existing secret the established way

</philosophy>

---

<decision_framework>

## Severity for infrastructure findings

Must Fix blocks approval. Should Fix travels with the approval, for the author to fix before merging, and needs a cost concrete in this diff. Nice to Have is the author's to take or leave.

```
Does the diff introduce a security defect?
├─ Credential literal, or a secret through ARG/ENV, a log line or an artifact → MUST FIX
├─ Third-party action on a tag, or any action on a branch (@v3, @main) → MUST FIX
├─ ${{ }} of outsider-controlled input inside run: → MUST FIX
├─ pull_request_target / workflow_run that checks out or runs PR head code → MUST FIX
├─ Write scopes a job doesn't use, or no permissions: on a workflow fed untrusted input → MUST FIX
├─ Production image without a non-root USER → MUST FIX
└─ NO → Is it an operational-correctness gap?
    ├─ GitHub's own action (actions/*) on a version tag instead of a full SHA → SHOULD FIX
    ├─ Base image on latest or untagged, or without a digest on a deploy path; CI install that ignores the lockfile → SHOULD FIX
    ├─ No permissions: block on any other workflow → SHOULD FIX
    ├─ Debug output beside secret use (set -x, env dumps) → SHOULD FIX
    ├─ Deploy job without a concurrency group, or not waiting on the tests → SHOULD FIX
    ├─ New env var missing from one environment → SHOULD FIX
    ├─ Cache key that never changes; cache-hostile Dockerfile layer order → SHOULD FIX
    ├─ New Dockerfile without .dockerignore; shell-form CMD or CMD via npm → SHOULD FIX
    ├─ New production service without a readiness check, resource requests or limits → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Slimmer base image where size demonstrably matters → NICE TO HAVE
        ├─ Faster caching for an already-fast job → don't write it
        ├─ Production ceremony on a workflow that deploys nothing → don't write it
        └─ Tool preference (compose vs Kubernetes, one package manager over another) → don't write it
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Supply-Chain Pinning

Every external reference resolves to something immutable, and the record of it is committed.

- Third-party actions on a full 40-character commit SHA from the action's own repository, not a fork; a trailing `# vX.Y.Z` comment keeps it readable
- GitHub's own `actions/*` on a full SHA as well — GitHub's secure-use guidance makes no first-party exception, and an organisation's SHA-pinning policy fails any unpinned action at job setup. A version tag here is Should Fix rather than Must Fix, because GitHub is a smaller trust grant than a third party
- Base images on a version tag at minimum, and on a digest on deploy paths — `latest` changes the build with no diff to review, and a publisher can re-point any tag; a digest is the only immutable form
- CI installs from the committed lockfile and fails on drift (`npm ci`, or the package manager's frozen-lockfile mode)
- Terraform providers and modules carry version constraints, and `.terraform.lock.hcl` is committed

```yaml
# Must Fix: whoever controls this repository's tags decides what runs next
- uses: some-org/deploy-action@v4

# Good: immutable; the comment keeps it readable
- uses: some-org/deploy-action@8f4b7f84864484a7bf31766abe9204da3cbe65b3 # v4.1.2
```

Full code: [examples/core.md](examples/core.md#pattern-1-supply-chain-pinning)

### Pattern 2: Secret Exposure

Secrets reach the process that needs them and nothing else.

- No literal tokens, keys, passwords or connection strings — grep for `token`, `key`, `secret`, `password` and `://user:pass@` shapes
- Secrets come from the platform's secret store, never a committed file
- No secret in a Dockerfile `ARG` or `ENV` — a secret mount exists for one `RUN` and in no layer
- No secret in workflow- or job-level `env:` when one step uses it — scope it to that step
- No line prints a secret or a value derived from one; derived values are registered with `::add-mask::`
- Artifacts and caches cannot contain `.env` files, credentials, Terraform state or saved plans
- `.gitignore` and `.dockerignore` cover the `.env` and credential paths the diff introduces

```dockerfile
# Must Fix: the token is in `docker history` and in the .npmrc layer
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci

# Good: the credentials file is mounted for this one RUN
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

Full code: [examples/core.md](examples/core.md#pattern-2-secret-exposure)

### Pattern 3: Workflow Trust Boundaries

What a workflow can reach is set by its trigger and its `permissions:`; what an outsider can make it do is set by where their input lands.

- `permissions:` read-only (or `{}`) at workflow level, write scopes granted per job
- `pull_request_target` and `workflow_run` only where the job needs the base repository's secrets or write token, and never checking out or running PR head code
- Under those triggers: no `allow-unsafe-pr-checkout: true`, no `actions/checkout` older than v7, no manual fetch of the PR head — v7's refusal guards only its own default path
- Outsider-set values — `github` context fields ending in `title`, `body`, `head_ref`, `label`, `message`, `name`, `email` or `ref` — reach `run:` through `env:`, never as `${{ }}` in the script

```yaml
# Must Fix: the title is pasted into the script before bash parses it
- run: echo "Checking ${{ github.event.pull_request.title }}"

# Good: the shell receives data, not script
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Checking $PR_TITLE"
```

Full code: [examples/core.md](examples/core.md#pattern-3-workflow-trust-boundaries)

### Pattern 4: Dockerfile Hygiene

The image is minimal, cache-friendly and unprivileged.

- Production stage ends on a non-root `USER`
- A multi-stage build keeps compilers and dev dependencies out of the image that ships
- Dependency manifests are copied and installed before the source, or every code change reinstalls everything
- `.dockerignore` excludes `.git`, `.env` and local dependency folders — `COPY . .` copies whatever the context holds
- Base image minimal for the job (slim, alpine, distroless) where the app's native dependencies allow

```dockerfile
# Should Fix: every source change busts the dependency layer
COPY . .
RUN npm ci && npm run build

# Good: the install layer is reused until a manifest changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

Full code: [examples/core.md](examples/core.md#pattern-4-dockerfile-hygiene)

### Pattern 5: Pipeline Correctness

The jobs compose the way the author thinks they do.

- `needs:` matches real dependencies — deploy waits for every test job, not only lint
- Deploy jobs share a `concurrency` group, so two quick merges cannot deploy out of order
- Cache keys include a lockfile hash (`hashFiles(...)`); a static key never invalidates
- A renamed job, output or env var is renamed at every reference in the same diff

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false
jobs:
  deploy:
    needs: [lint, test, e2e]
```

Full code: [examples/core.md](examples/core.md#pattern-5-pipeline-correctness)

### Pattern 6: Deployment Safety, Scoped to the Diff

When the diff changes how production runs, check it can fail safely.

- Services behind a load balancer or orchestrator have a readiness check — without one, traffic reaches a container still booting
- New containers on a shared cluster declare resource requests and limits — requests are what the scheduler places by, and a memory limit makes a leak kill its own container rather than starve its neighbours
- The app receives SIGTERM and finishes in-flight work inside the grace period: exec-form `CMD`, not shell form or `npm start`, and a handler or an init process, because PID 1 gets no default signal behaviour
- Every env var and secret the diff introduces exists in every environment the app deploys to
- IaC backend and locking changes are deliberate, a risky change (a backend move, a destroy or a replace) comes with its `terraform plan` output so the reviewer sees what the apply will do, and `apply` in CI runs the plan CI produced against the real state

```dockerfile
# Should Fix: /bin/sh -c is PID 1 and does not pass SIGTERM on
CMD node dist/server.js

# Good: the app receives the signal itself
CMD ["node", "dist/server.js"]
```

Full code: [examples/core.md](examples/core.md#pattern-6-deployment-safety-scoped-to-the-diff)

</patterns>

---

<red_flags>

## Red flags

**Common mistakes:**

- SHA-pinning `actions/*` while a third-party action stays on a tag — backwards, since the third party is the larger trust grant
- Asking only for a leaked secret's removal from the diff — it is already pushed, so ask for revocation
- "Fixing" a slow image build by dropping the lockfile instead of reordering the layers
- Approving an `apply` in CI because a plan passed locally — against different state it proves nothing about this run

**Surprising behaviour:**

- Build-arg values appear in `docker history` and in max-mode provenance attestations.
- Log masking redacts the exact registered value; a base64, URL-encoded or substring form prints in clear, and a secret stored as a JSON blob is not reliably masked.
- Every step in a job sees workflow- and job-level `env:`, third-party actions included.
- A job's `permissions:` block is that job's whole grant: every scope it omits is `none`, whatever the workflow level said.
- `GITHUB_TOKEN`'s default comes from organisation and repository settings the diff doesn't show; fork PRs get read-only unless the repository sends write tokens to forks.
- Since 8 December 2025, `pull_request_target` runs the default branch's copy of the workflow, so a PR editing that workflow is not exercised by its own run.
- In a repository with a workflow dependency lockfile, the run executes the commit the lockfile records, so a `uses:` tag is not mutable there; review the lockfile's changed `commit` entries instead.
- In `image:tag@sha256:…` the digest decides and the tag is a label.
- `.terraform.lock.hcl` locks providers only; a module floats within its version constraint unless the constraint is exact.
- `sensitive = true` hides a Terraform value from CLI output, not from state or plan files, which hold it in plaintext — a plan uploaded as an artifact ships the secret.
- Alpine uses musl: a native module compiled in a glibc build stage fails to load in an Alpine runtime stage.
- Cleanup that outlasts the grace period never finishes — the platform sends SIGKILL (Kubernetes' default is 30 seconds, `preStop` time included).

</red_flags>
