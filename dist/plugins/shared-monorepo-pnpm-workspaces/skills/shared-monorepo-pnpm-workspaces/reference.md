# pnpm Workspaces Quick Reference

> Quick reference for pnpm workspace commands, protocol syntax, and configuration options. See [SKILL.md](SKILL.md) for detailed patterns and [examples/](examples/) for practical examples.

---

## Workspace Protocol Syntax

| Protocol      | Development | On Publish              | Use When                                       |
| ------------- | ----------- | ----------------------- | ---------------------------------------------- |
| `workspace:*` | Local link  | Exact version (`1.5.0`) | Internal packages (default choice)             |
| `workspace:^` | Local link  | Caret range (`^1.5.0`)  | Publishing packages that need flexible ranges  |
| `workspace:~` | Local link  | Tilde range (`~1.5.0`)  | Publishing packages with tight version control |

---

## Catalog Protocol Syntax

| Syntax              | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `"catalog:"`        | Use version from default `catalog:` in `pnpm-workspace.yaml` |
| `"catalog:default"` | Explicit reference to default catalog                        |
| `"catalog:<name>"`  | Use version from named catalog in `catalogs:`                |

---

## Filter Commands

### Package Selection

```bash
pnpm --filter <package-name> <cmd>    # Exact package
pnpm --filter "@scope/*" <cmd>        # Glob pattern
pnpm -F <package-name> <cmd>          # Short form
```

### Dependency / Dependent Selection

```bash
pnpm --filter "pkg..." <cmd>          # Package + all its dependencies
pnpm --filter "pkg^..." <cmd>         # Only dependencies (excludes pkg)
pnpm --filter "...pkg" <cmd>          # Package + all its dependents
pnpm --filter "...^pkg" <cmd>         # Only dependents (excludes pkg)
```

### Directory and Change-Based

```bash
pnpm --filter "./packages/**" <cmd>   # All packages in directory
pnpm --filter "[origin/main]" <cmd>   # Changed packages since ref
pnpm --filter "...[origin/main]" <cmd>  # Changed + their dependents
```

### Exclusion

```bash
pnpm --filter "!pkg-name" <cmd>       # Exclude package
pnpm --filter "!./lib" <cmd>          # Exclude directory
```

### Advanced Options

```bash
--filter-prod                          # Omit devDependencies during selection
--test-pattern="test/*"                # Prevent dependent execution for test-only changes
--changed-files-ignore-pattern="**/*.md"  # Exclude files from change detection
--fail-if-no-match                     # Error if no packages match
```

---

## Script Execution

```bash
pnpm -r <cmd>                         # Recursive, topological order
pnpm -r --parallel <cmd>              # Parallel, ignores dependency graph
pnpm -r --workspace-concurrency 4 <cmd>  # Topological, max 4 concurrent
pnpm -r --include-workspace-root <cmd>   # Include root package
```

---

## Dependency Management

```bash
pnpm add -Dw <pkg>                    # Add dev dep to workspace root
pnpm --filter <name> add <pkg>        # Add dep to specific package
pnpm --filter <name> add <pkg> --workspace  # Add workspace package as dep
pnpm -r update <pkg>                  # Update dep across all packages
pnpm -r exec rm -rf dist node_modules # Clean all packages
```

---

## pnpm-workspace.yaml Settings (v10+)

### Workspace Definition

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Dependency Resolution

| Setting                   | Default   | Purpose                                 |
| ------------------------- | --------- | --------------------------------------- |
| `linkWorkspacePackages`   | `false`   | Link local packages to `node_modules`   |
| `saveWorkspaceProtocol`   | `rolling` | Auto-save `workspace:` protocol         |
| `preferWorkspacePackages` | `false`   | Prefer workspace packages over registry |
| `disallowWorkspaceCycles` | `false`   | Fail install on circular deps           |
| `ignoreWorkspaceCycles`   | `false`   | Suppress cycle warnings                 |

