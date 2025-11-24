# Build Tooling & Configuration

**Auto-detection:** Turborepo configuration, ESLint 9 flat config, Prettier, Husky pre-commit hooks, lint-staged, Bun, monorepo setup, syncpack

**When to use:**

- Configuring Turborepo task pipeline and caching strategies
- Setting up ESLint 9 flat config with shared configurations
- Configuring Husky pre-commit hooks with lint-staged
- Synchronizing dependencies across workspace with syncpack

**Key patterns covered:**

- Turborepo 2.4.2 with Bun 1.2.2 for monorepo orchestration
- ESLint 9 flat config with only-warn plugin (errors become warnings for better DX)
- Shared configurations (@repo/eslint-config, @repo/prettier-config, @repo/typescript-config)
- Husky + lint-staged for pre-commit quality gates (fast, staged files only)

---

# Build & Tooling

> **Quick Guide:** Turborepo 2.4.2 with Bun for monorepo orchestration. ESLint 9 flat config with `only-warn` plugin. Prettier shared config. Husky + lint-staged for pre-commit hooks. Shared TypeScript configs. Bun 1.2.2 package manager (3-10x faster installs).

---

## Turborepo Configuration

**ACTUAL IMPLEMENTATION: Turborepo 2.4.2 with Bun 1.2.2**

**Location:** `turbo.json` in repository root

### Task Pipeline

**Pattern:** Define task dependencies and caching behavior

**Key concepts:**

- `dependsOn: ["^build"]` - Run dependency tasks first (topological order)
- `outputs` - Define what files to cache
- `inputs` - Specify which files trigger cache invalidation
- `cache: false` - Disable caching for tasks with side effects
- `persistent: true` - Keep dev servers running

**ACTUAL tasks in this codebase:**

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL", "NODE_ENV"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "src/**/*.tsx", "src/**/*.ts", "test/**/*.ts", "test/**/*.tsx"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "generate": {
      "dependsOn": ["^generate"],
      "cache": false
    },
    "lint": {}
  }
}
```

### Caching Strategies

**What gets cached:**

- Build outputs (`dist/`, `.next/`)
- Test results (when `cache: true`)
- Lint results

**What doesn't get cached:**

- Dev servers (`cache: false`)
- Code generation (`cache: false` - generates files)
- Tasks with side effects

**Cache invalidation triggers:**

- Source file changes
- Dependency changes
- Environment variable changes (when in `env` array)
- Global dependencies changes (`.env`, `tsconfig.json`)

### Remote Caching

**Optional but recommended for teams:**

```json
{
  "remoteCache": {
    "signature": true
  }
}
```

**Setup:** Link Vercel account, set `TURBO_TOKEN` and `TURBO_TEAM` env vars. Shares cache across team and CI.

### Environment Variables

**Pattern:** Declare environment variables in `env` array

```json
{
  "tasks": {
    "build": {
      "env": ["DATABASE_URL", "NODE_ENV", "NEXT_PUBLIC_API_URL"]
    }
  }
}
```

**Why:** Turbo includes env vars in cache key - different values trigger rebuilds

---

## Linting Configuration

**ACTUAL IMPLEMENTATION: ESLint 9 with flat config**

**Location:** `packages/eslint-config/`

### Shared Config Pattern

**Pattern:** Shared base config extended by apps and packages

**Structure:**

```
packages/eslint-config/
├── base.js           # Base config for all packages
├── react.js          # React-specific rules
├── next.js           # Next.js-specific rules
└── package.json
```

**Base config includes:** Recommended JS/TS rules, Prettier conflict resolution, Turbo env var validation, `only-warn` plugin (converts errors to warnings), and ignore patterns for build outputs.

### Key Features

**ESLint 9 flat config:**

- New configuration format (replaces `.eslintrc`)
- Simpler, more flexible
- Better TypeScript support

**Plugins used:**

- `@typescript-eslint` - TypeScript linting
- `eslint-config-prettier` - Disable conflicting Prettier rules
- `eslint-plugin-turbo` - Validate environment variables
- `eslint-plugin-only-warn` - Convert errors to warnings (better DX)

**Why `only-warn`:**

- Developers aren't blocked by errors
- Issues are visible but not disruptive
- CI can still fail on warnings if needed

### ESLint vs Biome (2025)

**Current choice: ESLint 9**

- Mature ecosystem
- Extensive plugin support
- Good TypeScript integration

**Biome (emerging alternative):**

- ✅ Extremely fast (Rust-based)
- ✅ Combined linter + formatter
- ✅ Drop-in Prettier replacement
- ❌ Smaller ecosystem
- ❌ Fewer plugins

**Recommendation:**

- Stick with ESLint for now (mature, stable)
- Monitor Biome adoption (may switch in 2025-2026)
- Consider Biome for greenfield projects

---

## Formatting

**ACTUAL IMPLEMENTATION: Prettier with shared config**

**Location:** `packages/prettier-config/`

### Shared Configuration

**Pattern:** Centralized Prettier config shared across all packages

**Key settings:** 100 char line width, 2-space indentation, double quotes, required semicolons, trailing commas everywhere, always use arrow parens.

**Usage in packages:**

```json
{
  "prettier": "@repo/prettier-config"
}
```

### Format Settings Explained

**Line width:** `100` characters

- Balances readability and screen width
- Works well with side-by-side diffs
- Alternative: `120` for wider screens

**Quotes:** Double quotes (`"`)

