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

### Prettier Config File Format

```
What Prettier config format to use?
├─ Need type checking in config?
│   ├─ Node.js 22.6.0+?
│   │   └─ YES → .prettierrc.ts or prettier.config.ts
│   └─ NO → Use .mjs with JSDoc types
├─ ESM project ("type": "module")?
│   └─ YES → prettier.config.mjs
└─ CommonJS project?
    └─ YES → prettier.config.cjs
```

**File precedence (highest to lowest):**
1. `"prettier"` key in `package.json`
2. `.prettierrc` (JSON/YAML)
3. `.prettierrc.json`, `.prettierrc.yaml`
4. `.prettierrc.js`, `prettier.config.js`
5. `.prettierrc.mjs`, `prettier.config.mjs`
6. `.prettierrc.cjs`, `prettier.config.cjs`
7. `.prettierrc.ts`, `prettier.config.ts` (v3.5+)
8. `.prettierrc.toml`

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

### Vite vs Rolldown-Vite

```
Choosing bundler for Vite project?
├─ Production stability required?
│   └─ YES → Standard Vite (Rollup-based) ✓
├─ Build performance is critical bottleneck?
│   ├─ Build time > 30 seconds?
│   │   └─ YES → Consider rolldown-vite (16x faster)
│   └─ NO → Standard Vite is fine
└─ Framework author / early adopter?
    └─ YES → Test rolldown-vite for future readiness
```

**Current recommendation:** Standard Vite for stability; rolldown-vite for large projects needing build speed.

---

### Vite Build Target Selection

```
Choosing build.target?
├─ Supporting legacy browsers (< Safari 16)?
│   └─ YES → Use @vitejs/plugin-legacy
├─ Modern browsers only?
│   ├─ Need smallest possible bundle?
│   │   └─ YES → 'esnext'
│   └─ NO → 'baseline-widely-available' (Vite 7 default) ✓
└─ Specific browser requirements?
    └─ YES → Use explicit array: ['chrome107', 'safari16']
```

---

## RED FLAGS

**High Priority Issues:**

- ❌ Using legacy .eslintrc format instead of ESLint 9 flat config (**WILL BREAK in ESLint 10, January 2026**)
- ❌ Using `tseslint.config()` instead of ESLint's native `defineConfig()` (deprecated)
- ❌ Using bare `ignores` property instead of `globalIgnores()` helper (ambiguous behavior)
- ❌ Missing eslint-plugin-only-warn (errors block developers during development)
- ❌ Disabling TypeScript strict mode (allows implicit any and null bugs)
- ❌ Not using shared configs in monorepo (configs drift causing inconsistency)

**Medium Priority Issues:**

- ⚠️ Running full test suite in pre-commit hook (too slow, encourages --no-verify)
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Hardcoded config values in each package instead of shared config
- ⚠️ No path aliases configured (deep relative imports break on refactor)
- ⚠️ Using manual `project` option instead of `projectService: true` in typescript-eslint

**Common Mistakes:**

- Forgetting to sync tsconfig paths with Vite resolve.alias (causes import resolution failures)
- Not ignoring build outputs in ESLint config (linting dist/ is slow and pointless)
- Using different Prettier configs per package (creates formatting inconsistency)
- Running lint-staged on all files instead of staged only (defeats the purpose)
- Committing .env files (exposes secrets)
- Using deprecated `jsxBracketSameLine` option (use `bracketSameLine` instead, Prettier 2.4+)
- Explicitly setting `trailingComma: "all"` when it's already the default (Prettier 3.0+)
- Using spread operators with `defineConfig()` (unnecessary - auto-flattens arrays)
- Using deprecated `build.polyfillModulePreload` (use `build.modulePreload.polyfill` instead, Vite 6+)
- Using deprecated `splitVendorChunkPlugin` (use `build.rollupOptions.output.manualChunks` directly)
- Using `target: 'modules'` (deprecated in Vite 7; use `'baseline-widely-available'`)
- Using Sass legacy API without migration plan (removed in Vite 7)

**Gotchas & Edge Cases:**

