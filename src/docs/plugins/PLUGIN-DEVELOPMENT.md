# Plugin Development Guide

This guide explains how Claude Code plugins are created using the Claude Collective system.

## Overview

The Claude Collective uses a stack-based architecture with a single shared plugin. Skills are organized into switchable stacks, and one plugin serves all stacks.

**Key concepts:**

- **Stacks** - Collections of skills stored in `~/.claude-collective/stacks/`
- **Plugin** - Single shared plugin at `~/.claude/plugins/claude-collective/`
- **Switch** - Copies skills from stack to plugin
- **Agents** - Compiled from marketplace definitions

---

## Directory Structure

### User's Machine

```
~/.claude-collective/                    # SOURCE (our domain)
├── config.yaml                          # source, active_stack
└── stacks/
    ├── work-stack/
    │   └── skills/
    │       ├── react/SKILL.md
    │       └── hono/SKILL.md
    └── home-stack/
        └── skills/
            ├── react/SKILL.md
            └── zustand/SKILL.md

~/.claude/plugins/claude-collective/     # OUTPUT (Claude's domain)
├── .claude-plugin/
│   └── plugin.json           # REQUIRED - Plugin manifest
├── skills/                   # Active stack's skills (copied on switch)
│   ├── react/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── zustand/
│   │   └── SKILL.md
│   └── ...
├── agents/                   # Compiled agents
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
├── hooks/
│   └── hooks.json            # Optional - automation triggers
├── CLAUDE.md                 # Project conventions
└── README.md                 # Generated documentation
```

**Important**: Only `plugin.json` belongs inside `.claude-plugin/`. All other directories must be at the plugin root.

---

## Creating Stacks

### Using the CLI (Recommended)

```bash
# Create a new stack with the wizard
cc init --name my-stack

# The wizard will:
# 1. Show available skills from the marketplace
# 2. Let you select a pre-built stack or custom skills
# 3. Copy skills to your stack
# 4. If first stack: create plugin and compile agents
# 5. Activate the new stack
```

### Multiple Stacks

```bash
# Create first stack (also creates plugin)
cc init --name work-stack

# Create additional stack
cc init --name home-stack

# Switch between stacks
cc switch work-stack
cc switch home-stack

# List all stacks
cc list
```

---

## Plugin Manifest (plugin.json)

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

| Field         | Required | Description                          |
| ------------- | -------- | ------------------------------------ |
| `name`        | Yes      | Plugin identifier (kebab-case)       |
| `version`     | No       | Semantic version (MAJOR.MINOR.PATCH) |
| `description` | No       | Brief description                    |
| `author`      | No       | Author information                   |
| `keywords`    | No       | Tags for searchability               |
| `skills`      | No       | Path to skills directory             |
| `agents`      | No       | Path to agents directory             |
| `hooks`       | No       | Path to hooks configuration          |
| `license`     | No       | License identifier                   |

---

## Skills

Skills are markdown files that provide domain knowledge to agents. They are copied from the marketplace into your plugin.

### SKILL.md Structure

````yaml
---
name: react
description: React patterns and conventions for Claude agents
disable-model-invocation: false
user-invocable: true
---

# React Skill

Your skill content in Markdown...

## Critical Requirements

<critical_requirements>
- Always use functional components
- Prefer composition over inheritance
</critical_requirements>

## Examples

```tsx
// Code examples here
````

````

### Frontmatter Fields

| Field                      | Required | Description                             |
| -------------------------- | -------- | --------------------------------------- |
| `name`                     | No       | Skill name (defaults to directory name) |
| `description`              | Yes      | When Claude should use this skill       |
| `disable-model-invocation` | No       | Prevent auto-loading (default: false)   |
| `user-invocable`           | No       | Show in `/` menu (default: true)        |
| `allowed-tools`            | No       | Comma-separated tool allowlist          |
| `model`                    | No       | Model override for this skill           |
| `context`                  | No       | `fork` to run in subagent               |

### Skill Content Guidelines

1. **Clear description** - Explain when Claude should use this skill
2. **Critical requirements** - Use `<critical_requirements>` tags for must-follow rules
3. **Code examples** - Include practical, copy-paste ready examples
4. **Anti-patterns** - Document what NOT to do
5. **Keep focused** - One skill per technology/concept

---

## Agents

Agents are compiled from templates, with skill content embedded. You don't write agents directly - the CLI compiles them.

### Agent Frontmatter (Compiled Output)

```yaml
---
name: frontend-developer
description: Expert frontend developer. Use for React components and UI work.
tools: Read, Grep, Glob, Bash, Write, Edit
model: opus
permissionMode: default
---
You are a senior frontend developer specializing in React and TypeScript...

