# Skill ID Reference Research

> **Generated**: 2026-01-25
> **Purpose**: Comprehensive analysis of how skills are referenced throughout the codebase
> **Goal**: Standardize on frontmatter name as the canonical skill ID everywhere

---

## Executive Summary

The codebase currently uses **THREE different skill ID formats** depending on context:

| Format               | Example                             | Where Used                         |
| -------------------- | ----------------------------------- | ---------------------------------- |
| **Directory Path**   | `frontend/framework/react (@vince)` | Stack configs, internal loaders    |
| **Frontmatter Name** | `frontend/react (@vince)`           | SKILL.md `name` field              |
| **Plugin Name**      | `skill-react`                       | Compiled output, agent frontmatter |

**Key Finding**: 70% of skills have a mismatch between directory path and frontmatter name. The system maintains a `frontmatterToPath` mapping to bridge this gap.

---

## 1. Current ID Formats

### 1.1 Directory Path ID (Currently "Canonical")

**Format**: `{category}/{subcategory}/{skill-name} (@{author})`

**Examples**:

- `frontend/framework/react (@vince)`
- `frontend/client-state-management/zustand (@vince)`
- `backend/api/hono (@vince)`
- `reviewing/reviewing (@vince)`

**Where Used**:

- Stack config files (`src/stacks/*/config.yaml`) - **889 total references**
- Internal data structures (`ExtractedSkillMetadata.id`)
- Matrix loader output
- Skill copier paths

### 1.2 Frontmatter Name

**Format**: `{category}/{slug-name} (@{author})` (flattened)

**Examples**:

- `frontend/react (@vince)` (from `frontend/framework/react (@vince)`)
- `frontend/state-zustand (@vince)` (from `frontend/client-state-management/zustand (@vince)`)
- `backend/api-hono (@vince)` (from `backend/api/hono (@vince)`)

**Where Used**:

- SKILL.md `name` field
- Referenced in `metadata.yaml` relationships
- Legacy references

### 1.3 Plugin Name (Compiled Output)

**Format**: `skill-{kebab-name}`

**Examples**:

- `skill-react`
- `skill-zustand`
- `skill-api-hono`

**Where Used**:

- Compiled agent frontmatter (`skills:` array)
- Plugin manifest (`plugin.json`)
- Claude Code plugin system

---

## 2. Directory Path vs Frontmatter Name Comparison

| Directory Path                                      | Frontmatter Name                         | Match? |
| --------------------------------------------------- | ---------------------------------------- | ------ |
| `frontend/framework/react (@vince)`                 | `frontend/react (@vince)`                | NO     |
| `frontend/client-state-management/zustand (@vince)` | `frontend/state-zustand (@vince)`        | NO     |
| `backend/api/hono (@vince)`                         | `backend/api-hono (@vince)`              | NO     |
| `frontend/styling/scss-modules (@vince)`            | `frontend/styling-scss-modules (@vince)` | NO     |
| `frontend/testing/vitest (@vince)`                  | `frontend/testing-vitest (@vince)`       | NO     |
| `backend/database/drizzle (@vince)`                 | `backend/database-drizzle (@vince)`      | NO     |
| `reviewing/reviewing (@vince)`                      | `reviewing/reviewing (@vince)`           | YES    |
| `security/security (@vince)`                        | `security/security (@vince)`             | YES    |
| `setup/tooling/tooling (@vince)`                    | `setup/tooling (@vince)`                 | YES    |

**Pattern**: The frontmatter name flattens the three-level directory structure into a two-level format by hyphenating the subcategory with the skill name.

---

## 3. Skills Matrix References

### 3.1 skill_aliases Section

Maps short names to full directory path IDs:

```yaml
skill_aliases:
  react: "frontend/framework/react (@vince)"
  zustand: "frontend/client-state-management/zustand (@vince)"
  hono: "backend/api/hono (@vince)"
  reviewing: "reviewing/reviewing (@vince)"
```

### 3.2 Relationships (conflicts, recommends, requires, alternatives)

All use **short alias names only**:

