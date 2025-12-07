# Profile-Based Agent Compilation System - Migration Progress

> Tracking the migration from `@include()` preprocessor to TypeScript + LiquidJS hybrid system.

---

## Current Status

**Phase:** 1 - Core Agent Migration (COMPLETE)
**Started:** 2024-12-07
**Completed:** 2025-12-07
**Status:** All 12 core agents migrated and compiling successfully

### Phase 0 Complete
POC with frontend-developer validated the architecture. Fixed config to make prompt placement explicit with `core_prompt_sets` and `ending_prompt_sets`.

### Phase 1 Complete (Session 5)
All agents migrated to the new directory structure AND added to config.yaml:
- ✅ frontend-developer - Full migration with skills (3852 lines compiled)
- ✅ backend-developer - Full migration with skills (3058 lines compiled)
- ✅ frontend-reviewer - Full migration with skills (3435 lines compiled)
- ✅ backend-reviewer - Full migration with skills (1084 lines compiled)
- ✅ pm - Full migration with skills (1133 lines compiled)
- ✅ tester - Full migration with skills (3136 lines compiled)
- ✅ documentor - Full migration with skills (1362 lines compiled)
- ✅ pattern-scout - Full migration (1960 lines compiled)
- ✅ pattern-critique - Full migration (1617 lines compiled)
- ✅ skill-summoner - Full migration (2719 lines compiled)
- ✅ agent-summoner - Full migration (2507 lines compiled)
- ✅ agent-migrator - Utility agent for migrations (1629 lines compiled)

**Total:** 12 agents, 27,492 lines compiled, 14 skills

**New agent created:** `agent-migrator` - A utility agent that automates the migration of agents from the old `.src.md` format to the new modular format.

---

## Completed Tasks

- [x] Read and analyze PROFILE_SYSTEM_SPEC.md
- [x] Explore current codebase structure
- [x] Understand existing `compile.mjs` preprocessor
- [x] Identify files to migrate for frontend-developer
- [x] Install dependencies (liquidjs, yaml)
- [x] Create `types.ts` (TypeScript types)
- [x] Create `templates/agent.liquid` (main template)
- [x] Create `compile.ts` (Bun + LiquidJS)
- [x] Rename `core prompts/` to `core-prompts/`
- [x] Create `profiles/home/` directory structure
- [x] Create `profiles/home/config.yaml` (frontend-developer only)
- [x] Create `profiles/home/CLAUDE.md`
- [x] Copy skills to `profiles/home/skills/frontend/`
- [x] Create `agents/frontend-developer/intro.md`
- [x] Create `agents/frontend-developer/workflow.md`
- [x] Create `agents/frontend-developer/examples.md`
- [x] Create `agents/frontend-developer/critical-reminders.md`
- [x] Test compilation - SUCCESS (4329 lines output)
- [x] Update package.json with new compile scripts

---

## Phase 1 Complete

All core agents have been migrated to the new modular structure.

---

## Pending Tasks

### Phase 0: Proof of Concept ✅ COMPLETE

### Phase 1: Core Agent Migration ✅ COMPLETE

**All agents migrated:**
- [x] frontend-developer full migration
- [x] backend-developer full migration
- [x] frontend-reviewer agent files
- [x] backend-reviewer agent files
- [x] pm agent files
- [x] tester agent files
- [x] documentor agent files
- [x] pattern-scout agent files (large extraction)
- [x] pattern-critique agent files (large extraction)
- [x] skill-summoner agent files
- [x] agent-summoner agent files
- [x] agent-migrator NEW agent created
- [x] Added scout/summoner core_prompt_sets
- [x] Added scout/summoner ending_prompt_sets
- [x] Update config.yaml with all agents
- [x] Test full compilation (7 agents compile successfully)
- [x] Update this doc to Phase 1 complete

### Phase 2-6: Full Migration

See PROFILE_SYSTEM_SPEC.md for full migration steps.

**Next phases after Phase 1:**
1. Create work profile with Tailwind/MobX skills
2. Add remaining profiles as needed
3. Clean up old `.src.md` files after verification

---

## Technical Decisions

### 1. Keeping Compatibility

During POC, we'll keep the old system working alongside the new one:
- Old: `.claude-src/agents/*.src.md` + `compile.mjs`
- New: `.claude-src/agents/*/` + `profiles/` + `compile.ts`

### 2. File Extraction Strategy

From `frontend-developer.src.md`, extract:

| Source Section | Target File |
|----------------|-------------|
| Lines 8-14 (intro paragraph) | `intro.md` |
| Lines 125-194 (Development Workflow) | `workflow.md` |
| Lines 418-508 (Example Implementation) | `examples.md` |
| Lines 587-594 (Emphatic Repetition) | `critical-reminders.md` |

### 3. Prompt Architecture (IMPORTANT)

The config explicitly declares TWO types of prompts with different placement:

