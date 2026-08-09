---
name: infra-ci-cd-turborepo-ci
description: Turborepo CI pipelines with remote caching and affected detection
---

# Turborepo CI Patterns

> **Quick Guide:** Use `--affected` for PR builds (auto-detects CI environment, falls back to full suite on shallow clones). Enable Remote Cache with `TURBO_TOKEN` + `TURBO_TEAM` env vars. Declare `outputs` for every cacheable task or cached results will be incomplete. Use `env` and `globalEnv` in turbo.json to include environment variables in cache hashes -- missing entries cause cross-environment cache collisions. Pin `turbo` version in CI. Use `turbo query affected` to conditionally skip entire CI steps.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST declare `outputs` for every cacheable task in turbo.json -- missing outputs means cached results restore without build artifacts)**

**(You MUST list environment variables that affect task output in `env` (task-level) or `globalEnv` (all tasks) -- omitting them causes cross-environment cache hits with wrong values)**

**(You MUST use `--affected` for PR builds -- running the full task graph on PRs wastes CI time on unchanged packages)**

**(You MUST pin the `turbo` CLI version in CI -- `latest` can introduce breaking changes mid-pipeline)**

</critical_requirements>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - turbo.json task config, outputs, env, caching control, filter syntax
- [examples/remote-cache.md](examples/remote-cache.md) - Remote Cache setup, self-hosted options, signature verification
- [examples/affected-detection.md](examples/affected-detection.md) - --affected flag, turbo query affected, conditional CI steps
- [examples/docker.md](examples/docker.md) - turbo prune --docker, multi-stage Dockerfile, layer caching
- [reference.md](reference.md) - Decision frameworks, CLI flags, turbo.json quick reference

---

**Auto-detection:** Turborepo CI, turbo.json, turbo run, turbo prune, --affected, --filter, TURBO_TOKEN, TURBO_TEAM, Remote Cache, turbo query affected, outputs, dependsOn, globalEnv, envMode, concurrency, turbo login, turbo link, cache artifacts, monorepo CI

**When to use:**

- Configuring CI pipelines for a Turborepo monorepo
- Setting up Remote Cache for shared build artifacts across CI and local
- Using `--affected` to run only changed-package tasks on PRs
- Optimizing Docker builds with `turbo prune --docker`
- Debugging cache misses with `--summarize` or `--dry`
- Skipping CI steps conditionally with `turbo query affected`

**When NOT to use:**

