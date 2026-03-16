---
name: shared-tooling-typescript-config
description: TypeScript strict mode configs, TS 5.x+ options (verbatimModuleSyntax, module preserve, moduleDetection force, configDir), path alias sync, specialized configs
---

# TypeScript Configuration Patterns

> **Quick Guide:** Shared TypeScript strict config in `packages/typescript-config/`. Enable `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `moduleDetection: "force"`. Use `${configDir}` (TS 5.5+) for portable paths. Sync path aliases between tsconfig and your build tool.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable TypeScript strict mode (`strict: true`) in ALL tsconfig.json files - non-negotiable)**

**(You MUST use `verbatimModuleSyntax: true` to enforce explicit `import type` - replaces deprecated `importsNotUsedAsValues`)**

**(You MUST use shared config pattern (`packages/typescript-config/`) in monorepos - never duplicate configs per package)**

**(You MUST sync path aliases between tsconfig.json and your build tool - mismatches cause import resolution failures)**

**(You MUST use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"` for bundler-based projects)**

</critical_requirements>

---

**Auto-detection:** TypeScript config, tsconfig.json, tsconfig, strict mode, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax, moduleDetection force, module preserve, moduleResolution bundler, configDir, path aliases, typescript-config, shared config, noImplicitOverride, isolatedDeclarations, erasableSyntaxOnly, import defer, stableTypeOrdering

**When to use:**

- Setting up TypeScript strict mode in new or existing projects
- Creating shared tsconfig patterns for monorepo consistency
- Configuring TS 5.x+ modern module settings (preserve, bundler, verbatimModuleSyntax)
- Syncing path aliases between tsconfig and your build tool
- Creating specialized configs (React, Node.js, library publishing)
- Migrating from deprecated TypeScript options
- Evaluating new TS features (`isolatedDeclarations`, `erasableSyntaxOnly`, `configDir`, `import defer`)

**When NOT to use:**

- Runtime TypeScript code patterns (see language/framework skills)
- Linter configuration (separate skill)
- Build tool configuration (separate skill) - but DO keep path alias sync guidance here
- Daily coding conventions like naming and imports (see CLAUDE.md)

**Key patterns covered:**

- Shared strict config base with monorepo extension pattern
- Modern module settings (TS 5.x+: preserve, bundler, verbatimModuleSyntax, moduleDetection)
- `${configDir}` template variable for portable shared configs (TS 5.5+)
- Path alias sync between tsconfig and build tools
- Specialized configs (react.json, node.json, library.json)
- `isolatedDeclarations` for parallel build support (TS 5.5+)
- `erasableSyntaxOnly` for Node.js direct execution (TS 5.8+)
- `import defer` for deferred module evaluation (TS 5.9+)
- TypeScript 6.0 new defaults and deprecations

**Detailed resources:**

- [examples/core.md](examples/core.md) - Full config examples, specialized configs, TS 5.x+ features
- [reference.md](reference.md) - Decision frameworks, anti-patterns, gotchas

---

<philosophy>

## Philosophy

TypeScript configuration should be **strict by default, shared across packages, and forward-compatible**. Every project starts with the strictest settings. Shared configs prevent drift. Modern module settings align with bundler-based workflows.

**Core principles:**

1. **Strict by default** - `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
2. **Share, don't duplicate** - Monorepo configs extend a shared base; standalone projects use the same strict options
3. **Modern module mode** - `module: "preserve"` + `moduleResolution: "bundler"` for bundler projects; `"node18"`/`"node20"` for Node.js
4. **Path alias parity** - Aliases must exist in both tsconfig AND the build tool

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Shared Strict Config Base

All apps and packages extend a shared strict base. The base config lives in `packages/typescript-config/` (monorepo) or is inlined in a standalone project.

```json
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",

    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "incremental": true
  }
}
```

```json
// apps/web/tsconfig.json - extends shared config
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**Why good:** Single source of truth for strict settings, all packages get the same safety guarantees, consumers only add what differs

> See [examples/core.md](examples/core.md) for specialized configs (react.json, node.json, library.json).

---

### Pattern 2: Modern Module Settings (TS 5.x+)

#### verbatimModuleSyntax (TS 5.0+)

Enforces explicit `import type` for type-only imports. Replaces deprecated `importsNotUsedAsValues` and `preserveValueImports`.

```typescript
// With verbatimModuleSyntax: true

// Good - explicit type import
import type { User } from "./types";
import { createUser } from "./api";

// Bad - type imported as value (errors with verbatimModuleSyntax)
import { User, createUser } from "./api";
```

#### module: "preserve" (TS 5.4+)

Preserves import/export syntax as-is. TypeScript only type-checks; the bundler handles module output.

