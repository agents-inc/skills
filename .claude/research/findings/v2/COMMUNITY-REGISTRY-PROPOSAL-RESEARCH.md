# Community Registry & Skill Dependencies Proposal Research

> **Purpose**: Deep analysis of the proposed community skill registry with dependency management

---

## The Proposal

**Core Idea**: Instead of personal skill configurations, create a community-driven registry where:

1. **Skill Categories** (frontend, testing, styling, state-management, etc.) contain multiple community-contributed skills
2. **Skills are isolated** - e.g., React skill contains NO styling mentions, that's in the Styling skill
3. **Skill dependencies** prevent conflicts (Tailwind skill can't combine with SCSS Modules skill)
4. **Agents bundle skills** - selecting an agent automatically brings in its required skills
5. **Profiles** become selections of agents (which cascade to skills)

**Example**:
- `react-tailwind-mobx.md` vs `react-scss-zustand.md` - different skill variants
- User selects agents → agents declare skill requirements → skills auto-included
- Conflicting skills blocked (can't pick Tailwind AND SCSS)

---

## Research Questions

1. **Skill Isolation**: Is it practical to fully isolate skills? Can React truly avoid all styling mentions?
2. **Dependency System**: How should skill conflicts/dependencies be declared and enforced?
3. **Community Model**: How do contributions work? Quality control? Naming conventions?
4. **Agent-Skill Bundling**: How do agents declare their skill requirements?
5. **Comparison**: How does this compare to the findings from the first research round?

---

## Active Research Agents

| Agent | Focus Area | Status | Started |
|-------|------------|--------|---------|
| Agent A | Skill Isolation Feasibility | **Complete** | 2026-01-08 |
| Agent B | Dependency/Conflict System Design | **Complete** | 2026-01-08 |
| Agent C | Community Registry Models | **Complete** | 2026-01-08 |
| Agent D | Agent-Skill Bundling Architecture | **Complete** | 2026-01-08 |
| Agent E | Comparison with Previous Findings | **Complete** | 2026-01-08 |

---

## Agent A: Skill Isolation Feasibility

**Focus**: Can skills be truly isolated? What are the boundaries? What happens at the edges?

**Status**: Complete

**Completed**: 2026-01-08

### Executive Summary

**Full isolation is NOT feasible for most frontend skills.** The proposal to have skills like React contain "NO styling mentions" fundamentally misunderstands how these technologies work together. However, a **bounded isolation model** with explicit integration sections is both practical and valuable.

---

### Detailed Analysis

#### 1. Current Cross-Reference Inventory

Examined 7 skill files totaling ~8,500 lines. Here's the coupling found:

**React skill (1134 lines):**
- 30+ styling mentions: `cva`, SCSS Modules, `className` prop, design tokens, `clsx`
- Full SCSS examples embedded (lines 148-207, button.module.scss)
- Integration section explicitly lists: SCSS Modules, cva, Radix UI, lucide-react, React Query, Zustand

**Styling skill (1450 lines):**
- 50+ React/component mentions
- Examples are React component SCSS files
- Patterns show JSX + SCSS together (data-attributes pattern)
- Integration assumes React component context

**Client State skill (813 lines):**
- 100% React-specific (useState, Zustand hooks, React Query)
- Cannot exist without React context
- References data-attributes for styling state (line 139, 298)

**Testing skill (1131 lines):**
- Framework-specific: Playwright, Vitest, React Testing Library, MSW
- MSW integration is core pattern
- Ladle stories reference design system components

**Mocking skill (764 lines):**
- Exists primarily to support Testing skill
- Server worker lifecycle tied to test lifecycle
- Handler patterns designed for test scenarios

**API skill (1336 lines):**
- React Query IS the skill (generated query options pattern)
- Cannot separate API fetching from React Query integration
- References MSW for mocking integration

**Accessibility skill (1611 lines):**
- All examples are React components
- Radix UI integration throughout
- SCSS styling patterns in accessibility context

---

#### 2. The `className` Problem

The user asks: *"Can React truly avoid all styling mentions? What about `className`, `style` props?"*

**Answer: NO.** The `className` prop is:

1. **Part of JSX syntax** - Every React component uses it
2. **The styling API** - How ALL CSS is applied in React (SCSS Modules, Tailwind, CSS-in-JS)
3. **Required by project conventions** - "MUST expose className prop on ALL reusable components"

If React skill said "don't mention className", it would be:
- Missing critical patterns (how to merge classNames with `clsx`)
- Violating the codebase's own conventions
- Fundamentally incomplete as a component guide

**The same applies to:**
- `cva` - Cannot teach React variants without it
- `style` prop - Needed for runtime values
- Design tokens - Components consume them
- Data-attributes - Project pattern for state styling

---

#### 3. Coupling Categories Analysis

**Category A: TIGHT COUPLING (Cannot Be Separated)**

| Skill Pair | Why Inseparable |
|------------|-----------------|
| React + Styling | `className` prop is JSX syntax; cva variants are component API |
| React + State Management | Hooks (useState, useQuery) ARE React |
| Testing + Mocking | MSW exists to support testing |
| API + React Query | Generated query options ARE React Query hooks |

**Category B: PARTIAL ISOLATION POSSIBLE (But Limited Value)**

| Skill Pair | What Could Separate | What Can't |
|------------|--------------------|----|
| React core vs React data | Component patterns vs useQuery | Integration points still needed |
| Design tokens vs Component styling | Token definitions vs usage | Components must reference tokens |
| E2E philosophy vs Framework | "What to test" vs "how" | Practical guidance needs specifics |

**Category C: GENUINELY ISOLABLE**

| Skills | Why Separable |
|--------|---------------|
| PostHog setup | Independent service integration |
| Resend email setup | Independent service integration |
| Database (Drizzle) | Backend-specific, no frontend coupling |
| Authentication | Mostly backend-focused |
| CI/CD | Deployment infrastructure |

---

#### 4. What "Full Isolation" Would Actually Mean

If we forced React skill to have ZERO styling mentions:

```markdown
# React (Isolated Version)

## Pattern: Component with Variants
// Example shows variant prop but cannot explain how variants work
// because cva is "styling" and SCSS is in "Styling skill"

const Button = ({ variant }) => <button>...</button>
// How is variant applied? "See Styling skill"

## Missing:
- How to accept className prop
- How to merge classNames
- How to apply variant styles
- How to use design tokens
```

**Result:**
- Agent needs 2-3 skills loaded for basic component work
- Each skill lacks context to be useful alone
- Guidance becomes fragmented and less helpful
- Users must know which skills to combine

---

#### 5. Current Skills Are Already ~90% Domain-Focused

Analyzing the React skill structure:

| Content | Percentage | Coupling Level |
|---------|------------|----------------|
| Component architecture (forwardRef, patterns, hooks) | ~75% | React-only |
| Styling integration (cva, className, SCSS examples) | ~15% | Cross-domain |
| Integration section ("Works with...") | ~10% | Explicit references |

**This is the RIGHT balance.** The 15% styling content is:
- Necessary to show COMPLETE component patterns
- How components are ACTUALLY written in this codebase
- Teaching by example (the most effective approach)

---

### Recommendation: Bounded Isolation Model

Instead of "full isolation", implement **bounded isolation with explicit interfaces**:

#### 1. Core Content Isolated (~80-85%)
Each skill's patterns focus on ITS primary domain:
- React: Component architecture, hooks, refs, error boundaries
- Styling: Design tokens, SCSS patterns, dark mode, layers
- Testing: What to test, test organization, philosophy

#### 2. Integration Content Explicit (~15-20%)
Cross-domain content clearly marked and justified:
```markdown
## Integration Guide
**Works with:**
- SCSS Modules: All components use SCSS Modules for styling (see Styling skill for token details)
- React Query: Server state management (see API skill for query patterns)
```

#### 3. No Duplicate Detailed Content
- React skill shows cva usage (the HOW in component context)
- Styling skill shows cva philosophy (the WHY and design system context)
- Each skill adds unique value, not repetition

#### 4. Cross-References as Hints
```markdown
> For comprehensive design token documentation, see the Styling skill.
```

---

### Skill Isolation Feasibility Matrix

| Skill | Can Be Isolated? | Required Cross-References |
|-------|------------------|--------------------------|
| React | Partially | Styling (cva, className), State (hooks) |
| Styling | Partially | React (component context) |
| Client State | No | React (100% React hooks) |
| API | No | React Query (IS the skill) |
| Testing | Partially | Mocking (MSW integration) |
| Mocking | No | Testing (exists for testing) |
| Accessibility | Partially | React (all examples), Styling (focus indicators) |
| Database | Yes | Standalone backend skill |
| Authentication | Mostly | Light React integration possible |
| CI/CD | Yes | Standalone infrastructure |
| Setup skills | Yes | Independent service configs |

---

### Proposed Boundary Model

**Level 1: Standalone Skills** (No required dependencies)
- `setup/posthog`, `setup/resend`, `setup/observability`
- `backend/database`, `backend/ci-cd`
- Could be used by any agent without loading other skills

**Level 2: Domain-Complete Skills** (Self-contained for their domain)
- `frontend/react` - Complete React component guidance
- `frontend/styling` - Complete design system guidance
- Each includes necessary cross-domain content to be useful alone

**Level 3: Coupled Skill Pairs** (Work together by design)
- `frontend/testing` + `frontend/mocking` - Testing infrastructure
- `frontend/api` + `frontend/client-state` - Data management

---

### Trade-offs of Full Isolation

| Aspect | Full Isolation | Bounded Isolation (Recommended) |
|--------|---------------|--------------------------------|
| Skill composability | High | High |
| Individual skill usefulness | Low | High |
| Context for agents | Fragmented | Complete |
| Combined prompt verbosity | Higher | Lower |
| Maintenance | Harder (sync issues) | Easier |
| User cognitive load | Higher (which skills?) | Lower |

---

### Conclusion

**The proposal for "fully isolated" skills (React with NO styling mentions) is not practical.** Frontend technologies are fundamentally interconnected, and forcing artificial boundaries creates worse outcomes:

1. Each skill becomes less useful in isolation
2. Agents need more skills loaded for basic tasks
3. Guidance becomes fragmented
4. Missing context leads to incomplete implementations

**The current skills already implement a reasonable bounded isolation model** where ~85% of content is domain-specific and ~15% is necessary integration content. This should be **formalized and documented** rather than changed to "pure isolation."

**Recommendation:** Keep current structure, add explicit `## Integration Guide` sections to each skill, and document which skills are genuinely standalone vs. domain-coupled.

---

### Files Analyzed

- `/home/vince/dev/claude-subagents/src/skills/frontend/react/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/styling/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/client-state/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/testing/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/mocking/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/api/SKILL.md`
- `/home/vince/dev/claude-subagents/src/skills/frontend/accessibility/SKILL.md`

---

## Agent B: Dependency/Conflict System Design

**Focus**: How to declare and enforce skill dependencies/conflicts. Technical implementation.

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

A comprehensive dependency/conflict system should use a **hybrid approach**: category-based exclusivity for common mutual exclusions (styling, state management, ORM) combined with explicit per-skill relationships for edge cases. Based on research of npm, Cargo, ESLint, VS Code extensions, and Homebrew, the **Homebrew model** is most applicable - explicit `conflicts_with`, `depends_on`, and `replaces` declarations with clear error messages.

**Note**: Per Agent E's recommendation, this design is intended for **v2.0 if/when needed**, not v1.0 launch. This provides a complete blueprint ready for implementation when community usage demonstrates the need.

---

### 1. Research: Dependency Systems in Other Ecosystems

#### npm/package.json

| Aspect | How npm Handles It |
|--------|-------------------|
| Dependencies | `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies` |
| Conflicts | No explicit declaration - version resolution issues |
| Override | `overrides` field forces specific versions |

**Relevance**: `peerDependencies` pattern useful for "requires" relationships. npm lacks explicit "conflicts with" - we need this.

#### Cargo (Rust)

| Aspect | How Cargo Handles It |
|--------|---------------------|
| Features | Additive by design - `[features]` section |
| Exclusivity | No built-in mechanism |
| Conditional | `#[cfg()]` for conditional compilation |

**Relevance**: Feature flags useful for optional enhancements. Additive model problematic for truly exclusive choices.

#### ESLint

| Aspect | How ESLint Handles It |
|--------|----------------------|
| Conflicts | Last rule in `extends` chain wins |
| Declaration | No explicit conflict declaration |
| Resolution | Silent overrides - bad UX |

**Relevance**: "Last wins" is confusing - we need explicit declarations.

#### Homebrew (MOST RELEVANT MODEL)

```ruby
class MyFormula < Formula
  conflicts_with "other-formula",
    because: "both install a 'foo' binary"
  depends_on "required-dep"
  replaces "old-name"
end
```

**Error message example:**
```
Error: Cannot install myformula because conflicting formula is installed.
Please `brew unlink other-formula` or use `--force` to overwrite.
Reason: both install a 'foo' binary
```

**Why Homebrew is the best model:**
1. Explicit `conflicts_with` with `because:` explanation
2. Clear error messages with resolution steps
3. `--force` flag for power users
4. `replaces` for migration paths

---

### 2. Schema Design

Recommend **hybrid approach**: Categories for group exclusivity + explicit relationships for edge cases.

#### Proposed Registry Schema

```yaml
# registry.yaml additions

categories:
  state-management:
    type: exclusive          # Only one allowed
    description: Client-side state management solution
    skills: [frontend/zustand, frontend/mobx, frontend/redux, frontend/jotai]

  styling:
    type: exclusive
    description: CSS/styling methodology
    skills: [frontend/scss-modules, frontend/tailwind, frontend/styled-components]

  testing-framework:
    type: exclusive
    description: Test runner
    skills: [frontend/vitest, frontend/jest, frontend/karma]

  frontend-core:
    type: required           # At least one must be selected
    description: Frontend framework
    skills: [frontend/react, frontend/vue, frontend/svelte]

skills:
  frontend/zustand:
    path: skills/frontend/zustand.md
    name: Zustand State Management
    description: Zustand stores, slices, devtools
    category: state-management
    relationships:
      requires: [frontend/react]
      conflicts: []
      enhancedBy: [frontend/zustand-devtools]
      replaces: [frontend/zustand-v1]

  frontend/tailwind:
    path: skills/frontend/tailwind.md
    name: Tailwind CSS
    description: Utility-first CSS
    category: styling
    relationships:
      requires: []
      conflicts: [setup/postcss-legacy]  # Cross-category conflict
      enhancedBy: [frontend/tailwind-merge]
```

#### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Category-level exclusivity** | Most conflicts are alternatives (state mgmt, styling) |
| **Explicit conflicts for edge cases** | Some conflicts span categories |
| **`requires` for dependencies** | Clear declaration, auto-resolution |
| **`enhancedBy` for suggestions** | Soft recommendations, not requirements |
| **`replaces` for migrations** | Upgrade paths for deprecated skills |

---

### 3. TypeScript Type Definitions

```typescript
export interface SkillRelationships {
  requires?: string[];      // Skills that MUST be present
  conflicts?: string[];     // Skills that CANNOT be used together
  replaces?: string[];      // Skills this supersedes (migrations)
  enhancedBy?: string[];    // Optional enhancement suggestions
}

export type CategoryType = 'exclusive' | 'required' | 'optional';

export interface CategoryDefinition {
  type: CategoryType;
  description: string;
  skills: string[];
  default?: string;
}

export interface ConflictDetail {
  type: 'category_exclusive' | 'explicit_conflict' | 'missing_dependency';
  skillA: string;
  skillB?: string;
  category?: string;
  message: string;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: ConflictDetail[];
  warnings: string[];
  suggestions: string[];
  resolvedSkills: string[];
}
```

---

### 4. Validation Algorithm

```typescript
function validateSkillSelection(selected: string[], registry: RegistryConfig): SkillValidationResult {
  const errors: ConflictDetail[] = [];
  const resolved = resolveWithDependencies(selected, registry);

  // Check category exclusivity
  for (const [catName, cat] of Object.entries(registry.categories || {})) {
    if (cat.type === 'exclusive') {
      const inCat = cat.skills.filter(s => resolved.includes(s));
      if (inCat.length > 1) {
        errors.push({
          type: 'category_exclusive',
          skillA: inCat[0], skillB: inCat[1],
          category: catName,
          message: `Category "${catName}" is exclusive: cannot use both ${inCat.join(' and ')}.`
        });
      }
    }
    if (cat.type === 'required') {
      const inCat = cat.skills.filter(s => resolved.includes(s));
      if (inCat.length === 0) {
        errors.push({
          type: 'missing_dependency',
          skillA: catName, category: catName,
          message: `Category "${catName}" requires at least one: ${cat.skills.join(', ')}`
        });
      }
    }
  }

  // Check explicit conflicts
  for (const skillId of resolved) {
    const skill = registry.skills[skillId];
    for (const conflictId of skill.relationships?.conflicts || []) {
      if (resolved.includes(conflictId)) {
        errors.push({
          type: 'explicit_conflict',
          skillA: skillId, skillB: conflictId,
          message: `${skill.name} conflicts with ${registry.skills[conflictId]?.name}.`
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings: [], suggestions: [], resolvedSkills: resolved };
}

function resolveWithDependencies(requested: string[], registry: RegistryConfig): string[] {
  const resolved = new Set<string>();
  const queue = [...requested];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const skillId = queue.shift()!;
    if (visited.has(skillId)) continue;
    visited.add(skillId);
    resolved.add(skillId);
    for (const reqId of registry.skills[skillId]?.relationships?.requires || []) {
      if (!resolved.has(reqId)) queue.push(reqId);
    }
  }
  return Array.from(resolved);
}
```

---

### 5. Conflict Resolution UX

#### Compile Time Error
```
$ bun compile home

  CONFLICT DETECTED

  Category "state-management" is exclusive: cannot use both
  frontend/zustand and frontend/mobx.

  Resolution: Edit stacks/home-stack/config.yaml and remove one.
```

#### CLI Interactive Mode
```
$ claude-agents add frontend/mobx

  CONFLICT: Currently using frontend/zustand (state-management)

  What would you like to do?
    1. Keep frontend/zustand (cancel)
    2. Replace with frontend/mobx
    3. Cancel

  Choice [1/2/3]: _
```

---

### 6. CLI Commands

```bash
# List skills by category
$ claude-agents skills list
  STATE MANAGEMENT (pick one): zustand, mobx, redux
  STYLING (pick one): scss-modules, tailwind

# Check compatibility
$ claude-agents skills check zustand tailwind react
  COMPATIBLE
  Suggestions: zustand-devtools enhances zustand

# Add with auto-resolution
$ claude-agents skills add zustand
  + zustand
  + react (required by zustand)

# Validate profile
$ claude-agents validate home
  Dependencies... OK | Conflicts... OK | Categories... OK
  VALID
```

---

### 7. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Transitive deps** (A requires B requires C) | BFS resolution adds all |
| **Circular deps** | Cycle detection with visited set |
| **Missing skill** | Warning + skip (graceful) |
| **Orphan on removal** | CLI warns, offers to remove dependents |

---

### 8. Integration with Compiler

Add to `compile.ts` after loading registry:
```typescript
const validation = validateSkillSelection(extractAllSkills(profileConfig), registry);
if (!validation.valid) {
  console.error("SKILL CONFLICTS:");
  validation.errors.forEach(e => console.error(e.message));
  process.exit(1);
}
```

---

### 9. Migration Path

| Phase | Action | Breaking |
|-------|--------|----------|
| **Phase 1** | Add schema support (optional fields) | No |
| **Phase 2** | Validation in warning mode | No |
| **Phase 3** | Validation in error mode | Yes |
| **Phase 4** | CLI skill management | N/A |

---

### 10. Alignment with Other Agents

**Agent D (Skill Slots):** Slot system integrates naturally - slots define what goes where, dependency system validates the choices.

**Agent E (Recommendation):** This design is for v2.0 per Agent E's recommendation. It provides a complete blueprint ready for implementation when community usage demonstrates the need.

---

### Summary

| Component | Design Choice |
|-----------|---------------|
| **Schema** | Hybrid categories + explicit relationships |
| **Validation** | Compile-time with clear errors |
| **UX Model** | Homebrew-inspired (explanations + resolution) |
| **CLI** | list/add/remove/check/validate commands |
| **Timeline** | v2.0 (per Agent E) |

---

## Agent C: Community Registry Models

**Focus**: How do other ecosystems handle community contributions? Quality, naming, discoverability.

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

After extensive web research on 10+ community registry models, the recommendation is a **tiered registry with defensive namespacing**. The key insight: successful registries balance discoverability with quality control through trust signals (verified publishers, ratings, usage metrics) rather than gatekeeping.

For a skill registry specifically, the unique challenge is that skills are **prompt text, not code** - quality issues are subtle (bad advice) rather than obvious (crashes). This requires a community-driven review model focused on accuracy rather than functionality.

---

### 1. Ecosystem Analysis

#### npm Registry (JavaScript)

**Model**: Open publication with scoped namespacing

**What Works**:
- **Scoped packages** (`@org/package-name`) eliminate naming conflicts entirely
- **First-come, first-served** with typosquatting prevention: npm removes punctuation and compares to existing names
- **Weekly download counts** as popularity signal
- **Keywords** for discoverability

**What Fails**:
- **Typosquatting attacks**: 250+ malicious typosquatting packages found in 2024-2025
- **Supply chain attacks via compromised maintainers**: September 2025 saw 18 packages (chalk, debug, etc.) compromised, affecting 2.6B weekly downloads
- **Quality variance**: No curation means thousands of low-quality packages

**Sources**: [npm Docs - Scope](https://docs.npmjs.com/cli/v11/using-npm/scope/), [Typosquatting in Package Managers](https://nesbitt.io/2025/12/17/typosquatting-in-package-managers.html)

---

#### VS Code Extension Marketplace

**Model**: Open publication with verified publisher badges and ratings

**What Works**:
- **Verified Publisher badge**: Requires domain ownership + 6 months good standing
- **Star ratings + download counts**: Community-driven quality signals
- **Malware scanning**: Each extension scanned on publish
- **Category taxonomy**: Structured browsing

**What Fails**:
- **Verification is binary**: No quality tiers beyond verified/not
- **Discovery favors incumbents**: Sort by downloads surfaces established extensions

**Sources**: [VS Code Extension Marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace), [Microsoft Security Blog](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace)

---

#### Homebrew (macOS)

**Model**: Tiered taps (official vs community)

**What Works**:
- **homebrew/core**: Official tap with strict quality, CI testing, review
- **Third-party taps**: Anyone can create their own
- **Clear trust hierarchy**: Official > verified > random
- **Formula auditing**: `brew audit` enforces standards

**What Fails**:
- **Third-party tap quality varies**: No enforcement outside official
- **Tap discovery is poor**: No central catalog

---

#### ESLint Shareable Configs

**Model**: Naming convention + npm distribution

**What Works**:
- **Strict naming**: Must be `eslint-config-*` or `@scope/eslint-config*`
- **Composable**: Configs can extend other configs

**What Fails**:
- **Config explosion**: Thousands with overlapping functionality
- **Compatibility hell**: Different configs require different ESLint versions

**Sources**: [ESLint Shareable Configs](https://eslint.org/docs/latest/extend/shareable-configs)

---

#### Oh My Zsh Plugins

**Model**: Core plugins + external wiki + custom directory

**What Works**:
- **Custom directory** (`$ZSH_CUSTOM`): User additions never conflict with core
- **External plugins wiki**: Scales infinitely
- **Theme/plugin cap**: "More than enough" - new ones go to wiki
- **2,400+ contributors, 300+ plugins, 140+ themes**: Proven at scale

**What Fails**:
- **Wiki quality varies**: External plugins may be abandoned
- **No versioning**: Cannot pin plugin versions

**Sources**: [Oh My Zsh Wiki - Plugins](https://github.com/ohmyzsh/ohmyzsh/wiki/plugins), [External Plugins Wiki](https://github.com/ohmyzsh/ohmyzsh/wiki/External-plugins)

---

#### Terraform Registry

**Model**: Structured naming + versioning + partner verification

**What Works**:
- **Three-part naming**: `terraform-<PROVIDER>-<NAME>` - self-documenting
- **Semantic versioning required**: Tags must be semver
- **Partner filter**: HashiCorp reviews partner modules
- **Private registries**: Organizations can host internal modules

**What Fails**:
- **Public registry needs vetting**: Quality variance in community modules

**Sources**: [Terraform Registry - Publish Modules](https://developer.hashicorp.com/terraform/registry/modules/publish)

---

#### GitHub Actions Marketplace

**Model**: Open publication with verified creator badges

**What Works**:
- **Verified creator badge**: Partners get checkmark
- **Organization policies**: Can restrict to verified creators only
- **Semantic versioning recommended**

**What Fails**:
- **Verification requires partnership**: Individuals cannot get verified
- **Quality varies**: No review beyond malware scanning

**Sources**: [GitHub Docs - Publishing Actions](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)

---

#### crates.io (Rust)

**Model**: First-come-first-served with ownership policies

**What Works**:
- **No squatting disputes**: Will not hand over packages
- **Strict deletion rules**: Prevents rug-pulls
- **Code of Conduct enforcement**

**What Fails**:
- **Orphaned packages**: No adoption mechanism
- **No quality tiers**: All crates look equal

**Sources**: [crates.io Policies](https://crates.io/policies)

---

### 2. What Works Across Ecosystems

| Pattern | Used By | Why It Works |
|---------|---------|--------------|
| **Scoped namespacing** | npm, Terraform | Eliminates conflicts; clear ownership |
| **Verified publisher badges** | VS Code, GitHub Actions | Trust signal without gatekeeping |
| **Tiered quality** | Homebrew, Terraform | Official vs community separation |
| **Naming conventions** | ESLint, Terraform | Self-documenting; discoverable |
| **Custom directory** | Oh My Zsh, NvChad | User changes never conflict with core |
| **External wiki/catalog** | Oh My Zsh, Awesome lists | Scales community contributions |

---

### 3. What Fails Across Ecosystems

| Anti-Pattern | Examples | Why It Fails |
|--------------|----------|--------------|
| **No namespace protection** | npm typosquatting | Attack vector |
| **Orphaned maintainers** | npm supply chain attacks | Phished maintainers compromise downloads |
| **No quality tiers** | crates.io | All packages look equal |
| **Discovery favors popularity** | npm, VS Code | New high-quality entries invisible |
| **No adoption mechanism** | crates.io | Valuable packages die with maintainers |

---

### 4. Recommended Model for This Project

**Tiered Registry Model with Defensive Namespacing**:

```
TIER 1: Official Skills
  - Naming: skill-<domain>-<technology>
  - Example: skill-frontend-react, skill-backend-hono
  - Quality: Tested, reviewed, documented
  - Badge: "Official"

TIER 2: Verified Skills
  - Naming: @<username>/skill-<domain>-<technology>
  - Example: @johndoe/skill-frontend-svelte
  - Quality: Passes review, active maintainer
  - Badge: "Verified" after 3+ months good standing

TIER 3: Community Skills
  - Naming: @<username>/skill-*
  - Quality: Basic format validation only
  - Badge: None (unverified)
```

**Why This Model**:
1. **Scoped namespacing** eliminates name conflicts (learned from npm)
2. **Tiered trust** lets quality emerge without gatekeeping (VS Code/Homebrew)
3. **Official skills** provide baseline quality (Oh My Zsh core)
4. **Verification by time** prevents hit-and-run (VS Code)
5. **Community tier** allows permissionless innovation (npm/crates.io)

---

### 5. Naming Conventions Proposal

**Official Skills (Tier 1)**:
```
skill-<domain>-<technology>[-variant]
Examples: skill-frontend-react, skill-styling-tailwind, skill-state-zustand
```

**Community Skills (Tier 2/3)**:
```
@<username>/skill-<domain>-<technology>[-variant]
Examples: @johndoe/skill-frontend-svelte, @graphql-guild/skill-api-graphql
```

**Skill Bundles**:
```
bundle-<stack-description>
Examples: bundle-react-zustand-scss, bundle-fullstack-hono-drizzle
```

---

### 6. Quality Control Approach

#### The Unique Challenge: Skills Are Prompts, Not Code

Skills with bad advice may:
- Produce code that compiles but has security vulnerabilities
- Follow patterns contradicting codebase conventions
- Give outdated or deprecated guidance

#### Quality Control by Tier

| Tier | Checks |
|------|--------|
| **Official** | Format validation, manual expert review, quarterly freshness check |
| **Verified** | Format validation, 1 community approval, 3-month monitoring |
| **Community** | Format validation, flagging system for bad skills |

#### Review Focus Areas
1. **Accuracy**: Does advice match official docs?
2. **Completeness**: Are edge cases covered?
3. **Currency**: Based on latest versions?
4. **Safety**: Could this introduce vulnerabilities?

---

### 7. Discoverability Solution

1. **Domain browsing**: skills/frontend/, skills/backend/, etc.
2. **Search by technology**: Index skill names and content
3. **Curated bundles**: Entry points for new users
4. **Compatibility matrix**: Show which skills work together

```yaml
# Example bundle
name: bundle-react-zustand-scss
skills:
  - skill-frontend-react
  - skill-state-zustand
  - skill-styling-scss
  - skill-testing-vitest
```

---

### 8. Implementation Phases

| Phase | Features |
|-------|----------|
| **v1.0** | Official skills only, no community contributions yet |
| **v1.1** | Separate `claude-skills-community` repository |
| **v1.2** | Verification system, "Verified" badges |
| **v2.0** | Search indexing, usage metrics, recommendations |

---

### 9. Addressing Unique Challenges

| Challenge | Solution |
|-----------|----------|
| **Skills are prompts, not code** | Community accuracy review focusing on correctness |
| **Subtle quality issues** | Flagging + 30-day response requirement for verified |
| **Conflicting "best practices"** | Explicit scope declarations in skill frontmatter |
| **Skill updates** | Semantic versioning + user-chosen update strategy |

---

### 10. Summary

| Question | Recommendation |
|----------|----------------|
| **Official vs Community?** | Three tiers: Official -> Verified -> Community |
| **Naming conventions?** | `skill-<domain>-<tech>` for official; `@user/skill-*` for community |
| **Quality tiers?** | Yes, via verification badges earned over time |
| **How discovered?** | Domain browsing + search + curated bundles |
| **Central vs distributed?** | Central for official; separate repo for community |
| **Update handling?** | Semantic versioning with user-chosen strategy |

---

### Sources Consulted

- [npm Docs - Scope](https://docs.npmjs.com/cli/v11/using-npm/scope/)
- [Typosquatting in Package Managers](https://nesbitt.io/2025/12/17/typosquatting-in-package-managers.html)
- [Trend Micro - npm Supply Chain Attack](https://www.trendmicro.com/en_us/research/25/i/npm-supply-chain-attack.html)
- [VS Code Extension Marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)
- [Microsoft Developer Blog - Security and Trust](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace)
- [ESLint Shareable Configs](https://eslint.org/docs/latest/extend/shareable-configs)
- [Oh My Zsh Wiki - Plugins](https://github.com/ohmyzsh/ohmyzsh/wiki/plugins)
- [Terraform Registry - Publish Modules](https://developer.hashicorp.com/terraform/registry/modules/publish)
- [GitHub Docs - Publishing Actions](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)
- [crates.io Policies](https://crates.io/policies)
- [sindresorhus/awesome](https://github.com/sindresorhus/awesome)
- [GitHub Blog - Most Influential Open Source Projects](https://github.blog/open-source/maintainers/this-years-most-influential-open-source-projects/)

---

## Agent D: Agent-Skill Bundling Architecture

**Focus**: How agents declare skill requirements. The cascade from agent selection to skill inclusion.

**Status**: Complete

**Completed**: 2026-01-08

---

### Executive Summary

After deep analysis of the current architecture, user flows, and design alternatives, I recommend a **Skill Slots with Defaults** model. This approach allows agents to declare abstract capability requirements (slots) that profiles fill with concrete skill implementations, enabling tech-stack flexibility while maintaining clear agent-skill relationships.

---

### Current Architecture Analysis

#### What Exists Today

1. **Registry.yaml** - Central source of truth for agent and skill definitions
2. **Profile config.yaml** - Maps agents to their skill assignments (precompiled/dynamic)
3. **Agent sources** - Modular content files (intro, workflow, examples)
4. **Skills** - Technology-specific guidance files

#### Key Architectural Observations

**Separation of Concerns:**
- Agents = Roles (frontend-developer, tester, pm)
- Skills = Technologies (react, tailwind, zustand)
- Profiles = Tech Stack Configurations (home uses SCSS, work uses Tailwind)

**Current Binding Model:**
```yaml
# Profile binds skills to agents explicitly
agents:
  frontend-developer:
    precompiled:
      - id: frontend/react
      - id: frontend/styling  # Profile-specific implementation
    dynamic:
      - id: frontend/client-state  # Profile-specific implementation
```

**Skills are Named Abstractly, Implemented Concretely:**
- Skill ID: `frontend/styling` (generic)
- Skill Content: SCSS Modules patterns (specific to home profile)

This means the same agent with different profiles gets completely different skill implementations.

---

### Design Alternatives Evaluated

#### Option A: Concrete Skill Bundling (Rejected)

```yaml
agents:
  frontend-developer:
    skills:
      - frontend/react
      - frontend/tailwind  # Hardcoded technology
```

**Problems:**
- Agent becomes opinionated about tech stack
- Requires separate agents for each tech combination
- Combinatorial explosion (react-tailwind, react-scss, vue-tailwind, etc.)

#### Option B: Agent Bundle Variants (Rejected)

```yaml
agent_bundles:
  frontend-developer-tailwind:
    base: frontend-developer
    skills: [react, tailwind, zustand]
  frontend-developer-scss:
    base: frontend-developer
    skills: [react, scss-modules, zustand]
```

**Problems:**
- Maintenance burden grows exponentially
- Users must find the "right" variant
- Hard to customize individual choices

#### Option C: Abstract Capability Requirements (Rejected)

```yaml
agents:
  frontend-developer:
    requires:
      - styling-capability
      - state-capability
      - component-capability
```

**Problems:**
- Too abstract - hard to implement resolution
- Unclear which skills satisfy which capabilities
- Requires separate capability taxonomy

#### Option D: Skill Slots with Defaults (RECOMMENDED)

```yaml
agents:
  frontend-developer:
    skill_slots:
      component-framework:
        default: frontend/react
        alternatives: [frontend/vue, frontend/svelte]
      styling:
        default: frontend/scss-modules
        alternatives: [frontend/tailwind, frontend/styled-components]
      state-management:
        default: frontend/zustand
        alternatives: [frontend/mobx, frontend/redux]
        required: false  # Optional slot
```

**Advantages:**
- Agents self-document their needs
- Defaults make it work out of box
- Profiles can override specific slots
- No combinatorial explosion
- Compatible with CLI-guided setup
- Works with community registry model

---

### Proposed Schema Design

#### Registry.yaml Extension

```yaml
agents:
  frontend-developer:
    # Existing metadata
    title: Frontend Developer Agent
    description: Implements frontend features...
    model: opus
    tools: [Read, Write, Edit, Grep, Glob, Bash]
    output_format: output-formats-developer

    # NEW: Skill slot requirements
    skill_slots:
      # Required slots - must be resolved
      required:
        component-framework:
          description: React/Vue/Svelte framework patterns
          default: frontend/react
          alternatives:
            - frontend/vue
            - frontend/svelte
        styling:
          description: CSS methodology and patterns
          default: frontend/scss-modules
          alternatives:
            - frontend/tailwind
            - frontend/styled-components
            - frontend/css-modules

      # Optional slots - enhance agent but not required
      optional:
        state-management:
          description: Client-side state patterns
          default: frontend/zustand
          alternatives:
            - frontend/mobx
            - frontend/redux
            - frontend/jotai
        testing:
          description: Component testing patterns
          default: frontend/testing
          alternatives: []
        accessibility:
          description: A11y patterns and ARIA
          default: frontend/accessibility
          alternatives: []
```

#### Profile config.yaml Extension

```yaml
agents:
  frontend-developer:
    # Existing configuration
    core_prompts: [core-principles, investigation-requirement]
    ending_prompts: [context-management]

    # NEW: Override slot defaults
    slot_overrides:
      styling: frontend/tailwind      # Override default scss-modules
      state-management: frontend/mobx  # Override default zustand

    # Existing - additional skills beyond slots
    precompiled: []
    dynamic:
      - id: backend/authentication
        usage: when implementing client-side auth flows
```

---

### User Flow Design

#### Flow 1: Profile Creation (CLI-guided)

```
$ npx claude-agents init

Welcome to Claude Agents!

Creating profile "work"...

frontend-developer agent requires:
  - component-framework: [react] (default)
  - styling: [scss-modules] (default) or tailwind, styled-components
  - state-management: [zustand] (default) or mobx, redux

Use all defaults? [Y/n]: n

Select styling approach:
  > tailwind
    scss-modules
    styled-components

Select state management:
  > mobx
    zustand
    redux

Profile created with overrides:
  styling: tailwind
  state-management: mobx

Ready! Run "bun run compile work" to compile.
```

#### Flow 2: Silent Compilation (defaults)

```
$ bun run compile work

Resolving skill slots...
  frontend-developer:
    component-framework: frontend/react (default)
    styling: frontend/tailwind (override)
    state-management: frontend/mobx (override)
  backend-developer:
    api-framework: backend/hono (default)
    database: backend/drizzle (default)

Compiling 16 agents...
Done!
```

#### Flow 3: Community Agent Import

```
$ claude-agents import community/next-app-router-specialist

This agent requires:
  - next-framework: next/app-router (fixed, cannot be changed)
  - styling: (required, pick one)
  - state-management: (optional)

Your profile "work" provides:
  - styling: frontend/tailwind
  - state-management: frontend/mobx

Compatible! Import? [Y/n]
```

---

### Conflict Handling

#### Scenario 1: Different Defaults, Same Slot

```yaml
# Agent A default
styling: frontend/scss-modules

# Agent B default
styling: frontend/tailwind
```

**Resolution:** No conflict. Profile provides the tiebreaker:

```yaml
# Profile config.yaml - applies to all agents
global_slot_defaults:
  styling: frontend/tailwind  # All agents use this unless overridden
```

#### Scenario 2: Fixed Skill Conflicts

```yaml
# Agent A (community: tailwind-specialist)
skill_slots:
  styling:
    default: frontend/tailwind
    fixed: true  # CANNOT be overridden

# Agent B (community: scss-architecture-agent)
skill_slots:
  styling:
    default: frontend/scss-modules
    fixed: true
```

**Resolution:** These agents cannot coexist in the same profile.

```
Error: Incompatible agents detected

tailwind-specialist requires: styling = frontend/tailwind (fixed)
scss-architecture-agent requires: styling = frontend/scss-modules (fixed)

These agents have conflicting fixed requirements and cannot be used together.
Remove one agent or create separate profiles.
```

#### Scenario 3: Missing Skill Implementation

**Resolution:** Warn and offer options.

```
Warning: frontend-developer requires 'frontend/vue' skill

Your profile does not include this skill.
Options:
  1. Add frontend/vue skill to profile
  2. Import from community registry
  3. Skip this agent

Choose [1/2/3]:
```

---

### Compilation Pipeline

#### Step-by-Step Resolution

1. **Load Registry**: Read agent definitions with skill_slots
2. **Load Profile**: Read slot_overrides and additional skills
3. **Resolve Slots**: For each agent:
   ```
   for each slot in agent.skill_slots:
     if profile.slot_overrides[slot]:
       resolved = profile.slot_overrides[slot]
     else if profile.global_slot_defaults[slot]:
       resolved = profile.global_slot_defaults[slot]
     else:
       resolved = slot.default

     validate(resolved in [slot.default, ...slot.alternatives])
     add_to_precompiled(resolved)
   ```
4. **Merge Additional Skills**: Add profile's precompiled/dynamic skills
5. **Compile Agent**: Generate final agent with all resolved skills

---

### Schema Validation

#### Skill Slot Schema (TypeScript)

```typescript
interface SkillSlot {
  description: string;
  default: string;           // Skill ID
  alternatives: string[];    // Other valid skill IDs
  fixed?: boolean;           // If true, cannot be overridden
}

interface AgentSkillSlots {
  required: Record<string, SkillSlot>;
  optional: Record<string, SkillSlot>;
}

interface AgentDefinition {
  title: string;
  description: string;
  model: string;
  tools: string[];
  output_format: string;
  skill_slots?: AgentSkillSlots;  // NEW, optional for backwards compat
}
```

#### Validation Rules

1. **Default must be valid**: `slot.default` must be a valid skill ID in registry
2. **Alternatives must be valid**: All `slot.alternatives` must be valid skill IDs
3. **Override must be allowed**: `slot_override` value must be in `[default, ...alternatives]`
4. **Fixed cannot be overridden**: If `slot.fixed = true`, profile cannot override
5. **Required slots must resolve**: All required slots must have a resolution

---

### Migration Path

#### Phase 1: Backwards Compatibility (Immediate)

- `skill_slots` is optional in agent definitions
- Existing profiles continue working unchanged
- No breaking changes

#### Phase 2: Add Slot Declarations (Incremental)

- Add `skill_slots` to agents one at a time
- Document default skills for each agent
- Validate that current profile configs match slot defaults

#### Phase 3: Profile Simplification (Future)

- Profiles can remove verbose precompiled/dynamic lists
- Use slot_overrides for tech stack customization
- Keep additional skills in precompiled/dynamic for agent-specific extras

---

### Alignment with Other Agent Findings

#### Alignment with Agent A (Skill Isolation)

Agent A found that **bounded isolation** is practical (~85% domain-specific, ~15% integration content). The Skill Slots model works well with this:

- Slots represent the integration points between skills
- `styling` slot connects component skills to styling skills
- Bounded isolation means skills remain useful even when loaded alone
- Integration content ensures slots work correctly when filled

#### Alignment with Agent E (Comparison)

Agent E recommends shipping Approach A (Dev Kit) for v1 and evolving toward hybrid. The Skill Slots system aligns with this:

1. **v1 Compatibility**: `skill_slots` is optional - current configs work unchanged
2. **Progressive Enhancement**: Add slots to agents incrementally
3. **Foundation for v2**: Slot system provides foundation for community registry features
4. **No New Infrastructure**: Slot resolution happens at compile time, no runtime changes

The Skill Slots approach is the **implementation mechanism** for the hybrid model Agent E envisions.

---

### Recommendations Summary

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Bundling model | Skill Slots with Defaults | Flexible, no combinatorial explosion |
| Required vs Optional | Both, explicit declaration | Agents self-document their needs |
| Default behavior | Work out of box | No setup friction for basic usage |
| Override mechanism | Profile-level slot_overrides | Clean, explicit customization |
| Conflict handling | Warn + require explicit choice | Users understand what's happening |
| Community agents | Support fixed slots | Some agents are tech-specific |
| Migration | Backwards compatible | No breaking changes |

---

### Implementation Priority

#### For v1 (Dev Kit Launch)

1. [ ] Add `skill_slots` to registry.yaml schema (optional field)
2. [ ] Add `slot_overrides` and `global_slot_defaults` to profile config.yaml schema
3. [ ] Update compiler to resolve slots (use defaults when slots present)
4. [ ] Validate slot constraints during compilation
5. [ ] Document slot system in CONTRIBUTING.md

#### For v1.x (Community Integration)

6. [ ] Add CLI commands for browsing agent requirements
7. [ ] Add conflict detection during profile creation
8. [ ] Support `fixed: true` for tech-specific agents
9. [ ] Generate compatibility matrix from registry

---

### Open Questions for Other Agents

1. **Agent B (Dependency System)**: Should skill slots integrate with the dependency system? E.g., "styling slot must be filled before theme slot can be resolved"

2. **Agent C (Community Registry)**: How should community agents declare skill slots? Should there be slot naming conventions across the registry?

3. **Agent A (Skill Isolation)**: Can the bounded isolation model (85% domain, 15% integration) work with slots? Integration content may need to reference "whatever is in the styling slot" rather than specific skills.

---

## Agent E: Comparison with Previous Findings

**Focus**: How does this proposal compare to the hybrid "Agent Authoring Dev Kit" approach from round 1?

**Status**: Complete

**Completed**: 2026-01-08

### Executive Summary

After deep analysis using extended thinking, the two approaches are **complementary, not competing**. The optimal strategy is to launch with Approach A (Dev Kit) and evolve toward a hybrid that incorporates registry concepts. The registry model adds complexity that is not justified for v1 launch.

---

### 1. Comprehensive Comparison Matrix

| Criterion | Approach A: Dev Kit | Approach B: Registry | Analysis |
|-----------|---------------------|----------------------|----------|
| **Setup Complexity** | Low (fork + customize) | Medium (browse + select + configure) | A wins for first-time users |
| **Time to First Value** | ~5 min (clone template, compile) | ~15 min (understand registry, select skills, resolve conflicts) | A wins significantly |
| **Customization Freedom** | Full (own everything) | Constrained by isolation rules | A wins for power users |
| **Community Contribution** | Via forks (scattered) | Via central PRs (discoverable) | B wins for discoverability |
| **Maintenance Burden (User)** | High (must pull upstream manually) | Low (registry updates auto-available) | B wins for updates |
| **Maintenance Burden (Maintainer)** | Low (users own their content) | High (review PRs, enforce quality, maintain deps) | A wins for sustainability |
| **Quality Control** | None (wild west) | Maintainer review | B wins for consistency |
| **Discoverability** | Poor (search GitHub forks) | Good (central catalog) | B wins |
| **Conflict Handling** | User's problem | System prevents | B wins conceptually, but adds complexity |
| **Update Story** | Cherry-pick from upstream | Import new version | B wins for seamless updates |
| **Onboarding Experience** | "Fork this, it's yours" | "Browse registry, select what you need" | A wins for simplicity |
| **Infrastructure Required** | None (just Git) | Registry hosting, contribution workflow | A wins significantly |
| **Aligns with Expectations** | Yes (dotfiles model is familiar) | Partial (npm-like, less familiar for configs) | A wins for familiarity |

**Overall Assessment**: Approach A wins 8 criteria, Approach B wins 5 criteria. But they address different needs.

---

### 2. Where They Can COMBINE (The Hybrid Model)

These approaches are **not mutually exclusive**. Here's how they complement each other:

#### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User's Local Config (local/)                                    │
│  - Personal profiles (home/, work/)                              │
│  - Custom skills not for sharing                                 │
│  - Project-specific overrides                                    │
├─────────────────────────────────────────────────────────────────┤
│  Template Profiles (_templates/)                                 │
│  - Curated combinations: react-zustand, react-mobx, fullstack   │
│  - Import from registry + add integration patterns              │
│  - Starting point for new users                                  │
├─────────────────────────────────────────────────────────────────┤
│  Community Registry (registry/ or separate repo)                 │
│  - Technology-agnostic skills (React, Tailwind, Zustand)        │
│  - Lower barrier to contribution than templates                  │
│  - Can be imported into any template/profile                     │
├─────────────────────────────────────────────────────────────────┤
│  Core Framework (core/)                                          │
│  - Compiler, templates, schemas                                  │
│  - Stable, receives updates                                      │
│  - Never contains content-specific code                          │
└─────────────────────────────────────────────────────────────────┘
```

#### How They Work Together

1. **Registry provides ingredients**: Generic skills (React, TypeScript, testing patterns)
2. **Templates provide recipes**: Curated combinations (react-zustand = React + Zustand + SCSS + Vitest)
3. **Local profiles provide customization**: User's specific workflow and overrides

#### Analogy to npm Ecosystem

| npm Concept | Hybrid Equivalent |
|-------------|-------------------|
| npm packages | Registry skills |
| package.json | Profile config.yaml |
| starter templates (CRA, Vite) | `_templates/` profiles |
| node_modules | Compiled output (.claude/) |

---

### 3. Skill Isolation: Is It Practical?

The registry proposal claims "React skill contains NO styling mentions." After analysis:

**Verdict: Partial isolation is achievable, but full isolation is impossible and undesirable.**

#### Why Full Isolation Fails

1. **Cross-cutting concerns**: React component patterns differ based on styling (className vs style props vs CSS-in-JS)
2. **State management influences architecture**: Zustand store patterns affect component structure differently than MobX observables
3. **Testing strategies vary**: MSW + Vitest patterns differ from Karma + Sinon patterns

#### What Works: Tiered Skill System

| Tier | Example | Content |
|------|---------|---------|
| **Core Skills** | `react-core.md` | Hooks lifecycle, component patterns, JSX fundamentals |
| **Integration Skills** | `react-scss.md` | className patterns, SCSS Modules with React, cva integration |
| **Variant Skills** | `react-tailwind.md` | Tailwind with React, conditional classes, responsive patterns |

This is how other ecosystems handle it:
- **ESLint**: Base rules → presets → project overrides
- **TypeScript**: lib → strict → project tsconfig
- **Tailwind**: Base → presets → project config

---

### 4. User Persona Analysis

#### Persona 1: Solo Developer Wanting Quick Setup

| Approach | Experience |
|----------|------------|
| **A (Dev Kit)** | Fork repo → run CLI → select template → compile → coding in 5 min |
| **B (Registry)** | Browse skills → understand conflicts → select carefully → configure → 15+ min |

**Winner**: A - Speed matters for solo devs

#### Persona 2: Team Wanting Standardized Config

| Approach | Experience |
|----------|------------|
| **A (Dev Kit)** | Team lead forks → customizes → team members clone team fork |
| **B (Registry)** | Team creates shared profile → imports from registry → all members use same imports |

**Winner**: Tie - Both work. B is cleaner for updates, A gives more control.

#### Persona 3: Power User Wanting Full Customization

| Approach | Experience |
|----------|------------|
| **A (Dev Kit)** | Fork → delete examples → write everything from scratch → full ownership |
| **B (Registry)** | Import base skills → override what's needed → constrained by registry structure |

**Winner**: A - Power users want ownership, not dependency

#### Persona 4: Contributor Wanting to Share Their Setup

| Approach | Experience |
|----------|------------|
| **A (Dev Kit)** | Fork is public → others can see and learn → no central discovery |
| **B (Registry)** | PR to registry → reviewed → merged → discoverable by all |

**Winner**: B - Central registry is better for community building

---

### 5. Implementation Complexity Analysis

#### Approach A: Dev Kit (What's Needed)

| Task | Complexity | Status |
|------|------------|--------|
| Directory restructure (core/ vs examples/) | Low | Not done |
| Create `_templates/` profiles | Low | Can adapt existing home/work |
| CLI onboarding wizard | Medium | Not started |
| Documentation (CUSTOMIZING, UPSTREAM) | Low | Not started |
| `.gitignore` for local/ | Trivial | Not done |

**Total effort**: ~2-3 days of work
**Infrastructure**: None (just GitHub)

#### Approach B: Registry (What's Needed)

| Task | Complexity | Status |
|------|------------|--------|
| Skill isolation guidelines | High | Not defined |
| Dependency/conflict declaration format | High | Not designed |
| Dependency resolution engine | High | Not started |
| Contribution workflow documentation | Medium | Not started |
| Quality control process | Medium | Not defined |
| Registry hosting/infrastructure | Medium | None exists |
| Import syntax in profile configs | Medium | Not designed |

**Total effort**: ~2-4 weeks of work
**Infrastructure**: Registry hosting, CI for contributions

---

### 6. Clear Recommendation

#### For v1 Open Source Launch: **Ship Approach A (Dev Kit)**

**Rationale**:
1. **Simpler to ship** - Most infrastructure already exists
2. **Lower barrier** - Developers understand "fork and customize"
3. **No maintenance burden** - Users own their content
4. **Proven model** - Dotfiles, NvChad, oh-my-zsh all work this way
5. **Real usage informs future** - Learn what a registry would actually need

#### Evolution Roadmap

| Version | Milestone |
|---------|-----------|
| **v1.0** | Dev Kit with templates + CLI onboarding |
| **v1.1** | Add community skills repository (separate repo, optional) |
| **v1.2** | Add skill bundles for common combinations |
| **v2.0** | Add dependency system IF usage proves it's needed |

#### What to Defer

1. **Skill dependency/conflict system** - Adds complexity, unproven need
2. **Full skill isolation** - May not be practical or desirable
3. **Central registry infrastructure** - Wait for community to form
4. **Quality control process** - Premature optimization

#### What to Build Now

1. **`_templates/` and `local/` directory structure**
2. **CLI onboarding wizard** (Inquirer.js + Commander.js)
3. **Clear separation** of `core/` vs `examples/`
4. **Documentation**: CUSTOMIZING.md, UPSTREAM.md, CONTRIBUTING.md
5. **Migration script** for existing users

---

### 7. Hybrid Launch Strategy

For those who want registry benefits without the complexity:

#### Lightweight Registry (v1.x)

Instead of a full dependency system, add a **community skills repository** as a separate GitHub repo:

```
claude-agent-kit-community/
├── skills/
│   ├── react-native.md       # Contributed by community
│   ├── graphql.md
│   ├── kubernetes.md
│   └── terraform.md
├── bundles/
│   ├── mobile-react-native.yaml
│   └── devops-k8s.yaml
└── README.md                  # Contribution guide
```

Users can:
1. Clone both repos
2. Copy skills they want into their `local/` directory
3. No dependency resolution needed (manual selection)

This gets 80% of registry benefits with 20% of the complexity.

---

### Summary Table

| Question | Answer |
|----------|--------|
| Which approach for v1? | **Approach A (Dev Kit)** |
| Are they mutually exclusive? | **No - they complement each other** |
| Should we build registry for v1? | **No - defer to v1.x or v2** |
| Is skill isolation practical? | **Partially - use tiered skills instead** |
| What's the evolution path? | **Dev Kit → Community repo → Dependencies (if needed)** |
| Infrastructure needed for v1? | **None beyond GitHub** |

---

## Synthesis

### Overall Recommendation

**Launch with Approach A (Agent Authoring Dev Kit) for v1. Evolve toward hybrid model in later versions.**

The Community Registry proposal is intellectually appealing but adds significant complexity without proven need. The Dev Kit approach:
- Is nearly complete (most infrastructure exists)
- Aligns with developer expectations (dotfiles model)
- Has zero infrastructure requirements
- Allows real usage to inform whether a registry is needed

### Trade-offs Summary

| Trade-off | Our Choice | Reasoning |
|-----------|------------|-----------|
| Simplicity vs Features | Simplicity | Users can adopt quickly, complexity deters adoption |
| Customization vs Guardrails | Customization | Personal configs need freedom, not constraints |
| Discoverability vs Ownership | Ownership (for now) | Community repo can add discovery later |
| Automation vs Manual | Manual (for now) | Dependency resolution complexity is unjustified |
| Perfect isolation vs Practical layering | Practical layering | Full skill isolation is impossible anyway |

### Key Insights

1. **The approaches are complementary, not competing** - Registry concepts can layer on top of Dev Kit
2. **Skill isolation is a spectrum, not binary** - Tiered skills (core → integration → variant) work better than strict isolation
3. **Community forms around simplicity** - Oh-my-zsh succeeded with fork model, not dependency management
4. **80/20 rule applies** - Lightweight community repo gives most benefits without complexity

### Suggested Next Steps

#### Immediate (v1.0 Launch)

1. [ ] Restructure directories: `core/` (compiler) vs `examples/` (content)
2. [ ] Create `_templates/` with 4 profiles: react-zustand, react-mobx, fullstack, minimal
3. [ ] Create `local/` directory (gitignored) for user profiles
4. [ ] Build CLI onboarding wizard with Inquirer.js
5. [ ] Write documentation: README, CUSTOMIZING.md, UPSTREAM.md, CONTRIBUTING.md
6. [ ] Create migration script for existing users

#### Near-term (v1.x)

7. [ ] Create separate `claude-agent-kit-community` repository
8. [ ] Define contribution guidelines for community skills
9. [ ] Add skill bundles (curated combinations)
10. [ ] Add CLI commands for importing community skills

#### Long-term (v2.0, if needed)

11. [ ] Evaluate need for dependency system based on real usage
12. [ ] Consider skill versioning if external consumers emerge
13. [ ] Add conflict detection (not prevention) as a helper

### Final Assessment

The Community Registry proposal raised valuable questions about skill isolation, dependency management, and community contribution models. However, for a v1 launch, the simpler Dev Kit approach is the right choice. The registry concepts can be layered on incrementally as the community forms and real needs emerge.

**Bottom line**: Ship something simple that works. Let usage guide complexity.

---

_Last updated: 2026-01-08 (All agents complete - Agent A isolation, Agent B dependency/conflict system, Agent C community registry models, Agent D bundling architecture, Agent E comparison)_
