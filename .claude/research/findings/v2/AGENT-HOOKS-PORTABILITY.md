# Agent Hooks Portability Research

> **Created**: 2026-01-26
> **Status**: Proposal
> **Related**: `AGENT-HOOKS-RESEARCH.md`, `src/docs/TODO.md` (backlog)

---

## Problem Statement

Agent-level hooks are defined in the **agent** (generic, lives in marketplace) but execute in the **project** (specific, user's repository). This creates a portability problem:

```
Agent hook: "bun run format"
     ↓
Executes in user's Python project → FAILS (no bun, no package.json)
Executes in user's npm project   → FAILS (bun not installed)
Executes in user's Go project    → FAILS
```

The CLI having bun installed doesn't help - hooks execute in the **project's working directory**, not the CLI's environment.

---

## Analysis: What Hooks Can Safely Do

### Portable (Agent-Level Safe)

| Hook Type                       | Why It's Portable                                  |
| ------------------------------- | -------------------------------------------------- |
| **Security validation**         | Uses basic shell: `grep`, `test`, pattern matching |
| **Prompt-based checks**         | Uses Claude itself (always available)              |
| **Echo/logging**                | Universal shell commands                           |
| **File existence checks**       | `test -f`, `[ -d ]`                                |
| **Blocking dangerous patterns** | Regex on `$TOOL_INPUT_COMMAND`                     |

### Not Portable (Requires Project Context)

| Hook Type          | Why It's Not Portable                               |
| ------------------ | --------------------------------------------------- |
| **Format code**    | Requires prettier/eslint + specific package manager |
| **Run linters**    | Project-specific config and tools                   |
| **Run tests**      | vitest vs jest vs mocha vs pytest vs go test        |
| **Type checking**  | tsc vs mypy vs go vet                               |
| **Build commands** | Completely project-specific                         |

---

## Current Claude Code Limitation

Hook matchers work on **tool operations**, not agents:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write|Edit", "command": "..." },
      { "matcher": "Write(*.tsx)", "command": "..." },
      { "matcher": "Bash(npm *)", "command": "..." }
    ]
  }
}
```

**Available environment variables:**

- `$CLAUDE_PROJECT_DIR` - Project root
- `$TOOL_INPUT_FILE_PATH` - File being operated on
- `$TOOL_INPUT_COMMAND` - Bash command (if Bash tool)
- `$TOOL_OUTPUT` - Tool output (PostToolUse only)

**Missing:** `$CLAUDE_AGENT_NAME` or similar. Hooks don't know which agent triggered them.

This means project-level hooks in `.claude/settings.json` apply to ALL agents uniformly.

---

## Proposed Solution: Compile-Time Hook Injection

### Key Insight

We don't know which agent is running at **hook execution time** (Claude Code limitation), but we DO know which agent we're compiling at **plugin compilation time**.

### Design

#### 1. Project Defines Agent-Hook Mappings

```yaml
# .claude/agent-hooks.yaml (in user's project)
version: 1

# Optional: override package manager detection
packageManager: npm # npm | yarn | pnpm | bun (auto-detected if omitted)

agents:
  frontend-developer:
    PostToolUse:
      - matcher: "Write|Edit(*.tsx|*.ts|*.jsx|*.js)"
        script: "format"
      - matcher: "Write|Edit(*.scss|*.css)"
        script: "format:styles"

  backend-developer:
    PostToolUse:
      - matcher: "Write|Edit"
        script: "lint:fix"

  tester:
    PostToolUse:
      - matcher: "Write(*test*|*spec*)"
        script: "test:related"
```

#### 2. Project Has Standard Scripts

```json
// package.json
{
  "scripts": {
    "format": "prettier --write",
    "format:styles": "stylelint --fix",
    "lint:fix": "eslint --fix",
    "test:related": "vitest related"
  }
}
```

#### 3. CLI Merges at Compile Time

When `cc init` or `cc compile` runs:

1. CLI reads `.claude/agent-hooks.yaml` from project (if exists)
2. CLI detects package manager from lockfile
3. For each agent, CLI merges project hooks into agent frontmatter
4. Script references are converted to full commands

#### 4. Compiled Output

```yaml
# .claude/agents/frontend-developer.md (compiled output)
---
name: frontend-developer
description: Implements frontend features from specs
tools: Read, Write, Edit, Grep, Glob, Bash
hooks:
  PostToolUse:
    - matcher: "Write|Edit(*.tsx|*.ts|*.jsx|*.js)"
      hooks:
        - type: command
          command: "npm run format -- $TOOL_INPUT_FILE_PATH"
    - matcher: "Write|Edit(*.scss|*.css)"
      hooks:
        - type: command
          command: "npm run format:styles -- $TOOL_INPUT_FILE_PATH"
---
```

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S PROJECT                           │
├─────────────────────────────────────────────────────────────────┤
│  package.json          .claude/agent-hooks.yaml                 │
│  ├─ scripts:           ├─ agents:                               │
│  │  └─ format          │  └─ frontend-developer:                │
│  │  └─ lint:fix        │      └─ PostToolUse:                   │
│  │  └─ test            │          └─ script: "format"           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   cc compile    │
                    │   (or cc init)  │
                    └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ frontend-dev.md │ │ backend-dev.md  │ │   tester.md     │
│ hooks:          │ │ hooks:          │ │ hooks:          │
│  npm run format │ │  npm run lint   │ │  npm run test   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Schema: agent-hooks.yaml

```yaml
# yaml-language-server: $schema=../../../schemas/agent-hooks.schema.json
version: 1

