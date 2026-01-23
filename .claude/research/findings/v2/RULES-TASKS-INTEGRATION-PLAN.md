# Rules & Tasks Integration Plan

> **Generated**: 2026-01-23
> **Purpose**: Incorporate Claude Rules, Tasks, and v2.1.x features into the plugin system

---

## Executive Summary

Research reveals three high-impact opportunities:

1. **Rules Generation** - Compile skills into path-scoped `.claude/rules/` files
2. **Hooks in Frontmatter** - Add hook support to agent/skill compilation
3. **Context Forking** - Add `context: fork` support for research-type skills

---

## 1. Rules Generation

### Current State

- Skills compile to `.claude/skills/{name}/SKILL.md`
- All skills load into context regardless of relevance

### Proposed Enhancement

Generate path-scoped rules alongside skills for more intelligent context loading.

### Implementation

**Add `paths` to skill frontmatter schema:**

```yaml
# src/skills/frontend/react (@vince)/SKILL.md
---
name: React
description: React component patterns
category: frontend
# NEW: Path scope for rules generation
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*"
---
```

**Compile to rules:**

```
.claude/
├── skills/
│   └── react (@vince)/
│       └── SKILL.md           # Full skill content
└── rules/
    └── react-patterns.md      # Path-scoped excerpt
```

**Generated rule:**

```yaml
---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
---
# React Patterns (from react skill)

[Condensed key patterns - ~500 tokens]
```

### Benefits

- Reduces context pollution - backend skills don't load when editing .tsx
- Progressive disclosure - rules are lightweight, full skill loads on-demand
- Automatic relevance - Claude only sees relevant rules

### Schema Changes

```json
// skill-frontmatter.schema.json
{
  "properties": {
    "paths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Glob patterns for path-scoped rule generation"
    }
  }
}
```

---

## 2. Hooks in Frontmatter

### Current State

- Hooks defined in `.claude/settings.json` or `hooks/hooks.json`
- No agent-scoped hooks

### Proposed Enhancement

Support hooks directly in agent YAML frontmatter.

### Implementation

**Agent frontmatter with hooks:**

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

# NEW: Agent-scoped hooks
hooks:
  PreToolUse:
    - matcher: "Edit"
      command: "echo 'Editing file: $TOOL_INPUT_FILE_PATH'"
  PostToolUse:
    - matcher: "Write"
      command: "bun run lint --fix $TOOL_INPUT_FILE_PATH"
  Stop:
    - command: "echo 'Agent completed'"
```

**Use cases:**

- **Linting**: Auto-lint after Write/Edit
- **Verification**: Run type-check after edits
- **Logging**: Track tool usage for analytics
- **Guardrails**: Prevent certain operations

### Compiler Changes

- Parse `hooks` from agent YAML
- Generate `hooks/hooks.json` in stack plugin output
- Merge agent hooks with global hooks (agent hooks take precedence)

### Schema Changes

```json
// agent.schema.json
{
  "properties": {
    "hooks": {
      "type": "object",
      "properties": {
        "PreToolUse": { "type": "array" },
        "PostToolUse": { "type": "array" },
        "Stop": { "type": "array" }
      }
    }
  }
}
```

---

## 3. Context Forking for Skills

### Current State

- All skills run in main conversation context
- Research skills can pollute main context

### Proposed Enhancement

Add `context: fork` support for skills that should run in isolation.

### Implementation

**Skill frontmatter:**

```yaml
# src/skills/research/research-methodology (@vince)/SKILL.md
---
name: Research Methodology
description: Investigation patterns for codebase research
category: research

# NEW: Run in isolated context
context: fork
agent: Explore # Optional: specify agent type for forked context
---
```

**Benefits:**

- Research exploration doesn't clutter main conversation
- Pattern discovery runs in dedicated context
- Main conversation stays focused on implementation

### Candidates for Context Forking

| Skill                  | Reason                             |
| ---------------------- | ---------------------------------- |
| `research-methodology` | Extensive file exploration         |
| `backend-researcher`   | Read-only discovery                |
| `frontend-researcher`  | Read-only discovery                |
| `pattern-scout`        | Pattern extraction across codebase |

---

## 4. Progressive Disclosure Structure

### Current State

```
skills/frontend/react (@vince)/
├── SKILL.md          # 500-2000 tokens
├── reference.md      # 1000-5000 tokens
└── examples/         # Variable
```

### Proposed Enhancement

Explicit tiered structure with loading hints.

### Implementation

**Updated skill structure:**

```
skills/frontend/react (@vince)/
├── metadata.yaml     # Tier 0: Auto-generated, ~20 tokens
├── SKILL.md          # Tier 1: Core patterns, ~500 tokens
├── reference/        # Tier 2: Deep reference, ~2000 tokens
│   ├── hooks.md
│   ├── patterns.md
│   └── anti-patterns.md
└── examples/         # Tier 3: Code examples, variable
    └── *.tsx
