# Claude Collective CLI

A CLI for managing Claude Code skills, stacks, and agents.

## Command Reference

| Command                               | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `cc init`                             | Initialize your first stack in a project |
| `cc add`                              | Add additional stack to existing project |
| `cc update`                           | Update existing stack's skill selection  |
| `cc compile`                          | Compile agents for Claude Code           |
| `cc list`                             | List all stacks in project               |
| `cc switch`                           | Switch active stack                      |
| `cc validate`                         | Validate all YAML files against schemas  |
| `cc config show`                      | Show effective configuration             |
| `cc config set <key> <value>`         | Set global config value                  |
| `cc config set-project <key> <value>` | Set project config value                 |
| `cc config get <key>`                 | Get config value                         |
| `cc config unset <key>`               | Remove global config value               |
| `cc config unset-project <key>`       | Remove project config value              |
| `cc config path`                      | Show config file paths                   |

---

## What is Claude Collective?

Claude Collective is a system for managing reusable AI agent skills and tech stacks. It allows you to:

- Create custom tech stacks with specific skills (React, Zustand, Hono, etc.)
- Compile agents that understand your stack
- Switch between different stacks (personal, work, experimental)
- Share and reuse skills across projects

## Installation

```bash
npm install -g @claude-collective/cli
# or
bun add -g @claude-collective/cli
```

## Quick Start

```bash
# Initialize your first stack
cc init

# Compile agents for Claude Code
cc compile

# Switch between stacks
cc switch
```

## Commands

### `cc init`

Initialize a new stack in your project. This is your first step.

```bash
cc init [options]
```

**Options:**

- `--source <url>` - Override skills source (default: `github:claude-collective/skills`)
- `--refresh` - Force fresh download (bypass cache)
- `-v, --verbose` - Enable verbose logging

**What it does:**

1. Prompts you to select a pre-built stack or build custom
2. Creates `.claude-collective/stacks/{name}/` directory
3. Copies selected skills into the stack
4. Creates `config.yaml` with your stack configuration

**Example:**

```bash
cc init
cc init --source github:mycompany/private-skills
```

---

### `cc add`

Add an additional stack to your project (after running `cc init`).

```bash
cc add [options]
```

**Options:**

- `--source <url>` - Override skills source
- `--refresh` - Force fresh download
- `-v, --verbose` - Enable verbose logging

**What it does:**

1. Prompts for new stack name (must be unique)
2. Runs same wizard as `cc init`
3. Creates additional stack in `.claude-collective/stacks/`

**Example:**

```bash
cc add  # Creates work-stack, experimental-stack, etc.
```

---

### `cc update`

Update an existing stack's skill selection.

```bash
cc update [options]
```

**Options:**

- `--source <url>` - Override skills source
- `--refresh` - Force fresh download
- `-v, --verbose` - Enable verbose logging

**What it does:**

1. Lists your existing stacks
2. Prompts you to select one
3. Re-runs skill selection wizard
4. Updates stack configuration and skills

**Example:**

```bash
cc update
```

---

### `cc compile`

Compile agents for Claude Code from your active stack.

```bash
cc compile [options]
```

**Options:**

- `-s, --stack <name>` - Compile specific stack (default: active stack)
- `-v, --verbose` - Enable verbose logging

**What it does:**

1. Reads stack configuration from `.claude-collective/stacks/{name}/`
2. Compiles agents with embedded skills
3. Outputs to `.claude/agents/` for Claude Code to use

**Example:**

```bash
cc compile                      # Compile active stack
cc compile -s work-stack        # Compile specific stack
```

---

### `cc list`

List all stacks in your project.

```bash
cc list
```

**What it shows:**

- Stack names
- Number of skills
- Active stack indicator (\*)

**Example output:**

```
Your Stacks:
  * home-stack (25 skills) [active]
    work-stack (18 skills)
    experimental (12 skills)
```

---

### `cc switch`

Switch the active stack (changes which stack `cc compile` uses by default).

```bash
cc switch [stack-name]
```

**What it does:**

1. Lists available stacks (if no name provided)
2. Updates `.claude-collective/active-stack` file
3. Next `cc compile` will use the selected stack

**Example:**

```bash
cc switch work-stack
cc switch  # Interactive selection
```

---

### `cc validate`

Validate all YAML files against their schemas.

```bash
cc validate [options]
```

**Options:**

- `-v, --verbose` - Enable verbose logging

**What it validates:**

- `metadata.yaml` files in skills
- `config.yaml` files in stacks
- `SKILL.md` frontmatter
- Agent definitions

**Example:**

```bash
cc validate
```

---

### `cc config`

Manage Claude Collective configuration.

#### `cc config show`

Show current effective configuration with precedence chain.

```bash
cc config show
```

**Example output:**

```
Source: github:claude-collective/skills
  (from default)

Configuration Layers:
  1. Environment (CC_SOURCE): (not set)
  2. Project config: .claude-collective/config.yaml (not configured)
  3. Global config: ~/.claude-collective/config.yaml (not configured)
  4. Default: github:claude-collective/skills

Precedence: flag > env > project > global > default
```

#### `cc config set <key> <value>`

Set a global configuration value.

```bash
cc config set source github:mycompany/skills
cc config set author @myname
```

**Valid keys:**

- `source` - Default skills source URL
- `author` - Default author name for created skills

**Where it saves:** `~/.claude-collective/config.yaml`

#### `cc config set-project <key> <value>`

Set a project-level configuration value.

```bash
cc config set-project source github:myteam/team-skills
```

**Valid keys:**

- `source` - Skills source URL for this project only

**Where it saves:** `.claude-collective/config.yaml` (in current directory)

#### `cc config get <key>`

