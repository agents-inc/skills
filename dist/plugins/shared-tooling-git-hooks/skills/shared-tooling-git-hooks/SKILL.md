---
name: shared-tooling-git-hooks
description: Husky v9 setup + migration from v8, lint-staged patterns, commitlint + conventional commits, VS Code integration, CI/production handling
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

**Auto-detection:** Husky, husky init, .husky/, pre-commit hook, lint-staged, commitlint, conventional commits, commit-msg hook, git hooks

**When to use:**

- Setting up pre-commit hooks with Husky + lint-staged
- Configuring commit message validation with commitlint
- Migrating from Husky v8 to v9
- Adding VS Code editor integration for format-on-save
- Configuring git hooks in monorepo setups
- Disabling hooks in CI/production environments

**When NOT to use:**

- ESLint or Prettier configuration itself (see `shared-tooling-eslint-prettier`)
- CI/CD pipeline configuration (see CI/CD skill)
- Runtime code (this is developer workflow tooling only)

**Key patterns covered:**

- Husky v9 setup and hook creation
- lint-staged v16 configuration patterns
- commitlint with conventional commits
- VS Code integration (format on save, auto-fix)
- CI/production hook disabling
- Monorepo setup
- Migration from Husky v8 to v9
- Pre-commit timing guidelines

**Detailed Resources:**

