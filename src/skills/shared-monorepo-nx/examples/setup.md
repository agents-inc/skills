# Nx - Workspace Setup Examples

> Complete examples for creating Nx workspaces, directory structure, and nx.json configuration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [tasks.md](tasks.md) - Task pipelines, caching, affected commands
- [generators.md](generators.md) - Built-in and custom generators
- [ci.md](ci.md) - CI pipelines, Nx Cloud, release management

---

## Creating a New Nx Workspace

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

---

## Typical Directory Structure

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

### Good Example - Production-ready nx.json

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

### Bad Example - Incomplete nx.json

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

## Adding Nx to an Existing Project

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
