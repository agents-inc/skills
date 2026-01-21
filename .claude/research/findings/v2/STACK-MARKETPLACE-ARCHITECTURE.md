# Stack Marketplace Architecture

> **Source of Truth** for the Stack Marketplace design decisions. Read this before implementing.

---

## Executive Summary

The Stack Marketplace is a system for browsing, selecting, and contributing pre-configured skill combinations ("stacks") for Claude Code. Key principles:

- **Stacks replace profiles** - A stack IS your complete tech stack configuration
- **Skills are atomic** - Each skill teaches ONE technology without bleeding into others
- **Framework is the foundation** - Everything else (state, styling, testing) are siblings
- **No integrations layer** - Skill metadata handles dependencies and conflicts
- **Community-ready from day 1** - Upvote-only, no tiers/badges

---

## Core Concepts

### Skills

Atomic units of knowledge about ONE technology.

```
skills/
├── framework/
│   ├── react/
│   ├── vue/
│   └── svelte/
├── state/
│   ├── zustand/
│   ├── mobx/
│   └── redux/
├── styling/
│   ├── tailwind/
│   ├── scss-modules/
│   └── css-in-js/
├── testing/
│   ├── vitest/
│   ├── jest/
│   └── playwright/
├── mocking/
│   ├── msw/
│   └── module-mocks/
├── data-fetching/
│   ├── react-query/
│   ├── swr/
│   └── rtk-query/
└── ... (other categories)
```

**Key Properties:**
- Skills are **siblings** - no hierarchy except `framework/` as foundation
- Skills do NOT bleed into each other - no "MUST use Zustand" in React skill
- Skills are named by technology: `zustand`, `tailwind`, `vitest`

### Stacks

Complete tech stack bundles with philosophy and versioning.

```yaml
# stacks/modern-react.yaml
id: modern-react
name: "Modern React Stack"
version: "1.0.0"
author: "@vince"
philosophy: "Ship fast, iterate faster"

framework: react

skills:
  state: zustand
  styling: tailwind
  testing: vitest
  mocking: msw
  data-fetching: react-query

agents:
  - frontend-developer
  - frontend-reviewer
  - tester

# Override rules
overrides:
  styling:
    alternatives: [scss-modules, css-in-js]
    locked: false
  state:
    alternatives: [mobx, redux]
    locked: false
  framework:
    locked: true  # Cannot change - defines stack identity
```

**Key Properties:**
- Stacks are **versioned**
- Stacks have **philosophy** (guiding principles)
- Stacks allow **overrides** (swap tailwind for scss)
- Stacks include **agents** to compile
- Stacks replace profiles entirely

### Skill Metadata

Skills declare dependencies and conflicts via metadata.

```yaml
# skills/state/zustand/skill.yaml
id: state/zustand
name: Zustand
category: state
category_exclusive: true  # Only ONE from "state" category

requires:
  - framework/*  # Needs some framework

compatible_with:
  - framework/react
  - framework/vue

conflicts_with:
  - state/mobx
  - state/redux
  - state/pinia
```

**Metadata Fields:**
- `requires` - Hard dependencies (must have)
- `compatible_with` - Works well with (soft recommendation)
- `conflicts_with` - Cannot coexist
- `category_exclusive` - Only one skill from this category allowed

---

## Architecture Decisions

### 1. Stacks Replace Profiles

**Before:** Skills were mixed with stack config
**After:** Stacks are the compilation unit - complete tech stack configurations

```
OLD: mixed skills and config in same place
NEW: stacks/modern-react/ → references central skills, defines agents
```

### 2. Skills Are Atomic (No Bleeding)

**Research Finding:** 67% of current skill cross-references are REMOVABLE.

**Before:**
```markdown
## Critical Requirements
(You MUST use Zustand for ALL shared UI state)
```

**After:**
```markdown
## Core Patterns
[Zustand patterns without prescribing it as the only option]
```