- For code examples, see [examples/git-hooks.md](examples/git-hooks.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Related skills:**

- For ESLint and Prettier configuration (what lint-staged runs), see `shared-tooling-eslint-prettier`
- For monorepo workspace configuration, see `setup/monorepo`
- For daily coding conventions (naming, imports, constants), see CLAUDE.md

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

Husky v9 uses plain shell scripts in `.husky/` directory. No shebang lines needed. The `prepare` script ensures hooks install automatically for all team members.

#### Setup Steps

```bash
# 1. Install Husky
bun add -D husky

# 2. Initialize Husky (creates .husky/ and adds prepare script to package.json)
bunx husky init

# 3. Install lint-staged
bun add -D lint-staged

# 4. Create pre-commit hook
echo "bunx lint-staged" > .husky/pre-commit
```

**What `husky init` does:**

- Creates `.husky/` directory with a default `pre-commit` hook
- Adds `"prepare": "husky"` to your `package.json` scripts

```json
// package.json - This is added automatically by husky init
{
  "scripts": {
    "prepare": "husky"
  }
}
```

**Why good:** The `prepare` script ensures hooks are installed automatically when team members run `npm/bun install`, so everyone gets the same setup without manual steps

#### Husky v9 Key Points

- **Prepare script**: Must be `"prepare": "husky"` (NOT `"husky install"` which is deprecated)
- **Hook files**: Plain shell scripts in `.husky/` directory (no shebang required in v9)
- **Disable hooks**: Set `HUSKY=0` environment variable (for CI/production)
- **Debug mode**: Set `HUSKY=2` (replaces deprecated `HUSKY_DEBUG=1`)
- **Direct commands**: v9.1.1+ allows running package commands directly without npx/bunx
- **Pre-merge-commit**: v9.1.5+ supports the `pre-merge-commit` hook type

---

### Pattern 2: Pre-commit Hook with lint-staged

lint-staged runs commands only on staged files, keeping commits fast. v16 removed the `--shell` flag and uses `picomatch` for glob matching.

```bash
# .husky/pre-commit
bunx lint-staged
```

```javascript
// apps/client-react/lint-staged.config.mjs
export default {
  "*.{ts,tsx,scss}": "eslint --fix",
};
```

**Why good:** Only lints staged files keeping commits fast, auto-fix applies corrections automatically reducing manual work, blocking bad code before commit prevents build failures in CI, running on pre-commit catches issues immediately while context is fresh

```bash
// BAD: Full lint on every commit
# .husky/pre-commit
cd apps/client-react && bun run lint
```

**Why bad:** Linting entire codebase on every commit is slow reducing developer productivity, unrelated files failing lint blocks unrelated commits, long-running hooks encourage using --no-verify defeating the purpose, no auto-fix means developers manually fix issues

#### lint-staged Multiple File Type Patterns

```javascript
// lint-staged.config.mjs - Multiple patterns
export default {
  // TypeScript and React files
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],

  // Stylesheets
  "*.{css,scss}": ["prettier --write"],

  // JSON files
  "*.json": ["prettier --write"],

  // Run type check on all TS files when any TS file changes
  "*.{ts,tsx}": () => "tsc --noEmit",
};
```

**Why good:** Different file types get appropriate tooling, array syntax runs multiple commands sequentially, function syntax allows running commands on all files (not just staged)

#### lint-staged v16 Changes

- `--shell` flag removed - create shell scripts instead of inline shell commands
- Switched to `picomatch` for glob matching (from `micromatch`)
- Better subprocess management with `tinyexec`
- Improved error handling - backup stash restored on spawn failures

---

### Pattern 3: VS Code Integration

Editor integration catches issues at save time, before they even reach the commit hook.

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

```json
// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig"
  ]
}
```

**Why good:** Format on save prevents unformatted code from being committed, auto-fix on save applies ESLint corrections automatically, per-language formatters ensure consistent tooling, recommended extensions help team setup

```json
// BAD: No editor integration
// No .vscode/settings.json

// Developers manually run:
// bun run lint:fix
// bun run format
```

**Why bad:** Manual formatting is forgotten leading to inconsistent code, lint errors discovered late instead of immediately on save, new team members don't know which extensions to install, each developer configures editor differently

---

### Pattern 4: Commitlint with Conventional Commits

commitlint validates commit messages against conventional commit format. v20+ is ESM-native.

#### Installation

```bash
# Install commitlint
bun add -D @commitlint/cli @commitlint/config-conventional
```

#### Configuration

```javascript
// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
};
```

**Note:** Use `.mjs` extension for the config file. Node v24 may fail to load `.js` config files due to module loading changes.

#### Husky Integration

```bash
# .husky/commit-msg
bunx commitlint --edit $1
```

**Why good:** Enforces consistent commit message format across the team, conventional commits enable automatic changelog generation, machine-readable commit history aids automation

**Note:** In v9, use `$1` instead of the deprecated `HUSKY_GIT_PARAMS` environment variable.

#### Conventional Commit Format

```
type(scope): description

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

#### commitlint v20 Changes

- CLI migrated to pure ESM
- New `breaking-change-exclamation-mark` rule
- `body-max-line-length` now ignores lines containing URLs
- Use `.mjs` config extension for Node v24 compatibility

---

### Pattern 5: CI/Production Environment Handling

Disable Husky in environments where hooks should not run.

```bash
# In CI/CD pipelines - disable Husky to avoid running hooks
HUSKY=0 npm install

# Or in GitHub Actions:
env:
  HUSKY: 0
```

```javascript
// Alternative: Conditional prepare script for production installs
// package.json
{
  "scripts": {
    "prepare": "node -e \"if (process.env.CI !== 'true') require('husky')\""
  }
}
```

**Why good:** Prevents hook installation failures when `devDependencies` are not installed in production builds

---

### Pattern 6: Monorepo Setup

For monorepos where the package.json running hooks is not at the repository root.

```bash
# For monorepos where package.json is not at the root
# Modify the prepare script to navigate to the correct directory

# In apps/frontend/package.json:
{
  "scripts": {
    "prepare": "cd ../.. && husky apps/frontend/.husky"
  }
}
```

**Why good:** Allows Husky to work in nested project structures where the `.husky/` directory may not be at the repository root

---

### Pattern 7: Migration from Husky v8 to v9

Step-by-step migration guide for existing v8 installations.

```bash
# 1. Update prepare script (replace "husky install" with "husky")
# package.json
{
  "scripts": {
-    "prepare": "husky install"
+    "prepare": "husky"
  }
}

# 2. Remove shebang and husky.sh sourcing from hook files
# .husky/pre-commit (BEFORE - v8 style)
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bunx lint-staged

# .husky/pre-commit (AFTER - v9 style)
bunx lint-staged

# 3. Delete .husky/.gitignore (no longer needed)
rm .husky/.gitignore

# 4. If using pinst, remove it entirely
bun remove pinst
```

**Why good:** v9 simplifies hook files to plain scripts, removes boilerplate, and the prepare script is shorter

**Important:** Hooks containing deprecated shebang `#!/usr/bin/env sh` and husky.sh sourcing will **fail in v10.0.0**. Migrate now to avoid breakage.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Use Git Hooks

```
What to run pre-commit?
├─ Fast (< 10 seconds)?
│   ├─ Lint with auto-fix → YES (lint-staged)
│   ├─ Format with Prettier → YES (lint-staged)
│   └─ Type check (--noEmit) → YES (lint-staged)
└─ Slow (> 10 seconds)?
    ├─ Full test suite → NO (run in pre-push or CI)
    ├─ Full build → NO (run in CI)
    ├─ E2E tests → NO (run in CI)
    └─ Bundle analysis → NO (run in CI)
```

**Rule of thumb:** Pre-commit should take < 10 seconds. Anything slower goes to pre-push or CI.

### Husky vs Alternatives

```
Choosing a git hooks tool?
├─ JavaScript/TypeScript project?
│   ├─ Need mature ecosystem + community? → Husky ✓
│   └─ Need parallel hook execution? → Consider Lefthook
├─ Polyglot project (Go, Python, JS)?
│   └─ YES → Lefthook (no Node.js dependency)
├─ Minimal needs (one simple hook)?
│   └─ YES → simple-git-hooks (zero config)
└─ Large monorepo with slow hooks?
    └─ YES → Lefthook (Go binary, parallel execution, caching)
```

**Current recommendation:** Husky for JavaScript/TypeScript projects (7M+ weekly downloads, mature ecosystem). Consider Lefthook for polyglot or performance-critical setups.

### Pre-commit Timing Guidelines

| Task                            | Time  | Pre-commit? |
| ------------------------------- | ----- | ----------- |
| lint-staged (staged files only) | < 5s  | Yes         |
| Prettier format                 | < 2s  | Yes         |
| Type check (--noEmit)           | < 10s | Yes         |
| Full test suite                 | > 30s | No (CI)     |
| E2E tests                       | > 60s | No (CI)     |
| Full build                      | > 30s | No (CI)     |

See [reference.md](reference.md) for additional decision frameworks and anti-patterns.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Using deprecated `"prepare": "husky install"` instead of `"prepare": "husky"` (shows deprecation warning, will break in v10)
- ❌ Running full lint on entire codebase in pre-commit hook (too slow, defeats purpose of staged-only linting)
- ❌ Using v4-style `"husky": { "hooks": {} }` config in package.json (not supported in v9)
- ❌ Using `HUSKY_GIT_PARAMS` environment variable (deprecated, use `$1` instead)

**Medium Priority Issues:**

- ⚠️ Pre-commit hooks taking > 10 seconds (encourages --no-verify, move slow tasks to CI)
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Missing `HUSKY=0` in CI/production (hooks may fail when devDependencies not installed)
- ⚠️ Using deprecated shebang `#!/usr/bin/env sh` and husky.sh sourcing in hook files (will fail in v10)
- ⚠️ Using commitlint config with `.js` extension on Node v24 (use `.mjs` instead)

**Common Mistakes:**

- Running lint-staged on all files instead of staged only (defeats the purpose)
- Using incorrect hook file names (`precommit` instead of `pre-commit`, or `pre-commit.sh`)
- Not adding `.husky/` directory to git (hooks won't be shared with team)
- Forgetting to set `HUSKY=0` in Docker builds (causes install failures)

**Gotchas & Edge Cases:**

- Hooks don't run with `git commit --no-verify` (emergency escape hatch, not for regular use)
- lint-staged glob patterns differ slightly from .gitignore syntax (uses picomatch in v16)
- lint-staged function syntax `() => "tsc --noEmit"` runs command on ALL files, not just staged
- Hook file names must match Git's exact hook names (e.g., `pre-commit`, `commit-msg`, `pre-push`)
- `HUSKY=2` enables debug mode (replaces deprecated `HUSKY_DEBUG=1`)
- v9.1.1+ allows running package commands directly without npx/bunx in hooks
- commitlint v20+ is ESM-native - use `.mjs` config extension for compatibility
- Windows users need to escape `$1` in commit-msg hook: `` `$1` ``
- In monorepos, the `prepare` script must navigate to the repo root before running husky

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
