# Plugin Documentation Index

> **Purpose**: Single source of truth for all plugin-related documentation
> **Updated**: 2026-01-24
> **Status**: Architecture finalized, implementation complete

---

## Architecture Summary

The Claude Collective CLI uses a stack-based architecture with a single shared plugin. Skills are organized into switchable stacks, and one plugin serves all stacks.

### Key Principles

1. **Stacks are source of truth** - Skills live in `.claude-collective/stacks/{name}/skills/`
2. **Single shared plugin** - One plugin at `.claude/plugins/claude-collective/`
3. **Project-local** - Both directories are project-local (siblings), not global
4. **Agents fetch from marketplace** - Agent definitions, principles, templates fetched at compile time
5. **Skills switch instantly** - `cc switch` copies skills from stack to plugin

### Storage Model

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
│           └── skills/                  # Active stack's skills (copied on switch)
│               ├── react/SKILL.md
│               └── zustand/SKILL.md
│
└── src/                                 # Your project code
```

### Config File

```yaml
# .claude-collective/config.yaml (project-local)
source: github:claude-collective/skills
active_stack: work-stack
```

---

## Core Documentation

| Document                                                                     | Description                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| [PLUGIN-DISTRIBUTION-ARCHITECTURE.md](./PLUGIN-DISTRIBUTION-ARCHITECTURE.md) | Complete architecture, schemas, command flows |
| [CLI-REFERENCE.md](./CLI-REFERENCE.md)                                       | All CLI commands with examples                |
| [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md)                             | Creating and managing plugins                 |
| [IMPLEMENTATION-APPROACH.md](./IMPLEMENTATION-APPROACH.md)                   | **Implementation plan with code changes**     |
| [MANUAL-TESTING-GUIDE.md](./MANUAL-TESTING-GUIDE.md)                         | End-to-end testing procedures                 |

---

## Command Quick Reference

### User-Facing Commands

| Command            | Description                                      | Priority |
| ------------------ | ------------------------------------------------ | -------- |
| `cc init --name X` | Create new stack (first one also creates plugin) | Core     |
| `cc switch X`      | Switch active stack (copies skills to plugin)    | Core     |
| `cc add Y`         | Add skill to active stack                        | Core     |
| `cc list`          | List all stacks with active marker               | Core     |
| `cc compile`       | Recompile agents after manual skill edits        | Core     |
| `cc update`        | Update skills from source                        | Core     |
| `cc config`        | Manage configuration                             | Core     |

### Publishing Commands (CI Only)

| Command                   | Description                           |
| ------------------------- | ------------------------------------- |
| `cc compile-plugins`      | Build skill plugins for marketplace   |
| `cc compile-stack -s X`   | Build pre-built stack for marketplace |
| `cc generate-marketplace` | Generate marketplace.json             |

---

## Plugin Structure

```
.claude/plugins/claude-collective/       # Project-local
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Active stack's skills (copied on switch)
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

### `cc init --name X`

```
1. Create .claude-collective/stacks/X/skills/
2. Run wizard (select skills or pre-built stack)
3. Fetch selected skills from marketplace
4. Copy skills to stack directory
5. If first stack: create plugin at .claude/plugins/claude-collective/
6. If first stack: fetch agent definitions and compile
7. Run switch logic to activate new stack
```

### `cc switch X`

```
1. Validate stack exists in .claude-collective/stacks/X/
2. Remove .claude/plugins/claude-collective/skills/
3. Copy from .claude-collective/stacks/X/skills/ to plugin
4. Update active_stack in config
```

### `cc add Y`

```
1. Get active stack from config
2. Fetch skill Y from marketplace
3. Copy to .claude-collective/stacks/{active}/skills/
4. Run switch logic to update plugin
```

### `cc compile`

```
1. Read skills from plugin's skills/ folder
2. Fetch agent definitions from marketplace
3. Compile agents (embed skill references)
4. Write to plugin's agents/ folder
```

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

| Concept       | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| Stack         | Collection of skills stored in `.claude-collective/stacks/X/`     |
| Active Stack  | Currently active stack, tracked in config.yaml                    |
| Plugin        | Single plugin at `.claude/plugins/claude-collective/`             |
| Switch        | Copies skills from stack to plugin, updates active_stack          |
| Source        | Marketplace URL (default: `github:claude-collective/skills`)      |
| Project-local | All paths are relative to project root, not home directory (`~/`) |

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
# Create a new stack (first one also creates plugin)
cc init --name my-stack

# List all stacks
cc list

# Switch to a different stack
cc switch home-stack

# Add a skill to active stack
cc add zustand

# Recompile agents after manual edits
cc compile

# Show configuration
cc config show
```

---

## Related Files

- [TODO.md](../../TODO.md) - Complete task tracking
- [Skills Roadmap](../skills/SKILLS_ROADMAP.md) - Future skills planned

---

_Last updated: 2026-01-24_
