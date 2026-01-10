# Internal Package Conventions - Reference

> Decision frameworks, red flags, anti-patterns, and checklists. See [skill.md](skill.md) for core concepts.

---

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

---

## Red Flags

### High Priority Issues

- **Default exports in library packages** - breaks tree-shaking and naming consistency
- **Missing `exports` field in package.json** - allows importing internal paths
- **Hardcoded versions for internal deps instead of `workspace:*`** - version conflicts
- **React in `dependencies` instead of `peerDependencies`** - version duplication

### Medium Priority Issues

- Giant barrel files re-exporting everything (negates tree-shaking benefits)
- Missing `sideEffects` field (prevents aggressive tree-shaking)
- Importing from internal paths instead of package exports
- PascalCase file names (breaks on case-sensitive filesystems)

### Common Mistakes

- Using custom namespace like `@mycompany/*` instead of `@repo/*`
- Creating internal packages for app-specific code (over-abstraction)
- Missing `private: true` (can accidentally publish to npm)
- Using star imports `import *` (breaks tree-shaking)

### Gotchas & Edge Cases

- `workspace:*` is replaced with actual version on publish (if you ever publish)
- CSS/SCSS files must be marked as `sideEffects` even if package is otherwise pure
- TypeScript `paths` mapping may be needed for some bundlers (Next.js handles automatically)
- Barrel files slow down hot module replacement (HMR) in development
- Package.json `exports` field is strict - missing exports cannot be imported

---

## Anti-Patterns

### Default Exports in Library Packages

```typescript
// ❌ ANTI-PATTERN: Default export
// packages/ui/src/components/button/button.tsx
export default Button;
```

**Why it's wrong:** Breaks tree-shaking, naming conflicts across packages, inconsistent imports.

**What to do instead:** Use named exports: `export { Button }`

---

### Missing exports Field

```json
// ❌ ANTI-PATTERN: No exports field
{
  "name": "@repo/ui",
  "main": "./src/index.ts"
}
```

**Why it's wrong:** Allows importing internal paths (`@repo/ui/src/internal/utils`), breaks encapsulation.

**What to do instead:** Define explicit exports for each public API path.

---

### Hardcoded Internal Package Versions

```json
// ❌ ANTI-PATTERN: Hardcoded versions
{
  "dependencies": {
    "@repo/ui": "^1.0.0",
    "@repo/types": "1.2.3"
  }
}
```

**Why it's wrong:** Creates version conflicts when local package changes, may install from npm instead of using local.

**What to do instead:** Use workspace protocol: `"@repo/ui": "workspace:*"`

---

### React in Dependencies (Not peerDependencies)

```json
// ❌ ANTI-PATTERN: React as dependency
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Why it's wrong:** Causes React version duplication, "hooks can only be called inside body of function component" errors.

**What to do instead:** Mark React as peerDependencies in component packages.

---

## Checklists

### New Package Checklist

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

### Common Anti-Patterns to Avoid

- Default exports in library packages (breaks tree-shaking, naming conflicts)
- Importing from internal paths (`@repo/ui/src/components/...`)
- Giant barrel files that re-export everything
- Missing `exports` field (consumers can import anything)
- Hardcoded versions instead of `workspace:*` for internal deps
- Mixed naming conventions (some PascalCase files, some kebab-case)
- `dependencies` instead of `peerDependencies` for React

---

## Resources

### Official Documentation

- Node.js Package Exports: https://nodejs.org/api/packages.html#exports
- TypeScript Module Resolution: https://www.typescriptlang.org/docs/handbook/modules/reference.html
- Bun Workspaces: https://bun.sh/docs/install/workspaces

### Related

- Tree-shaking: https://webpack.js.org/guides/tree-shaking/
- Package.json exports: https://nodejs.org/api/packages.html#package-entry-points
