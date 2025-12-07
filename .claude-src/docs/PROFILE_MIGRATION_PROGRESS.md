# Profile-Based Agent Compilation System - Migration Progress

> Tracking the migration from `@include()` preprocessor to TypeScript + LiquidJS hybrid system.

---

## Current Status

**Phase:** 0 - Proof of Concept (frontend-developer only)
**Started:** 2024-12-07
**Status:** COMPLETE

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

## In Progress

(None - Phase 0 complete!)

---

## Pending Tasks

### Phase 0: Proof of Concept (frontend-developer only)

COMPLETE!

### Phase 1-6: Full Migration (After POC)

See PROFILE_SYSTEM_SPEC.md for full migration steps.

**Recommended next steps:**
1. Create an agent to automate migration of remaining agents
2. Migrate backend-developer agent (similar to frontend-developer)
3. Migrate reviewer agents (frontend-reviewer, backend-reviewer)
4. Migrate utility agents (pm, tester, documentor, etc.)
5. Create work profile with Tailwind/MobX skills
6. Clean up old `.src.md` files after verification

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

### 3. Core Prompts Mapping

For frontend-developer, use `developer` core prompt set:
- `core-principles`
- `investigation-requirement`
- `write-verification`
- `anti-over-engineering`
- `context-management`
- `improvement-protocol`

### 4. Skills Mapping

| Precompiled | Dynamic |
|-------------|---------|
| `frontend/react` | `frontend/api` |
| `frontend/styling` | `frontend/client-state` |
| | `frontend/accessibility` |
| | `frontend/performance` |

---

## File Changes Log

### Created
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

### Modified
- `package.json` - Added new compile scripts
- `.claude-src/core prompts/` - Renamed to `.claude-src/core-prompts/`

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
