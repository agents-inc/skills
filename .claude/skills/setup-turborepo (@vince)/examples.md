# Monorepo Examples

> Complete code examples for Turborepo and monorepo patterns. See [skill.md](skill.md) for core concepts and [reference.md](reference.md) for decision frameworks.

---

## Task Pipeline Examples

### Good Example - Proper task configuration with dependencies

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

**Why good:** `dependsOn: ["^build"]` ensures topological task execution (dependencies build first), `env` array includes all environment variables for proper cache invalidation, `cache: false` prevents caching tasks with side effects (dev servers, code generation), `outputs` specifies cacheable artifacts while excluding cache directories

### Bad Example - Missing critical configuration

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // BAD: No dependsOn - dependencies may not build first
      // BAD: No env array - environment changes won't invalidate cache
    },
    "dev": {
      "persistent": true
      // BAD: Missing cache: false - dev server output gets cached
    },
    "generate": {
      "dependsOn": ["^generate"]
      // BAD: Missing cache: false - generated files get cached
    }
  }
}
```

**Why bad:** Missing `dependsOn` breaks topological ordering (packages may build before their dependencies), missing `env` array causes stale builds when environment variables change, caching dev servers or code generation tasks causes incorrect cached outputs to be reused

---

## Caching Configuration Examples

### Good Example - Remote caching with signature verification

```json
{
  "remoteCache": {
    "signature": true
  },
  "tasks": {
    "build": {
      "env": ["DATABASE_URL", "NODE_ENV", "NEXT_PUBLIC_API_URL"]
    }
  }
}
```

**Why good:** `signature: true` enables cache verification for security, `env` array declares all environment variables so different values trigger rebuilds, remote cache shares artifacts across team and CI reducing redundant builds

---

## Advanced Caching Configuration

### Good Example - Full turbo.json with advanced caching

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

**Why good:** `globalDependencies` ensures changes to shared config files invalidate all caches, `inputs` array fine-tunes what triggers test cache invalidation, `outputs: []` for lint means it caches the result without storing files, remote cache with signature verification is secure

---

## Cache Hit Examples

```bash
# Local development - uses local cache
npx turbo run build
# Cache miss - Building...
# Packages built: 5
# Time: 45.2s

# Second run - hits cache
npx turbo run build
# Cache hit - Skipping...
# Packages restored: 5
# Time: 1.2s (97% faster)

# Only rebuilds changed packages
# Edit packages/ui/src/Button.tsx
npx turbo run build
# Cache hit: @repo/types, @repo/config, @repo/api-client
# Cache miss: @repo/ui (changed)
# Cache miss: web, admin (depend on @repo/ui)
# Time: 12.4s (73% faster)
```

---

## CI/CD Integration Examples

### Good Example - Remote caching in GitHub Actions

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

**Why good:** `fetch-depth: 2` enables affected detection with `--filter=...[HEAD^]`, remote cache tokens shared via secrets, affected tests run only on PRs to save CI time, full tests run on main for comprehensive coverage

---

## Package.json Scripts Examples

### Good Example - Remote cache setup scripts

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

**Why good:** `:fresh` script bypasses cache when needed, `:affected` scripts only run tasks for changed packages, clear naming convention indicates purpose

---

## Workspace Protocol Examples

### Good Example - Properly configured workspaces

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:*"
  }
}
```

**Why good:** `workspace:*` protocol links local packages automatically, glob patterns `apps/*` and `packages/*` discover all packages dynamically, Bun hoists common dependencies to root reducing duplication

### Bad Example - Hardcoded versions instead of workspace protocol

```json
{
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    "@repo/ui": "1.0.0",
    "@repo/types": "^2.1.0"
  }
}
```

**Why bad:** Hardcoded versions break local package linking (installs from npm instead of linking), version mismatches across packages cause duplicate dependencies, changes to internal packages require manual version updates everywhere

---

## Environment Variable Examples

### Good Example - All env vars declared

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["NEXT_PUBLIC_API_URL", "NODE_ENV", "DATABASE_URL"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["NEXT_PUBLIC_API_URL", "NODE_ENV"]
    }
  }
}
```

**Why good:** All environment variables explicitly declared in `env` array, cache invalidates when env values change, ESLint can validate undeclared usage, different environments (dev/staging/prod) properly trigger rebuilds

### Bad Example - Missing env declarations

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
      // BAD: No env array - using DATABASE_URL won't invalidate cache
    }
  }
}
```

**Why bad:** Missing `env` array means environment variable changes don't invalidate cache, stale builds with wrong config get reused across environments, ESLint can't catch undeclared variable usage

---

## ESLint Integration Example

### Good Example - Turborepo ESLint plugin

```javascript
// packages/eslint-config/base.js
export const baseConfig = [
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
];
```

**Why good:** ESLint warns when env vars are used but not declared in turbo.json, prevents cache invalidation bugs at development time

---

## Syncpack Examples

### Good Example - Syncpack configured for version checking