```yaml
conflicts:
  - skills: [react, vue, angular, solidjs]
    reason: "Core framework conflict"

recommends:
  - when: react
    suggest: [zustand, react-query, vitest]

requires:
  - skill: zustand
    needs: [react, react-native]
    needs_any: true
```

### 3.3 suggested_stacks Section

Uses **short names** in nested key:value format:

```yaml
suggested_stacks:
  - id: modern-react
    skills:
      frontend:
        framework: react
        styling: scss-modules
        client-state: zustand
      reviewing:
        reviewing: reviewing
```

---

## 4. Loader & Resolution Pipeline

### 4.1 Key Functions

| Function                      | File                     | Purpose                                 |
| ----------------------------- | ------------------------ | --------------------------------------- |
| `extractAllSkills()`          | matrix-loader.ts:122-201 | Scan directories, extract metadata      |
| `buildFrontmatterToPathMap()` | matrix-loader.ts:220-230 | Map frontmatter names → directory paths |
| `resolveToFullId()`           | matrix-loader.ts:236-251 | Resolve any format → directory path     |
| `buildReverseAliases()`       | matrix-loader.ts:206-214 | Map directory path → short alias        |

### 4.2 Resolution Order in `resolveToFullId()`

```typescript
function resolveToFullId(aliasOrId, aliases, frontmatterToPath) {
  // 1. Check aliases first
  if (aliases[aliasOrId]) return aliases[aliasOrId];

  // 2. Check frontmatter names
  if (frontmatterToPath[aliasOrId]) return frontmatterToPath[aliasOrId];

  // 3. Return as-is (assume it's already a full ID)
  return aliasOrId;
}
```

### 4.3 The `frontmatterToPath` Mapping

Built during matrix loading to handle the mismatch:

```typescript
{
  "frontend/react (@vince)": "frontend/framework/react (@vince)",
  "frontend/state-zustand (@vince)": "frontend/client-state-management/zustand (@vince)",
  "backend/api-hono (@vince)": "backend/api/hono (@vince)"
}
```

---

## 5. Stack Config Format

### 5.1 Top-level skills array

```yaml
# src/stacks/fullstack-react/config.yaml
skills:
  - id: frontend/framework/react (@vince)
  - id: frontend/styling/scss-modules (@vince)
  - id: backend/api/hono (@vince)
  - id: reviewing/reviewing (@vince)
```

### 5.2 Per-agent skill assignments

```yaml
agent_skills:
  frontend-developer:
    framework:
      - id: frontend/framework/react (@vince)
        preloaded: true
    styling:
      - id: frontend/styling/scss-modules (@vince)
        preloaded: true
```

**Total references across all stacks**: ~889

---

## 6. Compiler Transformation

### 6.1 Skill Plugin Compiler

```typescript
// From: frontend/framework/react (@vince)
// To: skill-react

function extractSkillPluginName(skillId: string): string {
  const lastPart = skillId.split("/").pop() || skillId;
  const withoutAuthor = lastPart.replace(/\s*\(@\w+\)$/, "").trim();
  return `skill-${withoutAuthor}`;
}
```

### 6.2 Compiled Agent Frontmatter

```yaml
---
name: backend-developer
skills:
  - skill-api-hono
  - skill-database-drizzle
---
```

---

## 7. Type Definitions

### 7.1 Core Types (src/types.ts)

```typescript
interface SkillAssignment {
  id: string; // Full directory path ID
  preloaded?: boolean;
}

interface SkillFrontmatter {
  name: string; // Kebab-case or "category/name (@author)"
  description: string;
}
```

### 7.2 Matrix Types (src/cli/types-matrix.ts)

```typescript
interface ExtractedSkillMetadata {
  id: string; // Directory path: "frontend/framework/react (@vince)"
  frontmatterName: string; // From SKILL.md: "frontend/react (@vince)"
  name: string; // Display name: "React"
}

interface ResolvedSkill {
  id: string; // Full directory path
  alias?: string; // Short alias from skill_aliases
  name: string; // Display name
}
```

---

## 8. Schema Validation

