# TypeScript Configuration Reference

> Decision frameworks, anti-patterns, and gotchas for TypeScript configuration. See [SKILL.md](SKILL.md) for core patterns and [examples/typescript-config.md](examples/typescript-config.md) for code examples.

---

## Decision Frameworks

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

---

### Target Selection

```
What target to use?
├─ Bundler-based project (handles downleveling)?
│   └─ YES → target: "ES2022" (stable, well-supported)
├─ Node.js 18+?
│   └─ YES → target: "ES2022"
├─ Node.js 20+?
│   └─ YES → target: "ES2023"
└─ TS 6.0+ project (new defaults)?
    └─ target: "es2025" (new default, or omit to use default)
```

---

### Shared Config vs Local Config

```
Setting up TypeScript config?
├─ Monorepo with multiple packages?
│   └─ YES → Shared config (packages/typescript-config/) ✓
│       ├─ Use ${configDir} for portable paths (TS 5.5+)
│       └─ Create specialized configs (react.json, node.json, library.json)
└─ Single standalone project?
    └─ YES → Local tsconfig.json is fine
        └─ Still use all strict options from base config
```

---

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

---

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

---

### TypeScript 6.0 Migration

```
Preparing for TS 6.0?
├─ Already have strict: true?
│   └─ YES → No change needed (6.0 makes it default)
├─ Using moduleResolution: "node" (node10)?
│   └─ YES → Migrate to "bundler" or "node18" (deprecated in 6.0)
├─ Using target: "es5"?
│   └─ YES → Migrate to "ES2022"+ (deprecated in 6.0)
├─ Using module: "amd" | "umd" | "systemjs"?
│   └─ YES → Migrate to "preserve" or "nodenext" (deprecated in 6.0)
├─ Using esModuleInterop: false?
│   └─ YES → Remove it (always true in 6.0)
└─ Using --baseUrl for module resolution?
    └─ YES → Migrate to "paths" (deprecated in 6.0)
```

---

## Anti-Patterns to Avoid

### Disabled TypeScript Strict Mode

```json
// ❌ ANTI-PATTERN: Loose TypeScript config
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}
```

**Why it's wrong:** Allows implicit any types leading to runtime errors, no null checks cause crashes, different safety levels across packages confuse developers.

**What to do instead:** Enable TypeScript strict mode in ALL tsconfig.json files. In TS 6.0+, `strict: true` is the default.

---

### Deprecated TypeScript Options (TS 5.5+)

```json
// ❌ ANTI-PATTERN: Using deprecated TS options
{
  "compilerOptions": {
    "importsNotUsedAsValues": "error",
    "preserveValueImports": true,
    "target": "ES3"
  }
}
```

**Why it's wrong:** These options were deprecated in TypeScript 5.0 and no longer function in TS 5.5+.

**What to do instead:**

- Replace `importsNotUsedAsValues` + `preserveValueImports` with `verbatimModuleSyntax: true`
- Replace `target: "ES3"` with `target: "ES2022"` (modern stable target)
- Use `module: "preserve"` + `moduleResolution: "bundler"` for bundler projects

---

### Missing verbatimModuleSyntax

```typescript
// ❌ ANTI-PATTERN: Without verbatimModuleSyntax
import { User, createUser } from "./api"; // User is only a type!
// This may emit: import { createUser } from "./api";
// Or may emit both, depending on transpiler - unpredictable!
```

**Why it's wrong:** Type-only imports may or may not be elided depending on transpiler, causing inconsistent behavior.

**What to do instead:**

```typescript
// ✅ With verbatimModuleSyntax: true
import type { User } from "./api";
import { createUser } from "./api";
// Predictable: type import always elided, value import always preserved
```

---

### Duplicated Configs Per Package

```
// ❌ ANTI-PATTERN: Different configs per package
apps/client-react/tsconfig.json → strict: true, noUncheckedIndexedAccess: false
apps/admin/tsconfig.json → strict: false
packages/ui/tsconfig.json → completely different options
```

**Why it's wrong:** Inconsistent type safety across monorepo, developers switching packages encounter different rules, bugs slip through in less-strict packages.

**What to do instead:** Use shared config packages (`@repo/typescript-config`) with a strict base that all packages extend.

---

### Hardcoded Paths in Shared Config (Pre-configDir)

```json
// ❌ ANTI-PATTERN: Relative paths in shared config
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["./src"]
}
```

**Why it's wrong:** Relative paths resolve from the base config location (`packages/typescript-config/`), not the extending package. Every consumer must override these paths.

**What to do instead:** Use `${configDir}` (TS 5.5+):

