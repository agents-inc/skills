---
name: shared-tooling-eslint-prettier
description: ESLint 9/10 flat config with defineConfig(), Prettier v3.0+ shared config, eslint-config-prettier integration, typescript-eslint v8+ projectService
---

# ESLint & Prettier

> **Quick Guide:** ESLint 9+ flat config with `defineConfig()` and `globalIgnores()`. typescript-eslint v8+ with `projectService: true`. Prettier shared config with consistent formatting. eslint-config-prettier to disable conflicting rules. eslint-plugin-only-warn for better DX.
>
> **WARNING**: ESLint 10 was released February 2026 and completely removes .eslintrc support. Migrate to flat config now.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use ESLint 9+ flat config with `defineConfig()` from `eslint/config` - NOT legacy .eslintrc)**

**(You MUST use `globalIgnores()` for explicit global ignore patterns - NOT bare `ignores` property)**

**(You MUST use typescript-eslint v8+ with `projectService: true` for typed linting)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use eslint-config-prettier to disable formatting rules that conflict with Prettier)**

</critical_requirements>

---

**Auto-detection:** ESLint 9 flat config, defineConfig, globalIgnores, eslint.config.ts, Prettier config, prettier.config.mjs, eslint-config-prettier, eslint-plugin-only-warn, typescript-eslint projectService, .eslintrc migration

**When to use:**

- Setting up ESLint 9/10 flat config (standalone or shared)
- Configuring Prettier with shared config
- Migrating from legacy .eslintrc to flat config
- Integrating ESLint and Prettier (eslint-config-prettier)
- Configuring typescript-eslint v8+ with projectService
- Setting up custom ESLint rules (named exports, import restrictions, type imports)

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipeline configuration
- Git hooks or lint-staged setup
- TypeScript compiler configuration (tsconfig)
- Bundler configuration

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Essential flat config + Prettier setup
- [examples/eslint.md](examples/eslint.md) - Advanced ESLint patterns (shared configs, custom rules, ESLint 10 migration)
- [examples/prettier.md](examples/prettier.md) - Advanced Prettier patterns (TS config, experimental options, ignore files)
- [reference.md](reference.md) - Version reference and official documentation links

---

<philosophy>

## Philosophy

Linting and formatting should be **fast, consistent, and non-blocking**. Developers should not fight with tools - tools should help catch issues early while staying out of the way during development.

**Core principles:**

1. **Warnings, not errors** - Use only-warn to convert lint errors to warnings so developers can iterate without being blocked
2. **Single source of truth** - Shared configs prevent drift between packages and team members
3. **Automate formatting** - Prettier handles all formatting decisions; ESLint handles code quality only
4. **No conflicts** - eslint-config-prettier ensures ESLint and Prettier never disagree

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: ESLint 9+ Flat Config with defineConfig()

ESLint 9+ uses flat config. The `defineConfig()` helper from `eslint/config` provides type safety and automatic array flattening. `globalIgnores()` explicitly marks global ignore patterns.

```typescript
// eslint.config.ts — the essential flat config
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export default defineConfig(
  globalIgnores(["dist/**", "generated/**", "node_modules/**"]),
  js.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,
  { plugins: { "only-warn": onlyWarnPlugin } }, // must be last
);
```

**Key points:** `defineConfig()` auto-flattens arrays (no spread operators needed), `globalIgnores()` prevents ambiguous behavior of bare `ignores`, only-warn converts all preceding errors to warnings, eslint-config-prettier disables formatting rules that conflict with Prettier.

See [examples/core.md](examples/core.md) for the complete standalone and shared config patterns.

---

### Pattern 2: typescript-eslint v8+ with projectService

The `projectService` feature (stable since v8) auto-discovers the nearest tsconfig.json for each file, replacing the fragile manual `project` path.

```typescript
parserOptions: {
  projectService: true,
  allowDefaultProject: ["*.config.ts", "*.config.mjs"],
},
```

**Key points:** Eliminates need for tsconfig.eslint.json files, faster than manual project configuration, `allowDefaultProject` handles config files not in tsconfig.

See [examples/core.md](examples/core.md) for full typescript-eslint configuration.

---

### Pattern 3: Shared Config Pattern (Monorepos/Teams)

For teams or monorepos, extract linting config into a shared package to prevent drift.

```typescript
// packages/eslint-config/base.ts — shared config
export const baseConfig = defineConfig(
  globalIgnores(["dist/**", "generated/**"]),
  js.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,
  { plugins: { "only-warn": onlyWarnPlugin } },
);

// apps/my-app/eslint.config.ts — consuming shared config
export default defineConfig(baseConfig, customRules, {
  rules: { "no-console": "warn" },
});
```

**Key points:** `defineConfig()` auto-flattens so no spread operators needed, single source of truth prevents config drift, TypeScript config file for type checking.

See [examples/eslint.md](examples/eslint.md) for shared config and custom rules patterns.

---

### Pattern 4: Prettier Shared Config

Prettier config should be consistent across all packages. Use a shared config for teams.

```javascript
// prettier.config.mjs
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  bracketSameLine: false,
  // trailingComma: "all" is the default in Prettier 3.0+
};
export default config;
```

