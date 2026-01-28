# Agent Plugin Migration

> **Date**: 2026-01-24
> **Status**: COMPLETE
> **Purpose**: Migrate to shared agents + switchable skill stacks architecture

---

## Executive Summary

### What We Learned

Research by 7 agents confirmed that **skills are already referenced by name, not embedded**. The current architecture is closer to target than expected. Main changes needed:

1. **Create `cc switch` command** - copies skills between stacks
2. **Unify on plugin mode** - remove stack mode from `cc compile`
3. **Revive `.claude-collective/`** - use for stack storage and config
4. **Track active stack** - one line in config for better UX

### Key Decisions

| Decision            | Choice                                                     | Rationale                                    |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| Plugin name         | `claude-collective`                                        | Clear branding                               |
| Stack storage       | `~/.claude-collective/stacks/`                             | Keep existing dir, remove deprecated label   |
| Active tracking     | Store `active_stack` in config                             | Enables `cc add` without flags               |
| `cc compile`        | Plugin mode only                                           | Same workflow for dev and users (dogfooding) |
| Publishing commands | `compile-stack`, `compile-plugins`, `generate-marketplace` | CI/release only                              |

---

## Target Architecture

### Directory Structure

```
~/.claude-collective/                    # SOURCE (our domain)
├── config.yaml                          # source, active_stack
└── stacks/
    ├── work-stack/
    │   └── skills/
    │       ├── react/SKILL.md
    │       └── hono/SKILL.md
    └── home-stack/
        └── skills/
            ├── react/SKILL.md
            └── zustand/SKILL.md

~/.claude/plugins/claude-collective/     # OUTPUT (Claude's domain)
├── .claude-plugin/plugin.json
├── agents/                              # Shared agents (fetched from source)
│   ├── frontend-developer.md
│   └── backend-developer.md
└── skills/                              # Active stack's skills (copied on switch)
    ├── react/SKILL.md
    └── zustand/SKILL.md
```

### Config File

```yaml
# ~/.claude-collective/config.yaml
source: github:claude-collective/skills
active_stack: work-stack
```

---

## CLI Commands After Migration

### User-Facing Commands

| Command            | Purpose                      | Behavior                                                                                   |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `cc init --name X` | Create new stack             | Creates `~/.claude-collective/stacks/X/`, if first stack also creates plugin and activates |
| `cc switch X`      | Switch active stack          | Removes `plugin/skills/`, copies from `stacks/X/skills/`, updates config                   |
| `cc add Y`         | Add skill to active stack    | Adds to `stacks/{active}/skills/`, then runs switch                                        |
| `cc compile`       | Recompile after manual edits | Plugin mode only - uses local skills, fetches agent defs                                   |
| `cc update`        | Update skills from source    | Re-fetches skills for active stack, then switch                                            |
| `cc list`          | List all stacks              | Shows stacks with `*` for active                                                           |
| `cc config`        | Manage configuration         | Show/set source, active_stack, etc.                                                        |

### Publishing Commands (CI Only)

| Command                   | Purpose                               |
| ------------------------- | ------------------------------------- |
| `cc compile-plugins`      | Build skill plugins for marketplace   |
| `cc compile-stack -s X`   | Build pre-built stack for marketplace |
| `cc generate-marketplace` | Generate marketplace.json             |

---

## Research Findings Summary

### Finding 1: Skills Are References, Not Embedded

Compiled agents contain:

```yaml
skills:
  - skill-react
  - skill-zustand
```

NOT embedded content. Claude Code loads skills at runtime.

**Source:** Agent template at `src/agents/_templates/agent.liquid:8-10`

### Finding 2: Agent Definitions Fetched From Source

When recompiling, agent definitions come from the marketplace source repository, NOT from existing compiled agents. This means agents stay fresh.

**Source:** `src/cli/lib/loader.ts:87-115`

### Finding 3: No Active Plugin Tracking

Current `findPluginDirectory()` returns first plugin found via filesystem ordering. Non-deterministic with multiple plugins.

**Source:** `src/cli/lib/plugin-finder.ts:165-224`

### Finding 4: `.claude-collective/` Marked Deprecated But Usable

