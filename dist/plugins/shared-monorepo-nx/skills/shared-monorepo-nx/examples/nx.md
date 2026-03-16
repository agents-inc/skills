# Nx - Practical Examples

> Complete examples for Nx workspace setup, task pipelines, caching, affected commands, and custom generators. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for CLI reference.

---

## Workspace Setup

### Creating a New Nx Workspace

```bash
# Create workspace with React preset
npx create-nx-workspace@latest my-org --preset=react-monorepo --bundler=vite

# Create workspace with Next.js
npx create-nx-workspace@latest my-org --preset=next

# Create workspace with Angular
npx create-nx-workspace@latest my-org --preset=angular-monorepo

# Create empty workspace (add plugins later)
npx create-nx-workspace@latest my-org --preset=ts

# Add Nx to an existing monorepo
npx nx init
```

### Typical Directory Structure

```
my-org/
├── apps/
│   ├── web/                    # Next.js or React app
│   │   ├── src/
│   │   ├── project.json        # Only overrides (or omitted entirely)
│   │   ├── vite.config.ts      # Plugin infers build/serve/test
│   │   └── tsconfig.json
│   └── api/                    # Node.js API server
│       ├── src/
│       ├── project.json
│       └── tsconfig.json
├── libs/
│   ├── shared/
│   │   ├── ui/                 # Shared UI components
│   │   │   ├── src/
│   │   │   ├── vite.config.ts
│   │   │   └── tsconfig.json
│   │   └── types/              # Shared TypeScript types
│   │       ├── src/
│   │       └── tsconfig.json
│   └── feature/
│       └── auth/               # Auth feature library
│           ├── src/
│           ├── vite.config.ts
│           └── tsconfig.json
├── tools/
│   └── generators/             # Custom workspace generators
├── nx.json                     # Workspace configuration
├── tsconfig.base.json          # Shared TypeScript config
└── package.json
```

---

## Complete nx.json Configuration

### Good Example — Production-ready nx.json

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.spec.tsx",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/**/*.test.tsx",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.ts",
      "!{projectRoot}/vitest.config.ts",
      "!{projectRoot}/.eslintrc.json"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.github/workflows/*"
    ]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": [
        "default",
        "^production",
        { "externalDependencies": ["vitest"] }
      ],
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "cache": true
    },
    "lint": {
      "inputs": ["default", "{workspaceRoot}/eslint.config.js"],
      "cache": true
    },
    "serve": {
      "cache": false,
      "continuous": true
    },
    "e2e": {
      "dependsOn": [{ "target": "serve", "params": "ignore" }],
      "inputs": ["default", "^production"],
      "cache": true
    }
  },
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve",
        "testTargetName": "test",
        "serveStaticTargetName": "preview"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/playwright/plugin",
      "include": ["apps/*-e2e/**/*"],
      "options": {
        "targetName": "e2e"
      }
    }
  ],
  "generators": {
    "@nx/react:library": {
      "bundler": "vite",
      "unitTestRunner": "vitest",
      "style": "scss"
    },
    "@nx/react:component": {
      "style": "scss"
    }
  },
  "nxCloudId": "your-nx-cloud-id",
  "maxCacheSize": "10GB",
  "parallel": 3
}
```

**Why good:** Complete configuration covering caching, ordering, inferred tasks, and cloud integration. `namedInputs` separate production from test files. Plugins auto-detect targets. Generator defaults enforce consistency.

### Bad Example — Incomplete nx.json

```json
{
  "targetDefaults": {
    "build": {
      "outputs": ["dist/**"]
    },
    "test": {},
    "serve": {}
  }
}
```

**Why bad:** No `dependsOn` on build (broken ordering), no `inputs` (unreliable cache keys), no `cache: true` on test (caching disabled), no `cache: false` on serve (may try to cache dev server), no `namedInputs` (test changes bust build cache), no plugins (must manually configure every project), relative `outputs` path instead of `{projectRoot}/dist`

---

## Task Pipeline Examples

### Build Pipeline with Topological Ordering

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    }
  }
}
```

When you run `nx build web`, Nx:

1. Analyzes the project graph to find `web`'s dependencies (e.g., `shared-ui`, `shared-types`)
2. Builds `shared-types` first (leaf dependency)
3. Builds `shared-ui` next (depends on `shared-types`)
4. Builds `web` last (depends on both)
5. Caches each step. Next run with no changes: instant.

### E2E Pipeline with Continuous Serve

```json
{
  "targetDefaults": {
    "e2e": {
      "dependsOn": [{ "target": "serve", "params": "ignore" }],
      "cache": true
    },
    "serve": {
      "continuous": true,
      "cache": false
    }
  }
}
```

**Why good:** `continuous: true` on serve means Nx starts the dev server and immediately proceeds to run e2e tests without waiting for serve to "exit." Without `continuous: true`, the e2e task waits forever.

---

## Caching Examples

