# Commit Protocol for AI Agents

Quick reference for AI agents making commits to this repository.

## Commit Standards

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `style`

**Examples:**

- `feat(skills/web): add Zustand state management skill`
- `feat(skills/api): add Hono framework skill`
- `fix(metadata): correct schema references in metadata.yaml files`
- `docs: update README with new skill categories`
- `refactor(skills): rename skill directories to kebab-case`
- `chore: update prettier config`

### Co-Author Rules

- Do NOT include `Co-Authored-By: Claude` in commit messages

## Scope Conventions

| Scope | When to use |
| --- | --- |
| `skills/web` | Adding or modifying web skills |
| `skills/api` | Adding or modifying API skills |
| `skills/mobile` | Adding or modifying mobile skills |
| `skills/meta` | Adding or modifying meta skills |
| `skills/cli` | Adding or modifying CLI skills |
| `skills/infra` | Adding or modifying infra skills |
| `skills` | Changes spanning multiple skill categories |
| `metadata` | metadata.yaml changes across skills |
| `stacks` | Stack configuration changes |
| `agents` | Agent definition changes |
| `ci` | CI/CD pipeline changes |
| _(no scope)_ | Broad changes: `chore: remove deprecated files` |

## What NOT to Commit

This is a content repository (markdown + YAML). There are no build artifacts or compiled output.

- Never commit `.DS_Store` files
- Never commit `.claude/` directory contents
- Never commit `node_modules/`
- Never commit personal paths, API keys, or company-specific references

## Versioning

This repository does not use release-based versioning or changelogs. The CLI fetches skills directly from `main`. The git log serves as the changelog.

Version in `package.json` is bumped manually for notable milestones only.
