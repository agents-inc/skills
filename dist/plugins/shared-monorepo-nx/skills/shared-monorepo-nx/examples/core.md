# Nx - Workspace Setup Examples

> Core patterns for nx.json configuration and workspace structure. See [SKILL.md](../SKILL.md) for concepts and decision guidance.

**Related examples:**

- [tasks.md](tasks.md) - Task pipelines, caching, affected commands
- [generators.md](generators.md) - Built-in and custom generators
- [ci.md](ci.md) - CI pipelines, Nx Cloud, release management

---

## Typical Directory Structure

```
my-org/
├── apps/
│   ├── web/                    # Frontend application
│   │   ├── src/
│   │   ├── project.json        # Only overrides (or omitted entirely)
│   │   ├── vite.config.ts      # Plugin infers build/serve/test
│   │   └── tsconfig.json
│   └── api/                    # Backend API server
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

## Verifying Inferred Tasks

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
