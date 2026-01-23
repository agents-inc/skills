# Hooks in Agent Frontmatter

> **Feature**: Agent-scoped PreToolUse/PostToolUse/Stop hooks
> **Introduced**: Claude Code v2.1.0 (January 2026)
> **Priority**: HIGH
> **Status**: Research Complete

---

## What It Is

You can now add `PreToolUse`, `PostToolUse`, and `Stop` hooks directly in agent YAML frontmatter. These hooks **only run during that specific agent's lifecycle**.

## Why It Matters For Us

**Current Problem:**

- Hooks defined globally in `settings.json` or `hooks/hooks.json`
- No way to have agent-specific automation
- Can't enforce different rules for different agents

**Solution:**

- Define hooks per agent in frontmatter
- Lint after frontend-developer edits
- Type-check after backend-developer writes
- Verification hooks for specific agents

## Hook Types

| Hook          | When It Runs           | Use Cases                         |
| ------------- | ---------------------- | --------------------------------- |
| `PreToolUse`  | Before a tool executes | Validation, logging, blocking     |
| `PostToolUse` | After a tool completes | Linting, formatting, verification |
| `Stop`        | When agent completes   | Cleanup, summary, notifications   |

## Implementation

### Agent Frontmatter Example

```yaml
# src/agents/developer/frontend-developer/agent.yaml
name: frontend-developer
description: Implements frontend features from specs
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash

hooks:
  PreToolUse:
    - matcher: "Edit"
      command: "echo 'Editing: $TOOL_INPUT_FILE_PATH'"

  PostToolUse:
    - matcher: "Write"
      command: "bun run lint --fix $TOOL_INPUT_FILE_PATH"
    - matcher: "Edit"
      command: "bun run prettier --write $TOOL_INPUT_FILE_PATH"

  Stop:
    - command: "echo 'Frontend developer completed'"
```

### Hook Schema

```json
{
  "hooks": {
    "type": "object",
    "properties": {
      "PreToolUse": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "matcher": { "type": "string" },
            "command": { "type": "string" }
          },
          "required": ["command"]
        }
      },
      "PostToolUse": { "...same structure..." },
      "Stop": { "...same structure..." }
    }
  }
}
```

### Matcher Patterns

| Pattern           | Matches                                |
| ----------------- | -------------------------------------- |
| `Edit`            | Any Edit tool call                     |
| `Bash(npm test*)` | Bash commands starting with `npm test` |
| `Write(*.tsx)`    | Write to any .tsx file                 |
| `*` or omitted    | All tool calls of that type            |

## Use Cases by Agent

### Frontend Developer

```yaml
hooks:
  PostToolUse:
    - matcher: "Write(*.tsx)"
      command: "bun run lint --fix $TOOL_INPUT_FILE_PATH"
    - matcher: "Edit(*.tsx)"
      command: "bun run prettier --write $TOOL_INPUT_FILE_PATH"
```

### Backend Developer

```yaml
hooks:
  PostToolUse:
    - matcher: "Write(*.ts)"
      command: "bun tsc --noEmit $TOOL_INPUT_FILE_PATH"
    - matcher: "Edit(**/api/**)"
      command: "bun run lint:api $TOOL_INPUT_FILE_PATH"
```

### Tester

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash(bun test*)"
      command: "echo 'Running tests...'"
  PostToolUse:
    - matcher: "Bash(bun test*)"
      command: "echo 'Tests completed'"
```

### Reviewer (Read-Only Enforcement)

```yaml
hooks:
  PreToolUse:
    - matcher: "Write"
      command: "exit 1" # Block writes
    - matcher: "Edit"
      command: "exit 1" # Block edits
```

## Environment Variables in Hooks

| Variable                | Description                         |
| ----------------------- | ----------------------------------- |
| `$TOOL_INPUT_FILE_PATH` | File path being operated on         |
| `$TOOL_INPUT_COMMAND`   | Bash command being run              |
| `$TOOL_OUTPUT`          | Output from tool (PostToolUse only) |

## Implementation Plan

### 1. Schema Update

Add hooks to agent schema:

```json
// agent.schema.json
{
  "properties": {
    "hooks": {
      "type": "object",
      "properties": {
        "PreToolUse": { "$ref": "#/definitions/hookArray" },
        "PostToolUse": { "$ref": "#/definitions/hookArray" },
        "Stop": { "$ref": "#/definitions/hookArray" }
      }
    }
  },
  "definitions": {
    "hookArray": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "matcher": { "type": "string" },
          "command": { "type": "string" }
        },
        "required": ["command"]
      }
    }
  }
}
```

### 2. Compiler Changes

The stack-plugin-compiler should:

1. Extract hooks from each agent's YAML
2. Generate consolidated `hooks/hooks.json` in plugin output
3. Scope hooks to their respective agents

### 3. Generated hooks.json

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matcher": "Edit",
      "command": "bun run lint --fix $TOOL_INPUT_FILE_PATH",
      "agent": "frontend-developer"
    },
    {
      "event": "PostToolUse",
      "matcher": "Write",
      "command": "bun tsc --noEmit",
      "agent": "backend-developer"
    }
  ]
}
```

## Hook Precedence

When multiple hooks match:

1. Agent-specific hooks run first
2. Global hooks run after
3. Within same level, order is preserved

## Related Features

- **Permission Generation**: Hooks can enforce permissions
- **Context Forking**: Hooks run in main context even for forked skills

## References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code v2.1.0 Release Notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.0)
