---
name: shared-tooling-typescript-config
description: Shared TypeScript strict mode configs, TS 5.x options (verbatimModuleSyntax, module preserve, moduleDetection force, configDir), path alias sync, specialized configs
---

# TypeScript Configuration Patterns

> **Quick Guide:** Shared TypeScript strict config in `packages/typescript-config/`. Enable `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `moduleDetection: "force"`. Use `${configDir}` (TS 5.5+) for portable paths. Sync path aliases between tsconfig and build tool.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable TypeScript strict mode (`strict: true`) in ALL tsconfig.json files - non-negotiable)**

**(You MUST use `verbatimModuleSyntax: true` to enforce explicit `import type` - replaces deprecated `importsNotUsedAsValues`)**

**(You MUST use shared config pattern (`packages/typescript-config/`) - never duplicate configs per package)**

**(You MUST sync path aliases between tsconfig.json and build tool (Vite/Next) - mismatches cause import resolution failures)**

**(You MUST use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"` for bundler-based projects)**

</critical_requirements>

---

**Auto-detection:** TypeScript config, tsconfig.json, tsconfig, strict mode, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax, moduleDetection force, module preserve, moduleResolution bundler, configDir, path aliases, typescript-config, shared config, noImplicitOverride, isolatedDeclarations, erasableSyntaxOnly

**When to use:**

- Setting up TypeScript strict mode in new or existing projects
- Creating shared tsconfig patterns for monorepo consistency
- Configuring TS 5.x+ modern module settings (preserve, bundler, verbatimModuleSyntax)
- Syncing path aliases between tsconfig and build tools (Vite, Next.js)
- Creating specialized configs (React, Node.js, library publishing)
- Migrating from deprecated TypeScript options
- Evaluating new TS features (`isolatedDeclarations`, `erasableSyntaxOnly`, `configDir`)

**When NOT to use:**

- Runtime TypeScript code patterns (see language/framework skills)
- ESLint TypeScript plugin configuration (see `shared-tooling-eslint-prettier`)
- Vite build configuration (see `web-tooling-vite`) - but DO keep path alias sync here
- Daily coding conventions like naming and imports (see CLAUDE.md)

**Key patterns covered:**

- Shared strict config base with all strict options explained
- Modern module settings (TS 5.x: preserve, bundler, verbatimModuleSyntax, moduleDetection)
- `${configDir}` template variable for portable shared configs (TS 5.5+)
- Path alias sync between tsconfig and build tools
- Specialized configs (react.json, node.json, library.json)
- `isolatedDeclarations` for parallel build support (TS 5.5+)
- `erasableSyntaxOnly` for Node.js direct execution (TS 5.8+)
- TypeScript 6.0 new defaults and deprecations
- `NoInfer<T>` utility type (TS 5.4+)

**Related skills:**

- `shared-tooling-eslint-prettier` for `consistent-type-imports` ESLint rule (enforces `import type`)
- `web-tooling-vite` for Vite path alias configuration (keep aliases in sync)
- For daily TypeScript enforcement rules (no unjustified `any`, explicit types), see CLAUDE.md

**Detailed resources:**