### Named Inputs for Fine-Grained Cache Control

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/test-setup.ts",
      "!{projectRoot}/vitest.config.ts"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.env"
    ]
  }
}
```

**Scenario:** You modify `libs/shared/ui/src/button.spec.ts` (a test file).

- `build` uses `production` input → test file is excluded → build cache is **not** invalidated
- `test` uses `default` input → test file is included → test cache **is** invalidated
- Result: `nx build shared-ui` is instant (cache hit), `nx test shared-ui` reruns

### External Dependency Tracking

```json
{
  "targetDefaults": {
    "test": {
      "inputs": [
        "default",
        "^production",
        { "externalDependencies": ["vitest", "@testing-library/react"] }
      ],
      "cache": true
    }
  }
}
```

**Why good:** Upgrading vitest or testing-library invalidates test caches (new test runner might produce different results), but upgrading an unrelated dependency does not.

### Next.js Output Caching

```json
{
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/.next/**", "!{projectRoot}/.next/cache/**"],
      "cache": true
    }
  }
}
```

**Why good:** Caches `.next/` build output but excludes `.next/cache/` (Next.js internal cache) to avoid caching the cache and bloating storage.

---

## Affected Command Examples

### CI Pipeline (GitHub Actions)

```yaml
name: CI
on: [pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for affected detection

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      # Set SHAs for affected comparison
      - uses: nrwl/nx-set-shas@v4

      # Run only affected targets
      - run: npx nx affected -t lint test build --parallel=3
```

**Why good:** `fetch-depth: 0` provides full git history for affected analysis, `nrwl/nx-set-shas@v4` sets base/head SHAs correctly, `--parallel=3` runs up to 3 tasks concurrently

### Affected with Nx Cloud

```yaml
name: CI
on: [pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - uses: nrwl/nx-set-shas@v4

      # Nx Cloud handles distribution automatically
      - run: npx nx affected -t lint test build e2e
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

**Why good:** Nx Cloud remote cache means tasks computed by other developers or previous CI runs are reused. No extra configuration needed beyond the token.

### Local Affected Usage

```bash
# See what's affected compared to main
npx nx affected --graph

# Run tests for affected projects
npx nx affected -t test

# Build only affected, compare against specific commit
npx nx affected -t build --base=HEAD~3

# List affected projects (useful for scripting)
npx nx show projects --affected
```

---

## Generator Examples

### Creating Libraries

```bash
# Create a buildable React library
npx nx g @nx/react:library shared-ui \
  --directory=libs/shared/ui \
  --bundler=vite \
  --unitTestRunner=vitest \
  --style=scss

# Create a publishable TypeScript library
npx nx g @nx/js:library utils \
  --directory=libs/shared/utils \
  --publishable \
  --importPath=@my-org/utils

# Create a feature library (non-buildable, internal only)
npx nx g @nx/react:library feature-auth \
  --directory=libs/feature/auth \
  --bundler=none
```

### Creating Applications

```bash
# Create a Next.js application
npx nx g @nx/next:application web \
  --directory=apps/web \
  --style=scss

# Create a Node API application
npx nx g @nx/node:application api \
  --directory=apps/api

# Create an Angular application
npx nx g @nx/angular:application admin \
  --directory=apps/admin \
  --style=scss
```

### Creating Components

```bash
# Create a React component in a library
npx nx g @nx/react:component button \
  --project=shared-ui \
  --directory=libs/shared/ui/src/lib/button \
  --style=scss

# Dry run to preview generated files
npx nx g @nx/react:component button \
  --project=shared-ui \
  --dry-run
```

---

## Custom Generator Example

### Generator Structure

```
tools/
└── generators/
    └── feature-lib/
        ├── index.ts         # Generator entry point
        ├── schema.json      # Input schema
        └── files/           # Template files
            └── src/
                └── index.ts__tmpl__
```

### Generator Implementation

```typescript
// tools/generators/feature-lib/index.ts
import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from "@nx/devkit";

interface FeatureLibGeneratorSchema {
  name: string;
  directory: string;
}

function featureLibGenerator(tree: Tree, options: FeatureLibGeneratorSchema) {
  const normalizedNames = names(options.name);
  const projectRoot = joinPathFragments(
    "libs",
    options.directory,
    normalizedNames.fileName,
  );

  generateFiles(tree, joinPathFragments(__dirname, "files"), projectRoot, {
    ...normalizedNames,
    tmpl: "",
  });

  formatFiles(tree);
}

export { featureLibGenerator };
export default featureLibGenerator;
```

### Generator Schema

```json
{
  "$schema": "https://json-schema.org/schema",
  "cli": "nx",
  "id": "feature-lib",
  "title": "Create Feature Library",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": { "$source": "argv", "index": 0 }
    },
    "directory": {
      "type": "string",
      "description": "Directory within libs/",
      "default": "feature"
    }
  },
  "required": ["name"]
}
```

### Using the Custom Generator

```bash
# Register in nx.json
# Add to "plugins" or configure in workspace.json

# Run the generator
npx nx g @my-org/tools:feature-lib auth --directory=feature
```

---

## Release Management Examples

### Fixed Release (All Packages Together)

```json
{
  "release": {
    "projects": ["libs/*"],
    "projectsRelationship": "fixed",
    "version": {
      "conventionalCommits": true
    },
    "changelog": {
      "workspaceChangelog": {
        "createRelease": "github",
        "file": "{workspaceRoot}/CHANGELOG.md"
      }
    },
    "git": {
      "commit": true,
      "tag": true
    }
  }
}
```

```bash
# Preview release
npx nx release --dry-run

# Execute release
npx nx release

# First release (skip changelog comparison)
npx nx release --first-release
```

### Independent Release (Per-Package Versioning)

```json
{
  "release": {
    "projects": ["libs/*"],
    "projectsRelationship": "independent",
    "version": {
      "conventionalCommits": true,
      "updateDependents": "always",
      "preserveMatchingDependencyRanges": true
    },
    "changelog": {
      "projectChangelogs": {
        "file": "{projectRoot}/CHANGELOG.md",
        "createRelease": "github"
      }
    },
    "releaseTag": {
      "pattern": "{projectName}-v{version}"
    },
    "git": {
      "commit": true,
      "tag": true
    }
  }
}
```

**Why good:** Each package versions independently, dependent packages get dependency bumps automatically (`updateDependents: "always"`), per-project changelogs and GitHub releases, clear tag naming (`shared-ui-v1.2.3`)

### Version Plans (File-Based Versioning)

```json
{
  "release": {
    "projects": ["libs/*"],
    "versionPlans": true,
    "version": {
      "conventionalCommits": false
    }
  }
}
```

```bash
# Developer creates a version plan when making changes
npx nx release plan minor -m "Add new Button variants"
# Creates .nx/version-plans/plan-abc123.md

# Release manager applies all pending version plans
npx nx release
```

**When to use:** Teams that want explicit control over version bumps rather than deriving from commit messages.

---

## Module Federation Examples

### Setting Up Host + Remotes

```bash
# Create host application
npx nx g @nx/react:host shell --directory=apps/shell

# Create remote applications
npx nx g @nx/react:remote shop --directory=apps/shop --host=shell
npx nx g @nx/react:remote cart --directory=apps/cart --host=shell
```

### Serving the Full System

```bash
# Serve host with all remotes
npx nx serve shell --devRemotes=shop,cart

# Serve host with only one remote in dev mode (others use production builds)
npx nx serve shell --devRemotes=shop
```

### Dynamic Module Federation Manifest

```json
{
  "shop": "http://localhost:4201",
  "cart": "http://localhost:4202"
}
```

**Why good:** Remote URLs resolved at runtime, not hardcoded at build time. Host does not need to rebuild when remotes change. Enables independent deployment of micro-frontends.

---

## Migration Examples

### Upgrading Nx Versions

```bash
# Check for available updates
npx nx migrate latest

# This generates:
# 1. Updated package.json with new versions
# 2. migrations.json with migration scripts

# Install updated dependencies
npm install

# Run the migrations
npx nx migrate --run-migrations

# Clean up
rm migrations.json
```

### Adding Nx to an Existing Project

```bash
# Initialize Nx in existing monorepo
npx nx init

# Add specific plugin
npx nx add @nx/react
npx nx add @nx/vite

# Verify inferred tasks
npx nx show project my-app
```

---

## TypeScript Project References Setup

### tsconfig.base.json (Workspace Root)

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "bundler",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es2015",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@my-org/shared-ui": ["libs/shared/ui/src/index.ts"],
      "@my-org/shared-types": ["libs/shared/types/src/index.ts"],
      "@my-org/utils": ["libs/shared/utils/src/index.ts"]
    }
  }
}
```

**Why good:** Centralized path mappings enable TypeScript imports across workspace without publishing packages. Editors resolve types correctly. Nx uses these paths to build the project graph.

---

## Nx Console (IDE Integration)

### VS Code Setup

```bash
# Install via VS Code marketplace
# Extension: "Nx Console" by Nrwl

# Features available:
# - Visual project graph
# - Run targets from the sidebar
# - Generate code with GUI forms
# - Explore inferred task configuration
# - Nx Cloud integration (PR status, self-healing fixes)
```

### Verifying Inferred Tasks

```bash
# Show all targets for a project (including inferred)
npx nx show project my-app

# Output shows:
# build    - inferred by @nx/vite/plugin
# serve    - inferred by @nx/vite/plugin
# test     - inferred by @nx/vite/plugin
# lint     - inferred by @nx/eslint/plugin
# preview  - inferred by @nx/vite/plugin
```

**Why useful:** Confirms which targets are inferred vs manually configured. Helps identify when `project.json` overrides are needed vs unnecessary.
