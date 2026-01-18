# Tooling - Git Hooks

> Husky v9 pre-commit hooks with lint-staged and VS Code integration for consistent code quality. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

---

## Husky v9 Key Points

- **Prepare script**: Must be `"prepare": "husky"` (NOT `"husky install"` which is deprecated)
- **Hook files**: Plain shell scripts in `.husky/` directory (no shebang required in v9)
- **Disable hooks**: Set `HUSKY=0` environment variable (for CI/production)
- **Debug mode**: Set `HUSKY=2` (replaces deprecated `HUSKY_DEBUG=1`)

---

## Pre-commit Hook Setup

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

---

## VS Code Integration

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
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"]
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

## Husky v9 Setup Steps

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

---

## Husky v9 Monorepo Setup

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

## CI/Production Environment Handling

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

## lint-staged Patterns

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

---

## Pre-commit Timing Guidelines

| Task | Time | Pre-commit? |
|------|------|-------------|
| lint-staged (staged files only) | < 5s | Yes |
| Prettier format | < 2s | Yes |
| Type check (--noEmit) | < 10s | Yes |
| Full test suite | > 30s | No (CI) |
| E2E tests | > 60s | No (CI) |
| Full build | > 30s | No (CI) |

**Rule of thumb:** Pre-commit should take < 10 seconds. Anything slower goes to pre-push or CI.

---

## Husky v9 Deprecated Patterns

```bash
# BAD: Deprecated v8 prepare script
{
  "scripts": {
    "prepare": "husky install"  # DEPRECATED - shows warning
  }
}
```

**Why bad:** `husky install` is deprecated in v9 and will show a deprecation warning. Use just `"prepare": "husky"` instead.

```bash
# BAD: Deprecated v4-style config in package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  }
}
```

**Why bad:** v4-style configuration in package.json or `.huskyrc` files is no longer supported. Use `.husky/` directory with individual hook files instead.

```bash
# BAD: Incorrect hook file names
.husky/precommit       # Missing hyphen - won't work
.husky/pre-commit.sh   # Extra extension - won't work
```

**Why bad:** Hook file names must match Git's exact hook names (e.g., `pre-commit`, `commit-msg`). No extensions or variations.

---

## Husky v9 Migration from v8

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

---

## Husky v9 Commitlint Integration

```bash
# .husky/commit-msg
bunx commitlint --edit $1
```

```javascript
// commitlint.config.mjs
export default {
  extends: ["@commitlint/config-conventional"],
};
```

**Note:** In v9, use `$1` instead of the deprecated `HUSKY_GIT_PARAMS` environment variable.

---

## See Also

- [eslint.md](eslint.md) for ESLint configuration
- [core.md](core.md) for Prettier configuration
- [reference.md](../reference.md) for when to use git hooks decision framework
