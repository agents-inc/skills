# Architecture Research Index

> **Start here** for any session involving the agent/skill architecture improvement project.

---

## Quick Context (Read This First)

**What is this project?**
A modular agent/skill compilation system for Claude Code that uses:

- TypeScript compiler (`.claude-src/compile.ts`)
- LiquidJS templates (`.claude-src/templates/agent.liquid`)
- YAML configs (`registry.yaml` for agents+skills, profile configs)
- Profile switching (home/work) for different tech stacks

**What happened?**
On 2026-01-08, we spawned 12 research agents with ultrathink to analyze every aspect of the architecture. They identified **49 distinct issues** across maintainability, type safety, prompting, scalability, DRY, templates, compilation, profiles, skills, XML tags, model optimization, and testing.

Additionally, **three rounds of open-source research** were completed:

- **Round 1**: Open Source Strategy (4 agents) - CLI onboarding, positioning, profiles, community patterns
- **Round 2**: Community Registry (5 agents) - Skill isolation, dependencies, registry models, bundling
- **Round 3**: Stack Marketplace (5 agents) - Prior art, filtering, unification, viral adoption, schema

**Current Status:**

- Phase 1 (Architecture Research): ✅ Complete (49 issues identified)
- Phase 2 (Synthesis): ✅ Complete
- Phase 3 (Implementation): ⏳ Pending
- Phase 4 (Competitor Analysis): ⏳ Pending
- **Open Source Research: ✅ COMPLETE** - See [FINAL-DECISION.md](./FINAL-DECISION.md)
- **Skill Folder Migration: ✅ COMPLETE** - See [SKILL-FOLDER-MIGRATION.md](./SKILL-FOLDER-MIGRATION.md)
- **Skill Loading Refactor: ✅ IMPLEMENTED** - See [SKILL-LOADING-REFACTOR-PLAN.md](./SKILL-LOADING-REFACTOR-PLAN.md)

---

## Key Files

| File                                                                               | Purpose                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **[ISSUES-INDEX.md](./ISSUES-INDEX.md)**                                           | All 49 issues explained, ordered by severity         |
| **[ARCHITECTURE-IMPROVEMENT-FINDINGS.md](./ARCHITECTURE-IMPROVEMENT-FINDINGS.md)** | Main tracking doc with detailed findings by category |
| **[SKILL-FOLDER-MIGRATION.md](./SKILL-FOLDER-MIGRATION.md)**                       | Skill migration to folder-based structure (COMPLETE) |

### Detailed Analysis Files

| Area                  | File                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| Type Safety           | [TYPE-SAFETY-DETAILED.md](./TYPE-SAFETY-DETAILED.md)                                   |
| Scalability           | [SCALABILITY-ANALYSIS.md](./SCALABILITY-ANALYSIS.md)                                   |
| DRY Principles        | [DRY-PRINCIPLES-AGENT5-FINDINGS.md](./DRY-PRINCIPLES-AGENT5-FINDINGS.md)               |
| Template Architecture | [TEMPLATE-ARCHITECTURE-FINDINGS.md](./TEMPLATE-ARCHITECTURE-FINDINGS.md)               |
| Compilation Pipeline  | [COMPILATION-PIPELINE-FINDINGS.md](./COMPILATION-PIPELINE-FINDINGS.md)                 |
| Profile System        | [PROFILE-SYSTEM-FINDINGS.md](./PROFILE-SYSTEM-FINDINGS.md)                             |
| XML Tag Strategy      | [10-XML-TAG-STRATEGY-FINDINGS.md](./10-XML-TAG-STRATEGY-FINDINGS.md)                   |
| Model Optimizations   | [MODEL-SPECIFIC-OPTIMIZATIONS-FINDINGS.md](./MODEL-SPECIFIC-OPTIMIZATIONS-FINDINGS.md) |

### Open Source Research Files (Stack Marketplace)

