---
name: shared-tooling-git-hooks
description: Husky v9 setup, lint-staged v16 patterns, commitlint with conventional commits, CI/production handling, monorepo setup, migration from v8
---

# Git Hooks

> **Quick Guide:** Husky v9 for git hooks with `"prepare": "husky"` (NOT `"husky install"`). lint-staged v16 for staged-only linting. commitlint for conventional commit messages. Pre-commit hooks should take < 10 seconds. Set `HUSKY=0` in CI/production.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `"prepare": "husky"` in package.json - NOT the deprecated `"husky install"`)**

**(You MUST only lint staged files via lint-staged - NEVER lint the entire codebase in pre-commit)**

**(You MUST set `HUSKY=0` in CI/production environments to disable hooks)**

**(You MUST use plain hook files in `.husky/` directory - NO shebang lines or husky.sh sourcing in v9)**

**(You MUST keep pre-commit hooks under 10 seconds - move slow tasks to pre-push or CI)**

</critical_requirements>

---

**Auto-detection:** Husky, husky init, .husky/, pre-commit hook, lint-staged, commitlint, conventional commits, commit-msg hook, git hooks, prepare script

**When to use:**

- Setting up pre-commit hooks with Husky + lint-staged
- Configuring commit message validation with commitlint
- Migrating from Husky v8 to v9
- Configuring git hooks in monorepo setups
- Disabling hooks in CI/production environments

**When NOT to use:**

- Linter/formatter configuration itself (separate concern)
- CI/CD pipeline configuration (separate concern)
- Runtime application code (this is developer workflow tooling only)

**Key patterns covered:**

- Husky v9 setup and hook creation
- lint-staged v16 configuration patterns
- commitlint with conventional commits
- CI/production hook disabling
- Monorepo setup
- Migration from Husky v8 to v9

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Setup, lint-staged config, commitlint, CI handling, monorepo, migration
- [reference.md](reference.md) - Decision frameworks, tool comparison, anti-patterns

---

<philosophy>

## Philosophy

Git hooks are a **developer workflow tool** - they catch issues early while staying fast and non-blocking. The goal is fast feedback (< 10 seconds) on staged files only. Hooks are optional infrastructure; many projects work fine without them.

**When to use git hooks:**

- Team projects where code quality gates prevent CI failures
- Projects with established linting/formatting that should be enforced
- When you want fast feedback before code reaches CI
- Monorepos where running full lint is too slow

**When NOT to use:**

- Solo projects where you always remember to lint (overhead without benefit)
- Projects without established linting/formatting rules yet (set up linting first)
- When pre-commit hooks exceed 10 seconds (move to CI instead)
- CI-only projects where hooks add friction without value

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Husky v9 Setup

Husky v9 uses plain shell scripts in `.husky/` directory. No shebang lines needed. The `prepare` script auto-installs hooks for all team members.

```bash
# Full setup in 4 commands
bun add -D husky
bunx husky init       # Creates .husky/ and adds "prepare": "husky" to package.json
bun add -D lint-staged
echo "bunx lint-staged" > .husky/pre-commit
```

**Key points:**

- `"prepare": "husky"` (NOT `"husky install"` - deprecated, will break in v10)
- Hook files are plain shell scripts (no shebang required in v9)
- `HUSKY=0` disables hooks (CI/production); `HUSKY=2` enables debug mode
- v9.1.1+ allows running package commands directly without npx/bunx

See [examples/core.md](examples/core.md) for full setup and package.json configuration.

---

### Pattern 2: Pre-commit Hook with lint-staged

lint-staged v16 runs commands only on staged files. Uses `picomatch` for glob matching (replaced `micromatch`).

```javascript
// lint-staged.config.mjs
export default {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,scss}": ["prettier --write"],
};
```

Type checking requires function syntax (runs on ALL files, not just staged):

```javascript
// lint-staged.config.mjs — with type checking
export default {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{ts,tsx,js,jsx}": () => "tsc --noEmit",
};
```

**Why good:** Only staged files, auto-fix reduces manual work, fast feedback

**v16 breaking changes:** `--shell` flag removed (use shell scripts instead), requires Node.js 20.18+

See [examples/core.md](examples/core.md) for multiple file type patterns and v16 migration details.

---

### Pattern 3: Commitlint with Conventional Commits

commitlint v20+ validates commit messages. ESM-native - use `.mjs` config extension.

```bash
bun add -D @commitlint/cli @commitlint/config-conventional
```

```bash
# .husky/commit-msg
bunx commitlint --edit $1
```

```javascript
// commitlint.config.mjs (MUST be .mjs for Node v24 compatibility)
export default {
  extends: ["@commitlint/config-conventional"],
};
```

Format: `type(scope): description` - types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc.

See [examples/core.md](examples/core.md) for v20 changes and advanced configuration.

---

