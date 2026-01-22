# Stack Marketplace: Final Decisions

> **Purpose**: Authoritative record of user-confirmed decisions for the Stack Marketplace project.

---

## Current Status (2026-01-10)

### Architecture Vision

The system has three layers with clear responsibilities:

| Layer      | Purpose                                       | Complexity                                      |
| ---------- | --------------------------------------------- | ----------------------------------------------- |
| **Skills** | Atomic, portable knowledge units              | Rich (SKILL.md + metadata.yaml)                 |
| **Agents** | Role-based AI assistants with assigned skills | Medium (agent.yaml + intro.md + workflow.md)    |
| **Stacks** | Curated skill collections with conventions    | Medium (config + CLAUDE.md + optional template) |

**Key Principles:**

- SKILL.md frontmatter is the **single source of truth** for skill identity
- `name` field IS the identifier (no separate `id` field)
- Templates cascade: Stack -> Default
- Skills stay in central directory (deferred: copying into stacks for independent versioning)

---

## Phase 0A: Co-located Config (COMPLETE)

Registry.yaml removed. Agents and skills discovered via directory scanning:

- `src/agent-sources/{category}/{agent}/agent.yaml` - Agent definitions (organized by category)
- `src/skills/**/skill.yaml` - Skill metadata (being replaced by SKILL.md + metadata.yaml)

**Agent Categories:**

- `developer/` - Implementation agents (frontend-developer, backend-developer, architecture)
- `reviewer/` - Code review agents (frontend-reviewer, backend-reviewer)
- `researcher/` - Read-only research agents (frontend-researcher, backend-researcher)
- `planning/` - Planning agents (pm, orchestrator)
- `pattern/` - Pattern discovery agents (pattern-scout, pattern-critique)
- `meta/` - Meta-level agents (agent-summoner, skill-summoner, documentor)
- `tester/` - Testing agents (tester-agent)

---

## Phase 0B: SKILL.md as Source of Truth (COMPLETE)

### Problem Statement

Skill identity (name, description) is duplicated across:

1. skill.yaml (has id, name, description + metadata)
2. SKILL.md frontmatter (has name, description)
3. Stack config.yaml (references skills by name)

### Solution: SKILL.md Frontmatter = Source of Truth

**SKILL.md frontmatter contains identity:**

```yaml
---
name: frontend/react (@vince) # This IS the identifier (must be unique)
description: Component architecture, hooks, patterns
model: opus # Optional: which AI model to use
---
```

**metadata.yaml contains relationships (renamed from skill.yaml):**

```yaml
category: framework
category_exclusive: true
author: "@vince"
version: "1.0.0"
compatible_with: [...]
conflicts_with: [...]
requires: [...]
tags: [...]
```

### Key Decisions

| Decision                        | Rationale                                                                |
| ------------------------------- | ------------------------------------------------------------------------ |
| **No `id` field**               | `name` IS the identifier - must be unique                                |
| **skill.yaml -> metadata.yaml** | Clear separation: identity vs relationships                              |
| **ID derived from folder path** | `src/skills/frontend/react/react (@vince)/` -> `frontend/react (@vince)` |
| **model in SKILL.md**           | Skills can specify preferred AI model                                    |

### Required Changes

1. Update all SKILL.md frontmatter to include `model` field (optional)
2. Rename skill.yaml -> metadata.yaml in all skill folders
3. Remove `id`, `name`, `description` from metadata.yaml
4. Update compile.ts to parse SKILL.md frontmatter (add frontmatter parser)
5. Update compile.ts to read metadata.yaml for relationship data

### Skill Directory Structure (Final)

```
src/skills/{category}/{subcategory}/{skill-name} (@author)/
├── SKILL.md              # SOURCE OF TRUTH: name, description, model
├── metadata.yaml         # Relationships: category, tags, requires, conflicts, etc.
├── examples.md           # Optional: usage examples
└── reference.md          # Optional: reference material
```