| Round     | File                                                                                 | Content                                                   |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **FINAL** | **[FINAL-DECISION.md](./FINAL-DECISION.md)**                                         | **Authoritative decisions - START HERE**                  |
| Round 1   | [OPEN-SOURCE-RESEARCH-TRACKER.md](./OPEN-SOURCE-RESEARCH-TRACKER.md)                 | CLI onboarding, positioning, profiles, community patterns |
| Round 2   | [COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md](./COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md) | Skill isolation, dependencies, registry models, bundling  |
| Round 3   | [STACK-MARKETPLACE-PROPOSAL-RESEARCH.md](./STACK-MARKETPLACE-PROPOSAL-RESEARCH.md)   | Prior art, filtering, viral adoption, schema design       |

**Key OSS Decisions (from FINAL-DECISION.md):**

- Community ready from day 1 (not phased)
- No tiers/badges - upvotes only (quality emerges from votes)
- Build everything in 1-2 days before launch
- CLI-first experience
- Stack Arena deferred to post-launch

---

## Issue Summary (49 Total)

### RESOLVED (2)

1. ~~**Agents consume 30-35% of context**~~ → ✅ **RESOLVED**: 17% context usage in worst case is acceptable for short-lived subagents
2. ~~**Dynamic skill invocation is fake**~~ → ✅ **RESOLVED**: All 36 skills now have proper YAML frontmatter

### NOT NEEDED (2)

10. ~~**No skill versioning**~~ → ❌ **NOT NEEDED**: Git history sufficient, no external consumers
11. ~~**No skill dependencies**~~ → ❌ **NOT NEEDED**: Skills are self-contained, bundles solve grouping

### CRITICAL (2) _(Updated 2026-01-08)_

2. **No test suite** - Zero test files exist
3. **No CI/CD** - No automated validation
4. **Schema/compiler mismatch** - Skill overrides silently ignored

### HIGH (12) _(#7, #8 re-investigated 2026-01-08)_

6. Schema validation IDE-only (no runtime)
7. Config redundancy (625+ lines) → **Solutions identified**: YAML anchors (40% reduction), profile defaults, skill bundles - see [ISSUE-7-8-PROPOSALS.md](./ISSUE-7-8-PROPOSALS.md)
8. Multi-file update workflow (5-7 files per agent) → 📋 **PLANNED**: Scaffolding CLI - see [ISSUE-7-8-PROPOSALS.md](./ISSUE-7-8-PROPOSALS.md)
9. Verification scripts doc-only
10. Redundant skill compilation
11. Workflow files ~80% duplicated
12. No config defaults mechanism
13. No file caching in compiler
14. Sequential compilation
15. Undocumented workflow tags (15+)
16. Excessive template whitespace
17. Missing MUST/SHOULD classification

### MEDIUM (18) & LOW (12)

See [ISSUES-INDEX.md](./ISSUES-INDEX.md) for complete list.

---

## Recommended Next Steps

### Phase 3: Implementation (Priority Order)

**Foundation (Critical):**

1. Add test suite for compiler
2. Add CI/CD pipeline
3. Add Zod runtime validation

**Context Optimization (Critical):** 4. Reduce compiled agent sizes 5. Add file caching 6. Parallelize compilation

**DRY Refactoring (High):** 7. Extract common workflows 8. Implement config defaults 9. Create skill bundles

**Feature Completion (High):** 10. Fix or remove dynamic skill loading 11. Create scaffolding CLI 12. Save verification scripts

### Phase 4: Competitor Analysis

Review systems in `.claude/research/`:

- `competitor-superclaude.md`
- `competitor-zebbern-claude-code-guide.md`
- `competitor-wshobson-agents.md`
- `competitor-claude-flow.md`
- `competitor-voltagent.md`

---

## Architecture Overview

