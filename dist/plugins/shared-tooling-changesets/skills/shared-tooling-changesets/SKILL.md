---
name: shared-tooling-changesets
description: Versioning and changelog management with @changesets/cli — adding changesets, version bumping, changelog generation, monorepo publishing, pre-release modes, and CI automation
---

# Changesets

> **Quick Guide:** Changesets decouple the _intent to release_ from the _act of publishing_. Contributors add a changeset file (YAML frontmatter + markdown summary) alongside their code. When ready to release, `changeset version` consumes all pending changesets to bump versions and write changelogs. `changeset publish` publishes to npm. Use `fixed` for packages that must always share a version, `linked` for packages that share versions only when changed, and `pre enter <tag>` for pre-release cycles.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST add a changeset via `changeset` or `changeset add` for every user-facing change -- documentation-only or CI-only changes use `changeset --empty`)**

**(You MUST run `changeset version` before `changeset publish` -- version consumes changesets and bumps package.json, publish reads the bumped versions)**

**(You MUST set `"access": "public"` in `.changeset/config.json` for public npm packages -- the default `"restricted"` prevents public publishing)**

**(You MUST run pre-releases from a feature branch, NOT the default branch -- pre-release mode blocks normal releases until exited)**

</critical_requirements>

---

**Auto-detection:** changesets, @changesets/cli, changeset add, changeset version, changeset publish, changeset status, changeset pre, changeset init, .changeset/config.json, changeset snapshot, CHANGELOG.md generation, semver bump, version packages

**When to use:**

- Managing package versioning and changelogs for single or multi-package repos
- Automating release workflows (version bumping, changelog generation, npm publishing)
- Coordinating releases across monorepo packages (fixed or linked versioning)
- Running pre-release cycles (alpha, beta, rc)
- Publishing snapshot/canary versions for testing

**When NOT to use:**

- Projects using conventional-commits-based versioning (different paradigm)
- Single-file scripts or internal tools that are never published
- Projects with no semver versioning needs

**Key patterns covered:**

- Changeset file format (YAML frontmatter + markdown body)
- Config options: `access`, `baseBranch`, `fixed`, `linked`, `commit`, `changelog`
- CLI commands: `changeset`, `version`, `publish`, `status`, `pre`, `tag`, `init`
- Monorepo strategies: fixed packages vs linked packages
- Pre-release workflow: `pre enter`, version, publish, `pre exit`
- Snapshot releases for testing without version bumps
- CI automation with status checks and release workflows

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Changeset files, config, versioning, publishing, monorepo strategies
- [examples/ci.md](examples/ci.md) - CI automation, status checks, pre-release, snapshots
- [reference.md](reference.md) - CLI command reference, config option reference, official doc links

---

<philosophy>

## Philosophy

Changesets flip the release model: **contributors decide the version impact at PR time, not at release time**. A changeset is a small markdown file that declares which packages are affected, what semver bump they need, and a human-readable summary. This distributes versioning decisions to the people who understand the change best.

The workflow has three stages:

1. **Add** -- contributors create changeset files alongside their code changes
2. **Version** -- maintainers (or CI) consume all pending changesets to bump `package.json` versions and write `CHANGELOG.md` entries
3. **Publish** -- packages are published to npm with the new versions

**Key mental model:** A changeset is an _intent to release_, not a release itself. Multiple changesets accumulate between releases. When `changeset version` runs, it combines all pending intents into the minimal set of version bumps.

**When to use Changesets:**

- Any npm package (single or monorepo) that follows semver
- Teams where multiple contributors need to declare version impacts independently
- Projects that want changelogs generated from structured data, not commit messages

**When NOT to use:**

- Projects that derive versions from commit messages (conventional commits paradigm)
- Internal-only code that is never published to a registry

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: The Changeset File Format

A changeset is a markdown file in `.changeset/` with YAML frontmatter mapping package names to bump types and a markdown body for the changelog entry.

```markdown
---
"@myorg/core": minor
"@myorg/cli": patch
---

Add support for custom templates in the core package.
The CLI now passes template options through to core.
```

