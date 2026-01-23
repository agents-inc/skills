# Tooling - ESLint 9 Configuration

> ESLint 9 flat config patterns with shared configurations and only-warn plugin for better developer experience. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

> **WARNING**: ESLint 10 (January 2026) completely removes .eslintrc support. Migrate to flat config now.

---

## Modern Flat Config with defineConfig()

ESLint 9.15+ introduced `defineConfig()` for type-safe configuration with automatic flattening.

```typescript
// packages/eslint-config/base.ts (TypeScript config supported since ESLint 9)
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export const baseConfig = defineConfig(
  // Global ignores using the new helper function
  globalIgnores(["dist/**", "generated/**", ".next/**", "node_modules/**"]),

  js.configs.recommended,
  eslintConfigPrettier,

  // typescript-eslint configs (use defineConfig, not tseslint.config)
  tseslint.configs.recommended,

  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // Convert all errors to warnings for better DX (must be last)
  {
    plugins: {
      "only-warn": onlyWarnPlugin,
    },
  },
);
```

**Why good:** `defineConfig()` provides type safety and auto-flattens nested arrays, `globalIgnores()` explicitly marks global ignores (clearer intent than bare `ignores`), TypeScript config files supported natively, only-warn plugin loaded last converts all preceding errors to warnings

```javascript
// BAD: Legacy .eslintrc format (WILL BREAK in ESLint 10)
// .eslintrc.json (DON'T USE THIS)
{
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-unused-vars": "error" // Blocks developers
  },
  "ignorePatterns": ["dist/"]
}
```

**Why bad:** Legacy .eslintrc is deprecated in ESLint 9 and **completely removed in ESLint 10** (January 2026), error severity blocks developers during development reducing productivity, no only-warn plugin means disruptive error messages, harder to compose and extend configs

---

## Using extends Property (ESLint 9.15+)

The new `extends` property in flat config objects simplifies plugin composition:

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

## typescript-eslint v8+ with projectService

The `projectService` feature (stable since typescript-eslint v8) provides easier typed linting:

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

**Why good:** `projectService` auto-discovers nearest tsconfig.json for each file, `allowDefaultProject` lints config files without adding them to tsconfig, faster than manual project configuration, cleaner than EXPERIMENTAL_useProjectService

```javascript
// BAD: Deprecated tseslint.config() wrapper
import tseslint from "typescript-eslint";

// tseslint.config() is deprecated - use defineConfig() instead
export default tseslint.config(tseslint.configs.recommended);
```

**Why bad:** `tseslint.config()` is deprecated in favor of ESLint's native `defineConfig()`, mixing wrapper functions creates confusion

---

## Shared Config Pattern (Updated)

```typescript
// packages/eslint-config/base.ts
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export const baseConfig = defineConfig(
  globalIgnores(["dist/**", "generated/**", ".next/**"]),

  js.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,

  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // Convert all errors to warnings for better DX
  {
    plugins: {
      "only-warn": onlyWarnPlugin,
    },
  },
);
```

**Why good:** Uses modern `defineConfig()` for type safety, explicit `globalIgnores()` for clarity, TypeScript config file support, only-warn plugin loaded last to convert all errors

---

## Custom ESLint Rules for Monorepo

```javascript
// packages/eslint-config/custom-rules.js
export const customRules = {
  rules: {
    "import/no-default-export": "warn",
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
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixable: "code",
      },
    ],
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

**Why good:** Named exports enable better tree-shaking reducing bundle size, preventing internal imports maintains package API boundaries, consistent type imports improve build performance, unused variable warnings catch dead code early

```javascript
// BAD: No custom rules
export const config = [
  js.configs.recommended,
  // Missing project-specific rules
];
```

**Why bad:** No enforcement of named exports allows default exports reducing tree-shaking effectiveness, no internal import restrictions breaks package encapsulation, no type import consistency slows builds, unused variables clutter codebase

---

## Using Shared Config in Apps

```typescript
// apps/client-react/eslint.config.ts
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

**Why good:** No spread operators needed with `defineConfig()` (auto-flattens), TypeScript config file for type checking, clean composition of shared configs

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

## Key Points

| Requirement                | Implementation                               |
| -------------------------- | -------------------------------------------- |
| Use flat config            | `defineConfig(...)` with TypeScript config   |
| Type-safe config           | `eslint.config.ts` with `defineConfig()`     |
| Global ignores             | `globalIgnores(["dist/**", ".next/**"])`     |
| Convert errors to warnings | Include `eslint-plugin-only-warn`            |
| Prevent Prettier conflicts | Include `eslint-config-prettier`             |
| typescript-eslint v8+      | Use `projectService: true` for typed linting |

---

## ESLint 10 Migration Notes

ESLint 10 (January 2026) completely removes .eslintrc support. Before upgrading:

1. **Remove .eslintrc files** - Replace with `eslint.config.ts`
2. **Remove .eslintignore** - Use `globalIgnores()` in config
3. **Update CLI scripts** - Remove `--no-eslintrc`, `--env`, `--rulesdir` flags
4. **Update Node.js** - Minimum Node.js 20.19.0 required for ESLint 10

---

## See Also

- [core.md](core.md) for Prettier configuration
- [typescript.md](typescript.md) for TypeScript integration
- [reference.md](../reference.md) for ESLint vs Biome decision framework

**Official Documentation:**

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [typescript-eslint v8](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/)
