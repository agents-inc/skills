---
name: meta-reviewing-infra-reviewing
description: Infrastructure code review patterns. Use when reviewing CI/CD workflows, Dockerfiles, deployment configs, and IaC. Covers supply-chain pinning, secret exposure, container hygiene, least-privilege permissions, and deployment safety.
---

# Infrastructure Code Review Patterns

> **Quick Guide:** When a diff touches operational code, grep it for secrets first - hardcoded credentials are always blocking. Verify third-party actions are pinned to SHAs and base images to digests or versions, containers run as non-root, workflow permissions are least-privilege, and secrets never pass through build args, logs, or artifacts. Judge deployment ceremony against what the diff actually deploys.

---

<critical_requirements>

## CRITICAL: Before Reviewing Infrastructure Code

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST verify no secrets are hardcoded - scan the diff for tokens, API keys, passwords, and connection strings)**

**(You MUST verify third-party CI actions are pinned to full SHA hashes, not mutable tags like `@v4` or `@main`)**

**(You MUST verify secrets never pass through build args, echo/log lines, or uploaded artifacts)**

**(You MUST verify production Dockerfiles the diff adds or changes set a non-root USER and pin their base image)**

**(You MUST verify workflow permissions are declared least-privilege, not inherited write-all)**

</critical_requirements>

---

**Auto-detection:** review workflow, CI PR review, Dockerfile review, pipeline review, deployment config review, GitHub Actions review, IaC review, terraform review

**When to use:**

- Reviewing diffs that touch CI/CD workflows (GitHub Actions, GitLab CI)
- Reviewing Dockerfiles, .dockerignore, or compose files
- Reviewing deployment configs (Kubernetes, Helm, platform configs)
- Reviewing IaC (Terraform, Pulumi) or release/build scripts
- Reviewing package-manager and lockfile changes with supply-chain impact

**When NOT to use:**

- When implementing infrastructure (use the relevant infra implementation skill)
- For application code in the same diff (use the web/api reviewing skills)
- For incident response or live operations questions

**Key patterns covered:**

- Supply-chain pinning: actions, base images, lockfiles
- Secret exposure across build args, logs, artifacts, and ignore files
- Dockerfile hygiene: non-root, multi-stage, layer order
- CI/CD least-privilege permissions and pipeline correctness
- Deployment safety scoped to what the diff deploys

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Good/bad infrastructure patterns to look for during review

---

<philosophy>

## Philosophy

**Operational code fails in production only.** No unit test catches an unpinned action's supply-chain compromise or a leaked deploy key; the review is frequently the only gate this code passes through. Security findings here are cheap to fix pre-merge and brutally expensive after.

**When reviewing infrastructure code:**

- Scan for secrets before reading for style - the highest-severity class takes seconds to check
- Treat every third-party reference (action, image, module) as an attack surface: is it pinned to something immutable?
- Cross-reference the diff's blast radius: a new env var must exist everywhere the app runs; a renamed job must update everything that `needs` it
- Ask what happens when this pipeline runs on a fork PR, on a re-run, and on two branches at once

**When NOT to flag:**

- Don't demand k8s-grade ceremony (probes, resource limits, rollback strategy) for a docs site or an internal workflow that deploys nothing
- Don't demand multi-stage builds for a CI-only image where size is irrelevant
- Don't flag missing caching in a job that runs in seconds
- Don't require a vault migration in a diff that just consumes an existing secret the established way

**Core principles:**

- **Secrets and supply chain are non-negotiable**: always blocking, in any diff, at any scale
- **Pin everything external**: mutable references delegate your security to strangers
- **Least privilege by default**: a workflow gets the permissions it needs, not the ones it inherits
- **Ceremony proportional to blast radius**: production deployment paths earn strictness; a lint workflow does not

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Supply-Chain Pinning

Every external reference resolves to something immutable.

