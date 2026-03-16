# Git Hooks Reference

> Decision frameworks, tool comparison, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for implementation patterns.

---

## Husky vs Alternatives

```
Choosing a git hooks tool?
├─ JavaScript/TypeScript project?
│   ├─ Need mature ecosystem + community? → Husky
│   └─ Need parallel hook execution? → Consider Lefthook
├─ Polyglot project (Go, Python, JS)?
│   └─ YES → Lefthook (no Node.js dependency, Go binary)
├─ Minimal needs (one simple hook)?
│   └─ YES → simple-git-hooks (zero config)
└─ Large monorepo with slow hooks?
    └─ YES → Lefthook (Go binary, parallel execution, caching)
```

| Tool             | Language | Parallel | Config       | Best For                |
| ---------------- | -------- | -------- | ------------ | ----------------------- |
| Husky            | JS       | No       | Shell files  | JS/TS projects (7M+/wk) |
| Lefthook         | Go       | Yes      | YAML         | Polyglot, performance   |
| simple-git-hooks | JS       | No       | package.json | Single simple hook      |

---

## Anti-Patterns

### Deprecated v8 Prepare Script

```json
// BAD
{ "scripts": { "prepare": "husky install" } }

// GOOD
{ "scripts": { "prepare": "husky" } }
```

`husky install` is deprecated in v9, shows warnings, removed in v10.

---

### Legacy v4 Configuration

```json
// BAD - v4-style config in package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

Not supported in v9. Use individual hook files in `.husky/` directory. `HUSKY_GIT_PARAMS` is also deprecated (use `$1`).

---

### Deprecated Shebang and husky.sh Sourcing

```bash
# BAD - v8-style hook file
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bunx lint-staged

# GOOD - v9-style plain script
bunx lint-staged
```

Shebang and husky.sh sourcing will **fail in v10.0.0**.

---

### Full Codebase Lint in Pre-commit

```bash
# BAD
# .husky/pre-commit
cd apps/client-react && bun run lint

# GOOD
# .husky/pre-commit
bunx lint-staged
```

Full codebase lint is slow, blocks unrelated commits, encourages `--no-verify`.

---

### Incorrect Hook File Names

```bash
# BAD
.husky/precommit       # Missing hyphen
.husky/pre-commit.sh   # Extra extension
.husky/Pre-Commit      # Wrong case

# GOOD
.husky/pre-commit
.husky/commit-msg
.husky/pre-push
```

Hook file names must match Git's exact hook names. No extensions, case-sensitive.
