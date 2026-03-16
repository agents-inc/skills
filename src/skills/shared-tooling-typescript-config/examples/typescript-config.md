# TypeScript Configuration Examples

> Complete examples for TypeScript configuration patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

---

## Shared Config Pattern

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
// ❌ BAD: Loose TypeScript config per package
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

**Why bad:** Disabling strict mode allows implicit any types leading to runtime errors, no null checks cause undefined is not a function crashes, inconsistent configs across packages create different safety levels, developers switching packages lose type safety

---

## Strict Mode Options Explained

| Option                             | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `strict: true`                     | Enables all strict type-checking options         |
| `noImplicitAny: true`              | Error on expressions with implied `any`          |
| `strictNullChecks: true`           | `null` and `undefined` are distinct types        |
| `noUncheckedIndexedAccess: true`   | Add `undefined` to index signature results       |
| `exactOptionalPropertyTypes: true` | Optional properties can't be `undefined`         |
| `noImplicitOverride: true`         | Require `override` keyword for inherited methods |
| `noUnusedLocals: true`             | Error on unused local variables                  |
| `noUnusedParameters: true`         | Error on unused parameters                       |

---

## TypeScript 5.x Modern Options

### verbatimModuleSyntax (TS 5.0+)

Enforces explicit `import type` for type-only imports. Replaces deprecated `importsNotUsedAsValues`.

```typescript
// With verbatimModuleSyntax: true

// ✅ Good - explicit type import
import type { User } from "./types";
import { createUser } from "./api";

// ❌ Bad - type imported as value (will error)
import { User, createUser } from "./api";
```

**Why good:** Prevents type imports from appearing in emitted JavaScript, enables tree-shaking, clarifies intent

---

### moduleDetection: "force" (TS 5.0+)

Forces all files to be treated as modules, even without `import`/`export` statements.

```json
{
  "compilerOptions": {
    "moduleDetection": "force"
  }
}
```

**Why use:** Prevents unexpected global scope pollution, ensures consistent module behavior

---

### module: "preserve" (TS 5.4+)

Preserves import/export syntax as-is for bundlers. Recommended with `moduleResolution: "bundler"`.

```json
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

**When to use:** Bundler-based projects (Vite, Webpack, esbuild) where TypeScript only type-checks

---

### ${configDir} Template Variable (TS 5.5+)

Enables portable shared configs with relative paths.

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

**Why good:** Shared configs can use paths relative to the extending config, not the base config. Eliminates need for each package to override `outDir`, `rootDir`, and `include`.

```json
// ❌ Bad - hardcoded relative paths in shared config
// packages/typescript-config/base.json
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

### isolatedDeclarations (TS 5.5+)

Requires explicit type annotations on exports for faster parallel declaration emit. Stable for basic use.

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

// ✅ Good - explicit return type
export function getUser(id: string): User {
  return { id, name: "John" };
}

// ❌ Bad - inferred return type (will error)
export function getUser(id: string) {
  return { id, name: "John" };
}
```

**When to use:** Large monorepos wanting faster builds with tools like oxc or swc
**Trade-off:** More verbose code, but enables external tools to generate .d.ts files in parallel

---

### erasableSyntaxOnly (TS 5.8+)

Prohibits TypeScript-specific constructs that have runtime behavior. Designed for compatibility with Node.js `--experimental-strip-types` for direct TypeScript execution without a build step.

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}
```

```typescript
// With erasableSyntaxOnly: true

// ✅ Good - type-only constructs (safely erasable)
type Status = "active" | "inactive";
interface User {
  id: string;
  name: string;
}
const enum Direction {
  Up,
  Down,
} // const enum is erasable

// ❌ Bad - constructs with runtime behavior (will error)
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

**When to use:** Projects using Node.js `--experimental-strip-types` for direct TS execution, or targeting the types-only TypeScript philosophy

---

### rewriteRelativeImportExtensions (TS 5.8+)

Automatically rewrites TypeScript file extensions to JavaScript extensions in emitted output.

```typescript
// Source file
import { helper } from "./utils.ts";
// Emitted as: import { helper } from "./utils.js";
```

**When to use:** Projects that want to use `.ts` extensions in imports while still emitting valid `.js` imports. Particularly useful with Node.js direct TypeScript execution.

---

### module: "node18" and "node20" (TS 5.8+ / 5.9+)

Stable module options for specific Node.js versions, unlike `nodenext` which floats with the latest Node.js behavior.

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

**Why use over `nodenext`:** `nodenext` implies `target: esnext` and its behavior may change with new TypeScript releases. `node18`/`node20` provide stable, predictable behavior tied to a specific Node.js version.

---

## TypeScript 5.4+ Utility Types

### NoInfer<T> (TS 5.4+)

Prevents TypeScript from inferring a type from a specific position in generic functions.

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

**When to use:** Generic functions where one parameter should match values from another, not expand the type

---

## Path Alias Sync

Path aliases must be configured in both `tsconfig.json` and build tool (Vite/Next):

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
// vite.config.ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@components": path.resolve(__dirname, "./src/components"),
  }
}
```

**Gotcha:** Forgetting to sync causes import resolution failures at build time. TypeScript resolves fine but the bundler fails (or vice versa). Always update both files when adding a new alias.

---

## Specialized Configs

```
packages/typescript-config/
├── base.json        # Shared strict settings
├── react.json       # React-specific settings
├── node.json        # Node.js-specific settings
└── library.json     # Library publishing settings
```

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

## TypeScript 6.0 New Defaults

TypeScript 6.0 RC changes several defaults. New projects on TS 6.0+ get these automatically:

| Option                         | Old Default   | TS 6.0 Default       |
| ------------------------------ | ------------- | -------------------- |
| `strict`                       | `false`       | `true`               |
| `module`                       | `commonjs`    | `esnext`             |
| `target`                       | `es5`         | `es2025`             |
| `noUncheckedSideEffectImports` | `false`       | `true`               |
| `types`                        | auto-discover | `[]` (explicit only) |

**Deprecated in TS 6.0** (removed in TS 7.0):

- `target: "es5"` - use `"ES2022"` or higher
- `moduleResolution: "node"` (node10) - use `"bundler"` or `"node18"`
- `module: "amd"` / `"umd"` / `"systemjs"` / `"none"` - use `"preserve"` or `"nodenext"`
- `esModuleInterop: false` - always enabled in 6.0+
- `--baseUrl` as module resolution root - use `paths` instead
- `--outFile` - use bundlers for concatenation

Use `"ignoreDeprecations": "6.0"` during migration to suppress warnings.

---

## Standalone Project (Non-Monorepo)

For standalone projects without a monorepo, the same strict settings apply but without the shared config package:

```json
// tsconfig.json (standalone project)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "moduleDetection": "force",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
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
    "jsx": "react-jsx",
    "incremental": true,

    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Why good:** Same strict safety as monorepo config, all modern module settings, path aliases ready

---

## See Also

- For Vite path alias configuration, see `web-tooling-vite`
- For `consistent-type-imports` ESLint rule, see `shared-tooling-eslint-prettier`
- For TypeScript strict mode decision framework, see [reference.md](../reference.md)
