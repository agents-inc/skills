# Outstanding Tasks

> **Generated**: 2026-01-21
> **Updated**: 2026-01-26
> **Completed Tasks**: See [TODO-COMPLETED.md](./TODO-COMPLETED.md)
>
> **Architecture Status**: Simplified plugin architecture complete. See [plugins/INDEX.md](./plugins/INDEX.md) for documentation.

---

## Related Files

| File                                | Purpose                                                     | Location                        |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `DUAL-REPO-ARCHITECTURE.md`         | **Next Refactor** - Public marketplace + private work repo  | `.claude/research/findings/v2/` |
| `SIMPLIFIED-PLUGIN-MIGRATION.md`    | **Complete** - 8-phase migration tracking                   | `.claude/tasks/`                |
| `SKILLS-MATRIX-VERIFICATION.md`     | **Complete** - 18-agent verification of skill relationships | `.claude/research/`             |
| `SIMPLIFIED-PLUGIN-ARCHITECTURE.md` | **Complete** - One plugin per project architecture          | `.claude/research/findings/v2/` |
| `CLI-AGENT-INVOCATION-RESEARCH.md`  | **Key** - Inline `--agents` JSON invocation                 | `src/docs/cli/`                 |

---

## Totals

| Status              | Count       |
| ------------------- | ----------- |
| **Do Now**          | 3           |
| **After Migration** | 8 (3 done)  |
| **Backlog**         | 21 (3 done) |

---

## 1. Do Now (Before CLI Migration)

> Complete these while skills and CLI live in same repo.

| Priority | Task                                  | Description                                                                                                                                                                                                                            |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH     | A7 Inline agent test                  | Test `--agents` JSON flag with model/tools (CLI-AGENT-INVOCATION.md)                                                                                                                                                                   |
| HIGH     | Manual skill testing                  | Manually test all 76 skills and 11 stacks for correctness                                                                                                                                                                              |
| MEDIUM   | Re-add schema to skills               | Post-migration: inject schema path once CLI repo bundles the schema                                                                                                                                                                    |
| MEDIUM   | Update stacks with methodology skills | Uncomment methodology skills in all stack configs - skills exist but are commented out with outdated "don't exist yet" note. Use directory refs: `methodology/universal`, `methodology/implementation`, `methodology/extended-session` |

---

## 2. After CLI Migration (Post Repo Split)

> These require the CLI to fetch from remote marketplace.

### Repo Split Milestone

| Priority     | Task                   | Description                                                                    |
| ------------ | ---------------------- | ------------------------------------------------------------------------------ |
| ~~CRITICAL~~ | ~~B1 CLI Repository~~  | **DONE** (2026-01-29) - CLI at `/home/vince/dev/cli`, all phases implemented   |
| CRITICAL     | B2 Rename Repository   | Rename `claude-subagents` -> `claude-collective-skills`                        |
| ~~CRITICAL~~ | ~~B3 Remote fetching~~ | **DONE** (2026-01-29) - giget integration in source-fetcher.ts, tested locally |

### Post-Split Features

| Priority | Task                                | Description                                                                                                  |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| HIGH     | Add marketplace for this repository | Add marketplace                                                                                              |
| HIGH     | C1 Schema Distribution              | GitHub raw URLs, SchemaStore PR                                                                              |
| ~~HIGH~~ | ~~C8 Agent plugins~~                | **REMOVED** - Agents are compiled output, not marketplace plugins. Only Skills and Stacks are distributable. |
| ~~HIGH~~ | ~~C9 `cc add <agent>`~~             | **REMOVED** - Agents are compiled from templates + skills, not installed individually.                       |
| ~~HIGH~~ | ~~C10 Essential vs optional~~       | **REMOVED** - All agents compiled locally from bundled templates.                                            |
| HIGH     | C11 Hooks in frontmatter            | Support PreToolUse/PostToolUse/Stop hooks in agent.yaml                                                      |
| MEDIUM   | C6 `cc doctor`                      | Diagnose connectivity/auth issues                                                                            |
| MEDIUM   | C7 `cc eject`                       | Local export or GitHub fork for full independence                                                            |

---

## 3. Backlog

> Deferred items. Nice to have but not blocking.

### Skills & Content

