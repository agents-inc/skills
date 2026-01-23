# Plugin Distribution Architecture

> **Purpose**: CLI compiles skills into plugins for native Claude Code distribution.
> **Date**: 2026-01-23
> **Status**: Research complete, implementation ready
> **Research Sources**: [Official Docs](https://code.claude.com/docs/en/plugins), [Marketplace Docs](https://code.claude.com/docs/en/plugin-marketplaces), [Anthropic Plugins](https://github.com/anthropics/claude-plugins-official)

---

## Implementation Tracking

### Architecture Decision (2026-01-23)

**Every skill becomes its own plugin.** Stacks compile from selected skill plugins, enabling:

- Individual skill versioning (`skill-react@v6`)
- Surgical updates (update one skill without touching others)
- Version pinning per skill in stacks
- Independent community publishing

### Phase Overview

| Phase | Name                 | Description                                    | Status   | Blocking |
| ----- | -------------------- | ---------------------------------------------- | -------- | -------- |
| 0     | Schema Alignment     | Align our formats with official Claude schemas | Complete | Yes      |
| 1     | Skill-as-Plugin      | Each skill outputs as its own plugin           | Complete | Yes      |
| 2     | Marketplace Setup    | Create marketplace.json with all skill plugins | Complete | Yes      |
| 3     | Stack Compilation    | Stacks compile from installed skill plugins    | Complete | Yes      |
| 4     | CLI Updates          | Update commands for skill-plugin workflow      | Complete | No       |
| 5     | Testing & Validation | Test plugin loading in Claude Code             | Complete | No       |
| 6     | Documentation        | Update all docs for plugin workflow            | Complete | No       |

### Detailed Task Tracking

| ID  | Task                               | Phase | Status   | Notes                                     |
| --- | ---------------------------------- | ----- | -------- | ----------------------------------------- |
| 0.1 | Update SKILL.md frontmatter schema | 0     | Complete | src/schemas/skill-frontmatter.schema.json |
| 0.2 | Update agent.md frontmatter schema | 0     | Complete | src/schemas/agent-frontmatter.schema.json |
| 0.3 | Create plugin.json generator       | 0     | Complete | src/cli/lib/plugin-manifest.ts            |
| 1.1 | Create skill plugin compiler       | 1     | Complete | src/cli/lib/skill-plugin-compiler.ts      |
| 1.2 | Add plugin.json to each skill      | 1     | Complete | 83 plugins in dist/plugins/               |
| 1.3 | Create compile-plugins command     | 1     | Complete | src/cli/commands/compile-plugins.ts       |
| 2.1 | Create marketplace.json            | 2     | Complete | src/cli/lib/marketplace-generator.ts      |
| 2.2 | Organize by category               | 2     | Complete | 12 categories auto-detected               |
| 2.3 | Create generate-marketplace cmd    | 2     | Complete | src/cli/commands/generate-marketplace.ts  |
| 3.1 | Create stack plugin compiler       | 3     | Complete | src/cli/lib/stack-plugin-compiler.ts      |
| 3.2 | Create compile-stack command       | 3     | Complete | src/cli/commands/compile-stack.ts         |
| 3.3 | Agent frontmatter with skills      | 3     | Complete | skills array in compiled agents           |
| 4.1 | Update `cc init` for plugin output | 4     | Complete | --name, --scope, --plugin flags           |
| 4.2 | Add `--scope` flag                 | 4     | Complete | user/project/local scopes                 |
| 4.3 | Add `cc version` command           | 4     | Complete | patch/minor/major/set actions             |
| 5.1 | Create plugin validator            | 5     | Complete | src/cli/lib/plugin-validator.ts           |
| 5.2 | Create validate command            | 5     | Complete | cc validate ./path --all                  |
| 5.3 | Create validation tests            | 5     | Complete | 34 tests in plugin-validator.test.ts      |
| 5.4 | Fix compiler issues                | 5     | Complete | semver + kebab-case fixes                 |
| 5.5 | Validate all 83 plugins            | 5     | Complete | 83/83 valid, 0 invalid                    |
| 6.1 | Update README                      | 6     | Complete | New installation workflow                 |
| 6.2 | Create marketplace README          | 6     | Complete | .claude-plugin/README.md                  |
| 6.3 | Document skill plugin format       | 6     | Complete | src/docs/plugins/PLUGIN-DEVELOPMENT.md    |
| 6.4 | Create CLI reference               | 6     | Complete | src/docs/plugins/CLI-REFERENCE.md         |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Official Claude Code Schemas](#official-claude-code-schemas)
3. [Current vs Target Architecture](#current-vs-target-architecture)
4. [Implementation Details](#implementation-details)
5. [Marketplace Architecture](#marketplace-architecture)
6. [CLI Changes Required](#cli-changes-required)
7. [Migration Path](#migration-path)
8. [Testing Checklist](#testing-checklist)

---

## Executive Summary

The CLI remains the entry point. Users build stacks through the wizard. The **output is a plugin** instead of raw `.claude/` files. This gives us native Claude Code integration with remote installation and versioning.

```
CLI (input)  = Wizard + compilation (our unique value)
Plugin (output) = Distributable, installable, versioned result
```

**Key insight**: Plugins are the OUTPUT, not the input. The CLI generates custom plugins from selected skills.

### What We Gain

| Feature                | Current (.claude/) | Plugin                             |
| ---------------------- | ------------------ | ---------------------------------- |
| Remote installation    | No                 | `/plugin install name@marketplace` |
| Skill namespacing      | /skill             | /plugin-name:skill                 |
| Version management     | Manual             | Semver + git tags                  |
| Team distribution      | Copy files         | settings.json enabledPlugins       |
| Update mechanism       | Manual             | `/plugin update`                   |
| Multiple installations | Project only       | user/project/local scopes          |

---

## Official Claude Code Schemas

> **CRITICAL**: These are the official schemas from Claude Code documentation. Our output MUST conform to these exactly.

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

### plugin.json Schema (Official)

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com"
  },
  "homepage": "https://docs.example.com",
  "repository": "https://github.com/author/repo",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": "./custom/commands/",
  "agents": "./agents/",
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json"
}
```

| Field         | Required | Type          | Description                 |
| ------------- | -------- | ------------- | --------------------------- |
| `name`        | Yes      | string        | Kebab-case identifier       |
| `version`     | No       | string        | Semver (MAJOR.MINOR.PATCH)  |
| `description` | No       | string        | Brief description           |
| `author`      | No       | object        | `{name, email?}`            |
| `homepage`    | No       | string        | Documentation URL           |
| `repository`  | No       | string        | Source code URL             |
| `license`     | No       | string        | License identifier          |
| `keywords`    | No       | string[]      | Discovery tags              |
| `commands`    | No       | string/array  | Custom command paths        |
| `agents`      | No       | string/array  | Custom agent paths          |
| `skills`      | No       | string/array  | Custom skill paths          |
| `hooks`       | No       | string/object | Hooks config path or inline |
| `mcpServers`  | No       | string/object | MCP config path or inline   |

### SKILL.md Frontmatter (Official)

```yaml
---
name: skill-name
description: What this skill does and when to use it
argument-hint: "[filename] [format]"
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
model: sonnet
context: fork
agent: Explore
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
---
Your skill content in Markdown...
```

| Field                      | Required | Type    | Description                                   |
| -------------------------- | -------- | ------- | --------------------------------------------- |
| `name`                     | No       | string  | Display name (uses directory name if omitted) |
| `description`              | Yes      | string  | When Claude should use this skill             |
| `argument-hint`            | No       | string  | Hint shown during autocomplete                |
| `disable-model-invocation` | No       | boolean | Prevent auto-loading (default: false)         |
| `user-invocable`           | No       | boolean | Show in / menu (default: true)                |
| `allowed-tools`            | No       | string  | Comma-separated tool allowlist                |
| `model`                    | No       | string  | Model override for this skill                 |
| `context`                  | No       | string  | `fork` to run in subagent                     |
| `agent`                    | No       | string  | Subagent type when `context: fork`            |
| `hooks`                    | No       | object  | Scoped hooks for this skill                   |

### Agent Definition Frontmatter (Official)

```yaml
---
name: frontend-developer
description: Expert frontend developer. Use for React components and UI work.
tools: Read, Grep, Glob, Bash, Write, Edit
disallowedTools:
model: inherit
permissionMode: default
skills:
  - react
  - zustand
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
---
You are a senior frontend developer specializing in React and TypeScript...
```

| Field             | Required | Type     | Description                               |
| ----------------- | -------- | -------- | ----------------------------------------- |
| `name`            | Yes      | string   | Unique identifier (kebab-case)            |
| `description`     | Yes      | string   | When Claude should delegate to this agent |
| `tools`           | No       | string   | Comma-separated tool allowlist            |
| `disallowedTools` | No       | string   | Comma-separated tool denylist             |
| `model`           | No       | string   | `sonnet`, `opus`, `haiku`, or `inherit`   |
| `permissionMode`  | No       | string   | `default`, `acceptEdits`, `dontAsk`, etc. |
| `skills`          | No       | string[] | Skills to preload into agent context      |
| `hooks`           | No       | object   | Scoped hooks for this agent               |

### marketplace.json Schema (Official)

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-collective",
  "version": "1.0.0",
  "description": "Community skills and stacks for Claude Code",
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
      "description": "React patterns and conventions",
      "version": "1.0.0",
      "author": { "name": "vince" },
      "category": "frontend"
    }
  ]
}
```

| Field              | Required | Type   | Description                         |
| ------------------ | -------- | ------ | ----------------------------------- |
| `name`             | Yes      | string | Marketplace identifier (kebab-case) |
| `owner.name`       | Yes      | string | Maintainer name                     |
| `owner.email`      | No       | string | Contact email                       |
| `plugins`          | Yes      | array  | Plugin definitions                  |
| `plugins[].name`   | Yes      | string | Plugin identifier                   |
| `plugins[].source` | Yes      | string | Path OR GitHub source object        |

### Plugin Source Options

**Local path (for same-repo plugins):**

```json
{ "source": "./dist/plugins/my-plugin" }
```

**GitHub repository:**

```json
{
  "source": {
    "source": "github",
    "repo": "owner/repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4..."
  }
}
```

**Git URL (GitLab, Bitbucket, self-hosted):**

```json
{
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git",
    "ref": "main"
  }
}
```

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

**Environment Variables in Plugins:**

- `${CLAUDE_PLUGIN_ROOT}` - Absolute path to plugin directory
- `${CLAUDE_PROJECT_DIR}` - Project root directory

---

## Current vs Target Architecture

### Current Output Structure

```
.claude/
├── agents/
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
├── skills/
│   ├── react/
│   │   └── SKILL.md
│   └── ...
└── settings.json (maybe)
```

**Problems:**

- No plugin.json manifest
- No namespacing
- Cannot be installed remotely
- No version tracking

### Target Output Structure

```
~/.claude/plugins/my-stack/          # OR .claude/plugins/ for project scope
├── .claude-plugin/
│   └── plugin.json                  # REQUIRED manifest
├── skills/
│   ├── react/
│   │   └── SKILL.md
│   ├── zustand/
│   │   └── SKILL.md
│   └── ...
├── agents/
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
├── hooks/
│   └── hooks.json                   # Optional
└── README.md                        # Generated
```

**Benefits:**

- Valid Claude Code plugin
- Namespaced skills: `/my-stack:react`
- Remote installation via marketplace
- Version tracked in plugin.json

### File Format Changes

| Component | Current                         | Target                               |
| --------- | ------------------------------- | ------------------------------------ |
| Skills    | `SKILL.md` with our frontmatter | `SKILL.md` with official frontmatter |
| Agents    | `agent.md` with our frontmatter | `agent.md` with official frontmatter |
| Manifest  | None                            | `.claude-plugin/plugin.json`         |
| Location  | `.claude/`                      | `~/.claude/plugins/` or project      |

---

## Implementation Details

### Phase 0: Schema Alignment

**Goal**: Update our skill and agent formats to match official schemas.

#### 0.1 SKILL.md Frontmatter Update

Our current frontmatter:

```yaml
---
name: React
description: React patterns
author: "@vince"
version: 5
---
```

Required official frontmatter:

```yaml
---
name: react
description: React patterns and conventions for Claude agents
disable-model-invocation: false
user-invocable: true
---
```

**Changes needed in skills:**

- Remove `author` (move to metadata.yaml)
- Remove `version` (move to metadata.yaml)
- Add `disable-model-invocation: false` for background skills
- Add `user-invocable: true/false` based on skill type

#### 0.2 Agent Frontmatter Update

Our current agent output has no frontmatter or basic frontmatter. We need:

```yaml
---
name: frontend-developer
description: Expert frontend developer. Use proactively for React and UI work.
tools: Read, Grep, Glob, Bash, Write, Edit, Task
model: inherit
permissionMode: default
skills:
  - react
  - zustand
  - scss-modules
---
```

**Changes needed:**

- Update `agent.liquid` template to output official frontmatter
- Include `tools` field with appropriate tool restrictions
- Include `skills` field to preload relevant skills
- Include `description` that matches what's in `agents.yaml`

#### 0.3 plugin.json Generator

Create function to generate valid plugin.json:

```typescript
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
  };
  repository?: string;
  license?: string;
  keywords?: string[];
}

function generatePluginJson(config: StackConfig): PluginManifest {
  return {
    name: config.name,
    version: config.version || "1.0.0",
    description: `Compiled stack with ${config.skills.length} skills`,
    author: {
      name: config.author || "claude-collective",
    },
    keywords: config.skills.map((s) => s.split("/")[0]), // categories
  };
}
```

### Phase 1: Plugin Output Structure

#### 1.1 Update Compiler Output Path

Current (`src/cli/lib/stack-creator.ts`):

```typescript
const outputDir = path.join(projectRoot, ".claude");
```

New:

```typescript
function getOutputPath(
  name: string,
  scope: "user" | "project" | "local",
): string {
  switch (scope) {
    case "user":
      return path.join(os.homedir(), ".claude", "plugins", name);
    case "project":
      return path.join(process.cwd(), ".claude", "plugins", name);
    case "local":
      return path.join(process.cwd(), ".claude", "plugins", name);
    default:
      return path.join(os.homedir(), ".claude", "plugins", name);
  }
}
```

#### 1.2 Generate Plugin Manifest

After compilation, generate `.claude-plugin/plugin.json`:

```typescript
async function writePluginManifest(outputDir: string, config: StackConfig) {
  const manifestDir = path.join(outputDir, ".claude-plugin");
  await fs.ensureDir(manifestDir);

  const manifest = {
    name: config.name,
    version: config.version || "1.0.0",
    description:
      config.description || `Claude Collective stack: ${config.name}`,
    author: {
      name: config.author || "claude-collective",
    },
    keywords: extractKeywords(config.skills),
  };

  await fs.writeJson(path.join(manifestDir, "plugin.json"), manifest, {
    spaces: 2,
  });
}
```

#### 1.3 Skills Directory Structure

Ensure skills output to `skills/<name>/SKILL.md`:

```typescript
// Current: skills/react.md
// Target:  skills/react/SKILL.md

async function writeSkill(outputDir: string, skill: CompiledSkill) {
  const skillDir = path.join(outputDir, "skills", skill.name);
  await fs.ensureDir(skillDir);
  await fs.writeFile(path.join(skillDir, "SKILL.md"), skill.content);
}
```

#### 1.4 Agents Stay in agents/

Agents already output to `agents/` directory. No change needed for location, but frontmatter needs updating.

### Phase 2: Marketplace Setup

#### 2.1 Create marketplace.json

In source repository root, create `.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-collective",
  "version": "1.0.0",
  "description": "Community-driven skills and stacks for Claude Code",
  "owner": {
    "name": "Claude Collective",
    "email": "hello@claude-collective.com"
  },
  "plugins": []
}
```

#### 2.2 Structure Skills as Plugin Entries

Each skill becomes a plugin entry:

```json
{
  "plugins": [
    {
      "name": "skill-react",
      "source": "./dist/plugins/skill-react",
      "description": "React patterns, hooks, and component architecture",
      "version": "1.0.0",
      "author": { "name": "vince" },
      "category": "frontend"
    },
    {
      "name": "skill-zustand",
      "source": "./dist/plugins/skill-zustand",
      "description": "Zustand state management patterns",
      "version": "1.0.0",
      "author": { "name": "vince" },
      "category": "frontend"
    }
  ]
}
```

#### 2.3 Pre-built Stacks as Plugins

Pre-built stacks (like `home-stack`, `work-stack`) are also plugin entries:

```json
{
  "name": "stack-fullstack-react",
  "source": "./dist/stacks/fullstack-react",
  "description": "Full-stack React + Hono + Drizzle stack with 15 skills",
  "version": "1.0.0",
  "author": { "name": "claude-collective" },
  "category": "stack"
}
```

### Phase 3: CLI Updates

#### 3.1 Update `cc init`

Add `--scope` and `--name` flags:

```typescript
program
  .command("init")
  .option("--name <name>", "Plugin name")
  .option("--scope <scope>", "Installation scope: user, project, local", "user")
  .action(async (options) => {
    const name = options.name || (await promptForName());
    const scope = options.scope;
    const outputPath = getOutputPath(name, scope);
    // ... existing wizard logic ...
    await compileToPlugin(outputPath, selectedSkills);
  });
```

#### 3.2 Update `cc compile`

Output to plugin format:

```typescript
program
  .command("compile")
  .option("--scope <scope>", "Installation scope", "user")
  .action(async (options) => {
    const config = await loadStackConfig();
    const outputPath = getOutputPath(config.name, options.scope);
    await compileToPlugin(outputPath, config);
  });
```

#### 3.3 Add `cc version` Command

Bump plugin version:

```typescript
program
  .command("version <bump>")
  .description("Bump plugin version (major, minor, patch)")
  .action(async (bump) => {
    const manifestPath = findPluginManifest();
    const manifest = await fs.readJson(manifestPath);
    manifest.version = semver.inc(manifest.version, bump);
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    console.log(`Bumped to ${manifest.version}`);
  });
```

---

## Marketplace Architecture

### Repository Structure

```
claude-collective/skills/
├── .claude-plugin/
│   └── marketplace.json           # Marketplace definition
├── src/
│   └── skills/                    # Source skills
│       ├── frontend/
│       │   ├── react (@vince)/
│       │   └── zustand (@vince)/
│       └── backend/
│           ├── hono (@vince)/
│           └── drizzle (@vince)/
├── dist/
│   ├── plugins/                   # Compiled skill plugins
│   │   ├── skill-react/
│   │   └── skill-zustand/
│   └── stacks/                    # Pre-compiled stacks
│       ├── fullstack-react/
│       └── backend-api/
└── README.md
```

### How Users Install

```bash
# Add marketplace (one time)
/plugin marketplace add claude-collective/skills

# Install individual skill
/plugin install skill-react@claude-collective

# Install pre-built stack
/plugin install stack-fullstack-react@claude-collective

# Or use our CLI to build custom stack
npx @claude-collective/cli init --name my-stack
```

### Team Configuration

Teams can pre-configure marketplace in `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-collective": {
      "source": {
        "source": "github",
        "repo": "claude-collective/skills"
      }
    }
  },
  "enabledPlugins": {
    "stack-fullstack-react@claude-collective": true
  }
}
```

---

## CLI Changes Required

### Files to Modify

| File                                 | Changes                                        |
| ------------------------------------ | ---------------------------------------------- |
| `src/cli/commands/init.ts`           | Add --scope, --name, output to plugin format   |
| `src/cli/commands/compile.ts`        | Output to plugin format with manifest          |
| `src/cli/lib/stack-creator.ts`       | Update output path logic                       |
| `src/cli/lib/compiler.ts`            | Update agent/skill compilation for frontmatter |
| `src/agents/_templates/agent.liquid` | Update to output official frontmatter          |
| `src/schemas/`                       | Add plugin.json, marketplace.json schemas      |

### New Files to Create

| File                              | Purpose                             |
| --------------------------------- | ----------------------------------- |
| `src/cli/lib/plugin-manifest.ts`  | Generate plugin.json                |
| `src/cli/commands/version.ts`     | Bump plugin version                 |
| `.claude-plugin/marketplace.json` | Marketplace definition for our repo |

---

## Migration Path

### For Existing Users

1. Run `cc migrate` command (to be implemented)
2. Copies `.claude/` contents to `~/.claude/plugins/migrated-stack/`
3. Generates plugin.json
4. Updates frontmatter in skills/agents

### For New Users

1. `npx @claude-collective/cli init`
2. Outputs directly to plugin format
3. Claude Code loads automatically

### For Distribution

1. Create marketplace.json
2. Push to GitHub
3. Users add marketplace once: `/plugin marketplace add owner/repo`
4. Users install: `/plugin install plugin-name@marketplace-name`

---

## Testing Checklist

### Plugin Loading Tests

- [ ] Plugin loads when placed in `~/.claude/plugins/`
- [ ] Skills are namespaced correctly (`/plugin-name:skill`)
- [ ] Agents appear in Task tool
- [ ] Hooks execute correctly
- [ ] Plugin validates with `/plugin validate .`

### Marketplace Tests

- [ ] Marketplace.json validates
- [ ] `/plugin marketplace add owner/repo` succeeds
- [ ] `/plugin install plugin@marketplace` succeeds
- [ ] `/plugin update` works
- [ ] Version pinning works

### CLI Tests

- [ ] `cc init --scope user` outputs to `~/.claude/plugins/`
- [ ] `cc init --scope project` outputs to `.claude/plugins/`
- [ ] `cc compile` regenerates plugin
- [ ] `cc version patch` bumps version correctly

### Integration Tests

- [ ] Compiled agents use skills correctly
- [ ] Tool restrictions from frontmatter are enforced
- [ ] Model overrides from frontmatter work
- [ ] Multiple plugins coexist without conflicts

---

## Open Questions (Resolved)

### 1. Plugin Installation Path

**Answer**: Use `--scope` flag with default `user`:

- `user`: `~/.claude/plugins/` (default, portable)
- `project`: `.claude/plugins/` (team sharing via git)
- `local`: `.claude/plugins/` (not committed)

### 2. Plugin Naming

**Answer**: Prompt in wizard with `--name` override. Default to sanitized directory name.

### 3. Updating Existing Plugins

**Answer**: `cc update` fetches latest skills and recompiles. User must run `cc version` manually before sharing.

### 4. How Skills Get Namespaced

**Answer**: Plugin `name` field in plugin.json becomes namespace. Skill at `skills/react/SKILL.md` in plugin `my-stack` becomes `/my-stack:react`.

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

## References

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces Guide](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugins Technical Reference](https://code.claude.com/docs/en/plugins-reference)
- [Skills Documentation](https://code.claude.com/docs/en/skills)
- [Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Official Plugin Repository](https://github.com/anthropics/claude-plugins-official)
- [Official Plugin Examples](https://github.com/anthropics/claude-code/tree/main/plugins)
- [Plugin Template](https://github.com/ivan-magda/claude-code-plugin-template)

---

_Created: 2026-01-23_
_Updated: 2026-01-23 - Complete rewrite with official schema research_
