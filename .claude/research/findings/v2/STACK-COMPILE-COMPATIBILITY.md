# Stack Compile Compatibility Research

> **Purpose**: Analyze whether the proposed Stack Marketplace structure is compatible with the existing compilation infrastructure, and propose the path of least resistance.

---

## Executive Summary

The proposed stack structure (`skills/react/SKILL.md`) is **incompatible** with the existing source structure (`skills/frontend/react.md`) but **aligns exactly** with the compiled output structure (`skills/frontend-react/SKILL.md`). This creates a key insight: **stacks should contain pre-compiled skills, not source skills**.

### Key Findings

| Aspect | Existing Source | Existing Compiled | Proposed Stack |
|--------|-----------------|-------------------|----------------|
| Path pattern | `skills/frontend/react.md` | `skills/frontend-react/SKILL.md` | `skills/react/SKILL.md` |
| Naming | `{category}/{name}.md` | `{category-name}/SKILL.md` | `{name}/SKILL.md` |
| Registry reference | Required | N/A (output) | Not needed |
| Compilation | Yes (via registry) | N/A (is output) | No (already compiled) |

### Recommendations

1. **Stacks contain compiled skills, not source skills** - No compilation needed for stack skills
2. **Adopt convention**: `skills/{id}/SKILL.md` where `id` matches registry pattern (e.g., `frontend-react`)
3. **Minimal changes to compile.ts** - Stacks are independent; profiles continue as-is
4. **Stack registry is separate** - `stack.yaml` lists skills by ID, resolved at runtime (not compile time)

---

## Current Infrastructure Analysis

### Source Structure (`src/skills/`)

```
skills/
├── frontend/
│   ├── react.md
│   ├── styling.md
│   ├── api.md
│   └── ...
├── backend/
│   ├── api.md
│   ├── authentication.md
│   └── ...
├── setup/
│   ├── monorepo.md
│   └── ...
├── shared/
│   └── reviewing.md
├── security/
│   └── security.md
└── research/
    └── methodology.md
```

**Key characteristics:**
- Flat files within category directories
- File name IS the skill name: `react.md`
- Registry reference: `frontend/react` maps to `skills/frontend/react.md`
- Has YAML frontmatter with `name` and `description`

### Registry Definition (`src/registry.yaml`)

```yaml
skills:
  frontend/react:
    path: skills/frontend/react.md  # Relative to profile directory
    name: React
    description: Component architecture, hooks, patterns
```

**Key characteristics:**
- Skill ID uses `/` separator: `frontend/react`
- Path is relative to profile: `${ROOT}/profiles/${PROFILE}/${skill.path}`
- Name/description are metadata, not used in path resolution

### Compiled Output (`.claude/skills/`)

```
skills/
├── frontend-react/
│   └── SKILL.md
├── frontend-styling/
│   └── SKILL.md
├── backend-api/
│   └── SKILL.md
└── ...
```

**Key characteristics:**
- Directory per skill (not flat files)
- Skill ID transformed: `/` becomes `-` (e.g., `frontend/react` → `frontend-react`)
- File is always `SKILL.md`
- Content is copied verbatim from source

### Compilation Logic (`compile.ts` lines 386-411)

```typescript
async function compileAllSkills(
  resolvedAgents: Record<string, AgentConfig>
): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(resolvedAgents)
    .flatMap((a) => [...a.skills.precompiled, ...a.skills.dynamic])
    .filter((s) => s.path);

  const uniqueSkills = [...new Map(allSkills.map((s) => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");  // Key transformation
    const outDir = `${OUT}/skills/${id}`;
    await Bun.$`mkdir -p ${outDir}`;

    try {
      const content = await readFile(
        `${ROOT}/profiles/${PROFILE}/${skill.path}`
      );
      await Bun.write(`${outDir}/SKILL.md`, content);
    } catch (error) { /* ... */ }
  }
}
```

