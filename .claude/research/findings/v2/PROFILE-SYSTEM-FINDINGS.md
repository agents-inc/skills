# Profile System Analysis - Agent #8

**Analysis Date:** 2026-01-08
**Files Analyzed:**

- `/home/vince/dev/claude-subagents/src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`
- `/home/vince/dev/claude-subagents/src/compile.ts`
- `/home/vince/dev/claude-subagents/src/profiles/work/config.yaml`
- `/home/vince/dev/claude-subagents/src/profiles/home/config.yaml`
- `/home/vince/dev/claude-subagents/src/profiles/work/CLAUDE.md`
- `/home/vince/dev/claude-subagents/src/profiles/home/CLAUDE.md`
- `/home/vince/dev/claude-subagents/src/skills.yaml`
- `/home/vince/dev/claude-subagents/src/types.ts`
- `/home/vince/dev/claude-subagents/src/schemas/profile-config.schema.json`
- `/home/vince/dev/claude-subagents/src/templates/agent.liquid`

---

## Overall Assessment

The profile system is **well-designed conceptually** with good separation between shared agent definitions and profile-specific skills. However, there are **significant risks** around profile isolation and visibility that should be addressed.

---

## 1. What Works Well

- **Clean separation:** `agents.yaml` (shared) vs `profiles/*/config.yaml` (profile-specific)
- **Single source of truth:** `skills.yaml` centralizes skill metadata
- **Profile-specific CLAUDE.md:** Provides project context tailored to each profile
- **JSON Schema validation:** `profile-config.schema.json` enforces config structure
- **Compile-time validation:** Catches missing files, invalid skill references, malformed prompts
- **Descriptive npm scripts:** `npm run compile:home`, `npm run compile:work`

---

## 2. Profile Switching Workflow

Current profile switching workflow in `compile.ts`:

```
1. Load agents.yaml (shared agent definitions)
2. Load skills.yaml (shared skill metadata)
3. Load profiles/{profile}/config.yaml (profile-specific config)
4. Resolve agents: merge agent definitions with profile skills/prompts
5. Validate: check all required files exist
6. Clear output: rm -rf .claude/agents .claude/skills .claude/commands
7. Compile agents with profile-specific skills bundled
8. Compile skills to .claude/skills/
9. Copy CLAUDE.md from profile
```

---

## 3. Critical Issues

### Issue #1: Incomplete Output Directory Clearing (HIGH)

**Location:** `compile.ts` line 557

**Problem:** Compiler only clears specific subdirectories:

