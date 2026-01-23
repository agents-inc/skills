# Plugin Development Guide

This guide explains how Claude Code plugins are created using the Claude Collective system.

## Overview

The Claude Collective compiles skills from the marketplace into complete Claude Code plugins. Each plugin contains:

- **Skills** - Copied from the marketplace
- **Agents** - Compiled with skill content embedded
- **Hooks** - Optional automation triggers
- **CLAUDE.md** - Project conventions

**Key principle:** Skills are embedded in the plugin and their content is compiled into agents. This allows skills to evolve together as a cohesive unit.

---

## Plugin Structure

### Complete Plugin (Output of `cc init`)

```
my-stack/
├── .claude-plugin/
│   └── plugin.json           # REQUIRED - Plugin manifest
├── skills/                   # Skills copied from marketplace
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

## Creating a Plugin

### Using the CLI (Recommended)

```bash
# Create a new plugin with the wizard
cc init --name my-stack

# The wizard will:
# 1. Show available skills from the marketplace
# 2. Let you select a pre-built stack or custom skills
# 3. Compile everything into a complete plugin
```

### Plugin Output Location

| Scope     | Location                   | Use Case                     |
| --------- | -------------------------- | ---------------------------- |
| `user`    | `~/.claude/plugins/<name>` | Personal, globally available |
| `project` | `.claude/plugins/<name>`   | Team sharing via git         |

```bash
# User scope (default)
cc init --name my-stack

# Project scope
cc init --name my-stack --scope project
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

## Managing Your Plugin

### Adding Skills

```bash
# Add a skill from the marketplace
cc add skill-jotai

# This will:
# 1. Fetch the skill from marketplace
# 2. Copy to your plugin's skills/ folder
# 3. Recompile all agents
```

### Updating Skills

```bash
# Update a single skill
cc update skill-react

# Update all skills
cc update --all

# This fetches latest from marketplace and recompiles agents
```

### Manual Recompilation

After manually editing skills, recompile agents:

```bash
cc compile
```

### Validation

```bash
# Validate your plugin
cc validate

# Common issues:
# - Missing plugin.json
# - Invalid JSON syntax
# - Non-kebab-case name
# - Invalid semver version
```

### Version Management

```bash
# Bump version
cc version patch   # 1.0.0 -> 1.0.1
cc version minor   # 1.0.0 -> 1.1.0
cc version major   # 1.0.0 -> 2.0.0
```

---

## Best Practices

### Skill Content

- Use `<critical_requirements>` for must-follow rules
- Include practical code examples
- Document anti-patterns
- Keep skills focused on one technology

### Version Bumping

| Change Type                      | Version Bump           |
| -------------------------------- | ---------------------- |
| Bug fixes, typos                 | Patch (1.0.0 -> 1.0.1) |
| New content, examples            | Minor (1.0.0 -> 1.1.0) |
| Breaking changes, major rewrites | Major (1.0.0 -> 2.0.0) |

### Plugin Naming

- Use kebab-case: `my-stack`, `team-frontend`
- Be descriptive but concise
- Avoid generic names like `plugin` or `stack`

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
