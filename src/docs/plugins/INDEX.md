# Plugin Documentation Index

> **Purpose**: Single source of truth for all plugin-related documentation
> **Updated**: 2026-01-23
> **Status**: Architecture finalized, implementation in progress

---

## Architecture Summary

The Claude Collective CLI compiles skills from a marketplace repository into complete Claude Code plugins.

### Key Principles

1. **Marketplace is single source of truth** - Skills, agent definitions, principles, and templates all live in the marketplace repo
2. **CLI is stateless** - No bundled content, requires network for all operations
3. **Complete plugin output** - `cc init` produces a ready-to-use plugin with skills AND compiled agents
4. **Skills embedded in stacks** - Skills are copied into the plugin and can evolve together

### Storage Model

```
Marketplace (github.com/claude-collective/skills)
├── src/skills/          # All skills
├── src/agents/          # Agent definitions + principles + templates
└── src/stacks/          # Pre-built stack configs

User's Machine
└── ~/.claude/plugins/my-stack/    # Complete compiled plugin
    ├── skills/                    # Skills (copied from marketplace)
    ├── agents/                    # Compiled agents
    ├── hooks/hooks.json
    └── plugin.json
```

---

## Core Documentation

| Document                                                                     | Description                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| [PLUGIN-DISTRIBUTION-ARCHITECTURE.md](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md) | Complete architecture, schemas, command flows |
| [CLI-REFERENCE.md](./CLI-REFERENCE.md)                                       | All CLI commands with examples                |
| [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md)                             | Creating and managing plugins                 |
| [MANUAL-TESTING-GUIDE.md](./MANUAL-TESTING-GUIDE.md)                         | End-to-end testing procedures                 |

---

## Command Quick Reference

| Command                   | Description                              | Priority |
| ------------------------- | ---------------------------------------- | -------- |
| `cc init --name my-stack` | Create complete plugin (skills + agents) | Core     |
| `cc add skill-jotai`      | Add skill and recompile                  | Core     |
| `cc update skill-react`   | Update skill and recompile               | Core     |
| `cc compile`              | Recompile after manual edits             | Core     |
| `cc list`                 | List installed plugins                   | Core     |
| `cc validate`             | Validate plugin structure                | Core     |
| `cc version patch`        | Bump version                             | Core     |
| `cc remove`               | Remove skill                             | Lowest   |
| `cc swap`                 | Swap skills                              | Lowest   |
| `cc outdated`             | Check for updates                        | Lowest   |
| `cc customize`            | Add custom principles                    | Lowest   |
| `cc publish`              | Contribute to marketplace                | Lowest   |

---

## Plugin Structure

```
~/.claude/plugins/my-stack/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Skills from marketplace
│   ├── react/SKILL.md
│   └── zustand/SKILL.md
├── agents/                   # Compiled agents
│   ├── frontend-developer.md
│   └── backend-developer.md
├── hooks/hooks.json          # Optional
├── CLAUDE.md
└── README.md
```

---

## Command Flows

### `cc init`

```
1. Fetch skills-matrix from marketplace
2. Run wizard (select skills or pre-built stack)
3. Fetch selected skills from marketplace
4. Fetch agent definitions, principles, templates from marketplace
5. Compile agents (embed skill content)
6. Generate plugin.json, CLAUDE.md, README.md
7. Complete plugin ready
```

### `cc add`

```
1. Fetch skill from marketplace
2. Copy to plugin's skills/ folder
3. Fetch agent definitions, principles, templates from marketplace
4. Recompile all agents
5. Plugin updated in place
```

### `cc update`

```
1. Fetch latest skill from marketplace
2. Replace in plugin's skills/ folder
3. Fetch agent definitions, principles, templates from marketplace
4. Recompile all agents
5. Plugin updated in place
```

---

## Implementation Status

### Complete

- [x] Skill plugin compiler (83 skills)
- [x] Stack plugin compiler
- [x] Marketplace generator
- [x] Plugin validator
- [x] CLI commands: compile-plugins, compile-stack, generate-marketplace, validate, version

### In Progress

- [ ] Update `cc init` to produce complete plugins
- [ ] Update `cc add` to modify plugin in place and recompile
- [ ] Network fetching for agents/principles/templates during compile

### Lowest Priority

- [ ] `cc remove` - Remove skill from plugin
- [ ] `cc swap` - Swap one skill for another
- [ ] `cc outdated` - Check for skill updates
- [ ] `cc customize --principles` - Add custom principles
- [ ] `cc publish` - Contribute skills to marketplace

---

## Deprecated Concepts

| Concept                         | Status                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `.claude-collective/` directory | Removed - plugins output directly to `~/.claude/plugins/` |
| `skills:` array in plugin.json  | Removed - `skills/` folder exists instead                 |
| Classic mode vs plugin mode     | Removed - always plugin mode                              |
| Bundled content in CLI          | Removed - fetched from marketplace at runtime             |

---

## Research & Background

### CLI Research

| Document                                                                    | Location        | Purpose                 |
| --------------------------------------------------------------------------- | --------------- | ----------------------- |
| [CLI-AGENT-INVOCATION-RESEARCH.md](../cli/CLI-AGENT-INVOCATION-RESEARCH.md) | `src/docs/cli/` | Inline agent invocation |
| [CLI-FRAMEWORK-RESEARCH.md](../cli/CLI-FRAMEWORK-RESEARCH.md)               | `src/docs/cli/` | Framework comparison    |

### Architecture Research

| Document                                                                                                 | Location                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [CLI-DATA-DRIVEN-ARCHITECTURE.md](../../../.claude/research/findings/v2/CLI-DATA-DRIVEN-ARCHITECTURE.md) | `.claude/research/findings/v2/` |
| [CLI-SIMPLIFIED-ARCHITECTURE.md](../../../.claude/research/findings/v2/CLI-SIMPLIFIED-ARCHITECTURE.md)   | `.claude/research/findings/v2/` |
| [VERSIONING-PROPOSALS.md](../../../.claude/research/VERSIONING-PROPOSALS.md)                             | `.claude/research/`             |

---

## Quick Commands

```bash
# Create a new plugin
cc init --name my-stack

# Add a skill
cc add skill-jotai

# Update a skill
cc update skill-react

# Recompile after manual edits
cc compile

# Validate
cc validate

# Bump version
cc version patch
```

---

## Related Files

- [TODO.md](../../TODO.md) - Complete task tracking
- [Skills Roadmap](../skills/SKILLS_ROADMAP.md) - Future skills planned

---

_Last updated: 2026-01-23_