Constants marked deprecated but directory structure still works. We'll revive it.

**Source:** `src/cli/consts.ts:33-35`

### Finding 5: Two Compilation Modes in `compile.ts`

Stack mode vs plugin mode. Stack mode is for dev, plugin mode for users. Decision: unify on plugin mode for dogfooding.

**Source:** `src/cli/commands/compile.ts:107-406`

---

## Implementation Tasks

> **Principle:** Remove first, then refactor. Each phase has a test gate.

---

### Phase 1: Remove Deprecated Code

**Goal:** Clean slate before adding new features.

| Task | File                          | Description                                                          |
| ---- | ----------------------------- | -------------------------------------------------------------------- |
| 1.1  | `src/cli/commands/compile.ts` | ~~Remove stack mode (`-s/--stack` flag and all related code)~~ DONE  |
| 1.2  | `src/cli/commands/compile.ts` | ~~Remove `--plugin` flag (always plugin mode now)~~ DONE             |
| 1.3  | `src/cli/commands/init.ts`    | ~~Remove `--scope` option (always user scope)~~ DONE                 |
| 1.4  | `src/cli/lib/active-stack.ts` | ~~Delete file or gut deprecated functions~~ DONE                     |
| 1.5  | `src/cli/consts.ts`           | ~~Remove `@deprecated` labels from `COLLECTIVE_DIR` constants~~ DONE |
| 1.6  | `src/cli/commands/list.ts`    | ~~Remove deprecated active-stack.ts imports~~ DONE                   |
| 1.7  | `src/cli/commands/update.ts`  | ~~Remove deprecated active-stack.ts imports~~ DONE                   |

**Test Gate:**

```bash
bun test
bun tsc --noEmit
# Manual: verify cc compile, cc init still work (may have reduced functionality)
```

---

### Phase 2: Add Foundations

**Goal:** New constants, types, and config before building features.

| Task | File                           | Description                                                                                       |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| 2.1  | `src/cli/consts.ts`            | ~~Add `PLUGIN_NAME = "claude-collective"` constant~~ DONE                                         |
| 2.2  | `src/cli/consts.ts`            | ~~Add `getUserCollectiveDir()` helper (returns `~/.claude-collective/`)~~ DONE                    |
| 2.3  | `src/cli/consts.ts`            | ~~Add `getUserStacksDir()` helper (returns `~/.claude-collective/stacks/`)~~ DONE                 |
| 2.4  | `src/types.ts`                 | ~~Add `active_stack?: string` to `Config` type~~ DONE                                             |
| 2.5  | `src/cli/lib/config.ts`        | ~~Add `getActiveStack(): string                                                                   | null` function~~ DONE |
| 2.6  | `src/cli/lib/config.ts`        | ~~Add `setActiveStack(stackName: string)` function~~ DONE                                         |
| 2.7  | `src/cli/lib/plugin-finder.ts` | ~~Add `getCollectivePluginDir()` that returns fixed `~/.claude/plugins/claude-collective/`~~ DONE |

**Test Gate:**

```bash
bun tsc --noEmit
bun test
# Manual: cc config show (should work, active_stack may be null)
```

---

### Phase 3: Implement `cc switch`

**Goal:** Core switching mechanism works standalone.

| Task | File                              | Description                                                               |
| ---- | --------------------------------- | ------------------------------------------------------------------------- |
| 3.1  | `src/cli/commands/switch.ts`      | ~~Create new command file~~ DONE                                          |
| 3.2  | `src/cli/commands/switch.ts`      | ~~Validate stack exists in `~/.claude-collective/stacks/{name}/`~~ DONE   |
| 3.3  | `src/cli/commands/switch.ts`      | ~~Remove `~/.claude/plugins/claude-collective/skills/`~~ DONE             |
| 3.4  | `src/cli/commands/switch.ts`      | ~~Copy from `~/.claude-collective/stacks/{name}/skills/` to plugin~~ DONE |
| 3.5  | `src/cli/commands/switch.ts`      | ~~Call `setActiveStack(stackName)`~~ DONE                                 |
| 3.6  | `src/cli/index.ts`                | ~~Register switch command~~ DONE                                          |
| 3.7  | `src/cli/commands/switch.test.ts` | ~~Write tests for switch command~~ DONE                                   |

