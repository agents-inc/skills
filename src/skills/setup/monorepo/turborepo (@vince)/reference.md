# Monorepo Reference

> Decision frameworks, anti-patterns, and red flags for Turborepo and monorepo development. See [skill.md](skill.md) for core concepts and [examples.md](examples.md) for code examples.

---

## Decision Framework

### When to Create a New Package

```
New code to write?
│
├─ Is it a deployable application?
│  └─ apps/ (Next.js app, API server, admin dashboard)
│
├─ Is it shared across multiple apps?
│  └─ packages/ (ui, api-client, types)
│
├─ Is it app-specific but significant?
│  └─ Feature folder within the app (not a package)
│
└─ Is it a build tool or generator?
   └─ tools/ (code generators, custom scripts)
```

### Package Creation Criteria

**Create package when:**

- Code is used by 2+ apps
- Logical boundary exists (UI library, API client)
- Independent versioning would be valuable
- Clear ownership/team boundary

**Keep code in app when:**

- Only one app uses it
- Tightly coupled to app-specific logic
- Frequently changes with app features
- No clear reuse potential

### When to Use Turborepo vs Standard Tools

```
Is this a monorepo?
├─ NO → Use standard build tools (Vite, esbuild, etc.)
└─ YES → Are there multiple packages/apps?
    ├─ NO → Use standard build tools
    └─ YES → Do builds take > 30 seconds?
        ├─ YES → Use Turborepo
        └─ NO → Is caching important for your team?
            ├─ YES → Use Turborepo
            └─ NO → Standard tools may be sufficient
```

---

## Integration Guide

**Works with:**

- **Bun**: Package manager and task runner - `bun install`, `bun run build`
- **ESLint**: Turborepo plugin validates env var declarations in turbo.json
- **Syncpack**: Ensures consistent dependency versions across workspaces
- **CI/CD**: GitHub Actions, GitLab CI, CircleCI with remote caching via `TURBO_TOKEN` and `TURBO_TEAM`
- **Vercel**: Built-in support for Turborepo with automatic remote caching

**Replaces / Conflicts with:**

- **Lerna**: Turborepo provides better caching and task orchestration
- **Nx**: Similar monorepo tool - choose one, not both
- **Rush**: Microsoft's monorepo tool - Turborepo is simpler for JS/TS projects

---

## RED FLAGS

### High Priority Issues

- Running full test suite on every PR without affected detection (wastes CI time and money)
- Not using caching at all (missing `outputs` configuration)
- Missing `dependsOn: ["^build"]` for tasks that need dependencies built first
- Forgetting to declare environment variables in `env` array (causes cache misses across environments)

### Medium Priority Issues

- Not setting `cache: false` for dev servers and code generation tasks
- Not using remote caching for teams (everyone rebuilds everything locally)
- Missing `globalDependencies` for shared config files affecting all packages
- Using `latest` Docker tags in CI (non-deterministic builds)

### Common Mistakes

- Building dependencies separately instead of letting Turborepo handle topological ordering
- Rebuilding for each environment instead of building once and deploying many
- Not setting GitHub Actions concurrency limits (multiple CI runs on same PR)
- Hardcoding package versions instead of using `workspace:*` protocol

### Gotchas & Edge Cases

- Cache invalidation requires ALL affected inputs to be declared - missing `env` vars or `inputs` causes stale builds
- Remote cache requires Vercel account or self-hosted solution - not automatic
- `dependsOn: ["^task"]` runs dependencies' tasks, `dependsOn: ["task"]` runs same package's task first
- Excluding cache directories in `outputs` is critical: `!.next/cache/**` prevents caching the cache
- `--filter=...[HEAD^]` syntax requires fetch-depth: 2 in GitHub Actions checkout

---

## Anti-Patterns

### Missing dependsOn for Build Tasks

```json
// ANTI-PATTERN: No dependency ordering
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // Missing dependsOn: ["^build"]
    }
  }
}
```

