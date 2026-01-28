# Plugin Architecture Migration Testing Guide

> **Purpose**: Comprehensive testing of the new plugin architecture (Phases 1-5)
> **Created**: 2026-01-23
> **Prerequisites**: All phases implemented, 316 tests passing

---

## What Changed

The plugin architecture migration introduced these key changes:

| Before                                               | After                                      |
| ---------------------------------------------------- | ------------------------------------------ |
| `skills: ["skill-react", ...]` (array of references) | `skills: "./skills/"` (embedded directory) |
| `cc init` created `.claude-collective/`              | `cc init` creates `~/.claude/plugins/`     |
| `cc add` created new stacks                          | `cc add` adds skills to existing plugins   |
| `cc switch` changed active stack                     | Command removed (deprecated)               |
| Classic mode vs plugin mode                          | Plugin mode only                           |

---

## Test Suite Overview

| Test                   | Priority | What It Verifies                             |
| ---------------------- | -------- | -------------------------------------------- |
| 1. Embedded Skills     | CRITICAL | Stack plugins contain `skills/` directory    |
| 2. Plugin Manifest     | CRITICAL | `skills: "./skills/"` not an array           |
| 3. cc init             | HIGH     | Creates complete plugin with skills + agents |
| 4. cc add              | HIGH     | Adds skill to existing plugin                |
| 5. cc compile --plugin | MEDIUM   | Recompiles using local skills                |
| 6. Deprecated Removal  | MEDIUM   | `switch` command removed                     |
| 7. Full E2E            | CRITICAL | Plugin works in Claude Code                  |

---

## Test 1: Embedded Skills Directory (CRITICAL)

Verifies Phase 1 - stack plugins embed skills directly.

### Run

```bash
cd /home/vince/dev/claude-subagents

# Clean and compile stack
rm -rf dist/stacks/fullstack-react
bun src/cli/index.ts compile-stack -s fullstack-react
```

### Verify Directory Structure

```bash
# Check skills directory exists in output
ls -la dist/stacks/fullstack-react/

# Expected output should include:
#   .claude-plugin/
#   agents/
#   skills/        <-- NEW: embedded skills directory
#   CLAUDE.md
#   README.md
```

### Verify Skills Content

```bash
# List skill categories
ls dist/stacks/fullstack-react/skills/

# Expected: backend, frontend, research, security, setup, shared

# Check a specific skill exists with content
ls "dist/stacks/fullstack-react/skills/react (@vince)/"

# Expected: SKILL.md, metadata.yaml, reference.md, examples/

# Verify SKILL.md has content
head -20 "dist/stacks/fullstack-react/skills/react (@vince)/SKILL.md"
```

### Pass Criteria

- [ ] `dist/stacks/fullstack-react/skills/` directory exists
- [ ] Contains skill subdirectories (backend/, frontend/, etc.)
- [ ] Skills have SKILL.md files with content
- [ ] Skills have metadata.yaml files

---

## Test 2: Plugin Manifest Format (CRITICAL)

Verifies the manifest uses path string, not array.

### Run

```bash
# View the manifest
cat dist/stacks/fullstack-react/.claude-plugin/plugin.json
```

### Expected Output

```json
{
  "name": "fullstack-react",
  "version": "1.0.0",
  "license": "MIT",
  "skills": "./skills/",
  "description": "...",
  "author": { "name": "@vince" },
  "keywords": [...],
  "agents": "./agents/"
}
```

### Verify Key Fields

```bash
# Check skills is a path string (not array)
cat dist/stacks/fullstack-react/.claude-plugin/plugin.json | grep '"skills"'

# CORRECT: "skills": "./skills/"
# WRONG:   "skills": ["skill-react", "skill-zustand", ...]

# Verify with jq (if installed)
cat dist/stacks/fullstack-react/.claude-plugin/plugin.json | jq '.skills'

# Expected: "./skills/"
# NOT: ["skill-react", ...]
```

### Pass Criteria