Prescriptive language ("MUST use X") belongs in:
- The skill itself (if it's specific to that tool)
- Stack conventions array
- Injected via templates at compile time

### 3. Framework as Foundation, Everything Else as Siblings

```
framework/        ← FOUNDATION (must pick one)
    │
    ├── state/        ← SIBLING
    ├── styling/      ← SIBLING
    ├── testing/      ← SIBLING
    ├── mocking/      ← SIBLING
    └── data-fetching/ ← SIBLING
```

No hierarchy among siblings. No "integrations" layer needed.

### 4. Metadata Handles Dependencies

Instead of an integrations layer, skill metadata expresses relationships:

| Relationship | Metadata Field | Example |
|--------------|----------------|---------|
| Hard dependency | `requires` | Zustand requires framework/* |
| Soft recommendation | `compatible_with` | Zustand compatible_with react |
| Mutual exclusion | `conflicts_with` | Zustand conflicts_with mobx |
| Category limit | `category_exclusive` | Only one state skill |

### 5. Skill Naming Convention

Simple format: `technology-name (@publisher)`

Examples:
- `react-zustand (@vince)`
- `react-mobx (@photoroom)`
- `vitest-msw (@vince)`

No complex namespacing for now - defer until community contributions exist.

### 6. Stacks Are Versioned

Unlike the earlier decision to not version, stacks ARE versioned because they're now comprehensive tech stack bundles.

```yaml
id: modern-react
version: "1.0.0"  # Semantic versioning
```

### 7. Override System

Users select a stack, then can override specific slots:

```
User selects: modern-react (React + Zustand + Tailwind)
User overrides: styling → scss-modules

Result: React + Zustand + SCSS Modules
```

Override rules per slot:
- `locked: true` - Cannot override (e.g., framework defines stack identity)
- `locked: false` - Can swap from alternatives list
- `alternatives: [...]` - Valid replacements

---

## Implementation Order

### Phase 1: Restructure (No Logic Changes)

1. Create central `skills/` directory
2. Move skills from profiles to central location
3. Create `stacks/` directory
4. Update compile.ts paths
5. Verify compilation still works

### Phase 2: Stack Logic

1. Create stack schema and validation
2. Add stack resolution to compile.ts
3. Implement skill metadata parsing
4. Add conflict/requires validation

### Phase 3: CLI Commands

1. `claude-stacks list` - Browse stacks
2. `claude-stacks use <id>` - Select a stack
3. `claude-stacks build` - Interactive wizard
4. `claude-stacks export` - Export current as stack

---

## Directory Structure (Target)

```
src/
├── skills/                    # CENTRAL (all skills here)
│   ├── framework/
│   │   ├── react/
│   │   │   ├── SKILL.md
│   │   │   ├── examples.md
│   │   │   └── skill.yaml    # Metadata
│   │   └── vue/
│   ├── state/
│   │   ├── zustand/
│   │   └── mobx/
│   ├── styling/
│   │   ├── tailwind/
│   │   └── scss-modules/
│   └── ... (other categories)
│
├── stacks/                    # Stack definitions
│   ├── modern-react.yaml
│   ├── enterprise-react.yaml
│   └── photoroom-webapp.yaml
│
├── schemas/                   # Validation schemas
│   ├── skill.schema.json
│   └── stack.schema.json
│
└── compile.ts                 # Updated for stack resolution
```

---

## What's Deferred

| Item | Reason |
|------|--------|
| Complex naming convention | No community yet |
| Web catalog | CLI-first |
| Stack Arena | Post-launch feature |
| Template customization | Figure out with usage |
| Conventions injection | TBD - skill, template, or array |

---

## Research References

This architecture is based on research from multiple agents:

- **Skill Bleed Analysis**: 67% of cross-references removable
- **Testing/Mocking Separation**: CAN be cleanly separated
- **Atomic Skill Templates**: Designed for React, Testing, State
- **Edge Case Analysis**: Sibling-only works with proper metadata
- **Problem Catalog**: Root cause is prescriptive language, not architecture

See also:
- `FINAL-DECISION.md` - Original marketplace decisions (some superseded)
- `INDEX.md` - Full research index

---

_Last updated: 2026-01-09_
