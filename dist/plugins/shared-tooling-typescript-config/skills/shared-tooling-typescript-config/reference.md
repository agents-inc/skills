# TypeScript Configuration Reference

> Decision frameworks, anti-patterns, and gotchas. See [SKILL.md](SKILL.md) for core patterns and [examples/core.md](examples/core.md) for full config examples.

---

## Decision Frameworks

### Shared Config vs Local Config

```
Setting up TypeScript config?
├─ Monorepo with multiple packages?
│   └─ YES -> Shared config (packages/typescript-config/)
│       ├─ Use ${configDir} for portable paths (TS 5.5+)
│       └─ Create specialized configs (react.json, node.json, library.json)
└─ Single standalone project?
    └─ YES -> Local tsconfig.json is fine
        └─ Still use all strict options from the base config pattern
```

### TypeScript 6.0 Migration

```
Preparing for TS 6.0?
├─ Already have strict: true?
│   └─ YES -> No change needed (6.0 makes it default)
├─ Using moduleResolution: "node" (node10)?
│   └─ YES -> Migrate to "bundler" or "node18" (deprecated in 6.0)
├─ Using target: "es5"?
│   └─ YES -> Migrate to "ES2022"+ (deprecated in 6.0)
├─ Using module: "amd" | "umd" | "systemjs"?
│   └─ YES -> Migrate to "preserve" or "nodenext" (deprecated in 6.0)
├─ Using esModuleInterop: false?
│   └─ YES -> Remove it (always true in 6.0)
├─ Using --baseUrl for module resolution?
│   └─ YES -> Migrate to "paths" (deprecated in 6.0)
└─ Not setting "types" explicitly?
    └─ YES -> Add "types": ["node"] (auto-discovery removed in 6.0)
```

---

## Anti-Patterns

### Deprecated Options Still in Use

```json
// ANTI-PATTERN: Using options deprecated since TS 5.0
{
  "compilerOptions": {
    "importsNotUsedAsValues": "error",
    "preserveValueImports": true
  }
}
```

**Fix:** Replace both with `"verbatimModuleSyntax": true`

---

### Missing verbatimModuleSyntax

```typescript
// ANTI-PATTERN: Without verbatimModuleSyntax
import { User, createUser } from "./api"; // User is only a type!
// May emit: import { createUser } from "./api";
// Or may emit both -- depends on transpiler. Unpredictable!
```

**Fix:** Enable `verbatimModuleSyntax: true` and split imports:

```typescript
import type { User } from "./api";
import { createUser } from "./api";
```

---

### Duplicated Configs Per Package

```
// ANTI-PATTERN: Different strict settings per package
apps/web/tsconfig.json        -> strict: true, noUncheckedIndexedAccess: false
apps/admin/tsconfig.json      -> strict: false
packages/ui/tsconfig.json     -> completely different options
```

**Fix:** Use a shared config base that all packages extend.

---

### Hardcoded Paths in Shared Config (Pre-configDir)

```json
// ANTI-PATTERN: Relative paths resolve from base config location
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Fix:** Use `${configDir}` (TS 5.5+):

```json
{
  "compilerOptions": {
    "outDir": "${configDir}/dist",
    "rootDir": "${configDir}/src"
  }
}
```

---

### Legacy Module Resolution

```json
// ANTI-PATTERN: "node" is actually "node10" behavior
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

**Fix:** Use `"bundler"` for bundler projects, `"node18"` or `"node20"` for Node.js projects.

---

### CJS Module for Bundler Projects

```json
// ANTI-PATTERN: TypeScript emitting CJS when bundler handles output
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

**Fix:** `"module": "preserve"`, `"moduleResolution": "bundler"`, `"noEmit": true`

---

## Gotchas & Edge Cases

### ${configDir} Resolution

`${configDir}` resolves to the directory of the config file that **contains** the path. When using `extends`, it resolves relative to the leaf (extending) config's directory. Verify with `tsc --showConfig` from the extending package.

### exactOptionalPropertyTypes

With `exactOptionalPropertyTypes: true`, optional properties do NOT accept `undefined`:

```typescript
interface User {
  bio?: string;
}

const user1: User = { name: "John" }; // OK - bio omitted
const user2: User = { name: "John", bio: "Hi" }; // OK - bio present
const user3: User = { name: "John", bio: undefined }; // Error!
```

This surprises developers who use `undefined` to "clear" optional fields.

### noUncheckedIndexedAccess

Adds `| undefined` to ALL index signatures, including arrays:

```typescript
const arr: string[] = ["a", "b", "c"];
const first = arr[0]; // Type: string | undefined

// Must guard before use
if (first !== undefined) {
  console.log(first.toUpperCase());
}

// Or use for...of (no undefined)
for (const item of arr) {
  console.log(item.toUpperCase()); // OK
}
```

### verbatimModuleSyntax with Mixed Imports

Cannot mix types and values in a single import if the type is type-only:

```typescript
// Error: User is a type but imported as a value
import { User, createUser } from "./api";

// Fix: split or use inline type
import type { User } from "./api";
import { createUser } from "./api";
// OR
import { type User, createUser } from "./api";
```

### module: "preserve" Emit Restriction

`module: "preserve"` only works with `noEmit: true` or `emitDeclarationOnly: true`. For projects that need TypeScript to emit JS, use `module: "nodenext"` or `"node18"`.

### TS 6.0 types Default Change

After upgrading to TS 6.0, `@types/node`, `@types/react`, etc. must be explicitly listed in `"types"` -- the auto-discovery of `node_modules/@types` is gone.

### import defer Limitations

`import defer` (TS 5.9+) only supports namespace syntax and only works under `--module preserve` or `esnext`. Named imports and default imports are not supported.

### --module node20 Target Implication

`--module node20` (TS 5.9+) implies `--target es2023` by default, unlike `nodenext` which implies `esnext`.
