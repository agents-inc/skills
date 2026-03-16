---
name: shared-tooling-eslint-prettier
description: ESLint 9 flat config with defineConfig(), Prettier v3.0+ shared config, eslint-config-prettier integration, typescript-eslint v8+ projectService
---

# ESLint & Prettier

> **Quick Guide:** ESLint 9 flat config with `defineConfig()` and `globalIgnores()`. typescript-eslint v8+ with `projectService: true`. Prettier shared config with consistent formatting. eslint-config-prettier to disable conflicting rules. eslint-plugin-only-warn for better DX.
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

- Setting up ESLint 9 flat config (standalone or shared)
- Configuring Prettier with shared config
- Migrating from legacy .eslintrc to flat config
- Integrating ESLint and Prettier (eslint-config-prettier)
- Configuring typescript-eslint v8+ with projectService
- Setting up custom ESLint rules (named exports, import restrictions, type imports)

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipelines (see CI/CD skill instead)
- Git hooks / lint-staged setup (see `shared-tooling-git-hooks`)
- TypeScript compiler configuration (see `shared-tooling-typescript-config`)
- Vite / bundler configuration (see `shared-tooling-vite-config`)

**Key patterns covered:**

- ESLint 9 flat config with `defineConfig()`, `globalIgnores()`, and `extends` property
- typescript-eslint v8+ with `projectService: true` (replaces manual project config)
- Prettier v3.0+ shared config pattern with TypeScript config file support
- eslint-config-prettier integration to prevent rule conflicts
- eslint-plugin-only-warn for non-blocking DX during development
- Custom rules: named exports, import restrictions, consistent type imports
- ESLint 10 migration guide (released February 2026)

**Detailed Resources:**

