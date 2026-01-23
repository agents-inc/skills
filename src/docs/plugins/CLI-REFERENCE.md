# CLI Reference

Complete reference for the Claude Collective CLI (`cc`).

## Overview

The CLI compiles skills from the marketplace into complete Claude Code plugins. It is a thin client that fetches all content (skills, agents, principles, templates) from the marketplace at runtime.

**Network Required**: All commands require network access to fetch from the marketplace.

## Global Options

```bash
cc [command] [options]

Global Options:
  --dry-run     Preview operations without executing
  --help        Display help information
  --version     Display CLI version
```

---

## Commands Overview

| Command     | Description                             | Priority |
| ----------- | --------------------------------------- | -------- |
| `init`      | Create a complete stack plugin          | Core     |
| `add`       | Add a skill to an existing plugin       | Core     |
| `update`    | Update skills from marketplace          | Core     |
| `compile`   | Recompile agents (after manual edits)   | Core     |
| `list`      | List installed plugins and their skills | Core     |
| `validate`  | Validate plugin structure               | Core     |
| `version`   | Manage plugin version                   | Core     |
| `remove`    | Remove a skill from a plugin            | Lowest   |
| `swap`      | Swap one skill for another              | Lowest   |
| `outdated`  | Check for available skill updates       | Lowest   |
| `customize` | Add custom principles to a plugin       | Lowest   |
| `publish`   | Contribute a skill to the marketplace   | Lowest   |

---

## Core Commands

### `init`

Create a complete stack plugin with skills and compiled agents.

```bash
cc init [options]

Options:
  --name <name>      Plugin name (required)
  --source <url>     Marketplace source URL (default: github:claude-collective/skills)
  --scope <scope>    Output scope: user, project (default: "user")
  --refresh          Force refresh from marketplace (bypass cache)
```

**What it does:**

1. Fetches skills-matrix from marketplace
2. Runs interactive wizard (select pre-built stack or custom skills)
3. Fetches selected skills from marketplace
4. Fetches agent definitions, principles, templates from marketplace
5. Compiles agents (embeds skill content)
6. Generates complete plugin

**Output structure:**

```
~/.claude/plugins/<name>/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Skills copied from marketplace
│   ├── react/
│   │   └── SKILL.md
│   └── zustand/
│       └── SKILL.md
├── agents/                   # Compiled agents
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
├── hooks/
│   └── hooks.json            # If hooks configured
├── CLAUDE.md                 # Project conventions
└── README.md
```

**Scope options:**

| Scope     | Output Path                | Use Case                             |
| --------- | -------------------------- | ------------------------------------ |
| `user`    | `~/.claude/plugins/<name>` | Personal plugins, available globally |
| `project` | `.claude/plugins/<name>`   | Team sharing via git                 |

**Examples:**

```bash
# Create user-scoped plugin (default)
cc init --name my-stack

# Create project-scoped plugin (for team sharing)
cc init --name team-stack --scope project

# Use specific marketplace source
cc init --name my-stack --source github:myorg/my-skills
```

---

### `add`

Add a skill to an existing plugin and recompile agents.

```bash
cc add <skill-name> [options]

Options:
  --source <url>     Marketplace source URL
  --refresh          Force refresh from marketplace
```

**What it does:**

1. Locates existing plugin (current directory or `~/.claude/plugins/`)
2. Fetches skill from marketplace
3. Copies skill to plugin's `skills/` folder
4. Fetches agent definitions, principles, templates from marketplace
5. Recompiles all agents
6. Updates plugin in place

**Examples:**

```bash
# Add a skill to the current plugin
cc add skill-jotai

# Add skill from specific source
cc add skill-custom --source github:myorg/my-skills
```

---

### `update`

Update skills from the marketplace and recompile agents.

```bash
cc update [skill-name] [options]

Options:
  --all              Update all skills in the plugin
  --source <url>     Marketplace source URL
  --refresh          Force refresh from marketplace
```

**What it does:**

1. Fetches latest skill(s) from marketplace
2. Replaces skill(s) in plugin's `skills/` folder
3. Fetches agent definitions, principles, templates from marketplace
4. Recompiles all agents
5. Plugin updated in place

**Examples:**

```bash
# Update a single skill
cc update skill-react

# Update all skills
cc update --all
```

---

### `compile`

Recompile agents without fetching new skills. Useful after manual skill edits.

```bash
cc compile [options]

Options:
  -v, --verbose      Enable verbose logging
```

**What it does:**

1. Reads skills from local plugin's `skills/` folder
2. Fetches agent definitions, principles, templates from marketplace
3. Compiles agents
4. Writes to plugin's `agents/` folder

**Examples:**

```bash
# Recompile current plugin
cc compile

# Recompile with verbose output
cc compile -v
```

---

### `list`

List installed plugins and their skills.

```bash
cc list
```

**Output:**

```
my-fullstack-stack (23 skills, 15 agents)
├── react v2.0.0
├── zustand v1.5.0
└── ...

work-stack (18 skills, 15 agents)
├── react v2.0.0
└── ...
```

---

### `validate`

Validate plugin structure and schemas.

```bash
cc validate [path] [options]

Arguments:
  path               Path to plugin to validate

Options:
  -v, --verbose      Enable verbose logging
  -a, --all          Validate all plugins in directory
```

**Validation checks:**

- `plugin.json` exists and is valid JSON
- Required fields present (name, version)
- Name is kebab-case
- Version is valid semver
- Skills directory exists (if declared)
- Each skill has valid SKILL.md with frontmatter
- Agents directory exists (if declared)

**Examples:**

```bash
# Validate current plugin
cc validate

# Validate specific plugin
cc validate ~/.claude/plugins/my-stack

# Validate all plugins
cc validate ~/.claude/plugins --all
```

---

### `version`

Manage plugin version using semantic versioning.

```bash
cc version <action> [version]

Arguments:
  action     Version action: "patch", "minor", "major", or "set"
  version    Version to set (only for "set" action)
```

**Actions:**

| Action  | Description             | Example        |
| ------- | ----------------------- | -------------- |
| `patch` | Increment patch version | 1.0.0 -> 1.0.1 |
| `minor` | Increment minor version | 1.0.0 -> 1.1.0 |
| `major` | Increment major version | 1.0.0 -> 2.0.0 |
| `set`   | Set specific version    | 1.0.0 -> 2.5.0 |

**Examples:**

```bash
# Bump patch version
cc version patch

# Set specific version
cc version set 2.5.0
```

---

## Lowest Priority Commands

These commands are planned but lowest priority:

### `remove`

Remove a skill from a plugin.

```bash
cc remove <skill-name>
```

### `swap`

Replace one skill with another.

```bash
cc swap <old-skill> <new-skill>
```

### `outdated`

Check for available skill updates.

```bash
cc outdated
```

### `customize`

Add custom principles to a plugin.

```bash
cc customize --principles
```

### `publish`

Contribute a skill to the marketplace.

```bash
cc publish <skill-path>
```

---

## Exit Codes

| Code | Meaning            |
| ---- | ------------------ |
| 0    | Success            |
| 1    | General error      |
| 2    | Invalid arguments  |
| 130  | Cancelled (Ctrl+C) |

---

## Environment Variables

| Variable                   | Description                    |
| -------------------------- | ------------------------------ |
| `CLAUDE_COLLECTIVE_SOURCE` | Default marketplace source URL |
| `NO_COLOR`                 | Disable colored output         |

---

## Related Documentation

- [Plugin Distribution Architecture](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md)
- [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md)
- [Manual Testing Guide](./MANUAL-TESTING-GUIDE.md)