| Priority | Task                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HIGH     | Skill optimization suite   | **Combined effort:** (1) Try existing tools: [johnlindquist gist](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a), [ClaudeSkills-Optimizer-GEFA](https://github.com/rartzi/ClaudeSkills-Optimizer-GEFA), [prompt-optimization-analyzer](https://github.com/Exploration-labs/Nates-Substack-Skills/tree/main/prompt-optimization-analyzer). (2) Create Rolf Wiggins-inspired prompt compaction skill. (3) Build meta-skills for diagnosing skill issues, improving prompts to align with Claude expectations, and validating skill quality. |
| MEDIUM   | Skill granularity refactor | Make skills more granular - split into `examples/` and `patterns/` folders instead of just examples. will do this manually                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LOW      | New skills (Critical)      | nx, docker, kubernetes, vite, svelte, supabase, AI. will do this manually later SDKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LOW      | New skills (High)          | astro, firebase, clerk, cloudflare, terraform, etc.. will do this manually later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LOW      | Roadmap Phase 3-5          | background-jobs, caching, i18n, payments, etc.. will do this manually later                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### CLI & Infrastructure

| Priority | Task                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~HIGH~~ | ~~Dual-repo architecture~~  | **DONE** (2026-01-29) - Phases 1-6 complete. See `DUAL-REPO-ARCHITECTURE.md` and knowledge base.                                                                                                                                                                                                                                                                                                                                              |
| ~~HIGH~~ | ~~Bundle templates in CLI~~ | **DONE** (2026-01-29) - Templates bundled at `src/agents/_templates/agent.liquid` in CLI repo.                                                                                                                                                                                                                                                                                                                                                |
| ~~HIGH~~ | ~~`cc eject` command~~      | **DONE** (2026-01-29) - `cc eject templates`, `cc eject skills`, `cc eject config`, `cc eject all` implemented.                                                                                                                                                                                                                                                                                                                               |
| MEDIUM   | Advanced wizard UI          | Migrate `cc init` wizard from @clack to Ink (or alternative). Enables: horizontal tabs, arrow key navigation, single-view skill selection with expand/collapse categories, horizontal dividers. See `CLI-FRAMEWORK-RESEARCH.md`. Options: **Ink** (React for CLI, recommended), **blessed/neo-blessed** (widget-based TUI), **terminal-kit** (low-level + widgets), **Textual** (Python, would require rewrite).. will do this manually later |
| MEDIUM   | Output styles research      | Investigate Claude Code output styles for sub-agents; could set concise mode for agent cross-communication                                                                                                                                                                                                                                                                                                                                    |
| LOW      | Template refactoring        | Split agent.liquid into partials (partials bundled in CLI repo alongside templates, not in public skills repo)                                                                                                                                                                                                                                                                                                                                |
| LOW      | Marketplace foundation      | Stack Marketplace Phase 1-2                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LOW      | Community submission        | `cc submit` flow                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LOW      | External skill sources      | `cc add skill-id --source github:user/repo` fetches external skills to local                                                                                                                                                                                                                                                                                                                                                                  |
| LOW      | Claude simplifier hook      | Add hook that simplifies/improves Claude's responses or workflow                                                                                                                                                                                                                                                                                                                                                                              |
| LOW      | CLI branding                | ASCII art logo + animated mascot on startup                                                                                                                                                                                                                                                                                                                                                                                                   |
| LOW      | Agent partials refactor     | Review agent partials bundled in CLI (workflow.md, intro.md, examples.md) - improve naming, modularity. Note: Partials live in CLI repo, not public skills repo                                                                                                                                                                                                                                                                               |
| LOW      | Configurable thinking       | CLI flags `--thinking <tokens>` and `--agent-thinking <agent>:<tokens>` to override default max thinking                                                                                                                                                                                                                                                                                                                                      |
| LOW      | Metadata auto-generation    | Generate metadata.yaml from SKILL.md frontmatter for custom skills (no schema comment, relaxed validation)                                                                                                                                                                                                                                                                                                                                    |
| LOW      | Project agent-hooks         | `.claude/agent-hooks.yaml` maps agents to package.json scripts; merged at compile time. See `AGENT-HOOKS-PORTABILITY.md`                                                                                                                                                                                                                                                                                                                      |

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

| Date       | Decision                             | Rationale                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-26 | **Custom skills: no schema comment** | Official skills include `yaml-language-server` schema comment for strict validation. Custom/local skills omit it - no IDE validation, users free to use any category values. Simpler than maintaining multiple schemas.                       |
| 2026-01-26 | **Expert Mode in wizard**            | Toggle on approach screen disables conflict checking, allows combining any skills (e.g., React + Vue). For advanced users who know what they're doing.                                                                                        |
| 2026-01-25 | **Simplified plugin architecture**   | One plugin per project. "Stacks" are now "templates" (starting points). No more `cc switch`. Migration complete - see `.claude/tasks/SIMPLIFIED-PLUGIN-MIGRATION.md`.                                                                         |
| 2026-01-25 | Version deprecated in metadata       | `version` field removed from metadata.yaml and types. Version lives only in `plugin.json`. `content_hash` is primary identifier for change detection.                                                                                         |
| 2026-01-25 | Summoners as local agents            | `cc create skill/agent` commands won't do. Users install skill-summoner/agent-summoner as optional agents (`cc add`), run locally. Avoids network dependency, works offline, consistent with other agents. Staleness caught by `cc validate`. |
| 2026-01-25 | Thinking budget: use defaults        | Claude Code defaults to max thinking (31,999 tokens) since Jan 2026. Ultrathink keywords deprecated. No need to configure per-agent - defer CLI configurability to later.                                                                     |
| 2026-01-25 | Core principles in template          | Embedded directly in agent.liquid (not a skill). Methodology content available via skills. External skill sources deferred - would need `cc add --source` to fetch to local.                                                                  |
| 2026-01-28 | Agents are NOT plugins               | **Decision**: Agents are compiled OUTPUT, not marketplace artifacts. Only Skills and Stacks are distributable plugins. Agents are generated locally from bundled templates + user-selected skills.                                            |
| 2026-01-24 | Plugin-based versioning              | Skills and stacks are plugins. Version goes in `plugin.json`, NOT `metadata.yaml`. Agents are not versioned separately (compiled output).                                                                                                     |
| 2026-01-23 | Architecture finalized               | Marketplace is single source of truth; CLI is thin (no bundled content); `cc init` produces complete plugin with skills + agents                                                                                                              |
| 2026-01-22 | Inline agent invocation via CLI      | `--agents` JSON flag verified working; no file writes needed                                                                                                                                                                                  |
| 2026-01-21 | Integer versioning                   | Zero friction; semver overkill for markdown skills                                                                                                                                                                                            |

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
