# Changesets CI & Pre-Release Examples

> CI automation, status enforcement, pre-release workflow, and snapshot releases. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [core.md](core.md) for changeset files, config, and monorepo strategies.

---

## CI Enforcement: Require Changesets on PRs

### Non-Blocking: Changeset Bot

Install the [changeset bot](https://github.com/apps/changeset-bot) GitHub App. It comments on PRs indicating whether a changeset is present. It does not block merges but provides a link for maintainers to add a changeset directly from the browser.

### Blocking: Status Check in CI

Add a step to your CI pipeline that fails when no changesets exist:

```bash
changeset status --since=main
```

This exits with code 1 if no changesets have been added since the base branch. For PRs that intentionally skip a release (docs, CI config), contributors run:

```bash
changeset --empty
```

---

## Automated Release Workflow

A generic CI workflow that creates a versioning PR and optionally publishes:

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Create release PR or publish
        uses: changesets/action@v1
        with:
          publish: npm run release
          commit: "chore(release): version packages"
          title: "chore(release): version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**How it works:**

1. When changesets exist on main, the action creates (or updates) a "Version Packages" PR that runs `changeset version`
2. When that PR is merged, the action runs the `publish` command and publishes to npm
3. If `createGithubReleases` is true (default), it also creates GitHub Releases

**Key inputs:**

| Input                  | Default              | Purpose                                |
| ---------------------- | -------------------- | -------------------------------------- |
| `publish`              | --                   | Command to build and publish           |
| `version`              | `changeset version`  | Command to bump versions               |
| `commit`               | `"Version Packages"` | Commit message for version PR          |
| `title`                | `"Version Packages"` | PR title                               |
| `setupGitUser`         | `true`               | Configure git as `github-actions[bot]` |
| `createGithubReleases` | `true`               | Create GitHub Releases on publish      |

**Key outputs:**

| Output              | Type         | Purpose                                        |
| ------------------- | ------------ | ---------------------------------------------- |
| `published`         | `boolean`    | Whether packages were published                |
| `publishedPackages` | `JSON array` | `[{"name": "@myorg/pkg", "version": "1.2.0"}]` |
| `hasChangesets`     | `boolean`    | Whether unpublished changesets exist           |

---

## Pre-Release Workflow

Pre-releases publish versions with a tag suffix (e.g., `2.0.0-beta.0`). Always run from a feature branch.

### Full Pre-Release Cycle

```bash
# 1. Create a pre-release branch
git checkout -b release/v2-beta

# 2. Enter pre-release mode
changeset pre enter beta

# 3. Add changesets for the upcoming release
changeset

# 4. Version (creates -beta.0 versions)
changeset version

# 5. Commit and publish
git add .
git commit -m "Version packages (beta.0)"
changeset publish
git push --follow-tags

# --- Iterate: add more changes, repeat steps 3-5 ---
# Each iteration increments: -beta.1, -beta.2, etc.

# 6. When ready for stable release, exit pre-release mode
changeset pre exit

# 7. Version (strips -beta suffix, applies stable versions)
changeset version

# 8. Commit and publish stable
git add .
git commit -m "Version packages (stable)"
changeset publish
git push --follow-tags
```

**Critical warnings:**

- `pre enter` creates a `.changeset/pre.json` file -- commit this file
- `pre exit` only sets intent -- you must run `version` afterward to actually apply stable versions
- Pre-release versions do NOT satisfy standard semver ranges (`^5.0.0` does not match `5.1.0-beta.0`), so dependent packages are also bumped
- Do NOT run pre-releases on the default branch -- it blocks all normal releases until `pre exit`

### Common Pre-Release Tags

| Tag     | Purpose                        | Example Version |
| ------- | ------------------------------ | --------------- |
| `alpha` | Early testing, unstable        | `2.0.0-alpha.0` |
| `beta`  | Feature complete, testing      | `2.0.0-beta.0`  |
| `rc`    | Release candidate, near stable | `2.0.0-rc.0`    |
| `next`  | Upcoming major version         | `2.0.0-next.0`  |

---

## Snapshot Releases

Snapshots publish temporary versions for testing without permanently bumping `package.json`.

### Basic Snapshot

```bash
# Version with snapshot tag
changeset version --snapshot canary

# Publish without creating git tags
changeset publish --no-git-tag --tag canary
```

**Result:** Publishes as `0.0.0-canary-20260403T120000` (default) or calculated version if configured.

### Snapshot Config Options

```json
{
  "snapshot": {
    "useCalculatedVersion": true,
    "prereleaseTemplate": "{tag}-{datetime}"
  }
}
```

| Option                                  | Effect                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| `useCalculatedVersion: false` (default) | Base version is `0.0.0`                                         |
| `useCalculatedVersion: true`            | Base version is the calculated next version                     |
| `prereleaseTemplate`                    | Custom suffix: `{tag}`, `{commit}`, `{timestamp}`, `{datetime}` |

**Critical:** Do NOT commit or push snapshot version changes -- they are for installation testing only. Consumers install via:

```bash
npm install @myorg/core@canary
```

### Snapshot in CI (PR Preview)

A generic CI step for publishing snapshots on PRs:

```yaml
- name: Publish snapshot
  if: github.event_name == 'pull_request'
  run: |
    changeset version --snapshot pr-${{ github.event.number }}
    changeset publish --no-git-tag --tag pr-${{ github.event.number }}
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This publishes packages tagged as `pr-123` so reviewers can test the exact PR changes:

```bash
npm install @myorg/core@pr-123
```
