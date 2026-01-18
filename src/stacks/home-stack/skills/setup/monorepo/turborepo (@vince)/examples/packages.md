# Turborepo - Internal Package Examples

> Internal package conventions, exports, and creation patterns. See [../SKILL.md](../SKILL.md) for core concepts and [../reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [workspaces.md](workspaces.md) - Workspace protocol (prerequisite)
- [core.md](core.md) - Essential task pipeline patterns
- [caching.md](caching.md) - Remote caching, CI/CD integration

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

---
