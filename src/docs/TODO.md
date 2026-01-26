# Outstanding Tasks

> **Generated**: 2026-01-21
> **Updated**: 2026-01-26 (Restructured into Now/After Migration/Backlog)
> **Completed Tasks**: See [TODO-COMPLETED.md](./TODO-COMPLETED.md)
>
> **Architecture Status**: Implementation complete. See [plugins/INDEX.md](./plugins/INDEX.md) for complete documentation.

---

## Related Files

| File                                            | Purpose                                                     | Location                        |
| ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `SKILLS-MATRIX-VERIFICATION.md`                 | **Complete** - 18-agent verification of skill relationships | `.claude/research/`             |
| `CLI-REVIEW-FINDINGS.md`                        | **Active** - 12-agent code review findings                  | Root                            |
| `CLAUDE-COLLECTIVE-DIRECTORY-IMPLEMENTATION.md` | **Critical** - `.claude-collective/` separation research    | `.claude/research/findings/v2/` |
| `SIMPLIFIED-PLUGIN-ARCHITECTURE.md`             | **Critical** - One plugin per project architecture          | `.claude/research/findings/v2/` |
| `CLI-AGENT-INVOCATION-RESEARCH.md`              | **Key** - Inline `--agents` JSON invocation                 | `src/docs/cli/`                 |

---

## Totals

| Status              | Count |
| ------------------- | ----- |
| **Do Now**          | 10    |
| **After Migration** | 14    |
| **Backlog**         | 18    |

---

## 1. Do Now (Before CLI Migration)

> Complete these while skills and CLI live in same repo.

### Simplified Plugin Architecture (CRITICAL)

> **MAJOR REFACTOR:** Eliminate `.claude-collective/` directory entirely. One plugin per project.
> See [SIMPLIFIED-PLUGIN-ARCHITECTURE.md](/.claude/research/findings/v2/SIMPLIFIED-PLUGIN-ARCHITECTURE.md)

| Priority | Task                      | Description                                                      |
| -------- | ------------------------- | ---------------------------------------------------------------- |
| CRITICAL | A5.1 Research migration   | Identify all files referencing stacks/`.claude-collective/`      |
| CRITICAL | A5.2 Remove `cc switch`   | Eliminate stack switching entirely                               |
| CRITICAL | A5.3 Simplify `cc init`   | Create plugin directly, use "templates" instead of "stacks"      |
| CRITICAL | A5.4 Update `cc edit/add` | Modify plugin directly, not stack                                |
| CRITICAL | A5.5 Remove stack files   | Delete stack-list.ts, stack-config.ts, stack-creator.ts          |
| CRITICAL | A5.6 Update `cc list`     | Show plugin info (version, skills, agents) instead of stack list |
| CRITICAL | A5.7 User migration       | Detect `.claude-collective/` and offer migration prompt          |

### Other Pre-Migration Tasks

| Priority | Task                    | Description                                                          |
| -------- | ----------------------- | -------------------------------------------------------------------- |
| HIGH     | A7 Inline agent test    | Test `--agents` JSON flag with model/tools (CLI-AGENT-INVOCATION.md) |
| HIGH     | Manual skill testing    | Manually test all 76 skills and 11 stacks for correctness            |
| MEDIUM   | Re-add schema to skills | Post-migration: inject schema path once CLI repo bundles the schema  |

---

## 2. After CLI Migration (Post Repo Split)

> These require the CLI to fetch from remote marketplace.

### Repo Split Milestone

| Priority | Task                 | Description                                                          |
| -------- | -------------------- | -------------------------------------------------------------------- |
| CRITICAL | B1 CLI Repository    | Move CLI to `claude-collective-cli` repo (created 2026-01-22)        |
| CRITICAL | B2 Rename Repository | Rename `claude-subagents` -> `claude-collective-skills`              |
| CRITICAL | B3 Remote fetching   | Refactor compile scripts to use giget/source-fetcher for all content |