- Consistent with JSON
- Fewer escapes in JSX
- Alternative: Single quotes (`'`) for smaller bundles

**Semicolons:** Required

- Explicit statement termination
- Avoids ASI issues
- Alternative: No semicolons (modern style)

**Trailing commas:** All

- Cleaner git diffs
- Easier to reorder items
- Required for multi-line

**Arrow parens:** Always

- Consistent with multi-param functions
- Easier to add params later

### Editor Integration

**VS Code:** Install Prettier extension

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**EditorConfig:** Basic formatting rules

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,jsx,ts,tsx,json}]
indent_style = space
indent_size = 2
```

### Prettier vs Biome

**Current choice: Prettier**

- Industry standard
- Extensive language support
- Battle-tested

**Biome alternative:**

- ~20x faster than Prettier
- Combined linter + formatter
- Compatible with Prettier config
- Growing adoption

**When to switch:**

- Large monorepos (speed matters)
- Greenfield projects
- When Biome plugin ecosystem matures

---

## Pre-commit Hooks

**ACTUAL IMPLEMENTATION: Husky + lint-staged**

**Location:** `.husky/` directory, per-package `lint-staged.config.mjs`

### Husky Configuration

**Pre-commit hook:**

```bash
# .husky/pre-commit
bunx lint-staged
```

**Pre-push hook:**

```bash
# .husky/pre-push
cd apps/client-react && bun run test --watch=false
```

### lint-staged Setup

**Pattern:** Per-package configuration runs ESLint with auto-fix on staged TypeScript and SCSS files.

**What runs on commit:**

- ESLint with auto-fix
- Prettier formatting (via ESLint integration)
- Only on staged files (fast!)

### What to Run Pre-commit

**Recommended (fast):**

- ✅ Linting with auto-fix
- ✅ Formatting
- ✅ Type checking (--noEmit, fast)

**NOT recommended (slow):**

- ❌ Full test suite (run in pre-push or CI)
- ❌ Full build (too slow)
- ❌ E2E tests (run in CI)

### Advanced Patterns

**Run affected tests only:**

```javascript
// lint-staged.config.mjs
export default {
  "*.{ts,tsx}": (filenames) => {
    const testFiles = filenames.filter((f) => f.includes(".test.")).map((f) => `bun test ${f}`);
    return ["eslint --fix", ...testFiles];
  },
};
```

**Type check only changed files:**

```javascript
export default {
  "*.{ts,tsx}": ["eslint --fix", () => "tsc --noEmit --incremental"],
};
```

---

## TypeScript Configuration

**ACTUAL IMPLEMENTATION: Shared configs in `@repo/typescript-config`**

**Location:** `packages/typescript-config/`

### Shared Config Pattern

**Structure:**

```
packages/typescript-config/
├── base.json              # Common settings for all packages
├── nextjs.json            # Next.js-specific settings
├── react-library.json     # React library settings
├── node.json              # Node.js server settings
└── package.json
```

**Usage:**

```json
// apps/client-next/tsconfig.json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Base Configuration