### Pattern 4: CI/Production Environment Handling

Disable Husky where hooks should not run.

```bash
# CI pipelines
HUSKY=0 npm install

# GitHub Actions
env:
  HUSKY: 0
```

**Why:** Prevents hook installation failures when `devDependencies` not installed in production.

See [examples/core.md](examples/core.md) for conditional prepare script alternatives.

---

### Pattern 5: Monorepo Setup

For monorepos where package.json is not at the repository root.

```json
// apps/frontend/package.json
{
  "scripts": {
    "prepare": "cd ../.. && husky apps/frontend/.husky"
  }
}
```

**Key:** Navigate to repo root, then pass the `.husky/` directory path to Husky.

---

### Pattern 6: Migration from Husky v8 to v9

Step-by-step: update prepare script, remove shebangs/husky.sh sourcing from hook files, delete `.husky/.gitignore`, remove `pinst` if used.

**Important:** Hooks with deprecated shebang `#!/usr/bin/env sh` and husky.sh sourcing will **fail in v10.0.0**. Migrate now.

See [examples/core.md](examples/core.md) for the full migration walkthrough.

</patterns>

---

<decision_framework>

## Decision Framework

### What to Run Pre-commit

```
What to run pre-commit?
├─ Fast (< 10 seconds)?
│   ├─ Lint with auto-fix → YES (lint-staged)
│   ├─ Format → YES (lint-staged)
│   └─ Type check (--noEmit) → YES (lint-staged)
└─ Slow (> 10 seconds)?
    ├─ Full test suite → NO (pre-push or CI)
    ├─ Full build → NO (CI)
    └─ E2E tests → NO (CI)
```

### Which Hook for Which Task

```
Which Git hook?
├─ Before committing? → pre-commit (lint-staged)
├─ Validating commit message? → commit-msg (commitlint)
├─ Before pushing? → pre-push (type check, unit tests)
├─ Before merging? → pre-merge-commit (v9.1.5+)
└─ After checkout/merge? → post-checkout / post-merge (install deps)
```

### Pre-commit Timing Guidelines

| Task                            | Time  | Pre-commit? |
| ------------------------------- | ----- | ----------- |
| lint-staged (staged files only) | < 5s  | Yes         |
| Prettier format                 | < 2s  | Yes         |
| Type check (--noEmit)           | < 10s | Yes         |
| Full test suite                 | > 30s | No (CI)     |
| E2E tests                       | > 60s | No (CI)     |
| Full build                      | > 30s | No (CI)     |

See [reference.md](reference.md) for Husky vs alternatives comparison.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using deprecated `"prepare": "husky install"` instead of `"prepare": "husky"` (will break in v10)
- Running full lint on entire codebase in pre-commit hook (too slow, defeats staged-only purpose)
- Using v4-style `"husky": { "hooks": {} }` config in package.json (not supported in v9)
- Using `HUSKY_GIT_PARAMS` environment variable (deprecated, use `$1` instead)

**Medium Priority Issues:**

- Pre-commit hooks taking > 10 seconds (encourages `--no-verify` abuse)
- Missing `HUSKY=0` in CI/production (hooks may fail when devDependencies not installed)
- Using deprecated shebang `#!/usr/bin/env sh` and husky.sh sourcing in hook files (will fail in v10)
- Using commitlint config with `.js` extension on Node v24 (use `.mjs` instead)

**Gotchas & Edge Cases:**

- `git commit --no-verify` bypasses hooks entirely - emergency escape hatch, not for regular use
- lint-staged function syntax `() => "tsc --noEmit"` runs on ALL files, not just staged
- Hook file names must match Git's exact names (`pre-commit`, `commit-msg`) - no extensions, case-sensitive
- `HUSKY=2` enables debug mode (replaces deprecated `HUSKY_DEBUG=1`)
- commitlint v20+ is ESM-native - `.mjs` config extension avoids module loading issues
- Windows users need to escape `$1` in commit-msg hook
- In monorepos, `prepare` script must navigate to repo root before running husky
- `~/.huskyrc` support will be removed in v10 - migrate to `.config/husky/init.sh`
- lint-staged v16 uses `picomatch` (not `micromatch`) - glob patterns may differ slightly

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `"prepare": "husky"` in package.json - NOT the deprecated `"husky install"`)**

**(You MUST only lint staged files via lint-staged - NEVER lint the entire codebase in pre-commit)**

**(You MUST set `HUSKY=0` in CI/production environments to disable hooks)**

**(You MUST use plain hook files in `.husky/` directory - NO shebang lines or husky.sh sourcing in v9)**

**(You MUST keep pre-commit hooks under 10 seconds - move slow tasks to pre-push or CI)**

**Failure to follow these rules will cause slow commits, broken CI builds, and deprecated hook patterns that will fail in Husky v10.**

</critical_reminders>