**Key points:** File names are randomly generated (e.g., `brave-dogs-dance.md`) to avoid merge conflicts. The YAML maps package names to `major`, `minor`, or `patch`. The markdown body becomes the CHANGELOG.md entry verbatim. Use `changeset --empty` for changes that should not trigger a release (CI config, docs).

See [examples/core.md](examples/core.md) for changeset file examples and the `--empty` pattern.

---

### Pattern 2: Configuration (.changeset/config.json)

The config file controls versioning behavior, changelog generation, and publishing access.

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Critical options:**

- `access`: `"restricted"` (default) or `"public"` -- **must be `"public"` for public npm packages**
- `baseBranch`: branch changesets compares against (usually `"main"`)
- `changelog`: the generator module -- use `["@changesets/changelog-github", { "repo": "org/repo" }]` for PR links
- `commit`: `false` (default) -- set to `true` to auto-commit version/add changes
- `fixed`: arrays of packages that always release together with the same version
- `linked`: arrays of packages that share versions only when both have changesets

See [examples/core.md](examples/core.md) for config variations and changelog generator setup.

---

### Pattern 3: The Release Workflow (version + publish)

The two-step release: `version` consumes changesets and bumps versions, `publish` pushes to npm.

```bash
# Step 1: Consume changesets, bump versions, write changelogs
changeset version

# Step 2: Commit the version changes
git add .
git commit -m "Version packages"

# Step 3: Publish to npm and create git tags
changeset publish

# Step 4: Push commits and tags
git push --follow-tags
```

**Key points:** `version` is idempotent -- running it again with no new changesets is a no-op. `publish` reads the current `package.json` versions and publishes any that are newer than what is on npm. Always commit between version and publish so that git tags point to the correct commit.

See [examples/core.md](examples/core.md) for the full workflow with status checks.

---

### Pattern 4: Monorepo Strategies (fixed vs linked)

**Fixed packages** always release together with the same version, even if only one package changed:

```json
{ "fixed": [["@myorg/react-*"]] }
```

**Linked packages** share versions only when both have changesets -- unchanged packages are not bumped:

```json
{ "linked": [["@myorg/core", "@myorg/utils"]] }
```

**Decision guide:**

- Use `fixed` when packages are a single product (e.g., a component library where all packages must match)
- Use `linked` when packages are related but can release independently (e.g., core + utilities)
- Use neither for fully independent packages

See [examples/core.md](examples/core.md) for fixed vs linked behavior examples.

---

### Pattern 5: Pre-Release Workflow

Pre-releases use a mode that tags versions with a suffix (e.g., `-beta.0`). Run from a feature branch, not the default branch.

```bash
# Enter pre-release mode with a tag
changeset pre enter beta

# Add changesets and version as normal
changeset version
git add . && git commit -m "Version packages (beta)"
changeset publish
git push --follow-tags

# Subsequent pre-releases just repeat version + publish
changeset version
git add . && git commit -m "Version packages (beta)"
changeset publish
git push --follow-tags

# Exit pre-release mode when ready for stable
changeset pre exit
changeset version
git add . && git commit -m "Version packages (stable)"
changeset publish
git push --follow-tags
```

**Key points:** `pre enter` creates a `pre.json` file tracking pre-release state. Dependent packages are also bumped because pre-release versions do not satisfy standard semver ranges (e.g., `^5.0.0` does not match `5.1.0-beta.0`). Always run pre-releases from a branch to avoid blocking normal releases on main.

See [examples/ci.md](examples/ci.md) for pre-release workflow details and CI integration.

---

### Pattern 6: Snapshot Releases

Snapshots publish temporary test versions without modifying the actual version in `package.json`.

```bash
# Publish a snapshot with a tag
changeset version --snapshot canary
changeset publish --no-git-tag --tag canary
```

**Key points:** Default base version is `0.0.0` (e.g., `0.0.0-canary-20260403T120000`). Set `snapshot.useCalculatedVersion: true` in config to use the real calculated version as base. Do not push snapshot version changes to any branch -- they are for installation testing only.

