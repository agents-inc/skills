# Simplified Plugin Architecture Migration

## Context

We are migrating the CLI from a multi-stack architecture to a single-plugin-per-project model:

**Current (being removed):**

```
project/
├── .claude-collective/           # TO BE ELIMINATED
│   ├── config.yaml              # active_stack tracking
│   └── stacks/
│       ├── home-stack/skills/
│       └── work-stack/skills/
└── .claude/plugins/claude-collective/
```

**Target (simplified):**

```
project/
└── .claude/plugins/claude-collective/   # SINGLE LOCATION
    ├── .claude-plugin/plugin.json
    ├── agents/
    └── skills/
```

## Key Documents

1. **Tracking File:** `.claude/tasks/SIMPLIFIED-PLUGIN-MIGRATION.md`
   - Contains phase-by-phase task list with status
   - Update this file as you complete tasks

2. **Research:** `.claude/research/SIMPLIFIED-ARCHITECTURE-MIGRATION-RESEARCH.md`
   - Detailed analysis of all files affected
   - Type dependencies and cascade effects
   - Test impact analysis

3. **Proposal:** `.claude/research/findings/v2/SIMPLIFIED-PLUGIN-ARCHITECTURE.md`
   - Original architecture proposal
   - CLI command changes
   - Migration path overview

## Instructions

### Use Subagents

Spawn **backend-developer** subagents to execute each phase. Multiple agents can work in parallel on independent tasks within a phase.

Example:

```
Task tool with subagent_type=backend-developer:
"Execute Phase 1 of the simplified plugin migration.
Read the tracking file at .claude/tasks/SIMPLIFIED-PLUGIN-MIGRATION.md for the task list.
DELETE before REFACTOR. Update the tracking file as you complete each task."
```

### Critical Rule: DELETE BEFORE REFACTOR

The migration MUST follow this order:

1. **First, DELETE files/code that are no longer needed**
2. **Then, REFACTOR remaining code to work without deleted dependencies**

This prevents:

- Wasted effort updating code that will be deleted
- Orphaned imports causing build failures
- Confusion about what's still needed

### Phase Execution Order

| Phase | Description                        | Risk   | Can Parallelize            |
| ----- | ---------------------------------- | ------ | -------------------------- |
| 1     | Remove stack switching             | Low    | Yes - all deletions        |
| 2     | Remove stack config infrastructure | Medium | Partially                  |
| 3     | Remove COLLECTIVE\_\* constants    | Medium | After Phase 2              |
| 4     | Refactor commands                  | High   | init/edit/list in parallel |
| 5     | Refactor library files             | Medium | After Phase 4              |
| 6     | Update types                       | Low    | After Phase 5              |
| 7     | Update remaining tests             | Medium | After Phase 6              |
| 8     | Documentation cleanup              | Low    | Anytime after Phase 7      |

### Tracking File Updates

After completing each task, update the tracking file:

```markdown
| Delete `src/cli/commands/switch.ts` | done | backend-developer | Deleted 2026-01-25 |
```

After completing a phase:

```markdown
| Phase 1 | 2026-01-25 | All 5 tasks completed, tests passing |
```

### Running Tests

After each phase:

```bash
cd src/cli && bun test
```

If tests fail after deletions, that's expected - note which tests fail and continue. They'll be fixed in later phases.

### Files Summary

**To DELETE (Phase 1-3):**

- `src/cli/commands/switch.ts` + test
- `src/cli/lib/stack-list.ts`
- `src/cli/lib/stack-config.ts`
- `src/cli/lib/stack-skills.ts`
- `src/cli/lib/skill-copier.test.ts`
- Constants in `src/cli/consts.ts`
- Functions in `src/cli/lib/config.ts`

**To REFACTOR (Phase 4-7):**

- `src/cli/commands/init.ts` - major changes
- `src/cli/commands/edit.ts` - moderate changes
- `src/cli/commands/list.ts` - repurpose
- `src/cli/lib/skill-copier.ts` - update paths
- `src/cli/lib/loader.ts` - update loadStack()
- `src/cli/lib/resolver.ts` - update functions
- `src/cli/lib/stack-plugin-compiler.ts` - rename/update
- Multiple test files

## Starting Point

Begin with Phase 1 - it's self-contained and low risk:

```
Spawn a backend-developer agent:

"Execute Phase 1 of the simplified plugin migration.

Read the tracking file: .claude/tasks/SIMPLIFIED-PLUGIN-MIGRATION.md
Read the research: .claude/research/SIMPLIFIED-ARCHITECTURE-MIGRATION-RESEARCH.md

Tasks:
1. Remove switchCommand import from src/cli/index.ts
2. Remove program.addCommand(switchCommand) from src/cli/index.ts
3. Delete src/cli/commands/switch.ts
4. Delete src/cli/commands/switch.test.ts
5. Delete src/cli/lib/stack-list.ts

Update the tracking file after each task.
Run tests after all deletions to see current state.
Do NOT refactor any other files yet - just delete."
```

Then proceed to Phase 2, and so on.
