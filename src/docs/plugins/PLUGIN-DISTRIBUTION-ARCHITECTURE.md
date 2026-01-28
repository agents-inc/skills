# Plugin Distribution Architecture

> **Purpose**: CLI compiles skills into plugins for native Claude Code distribution.
> **Date**: 2026-01-24
> **Status**: Architecture finalized, implementation complete

---

## Architecture Overview

The Claude Collective CLI uses a stack-based architecture with a single shared plugin. Skills are organized into switchable stacks stored in `.claude-collective/stacks/`, and one plugin at `.claude/plugins/claude-collective/` serves all stacks. All paths are project-local (not global).

### Key Principles

1. **Stacks are source of truth** - Skills live in `.claude-collective/stacks/{name}/skills/`
2. **Single shared plugin** - One plugin at `.claude/plugins/claude-collective/`
3. **Project-local** - Both directories are project-local (siblings), not global
4. **Agents fetch from marketplace** - Agent definitions, principles, templates fetched at compile time
5. **Skills switch instantly** - `cc switch` copies skills from stack to plugin

---

## Storage Model

### User's Project

```
my-project/
├── .claude-collective/                  # SOURCE (our domain, project-local)
│   ├── config.yaml                      # source, active_stack
│   └── stacks/
│       ├── work-stack/
│       │   └── skills/
│       │       ├── react/SKILL.md
│       │       └── hono/SKILL.md
│       └── home-stack/
│           └── skills/
│               ├── react/SKILL.md
│               └── zustand/SKILL.md
│
├── .claude/
│   └── plugins/
│       └── claude-collective/           # OUTPUT (Claude's domain, project-local)
│           ├── .claude-plugin/plugin.json
│           ├── agents/                  # Shared agents (fetched from source)
│           │   ├── frontend-developer.md
│           │   └── backend-developer.md
│           ├── skills/                  # Active stack's skills (copied on switch)
│           │   ├── react/SKILL.md
│           │   └── zustand/SKILL.md
│           ├── hooks/hooks.json
│           ├── CLAUDE.md
│           └── README.md
│
└── src/                                 # Your project code
```

### Config File

```yaml
# .claude-collective/config.yaml (project-local)
source: github:claude-collective/skills
active_stack: work-stack
```

### Marketplace Repository

The marketplace (`github.com/claude-collective/skills`) contains all source content:

```
marketplace-repo/
├── src/
│   ├── skills/                      # All skills (83+)
│   │   ├── frontend/
│   │   │   ├── react (@vince)/
│   │   │   │   ├── SKILL.md
│   │   │   │   ├── metadata.yaml
│   │   │   │   ├── reference.md
│   │   │   │   └── examples/
│   │   │   └── zustand (@vince)/
│   │   └── backend/
│   │       ├── hono (@vince)/
│   │       └── drizzle (@vince)/
│   │
│   ├── agents/                      # Agent definitions
│   │   ├── developer/
│   │   │   ├── frontend-developer/
│   │   │   │   ├── agent.yaml
│   │   │   │   ├── intro.md
│   │   │   │   ├── workflow.md
│   │   │   │   └── examples.md
│   │   │   └── backend-developer/
│   │   └── _templates/              # LiquidJS templates (core principles embedded)
│   │       └── agent.liquid
│   │
│   └── stacks/                      # Pre-built stack configs
│       ├── fullstack-react/
│       └── work-stack/
│
├── skills-matrix.yaml               # Skill relationships and metadata
└── marketplace.json                 # Registry of available skills
```

### CLI (Thin Client)

The CLI contains:

- Compilation logic (LiquidJS templating)
- Network fetching utilities
- Wizard UI (@clack/prompts)
- Validation logic

The CLI does NOT contain:

- Skills
- Agent definitions
- Principles
- Templates

All content is fetched from the marketplace at runtime.

---

## Command Flows

### `cc init --name X`

Creates a new stack. First stack also creates the shared plugin:

```
1. Create .claude-collective/stacks/X/skills/
2. Fetch skills-matrix.yaml from marketplace
3. Run wizard:
   - User selects approach (pre-built stack or custom)
   - User selects skills (or uses stack defaults)
4. Fetch selected skills from marketplace
5. Copy skills to .claude-collective/stacks/X/skills/
6. If first stack:
   a. Create .claude/plugins/claude-collective/
   b. Fetch agent definitions, principles, templates
   c. Compile agents
   d. Generate plugin.json, CLAUDE.md, README.md, hooks.json
7. Run switch logic to activate new stack
```

### `cc switch X`

Switches to a different stack:

```
1. Validate stack exists in .claude-collective/stacks/X/
2. Remove .claude/plugins/claude-collective/skills/
3. Copy from .claude-collective/stacks/X/skills/ to plugin
4. Update active_stack in .claude-collective/config.yaml
5. Switched to X
```

### `cc add Y`

Adds a skill to the active stack:

```
1. Get active stack from config
2. Error if no active stack
3. Fetch skill Y from marketplace
4. Copy to .claude-collective/stacks/{active}/skills/
5. Run switch logic to update plugin
```

### `cc compile`

Recompiles agents without fetching new skills (useful after manual skill edits):

```
1. Read skills from .claude/plugins/claude-collective/skills/
2. Fetch agent definitions from marketplace
3. Fetch principles from marketplace
4. Fetch templates from marketplace
5. Compile agents (embed skill references)
6. Write to .claude/plugins/claude-collective/agents/
```

### `cc list`

Lists all stacks with active marker:

```
1. Read stacks from .claude-collective/stacks/
2. Read active_stack from config
3. Display stacks with * for active
4. Show skill count per stack
```

---

## Official Claude Code Schemas

