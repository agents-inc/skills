# Tooling Reference

> Decision frameworks, red flags, and anti-patterns for build tooling.

---

## Decision Framework

### ESLint vs Biome

```
Need linting and formatting?
├─ Large monorepo (1000+ files)?
│   ├─ Speed is critical bottleneck?
│   │   └─ YES → Consider Biome (20x faster)
│   └─ NO → ESLint 9 + Prettier
└─ Greenfield project?
    ├─ Want single tool for lint + format?
    │   └─ YES → Consider Biome
    └─ Need mature plugin ecosystem?
        └─ YES → ESLint 9 + Prettier ✓
```

**Current recommendation:** ESLint 9 + Prettier (mature, stable, extensive plugin ecosystem)

**Future consideration:** Biome when plugin ecosystem matures

---

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

### Prettier vs Biome Formatting

```
Need code formatting?
├─ Already using ESLint?
│   └─ YES → Prettier (integrates well)
├─ Want fastest possible formatting?
│   └─ YES → Biome (20x faster)
└─ Need extensive language support?
    └─ YES → Prettier (supports more languages)
```

---

### Shared Config vs Per-Package Config

```
Setting up linting/formatting?
├─ Monorepo with multiple packages?
│   └─ YES → Shared config (@repo/eslint-config) ✓
└─ Single package/app?
    └─ YES → Local config is fine
```

**Shared configs prevent drift and ensure consistency.**

---

## RED FLAGS

**High Priority Issues:**

- ❌ Using legacy .eslintrc format instead of ESLint 9 flat config (format is being phased out)
- ❌ Missing eslint-plugin-only-warn (errors block developers during development)
- ❌ Disabling TypeScript strict mode (allows implicit any and null bugs)
- ❌ Not using shared configs in monorepo (configs drift causing inconsistency)

**Medium Priority Issues:**

- ⚠️ Running full test suite in pre-commit hook (too slow, encourages --no-verify)
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Hardcoded config values in each package instead of shared config
- ⚠️ No path aliases configured (deep relative imports break on refactor)

**Common Mistakes:**

- Forgetting to sync tsconfig paths with Vite resolve.alias (causes import resolution failures)
- Not ignoring build outputs in ESLint config (linting dist/ is slow and pointless)
- Using different Prettier configs per package (creates formatting inconsistency)
- Running lint-staged on all files instead of staged only (defeats the purpose)
- Committing .env files (exposes secrets)

**Gotchas & Edge Cases:**

- ESLint 9 flat config uses different plugin syntax than legacy .eslintrc
- only-warn plugin must be loaded AFTER other plugins to convert their errors
- TypeScript path aliases must be configured in BOTH tsconfig and build tool (Vite/Next)
- Husky hooks don't run on `git commit --no-verify` (emergency escape hatch)
- lint-staged uses glob patterns that differ slightly from .gitignore syntax
- Prettier and ESLint can conflict - must use eslint-config-prettier to disable conflicting rules
- Biome is not a drop-in replacement for ESLint - some plugins don't exist yet

---

## Anti-Patterns to Avoid

### Legacy .eslintrc Format

```javascript
// ❌ ANTI-PATTERN: Legacy .eslintrc.json
{
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["@typescript-eslint"],
  "rules": {}
}
```

**Why it's wrong:** Legacy .eslintrc format is being phased out in ESLint 9+, harder to compose and extend.

**What to do instead:** Use ESLint 9 flat config with `export default [...]` array syntax.

---

### Missing only-warn Plugin

```javascript
// ❌ ANTI-PATTERN: Errors block developers
export default [
  js.configs.recommended,
  // Missing only-warn plugin
  // ESLint errors block development
];
```

**Why it's wrong:** Error severity blocks developers during active development, reducing productivity.

**What to do instead:** Include eslint-plugin-only-warn to convert errors to warnings.

---

### Disabled TypeScript Strict Mode

```json
// ❌ ANTI-PATTERN: Loose TypeScript config
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}
```

**Why it's wrong:** Allows implicit any types leading to runtime errors, no null checks cause crashes.

**What to do instead:** Enable TypeScript strict mode in ALL tsconfig.json files.

---

### Duplicated Configs Per Package

```
// ❌ ANTI-PATTERN: Different configs per package
apps/client-react/.prettierrc → printWidth: 80
apps/client-next/.prettierrc → printWidth: 120
packages/ui/.eslintrc → different rules
```

**Why it's wrong:** Inconsistent formatting across monorepo, code reviews show formatting noise.

**What to do instead:** Use shared config packages (@repo/eslint-config, @repo/prettier-config).
