# Manual Testing Checklist

> **Date**: 2026-01-24
> **Purpose**: End-to-end testing for Phase A completion

---

## Pre-requisites

- [ ] All tests passing (`bun test`)
- [ ] CLI builds without errors
- [ ] fullstack-react symlinked at `~/.claude/plugins/fullstack-react`

---

## 1. Validate Stack Plugin Loads (CRITICAL)

**Setup**: Restart Claude Code to pick up the fullstack-react plugin

**Tests**:

- [ ] Run `/agents` - verify fullstack-react agents appear
- [ ] Verify agent count: should see 14 agents (frontend-developer, backend-developer, pm, tester, skill-summoner, agent-summoner, pattern-scout, pattern-critique, documentor, architecture, frontend-researcher, backend-researcher, frontend-reviewer, backend-reviewer)
- [ ] Spawn `frontend-developer` agent - verify it loads
- [ ] Check agent frontmatter has `skills:` array
- [ ] Run `/skill-react` - verify skill activates

**Expected Results**:

- Agents load without errors
- Skills referenced in agent frontmatter
- Skills can be invoked via slash command

---

## 2. cc init - Pre-built Stack

**Command**: `bun src/cli/index.ts init --name test-fullstack --scope user`

**Steps**:

1. Select "Use pre-built stack"
2. Select "Fullstack React"
3. Confirm selections
4. Complete wizard

**Verify**:

- [ ] Plugin created at `~/.claude/plugins/test-fullstack/`
- [ ] `plugin.json` exists with correct structure
- [ ] `skills/` directory contains all 28 skills from fullstack-react
- [ ] `agents/` directory contains 14 compiled agents
- [ ] Each agent has `skills:` frontmatter

**Cleanup**: `rm -rf ~/.claude/plugins/test-fullstack`

---

## 3. cc init - Custom Stack

**Command**: `bun src/cli/index.ts init --name test-custom --scope user`

**Steps**:

1. Select "Build custom stack"
2. Navigate categories, select 5-10 skills
3. Confirm selections
4. Complete wizard

**Verify**:

- [ ] Plugin created at `~/.claude/plugins/test-custom/`
- [ ] `skills/` directory contains only selected skills
- [ ] `agents/` directory contains 4 default agents (frontend-developer, backend-developer, pm, tester)
- [ ] Agents compile without errors

**Cleanup**: `rm -rf ~/.claude/plugins/test-custom`

---

## 4. cc add - Add Skill

**Setup**: Create a test plugin first

```bash
bun src/cli/index.ts init --name test-add --scope user
# Select custom stack with minimal skills (e.g., just frontend/react)
```

**Command**: `bun src/cli/index.ts add zustand --plugin test-add`

**Verify**:

- [ ] Skill copied to `~/.claude/plugins/test-add/skills/`
- [ ] Agents recompiled (check agent timestamps)
- [ ] Version bumped in plugin.json
- [ ] No duplicate skill errors

**Cleanup**: `rm -rf ~/.claude/plugins/test-add`

---

## 5. cc compile-stack

**Command**: `bun src/cli/index.ts compile-stack -s fullstack-react`

**Verify**:

- [ ] Stack compiles to `dist/stacks/fullstack-react/`
- [ ] All 15 agents generated in `agents/`
- [ ] All skills copied to `skills/`
- [ ] `plugin.json` has correct structure
- [ ] `hooks/hooks.json` generated if stack has hooks
- [ ] `README.md` generated

---

## 6. cc compile-plugins

**Command**: `bun src/cli/index.ts compile-plugins`

**Verify**:

- [ ] All 83 skills compiled to `dist/plugins/`
- [ ] Each skill has valid `plugin.json`
- [ ] Each skill has `SKILL.md` with frontmatter

---

## 7. cc generate-marketplace

**Command**: `bun src/cli/index.ts generate-marketplace`

**Verify**:

- [ ] `dist/marketplace.json` generated
- [ ] Contains all 83 skill plugins
- [ ] All `pluginRoot` paths valid

---

## 8. cc validate

**Command**: `bun src/cli/index.ts validate dist/plugins --all`

**Verify**:

- [ ] All plugins pass validation
- [ ] No errors reported
- [ ] Warnings (if any) are expected

---

## 9. Dry Run Mode

**Commands**:

```bash
bun src/cli/index.ts init --dry-run --name dry-test
bun src/cli/index.ts add zustand --dry-run --plugin test-add
```

**Verify**:

- [ ] No files created
- [ ] Preview output shows what would be created
- [ ] Exit code 0

---

## 10. Error Handling

**Test**: Invalid skill name

```bash
bun src/cli/index.ts add nonexistent-skill --plugin test-add
```

- [ ] Clear error message
- [ ] Exit code non-zero

**Test**: No plugin found

```bash
bun src/cli/index.ts add zustand
```

- [ ] Error: "No plugin found"
- [ ] Suggests running `cc init`

**Test**: Skill already exists

```bash
bun src/cli/index.ts add react --plugin fullstack-react  # if react already in plugin
```

- [ ] Error: "Skill already exists"

---

## Sign-off

| Test                    | Passed | Notes |
| ----------------------- | ------ | ----- |
| 1. Plugin loads         |        |       |
| 2. Init pre-built       |        |       |
| 3. Init custom          |        |       |
| 4. Add skill            |        |       |
| 5. Compile stack        |        |       |
| 6. Compile plugins      |        |       |
| 7. Generate marketplace |        |       |
| 8. Validate             |        |       |
| 9. Dry run              |        |       |
| 10. Error handling      |        |       |

**Tester**: **\*\***\_\_\_**\*\***
**Date**: **\*\***\_\_\_**\*\***
