# Manual Testing Guide

> **Date**: 2026-01-24
> **Purpose**: End-to-end verification of stack-based architecture

---

## Quick Reference

### Setup Commands

```bash
# Clean slate (run before testing)
rm -rf .claude-collective .claude/plugins/claude-collective

# Build CLI
bun run build
```

### Test Progress Checklist

| #   | Test                   | Command                                           | Expected                       | Pass |
| --- | ---------------------- | ------------------------------------------------- | ------------------------------ | ---- |
| 1   | List empty             | `cc list`                                         | "No stacks found" message      | [ ]  |
| 2   | Switch without stacks  | `cc switch foo`                                   | Error: stack not found         | [ ]  |
| 3   | Init first stack       | `cc init --name dev-stack`                        | Creates stack + plugin         | [ ]  |
| 4   | Verify stack created   | `ls .claude-collective/stacks/`                   | `dev-stack/` exists            | [ ]  |
| 5   | Verify plugin created  | `ls .claude/plugins/claude-collective/`           | Plugin structure exists        | [ ]  |
| 6   | List shows active      | `cc list`                                         | `* dev-stack` with skill count | [ ]  |
| 7   | Verify config          | `cat .claude-collective/config.yaml`              | `active_stack: dev-stack`      | [ ]  |
| 8   | Init second stack      | `cc init --name work-stack`                       | Creates stack, prompts switch  | [ ]  |
| 9   | List shows both        | `cc list`                                         | Both stacks, one with `*`      | [ ]  |
| 10  | Switch stacks          | `cc switch work-stack`                            | Success message                | [ ]  |
| 11  | Verify skills replaced | `ls .claude/plugins/claude-collective/skills/`    | Different skills               | [ ]  |
| 12  | Add skill              | `cc add <skill>`                                  | Added to active stack          | [ ]  |
| 13  | Verify skill in stack  | `ls .claude-collective/stacks/work-stack/skills/` | New skill present              | [ ]  |
| 14  | Verify skill in plugin | `ls .claude/plugins/claude-collective/skills/`    | New skill synced               | [ ]  |
| 15  | Compile agents         | `cc compile --source .`                           | Agents recompiled              | [ ]  |
| 16  | Switch back            | `cc switch dev-stack`                             | Skills change back             | [ ]  |
| 17  | Error: bad stack       | `cc switch nonexistent`                           | Helpful error message          | [ ]  |
| 18  | Error: no active       | (clear config) `cc add foo`                       | "No active stack" error        | [ ]  |

---

## Detailed Test Steps

### Test 1: List Empty State

**Purpose**: Verify `cc list` handles no stacks gracefully.

**Precondition**: Clean slate (no `.claude-collective/` directory)

```bash
rm -rf .claude-collective .claude/plugins/claude-collective
cc list
```

**Expected Output**:

```
▲  No stacks found.
●  Run cc init --name <name> to create one.
```

**Verify**:

```bash
[ ! -d .claude-collective ] && echo "PASS: No directory created" || echo "FAIL"
```

---

### Test 2: Switch Without Stacks

**Purpose**: Verify `cc switch` errors gracefully when no stacks exist.

```bash
cc switch foo
```

**Expected Output**:

```
■  Stack "foo" not found.
●  Run cc list to see available stacks.
●  Stacks are stored in: .claude-collective/stacks
```

**Verify**: Exit code is non-zero

```bash
cc switch foo; echo "Exit code: $?"
# Should show: Exit code: 1
```

---

### Test 3: Init First Stack

**Purpose**: First `cc init` creates both stack AND plugin.

```bash
cc init --name dev-stack
```

**Interactive Steps**:

1. Select source (default or custom)
2. Choose "Build custom stack" or "Use pre-built stack"
3. Select skills via wizard
4. Confirm selections

**Expected Behavior**:

- Stack created at `.claude-collective/stacks/dev-stack/`
- Plugin created at `.claude/plugins/claude-collective/`
- Skills copied to both locations
- Agents compiled in plugin
- Stack automatically activated