- [ ] `"skills": "./skills/"` (path string)
- [ ] NOT `"skills": ["skill-react", ...]` (array)
- [ ] `"agents": "./agents/"` present
- [ ] Valid JSON structure

---

## Test 3: cc init Command (HIGH)

Verifies Phase 2 - unified init creates complete plugins.

### Preparation

```bash
# Create a temp directory for testing
mkdir -p /tmp/cc-test-init
cd /tmp/cc-test-init
```

### Run Interactive Init

```bash
# Run init (will prompt for selections)
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --name test-plugin --scope user
```

### Expected Flow

1. Loads skills matrix from source
2. Runs wizard for skill selection
3. Creates plugin at `~/.claude/plugins/test-plugin/`

### Verify Output

```bash
# Check plugin was created
ls -la ~/.claude/plugins/test-plugin/

# Expected:
#   .claude-plugin/
#   skills/
#   (possibly agents/ if agent compilation is implemented)

# Check manifest
cat ~/.claude/plugins/test-plugin/.claude-plugin/plugin.json

# Check skills were copied
ls ~/.claude/plugins/test-plugin/skills/
```

### Cleanup

```bash
rm -rf ~/.claude/plugins/test-plugin
rm -rf /tmp/cc-test-init
```

### Pass Criteria

- [ ] Plugin created at `~/.claude/plugins/test-plugin/`
- [ ] Has `.claude-plugin/plugin.json`
- [ ] Has `skills/` directory with selected skills
- [ ] Manifest has `"skills": "./skills/"`

---

## Test 4: cc add Command (HIGH)

Verifies Phase 3 - adds skills to existing plugins.

### Preparation

```bash
# First, create a plugin to add to
mkdir -p ~/.claude/plugins/test-add-plugin/.claude-plugin
mkdir -p ~/.claude/plugins/test-add-plugin/skills

# Create a minimal manifest
cat > ~/.claude/plugins/test-add-plugin/.claude-plugin/plugin.json << 'EOF'
{
  "name": "test-add-plugin",
  "version": "1.0.0",
  "license": "MIT",
  "skills": "./skills/"
}
EOF
```

### Run Add Command

```bash
cd /tmp

# Try to add a skill (note: may fail if marketplace not available)
bun /home/vince/dev/claude-subagents/src/cli/index.ts add react --plugin test-add-plugin
```

### Expected Behavior

1. Finds existing plugin at `~/.claude/plugins/test-add-plugin/`
2. Checks skill doesn't already exist
3. Fetches skill from marketplace
4. Copies to `skills/` directory
5. Bumps version to `1.0.1`

### Verify

```bash
# Check skill was added
ls ~/.claude/plugins/test-add-plugin/skills/

# Check version was bumped
cat ~/.claude/plugins/test-add-plugin/.claude-plugin/plugin.json | grep version

# Expected: "version": "1.0.1"
```

### Error Cases to Test

```bash
# Test 1: No plugin found
rm -rf ~/.claude/plugins/test-add-plugin
bun /home/vince/dev/claude-subagents/src/cli/index.ts add react
# Expected: Error "No plugin found. Run 'cc init' first."

# Test 2: Skill already exists (recreate plugin first, then add same skill twice)
# Expected: Error "Skill 'react' already exists in this plugin."
```

### Cleanup

```bash
rm -rf ~/.claude/plugins/test-add-plugin
```

### Pass Criteria

- [ ] Finds existing plugin correctly
- [ ] Skill added to `skills/` directory
- [ ] Version bumped after adding
- [ ] Proper error when no plugin exists
- [ ] Proper error when skill already exists

---

## Test 5: cc compile --plugin Mode (MEDIUM)

Verifies Phase 4 - plugin mode uses local skills.

### Preparation

```bash
# Create a test plugin with local skills
mkdir -p ~/.claude/plugins/test-compile/.claude-plugin
mkdir -p ~/.claude/plugins/test-compile/skills/test-skill

# Create manifest
cat > ~/.claude/plugins/test-compile/.claude-plugin/plugin.json << 'EOF'
{
  "name": "test-compile",
  "version": "1.0.0",
  "skills": "./skills/"
}
EOF

# Create a test skill
cat > ~/.claude/plugins/test-compile/skills/test-skill/SKILL.md << 'EOF'
---
name: test-skill
description: A test skill for compilation
---

# Test Skill

This is a test skill content.
EOF
```

