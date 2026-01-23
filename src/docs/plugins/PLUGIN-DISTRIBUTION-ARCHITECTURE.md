# Plugin Distribution Architecture

> **Purpose**: CLI compiles skills into plugins for native Claude Code distribution.
> **Date**: 2026-01-23
> **Status**: Architecture finalized, implementation in progress

---

## Architecture Overview

The Claude Collective CLI compiles skills from a marketplace repository into complete Claude Code plugins. The CLI is thin (no bundled content) and fetches all definitions from the marketplace during compilation.

### Key Principles

1. **Marketplace is single source of truth** - Skills, agent definitions, principles, and templates all live in the marketplace repo
2. **CLI is stateless** - No bundled content, requires network for all operations
3. **Complete plugin output** - `cc init` produces a ready-to-use plugin with skills AND compiled agents
4. **Skills embedded in stacks** - Skills are copied into the stack and can evolve together

---

## Storage Model

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
│   │   │   │   ├── agent.yaml       # Agent config
│   │   │   │   ├── intro.md
│   │   │   │   ├── workflow.md
│   │   │   │   └── examples.md
│   │   │   └── backend-developer/
│   │   ├── reviewer/
│   │   ├── researcher/
│   │   ├── planning/
│   │   ├── pattern/
│   │   ├── meta/
│   │   ├── tester/
│   │   ├── _principles/             # Shared principles
│   │   │   ├── core.md
│   │   │   ├── code-quality.md
│   │   │   ├── investigation-requirement.md
│   │   │   └── ...
│   │   └── _templates/              # LiquidJS templates
│   │       └── agent.liquid
│   │
│   └── stacks/                      # Pre-built stack configs
│       ├── fullstack-react/
│       │   └── config.yaml
│       └── work-stack/
│           └── config.yaml
│
├── skills-matrix.yaml               # Skill relationships and metadata
└── marketplace.json                 # Registry of available skills
```

### User's Plugin (Output)

When user runs `cc init`, a complete plugin is created:

```
~/.claude/plugins/my-stack/          # Or .claude/plugins/ for project scope
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── skills/                          # Skills copied from marketplace
│   ├── react/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── zustand/
│   │   └── SKILL.md
│   └── ...
├── agents/                          # Compiled agents (skill content embedded)
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
├── hooks/
│   └── hooks.json                   # If hooks configured
├── CLAUDE.md                        # Project conventions
└── README.md                        # Generated documentation
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

### `cc init --name my-stack`

Creates a complete plugin from scratch:

```
1. Fetch skills-matrix.yaml from marketplace
2. Run wizard:
   - User selects approach (pre-built stack or custom)
   - User selects skills (or uses stack defaults)
3. Fetch selected skills from marketplace
4. Copy skills to ~/.claude/plugins/my-stack/skills/
5. Fetch agent definitions from marketplace
6. Fetch principles from marketplace
7. Fetch templates from marketplace
8. Compile agents (embed skill content into agent markdown)
9. Write compiled agents to ~/.claude/plugins/my-stack/agents/
10. Generate plugin.json, CLAUDE.md, README.md, hooks.json
11. Complete plugin ready for use
```

### `cc add skill-jotai`

Adds a skill to an existing plugin and recompiles:

```
1. Locate existing plugin (current directory or specified)
2. Fetch skill-jotai from marketplace
3. Copy to ~/.claude/plugins/my-stack/skills/jotai/
4. Fetch agent definitions from marketplace
5. Fetch principles from marketplace
6. Fetch templates from marketplace
7. Recompile all agents (with new skill available)
8. Update plugin.json if needed
9. Plugin updated in place
```

### `cc update skill-react`

Updates an existing skill and recompiles:

```
1. Locate existing plugin
2. Fetch latest skill-react from marketplace
3. Replace ~/.claude/plugins/my-stack/skills/react/
4. Fetch agent definitions from marketplace
5. Fetch principles from marketplace
6. Fetch templates from marketplace
7. Recompile all agents
8. Plugin updated in place
```

### `cc compile`

Recompiles agents without fetching new skills (useful after manual skill edits):

```
1. Locate existing plugin
2. Read skills from local plugin's skills/ folder
3. Fetch agent definitions from marketplace
4. Fetch principles from marketplace
5. Fetch templates from marketplace
6. Compile agents
7. Write to agents/ folder
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

## Scope Options

| Scope     | Output Path                | Use Case                             |
| --------- | -------------------------- | ------------------------------------ |
| `user`    | `~/.claude/plugins/<name>` | Personal plugins, available globally |
| `project` | `.claude/plugins/<name>`   | Team sharing via git                 |

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
- [ ] Remove `.claude-collective/` directory support
- [ ] Network fetching for agents/principles/templates during compile

### Lowest Priority

- [ ] `cc remove` - Remove skill from plugin
- [ ] `cc swap` - Swap one skill for another
- [ ] `cc outdated` - Check for skill updates
- [ ] `cc customize --principles` - Add custom principles
- [ ] `cc publish` - Contribute skills to marketplace

---

## Deprecated Concepts

The following are no longer part of the architecture:

| Concept                          | Replacement                                     |
| -------------------------------- | ----------------------------------------------- |
| `.claude-collective/` directory  | Plugins output directly to `~/.claude/plugins/` |
| `skills:` array in plugin.json   | `skills/` folder with actual skill content      |
| Classic mode vs plugin mode      | Always plugin mode                              |
| Bundled agents/principles in CLI | Fetched from marketplace at runtime             |

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

_Last updated: 2026-01-23_