**Key observations:**
1. Skills are derived from agent configs (precompiled + dynamic)
2. ID transformation: `skill.id.replace("/", "-")` - slash to dash
3. Output directory: `${OUT}/skills/${id}/SKILL.md`
4. Content is **copied verbatim** - no processing beyond copy

---

## Proposed Stack Structure Analysis

From SKILL-FORKING-RESEARCH.md:

```
my-stack/
├── stack.yaml
├── skills/
│   ├── react/
│   │   └── SKILL.md
│   ├── styling/
│   │   └── SKILL.md
│   └── testing/
│       └── SKILL.md
└── agents/
```

### Structure Mismatch Identified

| Aspect | Existing | Proposed | Issue |
|--------|----------|----------|-------|
| Skill ID | `frontend/react` | `react` | Drops category prefix |
| Directory | `frontend-react/` | `react/` | Different naming |
| Source path | `skills/frontend/react.md` | `skills/react/SKILL.md` | Different structure |

### Why the Proposed Structure Differs

The SKILL-FORKING-RESEARCH.md proposal was **UI-focused**, optimizing for user-friendliness:
- "react" is cleaner than "frontend-react" or "frontend/react"
- Nested `SKILL.md` matches the compiled output pattern

However, it **diverges from existing conventions** in a way that could cause confusion.

---

## Compatibility Options

### Option 1: Stacks Use Compiled Output Convention (RECOMMENDED)

Stacks mirror the compiled output structure exactly:

```
my-stack/
├── stack.yaml
├── skills/
│   ├── frontend-react/
│   │   └── SKILL.md
│   ├── frontend-styling/
│   │   └── SKILL.md
│   └── backend-api/
│       └── SKILL.md
└── agents/
```

**Advantages:**
- Exact match with existing compiled output (`.claude/skills/`)
- Skills can be copied FROM compiled output TO stack (or vice versa)
- No new naming convention to learn
- `compile.ts` unchanged - stacks bypass compilation entirely

**Disadvantages:**
- Less user-friendly IDs (`frontend-react` vs `react`)
- Longer paths

**Integration:**
- Stacks are **post-compilation artifacts**
- When creating a stack, copy from `.claude/skills/{id}/SKILL.md`
- Stack skills don't go through `compile.ts`

### Option 2: Stacks Use Simplified IDs (Proposed in Research)

Stacks use shorter, cleaner IDs:

```
my-stack/
├── stack.yaml
├── skills/
│   ├── react/
│   │   └── SKILL.md
│   ├── styling/
│   │   └── SKILL.md
│   └── testing/
│       └── SKILL.md
```

**Advantages:**
- Cleaner, more intuitive names
- Better UX for stack creators

**Disadvantages:**
- ID mismatch with registry (`frontend/react` vs `react`)
- Potential naming collisions (`backend/testing` vs `frontend/testing` → both `testing`?)
- Requires ID mapping layer

**Integration:**
- Stack needs mapping: `react` → `frontend/react` (in provenance metadata)
- Must handle collisions (multiple skills named `testing`)

### Option 3: Stacks Use Source Convention (Profile-Like)

Stacks mirror the source structure:

```
my-stack/
├── stack.yaml
├── skills/
│   ├── frontend/
│   │   ├── react.md
│   │   └── styling.md
│   └── backend/
│       └── api.md
```

**Advantages:**
- Exact match with profile source structure
- Could potentially use `compile.ts` for stacks

**Disadvantages:**
- `SKILL.md` is Claude Code's expected file name for skills
- Would need to add stack compilation to `compile.ts`
- Adds complexity to the compiler

**Integration:**
- Would need `bun src/compile.ts --stack=my-stack`
- Significant changes to `compile.ts`

---

## Recommendation: Option 1 (Compiled Output Convention)

### Rationale