- For ESLint code examples, see [examples/eslint.md](examples/eslint.md)
- For Prettier code examples, see [examples/prettier.md](examples/prettier.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Related skills:**

- For TypeScript compiler configuration, see `shared-tooling-typescript-config`
- For git hooks and lint-staged, see `shared-tooling-git-hooks`
- For daily coding conventions (naming, imports, constants), see CLAUDE.md

---

<philosophy>

## Philosophy

Linting and formatting should be **fast, consistent, and non-blocking**. Developers should not fight with tools - tools should help catch issues early while staying out of the way during development.

**Core principles:**

1. **Warnings, not errors** - Use only-warn to convert lint errors to warnings so developers can iterate without being blocked
2. **Single source of truth** - Shared configs prevent drift between packages and team members
3. **Automate formatting** - Prettier handles all formatting decisions; ESLint handles code quality only
4. **No conflicts** - eslint-config-prettier ensures ESLint and Prettier never disagree

**When to use this skill:**

- Setting up linting for new apps or packages
- Configuring formatting with Prettier
- Creating shared ESLint/Prettier configurations
- Migrating from legacy .eslintrc to flat config
- Upgrading to ESLint 10

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipelines (see separate CI/CD skill)
- Server-side build processes
- Git hooks setup (see `shared-tooling-git-hooks`)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: ESLint 9 Flat Config with defineConfig()

ESLint 9 uses flat config format (replaces legacy `.eslintrc`). The `defineConfig()` helper from `eslint/config` provides type safety and automatic array flattening.

**Key Requirements (ESLint 9.15+):**

- Use `defineConfig()` from `eslint/config` for type-safe configuration
- Use `globalIgnores()` for explicit global ignore patterns
- Support for `eslint.config.ts` TypeScript config files
- Use `extends` property in config objects for plugin composition
- Include `eslint-plugin-only-warn` to convert errors to warnings
- Use `eslint-config-prettier` to disable conflicting formatting rules

#### Standalone Project Config

```typescript
// eslint.config.ts
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export default defineConfig(
  // Global ignores using the helper function
  globalIgnores(["dist/**", "generated/**", "node_modules/**"]),

  js.configs.recommended,
  eslintConfigPrettier,

  // typescript-eslint recommended rules
  tseslint.configs.recommended,

  // Convert all errors to warnings for better DX (must be last)
  {
    plugins: {
      "only-warn": onlyWarnPlugin,
    },
  },
);
```

**Why good:** `defineConfig()` provides type safety and auto-flattens nested arrays, `globalIgnores()` explicitly marks global ignores (clearer intent than bare `ignores`), only-warn plugin loaded last converts all preceding errors to warnings, eslint-config-prettier disables formatting rules that conflict with Prettier

```javascript
// BAD: Legacy .eslintrc format (BROKEN in ESLint 10)
// .eslintrc.json (DON'T USE THIS)
{
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-unused-vars": "error"
  },
  "ignorePatterns": ["dist/"]
}
```

**Why bad:** Legacy .eslintrc is deprecated in ESLint 9 and completely removed in ESLint 10 (February 2026), error severity blocks developers during development, no only-warn plugin means disruptive error messages, harder to compose and extend configs

---

### Pattern 2: typescript-eslint v8+ with projectService

The `projectService` feature (stable since typescript-eslint v8) provides easier typed linting by auto-discovering the nearest tsconfig.json for each file.

```typescript
// eslint.config.ts
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(tseslint.configs.recommended, {
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      // projectService replaces the old project/parserOptions pattern
      projectService: true,
      // Allows linting files not in tsconfig (like config files)
      allowDefaultProject: ["*.config.ts", "*.config.mjs"],
    },
  },
});
```

**Why good:** `projectService` auto-discovers nearest tsconfig.json for each file, `allowDefaultProject` lints config files without adding them to tsconfig, faster than manual project configuration, eliminates need for tsconfig.eslint.json files

```javascript
// BAD: Deprecated tseslint.config() wrapper
import tseslint from "typescript-eslint";

// tseslint.config() is deprecated - use defineConfig() instead
export default tseslint.config(tseslint.configs.recommended);
```

**Why bad:** `tseslint.config()` is deprecated in favor of ESLint's native `defineConfig()`, mixing wrapper functions creates confusion about which API to use

```javascript
// BAD: Manual project option (old approach)
parserOptions: {
  project: "./tsconfig.json", // Fragile path, no auto-discovery
}
```

**Why bad:** Manual `project` path is fragile in monorepos, requires tsconfig.eslint.json for config files, slower than projectService, no support for TypeScript project references

---

### Pattern 3: Using extends Property (ESLint 9.15+)

The `extends` property in flat config objects simplifies plugin composition:

```typescript
// eslint.config.ts
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";

export default defineConfig({
  files: ["**/*.tsx"],
  extends: [
    // String references for standard configs
    "eslint/recommended",
    // Plugin configs (various formats supported)
    tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,
  ],
  rules: {
    // Override specific rules
    "react/prop-types": "off",
  },
});
```

**Why good:** Standardizes config merging regardless of plugin format (object, array, or string), cleaner than spreading arrays manually, conditionally applies configs based on file patterns

---

### Pattern 4: Shared ESLint Config Pattern

For teams or monorepos, shared configs ensure consistency across all packages.

#### Shared Config Package

```typescript
// packages/eslint-config/base.ts
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export const baseConfig = defineConfig(
  globalIgnores(["dist/**", "generated/**", ".next/**", "node_modules/**"]),

  js.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,

  // Convert all errors to warnings for better DX
  {
    plugins: {
      "only-warn": onlyWarnPlugin,
    },
  },
);
```

#### Using Shared Config in Apps

```typescript
// apps/my-app/eslint.config.ts
import { defineConfig } from "eslint/config";
import { baseConfig } from "@repo/eslint-config";
import { customRules } from "@repo/eslint-config/custom-rules";

export default defineConfig(baseConfig, customRules, {
  // App-specific overrides
  rules: {
    "no-console": "warn",
  },
});
```

**Why good:** No spread operators needed with `defineConfig()` (auto-flattens), TypeScript config file for type checking, clean composition of shared configs, single source of truth prevents config drift

```javascript
// BAD: Manual spreading (old pattern)
export default [
  ...baseConfig,
  customRules,
  { rules: { "no-console": "warn" } },
];
```

**Why bad:** Spread operator required for array configs, no type safety, easy to make mistakes with array composition

---

### Pattern 5: Custom ESLint Rules

Common custom rules for enforcing project conventions:

```javascript
// packages/eslint-config/custom-rules.js (or custom-rules.ts)
export const customRules = {
  rules: {
    // Enforce named exports for better tree-shaking
    "import/no-default-export": "warn",

    // Prevent importing from internal package paths
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@repo/*/src/**"],
            message: "Import from package exports, not internal paths",
          },
        ],
      },
    ],

    // Enforce import type for type-only imports
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixable: "code",
      },
    ],

    // Catch unused variables with underscore escape hatch
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
  },
};
```

**Why good:** Named exports enable better tree-shaking, preventing internal imports maintains package API boundaries, consistent type imports improve build performance, unused variable warnings catch dead code early with underscore escape hatch

```javascript
// BAD: No custom rules
export const config = [
  js.configs.recommended,
  // Missing project-specific rules
];
```

**Why bad:** No enforcement of named exports allows default exports reducing tree-shaking effectiveness, no internal import restrictions breaks package encapsulation, no type import consistency slows builds

---

### Pattern 6: Prettier Configuration (v3.0+)

Prettier configuration should be consistent across all packages. Use a shared config for teams.

#### Standard Prettier Config

```javascript
// prettier.config.mjs (standalone project)
// OR packages/prettier-config/prettier.config.mjs (shared config)
const config = {
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  // trailingComma: "all" is the default in Prettier 3.0+
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  // bracketSameLine replaces deprecated jsxBracketSameLine (Prettier 2.4+)
  bracketSameLine: false,
};

export default config;
```

**Why good:** Single source of truth prevents formatting inconsistencies, 100 char line width balances readability with screen space, double quotes match JSON format reducing escaping in JSX, trailing commas create cleaner git diffs, explicit `endOfLine: "lf"` prevents cross-platform line ending issues

#### Shared Config Usage

```json
// apps/my-app/package.json
{
  "name": "my-app",
  "prettier": "@repo/prettier-config",
  "devDependencies": {
    "@repo/prettier-config": "*"
  }
}
```

```json
// BAD: Duplicated config in each package
// apps/client-react/.prettierrc
{
  "printWidth": 80,
  "semi": true,
  "singleQuote": true
}

// apps/client-next/.prettierrc
{
  "printWidth": 120,
  "semi": false,
  "singleQuote": true
}
```

**Why bad:** Different configs per package creates inconsistent formatting, manually syncing changes is error-prone, developers switching between packages see formatting churn, code reviews show formatting noise instead of logic changes

---

### Pattern 7: Prettier TypeScript Config (v3.5+)

Prettier 3.5+ supports TypeScript configuration files for type-safe config.

```typescript
// packages/prettier-config/prettier.config.ts
import type { Config } from "prettier";

const config: Config = {
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  bracketSameLine: false,
};

export default config;
```

**Requirements:**

- Node.js 22.6.0 or later
- Before Node.js v24.3.0, run with: `NODE_OPTIONS="--experimental-strip-types" prettier . --write`

**Supported file names:**

- `.prettierrc.ts`, `.prettierrc.mts`, `.prettierrc.cts`
- `prettier.config.ts`, `prettier.config.mts`, `prettier.config.cts`

**When to use:** When you want type-checked Prettier config and your project already runs Node.js 22.6.0+

**When not to use:** If running Node.js < 22.6.0, or if the overhead of TypeScript config is not justified for a simple settings file

---

### Pattern 8: Prettier Experimental Options (v3.1+)

Prettier provides experimental options for specific formatting behaviors. These may be removed or changed in future versions.

```javascript
// prettier.config.mjs - with experimental options
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,

  // Experimental: ternary formatting (v3.1+)
  // Changes how ternary expressions are formatted across lines
  experimentalTernaries: true,

  // Experimental: object wrapping (v3.5+)
  // "preserve" (default): keeps multi-line objects as-is
  // "collapse": collapses objects that fit on one line
  objectWrap: "preserve",

  // Experimental: operator position (v3.5+)
  // "end" (default): operators at end of line
  // "start": operators at start of new lines
  experimentalOperatorPosition: "end",
};

export default config;
```

**Why experimental options exist:** These address long-standing formatting debates where no single solution fits all preferences. They follow Prettier's experimental option policy and may be removed or changed.

</patterns>

---

<decision_framework>

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

**Current recommendation:** ESLint 9/10 + Prettier (mature, stable, extensive plugin ecosystem)

**Future consideration:** Biome when plugin ecosystem matures

### Prettier vs Biome Formatting

```
Need code formatting?
├─ Already using ESLint?
│   └─ YES → Prettier (integrates well via eslint-config-prettier)
├─ Want fastest possible formatting?
│   └─ YES → Biome (20x faster)
└─ Need extensive language support?
    └─ YES → Prettier (supports more languages)
```

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

### Shared Config vs Local Config

```
Setting up linting/formatting?
├─ Monorepo with multiple packages?
│   └─ YES → Shared config (@repo/eslint-config, @repo/prettier-config) ✓
├─ Team project (2+ developers)?
│   └─ YES → Shared config (consistency matters)
└─ Single package / solo project?
    └─ YES → Local config is fine
```

**Shared configs prevent drift and ensure consistency.**

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

See [reference.md](reference.md) for additional decision frameworks and anti-patterns.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Using legacy .eslintrc format instead of ESLint 9+ flat config (**BROKEN in ESLint 10, released February 2026**)
- ❌ Using `tseslint.config()` instead of ESLint's native `defineConfig()` (deprecated)
- ❌ Using bare `ignores` property instead of `globalIgnores()` helper (ambiguous behavior)
- ❌ Missing eslint-plugin-only-warn (errors block developers during development)
- ❌ Missing eslint-config-prettier (ESLint and Prettier rules conflict)
- ❌ Not using shared configs when working with a team (configs drift causing inconsistency)

**Medium Priority Issues:**

- ⚠️ Using manual `project` option instead of `projectService: true` in typescript-eslint
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Hardcoded config values in each package instead of shared config
- ⚠️ Using deprecated `jsxBracketSameLine` option in Prettier (use `bracketSameLine` instead)
- ⚠️ Explicitly setting `trailingComma: "all"` in Prettier 3.0+ (it is the default)

**Gotchas & Edge Cases:**

- ESLint 9 flat config uses different plugin syntax than legacy .eslintrc
- only-warn plugin must be loaded AFTER other plugins to convert their errors
- Prettier and ESLint can conflict - must use eslint-config-prettier to disable conflicting rules
- `defineConfig()` auto-flattens arrays - no spread operators needed
- `projectService` requires typescript-eslint v8+ (was experimental in v6-v7 as `EXPERIMENTAL_useProjectService`)
- ESLint 10 requires Node.js 20.19.0+ (upgrade Node before upgrading ESLint)
- ESLint 10 config lookup starts from linted file directory (not cwd) - enables monorepo multi-config
- Prettier TypeScript config files (`.prettierrc.ts`) require Node.js 22.6.0+ and `--experimental-strip-types` flag before Node v24.3.0
- Prettier 3.0+ APIs are async - plugins using sync APIs need migration (use `@prettier/sync` for sync wrappers)
- **ESLint 9.15+**: `eslint.config.ts` TypeScript config files supported natively
- **ESLint 9.15+**: `extends` property reintroduced for plugin composition
- **ESLint 9.34+**: Multithreaded linting available (30-300% performance boost on large projects)
- **ESLint 10**: `/* eslint-env */` comments now trigger errors
- **ESLint 10**: Deprecated `Linter` methods (`defineParser()`, `defineRule()`, `getRules()`) removed
- **typescript-eslint v8**: `tseslint.config()` deprecated in favor of ESLint's `defineConfig()`

See [reference.md](reference.md) for full anti-patterns documentation.

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
