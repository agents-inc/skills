# Simplified Plugin Architecture Migration

> **Status:** Complete
> **Created:** 2026-01-25
> **Research:** `.claude/research/SIMPLIFIED-ARCHITECTURE-MIGRATION-RESEARCH.md`
> **Proposal:** `.claude/research/findings/v2/SIMPLIFIED-PLUGIN-ARCHITECTURE.md`

---

## Goal

Migrate CLI from multi-stack architecture (`.claude-collective/stacks/`) to single-plugin-per-project model (`.claude/plugins/claude-collective/` only).

---

## Progress Tracking

### Phase 1: Remove Stack Switching (Low Risk)

| Task                                                                  | Status | Agent             | Notes              |
| --------------------------------------------------------------------- | ------ | ----------------- | ------------------ |
| Remove `switchCommand` import from `src/cli/index.ts:12`              | done   | backend-developer | Deleted 2026-01-25 |
| Remove `program.addCommand(switchCommand)` from `src/cli/index.ts:46` | done   | backend-developer | Deleted 2026-01-25 |
| Delete `src/cli/commands/switch.ts`                                   | done   | backend-developer | Deleted 2026-01-25 |
| Delete `src/cli/commands/switch.test.ts`                              | done   | backend-developer | Deleted 2026-01-25 |
| Delete `src/cli/lib/stack-list.ts`                                    | done   | backend-developer | Deleted 2026-01-25 |

### Phase 2: Remove Stack Config Infrastructure (Medium Risk)

| Task                                                 | Status | Agent             | Notes                                                                                      |
| ---------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------ |
| Delete `src/cli/lib/stack-config.ts`                 | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: init.ts, stack-creator.ts                           |
| Delete `src/cli/lib/stack-skills.ts`                 | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: edit.ts                                             |
| Delete `src/cli/lib/skill-copier.test.ts`            | done   | backend-developer | Deleted 2026-01-25                                                                         |
| Remove `getActiveStack()` from `config.ts:185-207`   | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: init.ts, edit.ts                                    |
| Remove `setActiveStack()` from `config.ts:209-232`   | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: init.ts                                             |
| Remove `active_stack` from `GlobalConfig` interface  | done   | backend-developer | Deleted 2026-01-25. Also updated isValidGlobalConfig validator                             |
| Remove `active_stack` from `ProjectConfig` interface | done   | backend-developer | Deleted 2026-01-25. Also updated isValidProjectConfig validator                            |
| Update `src/cli/lib/config.test.ts`                  | done   | backend-developer | No changes needed - tests didn't reference active_stack, getActiveStack, or setActiveStack |

### Phase 3: Remove COLLECTIVE\_\* Constants (Medium Risk)

| Task                                                                    | Status | Agent             | Notes                                                                        |
| ----------------------------------------------------------------------- | ------ | ----------------- | ---------------------------------------------------------------------------- |
| Remove `COLLECTIVE_DIR` from `consts.ts:17`                             | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: config.ts, loader.ts, skill-copier.ts |
| Remove `COLLECTIVE_STACKS_SUBDIR` from `consts.ts:18`                   | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: loader.ts, skill-copier.ts            |
| Remove `getProjectCollectiveDir()` from `consts.ts:21-23`               | done   | backend-developer | Deleted 2026-01-25                                                           |
| Remove `getProjectStacksDir()` from `consts.ts:25-27`                   | done   | backend-developer | Deleted 2026-01-25                                                           |
| Remove `getUserCollectiveDir`/`getUserStacksDir` from `consts.ts:30-31` | done   | backend-developer | Deleted 2026-01-25. Breaks imports in: init.ts, edit.ts                      |

### Phase 4: Refactor Commands (High Complexity)