**Recommended settings:**

```json
{
  "compilerOptions": {
    "strict": true,
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

### Path Aliases

**Pattern:** Configure in both tsconfig and build tool

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

**Benefits:**

- Clean imports: `import { Button } from "@components/button"`
- No relative path hell: No `../../../components`
- Easy refactoring

---

## Package Manager

**ACTUAL IMPLEMENTATION: Bun 1.2.2**

**Location:** `package.json` (root)

```json
{
  "packageManager": "bun@1.2.2"
}
```

### Why Bun?

**Benefits:**

- ⚡ Extremely fast installs (3-10x faster than npm/yarn)
- 🔧 Native TypeScript support
- 🎯 Compatible with npm packages
- 📦 Built-in test runner
- 🔨 Built-in bundler

**Alternatives:**

- **npm** - Slowest, but universal
- **yarn** - Faster, PnP mode
- **pnpm** - Efficient disk usage, fast
- **bun** - Fastest, modern

### Workspaces

**Pattern:** Monorepo with workspaces

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

**Benefits:**

- Shared dependencies across packages
- Hoist common dependencies
- Link local packages automatically

---

## Dependency Synchronization

**ACTUAL IMPLEMENTATION: Syncpack**

**Purpose:** Ensure consistent versions across workspace

**Commands:**

```json
{
  "scripts": {
    "deps:check": "syncpack list-mismatches",
    "deps:fix": "syncpack fix-mismatches"
  }
}
```

### Why Syncpack?

**Problem:**

- Different packages use different versions of React
- `@types/react` version mismatch
- Duplicate dependencies in bundle

**Solution:**

- Syncpack identifies version mismatches
- Auto-fix to use consistent versions
- Reduces bundle size

**Example:**

```bash
$ bun run deps:check
❌ react: 18.2.0, 18.3.0, 19.0.0 (3 versions!)
❌ @types/react: 18.2.0, 18.3.0 (2 versions!)