**Implementation:**

```typescript
async function switchCommand(stackName: string) {
  const stackSkillsDir = path.join(getUserStacksDir(), stackName, "skills");

  if (!(await directoryExists(stackSkillsDir))) {
    throw new Error(
      `Stack "${stackName}" not found. Run "cc list" to see available stacks.`,
    );
  }

  const pluginSkillsDir = path.join(getCollectivePluginDir(), "skills");

  // Remove existing skills
  if (await directoryExists(pluginSkillsDir)) {
    await remove(pluginSkillsDir);
  }

  // Copy new skills
  await copy(stackSkillsDir, pluginSkillsDir);

  // Update config
  await setActiveStack(stackName);

  console.log(`Switched to ${stackName}`);
}
```

**Test Gate:**

```bash
bun test
# Manual:
#   1. Create fake stacks: mkdir -p ~/.claude-collective/stacks/{a,b}/skills/
#   2. Add dummy SKILL.md files
#   3. Run: cc switch a
#   4. Verify: ls ~/.claude/plugins/claude-collective/skills/
#   5. Run: cc switch b
#   6. Verify skills changed
```

---

### Phase 4: Update `cc init`

**Goal:** Init creates stacks in new location, activates on first run.

| Task | File                       | Description                                                            |
| ---- | -------------------------- | ---------------------------------------------------------------------- |
| 4.1  | `src/cli/commands/init.ts` | ~~Output skills to `~/.claude-collective/stacks/{name}/skills/`~~ DONE |
| 4.2  | `src/cli/commands/init.ts` | ~~Check if `claude-collective` plugin exists~~ DONE                    |
| 4.3  | `src/cli/commands/init.ts` | ~~If first stack: create plugin dir, copy agents~~ DONE                |
| 4.4  | `src/cli/commands/init.ts` | ~~Call switch logic to activate new stack~~ DONE                       |
| 4.5  | `src/cli/commands/init.ts` | ~~If NOT first stack: just create stack, prompt to switch~~ DONE       |
| 4.6  | Update init tests          | ~~Adjust expectations for new paths~~ DONE                             |

**Test Gate:**

```bash
bun test
# Manual:
#   1. rm -rf ~/.claude-collective ~/.claude/plugins/claude-collective
#   2. cc init --name test-stack (select some skills)
#   3. Verify: ~/.claude-collective/stacks/test-stack/skills/ exists
#   4. Verify: ~/.claude/plugins/claude-collective/ exists with agents + skills
#   5. cc init --name second-stack
#   6. Verify: prompts to switch (doesn't auto-activate)
```

---

### Phase 5: Update `cc add` and `cc list`

**Goal:** Full workflow works end-to-end.

| Task | File                       | Description                                                          |
| ---- | -------------------------- | -------------------------------------------------------------------- |
| 5.1  | `src/cli/commands/add.ts`  | ~~Get active stack from config~~ DONE                                |
| 5.2  | `src/cli/commands/add.ts`  | ~~Error if no active stack~~ DONE                                    |
| 5.3  | `src/cli/commands/add.ts`  | ~~Add skill to `~/.claude-collective/stacks/{active}/skills/`~~ DONE |
| 5.4  | `src/cli/commands/add.ts`  | ~~Call switch logic to update plugin~~ DONE                          |
| 5.5  | `src/cli/commands/add.ts`  | ~~Remove `--plugin` option~~ DONE                                    |
| 5.6  | `src/cli/commands/list.ts` | ~~Read stacks from `~/.claude-collective/stacks/`~~ DONE             |
| 5.7  | `src/cli/commands/list.ts` | ~~Show `*` marker for active stack~~ DONE                            |
| 5.8  | `src/cli/commands/list.ts` | ~~Show skill count per stack~~ DONE                                  |

**Test Gate:**

```bash
bun test
# Manual full cycle:
#   1. cc init --name my-stack
#   2. cc list (should show * my-stack)
#   3. cc add zustand
#   4. Verify skill in both stack source AND plugin
#   5. cc init --name other-stack
#   6. cc switch other-stack
#   7. cc list (should show * other-stack)
#   8. Open Claude Code, verify agents load
```

