# Plugin Distribution Architecture

> **Purpose**: CLI compiles skills into plugins for native Claude Code distribution.
> **Date**: 2026-01-23
> **Status**: Research complete, ready for implementation

---

## Executive Summary

The CLI remains the entry point. Users build stacks through the wizard. The **output is a plugin** instead of raw `.claude/` files. This gives us native Claude Code integration with remote installation and versioning, while keeping our unique compilation pipeline.

```
CLI (input)  = Wizard + compilation (our unique value)
Plugin (output) = Distributable, installable, versioned result
```

**Key insight**: Plugins are the OUTPUT, not the input. The CLI generates custom plugins from selected skills.

---

## Table of Contents

1. [Claude Code Plugin System](#claude-code-plugin-system)
2. [The Architecture: Plugin as Output](#the-architecture-plugin-as-output)
3. [User Flow](#user-flow)
4. [Two-Level Versioning](#two-level-versioning)
5. [Plugin Output Structure](#plugin-output-structure)
6. [Sharing and Distribution](#sharing-and-distribution)
7. [What Changes vs Stays The Same](#what-changes-vs-stays-the-same)
8. [CLI Commands](#cli-commands)
9. [Implementation Plan](#implementation-plan)
10. [Open Questions](#open-questions)

---

## Claude Code Plugin System

### Two Approaches (From Official Docs)

| Approach                             | Skill names        | Best for                                                           |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------ |
| Standalone (.claude/ directory)      | /hello             | Personal workflows, project-specific, quick experiments            |
| Plugins (.claude-plugin/plugin.json) | /plugin-name:hello | Sharing with teammates, community distribution, versioned releases |

### How Marketplaces Work

```bash
# Add a marketplace (just an index, nothing installed)
/plugin marketplace add owner/repo

# Install a plugin from that marketplace
/plugin install my-plugin@owner

# Update later
/plugin update my-plugin@owner
```

### What Plugins Can Contain

- **Skills** - Custom `/commands`
- **Agents** - Subagent definitions
- **Hooks** - Event handlers
- **MCP servers** - External tool integrations

### Team Configuration

```json
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "company-tools": {
      "source": { "source": "github", "repo": "your-org/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "my-plugin@company-tools": true
  }
}
```

---

## The Architecture: Plugin as Output

The CLI compiles selected skills into a plugin. The plugin is the **output**, not the input.

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI (Entry Point)                                               │
│                                                                 │
│  cc init --name my-stack                                        │
│    → Wizard: select skills                                      │
│    → Fetch selected skills from source repo (giget)             │
│    → Compile: skills + principles + templates → agents          │
│    → Package as plugin                                          │
│    → Install to ~/.claude/plugins/my-stack/                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Plugin (Output)                                                 │
│                                                                 │
│  ~/.claude/plugins/my-stack/                                    │
│  ├── .claude-plugin/plugin.json                                 │
│  ├── agents/           # Compiled agents                        │
│  └── skills/           # Compiled skills                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code                                                     │
│                                                                 │
│  Loads plugin automatically                                     │
│  Skills: /my-stack:react, /my-stack:zustand                     │
│  Agents: Available via Task tool                                │
└─────────────────────────────────────────────────────────────────┘
```

### Why Plugin as Output?

| Output to `.claude/`        | Output to Plugin             |
| --------------------------- | ---------------------------- |
| Files in project directory  | Files in plugins directory   |
| Copy/paste to share         | Copy/paste to share          |
| **Cannot install remotely** | **Can install remotely**     |
| No versioning               | Versioning via plugin system |
| Project-specific            | Portable across projects     |

**The only difference**: Plugins can be installed from a remote location and have built-in versioning.

---

## User Flow

The user flow is **identical** to current. Only the output format changes.

```bash
cc init --name photoroom-stack
```

1. **Wizard**: User picks skills (react, zustand, hono, drizzle)
2. **Fetch**: CLI fetches only those skills from source repo (giget)
3. **Compile**: CLI compiles agents using LiquidJS templates
4. **Package**: CLI creates a plugin with compiled output
5. **Install**: Plugin placed in `~/.claude/plugins/photoroom-stack/`

**Done.** Claude Code loads the plugin automatically.

---

## Two-Level Versioning

We keep **both** skill versioning and plugin versioning. They serve different purposes.

### Skill Versioning (Source)

```yaml
# metadata.yaml
version: 5 # This skill has been refined 5 times
```

**Purpose:**

- Signals maturity (v12 is more battle-tested than v1)
- Shows in wizard: "React @vince (v5)"
- Changelog context: "What changed in v5?"
- Informational, not for rollback

### Plugin Versioning (Distribution)

```json
// plugin.json
{
  "name": "photoroom-stack",
  "version": "2.0.0"
}
```

**Purpose:**

- Teammates install/update specific versions
- Rollback to previous plugin release
- Semantic versioning for breaking changes

### How They Work Together

```
You update React skill (v5 → v6)
You update Hono skill (v3 → v4)
You recompile your stack
You bump plugin version (2.0.0 → 2.1.0)

Plugin 2.1.0 contains:
  - React v6
  - Hono v4
  - Zustand v2 (unchanged)
```

**Plugin version** = release of the compiled stack
**Skill versions** = ingredients that went into it

---

## Plugin Output Structure

```
~/.claude/plugins/my-stack/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest with version
├── agents/                      # Compiled agent prompts
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   ├── pm.md
│   └── ...
├── skills/                      # Compiled skill documents
│   ├── react.md
│   ├── zustand.md
│   ├── hono.md
│   └── ...
└── metadata/                    # Build metadata
    └── build-info.yaml          # Which skill versions, build date
```

### Plugin Manifest

```json
{
  "name": "photoroom-stack",
  "version": "2.1.0",
  "description": "PhotoRoom's AI agent stack",
  "author": "photoroom",
  "skills": ["react", "zustand", "hono", "drizzle"],
  "built": "2026-01-23T22:30:00Z"
}
```

---

## Sharing and Distribution

### Teammate Workflow

```bash
# User A creates a stack
cc init --name photoroom-stack
# → Creates plugin at ~/.claude/plugins/photoroom-stack/

# User A pushes plugin to team repo
cd ~/.claude/plugins/photoroom-stack
git init && git add . && git commit -m "v1.0.0"
git remote add origin github.com/photoroom/claude-stack
git push -u origin main

# User B installs from team repo
/plugin marketplace add photoroom/claude-stack
/plugin install photoroom-stack@photoroom

# Later: User A updates, bumps to v1.1.0, pushes
# User B updates
/plugin update photoroom-stack@photoroom
```

### Version Pinning

```bash
# Install specific version
/plugin install photoroom-stack@photoroom --ref v1.0.0

# Stay on v1.0.0, don't update
# Or explicitly update to latest when ready
/plugin update photoroom-stack@photoroom
```

## What Changes vs Stays The Same

### Unchanged

| Component            | Notes                                |
| -------------------- | ------------------------------------ |
| CLI as entry point   | `cc init` remains the main command   |
| Wizard experience    | User selects skills interactively    |
| Compilation pipeline | LiquidJS, agent.liquid template      |
| Skill format         | SKILL.md, metadata.yaml, examples/   |
| Principles           | Core instructions loaded into agents |
| Source fetching      | giget from source repo               |
| Skill versioning     | Integer versions in metadata.yaml    |
| `cc eject`           | Export for full ownership            |

### Changed

| Before                           | After                                 |
| -------------------------------- | ------------------------------------- |
| Output to `.claude/`             | Output to `~/.claude/plugins/{name}/` |
| Project-specific files           | Portable plugin                       |
| No distribution format           | Plugin = distribution format          |
| Manual sharing (copy `.claude/`) | Native plugin sharing                 |
| No versioning of output          | Plugin versioning (semver)            |

---

## CLI Commands

### Command Set

| Command            | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `cc init`          | Wizard: pick skills, compile, output plugin |
| `cc init --name X` | Create plugin with specific name            |
| `cc compile`       | Recompile current stack to plugin           |
| `cc update`        | Fetch latest skills, recompile              |
| `cc eject`         | Copy plugin to local `.claude-collective/`  |
| `cc eject --fork`  | Fork source repo on GitHub                  |
| `cc validate`      | Validate skill metadata                     |
| `cc list skills`   | Show available skills with versions         |
| `cc version`       | Bump plugin version before sharing          |

---

## Implementation Plan

### Phase 1: Plugin Output Support

1. Update compiler to output plugin structure
2. Generate `.claude-plugin/plugin.json` manifest
3. Generate `build-info.yaml` with skill versions
4. Determine plugin installation path

### Phase 2: Update CLI

1. Add `--name` flag to `cc init`
2. Update output path to plugins directory
3. Add `cc version` command for bumping plugin version
4. Update `cc eject` to work with plugin format

### Phase 3: Test

1. Test plugin creation via `cc init`
2. Verify Claude Code loads the plugin
3. Test skill namespacing (`/my-stack:react`)
4. Test sharing workflow (push to repo, teammate installs)

### Phase 4: Document

1. Update README with plugin output workflow
2. Document sharing/distribution flow
3. Document two-level versioning

---

## Open Questions

### 1. Plugin Installation Path

Where should CLI output plugins?

Options:

- `~/.claude/plugins/` (user-level, portable)
- `.claude/plugins/` (project-level)
- Let user choose via `--output` flag

**Recommendation**: Default to `~/.claude/plugins/`, allow override.

### 2. Plugin Naming

How to name the generated plugin?

Options:

- Require `--name` flag: `cc init --name photoroom-stack`
- Derive from directory: `cc init` in `~/photoroom` → `photoroom-stack`
- Prompt in wizard

**Recommendation**: Prompt in wizard, allow `--name` override.

### 3. Updating Existing Plugins

When user runs `cc update`:

- Fetch latest skills
- Recompile
- Bump plugin version automatically?

**Recommendation**: Recompile, prompt user to bump version.

---

## Key Insight

**We are the only project that compiles skills into agents this way.**

Our unique value:

- Combining multiple skills into coherent agent prompts
- LiquidJS templating with principles injection
- Stack-based skill selection
- Two-level versioning (skills + plugin)

The plugin format is just the **output container**. The compilation is the magic.

---

## Summary

```
CLI:     Entry point, wizard, compilation     (unchanged)
giget:   Fetch skills from source repo        (unchanged)
Plugin:  Output format                        (new)
Sharing: Push plugin to repo, others install  (enabled by plugin format)
```

User flow is the same. Output is now a distributable, versioned plugin.

---

## Advanced: Skills as Plugins

An evolution of the architecture where each skill is its own plugin, enabling independent versioning and surgical updates.

### The Concept

```
Instead of:
  Source repo with 70 skills → CLI fetches → Compiles → Stack plugin

It becomes:
  70 skill plugins → CLI installs selected → Compiles → Stack plugin
```

Each skill is a first-class plugin with its own version and update lifecycle.

### The Flow

```bash
cc init
```

1. **Wizard**: Shows available skills (reads from marketplace)
2. **User selects**: React, Zustand, Hono, Drizzle
3. **CLI installs each skill as a plugin** (automated, under the hood)
   ```
   Installing skill-react@claude-collective...
   Installing skill-zustand@claude-collective...
   Installing skill-hono@claude-collective...
   Installing skill-drizzle@claude-collective...
   ```
4. **CLI compiles**: Combines installed skill plugins into stack plugin
5. **Done**: Stack plugin ready

**User experience is identical.** Skills being plugins is an implementation detail.

### Plugin Structure

```
~/.claude/plugins/
├── skill-react/                    # Skill plugin (v5)
│   ├── .claude-plugin/plugin.json
│   ├── SKILL.md
│   ├── metadata.yaml
│   └── examples/
├── skill-zustand/                  # Skill plugin (v2)
│   └── ...
├── skill-hono/                     # Skill plugin (v4)
│   └── ...
└── my-stack/                       # Compiled stack plugin
    ├── .claude-plugin/plugin.json
    ├── agents/
    ├── skills/
    └── stack-config.yaml
```

### Surgical Updates

```bash
# Update just React (v5 → v6)
cc update react --plugin my-stack

# What happens:
# 1. CLI updates skill-react plugin
# 2. CLI recompiles stack (reads all installed skill plugins)
# 3. Zustand stays v2, Hono stays v4
# 4. Stack plugin bumped to v1.1.0
```

### Adding a New Skill

```bash
cc add vitest --plugin my-stack

# What happens:
# 1. CLI installs skill-vitest plugin
# 2. CLI recompiles stack
# 3. Existing skills unchanged
```

### Benefits

| Benefit                | How                                      |
| ---------------------- | ---------------------------------------- |
| Independent versioning | Each skill plugin has its own version    |
| Surgical updates       | Update one skill without touching others |
| Pinning                | Each skill stays at installed version    |
| Community publishing   | Anyone can publish skill plugins         |
| Discoverability        | Skills appear in marketplace             |

### Trade-offs

| Aspect            | Source Repo Model | Skills as Plugins         |
| ----------------- | ----------------- | ------------------------- |
| Number of plugins | 1 stack plugin    | 70+ skill plugins + stack |
| Maintenance       | One repo          | Many plugins to publish   |
| Versioning        | Coupled           | Independent               |
| Updates           | All or nothing    | Surgical                  |
| User complexity   | Simple            | Hidden by CLI             |

### Marketplace Structure

```json
// marketplace.json
{
  "name": "claude-collective",
  "plugins": [
    { "name": "skill-react", "source": "./skills/react" },
    { "name": "skill-zustand", "source": "./skills/zustand" },
    { "name": "skill-hono", "source": "./skills/hono" }
    // ... 70+ skill plugins
  ]
}
```

### Compilation

The CLI reads from installed skill plugins:

```typescript
async function compile(stackName: string, selectedSkills: string[]) {
  const skills = [];

  for (const skillName of selectedSkills) {
    // Read from installed plugin
    const pluginPath = `~/.claude/plugins/skill-${skillName}`;
    const skill = await readSkillPlugin(pluginPath);
    skills.push(skill);
  }

  // Compile agents using skills
  const agents = await compileAgents(skills, principles, templates);

  // Output stack plugin
  await writeStackPlugin(stackName, { agents, skills });
}
```

---

## Namespace and Registry

### How Claude Code Plugins Work

Claude Code uses **decentralized marketplaces**, not a central registry like npm.

| npm                             | Claude Code Plugins               |
| ------------------------------- | --------------------------------- |
| Central registry (npmjs.com)    | Decentralized (your own repo)     |
| Register namespace (`@org/pkg`) | Create marketplace repo           |
| `npm publish`                   | Push to your repo                 |
| `npm install @org/pkg`          | `/plugin install pkg@marketplace` |

### No Registration Required

You don't register a namespace. You create a marketplace:

```bash
# Create repo: github.com/claude-collective/skills
# Add .claude-plugin/marketplace.json
# That's your "namespace"
```

Users add your marketplace:

```bash
/plugin marketplace add claude-collective/skills
```

Now they can install from it:

```bash
/plugin install skill-react@claude-collective
#                          ^^^^^^^^^^^^^^^^
#                          This is your marketplace name
```

### The Marketplace IS the Namespace

```
claude-collective/skills (repo)
└── .claude-plugin/marketplace.json
    └── "name": "claude-collective"   ← This is your namespace

/plugin install skill-react@claude-collective
                            ^^^^^^^^^^^^^^^^
                            References the marketplace name
```

### Multiple Marketplaces

Users can add multiple marketplaces:

```bash
/plugin marketplace add claude-collective/skills    # Community
/plugin marketplace add photoroom/claude-plugins    # Company

# Install from different sources
/plugin install skill-react@claude-collective
/plugin install skill-photoroom-auth@photoroom
```

### No Conflicts

Plugin names are scoped to marketplaces:

```
skill-react@claude-collective   # Community React skill
skill-react@acme-corp           # Acme's custom React skill
```

Different plugins, no conflict.

---

## Final Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Marketplace: claude-collective/skills                           │
│                                                                 │
│  skill-react (v5)                                               │
│  skill-zustand (v2)                                             │
│  skill-hono (v4)                                                │
│  skill-drizzle (v3)                                             │
│  ... 70+ skill plugins                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ cc init (wizard)
                              │ CLI installs selected skill plugins
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ User's Machine: ~/.claude/plugins/                              │
│                                                                 │
│  skill-react/        (installed, v5)                            │
│  skill-zustand/      (installed, v2)                            │
│  skill-hono/         (installed, v4)                            │
│                                                                 │
│  my-stack/           (compiled stack plugin)                    │
│    ├── agents/                                                  │
│    ├── skills/                                                  │
│    └── stack-config.yaml                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Claude Code loads plugins
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code                                                     │
│                                                                 │
│  Skills: /my-stack:react, /my-stack:zustand                     │
│  Agents: frontend-developer, backend-developer, etc.            │
└─────────────────────────────────────────────────────────────────┘
```

---

_Created: 2026-01-23_
_Updated: 2026-01-23 - Added skills-as-plugins architecture, namespace clarification_
