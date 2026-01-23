# Manual Testing Guide: Plugin Distribution System

> **Purpose**: Verify the entire plugin compilation and distribution pipeline works end-to-end
> **Created**: 2026-01-23
> **Estimated Time**: 30-45 minutes

---

## Overview

The plugin system compiles skills and agents into distributable Claude Code plugins. This guide walks through testing each component in order of criticality.

### What Was Built

```
src/skills/           →  compile-plugins  →  dist/plugins/skill-*
src/stacks/           →  compile-stack    →  dist/stacks/{stack-name}
dist/plugins/         →  generate-marketplace  →  marketplace.json
```

### Key Files

| File                              | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `dist/plugins/`                   | Compiled skill plugins (83 total)                       |
| `dist/stacks/`                    | Compiled stack plugins (2: fullstack-react, work-stack) |
| `.claude-plugin/marketplace.json` | Plugin registry for discovery                           |
| `src/cli/index.ts`                | CLI entry point                                         |

---

## Test 1: Compile All Skills (CRITICAL)

Verifies all 83 skills compile to valid plugins.

### Run

```bash
# Clean and compile
rm -rf dist/plugins
bun src/cli/index.ts compile-plugins
```

### Expected Output

```
Compiling skills from: /home/vince/dev/claude-subagents/src/skills
Output directory: /home/vince/dev/claude-subagents/dist/plugins

Compiled 83 skill plugins successfully
```

### Verify

```bash
# Count compiled plugins
ls -d dist/plugins/skill-* | wc -l
# Expected: 83

# Check a sample plugin structure
ls -la dist/plugins/skill-react/
# Expected:
#   .claude-plugin/
#   skills/
#   README.md

# Check plugin.json exists and is valid
cat dist/plugins/skill-react/.claude-plugin/plugin.json | head -10
```

### Pass Criteria

- [ ] 83 plugins created
- [ ] Each has `.claude-plugin/plugin.json`
- [ ] Each has `skills/` directory with SKILL.md
- [ ] No error messages during compilation

---

## Test 2: Compile Stack Plugins (CRITICAL)

Verifies stacks compile with agents and skill references.

### Run

```bash
# Clean and compile both stacks
rm -rf dist/stacks
bun src/cli/index.ts compile-stack -s fullstack-react
bun src/cli/index.ts compile-stack -s work-stack
```

### Expected Output

```
Compiling stack: fullstack-react
Output: dist/stacks/fullstack-react

Stack plugin compiled successfully:
  - Agents: 15
  - Skill plugins referenced: X
```

### Verify

```bash
# Check stack structure
ls -la dist/stacks/fullstack-react/
# Expected:
#   .claude-plugin/
#   agents/
#   hooks/
#   README.md

# Check agents were compiled
ls dist/stacks/fullstack-react/agents/
# Expected: 15 .md files (one per agent)

# Check plugin.json references agents
cat dist/stacks/fullstack-react/.claude-plugin/plugin.json

# Check hooks.json was generated
cat dist/stacks/fullstack-react/hooks/hooks.json
```

### Pass Criteria

- [ ] Both stacks compile without errors
- [ ] Each has `agents/` with .md files
- [ ] Each has `hooks/hooks.json`
- [ ] plugin.json has `"agents": "./agents/"`

---

## Test 3: Validate All Plugins (HIGH)

Verifies compiled plugins pass schema validation.

### Run

```bash
# Validate skill plugins
bun src/cli/index.ts validate dist/plugins --all

# Validate stack plugins
bun src/cli/index.ts validate dist/stacks/fullstack-react
bun src/cli/index.ts validate dist/stacks/work-stack
```

### Expected Output

```
Validating all plugins in: dist/plugins

Plugin Validation Summary:
  Total plugins: 83
  Valid: 83
  Invalid: 0
```

### Pass Criteria

- [ ] All 83 skill plugins valid
- [ ] Both stack plugins valid
- [ ] No errors (warnings are OK)

---

## Test 4: Generate Marketplace (HIGH)

Verifies marketplace.json is generated correctly.

### Run

```bash
bun src/cli/index.ts generate-marketplace
```

### Verify

```bash
# Check marketplace was created
cat .claude-plugin/marketplace.json | head -30

# Count plugins in marketplace
cat .claude-plugin/marketplace.json | grep '"name":' | wc -l
# Expected: 83

# Verify schema reference
cat .claude-plugin/marketplace.json | grep '$schema'
# Expected: "https://anthropic.com/claude-code/marketplace.schema.json"
```

### Pass Criteria

- [ ] marketplace.json created in `.claude-plugin/`
- [ ] Contains 83 plugin entries
- [ ] Has correct `$schema` reference
- [ ] All `source` paths are valid

---

## Test 5: Install Plugin in Claude Code (CRITICAL)

This is the ultimate test - does the plugin actually work?

### Preparation

```bash
# Create plugins directory if it doesn't exist
mkdir -p ~/.claude/plugins

# Remove any previous test installations
rm -rf ~/.claude/plugins/fullstack-react
```

### Install Stack Plugin

```bash
# Copy the compiled stack plugin
cp -r dist/stacks/fullstack-react ~/.claude/plugins/
```

### Verify Installation

```bash
# Check structure
ls -la ~/.claude/plugins/fullstack-react/
# Expected:
#   .claude-plugin/
#   agents/
#   hooks/
#   README.md

# Verify plugin.json is readable
cat ~/.claude/plugins/fullstack-react/.claude-plugin/plugin.json
```

### Test in Claude Code

1. **Open a new terminal in any project directory**

2. **Start Claude Code**

   ```bash
   claude
   ```

