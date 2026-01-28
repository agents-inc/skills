# Atomic vs Integration Skills Research

Research on when to create atomic skills versus integrated multi-library skills.

---

## Backend Integration Analysis

**Date:** 2026-01-17
**Skills Analyzed:**

- `backend/api-hono (@vince)` - Atomic Hono skill
- `backend/database-drizzle (@vince)` - Atomic Drizzle skill
- `backend/auth-better-auth+drizzle+hono (@vince)` - Integration skill

### Executive Summary

After deep analysis of the three skills, the conclusion is clear: **Better Auth does NOT benefit from a standalone atomic skill**, and the current integration approach is correct. However, the atomic Hono and Drizzle skills remain valuable because they serve broader use cases beyond authentication.

---

### Analysis: Does Better Auth Make Sense Without Drizzle/Hono?

**No.** Better Auth is fundamentally an integration library. Examining the skill content reveals:

1. **Database Adapter is Required**
   - Better Auth requires a database adapter at initialization: `drizzleAdapter(db, { provider: "pg" })`
   - Session storage, user records, OAuth tokens, 2FA secrets ALL require database
   - A "Better Auth without database" skill would be incomplete and unusable

2. **HTTP Handler is Required**
   - Better Auth exposes `auth.handler(c.req.raw)` which must be mounted on an HTTP framework
   - All client-server communication flows through this handler
   - OAuth callbacks, session cookies, CSRF protection all need HTTP layer

3. **The Three Are Inseparable in Practice**
   - Every Better Auth pattern in the skill requires both Hono context (`c.req.raw.headers`) AND Drizzle (`drizzleAdapter(db, ...)`)
   - There is no meaningful Better Auth code that doesn't touch both layers

---

### Pattern Classification: Integration-Specific vs Atomic

#### Patterns That ONLY Make Sense in Integration Context

These patterns are inherently cross-cutting and cannot be extracted to atomic skills:

| Pattern                            | Why Integration-Specific                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Server Configuration (auth.ts)** | Requires `drizzleAdapter(db, ...)` - cannot exist without Drizzle                                             |
| **Hono Session Middleware**        | Uses `auth.api.getSession({ headers: c.req.raw.headers })` - requires both Hono context AND auth instance     |
| **Protected Routes**               | Combines Hono's `createRoute`, OpenAPI metadata, and `c.get("user")` from auth middleware                     |
| **CORS Before Auth**               | Framework-specific ordering: `app.use("/auth/*", cors(...))` before `app.on(["POST", "GET"], "/auth/*", ...)` |
| **Schema Generation Workflow**     | `npx @better-auth/cli generate` then `npx drizzle-kit migrate` - tools are tightly coupled                    |
| **Type-Safe Variables**            | `auth.$Infer.Session` types flow into Hono's `Variables` generic - cross-library type bridging                |

#### Patterns That COULD Be Atomic (But Aren't Worth Extracting)

| Pattern                        | Why Extraction Is Low Value                                  |
| ------------------------------ | ------------------------------------------------------------ |
| **OAuth Provider Config**      | 15 lines of config, always shown with full auth setup        |
| **2FA TOTP Flow**              | Client-side React hooks, but always in context of auth setup |
| **Organization Multi-tenancy** | Plugin config, meaningless without auth instance             |
| **Session Cookie Caching**     | 5 lines of config in session object                          |

**Key Insight:** The "atomic" patterns are too small to justify separate skills. They're configuration snippets, not reusable architectural patterns.

---

### Value Assessment: Atomic Hono and Drizzle Skills

#### Atomic Hono Skill Value: HIGH

The atomic Hono skill covers patterns that are used WITHOUT Better Auth:

- OpenAPI spec generation with `@hono/zod-openapi`
- Rate limiting middleware
- CORS configuration
- Health check endpoints
- Structured logging
- Caching strategies (Cache-Control, ETags)
- Error handling with standardized responses
- Pagination patterns
- Filtering with comma-separated values

**These patterns apply to ANY Hono API**, not just authenticated ones.

#### Atomic Drizzle Skill Value: HIGH

The atomic Drizzle skill covers patterns independent of auth:

- Neon HTTP/WebSocket connection setup
- Schema definition (tables, enums, relations)
- Relational queries with `.with()` (N+1 prevention)
- Query builder for complex filters
- Transactions with proper `tx` usage
- Migration workflows
- Database seeding

**These patterns apply to ANY database operation**, not just auth-related ones.