- For code examples, see [examples/typescript-config.md](examples/typescript-config.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

TypeScript configuration should be **strict by default, shared across packages, and forward-compatible**. Every project starts with the strictest settings. Shared configs prevent drift. Modern module settings align with bundler-based workflows.

**When to use this skill:**

- Setting up new apps or packages in a monorepo or standalone project
- Configuring strict type-checking for maximum safety
- Creating shared TypeScript configs for consistency across packages
- Evaluating modern TS features for adoption

**When NOT to use:**

- Runtime TypeScript patterns (this is compile-time configuration only)
- ESLint TypeScript rules (see eslint-prettier skill)
- Build tool configuration (see vite skill) - except path alias sync

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Shared Strict Config Base

TypeScript configurations live in `packages/typescript-config/` (monorepo) or a dedicated base config (standalone). All apps and packages extend the shared base.

#### Directory Structure

```
packages/typescript-config/
  base.json        # Shared strict settings (all projects extend this)
  react.json       # React-specific settings (extends base)
  node.json        # Node.js-specific settings (extends base)
  library.json     # Library publishing settings (extends base)
```

#### Base Config

```json
// packages/typescript-config/base.json
{
  "compilerOptions": {
    // Target & Module (TS 5.x recommended)
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",

    // Strict Mode (all enabled)
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Code Quality
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    // Module Interop
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // Build
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

```json
// apps/client-react/tsconfig.json
// ✅ Good - extends shared config, adds only app-specific settings
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Why good:** Shared strict mode prevents any types across entire monorepo, centralized config ensures all packages have same safety guarantees, path aliases eliminate relative import hell, noUncheckedIndexedAccess prevents undefined access bugs

```json
// ❌ Bad - loose config per package, not extending shared base
// apps/client-react/tsconfig.json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "skipLibCheck": true
  }
}
```

**Why bad:** Disabling strict mode allows implicit any types leading to runtime errors, no null checks cause undefined-is-not-a-function crashes, inconsistent configs across packages create different safety levels, developers switching packages lose type safety

---

### Pattern 2: Modern Module Settings (TS 5.x)

Modern TypeScript projects using bundlers (Vite, Webpack, esbuild) should use the `preserve`/`bundler` combination. TypeScript only type-checks; the bundler handles module resolution and output.

#### verbatimModuleSyntax (TS 5.0+)

Enforces explicit `import type` for type-only imports. Replaces deprecated `importsNotUsedAsValues` and `preserveValueImports`.

```typescript
// With verbatimModuleSyntax: true

// ✅ Good - explicit type import
import type { User } from "./types";
import { createUser } from "./api";
```

**Why good:** Prevents type imports from appearing in emitted JavaScript, enables tree-shaking, clarifies intent

```typescript
// ❌ Bad - type imported as value (will error with verbatimModuleSyntax)
import { User, createUser } from "./api";
```

**Why bad:** Type imports may or may not be elided depending on transpiler, causing inconsistent runtime behavior and preventing reliable tree-shaking

#### moduleDetection: "force" (TS 5.0+)

Forces all files to be treated as modules, even without `import`/`export` statements.

```json
{
  "compilerOptions": {
    "moduleDetection": "force"
  }
}
```

**Why use:** Prevents unexpected global scope pollution, ensures consistent module behavior across all files

#### module: "preserve" (TS 5.4+)

Preserves import/export syntax as-is for bundlers. Recommended with `moduleResolution: "bundler"`.

```json
// ✅ Good - bundler-based project (Vite, Webpack, esbuild)
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

**When to use:** Bundler-based projects (Vite, Webpack, esbuild) where TypeScript only type-checks

**When not to use:** Node.js packages that emit CJS/ESM directly - use `module: "node18"` or `"nodenext"` instead

---

### Pattern 3: ${configDir} Template Variable (TS 5.5+)

Enables portable shared configs with relative paths. `${configDir}` resolves to the directory of the config file that contains the path, making shared configs work correctly across different package locations.

```json
// packages/typescript-config/base.json
// ✅ Good - portable paths resolve relative to extending config
{
  "compilerOptions": {
    "outDir": "${configDir}/dist",
    "rootDir": "${configDir}/src"
  },
  "include": ["${configDir}/src"]
}
```

**Why good:** Shared configs can use paths relative to the extending config (not the base config), eliminating the need for each package to override `outDir`, `rootDir`, and `include`

```json
// ❌ Bad - hardcoded paths in shared config
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["./src"]
}
```

**Why bad:** Relative paths resolve from the base config location (`packages/typescript-config/`), not the extending package - every consumer must override these paths

**When to use:** Shared configs in monorepos where path options (`outDir`, `rootDir`, `include`, `exclude`) need to be relative to the consuming package

---

### Pattern 4: Path Alias Sync

Path aliases must be configured in BOTH `tsconfig.json` and the build tool (Vite, Next.js, etc.). A mismatch causes either TypeScript errors or build-time import resolution failures.

```json
// tsconfig.json
// ✅ Good - aliases defined for TypeScript resolution
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}
```

```typescript
// vite.config.ts
// ✅ Good - same aliases defined for Vite bundler resolution
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@components": path.resolve(__dirname, "./src/components"),
  }
}
```

**Why good:** Both TypeScript and the bundler resolve the same paths, preventing "module not found" errors at either type-check or build time

**Gotcha:** Forgetting to sync causes import resolution failures - TypeScript resolves fine but build fails (or vice versa). When adding a new alias, always update BOTH files.

---

### Pattern 5: Specialized Configs

Extend the base config for specific environments. Each specialized config inherits all strict settings and adds environment-specific options.

```json
// packages/typescript-config/react.json
// ✅ Good - extends base, adds React-specific settings only
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"]
  }
}
```

```json
// packages/typescript-config/node.json
// ✅ Good - extends base, overrides module settings for Node.js
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "node18",
    "moduleResolution": "node18",
    "lib": ["ES2022"],
    "verbatimModuleSyntax": true
  }
}
```

```json
// packages/typescript-config/library.json
// ✅ Good - extends base, enables declaration emit for library publishing
{
  "extends": "./base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": false
  }
}
```

**Why good:** Each environment gets strict base settings automatically, specialized configs only add what differs, single place to update strict settings for all packages

---

### Pattern 6: isolatedDeclarations (TS 5.5+)

Requires explicit type annotations on all exports. Enables faster parallel declaration emit by external tools (oxc, swc). Stable for basic use since TS 5.5 with ongoing improvements.

```json
{
  "compilerOptions": {
    "declaration": true,
    "isolatedDeclarations": true
  }
}
```

```typescript
// With isolatedDeclarations: true

