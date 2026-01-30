# Progressive Disclosure for Skills

> **Feature**: Tiered skill loading for token efficiency
> **Source**: Anthropic's official skill architecture recommendations
> **Priority**: MEDIUM
> **Status**: Research Complete

---

## What It Is

Progressive disclosure organizes skill content into tiers that load based on need:

| Tier       | Content                | Tokens   | Loads When           |
| ---------- | ---------------------- | -------- | -------------------- |
| **Tier 0** | metadata.yaml          | ~20      | Always (discovery)   |
| **Tier 1** | SKILL.md core patterns | ~500     | Skill invoked        |
| **Tier 2** | reference/ deep docs   | ~2,000   | Explicitly requested |
| **Tier 3** | examples/ code         | Variable | Code generation      |

## Why It Matters For Us

**Current Problem:**

- All skill content loads when skill is invoked
- Large skills (2000+ tokens) waste context on simple questions
- No way to load "just the basics"

**Solution:**

- Structure skills into explicit tiers
- Load Tier 1 by default
- Load deeper tiers on-demand

## Anthropic's Recommendation

From the official blog post:

> "Progressive disclosure through three tiers optimizes token usage:
>
> - Tier 1: Metadata (~50 tokens) loads initially
> - Tier 2: Full documentation (~500 tokens) loads on-demand
> - Tier 3: Reference files (2,000+ tokens) load only when specifically needed"

## Current Skill Structure

```
skills/frontend/react (@vince)/
├── metadata.yaml     # ~50 tokens
├── SKILL.md          # 500-2000 tokens (all loads)
├── reference.md      # 1000-5000 tokens (all loads)
└── examples/         # Variable (all loads)
```

## Proposed Tiered Structure

```
skills/frontend/react (@vince)/
├── metadata.yaml           # Tier 0: Discovery (~20 tokens)
├── SKILL.md                # Tier 1: Core patterns (~500 tokens)
├── reference/              # Tier 2: Deep reference (~2000 tokens)
│   ├── hooks.md
│   ├── patterns.md
│   └── anti-patterns.md
└── examples/               # Tier 3: Code examples (variable)
    ├── component.tsx
    └── hook.ts
```

## Implementation Plan

### 1. Schema Update

Add loading hints to frontmatter:

```json
// skill-frontmatter.schema.json
{
  "properties": {
    "loading": {
      "type": "object",
      "properties": {
        "tier1": {
          "type": "string",
          "default": "SKILL.md",
          "description": "Primary content - always loads"
        },
        "tier2": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Deep reference - loads on request"
        },
        "tier3": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Examples - loads for code generation"
        }
      }
    }
  }
}
```

### 2. Skill Frontmatter Example

```yaml
# src/skills/frontend/react (@vince)/SKILL.md
---
name: React
description: React component patterns
category: frontend

loading:
  tier1: SKILL.md
  tier2:
    - reference/hooks.md
    - reference/patterns.md
    - reference/anti-patterns.md
  tier3:
    - examples/
---
```

### 3. SKILL.md Content Guidelines

**Tier 1 (SKILL.md)** should contain:

- Core decision trees
- Most common patterns
- Quick reference tables
- ~500 tokens max

**Tier 2 (reference/)** should contain:

- Detailed explanations
- Edge cases
- Anti-patterns
- ~2000 tokens total

**Tier 3 (examples/)** should contain:

- Code examples
- Templates
- Full implementations
- Variable size

### 4. Loading Triggers

| Trigger                | Tiers Loaded |
| ---------------------- | ------------ |
| Skill discovered       | Tier 0 only  |
| Skill invoked          | Tier 0 + 1   |
| "Show me more detail"  | + Tier 2     |
| "Generate code for..." | + Tier 3     |
| "Show examples"        | + Tier 3     |

## Migration Strategy

### Phase 1: Restructure Directories

Move existing `reference.md` to `reference/` directory:

```bash
# For each skill
mkdir -p reference/
mv reference.md reference/main.md
# Split into focused files if large
```

### Phase 2: Update Frontmatter

Add `loading:` section to each skill.

### Phase 3: Update Compiler

Compiler respects tiers:

- Copies all tiers to output
- Generates manifest of tier structure
- Claude Code handles loading at runtime

## Content Guidelines by Tier

### Tier 1: Core (SKILL.md)

```markdown
# React Patterns

## Quick Reference

| Pattern    | When to Use           |
| ---------- | --------------------- |
| useState   | Local component state |
| useReducer | Complex state logic   |

## Decision Tree

Is it server data?
├─ YES → React Query
└─ NO → useState or useReducer

## Key Principles

1. Components should be small (<300 lines)
2. Extract custom hooks for reusable logic
3. Use composition over inheritance
```

### Tier 2: Reference

```markdown
# React Hooks Deep Dive

## useState vs useReducer

[Detailed comparison with examples...]

## Custom Hook Patterns

[Detailed patterns with explanations...]

## Anti-Patterns

[What NOT to do and why...]
```

### Tier 3: Examples

```typescript
// examples/use-fetch.ts
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  // Full implementation...
}
```

## Benefits

1. **Token efficiency** - Only load what's needed
2. **Faster initial response** - Less to process
3. **Better organization** - Clear content hierarchy
4. **Easier maintenance** - Focused files

## Complexity Levels

From Anthropic's blog:

| Level        | Lines  | Example                  |
| ------------ | ------ | ------------------------ |
| Simple       | ~100   | Templates, formatting    |
| Intermediate | ~800   | Data retrieval, modeling |
| Complex      | 2,500+ | Multi-tool workflows     |

Tag skills by complexity to inform loading:

```yaml
complexity: intermediate # Suggests Tier 2 may be needed
```

## Related Features

- **Context Forking**: Forked skills can load full content without impacting main
- **Path-Scoped Rules**: Tier 1 content ideal for rules generation

## References

- [Building Agents with Skills](https://claude.com/blog/building-agents-with-skills-equipping-agents-for-specialized-work)
- [Extending Claude Capabilities](https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers)