---

## Phase 0D: Stack Architecture (COMPLETE)

### Stack Structure

Stacks are **directories** (not single YAML files) containing:

```
src/stacks/{stack-id}/
├── config.yaml           # Stack configuration (references skills by name)
├── CLAUDE.md             # Stack-level project conventions
└── agent.liquid          # Optional: stack-specific agent template
```

**Note:** Skills are NOT copied into stacks yet. Stacks reference skills from central `src/skills/` directory. Independent versioning (copying skills into stacks) is deferred until skills stabilize.

### Stack config.yaml

```yaml
name: Modern React Stack
description: SCSS Modules, Zustand, React Query
author: "@vince"
version: "1.0.0"

skills:
  - frontend/react (@vince)
  - frontend/scss-modules (@vince)
  - frontend/zustand (@vince)
  - frontend/react-query (@vince)
  - frontend/vitest (@vince)
  - frontend/msw (@vince)
  - frontend/accessibility (@vince)
  - backend/hono (@vince)
  - backend/drizzle (@vince)
  # ... more skill references

agents:
  - frontend-developer
  - backend-developer
  - frontend-reviewer
  - backend-reviewer
  - tester
  - pm

philosophy: "Ship fast, iterate faster"
principles:
  - Prefer composition over inheritance
  - Use hooks for everything, avoid classes
  - SCSS Modules + cva for styling

tags: [react, typescript, scss, zustand]
```

### Deferred: Skill Copies in Stacks

**Later**, when skills stabilize, stacks will contain full skill copies for independent versioning:

```
src/stacks/{stack-id}/
├── config.yaml
├── CLAUDE.md
├── agent.liquid
└── skills/                    # DEFERRED: Full copies for independent versioning
    └── frontend/
        └── react (@vince)/
            ├── SKILL.md
            └── metadata.yaml
```

---

## Phase 0D.1: Stack Compilation (COMPLETE)

Stack compilation is now the primary compilation method.

### Implementation

1. `--stack=<stack-id>` option added to compile.ts
2. Stack compilation outputs to `.claude/` directory
3. Created `home-stack` and `work-stack` stacks

---

## Template & CLAUDE.md Cascade

### Resolution Order: Stack -> Default

| Asset            | Check 1 (Stack)           | Check 2 (Default)        |
| ---------------- | ------------------------- | ------------------------ |
| **agent.liquid** | `stacks/{s}/agent.liquid` | `templates/agent.liquid` |
| **CLAUDE.md**    | `stacks/{s}/CLAUDE.md`    | Error (required)         |

### Implementation in compile.ts

```typescript
async function resolveTemplate(stack: string): Promise<string> {
  // 1. Stack-specific template
  const stackTemplate = `${ROOT}/stacks/${stack}/agent.liquid`;
  if (await exists(stackTemplate)) return stackTemplate;

  // 2. Default template
  return `${ROOT}/templates/agent.liquid`;
}

async function resolveClaudeMd(stack: string): Promise<string> {
  // Stack-specific CLAUDE.md
  const stackClaude = `${ROOT}/stacks/${stack}/CLAUDE.md`;
  if (await exists(stackClaude)) return stackClaude;

  throw new Error(`No CLAUDE.md found for stack ${stack}`);
}
```

---

## Directory Structure (Final)