// ✅ Good - explicit return type on export
export function getUser(id: string): User {
  return { id, name: "John" };
}

// ❌ Bad - inferred return type (will error)
export function getUser(id: string) {
  return { id, name: "John" };
}
```

**When to use:** Large monorepos wanting faster builds with tools like oxc or swc that can generate .d.ts files in parallel

**When not to use:** Small projects where the verbosity cost outweighs build speed benefits, application code that is never consumed as a library

**Trade-off:** More verbose code (explicit return types on all exports), but enables external tools to generate .d.ts files without full type-checking

---

### Pattern 7: erasableSyntaxOnly (TS 5.8+)

Prohibits TypeScript-specific constructs that have runtime behavior (enums, namespaces, parameter properties). Ensures compatibility with Node.js `--experimental-strip-types` for direct TypeScript execution.

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}
```

```typescript
// With erasableSyntaxOnly: true

// ✅ Good - type-only constructs (erased at runtime)
type Status = "active" | "inactive";
interface User {
  id: string;
  name: string;
}

// ✅ Good - const enum is erasable
const enum Direction {
  Up,
  Down,
}

// ❌ Bad - regular enum has runtime behavior (will error)
enum Direction {
  Up,
  Down,
}

// ❌ Bad - namespace has runtime behavior (will error)
namespace Utils {
  export function parse() {}
}

// ❌ Bad - parameter properties have runtime behavior (will error)
class User {
  constructor(public name: string) {}
}
```

**When to use:** Projects using Node.js `--experimental-strip-types` for direct TS execution without a build step, or projects targeting the TypeScript-as-types-only philosophy

**When not to use:** Projects that rely on enums, namespaces, or parameter properties extensively - migration cost may be high

---

### Pattern 8: TypeScript 5.4+ Utility Types

#### NoInfer<T> (TS 5.4+)

Prevents TypeScript from inferring a type from a specific position in generic functions. Useful when one parameter should match values from another parameter, not expand the inferred type.

```typescript
// ✅ Good - NoInfer ensures initial must be from states array
declare function createFSM<TState extends string>(config: {
  initial: NoInfer<TState>;
  states: TState[];
}): void;

createFSM({
  initial: "invalid", // Error: "invalid" not in states
  states: ["open", "closed"],
});
```

**Why good:** TypeScript infers `TState` from `states` array only, `initial` must match without widening the union

```typescript
// ❌ Bad - Without NoInfer, TypeScript infers union including initial
declare function createFSM<TState extends string>(config: {
  initial: TState;
  states: TState[];
}): void;

createFSM({
  initial: "invalid", // No error - inferred as "invalid" | "open" | "closed"
  states: ["open", "closed"],
});
```

**Why bad:** TypeScript infers `TState` from both `initial` and `states`, widening the union to include the invalid value

**When to use:** Generic functions where one parameter should match values from another, not expand the type

</patterns>

---

<decision_framework>

## Decision Framework

### Module Settings Selection

```
What module/moduleResolution to use?
├─ Bundler-based project (Vite, Webpack, esbuild)?
│   └─ YES → module: "preserve", moduleResolution: "bundler"
├─ Node.js package (direct execution)?
│   ├─ Node 20+?
│   │   └─ YES → module: "node20" (stable in TS 5.9+)
│   └─ Node 18+?
│       └─ YES → module: "node18" (TS 5.8+)
└─ Library consumed by both bundlers and Node?
    └─ module: "nodenext" (most compatible)
```

### Target Selection

```
What target to use?
├─ Bundler-based project (handles downleveling)?
│   └─ YES → target: "ES2022" (stable, well-supported)
├─ Node.js 18+?
│   └─ YES → target: "ES2022"
├─ Node.js 20+?
│   └─ YES → target: "ES2023"
└─ TS 6.0+ project?
    └─ target: "es2025" (new default)
```

### isolatedDeclarations Adoption

```
Should you enable isolatedDeclarations?
├─ Publishing library packages?
│   ├─ Large monorepo with many packages?
│   │   └─ YES → Enable (parallel .d.ts generation)
│   └─ Small library?
│       └─ Optional (benefit is marginal)
├─ Application code only (never consumed as library)?
│   └─ NO → Skip (adds verbosity for no benefit)
└─ Using oxc or swc for builds?
    └─ YES → Enable (these tools benefit most)
```