### Hoisting

| Setting                  | Default | Purpose                                     |
| ------------------------ | ------- | ------------------------------------------- |
| `shamefullyHoist`        | `false` | Hoist everything to root (avoid this)       |
| `hoist`                  | `true`  | Hoist to hidden `.pnpm/node_modules`        |
| `hoistPattern`           | `["*"]` | Which packages to hoist                     |
| `publicHoistPattern`     | `[]`    | Hoist to root `node_modules`                |
| `hoistWorkspacePackages` | `true`  | Symlink workspace packages per hoist config |

### Injection

| Setting                   | Default | Purpose                                               |
| ------------------------- | ------- | ----------------------------------------------------- |
| `injectWorkspacePackages` | `false` | Hard-link workspace deps (required for `pnpm deploy`) |

### Catalogs

| Setting                 | Default  | Purpose                                  |
| ----------------------- | -------- | ---------------------------------------- |
| `catalogMode`           | `manual` | `strict` / `prefer` / `manual`           |
| `cleanupUnusedCatalogs` | `false`  | Remove unused catalog entries on install |

### Security (v10)

| Setting                 | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `allowBuilds`           | Map-based allowlist for install scripts (preferred, per-package boolean) |
| `onlyBuiltDependencies` | Array-based allowlist (legacy, still supported)                          |

---

## .npmrc (v10+)

In pnpm v10, `.npmrc` should ONLY contain auth and registry settings:

```ini
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
@myorg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

---

## Build Script Approval

```bash
pnpm approve-builds                   # Interactive approval of packages needing install scripts
pnpm approve-builds --all             # Approve all pending builds without prompting
```

---

## Changesets Commands

```bash
pnpm add -Dw @changesets/cli          # Install
pnpm changeset init                    # Initialize
pnpm changeset                         # Create changeset (interactive)
pnpm changeset version                 # Bump versions + changelogs
pnpm install                           # Update lockfile after bumps
pnpm publish -r                        # Publish updated packages
pnpm publish -r --access=public        # Publish scoped public packages
```

---

## CI Checklist

- [ ] Use `pnpm/action-setup@v4` with explicit version
- [ ] Use `actions/setup-node@v4` with `cache: "pnpm"`
- [ ] `--frozen-lockfile` is default in CI (do not disable)
- [ ] Use `fetch-depth: 0` for change-based filtering
- [ ] Use `--filter "...[origin/main]"` for affected-only builds
- [ ] Pin pnpm version to match local development
- [ ] Configure `NPM_TOKEN` secret for publishing
- [ ] Configure `allowBuilds` (or `onlyBuiltDependencies`) for packages needing install scripts

---

## pnpm v10 Breaking Changes

| Change                                                 | Migration                                           |
| ------------------------------------------------------ | --------------------------------------------------- |
| Settings moved from `.npmrc` to `pnpm-workspace.yaml`  | Move non-auth settings to YAML                      |
| Lifecycle scripts blocked by default                   | Add `allowBuilds` map or run `pnpm approve-builds`  |
| `pnpm deploy` requires `injectWorkspacePackages: true` | Add setting to workspace config (or use `--legacy`) |
| JSR support via `jsr:` protocol                        | Use for JSR packages                                |
| `devEngines.runtime` support                           | Specify runtime versions in `package.json`          |

---

## Resources

**Official Documentation:**

- pnpm Workspaces: https://pnpm.io/workspaces
- pnpm Settings: https://pnpm.io/settings
- pnpm Filtering: https://pnpm.io/filtering
- pnpm Catalogs: https://pnpm.io/catalogs
- pnpm CI: https://pnpm.io/continuous-integration
- pnpm Changesets: https://pnpm.io/using-changesets

**Tools:**

- Changesets: https://github.com/changesets/changesets
- pnpm GitHub Action: https://github.com/pnpm/action-setup
