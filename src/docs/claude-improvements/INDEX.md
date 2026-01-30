# Claude Code Improvements Research

> **Created**: 2026-01-23
> **Purpose**: Track Claude Code features that could improve our skill/agent system

---

## Overview

This folder contains research on Claude Code features (v2.1.x+) that we can leverage to improve our plugin compilation system.

## Documents

| Document                                                 | Feature                      | Priority | Status            |
| -------------------------------------------------------- | ---------------------------- | -------- | ----------------- |
| [rules-directory.md](./rules-directory.md)               | Path-scoped `.claude/rules/` | HIGH     | Research Complete |
| [thinking-budget.md](./thinking-budget.md)               | Configurable thinking tokens | MEDIUM   | Research Complete |
| [context-forking.md](./context-forking.md)               | Isolated skill execution     | HIGH     | Research Complete |
| [hooks-frontmatter.md](./hooks-frontmatter.md)           | Agent-scoped hooks           | HIGH     | Research Complete |
| [permission-generation.md](./permission-generation.md)   | Auto-generate from tools     | MEDIUM   | Research Complete |
| [progressive-disclosure.md](./progressive-disclosure.md) | Tiered skill loading         | MEDIUM   | Research Complete |
| [hot-reload.md](./hot-reload.md)                         | Skills hot reload            | LOW      | Research Complete |

## Implementation Priority

### Phase 1 - High Impact, Low Effort

1. **Context Forking** - Just add frontmatter to research skills
2. **Hot Reload** - Already built-in, document usage

### Phase 2 - High Impact, Medium Effort

3. **Hooks in Frontmatter** - Schema update + compiler changes
4. **Path-scoped Rules** - New compilation target

### Phase 3 - Medium Impact, Medium Effort

5. **Permission Generation** - Parse tools, generate rules
6. **Progressive Disclosure** - Restructure skill directories
7. **Thinking Budget** - Add to agent schema, CLI integration

## Quick Reference

### What Each Feature Does

| Feature                    | Problem It Solves                                                  |
| -------------------------- | ------------------------------------------------------------------ |
| **Rules Directory**        | Skills load even when irrelevant (backend skill loads for .tsx)    |
| **Thinking Budget**        | Paying for 32K thinking on simple tasks                            |
| **Context Forking**        | Research skills pollute main conversation with file reads          |
| **Hooks Frontmatter**      | No agent-scoped automation (lint after edit, verify after write)   |
| **Permission Generation**  | Manual permission rules, no enforcement of agent tool restrictions |
| **Progressive Disclosure** | All skill content loads upfront, wasting tokens                    |
| **Hot Reload**             | Had to restart Claude Code to test skill changes                   |

## Related Files

- Original integration plan: `../findings/v2/RULES-TASKS-INTEGRATION-PLAN.md`
- TODO tracking: `src/docs/TODO.md`
- Schema files: `src/schemas/`
