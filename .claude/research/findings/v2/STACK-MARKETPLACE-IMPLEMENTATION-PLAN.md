# Stack Marketplace: Comprehensive Implementation Plan

> **Purpose**: Single source of truth for the Stack Marketplace project. Start here.
> **Status**: READY FOR IMPLEMENTATION
> **Date**: 2026-01-09
> **Last Updated**: 2026-01-09

---

## How to Use This Document

**For a fresh context window**, read this file first. It contains:
1. All confirmed decisions (locked, don't revisit)
2. Final directory structure and schemas
3. Implementation phases with tasks
4. Links to detailed research documents

**Before implementing**, note this prerequisite:
- Current skills may benefit from `examples.md` and `reference.md` files (see [CLAUDE-CODE-SKILL-CONVENTIONS.md](./CLAUDE-CODE-SKILL-CONVENTIONS.md))
- Consider aligning existing skills with Claude Code conventions first

---

## Related Research Documents

| Document | Purpose |
|----------|---------|
| [FINAL-DECISION.md](./FINAL-DECISION.md) | Original user decisions from Round 1-3 research |
| [SKILL-FORKING-RESEARCH.md](./SKILL-FORKING-RESEARCH.md) | Fork-and-forget pattern validation |
| [SKILL-VERSIONING-RESEARCH.md](./SKILL-VERSIONING-RESEARCH.md) | npm/Cargo/Helm versioning patterns |
| [STACK-COMPILE-COMPATIBILITY.md](./STACK-COMPILE-COMPATIBILITY.md) | compile.ts integration analysis |
| [CLAUDE-CODE-SKILL-CONVENTIONS.md](./CLAUDE-CODE-SKILL-CONVENTIONS.md) | Official skill structure conventions |
| [VOTING-SYSTEM-RESEARCH.md](./VOTING-SYSTEM-RESEARCH.md) | GitHub Discussions voting (deferred) |

---

## Executive Overview

The Stack Marketplace is a CLI-first platform for browsing, selecting, and contributing pre-configured Claude Code skill/agent combinations ("stacks"). This document refines FINAL-DECISION.md into actionable implementation steps.

### What This Document Contains

1. **Confirmed Decisions** - All user-confirmed choices (locked)
2. **Open Questions** - Items needing user input before implementation
3. **Proposed Architecture** - Directory structure and schemas
4. **Implementation Phases** - Sequential build order
5. **Technical Specifications** - Detailed schemas and CLI designs
6. **Risk Mitigation** - Known challenges and solutions

---

## Part 1: Confirmed Decisions (Locked)

These decisions are confirmed and will not change during implementation.

### Core Philosophy

| Decision | Details | Source |
|----------|---------|--------|
| Community from Day 1 | Not "curated first, community later" | User confirmed |
| Upvotes Only | No downvotes, no badges, no tiers | User confirmed |
| Build Before Launch | All features ready before going live | User confirmed |
| Stacks Are Primary Unit | Stacks are the compilation unit | User confirmed |
| PR-based Ownership | Stack creators are CODEOWNERS for their stacks | User confirmed |
| Full Marketplace MVP | Community submissions from day 1 | User confirmed |
| Single Repository | No separate community repo (for now) | User confirmed |

### Technical Approach

| Decision | Details | Source |
|----------|---------|--------|
| Voting Mechanism | **DEFERRED** - Will add Firebase or similar later | User confirmed |
| Vote Tracking | **DEFERRED** - JSON file tracking planned for future | User confirmed |
| Skill Stability | **Automatic forking** - skills cloned into stack, completely disconnected | User confirmed |
| Smart Filtering | Framework → Styling → State → Testing cascade | Round 3 Research |
| CLI-first | Web catalog optional for later | FINAL-DECISION.md |

---

## Part 2: Open Questions Requiring Decision

### Question 1: Directory Structure - DECIDED

**Research Findings**: See [STACK-COMPILE-COMPATIBILITY.md](./STACK-COMPILE-COMPATIBILITY.md) and [CLAUDE-CODE-SKILL-CONVENTIONS.md](./CLAUDE-CODE-SKILL-CONVENTIONS.md).

**Key Insight**: Stacks should use the **compiled format** (folder-per-skill with `SKILL.md`), not the source format (flat files). This requires **zero changes to compile.ts**.

**Final Structure**:

```
src/
├── registry.yaml              # Existing: agent + skill definitions
├── marketplace/               # NEW: Community stacks
│   ├── stacks/
│   │   ├── @vincentbollaert/  # Scoped by author (CODEOWNERS)
│   │   │   └── yolo-modern-react/
│   │   │       ├── stack.yaml
│   │   │       └── skills/    # Forked skills (compiled format)
│   │   │           ├── frontend-react/
│   │   │           │   └── SKILL.md
│   │   │           ├── frontend-styling/
│   │   │           │   └── SKILL.md
│   │   │           └── frontend-testing/
│   │   │               └── SKILL.md
│   │   └── @community/        # Official/shared stacks
│   │       └── react-zustand-scss/
│   │           ├── stack.yaml
│   │           └── skills/
│   └── CODEOWNERS             # Maps @user/ dirs to GitHub users
├── profiles/                  # Existing: personal profiles (unchanged)
│   ├── home/
│   │   ├── config.yaml
│   │   └── skills/            # Source format (flat files)
│   └── work/
└── compile.ts                 # UNCHANGED - stacks bypass compilation
```

**Key Design Decisions**:
1. **Stacks use compiled format** - `skills/frontend-react/SKILL.md` matches `.claude/skills/` output
2. **Scoped directories** (`@username/`) - CODEOWNERS protects user content
3. **Skills forked into stack** - Complete copies, disconnected from originals
4. **No changes to compile.ts** - Stacks are standalone, pre-compiled artifacts
5. **Optional supporting files** - Skills can include `examples.md`, `reference.md`, `scripts/`

**Why This Works**:
- Forking = copy from `.claude/skills/{id}/SKILL.md` to `stack/skills/{id}/SKILL.md`
- Claude Code already expects this structure
- Skills in central repository used by all stacks
- Stacks are ready-to-use without compilation

### Question 2: Skill Versioning Approach - DECIDED

**User Decision**: Automatic Forking (Fork-and-Forget)

**How It Works**:
1. When you create a stack and select a skill, it gets **cloned into your stack folder**
2. The forked skill is **completely disconnected** from the original
3. No notifications when the original skill is updated
4. You can modify your forked copy however you want
5. The original and your fork evolve independently

**Rationale**:
- Stacks will naturally become hyper-focused and deviate from originals
- Complete ownership of your stack content
- No "your stack broke because upstream changed" issues
- Simpler mental model: "it's all in my folder"

**Stack Structure with Forked Skills** (Compiled Format):
```
marketplace/stacks/@username/my-stack/
├── stack.yaml                 # Stack metadata
└── skills/                    # Forked skills (compiled format)
    ├── frontend-react/        # Folder per skill
    │   ├── SKILL.md           # Required: main skill content
    │   ├── examples.md        # Optional: detailed examples
    │   └── reference.md       # Optional: additional docs
    ├── frontend-styling/
    │   └── SKILL.md
    └── frontend-zustand/
        └── SKILL.md
```

**Skill Metadata** (in SKILL.md frontmatter):
```yaml
---
name: React
description: Component architecture, hooks, patterns

# PROVENANCE (auto-generated on fork)
forked_from:
  skill: frontend/react        # Original registry ID
  version: 1.2.0               # Version at fork time
  date: 2026-01-09
  original_checksum: sha256:abc123...

# CUSTOMIZATION (auto-updated on edit)
modified: true
modified_date: 2026-01-15
---
```

**What This Means**:
- No lockfiles needed
- No version resolution
- No upgrade notifications
- Full isolation between stacks
- Possible divergence (considered a feature, not a bug)

**Future Enhancement** (not MVP):
- Comparison tooling to diff forked skills against originals
- "Based on" metadata for discovery

**Research**: See [SKILL-FORKING-RESEARCH.md](./SKILL-FORKING-RESEARCH.md) for detailed analysis.

### Question 3: CLI Integration

**Context**: You said CLI design has "too many open questions" for now.

**Minimal Proposal for MVP**:
```bash
# Add to existing bun scripts
bun stacks list                    # List available stacks
bun stacks preview <stack-id>      # Show stack details
bun stacks use <stack-id>          # Apply stack to current profile
bun stacks create                  # Interactive stack builder
bun stacks submit                  # Create PR for community stack
```

**Defer to Later**:
- Separate `claude-stacks` npm package
- Global installation
- Advanced filtering commands

---

## Part 3: Implementation Phases

### Phase 1: Foundation (Day 1 Morning)

**Goal**: Stack schema exists and can be validated

**Tasks**:
1. [ ] Create `marketplace/` directory structure
2. [ ] Create `stack.schema.json` (JSON Schema for validation)
3. [ ] Create `stacks.yaml` registry file format
4. [ ] Add CODEOWNERS template
5. [ ] Create 3 seed stacks:
   - `@community/react-zustand-scss` (mirrors home profile)
   - `@community/react-mobx-tailwind` (mirrors work profile)
   - `@community/minimal-react` (React only, no extras)

**Deliverables**:
- Directory structure in place
- Schema validates correctly
- Seed stacks compile without errors

### Phase 2: Compilation Integration (Day 1 Afternoon)

**Goal**: Stacks integrate with the existing compilation pipeline

**Tasks**:
1. [ ] Update `compile.ts` to resolve stack references
2. [ ] Add `stack:` field to profile config schema
3. [ ] Implement skill resolution from stack
4. [ ] Test compilation with stack-based profile
5. [ ] Document stack compilation in README

**Deliverables**:
- Users compile with `--stack=@community/react-zustand-scss`
- Compilation pulls skills from stack definition
- Stack compilation is the primary compilation method

### Phase 3: Smart Filtering Engine (Day 2 Morning)

**Goal**: Framework choices cascade to valid options

**Tasks**:
1. [ ] Create `filtering.yaml` - technology relationships
2. [ ] Implement filter engine in TypeScript
3. [ ] Create technology categories:
   - Framework: react, vue, svelte, angular
   - Styling: scss-modules, tailwind, styled-components, css-modules
   - State: zustand, mobx, redux, jotai, pinia (vue)
   - Data: react-query, rtk-query, apollo (graphql)
   - Testing: vitest, jest, karma, playwright
4. [ ] Define relationships (requires, suggests, conflicts, enhances)
5. [ ] Test cascade: React selected → Vue/Svelte/Angular disabled

**Deliverables**:
- `filtering.yaml` with all technology relationships
- TypeScript filter engine
- Unit tests for cascade logic

### Phase 4: Interactive Builder (Day 2 Afternoon)

**Goal**: Users can build custom stacks interactively

**Tasks**:
1. [ ] Create CLI wizard using Inquirer.js
2. [ ] Step-by-step selection:
   - Step 1: Framework (React/Vue/Svelte)
   - Step 2: Styling (options based on Step 1)
   - Step 3: State Management
   - Step 4: Data Fetching
   - Step 5: Testing
3. [ ] Show "why" when options are disabled
4. [ ] Generate stack YAML from selections
5. [ ] Support "use stack as-is" or "customize stack"

**Deliverables**:
- `bun stacks create` command works
- Generated YAML is valid
- Disabled options show explanations

### Phase 5: Community Contribution (Day 3 Morning)

**Goal**: Users can contribute stacks to the marketplace

**Tasks**:
1. [ ] Add `bun stacks submit` command:
   - Validates stack YAML and forked skills
   - Adds CODEOWNERS entry for author
   - Opens PR with proper labels
2. [ ] Create CONTRIBUTING.md for stack submissions
3. [ ] Add GitHub Action for PR validation:
   - Schema validation
   - Skill file existence check
   - Author directory structure

**Deliverables**:
- Submit workflow works end-to-end
- PR validation Action deployed
- Contribution docs complete

**Note**: Voting deferred - will add Firebase/similar later

### Phase 6: Documentation & Launch Prep (Day 3 Afternoon)

**Goal**: Ready for community launch

**Tasks**:
1. [ ] Write CONTRIBUTING.md for stack submissions
2. [ ] Create stack creation tutorial
3. [ ] Document CLI commands
4. [ ] Create 5-10 official stacks:
   - YOLO Modern React (React + Tailwind + Zustand + React Query)
   - Conservative Redux (React + SCSS + Redux Toolkit + RTK Query)
   - Minimal React (React + CSS Modules only)
   - Full Stack (React + Tailwind + Zustand + Hono + Drizzle)
   - Vue Modern (Vue + Tailwind + Pinia + Vue Query)
5. [ ] Test full workflow end-to-end
6. [ ] Prepare launch announcement

**Deliverables**:
- Complete documentation
- 10+ launch stacks
- Working end-to-end flow

---

## Part 4: Technical Specifications

### Stack YAML Schema

```yaml
# marketplace/stacks/@community/react-zustand-scss.yaml

# === Identity ===
id: react-zustand-scss
name: "React + Zustand + SCSS Stack"
description: >
  Modern React with Zustand for state, React Query for server state,
  and SCSS Modules with cva for styling. Opinionated but flexible.
author: "@vincentbollaert"
version: "1.0.0"
created: "2026-01-09"
updated: "2026-01-09"

# === Framework (required) ===
framework: react

# === Skill Slots ===
# Maps slot names to skill IDs from registry
slots:
  styling: frontend/scss-modules          # Or: frontend/tailwind
  state-management: frontend/zustand      # Or: frontend/mobx, frontend/redux
  data-fetching: frontend/react-query     # Or: frontend/rtk-query
  testing: frontend/vitest                # Or: frontend/jest
  mocking: frontend/msw
  accessibility: frontend/accessibility

# === Agents ===
# Which agents should be compiled with this stack's skills
agents:
  - frontend-developer
  - frontend-reviewer
  - tester
  - pm

# === Philosophy (optional) ===
philosophy: "Move fast, ship often, refactor when needed"
principles:
  - Prefer composition over inheritance
  - Use hooks for everything, avoid classes
  - SCSS utilities first, extract components when repeated 3x
  - Test behavior, not implementation

# === Discoverability ===
tags: [react, typescript, scss, zustand, modern]
keywords: [frontend, spa, state-management]

# === Links (optional) ===
links:
  discussion: https://github.com/org/repo/discussions/42
  documentation: https://...

# === Metrics (auto-populated) ===
# DO NOT EDIT - Updated by GitHub Action
metrics:
  upvotes: 0
  downloads: 0
  last_synced: null
```

### Filtering Schema

```yaml
# src/filtering.yaml

categories:
  framework:
    type: exclusive              # Only one can be selected
    required: true               # Must select one
    options:
      - id: react
        name: React
        description: Component-based UI with hooks
      - id: vue
        name: Vue
        description: Progressive framework with Composition API
      - id: svelte
        name: Svelte
        description: Compile-time framework, minimal runtime
      - id: angular
        name: Angular
        description: Full-featured enterprise framework

  styling:
    type: exclusive
    required: true
    options:
      - id: scss-modules
        name: SCSS Modules
        description: Scoped CSS with SCSS preprocessing
        requires: [react, vue, svelte, angular]  # Works with all
      - id: tailwind
        name: Tailwind CSS
        description: Utility-first CSS framework
        requires: [react, vue, svelte, angular]
      - id: styled-components
        name: Styled Components
        description: CSS-in-JS with tagged templates
        requires: [react]                        # React only
        conflicts: [scss-modules]

  state-management:
    type: exclusive
    required: false              # Optional for simple apps
    options:
      - id: zustand
        name: Zustand
        description: Minimal state management with hooks
        requires: [react]
      - id: mobx
        name: MobX
        description: Observable state with decorators
        requires: [react]
      - id: redux
        name: Redux Toolkit
        description: Predictable state container
        requires: [react]
      - id: pinia
        name: Pinia
        description: Vue's official state management
        requires: [vue]
      - id: jotai
        name: Jotai
        description: Primitive and flexible atoms
        requires: [react]

  data-fetching:
    type: exclusive
    required: false
    options:
      - id: react-query
        name: React Query / TanStack Query
        description: Server state management
        requires: [react, vue]
        suggests: [zustand, mobx]    # Pairs well with
      - id: rtk-query
        name: RTK Query
        description: Data fetching for Redux
        requires: [redux]
      - id: apollo
        name: Apollo Client
        description: GraphQL client
        requires: [react, vue]
        enhances: [graphql]

  testing:
    type: multiple               # Can select multiple
    required: false
    options:
      - id: vitest
        name: Vitest
        description: Vite-native test runner
        requires: [react, vue, svelte]
      - id: jest
        name: Jest
        description: Delightful JavaScript testing
        requires: [react, vue, angular]
      - id: playwright
        name: Playwright
        description: End-to-end testing
        requires: []             # Works with all
      - id: rtl
        name: React Testing Library
        description: Testing utilities for React
        requires: [react]
        suggests: [vitest, jest]
```

### Stack Configuration Example

```yaml
# src/stacks/home-stack/config.yaml

name: home-stack
description: Personal projects stack

skills:
  - frontend/react (@vince)
  - frontend/scss-modules (@vince)
  - frontend/zustand (@vince)
  # ... more skills

agents:
  - frontend-developer
  - backend-developer
  - tester
  # ... more agents
```

### votes.json Format

```json
{
  "last_synced": "2026-01-09T12:00:00Z",
  "stacks": {
    "@community/react-zustand-scss": {
      "discussion_id": 42,
      "discussion_url": "https://github.com/org/repo/discussions/42",
      "upvotes": 128,
      "rank": 1
    },
    "@community/conservative-redux": {
      "discussion_id": 43,
      "discussion_url": "https://github.com/org/repo/discussions/43",
      "upvotes": 95,
      "rank": 2
    }
  }
}
```

---

## Part 5: Risk Mitigation

### Risk 1: Cold Start Problem

**Problem**: No stacks to browse at launch
**Mitigation**:
- Create 10+ official stacks before launch
- Migrate existing home/work profiles to stack format
- Seed with stacks covering major frameworks

### Risk 2: Low-Quality Submissions

**Problem**: Community submits broken or unhelpful stacks
**Mitigation**:
- Schema validation catches structural issues
- PR review by maintainers
- Upvotes surface quality (low-quality stacks sink)
- No downvotes reduces drama

### Risk 3: Skill Modification Breaks Stacks

**Problem**: Changing a shared skill breaks multiple stacks
**Mitigation**:
- Skill versioning with locked commits
- Changelog requirements for skill changes
- Upgrade CLI shows breaking changes
- Stack authors notified of updates

### Risk 4: Filtering Complexity

**Problem**: Smart filtering is hard to implement correctly
**Mitigation**:
- Start with simple relationships (requires/conflicts)
- Add suggests/enhances later
- Comprehensive unit tests
- Manual override available

### Risk 5: Timeline Too Aggressive

**Problem**: 1-2 days may not be enough
**Mitigation**:
- Phase 1-2 are critical path (MVP)
- Phase 3-4 can be simplified
- Phase 5-6 can slip to post-launch
- Defer versioning complexity to v2

---

## Part 6: Deferred Features (Post-Launch)

| Feature | Description | When |
|---------|-------------|------|
| Stack Arena | Compare outputs of different stacks | After 50+ stacks |
| Web Catalog | Browse stacks in browser | After CLI stable |
| Creator Pages | Full creator pages | After 20+ contributors |
| Trending Algorithm | Sophisticated popularity | After 6 months data |
| Comments | Stack-level discussions | Use GitHub Discussions for now |
| Forking | "Based on" lineage | Start with independent stacks |
| Full Versioning | npm-style lockfiles | If complexity needed |
| Separate CLI Package | `npx claude-stacks` | After patterns stabilize |

---

## Continuation Prompt

Use this to start work in a new session:

```
Read .claude/research/findings/STACK-MARKETPLACE-IMPLEMENTATION-PLAN.md

This is the single source of truth for the Stack Marketplace project.

All decisions are confirmed:
- Directory structure: marketplace/stacks/@user/stack-name/ with compiled skill format
- Skill versioning: Automatic forking (fork-and-forget) with provenance metadata
- Voting: Deferred (Firebase/similar later)
- compile.ts: No changes needed - stacks bypass compilation

PREREQUISITE CHECK:
Before implementing the marketplace, consider whether existing skills should be
aligned with Claude Code conventions (examples.md, reference.md). See
CLAUDE-CODE-SKILL-CONVENTIONS.md for details.

I want to:
- [ ] First align existing skills with Claude Code conventions (recommended)
- [ ] Start marketplace implementation from Phase 1
- [ ] Review a specific research document
- [ ] Discuss implementation details
```

---

## Quick Reference: Key Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Stack skill format | `skills/frontend-react/SKILL.md` | Matches compiled output, no compile.ts changes |
| Forking model | Fork-and-forget | Complete disconnection, provenance metadata only |
| Voting | Deferred | Firebase/similar when community exists |
| CLI | `bun stacks <cmd>` | Integrated with existing tooling |
| Directory scoping | `@username/` | CODEOWNERS protection |

---

_Last updated: 2026-01-09_

**Status: READY FOR IMPLEMENTATION**

**Recommended first step**: Align existing skills with Claude Code conventions before adding marketplace complexity.
