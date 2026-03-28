# Monorepo Reference

> Decision frameworks, anti-patterns, and red flags for Turborepo and monorepo development. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for code examples.

---

## Decision Framework

### When to Create a New Package

```
New code to write?
│
├─ Is it a deployable application?
│  └─ apps/ (web app, API server, admin dashboard)
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
├─ NO → Use standard build tools directly
└─ YES → Are there multiple packages/apps?
    ├─ NO → Use standard build tools
    └─ YES → Do builds take > 30 seconds?
        ├─ YES → Use Turborepo
        └─ NO → Is caching important for your team?
            ├─ YES → Use Turborepo
            └─ NO → Standard tools may be sufficient
```

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

## Turborepo 2.x Features

### Recent Additions

**Devtools (2.7 — Visual Graph Exploration):**

```bash
# Launch visual devtools for Package/Task Graph exploration
turbo devtools
```

**`turbo docs` (2.8 — CLI Documentation Search):**

```bash
# Search docs from terminal
turbo docs "package configurations"
```

**Composable Configuration (`$TURBO_EXTENDS$`):**

Package configurations can extend and append to inherited arrays instead of overwriting:

```json
// packages/web/turbo.json - Extend root config and ADD to arrays
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "inputs": ["$TURBO_EXTENDS$", "public/**"]
    }
  }
}
```

**Task Options Added in 2.x:**

| Option          | Type       | Purpose                                         |
| --------------- | ---------- | ----------------------------------------------- |
| `description`   | `string`   | Human-readable task documentation               |
| `interruptible` | `boolean`  | Allow `turbo watch` to restart persistent tasks |
| `with`          | `string[]` | Sibling tasks to run alongside this task        |

**Package Boundaries (Tags) — experimental:**

```json
// Root turbo.json - Define boundary rules for tags
{
  "boundaries": {
    "tags": {
      "ui": {
        "dependencies": {
          "allow": ["shared"],
          "deny": ["api"]
        }
      }
    }
  }
}

// packages/ui/turbo.json - Assign tags to package
{
  "tags": ["ui"]
}

// packages/api/turbo.json
{
  "tags": ["api"]
}
```

Run `turbo boundaries` to validate dependency rules against tag assignments.

**Special Microsyntax:**

| Syntax            | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `$TURBO_DEFAULT$` | Restores default input behavior while customizing     |
| `$TURBO_ROOT$`    | Makes globs relative to repo root (not package)       |
| `$TURBO_EXTENDS$` | Appends to arrays instead of replacing in pkg configs |

### Breaking Changes (Turborepo 2.0)

If migrating from Turborepo 1.x, run the codemod:

```bash
npx @turbo/codemod migrate
```

Key changes:

- `pipeline` renamed to `tasks`
- `outputMode` renamed to `outputLogs`
- `globalDotEnv` and `dotEnv` removed (use `inputs` instead)
- Strict Mode for environment variables is now default
- `--ignore` removed (use `--filter` instead)
- `packageManager` field required in root package.json

---

## Resources

**Official documentation:**

- Turborepo: https://turborepo.dev/docs
- Turborepo Configuration: https://turborepo.dev/docs/reference/configuration
- Turborepo CI/CD: https://turborepo.dev/docs/ci
- Turborepo Caching: https://turborepo.dev/docs/core-concepts/caching
- Turborepo Upgrading: https://turborepo.dev/docs/crafting-your-repository/upgrading
- Bun Workspaces: https://bun.sh/docs/install/workspaces

**Tools:**

- Syncpack: https://github.com/JamieMason/syncpack
- Turborepo Remote Cache: https://turborepo.dev/docs/core-concepts/remote-caching

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
- CSS files must be marked as `sideEffects` even if package is otherwise pure
- TypeScript `paths` mapping may be needed for some bundlers (some handle it automatically)
- Barrel files slow down hot module replacement (HMR) in development
- Package.json `exports` field is strict - missing exports cannot be imported

---

## Package Checklist

- [ ] Directory in `packages/`
- [ ] `package.json` with `@repo/` prefix name
- [ ] `private: true` set
- [ ] `exports` field configured
- [ ] `sideEffects` field set
- [ ] `workspace:*` for internal dependencies
- [ ] `peerDependencies` for React (if applicable)
- [ ] `tsconfig.json` extending shared config
- [ ] kebab-case file naming
- [ ] Named exports only