```typescript
await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills ${OUT}/commands`
```

But `.claude/` also contains directories that persist across profile switches:

- `.claude/orchestrator/` - May contain profile-specific orchestration state
- `.claude/research/` - Research artifacts tied to specific profile context
- `.claude/settings.local.json` - User settings that might be profile-dependent

**Risk:** Cross-contamination between profiles when switching. Orchestration state or research files from one profile are used with another profile's agents.

**Recommendation:** Either:

1. Expand the clear operation to include all profile-dependent directories
2. Or namespace these directories by profile (e.g., `.claude/work/orchestrator/`)

---

### Issue #2: No Active Profile Indicator (HIGH)

**Problem:** After compilation, there is NO way to determine which profile is active:

- No marker file indicating current profile
- No profile metadata in compiled agent frontmatter
- CLAUDE.md content is the only indicator (requires manual inspection)
- Claude has no way to know which tech stack is active

**Example risk scenario:** User compiles work profile, then later runs Claude Code without realizing they switched git branches to a home project. Claude uses work profile agents for home project, giving wrong tech stack guidance (MobX instead of Zustand, Tailwind instead of SCSS).

**Recommendations:**

1. Create `.claude/.profile-state.json`:
   ```json
   {
     "profile": "work",
     "compiledAt": "2024-01-08T10:30:00Z",
     "sourceHashes": {
       "agents.yaml": "abc123",
       "profiles/work/config.yaml": "def456",
       "core-prompts": "ghi789"
     },
     "agentsCompiled": ["frontend-developer", "frontend-reviewer", ...]
   }
   ```
2. Add profile metadata to compiled agent frontmatter:
   ```yaml
   ---
   name: frontend-developer
   profile: work
   profileDescription: Photoroom webapp (MobX, Tailwind)
   compiledAt: 2024-01-08T10:30:00Z
   ---
   ```
3. Add compile verification command: `npm run verify-profile`

---

### Issue #3: skills.yaml vs Profile Skill Files Mismatch (MEDIUM)

**Problem:** `skills.yaml` defines ALL possible skills globally (28 skills), but skill files exist per-profile. The skill registry is shared, but implementations are profile-specific.

```
skills.yaml: frontend/testing -> path: skills/frontend/testing.md
work profile: src/profiles/work/skills/frontend/testing.md  (Karma, Mocha, Chai)
home profile: src/profiles/home/skills/frontend/testing.md  (Vitest, RTL)
```

**Current mitigation:** Compile-time validation checks skill file existence for referenced skills.

**Gap:** No check that all skills in skills.yaml have corresponding files for each profile. A skill could exist in skills.yaml and one profile but not another, without any warning.

**Recommendation:** Add profile-completeness validation that warns if a profile references skills without corresponding files. Consider a "profile skill matrix" showing which skills are implemented per profile.

---

### Issue #4: No Profile Inheritance/Layering (MEDIUM)

**Problem:** Each profile is completely independent. Common patterns must be duplicated:

- Both profiles need `frontend/react.md` skill files (with different content)
- No way to share common skill sections between profiles
- No base profile concept for shared behaviors

**Example of duplication:**

- `work/skills/frontend/accessibility.md` and `home/skills/frontend/accessibility.md` likely share 80% content (WCAG guidelines, ARIA patterns, keyboard navigation)
- Only the state management integration sections differ (MobX vs Zustand)

**Recommendations:**

1. Implement base/override pattern:
   ```
   src/skills-base/        # Shared skill foundations
   src/profiles/{p}/skills/ # Profile-specific overrides
   ```
2. Or use Liquid template inheritance within skill files:
   ```liquid
   {% include "base/accessibility.md" %}
   ## Profile-Specific Section
   ...
   ```

---

## 4. Moderate Issues

### Issue #5: Profile Config Structure Inconsistency (LOW)

The work and home config.yaml files have different structures:

**Work profile** includes explicit `path`, `name`, `description` overrides:

```yaml
- id: frontend/react
  path: skills/frontend/react.md
  name: React
  description: Component architecture, MobX observer, hooks, patterns
  usage: when implementing React components
```

**Home profile** relies on skills.yaml resolution (minimal):

```yaml
- id: frontend/react
  usage: when implementing React components
