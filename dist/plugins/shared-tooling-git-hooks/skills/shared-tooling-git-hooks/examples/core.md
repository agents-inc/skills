# Git Hooks - Core Examples

> Setup, configuration, and migration patterns for Husky v9, lint-staged v16, and commitlint v20. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for tool comparison.

---

## Pattern 1: Husky v9 Setup

### Setup Steps

```bash
# 1. Install Husky
bun add -D husky

# 2. Initialize (creates .husky/ and adds prepare script to package.json)
bunx husky init

# 3. Install lint-staged
bun add -D lint-staged

# 4. Create pre-commit hook
echo "bunx lint-staged" > .husky/pre-commit
```

### What `husky init` Does

- Creates `.husky/` directory with a default `pre-commit` hook
- Adds `"prepare": "husky"` to `package.json` scripts

```json
// package.json - added automatically by husky init
{
  "scripts": {
    "prepare": "husky"
  }
}
```

**Why good:** `prepare` script auto-installs hooks on `npm/bun install`, ensuring consistent setup across the team without manual steps

---

## Pattern 2: Pre-commit Hook with lint-staged

### Basic Setup

```bash
# .husky/pre-commit
bunx lint-staged
```

```javascript
// lint-staged.config.mjs
export default {
  "*.{ts,tsx}": "eslint --fix",
};
```

**Why good:** Only lints staged files keeping commits fast, auto-fix reduces manual work, blocks bad code before it reaches CI

### Bad Example - Full Codebase Lint

```bash
# BAD: .husky/pre-commit
cd apps/client-react && bun run lint
```

**Why bad:** Linting entire codebase is slow, unrelated file failures block unrelated commits, encourages `--no-verify`

### Multiple File Type Patterns

```javascript
// lint-staged.config.mjs
export default {
  // TypeScript files - lint and format
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],

  // Stylesheets - format only
  "*.{css,scss}": ["prettier --write"],

  // JSON files - format only
  "*.json": ["prettier --write"],

  // Type check ALL TS files when any changes (function syntax = all files)
  "*.{ts,tsx}": () => "tsc --noEmit",
};
```

**Why good:** Different file types get appropriate tooling, array syntax runs commands sequentially, function syntax runs on all files (needed for type checking)

### lint-staged v16 Changes

- `--shell` flag removed - create shell scripts for complex shell operations
- Switched to `picomatch` for glob matching (from `micromatch`)
- Subprocess management via `tinyexec` (replaced `execa` and `nano-spawn`)
- Requires Node.js 20.18+
- Improved error handling - backup stash restored on spawn failures

---

## Pattern 3: Commitlint with Conventional Commits

### Installation and Configuration

```bash
bun add -D @commitlint/cli @commitlint/config-conventional
```

```javascript
// commitlint.config.mjs (MUST use .mjs for Node v24 compatibility)
export default {
  extends: ["@commitlint/config-conventional"],
};
```

### Husky Integration

```bash
# .husky/commit-msg
bunx commitlint --edit $1
```

**Note:** Use `$1` (not the deprecated `HUSKY_GIT_PARAMS`).

### Conventional Commit Format

```
type(scope): description

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### commitlint v20 Changes

- CLI migrated to pure ESM
- New `breaking-change-exclamation-mark` rule
- `body-max-line-length` ignores lines containing URLs
- Use `.mjs` config extension for Node v24 compatibility

---

## Pattern 4: CI/Production Environment Handling

### Disable Hooks in CI

```bash
# Inline environment variable
HUSKY=0 npm install

# GitHub Actions
env:
  HUSKY: 0
```

### Conditional Prepare Script

```json
// package.json - skip husky in CI
{
  "scripts": {
    "prepare": "node -e \"if (process.env.CI !== 'true') require('husky')\""
  }
}
```

**Why good:** Prevents hook installation failures when `devDependencies` not installed in production/CI builds

---

## Pattern 5: Monorepo Setup

```json
// apps/frontend/package.json
{
  "scripts": {
    "prepare": "cd ../.. && husky apps/frontend/.husky"
  }
}
```

**Key:** Navigate to repo root first, then pass the nested `.husky/` directory path. The `.husky/` directory must be reachable from the Git root.

---

## Pattern 6: Migration from Husky v8 to v9

```bash
# 1. Update prepare script
# package.json
{
  "scripts": {
-    "prepare": "husky install"
+    "prepare": "husky"
  }
}

# 2. Remove shebang and husky.sh sourcing from ALL hook files
# BEFORE (v8 style):
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bunx lint-staged

# AFTER (v9 style):
bunx lint-staged

# 3. Delete .husky/.gitignore (no longer needed)
rm .husky/.gitignore

# 4. Remove pinst if used
bun remove pinst
```

**Important:** Hooks with deprecated shebang `#!/usr/bin/env sh` and husky.sh sourcing will **fail in v10.0.0**. Migrate now to avoid breakage.
