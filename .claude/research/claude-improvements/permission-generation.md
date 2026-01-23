# Permission Generation from Agent Tools

> **Feature**: Auto-generate permission rules from agent tool definitions
> **Introduced**: Wildcard permissions in Claude Code v2.1.0
> **Priority**: MEDIUM
> **Status**: Research Complete

---

## What It Is

Automatically generate permission rules (allow/deny) based on the tools defined in an agent's YAML. If an agent only lists `Read`, `Grep`, `Glob`, it should be denied `Write`, `Edit`, `Bash`.

## Why It Matters For Us

**Current Problem:**

- Agent tool restrictions are advisory only
- Nothing enforces that `backend-researcher` can't write files
- Manual permission configuration is tedious

**Solution:**

- Parse agent's `tools:` array
- Generate permission rules automatically
- Enforce restrictions at runtime

## Wildcard Permission Syntax (v2.1.0)

Claude Code now supports wildcards in permission rules:

| Pattern            | Matches                           |
| ------------------ | --------------------------------- |
| `Bash(npm *)`      | Any npm command                   |
| `Bash(* install)`  | Commands ending in "install"      |
| `Bash(git * main)` | Git commands involving main       |
| `Bash(ls:*)`       | ls with any flags (word boundary) |
| `Read(src/**)`     | Read any file under src/          |
| `Write(*.tsx)`     | Write to any .tsx file            |

The `:*` suffix enforces word boundary matching.

## Agent Tool Definitions

### Current Format

```yaml
# src/agents/researcher/backend-researcher/agent.yaml
name: backend-researcher
description: Read-only backend research
tools:
  - Read
  - Grep
  - Glob
  - Bash # But should be restricted!
```

### Enhanced Format

```yaml
name: backend-researcher
description: Read-only backend research
tools:
  - Read
  - Grep
  - Glob
  - Bash(git log*)
  - Bash(git show*)
  - Bash(git diff*)
```

This explicitly allows only specific Bash commands.

## Implementation Plan

### 1. Schema Update

Enhance tools to support wildcards:

```json
// agent.schema.json
{
  "properties": {
    "tools": {
      "type": "array",
      "items": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "pattern": { "type": "string" }
            }
          }
        ]
      }
    }
  }
}
```

### 2. Permission Generation Logic

```typescript
function generatePermissions(agent: Agent): Permissions {
  const allTools = [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep",
    "WebFetch",
    "WebSearch",
  ];

  const allowed = agent.tools;
  const denied = allTools.filter((t) => !isToolAllowed(t, allowed));

  return {
    allow: allowed.map(formatPermission),
    deny: denied.map((t) => `${t}(*)`),
  };
}

function isToolAllowed(tool: string, allowed: string[]): boolean {
  return allowed.some((a) => {
    if (a === tool) return true;
    if (a.startsWith(`${tool}(`)) return true;
    return false;
  });
}
```

### 3. Generated Output

For `backend-researcher`:

```json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Grep(*)",
      "Glob(*)",
      "Bash(git log*)",
      "Bash(git show*)",
      "Bash(git diff*)"
    ],
    "deny": ["Write(*)", "Edit(*)", "Bash(*)", "WebFetch(*)", "WebSearch(*)"]
  }
}
```

**Note:** `Bash(*)` is denied but specific patterns are allowed - specific rules take precedence.

## Agent Permission Profiles

### Read-Only Researcher

```yaml
tools:
  - Read
  - Grep
  - Glob
  - Bash(git log*)
  - Bash(git show*)
```

### Frontend Developer

```yaml
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(bun *)
  - Bash(npm *)
  - Bash(pnpm *)
```

### Backend Developer

```yaml
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(bun *)
  - Bash(docker *)
  - Bash(git *)
```

### Pattern Scout (Read-Only)

```yaml
tools:
  - Read
  - Grep
  - Glob
```

## Permission Warnings

Claude Code v2.1.3 added detection of unreachable permission rules:

- Warns in `/doctor` output
- Shows source of conflicting rules
- Provides actionable fix guidance

Our compiler should validate generated rules don't conflict.

## Security Considerations

1. **Deny by default** - If tool not listed, it's denied
2. **Specific over general** - `Bash(git *)` allows git even if `Bash(*)` denied
3. **No bypass** - Permissions enforced at runtime, not just advisory
4. **Audit trail** - Log permission denials for debugging

## Integration with Hooks

Permissions and hooks complement each other:

- **Permissions**: Binary allow/deny
- **Hooks**: Conditional logic, logging, modification

```yaml
# Use both
tools:
  - Edit

hooks:
  PreToolUse:
    - matcher: "Edit"
      command: "echo 'About to edit: $TOOL_INPUT_FILE_PATH'"
```

## Related Features

- **Hooks Frontmatter**: Can implement soft enforcement via hooks
- **Context Forking**: Forked contexts have separate permission scopes

## References

- [Claude Code Settings - Permissions](https://code.claude.com/docs/en/settings#permissions)
- [Permission Rule Warnings - v2.1.3](https://github.com/anthropics/claude-code/releases/tag/v2.1.3)
