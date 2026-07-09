# Changesets Core Examples

> Changeset files, config setup, versioning, publishing, and monorepo strategies. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [ci.md](ci.md) for CI automation and pre-release patterns.

---

## Changeset File Examples

### Standard Changeset (Single Package)

```markdown
---
"@myorg/utils": patch
---

Fix edge case in `formatDate` where timezone offset was ignored for UTC inputs.
```

**Why good:** Specific description that explains the change and its context -- this becomes the CHANGELOG.md entry.

```markdown
---
"@myorg/utils": patch
---

fix bug
```

**Why bad:** Vague description provides no useful context in the changelog. Future readers cannot understand what changed or why.

---

### Multi-Package Changeset

When a single code change affects multiple packages, declare all bumps in one changeset file:

```markdown
---
"@myorg/core": minor
"@myorg/cli": patch
"@myorg/types": patch
---

Add custom template support to the core rendering engine.
The CLI now accepts a `--template` flag that passes through to core.
Types updated with the new `TemplateOptions` interface.
```

**Why good:** One changeset captures the full scope of a cross-cutting change. Each package gets the correct bump type. The description explains the relationship between changes.

---

### Empty Changeset (No Release Needed)

For changes that should not trigger a version bump (docs, CI config, dev tooling):

```bash
changeset --empty
```

This creates a changeset with no packages listed:

```markdown
---
---
```

**When to use:** CI enforcement requires a changeset on every PR (`changeset status --since=main`), but the change does not affect any published package.

---

## Config Variations

### Minimal Config (Single Package, Public)

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

---

### Config with GitHub Changelog Generator

The `@changesets/changelog-github` generator adds PR links and contributor attribution to changelog entries:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "myorg/myrepo" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Key point:** Requires `npm install @changesets/changelog-github` and a `GITHUB_TOKEN` environment variable at version time for PR lookups.

---

### Config with Fixed and Linked Groups

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    ["@myorg/react-button", "@myorg/react-input", "@myorg/react-select"]
  ],
  "linked": [["@myorg/core", "@myorg/utils"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/docs", "@myorg/dev-tools"]
}
```

**Key points:**

- `fixed`: all three react-\* packages always release together with the same version
- `linked`: core and utils share versions, but only when both have changesets
- `ignore`: docs and dev-tools are excluded from publishing entirely
- Glob patterns supported: `["@myorg/react-*"]` instead of listing each package

---

## The Release Workflow

### Full Manual Release

```bash
# 1. Check what changesets exist
changeset status --verbose

# 2. Consume changesets, bump versions, write changelogs
changeset version

# 3. Review the changes
git diff

# 4. Commit version bumps and changelog entries
git add .
git commit -m "Version packages"

# 5. Publish to npm (creates git tags automatically)
changeset publish

# 6. Push commits and tags to remote
git push --follow-tags
```

**Critical:** Always commit between `version` and `publish` so that git tags created by `publish` point to the commit with the correct `package.json` versions.

---

### Status Check Before Release

```bash
# Show pending changesets with expected version bumps
changeset status --verbose

# Output status as JSON (useful for CI scripts)
changeset status --output=changeset-status.json

# Check for changesets since a specific ref (CI enforcement)
changeset status --since=main
# Exits with code 1 if no changesets found
```

---

## Monorepo: fixed vs linked Behavior

### Fixed Packages Example

Config: `"fixed": [["pkg-a", "pkg-b"]]`

Starting state: both at `1.0.0`.

| Changeset                  | pkg-a bump        | pkg-b bump        | Result                             |
| -------------------------- | ----------------- | ----------------- | ---------------------------------- |
| Only pkg-a: minor          | minor             | (none, but fixed) | Both become `1.1.0`                |
| Only pkg-b: patch          | (none, but fixed) | patch             | Both become `1.0.1`                |
| pkg-a: minor, pkg-b: patch | minor             | patch             | Both become `1.1.0` (highest wins) |

**Key behavior:** Even unchanged packages are bumped to match the group's highest version.

### Linked Packages Example

Config: `"linked": [["pkg-a", "pkg-b"]]`

Starting state: both at `1.0.0`.

| Changeset                      | pkg-a bump | pkg-b bump | Result                                      |
| ------------------------------ | ---------- | ---------- | ------------------------------------------- |
| Only pkg-a: minor              | minor      | --         | pkg-a: `1.1.0`, pkg-b stays `1.0.0`         |
| Both: pkg-a minor, pkg-b patch | minor      | minor      | Both become `1.1.0` (highest wins for both) |

**Key behavior:** Only packages with changesets are bumped. When both change, they coordinate to the highest version in the group.

---

## Adding Changeset via CLI Flags

```bash
# Interactive prompt (default)
changeset

# Provide summary inline (skip editor)
changeset add -m "Fix timezone handling in date formatter"

# Open external editor for longer descriptions
changeset add --open

# Pre-select changed packages based on git diff
changeset add --since=main
```
