# Nx Quick Reference

> CLI commands, configuration properties, and decision frameworks for Nx monorepos. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## CLI Commands

### Task Execution

| Command                     | Description                            | Key Flags                               |
| --------------------------- | -------------------------------------- | --------------------------------------- |
| `nx run <project>:<target>` | Run a single target                    | `--configuration`, `--skip-nx-cache`    |
| `nx run-many -t <target>`   | Run target across projects             | `--projects`, `--parallel`, `--exclude` |
| `nx affected -t <target>`   | Run target on affected projects        | `--base`, `--head`, `--files`           |
| `nx build <project>`        | Shorthand for `nx run <project>:build` | `--skip-nx-cache`, `--verbose`          |
| `nx test <project>`         | Shorthand for `nx run <project>:test`  | `--watch`, `--coverage`                 |
| `nx lint <project>`         | Shorthand for `nx run <project>:lint`  | `--fix`                                 |
| `nx serve <project>`        | Start dev server                       | `--port`, `--host`                      |

### Code Generation

| Command                            | Description                  | Key Flags                       |
| ---------------------------------- | ---------------------------- | ------------------------------- |
| `nx generate <plugin>:<generator>` | Scaffold code from templates | `--directory`, `--dry-run`      |
| `nx g @nx/react:library my-lib`    | Create React library         | `--bundler`, `--unitTestRunner` |
| `nx g @nx/react:component my-comp` | Create React component       | `--project`, `--style`          |
| `nx g @nx/next:application my-app` | Create Next.js app           | `--directory`, `--style`        |
| `nx g @nx/node:library my-api`     | Create Node library          | `--buildable`, `--publishable`  |
| `nx g @nx/workspace:move`          | Move a project               | `--project`, `--destination`    |
| `nx g @nx/workspace:remove`        | Remove a project             | `--project`, `--forceRemove`    |

### Workspace Management

| Command                  | Description                             | Key Flags                               |
| ------------------------ | --------------------------------------- | --------------------------------------- |
| `nx graph`               | Visualize project graph                 | `--focus`, `--file`, `--affected`       |
| `nx show projects`       | List all projects                       | `--affected`, `--type`, `--with-target` |
| `nx show project <name>` | Show project configuration              | `--json`                                |
| `nx list`                | List installed plugins                  |                                         |
| `nx report`              | Report workspace info (for bug reports) |                                         |
| `nx reset`               | Clear cache and daemon                  | `--only-cache`, `--only-daemon`         |
| `nx repair`              | Fix deprecated configurations           |                                         |

### Versioning & Release

| Command                  | Description                                  | Key Flags                      |
| ------------------------ | -------------------------------------------- | ------------------------------ |
| `nx release`             | Full release (version + changelog + publish) | `--dry-run`, `--first-release` |
| `nx release version`     | Bump versions only                           | `--specifier`, `--preid`       |
| `nx release changelog`   | Generate changelogs                          | `--from`, `--to`               |
| `nx release publish`     | Publish to registry                          | `--otp`, `--tag`               |
| `nx release plan <bump>` | Create version plan file                     | `-m "message"`                 |

### Migration & Updates

| Command                       | Description                     | Key Flags                |
| ----------------------------- | ------------------------------- | ------------------------ |
| `nx migrate latest`           | Generate migration scripts      | `--from`, `--to`         |
| `nx migrate --run-migrations` | Execute pending migrations      | `--create-commits`       |
| `nx add <plugin>`             | Install and initialize a plugin | `--updatePackageScripts` |

### CI & Cloud

| Command                       | Description             | Key Flags                    |
| ----------------------------- | ----------------------- | ---------------------------- |
| `nx connect`                  | Connect to Nx Cloud     | `--generateToken`            |
| `nx sync`                     | Run sync generators     |                              |
| `nx sync:check`               | Check if sync is needed |                              |
| `nx watch --all -- <command>` | Watch for changes       | `--includeDependentProjects` |
| `nx format:check`             | Check formatting        | `--base`, `--head`           |
| `nx format:write`             | Fix formatting          | `--base`, `--head`           |

---

## nx.json Property Reference

### Top-Level Properties