---

### Overlap Analysis: Duplication Between Skills

| Concept            | Atomic Skill Coverage      | Integration Skill Coverage  | Duplication?                |
| ------------------ | -------------------------- | --------------------------- | --------------------------- |
| Hono route setup   | Full patterns with OpenAPI | Basic handler mounting only | No - different depth        |
| Drizzle connection | Full config with casing    | Implicit via adapter        | No - different focus        |
| Error handling     | Comprehensive with codes   | Auth-specific 401/403       | No - different scope        |
| Middleware         | Generic patterns           | Auth-specific middleware    | No - different purpose      |
| Type safety        | Zod + OpenAPI types        | `auth.$Infer.Session` types | No - different type sources |

**Conclusion:** The skills are complementary, not redundant. The integration skill USES the atomic concepts but focuses on the GLUE between them.

---

### Recommendation for Backend Integrations

#### 1. Keep Atomic Skills When Libraries Have Independent Value

**Hono and Drizzle warrant atomic skills because:**

- They're used in non-auth contexts (CRUD APIs, data pipelines)
- Their patterns are substantial (pagination, transactions, rate limiting)
- They have independent decision trees (caching strategy, migration workflow)

#### 2. Integration Skills for Tightly-Coupled Auth Stacks

**Better Auth should NOT have an atomic skill because:**

- It cannot function without database + HTTP framework
- Its patterns are inherently cross-cutting
- A standalone skill would be incomplete and confusing

#### 3. Pattern for Future Integration Skills

```
Is Library X useful without its typical companions?
+-- YES -> Create atomic skill
|   +-- Do companions have integration patterns worth documenting?
|       +-- YES -> Also create integration skill
|       +-- NO -> Atomic skill sufficient
+-- NO -> Create integration skill ONLY
    +-- Are companions already documented in atomic skills?
        +-- YES -> Integration skill references atomic skills
        +-- NO -> Integration skill is self-contained
```

#### 4. Naming Convention Confirmation

The current naming is correct:

- `better-auth+drizzle+hono` signals "this skill is about how these work TOGETHER"
- Users seeking standalone Hono help find `api-hono`
- Users seeking standalone Drizzle help find `database-drizzle`
- Users setting up auth naturally find the integration skill

---

### Potential Improvements

1. **Cross-References in Atomic Skills**
   - Add "See also: `better-auth+drizzle+hono` for authentication patterns" in atomic skills
   - Prevents users from trying to implement auth from scratch using atomic skills

2. **Prerequisite Documentation**
   - Integration skill could note: "This skill assumes familiarity with Hono and Drizzle patterns"
   - Links to atomic skills for foundational concepts

3. **Future Integration Skills**
   - `prisma+trpc+next-auth` - similar tightly-coupled auth stack
   - `stripe+drizzle+hono` - payment integration (Stripe requires DB + HTTP)
   - `uploadthing+react+hono` - file upload stack

---

### Final Verdict

| Skill                                    | Should Exist? | Reason                              |
| ---------------------------------------- | ------------- | ----------------------------------- |
| `api-hono` (atomic)                      | YES           | Hono is widely used without auth    |
| `database-drizzle` (atomic)              | YES           | Drizzle is widely used without auth |
| `better-auth+drizzle+hono` (integration) | YES           | Correct scope for auth patterns     |
| `better-auth` (atomic)                   | NO            | Would be incomplete and misleading  |

**The current skill architecture is correct.** Atomic skills for libraries with independent value, integration skills for tightly-coupled stacks where the value IS the integration.

---

## Frontend Integration Analysis (React + MobX)

**Date:** 2026-01-17
**Skills Analyzed:**

- `react (@vince)` - Atomic React skill
- `mobx (@vince)` - Atomic MobX skill
- `react+mobx (@vince)` - Integration skill

### Executive Summary

The React+MobX integration skill demonstrates the **critical need for combined skills** when libraries have conflicting patterns. Unlike backend integrations where components simply wire together, frontend state management integrations require guidance on **which tool to use when**. The integration skill teaches developers to avoid patterns that work in isolation but fail when combined.

---

### Pattern Classification: What Lives Where?

#### Content in React Atomic Skill