3. **Check agents are loaded**

   ```
   /agents
   ```

   **Expected**: You should see the 15 agents from fullstack-react listed:
   - frontend-developer
   - backend-developer
   - frontend-reviewer
   - backend-reviewer
   - pm
   - orchestrator
   - etc.

4. **Test agent invocation**

   ```
   Use the frontend-researcher agent to find React components in this directory
   ```

   **Expected**: Claude should spawn the frontend-researcher agent

5. **Check skills are referenced**
   - When an agent runs, check if it mentions skills in its context
   - The agent frontmatter should have `skills:` array

### Pass Criteria

- [ ] Plugin appears in `~/.claude/plugins/`
- [ ] Agents appear in `/agents` command
- [ ] At least one agent can be invoked
- [ ] No errors about missing files or invalid structure

---

## Test 6: Skill Plugin Installation (MEDIUM)

Test that individual skill plugins work.

### Install a Skill Plugin

```bash
# Copy a skill plugin
cp -r dist/plugins/skill-react ~/.claude/plugins/
```

### Verify in Claude Code

1. **Start Claude Code**

   ```bash
   claude
   ```

2. **Check skills are loaded**

   ```
   /skills
   ```

   **Expected**: `skill-react` or `react` should appear in the list

3. **Invoke the skill**
   ```
   /skill-react
   ```
   or reference it in conversation:
   ```
   Using the React skill, explain how to create a custom hook
   ```

### Pass Criteria

- [ ] Skill appears in `/skills`
- [ ] Skill content is loaded when invoked
- [ ] No errors about missing frontmatter

---

## Test 7: Hooks Execution (MEDIUM)

Test that hooks are properly configured.

**Note:** `hooks/hooks.json` is only generated if the stack has hooks defined in its config. If no hooks are defined, the hooks directory will not exist.

### Check hooks.json Structure (if hooks are defined)

```bash
cat dist/stacks/fullstack-react/hooks/hooks.json
```

**Expected structure (when hooks are defined):**

```json
{
  "$schema": "https://claude-subagents.local/schemas/hooks.schema.json",
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...]
  }
}
```

### Verify in Claude Code

1. If hooks are defined, they should execute at the appropriate trigger points
2. Check Claude Code logs for hook execution messages

### Pass Criteria

- [ ] If stack has hooks defined: `hooks/hooks.json` exists and is valid JSON
- [ ] If stack has NO hooks defined: `hooks/` directory does not exist (this is correct)
- [ ] Has `$schema` reference (when file exists)
- [ ] Has `hooks` object with defined hooks (when file exists)

---

## Test 8: Full Pipeline Validation (LOW)

Run the complete automated test suite.

### Run

```bash
bun test
```

### Expected Output

```
314 pass
0 fail
```

### Run Schema Validation

```bash
bun src/cli/index.ts validate
```

### Expected Output

```
Total schemas checked: 7
Total files: 254
Valid: 254
Invalid: 0
```

### Pass Criteria

- [ ] All 314 tests pass
- [ ] All 254 schema validations pass

---

## Troubleshooting

### Plugin not appearing in Claude Code

1. Check the plugin is in the correct location:

   ```bash
   ls ~/.claude/plugins/
   ```

2. Verify plugin.json exists:

   ```bash
   cat ~/.claude/plugins/{name}/.claude-plugin/plugin.json
   ```

3. Check for JSON syntax errors:
   ```bash
   cat ~/.claude/plugins/{name}/.claude-plugin/plugin.json | jq .
   ```

### Agents not loading

1. Check agents directory exists:

   ```bash
   ls ~/.claude/plugins/{name}/agents/
   ```

2. Verify agent files have valid frontmatter:

   ```bash
   head -20 ~/.claude/plugins/{name}/agents/frontend-developer.md
   ```

3. Check for YAML syntax errors in frontmatter

### Skills not appearing

1. Check skills directory structure:

   ```bash
   ls -R ~/.claude/plugins/skill-*/skills/
   ```

2. Verify SKILL.md has frontmatter:
   ```bash
   head -10 ~/.claude/plugins/skill-react/skills/react/SKILL.md
   ```

### Validation errors

1. Run verbose validation:

   ```bash
   bun src/cli/index.ts validate dist/plugins/skill-react -v
   ```

2. Check specific error messages for missing fields

---

## Quick Reference Commands

```bash
# Compile everything fresh
rm -rf dist && bun src/cli/index.ts compile-plugins && bun src/cli/index.ts compile-stack -s fullstack-react && bun src/cli/index.ts compile-stack -s work-stack

# Validate everything
bun src/cli/index.ts validate dist/plugins --all && bun src/cli/index.ts validate dist/stacks/fullstack-react && bun src/cli/index.ts validate dist/stacks/work-stack

# Generate marketplace
bun src/cli/index.ts generate-marketplace

# Install for testing
cp -r dist/stacks/fullstack-react ~/.claude/plugins/

# Run all automated tests
bun test && bun src/cli/index.ts validate
```

---

## Sign-Off Checklist

Before considering the plugin system production-ready:

- [ ] **Test 1**: All 83 skills compile
- [ ] **Test 2**: Both stacks compile with agents
- [ ] **Test 3**: All plugins pass validation
- [ ] **Test 4**: Marketplace generates correctly
- [ ] **Test 5**: Stack plugin loads in Claude Code
- [ ] **Test 6**: Skill plugin loads in Claude Code
- [ ] **Test 7**: Hooks file is valid
- [ ] **Test 8**: All automated tests pass

**Tested by**: **\*\***\_\_\_**\*\***
**Date**: **\*\***\_\_\_**\*\***
**Notes**: **\*\***\_\_\_**\*\***
