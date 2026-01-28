# Manual Testing Guide - Simplified Plugin Architecture

> **Purpose**: Test all CLI functionality after the simplified plugin architecture migration.
> **Created**: 2026-01-26
> **Architecture**: One plugin per project (no more stacks or `cc switch`)

---

## Prerequisites

```bash
# Ensure you're in the project root
cd /home/vince/dev/claude-subagents

# Verify tests pass
bun test

# Expected: All 323+ tests pass
```

---

## Test Environment Setup

Create a temporary test directory for each test session:

```bash
# Create isolated test directory
mkdir -p /tmp/cc-test && cd /tmp/cc-test

# Verify clean state
ls -la
# Expected: Empty directory (or just . and ..)
```

---

## 1. Help & Version Commands

### 1.1 Global Help

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts --help
```

**Expected output:**

```
Usage: cc [options] [command]

Claude Collective CLI - Manage skills, plugins, and agents

Options:
  -V, --version     output the version number
  --dry-run         Preview operations without executing
  -h, --help        display help for command

Commands:
  init [options]    Initialize Claude Collective in this project
  edit [options]    Edit skills in the plugin
  update [options]  Update plugin from marketplace
  compile [options] Compile agents with skills
  compile-plugins   Compile skills to individual plugins
  compile-stack     Compile a stack template to a plugin
  generate-marketplace  Generate marketplace.json from compiled plugins
  validate          Validate YAML files against schemas, or validate compiled plugins
  list|ls           Show plugin information
  config            Manage Claude Collective configuration
  version           Manage plugin versions
  help [command]    display help for command
```

**Verify:**

- [ ] No `switch` command listed
- [ ] Description says "Manage skills, plugins, and agents"

### 1.2 CLI Version

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts --version
```

**Expected output:**

```
0.1.0
```

---

## 2. Configuration Commands

### 2.1 Show Configuration

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts config show
```

**Expected output (fresh project):**

```
Claude Collective Configuration

Source:
  github:claude-collective/skills
  (from default)

Configuration Layers:

  1. Environment (CC_SOURCE):
     (not set)
  2. Project config:
     /tmp/cc-test/.claude-collective/config.yaml
     (not configured)
  3. Global config:
     ~/.config/claude-collective/config.yaml
     (not configured)
  4. Default:
     github:claude-collective/skills
```

### 2.2 Set Global Config

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts config set source "github:myorg/myrepo"
```

**Expected output:**

```
✔ Set source = github:myorg/myrepo (global)
```

### 2.3 Get Config Value

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts config get source
```

**Expected output:**

```
source: github:myorg/myrepo
```

### 2.4 Unset Global Config

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts config unset source
```

**Expected output:**

```
✔ Removed source from global config
```

### 2.5 Config Path

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts config path
```

**Expected output:**

```
Configuration file paths:

Global: ~/.config/claude-collective/config.yaml
Project: /tmp/cc-test/.claude-collective/config.yaml
```

---

## 3. Initialize Plugin (`cc init`)

### 3.1 Init with Local Source (Interactive Wizard)

```bash
cd /tmp/cc-test
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --source /home/vince/dev/claude-subagents
```

**Expected behavior:**

1. Shows "Claude Collective Setup" intro
2. Displays skill selection wizard with categories
3. After selections, shows summary:
   - Plugin path: `.claude/plugins/claude-collective/`
   - Number of skills selected
   - Number of agents compiled

**Verify after completion:**

```bash
# Check plugin structure
ls -la .claude/plugins/claude-collective/
```

**Expected structure:**

```
.claude/plugins/claude-collective/
├── plugin.json          # Plugin manifest
├── skills/              # Copied skills
│   └── <skill-folders>
└── agents/              # Compiled agents
    └── <agent>.md
```

### 3.2 Verify Plugin Manifest

```bash
cat .claude/plugins/claude-collective/plugin.json | head -20
```

**Expected fields:**

```json
{
  "name": "claude-collective",
  "version": "1.0.0",
  "type": "stack",
  "skills": [...],
  "agents": [...],
  "created_at": "...",
  "updated_at": "..."
}
```

### 3.3 Init with Template (Non-Interactive)

```bash
# Clean up first
rm -rf /tmp/cc-test && mkdir /tmp/cc-test && cd /tmp/cc-test

# Init with specific template
bun /home/vince/dev/claude-subagents/src/cli/index.ts init \
  --source /home/vince/dev/claude-subagents \
  --template fullstack-react