```
.claude-src/
├── registry.yaml            # Single source of truth for agents + skills
├── agents.yaml              # DEPRECATED - merged into registry.yaml
├── skills.yaml              # DEPRECATED - merged into registry.yaml
├── compile.ts               # TypeScript compiler
├── types.ts                 # Type definitions
├── templates/
│   └── agent.liquid         # Main agent template
├── agent-sources/           # Agent source files (16 agents)
│   └── {agent}/
│       ├── intro.md         # Role definition
│       ├── workflow.md      # Agent workflow
│       ├── critical-requirements.md
│       ├── critical-reminders.md
│       └── examples.md
├── core-prompts/            # Shared prompts
├── profiles/
│   ├── home/                # Personal projects (Zustand, SCSS)
│   │   ├── config.yaml
│   │   ├── CLAUDE.md
│   │   └── skills/
│   └── work/                # Photoroom (MobX, Tailwind)
│       ├── config.yaml
│       ├── CLAUDE.md
│       └── skills/
└── docs/
    └── CLAUDE_ARCHITECTURE_BIBLE.md

.claude/                     # Compiled output
├── agents/                  # Compiled agent .md files
├── skills/                  # Compiled skill files
└── research/findings/       # Architecture research documentation
```

---

## Continuation Prompt

Use this to resume work in a new session:

```
Read .claude/research/findings/INDEX.md to get context on the architecture improvement project.

We completed Phase 1 (research with 12 agents) and Phase 2 (synthesis).
49 issues were identified across 12 areas.

I want to [CHOOSE ONE]:
- Proceed with Phase 3 implementation, starting with [critical/high/specific issue]
- Proceed with Phase 4 competitor analysis
- Deep dive into [specific area] findings
- Review the issues list and reprioritize
```

---

_Last updated: 2026-01-09_

**Session Highlights:**

**Architecture Research:**

- ✅ Issue #1 RESOLVED (context usage acceptable)
- ✅ Issue #4 RESOLVED (36 skills now have frontmatter)
- ✅ Issue #8 PLANNED (scaffolding CLI proposal ready)
- ✅ Issue #10 NOT NEEDED (versioning unnecessary - git sufficient)
- ✅ Issue #11 NOT NEEDED (skill dependencies unnecessary - bundles solve this)
- ✅ Created `registry.yaml` (merged agents.yaml + skills.yaml)
- ✅ Updated `compile.ts` to use registry.yaml
- ✅ Created `ISSUE-7-8-PROPOSALS.md` with implementation details

**Open Source Research (3 Rounds, 14 Agents):**

- ✅ Round 1: Open Source Strategy (4 agents) - CLI onboarding, positioning, profiles, community patterns
- ✅ Round 2: Community Registry (5 agents) - Skill isolation, dependencies, registry models, bundling
- ✅ Round 3: Stack Marketplace (5 agents) - Prior art, filtering, viral adoption, schema design
- ✅ Created `FINAL-DECISION.md` - Authoritative record of user-confirmed decisions
- ✅ **OSS RESEARCH COMPLETE** - Ready for implementation

**Skill Folder Migration (2026-01-09):**

- ✅ Updated compile.ts to support folder-based skills
- ✅ Updated schema files to allow folder paths (trailing /)
- ✅ Migrated 25 skills to folder-based structure (skill.md + examples.md + reference.md)
- ✅ 2 stub skills skipped (backend/performance, backend/testing - need content first)
- ✅ 78 total skill files now compile (26 SKILL.md + 52 supporting files)
- ✅ See [SKILL-FOLDER-MIGRATION.md](./SKILL-FOLDER-MIGRATION.md) for details

**Skill Loading Refactor (2026-01-09):**

- ✅ Unified `skills` array (removed `precompiled` vs `dynamic` distinction)
- ✅ Added `<skill_activation_protocol>` section with three-step EVALUATE/ACTIVATE/IMPLEMENT
- ✅ Emphatic language for 84% activation rate (vs 20% baseline)
- ✅ Protocol placed after `<critical_requirements>` for context proximity
- ✅ Simplified skill listing format (removed bold formatting)
- ✅ Updated CLAUDE_ARCHITECTURE_BIBLE.md with new patterns
- ✅ See [SKILL-LOADING-REFACTOR-PLAN.md](./SKILL-LOADING-REFACTOR-PLAN.md) for research
