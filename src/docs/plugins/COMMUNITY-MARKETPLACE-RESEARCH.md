# Community Marketplace Research

> **Date**: 2026-01-24
> **Status**: Complete
> **Purpose**: Answer open questions from MARKETPLACE-ARCHITECTURE-FINDINGS.md

---

## Executive Summary

After researching 7 major community marketplaces and conducting web searches across Reddit, Hacker News, and GitHub, the key findings are:

1. **Version Pinning**: Most community marketplaces do **NOT** use ref/sha pinning. Only Anthropic's official patterns support it.
2. **Common Structure**: All use `.claude-plugin/marketplace.json` with a `plugins` array
3. **Private Fork Support**: Limited - relies on standard Git forking; enterprise features are nascent
4. **Update Handling**: Branch-based (community) vs manual SHA pinning (enterprise-ready)

---

## Marketplaces Investigated

| Repository                         | Plugins | Version Pinning          | Private Support   |
| ---------------------------------- | ------- | ------------------------ | ----------------- |
| wshobson/agents                    | 72      | Semver only, no SHA      | Not documented    |
| ccplugins/marketplace              | 116+    | Branch-based, no SHA     | Fork instructions |
| kivilaid/plugin-marketplace        | 77      | Semver only, no SHA      | 3 forks exist     |
| anthropics/claude-plugins-official | 40+     | **Full ref/sha support** | Token auth        |
| Kamalnrf/claude-plugins            | 11,989  | None (registry API)      | Not supported     |
| affaan-m/everything-claude-code    | 25+     | None (latest branch)     | Fork-friendly     |
| skills.sh (anthropics/skills)      | 50+     | Package-level only       | Manual upload     |

---

## 1. Marketplace.json Structure Patterns

### Common Schema (All Marketplaces)

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "marketplace-name",
  "owner": {
    "name": "Owner Name",
    "email": "contact@example.com"
  },
  "metadata": {
    "description": "Marketplace description",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-folder",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": { "name": "Author" },
      "category": "development"
    }
  ]
}
```

### Source Field Patterns

**Pattern 1: Relative Paths (Most Common)**

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin"
}
```

Used by: wshobson/agents, ccplugins/marketplace, kivilaid/plugin-marketplace, affaan-m/everything-claude-code

**Pattern 2: GitHub Source with Pinning (Official Only)**