- General Turborepo workspace setup (package structure, task graph design) -- that belongs in a monorepo/workspace skill
- CI provider-specific workflow syntax (use your CI provider's skill)
- Application build configuration (bundler, compiler settings)

**Key patterns covered:**

- turbo.json task configuration (`outputs`, `env`, `dependsOn`, `cache`, `inputs`)
- Remote Cache authentication and setup (`TURBO_TOKEN`, `TURBO_TEAM`, signature verification)
- Affected detection (`--affected`, `--filter=...[origin/main]`, `turbo query affected`)
- Docker optimization with `turbo prune --docker` and multi-stage builds
- Cache debugging (`--summarize`, `--dry`, `--force`)
- Environment variable modes (`strict` vs `loose`) and `passThroughEnv`
- Concurrency control and output log filtering

---

<philosophy>

## Philosophy

Turborepo's CI value comes from two things: **caching** (never redo work whose inputs haven't changed) and **affected detection** (never start work that can't have changed). The combination turns a 15-minute full monorepo build into a sub-minute cache restore for unchanged packages.

**Core CI principles:**

- **Cache correctness over speed:** A wrong cache hit is worse than a cache miss. Declare all `outputs` and all `env` variables that affect task results.
- **Affected detection for PRs, full suite for main:** PRs get fast feedback via `--affected`. Main branch runs the full task graph to catch integration issues.
- **Remote Cache for team-wide sharing:** Local cache is per-machine. Remote Cache shares artifacts across CI runners and developer machines, eliminating redundant work organization-wide.
- **Pin versions in CI:** Turborepo follows semver, but `latest` in CI means non-reproducible builds. Pin to the major version at minimum.

**When to use Turborepo in CI:**

- Monorepo with 2+ packages where cross-package caching saves meaningful time
- Teams where multiple developers and CI runners rebuild the same packages
- Projects where Docker builds benefit from pruned lockfiles

**When NOT to use:**

- Single-package repos (no cross-package caching benefit)
- Repos where every PR touches every package (affected detection provides no speedup)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Task Configuration in turbo.json

Every task that produces files must declare `outputs`. Every task affected by environment variables must declare `env`. Missing either causes cache correctness issues.

```jsonc
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"],
      "env": ["NODE_ENV", "API_URL"],
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL"],
    },
    "lint": {
      "dependsOn": [],
      "cache": true,
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": true,
    },
  },
}
```

**Key decisions:**

- `dependsOn: ["^build"]` means "run build in all dependencies first" -- the `^` prefix means upstream packages
- `outputs` defines what gets cached and restored -- omit it and cached runs produce empty results
- `env` includes variables in the cache hash -- change the value, bust the cache
- `cache: false` disables caching for tasks like `dev` or deployment scripts

See [examples/core.md](examples/core.md) for complete task config with `inputs`, `passThroughEnv`, `outputLogs`, and package-level overrides.

---

### Pattern 2: Remote Cache Setup

Remote Cache shares build artifacts across CI runners and developer machines. Two environment variables enable it.

```bash
# Required for Remote Cache in CI
TURBO_TOKEN=<bearer-token>   # Auth token (Vercel or self-hosted)
TURBO_TEAM=<team-slug>       # Team/account identifier
```

**Vercel Remote Cache:** Free, automatic on Vercel deployments. For other CI providers, set `TURBO_TOKEN` and `TURBO_TEAM` as CI secrets.

**Self-hosted:** Use `TURBO_API` to point to a custom Remote Cache server implementing the Turborepo Remote Cache API. Community options: `ducktors/turborepo-remote-cache`, `brunojppb/turbo-cache-server`.

**Signature verification** (recommended for shared caches):

```jsonc
{
  "remoteCache": {
    "signature": true,
  },
}
```

Set `TURBO_REMOTE_CACHE_SIGNATURE_KEY` with an HMAC-SHA256 secret. Failed verification is treated as a cache miss.

See [examples/remote-cache.md](examples/remote-cache.md) for complete setup including self-hosted config and cache permission tuning.

---

### Pattern 3: Affected Detection for PR Builds

`--affected` runs tasks only in packages with code changes. Auto-detects CI environment variables (`GITHUB_BASE_REF`, etc.) to determine the comparison base.

```bash
# PR builds: only changed packages
turbo run build test lint --affected

# Manual comparison base
turbo run test --filter=...[origin/main]
```

**Gotcha:** Shallow clones break affected detection because git diff needs history. `--affected` gracefully falls back to running all tasks, but `--filter=...[origin/main]` may fail silently. Ensure sufficient clone depth in CI.

**Advanced: Conditional CI steps** with `turbo query affected`:

```bash
# Check if a specific package is affected before running expensive steps
AFFECTED=$(turbo query affected --packages web \
  | jq '.data.affectedPackages.length')
if [ "$AFFECTED" -gt 0 ]; then
  # Run expensive deployment steps
fi
```

See [examples/affected-detection.md](examples/affected-detection.md) for PR vs main branch patterns and `turbo query affected` examples.

---

### Pattern 4: Docker Optimization with turbo prune

`turbo prune` generates a sparse monorepo with only the packages needed to build a target. The `--docker` flag splits output for Docker layer caching.

```dockerfile
# Stage 1: Install dependencies (cached unless lockfile changes)
FROM node:20-alpine AS deps
WORKDIR /app
COPY out/json/ .
RUN npm install --frozen-lockfile

# Stage 2: Build (cached unless source changes)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app .
COPY out/full/ .
RUN npx turbo run build --filter=web
```

**Key benefit:** Changes to source code in one package don't invalidate the dependency install layer for other packages. Without pruning, any lockfile change (even in unrelated packages) busts the Docker cache for all images.

See [examples/docker.md](examples/docker.md) for complete multi-stage Dockerfile with `turbo prune --docker`.

---

### Pattern 5: Cache Debugging

When tasks produce unexpected results after cache hits, use these tools to diagnose.

```bash
# See what would run without executing (dry run)
turbo run build --dry

# Generate detailed run summary with hashes and timing
turbo run build --summarize
# Output in .turbo/runs/<id>.json

# Force re-execution, ignoring cache
turbo run build --force

# Control cache sources (disable remote, keep local)
turbo run build --cache=local:rw,remote:off
```

**Common cache miss causes:**

- Changed environment variable not listed in `env` or `globalEnv`
- Modified file not captured by default inputs (use `inputs` key to customize)
- Different `turbo` version between CI and local (different hashing algorithm)
- Missing `outputs` declaration (task runs but restores nothing from cache)

See [examples/core.md](examples/core.md) for `--summarize` output analysis and cache troubleshooting.

---

### Pattern 6: Environment Variable Strategy

Turborepo's `strict` env mode (default in v2) only makes variables listed in `env`, `globalEnv`, or `passThroughEnv` available to tasks. This prevents accidental cache collisions but requires explicit configuration.

```jsonc
{
  "globalEnv": ["CI", "NODE_ENV"],
  "tasks": {
    "build": {
      "env": ["API_URL", "SENTRY_DSN"],
      "passThroughEnv": ["npm_config_registry"],
    },
  },
}
```

**Decision: `env` vs `globalEnv` vs `passThroughEnv`:**

| Key                    | Affects hash?   | Available to task? | Scope       |
| ---------------------- | --------------- | ------------------ | ----------- |
| `env`                  | Yes             | Yes                | Single task |
| `globalEnv`            | Yes (all tasks) | Yes                | All tasks   |
| `passThroughEnv`       | No              | Yes                | Single task |
| `globalPassThroughEnv` | No              | Yes                | All tasks   |

**When to use `passThroughEnv`:** Variables needed at runtime but that don't affect build output (e.g., `npm_config_registry`, `HTTP_PROXY`). Changing them should not bust the cache.

See [examples/core.md](examples/core.md) for strict vs loose mode examples and environment variable debugging.

</patterns>

---

<performance>

## Performance Optimization

**Goal: PR builds < 3 minutes with affected detection + Remote Cache**

**Cache hit rate optimization:**

- Declare all `outputs` and `env` variables to prevent false misses
- Use `--summarize` to compare hashes between runs and identify unexpected invalidations
- Keep `globalEnv` minimal -- variables there bust cache for ALL tasks
- Use task-level `env` for variables that only affect specific tasks

**Concurrency tuning:**

```bash
# Default concurrency is 10 parallel tasks
turbo run build test lint --concurrency=20

# Use percentage of available CPUs
turbo run build --concurrency=50%

# Serial execution (debugging)
turbo run build --concurrency=1
```

**Output log filtering for CI readability:**

```jsonc
{
  "tasks": {
    "build": {
      "outputLogs": "new-only",
    },
    "lint": {
      "outputLogs": "errors-only",
    },
  },
}
```

Options: `full` (default), `hash-only`, `new-only`, `errors-only`, `none`.

**Monitoring targets:**

- **PR build:** < 3 min (with affected + Remote Cache)
- **Main build:** < 10 min (full suite)
- **Cache hit rate:** > 80% on Remote Cache
- **Docker build:** < 5 min with pruned lockfile

</performance>

---

<decision_framework>

## Decision Framework

### When to use --affected vs --filter?

```
Running a PR build?
|-- YES --> Use --affected (auto-detects CI env, graceful shallow clone fallback)
+-- NO --> Need specific package selection?
    |-- YES --> Use --filter (explicit package/directory/git targeting)
    +-- NO --> Run full task graph (main branch, release builds)
```

### When to enable Remote Cache?

```
Team > 1 person OR using CI?
|-- YES --> Enable Remote Cache (shared artifacts save significant time)
|   |-- Using Vercel for hosting?
|   |   |-- YES --> Free, auto-configured on Vercel deployments
|   |   +-- NO --> Set TURBO_TOKEN + TURBO_TEAM as CI secrets
|   +-- Need artifact signing?
|       |-- YES --> Enable signature verification in turbo.json
|       +-- NO --> Default (unsigned) is fine for trusted environments
+-- NO --> Local cache sufficient (solo developer, single machine)
```

### env vs globalEnv vs passThroughEnv?

```
Does the variable affect task output (build artifacts, test results)?
|-- YES --> Does it affect ALL tasks or just one?
|   |-- ALL tasks --> globalEnv (changes bust cache for everything)
|   +-- One task --> env on that specific task
+-- NO --> Does the task need it at runtime?
    |-- YES --> passThroughEnv (available but not in hash)
    +-- NO --> Don't list it (strict mode blocks it)
```

### When to use turbo prune --docker?

```
Building Docker images from monorepo?
|-- YES --> Does your Dockerfile install from root lockfile?
|   |-- YES --> Use turbo prune --docker (pruned lockfile = better layer caching)
|   +-- NO --> Standard turbo prune (no --docker flag needed)
+-- NO --> Not applicable
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority:**

- **Missing `outputs` on cacheable tasks** -- cached runs restore nothing, tasks appear to succeed but produce no artifacts
- **Missing `env` for environment-dependent tasks** -- build with `API_URL=staging` hits cache from `API_URL=production`, serving wrong config
- **Using `latest` turbo version in CI** -- non-reproducible builds, potential breaking changes mid-pipeline
- **Shallow clones without fallback** -- `--filter=...[origin/main]` fails when git history is insufficient; `--affected` handles this gracefully by falling back to full suite

**Medium Priority:**

- **All environment variables in `globalEnv`** -- every change busts cache for ALL tasks; use task-level `env` for task-specific variables
- **No `--affected` on PR builds** -- full task graph on PRs wastes CI time rebuilding unchanged packages
- **Missing signature verification on shared Remote Cache** -- unsigned artifacts can be tampered with in shared environments
- **Not using `turbo run` explicitly in CI** -- bare `turbo build` may conflict with future CLI subcommands

**Common Mistakes:**

- Forgetting `dependsOn: ["^build"]` for tasks that consume upstream package outputs (test/lint fail because dependency not built)
- Using `loose` env mode and wondering why cache hits serve wrong environment config
- Not including `globalDependencies` for files like `.env` or `tsconfig.base.json` that affect all packages
- Setting `cache: false` on tasks that should be cached (e.g., test, lint) because of past debugging and forgetting to re-enable

**Gotchas & Edge Cases:**

- `--affected` auto-detects GitHub Actions via `GITHUB_BASE_REF` -- other CI providers may need manual `--filter` instead
- `turbo query affected` returns JSON -- parse with `jq` for conditional CI steps
- `outputs` globs are relative to the package directory, not the repo root
- `$TURBO_DEFAULT$` in `inputs` restores the default input behavior when you only want to add inputs, not replace them
- Remote Cache `signature: true` requires `TURBO_REMOTE_CACHE_SIGNATURE_KEY` -- missing key means cache reads fail silently (treated as misses)
- `--summarize` output goes to `.turbo/runs/` -- useful for diffing hashes between two runs to find what changed
- Circular package dependencies are allowed since v2.9 (validated at task graph level, not package graph level)
- `--parallel` flag is deprecated -- use `persistent: true` in turbo.json for long-running tasks instead
- `turbo-ignore` is deprecated -- use `turbo query affected` instead for conditional CI steps
- `remoteCache.timeout` default is 30s, `uploadTimeout` is 60s -- increase for large monorepo artifacts

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST declare `outputs` for every cacheable task in turbo.json -- missing outputs means cached results restore without build artifacts)**

**(You MUST list environment variables that affect task output in `env` (task-level) or `globalEnv` (all tasks) -- omitting them causes cross-environment cache hits with wrong values)**

**(You MUST use `--affected` for PR builds -- running the full task graph on PRs wastes CI time on unchanged packages)**

**(You MUST pin the `turbo` CLI version in CI -- `latest` can introduce breaking changes mid-pipeline)**

**Failure to follow these rules will cause incorrect cache hits (wrong build artifacts served), slow CI (full rebuilds on every PR), and non-reproducible pipelines.**

</critical_reminders>
