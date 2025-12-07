# Internal Package Conventions

> **Quick Guide:** Internal packages live in `packages/`. Use `@repo/*` naming convention. Define explicit exports in `package.json`. Named exports only (no default exports). kebab-case for all files and directories. Use `workspace:*` for internal dependencies.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST use `workspace:*` protocol for ALL internal package dependencies)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

</critical_requirements>

---

**Auto-detection:** Internal packages, @repo/* packages, package.json exports, workspace dependencies, shared configurations

**When to use:**

- Creating new internal packages in `packages/`
- Configuring package.json exports for tree-shaking
- Setting up shared configuration packages (@repo/eslint-config, @repo/typescript-config)
- Understanding import/export conventions

**Key patterns covered:**

- Package structure and naming conventions
- package.json configuration (exports, main, types, sideEffects)
- Named exports and barrel file patterns
- Internal dependencies with workspace protocol
- Shared configuration package patterns

**Related skills:**

- For Turborepo orchestration and workspaces, see `setup/monorepo/basic.md`
- For ESLint, Prettier, TypeScript shared configs, see `setup/tooling/basic.md`

---

<philosophy>

## Philosophy

Internal packages in a monorepo enable code sharing without duplication while maintaining strict boundaries and explicit APIs. The `@repo/*` namespace makes internal packages immediately recognizable, and explicit `exports` fields prevent coupling to internal implementation details.

**When to use internal packages:**

- Sharing UI components across multiple apps
- Centralizing API client logic
- Distributing shared configuration (ESLint, TypeScript, Prettier)
- Reusing utility functions across projects
- Creating domain-specific libraries (auth, analytics, etc.)

**When NOT to use:**

- For app-specific code that won't be shared
- When a single file would suffice (don't over-abstract)
- For external dependencies (use npm packages instead)
- When the overhead of package management exceeds benefits

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Package Structure and Naming

Standard internal package structure with `@repo/*` naming and kebab-case files.

#### Directory Layout

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

**Why good:** `@repo/*` namespace makes internal packages instantly recognizable, kebab-case ensures cross-platform compatibility, consistent structure reduces cognitive load when navigating monorepo

#### Naming Conventions

```typescript
// ✅ Good Example - Package naming
// package.json
{
  "name": "@repo/ui",           // @repo/* prefix, kebab-case
  "name": "@repo/api-client",   // Multi-word: kebab-case
  "name": "@repo/eslint-config" // Config package: kebab-case
}

// ✅ Good Example - File naming
// button.tsx (NOT Button.tsx)
// use-auth.ts (NOT useAuth.ts)
// api-client.ts (NOT apiClient.ts or api_client.ts)

// ✅ Good Example - Export naming
export { Button } from "./button";              // PascalCase for components
export { useAuth, formatDate } from "./utils";   // camelCase for functions/hooks
export { API_TIMEOUT_MS } from "./constants";    // SCREAMING_SNAKE_CASE for constants
```

**Why good:** Consistent naming enables predictable imports, kebab-case files work across all OS filesystems, @repo prefix prevents namespace collisions with npm packages

```typescript
// ❌ Bad Example - Inconsistent naming
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

### Pattern 2: package.json Configuration

Complete package.json setup with exports, workspace dependencies, and tree-shaking configuration.

#### Essential Fields

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
// ❌ Bad Example - Missing exports and wrong dependencies
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

#### Exports Field Pattern

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
// ❌ Bad Example - No exports or barrel file anti-pattern
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

#### Usage Pattern

```typescript
// ✅ Good Example - Import from explicit exports
import { Button } from "@repo/ui/button";
import { Switch } from "@repo/ui/switch";
import { useClickOutside } from "@repo/ui/hooks";
```

**Why good:** Each import maps to a single file, bundler can tree-shake unused components, clear and predictable import paths

```typescript
// ❌ Bad Example - Import from internal paths
import { Button } from "@repo/ui/src/components/button/button";
import { Switch } from "@repo/ui/src/components/switch/switch";
```

**Why bad:** Couples to internal file structure, breaks when package refactors, bypasses intended public API, tree-shaking may fail

---

### Pattern 3: Tree-Shaking Configuration

Mark packages as side-effect-free for aggressive tree-shaking.

```json
{
  "sideEffects": false
}
```

**Why good:** Tells bundlers they can safely remove unused exports, enables aggressive dead code elimination, reduces bundle size significantly

```json
// ❌ Bad Example - Missing sideEffects field
{
  "name": "@repo/ui",
  // BAD: No sideEffects field - bundler must assume side effects exist
  "exports": {
    "./button": "./src/components/button/button.tsx"
  }
}
```

**Why bad:** Bundler cannot safely tree-shake unused code, entire module graph may be included even if only one export is used, larger bundle sizes

#### With CSS/SCSS Files

```json
// ✅ Good Example - Mark CSS as side effects
{
  "sideEffects": ["*.css", "*.scss"]
}
```

**Why good:** CSS imports must always execute, bundler knows to keep CSS files while still tree-shaking JS exports

---

### Pattern 4: Workspace Dependencies

Use `workspace:*` protocol for all internal dependencies to ensure local versions are always used.

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/api": "workspace:*"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*"
  }
}
```

**Why good:** Always uses local workspace version, prevents version conflicts in monorepo, automatic symlinking by package manager, instant updates when packages change

```json
// ❌ Bad Example - Hardcoded versions
{
  "dependencies": {
    "@repo/ui": "^1.0.0",            // BAD: Hardcoded version
    "@repo/api": "1.2.3"             // BAD: Specific version
  },
  "devDependencies": {
    "@repo/eslint-config": "latest"  // BAD: Using 'latest'
  }
}
```

**Why bad:** Hardcoded versions create conflicts when local package changes, breaks monorepo symlink benefits, requires manual version bumps, can install from npm instead of using local version

---

### Pattern 5: Barrel Files (Use Sparingly)

Barrel files for small groups only, prefer package.json exports for tree-shaking.

```typescript
// ✅ Good Example - Small barrel file for related items
// packages/ui/src/hooks/index.ts
export { useClickOutside } from "./use-click-outside";
export { useDebounce } from "./use-debounce";
export { useMediaQuery } from "./use-media-query";
export type { DebounceOptions } from "./use-debounce";
```

**Why good:** Small barrels (<10 exports) group related items, package.json exports still controls public API, manageable cognitive load

**When to use:** Only for grouping 3-10 tightly related exports (e.g., hooks, utils)

```typescript
// ❌ Bad Example - Giant barrel file
// packages/ui/src/index.ts
export * from "./components/button/button";
export * from "./components/switch/switch";
export * from "./components/dialog/dialog";
export * from "./components/input/input";
// ... 50 more exports
```

**Why bad:** Giant barrels break tree-shaking (bundler loads entire file), slow TypeScript compilation, IDE struggles with autocomplete, defeats purpose of explicit exports

**When not to use:** For large numbers of exports, prefer explicit package.json exports field instead

</patterns>

---

<decision_framework>

## Decision Framework

```
Creating new code in monorepo?
├─ Is it shared across 2+ apps?
│   ├─ YES → Create internal package
│   └─ NO → Keep in app directory
│
└─ Creating internal package?
    ├─ Component library? → @repo/ui with React peerDeps
    ├─ API client? → @repo/api with sideEffects:false
    ├─ Config (ESLint/TS/Prettier)? → @repo/*-config
    └─ Utils? → @repo/utils with sideEffects:false

Configuring package.json?
├─ Set "exports" field → Explicit API surface
├─ Set "sideEffects" → false (or ["*.css"] if styles)
├─ Internal deps → Use "workspace:*"
└─ React dependency → Use "peerDependencies"

Importing from packages?
├─ Types only? → import type { }
├─ Components/functions → import { } from "@repo/*/export-name"
└─ NEVER → import from internal paths
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Default exports in library packages (breaks tree-shaking and naming consistency)
- ❌ Missing `exports` field in package.json (allows importing internal paths)
- ❌ Hardcoded versions for internal deps instead of `workspace:*` (version conflicts)
- ❌ React in `dependencies` instead of `peerDependencies` (version duplication)