```

**Frontmatter loading hints:**

```yaml
---
name: React
loading:
  tier1: SKILL.md # Always load
  tier2: reference/ # Load on explicit request
  tier3: examples/ # Load only for code generation
---
```

### Benefits

- Token-efficient by default
- Full content available on-demand
- Clear authoring guidance

---

## 5. Commands/Skills Unification

### Current State

- Skills in `.claude/skills/`
- Commands in `.claude/commands/` (deprecated in v2.1.3)

### Proposed Enhancement

Migrate any remaining command patterns to skills.

### Implementation

- Audit existing commands in stacks
- Convert to skill format with `disable-model-invocation: true` where needed
- Update compiler to not generate `.claude/commands/`

**Example conversion:**

```yaml
# Before: .claude/commands/commit.md
# After: .claude/skills/commit/SKILL.md
---
name: commit
description: Create git commit
disable-model-invocation: true # User must explicitly invoke
---
```

---

## 6. Permission Rule Generation

### Current State

- Permissions defined manually in settings

### Proposed Enhancement

Generate permission rules from agent tool definitions.

### Implementation

**Agent with restrictive tools:**

```yaml
name: backend-researcher
description: Read-only backend research
tools:
  - Read
  - Grep
  - Glob
  - Bash(git log*)
  - Bash(git show*)
```

**Generated permissions:**

```json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Grep(*)",
      "Glob(*)",
      "Bash(git log*)",
      "Bash(git show*)"
    ],
    "deny": ["Write(*)", "Edit(*)", "Bash(*)"]
  }
}
```

### Benefits

- Enforcement of agent tool restrictions
- Automatic deny for unlisted tools
- Wildcard support for bash commands

---

## 7. Tasks Integration Improvements

### Current State

- Orchestrator uses TaskCreate/TaskUpdate/TaskList
- Basic status tracking

### Proposed Enhancement

Leverage dependency tracking for complex workflows.

### Implementation

**Enhanced orchestrator workflow:**

```
1. TaskCreate: "Research existing patterns"     # Task A
2. TaskCreate: "Write implementation spec"      # Task B, addBlockedBy: [A]
3. TaskCreate: "Implement feature"              # Task C, addBlockedBy: [B]
4. TaskCreate: "Write tests"                    # Task D, addBlockedBy: [C]
5. TaskCreate: "Code review"                    # Task E, addBlockedBy: [C, D]
```

**Benefits:**

- Clear dependency chains
- Parallel execution where possible
- Automatic blocking when dependencies incomplete

---

## Implementation Priority

| Priority | Feature                | Effort | Impact                                 |
| -------- | ---------------------- | ------ | -------------------------------------- |
| HIGH     | Hooks in frontmatter   | Medium | High - enables agent-scoped automation |
| HIGH     | Context forking        | Low    | High - cleaner research workflows      |
| MEDIUM   | Rules generation       | Medium | Medium - better context relevance      |
| MEDIUM   | Permission generation  | Medium | Medium - enforced tool restrictions    |
| LOW      | Progressive disclosure | High   | Medium - token optimization            |
| LOW      | Commands migration     | Low    | Low - backwards compatible             |

---

## Schema Updates Required

### 1. skill-frontmatter.schema.json

```diff
+ "paths": { "type": "array", "items": { "type": "string" } }
+ "context": { "enum": ["main", "fork"] }
+ "agent": { "type": "string" }
+ "disable-model-invocation": { "type": "boolean" }
+ "loading": { "type": "object" }
```

### 2. agent.schema.json

```diff
+ "hooks": {
+   "type": "object",
+   "properties": {
+     "PreToolUse": { "type": "array" },
+     "PostToolUse": { "type": "array" },
+     "Stop": { "type": "array" }
+   }
+ }
+ "permissions": {
+   "type": "object",
+   "properties": {
+     "allow": { "type": "array" },
+     "deny": { "type": "array" }
+   }
+ }
```

### 3. NEW: hooks.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "hooks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "event": { "enum": ["PreToolUse", "PostToolUse", "Stop"] },
          "matcher": { "type": "string" },
          "command": { "type": "string" }
        },
        "required": ["event", "command"]
      }
    }
  }
}
```

