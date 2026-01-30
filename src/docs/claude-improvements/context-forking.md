# Context Forking for Skills

> **Feature**: `context: fork` frontmatter for isolated skill execution
> **Introduced**: Claude Code v2.1.0 (January 2026)
> **Priority**: HIGH
> **Status**: Research Complete

---

## What It Is

When a skill has `context: fork` in its frontmatter, it runs in an **isolated sub-agent context** rather than the main conversation.

## Why It Matters For Us

**Current Problem:**

- Research skills (pattern-scout, researchers) read 20-50+ files during exploration
- All those file contents accumulate in the main conversation context
- Wastes tokens and clutters the conversation

**Solution:**

- Fork research skills into isolated contexts
- Only the final summary returns to main context
- Intermediate file reads are contained

## How It Works

### Visual Flow

```
Main Context                          Forked Context
─────────────                         ──────────────
User: "Find auth patterns"
  │
  └──► Skill invoked (context: fork)
                                      ├─ Read src/auth/index.ts
                                      ├─ Read src/middleware/auth.ts
                                      ├─ Grep "session" across codebase
                                      ├─ Read 15 more files...
                                      └─ Summarize findings
  ◄────────────────────────────────────┘

Result: Only summary returns to main
(main context never sees the 20 file reads)
```

### Comparison

| Aspect               | Main Context (default)         | Forked Context            |
| -------------------- | ------------------------------ | ------------------------- |
| Conversation history | Shared with main chat          | Isolated - starts fresh   |
| File reads/searches  | Accumulate in main context     | Contained in fork         |
| Token usage          | Counts toward main limit       | Separate budget           |
| Results              | All intermediate steps visible | Only final result returns |

## Implementation

### Skill Frontmatter

```yaml
# src/skills/research/research-methodology (@vince)/SKILL.md
---
name: Research Methodology
description: Deep codebase investigation patterns
category: research
context: fork # Run in isolated context
agent: Explore # Optional: use specific agent type
---
```

### Available Options

| Field     | Type                 | Description                              |
| --------- | -------------------- | ---------------------------------------- |
| `context` | `"main"` \| `"fork"` | Execution context (default: `"main"`)    |
| `agent`   | string               | Agent type for forked context (optional) |

### Agent Types for Forking

When specifying `agent:`, use these built-in types:

| Agent Type        | Best For                  |
| ----------------- | ------------------------- |
| `Explore`         | Fast codebase exploration |
| `general-purpose` | Multi-step research tasks |
| `Plan`            | Architecture planning     |

## Skills to Fork

| Skill                  | Reason                            | Frontmatter                       |
| ---------------------- | --------------------------------- | --------------------------------- |
| `pattern-scout`        | Reads 50+ files during extraction | `context: fork`                   |
| `frontend-researcher`  | Extensive codebase exploration    | `context: fork`, `agent: Explore` |
| `backend-researcher`   | Extensive codebase exploration    | `context: fork`, `agent: Explore` |
| `research-methodology` | Deep investigation patterns       | `context: fork`                   |

## Implementation Plan

### 1. Schema Update

Add `context` and `agent` to skill frontmatter schema:

```json
// skill-frontmatter.schema.json
{
  "properties": {
    "context": {
      "type": "string",
      "enum": ["main", "fork"],
      "default": "main",
      "description": "Execution context for the skill"
    },
    "agent": {
      "type": "string",
      "description": "Agent type to use for forked context"
    }
  }
}
```

### 2. Update Research Skills

```yaml
# pattern-scout
---
name: Pattern Scout
context: fork
---
# frontend-researcher
---
name: Frontend Researcher
context: fork
agent: Explore
---
# backend-researcher
---
name: Backend Researcher
context: fork
agent: Explore
---
```

### 3. Compiler Handling

The compiler should:

1. Detect `context: fork` in skill frontmatter
2. Pass through to compiled output
3. Claude Code handles the actual forking at runtime

## Benefits

1. **Cleaner main context** - No file read clutter
2. **Better token efficiency** - Research doesn't consume main budget
3. **Focused results** - Only actionable summary returns
4. **Parallel execution** - Forked skills can run alongside main work

## Limitations

1. **No shared state** - Forked context can't see main conversation history
2. **One-way communication** - Results return, but can't ask follow-ups in fork
3. **MCP tools unavailable** - Background/forked contexts can't use MCP

## Related Features

- **Hot Reload**: Forked skills benefit from hot reload for iteration
- **Progressive Disclosure**: Can combine with tiered loading in forked context

## References

- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
- [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code v2.1.0 Release Notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.0)