```json
// package.json
{
  "scripts": {
    "deps:check": "syncpack list-mismatches",
    "deps:fix": "syncpack fix-mismatches"
  }
}
```

**Why good:** `deps:check` identifies version mismatches across packages, `deps:fix` auto-updates to consistent versions, runs in CI to prevent version drift

### Good Example - Syncpack configuration

```json
// .syncpackrc.json - Enforce workspace protocol and consistent versions
{
  "versionGroups": [
    {
      "label": "Use workspace protocol for internal packages",
      "dependencies": ["@repo/*"],
      "dependencyTypes": ["prod", "dev"],
      "pinVersion": "workspace:*"
    }
  ],
  "semverGroups": [
    {
      "range": "^",
      "dependencyTypes": ["prod", "dev"],
      "dependencies": ["**"],
      "packages": ["**"]
    }
  ]
}
```

**Why good:** `versionGroups` enforces workspace protocol for internal packages, `semverGroups` enforces consistent version ranges across all packages

### Usage Example

```bash
# Check for mismatches
$ bun run deps:check
react: 18.2.0, 18.3.0, 19.0.0 (3 versions across packages!)
@types/react: 18.2.0, 18.3.0 (2 versions!)

# Auto-fix to consistent versions
$ bun run deps:fix
Updated react to 19.0.0 across all packages
Updated @types/react to 18.3.0 across all packages
```

---

## Dependency Boundary Examples

### Allowed vs Forbidden Dependencies

```
ALLOWED:
apps/web -> @repo/ui -> @repo/types
apps/admin -> @repo/api-client -> @repo/types

FORBIDDEN:
@repo/ui -> apps/web  (packages cannot depend on apps)
@repo/types -> apps/admin  (packages cannot depend on apps)
@repo/ui -> @repo/api-client -> @repo/ui  (circular dependency)
```

### Circular Dependency Detection

```bash
# Using madge to detect circular dependencies
npx madge --circular --extensions ts,tsx ./packages
npx madge --circular --extensions ts,tsx ./apps/client-next/src

# Using dpdm
npx dpdm --circular ./packages/*/src/index.ts
```

### CI Integration for Dependency Checks

```json
// package.json - Add to CI pipeline
{
  "scripts": {
    "check:circular": "madge --circular --extensions ts,tsx ./packages",
    "check:deps": "bun run deps:check"
  }
}
```

**Why good:** Automated checks prevent circular dependencies from being merged, clear boundary rules enforce clean architecture

---

## Internal Package Conventions