### Post-Split Features

| Priority | Task                      | Description                                                                 |
| -------- | ------------------------- | --------------------------------------------------------------------------- |
| HIGH     | C1 Schema Distribution    | GitHub raw URLs, SchemaStore PR                                             |
| HIGH     | C2 Private Repos          | Configurable source, auth, pre-flight checks                                |
| HIGH     | C8 Agent plugins          | Agents become individually installable plugins in marketplace               |
| HIGH     | C9 `cc add <agent>`       | Install individual agents (e.g., `cc add pattern-scout`)                    |
| HIGH     | C10 Essential vs optional | Stacks install ~9-10 essential agents; optional agents installed separately |
| HIGH     | C11 Hooks in frontmatter  | Support PreToolUse/PostToolUse/Stop hooks in agent.yaml                     |
| MEDIUM   | C3 Multi-Source           | Community + private skills composition                                      |
| MEDIUM   | C4 Skill Reorg            | Separate PhotoRoom from community skills                                    |
| MEDIUM   | C5 Custom principles      | `cc customize --principles` for user-added principles merged on compile     |
| MEDIUM   | C6 `cc doctor`            | Diagnose connectivity/auth issues                                           |
| MEDIUM   | C7 `cc eject`             | Local export or GitHub fork for full independence                           |

---

## 3. Backlog

> Deferred items. Nice to have but not blocking.

### Skills & Content

