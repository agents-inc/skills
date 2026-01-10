# Stack Marketplace: Final Decisions

> **Purpose**: Authoritative record of user-confirmed decisions for the Stack Marketplace project, integrating three rounds of research.

---

## Implementation Progress (2026-01-09)

### Phase 1: Restructure ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Create central `src/skills/` directory | ✅ Done | Skills moved from profiles to central location |
| Move skills from profiles | ✅ Done | 26 skills migrated |
| Update registry.yaml paths | ✅ Done | Paths already used `skills/` prefix |
| Update compile.ts paths | ✅ Done | Changed from `profiles/${PROFILE}/skills/` to `src/skills/` |
| Verify compilation | ✅ Done | All 15 agents compile successfully |

### Phase 2: Stack Logic ✅ COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Create stack.schema.json | ✅ Done | Full schema with overrides, metrics, philosophy |
| Create skill.schema.json | ✅ Done | Includes requires, conflicts_with, compatible_with |
| Add skill.yaml metadata to all skills | ✅ Done | 26 skill.yaml files created |
| Add stack resolution to compile.ts | ✅ Done | Profiles can now use `stack:` field |
| Create initial stack definitions | ✅ Done | `modern-react.yaml`, `minimal-react.yaml` |

### Phase 3: CLI Commands ⏳ PENDING

> **Note**: Phase 3 requires discussion before implementation.

| Task | Status | Notes |
|------|--------|-------|
| `claude-stacks list` | Pending | Browse available stacks |
| `claude-stacks use <id>` | Pending | Select a stack for profile |
| `claude-stacks build` | Pending | Interactive stack builder wizard |
| `claude-stacks export` | Pending | Export current profile as stack |

### New Directory Structure

```
src/
├── skills/                              # Categorized with publisher naming
│   ├── frontend/
│   │   ├── react (@vince)/              # React patterns (SCSS/cva stack)
│   │   ├── scss-modules (@vince)/       # SCSS Modules + cva
│   │   ├── zustand (@vince)/            # Zustand state management
│   │   ├── react-query (@vince)/        # React Query data fetching
│   │   ├── vitest (@vince)/             # Vitest + Playwright + RTL
│   │   ├── msw (@vince)/                # MSW mocking
│   │   ├── accessibility (@vince)/      # WCAG, ARIA patterns
│   │   ├── performance (@vince)/        # Bundle optimization
│   │   ├── react-mobx (@photoroom)/     # React + MobX patterns
│   │   ├── tailwind (@photoroom)/       # Tailwind CSS patterns
│   │   ├── mobx (@photoroom)/           # MobX state management
│   │   └── react-query-mobx (@photoroom)/ # React Query + MobX bridge
│   ├── backend/
│   │   ├── hono (@vince)/               # Hono API routes
│   │   ├── drizzle (@vince)/            # Drizzle ORM
│   │   ├── better-auth (@vince)/        # Better Auth patterns
│   │   ├── posthog-analytics (@vince)/  # PostHog analytics
│   │   ├── posthog-flags (@vince)/      # PostHog feature flags
│   │   ├── resend (@vince)/             # Resend email
│   │   ├── observability (@vince)/      # Pino, Sentry, Axiom
│   │   ├── github-actions (@vince)/     # CI/CD patterns
│   │   ├── performance (@vince)/        # Query optimization
│   │   └── testing (@vince)/            # API testing
│   ├── security/
│   │   └── security (@vince)/           # Auth, secrets, XSS/CSRF
│   ├── setup/
│   │   ├── turborepo (@vince)/          # Monorepo patterns
│   │   ├── package (@vince)/            # Package conventions
│   │   ├── env (@vince)/                # Environment config
│   │   ├── tooling (@vince)/            # ESLint, Prettier, TS
│   │   ├── posthog-setup (@vince)/      # PostHog setup
│   │   ├── resend-setup (@vince)/       # Resend setup
│   │   └── observability-setup (@vince)/ # Observability setup
│   ├── shared/
│   │   └── reviewing (@vince)/          # Code review patterns
│   └── research/
│       └── research-methodology (@vince)/ # Investigation patterns
├── stacks/
│   ├── modern-react.yaml                # @vince: SCSS + Zustand + React Query
│   ├── minimal-react.yaml               # @vince: Minimal frontend-only
│   └── photoroom-webapp.yaml            # @photoroom: Tailwind + MobX
├── schemas/
│   ├── stack.schema.json                # Stack validation
│   └── skill.schema.json                # Skill metadata validation
└── compile.ts                           # Updated with stack resolution
```