```markdown
## Pinning Review

For EACH external reference the diff adds or changes:

- [ ] Third-party GitHub Actions pinned to a full commit SHA (comment may carry the version)
- [ ] First-party actions (actions/\*) at minimum major-version pinned
- [ ] Base images pinned to a digest or a specific version tag - never `latest`
- [ ] Dependency installs in CI use the lockfile (`npm ci`, `bun install --frozen-lockfile`), and the lockfile is committed
- [ ] Terraform/Pulumi providers and modules carry version constraints
```

```yaml
# Must Fix: mutable tag - the action's owner (or their attacker) can rewrite v4 tomorrow
- uses: some-org/deploy-action@v4

# Good: immutable SHA, human-readable version alongside
- uses: some-org/deploy-action@8f4b7f84864484a7bf31766abe9204da3cbe65b3 # v4.1.2
```

**Why this matters:** A mutable tag is remote code execution deferred: whoever controls that ref controls your CI, with your secrets in scope. Tag-rewriting attacks on popular actions are documented, recurring events.

---

### Pattern 2: Secret Exposure

Secrets reach the process that needs them and nothing else.

```markdown
## Secret Review

- [ ] No literal tokens, keys, passwords, or connection strings anywhere in the diff
- [ ] Secrets arrive via the platform's secret store (secrets context, env from vault) - not committed files
- [ ] No secret passes through a Docker build arg (build args persist in image history)
- [ ] No echo/printf/debug line prints a secret; secret-bearing env is not dumped wholesale (`env | sort`)
- [ ] Uploaded artifacts and caches cannot contain secret-bearing files (.env, credentials)
- [ ] .gitignore / .dockerignore cover .env files and credential paths the diff introduces
```

```dockerfile
# Must Fix: the token is baked into image history - docker history shows it
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci

# Good: secret mount exists only for the one RUN
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm ci
```

**Why this matters:** A leaked secret is a full compromise of whatever it guards, and build-arg/log leaks are invisible until someone pulls the image or reads the log archive.

---

### Pattern 3: Dockerfile Hygiene

The image is minimal, cache-friendly, and unprivileged.

```markdown
## Dockerfile Review

When the diff adds or changes a Dockerfile:

- [ ] Production stage sets a non-root USER
- [ ] Multi-stage build separates build tooling from the runtime image (when the image ships to production)
- [ ] Dependency manifests are COPYed and installed BEFORE the source copy (layer caching)
- [ ] .dockerignore exists and excludes node_modules, .git, .env
- [ ] Base image is minimal for the job (slim/alpine/distroless where compatible)
```

```dockerfile
# Should Fix: source copy first - every code change busts the dependency cache
COPY . .
RUN npm ci && npm run build

# Good: manifest layer caches until dependencies actually change
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
```

**Why this matters:** Root containers turn any app compromise into a container-escape attempt; bad layer order turns every commit into a full rebuild, which teams then "fix" by caching less safely.

---

### Pattern 4: CI/CD Permissions and Pipeline Correctness

The workflow can do its job and nothing more, and its jobs compose correctly.

```markdown
## Workflow Review

- [ ] `permissions:` is declared at workflow or job level - read-all default, write scopes named individually
- [ ] `pull_request_target` (if present) does not check out and execute PR head code with secrets in scope
- [ ] Job `needs:` ordering matches real dependencies - deploy waits for test
- [ ] Concurrency groups guard deploy jobs against overlapping runs
- [ ] Cache keys include the lockfile hash - not a static string that never invalidates
- [ ] When the diff renames jobs/outputs, everything that references them is updated in the same diff
```

```yaml
# Must Fix: inherited write-all - a compromised step can push code and rewrite releases
on: pull_request

# Good: the job names exactly what it may touch
permissions:
  contents: read
  pull-requests: write
```

**Why this matters:** Default token permissions turn "a test step got compromised" into "the repository got compromised". `pull_request_target` with a head checkout is the classic secrets-exfiltration footgun.

---

### Pattern 5: Deployment Safety - Scoped to the Diff

When the diff touches how production runs, verify it can fail safely.