- ESLint 9 flat config uses different plugin syntax than legacy .eslintrc
- only-warn plugin must be loaded AFTER other plugins to convert their errors
- TypeScript path aliases must be configured in BOTH tsconfig and build tool (Vite/Next)
- Husky hooks don't run on `git commit --no-verify` (emergency escape hatch)
- lint-staged uses glob patterns that differ slightly from .gitignore syntax
- Prettier and ESLint can conflict - must use eslint-config-prettier to disable conflicting rules
- Biome is not a drop-in replacement for ESLint - some plugins don't exist yet
- Prettier TypeScript config files (`.prettierrc.ts`) require Node.js 22.6.0+ and `--experimental-strip-types` flag before Node v24.3.0
- Prettier 3.0+ APIs are async - plugins using sync APIs need migration (use `@prettier/sync` for sync wrappers)
- **ESLint 9.15+**: `defineConfig()` auto-flattens arrays - no spread operators needed
- **ESLint 9.15+**: `eslint.config.ts` TypeScript config files supported natively
- **ESLint 9.15+**: `extends` property reintroduced for plugin composition
- **ESLint 10 (Jan 2026)**: .eslintrc completely removed, Node.js 20.19.0+ required
- **typescript-eslint v8**: `projectService` replaces manual `project` option (was experimental in v6-v7)
- **typescript-eslint v8**: `tseslint.config()` deprecated in favor of ESLint's `defineConfig()`
- **Husky v9**: `husky install` is deprecated - use `"prepare": "husky"` instead
- **Husky v9**: Hook file names must be exact (`pre-commit`, not `precommit` or `pre-commit.sh`)
- **Husky v9**: Shebang lines (`#!/usr/bin/env sh`) are no longer required in hook files
- **Husky v9**: Use `$1`, `$2` for Git params instead of deprecated `HUSKY_GIT_PARAMS`
- **Husky v9**: Set `HUSKY=0` in CI/production to disable hooks (replaces `HUSKY_SKIP_HOOKS`)
- **Husky v9**: Debug mode is now `HUSKY=2` (replaces deprecated `HUSKY_DEBUG=1`)
- **Vite 6**: Environment API is experimental - don't use `environments` config in production apps yet
- **Vite 6**: `options.ssr` in plugin hooks will be deprecated - use `this.environment` instead
- **Vite 7**: Node.js 18 dropped - requires Node.js 20.19+ or 22.12+
- **Vite 7**: Sass legacy API completely removed - migrate to modern API before upgrading
- **Vite 7**: `splitVendorChunkPlugin` removed - migrate to `manualChunks` before upgrading
- **Rolldown**: `manualChunks` deprecated in rolldown-vite - use `advancedChunks.groups` instead
- **Rolldown**: Breaking changes may occur within patch versions (experimental package)

---

## Anti-Patterns to Avoid

### Legacy .eslintrc Format

```javascript
// ❌ ANTI-PATTERN: Legacy .eslintrc.json (WILL BREAK in ESLint 10)
{
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["@typescript-eslint"],
  "rules": {}
}
```

**Why it's wrong:** Legacy .eslintrc format is deprecated in ESLint 9 and **completely removed in ESLint 10** (January 2026).

**What to do instead:** Use ESLint 9 flat config with `defineConfig()`:

```typescript
// ✅ Modern flat config with defineConfig()
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/**", ".next/**"]),
  tseslint.configs.recommended
);
```

---

### Deprecated tseslint.config() Wrapper

```javascript
// ❌ ANTI-PATTERN: Using deprecated tseslint.config()
import tseslint from "typescript-eslint";

export default tseslint.config(
  tseslint.configs.recommended
);
```

**Why it's wrong:** `tseslint.config()` is deprecated in favor of ESLint's native `defineConfig()`.

**What to do instead:** Use ESLint's `defineConfig()` from `eslint/config`:

```typescript
// ✅ Use ESLint's native defineConfig
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(tseslint.configs.recommended);
```

---

### Bare ignores Property

```javascript
// ❌ ANTI-PATTERN: Ambiguous ignores behavior
export default [
  {
    ignores: ["dist/**", ".next/**"]  // Is this global or local?
  },
  // ...other config
];
```

**Why it's wrong:** The bare `ignores` property has ambiguous behavior - it acts as global ignores when alone, but as local excludes when paired with other properties.

**What to do instead:** Use `globalIgnores()` for clarity:

```typescript
// ✅ Explicit global ignores
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores(["dist/**", ".next/**"]),  // Clearly global
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"],  // Clearly local to this config object
    // ...rules
  }
);

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

### Deprecated TypeScript Options (TS 5.5+)

```json
// ❌ ANTI-PATTERN: Using deprecated TS options
{
  "compilerOptions": {
    "importsNotUsedAsValues": "error",
    "preserveValueImports": true,
    "target": "ES3"
  }
}
```

**Why it's wrong:** These options were deprecated in TypeScript 5.0 and no longer function in TS 5.5+.

**What to do instead:**
- Replace `importsNotUsedAsValues` + `preserveValueImports` with `verbatimModuleSyntax: true`
- Replace `target: "ES3"` with `target: "ES2022"` (modern stable target)
- Use `module: "preserve"` + `moduleResolution: "bundler"` for bundler projects

---

### Missing verbatimModuleSyntax

```typescript
// ❌ ANTI-PATTERN: Without verbatimModuleSyntax
import { User, createUser } from "./api"; // User is only a type!
// This may emit: import { createUser } from "./api";
// Or may emit both, depending on transpiler - unpredictable!
```

**Why it's wrong:** Type-only imports may or may not be elided depending on transpiler, causing inconsistent behavior.

**What to do instead:**
```typescript
// ✅ With verbatimModuleSyntax: true
import type { User } from "./api";
import { createUser } from "./api";
// Predictable: type import always elided, value import always preserved
```

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

---

### Deprecated Husky v8 Prepare Script

```json
// ❌ ANTI-PATTERN: Deprecated husky install command
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

**Why it's wrong:** `husky install` is deprecated in Husky v9 and will show a deprecation warning on every `npm install`.

**What to do instead:** Use just `"prepare": "husky"` for v9.

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
# .husky/pre-commit
bunx lint-staged

# .husky/commit-msg
bunx commitlint --edit $1
```

---

### Deprecated Vite Module Preload Option

```javascript
// ❌ ANTI-PATTERN: Deprecated polyfillModulePreload
export default defineConfig({
  build: {
    polyfillModulePreload: false, // DEPRECATED in Vite 6
  },
});
```

**Why it's wrong:** `build.polyfillModulePreload` is deprecated; use the new structured API.

**What to do instead:** Use `build.modulePreload.polyfill`:
```javascript
// ✅ Vite 6+ module preload configuration
export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        return deps.filter((dep) => !dep.includes("heavy-vendor"));
      },
    },
  },
});
```

---

### Deprecated splitVendorChunkPlugin

```javascript
// ❌ ANTI-PATTERN: Deprecated in Vite 7
import { splitVendorChunkPlugin } from "vite";

export default defineConfig({
  plugins: [splitVendorChunkPlugin()], // REMOVED in Vite 7
});
```

**Why it's wrong:** `splitVendorChunkPlugin` is deprecated and removed in Vite 7.

**What to do instead:** Use `manualChunks` directly:
```javascript
// ✅ Direct manualChunks configuration
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
});
```

---

### Deprecated build.target: 'modules'

```javascript
// ❌ ANTI-PATTERN: Deprecated target value
export default defineConfig({
  build: {
    target: "modules", // REMOVED in Vite 7
  },
});
```

**Why it's wrong:** The `'modules'` target value is deprecated and no longer available in Vite 7.

**What to do instead:** Use the new default or explicit browser targets:
```javascript
// ✅ Vite 7 compatible targets
export default defineConfig({
  build: {
    // Option 1: New default (Chrome 107+, Safari 16+)
    target: "baseline-widely-available",
    // Option 2: Explicit browser list
    target: ["chrome107", "edge107", "firefox104", "safari16"],
    // Option 3: Latest browsers only
    target: "esnext",
  },
});
```

---

### Sass Legacy API Without Migration Plan

```javascript
// ❌ ANTI-PATTERN: Legacy Sass API
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "legacy", // Works in Vite 6, REMOVED in Vite 7
      },
    },
  },
});
```

**Why it's wrong:** Sass legacy API is deprecated in Vite 6 and completely removed in Vite 7.

**What to do instead:** Migrate to modern Sass API (default in Vite 6):
```javascript
// ✅ Modern Sass API (default, no need to specify)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // api: 'modern', // This is the default - no need to specify
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Migration notes:**
- Replace `@import` with `@use` and `@forward`
- Use namespaced access for variables/mixins: `variables.$color-primary`
- Test thoroughly before removing `api: 'legacy'`