The following sections cover internal package conventions for @repo/* packages.

---

## Naming Conventions

### Package Naming

```typescript
// Good Example - Package naming
// package.json
{
  "name": "@repo/ui",           // @repo/* prefix, kebab-case
  "name": "@repo/api-client",   // Multi-word: kebab-case
  "name": "@repo/eslint-config" // Config package: kebab-case
}

// Good Example - File naming
// button.tsx (NOT Button.tsx)
// use-auth.ts (NOT useAuth.ts)
// api-client.ts (NOT apiClient.ts or api_client.ts)

// Good Example - Export naming
export { Button } from "./button";              // PascalCase for components
export { useAuth, formatDate } from "./utils";   // camelCase for functions/hooks
export { API_TIMEOUT_MS } from "./constants";    // SCREAMING_SNAKE_CASE for constants
```

**Why good:** Consistent naming enables predictable imports, kebab-case files work across all OS filesystems, @repo prefix prevents namespace collisions with npm packages

```typescript
// Bad Example - Inconsistent naming
{
  "name": "ui",                 // BAD: Missing @repo/ prefix
  "name": "@repo/API-Client",   // BAD: PascalCase package name
  "name": "@mycompany/ui"       // BAD: Custom namespace (use @repo)
}

// Button.tsx                   // BAD: PascalCase file name
// useAuth.ts                   // BAD: camelCase file name
// api_client.ts                // BAD: snake_case file name

export default Button;          // BAD: Default export
```

**Why bad:** Missing @repo prefix causes namespace confusion, PascalCase files break on case-sensitive filesystems, default exports prevent tree-shaking and cause naming conflicts

---

## package.json Configuration

### Essential Fields

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx",
    "./hooks": "./src/hooks/index.ts",
    "./styles/*": "./src/styles/*"
  },
  "scripts": {
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**Why good:** Explicit exports enable tree-shaking, workspace protocol ensures local versions always used, peerDependencies prevent React version conflicts, private true prevents accidental publishing

```json
// Bad Example - Missing exports and wrong dependencies
{
  "name": "@repo/ui",
  "version": "0.0.0",
  // BAD: No exports field - allows importing internal paths
  "main": "./src/index.ts",
  "dependencies": {
    "react": "^19.0.0",              // BAD: Should be peerDependencies
    "@repo/eslint-config": "^1.0.0"  // BAD: Should use workspace:*
  }
}
```

**Why bad:** Missing exports allows importing internal paths breaking encapsulation, React in dependencies causes version duplication, hardcoded versions create version conflicts in monorepo

---

## Exports Field Pattern

Define explicit exports for each public API to enable tree-shaking and encapsulation.

```json
{
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx",
    "./hooks": "./src/hooks/index.ts"
  }
}
```

**Why good:** Explicit exports enable aggressive tree-shaking, prevents coupling to internal file structure, makes API surface clear to consumers

```json
// Bad Example - No exports or barrel file anti-pattern
{
  // BAD: No exports - allows deep imports
  "main": "./src/index.ts"
}

// OR worse - barrel file anti-pattern
{
  "exports": {
    ".": "./src/index.ts"  // BAD: Giant barrel file that re-exports everything
  }
}
```

**Why bad:** No exports allows deep imports like `@repo/ui/src/internal/utils` breaking encapsulation, barrel files bundle all code even if only one component is imported

---

## Usage Pattern

```typescript
// Good Example - Import from explicit exports
import { Button } from "@repo/ui/button";
import { Switch } from "@repo/ui/switch";
import { useClickOutside } from "@repo/ui/hooks";
```

**Why good:** Each import maps to a single file, bundler can tree-shake unused components, clear and predictable import paths

```typescript
// Bad Example - Import from internal paths
import { Button } from "@repo/ui/src/components/button/button";
import { Switch } from "@repo/ui/src/components/switch/switch";
```

**Why bad:** Couples to internal file structure, breaks when package refactors, bypasses intended public API, tree-shaking may fail

---

## Barrel Files (Use Sparingly)

Barrel files for small groups only, prefer package.json exports for tree-shaking.

```typescript
// Good Example - Small barrel file for related items
// packages/ui/src/hooks/index.ts
export { useClickOutside } from "./use-click-outside";
export { useDebounce } from "./use-debounce";
export { useMediaQuery } from "./use-media-query";
export type { DebounceOptions } from "./use-debounce";
```

**Why good:** Small barrels (<10 exports) group related items, package.json exports still controls public API, manageable cognitive load

**When to use:** Only for grouping 3-10 tightly related exports (e.g., hooks, utils)

```typescript
// Bad Example - Giant barrel file
// packages/ui/src/index.ts
export * from "./components/button/button";
export * from "./components/switch/switch";
export * from "./components/dialog/dialog";
export * from "./components/input/input";
// ... 50 more exports
```

**Why bad:** Giant barrels break tree-shaking (bundler loads entire file), slow TypeScript compilation, IDE struggles with autocomplete, defeats purpose of explicit exports

**When not to use:** For large numbers of exports, prefer explicit package.json exports field instead

---

## Package Types

### Component Library Package

```json
{
  "name": "@repo/ui",
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "sideEffects": ["*.css", "*.scss"]
}
```

### API Client Package

```json
{
  "name": "@repo/api",
  "exports": {
    ".": "./src/client.ts",
    "./queries": "./src/queries/index.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0"
  },
  "sideEffects": false
}
```

### Configuration Package

```json
{
  "name": "@repo/eslint-config",
  "exports": {
    "./base": "./base.js",
    "./react": "./react.js",
    "./next": "./next.js"
  },
  "dependencies": {
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

### TypeScript Config Package

```json
{
  "name": "@repo/typescript-config",
  "exports": {
    "./base.json": "./base.json",
    "./nextjs.json": "./nextjs.json",
    "./react-library.json": "./react-library.json"
  }
}
```

---

## Creating New Packages

### Step-by-Step Guide

**1. Create directory structure:**

```bash
mkdir -p packages/my-package/src
```

**2. Create package.json:**

```json
{
  "name": "@repo/my-package",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**3. Create tsconfig.json:**

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**4. Create eslint.config.js:**

```javascript
import { baseConfig } from "@repo/eslint-config/base";

export default [...baseConfig];
```

**5. Create source files:**

```typescript
// packages/my-package/src/index.ts
export { myFunction } from "./my-function";
export type { MyType } from "./types";
```

**6. Install dependencies from root:**

```bash
bun install
```

**7. Verify package is linked:**

```bash
# In another package
bun add @repo/my-package
```

---

## Directory Layout (Full)

```
packages/
├── ui/                           # Shared UI components
│   ├── src/
│   │   ├── components/
│   │   │   ├── button/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── button.module.scss
│   │   │   │   └── button.stories.tsx
│   │   │   └── switch/
│   │   │       ├── switch.tsx
│   │   │       └── switch.module.scss
│   │   ├── hooks/
│   │   │   └── index.ts
│   │   └── styles/
│   │       └── global.scss
│   ├── package.json
│   └── tsconfig.json
│
├── api/                          # API client package
│   ├── src/
│   │   ├── client.ts
│   │   ├── queries/
│   │   │   └── index.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
│
├── eslint-config/                # Shared ESLint config
│   ├── base.js
│   ├── react.js
│   ├── next.js
│   └── package.json
│
├── prettier-config/              # Shared Prettier config
│   ├── prettier.config.mjs
│   └── package.json
│
└── typescript-config/            # Shared TypeScript config
    ├── base.json
    ├── nextjs.json
    ├── react-library.json
    └── package.json
```
