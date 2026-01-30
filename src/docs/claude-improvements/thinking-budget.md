# Thinking Budget Configuration

> **Feature**: Configurable extended thinking tokens (replaces ultrathink)
> **Changed**: January 16, 2026
> **Priority**: MEDIUM
> **Status**: Research Complete

---

## What Changed

### Before (Deprecated)

Magic keywords in prompts triggered thinking budgets:

| Keyword                       | Thinking Tokens |
| ----------------------------- | --------------- |
| `think`                       | 4,000           |
| `megathink`                   | 10,000          |
| `think hard` / `think harder` | 32,000          |
| `ultrathink`                  | 31,999          |

### Now (v2.0+)

- Extended thinking **enabled by default** at 31,999 tokens
- Keywords no longer work - treated as regular text
- Configure via environment variable or settings

**Official deprecation (January 16, 2026):**

> "Closing as ultrathink is now deprecated and thinking mode is enabled by default."

## Why It Matters For Us

**Current Problem:**

- Every Claude Code request uses 32K thinking tokens by default
- Simple tasks (file edits, quick questions) don't need this
- Thinking tokens are **billed as output tokens** (most expensive)

**Solution:**

- Configure appropriate thinking budgets per agent type
- Architecture agents: maximum thinking
- Developer agents: moderate thinking
- Simple tasks: minimal or no thinking

## Configuration Methods

### 1. Environment Variable (Per-Session)

```bash
# Disable thinking for simple tasks
MAX_THINKING_TOKENS=0 claude

# Lower budget for routine work
MAX_THINKING_TOKENS=8000 claude

# Maximum for complex architecture
MAX_THINKING_TOKENS=63999 claude
```

### 2. Settings.json (Persistent)

```json
{
  "env": {
    "MAX_THINKING_TOKENS": "16000"
  },
  "alwaysThinkingEnabled": true
}
```

### 3. Tab Key Toggle

Press **Tab** during session to toggle thinking on/off. Setting is sticky across sessions.

### 4. /config Command

Use `/config` in interactive mode to modify settings.

## Valid Budget Ranges

| Model        | Max Output | Max Thinking |
| ------------ | ---------- | ------------ |
| Opus 4.5     | 64K        | 63,999       |
| Sonnet 4/4.5 | 64K        | 63,999       |
| Haiku 4.5    | 64K        | 63,999       |
| Opus 4/4.1   | 32K        | 31,999       |

**Minimum:** 1,024 tokens (or 0 to disable)

## Budget Recommendations

| Task Type              | Budget        | Rationale                           |
| ---------------------- | ------------- | ----------------------------------- |
| Simple file edits      | `0`           | No reasoning needed                 |
| Routine coding         | `4,000-8,000` | Basic problem solving               |
| Standard development   | `16,000`      | Balanced cost/capability            |
| Complex debugging      | `32,000`      | Default, handles most complex work  |
| Architecture decisions | `63,999`      | Maximum reasoning for hard problems |

## Cost Implications

1. **Thinking tokens = output tokens** (most expensive category)
2. Default 32K budget can significantly increase costs
3. Previous thinking blocks are **stripped from context** (don't accumulate)
4. Thinking tokens count toward rate limits

## Implementation Plan

### 1. Schema Update

Add `recommended_thinking` to agent schema:

```json
// agent.schema.json
{
  "properties": {
    "recommended_thinking": {
      "type": "integer",
      "minimum": 0,
      "maximum": 63999,
      "description": "Recommended thinking budget for this agent"
    }
  }
}
```

### 2. Agent Examples

```yaml
# src/agents/planning/architecture/agent.yaml
name: architecture
description: Scaffolds new applications
recommended_thinking: 63999  # Maximum - complex decisions

# src/agents/developer/frontend-developer/agent.yaml
name: frontend-developer
description: Implements features from specs
recommended_thinking: 16000  # Standard development

# src/agents/researcher/frontend-researcher/agent.yaml
name: frontend-researcher
description: Read-only pattern discovery
recommended_thinking: 8000   # Lower - mostly reading
```

### 3. CLI Integration

When invoking agents, set `MAX_THINKING_TOKENS`:

```typescript
// In CLI agent invocation
const agent = loadAgent(agentName);
const thinkingBudget = agent.recommended_thinking ?? 31999;

spawn("claude", [...args], {
  env: {
    ...process.env,
    MAX_THINKING_TOKENS: String(thinkingBudget),
  },
});
```

### 4. User Override

Allow users to override in stack config:

```yaml
# .claude-collective/stacks/my-stack/config.yaml
thinking_overrides:
  architecture: 32000 # Lower than default
  frontend-developer: 8000 # Cost-conscious
```

## Best Practices

1. **Start low, increase as needed** - Begin at 8K, bump up if quality suffers
2. **Match budget to task complexity** - Don't throw 64K at simple edits
3. **Use batch processing for 32K+** - Avoids networking issues
4. **Monitor costs** - Track thinking token usage in analytics

## Supported Models

Extended thinking available on:

- Claude Opus 4.5
- Claude Sonnet 4/4.5
- Claude Haiku 4.5
- Claude Opus 4/4.1

## References

- [UltraThink Deprecated - Decode Claude](https://decodeclaude.com/ultrathink-deprecated/)
- [Manage Costs - Claude Code Docs](https://code.claude.com/docs/en/costs)
- [Extended Thinking Tips](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/extended-thinking-tips)
- [Building with Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
