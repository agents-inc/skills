# Build & Tooling

> **Quick Guide:** ESLint 9 flat config with `only-warn` plugin. Prettier shared config. Shared TypeScript configs. Bun 1.2.2 package manager. Vite build configuration. Husky + lint-staged for git hooks.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use ESLint 9 flat config format - NOT legacy .eslintrc)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use shared config pattern - @repo/eslint-config, @repo/prettier-config, @repo/typescript-config)**

**(You MUST enable TypeScript strict mode in ALL tsconfig.json files)**

</critical_requirements>

---

**Auto-detection:** ESLint 9 flat config, Prettier, Bun, Vite configuration, Husky pre-commit hooks, lint-staged, commitlint

**When to use:**

- Setting up ESLint 9 flat config with shared configurations
- Configuring Prettier with shared config
- Setting up Vite build configuration
- Configuring TypeScript with shared configs
- Setting up pre-commit hooks with lint-staged
- Configuring commit message validation (commitlint)

**Key patterns covered:**

- ESLint 9 flat config with only-warn plugin (errors become warnings for better DX)
- Shared configurations (@repo/eslint-config, @repo/prettier-config, @repo/typescript-config)
- Vite configuration (path aliases, environment-specific builds)
- Husky + lint-staged for pre-commit quality gates (fast, staged files only)
- Commitlint for conventional commit messages

**Related skills:**

- For Turborepo task pipelines, caching, and workspaces, see `setup/monorepo/basic.md`
- For internal package structure and conventions, see `setup/package/basic.md`
- For daily coding conventions (naming, imports, constants), see `shared/conventions/basic.md`

---

<philosophy>

## Philosophy

Build tooling should be **fast, consistent, and non-blocking**. Developers shouldn't fight with tools - tools should help catch issues early while staying out of the way during development.

**When to use this skill:**

- Setting up new apps or packages in the monorepo
- Configuring linting, formatting, or type-checking
- Adding git hooks for pre-commit quality gates
- Creating shared configurations for consistency
- Optimizing build performance with Vite

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipelines (see separate CI/CD skill)
- Production deployment configuration
- Server-side build processes

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Vite Configuration

#### Path Aliases

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

#### Environment-Specific Builds

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

### Pattern 2: ESLint 9 Flat Config

#### Shared Config Pattern

ESLint 9 uses flat config format (replaces legacy `.eslintrc`). Shared configs live in `packages/eslint-config/` and are extended by apps and packages.

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

#### Custom ESLint Rules for Monorepo

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

### Pattern 3: Prettier Configuration

#### Shared Config Pattern

Prettier configuration lives in `packages/prettier-config/` and is shared across all packages.

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

### Pattern 4: TypeScript Configuration

#### Shared Config Pattern

TypeScript configurations live in `packages/typescript-config/` with base settings extended by apps and packages.

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

For daily TypeScript enforcement rules (no unjustified `any`, explicit types), see CLAUDE.md.

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

### Pattern 5: Git Hooks with Husky + lint-staged

#### Pre-commit Hook Setup

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

#### VS Code Integration

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

</decision_framework>

---

<red_flags>

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

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use ESLint 9 flat config format - NOT legacy .eslintrc)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use shared config pattern - @repo/eslint-config, @repo/prettier-config, @repo/typescript-config)**

**(You MUST enable TypeScript strict mode in ALL tsconfig.json files)**

**Failure to follow these rules will cause inconsistent tooling, implicit any types, and blocked developers.**

</critical_reminders>
