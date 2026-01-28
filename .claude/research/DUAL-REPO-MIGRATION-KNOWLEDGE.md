# Dual Repository Migration Knowledge Document

> **Created**: 2026-01-28
> **Updated**: 2026-01-29
> **Purpose**: Track implementation progress for dual-repo architecture migration
> **Source of Truth**: `.claude/research/findings/v2/DUAL-REPO-ARCHITECTURE.md`

---

## Executive Summary

This document tracks the migration from a single monorepo (`claude-subagents`) to a dual-repo architecture:

1. **CLI Repo** (`/home/vince/dev/cli`) - The CLI tool for managing skills
2. **Skills Repo** (`/home/vince/dev/claude-subagents`) - Skills, stacks, agents, and content (to become marketplace)

---

## Current Implementation Status

### Phases Completed

| Phase   | Description                | Status       | Verified                         |
| ------- | -------------------------- | ------------ | -------------------------------- |
| Phase 1 | Bundle templates in CLI    | **COMPLETE** | Tests pass                       |
| Phase 2 | Wizard mode selection      | **COMPLETE** | Tests pass                       |
| Phase 3 | Plugin Mode implementation | **COMPLETE** | Simulated (marketplace not live) |
| Phase 4 | Local Mode implementation  | **COMPLETE** | Tests pass                       |
| Phase 5 | Unified compilation        | **COMPLETE** | Tests pass                       |
| Phase 6 | Eject command              | **COMPLETE** | Tests pass                       |

**All 370 tests pass in CLI repo.**

### Features Implemented

1. **Mode Selection in Wizard**
   - Plugin Mode: Simulates `claude plugin install skill-X@marketplace`
   - Local Mode: Copies skills to `.claude/skills/` with flattened structure
   - Toggle appears in approach screen (like expert mode)

2. **Template Bundling**
   - Templates bundled at `src/agents/_templates/agent.liquid`
   - Liquid engine checks `.claude/templates/` first (local override)
   - Falls back to bundled templates

3. **Local Mode (Phase 4)**
   - `copySkillsToLocalFlattened()` in `skill-copier.ts`
   - Skills copied to `.claude/skills/{skill-name}/`
   - `forked_from` metadata injected for provenance
   - Config saved to `.claude/config.yaml`

4. **Unified Compilation (Phase 5)**
   - `cc compile` discovers from both sources:
     - `.claude/plugins/*/skills/` (plugin skills)
     - `.claude/skills/` (local skills)
   - Local skills take precedence (allows overrides)
   - Shows skill count breakdown in output

5. **Eject Command (Phase 6)**
   - `cc eject templates` - Copies `agent.liquid` to `.claude/templates/`
   - `cc eject skills` - Creates example skill in `.claude/skill-templates/`
   - `cc eject config` - Creates default `.claude/config.yaml`
   - `cc eject all` - All of the above
   - `--force` flag to overwrite existing files

---

## Remaining Work (Not from DUAL-REPO-ARCHITECTURE.md Phases)

Per DUAL-REPO-ARCHITECTURE.md, Phases 1-6 are complete. The following items are tracked elsewhere:

### From TODO.md - "Do Now" Priority

| Task                                  | Description                                | Notes                       |
| ------------------------------------- | ------------------------------------------ | --------------------------- |
| A7 Inline agent test                  | Test `--agents` JSON flag with model/tools | See CLI-AGENT-INVOCATION.md |
| Manual skill testing                  | Test all 76 skills and 11 stacks           | Not automated               |
| Re-add schema to skills               | Inject schema path once CLI bundles schema | Post-migration              |
| Update stacks with methodology skills | Uncomment methodology skills in configs    | Skills exist but commented  |

### From TODO.md - "After CLI Migration" Priority

| Task                 | Description                                             |
| -------------------- | ------------------------------------------------------- |
| B1 CLI Repository    | Already done - CLI at `/home/vince/dev/cli`             |
| B2 Rename Repository | Rename `claude-subagents` -> `claude-collective-skills` |
| B3 Remote fetching   | CLI already has giget; needs testing with actual GitHub |

### From TODO.md - Backlog (HIGH Priority)

| Task                    | Description                            |
| ----------------------- | -------------------------------------- |
| Dual-repo architecture  | Support local-only mode for work repos |
| Bundle templates in CLI | **DONE** - already implemented         |
| `cc eject` command      | **DONE** - already implemented         |

---

## Architecture Summary

### CLI Repo (`/home/vince/dev/cli`)

```
cli/
├── config/
│   └── skills-matrix.yaml     # Skill definitions and relationships
├── src/
│   ├── agents/
│   │   └── _templates/
│   │       └── agent.liquid   # Bundled agent template
│   ├── cli/                   # CLI implementation (65+ files)
│   │   ├── commands/          # init, compile, eject, etc.
│   │   └── lib/               # Core logic
│   ├── schemas/               # JSON validation schemas
│   └── types.ts               # CLI types
├── package.json
├── tsup.config.ts
└── vitest.config.ts
```

### Skills Repo (`/home/vince/dev/claude-subagents`)

```
claude-subagents/
├── src/
│   ├── agents/                # Agent category folders
│   ├── skills/                # 89 skills in category folders
│   ├── stacks/                # 14 stack configurations
│   ├── docs/                  # Documentation
│   └── commands/              # CLI command docs (reference)
├── .claude/                   # Research, decisions, progress
├── CLAUDE.md
└── README.md
```