**Medium Priority Issues:**

- ⚠️ Giant barrel files re-exporting everything (negates tree-shaking benefits)
- ⚠️ Missing `sideEffects` field (prevents aggressive tree-shaking)
- ⚠️ Importing from internal paths instead of package exports
- ⚠️ PascalCase file names (breaks on case-sensitive filesystems)

**Common Mistakes:**

- Using custom namespace like `@mycompany/*` instead of `@repo/*`
- Creating internal packages for app-specific code (over-abstraction)
- Missing `private: true` (can accidentally publish to npm)
- Using star imports `import *` (breaks tree-shaking)

**Gotchas & Edge Cases:**

- `workspace:*` is replaced with actual version on publish (if you ever publish)
- CSS/SCSS files must be marked as `sideEffects` even if package is otherwise pure
- TypeScript `paths` mapping may be needed for some bundlers (Next.js handles automatically)
- Barrel files slow down hot module replacement (HMR) in development
- Package.json `exports` field is strict - missing exports cannot be imported

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST use `workspace:*` protocol for ALL internal package dependencies)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

**Failure to follow these rules will break tree-shaking, cause version conflicts, and create coupling to internal implementation details.**

</critical_reminders>

---

## Package Types and Examples

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

## Common Anti-Patterns

**NEVER do these:**

- Default exports in library packages (breaks tree-shaking, naming conflicts)
- Importing from internal paths (`@repo/ui/src/components/...`)
- Giant barrel files that re-export everything
- Missing `exports` field (consumers can import anything)
- Hardcoded versions instead of `workspace:*` for internal deps
- Mixed naming conventions (some PascalCase files, some kebab-case)
- `dependencies` instead of `peerDependencies` for React

---

## Checklist: New Package

- [ ] Directory in `packages/`
- [ ] `package.json` with `@repo/` prefix name
- [ ] `private: true` set
- [ ] `exports` field configured
- [ ] `sideEffects` field set
- [ ] `workspace:*` for internal dependencies
- [ ] `peerDependencies` for React (if applicable)
- [ ] `tsconfig.json` extending `@repo/typescript-config`
- [ ] `eslint.config.js` extending `@repo/eslint-config`
- [ ] kebab-case file naming
- [ ] Named exports only

---

## Resources

**Official documentation:**

- Node.js Package Exports: https://nodejs.org/api/packages.html#exports
- TypeScript Module Resolution: https://www.typescriptlang.org/docs/handbook/modules/reference.html
- Bun Workspaces: https://bun.sh/docs/install/workspaces

**Related:**

- Tree-shaking: https://webpack.js.org/guides/tree-shaking/
- Package.json exports: https://nodejs.org/api/packages.html#package-entry-points