Get a configuration value.

```bash
cc config get source
cc config get author
```

#### `cc config unset <key>`

Remove a global configuration value.

```bash
cc config unset source
cc config unset author
```

#### `cc config unset-project <key>`

Remove a project-level configuration value.

```bash
cc config unset-project source
```

#### `cc config path`

Show configuration file paths.

```bash
cc config path
```

**Example output:**

```
Global:  /home/user/.claude-collective/config.yaml
Project: /path/to/project/.claude-collective/config.yaml
```

---

## Configuration System

### Configuration Precedence

When determining which skills source to use, the CLI checks in this order:

1. **CLI flag** - `--source github:org/repo`
2. **Environment variable** - `CC_SOURCE=github:org/repo`
3. **Project config** - `.claude-collective/config.yaml`
4. **Global config** - `~/.claude-collective/config.yaml`
5. **Default** - `github:claude-collective/skills`

### Configuration Files

#### Global Config (`~/.claude-collective/config.yaml`)

```yaml
source: github:mycompany/skills
author: @myname
```

Set with: `cc config set source <url>`

#### Project Config (`.claude-collective/config.yaml`)

```yaml
source: github:team/team-skills
```

Create manually in your project root.

### Environment Variables

```bash
export CC_SOURCE=github:mycompany/skills
cc init  # Uses environment variable
```

---

## Skills Sources

### Using Default Source

By default, the CLI fetches skills from `github:claude-collective/skills`.

```bash
cc init  # Uses default
```

### Using Custom Source

#### Via Flag

```bash
cc init --source github:mycompany/private-skills
```

#### Via Global Config

```bash
cc config set source github:mycompany/private-skills
cc init  # Uses global config
```

#### Via Environment

```bash
export CC_SOURCE=github:mycompany/private-skills
cc init  # Uses environment variable
```

### Private Repositories

For private repositories, set authentication:

```bash
# GitHub
export GIGET_AUTH=ghp_yourtoken

# Or use GitHub token
export GITHUB_TOKEN=ghp_yourtoken
```

Create a token at: https://github.com/settings/tokens

**Required scopes:** `repo` (private repos) or `public_repo` (public only)

### Local Development

Point to a local skills directory:

```bash
cc init --source /path/to/local/skills
cc init --source ./my-skills  # Relative path
```

---

## Directory Structure

After running `cc init` and `cc compile`:

```
my-project/
├── .claude-collective/          # Your stacks (source)
│   ├── active-stack             # Plain text: "home-stack"
│   └── stacks/
│       └── home-stack/
│           ├── config.yaml      # Stack configuration
│           └── skills/          # Copied skills
│               ├── frontend/
│               │   └── react (@vince)/
│               └── backend/
│
├── .claude/                     # Compiled output (for Claude Code)
│   ├── agents/                  # Compiled agents
│   ├── skills/                  # Compiled skills
│   └── CLAUDE.md                # Stack philosophy
│
└── src/
```

**Important:**

- `.claude-collective/` - Your configuration (edit this)
- `.claude/` - Generated output (don't edit, regenerate with `cc compile`)

---

## Common Workflows

### Creating Your First Stack

```bash
# 1. Initialize
cc init

# 2. Select "Build custom stack"

# 3. Choose your skills
#    - Framework: React
#    - Styling: SCSS Modules
#    - State: Zustand
#    - etc.

# 4. Compile agents
cc compile
```

### Working with Multiple Stacks

```bash
# Personal projects
cc init  # Creates home-stack

# Work projects
cc add   # Creates work-stack

# Switch between them
cc switch home-stack
cc compile

cc switch work-stack
cc compile
```

### Using Private Company Skills

```bash
# Set up authentication
export GIGET_AUTH=ghp_yourtoken

# Configure global default
cc config set source github:mycompany/skills

# All commands now use company skills
cc init
cc add
cc update
```

### Updating Skills

```bash
# Get latest skills from source
cc update --refresh

# Select stack to update
# Re-run wizard with latest skills
# Compile to apply changes
cc compile
```

---

## NPM Scripts (for development)

If working on the CLI itself:

```bash
bun cc:init           # Run cc init
bun cc:add            # Run cc add
bun cc:update         # Run cc update
bun cc:compile        # Run cc compile
bun cc:validate       # Run cc validate
bun cc:config         # Run cc config
bun cc:list           # Run cc list
bun cc:switch         # Run cc switch
```

---

## Troubleshooting

### "Repository not found"

**Cause:** Private repository or wrong URL

**Fix:**

```bash
export GIGET_AUTH=ghp_yourtoken
cc init --source github:mycompany/skills
```

### "Authentication required"

**Cause:** Missing token for private repository

**Fix:**

```bash
export GIGET_AUTH=ghp_yourtoken
# or
export GITHUB_TOKEN=ghp_yourtoken
```

### "Network error"

**Cause:** Corporate proxy or network issues

**Fix:**

```bash
export HTTPS_PROXY=http://your-proxy:port
export FORCE_NODE_FETCH=true  # Required for Node 20+
```

### Force Fresh Download

If cached content is stale:

```bash
cc init --refresh
cc update --refresh
```

Or delete cache manually:

```bash
rm -rf ~/.cache/claude-collective/
```

---

## Next Steps

After setting up your stack:

1. **Compile agents:** `cc compile`
2. **Use with Claude Code:** Agents are now in `.claude/agents/`
3. **Switch stacks:** `cc switch` when working on different projects
4. **Update skills:** `cc update --refresh` to get latest

---

## Support

- **Issues:** https://github.com/claude-collective/cli/issues
- **Documentation:** https://github.com/claude-collective/skills
- **Community:** https://github.com/claude-collective/skills/discussions
