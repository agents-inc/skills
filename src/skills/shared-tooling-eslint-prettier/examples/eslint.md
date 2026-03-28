# ESLint - Advanced Examples

> Shared configs, custom rules, and ESLint 10 migration. See [core.md](core.md) for essential flat config setup.

**Prerequisites**: Understand Pattern 1 (Standalone Flat Config) and Pattern 2 (projectService) from [core.md](core.md) first.

---

## Pattern 6: Shared Config Package

For teams or monorepos, extract linting config into a shared package:

```typescript
// packages/eslint-config/base.ts
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export const baseConfig = defineConfig(
  globalIgnores(["dist/**", "generated/**", "build/**"]),

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

**Why good:** Single source of truth prevents config drift, `defineConfig()` provides type safety, explicit `globalIgnores()` for clarity

---

## Pattern 7: Consuming Shared Config

```typescript
// apps/my-app/eslint.config.ts
import { defineConfig } from "eslint/config";
import { baseConfig } from "@company/eslint-config";
import { customRules } from "@company/eslint-config/custom-rules";

export default defineConfig(baseConfig, customRules, {
  // App-specific overrides
  rules: {
    "no-console": "warn",
  },
});
```

**Why good:** No spread operators needed with `defineConfig()` (auto-flattens), clean composition of shared configs

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

## Pattern 8: Custom ESLint Rules

Common custom rules for enforcing project conventions:

```javascript
// packages/eslint-config/custom-rules.js
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
            group: ["@company/*/src/**"],
            message: "Import from package exports, not internal paths",
          },
        ],
      },
    ],

    // Enforce import type for type-only imports
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports" },
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

---

## ESLint 10 Migration

ESLint 10 was released February 6, 2026 and completely removes .eslintrc support. Before upgrading:

1. **Remove .eslintrc files** - Replace with `eslint.config.ts`
2. **Remove .eslintignore** - Use `globalIgnores()` in config
3. **Update CLI scripts** - Remove `--no-eslintrc`, `--env`, `--rulesdir` flags
4. **Remove `/* eslint-env */` comments** - These now trigger errors in ESLint 10
5. **Update Node.js** - ESLint 10 requires `^20.19.0 || ^22.13.0 || >=24`

**Key ESLint 10 changes:**

- Config lookup starts from linted file directory (not cwd) - better monorepo support
- JSX reference tracking improved - fewer false positives with `no-unused-vars`
- Updated `eslint:recommended` with new rules
- Deprecated `Linter` methods removed (`defineParser()`, `defineRule()`, `getRules()`)
- Built-in TypeScript definitions (no more `@types/eslint` needed)

**ESLint 10 compatible config:**

```typescript
// eslint.config.ts - works with both ESLint 9.15+ and ESLint 10
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export default defineConfig(
  globalIgnores(["dist/**", "node_modules/**"]),
  js.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,
  {
    plugins: {
      "only-warn": onlyWarnPlugin,
    },
  },
);
```

**Why good:** This config works with both ESLint 9.15+ and ESLint 10 with zero changes — `defineConfig()` and `globalIgnores()` are the forward-compatible API
