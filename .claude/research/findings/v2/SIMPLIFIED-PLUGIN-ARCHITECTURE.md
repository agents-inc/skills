# Simplified Plugin Architecture

> **Status:** Proposed
> **Created:** 2026-01-25
> **Decision:** Approved - pending implementation

---

## Summary

Simplify the Claude Collective architecture from multi-stack to single-plugin-per-project. Eliminate `.claude-collective/` directory entirely. Everything lives in `.claude/plugins/claude-collective/`.

---

## Current Architecture (To Be Replaced)

```
project/
├── .claude-collective/              # SOURCE (to be eliminated)
│   ├── config.yaml                  # active_stack tracking
│   └── stacks/
│       ├── home-stack/
│       │   └── skills/
│       └── work-stack/
│           └── skills/
│
└── .claude/plugins/claude-collective/   # OUTPUT
    ├── .claude-plugin/plugin.json
    ├── agents/
    └── skills/                      # Copied from active stack
```

**Problems with current architecture:**

- Two locations for skills (source vs output)
- Stack switching complexity
- Version sync issues between stack config and plugin.json
- Users confused about where to edit files
- Unnecessary complexity for most use cases

---

## New Architecture (Target)

```
project/
└── .claude/plugins/claude-collective/   # SINGLE LOCATION
    ├── .claude-plugin/
    │   └── plugin.json              # Version, metadata, manifest
    ├── agents/                      # All agents (essential + optional)
    │   ├── frontend-developer.md
    │   ├── backend-developer.md
    │   ├── skill-summoner.md        # Optional, added via cc add
    │   └── rust-developer.md        # Optional, added via cc add
    └── skills/                      # All skills
        ├── react/
        ├── typescript/
        └── rust/                    # Added later via cc add
```

---

## Key Principles

### 1. One Project = One Plugin

- Each project has exactly ONE plugin configuration
- No stack switching, no sync issues
- Users own the plugin folder entirely

### 2. Grow, Don't Multiply

Instead of multiple stacks for different concerns:

- Add agents for new domains (e.g., `rust-developer` for Rust engine)
- Add skills for new technologies (e.g., `rust/` skills)
- Your plugin evolves with your project

### 3. Single Source of Truth

- Skills: Edit in `.claude/plugins/claude-collective/skills/`
- Agents: Edit in `.claude/plugins/claude-collective/agents/`
- Version: Lives in `.claude-plugin/plugin.json`
- No duplication, no sync required

### 4. Marketplace as Starter Templates

- "Stacks" become initialization templates
- `cc init` lets you pick a template (e.g., "fullstack-react")
- After init, you have a single plugin you grow over time
- Templates are not ongoing configurations

---

## CLI Command Changes

| Current Command                      | New Behavior                                                    |
| ------------------------------------ | --------------------------------------------------------------- |
| `cc init`                            | Creates plugin directly in `.claude/plugins/claude-collective/` |
| `cc init --template fullstack-react` | Uses template to seed initial skills/agents                     |
| `cc switch`                          | **REMOVED** - no stacks to switch                               |
| `cc list`                            | Shows plugin info (version, skill count, agent count)           |
| `cc edit`                            | Opens wizard to add/remove skills in plugin                     |
| `cc add <skill>`                     | Adds skill directly to plugin                                   |
| `cc add <agent>`                     | Adds agent directly to plugin                                   |
| `cc compile`                         | Recompiles agents (if needed after skill changes)               |

---

## Files to Remove/Refactor

### Remove Entirely

| File                                           | Reason                       |
| ---------------------------------------------- | ---------------------------- |
| `src/cli/lib/stack-list.ts`                    | No stacks to list            |
| `src/cli/lib/stack-config.ts`                  | No stack configs             |
| `src/cli/lib/stack-creator.ts`                 | No stacks to create          |
| `src/cli/commands/switch.ts`                   | No stacks to switch          |
| `src/cli/consts.ts` → `COLLECTIVE_*` constants | No `.claude-collective/` dir |

### Refactor

| File                          | Changes Needed                             |
| ----------------------------- | ------------------------------------------ |
| `src/cli/lib/skill-copier.ts` | Change destination to plugin dir           |
| `src/cli/commands/init.ts`    | Remove stack logic, create plugin directly |
| `src/cli/commands/edit.ts`    | Edit skills in plugin dir, not stack       |
| `src/cli/commands/list.ts`    | Show plugin info instead of stack list     |
| `src/cli/lib/config.ts`       | Remove `active_stack` logic                |

### Keep As-Is

| File                                   | Reason                               |
| -------------------------------------- | ------------------------------------ |
| `src/cli/lib/plugin-finder.ts`         | Still need to find plugin            |
| `src/cli/lib/plugin-manifest.ts`       | Still generate plugin.json           |
| `src/cli/lib/plugin-version.ts`        | Version management stays             |
| `src/cli/lib/marketplace-generator.ts` | Marketplace still exists             |
| `src/cli/lib/skill-plugin-compiler.ts` | Still compile skills for marketplace |
| `src/cli/lib/stack-plugin-compiler.ts` | Rename to `template-compiler.ts`     |

---

## Migration Path

### Phase 1: Research & Planning

- [ ] Identify all files referencing `.claude-collective/`
- [ ] Identify all files referencing stack switching
- [ ] Map dependencies between files
- [ ] Create detailed migration checklist

### Phase 2: Remove Stack Switching

- [ ] Remove `cc switch` command
- [ ] Remove `active_stack` from config
- [ ] Update `cc list` to show plugin info

### Phase 3: Simplify Init

- [ ] Remove stack creation logic from `cc init`
- [ ] Create plugin directly in `.claude/plugins/claude-collective/`
- [ ] Rename "stacks" to "templates" in marketplace

### Phase 4: Update Edit/Add Commands

- [ ] `cc edit` modifies plugin skills directly
- [ ] `cc add` adds to plugin directly
- [ ] Remove stack-related prompts

### Phase 5: Cleanup

- [ ] Remove unused files (stack-list.ts, stack-config.ts, etc.)
- [ ] Remove `COLLECTIVE_*` constants
- [ ] Update all documentation
- [ ] Update tests

---

## User Migration

For users with existing `.claude-collective/` directories:

```bash
# Option 1: Fresh start
rm -rf .claude-collective
cc init --template <their-current-stack>

# Option 2: Manual migration
cp -r .claude-collective/stacks/<active-stack>/skills/* .claude/plugins/claude-collective/skills/
rm -rf .claude-collective
```

CLI could detect `.claude-collective/` and offer migration prompt.

---

## Benefits

1. **Simpler mental model** - One plugin, one location
2. **No sync issues** - Version lives in plugin.json only
3. **Users can edit freely** - No "source vs output" confusion
4. **Easier onboarding** - `cc init` creates working plugin immediately
5. **Extensible** - Add agents/skills as project grows
6. **Less code** - Remove ~5 files, simplify ~5 more

---

## Open Questions

1. **Backward compatibility** - How long to support `.claude-collective/` migration?
2. **Template updates** - How do users get template updates after init?
3. **Agent recompilation** - When should agents auto-recompile after skill edits?

---

## References

- Original discussion: Session 2026-01-25
- Related: `CLI-DATA-DRIVEN-ARCHITECTURE.md` (now partially obsolete)
- Related: `CLAUDE-COLLECTIVE-DIRECTORY-IMPLEMENTATION.md` (now obsolete)
