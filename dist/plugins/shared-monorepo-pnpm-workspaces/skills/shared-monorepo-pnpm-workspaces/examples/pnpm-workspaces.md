# pnpm Workspaces - Practical Examples

> Practical examples for pnpm workspace setup, filtering, catalogs, publishing, CI pipelines, and shared configuration. See [../SKILL.md](../SKILL.md) for core concepts and [../reference.md](../reference.md) for quick command reference.

---

## Complete Workspace Setup

### Minimal Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r --parallel lint",
    "clean": "pnpm -r exec rm -rf dist node_modules"
  }
}
```

### Full Workspace with Catalogs and Settings

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"

# Dependency version catalog
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.7.0
  vitest: ^3.0.0
  zod: ^3.24.0
  "@changesets/cli": ^2.27.0

# Workspace settings (moved from .npmrc in v10)
linkWorkspacePackages: true
saveWorkspaceProtocol: rolling
disallowWorkspaceCycles: true
strictPeerDependencies: true

# Security: allowlist packages that need install scripts
onlyBuiltDependencies:
  - esbuild
  - sharp
  - "@swc/core"
```

**Why good:** Single file defines workspace structure, dependency versions, and pnpm settings. `disallowWorkspaceCycles: true` catches circular dependencies at install time. `onlyBuiltDependencies` explicitly trusts only necessary packages.

---

## Workspace Protocol Examples

### Good: Internal Dependencies with workspace:\*

```json
{
  "name": "@repo/web-app",
  "private": true,
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/api-client": "workspace:*",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@repo/config-typescript": "workspace:*",
    "@repo/config-eslint": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**Why good:** `workspace:*` guarantees local linking for internal packages, `catalog:` centralizes external dependency versions, clear separation of internal vs external dependencies

### Bad: Hardcoded Versions for Internal Packages

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "@repo/ui": "^1.0.0",
    "@repo/types": "1.2.3",
    "react": "^19.0.0"
  }
}
```

**Why bad:** Hardcoded internal versions may pull from npm instead of local workspace, different packages may have different versions of the same internal dependency, manual version bumps required on every change

### Publishing: workspace:^ for Flexible Ranges

```json
{
  "name": "@repo/ui",
  "version": "2.1.0",
  "dependencies": {
    "@repo/types": "workspace:^"
  }
}
```

After `pnpm publish`:

```json
{
  "name": "@repo/ui",
  "version": "2.1.0",
  "dependencies": {
    "@repo/types": "^2.1.0"
  }
}
```

**When to use:** Publishing packages to npm where consumers need semver flexibility

---

## Catalog Examples

### Default Catalog

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  next: ^15.0.0
  typescript: ^5.7.0
  vitest: ^3.0.0
  zod: ^3.24.0
  drizzle-orm: ^0.38.0
  hono: ^4.7.0
```

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "next": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

### Named Catalogs for Version Migration

```yaml
# pnpm-workspace.yaml
catalogs:
  react18:
    react: ^18.3.1
    react-dom: ^18.3.1
    "@types/react": ^18.3.0
  react19:
    react: ^19.0.0
    react-dom: ^19.0.0
    "@types/react": ^19.0.0
```

```json
{
  "name": "@repo/legacy-dashboard",
  "dependencies": {
    "react": "catalog:react18",
    "react-dom": "catalog:react18"
  }
}
```

```json
{
  "name": "@repo/new-app",
  "dependencies": {
    "react": "catalog:react19",
    "react-dom": "catalog:react19"
  }
}
```

**Why good:** Named catalogs allow gradual migration between major versions, each app declares its target version explicitly, centralized management of both version tracks

### Strict Catalog Enforcement

```yaml
# pnpm-workspace.yaml
catalogMode: strict
catalog:
  react: ^19.0.0
  typescript: ^5.7.0
```

With `catalogMode: strict`, this will **fail** on `pnpm install`:

```json
{
  "dependencies": {
    "react": "^18.0.0"
  }
}
```

Error: Package "react" must use `catalog:` protocol when `catalogMode` is `strict`.

**When to use:** Enforce consistent versions across all packages with no exceptions

---

## Filtering Command Examples

### Common Development Workflows

```bash
# Start dev server for a specific app
pnpm --filter @repo/web-app dev

# Build a package and all its dependencies
pnpm --filter "@repo/web-app..." build

# Run tests for changed packages since main branch
pnpm --filter "...[origin/main]" test

# Lint everything except docs
pnpm --filter "!@repo/docs" --filter "@repo/*" lint

# Add a dependency to a specific package
pnpm --filter @repo/api-server add hono

# Add a workspace dependency
pnpm --filter @repo/web-app add @repo/ui --workspace

# Remove a dependency from a package
pnpm --filter @repo/web-app remove lodash
```

### CI-Optimized Filtering

```bash
# Build only changed packages and their dependents
pnpm --filter "...[origin/main]..." build

# Test changed packages (ignore README changes)
pnpm --filter "...[origin/main]" \
  --changed-files-ignore-pattern="**/*.md" \
  test

# Type-check only packages in the packages/ directory
pnpm --filter "./packages/**" typecheck

# Build with failure on no matches (catches filter typos)
pnpm --filter "@repo/web-app" --fail-if-no-match build
```

### Dependency Graph Exploration

```bash
# See what depends on @repo/types
pnpm --filter "...@repo/types" list --depth 0

# See what @repo/web-app depends on
pnpm --filter "@repo/web-app..." list --depth 0