### 8.1 skill-frontmatter.schema.json

```json
{
  "name": {
    "type": "string",
    "description": "Skill identifier. For Claude Code plugins, use kebab-case. Legacy format 'category/name (@author)' is supported.",
    "examples": ["react", "api-hono", "frontend/react (@vince)"]
  }
}
```

### 8.2 Kebab-case Validation

```typescript
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
```

---

## 9. Files That Would Need Changes

To standardize on frontmatter name as the canonical ID:

### 9.1 Stack Config Files (13 files, ~889 references)

| File                                           | References |
| ---------------------------------------------- | ---------- |
| `src/stacks/fullstack-react/config.yaml`       | 256        |
| `src/stacks/modern-react/config.yaml`          | 84         |
| `src/stacks/enterprise-react/config.yaml`      | 84         |
| `src/stacks/modern-react-tailwind/config.yaml` | 77         |
| `src/stacks/full-observability/config.yaml`    | 63         |
| `src/stacks/remix-stack/config.yaml`           | 60         |
| `src/stacks/nuxt-stack/config.yaml`            | 54         |
| `src/stacks/vue-stack/config.yaml`             | 49         |
| `src/stacks/work-stack/config.yaml`            | 44         |
| `src/stacks/angular-stack/config.yaml`         | 34         |
| `src/stacks/solidjs-stack/config.yaml`         | 34         |
| `src/stacks/mobile-stack/config.yaml`          | 32         |
| `src/stacks/minimal-backend/config.yaml`       | 18         |

### 9.2 Skills Matrix (1 file)

- `src/config/skills-matrix.yaml` - Update `skill_aliases` values

### 9.3 Loader Files (3 files)

- `src/cli/lib/loader.ts` - Change ID extraction logic
- `src/cli/lib/matrix-loader.ts` - Remove/invert `frontmatterToPath` mapping
- `src/cli/lib/matrix-resolver.ts` - Update resolution logic

### 9.4 Compiler Files (3 files)

- `src/cli/lib/skill-plugin-compiler.ts` - Update ID extraction
- `src/cli/lib/stack-plugin-compiler.ts` - Update skill resolution
- `src/cli/lib/skill-copier.ts` - Update path handling

### 9.5 Test Files (6+ files)

- `src/cli/lib/__tests__/skill-plugin-compiler.test.ts`
- `src/cli/lib/__tests__/stack-plugin-compiler.test.ts`
- `src/cli/lib/__tests__/integration.test.ts`
- `src/cli/lib/matrix-resolver.test.ts`
- `src/cli/lib/__tests__/plugin-validator.test.ts`
- `src/cli/lib/loader.test.ts`

---

## 10. Proposed Standardization

### Option A: Frontmatter Name as Canonical (Recommended)

**Format**: `{category}/{slug-name} (@{author})`

**Pros**:

- Cleaner, more concise
- Already used in SKILL.md (source of truth for skill identity)
- Better for user-facing references

**Cons**:

- Requires updating ~889 stack config references
- Directory structure won't match ID

### Option B: Directory Path as Canonical (Current)

**Format**: `{category}/{subcategory}/{skill-name} (@{author})`

**Pros**:

- Already the default throughout configs
- Matches file system structure

**Cons**:

- Verbose
- Requires maintaining `frontmatterToPath` mapping
- Mismatch with SKILL.md frontmatter

---

## 11. Migration Strategy

If choosing Option A (frontmatter name as canonical):

1. **Phase 1**: Update `skill_aliases` in skills-matrix.yaml to use frontmatter names
2. **Phase 2**: Update all stack config files (can use `replace_all`)
3. **Phase 3**: Simplify loader to use frontmatter name directly
4. **Phase 4**: Remove `frontmatterToPath` mapping (no longer needed)
5. **Phase 5**: Update tests
6. **Phase 6**: Update documentation

---

## References

- TODO.md line 163: "Skill ID: use frontmatter name - Currently using directory path as skill ID (workaround)"
- TODO.md note: "The proper fix would be to use `frontmatter.name` as the canonical ID everywhere"