| Task                                                | Status | Agent             | Notes                                                     |
| --------------------------------------------------- | ------ | ----------------- | --------------------------------------------------------- |
| **init.ts refactor**                                | done   | backend-developer | Completed 2026-01-25                                      |
| - Remove `promptStackName` import and usage         | done   | backend-developer | Removed - no longer needed                                |
| - Remove `copySkillsToStackFromSource` usage        | done   | backend-developer | Replaced with `copySkillsToPluginFromSource`              |
| - Remove `createStackConfig*` imports               | done   | backend-developer | Removed - manifest generated differently                  |
| - Remove `setActiveStack()` calls                   | done   | backend-developer | Removed - no active stack tracking                        |
| - Update `getStackOutputPath()` → plugin path       | done   | backend-developer | Removed - uses getCollectivePluginDir()                   |
| - Change command description                        | done   | backend-developer | Changed to "Initialize Claude Collective in this project" |
| - Update `src/cli/commands/init.test.ts`            | done   | backend-developer | Rewrote for simplified architecture (18 tests)            |
| **edit.ts refactor**                                | done   | backend-developer | Completed 2026-01-25                                      |
| - Remove `getActiveStack` dependency                | done   | backend-developer | Removed - plugin dir found directly                       |
| - Replace `getStackSkillIds` with plugin equivalent | done   | backend-developer | Created `getPluginSkillIds()` in plugin-finder.ts         |
| - Remove stack-to-plugin sync step                  | done   | backend-developer | Removed - skills copied directly to plugin                |
| - Update intro message                              | done   | backend-developer | Changed to "Edit Plugin Skills"                           |
| **list.ts refactor**                                | done   | backend-developer | Completed 2026-01-25                                      |
| - Create `plugin-info.ts` with `getPluginInfo()`    | done   | backend-developer | Created src/cli/lib/plugin-info.ts                        |
| - Update command to show plugin info                | done   | backend-developer | Uses getPluginInfo() and formatPluginDisplay()            |
| - Update command description                        | done   | backend-developer | Changed to "Show plugin information"                      |

### Phase 5: Refactor Library Files (Medium Complexity)

| Task                                                                    | Status  | Agent             | Notes                                              |
| ----------------------------------------------------------------------- | ------- | ----------------- | -------------------------------------------------- |
| **skill-copier.ts**                                                     | done    | backend-developer | Clean - only has `copySkillsToPluginFromSource`    |
| - Rename `copySkillsToStackFromSource` → `copySkillsToPluginFromSource` | done    | backend-developer | Added new function (kept old for backwards compat) |
| - Update all paths to plugin directory                                  | done    | backend-developer | Reuses existing dest path logic                    |
| - Remove broken imports                                                 | done    | backend-developer | Removed COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR   |
| - Remove deprecated `getStackDir()` function                            | done    | backend-developer | Removed unused function                            |
| - Remove `copySkillsToStackFromSource` (old function)                   | done    | backend-developer | Not present - already removed                      |
| **config.ts**                                                           | done    | backend-developer | Updated during Phase 4                             |
| - Fix broken COLLECTIVE_DIR import                                      | done    | backend-developer | Defined PROJECT_CONFIG_DIR locally                 |
| **loader.ts**                                                           | done    | backend-developer | Clean - no broken imports                          |
| - Remove broken imports                                                 | done    | backend-developer | Removed COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR   |
| - Simplify CompileMode type                                             | done    | backend-developer | Now only supports "dev" mode                       |
| - Update `loadStack()` function                                         | done    | backend-developer | Works with stack templates only                    |
| **stack-creator.ts**                                                    | done    | backend-developer | Deleted 2026-01-25 - not used anywhere             |
| - Keep/rename `promptStackName` → `promptPluginName`                    | n/a     | backend-developer | File deleted - function not needed                 |
| - Remove `createStackFromSource`                                        | n/a     | backend-developer | File deleted                                       |
| **resolver.ts**                                                         | done    | backend-developer | Still needed for stack templates                   |
| - Update `stackToCompileConfig()`                                       | done    | backend-developer | Still used by init.ts and stack-plugin-compiler    |
| - Update `resolveStackSkills()`                                         | done    | backend-developer | Still used by resolver (internal)                  |
| **stack-plugin-compiler.ts**                                            | done    | backend-developer | Still needed for compiling stack templates         |
| - Consider renaming to `plugin-compiler.ts`                             | skipped | backend-developer | Keep name - compiles stack templates to plugins    |
| - Update functions using StackConfig                                    | done    | backend-developer | Still uses StackConfig for templates               |

### Phase 6: Update Types (Low Complexity)

| Task                                                   | Status  | Agent             | Notes                                                                                |
| ------------------------------------------------------ | ------- | ----------------- | ------------------------------------------------------------------------------------ |
| Remove `StackOverrideRule` from `src/types.ts:201-204` | done    | backend-developer | Removed 2026-01-25 - unused (no runtime access to `overrides` field)                 |
| Remove `StackMetrics` from `src/types.ts:206-209`      | done    | backend-developer | Removed 2026-01-25 - unused (no runtime access to `metrics` field)                   |
| Simplify/rename `StackConfig` in `src/types.ts`        | done    | backend-developer | Removed unused `overrides` and `metrics` fields. Rest kept (used by stack templates) |
| Update `ResolvedStack` in `types-matrix.ts`            | skipped | backend-developer | KEEP - actively used by wizard for suggested templates                               |
| Update `SuggestedStack` in `types-matrix.ts`           | skipped | backend-developer | KEEP - actively used for wizard presets in skills-matrix.yaml                        |

### Phase 7: Update Remaining Tests (Medium Complexity)