$ bun run deps:fix
✅ Updated react to 19.0.0 across all packages
✅ Updated @types/react to 18.3.0 across all packages
```

---

## Build Optimization

**Recommended practices for production builds**

### Bundle Analysis

**Tools:**

- `rollup-plugin-visualizer` - Vite/Rollup
- `@next/bundle-analyzer` - Next.js
- `webpack-bundle-analyzer` - Webpack

**Setup:**

```bash
bun add -D rollup-plugin-visualizer
bun run build --analyze
```

### Code Splitting

**Patterns:**

- Route-based splitting (automatic in Next.js)
- Component lazy loading with `React.lazy()`
- Vendor chunk splitting
- Dynamic imports for large libraries

### Tree Shaking

**Requirements:**

- ES modules (not CommonJS)
- Named exports (not default)
- Side-effect-free code

**Mark as side-effect-free:**

```json
{
  "sideEffects": false
}
```

Or specify files with side effects:

```json
{
  "sideEffects": ["*.css", "*.scss"]
}
```

### Performance Budgets

**Set size limits:**

```json
{
  "build": {
    "chunkSizeWarningLimit": 500,
    "rollupOptions": {
      "output": {
        "manualChunks": {
          "vendor": ["react", "react-dom"]
        }
      }
    }
  }
}
```

**Monitor:**

- Initial bundle < 200KB (gzip)
- Largest chunk < 500KB
- Total bundle < 1MB


---

# Build & Tooling - Examples

---

## Turborepo/Nx/Vite Configuration

### Example: Vite Configuration with Path Aliases

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

**Why:** Clean imports. Better organization. Vendor chunk splitting. API proxy for development.

**Edge Cases:**

- Use `@/` as primary alias, others as convenience
- Sync with tsconfig paths
- Consider dynamic imports for large features

---

### Example: Environment-Specific Builds

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

**Why:** Environment-specific optimizations. Conditional features. Different API endpoints.

**Edge Cases:**

- Never commit .env files
- Use .env.example as template
- Validate required env vars at build time

---

### Example: Incremental Builds with Turborepo Caching

```typescript
// turbo.json - Advanced caching configuration
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.json",
    ".eslintrc.js"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true,
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"]
    },
    "lint": {
      "cache": true,
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

```bash
# Local development - uses local cache
npx turbo run build
# ✅ Cache miss - Building...
# ✅ Packages built: 5
# ✅ Time: 45.2s

# Second run - hits cache
npx turbo run build
# ✅ Cache hit - Skipping...
# ✅ Packages restored: 5
# ✅ Time: 1.2s (97% faster)

# Only rebuilds changed packages
# Edit packages/ui/src/Button.tsx
npx turbo run build
# ✅ Cache hit: @repo/types, @repo/config, @repo/api-client
# ✅ Cache miss: @repo/ui (changed)
# ✅ Cache miss: web, admin (depend on @repo/ui)
# ✅ Time: 12.4s (73% faster)
```

```yaml
# .github/workflows/ci.yml - Remote caching in CI
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Needed for --filter

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      # Remote cache with Vercel
      - name: Build
        run: npx turbo run build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      # Only run affected tests on PRs
      - name: Test affected
        if: github.event_name == 'pull_request'
        run: npx turbo run test --filter=...[HEAD^]

      # Run all tests on main
      - name: Test all
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx turbo run test
```

```json
// package.json - Remote cache setup
{
  "scripts": {
    "build": "turbo run build",
    "build:fresh": "turbo run build --force",
    "build:affected": "turbo run build --filter=...[HEAD^1]",
    "test:affected": "turbo run test --filter=...[HEAD^1]"
  }
}
```

**Why:** Incremental builds save massive time. Local cache makes rebuilds instant. Remote cache shares across CI and developers. Only affected packages rebuild.

**Edge Cases:**

- Use `--force` to ignore cache when needed
- Set `globalDependencies` for files that affect all packages
- Use `inputs` to fine-tune what triggers cache invalidation
- Remote cache requires Vercel account or self-hosted solution

**Metrics:**

- First build: ~45s (5 packages)
- Cached build: ~1s (97% faster)
- Affected build: ~12s (73% faster)
- Team savings: Hours per week with remote cache

---

## Linting Configuration

### Example: ACTUAL ESLint 9 Flat Config

```javascript
// packages/eslint-config/base.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import { plugin as onlyWarn } from "eslint-plugin-only-warn";

export const baseConfig = [
  // ✅ Recommended base rules
  js.configs.recommended,

  // ✅ Disable Prettier conflicts
  eslintConfigPrettier,

  // ✅ TypeScript rules
  ...tseslint.configs.recommended,

  // ✅ Turbo plugin for env var validation
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // ✅ Convert all errors to warnings
  {
    plugins: {
      onlyWarn,
    },
  },

  // ✅ Ignore build outputs
  {
    ignores: ["dist/**", "generated/**", ".next/**"],
  },
];
```

```javascript
// packages/eslint-config/react.js
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { baseConfig } from "./base.js";

export const reactConfig = [
  ...baseConfig,

  // ✅ React plugin
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React rules
      "react/react-in-jsx-scope": "off", // Not needed in React 19
      "react/prop-types": "off", // Using TypeScript
      "react/no-unescaped-entities": "warn",

      // Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility rules
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
    },
  },
];
```

```javascript
// apps/client-react/eslint.config.js
import { reactConfig } from "@repo/eslint-config/react";

export default [
  ...reactConfig,

  // ✅ App-specific overrides
  {
    rules: {
      // Override specific rules for this app
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
```

**Why:** Flat config is simpler, more flexible, and better typed than legacy `.eslintrc`.

---

### Example: Custom ESLint Rules for Monorepo

```javascript
// packages/eslint-config/custom-rules.js
export const customRules = {
  rules: {
    // ✅ Enforce named exports (better tree-shaking)
    "import/no-default-export": "warn",

    // ✅ Prevent importing from internal paths
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

    // ✅ Enforce consistent type imports
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixable: "code",
      },
    ],

    // ✅ Prevent unused variables
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],

    // ✅ Enforce naming conventions
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: "typeParameter",
        format: ["PascalCase"],
        prefix: ["T"],
      },
    ],
  },
};
```

**Why:** Custom rules enforce project-specific patterns and best practices.

---

### Example: Biome Configuration (Alternative)

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "warn",
        "useTemplate": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingComma": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  }
}
```

```json
// package.json - Scripts for Biome
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --apply .",
    "format": "biome format --write ."
  }
}
```

**Why:** Biome is 20x faster than ESLint+Prettier combined, single tool for linting and formatting.

**When to use:** Large monorepos where speed matters, greenfield projects.

---

## Formatting

### Example: ACTUAL Prettier Configuration

```javascript
// packages/prettier-config/prettier.config.mjs
const config = {
  // Line length
  printWidth: 100,

  // Indentation
  useTabs: false,
  tabWidth: 2,

  // Punctuation
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",

  // Spacing
  bracketSpacing: true,
  arrowParens: "always",

  // JSX
  jsxSingleQuote: false,
  bracketSameLine: false,

  // Prose
  proseWrap: "preserve",

  // End of line
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

**Why:** Single source of truth for formatting. All packages use same rules.

---

### Example: VS Code Integration

```json
// .vscode/settings.json
{
  // ✅ Enable format on save
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // ✅ Per-language formatters
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // ✅ Auto-fix on save with ESLint
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // ✅ ESLint validation
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

```json
// .vscode/extensions.json - Recommended extensions
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig"
  ]
}
```

**Why:** Consistent formatting across team. Auto-fix on save. No format debates.

---

### Example: EditorConfig for Basic Formatting

```ini
# .editorconfig
root = true