---

### Phase 6: Update `cc compile`

**Goal:** Compile uses plugin mode only, simplified.

| Task | File                          | Description                                          |
| ---- | ----------------------------- | ---------------------------------------------------- |
| 6.1  | `src/cli/commands/compile.ts` | ~~Always use `getCollectivePluginDir()`~~ DONE       |
| 6.2  | `src/cli/commands/compile.ts` | ~~Read skills from plugin's `skills/` dir~~ DONE     |
| 6.3  | `src/cli/commands/compile.ts` | ~~Fetch agent definitions from source~~ DONE         |
| 6.4  | `src/cli/commands/compile.ts` | ~~Compile and write to plugin's `agents/` dir~~ DONE |
| 6.5  | `src/cli/commands/compile.ts` | ~~Remove all legacy code paths~~ DONE                |

**Test Gate:**

```bash
bun test
# Manual:
#   1. Edit a skill in ~/.claude/plugins/claude-collective/skills/
#   2. cc compile
#   3. Verify agents recompiled
```

---

### Phase 7: Cleanup and Documentation

**Goal:** Remove dead code, update docs.

| Task | File                    | Description                                          |
| ---- | ----------------------- | ---------------------------------------------------- |
| 7.1  | Various                 | ~~Search for any remaining deprecated imports~~ DONE |
| 7.2  | Various                 | ~~Remove unused functions/files~~ DONE               |
| 7.3  | `src/docs/plugins/*.md` | ~~Update all docs for new architecture~~ DONE        |
| 7.4  | `src/docs/TODO.md`      | ~~Update task status~~ DONE                          |
| 7.5  | `README.md`             | ~~Update if needed~~ DONE                            |

**Test Gate:**

```bash
bun test
bun tsc --noEmit
# Full manual regression test of all commands
```

---

## Files to Modify

| File                           | Change                                                            | Priority |
| ------------------------------ | ----------------------------------------------------------------- | -------- |
| `src/cli/consts.ts`            | Remove deprecated labels, add `PLUGIN_NAME = "claude-collective"` | High     |
| `src/cli/lib/config.ts`        | Add `active_stack` handling                                       | High     |
| `src/types.ts`                 | Add `active_stack` to Config type                                 | High     |
| `src/cli/commands/switch.ts`   | **NEW FILE** - switch command                                     | High     |
| `src/cli/commands/init.ts`     | Output to stacks dir, create plugin on first init                 | High     |
| `src/cli/commands/add.ts`      | Use active stack, add to stacks dir                               | High     |
| `src/cli/commands/compile.ts`  | Remove stack mode, plugin mode only                               | High     |
| `src/cli/commands/list.ts`     | Use new stacks dir, show active marker                            | Medium   |
| `src/cli/index.ts`             | Register switch command                                           | High     |
| `src/cli/lib/active-stack.ts`  | Refactor or remove                                                | Medium   |
| `src/cli/lib/plugin-finder.ts` | Simplify to always use `claude-collective`                        | Low      |

---

## Notes

### CLI Repository Split

The CLI is planned to move to a separate repository (`claude-collective-cli`). Keep changes focused and avoid over-engineering that will need rework post-split.

**Defer until after split:**

- Multi-source marketplace support
- Private repository authentication enhancements
- Schema distribution to SchemaStore

### Testing Strategy

After each phase:

1. Run existing tests (`bun test`)
2. Manual test: `cc init --name test-stack`
3. Manual test: `cc switch` between stacks
4. Verify plugin loads in Claude Code

---

## Open Questions (Resolved)

| Question                           | Resolution                                 |
| ---------------------------------- | ------------------------------------------ |
| Should we track active plugin?     | No - always use `claude-collective` plugin |
| Should we track active stack?      | Yes - store in config for `cc add` UX      |
| Stack mode vs plugin mode?         | Plugin mode only - dogfooding              |
| Plugin name fixed or configurable? | Fixed: `claude-collective`                 |
| Skill deduplication across stacks? | Not needed - skills will diverge over time |

---

_Last updated: 2026-01-24_