**Why it's wrong:** Dependencies may not build first causing build failures, topological ordering broken.

**What to do instead:** Always use `dependsOn: ["^build"]` for build tasks.

---

### Hardcoded Package Versions

```json
// ANTI-PATTERN: Hardcoded versions for workspace packages
{
  "dependencies": {
    "@repo/ui": "1.0.0",
    "@repo/types": "^2.1.0"
  }
}
```

**Why it's wrong:** Breaks local package linking (installs from npm instead), version mismatches cause duplicate dependencies.

**What to do instead:** Use workspace protocol: `"@repo/ui": "workspace:*"`

---

### Missing Environment Variable Declarations

```json
// ANTI-PATTERN: Env vars not declared
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // Missing env array - DATABASE_URL changes won't invalidate cache
    }
  }
}
```

**Why it's wrong:** Environment variable changes don't invalidate cache, stale builds with wrong config get reused.

**What to do instead:** Declare all env vars in the `env` array.

---

### Caching Side-Effect Tasks

```json
// ANTI-PATTERN: Dev server gets cached
{
  "tasks": {
    "dev": {
      "persistent": true
      // Missing cache: false
    }
  }
}
```

**Why it's wrong:** Dev servers and code generation should not be cached, causes incorrect cached outputs to be reused.

**What to do instead:** Set `cache: false` for dev servers and code generation tasks.

---

## Quick Reference

### turbo.json Task Checklist

- [ ] `dependsOn: ["^build"]` for tasks needing dependencies built first
- [ ] `env` array lists all environment variables used
- [ ] `outputs` array specifies files to cache
- [ ] `cache: false` for dev servers and code generation
- [ ] `persistent: true` for long-running tasks like dev servers
- [ ] `inputs` array fine-tunes cache invalidation triggers

### Workspace Checklist

- [ ] Root package.json has `workspaces` array
- [ ] Internal packages use `workspace:*` protocol
- [ ] Syncpack configured for version consistency
- [ ] Circular dependency checks in CI

### Remote Cache Checklist

- [ ] `TURBO_TOKEN` secret configured in CI
- [ ] `TURBO_TEAM` secret configured in CI
- [ ] `remoteCache.signature: true` for security
- [ ] `fetch-depth: 2` in GitHub Actions checkout for affected detection

---

## Resources

**Official documentation:**

- Turborepo: https://turbo.build/repo/docs
- Turborepo CI/CD: https://turbo.build/repo/docs/ci
- Turborepo Caching: https://turbo.build/repo/docs/core-concepts/caching
- Bun Workspaces: https://bun.sh/docs/install/workspaces

**Tools:**

- Syncpack: https://github.com/JamieMason/syncpack
- Turborepo Remote Cache: https://turbo.build/repo/docs/core-concepts/remote-caching

---

## Internal Package Conventions Reference

The following sections cover decision frameworks and anti-patterns for internal packages.

---

## Package Decision Framework

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

## Package Red Flags

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

## Package Anti-Patterns

### Default Exports in Library Packages

```typescript
// ANTI-PATTERN: Default export
// packages/ui/src/components/button/button.tsx
export default Button;
```

**Why it's wrong:** Breaks tree-shaking, naming conflicts across packages, inconsistent imports.

**What to do instead:** Use named exports: `export { Button }`

---

### Missing exports Field

```json
// ANTI-PATTERN: No exports field
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
// ANTI-PATTERN: Hardcoded versions
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
// ANTI-PATTERN: React as dependency
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

## Package Checklists

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

## Additional Package Resources

### Official Documentation

- Node.js Package Exports: https://nodejs.org/api/packages.html#exports
- TypeScript Module Resolution: https://www.typescriptlang.org/docs/handbook/modules/reference.html
- Bun Workspaces: https://bun.sh/docs/install/workspaces

### Related

- Tree-shaking: https://webpack.js.org/guides/tree-shaking/
- Package.json exports: https://nodejs.org/api/packages.html#package-entry-points