### Run Plugin Mode Compile

```bash
cd ~/.claude/plugins/test-compile

bun /home/vince/dev/claude-subagents/src/cli/index.ts compile --plugin -v
```

### Expected Behavior

1. Finds plugin in current directory or standard locations
2. Loads LOCAL skills from `skills/` directory (does NOT fetch)
3. Fetches agent definitions from marketplace
4. Would compile agents (currently shows "not yet fully implemented")

### Verify

```bash
# The compile should show it found local skills
# Look for output like:
#   "Loaded 1 local skills"
#   "Found plugin: test-compile"
```

### Cleanup

```bash
rm -rf ~/.claude/plugins/test-compile
```

### Pass Criteria

- [ ] Finds plugin directory
- [ ] Loads skills from local `skills/` directory
- [ ] Does NOT fetch skills from remote (key difference!)
- [ ] Fetches agent definitions from marketplace

---

## Test 6: Deprecated Code Removal (MEDIUM)

Verifies Phase 5 - classic mode removed.

### Test: switch Command Removed

```bash
# Check help output
bun /home/vince/dev/claude-subagents/src/cli/index.ts --help
```

### Expected Output

Should NOT include `switch` command:

```
Commands:
  init              Initialize Claude Collective in your project
  add               Add a skill to an existing plugin
  update            Update an existing stack
  compile           Compile agents from a stack or plugin
  compile-plugins   Compile all skills to plugins
  compile-stack     Compile a stack to a plugin
  ...
```

### Verify switch Is Gone

```bash
# Try to run switch - should fail with unknown command
bun /home/vince/dev/claude-subagents/src/cli/index.ts switch test

# Expected: error about unknown command
```

### Test: No Classic Mode in init

```bash
# The --plugin flag should no longer exist (or be ignored)
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --help
```

### Expected

- NO `--plugin` option (always plugin mode now)
- Options should include: `--name`, `--source`, `--scope`, `--refresh`

### Pass Criteria

- [ ] `switch` command not in help output
- [ ] Running `switch` gives "unknown command" error
- [ ] `--plugin` flag removed from `init`
- [ ] `init` always creates plugins (not `.claude-collective/`)

---

## Test 7: Full End-to-End (CRITICAL)

The ultimate test - does it work in Claude Code?

### Step 1: Compile Fresh Stack

```bash
cd /home/vince/dev/claude-subagents

# Clean compile
rm -rf dist/stacks/fullstack-react
bun src/cli/index.ts compile-stack -s fullstack-react
```

### Step 2: Validate the Output

```bash
bun src/cli/index.ts validate dist/stacks/fullstack-react
```

### Expected

```
Plugin Validation Summary:
  Valid: Yes
  Warnings: 0
  Errors: 0
```

### Step 3: Install to Claude Plugins

```bash
# Remove any old version
rm -rf ~/.claude/plugins/fullstack-react

# Copy the compiled plugin
cp -r dist/stacks/fullstack-react ~/.claude/plugins/
```

### Step 4: Verify Installation

```bash
# Check structure
ls -la ~/.claude/plugins/fullstack-react/

# Verify skills are embedded
ls ~/.claude/plugins/fullstack-react/skills/

# Verify agents exist
ls ~/.claude/plugins/fullstack-react/agents/
```

### Step 5: Test in Claude Code

Open a new terminal and start Claude Code:

```bash
claude
```

Then run these checks:

```
# 1. Check agents are loaded
/agents

# Expected: Should list agents like:
#   - frontend-developer
#   - backend-developer
#   - frontend-reviewer
#   - etc.

# 2. Check skills are loaded
/skills

# Expected: Should list skills from the plugin

# 3. Test an agent
Use the frontend-researcher to find all React components
```

