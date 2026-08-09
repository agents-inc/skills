# Changesets Reference

> CLI command reference, config options, and official documentation links. See [SKILL.md](SKILL.md) for decision frameworks and red flags.

---

## CLI Command Reference

| Command                       | Purpose                                             | Key Flags                                        |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `changeset init`              | Set up `.changeset/` directory                      | --                                               |
| `changeset` / `changeset add` | Create a changeset file                             | `--empty`, `--open`, `-m <msg>`, `--since <ref>` |
| `changeset version`           | Consume changesets, bump versions, write changelogs | `--ignore <pkg>`, `--snapshot [tag]`             |
| `changeset publish`           | Publish packages to npm, create git tags            | `--otp <token>`, `--tag <name>`, `--no-git-tag`  |
| `changeset status`            | Show pending changesets and expected bumps          | `--verbose`, `--output <file>`, `--since <ref>`  |
| `changeset pre enter <tag>`   | Enter pre-release mode                              | tag: `alpha`, `beta`, `rc`, `next`, etc.         |
| `changeset pre exit`          | Signal intent to exit pre-release mode              | --                                               |
| `changeset tag`               | Create git tags for current versions                | --                                               |

---

## Config Options (.changeset/config.json)

| Option                                  | Type                                     | Default                         | Description                       |
| --------------------------------------- | ---------------------------------------- | ------------------------------- | --------------------------------- |
| `changelog`                             | `false \| string \| [string, options]`   | `"@changesets/cli/changelog"`   | Changelog generator module        |
| `commit`                                | `boolean \| string \| [string, options]` | `false`                         | Auto-commit on add/version        |
| `access`                                | `"restricted" \| "public"`               | `"restricted"`                  | npm publish access level          |
| `baseBranch`                            | `string`                                 | `"main"`                        | Branch for comparison             |
| `fixed`                                 | `string[][]`                             | `[]`                            | Package groups released together  |
| `linked`                                | `string[][]`                             | `[]`                            | Package groups sharing versions   |
| `updateInternalDependencies`            | `"patch" \| "minor"`                     | `"patch"`                       | Min bump to update internal deps  |
| `ignore`                                | `string[]`                               | `[]`                            | Packages excluded from publishing |
| `bumpVersionsWithWorkspaceProtocolOnly` | `boolean`                                | `false`                         | Only bump `workspace:` ranges     |
| `privatePackages`                       | `{ version, tag } \| false`              | `{ version: true, tag: false }` | How to handle private packages    |
| `snapshot.useCalculatedVersion`         | `boolean`                                | `false`                         | Use real version as snapshot base |
| `snapshot.prereleaseTemplate`           | `string`                                 | `"{tag}-{datetime}"`            | Snapshot version suffix template  |

### Snapshot Template Placeholders

| Placeholder   | Value                    |
| ------------- | ------------------------ |
| `{tag}`       | Snapshot tag name        |
| `{commit}`    | Current git commit hash  |
| `{timestamp}` | Unix timestamp           |
| `{datetime}`  | ISO-like datetime string |

---

## Changeset File Format

```markdown
---
"@myorg/core": minor
"@myorg/cli": patch
---

Description of the change (becomes CHANGELOG.md entry).
```

- File location: `.changeset/<random-name>.md`
- YAML frontmatter: maps package names to `major | minor | patch`
- Markdown body: becomes the changelog entry verbatim
- Empty changeset: `changeset --empty` (creates a file with no packages)

---

## fixed vs linked Quick Reference

| Behavior                   | `fixed`          | `linked`                        |
| -------------------------- | ---------------- | ------------------------------- |
| All packages bump together | Yes (always)     | No (only those with changesets) |
| Share the same version     | Yes              | Yes (when bumped)               |
| Unchanged packages bumped  | Yes              | No                              |
| Glob support               | Yes (micromatch) | Yes (micromatch)                |
| Use case                   | Single product   | Related but independent         |

---

## Official Documentation

- [Changesets GitHub repo](https://github.com/changesets/changesets)
- [Intro to Using Changesets](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
- [Config File Options](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md)
- [Command Line Options](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md)
- [Pre-releases](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- [Snapshot Releases](https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md)
- [Fixed Packages](https://github.com/changesets/changesets/blob/main/docs/fixed-packages.md)
- [Linked Packages](https://github.com/changesets/changesets/blob/main/docs/linked-packages.md)
- [Automating Changesets](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md)
- [Custom Changelog Format](https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md)
- [changesets/action (GitHub Action)](https://github.com/changesets/action)
- [changesets/bot (PR bot)](https://github.com/changesets/bot)
- [@changesets/cli on npm](https://www.npmjs.com/package/@changesets/cli)
