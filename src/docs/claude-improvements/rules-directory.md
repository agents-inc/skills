# Path-Scoped Rules Directory

> **Feature**: `.claude/rules/` with glob-based path scoping
> **Introduced**: Claude Code v2.0.64 (December 2025)
> **Priority**: HIGH
> **Status**: Research Complete

---

## What It Is

The `.claude/rules/` directory allows breaking monolithic CLAUDE.md into focused, topic-based files. Rules can be **path-scoped** to only load when working on matching files.

## Why It Matters For Us

**Current Problem:**

- All skills load into context regardless of relevance
- Backend skills load when editing `.tsx` files
- Wastes tokens and can confuse the model

**Solution:**

- Generate path-scoped rules from skills
- Backend skills only load for backend files
- Frontend skills only load for frontend files

## How It Works

### Basic Structure

```
.claude/
├── CLAUDE.md           # Global instructions (optional)
└── rules/
    ├── react-patterns.md      # Loads for **/*.tsx
    ├── api-conventions.md     # Loads for src/api/**
    └── testing.md             # Loads for **/*.test.ts
```

### Path Scoping via Frontmatter

```yaml
---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*"
---
# React Patterns

[Condensed skill content here]
```

**Rules without `paths:` load unconditionally (like CLAUDE.md).**

### Supported Glob Patterns

| Pattern                | Matches                       |
| ---------------------- | ----------------------------- |
| `**/*.ts`              | All TypeScript files anywhere |
| `src/**/*`             | Everything under src/         |
| `*.md`                 | Markdown files in root only   |
| `src/components/*.tsx` | Direct children only          |
| `**/*.{ts,tsx}`        | Both .ts and .tsx files       |
| `{src,lib}/**/*.ts`    | TypeScript in src/ or lib/    |

### YAML Syntax Warning

Patterns starting with `*` or `{` must be **quoted**:

```yaml
# WRONG - YAML syntax error
paths: **/*.ts

# CORRECT
paths:
  - "**/*.ts"
```

## Memory Hierarchy

| Priority | Type              | Location               |
| -------- | ----------------- | ---------------------- |
| Highest  | Managed policy    | System-level           |
| High     | Project memory    | `./CLAUDE.md`          |
| **High** | **Project rules** | `./.claude/rules/*.md` |
| Medium   | User rules        | `~/.claude/rules/`     |
| Medium   | User memory       | `~/.claude/CLAUDE.md`  |
| Lower    | Local memory      | `./CLAUDE.local.md`    |

Rules have the **same priority as CLAUDE.md**.

## Implementation Plan

### 1. Schema Update

Add `paths` to skill frontmatter schema:

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

### 2. Skill Frontmatter Example

```yaml
# src/skills/frontend/react (@vince)/SKILL.md
---
name: React
description: React component patterns
category: frontend
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**/*"
---
```

### 3. Compiler Output

Generate both skill and rule:

```
.claude/
├── skills/
│   └── react (@vince)/
│       └── SKILL.md           # Full skill content
└── rules/
    └── react-patterns.md      # Condensed, path-scoped
```

### 4. Rule Generation Strategy

**Option A: Extract key patterns**

- Parse skill, extract most important patterns
- Generate ~500 token condensed rule
- Full skill available on-demand

**Option B: Full content as rule**

- Copy entire skill content to rule
- Add paths frontmatter
- Simpler but uses more tokens when active

**Recommendation:** Start with Option B for simplicity, optimize later.

## Skills to Path-Scope

| Skill                           | Suggested Paths                       |
| ------------------------------- | ------------------------------------- |
| `frontend/react`                | `**/*.tsx`, `**/*.jsx`                |
| `frontend/styling-scss-modules` | `**/*.scss`, `**/*.module.scss`       |
| `backend/api-hono`              | `**/api/**/*.ts`, `**/routes/**/*.ts` |
| `backend/database-drizzle`      | `**/db/**/*.ts`, `**/schema/**/*.ts`  |
| `backend/testing`               | `**/*.test.ts`, `**/*.spec.ts`        |
| `frontend/testing-vitest`       | `**/*.test.tsx`, `**/e2e/**/*`        |

## Known Issues

- [GitHub #16299](https://github.com/anthropics/claude-code/issues/16299): Path-scoped rules may load at session start even when cwd doesn't match

## Viewing Loaded Rules

Use `/memory` command to see what rules are currently loaded.

## References

- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)
- [Rules Directory - Claude Fast](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
