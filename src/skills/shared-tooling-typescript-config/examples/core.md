# TypeScript Configuration - Core Examples

> Full config examples for TypeScript configuration patterns. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for anti-patterns.

---

## Pattern 1: Shared Strict Config (Base + Consumer)

### Base Config

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

> **Note:** `strict: true` already enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `alwaysStrict`. The additional options above (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`) are NOT included in `strict: true` and must be set separately.

### Consumer Config

```json
// apps/web/tsconfig.json
// Use your workspace package name (e.g. @repo/typescript-config, @acme/tsconfig)
{
  "extends": "<workspace-pkg>/base.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## Pattern 2: Specialized Configs

```
packages/typescript-config/
├── base.json        # Shared strict settings (all projects extend this)
├── react.json       # React-specific settings (extends base)
├── node.json        # Node.js-specific settings (extends base)
└── library.json     # Library publishing settings (extends base)
```

### React Config

```json
// packages/typescript-config/react.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"]
  }
}
```

### Node.js Config

```json
// packages/typescript-config/node.json
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

### Library Publishing Config

```json
// packages/typescript-config/library.json
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

---

## Pattern 3: verbatimModuleSyntax (TS 5.0+)

```typescript
// With verbatimModuleSyntax: true

// Good - explicit type import
import type { User } from "./types";
import { createUser } from "./api";

// Also valid - inline type annotation
import { type User, createUser } from "./api";

// Bad - type imported as value (will error)
import { User, createUser } from "./api";
```

**Why good:** Type imports are always elided, value imports always preserved -- predictable behavior regardless of transpiler

---

## Pattern 4: ${configDir} Template Variable (TS 5.5+)

```json
// packages/typescript-config/base.json
// Good - portable paths resolve relative to extending config
{
  "compilerOptions": {
    "outDir": "${configDir}/dist",
    "rootDir": "${configDir}/src"
  },
  "include": ["${configDir}/src"]
}
```

```json
// Bad - hardcoded relative paths in shared config
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["./src"]
}
```

**Why bad:** Relative paths resolve from the base config location (`packages/typescript-config/`), not the extending package

---

## Pattern 5: Path Alias Sync

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

**Gotcha:** Forgetting to sync causes "module not found" errors at build time even though TypeScript type-checking passes. Always update both files when adding a new alias.

---

## Pattern 6: isolatedDeclarations (TS 5.5+)

```json
{
  "compilerOptions": {
    "declaration": true,
    "isolatedDeclarations": true
  }
}
```

```typescript
// Good - explicit return type on export
export function getUser(id: string): User {
  return { id, name: "John" };
}

// Bad - inferred return type (will error with isolatedDeclarations)
export function getUser(id: string) {
  return { id, name: "John" };
}
```

**Trade-off:** More verbose code (explicit return types on all exports), but enables external tools (oxc, swc) to generate `.d.ts` files in parallel without full type-checking

---

## Pattern 7: erasableSyntaxOnly (TS 5.8+)

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}
```

```typescript
// Good - type-only constructs (safely erasable)
type Status = "active" | "inactive";
interface User {
  id: string;
  name: string;
}

// Bad - constructs with runtime behavior (will error)
enum Direction {
  Up,
  Down,
} // enum declaration
const enum Dir {
  Left,
  Right,
} // const enum also blocked
namespace Utils {
  export function parse() {}
} // runtime namespace
class User {
  constructor(public name: string) {}
} // parameter property
```

---

## Pattern 8: rewriteRelativeImportExtensions (TS 5.8+)

Automatically rewrites `.ts` extensions to `.js` in emitted output:

```typescript
// Source file
import { helper } from "./utils.ts";
// Emitted as: import { helper } from "./utils.js";
```

**When to use:** Projects that want `.ts` extensions in source imports while emitting valid `.js`. Pairs well with Node.js direct TypeScript execution.

---

## Pattern 9: module: "node18" and "node20" (TS 5.8+ / 5.9+)

Stable module options tied to specific Node.js versions, unlike `nodenext` which floats with latest Node.js behavior.

```json
// For Node.js 18+ projects
{
  "compilerOptions": {
    "module": "node18",
    "moduleResolution": "node18"
  }
}
```

```json
// For Node.js 20+ projects (TS 5.9+)
{
  "compilerOptions": {
    "module": "node20",
    "moduleResolution": "node20"
  }
}
```

**Why prefer over `nodenext`:** `nodenext` implies `target: esnext` and its behavior may change with new TypeScript releases. `node18`/`node20` provide stable, predictable behavior tied to a specific Node.js version. `node20` implies `target: es2023`.

---

## Pattern 10: TypeScript 6.0 Defaults & Deprecations

### New Defaults (February 2026)

| Option                         | Old Default              | TS 6.0 Default       |
| ------------------------------ | ------------------------ | -------------------- |
| `strict`                       | `false`                  | `true`               |
| `module`                       | `commonjs`               | `esnext`             |
| `target`                       | `es3`                    | `es2025`             |
| `rootDir`                      | inferred                 | `.` (current dir)    |
| `types`                        | auto-discover `@types/*` | `[]` (explicit only) |
| `noUncheckedSideEffectImports` | `false`                  | `true`               |
| `libReplacement`               | `true`                   | `false`              |

### Deprecated in TS 6.0 (removed in TS 7.0)

- `target: "es5"` -- use `"ES2022"` or higher
- `moduleResolution: "node"` (node10) -- use `"bundler"` or `"node18"`
- `moduleResolution: "classic"` -- use `"bundler"` or `"nodenext"`
- `module: "amd"` / `"umd"` / `"systemjs"` / `"none"` -- use `"preserve"` or `"nodenext"`
- `esModuleInterop: false` / `allowSyntheticDefaultImports: false` -- always enabled in 6.0+
- `alwaysStrict: false` -- always enabled in 6.0+
- `--baseUrl` as module resolution root -- use `paths` instead
- `--outFile` -- use bundlers for concatenation
- `--downlevelIteration` -- no longer needed with modern targets
- Import `asserts` keyword -- use `with` instead

Use `"ignoreDeprecations": "6.0"` during migration to suppress warnings for deprecated options.

### Migration Action Items

```json
// TS 6.0 - explicitly set types (auto-discovery is gone)
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

---

## Pattern 11: NoInfer<T> Utility Type (TS 5.4+)

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

// Bad - Without NoInfer, TypeScript infers union including initial
declare function createFSM<TState extends string>(config: {
  initial: TState;
  states: TState[];
}): void;

createFSM({
  initial: "invalid", // No error - inferred as "invalid" | "open" | "closed"
  states: ["open", "closed"],
});
```

**When to use:** Generic functions where one parameter should constrain values from another, not expand the inferred type
