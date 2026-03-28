# pnpm Workspaces -- Shared Packages Examples

> Workspace protocol, internal packages, and shared configuration examples. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Workspace initialization, pnpm-workspace.yaml, settings
- [scripts.md](scripts.md) -- Running scripts, filtering, dependency management
- [publishing.md](publishing.md) -- Changesets, versioning, publishing
- [ci.md](ci.md) -- CI/CD pipelines, GitHub Actions, Docker

---

## Workspace Protocol

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

### Aliasing

```json
{
  "dependencies": {
    "ui-v2": "workspace:@repo/ui@*"
  }
}
```

**When to use:** Migrating between package versions in the same workspace, running two versions of an internal package side by side

---

## Catalog Examples

### Default Catalog

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.7.0
  vitest: ^3.0.0
  zod: ^3.24.0
```

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
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

## Internal Package Examples

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