# List all workspace packages
pnpm -r list --depth -1
```

---

## Shared TypeScript Configuration

### Configuration Package

```
packages/config-typescript/
  package.json
  tsconfig.base.json
  tsconfig.react.json
  tsconfig.node.json
```

```json
{
  "name": "@repo/config-typescript",
  "private": true,
  "exports": {
    "./base": "./tsconfig.base.json",
    "./react": "./tsconfig.react.json",
    "./node": "./tsconfig.node.json"
  }
}
```

### Base Configuration

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### React Configuration (extends base)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "noEmit": true
  }
}
```

### Node.js Configuration (extends base)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Consumer Usage

```json
{
  "extends": "@repo/config-typescript/react",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

**Why good:** Consistent TypeScript settings across all packages, base config with strict options, variants for different environments (browser vs node), consumer packages only add project-specific paths

---

## Shared ESLint Configuration

### Configuration Package

```json
{
  "name": "@repo/config-eslint",
  "private": true,
  "dependencies": {
    "@repo/config-typescript": "workspace:*"
  },
  "exports": {
    ".": "./index.js",
    "./react": "./react.js"
  }
}
```

### Consumer Usage (flat config)

```js
// apps/web/eslint.config.js
import baseConfig from "@repo/config-eslint";
import reactConfig from "@repo/config-eslint/react";

export default [...baseConfig, ...reactConfig];
```

---

## Publishing Workflow with Changesets

### Setup

```bash
# Install changesets in workspace root
pnpm add -Dw @changesets/cli

# Initialize changesets
pnpm changeset init
```

### Changesets Configuration

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@repo/ui", "@repo/types"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@repo/web-app", "@repo/api-server"]
}
```

**Key options:**

- `linked`: Packages that should always share the same version
- `access`: `"public"` for scoped packages on npm
- `ignore`: Private packages that should not be versioned/published
- `updateInternalDependencies`: How to bump internal dep references

### Development Workflow

```bash
# 1. Make code changes across packages

# 2. Create a changeset describing the change
pnpm changeset
# Interactive prompt: select packages, bump type, description

# 3. Commit the changeset file
# .changeset/cool-dogs-dance.md gets committed with your PR

# 4. When ready to release (usually automated):
pnpm changeset version   # Bumps versions, generates changelogs
pnpm install              # Update lockfile
pnpm publish -r           # Publish to npm
```

### Root package.json Scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version && pnpm install",
    "release": "pnpm build && pnpm publish -r --access=public"
  }
}
```

---

## CI/CD Pipeline Examples

### GitHub Actions: Build + Test

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install
        run: pnpm install

      - name: Typecheck
        run: pnpm -r --parallel typecheck

      - name: Lint
        run: pnpm -r --parallel lint

      - name: Build (affected only)
        run: pnpm --filter "...[origin/main]" build

      - name: Test (affected only)
        run: pnpm --filter "...[origin/main]" test
```

### GitHub Actions: Automated Release with Changesets

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"

      - name: Install
        run: pnpm install

      - name: Build
        run: pnpm -r build

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm publish -r --access=public
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Why good:** `concurrency` prevents duplicate runs, `permissions` grants write access for PR creation, `changesets/action` auto-creates version bump PRs and publishes on merge, pnpm store is cached between runs

---

## Internal Package Setup Example

### Shared UI Package

```json
{
  "name": "@repo/ui",
  "version": "1.0.0",
  "private": true,
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./button": {
      "types": "./src/components/button/index.ts",
      "default": "./src/components/button/index.ts"
    }
  },
  "dependencies": {
    "@repo/types": "workspace:*"
  },
  "peerDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@repo/config-typescript": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**Why good:** `exports` defines explicit public API (prevents internal path imports), `sideEffects: false` enables tree-shaking, React in `peerDependencies` (not dependencies) prevents version duplication, `private: true` prevents accidental npm publish, source exports during development for fast HMR

### Shared Types Package

```json
{
  "name": "@repo/types",
  "version": "1.0.0",
  "private": true,
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "devDependencies": {
    "@repo/config-typescript": "workspace:*",
    "typescript": "catalog:"
  }
}
```

---

## Docker with pnpm Workspaces

### Multi-Stage Dockerfile

```dockerfile
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @repo/api build

# Stage 3: Production
FROM node:22-alpine AS runner
RUN corepack enable pnpm

WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

### Using pnpm deploy (Recommended)

```yaml
# pnpm-workspace.yaml
injectWorkspacePackages: true # Required for pnpm deploy
```

```dockerfile
FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/api build
RUN pnpm --filter @repo/api deploy ./pruned

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/pruned .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Why good:** `pnpm deploy` creates a standalone directory with only the production dependencies for a specific package, dramatically smaller Docker images, `injectWorkspacePackages: true` required for deploy to resolve workspace deps correctly

---

## Migration from npm/yarn

### Step-by-Step

```bash
# 1. Remove old lockfile and node_modules
rm -rf node_modules package-lock.json yarn.lock

# 2. Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# 3. Set packageManager in root package.json
# "packageManager": "pnpm@10.32.1"

# 4. Install with pnpm
pnpm install

# 5. Convert internal dependencies to workspace:*
# In each package.json, change "@repo/ui": "^1.0.0" to "@repo/ui": "workspace:*"

# 6. Re-install to generate proper lockfile
pnpm install
```

**Key differences from npm/yarn:**

- pnpm creates strict `node_modules` (no phantom dependencies)
- You may need to add missing dependency declarations that npm/yarn silently resolved
- `shamefullyHoist: true` can ease migration but should be removed once deps are fixed