```markdown
## Deployment Review (when the diff touches deployment config)

- [ ] Health/readiness checks exist for services behind a load balancer or orchestrator
- [ ] Resource limits accompany new containers on shared clusters
- [ ] The app handles SIGTERM (finish in-flight work, then exit) when the platform does rolling restarts
- [ ] New env vars/secrets the diff introduces exist in EVERY environment the app deploys to
- [ ] IaC state changes (backend, locking) are deliberate; `terraform plan` output accompanies risky changes
```

**Why this matters:** A missing readiness check means the balancer routes traffic to a booting container; a missing env var in one environment is the deploy that fails only in production, at deploy time.

</patterns>

---

<decision_framework>

## Decision Framework

### Severity Classification for Infra Issues

```
Is this a security defect the diff introduces?
├─ Hardcoded secret, or secret through build arg/log/artifact → MUST FIX
├─ Third-party action on a mutable tag → MUST FIX
├─ pull_request_target executing PR head code with secrets → MUST FIX
├─ Write-all permissions on a workflow that needs read → MUST FIX
├─ Production container running as root → MUST FIX
└─ NO → Is it an operational-correctness gap?
    ├─ Base image on `latest` / installs ignoring the lockfile → SHOULD FIX
    ├─ Deploy job without concurrency guard → SHOULD FIX
    ├─ New env var missing from one environment → SHOULD FIX
    ├─ Cache-hostile Dockerfile layer order → SHOULD FIX
    ├─ New production service without health checks or limits → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Slimmer base image where size demonstrably matters → NICE TO HAVE
        ├─ Faster caching for an already-fast job → DON'T MENTION
        ├─ K8s-grade ceremony for a workflow that deploys nothing → DON'T MENTION
        └─ Tool preferences (compose vs k8s, npm vs bun) → DON'T MENTION
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (Must Fix):**

- Any credential literal in the diff (grep for `token`, `key`, `password`, `secret`, connection-string shapes)
- `uses: third-party/action@v3` / `@main` / `@master`
- `ARG`/`ENV` carrying secrets in a Dockerfile
- Missing `permissions:` on workflows that handle untrusted input
- `pull_request_target` + `actions/checkout` of the PR head
- Production Dockerfile with no `USER` directive

**Medium Priority Issues (Should Fix):**

- `FROM node:latest` or digest-less base images on deploy paths
- `npm install` in CI where `npm ci` belongs
- Static cache keys that never invalidate
- Deploy steps with no concurrency group
- Missing .dockerignore alongside a new Dockerfile
- Debug steps that `env`-dump or `set -x` around secret use

**Common Mistakes:**

- Pinning first-party actions to SHA while leaving the third-party one on a tag (backwards priority)
- Adding a secret to one environment and assuming the others inherit it
- Copying source before manifests and "fixing" slow builds by skipping the lockfile
- `needs:` chains that let deploy start when only lint passed
- Treating `terraform apply` in CI as safe because plan passed locally against different state

**Gotchas & Edge Cases:**

- Docker build args persist in `docker history` even when unset afterwards
- Rewritten tags pass `uses:` resolution - only SHAs are immutable
- Composite actions inherit and can leak the caller's env
- GITHUB_TOKEN default permissions differ per org setting - declaring them is the only portable truth
- Alpine images lack glibc; native modules that built fine on debian-slim fail there at runtime
- SIGKILL follows SIGTERM after the grace period - cleanup that takes longer than the grace period never finishes

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST verify no secrets are hardcoded - scan the diff for tokens, API keys, passwords, and connection strings)**

**(You MUST verify third-party CI actions are pinned to full SHA hashes, not mutable tags like `@v4` or `@main`)**

**(You MUST verify secrets never pass through build args, echo/log lines, or uploaded artifacts)**

**(You MUST verify production Dockerfiles the diff adds or changes set a non-root USER and pin their base image)**

**(You MUST verify workflow permissions are declared least-privilege, not inherited write-all)**

**Failure to catch these issues will result in leaked credentials, supply-chain compromise executing in CI with secrets in scope, and deploys that fail only in production.**

</critical_reminders>