# Optional: override auto-detection
packageManager: npm # npm | yarn | pnpm | bun

agents:
  <agent-id>:
    PreToolUse:
      - matcher: "<tool-pattern>"
        script: "<package.json script name>"
        args: "--additional-args" # optional
    PostToolUse:
      - matcher: "<tool-pattern>"
        script: "<script-name>"
    Stop:
      - script: "<script-name>"
```

### Field Definitions

| Field                     | Type   | Required | Description                                       |
| ------------------------- | ------ | -------- | ------------------------------------------------- |
| `version`                 | number | Yes      | Schema version (currently 1)                      |
| `packageManager`          | enum   | No       | Override detection: `npm`, `yarn`, `pnpm`, `bun`  |
| `agents`                  | object | Yes      | Map of agent ID to hook configuration             |
| `agents.<id>.PreToolUse`  | array  | No       | Hooks before tool execution                       |
| `agents.<id>.PostToolUse` | array  | No       | Hooks after tool execution                        |
| `agents.<id>.Stop`        | array  | No       | Hooks when agent completes                        |
| `matcher`                 | string | No       | Tool pattern (e.g., `Write\|Edit`, `Bash(npm *)`) |
| `script`                  | string | Yes      | Name of script in package.json                    |
| `args`                    | string | No       | Additional arguments to append                    |

---

## Package Manager Detection

CLI detects package manager by checking for lockfiles in order:

1. `bun.lockb` → bun
2. `pnpm-lock.yaml` → pnpm
3. `yarn.lock` → yarn
4. `package-lock.json` → npm

If none found and `packageManager` not specified, skip script-based hooks with warning.

---

## Implementation Plan

### Phase 1: Schema & Types

1. Create `src/schemas/agent-hooks.schema.json`
2. Add TypeScript types to `src/cli/types-matrix.ts`
3. Add validation function

**Effort:** ~1 hour

### Phase 2: Package Manager Detection

1. Add `detectPackageManager()` to `src/cli/lib/`
2. Handle edge cases (monorepos, no lockfile)

**Effort:** ~30 minutes

### Phase 3: Config Loader

1. Add `loadAgentHooksConfig()` function
2. Parse and validate `.claude/agent-hooks.yaml`
3. Return null if file doesn't exist (optional feature)

**Effort:** ~1 hour

### Phase 4: Compiler Integration

1. Update `stack-plugin-compiler.ts`
2. Add `mergeProjectHooks()` function
3. Convert script references to commands
4. Inject into agent frontmatter during compilation

**Effort:** ~2 hours

### Phase 5: Documentation & Testing

1. Add to CLI-REFERENCE.md
2. Create example agent-hooks.yaml
3. Add test cases

**Effort:** ~1-2 hours

**Total Estimate:** ~6-8 hours

---

## Benefits

| Benefit                         | How                                             |
| ------------------------------- | ----------------------------------------------- |
| **Portable agents**             | Base agents have no tooling-specific hooks      |
| **Project-specific tooling**    | Uses project's own package.json scripts         |
| **Agent-aware**                 | Each agent gets different hooks at compile time |
| **Package manager agnostic**    | CLI detects npm/yarn/pnpm/bun from lockfile     |
| **Standard convention**         | Points to scripts, not raw commands             |
| **No runtime detection needed** | Resolved at compile time                        |
| **Optional feature**            | Projects without config file work normally      |

---

## Agent-Level Hooks (Still Recommended)

Agent definitions should still include **portable** hooks:

```yaml
# In agent definition (marketplace)
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: |
            if echo "$TOOL_INPUT_COMMAND" | grep -qE "rm -rf /"; then
              echo "BLOCKED: Dangerous command"
              exit 2
            fi
  Stop:
    - hooks:
        - type: prompt
          prompt: "Check for over-engineering patterns"
```

These are additive - project hooks merge with agent hooks, they don't replace them.

---

## Hook Precedence

When both agent and project define hooks for the same event:

1. **Agent hooks execute first** (security, prompts)
2. **Project hooks execute second** (formatting, linting)

This ensures security hooks can't be bypassed by project configuration.

---

## What If Hooks Change?

User updates `.claude/agent-hooks.yaml` → runs `cc compile` → agents recompiled with new hooks.

Same flow as updating skills or agents. No runtime overhead.

---

## Alternatives Considered

### 1. Runtime Agent Detection

Have hooks check an environment variable for current agent.

**Rejected:** Claude Code doesn't expose agent context to hooks.

### 2. Wrapper Script Router

All hooks call a router script that reads config.

**Rejected:** Still can't determine which agent is running.

### 3. File-Path-Based Routing

Route based on file location (e.g., `src/components/` → frontend formatting).

**Limited:** Works for some projects, not universal. Doesn't handle shared files.

### 4. Feature Request to Anthropic

Request `$CLAUDE_AGENT_ID` environment variable in hooks.

**Future:** Would simplify this, but compile-time solution works today.

---

## Related Files

| File                                   | Purpose                                            |
| -------------------------------------- | -------------------------------------------------- |
| `AGENT-HOOKS-RESEARCH.md`              | Existing hook research (events, schemas, examples) |
| `src/schemas/agent.schema.json`        | Agent schema with hooks support                    |
| `src/cli/lib/stack-plugin-compiler.ts` | Compiler to modify                                 |
| `landscape-hooks-automation.md`        | Claude Code hook documentation                     |