### Pass Criteria

- [ ] Plugin installs to `~/.claude/plugins/fullstack-react/`
- [ ] Has embedded `skills/` directory (not references)
- [ ] Has compiled `agents/` directory
- [ ] Agents appear in `/agents` command
- [ ] Skills appear in `/skills` command
- [ ] Agent invocation works

---

## Quick Test Commands

```bash
# ==========================================
# QUICK VERIFICATION SCRIPT
# Run all critical checks in sequence
# ==========================================

cd /home/vince/dev/claude-subagents

echo "=== Test 1: Compile Stack ==="
rm -rf dist/stacks/fullstack-react
bun src/cli/index.ts compile-stack -s fullstack-react

echo ""
echo "=== Test 2: Check Skills Directory ==="
ls dist/stacks/fullstack-react/skills/ && echo "PASS: skills/ exists" || echo "FAIL: skills/ missing"

echo ""
echo "=== Test 3: Check Manifest Format ==="
grep '"skills": "./skills/"' dist/stacks/fullstack-react/.claude-plugin/plugin.json && echo "PASS: skills is path" || echo "FAIL: skills is not path"

echo ""
echo "=== Test 4: Validate Plugin ==="
bun src/cli/index.ts validate dist/stacks/fullstack-react

echo ""
echo "=== Test 5: Check switch Command Removed ==="
bun src/cli/index.ts --help | grep -q "switch" && echo "FAIL: switch still exists" || echo "PASS: switch removed"

echo ""
echo "=== Test 6: Run All Unit Tests ==="
bun test

echo ""
echo "=== All Quick Tests Complete ==="
```

---

## Troubleshooting

### Skills Not Embedded

**Symptom:** `dist/stacks/*/skills/` directory is empty or missing

**Check:**

```bash
# Verify source skills exist
ls /home/vince/dev/claude-subagents/src/stacks/fullstack-react/skills/
```

**Cause:** Stack source doesn't have a `skills/` directory, or copy failed

**Fix:** Ensure `src/stacks/<name>/skills/` has content

---

### Manifest Has Array Instead of Path

**Symptom:** `"skills": ["skill-react", ...]` instead of `"skills": "./skills/"`

**Check:**

```bash
cat dist/stacks/fullstack-react/.claude-plugin/plugin.json | grep skills
```

**Cause:** Phase 1 changes not applied correctly

**Fix:** Verify `plugin-manifest.ts` uses `hasSkills: true` not `skills: [...]`

---

### cc add Fails to Find Plugin

**Symptom:** "No plugin found" error

**Check:**

```bash
# Check standard locations
ls ~/.claude/plugins/
ls .claude/plugins/
```

**Cause:** Plugin not in expected location

**Fix:** Ensure plugin exists at `~/.claude/plugins/<name>/` or `.claude/plugins/<name>/`

---

### Agents Not Loading in Claude Code

**Symptom:** `/agents` shows no custom agents

**Check:**

```bash
# Verify agents directory
ls ~/.claude/plugins/fullstack-react/agents/

# Check agent frontmatter
head -20 ~/.claude/plugins/fullstack-react/agents/frontend-developer.md
```

**Cause:** Missing agents directory or invalid frontmatter

**Fix:** Ensure agents have valid YAML frontmatter with `name` and `description`

---

## Sign-Off Checklist

| Test                   | Status | Notes |
| ---------------------- | ------ | ----- |
| 1. Embedded Skills     | [ ]    |       |
| 2. Plugin Manifest     | [ ]    |       |
| 3. cc init             | [ ]    |       |
| 4. cc add              | [ ]    |       |
| 5. cc compile --plugin | [ ]    |       |
| 6. Deprecated Removal  | [ ]    |       |
| 7. Full E2E            | [ ]    |       |

**Tested By:** **\*\***\_\_\_**\*\***
**Date:** **\*\***\_\_\_**\*\***
**Build/Commit:** **\*\***\_\_\_**\*\***

---

_Last updated: 2026-01-23_
