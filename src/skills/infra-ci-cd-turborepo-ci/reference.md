# Turborepo CI Quick Reference

Decision frameworks, CLI flags, and turbo.json quick reference for CI pipelines.

---

## CLI Flags Reference

### turbo run

| Flag                  | Default              | Purpose                                                               |
| --------------------- | -------------------- | --------------------------------------------------------------------- |
| `--affected`          | -                    | Run tasks only in changed packages (auto-detects CI env)              |
| `--filter` / `-F`     | -                    | Target specific packages, directories, or git ranges                  |
| `--cache`             | `local:rw,remote:rw` | Cache source and permission control                                   |
| `--concurrency`       | `10`                 | Max parallel task execution (integer or percentage)                   |
| `--dry` / `--dry-run` | -                    | Show execution plan without running                                   |
| `--force`             | -                    | Bypass cache, re-execute all tasks                                    |
| `--summarize`         | -                    | Generate run summary in `.turbo/runs/`                                |
| `--output-logs`       | `full`               | Log verbosity: `full`, `hash-only`, `new-only`, `errors-only`, `none` |
| `--env-mode`          | `strict`             | `strict` (only listed vars) or `loose` (all vars available)           |
| `--graph`             | -                    | Generate task graph (svg, html, mermaid, dot)                         |
| `--only`              | -                    | Run specified tasks without their dependencies                        |
| `--continue`          | `never`              | Error handling: `never`, `dependencies-successful`, `always`          |
| `--json`              | -                    | Stream NDJSON output to stdout                                        |
| `--log-file`          | -                    | Write structured logs to file                                         |
| `--team`              | -                    | Remote Cache team slug                                                |
| `--token`             | -                    | Remote Cache auth token                                               |

### turbo prune

| Flag                  | Default | Purpose                                                    |
| --------------------- | ------- | ---------------------------------------------------------- |
| `--docker`            | -       | Split output for Docker layer caching (json/ + full/ dirs) |
| `--out`               | `./out` | Output directory for pruned workspace                      |
| `--respect-gitignore` | -       | Honor .gitignore when copying files                        |

### turbo query

| Subcommand                           | Purpose                                           |
| ------------------------------------ | ------------------------------------------------- |
| `turbo query affected`               | List affected packages/tasks as JSON              |
| `turbo query affected --packages`    | List only affected package names                  |
| `turbo query affected --tasks build` | List affected tasks matching a specific task name |
| `turbo query ls`                     | List all packages in the workspace                |

---

## --filter Syntax Cheat Sheet

| Pattern                       | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `--filter=web`                | Package named `web`                                    |
| `--filter=web...`             | `web` and all its dependencies                         |
| `--filter=...web`             | `web` and all its dependents                           |
| `--filter=...^web`            | All dependents of `web` (excluding `web` itself)       |
| `--filter=./apps/*`           | All packages in `apps/` directory                      |
| `--filter=...[origin/main]`   | Packages changed since `origin/main`                   |
| `--filter={./apps/*}[HEAD^1]` | Packages in `apps/` changed since last commit          |
| `--filter=web --filter=api`   | Union of `web` and `api`                               |
| `--filter=!admin`             | Exclude `admin` from results                           |
| `web#build`                   | Run `build` task for `web` only (no `--filter` needed) |

---

## turbo.json Task Keys

| Key              | Affects Hash? | Purpose                                                  |
| ---------------- | ------------- | -------------------------------------------------------- |
| `dependsOn`      | No            | Tasks/packages that must complete first (`^` = upstream) |
| `outputs`        | No            | File globs to cache after task completion                |
| `cache`          | No            | Enable/disable caching (default: `true`)                 |
| `env`            | Yes           | Environment variables included in task hash              |
| `passThroughEnv` | No            | Variables available at runtime but not in hash           |
| `inputs`         | Yes           | File globs determining task invalidation                 |
| `outputLogs`     | No            | Log verbosity for cached task replay                     |
| `persistent`     | No            | Mark long-running processes (e.g., dev servers)          |
| `interactive`    | No            | Allow stdin input during execution                       |
| `description`    | No            | Human-readable task documentation                        |

## turbo.json Global Keys

| Key                    | Affects Hash?   | Purpose                                             |
| ---------------------- | --------------- | --------------------------------------------------- |
| `globalEnv`            | Yes (all tasks) | Environment variables affecting all task hashes     |
| `globalDependencies`   | Yes (all tasks) | File globs affecting all task hashes                |
| `globalPassThroughEnv` | No              | Variables available to all tasks, not in hash       |
| `envMode`              | No              | `strict` (default) or `loose` variable filtering    |
| `concurrency`          | No              | Default max parallel tasks                          |
| `cacheDir`             | No              | Filesystem cache location (default: `.turbo/cache`) |

---

## Environment Variables for CI

| Variable                           | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| `TURBO_TOKEN`                      | Bearer token for Remote Cache authentication        |
| `TURBO_TEAM`                       | Team/account slug for Remote Cache                  |
| `TURBO_API`                        | Custom Remote Cache server URL (self-hosted)        |
| `TURBO_REMOTE_CACHE_SIGNATURE_KEY` | HMAC-SHA256 key for artifact signing                |
| `TURBO_FORCE`                      | Force re-execution (equivalent to `--force`)        |
| `CI`                               | Auto-detected by Turborepo for CI-specific behavior |

---

## Gotchas & Edge Cases

> See [SKILL.md](SKILL.md) RED FLAGS section for the complete list of gotchas, edge cases, and anti-patterns.