### erasableSyntaxOnly Adoption

```
Should you enable erasableSyntaxOnly?
├─ Using Node.js --experimental-strip-types?
│   └─ YES → Enable (required for compatibility)
├─ Project uses enums extensively?
│   └─ YES → NO (migration cost too high)
├─ Targeting types-only TypeScript philosophy?
│   └─ YES → Enable (enforces the pattern)
└─ Standard bundler-based project?
    └─ Optional (nice-to-have, not required)
```

### TypeScript 6.0 Migration

```
Preparing for TS 6.0?
├─ Already have strict: true?
│   └─ YES → Good, no change needed (6.0 makes it default)
├─ Using moduleResolution: "node" (node10)?
│   └─ YES → Migrate to "bundler" or "node18" (deprecated in 6.0)
├─ Using target: "es5"?
│   └─ YES → Migrate to "ES2022"+ (deprecated in 6.0)
├─ Using module: "amd" | "umd" | "systemjs"?
│   └─ YES → Migrate to "preserve" or "nodenext" (deprecated in 6.0)
└─ Using esModuleInterop: false?
    └─ YES → Remove it (esModuleInterop true is default in 6.0)
```

See [reference.md](reference.md) for additional decision frameworks and anti-patterns.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Disabling TypeScript strict mode (`strict: false`) - allows implicit any and null bugs across the project
- ❌ Missing `verbatimModuleSyntax: true` - type imports may or may not be elided depending on transpiler
- ❌ Not using shared configs in monorepo - configs drift causing inconsistent safety levels across packages
- ❌ Using deprecated `importsNotUsedAsValues` or `preserveValueImports` - replaced by `verbatimModuleSyntax` since TS 5.0

**Medium Priority Issues:**

- ⚠️ No path aliases configured (deep relative imports like `../../../lib/utils` break on refactor)
- ⚠️ Path aliases in tsconfig but not in build tool (or vice versa) - causes import resolution failures
- ⚠️ Using deprecated `target: "ES3"` or `target: "ES5"` (deprecated in TS 6.0, removed in TS 7.0)
- ⚠️ Using `moduleResolution: "node"` (node10) instead of `"bundler"` or `"node18"` (deprecated in TS 6.0)
- ⚠️ Duplicated config per package instead of extending shared base

**Common Mistakes:**

- Forgetting to sync tsconfig paths with Vite `resolve.alias` (causes import resolution failures at build time)
- Using relative paths (`./dist`) in shared base config instead of `${configDir}/dist` (resolves from wrong directory)
- Setting `noEmit: true` in library configs that need declaration output (use `noEmit: false` with `declaration: true`)
- Explicitly listing individual strict options when `strict: true` already enables them (redundant, but acceptable as documentation)

**Gotchas & Edge Cases:**

- `${configDir}` resolves to the directory of the config file that **contains** the path, not the file that extends it. In extended configs, it resolves relative to the leaf config.
- `verbatimModuleSyntax` requires ALL type-only imports to use `import type` syntax - mixed imports like `import { Type, value }` will error if `Type` is type-only
- `exactOptionalPropertyTypes` means `{ key?: string }` does NOT accept `{ key: undefined }` - only omission or `string`. This can surprise developers.
- `noUncheckedIndexedAccess` adds `| undefined` to ALL index signatures, including arrays - use `for...of` or guard with `if` checks
- `module: "preserve"` only works with `noEmit: true` or `emitDeclarationOnly: true` - it cannot be used when TypeScript is emitting JavaScript
- TypeScript 6.0 changes several defaults (`strict: true`, `module: "esnext"`, `target: "es2025"`) - new projects on TS 6.0+ get these automatically, but set `"ignoreDeprecations": "6.0"` during migration to suppress warnings for deprecated options
- `--module node20` (TS 5.9+) implies `--target es2023` by default, unlike `nodenext` which implies `esnext`
- `isolatedDeclarations` requires explicit type annotations on ALL exports, including re-exports - can require significant refactoring in existing codebases

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable TypeScript strict mode (`strict: true`) in ALL tsconfig.json files - non-negotiable)**

**(You MUST use `verbatimModuleSyntax: true` to enforce explicit `import type` - replaces deprecated `importsNotUsedAsValues`)**

**(You MUST use shared config pattern (`packages/typescript-config/`) - never duplicate configs per package)**

**(You MUST sync path aliases between tsconfig.json and build tool (Vite/Next) - mismatches cause import resolution failures)**

**(You MUST use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"` for bundler-based projects)**

**Failure to follow these rules will cause type-safety gaps, inconsistent configs, and import resolution failures.**

</critical_reminders>