1. **Zero changes to compile.ts** - Stacks are independent artifacts, not compiled sources
2. **Consistent mental model** - `.claude/skills/` and stack `skills/` use same structure
3. **Easy copy** - Forking a skill = copying a directory
4. **Claude Code compatibility** - `SKILL.md` is the expected file name

### Proposed Stack Structure (Final)

```
my-stack/
├── stack.yaml              # Stack metadata + skill list
├── skills/                 # Forked skills (compiled format)
│   ├── frontend-react/
│   │   └── SKILL.md
│   ├── frontend-styling/
│   │   └── SKILL.md
│   └── frontend-testing/
│       └── SKILL.md
└── agents/                 # Optional: stack-specific agents
    └── developer.md
```

### stack.yaml Format

```yaml
name: yolo-modern-react
version: 1.0.0
description: Modern React with Zustand and React Query
author: '@vincentbollaert'

# Skills are listed by their ID (matches directory name)
skills:
  - frontend-react
  - frontend-styling
  - frontend-testing
  - frontend-client-state
  - frontend-api

# Optional: agents bundled with the stack
agents:
  - developer
```

### Skill File Format (with Provenance)

```yaml
---
name: React
description: Component architecture, hooks, patterns

# PROVENANCE (auto-generated on fork)
forked_from:
  skill: frontend/react       # Original registry ID
  version: 1.2.0              # Version at fork time
  date: 2025-01-09
  registry: marketplace
  original_checksum: sha256:abc123...

# CUSTOMIZATION (auto-updated on edit)
modified: true
modified_date: 2025-01-15
current_checksum: sha256:xyz789...
---

# React Components

> **Quick Guide:** Tiered components...
```

---

## Registry Integration

### Profile Skills vs Stack Skills

| Aspect | Profile Skills | Stack Skills |
|--------|----------------|--------------|
| Defined in | `registry.yaml` | `stack.yaml` |
| Source location | `src/skills/` | `{stack}/skills/` |
| Compilation | Yes (via compile.ts) | No (pre-compiled format) |
| ID format | `category/name` | `category-name` |
| Output location | `.claude/skills/{category-name}/` | Already in final format |

### How Stacks Integrate

1. **Stack is standalone** - Contains all skills it needs, no external dependencies
2. **No registry lookup** - Stack's `stack.yaml` lists skills, directory contains content
3. **Runtime resolution** - Claude Code reads from stack directory directly

### Workflow

```
Creating a Stack from Profile Skills:
1. User selects skills from marketplace (which uses registry IDs)
2. CLI copies from .claude/skills/{id}/SKILL.md to stack/skills/{id}/SKILL.md
3. CLI adds provenance metadata to copied skill
4. Stack is self-contained

Using a Stack:
1. Claude Code reads stack.yaml
2. Loads skills from stack/skills/{id}/SKILL.md
3. No compilation needed
```

---

## Changes Required to compile.ts

### Required Changes: NONE

The existing `compile.ts` handles profile-to-output compilation. Stacks operate at the output level:

```
Profile Source → compile.ts → Compiled Output
                                    ↓
                             Stack Creation
                                    ↓
                           Stack (standalone)
```

### Optional Enhancement: Stack Validation

Could add a `--validate-stack` mode:

```bash
bun src/compile.ts --validate-stack=my-stack
```

This would:
1. Verify `stack.yaml` exists and is valid
2. Verify all listed skills have corresponding `SKILL.md` files
3. Verify provenance metadata is present
4. Report any issues

This is **optional** and could be a separate tool.

---

## ID Naming Convention Clarification

### Registry ID vs Directory Name

| Registry ID | Directory Name | Used By |
|-------------|----------------|---------|
| `frontend/react` | `frontend-react` | compile.ts output, stack skills |
| `backend/api` | `backend-api` | compile.ts output, stack skills |
| `security/security` | `security-security` | compile.ts output, stack skills |

### The Transformation

```typescript
// From compile.ts line 397
const id = skill.id.replace("/", "-");
```

