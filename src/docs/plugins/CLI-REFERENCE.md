# CLI Reference

Complete reference for the Claude Collective CLI (`cc`).

## Overview

The CLI uses a stack-based architecture with a single shared plugin. Skills are organized into switchable stacks stored in `.claude-collective/stacks/`, and one plugin at `.claude/plugins/claude-collective/` serves all stacks. All paths are project-local (not global).

**Network Required**: Most commands require network access to fetch from the marketplace.

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

### User-Facing Commands

| Command    | Description                                      | Priority |
| ---------- | ------------------------------------------------ | -------- |
| `init`     | Create new stack (first one also creates plugin) | Core     |
| `switch`   | Switch active stack (copies skills to plugin)    | Core     |
| `edit`     | Edit skills in active stack (add/remove)         | Core     |
| `list`     | List all stacks with active marker               | Core     |
| `compile`  | Recompile agents after manual skill edits        | Core     |
| `update`   | Update skills from source                        | Core     |
| `config`   | Manage configuration                             | Core     |
| `validate` | Validate plugin structure                        | Core     |

### Publishing Commands (CI Only)

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `compile-plugins`      | Build skill plugins for marketplace   |
| `compile-stack -s X`   | Build pre-built stack for marketplace |
| `generate-marketplace` | Generate marketplace.json             |

### Lowest Priority (Not Yet Implemented)

| Command     | Description                           |
| ----------- | ------------------------------------- |
| `outdated`  | Check for available skill updates     |
| `customize` | Add custom principles to a plugin     |
| `publish`   | Contribute a skill to the marketplace |

---

## Core Commands

### `init`

Create a new stack with skills. First stack also creates the shared plugin.

```bash
cc init [options]

Options:
  --name <name>      Stack name (required, kebab-case)
  --source <url>     Marketplace source URL (default: github:claude-collective/skills)
  --refresh          Force refresh from marketplace (bypass cache)
```

**What it does:**

1. Creates `.claude-collective/stacks/<name>/skills/`
2. Runs interactive wizard (select pre-built stack or custom skills)
3. Fetches selected skills from marketplace
4. Copies skills to stack directory
5. If first stack: creates plugin at `.claude/plugins/claude-collective/`
6. If first stack: fetches agent definitions and compiles
7. Runs switch logic to activate new stack

**Output structure:**

```
my-project/
├── .claude-collective/                  # SOURCE (project-local)
│   ├── config.yaml                      # active_stack: <name>
│   └── stacks/
│       └── <name>/
│           └── skills/
│               ├── react/SKILL.md
│               └── zustand/SKILL.md
│
├── .claude/
│   └── plugins/
│       └── claude-collective/           # OUTPUT (project-local, on first init)
│           ├── .claude-plugin/plugin.json
│           ├── agents/
│           ├── skills/                  # Copied from active stack
│           ├── hooks/hooks.json
│           ├── CLAUDE.md
│           └── README.md
```

**Examples:**

```bash
# Create first stack (also creates plugin)
cc init --name my-stack

# Create additional stack
cc init --name work-stack

# Use specific marketplace source
cc init --name my-stack --source github:myorg/my-skills
```

---

### `switch`

Switch to a different stack. Copies skills from stack to plugin.

```bash
cc switch [stack-name]
```

**Arguments:**

- `stack-name` - Stack name to switch to (optional - shows interactive selector if omitted)

**What it does:**

1. If no stack name provided, shows interactive selector with all stacks
2. Validates stack exists in `.claude-collective/stacks/<name>/`
3. Removes `.claude/plugins/claude-collective/skills/`
4. Copies from `.claude-collective/stacks/<name>/skills/` to plugin
5. Updates `active_stack` in config

**Examples:**

```bash
# Show interactive stack selector
cc switch

# Switch directly to work stack
cc switch work-stack
```

---

### `edit`

Edit skills in the active stack. Opens the full skill selection wizard with current skills pre-selected. Allows adding and removing skills in a single operation.

```bash
cc edit [options]

Options:
  --source <url>     Marketplace source URL
  --refresh          Force refresh from marketplace
```

**What it does:**

1. Gets active stack from config
2. Loads current skills from stack
3. Opens skill wizard with current skills pre-selected
4. Shows changes (added/removed skills) before confirming
5. Updates stack and plugin with new selection
6. Recompiles agents with updated skills

**Examples:**

```bash
# Edit skills in active stack
cc edit

# Edit with specific source
cc edit --source github:myorg/my-skills
```

---

### `list`

List all stacks with active marker.

```bash
cc list
```

**Output:**

```
Stacks:
* work-stack (18 skills)
  home-stack (23 skills)
  minimal-stack (5 skills)
```

The `*` marker indicates the currently active stack.

---

### `compile`

Recompile agents without fetching new skills. Useful after manual skill edits.

```bash
cc compile [options]

Options:
  -v, --verbose      Enable verbose logging
```

**What it does:**

1. Reads skills from plugin's `skills/` folder
2. Fetches agent definitions, principles, templates from marketplace
3. Compiles agents (embeds skill references)
4. Writes to plugin's `agents/` folder

**Examples:**

```bash
# Recompile agents
cc compile

# Recompile with verbose output
cc compile -v
```

---

### `update`

Update skills from the marketplace.

```bash
cc update [skill-name] [options]

Options:
  --all              Update all skills in active stack
  --source <url>     Marketplace source URL
  --refresh          Force refresh from marketplace
```

**What it does:**

1. Re-fetches skill(s) from marketplace
2. Updates in active stack's skills directory
3. Runs switch logic to update plugin

**Examples:**

```bash
# Update a single skill
cc update react

# Update all skills
cc update --all
```

---

### `config`

Manage configuration settings.

```bash
cc config <action> [key] [value]

Actions:
  show               Show effective configuration
  set <key> <value>  Set global config value
  get <key>          Get resolved config value
  unset <key>        Remove global config value
  path               Show config file paths
```

**Examples:**

```bash
# Show all configuration
cc config show

# Set default source
cc config set source github:myorg/my-skills

# Get current source
cc config get source
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
cc validate .claude/plugins/claude-collective

# Validate all plugins
cc validate .claude/plugins --all
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

## Publishing Commands (CI Only)

### `compile-plugins`

Compile all skills to individual plugins for marketplace distribution.

```bash
cc compile-plugins [options]

Options:
  --skill <path>     Compile single skill (full path with author suffix)
  --all              Compile all skills
  -v, --verbose      Enable verbose logging
```

### `compile-stack`

Compile a pre-built stack for marketplace distribution.

```bash
cc compile-stack [options]

Options:
  -s, --stack <name>  Stack to compile (required)
  -v, --verbose       Enable verbose logging
```

### `generate-marketplace`

Generate marketplace.json with all available plugins.

```bash
cc generate-marketplace
```

---

## Lowest Priority Commands

These commands are planned but not yet implemented:

### `outdated`

Check for available skill updates.

```bash
cc outdated
```

### `customize`

Add custom principles to the plugin.

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