**Verify**:

```bash
# All should exist
ls .claude-collective/stacks/dev-stack/skills/
ls .claude/plugins/claude-collective/.claude-plugin/plugin.json
ls .claude/plugins/claude-collective/agents/
ls .claude/plugins/claude-collective/skills/
cat .claude-collective/config.yaml | grep "active_stack: dev-stack"
```

---

### Test 4: Verify Stack Directory Structure

**Purpose**: Confirm stack has correct structure.

```bash
tree .claude-collective/stacks/dev-stack/ 2>/dev/null || ls -laR .claude-collective/stacks/dev-stack/
```

**Expected Structure**:

```
.claude-collective/stacks/dev-stack/
└── skills/
    ├── react/
    │   └── SKILL.md
    └── zustand/
        └── SKILL.md
```

**Verify**:

```bash
[ -d .claude-collective/stacks/dev-stack/skills ] && echo "PASS" || echo "FAIL"
```

---

### Test 5: Verify Plugin Directory Structure

**Purpose**: Confirm plugin has correct structure.

```bash
tree .claude/plugins/claude-collective/ 2>/dev/null || ls -laR .claude/plugins/claude-collective/
```

**Expected Structure**:

```
.claude/plugins/claude-collective/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
└── skills/
    ├── react/
    │   └── SKILL.md
    └── ...
```

**Verify**:

```bash
[ -f .claude/plugins/claude-collective/.claude-plugin/plugin.json ] && echo "PASS" || echo "FAIL"
```

---

### Test 6: List Shows Active Stack

**Purpose**: Verify `cc list` shows active marker.

```bash
cc list
```

**Expected Output**:

```
Stacks:
  * dev-stack (X skills)
```

**Verify**: The `*` appears before the active stack name.

---

### Test 7: Verify Config File

**Purpose**: Confirm config tracks active stack.

```bash
cat .claude-collective/config.yaml
```

**Expected Content**:

```yaml
active_stack: dev-stack
```

**Verify**:

```bash
grep -q "active_stack: dev-stack" .claude-collective/config.yaml && echo "PASS" || echo "FAIL"
```

---

### Test 8: Init Second Stack

**Purpose**: Second `cc init` creates stack only, prompts to switch.

```bash
cc init --name work-stack
```

**Expected Behavior**:

- New stack created at `.claude-collective/stacks/work-stack/`
- Plugin NOT recreated (already exists)
- Prompted: "Switch to work-stack?"
- If "Yes": skills copied to plugin, config updated
- If "No": dev-stack remains active

**Verify**:

```bash
ls .claude-collective/stacks/ | grep -E "dev-stack|work-stack"
# Should show both stacks
```

---

### Test 9: List Shows Both Stacks

**Purpose**: Verify multiple stacks display correctly.

```bash
cc list
```

**Expected Output**:

```
Stacks:
  * dev-stack (X skills)    # or work-stack if you switched
    work-stack (Y skills)
```

**Verify**: Both stacks listed, exactly one has `*`.

---

### Test 10: Switch Between Stacks

**Purpose**: Verify `cc switch` changes active stack.

```bash
# Note current active
cc list

# Switch
cc switch work-stack

# Verify changed
cc list
```

**Expected Output**:

```
┌  Switch Stack: work-stack
◇  Stack found: work-stack
◇  Skills switched
◇  Configuration updated
└  Switched to work-stack!
```

**Verify**:

```bash
grep -q "active_stack: work-stack" .claude-collective/config.yaml && echo "PASS" || echo "FAIL"
```

---

### Test 11: Verify Skills Replaced on Switch

**Purpose**: Confirm plugin skills change when switching stacks.

```bash
# Before switch - note the skills
ls .claude/plugins/claude-collective/skills/

# Switch
cc switch dev-stack

# After switch - skills should be different
ls .claude/plugins/claude-collective/skills/
```

**Verify**: The skills directory contents should match the new active stack.