---

## Key Files Reference

### CLI Repo - Implementation Files

| File                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `src/cli/commands/init.ts`     | Main initialization - handles Plugin/Local mode       |
| `src/cli/commands/compile.ts`  | Unified compilation from plugins + local              |
| `src/cli/commands/eject.ts`    | Eject templates/skills/config                         |
| `src/cli/lib/skill-copier.ts`  | `copySkillsToLocalFlattened()`                        |
| `src/cli/lib/compiler.ts`      | `createLiquidEngine()` with local template resolution |
| `src/cli/lib/wizard.ts`        | Wizard with mode selection                            |
| `src/cli/lib/source-loader.ts` | Remote fetching via giget                             |
| `src/cli/consts.ts`            | Constants including LOCAL_SKILLS_PATH                 |

### Test Status

| Test File                    | Tests         | Status       |
| ---------------------------- | ------------- | ------------ |
| `init.test.ts`               | 16            | Pass         |
| `compile.ts`                 | (integration) | Pass         |
| `eject.test.ts`              | 9             | Pass         |
| `skill-copier.test.ts`       | 18            | Pass         |
| `source-loader.test.ts`      | 15            | Pass         |
| `local-skill-loader.test.ts` | 12            | Pass         |
| **Total**                    | **370**       | **All Pass** |

---

## Directory Structure After `cc init` (Local Mode)

```
project/
├── .claude/
│   ├── skills/                 # Copied skills (flattened)
│   │   ├── react/
│   │   │   ├── SKILL.md
│   │   │   └── metadata.yaml   # Has forked_from provenance
│   │   ├── zustand/
│   │   └── ...
│   ├── agents/                 # Compiled agents
│   │   ├── frontend-developer.md
│   │   ├── backend-developer.md
│   │   └── ...
│   ├── templates/              # Only if user runs `cc eject templates`
│   │   └── agent.liquid
│   └── config.yaml             # Agent-skill mappings
└── ...
```

---

## Questions / Blockers

### Resolved

1. **Q: Where do templates live?**
   A: Bundled in CLI (`src/agents/_templates/`), ejectable to `.claude/templates/`

2. **Q: How does local mode work?**
   A: Skills copied to `.claude/skills/`, agents to `.claude/agents/`, config to `.claude/config.yaml`

3. **Q: Does compile discover both sources?**
   A: Yes - plugins AND local skills, with local taking precedence

### Open Questions (From Architecture Doc)

1. **Remote skill references**: Exact syntax for `github:user/repo/path` references
   - Proposed: `remote: github:user/repo#version` in config.yaml

2. **Cache location**: Where to cache remotely fetched skills
   - Implemented: `~/.cache/claude-collective/sources/`

3. **Offline compilation**: How to handle when remote skills cached but user offline
   - Proposed: Use cache, warn if stale

---

## Next Steps

1. ~~**Create GitHub repo for skills**~~ - **DONE** - This repo IS the marketplace (renamed to `claude-collective-skills`)
2. ~~**Rename skills repo**~~ - **DONE** (2026-01-29) - Renamed via `gh repo rename claude-collective-skills`
3. **Manual skill testing** - Verify all 76 skills work correctly
4. ~~**Update methodology skills**~~ - **DONE** - Added to 4 stacks

## Remote Fetching Status

The CLI is ready for remote fetching:

- **giget integration**: `source-fetcher.ts` uses `downloadTemplate()` from giget
- **Caching**: Remote sources cached to `~/.cache/claude-collective/sources/`
- **Error handling**: Good messages for 404, 401, 403, network errors
- **Local fallback**: Works perfectly with local paths
- **Tests**: 10 source-fetcher tests pass (mostly local paths)

**Status**: The repository is now `github:vincentbollaert/claude-collective-skills`. The CLI default source should be updated to match.

**To test remote fetching**:

```bash
cd /home/vince/dev/cli
bun run src/cli/index.ts init --source github:vincentbollaert/claude-collective-skills
```

---

## Progress Log

### 2026-01-29 - All Implementation Complete

**Final Status:**

- All 6 phases from DUAL-REPO-ARCHITECTURE.md implemented and verified
- All 370 tests pass in CLI repo
- Methodology skills added to 4 stacks
- dist/ removed from git tracking
- A7 inline agent test documented

**Remaining (Manual Operations):**

- Create GitHub repo `claude-collective/skills`
- Rename repo `claude-subagents` → `claude-collective-skills`
- End-to-end flow testing after marketplace creation

### 2026-01-29 - Phase 6 Complete, Full Review

- Verified all 6 phases from DUAL-REPO-ARCHITECTURE.md are implemented
- All 370 tests pass in CLI repo
- Eject command fully functional with templates, skills, config support
- Local template resolution working (compiler.ts lines 287-308)
- Created comprehensive knowledge base update

### 2026-01-28 - Phases 1-5 Complete

- Phase 1: Bundle templates in CLI
- Phase 2: Wizard mode selection (Plugin vs Local)
- Phase 3: Plugin Mode implementation (simulated)
- Phase 4: Local Mode implementation
- Phase 5: Unified compilation (`cc compile`)

---

**End of Document**
