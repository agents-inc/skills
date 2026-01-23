# Plugin Development Guide

This guide explains how to create and distribute Claude Code plugins using the Claude Collective system.

## Overview

The Claude Collective compiles skills into two types of plugins:

1. **Skill Plugins** - Individual skills packaged for distribution
2. **Stack Plugins** - Bundles of skills with pre-configured agents

---

## Plugin Architecture

### Official Claude Code Plugin Structure

```
my-plugin/
  .claude-plugin/
    plugin.json           # REQUIRED - Plugin manifest
  skills/                 # Skills directory
    skill-name/
      SKILL.md            # Skill content with frontmatter
  agents/                 # Agent definitions (optional)
    agent-name.md
  hooks/                  # Hook configuration (optional)
    hooks.json
  .mcp.json               # MCP servers (optional)
  CLAUDE.md               # Project context (optional)
  README.md               # Documentation
```

**Important**: Only `plugin.json` belongs inside `.claude-plugin/`. All other directories must be at the plugin root.

---

## Creating a Skill Plugin

Each skill can be distributed as its own Claude Code plugin.

### Skill Plugin Structure

```
skill-react/
  .claude-plugin/
    plugin.json           # Plugin manifest
  skills/
    react/
      SKILL.md            # Skill content
  README.md
```

### plugin.json for Skill Plugins

```json
{
  "name": "skill-react",
  "version": "2.0.0",
  "license": "MIT",
  "skills": "./skills/",
  "description": "Component architecture, hooks, patterns",
  "author": {
    "name": "@vince"
  },
  "keywords": ["react", "react-19", "components", "hooks", "jsx", "tsx"]
}
```

| Field         | Required | Description                          |
| ------------- | -------- | ------------------------------------ |
| `name`        | Yes      | Plugin identifier (kebab-case)       |
| `version`     | Yes      | Semantic version (MAJOR.MINOR.PATCH) |
| `description` | No       | Brief description for discovery      |
| `author`      | No       | Author information                   |
| `keywords`    | No       | Tags for searchability               |
| `skills`      | No       | Path to skills directory             |
| `license`     | No       | License identifier                   |

### SKILL.md Frontmatter

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
disable-model-invocation: false
user-invocable: true
---
Your skill content in Markdown...
```

| Field                      | Required | Description                             |
| -------------------------- | -------- | --------------------------------------- |
| `name`                     | No       | Skill name (defaults to directory name) |
| `description`              | Yes      | When Claude should use this skill       |
| `disable-model-invocation` | No       | Prevent auto-loading (default: false)   |
| `user-invocable`           | No       | Show in `/` menu (default: true)        |
| `allowed-tools`            | No       | Comma-separated tool allowlist          |
| `model`                    | No       | Model override for this skill           |
| `context`                  | No       | `fork` to run in subagent               |

---

## Creating a Stack Plugin

Stack plugins bundle multiple skills with pre-configured agents.

### Stack Plugin Structure

```
stack-fullstack-react/
  .claude-plugin/
    plugin.json           # Plugin manifest
  agents/
    frontend-developer.md
    backend-developer.md
    tester.md
  skills/
    react/
      SKILL.md
    zustand/
      SKILL.md
    hono/
      SKILL.md
    drizzle/
      SKILL.md
  CLAUDE.md               # Project conventions
  README.md
```

### plugin.json for Stack Plugins

```json
{
  "name": "stack-fullstack-react",
  "version": "1.0.0",
  "description": "Full-stack React + Hono + Drizzle development stack",
  "author": {
    "name": "claude-collective"
  },
  "keywords": ["fullstack", "react", "hono", "drizzle", "typescript"],
  "skills": "./skills/",
  "agents": "./agents/"
}
```

### Agent Definition Frontmatter

Agents in stack plugins have frontmatter that defines their capabilities:

```yaml
---
name: frontend-developer
description: Expert frontend developer. Use for React components and UI work.
tools: Read, Grep, Glob, Bash, Write, Edit
model: inherit
permissionMode: default
skills:
  - react
  - zustand
  - scss-modules
