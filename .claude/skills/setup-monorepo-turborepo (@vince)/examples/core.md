# Turborepo - Core Examples

> Essential task pipeline patterns for Turborepo. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [caching.md](caching.md) - Remote caching, CI/CD integration
- [workspaces.md](workspaces.md) - Workspace protocol, syncpack, dependency boundaries
- [packages.md](packages.md) - Internal package conventions, exports, creating packages

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
      "inputs": [
        "$TURBO_DEFAULT$",
        "src/**/*.tsx",
        "src/**/*.ts",
        "test/**/*.ts",
        "test/**/*.tsx"
      ]
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