<skill_content>
... skill content embedded here during compilation ...
</skill_content>
````

| Field             | Description                             |
| ----------------- | --------------------------------------- |
| `name`            | Agent identifier (kebab-case)           |
| `description`     | When to delegate to this agent          |
| `tools`           | Comma-separated tool allowlist          |
| `disallowedTools` | Comma-separated tool denylist           |
| `model`           | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permissionMode`  | Permission handling mode                |

---

## Hooks

Hooks allow automation triggers at specific events.

### hooks.json Structure

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

### Hook Events

| Event               | When it fires           |
| ------------------- | ----------------------- |
| `SessionStart`      | Session begins          |
| `UserPromptSubmit`  | User submits prompt     |
| `PreToolUse`        | Before tool execution   |
| `PostToolUse`       | After tool succeeds     |
| `PermissionRequest` | Permission dialog shown |
| `Stop`              | Agent finishes          |
| `SubagentStop`      | Subagent finishes       |

### Environment Variables in Hooks

- `${CLAUDE_PLUGIN_ROOT}` - Absolute path to plugin directory
- `${CLAUDE_PROJECT_DIR}` - Project root directory

---

## Managing Stacks

### Adding Skills

```bash
# Add a skill to the active stack
cc add zustand

# This will:
# 1. Fetch the skill from marketplace
# 2. Copy to your stack's skills/ folder
# 3. Run switch to update plugin
```

### Switching Stacks

```bash
# Switch to a different stack
cc switch work-stack

# This will:
# 1. Remove plugin's current skills/
# 2. Copy skills from work-stack to plugin
# 3. Update active_stack in config
```

### Updating Skills

```bash
# Update a single skill
cc update react

# Update all skills
cc update --all

# This fetches latest from marketplace and updates stack
```

### Manual Recompilation

After manually editing skills in the plugin, recompile agents:

```bash
cc compile
```

### Validation

```bash
# Validate the plugin
cc validate

# Common issues:
# - Missing plugin.json
# - Invalid JSON syntax
# - Non-kebab-case name
# - Invalid semver version
```

---

## Best Practices

### Skill Content

- Use `<critical_requirements>` for must-follow rules
- Include practical code examples
- Document anti-patterns
- Keep skills focused on one technology

### Stack Naming

- Use kebab-case: `work-stack`, `home-stack`
- Be descriptive but concise
- Common patterns: `work-stack`, `home-stack`, `project-name-stack`

### When to Use Multiple Stacks

| Use Case              | Example                    |
| --------------------- | -------------------------- |
| Work vs personal      | `work-stack`, `home-stack` |
| Different tech stacks | `react-stack`, `vue-stack` |
| Project-specific      | `project-a-stack`          |
| Experimenting         | `experimental-stack`       |

---

## Troubleshooting

### Plugin Not Loading

1. Verify `plugin.json` exists in `.claude-plugin/` directory
2. Check JSON syntax is valid
3. Ensure `name` is kebab-case
4. Ensure `version` is valid semver

### Skills Not Found

1. Verify `skills` path in `plugin.json` points to correct directory
2. Check each skill has `SKILL.md` file
3. Validate frontmatter syntax

### Agents Not Loading

1. Verify `agents` path in `plugin.json`
2. Check agent files have valid frontmatter
3. Run `cc compile` to regenerate

### No Active Stack

If `cc add` fails with "no active stack":

```bash
# Check which stack is active
cc list

# If none marked with *, switch to one
cc switch work-stack
```

### Validation Errors

```bash
# Run verbose validation
cc validate -v
```

Common issues:

- Missing required fields
- Invalid version format
- Non-kebab-case name

---

## Related Documentation

- [CLI Reference](./CLI-REFERENCE.md)
- [Plugin Distribution Architecture](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md)
- [Manual Testing Guide](./MANUAL-TESTING-GUIDE.md)