| Property         | Type     | Default                  | Description                                       |
| ---------------- | -------- | ------------------------ | ------------------------------------------------- |
| `$schema`        | `string` | —                        | JSON schema for editor autocompletion             |
| `defaultBase`    | `string` | `"main"`                 | Branch for affected detection comparison          |
| `namedInputs`    | `object` | —                        | Reusable input sets for cache keys                |
| `targetDefaults` | `object` | —                        | Global target configuration defaults              |
| `plugins`        | `array`  | —                        | Nx plugins for inferred tasks                     |
| `generators`     | `object` | —                        | Default options for generators                    |
| `release`        | `object` | —                        | Release management configuration                  |
| `nxCloudId`      | `string` | —                        | Nx Cloud workspace identifier                     |
| `nxCloudUrl`     | `string` | `"https://cloud.nx.app"` | Nx Cloud URL (self-hosted)                        |
| `parallel`       | `number` | —                        | Max concurrent task execution                     |
| `maxCacheSize`   | `string` | 10% of disk, max 10GB    | Local cache size limit (B/KB/MB/GB)               |
| `cacheDirectory` | `string` | `".nx/cache"`            | Local cache storage path                          |
| `extends`        | `string` | —                        | Inherit from preset (e.g., `nx/presets/npm.json`) |
| `conformance`    | `object` | —                        | Workspace compliance rules                        |
| `sync`           | `object` | —                        | Sync generator configuration                      |
| `tui`            | `object` | —                        | Terminal UI options (Nx 22+)                      |

### Target Properties (in targetDefaults or project.json)

| Property               | Type      | Description                                       |
| ---------------------- | --------- | ------------------------------------------------- |
| `executor`             | `string`  | Which executor runs the task (e.g., `@nx/js:tsc`) |
| `command`              | `string`  | Shell command alternative to executor             |
| `options`              | `object`  | Executor-specific options                         |
| `configurations`       | `object`  | Named config overrides (e.g., `production`)       |
| `defaultConfiguration` | `string`  | Which configuration to use by default             |
| `dependsOn`            | `array`   | Task prerequisites (`["^build"]`, `["build"]`)    |
| `inputs`               | `array`   | Files/deps that determine cache key               |
| `outputs`              | `array`   | Files to cache from task results                  |
| `cache`                | `boolean` | Whether to cache this target's results            |
| `continuous`           | `boolean` | Mark as long-running (Nx 21+, e.g., serve)        |
| `parallelism`          | `boolean` | Allow concurrent execution (Nx 19.5+)             |
| `metadata`             | `object`  | Description and technology tags                   |
| `syncGenerators`       | `array`   | Generators to run before task (Nx 19.8+)          |

### Input Types

| Type             | Example                                | Description                         |
| ---------------- | -------------------------------------- | ----------------------------------- |
| File glob        | `"{projectRoot}/src/**/*"`             | Match files in project              |
| Named input      | `"production"`                         | Reference a namedInput              |
| Dependency input | `"^production"`                        | Same input from dependency projects |
| External dep     | `{ "externalDependencies": ["vite"] }` | Specific npm package versions       |
| Env variable     | `{ "env": "NODE_ENV" }`                | Environment variable value          |
| Runtime          | `{ "runtime": "node -v" }`             | Command output                      |

### Output Tokens

| Token             | Resolves To              |
| ----------------- | ------------------------ |
| `{workspaceRoot}` | Workspace root directory |
| `{projectRoot}`   | Project root directory   |
| `{projectName}`   | Name of the project      |

---

## Decision Framework

### When to Create a New Project

```
New code to write?
├─ Deployable application → apps/
├─ Shared across 2+ apps → libs/ or packages/
├─ App-specific feature → Keep in the app directory
├─ Build tooling → tools/
└─ Shared config (ESLint, TS, Prettier) → packages/*-config
```

### Library Creation Criteria

**Create a library when:**

- Code is used by 2+ applications
- Clear logical boundary exists (UI library, API client, shared types)
- Independent testing or deployment would be valuable
- Different team ownership

**Keep in app when:**

- Only one app uses it
- Tightly coupled to app-specific logic
- Changes alongside app features
- No reuse potential

### Workspace Configuration Strategy