This is the **canonical transformation**. Stacks should use the same convention.

---

## Summary

### Research Questions Answered

1. **Structure mismatch**:
   - Source: `skills/frontend/react.md` (flat files in category dirs)
   - Compiled: `skills/frontend-react/SKILL.md` (directory per skill)
   - **Recommendation**: Stacks use compiled format (`skills/frontend-react/SKILL.md`)

2. **Compilation compatibility**:
   - Stacks **do NOT need compilation** - they contain pre-compiled skills
   - Forked skills are copied from compiled output, not source
   - `compile.ts` remains unchanged

3. **Registry integration**:
   - Stacks are **independent** - no registry lookup at runtime
   - `stack.yaml` lists skill IDs; content is in `skills/` directory
   - Provenance metadata tracks origin for comparison tooling

4. **Compatible structure (least changes)**:
   ```
   my-stack/
   ├── stack.yaml
   ├── skills/
   │   ├── frontend-react/
   │   │   └── SKILL.md
   │   └── frontend-styling/
   │       └── SKILL.md
   └── agents/
   ```

### Path Forward

1. **Stack creation workflow**:
   - Copy from `.claude/skills/{id}/SKILL.md` to `stack/skills/{id}/SKILL.md`
   - Add provenance metadata to copied files
   - Generate `stack.yaml` with skill list

2. **Stack usage workflow**:
   - Claude Code reads `stack.yaml` and loads skills from stack directory
   - No compilation, no registry lookup

3. **Compilation system**:
   - Unchanged for profiles
   - Stacks bypass compilation entirely (already in output format)

---

## Files Analyzed

| File | Purpose |
|------|---------|
| `/home/vince/dev/claude-subagents/src/compile.ts` | Compilation logic |
| `/home/vince/dev/claude-subagents/src/stacks/home-stack/config.yaml` | Stack config example |
| `/home/vince/dev/claude-subagents/src/registry.yaml` | Skill definitions |
| `/home/vince/dev/claude-subagents/src/types.ts` | TypeScript types |
| `/home/vince/dev/claude-subagents/.claude/research/findings/SKILL-FORKING-RESEARCH.md` | Forking proposal |

---

## Appendix: Full Directory Comparison

### Source Skills (28 files)
```
src/skills/
├── frontend/ (8 files)
├── backend/ (10 files)
├── setup/ (7 files)
├── shared/ (1 file)
├── security/ (1 file)
└── research/ (1 file)
```

### Compiled Skills (28 directories)
```
.claude/skills/
├── frontend-react/SKILL.md
├── frontend-styling/SKILL.md
├── frontend-api/SKILL.md
├── frontend-client-state/SKILL.md
├── frontend-accessibility/SKILL.md
├── frontend-performance/SKILL.md
├── frontend-testing/SKILL.md
├── frontend-mocking/SKILL.md
├── backend-api/SKILL.md
├── backend-authentication/SKILL.md
├── backend-database/SKILL.md
├── backend-ci-cd/SKILL.md
├── backend-observability/SKILL.md
├── backend-analytics/SKILL.md
├── backend-feature-flags/SKILL.md
├── backend-email/SKILL.md
├── backend-testing/SKILL.md
├── backend-performance/SKILL.md
├── setup-monorepo/SKILL.md
├── setup-package/SKILL.md
├── setup-env/SKILL.md
├── setup-tooling/SKILL.md
├── setup-posthog/SKILL.md
├── setup-resend/SKILL.md
├── setup-observability/SKILL.md
├── shared-reviewing/SKILL.md
├── security-security/SKILL.md
└── research-methodology/SKILL.md
```

### Proposed Stack (example)
```
my-stack/
├── stack.yaml
├── skills/
│   ├── frontend-react/SKILL.md
│   ├── frontend-styling/SKILL.md
│   ├── frontend-testing/SKILL.md
│   └── frontend-api/SKILL.md
└── agents/
    └── developer.md
```