### Skill Naming Convention

Skills use the format: `category/technology-name (@publisher)`

**Examples:**
- `frontend/react (@vince)` - React patterns by @vince
- `frontend/mobx (@photoroom)` - MobX patterns by @photoroom
- `backend/hono (@vince)` - Hono API routes by @vince

This enables:
- Clear categorization by domain (frontend, backend, etc.)
- Community contributions with clear attribution
- Multiple implementations of the same technology
- Stack selection based on philosophy/author preference

---

> **UPDATE 2026-01-09**: This document has been superseded by **[STACK-MARKETPLACE-ARCHITECTURE.md](./STACK-MARKETPLACE-ARCHITECTURE.md)** for architectural decisions. Key changes:
> - **Stacks now replace profiles entirely** (not separate concepts)
> - **Skills are atomic** - no bleeding between skills (67% of cross-refs removable)
> - **Framework as foundation** - everything else as siblings (no integrations layer)
> - **Stacks ARE versioned** (changed from earlier "no versioning" decision)
> - **Skill naming simplified** - `technology-name (@publisher)` format
>
> The decisions below about community, upvotes, and quality signals remain valid.

---

## Executive Summary

The Stack Marketplace is a CLI-first platform for browsing, selecting, and contributing pre-configured Claude Code skill/agent combinations ("stacks"). After three research rounds (Open Source Strategy, Community Registry, Stack Marketplace), the user has confirmed a **community-ready-from-day-1** approach with **upvote-only quality signals** and **no tiered badges**. All features will be built incrementally over 1-2 days **before launch**, not as a post-launch evolution roadmap. The project differentiates itself by offering what no existing tool provides: community-created stacks with voting, smart cascading filters based on framework choices, and named stacks with philosophical identities.

---

## Key Decisions (User Confirmed)

### Implementation Approach

| Decision | Details |
|----------|---------|
| **"Phases" meaning** | Incremental development done in 1-2 days BEFORE launch |
| **Evolution roadmap** | NO - all features built before going live |
| **Community timing** | Ready from day 1, not "curated first, community later" |
| **Launch state** | Full system operational: smart filtering, upvotes, custom builder, community submissions |

### Quality Signals

