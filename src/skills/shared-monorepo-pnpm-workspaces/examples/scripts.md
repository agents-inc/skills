# pnpm Workspaces -- Scripts & Filtering Examples

> Running scripts, filtering commands, and dependency management examples. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Workspace initialization, pnpm-workspace.yaml, settings
- [packages.md](packages.md) -- Shared packages, TypeScript config, workspace protocol
- [publishing.md](publishing.md) -- Changesets, versioning, publishing
- [ci.md](ci.md) -- CI/CD pipelines, GitHub Actions, Docker

---

## Filtering Commands

### Common Development Workflows

```bash
# Start dev server for a specific app
pnpm --filter @repo/web-app dev

# Build a package and all its dependencies
pnpm --filter "@repo/web-app..." build

# Run tests for changed packages since main branch
pnpm --filter "...[origin/main]" test

# Lint everything except docs
pnpm --filter "!@repo/docs" --filter "@repo/*" lint

# Add a dependency to a specific package
pnpm --filter @repo/api-server add hono

# Add a workspace dependency
pnpm --filter @repo/web-app add @repo/ui --workspace

# Remove a dependency from a package
pnpm --filter @repo/web-app remove lodash
```

### Package Name Matching

```bash
# Exact package name
pnpm --filter @repo/web-app build

# Glob pattern
pnpm --filter "@repo/*" build

# Short form
pnpm -F @repo/web-app dev
```

### Dependency and Dependent Selection

```bash
# Package and ALL its dependencies (transitive)
pnpm --filter "web-app..." build

# Only dependencies of a package (excludes the package itself)
pnpm --filter "web-app^..." build

# Package and ALL its dependents (what depends on it)
pnpm --filter "...@repo/ui" build

# Only dependents (excludes the package itself)
pnpm --filter "...^@repo/ui" build
```

### Directory and Change-Based Filtering

```bash
# All packages in a directory
pnpm --filter "./packages/**" test

# All packages changed since a git ref
pnpm --filter "...[origin/main]" test

# Changed packages and their dependents
pnpm --filter "...[origin/main]..." build

# Exclude a package
pnpm --filter "!@repo/docs" build
```

### CI-Optimized Filtering

```bash
# Build only changed packages and their dependents
pnpm --filter "...[origin/main]..." build

# Test changed packages (ignore README changes)
pnpm --filter "...[origin/main]" \
  --changed-files-ignore-pattern="**/*.md" \
  test

# Type-check only packages in the packages/ directory
pnpm --filter "./packages/**" typecheck

# Build with failure on no matches (catches filter typos)
pnpm --filter "@repo/web-app" --fail-if-no-match build
```

**Why good:** Targeted execution saves CI time, dependency-aware filtering ensures correct build order, change-based filtering only rebuilds what changed

### Dependency Graph Exploration

```bash
# See what depends on @repo/types
pnpm --filter "...@repo/types" list --depth 0

# See what @repo/web-app depends on
pnpm --filter "@repo/web-app..." list --depth 0

# List all workspace packages
pnpm -r list --depth -1
```

---

## Recursive Script Execution

### Topological vs Parallel

```bash
# Run build in all packages (topological order -- respects dependency graph)
pnpm -r build

# Run in all packages including the root
pnpm -r --include-workspace-root build

# Run tests in parallel (ignores dependency graph)
pnpm -r --parallel test

# Control concurrency (4 packages at a time, topological order)
pnpm -r --workspace-concurrency 4 build
```

### Correct Ordering

```bash
# CORRECT: Build in dependency order (packages build before their dependents)
pnpm -r build

# CORRECT: Tests can run in parallel (no build artifact dependencies)
pnpm -r --parallel test

# CORRECT: Lint can run in parallel (no cross-package dependencies)
pnpm -r --parallel lint
```

```bash
# BAD: Building in parallel when packages depend on each other
pnpm -r --parallel build
```

**Why bad:** Packages that depend on other packages may start building before their dependencies finish, causing build failures with missing modules

---

## Dependency Management

### Adding Dependencies

```bash
# Add a dependency to a specific package
pnpm --filter @repo/web-app add zod

# Add a dev dependency to the workspace root
pnpm add -Dw vitest

# Add a workspace package as a dependency
pnpm --filter @repo/web-app add @repo/ui --workspace

# Update a dependency across all packages
pnpm -r update typescript

# Clean all packages
pnpm -r exec rm -rf dist node_modules
```
