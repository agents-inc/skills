# Tooling Examples

> Complete code examples for ESLint 9, Prettier, TypeScript, Vite, and Husky configuration.

---

## Vite Configuration

### Path Aliases

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
  },

  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@features/*": ["./src/features/*"],
      "@lib/*": ["./src/lib/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

**Why good:** Clean imports eliminate relative path hell, vendor chunk splitting reduces main bundle size, API proxy enables local development without CORS issues

```typescript
// ❌ Bad Example - No path aliases
import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/utils/format-date";

export default defineConfig({
  // No vendor chunk splitting - large main bundle
  build: {},
});
```

**Why bad:** Deep relative imports break when files move, no chunk splitting creates large initial bundles slowing page load, missing API proxy forces CORS workarounds

---

### Environment-Specific Builds

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    build: {
      sourcemap: mode === "development",
      minify: mode === "production",

      rollupOptions: {
        output: {
          manualChunks:
            mode === "production"
              ? {
                  "react-vendor": ["react", "react-dom"],
                }
              : undefined,
        },
      },
    },
  };
});
```

```json
// package.json
{
  "scripts": {
    "dev": "vite --mode development",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production"
  }
}
```

```
# .env files
.env.development    # Development settings
.env.staging        # Staging settings
.env.production     # Production settings
```

**Why good:** Conditional optimizations improve production builds without slowing development, environment-specific API endpoints enable testing against staging/production, build-time constants enable dead code elimination

```typescript
// ❌ Bad Example - Same config for all environments
export default defineConfig({
  // Always minify and source map - slow dev builds
  build: {
    minify: true,
    sourcemap: true,
  },
  // Hardcoded API endpoint
  define: {
    API_URL: JSON.stringify("https://api.production.com"),
  },
});
```

**Why bad:** Always minifying slows development builds, always generating source maps in production exposes code, hardcoded API URLs prevent testing against different environments

---

## ESLint 9 Flat Config

### Shared Config Pattern

```javascript
// ✅ Good Example - ESLint 9 flat config with only-warn
// packages/eslint-config/base.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import { plugin as onlyWarn } from "eslint-plugin-only-warn";

export const baseConfig = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,

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
      onlyWarn,
    },
  },

  {
    ignores: ["dist/**", "generated/**", ".next/**"],
  },
];
```

**Why good:** Flat config is simpler than legacy .eslintrc format, only-warn plugin prevents developers being blocked by errors during development, Prettier conflict resolution prevents formatting fights, Turbo plugin validates environment variables preventing runtime errors

```javascript
// ❌ Bad Example - Legacy .eslintrc format
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

**Why bad:** Legacy .eslintrc format is being phased out in ESLint 9+, error severity blocks developers during development reducing productivity, no only-warn plugin means disruptive error messages, harder to compose and extend configs

---

### Custom ESLint Rules for Monorepo

```javascript
// ✅ Good Example - Custom rules for monorepo patterns
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
// ❌ Bad Example - No custom rules
export const config = [
  js.configs.recommended,
  // Missing project-specific rules
];
```

**Why bad:** No enforcement of named exports allows default exports reducing tree-shaking effectiveness, no internal import restrictions breaks package encapsulation, no type import consistency slows builds, unused variables clutter codebase

---

## Prettier Configuration

### Shared Config Pattern

```javascript
// ✅ Good Example - Shared Prettier config
// packages/prettier-config/prettier.config.mjs
const config = {
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
};

export default config;
```

```json
// apps/client-react/package.json
{
  "name": "client-react",
  "prettier": "@repo/prettier-config",
  "devDependencies": {
    "@repo/prettier-config": "*"
  }
}
```

**Why good:** Single source of truth prevents formatting inconsistencies across team, 100 char line width balances readability with screen space, double quotes match JSON format reducing escaping in JSX, trailing commas create cleaner git diffs when adding items

```json
// ❌ Bad Example - Duplicated config in each package
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

**Why bad:** Different configs per package creates inconsistent formatting across monorepo, manually syncing changes is error-prone, developers switching between packages see formatting churn, code reviews show formatting noise instead of logic changes

---

## TypeScript Configuration

### Shared Config Pattern

```javascript
// ✅ Good Example - Shared TypeScript config with strict mode
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "incremental": true,
    "moduleResolution": "bundler"
  }
}
```

```json
// apps/client-react/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Why good:** Shared strict mode prevents any types across entire monorepo, centralized config ensures all packages have same safety guarantees, path aliases eliminate relative import hell, noUncheckedIndexedAccess prevents undefined access bugs

```json
// ❌ Bad Example - Loose TypeScript config per package
// apps/client-react/tsconfig.json
{
  "compilerOptions": {
    "strict": false, // Allows implicit any
    "noImplicitAny": false,
    "strictNullChecks": false,
    "skipLibCheck": true
  }
}
```

**Why bad:** Disabling strict mode allows implicit any types leading to runtime errors, no null checks cause undefined is not a function crashes, inconsistent configs across packages create different safety levels, developers switching packages lose type safety

---

## Git Hooks with Husky + lint-staged

### Pre-commit Hook Setup

```bash
// ✅ Good Example - Husky pre-commit with lint-staged
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
// ❌ Bad Example - Full lint on every commit
# .husky/pre-commit
cd apps/client-react && bun run lint
```

**Why bad:** Linting entire codebase on every commit is slow reducing developer productivity, unrelated files failing lint blocks unrelated commits, long-running hooks encourage using --no-verify defeating the purpose, no auto-fix means developers manually fix issues

---

### VS Code Integration

```json
// ✅ Good Example - VS Code + ESLint + Prettier integration
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
// ❌ Bad Example - No editor integration
// No .vscode/settings.json

// Developers manually run:
// bun run lint:fix
// bun run format
```

**Why bad:** Manual formatting is forgotten leading to inconsistent code, lint errors discovered late instead of immediately on save, new team members don't know which extensions to install, each developer configures editor differently