| Pattern                                                    | Notes                       |
| ---------------------------------------------------------- | --------------------------- |
| forwardRef + displayName                                   | Full examples with WHY      |
| Component tier architecture                                | React-specific organization |
| Variant props with TypeScript                              | Type-safe styling           |
| Icon usage (lucide-react)                                  | Tree-shakeable imports      |
| Event handler naming conventions                           | `handle` vs `on` prefixes   |
| Custom hooks (usePagination, useDebounce, useLocalStorage) | Generic React hooks         |
| Error boundaries with retry                                | Class component pattern     |
| className prop exposure                                    | Styling flexibility         |

#### Content in MobX Atomic Skill

| Pattern                              | Notes                       |
| ------------------------------------ | --------------------------- |
| Arrow function methods               | CRITICAL for `this` binding |
| runInAction after await              | Async action context        |
| RootStore pattern with DI            | Store orchestration         |
| reaction() for side effects          | Observable reactions        |
| MobxQuery bridge                     | Data fetching integration   |
| makeAutoObservable vs makeObservable | Observation modes           |
| Store type interfaces                | Type-safe DI                |
| Private dependencies (#)             | Encapsulation               |
| Computed properties                  | Derived state               |

#### Content UNIQUE to React+MobX Integration Skill

| Pattern                              | Why Integration-Specific                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| **observer() wrapper decision**      | HOW to wrap React components for MobX reactivity                     |
| **useEffect vs reaction() guidance** | "Don't use useEffect for MobX state" - cannot exist in either atomic |
| **useMemo vs computed guidance**     | "Use computed instead of useMemo" - overrides React atomic advice    |
| **displayName for observer**         | observer HOC obscures names; React atomic doesn't know this          |
| **Store access via singleton**       | How React components access MobX stores                              |
| **Props `type` vs `interface`**      | Project-specific ESLint rule                                         |
| **useTranslation patterns**          | i18next integration with MobX components                             |
| **Custom hooks accessing stores**    | Hook/store integration patterns                                      |
| **Promise-based modal pattern**      | UI pattern using both React hooks and stores                         |

---

### Critical Finding: Conflicting Patterns

The React+MobX integration skill contains **pattern overrides** that cannot exist in either atomic skill:

#### Conflict 1: useEffect vs reaction()

**React Atomic Might Teach:**

```typescript
// Standard React pattern
useEffect(() => {
  if (isLoaded) {
    doSomething();
  }
}, [isLoaded]);
```

**MobX Atomic Teaches:**

```typescript
// MobX pattern for side effects
reaction(
  () => this.isLoaded,
  (isLoaded) => {
    if (isLoaded) this.doSomething();
  },
);
```

**Integration Skill MUST Teach:**

```typescript
// BAD - creates duplicate reactive systems
useEffect(() => {
  if (store.isLoaded) doSomething();
}, [store.isLoaded]); // Breaks MobX tracking!

// GOOD - use reaction in store constructor
reaction(() => this.isLoaded, (isLoaded) => { ... });
```

**Why This Can't Be Atomic:**

- React skill can't say "don't use useEffect" - it's a valid React pattern
- MobX skill can't reference React hooks - it doesn't know React exists
- Only the integration can say "when using MobX with React, prefer reaction()"

#### Conflict 2: useMemo vs computed

**React Atomic Might Teach:**

```typescript
// Standard React memoization
const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
```

**MobX Atomic Teaches:**

```typescript
// MobX computed getters
get activeItems() {
  return this.items.filter(item => item.active);
}
```

**Integration Skill MUST Teach:**

```typescript
// BAD - redundant memoization
const activeItems = useMemo(
  () => store.items.filter(item => item.active),
  [store.items]
);

// GOOD - computed in store
// Store:
get activeItems() { return this.items.filter(...); }
// Component:
const { activeItems } = store; // Already cached
```

**Why This Can't Be Atomic:**

- React skill SHOULD teach useMemo - it's valuable for React state
- MobX skill teaches computed but can't say "not useMemo"
- The conflict only exists when both are present

---

### Overlap Analysis: Minimal Duplication

Examining actual content overlap between skills:

| Content            | React Atomic     | MobX Atomic      | Integration                   |
| ------------------ | ---------------- | ---------------- | ----------------------------- |
| displayName        | Full explanation | N/A              | WHY for observer specifically |
| Arrow functions    | N/A              | Full explanation | References MobX skill         |
| runInAction        | N/A              | Full explanation | References MobX skill         |
| observer()         | N/A              | Brief mention    | Full guidance                 |
| useEffect guidance | General use      | N/A              | Anti-pattern warning          |
| useMemo guidance   | General use      | N/A              | Anti-pattern warning          |

**Key Observation:** The integration skill **references** atomic concepts rather than duplicating them. It adds integration-specific guidance without repeating the foundations.

---

### Two-Layer Architecture Evaluation

#### Would Splitting Work?

**Proposed Structure:**

```
src/skills/
  libraries/
    react/
    mobx/
  integrations/
    react+mobx/
```

**Problems with this approach:**

1. **Context Switching:** Users need to load 3 skills for one task
2. **Incomplete Guidance:** Atomic React skill teaches useMemo; user doesn't know they shouldn't use it with MobX
3. **Discovery Problem:** How does user know react+mobx skill exists?
4. **Reference Fragility:** If React atomic changes to recommend useMemo more, integration skill becomes outdated

#### Why Current Structure Works Better

1. **Integration skills are self-contained** - all needed guidance in one place
2. **Atomic skills for standalone use** - React without MobX still valuable
3. **Cross-references** - integration skill can note "see mobx skill for store patterns"
4. **Clear purpose** - skill name signals what it teaches

---

### Additional Combined Skills Analyzed

#### React-Query+Axios+Zod

| Pattern                      | Integration-Specific?          |
| ---------------------------- | ------------------------------ |
| djangoBackend axios instance | Project-specific config        |
| Static API class URLs        | Project-specific pattern       |
| Zod safeParse for responses  | Zod + Axios integration        |
| MobxQuery bridge             | React Query + MobX integration |
| Query key constants          | Could be atomic                |

**Verdict:** More project-specific than general integration. Could be split, but value is low.

#### Performance+MobX

| Pattern                          | Integration-Specific?        |
| -------------------------------- | ---------------------------- |
| computed vs useMemo              | YES - React + MobX conflict  |
| observer fine-grained reactivity | YES - MobX + React rendering |
| Lazy route loading               | Could be atomic              |
| WebGL cleanup                    | Could be atomic              |
| MobxQuery disposal               | YES - RQ + MobX              |

**Verdict:** Contains both integration patterns (computed vs useMemo) and standalone patterns (lazy loading). Current combined approach is appropriate.

---

### Recommendation: Keep Integration Skills as Primary

#### When to Create Integration Skills

Create a combined skill when:

1. **Conflicting defaults exist:** Libraries suggest opposite approaches
   - Example: useMemo vs computed, useEffect vs reaction

2. **Integration boilerplate is significant:** Non-trivial setup to wire together
   - Example: observer() wrapper, MobxQuery bridge

3. **Anti-patterns emerge:** Things that work in isolation but fail combined
   - Example: useEffect with MobX observables

4. **Shared critical requirements:** Requirements that span both libraries
   - Example: "MUST wrap with observer() AND add displayName"

#### When to Keep Skills Atomic

Keep atomic skills when:

1. Library is truly standalone (date-fns, lodash)
2. Integration is trivial (just import and use)
3. No conflicting patterns with common pairings
4. Library is rarely combined with others

---

### Proposed Reference System

To improve skill discovery without restructuring:

#### Atomic Skill Headers

```yaml
# react/SKILL.md
---
name: frontend/react (@vince)
integrations:
  - react+mobx # When using MobX state management
  - react+zustand # When using Zustand state management
---
```

#### Integration Skill Headers

```yaml
# react+mobx/SKILL.md
---
name: frontend/react+mobx (@vince)
requires:
  - react # Understand React basics
  - mobx # Understand MobX basics
---
```

This allows Claude to:

1. Suggest loading integration skill when context detected
2. Warn users about potential conflicts
3. Guide users to foundational skills

---

### Final Classification: All Analyzed Skills

| Skill                      | Type        | Justification                                 |
| -------------------------- | ----------- | --------------------------------------------- |
| `react`                    | Atomic      | Valuable without any state library            |
| `mobx`                     | Atomic      | Store patterns standalone                     |
| `react+mobx`               | Integration | Conflicting patterns require unified guidance |
| `hono`                     | Atomic      | API patterns without auth                     |
| `drizzle`                  | Atomic      | Database patterns without auth                |
| `better-auth+drizzle+hono` | Integration | Auth requires all three                       |
| `react-query`              | Atomic      | Valuable without MobX                         |
| `react-query+axios+zod`    | Integration | Project-specific configuration                |
| `performance+mobx`         | Integration | Contains React+MobX conflicts                 |

---

### Conclusion

The two-layer architecture has theoretical appeal but practical challenges. **Integration-specific guidance cannot be split** because the rules only apply when libraries interact. The current pattern of:

1. **Atomic skills** for libraries with independent value
2. **Integration skills** for libraries with conflicting or complex interactions
3. **References** between skills for discovery

...is the correct approach. Do not force artificial separation that would fragment essential guidance about how libraries work together.

---

## Conflict Prevention Strategies

**Date:** 2026-01-17
**Research Question:** When Claude loads multiple related skills (e.g., `react`, `mobx`, and `react+mobx`), how do we prevent conflicts, overwrites, and confusion between skill instructions?

---

### How Skill Loading Works

Based on analysis of the current architecture in `src/cli/lib/compiler.ts`, `src/cli/lib/resolver.ts`, and `src/templates/agent.liquid`:

#### Loading Mechanism

```
1. COMPILE TIME: resolveAgents() builds AgentConfig with skills array
   +-- Skills are partitioned into preloaded vs dynamic
   +-- preloadedSkills: listed in frontmatter, Claude Code auto-loads
   +-- dynamicSkills: listed in activation protocol, require Skill tool invocation

2. RUNTIME: Claude Code processes compiled agent
   +-- Frontmatter skills: Auto-loaded into context before agent runs
   +-- Dynamic skills: Loaded on-demand via `skill: "[skill-id]"`

3. CONTEXT BUILDING: Skills are concatenated into context
   +-- Order: frontmatter skills first, then dynamic skills as invoked
```

#### Key Finding: Sequential Addition, No Merge Logic

Skills are **additively concatenated** into Claude's context. There is no:

- Conflict detection between skills
- Merge/override logic for contradictory rules
- Priority system beyond load order
- Deduplication of repeated patterns

**Implication**: If `react` skill says "use useState" and `react+mobx` skill says "avoid useState, use MobX", Claude receives both instructions and must resolve the conflict itself.

---

### Conflict Scenario Analysis

| Scenario                             | Example                                                                        | Conflict Type          | Severity |
| ------------------------------------ | ------------------------------------------------------------------------------ | ---------------------- | -------- |
| **Same pattern, different approach** | React: "use useState" vs MobX: "use observable"                                | Contradictory guidance | HIGH     |
| **Overlapping scope**                | React skill mentions icons, Styling skill mentions icons                       | Redundant content      | MEDIUM   |
| **Integration-specific overrides**   | React: "use forwardRef" vs React+MobX: "use observer wrapper"                  | Override confusion     | HIGH     |
| **Decision tree conflicts**          | React: "use useState for local state" vs Integration: "use MobX for all state" | Decision paralysis     | HIGH     |
| **Critical requirements clash**      | Two skills with different "MUST" rules for same concern                        | Compliance confusion   | CRITICAL |

---

### Strategy 1: Skill Atomicity (SKILL-ATOMICITY-BIBLE.md)

**Principle**: A skill should ONLY discuss its own domain.

**Implementation**:

```markdown
// React skill (ATOMIC)

- Discusses: component patterns, hooks, forwardRef, props
- Does NOT discuss: state libraries, styling solutions, testing frameworks

// MobX skill (ATOMIC)

- Discusses: stores, observables, reactions, computed
- Does NOT discuss: component patterns, rendering, styling

// React+MobX skill (INTEGRATION)

- Discusses ONLY: how React and MobX interact
- Covers: observer() wrapper, avoiding useEffect, stores in components
- Does NOT: repeat base React or MobX patterns
```

**Evidence of effectiveness**: Current `react+mobx (@vince)` skill references but doesn't duplicate patterns from base skills:

```markdown
// From react+mobx SKILL.md line 58
**When NOT to use:**

- Building stores (use `skill: frontend-mobx-state-work`)
- API integration (use `skill: frontend-api-work`)
- Styling patterns (use `skill: frontend-styling-work`)
```

**Violation to avoid**: Integration skill repeating atomic skill content.

---

### Strategy 2: Explicit Scope Declarations

**Principle**: Every skill must declare what it covers and what it defers.

**Proposed implementation**:

```markdown
<skill_scope>

## Scope Declaration

**This skill covers:**

- [Pattern 1]
- [Pattern 2]

**This skill defers to:**

- `[skill-id]` for [topic]
- `[skill-id]` for [topic]

**This skill conflicts with:**

- `[skill-id]` - mutually exclusive approaches
  </skill_scope>
```

**Example for React+MobX**:

```markdown
<skill_scope>

## Scope Declaration

**This skill covers:**

- Integrating MobX observer() with React components
- Store access patterns in React components
- Replacing useEffect/useMemo with MobX reactions/computed

**This skill defers to:**

- `frontend/react` for base component patterns (forwardRef, composition)
- `frontend/state-mobx` for store architecture (RootStore, makeAutoObservable)

**This skill conflicts with:**

- `frontend/state-zustand` - incompatible state management approach
- `frontend/react` useState patterns for shared state (use MobX instead)
  </skill_scope>
```

---

### Strategy 3: Priority/Specificity Rules

**Principle**: More specific skills override more general skills for their scope.

**Proposed hierarchy**:

```
Specificity Level 1 (HIGHEST): Integration skills (react+mobx)
Specificity Level 2: Domain-specific skills (react, mobx)
Specificity Level 3: Cross-cutting skills (accessibility, performance)
```

**Rule**: When loading an integration skill, its patterns override conflicting patterns from constituent atomic skills.

**Implementation in SKILL.md**:

```markdown
<skill_priority>

## Priority Declaration

**Priority Level:** Integration (overrides atomic skill patterns for integration scope)

**Overrides:**

- `frontend/react` Pattern 4 (useEffect for side effects) - use MobX reactions instead
- `frontend/react` Pattern 5 (useMemo for derived state) - use MobX computed instead

**Does NOT Override:**

- `frontend/react` Pattern 1 (component architecture) - still applies
- `frontend/react` Pattern 2 (forwardRef) - still applies
  </skill_priority>
```

---

### Strategy 4: Mutual Exclusion Tags

**Principle**: Some skills cannot be used together.

**Implementation in metadata.yaml**:

```yaml
# metadata.yaml for frontend/state-zustand
name: frontend/state-zustand (@vince)
description: Zustand stores, client state patterns
conflicts_with:
  - frontend/state-mobx (@vince)
  - frontend/state-redux (@vince)
  - frontend/react+mobx (@vince)
```

**CLI validation during compile**:

```typescript
// In resolver.ts or new validator
function validateSkillCompatibility(skills: Skill[]): void {
  for (const skill of skills) {
    for (const conflictId of skill.conflicts_with ?? []) {
      if (skills.some((s) => s.id === conflictId)) {
        throw new Error(
          `Skill conflict: "${skill.id}" cannot be used with "${conflictId}"`,
        );
      }
    }
  }
}
```

---

### Strategy 5: Layered Loading Order

**Principle**: Load skills in dependency order - atomic before integration.

**Proposed load order**:

```
1. Cross-cutting skills (accessibility, performance)
2. Domain atomic skills (react, mobx, styling)
3. Integration skills (react+mobx, react+query)
```

**Rationale**: Integration skills can reference patterns from atomic skills that are already in context, enabling phrases like "the observer() pattern overrides Pattern 4 from the React skill."

**Implementation in stack config**:

```yaml
agent_skills:
  frontend-developer:
    # Ordered by dependency
    cross-cutting:
      - id: frontend/accessibility (@vince)
        preloaded: true
    framework:
      - id: frontend/react (@vince)
        preloaded: true
    state:
      - id: frontend/state-mobx (@vince)
        preloaded: true
    integration:
      - id: frontend/react+mobx (@vince)
        preloaded: true # Loaded AFTER atomic skills
```

---

### Strategy 6: "Replaces" / "Extends" Relationship

**Principle**: Integration skills explicitly declare their relationship to atomic skills.

**Implementation**:

```markdown
<skill_relationships>

## Skill Relationships

**Extends:**

- `frontend/react (@vince)` - adds MobX-specific patterns to React components
- `frontend/state-mobx (@vince)` - adds React integration patterns to MobX stores

**Replaces (within scope):**

- Pattern: useState for shared state -> use MobX observables
- Pattern: useEffect for MobX reactions -> use reaction() in stores
- Pattern: useMemo for derived state -> use MobX computed

**Preserves:**

- All forwardRef patterns from React skill
- All RootStore patterns from MobX skill
- All component composition patterns
  </skill_relationships>
```

---

### Strategy 7: Conflict Resolution Protocol in Agent Template

**Principle**: Agents include explicit conflict resolution instructions.

**Implementation in agent.liquid**:

```liquid
{% if skills.size > 1 %}
<skill_conflict_resolution>
## Skill Conflict Resolution

When skills provide conflicting guidance:

1. **Integration skill > Atomic skill** for integrated patterns
2. **More specific > More general** for overlapping scope
3. **Later loaded > Earlier loaded** when specificity is equal
4. **Project CLAUDE.md > All skills** for project conventions

If conflict cannot be resolved, ask for clarification before proceeding.
</skill_conflict_resolution>
{% endif %}
```

---

### Recommended Conventions

#### Convention 1: Atomic Skill Rules

1. **Single domain only** - discuss ONLY own technology
2. **Generic placeholders** - "use your styling solution" not "use SCSS"
3. **No decision trees to other domains** - end within own domain
4. **Reference, don't embed** - link to other skills, don't duplicate content

#### Convention 2: Integration Skill Rules

1. **Bridge patterns only** - discuss ONLY the intersection
2. **Explicit overrides** - clearly state what changes from atomic skills
3. **Ordered dependencies** - list required atomic skills in load order
4. **Defer unchanged patterns** - link back to atomic skills for base patterns

#### Convention 3: Metadata Requirements

```yaml
# Required for all skills
name: category/name (@author)
description: One-line description

# Required for integration skills
extends:
  - skill-id-1
  - skill-id-2
replaces:
  - skill-id-1#pattern-name
  - skill-id-2#pattern-name
conflicts_with:
  - incompatible-skill-id

# Optional for atomic skills
conflicts_with:
  - alternative-approach-skill
```

#### Convention 4: Critical Requirements Non-Conflict

**Rule**: Critical requirements from integration skills MUST NOT contradict atomic skill critical requirements.

**Valid**:

```markdown
// React skill
**(You MUST use forwardRef on components exposing refs)**

// React+MobX skill
**(You MUST wrap components reading observables with observer())**
// ^^^ Different concern - no conflict
```

**Invalid**:

```markdown
// React skill
**(You MUST use useEffect for all side effects)**

// React+MobX skill
**(You MUST use reaction() in stores - NOT useEffect in components)**
// ^^^ Direct contradiction - needs reconciliation
```

**Resolution**: Atomic skill should be more generic:

```markdown
// React skill (fixed)
**(You MUST handle side effects appropriately for your state management approach)**
```

---

### Implementation Checklist

#### For New Atomic Skills

- [ ] Skill discusses ONLY its own domain
- [ ] No imports from other domains in examples
- [ ] Decision trees end within own scope
- [ ] Generic placeholders for external concerns
- [ ] "When NOT to use" references other skills

#### For New Integration Skills

- [ ] `extends:` lists all atomic skill dependencies
- [ ] `replaces:` specifies which patterns are overridden
- [ ] `conflicts_with:` lists incompatible skills
- [ ] Bridge patterns only - no duplication of atomic content
- [ ] Clear "Scope Declaration" section
- [ ] Critical requirements don't contradict atomic skills

#### For Skill Loading

- [ ] Load order: cross-cutting -> atomic -> integration
- [ ] Validate no `conflicts_with` collisions
- [ ] Integration skills loaded after their dependencies
- [ ] Agent template includes conflict resolution protocol

---

### Open Questions for Future Research

1. **Runtime validation**: Should Claude Code validate skill compatibility at runtime?
2. **Automatic deduplication**: Can we detect and merge duplicate patterns programmatically?
3. **Versioning**: How do skill version changes affect compatibility declarations?
4. **Transitive conflicts**: If A conflicts with B, and C extends B, does A conflict with C?
5. **Partial overrides**: Can an integration skill override only specific sections of an atomic skill?

---

### Conflict Prevention Summary

**Preventing skill conflicts requires a multi-layered approach:**

1. **Atomicity** - Skills discuss only their domain (SKILL-ATOMICITY-BIBLE.md)
2. **Scope declarations** - Explicit "covers", "defers", "conflicts" sections
3. **Priority rules** - Integration skills override atomic skills for overlap
4. **Mutual exclusion** - `conflicts_with` in metadata prevents incompatible combinations
5. **Load ordering** - Dependencies loaded before dependents
6. **Relationship declarations** - `extends`, `replaces` clarify modifications
7. **Agent-level resolution** - Template includes conflict resolution protocol

**The key insight**: Conflicts arise when skills overlap in scope without explicit coordination. The solution is strict boundaries (atomicity) combined with explicit relationship declarations (extends/replaces/conflicts).