### Plugin Directory Structure (Official)

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json              # REQUIRED - manifest (ONLY this goes here)
├── skills/                      # Skills with SKILL.md
│   ├── react/
│   │   └── SKILL.md
│   └── zustand/
│       └── SKILL.md
├── agents/                      # Agent definitions
│   ├── frontend-developer.md
│   └── backend-developer.md
├── hooks/                       # Optional hooks
│   └── hooks.json
├── .mcp.json                    # Optional MCP servers
└── README.md                    # Documentation
```

**CRITICAL**: Only `plugin.json` goes inside `.claude-plugin/`. All other directories MUST be at plugin root.

### plugin.json Schema

```json
{
  "name": "my-stack",
  "version": "1.0.0",
  "description": "My custom stack with React and Zustand",
  "author": {
    "name": "username"
  },
  "license": "MIT",
  "keywords": ["react", "zustand", "typescript"],
  "skills": "./skills/",
  "agents": "./agents/",
  "hooks": "./hooks/hooks.json"
}
```

| Field         | Required | Type          | Description                 |
| ------------- | -------- | ------------- | --------------------------- |
| `name`        | Yes      | string        | Kebab-case identifier       |
| `version`     | No       | string        | Semver (MAJOR.MINOR.PATCH)  |
| `description` | No       | string        | Brief description           |
| `author`      | No       | object        | `{name, email?}`            |
| `license`     | No       | string        | License identifier          |
| `keywords`    | No       | string[]      | Discovery tags              |
| `skills`      | No       | string        | Path to skills directory    |
| `agents`      | No       | string        | Path to agents directory    |
| `hooks`       | No       | string/object | Hooks config path or inline |

### SKILL.md Frontmatter (Official)

```yaml
---
name: react
description: React patterns and conventions for Claude agents
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
model: sonnet
context: fork
agent: Explore
---
Your skill content in Markdown...
```

| Field                      | Required | Type    | Description                                   |
| -------------------------- | -------- | ------- | --------------------------------------------- |
| `name`                     | No       | string  | Display name (uses directory name if omitted) |
| `description`              | Yes      | string  | When Claude should use this skill             |
| `disable-model-invocation` | No       | boolean | Prevent auto-loading (default: false)         |
| `user-invocable`           | No       | boolean | Show in / menu (default: true)                |
| `allowed-tools`            | No       | string  | Comma-separated tool allowlist                |
| `model`                    | No       | string  | Model override for this skill                 |
| `context`                  | No       | string  | `fork` to run in subagent                     |
| `agent`                    | No       | string  | Subagent type when `context: fork`            |

### Agent Definition Frontmatter (Official)

```yaml
---
name: frontend-developer
description: Expert frontend developer. Use for React components and UI work.
tools: Read, Grep, Glob, Bash, Write, Edit
model: inherit
permissionMode: default
---
You are a senior frontend developer specializing in React and TypeScript...
```

| Field             | Required | Type   | Description                               |
| ----------------- | -------- | ------ | ----------------------------------------- |
| `name`            | Yes      | string | Unique identifier (kebab-case)            |
| `description`     | Yes      | string | When Claude should delegate to this agent |
| `tools`           | No       | string | Comma-separated tool allowlist            |
| `disallowedTools` | No       | string | Comma-separated tool denylist             |
| `model`           | No       | string | `sonnet`, `opus`, `haiku`, or `inherit`   |
| `permissionMode`  | No       | string | `default`, `acceptEdits`, `dontAsk`, etc. |

### hooks.json Schema (Official)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Hook Events:**

- `SessionStart` - Session begins
- `UserPromptSubmit` - User submits prompt
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool succeeds
- `PermissionRequest` - Permission dialog
- `Stop` - Agent finishes
- `SubagentStop` - Subagent finishes

---

## Implementation Status

### Complete

- [x] Skill plugin compiler (83 skills)
- [x] Stack plugin compiler
- [x] Marketplace generator
- [x] Plugin validator
- [x] CLI commands: compile-plugins, compile-stack, generate-marketplace, validate, version
- [x] Stack-based architecture with single plugin
- [x] `cc init` - Create stacks with skills
- [x] `cc switch` - Switch between stacks
- [x] `cc add` - Add skills to active stack
- [x] `cc list` - List stacks with active marker
- [x] `cc compile` - Recompile agents from plugin skills
- [x] Config system with active_stack tracking

### Lowest Priority

- [ ] `cc remove` - Remove skill from stack
- [ ] `cc swap` - Swap one skill for another
- [ ] `cc outdated` - Check for skill updates
- [ ] `cc customize --principles` - Add custom principles
- [ ] `cc publish` - Contribute skills to marketplace

---

## Key Concepts

| Concept      | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| Stack        | Collection of skills stored in `.claude-collective/stacks/X/` |
| Active Stack | Currently active stack, tracked in config.yaml                |
| Plugin       | Single plugin at `.claude/plugins/claude-collective/`         |
| Switch       | Copies skills from stack to plugin, updates active_stack      |
| Source       | Marketplace URL (default: `github:claude-collective/skills`)  |

---

## Key Insight

**We are the only project that compiles skills into agents this way.**

Our unique value:

- Combining multiple skills into coherent agent prompts
- LiquidJS templating with principles injection
- Stack-based skill selection
- Marketplace as single source of truth

The plugin format is just the **output container**. The compilation is the magic.

---

## References

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces Guide](https://code.claude.com/docs/en/plugin-marketplaces)
- [Skills Documentation](https://code.claude.com/docs/en/skills)
- [Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Hooks Documentation](https://code.claude.com/docs/en/hooks)

---

_Last updated: 2026-01-24_
