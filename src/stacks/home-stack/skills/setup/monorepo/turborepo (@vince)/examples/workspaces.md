# Turborepo - Workspace Examples

> Workspace protocol, syncpack, and dependency boundary patterns. See [../SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for essential task pipeline patterns.

**Related Examples:**
- [core.md](core.md) - Essential task pipeline patterns (prerequisite)
- [caching.md](caching.md) - Remote caching, CI/CD integration
- [packages.md](packages.md) - Internal package conventions

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
