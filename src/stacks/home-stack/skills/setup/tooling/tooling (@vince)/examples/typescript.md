# Tooling - TypeScript Configuration

> Shared TypeScript configuration with strict mode for monorepo consistency. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

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
// BAD: Loose TypeScript config per package
// apps/client-react/tsconfig.json
{
  "compilerOptions": {
    "strict": false, // Allows implicit any
    "noImplicitAny": false,
    "strictNullChecks": false,
    "skipLibCheck": true
  }
}
```

**Why bad:** Disabling strict mode allows implicit any types leading to runtime errors, no null checks cause undefined is not a function crashes, inconsistent configs across packages create different safety levels, developers switching packages lose type safety

---

## Strict Mode Options Explained

| Option | Purpose |
|--------|---------|
| `strict: true` | Enables all strict type-checking options |
| `noImplicitAny: true` | Error on expressions with implied `any` |
| `strictNullChecks: true` | `null` and `undefined` are distinct types |
| `noUncheckedIndexedAccess: true` | Add `undefined` to index signature results |
| `exactOptionalPropertyTypes: true` | Optional properties can't be `undefined` |
| `noImplicitOverride: true` | Require `override` keyword for inherited methods |
| `noUnusedLocals: true` | Error on unused local variables |
| `noUnusedParameters: true` | Error on unused parameters |

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
  }
}
```

**Why good:** Shared configs can use paths relative to the extending config, not the base config

---

### isolatedDeclarations (TS 5.5+, Optional)

Requires explicit type annotations on exports for faster parallel declaration emit.

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

**Gotcha:** Forgetting to sync causes import resolution failures at build time.

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

---

## See Also

- [vite.md](vite.md) for path alias configuration in Vite
- [eslint.md](eslint.md) for consistent-type-imports rule
- [reference.md](../reference.md) for TypeScript strict mode requirements
