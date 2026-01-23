# CLI Reference

Complete reference for the Claude Collective CLI (`cc`).

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

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `init`                 | Initialize a new stack (classic or plugin mode) |
| `add`                  | Add another stack to an existing project        |
| `update`               | Update an existing stack                        |
| `compile`              | Compile the active stack to `.claude/` output   |
| `compile-plugins`      | Compile all skills into individual plugins      |
| `compile-stack`        | Compile a stack configuration into a plugin     |
| `generate-marketplace` | Generate marketplace.json from compiled plugins |
| `validate`             | Validate plugin structure and schemas           |
| `version`              | Manage plugin version                           |
| `switch`               | Switch active stack                             |
| `list`                 | List available stacks                           |
| `config`               | Manage CLI configuration                        |

---

## Initialization Commands

### `init`

Initialize Claude Collective in your project. Supports two modes:

- **Classic mode**: Creates `.claude-collective/` directory structure
- **Plugin mode**: Creates a standalone Claude Code plugin

```bash
cc init [options]

Options:
  --source <url>     Skills source URL (e.g., github:org/repo or local path)
  --refresh          Force refresh from remote source (default: false)
  --name <name>      Plugin name (enables plugin mode)
  --scope <scope>    Output scope: user, project, local (default: "user")
  --plugin           Enable plugin output mode (default: false)
```

**Scope Options:**

| Scope     | Output Path                | Use Case                             |
| --------- | -------------------------- | ------------------------------------ |
| `user`    | `~/.claude/plugins/<name>` | Personal plugins, available globally |
| `project` | `.claude/plugins/<name>`   | Team sharing via git                 |
| `local`   | `.claude/plugins/<name>`   | Project-specific, gitignored         |

**Examples:**

```bash
# Classic mode - creates .claude-collective/
cc init

# Plugin mode - creates user-scoped plugin
cc init --name my-stack --plugin

# Plugin mode with project scope (for team sharing)
cc init --name team-stack --scope project

# Use specific source
cc init --source github:claude-collective/skills --name my-stack
```

### `add`

Add another stack to an existing Claude Collective project.

```bash
cc add [options]

Options:
  --source <url>     Skills source URL
  --refresh          Force refresh from remote source
```

### `update`

Update an existing stack with the latest skills from source.

```bash
cc update [stack-name] [options]

Options:
  --source <url>     Skills source URL
  --refresh          Force refresh from remote source
```

---

## Compilation Commands

### `compile`

Compile the active stack to `.claude/` output format.

```bash
cc compile [options]
```

Reads the active stack configuration and compiles skills and agents to the `.claude/` directory.

### `compile-plugins`

Compile all skills into standalone plugins.

```bash
cc compile-plugins [options]

Options:
  -s, --skills-dir <dir>    Skills source directory (default: "src/skills")
  -o, --output-dir <dir>    Output directory (default: "dist/plugins")
  --skill <name>            Compile only a specific skill (path to skill directory)
  -v, --verbose             Enable verbose logging (default: false)
```

**Examples:**

```bash
# Compile all skills
cc compile-plugins

# Compile to custom output directory
cc compile-plugins -o build/plugins

# Compile single skill
cc compile-plugins --skill frontend/react

# Verbose output
cc compile-plugins -v
```

**Output Structure:**

```
dist/plugins/
  skill-react/
    .claude-plugin/
      plugin.json
    skills/
      react/
        SKILL.md
    README.md
  skill-zustand/
    ...
```

### `compile-stack`

Compile a stack configuration into a standalone plugin.

```bash
cc compile-stack [options]

Options:
  -s, --stack <id>       Stack ID to compile (directory name in src/stacks/)
  -o, --output-dir <dir> Output directory (default: "dist/stacks")
  -v, --verbose          Enable verbose logging (default: false)
```

If `--stack` is not provided, displays an interactive selection menu.

**Examples:**

```bash
# Interactive stack selection
cc compile-stack

# Compile specific stack
cc compile-stack -s fullstack-react

# Compile to custom directory
cc compile-stack -s fullstack-react -o build/stacks
```

**Output Structure:**

```
dist/stacks/fullstack-react/
  .claude-plugin/
    plugin.json
  agents/
    frontend-developer.md
    backend-developer.md
    ...
  skills/
    react/
      SKILL.md
    zustand/
      SKILL.md
    ...
  CLAUDE.md
  README.md
```

### `generate-marketplace`

Generate `marketplace.json` from compiled plugins.

```bash
cc generate-marketplace [options]

Options:
  -p, --plugins-dir <dir>    Plugins directory (default: "dist/plugins")
  -o, --output <file>        Output file (default: ".claude-plugin/marketplace.json")
  --name <name>              Marketplace name (default: "claude-collective")
  --version <version>        Marketplace version (default: "1.0.0")
  --description <desc>       Marketplace description
  --owner-name <name>        Owner name (default: "Claude Collective")
  --owner-email <email>      Owner email
  -v, --verbose              Enable verbose logging (default: false)
```

**Examples:**

```bash
# Generate with defaults
cc generate-marketplace

# Custom marketplace metadata
cc generate-marketplace \
  --name my-marketplace \
  --version 2.0.0 \
  --owner-name "My Team"
```

---

## Validation Commands

### `validate`

Validate plugin structure and schemas.

```bash
cc validate [path] [options]

Arguments:
  path                     Path to plugin or plugins directory to validate

Options:
  -v, --verbose            Enable verbose logging (default: false)
  -a, --all                Validate all plugins in directory (default: false)
  -p, --plugins            Validate plugins instead of schemas (default: false)
```

**Modes:**

1. **Schema validation** (default): Validates YAML files against schemas
2. **Plugin validation**: Validates compiled plugin structure

**Examples:**

```bash
# Validate YAML schemas (default)
cc validate

# Validate single plugin
cc validate ./dist/plugins/skill-react

# Validate all plugins in directory
cc validate ./dist/plugins --all

# Validate plugins (when path not provided)
cc validate --plugins
```

**Validation Checks:**

- `plugin.json` exists and is valid JSON
- Required fields present (name, version)
- Name is kebab-case
- Version is valid semver
- Skills directory exists (if declared)
- Each skill has valid SKILL.md with frontmatter

---

## Version Management

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
# Bump patch version (1.0.0 -> 1.0.1)
cc version patch

# Bump minor version (1.0.0 -> 1.1.0)
cc version minor

# Bump major version (1.0.0 -> 2.0.0)
cc version major

# Set specific version
cc version set 2.5.0
```

The command searches upward from the current directory for a `plugin.json` file.

---

## Stack Management

### `switch`

Switch the active stack.

```bash
cc switch [stack-name]
```

If no stack name is provided, displays an interactive selection menu.

### `list`

List available stacks.

```bash
cc list
```

Displays all stacks in the `.claude-collective/stacks/` directory.

---

## Configuration

### `config`

Manage CLI configuration.

```bash
cc config <subcommand>

Subcommands:
  get <key>           Get configuration value
  set <key> <value>   Set configuration value
  list                List all configuration
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

| Variable                   | Description               |
| -------------------------- | ------------------------- |
| `CLAUDE_COLLECTIVE_SOURCE` | Default skills source URL |
| `NO_COLOR`                 | Disable colored output    |

---

## Related Documentation

- [Plugin Development Guide](./PLUGIN-DEVELOPMENT.md)
- [Plugin Distribution Architecture](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md)
- [Skills Roadmap](../skills/SKILLS_ROADMAP.md)