```

**Expected:**

- Skips wizard, uses template's predefined skills
- Shows "Claude Collective initialized successfully!"

### 3.4 Init When Plugin Already Exists

```bash
# Run init again in same directory
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --source /home/vince/dev/claude-subagents
```

**Expected:**

```
✖ Plugin already exists. Use 'cc edit' to modify skills.
```

---

## 4. List Plugin Info (`cc list`)

### 4.1 List When Plugin Exists

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts list
```

**Expected output:**

```
◆  Plugin: claude-collective
   Version: 1.0.0
   Skills: <count> installed
   Agents: <count> compiled
   Path: .claude/plugins/claude-collective
```

### 4.2 List Alias (ls)

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts ls
```

**Expected:** Same output as `list`

### 4.3 List When No Plugin

```bash
rm -rf /tmp/cc-test && mkdir /tmp/cc-test && cd /tmp/cc-test
bun /home/vince/dev/claude-subagents/src/cli/index.ts list
```

**Expected:**

```
◇ No plugin found.
◇ Run cc init to create one.
```

---

## 5. Edit Plugin Skills (`cc edit`)

### 5.1 Edit Existing Plugin

```bash
# First, ensure plugin exists
cd /tmp/cc-test
bun /home/vince/dev/claude-subagents/src/cli/index.ts init \
  --source /home/vince/dev/claude-subagents \
  --template minimal-backend

# Now edit
bun /home/vince/dev/claude-subagents/src/cli/index.ts edit --source /home/vince/dev/claude-subagents
```

**Expected behavior:**

1. Shows "Edit Plugin Skills" intro
2. Displays wizard with current skills pre-selected
3. Allows adding/removing skills
4. Recompiles agents after changes
5. Bumps plugin version

**Verify:**

```bash
cat .claude/plugins/claude-collective/plugin.json | grep version
```

**Expected:** Version incremented (e.g., "1.0.1" or "1.1.0")

### 5.2 Edit When No Plugin

```bash
rm -rf /tmp/cc-test && mkdir /tmp/cc-test && cd /tmp/cc-test
bun /home/vince/dev/claude-subagents/src/cli/index.ts edit --source /home/vince/dev/claude-subagents
```

**Expected:**

```
✖ No plugin found. Run 'cc init' first to set up the plugin.
```

---

## 6. Update Plugin (`cc update`)

### 6.1 Update From Marketplace

```bash
cd /tmp/cc-test
# Ensure plugin exists first
bun /home/vince/dev/claude-subagents/src/cli/index.ts init \
  --source /home/vince/dev/claude-subagents \
  --template fullstack-react

# Update
bun /home/vince/dev/claude-subagents/src/cli/index.ts update --source /home/vince/dev/claude-subagents
```

**Expected:**

- Refreshes skills from source
- Shows skills that were updated (if any)
- Recompiles agents

---

## 7. Compile Commands

### 7.1 Compile Agents (`cc compile`)

```bash
cd /home/vince/dev/claude-subagents
bun src/cli/index.ts compile
```

**Expected:**

- Compiles all agents from `src/agents/`
- Outputs to `.claude/agents/`
- Shows success message with agent count

### 7.2 Compile All Skills to Plugins (`cc compile-plugins`)

```bash
cd /home/vince/dev/claude-subagents
bun src/cli/index.ts compile-plugins
```

**Expected:**

- Compiles each skill to individual plugin
- Outputs to `dist/plugins/skills/`
- Shows count (e.g., "Compiled 83 skill plugins")

### 7.3 Compile Single Skill

```bash
bun src/cli/index.ts compile-plugins --skill frontend-react
```

**Expected:**

- Compiles only the specified skill
- Shows "Compiled 1 skill plugin"

### 7.4 Compile Stack Template (`cc compile-stack`)

```bash
bun src/cli/index.ts compile-stack -s fullstack-react
```

**Expected:**

- Compiles stack template to plugin
- Outputs to `dist/plugins/stacks/fullstack-react/`
- Shows skill and agent counts

### 7.5 Compile All Stack Templates

```bash
bun src/cli/index.ts compile-stack --all
```

**Expected:**

- Compiles all 13 stack templates
- Shows summary for each

---

## 8. Generate Marketplace

```bash
cd /home/vince/dev/claude-subagents
bun src/cli/index.ts generate-marketplace
```

**Expected:**

- Generates `dist/marketplace.json`
- Shows plugin counts by type

**Verify:**

```bash
cat dist/marketplace.json | head -30
```

---

## 9. Validate Commands

### 9.1 Validate YAML Schemas

```bash
cd /home/vince/dev/claude-subagents
bun src/cli/index.ts validate
```

**Expected:**

- Validates all YAML files against schemas
- Shows pass/fail count
- Exit code 0 if all valid

### 9.2 Validate Single Plugin

```bash
bun src/cli/index.ts validate dist/plugins/skills/frontend-react
```

**Expected:**

- Validates plugin structure
- Shows validation result

### 9.3 Validate All Plugins

```bash
bun src/cli/index.ts validate dist/plugins --all
```

**Expected:**

- Validates all plugins in directory
- Shows summary

---

## 10. Version Commands

### 10.1 Show Plugin Version

```bash
cd /tmp/cc-test
bun /home/vince/dev/claude-subagents/src/cli/index.ts init \
  --source /home/vince/dev/claude-subagents \
  --template minimal-backend