```

Both are valid per schema (schema allows optional override fields), but the inconsistency is confusing. The work profile's explicit overrides might be intentional profile-specific customization, or might be redundant duplication.

**Note:** As found by Agent #1 (Maintainability), the compiler ignores these overrides anyway - they read from skills.yaml only.

**Recommendation:** Document the convention clearly. If overrides are not implemented, remove redundant properties from work config.

---

### Issue #6: Missing Profile Scaffolding CLI (LOW)

Creating a new profile requires manual steps:

1. Create directory: `src/profiles/{name}/`
2. Create config.yaml (copy and modify from existing)
3. Create CLAUDE.md with project-specific content
4. Create all skill files in `skills/` subdirectory

No CLI command exists to scaffold a new profile.

**Recommendation:** Add `npm run create-profile -- --name=new-project` that:

1. Creates directory structure
2. Copies template config.yaml with placeholders
3. Creates placeholder CLAUDE.md
4. Links to existing skills or creates stubs
5. Validates the new profile compiles successfully

---

### Issue #7: No Profile Drift Detection (LOW)

If agent source files (`agent-sources/`) or core prompts (`core-prompts/`) change, there is no indication that compiled agents are out of date.

**Risk:** User modifies a core prompt, forgets to recompile, and runs Claude Code with stale agents.

**Recommendation:** Store source file hashes in `.profile-state.json` and warn on startup if sources changed since last compile.

---

## 5. Profile Comparison Matrix

| Feature              | Home Profile            | Work Profile         |
| -------------------- | ----------------------- | -------------------- |
| **Agents**           | 15 agents               | 6 agents             |
| **Framework**        | React + TypeScript      | React + TypeScript   |
| **State Management** | Zustand                 | MobX                 |
| **Styling**          | SCSS Modules + cva      | Tailwind + clsx      |
| **Testing**          | Vitest + RTL            | Karma + Mocha + Chai |
| **Mocking**          | MSW                     | Sinon                |
| **Data Fetching**    | React Query             | React Query          |
| **Backend Skills**   | Yes (Hono, Drizzle)     | No                   |
| **Setup Skills**     | Yes (monorepo, tooling) | No                   |
| **Research Skills**  | Yes                     | No                   |

**Observation:** Work profile is narrowly scoped (frontend-only for Photoroom webapp), while home profile is full-stack for personal projects. This is correct but should be explicitly documented in each profile's CLAUDE.md.

---

## 6. Validation Quality Assessment

### Current validations (in `compile.ts`):

- Required agent source files exist (intro.md, workflow.md)
- Profile's CLAUDE.md exists
- Core prompts directory exists
- All referenced prompt files exist
- All precompiled skill paths exist
- Dynamic skills have usage property

### Missing validations:

1. No check that skills.yaml and profile skill files are in sync
2. No validation that agent names in config match agents.yaml (already done - good)
3. No check for orphaned skill files (files that exist but aren't referenced)
4. No validation of skill file structure/content
5. No profile-wide consistency checks
6. No check that profile name matches directory name

---

## 7. Recommendations Summary

| Priority     | Issue                       | Recommendation                                                     | Effort |
| ------------ | --------------------------- | ------------------------------------------------------------------ | ------ |
| **Critical** | No active profile indicator | Create `.profile-state.json` and add profile to frontmatter        | 2h     |
| **High**     | Incomplete output clearing  | Expand rm to include orchestrator/research or namespace by profile | 1h     |
| **Medium**   | Skills mismatch risk        | Add profile-skill completeness validation                          | 2h     |
| **Medium**   | No profile inheritance      | Implement base/override skill pattern                              | 4h     |
| **Low**      | Config inconsistency        | Document or standardize config conventions                         | 1h     |
| **Low**      | No scaffolding CLI          | Add `create-profile` command                                       | 3h     |
| **Low**      | No drift detection          | Add source hash tracking                                           | 2h     |

---

## 8. Code Examples for Key Improvements

### 8.1 Profile state file (`.claude/.profile-state.json`):

```json
{
  "profile": "work",
  "compiledAt": "2024-01-08T10:30:00Z",
  "sourceHashes": {
    "agents.yaml": "abc123",
    "profiles/work/config.yaml": "def456",
    "core-prompts": "ghi789"
  },
  "agentsCompiled": ["frontend-developer", "frontend-reviewer", "tester", "pm", "skill-summoner"]
}
```

### 8.2 Enhanced profile validation (add to compile.ts):

```typescript
// Check all skill references have corresponding files
for (const [skillId, skillDef] of Object.entries(skillsConfig.skills)) {
  const profileSkillPath = `${ROOT}/profiles/${PROFILE}/${skillDef.path}`
  const exists = await Bun.file(profileSkillPath).exists()
  if (!exists) {
    warnings.push(`Skill ${skillId} defined in skills.yaml but no file at ${profileSkillPath} for profile ${PROFILE}`)
  }
}
```

### 8.3 Profile indicator in compiled agents (modify agent.liquid):

```liquid
---
name: {{ agent.name }}
description: {{ agent.description }}
profile: {{ profileName }}
profileDescription: {{ profileDescription }}
compiledAt: {{ compiledAt }}
model: {{ agent.model | default: "opus" }}
tools: {{ agent.tools | join: ", " }}
---
```

### 8.4 Write profile state after compilation (add to compile.ts):

```typescript
async function writeProfileState(profile: string, compiledAgents: string[]): Promise<void> {
  const state = {
    profile,
    compiledAt: new Date().toISOString(),
    agentsCompiled: compiledAgents,
  }
  await Bun.write(`${OUT}/.profile-state.json`, JSON.stringify(state, null, 2))
  console.log(`  ✓ .profile-state.json`)
}
```

---

## Summary

The profile system has a **solid foundation** with clear separation of concerns. The main gaps are around **visibility** (knowing which profile is active) and **isolation** (preventing cross-contamination). The recommended improvements are incremental and don't require architectural changes.

**Key takeaways:**

1. Add profile state tracking (`.profile-state.json`) - this is the most impactful improvement
2. Expand the output clear operation to prevent cross-contamination
3. Consider profile inheritance for DRY skill content
4. Add scaffolding CLI for easier profile creation
