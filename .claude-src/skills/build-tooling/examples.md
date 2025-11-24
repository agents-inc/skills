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