See [examples/ci.md](examples/ci.md) for snapshot config and CI automation.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Add a Changeset

```
Did you change user-facing behavior (API, CLI, UI)?
+-- YES --> Add a changeset with appropriate bump type
+-- NO  --> Did you change internal implementation?
    +-- YES --> Does it affect dependents?
    |   +-- YES --> Add a patch changeset
    |   +-- NO  --> changeset --empty (or skip entirely)
    +-- NO  --> Skip (docs, CI, dev tooling changes)
```

### Choosing the Bump Type

```
Is this a breaking change (removes/renames API, changes behavior)?
+-- YES --> major
+-- NO  --> Does it add new functionality (new API, new feature)?
    +-- YES --> minor
    +-- NO  --> patch (bug fix, performance improvement, internal change)
```

### Monorepo Versioning Strategy

```
Must all packages always have the same version?
+-- YES --> Use "fixed" (single product, e.g., component library)
+-- NO  --> Should some packages coordinate versions when both change?
    +-- YES --> Use "linked" (related packages, e.g., core + plugins)
    +-- NO  --> Use neither (fully independent packages)
```

### Pre-Release vs Snapshot

```
Need to test unreleased changes?
+-- Is this a formal release candidate cycle (alpha/beta/rc)?
|   +-- YES --> Pre-release (changeset pre enter <tag>)
+-- Is this a one-off test publish from a PR or branch?
    +-- YES --> Snapshot (changeset version --snapshot)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Running `changeset publish` without `changeset version` first -- publish reads package.json versions; without version, nothing is bumped
- Leaving `"access": "restricted"` for public npm packages -- publish silently fails or requires authentication for every install
- Running pre-releases on the default branch -- blocks all normal releases until `pre exit`
- Pushing snapshot version changes to a branch -- snapshot versions are for testing only, not permanent state

**Medium Priority Issues:**

- Using `fixed` when `linked` is more appropriate -- fixed bumps ALL packages even when unchanged, creating noise
- Forgetting `changeset --empty` for non-release PRs when CI enforces changeset status -- causes CI to block the merge
- Not committing between `version` and `publish` -- git tags will point to the wrong commit
- Missing `--follow-tags` on `git push` after publish -- git tags stay local, breaking version tracking

**Gotchas & Edge Cases:**

- Pre-release versions do not satisfy standard semver ranges: `^5.0.0` does NOT match `5.1.0-beta.0`, so dependents are also bumped in pre-release mode
- `changeset pre exit` does not version anything -- it only sets the intent to exit; you must run `changeset version` afterward
- Snapshot `prereleaseTemplate` placeholders: `{tag}`, `{commit}`, `{timestamp}`, `{datetime}` -- using `{commit}` requires a git repo
- `updateInternalDependencies: "minor"` means patch bumps to an internal dependency will NOT update the dependent's version range -- only minor+ will
- `ignore` in config prevents a package from being published but changesets can still reference it -- the changeset is silently skipped for that package
- Glob patterns in `fixed`/`linked` use micromatch format -- test patterns carefully in monorepos
- `changeset status --since=main` exits with code 1 if no changesets exist -- useful for CI enforcement but can be surprising locally
- `changelog: false` disables changelog generation entirely -- useful for private packages but not for published libraries

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST add a changeset via `changeset` or `changeset add` for every user-facing change -- documentation-only or CI-only changes use `changeset --empty`)**

**(You MUST run `changeset version` before `changeset publish` -- version consumes changesets and bumps package.json, publish reads the bumped versions)**

**(You MUST set `"access": "public"` in `.changeset/config.json` for public npm packages -- the default `"restricted"` prevents public publishing)**

**(You MUST run pre-releases from a feature branch, NOT the default branch -- pre-release mode blocks normal releases until exited)**

**Failure to follow these rules will cause failed publishes, blocked releases, and version drift across packages.**

</critical_reminders>
