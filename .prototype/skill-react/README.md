# skill-react

A Claude Code plugin that provides React patterns, hooks, and component architecture guidance for Claude agents.

## Structure

```
skill-react/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/
│   └── react/
│       └── SKILL.md         # The actual skill content
└── README.md                # This file
```

## Installation

This plugin follows the official Claude Code plugin structure and can be installed via:

```bash
# From a git repository
claude plugins add github:username/skill-react

# From a local directory
claude plugins add /path/to/skill-react
```

## What's Included

The `react` skill provides:

- **Component Architecture Tiers**: Primitives, Components, Patterns, Templates
- **React 19 Patterns**: `ref` as prop, `use()`, `useActionState`, `useFormStatus`, `useOptimistic`
- **Icon Usage**: lucide-react patterns with accessibility
- **Error Boundaries**: With retry capability
- **Event Handling**: Naming conventions and type safety
- **Custom Hooks**: Common patterns like pagination, debounce, localStorage

## Skill Frontmatter

The skill uses official frontmatter format:

```yaml
---
name: react
description: React patterns for building components, hooks, and state management. Use when working on React TypeScript code.
disable-model-invocation: false
user-invocable: true
---
```

## Usage

Once installed, the skill is available in Claude Code conversations. It can be:

- Auto-detected when working with React code
- Manually invoked by users
- Loaded by model when relevant

## Author

Created by vince