# All files
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

# JavaScript/TypeScript
[*.{js,jsx,ts,tsx,json}]
indent_style = space
indent_size = 2

# YAML
[*.{yml,yaml}]
indent_style = space
indent_size = 2

# Markdown
[*.md]
trim_trailing_whitespace = false
max_line_length = off

# Makefiles
[Makefile]
indent_style = tab
```

**Why:** EditorConfig works across all editors. Prettier uses these as defaults.

---

### Example: Format-on-Commit with lint-staged

```javascript
// lint-staged.config.mjs
export default {
  // ✅ Format and lint TypeScript/JavaScript
  "*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --fix"],

  // ✅ Format JSON
  "*.json": ["prettier --write"],

  // ✅ Format SCSS/CSS
  "*.{css,scss}": ["prettier --write"],

  // ✅ Format Markdown
  "*.md": ["prettier --write"],
};
```

**Why:** Ensures all committed code is formatted. No unformatted code in repo.

---

## Pre-commit Hooks

### Example: ACTUAL Husky Setup

```bash
# Install Husky
bun add -D husky
bunx husky init
```

```bash
# .husky/pre-commit
bunx lint-staged
```

```bash
# .husky/pre-push
cd apps/client-react && bun run test --watch=false
```

```bash
# .husky/commit-msg (optional - enforce conventional commits)
bunx commitlint --edit $1
```

**Why:** Catch issues before they enter the repository. Auto-fix on commit.

---

### Example: ACTUAL lint-staged Configuration

```javascript
// apps/client-react/lint-staged.config.mjs
export default {
  "*.{ts,tsx,scss}": "eslint --fix",
};
```

```javascript
// Advanced: Per-file-type actions
export default {
  // ✅ TypeScript: lint and type-check
  "*.{ts,tsx}": [
    "eslint --fix",
    "bash -c 'tsc --noEmit --incremental'",
  ],

  // ✅ SCSS: lint with stylelint (if installed)
  "*.scss": ["stylelint --fix"],

  // ✅ Format everything
  "*": ["prettier --write --ignore-unknown"],
};
```

**Why:** Only runs on changed files. Fast feedback loop.

---

### Example: Advanced - Run Affected Tests Only

```javascript
// lint-staged.config.mjs
export default {
  "*.{ts,tsx}": (filenames) => {
    // ✅ Separate test files from source files
    const testFiles = filenames.filter(f => f.includes('.test.'));
    const sourceFiles = filenames.filter(f => !f.includes('.test.'));

    const commands = [];

    // ✅ Always lint all changed files
    commands.push(`eslint --fix ${filenames.join(' ')}`);

    // ✅ Run tests for changed test files
    if (testFiles.length > 0) {
      commands.push(`vitest run ${testFiles.join(' ')}`);
    }

    // ✅ Find and run tests related to changed source files
    if (sourceFiles.length > 0) {
      // This assumes test files are named component.test.tsx
      const relatedTests = sourceFiles
        .map(f => f.replace('.tsx', '.test.tsx').replace('.ts', '.test.ts'))
        .filter(f => require('fs').existsSync(f));

      if (relatedTests.length > 0) {
        commands.push(`vitest run ${relatedTests.join(' ')}`);
      }
    }

    return commands;
  },
};
```

**Why:** Only test what changed. Faster pre-commit hook.

---

### Example: Commitlint for Conventional Commits

```javascript
// commitlint.config.js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation
        "style",    // Formatting
        "refactor", // Code refactoring
        "test",     // Tests
        "chore",    // Maintenance
        "perf",     // Performance
        "ci",       // CI/CD
        "build",    // Build system
        "revert",   // Revert commit
      ],
    ],
    "subject-case": [2, "never", ["upper-case"]],
  },
};
```

```bash
# .husky/commit-msg
bunx commitlint --edit $1
```

**Example commits:**
```bash
✅ feat(ui): add Button component
✅ fix(api): handle network errors
✅ docs(readme): update installation steps
✅ chore(deps): upgrade react to 19.0.0