**core_prompt_sets** - Prompts at BEGINNING (before workflow):
```yaml
developer:
  - core-principles
  - investigation-requirement
  - write-verification
  - anti-over-engineering
```

**ending_prompt_sets** - Prompts at END (after skills/examples):
```yaml
developer:
  - context-management
  - improvement-protocol
```

**Agent config references both:**
```yaml
core_prompts: developer      # References core_prompt_sets
ending_prompts: developer    # References ending_prompt_sets
output_format: output-formats-developer
```

This makes placement explicit - NO hardcoded prompts in template.

### 4. Skills Mapping

| Precompiled | Dynamic |
|-------------|---------|
| `frontend/react` | `frontend/api` |
| `frontend/styling` | `frontend/client-state` |
| | `frontend/accessibility` |
| | `frontend/performance` |

---

## File Changes Log

### Created (Phase 0 - POC)
- `.claude-src/docs/PROFILE_MIGRATION_PROGRESS.md` (this file)
- `.claude-src/types.ts` - TypeScript types
- `.claude-src/compile.ts` - New Bun + LiquidJS compiler
- `.claude-src/templates/agent.liquid` - Main agent template
- `.claude-src/profiles/home/config.yaml` - Home profile config
- `.claude-src/profiles/home/CLAUDE.md` - Profile-specific project instructions
- `.claude-src/profiles/home/skills/frontend/*.md` - Copied frontend skills
- `.claude-src/agents/frontend-developer/intro.md`
- `.claude-src/agents/frontend-developer/workflow.md`
- `.claude-src/agents/frontend-developer/examples.md`
- `.claude-src/agents/frontend-developer/critical-reminders.md`

### Created (Phase 1 - Session 3)
- `.claude-src/agents/backend-developer/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/agents/frontend-reviewer/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/agents/backend-reviewer/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/agents/pm/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/agents/tester/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/agents/documentor/` - Full agent directory
  - intro.md, workflow.md, examples.md, critical-reminders.md
- `.claude-src/profiles/home/skills/backend/*.md` - Copied backend skills
- `.claude-src/profiles/home/skills/security/security.md` - Copied security skill

### Created (Phase 1 - Session 4)
- `.claude-src/agents/agent-migrator/` - NEW utility agent for migration automation
  - intro.md (6 lines), workflow.md (476 lines), examples.md (237 lines), critical-reminders.md (16 lines)
- `.claude-src/agents/pattern-scout/` - Large agent migrated
  - intro.md (5 lines), workflow.md (965 lines), examples.md (162 lines), critical-reminders.md (53 lines)
- `.claude-src/agents/pattern-critique/` - Large agent migrated
  - intro.md (5 lines), workflow.md (825 lines), examples.md (93 lines), critical-reminders.md (13 lines)
- `.claude-src/agents/skill-summoner/` - Full migration
  - intro.md (13 lines), workflow.md (1658 lines), examples.md (270 lines), critical-reminders.md (11 lines)
- `.claude-src/agents/agent-summoner/` - Full migration
  - intro.md (3 lines), workflow.md (1554 lines), examples.md (160 lines), critical-reminders.md (23 lines)

### Updated (Phase 1 - Session 5)
- `.claude-src/profiles/home/config.yaml` - Added 5 missing agent configurations:
  - frontend-reviewer (with precompiled: react, styling; dynamic: accessibility, performance, client-state)
  - backend-reviewer (with dynamic: api, database, ci-cd, security)
  - pm (with dynamic: all frontend/backend/security skills for spec scoping)
  - tester (with precompiled: frontend-testing, backend-testing, mocking; dynamic: accessibility, performance)
  - documentor (with dynamic: react, styling, api, client-state, backend-api, database, security)

### Modified
- `package.json` - Added new compile scripts
- `.claude-src/core prompts/` - Renamed to `.claude-src/core-prompts/`
- `.claude-src/types.ts` - Added `ending_prompts` to AgentConfig, `ending_prompt_sets` to ProfileConfig
- `.claude-src/compile.ts` - Read and validate ending_prompt_sets, pass to template
- `.claude-src/templates/agent.liquid` - Use endingPromptsContent instead of hardcoded prompts
- `.claude-src/profiles/home/config.yaml` - Multiple updates:
  - Added ending_prompt_sets section (Session 1)
  - Added scout/summoner core_prompt_sets (Session 4)
  - Added scout/summoner ending_prompt_sets (Session 4)
  - Added 7 new agent configurations (Session 4)
  - Added 5 missing agent configurations (Session 5)

### Deleted
- (none yet - old system still works)

---

## Notes

- Using Bun as runtime (per spec)
- LiquidJS for template rendering
- YAML for config parsing
- TypeScript for type safety and file composition
- Old `compile.mjs` still works alongside new `compile.ts`
- Skills are copied to profiles (not symlinked) for independence

---

## Commands

```bash
# Compile with new system (home profile)
bun run compile:home

# Compile with old system (still works)
npm run build:agents

# Watch mode for development
bun run compile:watch
```