---
You are a senior frontend developer specializing in React and TypeScript...
```

| Field             | Required | Description                             |
| ----------------- | -------- | --------------------------------------- |
| `name`            | Yes      | Agent identifier (kebab-case)           |
| `description`     | Yes      | When to delegate to this agent          |
| `tools`           | No       | Comma-separated tool allowlist          |
| `disallowedTools` | No       | Comma-separated tool denylist           |
| `model`           | No       | `sonnet`, `opus`, `haiku`, or `inherit` |
| `permissionMode`  | No       | Permission handling mode                |
| `skills`          | No       | Skills to preload into agent context    |

---

## Compiling Plugins

### Compile All Skill Plugins

```bash
cc compile-plugins
```

This compiles all skills in `src/skills/` to individual plugins in `dist/plugins/`.

### Compile Single Skill

```bash
cc compile-plugins --skill frontend/react
```

### Compile a Stack

```bash
cc compile-stack -s fullstack-react
```

### Validate Plugins

```bash
# Validate single plugin
cc validate ./dist/plugins/skill-react

# Validate all plugins
cc validate ./dist/plugins --all
```

---

## Publishing to Marketplace

### Generate Marketplace Manifest

```bash
cc generate-marketplace
```

This creates `.claude-plugin/marketplace.json` with all plugins:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-collective",
  "version": "1.0.0",
  "owner": {
    "name": "Claude Collective",
    "email": "hello@claude-collective.com"
  },
  "metadata": {
    "pluginRoot": "./dist/plugins"
  },
  "plugins": [
    {
      "name": "skill-react",
      "source": "./dist/plugins/skill-react",
      "description": "Component architecture, hooks, patterns",
      "version": "2.0.0",
      "author": { "name": "@vince" },
      "keywords": ["react", "react-19", "components"],
      "category": "frontend"
    }
  ]
}
```

### Version Management

Before publishing, bump the version:

```bash
# Inside plugin directory
cc version patch   # 1.0.0 -> 1.0.1
cc version minor   # 1.0.0 -> 1.1.0
cc version major   # 1.0.0 -> 2.0.0
cc version set 2.5.0
```

---

## Installing Plugins

### From Marketplace

```bash
# Add marketplace (one time)
/plugin marketplace add claude-collective/skills

# Install skill
/plugin install skill-react@claude-collective

# Install stack
/plugin install stack-fullstack-react@claude-collective
```

### Manual Installation

Copy plugin to:

- User scope: `~/.claude/plugins/`
- Project scope: `.claude/plugins/`

---

## Best Practices

### Skill Content Guidelines

1. **Clear description** - Explain when Claude should use this skill
2. **Critical requirements** - Use `<critical_requirements>` tags for must-follow rules
3. **Code examples** - Include practical, copy-paste ready examples
4. **Anti-patterns** - Document what NOT to do

### Version Bumping Guidelines

| Change Type                      | Version Bump           |
| -------------------------------- | ---------------------- |
| Bug fixes, typos                 | Patch (1.0.0 -> 1.0.1) |
| New content, examples            | Minor (1.0.0 -> 1.1.0) |
| Breaking changes, major rewrites | Major (1.0.0 -> 2.0.0) |

### Plugin Naming Conventions

- Skill plugins: `skill-<name>` (e.g., `skill-react`, `skill-zustand`)
- Stack plugins: `stack-<name>` (e.g., `stack-fullstack-react`)
- Names must be kebab-case
- Names should be descriptive but concise

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

### Validation Errors

Run validation with verbose output:

```bash
cc validate ./path/to/plugin -v
```

Common issues:

- Missing required fields
- Invalid version format
- Non-kebab-case name
- Missing skills directory

---

## Related Documentation

- [CLI Reference](./CLI-REFERENCE.md)
- [Plugin Distribution Architecture](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md)
- [SKILL.md Frontmatter Schema](../schemas/skill-frontmatter.schema.json)
