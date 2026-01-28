# Prototype Plugin Examples

This directory contains **educational reference implementations** for developers who want to create their own Claude Code plugins.

## Purpose

- **NOT production code** - These are examples for learning
- **Reference implementation** - Shows correct plugin structure
- **Starting point** - Copy and modify for your own plugins

## Contents

### skill-react/

A complete example of a skill plugin showing:

- Correct `.claude-plugin/plugin.json` manifest structure
- Proper `skills/` directory organization
- SKILL.md frontmatter format
- README.md documentation

```
skill-react/
  .claude-plugin/
    plugin.json           # Plugin manifest
  skills/
    react/
      SKILL.md            # Skill content with frontmatter
  README.md               # Plugin documentation
```

## Creating Your Own Plugin

1. Use these examples as a reference
2. Follow the official plugin structure
3. See [Plugin Development Guide](../src/docs/plugins/PLUGIN-DEVELOPMENT.md) for complete documentation

## Key Points

- `plugin.json` must be inside `.claude-plugin/` directory
- Skills go in `skills/<skill-name>/SKILL.md`
- Use kebab-case for all names
- Follow semantic versioning (MAJOR.MINOR.PATCH)