```bash
diff <(ls .claude-collective/stacks/dev-stack/skills/) <(ls .claude/plugins/claude-collective/skills/) && echo "PASS: Skills match" || echo "FAIL"
```

---

### Test 12: Add Skill to Active Stack

**Purpose**: Verify `cc add` adds skill to active stack and syncs.

```bash
# Ensure on a stack
cc switch work-stack

# Add a skill (use an available skill name)
cc add react  # or another skill from your source
```

**Expected Behavior**:

- Skill fetched from source
- Skill added to `.claude-collective/stacks/work-stack/skills/`
- Skill synced to `.claude/plugins/claude-collective/skills/`
- Agents recompiled

**Verify**: See Tests 13-14.

---

### Test 13: Verify Skill Added to Stack

**Purpose**: Confirm skill exists in stack source directory.

```bash
ls .claude-collective/stacks/work-stack/skills/
```

**Expected**: New skill directory present.

**Verify**:

```bash
[ -d .claude-collective/stacks/work-stack/skills/react ] && echo "PASS" || echo "FAIL"
```

---

### Test 14: Verify Skill Synced to Plugin

**Purpose**: Confirm skill was copied to plugin.

```bash
ls .claude/plugins/claude-collective/skills/
```

**Expected**: Same skills as in stack.

**Verify**:

```bash
[ -d .claude/plugins/claude-collective/skills/react ] && echo "PASS" || echo "FAIL"
```

---

### Test 15: Compile Agents

**Purpose**: Verify `cc compile` recompiles agents using local skills.

```bash
cc compile --source .
```

**Expected Output**:

```
Plugin Mode Compile
◇  Found plugin: claude-collective
◇  Loaded X local skills
◇  Source: flag
◇  Agent definitions fetched
◇  Agents compiled: frontend-developer, backend-developer, ...
└  Plugin compile complete!
```

**Verify**:

```bash
ls .claude/plugins/claude-collective/agents/*.md | head -5
```

---

### Test 16: Switch Back Confirms Isolation

**Purpose**: Verify stacks are isolated - switching back restores original skills.

```bash
# Add skill to work-stack
cc switch work-stack
# (skill added in test 12)

# Switch to dev-stack
cc switch dev-stack

# Verify dev-stack skills (should NOT have work-stack additions)
ls .claude/plugins/claude-collective/skills/
```

**Verify**: Skills match dev-stack, not work-stack.

---

### Test 17: Error Handling - Bad Stack Name

**Purpose**: Verify helpful error for non-existent stack.

```bash
cc switch nonexistent-stack
```

**Expected Output**:

```
■  Stack "nonexistent-stack" not found.
●  Run cc list to see available stacks.
●  Stacks are stored in: .claude-collective/stacks
```

**Verify**: Exit code 1, helpful message shown.

---

### Test 18: Error Handling - No Active Stack

**Purpose**: Verify `cc add` errors when no active stack.

```bash
# Clear the active stack
echo "" > .claude-collective/config.yaml

# Try to add
cc add react
```

**Expected Output**:

```
■  No active stack. Run 'cc init --name <name>' first.
```

**Verify**: Exit code 1, directs user to init.

```bash
# Restore for further testing
echo "active_stack: dev-stack" > .claude-collective/config.yaml
```

---

## Cleanup

After testing, optionally clean up:

```bash
rm -rf .claude-collective .claude/plugins/claude-collective
```

---

## Troubleshooting

### Plugin not loading in Claude Code

1. Restart Claude Code after creating plugin
2. Check `/plugins` command shows `claude-collective`
3. Verify `plugin.json` is valid JSON

### Skills not appearing

1. Check skills have valid `SKILL.md` with frontmatter
2. Verify `cc list` shows correct skill count
3. Run `cc compile --source .` to refresh

### Switch not working

1. Check stack exists: `ls .claude-collective/stacks/`
2. Check permissions on directories
3. Verify config.yaml is writable

---

_Last updated: 2026-01-24_