| Priority | Task                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HIGH     | Skill optimization suite   | **Combined effort:** (1) Try existing tools: [johnlindquist gist](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a), [ClaudeSkills-Optimizer-GEFA](https://github.com/rartzi/ClaudeSkills-Optimizer-GEFA), [prompt-optimization-analyzer](https://github.com/Exploration-labs/Nates-Substack-Skills/tree/main/prompt-optimization-analyzer). (2) Create Rolf Wiggins-inspired prompt compaction skill. (3) Build meta-skills for diagnosing skill issues, improving prompts to align with Claude expectations, and validating skill quality. |
| MEDIUM   | Skill granularity refactor | Make skills more granular - split into `examples/` and `patterns/` folders instead of just examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LOW      | New skills (Critical)      | nx, docker, kubernetes, vite, svelte, supabase, AI SDKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| LOW      | New skills (High)          | astro, firebase, clerk, cloudflare, terraform, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LOW      | Roadmap Phase 3-5          | background-jobs, caching, i18n, payments, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### CLI & Infrastructure

| Priority | Task                    | Description                                                                                                |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| MEDIUM   | Output styles research  | Investigate Claude Code output styles for sub-agents; could set concise mode for agent cross-communication |
| LOW      | Template refactoring    | Split agent.liquid into partials (moved to src/agents/\_templates/)                                        |
| LOW      | Marketplace foundation  | Stack Marketplace Phase 1-2                                                                                |
| LOW      | Community submission    | `cc submit` flow                                                                                           |
| LOW      | External skill sources  | `cc add skill-id --source github:user/repo` fetches external skills to local                               |
| LOW      | Claude simplifier hook  | Add hook that simplifies/improves Claude's responses or workflow                                           |
| LOW      | CLI branding            | ASCII art logo + animated mascot on startup                                                                |
| LOW      | Agent partials refactor | Review agent partials (workflow.md, intro.md, examples.md) - improve naming, modularity                    |
| LOW      | Configurable thinking   | CLI flags `--thinking <tokens>` and `--agent-thinking <agent>:<tokens>` to override default max thinking   |

### Documentation

| Priority | Task                    | Description                                 |
| -------- | ----------------------- | ------------------------------------------- |
| LOW      | GitHub raw URLs         | Update `yaml-language-server` references    |
| LOW      | SchemaStore PR          | Automatic IDE detection                     |
| LOW      | Platform support docs   | GitHub, GitLab, GitHub Enterprise           |
| LOW      | Unsupported platforms   | Bitbucket private, Azure DevOps, CodeCommit |
| LOW      | Generalize MobX skill   | Remove PhotoRoom-specific patterns          |
| LOW      | Generalize Tailwind     | Remove PhotoRoom-specific patterns          |
| LOW      | Contribution guidelines | For community skills                        |
| LOW      | Private skill guide     | For company-specific skills                 |

### Testing

| Priority | Task                  | Description                          |
| -------- | --------------------- | ------------------------------------ |
| LOW      | Private repo blockers | Document Bitbucket, Azure DevOps     |
| LOW      | Content linting       | Skills can omit sections             |
| LOW      | Skill structure valid | Missing required sections undetected |

---

## Decision Log

| Date       | Decision                           | Rationale                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-25 | **Simplified plugin architecture** | One plugin per project, eliminate `.claude-collective/` entirely. Grow plugin with `cc add` instead of switching stacks. "Stacks" become "templates". See `SIMPLIFIED-PLUGIN-ARCHITECTURE.md`.                                                |
| 2026-01-25 | Version deprecated in metadata     | `version` field removed from metadata.yaml and types. Version lives only in `plugin.json`. `content_hash` is primary identifier for change detection.                                                                                         |
| 2026-01-25 | Summoners as local agents          | `cc create skill/agent` commands won't do. Users install skill-summoner/agent-summoner as optional agents (`cc add`), run locally. Avoids network dependency, works offline, consistent with other agents. Staleness caught by `cc validate`. |
| 2026-01-25 | Thinking budget: use defaults      | Claude Code defaults to max thinking (31,999 tokens) since Jan 2026. Ultrathink keywords deprecated. No need to configure per-agent - defer CLI configurability to later.                                                                     |
| 2026-01-25 | Core principles in template        | Embedded directly in agent.liquid (not a skill). Methodology content available via skills. External skill sources deferred - would need `cc add --source` to fetch to local.                                                                  |
| 2026-01-24 | Agents as individual plugins       | **Future**: Agents will be standalone installable plugins. Stacks install ~9-10 essential agents; users can add others via `cc add agent-name`.                                                                                               |
| 2026-01-24 | Plugin-based versioning            | Skills, agents, and stacks are ALL plugins. Version goes in `plugin.json`, NOT `metadata.yaml`. Single versioning model for all artifacts.                                                                                                    |
| 2026-01-24 | Stack-based architecture           | Skills stored in `.claude-collective/stacks/` (project-local), single plugin at `.claude/plugins/claude-collective/` (project-local). `cc switch` for instant switching.                                                                      |
| 2026-01-23 | Architecture finalized             | Marketplace is single source of truth; CLI is thin (no bundled content); `cc init` produces complete plugin with skills + agents                                                                                                              |
| 2026-01-22 | Inline agent invocation via CLI    | `--agents` JSON flag verified working; no file writes needed                                                                                                                                                                                  |
| 2026-01-21 | Integer versioning                 | Zero friction; semver overkill for markdown skills                                                                                                                                                                                            |

---

## Quick Reference

### Compile Plugins

```bash
# Compile all skills to plugins
bun src/cli/index.ts compile-plugins

# Compile specific stack to plugin
bun src/cli/index.ts compile-stack -s fullstack-react

# Generate marketplace
bun src/cli/index.ts generate-marketplace

# Validate plugins
bun src/cli/index.ts validate dist/plugins --all
```

### Test Inline Agent Invocation

See `CLI-AGENT-INVOCATION-RESEARCH.md` for full details.

```bash
# VERIFIED WORKING - Basic test via CLI
bun src/cli/index.ts test-agent

# VERIFIED WORKING - Direct invocation
claude --agents '{"test": {"description": "Test agent", "prompt": "You are a test agent."}}' --agent test -p "Hello"
```

---

## Exit Codes

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success                 |
| 1    | General error           |
| 2    | Invalid arguments       |
| 3    | Network/auth error      |
| 4    | User cancelled (Ctrl+C) |
