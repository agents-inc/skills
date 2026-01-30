# Recent Claude Code Updates (October 2025 - January 2026)

Research Date: January 5, 2026

## Executive Summary

Claude Code shipped **176 updates in 2025**, demonstrating rapid iteration from beta (February 2025) to v2.0. The latest version is **2.0.76**. Key themes affecting subagent/skill systems include: enhanced subagent architecture, async/background execution, plugin marketplace, hooks expansion, and improved orchestration capabilities.

---

## 1. Subagent System Updates

### Core Subagent Architecture

- **Custom subagents** can be created via `/agents` command (July 24, 2025)
- Subagents are defined as **Markdown files with YAML frontmatter** in `.claude/agents/` (project) or `~/.claude/agents/` (user)
- Each subagent has its own **isolated context window**, preventing pollution of the main conversation
- Subagents only send relevant information back to the orchestrator, ideal for tasks requiring sifting through large amounts of data

### Built-in Subagents

- **Explore subagent**: Fast, lightweight, read-only agent for codebase searching/analysis
- **Plan subagent**: Used exclusively in plan mode for structured planning

### Recent Fixes (2.0.30 - 2.0.74)

- Fixed subagent permissions handling (2.0.49)
- Fixed MCP tools not available to sub-agents (2.0.30)
- Fixed steering messages lost while subagent is working (2.0.68)
- Added `permissionMode` field for custom agents (2.0.43)
- Added `disallowedTools` field to custom agent definitions (2.0.30)
- Added `agent_id` and `agent_transcript_path` fields to `SubagentStop` hooks (2.0.42)
- **SubagentStart hook event** added (2.0.43)

### Subagent Configuration Options

```yaml
# Agent frontmatter options
name: my-agent
description: Agent description
allowed-tools: [Read, Write, Bash]
disallowed-tools: [WebSearch]
permissionMode: default | auto-approve | plan
model: claude-sonnet-4-20250514
```

---

## 2. Skills System Updates

### Skills vs Slash Commands

- **Slash commands**: User-invoked via `/command-name`, single Markdown files
- **Skills**: Model-invoked (Claude autonomously uses based on context), directory structure with SKILL.md plus supporting files

### Skill Locations

- Project: `.claude/skills/`
- User: `~/.claude/skills/`

### Recent Updates

- Fixed skill `allowed-tools` not being applied to tools invoked by the skill (2.0.74)
- Added **skills frontmatter field** to declare skills for auto-loading in subagents (2.0.43)
- Improved `/context` command with grouped skills and agents by source, better token count visualization (2.0.74)
- Fixed circular symlinks in skill directories (2.0.62)

---

## 3. Async/Background Execution

### Native Background Support (2.0.60+)

- **Background agent support**: Agents can run in background while you work on other tasks
- Agents and bash commands can run asynchronously and send messages to wake up the main agent (2.0.64)
- **Unified TaskOutputTool** replacing AgentOutputTool and BashOutputTool (2.0.64)

### Background Command Execution

- Press **Ctrl+B** to run any Bash command in background
- Background tasks automatically persist across Claude Code sessions
- Start tasks with `&` prefix on web to run in background (2.0.45)

### Current Limitations