bun /home/vince/dev/claude-subagents/src/cli/index.ts version
```

**Expected:**

```
Plugin version: 1.0.0
```

### 10.2 Bump Patch Version

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts version patch
```

**Expected:**

```
Version bumped: 1.0.0 → 1.0.1
```

### 10.3 Bump Minor Version

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts version minor
```

**Expected:**

```
Version bumped: 1.0.1 → 1.1.0
```

### 10.4 Bump Major Version

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts version major
```

**Expected:**

```
Version bumped: 1.1.0 → 2.0.0
```

### 10.5 Set Specific Version

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts version set 3.0.0
```

**Expected:**

```
Version set: 2.0.0 → 3.0.0
```

---

## 11. Removed Commands (Should NOT Exist)

### 11.1 Switch Command (REMOVED)

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts switch
```

**Expected:**

```
error: unknown command 'switch'
```

---

## 12. Error Handling

### 12.1 Ctrl+C Handling

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --source /home/vince/dev/claude-subagents
# Press Ctrl+C during wizard
```

**Expected:**

```
Cancelled
```

**Exit code:** 4

### 12.2 Invalid Source

```bash
bun /home/vince/dev/claude-subagents/src/cli/index.ts init --source /nonexistent/path
```

**Expected:** Error message about invalid source

---

## 13. Available Templates

These templates can be used with `--template`:

| Template                | Description                   |
| ----------------------- | ----------------------------- |
| `fullstack-react`       | Full React stack with backend |
| `work-stack`            | Work-specific configuration   |
| `modern-react`          | Modern React patterns         |
| `vue-stack`             | Vue.js stack                  |
| `angular-stack`         | Angular stack                 |
| `enterprise-react`      | Enterprise React patterns     |
| `full-observability`    | Observability focus           |
| `minimal-backend`       | Minimal backend setup         |
| `mobile-stack`          | Mobile development            |
| `modern-react-tailwind` | React with Tailwind           |
| `nuxt-stack`            | Nuxt.js stack                 |
| `remix-stack`           | Remix stack                   |
| `solidjs-stack`         | SolidJS stack                 |

---

## Exit Codes Reference

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success                 |
| 1    | General error           |
| 2    | Invalid arguments       |
| 3    | Network/auth error      |
| 4    | User cancelled (Ctrl+C) |

---

## Quick Test Script

Copy and run this script for a quick validation:

```bash
#!/bin/bash
set -e

CLI="/home/vince/dev/claude-subagents/src/cli/index.ts"
TEST_DIR="/tmp/cc-quick-test"

echo "=== Quick CLI Test ==="

# Clean
rm -rf $TEST_DIR && mkdir -p $TEST_DIR && cd $TEST_DIR

# 1. Help
echo "1. Testing help..."
bun $CLI --help | grep -q "Manage skills, plugins, and agents" && echo "   ✓ Help works"

# 2. Init
echo "2. Testing init..."
bun $CLI init --source /home/vince/dev/claude-subagents --template minimal-backend
[ -f ".claude/plugins/claude-collective/plugin.json" ] && echo "   ✓ Plugin created"

# 3. List
echo "3. Testing list..."
bun $CLI list | grep -q "claude-collective" && echo "   ✓ List works"

# 4. Version
echo "4. Testing version..."
bun $CLI version patch
cat .claude/plugins/claude-collective/plugin.json | grep -q "1.0.1" && echo "   ✓ Version bump works"

# 5. Switch should fail
echo "5. Testing switch removed..."
bun $CLI switch 2>&1 | grep -q "unknown command" && echo "   ✓ Switch correctly removed"

echo ""
echo "=== All tests passed! ==="
```

---

## Cleanup

```bash
rm -rf /tmp/cc-test /tmp/cc-quick-test
```