---

## Next Steps

1. **Immediate**: Update `skill-frontmatter.schema.json` with `paths`, `context`, `agent` fields
2. **Immediate**: Update `agent.schema.json` with `hooks` field
3. **Short-term**: Implement rules generation in `skill-plugin-compiler.ts`
4. **Short-term**: Implement hooks generation in `stack-plugin-compiler.ts`
5. **Medium-term**: Add context forking support to compiler
6. **Medium-term**: Add permission generation from agent tools

---

---

## 8. Context Forking Deep Dive

### What Context Forking Does

When a skill has `context: fork`, it runs in an **isolated sub-agent context**:

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
(not all 20 file reads)
```

### Benefits

| Aspect               | Main Context (default)         | Forked Context            |
| -------------------- | ------------------------------ | ------------------------- |
| Conversation history | Shared with main chat          | Isolated - starts fresh   |
| File reads/searches  | Accumulate in main context     | Contained in fork         |
| Token usage          | Counts toward main limit       | Separate budget           |
| Results              | All intermediate steps visible | Only final result returns |

### Skills to Fork

| Skill                  | Reason                            | Frontmatter                       |
| ---------------------- | --------------------------------- | --------------------------------- |
| `pattern-scout`        | Reads 50+ files during extraction | `context: fork`                   |
| `frontend-researcher`  | Extensive codebase exploration    | `context: fork`, `agent: Explore` |
| `backend-researcher`   | Extensive codebase exploration    | `context: fork`, `agent: Explore` |
| `research-methodology` | Deep investigation patterns       | `context: fork`                   |

### Implementation

```yaml
# src/skills/research/research-methodology (@vince)/SKILL.md
---
name: Research Methodology
description: Deep codebase investigation patterns
category: research
context: fork # Run in isolated context
agent: Explore # Optional: use specific agent type for fork
---
```

---

## 9. Thinking Budget Configuration

### Background

"Ultrathink" and other magic keywords (`think`, `megathink`, `think hard`) were **deprecated in January 2026**. Extended thinking is now:

- **Enabled by default** at 31,999 tokens
- Configurable via environment variable or settings
- Keywords are now interpreted as regular text (no special behavior)

### Configuration Methods

**1. Environment Variable (per-session):**

```bash
# Disable thinking for simple tasks
MAX_THINKING_TOKENS=0 claude

# Lower budget for routine work
MAX_THINKING_TOKENS=8000 claude

# Maximum for complex architecture
MAX_THINKING_TOKENS=63999 claude
```

**2. Settings.json (persistent):**

```json
{
  "env": {
    "MAX_THINKING_TOKENS": "16000"
  },
  "alwaysThinkingEnabled": true
}
```

**3. Tab Key:** Press Tab during session to toggle thinking on/off.

### Budget Recommendations by Task Type

| Task Type              | Budget        | Rationale                           |
| ---------------------- | ------------- | ----------------------------------- |
| Simple file edits      | `0`           | No reasoning needed                 |
| Routine coding         | `4,000-8,000` | Basic problem solving               |
| Standard development   | `16,000`      | Balanced cost/capability            |
| Complex debugging      | `32,000`      | Default, good for most complex work |
| Architecture decisions | `63,999`      | Maximum reasoning for hard problems |

### Cost Implications

- **Thinking tokens are billed as output tokens** (most expensive category)
- Default 32K budget on every request can be costly
- Previous thinking blocks are stripped from context (don't accumulate)

### Agent Integration Opportunity

Agents could specify recommended thinking budgets:

```yaml
# src/agents/planning/architecture/agent.yaml
name: architecture
description: Scaffolds new applications
recommended_thinking: 32000  # Complex architectural decisions

# src/agents/developer/frontend-developer/agent.yaml
name: frontend-developer
description: Implements features from specs
recommended_thinking: 16000  # Standard development
```

The CLI could set `MAX_THINKING_TOKENS` when invoking agents based on their recommended budget.

---

## References

- [Claude Code Rules Directory](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Building Agents with Skills](https://claude.com/blog/building-agents-with-skills-equipping-agents-for-specialized-work)
- [Extending Claude Capabilities](https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers)
- [UltraThink Deprecated - Decode Claude](https://decodeclaude.com/ultrathink-deprecated/)
- [Manage Costs - Claude Code Docs](https://code.claude.com/docs/en/costs)
- [Extended Thinking Tips - Claude Docs](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/extended-thinking-tips)