❌ Add new feature          # Missing type
❌ feat: Add New Feature    # Subject is capitalized
```

**Why:** Consistent commit messages. Better changelogs. Clear history.

---

### Example: Skip Hooks When Needed

```bash
# Skip pre-commit hook
git commit -m "WIP: debugging" --no-verify

# Skip pre-push hook
git push --no-verify
```

**When to use:**
- Emergency hotfixes
- WIP commits on feature branch
- When hooks are broken

**Warning:** Use sparingly! Hooks exist for a reason.

---

## Build Optimization

### Example: Bundle Analysis with Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),

    // ✅ Bundle analyzer
    visualizer({
      open: true,
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // or "sunburst", "network"
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        // ✅ Manual chunk splitting
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-select"],
        },
      },
    },
  },
});
```

```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "build:analyze": "vite build && open dist/stats.html"
  }
}
```

**Output:**
- Visual treemap of bundle contents
- Identifies large dependencies
- Shows gzip/brotli sizes

---

### Example: Code Splitting with React.lazy()

```typescript
// App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// ✅ Lazy load routes
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// ✅ Preload on hover
const DashboardPage = lazy(() => import('./pages/Dashboard'));
DashboardPage.preload = () => import('./pages/Dashboard');

function Navigation() {
  return (
    <nav>
      <Link
        to="/dashboard"
        onMouseEnter={() => DashboardPage.preload()}
        onFocus={() => DashboardPage.preload()}
      >
        Dashboard
      </Link>
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

**Why:**
- Smaller initial bundle
- Faster first page load
- Users only download what they need
- Preload on hover = instant navigation

---

### Example: Tree Shaking with sideEffects

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

**Explanation:**
- `sideEffects: false` = All files are pure, can be tree-shaken
- `sideEffects: ["*.css"]` = Only CSS files have side effects
- Enables better tree-shaking in production builds

**Impact:**
```bash
# Without sideEffects
Bundle size: 450 KB (includes unused components)

# With sideEffects: false
Bundle size: 280 KB (38% smaller!)
```

---

### Example: Performance Budgets in CI

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // ✅ Warn when chunk exceeds 500KB
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // ✅ Fail build if any chunk > 1MB
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Each package gets its own chunk
            return id.toString().split('node_modules/')[1].split('/')[0];
          }
        },
      },
    },
  },
});
```

```json
// package.json - Size limit checks
{
  "scripts": {
    "build": "vite build",
    "size:check": "size-limit"
  },
  "size-limit": [
    {
      "path": "dist/assets/index-*.js",
      "limit": "200 KB"
    },
    {
      "path": "dist/assets/vendor-*.js",
      "limit": "500 KB"
    }
  ]
}
```

**Why:** Prevent bundle bloat. Fail builds that exceed size budgets.

