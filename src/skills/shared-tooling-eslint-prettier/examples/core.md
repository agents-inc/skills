# ESLint & Prettier - Core Examples

> Essential patterns for ESLint 9+ flat config with Prettier integration. See [eslint.md](eslint.md) for shared configs, custom rules, and ESLint 10 migration. See [prettier.md](prettier.md) for TypeScript config files and experimental options.

---

## Pattern 1: Standalone Flat Config

The minimal production-ready ESLint config combining flat config, typescript-eslint, Prettier, and only-warn:

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

**Why bad:** Legacy .eslintrc is deprecated in ESLint 9 and completely removed in ESLint 10 (February 2026), error severity blocks developers during development, no only-warn plugin

---

## Pattern 2: typescript-eslint v8+ with projectService

```typescript
// eslint.config.ts — adding typed linting
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
// BAD: Manual project option (old approach)
parserOptions: {
  project: "./tsconfig.json", // Fragile path, no auto-discovery
}
```

**Why bad:** Manual `project` path is fragile in monorepos, requires tsconfig.eslint.json for config files, slower than projectService

---

## Pattern 3: Using extends Property (ESLint 9.15+)

The `extends` property simplifies plugin composition by standardizing config merging regardless of plugin format:

```typescript
// eslint.config.ts
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  extends: [
    // String references for standard configs
    "eslint/recommended",
    // Plugin configs (various formats supported)
    tseslint.configs.recommended,
    // Add your framework plugin's flat config here
  ],
  rules: {
    // Override specific rules
    "no-console": "warn",
  },
});
```

**Why good:** Standardizes config merging regardless of plugin format (object, array, or string), cleaner than spreading arrays manually, conditionally applies configs based on file patterns. Add your framework-specific plugins via `extends` as needed.

---

## Pattern 4: Prettier Standard Config

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

**Why good:** Single source of truth prevents formatting inconsistencies, explicit `endOfLine: "lf"` prevents cross-platform line ending issues, double quotes match JSON format reducing escaping in JSX

---

## Pattern 5: eslint-config-prettier Integration

eslint-config-prettier disables all ESLint rules that conflict with Prettier formatting. It must be included after other configs:

```typescript
// eslint.config.ts — correct integration
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  tseslint.configs.recommended,
  // eslint-config-prettier AFTER other configs to disable conflicting rules
  eslintConfigPrettier,
);
```

**Why good:** Prevents ESLint from reporting formatting issues that Prettier will handle, eliminates "fix one, break the other" cycles

```typescript
// BAD: Missing eslint-config-prettier
export default defineConfig(
  tseslint.configs.recommended,
  // No eslint-config-prettier - ESLint and Prettier will fight over formatting
);
```

**Why bad:** ESLint rules like `indent`, `quotes`, `semi` will conflict with Prettier's formatting, creating an endless cycle of conflicting auto-fixes