```
src/
├── compile.ts                              # Scans directories, resolves cascades
├── types.ts                                # Type definitions
├── templates/
│   └── agent.liquid                        # Default agent template
├── agent-sources/                          # Agent source files (organized by category)
│   ├── developer/
│   │   ├── frontend-developer/
│   │   │   ├── agent.yaml
│   │   │   ├── intro.md
│   │   │   ├── workflow.md
│   │   │   └── ...
│   │   └── backend-developer/
│   ├── reviewer/
│   │   ├── frontend-reviewer/
│   │   └── backend-reviewer/
│   ├── researcher/
│   │   ├── frontend-researcher/
│   │   └── backend-researcher/
│   ├── planning/
│   │   ├── pm/
│   │   ├── architecture/
│   │   └── orchestrator/
│   ├── pattern/
│   │   ├── pattern-scout/
│   │   └── pattern-critique/
│   ├── meta/
│   │   ├── agent-summoner/
│   │   ├── skill-summoner/
│   │   └── documentor/
│   └── tester/
│       └── tester-agent/
├── skills/                                 # CENTRAL skill repository
│   └── {category}/
│       └── {subcategory}/
│           └── {skill-name} (@author)/
│               ├── SKILL.md                # Source of truth: name, description, model
│               ├── metadata.yaml           # Relationships: category, tags, requires, etc.
│               └── examples.md             # Optional
├── stacks/                                 # Stack directories
│   └── {stack-id}/
│       ├── config.yaml                     # Stack config (skill references, agents)
│       ├── CLAUDE.md                       # Stack conventions
│       └── agent.liquid                    # Optional: stack template
├── core-prompts/                           # Shared prompts
└── schemas/                                # JSON schemas for validation
```

---

## Phase 0C: Skills Truly Atomic (LAST)

Skills reference other domains they shouldn't own. 12 skills have violations.

**Principle**: A skill should ONLY discuss its own domain. A React skill shouldn't mention SCSS, Zustand, or MSW.

### Violations Audit

| Skill             | Violations                                    | Severity |
| ----------------- | --------------------------------------------- | -------- |
| React             | References SCSS Modules, React Query, Zustand | HIGH     |
| Performance       | References React Query, SCSS, Vitest          | HIGH     |
| React Query       | References Zustand, MSW                       | HIGH     |
| Observability     | References Hono, Drizzle, React               | HIGH     |
| Better Auth       | References Hono, Drizzle                      | HIGH     |
| PostHog Analytics | References Better Auth, Email                 | HIGH     |
| SCSS Modules      | References lucide-react                       | MEDIUM   |
| Zustand           | References React Query                        | MEDIUM   |
| Vitest            | References MSW                                | MEDIUM   |
| MSW               | References React Testing Library              | MEDIUM   |
| Resend Email      | References Better Auth                        | MEDIUM   |
| GitHub Actions    | References React Query, Zustand               | MEDIUM   |

**Clean Skills:** Accessibility, Hono, Drizzle, PostHog Flags, Security, Tooling, Reviewing

---

## Phase 3: CLI Commands (BLOCKED)

Blocked until foundation work (0B-0E, 0C) is complete.

| Command                  | Purpose                          |
| ------------------------ | -------------------------------- |
| `claude-stacks list`     | Browse available stacks          |
| `claude-stacks use <id>` | Select a stack for profile       |
| `claude-stacks build`    | Interactive stack builder wizard |
| `claude-stacks export`   | Export current as stack          |

---

## Deferred Work

| Feature                    | Why Deferred                                           |
| -------------------------- | ------------------------------------------------------ |
| **Skill copies in stacks** | Skills still iterating; avoid duplication until stable |
| **Independent versioning** | Depends on skill copies in stacks                      |
| **Stack Arena**            | Requires significant infrastructure                    |
| **Web catalog**            | CLI-first approach                                     |
| **Community features**     | Foundation must be solid first                         |

---

## Research History

Previous research rounds documented in:

- [INDEX.md](./INDEX.md) - Architecture research index
- [OPEN-SOURCE-RESEARCH-TRACKER.md](./OPEN-SOURCE-RESEARCH-TRACKER.md) - Round 1
- [COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md](./COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md) - Round 2
- [STACK-MARKETPLACE-PROPOSAL-RESEARCH.md](./STACK-MARKETPLACE-PROPOSAL-RESEARCH.md) - Round 3

---

_Last updated: 2026-01-22_