**When to use:** Bundler-based projects where TypeScript does NOT emit JavaScript (`noEmit: true`)

**When not to use:** Node.js packages that emit CJS/ESM directly -- use `module: "node18"` or `"node20"` instead

#### moduleDetection: "force" (TS 5.0+)

Forces all files to be treated as modules, even without `import`/`export`. Prevents unexpected global scope pollution.

---

### Pattern 3: ${configDir} Template Variable (TS 5.5+)

Makes shared configs portable. `${configDir}` resolves to the directory of the **leaf** config (the one that extends), not the base.

```json
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "outDir": "${configDir}/dist",
    "rootDir": "${configDir}/src"
  },
  "include": ["${configDir}/src"]
}
```

**Why good:** Consumers don't need to override `outDir`, `rootDir`, or `include` -- paths resolve relative to their own directory

**Gotcha:** Without `${configDir}`, relative paths like `"./dist"` resolve from the base config's location (`packages/typescript-config/`), not the consuming package.

---

### Pattern 4: Path Alias Sync

Path aliases must be configured in BOTH `tsconfig.json` AND your build tool. A mismatch causes either TypeScript errors or build-time import resolution failures.

```json
// tsconfig.json
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
// Build tool config - same aliases for bundler resolution
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@components": path.resolve(__dirname, "./src/components"),
  }
}
```

**Gotcha:** Forgetting to sync causes "module not found" errors. TypeScript resolves fine but the bundler fails (or vice versa). When adding a new alias, always update BOTH files.

---

### Pattern 5: isolatedDeclarations (TS 5.5+)

Requires explicit type annotations on all exports. Enables parallel `.d.ts` generation by external tools (oxc, swc).

```typescript
// With isolatedDeclarations: true

// Good - explicit return type on export
export function getUser(id: string): User {
  return { id, name: "John" };
}

// Bad - inferred return type (will error)
export function getUser(id: string) {
  return { id, name: "John" };
}
```

**When to use:** Large monorepos publishing library packages where parallel `.d.ts` generation speeds up builds

**When not to use:** Application code that is never consumed as a library (adds verbosity for no benefit)

---

### Pattern 6: erasableSyntaxOnly (TS 5.8+)

Prohibits TypeScript-specific constructs that have runtime behavior (enums, namespaces, parameter properties). Ensures compatibility with Node.js `--experimental-strip-types` for direct TS execution.

```typescript
// With erasableSyntaxOnly: true

// Good - type-only constructs (safely erasable)
type Status = "active" | "inactive";
const enum Direction {
  Up,
  Down,
} // const enum is erasable

// Bad - runtime behavior (will error)
enum Direction {
  Up,
  Down,
} // runtime enum object
namespace Utils {
  export function parse() {}
} // runtime namespace
class User {
  constructor(public name: string) {}
} // parameter property
```

**When to use:** Projects using Node.js direct TS execution, or targeting the types-only philosophy

**When not to use:** Projects that rely heavily on enums, namespaces, or parameter properties

---

### Pattern 7: import defer (TS 5.9+)

Deferred module evaluation -- the module loads but doesn't execute until an export is accessed. Only works with namespace imports under `--module preserve` or `esnext`.

```typescript
import * as analytics from "./heavy-analytics.js";

// Module is loaded but NOT executed yet
if (needsAnalytics) {
  analytics.track("event"); // Module executes here on first access
}
```

**When to use:** Improving startup performance for conditionally-loaded heavy modules

**Limitation:** Named imports and default imports are not supported with `import defer` -- only namespace syntax (`import defer * as ...`)

---

### Pattern 8: TypeScript 6.0 New Defaults

TS 6.0 (February 2026) changes several defaults. If your config already follows the patterns above, most changes are transparent.

| Option                         | Old Default              | TS 6.0 Default       |
| ------------------------------ | ------------------------ | -------------------- |
| `strict`                       | `false`                  | `true`               |
| `module`                       | `commonjs`               | `esnext`             |
| `target`                       | `es5`                    | `es2025`             |
| `rootDir`                      | inferred                 | `.` (current dir)    |
| `types`                        | auto-discover `@types/*` | `[]` (explicit only) |
| `noUncheckedSideEffectImports` | `false`                  | `true`               |

**Action required:** Set `"types": ["node"]` (or relevant packages) explicitly after upgrading to TS 6.0 -- the auto-discovery of `@types/*` is gone.

**Deprecated in TS 6.0** (removed in TS 7.0):

- `target: "es5"`, `moduleResolution: "node"` (node10), `module: "amd"|"umd"|"systemjs"`
- `esModuleInterop: false`, `--baseUrl` as module resolution root, `--outFile`