```json
// ✅ Portable paths with ${configDir}
{
  "compilerOptions": {
    "outDir": "${configDir}/dist",
    "rootDir": "${configDir}/src"
  },
  "include": ["${configDir}/src"]
}
```

---

### Deprecated moduleResolution: "node" (node10)

```json
// ❌ ANTI-PATTERN: Legacy module resolution
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

**Why it's wrong:** `"node"` is actually `"node10"` behavior, deprecated in TS 6.0 and removed in TS 7.0. Does not support `exports` field in package.json.

**What to do instead:**

- Bundler projects: `"moduleResolution": "bundler"`
- Node.js projects: `"moduleResolution": "node18"` or `"node20"`

---

### Using module: "commonjs" for Bundler Projects

```json
// ❌ ANTI-PATTERN: CJS module format for Vite/Webpack projects
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

**Why it's wrong:** Bundler projects don't need CJS output. TypeScript should preserve imports for the bundler to handle.

**What to do instead:**

```json
// ✅ Let the bundler handle module format
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

---

## Gotchas & Edge Cases

### TypeScript Path Aliases

Path aliases must be configured in BOTH `tsconfig.json` AND the build tool (Vite, Next.js, etc.). Forgetting one side causes:

- Missing from tsconfig: TypeScript errors (`Cannot find module '@/...'`)
- Missing from build tool: Build-time errors (bundler can't resolve the alias)

**Always update both files when adding/removing an alias.**

---

### ${configDir} Resolution

`${configDir}` resolves to the directory of the config file that **contains** the path, not the root config. When using `extends`, it resolves relative to the leaf (extending) config's directory. This is the desired behavior for shared configs.

**Edge case:** If a shared config uses `${configDir}` in a nested `references` path, the resolution may be unexpected. Test by running `tsc --showConfig` from the extending package.

---

### exactOptionalPropertyTypes Behavior

With `exactOptionalPropertyTypes: true`, optional properties do NOT accept `undefined`:

```typescript
interface User {
  name: string;
  bio?: string; // Can be string or omitted, but NOT undefined
}

// ✅ Good
const user1: User = { name: "John" }; // bio omitted
const user2: User = { name: "John", bio: "Hi" }; // bio present

// ❌ Error with exactOptionalPropertyTypes
const user3: User = { name: "John", bio: undefined }; // Error!
```

This can surprise developers who use `undefined` to "clear" optional fields.

---

### noUncheckedIndexedAccess Impact

With `noUncheckedIndexedAccess: true`, ALL index signatures add `| undefined`:

```typescript
const arr: string[] = ["a", "b", "c"];
const first = arr[0]; // Type: string | undefined

// Must guard before use
if (first !== undefined) {
  console.log(first.toUpperCase()); // OK
}

// Or use for...of (no undefined)
for (const item of arr) {
  console.log(item.toUpperCase()); // OK - item is string
}

const record: Record<string, number> = { a: 1 };
const val = record["a"]; // Type: number | undefined
```

This affects arrays, Maps, Records, and any object with index signatures.

---

### verbatimModuleSyntax with Mixed Imports

`verbatimModuleSyntax` requires ALL type-only imports to use `import type`. You cannot mix types and values in a single import if the type is type-only:

```typescript
// ❌ Error: User is a type but imported as a value
import { User, createUser } from "./api";

// ✅ Split into separate imports
import type { User } from "./api";
import { createUser } from "./api";

// ✅ Also valid: inline type annotation
import { type User, createUser } from "./api";
```

---

### module: "preserve" Emit Restriction

`module: "preserve"` only works with `noEmit: true` or `emitDeclarationOnly: true`. It cannot be used when TypeScript is emitting JavaScript files. For projects that need TypeScript to emit JS, use `module: "nodenext"` or `"node18"`.

---

### TypeScript 6.0 types Default Change

TS 6.0 changes the default `types` from auto-discovering `node_modules/@types` to `[]` (empty). This means `@types/node`, `@types/react`, etc. must be explicitly listed:

```json
// TS 6.0+ - explicit types required
{
  "compilerOptions": {
    "types": ["node", "react"]
  }
}
```

Or add them to your `tsconfig.json` to avoid missing global types after upgrading.

---

### import defer (TS 5.9+)

Enables deferred module evaluation - the module loads but doesn't execute until an export is accessed:

```typescript
import * as analytics from "./heavy-analytics.js";

// Module is loaded but NOT executed yet
if (needsAnalytics) {
  analytics.track("event"); // Module executes here on first access
}
```

**When to use:** Improving startup performance for conditionally-loaded heavy modules. Not yet widely adopted - evaluate carefully.