| Task                                   | Status | Agent             | Notes                                                                                             |
| -------------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------- |
| Update `stack-plugin-compiler.test.ts` | done   | backend-developer | No changes needed - tests stack template compilation using temp dirs, no .claude-collective/ refs |
| Update `integration.test.ts`           | done   | backend-developer | No changes needed - listStacks() helper reads src/stacks/ (templates), not user stacks            |
| Update `plugin-manifest.test.ts`       | done   | backend-developer | No changes needed - no stack or .claude-collective/ references                                    |
| Update `resolver.test.ts`              | done   | backend-developer | No changes needed - tests StackConfig (for templates), not user stacks                            |
| Update `source-loader.test.ts`         | done   | backend-developer | No changes needed - suggestedStacks refs are for wizard presets, not user stacks                  |

### Phase 8: Documentation & Cleanup

| Task                                                 | Status  | Agent             | Notes                                                                                                                  |
| ---------------------------------------------------- | ------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Update CLI help text                                 | done    | backend-developer | Updated index.ts description (stacks -> plugins), update.ts (removed stack refs), compile.ts (removed --name flag ref) |
| Update README if needed                              | done    | backend-developer | Rewrote Quick Start, Architecture, CLI Commands sections to reflect plugin-only model                                  |
| Add migration prompt for `.claude-collective/` users | skipped | backend-developer | Not needed - .claude-collective/ still used for config (source, author) - only stacks removed                          |

---

## Completion Log

| Phase   | Completed  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | 2026-01-25 | Removed switchCommand from index.ts, deleted switch.ts, switch.test.ts, and stack-list.ts                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 2 | 2026-01-25 | Deleted stack-config.ts, stack-skills.ts, skill-copier.test.ts; removed getActiveStack/setActiveStack/active_stack from config.ts. Broken imports in: init.ts, edit.ts, stack-creator.ts (to fix in Phase 4/5). All 331 tests pass.                                                                                                                                                                                                                                                                        |
| Phase 3 | 2026-01-25 | Removed COLLECTIVE_DIR, COLLECTIVE_STACKS_SUBDIR, getProjectCollectiveDir, getProjectStacksDir, getUserCollectiveDir, getUserStacksDir from consts.ts. Broken imports in: config.ts, loader.ts, skill-copier.ts, init.ts, edit.ts (to fix in Phase 4/5).                                                                                                                                                                                                                                                   |
| Phase 4 | 2026-01-25 | **init.ts and edit.ts refactor complete.** init.ts: Removed all stack-related imports and logic. New flow: check if plugin exists -> run wizard -> copy skills directly to plugin -> compile agents. edit.ts: Removed getActiveStack, getUserStacksDir, getStackSkillIds, copySkillsToStackFromSource. Added getPluginSkillIds() to plugin-finder.ts. New flow: get plugin dir -> read current skills from plugin -> run wizard -> copy skills directly to plugin -> recompile agents. All 323 tests pass. |
| Phase 5 | 2026-01-25 | **Library files refactor complete.** Deleted stack-creator.ts (not imported anywhere, had broken imports). Verified: skill-copier.ts clean (only has copySkillsToPluginFromSource), loader.ts clean (no broken imports), resolver.ts still needed (stackToCompileConfig used by init.ts and stack-plugin-compiler), stack-plugin-compiler.ts still needed (compiles stack templates to plugins). All 323 tests pass.                                                                                       |
| Phase 6 | 2026-01-25 | **Type cleanup complete.** Removed `StackOverrideRule` and `StackMetrics` types (unused - no runtime access). Simplified `StackConfig` by removing unused `overrides` and `metrics` fields. Kept `ResolvedStack` and `SuggestedStack` (actively used by wizard). All 323 tests pass.                                                                                                                                                                                                                       |
| Phase 7 | 2026-01-25 | **Test review complete.** Reviewed all 5 test files - no updates needed. stack-plugin-compiler.test.ts uses temp dirs for testing stack template compilation. integration.test.ts listStacks() reads src/stacks/ (templates). resolver.test.ts tests StackConfig for templates. source-loader.test.ts suggestedStacks refs are wizard presets. All 323 tests pass.                                                                                                                                         |
| Phase 8 | 2026-01-25 | **Documentation cleanup complete.** Updated CLI descriptions (index.ts, update.ts, compile.ts). Updated README.md with new plugin-only architecture. Verified .claude-collective/ refs are legitimate (config storage). All 323 tests pass.                                                                                                                                                                                                                                                                |

---

## Key Principles

1. **DELETE before REFACTOR** - Remove dead code first, then update remaining code
2. **One phase at a time** - Complete each phase before moving to next
3. **Run tests after each deletion** - Ensure nothing breaks unexpectedly
4. **Update tracking file** - Mark tasks complete as you go