| Decision | Details |
|----------|---------|
| **Maintained flags** | NO - not implementing |
| **Verified badges** | NO - not implementing |
| **Official/Verified/Community tiers** | NO - everything on the same level |
| **Quality mechanism** | Upvotes and usage metrics ONLY |
| **Downvotes** | NO - upvote-only system (reduces drama, low-quality stacks simply don't get upvoted) |

**Rationale**: Quality emerges organically from community engagement. Artificial tiers create gatekeeping that hinders adoption. The community decides what's valuable through votes and downloads.

### Directory Naming

| Decision | Details |
|----------|---------|
| **Stacks directory** | TBD - not decided yet whether to call it `stacks/` or something else |
| **Timeline** | Will be determined during implementation |

### Future Features (Post-Launch)

| Feature | Description | Timeline |
|---------|-------------|----------|
| **Stack Arena** | A comparison mode where users can see the output of famous apps (like a todo app) built with different stacks/variants | AFTER launch |

---

## What's Confirmed from Research

### Core Approach

| Finding | Source | Status |
|---------|--------|--------|
| **Stack-first approach** | Agent 3 (Unification) | CONFIRMED - Users select stacks, skills follow automatically |
| **Smart filtering system** | Agent 2 (Filtering) | CONFIRMED - Framework -> Styling -> State -> Testing cascade |
| **Slot-based composition** | Agent D (Round 2) | CONFIRMED - Agents declare required/optional slots, stacks fill them |
| **Upvote-only voting** | Agent 5 (Schema & UX) | CONFIRMED - No downvotes |
| **CLI-first experience** | Agent 5 (Schema & UX) | CONFIRMED - Web catalog optional for later |
| **Near-zero contribution friction** | Agent 4 (Viral Adoption) | CONFIRMED - Stack = single YAML file, <10 min to create |
| **High-visibility attribution** | Agent 4 (Viral Adoption) | CONFIRMED - Creator name everywhere, download counts, profiles |

### Technical Design

| Component | Design Decision | Source |
|-----------|-----------------|--------|
| **Stack schema** | Reference skills by ID (not embedded content) | Agent 5 |
| **Filtering relationships** | 4 types: requires, suggests, enhances, conflicts | Agent 2 |
| **Compilation model** | Stack -> Resolve skill IDs -> Generate profile -> Compile agents | Agent 5 |
| **Category cardinality** | Single for most (framework, styling), multiple for testing | Agent 2 |
| **Auto-selection** | Yes for `requires`, No for `suggests` | Agent 2 |

### UX Design

| Pattern | Implementation |
|---------|----------------|
| **Progressive disclosure wizard** | Step-by-step category selection with reasons shown for disabled options |
| **Summary panel** | Always-visible panel showing current stack composition |
| **Why tooltips** | Every disabled option shows WHY on hover |
| **Advanced mode** | Toggle for power users who want all categories at once |

---

## Stack Schema (Final)

Based on Agent 5's design, simplified for the flat quality model:

```yaml
# Example: stacks/yolo-modern-react.yaml

# Identity & Metadata
id: yolo-modern-react
name: "YOLO Modern React Stack"
description: >
  Modern React with Tailwind, Zustand, and React Query.
  Move fast without breaking things.
author: "@vincentbollaert"
version: "1.0.0"
created: "2026-01-01"
updated: "2026-01-08"

# Composition
framework: react
slots:
  styling: frontend/tailwind
  state-management: frontend/zustand
  data-fetching: frontend/react-query
  testing: frontend/vitest
  mocking: frontend/msw
  accessibility: frontend/accessibility

# Agents to include
agents:
  - frontend-developer
  - frontend-reviewer
  - tester
  - pm

# Philosophy
philosophy: "Ship fast, iterate faster"
principles:
  - Prefer composition over inheritance
  - Use hooks for everything, avoid classes
  - Tailwind utilities first, extract components when repeated 3x

# Discoverability
tags: [react, typescript, tailwind, zustand, modern, startup]

# Trust Signals (Community-driven)
metrics:
  upvotes: 0       # Incremented by community
  downloads: 0     # Tracked automatically
```

**Key differences from Agent 5's proposal:**
- Removed `verification.verified` and `verification.tier`
- Removed `badges` array
- Kept `metrics` for upvotes and downloads (community signals only)

---

## CLI Commands (Final)

```bash
# Browse
claude-stacks list                         # List all stacks
claude-stacks list --framework react       # Filter by framework
claude-stacks list --tag tailwind          # Filter by tag
claude-stacks list --sort popular          # Sort: popular, recent, downloads
claude-stacks search "tailwind zustand"    # Full-text search
claude-stacks preview <id>                 # Detailed preview

# Use
claude-stacks use <id>                     # Use a stack for your profile
claude-stacks use <id> --profile work      # Specify profile

# Build Custom
claude-stacks build                        # Interactive wizard
claude-stacks build --framework react      # Start with framework pre-selected

# Contribute
claude-stacks export <name>                # Export current profile as stack
claude-stacks validate <file>              # Validate stack YAML
claude-stacks submit <file>                # Create PR to contribute

# Engage
claude-stacks upvote <id>                  # Upvote a stack
```

---

## Research Files Created

This research effort produced the following documentation:

| File | Purpose | Round |
|------|---------|-------|
| [INDEX.md](./INDEX.md) | Architecture research index (49 issues from 12 agents) | Pre-research |
| [OPEN-SOURCE-RESEARCH-TRACKER.md](./OPEN-SOURCE-RESEARCH-TRACKER.md) | Round 1: Open source strategy (4 agents - CLI onboarding, positioning, profiles, community patterns) | Round 1 |
| [COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md](./COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md) | Round 2: Community registry (5 agents - skill isolation, dependencies, registry models, bundling, comparison) | Round 2 |
| [STACK-MARKETPLACE-PROPOSAL-RESEARCH.md](./STACK-MARKETPLACE-PROPOSAL-RESEARCH.md) | Round 3: Stack marketplace (5 agents - prior art, filtering, unification, viral adoption, schema) | Round 3 |
| [FINAL-DECISION.md](./FINAL-DECISION.md) | This file - final decisions record | Final |

### Key Insights by Round

**Round 1 (Open Source Strategy)**:
- Additive framing ("what do you do?") beats subtractive ("what to remove?")
- Hybrid positioning: Dev Kit + Framework (own content, updatable core)
- `_templates/` + `local/` directory structure
- CLI onboarding with presets + customization

**Round 2 (Community Registry)**:
- Full skill isolation is NOT feasible - bounded isolation (~85% domain, ~15% integration)
- Skill Slots with Defaults is the right bundling model
- Homebrew-style dependency declarations (`requires`, `conflicts`)
- Ship Dev Kit for v1, registry concepts layer on top

**Round 3 (Stack Marketplace)**:
- No existing tool combines community stacks + upvoting + smart filtering
- Stack-first selection is the right UX (stacks fill skill slots)
- Near-zero contribution friction (<10 min) is critical for adoption
- Single-user utility must exist before network effects (CLI works without community)

---

## What to Build First

### Day 1: Foundation

1. **Stack schema** (`stack.schema.json`)
   - Based on final schema above
   - JSON Schema for IDE validation
   - Zod schema for runtime validation

2. **Core official stacks** (5-10 to start)
   - YOLO Modern React (React + Tailwind + Zustand + React Query)
   - Conservative Redux (React + SCSS + Redux Toolkit + RTK Query)
   - Minimal React (React + CSS Modules only)
   - Full Stack (React + Tailwind + Zustand + Hono + Drizzle)
   - Vue Modern (Vue + Tailwind + Pinia + Vue Query)

3. **CLI commands: list, preview, use**
   - Basic browsing and selection
   - No filtering yet, just display

### Day 2: Smart Filtering & Custom Builder

4. **Filtering schema** (based on Agent 2's design)
   - Technology definitions with relationships
   - Category definitions with cardinality

5. **Filter engine** (TypeScript)
   - Cascade algorithm for `requires`, `suggests`, `conflicts`
   - Available options calculation
   - Disabled reasons generation

6. **CLI command: build** (wizard)
   - Step-by-step selection
   - Show disabled options with "why" explanations
   - Summary panel

### Day 3: Community Features

7. **CLI commands: export, validate, submit**
   - Export current profile as stack YAML
   - Validate against schema
   - Create GitHub PR (using `gh` CLI)

8. **CLI command: upvote**
   - Simple upvote mechanism
   - Store in JSON file or GitHub API

9. **Compiler integration**
   - Stack resolution step in compilation pipeline
   - Profile can specify `stack:` field

---

## What's Deferred (Post-Launch)

| Feature | Description | Why Deferred |
|---------|-------------|--------------|
| **Stack Arena** | Side-by-side comparison of same app built with different stacks | Requires significant additional infrastructure |
| **Web catalog** | Browse stacks in browser | CLI-first; web is nice-to-have |
| **Creator profiles** | Full creator pages with all their stacks | Start with simple attribution |
| **Trending algorithm** | Sophisticated popularity calculation | Start with simple sort by upvotes |
| **Comments/discussions** | Stack-level discussions | Use GitHub issues initially |
| **Forking stacks** | "Based on" lineage tracking | Start with independent stacks |

---

## Success Metrics

Based on Agent 4's viral adoption research:

| Metric | Target (6 months) | Why |
|--------|-------------------|-----|
| **Official stacks** | 30-50 | Quality seeding for cold start |
| **Community stacks** | 200+ | Network effects kicking in |
| **Total downloads** | 10,000+ | Adoption indicator |
| **Stack creators** | 50+ | Community engagement |
| **Average upvotes (top 10)** | 500+ | Quality differentiation working |

---

## Continuation Prompt

Use this to resume work in a new session:

```
Read .claude/research/findings/FINAL-DECISION.md for the authoritative decisions on the Stack Marketplace project.

Key decisions:
- Community ready from day 1 (not phased)
- No tiers/badges - upvotes only
- Build everything in 1-2 days before launch

I want to:
- Start implementing [Day 1 / Day 2 / Day 3] items
- Review the CLI command designs
- Deep dive into the filtering schema
- Create the first official stacks
```

---

_Last updated: 2026-01-08_

**Research complete. Ready for implementation.**