**Key points:** `trailingComma: "all"` is the default in v3.0+ (don't set it explicitly), `bracketSameLine` replaces deprecated `jsxBracketSameLine`, explicit `endOfLine: "lf"` prevents cross-platform issues.

See [examples/prettier.md](examples/prettier.md) for TypeScript config files, experimental options, and ignore patterns.

---

### Pattern 5: Custom ESLint Rules

Common custom rules for enforcing project conventions — named exports, consistent type imports, unused variable detection, and import boundary enforcement:

```javascript
export const customRules = {
  rules: {
    "import/no-default-export": "warn",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports" },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};
```

See [examples/eslint.md](examples/eslint.md) for the full custom rules pattern including import boundary restrictions.

---

### Pattern 6: Using extends Property (ESLint 9.15+)

The `extends` property in flat config objects simplifies plugin composition — standardizes config merging regardless of plugin format (object, array, or string):

```typescript
export default defineConfig({
  files: ["**/*.tsx"],
  extends: [
    "eslint/recommended",
    tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,
  ],
  rules: { "react/prop-types": "off" },
});
```

See [examples/core.md](examples/core.md) for the full extends pattern.

</patterns>

---

<decision_framework>

## Decision Framework

### ESLint vs Biome

```
Need linting and formatting?
├─ Speed is critical bottleneck (1000+ files)?
│   └─ YES → Consider Biome (20x faster)
└─ Need mature plugin ecosystem?
    └─ YES → ESLint 9/10 + Prettier ✓
```

**Current recommendation:** ESLint 9/10 + Prettier (mature, extensive plugin ecosystem)

### ESLint 9 vs ESLint 10

```
Which ESLint version?
├─ New project?
│   └─ ESLint 10 (latest, cleanest API)
├─ Existing project with flat config?
│   └─ ESLint 10 (straightforward upgrade)
├─ Existing project with .eslintrc?
│   ├─ Can invest time to migrate?
│   │   └─ YES → Migrate to flat config, then ESLint 10
│   └─ NO → ESLint 9.x (still supported, but plan migration)
└─ Node.js < 20.19.0?
    └─ ESLint 9.x (ESLint 10 requires 20.19.0+)
```

### Shared Config vs Local Config

```
Setting up linting/formatting?
├─ Monorepo with multiple packages?
│   └─ YES → Shared config ✓
├─ Team project (2+ developers)?
│   └─ YES → Shared config (consistency matters)
└─ Single package / solo project?
    └─ YES → Local config is fine
```

### Prettier Config File Format

```
What Prettier config format to use?
├─ Need type checking in config?
│   ├─ Node.js 22.6.0+? → prettier.config.ts
│   └─ NO → Use .mjs with JSDoc types
├─ ESM project? → prettier.config.mjs
└─ CommonJS project? → prettier.config.cjs
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Using legacy .eslintrc format instead of ESLint 9+ flat config (**BROKEN in ESLint 10**)
- ❌ Using bare `ignores` property instead of `globalIgnores()` helper (ambiguous behavior — acts as global ignores when alone, but as local excludes when paired with other properties)
- ❌ Missing eslint-plugin-only-warn (errors block developers during development)
- ❌ Missing eslint-config-prettier (ESLint and Prettier rules conflict, creating endless fix cycles)

**Medium Priority Issues:**

- ⚠️ Using manual `project` option instead of `projectService: true` in typescript-eslint (fragile in monorepos, slower)
- ⚠️ Using deprecated `jsxBracketSameLine` option in Prettier (renamed to `bracketSameLine` in Prettier 2.4)
- ⚠️ Explicitly setting `trailingComma: "all"` in Prettier 3.0+ (it is already the default)
- ⚠️ Using `tseslint.config()` wrapper (planned for deprecation in favor of ESLint's native `defineConfig()`)
- ⚠️ Hardcoded config values in each package instead of shared config

**Gotchas & Edge Cases:**

- only-warn plugin must be loaded AFTER other plugins to convert their errors to warnings
- `defineConfig()` auto-flattens arrays — never use spread operators with it
- `projectService` requires typescript-eslint v8+ (was `EXPERIMENTAL_useProjectService` in v6-v7)
- ESLint 10 requires Node.js `^20.19.0 || ^22.13.0 || >=24` (v21.x and v23.x explicitly unsupported)
- ESLint 10 config lookup starts from linted file directory (not cwd) — enables monorepo multi-config
- Prettier TypeScript config files (`.prettierrc.ts`) require Node.js 22.6.0+; before Node v24.3.0 run with `--experimental-strip-types`
- Prettier 3.0+ APIs are async — plugins using sync APIs need migration (use `@prettier/sync` for sync wrappers)
- **ESLint 9.15+**: `eslint.config.ts` TypeScript config files and `extends` property supported natively
- **ESLint 9.34+**: Multithreaded linting available via `--concurrency` flag (30-300% performance boost on large projects)
- **ESLint 10**: `/* eslint-env */` comments now trigger errors; deprecated `Linter` methods removed

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use ESLint 9+ flat config with `defineConfig()` from `eslint/config` - NOT legacy .eslintrc)**

**(You MUST use `globalIgnores()` for explicit global ignore patterns - NOT bare `ignores` property)**

**(You MUST use typescript-eslint v8+ with `projectService: true` for typed linting)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use eslint-config-prettier to disable formatting rules that conflict with Prettier)**

**Failure to follow these rules will cause inconsistent tooling, conflicting formatting rules, and blocked developers.**

**WARNING: ESLint 10 (February 2026) completely removes .eslintrc support. Plan migration now.**

</critical_reminders>