```
How to configure tasks?
├─ Use inferred tasks (Project Crystal) as baseline
│   └─ Plugin detects tool config → tasks created automatically
├─ Use targetDefaults for workspace-wide overrides
│   └─ Global caching, inputs, outputs, dependsOn
├─ Use project.json for project-specific overrides
│   └─ Only when a project differs from defaults
└─ NEVER duplicate config that plugins or defaults handle
```

---

## Anti-Patterns

### Missing Topological Ordering

```json
{
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/dist"]
    }
  }
}
```

**Why wrong:** No `dependsOn: ["^build"]` means dependency packages may not build first, causing import resolution failures.

**Fix:** Add `"dependsOn": ["^build"]` to build targetDefaults.

---

### Caching Dev Servers

```json
{
  "targetDefaults": {
    "serve": {
      "cache": true
    }
  }
}
```

**Why wrong:** Dev servers are long-running side-effect tasks. Caching them produces incorrect cached outputs.

**Fix:** Set `"cache": false` and `"continuous": true` on serve targets.

---

### Overly Broad Inputs

```json
{
  "targetDefaults": {
    "build": {
      "inputs": ["{projectRoot}/**/*"],
      "cache": true
    }
  }
}
```

**Why wrong:** Test file changes invalidate build cache. Build only needs production source files.

**Fix:** Use `namedInputs` to separate production files from test files:

```json
{
  "namedInputs": {
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts"
    ]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "cache": true
    }
  }
}
```

---

### Running Everything in CI

```yaml
# BAD: Runs all targets regardless of changes
- run: npx nx run-many -t build test lint
```

**Why wrong:** Wastes CI compute rebuilding unchanged projects.

**Fix:** Use affected commands:

```yaml
- run: npx nx affected -t build test lint --base=origin/main
```

---

### Manual project.json for Every Target

```json
{
  "name": "my-app",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "options": { "outputPath": "dist/apps/my-app" }
    },
    "serve": {
      "executor": "@nx/vite:dev-server"
    },
    "test": {
      "executor": "@nx/vite:test"
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

**Why wrong:** All of these targets can be inferred by `@nx/vite/plugin` and `@nx/eslint/plugin`. Manual configuration adds maintenance burden and may drift from plugin defaults.

**Fix:** Remove manual targets, let plugins infer them. Only add `project.json` entries for overrides.

---

## Checklists

### New Workspace Checklist

- [ ] `nx.json` configured with `namedInputs`, `targetDefaults`, and `plugins`
- [ ] `defaultBase` set to your main branch name
- [ ] Inferred tasks working (run `nx show project <name>` to verify)
- [ ] `dependsOn: ["^build"]` configured for build targets
- [ ] `cache: true` on build, test, lint targets
- [ ] `cache: false` on serve, dev targets
- [ ] Nx Cloud connected (`nx connect`) for remote caching
- [ ] CI pipeline uses `nx affected` instead of `nx run-many`

### New Project Checklist

- [ ] Generated with appropriate plugin generator
- [ ] Tags assigned for module boundary enforcement
- [ ] Verify inferred targets with `nx show project <name>`
- [ ] Override only what differs from defaults in `project.json`
- [ ] `implicitDependencies` set if non-static deps exist

### CI Pipeline Checklist

- [ ] `fetch-depth: 0` (or at least 2) in git checkout
- [ ] `nx affected -t build test lint` for task execution
- [ ] `--base=origin/main` or appropriate base ref
- [ ] Nx Cloud token configured for remote caching
- [ ] `parallel` setting tuned for CI machine resources

---

## Key Version Notes

- **Nx 22+**: `releaseTag` uses nested object (`releaseTag.pattern`), old flat `releaseTagPattern` deprecated (removed in Nx 23). `createNodes` v1 API dropped -- plugins must use `createNodesV2`.
- **Nx 21+**: `continuous: true` for long-running tasks (serve, watch). Dependents start immediately without waiting for continuous tasks to exit.
- **Nx 20+**: No distinction between "integrated" and "package-based" repos. TypeScript project references for faster builds.
- **Nx 18+**: Project Crystal -- inferred tasks from plugin configuration. Dramatically reduced `project.json` boilerplate.
