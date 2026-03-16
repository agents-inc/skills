# Git Hooks Reference

> Decision frameworks, red flags, and anti-patterns for git hooks with Husky, lint-staged, and commitlint.

---

## Decision Framework

### When to Use Git Hooks

```
What to run pre-commit?
├─ Fast (< 10 seconds)?
│   ├─ Lint with auto-fix → YES ✓
│   ├─ Format with Prettier → YES ✓
│   └─ Type check (--noEmit) → YES ✓
└─ Slow (> 10 seconds)?
    ├─ Full test suite → NO (run in pre-push or CI)
    ├─ Full build → NO (run in CI)
    ├─ E2E tests → NO (run in CI)
    └─ Bundle analysis → NO (run in CI)
```

**Rule of thumb:** Pre-commit should take < 10 seconds. Anything slower goes to pre-push or CI.

---

### Husky vs Alternatives

```
Choosing a git hooks tool?
├─ JavaScript/TypeScript project?
│   ├─ Need mature ecosystem + community? → Husky ✓
│   └─ Need parallel hook execution? → Consider Lefthook
├─ Polyglot project (Go, Python, JS)?
│   └─ YES → Lefthook (no Node.js dependency, Go binary)
├─ Minimal needs (one simple hook)?
│   └─ YES → simple-git-hooks (zero config)
└─ Large monorepo with slow hooks?
    └─ YES → Lefthook (Go binary, parallel execution, caching)
```

**Current recommendation:** Husky for JavaScript/TypeScript projects (7M+ weekly downloads, mature ecosystem)

**Future consideration:** Lefthook if you need parallel execution, polyglot support, or Go-binary speed

| Tool             | Language | Parallel | Config       | Downloads |
| ---------------- | -------- | -------- | ------------ | --------- |
| Husky            | JS       | No       | Shell files  | 7M+/week  |
| Lefthook         | Go       | Yes      | YAML         | Growing   |
| simple-git-hooks | JS       | No       | package.json | Moderate  |

---

### Which Hook for Which Task

```
Which Git hook to use?
├─ Before committing code?
│   └─ pre-commit → lint-staged (lint + format staged files)
├─ Validating commit message?
│   └─ commit-msg → commitlint (conventional commits)
├─ Before pushing to remote?
│   └─ pre-push → Full type check, unit tests
├─ Before merging?
│   └─ pre-merge-commit → Conflict checks (Husky v9.1.5+)
└─ After checkout/merge?
    └─ post-checkout / post-merge → Install deps, rebuild
```

---

## RED FLAGS

**High Priority Issues:**

- ❌ Using deprecated `"prepare": "husky install"` instead of `"prepare": "husky"` (will break in v10)
- ❌ Running full lint on entire codebase in pre-commit hook (too slow, defeats staged-only purpose)
- ❌ Using v4-style `"husky": { "hooks": {} }` config in package.json (not supported in v9)
- ❌ Using `HUSKY_GIT_PARAMS` environment variable (deprecated, use `$1` instead)

**Medium Priority Issues:**

- ⚠️ Pre-commit hooks taking > 10 seconds (encourages --no-verify abuse)
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Missing `HUSKY=0` in CI/production (hooks may fail when devDependencies not installed)
- ⚠️ Using deprecated shebang and husky.sh sourcing in hook files (will fail in v10)

---

## Anti-Patterns to Avoid

### Deprecated Husky v8 Prepare Script

```json
// ❌ ANTI-PATTERN: Deprecated husky install command
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

**Why it's wrong:** `husky install` is deprecated in Husky v9 and will show a deprecation warning on every `npm install`. Will be completely removed in v10.

**What to do instead:** Use just `"prepare": "husky"` for v9.

```json
// ✅ Correct Husky v9 prepare script
{
  "scripts": {
    "prepare": "husky"
  }
}
```

---

### Legacy Husky v4 Configuration

```json
// ❌ ANTI-PATTERN: v4-style config in package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

**Why it's wrong:** v4-style configuration in `package.json` or `.huskyrc` files is no longer supported in v9. Also, `HUSKY_GIT_PARAMS` is deprecated.

**What to do instead:** Create individual hook files in `.husky/` directory:

```bash
# ✅ .husky/pre-commit
bunx lint-staged

# ✅ .husky/commit-msg
bunx commitlint --edit $1
```

---

### Deprecated Shebang and husky.sh Sourcing

```bash
# ❌ ANTI-PATTERN: v8-style hook file
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bunx lint-staged
```

**Why it's wrong:** Shebang lines and husky.sh sourcing are deprecated in v9 and will **fail in v10.0.0**.

**What to do instead:** Use plain scripts without shebang or sourcing:

```bash
# ✅ v9-style hook file
bunx lint-staged
```

---

### Full Codebase Lint in Pre-commit

```bash
# ❌ ANTI-PATTERN: Linting entire codebase on every commit
# .husky/pre-commit
cd apps/client-react && bun run lint
```

**Why it's wrong:** Linting the entire codebase on every commit is slow, blocks unrelated commits, and encourages `--no-verify`.

**What to do instead:** Use lint-staged to lint only staged files:

```bash
# ✅ .husky/pre-commit
bunx lint-staged
```

---

### Incorrect Hook File Names

```bash
# ❌ ANTI-PATTERN: Wrong file names
.husky/precommit       # Missing hyphen
.husky/pre-commit.sh   # Extra extension
.husky/Pre-Commit      # Wrong case
```

**Why it's wrong:** Hook file names must match Git's exact hook names. No extensions, no variations, case-sensitive.

**What to do instead:** Use exact Git hook names:

```bash
# ✅ Correct hook file names
.husky/pre-commit
.husky/commit-msg
.husky/pre-push
.husky/pre-merge-commit
```

---

## Gotchas & Edge Cases

- **Hooks don't run with `git commit --no-verify`**: This is an emergency escape hatch, not for regular use. If developers use it regularly, your hooks are too slow.
- **lint-staged glob patterns**: v16 uses `picomatch` (not `micromatch`). Glob patterns differ slightly from `.gitignore` syntax. Test patterns with `bunx lint-staged --debug`.
- **lint-staged function syntax**: `() => "tsc --noEmit"` runs the command on ALL files, not just staged ones. Use this for type checking where you need the full project context.
- **Hook file names**: Must match Git's exact hook names (`pre-commit`, `commit-msg`, `pre-push`). No extensions (`.sh`), no variations (`precommit`).
- **`HUSKY=2` debug mode**: Replaces deprecated `HUSKY_DEBUG=1`. Shows which hooks are being executed and why.
- **v9.1.1+ direct commands**: You can run package commands directly in hooks without npx/bunx prefix (e.g., `lint-staged` instead of `bunx lint-staged`).
- **commitlint `.mjs` config**: Node v24 changes module loading. Use `commitlint.config.mjs` to avoid "Please add rules to your commitlint.config.js" errors.
- **Windows `$1` escaping**: In `.husky/commit-msg`, Windows users must escape the dollar sign: `` `$1` ``.
- **Monorepo `prepare` script**: Must navigate to the repo root before running husky. The `.husky/` directory must be at the git root or explicitly specified.
- **`~/.huskyrc` removal**: Support for `~/.huskyrc` will be removed in v10. Migrate to `.config/husky/init.sh` for user-level hook initialization.
- **lint-staged `--shell` removed in v16**: Create shell scripts for complex shell operations instead of using inline shell commands.
- **Partially staged files**: lint-staged handles partially staged files by stashing unstaged changes, running tasks, and restoring. If a task fails, the backup stash is restored automatically (improved in v16).