```json
{
  "name": "external-plugin",
  "source": {
    "source": "github",
    "repo": "owner/repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

Used by: anthropics/claude-plugins-official

**Pattern 3: Git URL Source**

```json
{
  "name": "gitlab-plugin",
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git",
    "ref": "main"
  }
}
```

Documented but rarely used in community marketplaces.

---

## 2. Version Pinning Analysis

### Finding: Community Marketplaces Don't Pin Versions

| Marketplace                     | Pinning Method       | Implication                     |
| ------------------------------- | -------------------- | ------------------------------- |
| wshobson/agents                 | `version` field only | Users get latest main branch    |
| ccplugins/marketplace           | `version` field only | No reproducibility guarantee    |
| kivilaid/plugin-marketplace     | `version` field only | Updates are implicit            |
| affaan-m/everything-claude-code | No version field     | Always latest                   |
| skills.sh                       | Package-level        | Individual skills not versioned |

### Finding: Only Anthropic Supports Full Pinning

From **anthropics/claude-plugins-official** documentation:

```json
{
  "name": "github-plugin",
  "source": {
    "source": "github",
    "repo": "owner/plugin-repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

- `ref` = Git branch or tag (optional, defaults to default branch)
- `sha` = Full 40-character commit hash for exact reproducibility
- Installation records commit hash at install time
- Plugins stay pinned unless explicitly updated

### Hacker News Criticism

From [HN discussion](https://news.ycombinator.com/item?id=46363490):

> "I hate everything about the Claude code plugin system... No lock files. Most plugins in turn install MCPs from pypi with uvx so you have two layers of no pinning."

This confirms the gap between community practice and enterprise needs.

---

## 3. Skills, Agents, and Stacks Organization

### Common Directory Structure

```
marketplace/
├── .claude-plugin/
│   └── marketplace.json     # Central registry
├── plugins/
│   └── {plugin-name}/
│       ├── .claude-plugin/
│       │   └── plugin.json  # Plugin manifest
│       ├── agents/
│       │   └── *.md         # Agent definitions
│       ├── commands/
│       │   └── *.md         # Slash commands
│       ├── skills/
│       │   └── {skill}/
│       │       └── SKILL.md # Skill definition
│       ├── hooks/
│       │   └── hooks.json   # Event handlers
│       └── mcp-servers/     # MCP configurations
```

### SKILL.md Format (Universal)

```yaml
---
name: skill-name
description: What it does and when to use it (< 1024 chars)
disable-model-invocation: true # Optional: user-only
user-invocable: false # Optional: Claude-only
allowed-tools: Read, Grep, Glob # Optional: restrict tools
context: fork # Optional: run in subagent
agent: Explore # Optional: subagent type
---
# Markdown Instructions

Claude follows these instructions when skill is invoked.
```

### Agent Definition Format

```yaml
---
name: agent-name
description: Expert overview with activation context
model: opus|sonnet|haiku
---
# Agent System Prompt

[Markdown with: Purpose, Capabilities, Behavioral Traits, etc.]
```

### Marketplace Scale Comparison

| Marketplace                        | Plugins | Agents | Skills | Commands |
| ---------------------------------- | ------- | ------ | ------ | -------- |
| wshobson/agents                    | 72      | 108    | 129    | 15       |
| ccplugins/marketplace              | 116     | ~50    | ~100   | ~60      |
| kivilaid/plugin-marketplace        | 77      | ~40    | ~60    | ~30      |
| anthropics/claude-plugins-official | 40      | ~20    | ~30    | ~15      |
| affaan-m/everything-claude-code    | 1       | 9      | 11     | 15       |
| Kamalnrf/claude-plugins            | 11,989  | -      | 63,065 | -        |

---

## 4. Private/Company Fork Support

### Current State: Limited But Possible

**Method 1: GitHub Forking (All Marketplaces)**

1. Fork the public marketplace repository
2. Modify `marketplace.json` with your plugins
3. Add marketplace: `/plugin marketplace add your-org/your-marketplace`

**Method 2: Token Authentication (Official Only)**

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export GITLAB_TOKEN=glpat-xxxxxxxxxxxx
export BITBUCKET_TOKEN=your-token
```

**Method 3: strictKnownMarketplaces (Enterprise)**

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "company-org/approved-plugins"
    }
  ]
}
```

### Gaps Identified

1. **No centralized private registry support** - unlike npm's Verdaccio
2. **No team-level access control** - relies on GitHub permissions
3. **No audit logging** - no visibility into plugin installations
4. **No MCP registry** - feature requested in [GitHub Issue #7992](https://github.com/anthropics/claude-code/issues/7992)

---

## 5. Update Handling Strategies

### Community Pattern: Branch-Based Updates

```
User adds marketplace → points to main branch
Repository updates → user gets latest on next install
No version locking → "latest is greatest"
```

**Pros**: Simple, always current
**Cons**: No reproducibility, breaking changes possible

### Enterprise Pattern: SHA Pinning

```
Admin pins SHA in company marketplace.json
Admin tests new version in sandbox
Admin updates SHA after validation
Team gets controlled update
```

**Pros**: Reproducible, controlled rollout
**Cons**: Manual maintenance, can fall behind

### Auto-Update Feature (Claude Code 2.0.70+)

From [official docs](https://code.claude.com/docs/en/discover-plugins):

- Per-marketplace automatic updates can be enabled
- Claude Code refreshes marketplace data at startup
- Installed plugins update if marketplace specifies new versions

### Update Commands

```bash
# Refresh marketplace catalog (not installed plugins)
/plugin marketplace update

# Update specific plugin (re-pin to latest)
claude plugin update plugin-name@marketplace-name
```

---

## 6. Community Pain Points (from Reddit/HN)

### Plugin System Criticism

1. **No lock files** - can't reproduce exact installation
2. **Two-layer unpinning** - plugins install MCPs which install pip packages
3. **Security concerns** - supply chain attacks possible
4. **Global scope bleeding** - plugins enabled in one project affect all projects

### Feature Requests

1. **Per-project plugin configuration** ([Issue #11461](https://github.com/anthropics/claude-code/issues/11461))
2. **Skill invocation logging** - understand why Claude activated skills
3. **Force-invoke/prevent skills** - more control over auto-activation
4. **MCP registry support** - centralized enterprise management

### Positive Feedback

1. **Rapid ecosystem growth** - "marketplaces cropped up everywhere" within 24 hours
2. **Extensibility appreciated** - users building meaningful tools
3. **LSP integration praised** - code intelligence plugins highly valued

---

## 7. Comparison to Other Plugin Systems

### npm Registry Model (Reference)

| Feature               | npm                    | Claude Code        |
| --------------------- | ---------------------- | ------------------ |
| Version pinning       | Full semver ranges     | SHA or nothing     |
| Lock files            | package-lock.json      | None               |
| Dist-tags             | latest, next, beta     | Not supported      |
| Private registry      | Verdaccio, Artifactory | GitHub tokens only |
| Dependency resolution | SAT solver             | Name references    |

### GitHub Actions Comparison (HN Criticism)

> "They saw GitHub Actions success and tried to copy it, but without understanding why it works."

GitHub Actions has:

- Pinnable versions (`uses: actions/checkout@v4`)
- Immutable releases
- Marketplace verification
- Enterprise controls

Claude Code plugins lack most of these enterprise features.

---

## 8. Recommendations for claude-subagents

### Adopt Official Pinning Pattern

```json
{
  "name": "skill-react",
  "source": {
    "repo": "claude-collective/skill-react",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

### Implement Dual Marketplace Model

```
Public Marketplace (claude-collective)
├── skills/     → latest versions (ref only)
├── agents/     → latest versions (ref only)
└── stacks/     → latest versions (ref only)

Company/Private Marketplace
├── skills/     → pinned to tested SHAs
├── agents/     → pinned to tested SHAs
└── stacks/     → pinned to tested SHAs
```

### Follow Existing Patterns For

- Directory structure (skills/, agents/, commands/)
- SKILL.md frontmatter format
- Agent markdown format with model specification
- Plugin.json manifest structure

### Innovate On

- SHA pinning for reproducibility (few do this)
- Changelog/migration documentation
- Compatibility matrix maintenance
- Testing before SHA promotion

---

## Sources

### Repositories Researched

- [wshobson/agents](https://github.com/wshobson/agents) - 72 plugins, 108 agents
- [ccplugins/marketplace](https://github.com/ccplugins/marketplace) - 116+ plugins
- [kivilaid/plugin-marketplace](https://github.com/kivilaid/plugin-marketplace) - 77 plugins
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) - Official marketplace
- [Kamalnrf/claude-plugins](https://github.com/Kamalnrf/claude-plugins) - Registry at claude-plugins.dev
- [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) - 22k stars
- [anthropics/skills](https://github.com/anthropics/skills) - Official skills repo

### Documentation

- [Plugin Marketplaces - Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugins Reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference)
- [Extend Claude with Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [skills.sh Documentation](https://agentskills.io/docs)

### Community Discussions

- [HN: Customize Claude Code with plugins](https://news.ycombinator.com/item?id=45530150)
- [HN: Plugin system criticism](https://news.ycombinator.com/item?id=46363490)
- [HN: Claude Code 2.0](https://news.ycombinator.com/item?id=45416228)
- [GitHub Issue #11461: Per-project plugin configuration](https://github.com/anthropics/claude-code/issues/11461)
- [GitHub Issue #7992: MCP Registry support](https://github.com/anthropics/claude-code/issues/7992)

---

## Open Questions Answered

From MARKETPLACE-ARCHITECTURE-FINDINGS.md:

| Question                                      | Answer                                                      |
| --------------------------------------------- | ----------------------------------------------------------- |
| Do existing marketplaces use version pinning? | **No** - only Anthropic's official patterns support ref/sha |
| How do they handle updates?                   | Branch-based (latest main), no lock files                   |
| Do any support private/company forks?         | Limited - GitHub forking only, no private registry          |
| What's the common structure?                  | `.claude-plugin/marketplace.json` with plugins array        |