- Task tool currently executes agents **synchronously**, blocking orchestrator until completion
- Feature request open for `run_in_background: true` parameter on Task tool (Issue #9905)

### Third-Party Parallel Execution Solutions

- **Async Code**: Web UI for parallel Claude Code agents
- **Tembo**: Cloud-based parallel task execution
- **Git Worktrees**: Native Git feature for parallel agent work in separate directories
- **Gitpod**: Isolated environments for each Claude Code agent

---

## 4. Hooks System Expansion

### Available Hook Events (8 total)

1. `SessionStart` - When session begins
2. `SessionEnd` - When session ends
3. `UserPromptSubmit` - Before user prompt is processed
4. `PreToolUse` - Before tool execution (can block)
5. `PostToolUse` - After tool execution
6. `SubagentStart` - When subagent begins (2.0.43)
7. `SubagentStop` - When subagent completes
8. `Notification` - For custom notifications

### Recent Hook Updates

- **PermissionRequest hooks** to process 'always allow' suggestions (2.0.45, 2.0.54)
- **Prompt-based stop hooks** added (2.0.30)
- Added `model` parameter to prompt-based stop hooks (2.0.41)
- Support for **custom timeouts** (2.0.41)
- Added matcher values for Notification hook events (2.0.37)
- Added `tool_use_id` field to hook input types (2.0.43)

### Common Hook Use Cases

- **Auto-formatting**: Run prettier, gofmt after file edits
- **Notifications**: Custom alerts when Claude awaits input
- **Logging**: Track commands for compliance
- **Permissions**: Block dangerous commands, validate paths
- **Context injection**: Add git status, TODO list at session start

---

## 5. Plugin Marketplace (2.0.13+)

### Plugin System

Plugins are packages containing any combination of:

- Slash commands
- Subagents
- Skills
- Hooks
- MCP servers

### Commands

```bash
/plugins                           # Browse marketplace
/plugin install plugin-name        # Install plugin
/plugin install user/repo          # Install from GitHub
/plugin install ./local-plugin     # Install local plugin
/plugin list                       # List installed plugins
/plugin remove plugin-name         # Remove plugin
/plugin marketplace add user/repo  # Add marketplace
```

### Recent Updates

- First-party plugins marketplace launched
- Search filtering added to plugin discover screen (2.0.73)
- Auto-update toggle for plugin marketplaces (2.0.70)
- Support for sharing and installing output styles (2.0.41)
- Fixed plugin uninstall not removing plugins (2.0.31)

### Creating Marketplaces

- Marketplaces are Git repositories with `.claude-plugin/marketplace.json`
- Teams can create internal marketplaces for private plugins

---

## 6. Memory and Rules System

### CLAUDE.md Hierarchy

1. `~/.claude/CLAUDE.md` - User-level (personal preferences)
2. `./CLAUDE.md` - Project root
3. Parent directories - Searched upward to root
4. `.claude/CLAUDE.md` - Project-specific

### Rules Directory (.claude/rules/) - v2.0.64+

- Organize instructions into multiple focused files
- All `.md` files automatically loaded
- Support for **path-scoped rules** via YAML frontmatter:

```yaml
---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---
# TypeScript-specific rules here
```

### Imports Feature

- Import external docs: `@docs/architecture.md`
- Works across Git worktrees
- `CLAUDE.local.md` deprecated in favor of imports

---

## 7. MCP (Model Context Protocol) Updates

### Core Features

- Connect to external tools/data sources via MCP servers
- **Wildcard syntax** for MCP tool permissions: `mcp__server__*` (2.0.70)
- Resources accessible via `@` mentions
- Plugin-bundled MCP servers supported

### Recent Fixes

- Fixed disallowed MCP tools being visible to model (2.0.68)
- Fixed MCP servers from `.mcp.json` stuck in pending state (2.0.67)
- Fixed MCP tools with nested references in input schemas (2.0.50)
- **SSE MCP servers enabled** on native build (2.0.30)
- Fixed infinite token refresh loop with OAuth MCP servers (2.0.34)

### Token Management

- Warning threshold: 10,000 tokens
- Default maximum: 25,000 tokens
- Configurable via `MAX_MCP_OUTPUT_TOKENS`

---

## 8. Plan Mode and Thinking Features

### Plan Mode

- Activated via **Shift+Tab** (cycles through permission modes)
- Start session in plan mode: `--permission-mode plan`
- Creates read-only analysis plans before implementation
- Improved plan feedback input when rejecting plans (2.0.57)
- Improved exit UX with simplified yes/no dialog (2.0.68)

### Thinking/UltraThink Modes

- Magic words: "think" < "think hard" < "think harder" < "ultrathink"
- UltraThink budget: 31,999 tokens
- **Thinking mode enabled by default for Opus 4.5** (2.0.67)
- Configuration moved to `/config` (2.0.67)
- View thinking: Press **Ctrl+O** for verbose mode
- `MAX_THINKING_TOKENS` env var overrides ultrathink keyword

---

## 9. Model and Performance Updates

### Opus 4.5 (2.0.51)

- Released as new frontier model
- Thinking mode on by default
- Pro users have access as part of subscription (2.0.58)
- Handles long-horizon coding tasks more efficiently
- Up to **65% fewer tokens** on complex tasks

### Model Switching

- Switch models while writing prompt: **Alt+P** (Linux/Windows), **Option+P** (macOS) (2.0.65)
- Model name added to "Co-Authored-By" commit messages (2.0.60)

---

## 10. Session Management

### Named Sessions (2.0.64)

- `/rename` - Name current session
- `/resume <name>` - Resume named session
- `--resume <name>` - Resume from terminal
- `/stats` - View usage stats, favorite model, usage streak

### Custom Session IDs (2.0.73)

- `--session-id` combined with `--resume`/`--continue`
- Support for `--fork-session`

---

## 11. IDE and Browser Integration

### Claude in Chrome (Beta) - 2.0.72

- Control browser directly from Claude Code
- Requires Chrome extension
- `/chrome` command for testing/debugging in Chrome

### VSCode Updates

- Multiple terminal clients support (2.0.60)
- Streaming message support (2.0.57)
- Copy-to-clipboard on code blocks (2.0.64)
- Windows ARM64 support with x64 emulation (2.0.64)
- Secondary sidebar support (2.0.56)

### LSP (Language Server Protocol) - 2.0.74

- Go-to-definition
- Find references
- Hover documentation
- Real-time diagnostics

---

## 12. Other Notable Updates

### Sandbox and Permissions

- `allowUnsandboxedCommands` sandbox setting (2.0.30)
- Search functionality in `/permissions` command (2.0.67)
- Fixed permission rules rejecting valid bash commands with glob patterns (2.0.71)

### Enterprise Features

- Enterprise managed settings support (2.0.68)
- Managed settings prefer `C:\Program Files\ClaudeCode` on Windows (2.0.58)

### Terminal Support

- `/terminal-setup` for Kitty, Alacritty, Zed, Warp (2.0.74)
- Customizable status line via `/statusline` (Aug 2025)
- **Ctrl+Z** to suspend, `fg` to resume

### IME Support (2.0.68)

- Fixed Input Method Editor for CJK languages
- Fixed word navigation for non-Latin text (Cyrillic, Greek, Arabic, Hebrew, Thai, Chinese)

---

## Impact on Subagent/Skill Systems

### Key Takeaways for Orchestration

1. **Async execution is partially available**: Background bash and basic agent support exists, but Task tool orchestration remains synchronous

2. **Hooks are the primary automation mechanism**: Use PreToolUse/PostToolUse hooks for guardrails, SubagentStart/Stop for orchestration tracking

3. **Plugin system enables distribution**: Package subagents, skills, hooks together for team sharing

4. **Skills auto-load into subagents**: Use `skills` frontmatter field to declare dependencies

5. **MCP provides external tool integration**: Wildcard permissions simplify configuration

6. **Rules directory enables modular configuration**: Split large CLAUDE.md files into focused `.claude/rules/*.md` files

### Recommended Architecture Patterns

1. **Multi-agent pipelines**: Orchestrator spawns specialized subagents (PM, Architect, Implementer, Tester)
2. **Hook-based guardrails**: Enforce standards via PreToolUse hooks
3. **Context preservation**: Use subagents for research to preserve main context
4. **Plan-then-execute**: Use plan mode with ultrathink for complex tasks

---

## Sources

- [Claude Code Changelog](https://claudelog.com/claude-code-changelog/)
- [GitHub anthropics/claude-code CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Anthropic Release Notes](https://releasebot.io/updates/anthropic/claude-code)
- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Skills/Slash Commands Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)
- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Claude Code Plugin Marketplace](https://www.anthropic.com/news/claude-code-plugins)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [What is UltraThink](https://claudelog.com/faqs/what-is-ultrathink/)
- [Claude Code Frameworks & Sub-Agents Guide](https://www.medianeth.dev/blog/claude-code-frameworks-subagents-2025)