Use `"ignoreDeprecations": "6.0"` during migration to suppress warnings.

> See [examples/core.md](examples/core.md) for full TS 6.0 defaults table and deprecation details.

---

### Pattern 9: NoInfer<T> Utility Type (TS 5.4+)

Prevents TypeScript from inferring a type from a specific position in generic functions.

```typescript
// Good - NoInfer ensures initial must be from states array
declare function createFSM<TState extends string>(config: {
  initial: NoInfer<TState>;
  states: TState[];
}): void;

createFSM({
  initial: "invalid", // Error: "invalid" not in states
  states: ["open", "closed"],
});
```

**Why good:** TypeScript infers `TState` from `states` only; `initial` must match without widening the union

**When to use:** Generic functions where one parameter should constrain another, not expand the inferred type

</patterns>

---

<decision_framework>

## Decision Framework

### Module Settings Selection

```
What module/moduleResolution to use?
├─ Bundler-based project (TypeScript does NOT emit JS)?
│   └─ YES -> module: "preserve", moduleResolution: "bundler"
├─ Node.js package (direct execution)?
│   ├─ Node 20+? -> module: "node20" (TS 5.9+, stable)
│   └─ Node 18+? -> module: "node18" (TS 5.8+)
└─ Library consumed by both bundlers and Node?
    └─ module: "nodenext" (most compatible)
```

### Target Selection

```
What target to use?
├─ Bundler-based project? -> target: "ES2022" (stable, well-supported)
├─ Node.js 18+? -> target: "ES2022"
├─ Node.js 20+? -> target: "ES2023"
└─ TS 6.0+ project? -> target: "es2025" (new default)
```

### New Feature Adoption

```
isolatedDeclarations?
├─ Publishing library packages in large monorepo? -> Enable
├─ Application code only? -> Skip (adds verbosity for no benefit)
└─ Using oxc or swc for builds? -> Enable (these tools benefit most)

erasableSyntaxOnly?
├─ Using Node.js --experimental-strip-types? -> Enable (required)
├─ Project uses enums extensively? -> Skip (migration cost too high)
└─ Standard bundler project? -> Optional (nice-to-have)
```

See [reference.md](reference.md) for additional decision frameworks (shared vs local config, TS 6.0 migration).

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Disabling TypeScript strict mode (`strict: false`) -- allows implicit any and null bugs across the project
- Missing `verbatimModuleSyntax: true` -- type imports may or may not be elided depending on transpiler
- Not using shared configs in monorepo -- configs drift, creating inconsistent safety levels across packages
- Using deprecated `importsNotUsedAsValues` or `preserveValueImports` -- replaced by `verbatimModuleSyntax` since TS 5.0

**Medium Priority Issues:**

- Path aliases in tsconfig but not in build tool (or vice versa) -- causes import resolution failures
- Using deprecated `moduleResolution: "node"` (node10) instead of `"bundler"` or `"node18"` -- deprecated in TS 6.0
- Using deprecated `target: "ES3"` or `"ES5"` -- deprecated in TS 6.0, removed in TS 7.0
- Duplicated config per package instead of extending shared base

**Gotchas & Edge Cases:**

- `${configDir}` resolves to the directory of the **leaf** config (the one that uses `extends`), not the base config
- `verbatimModuleSyntax` requires ALL type-only imports to use `import type` -- mixed imports like `import { Type, value }` error if `Type` is type-only. Use inline syntax: `import { type Type, value }`
- `exactOptionalPropertyTypes` means `{ key?: string }` does NOT accept `{ key: undefined }` -- only omission or `string`
- `noUncheckedIndexedAccess` adds `| undefined` to ALL index signatures, including arrays -- use `for...of` or guard with `if`
- `module: "preserve"` only works with `noEmit: true` or `emitDeclarationOnly: true`
- TS 6.0 changes `types` default to `[]` -- `@types/node`, `@types/react` etc. must be explicitly listed after upgrade
- `import defer` only supports namespace syntax (`import defer * as ...`), not named or default imports

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable TypeScript strict mode (`strict: true`) in ALL tsconfig.json files - non-negotiable)**

**(You MUST use `verbatimModuleSyntax: true` to enforce explicit `import type` - replaces deprecated `importsNotUsedAsValues`)**

**(You MUST use shared config pattern (`packages/typescript-config/`) in monorepos - never duplicate configs per package)**

**(You MUST sync path aliases between tsconfig.json and your build tool - mismatches cause import resolution failures)**

**(You MUST use modern module settings: `module: "preserve"`, `moduleResolution: "bundler"` for bundler-based projects)**

**Failure to follow these rules will cause type-safety gaps, inconsistent configs, and import resolution failures.**

</critical_reminders>
