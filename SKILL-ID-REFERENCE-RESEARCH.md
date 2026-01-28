# Skill ID Reference Research

> **Generated**: 2026-01-25
> **Purpose**: Comprehensive analysis of how skills are referenced throughout the codebase
> **Goal**: Standardize on frontmatter name as the canonical skill ID everywhere

---

## Executive Summary

The codebase currently uses **THREE different skill ID formats** depending on context:

| Format               | Example                             | Where Used                                     |
| -------------------- | ----------------------------------- | ---------------------------------------------- |
| **Directory Path**   | `frontend/framework/react (@vince)` | Filesystem paths only (internal)               |
| **Frontmatter Name** | `react (@vince)`                    | SKILL.md `name` field, stack configs, all APIs |
| **Plugin Name**      | `skill-react`                       | Compiled output, agent frontmatter             |

**Key Finding**: 70% of skills have a mismatch between directory path and frontmatter name. The system maintains a `frontmatterToPath` mapping to bridge this gap.

---

## 1. Current ID Formats

### 1.1 Directory Path ID (Internal Only)

**Format**: `{category}/{subcategory}/{skill-name} (@{author})`

**Examples**:

- `frontend/framework/react (@vince)`
- `frontend/client-state-management/zustand (@vince)`
- `backend/api/hono (@vince)`
- `reviewing/reviewing (@vince)`

**Where Used**:

- Filesystem paths only (internal to loaders)
- NOT used in stack configs anymore (migrated to frontmatter names)

### 1.2 Frontmatter Name (Canonical - NOW STANDARD)

**Format**: `{skill-name} (@{author})` (simplified, no category prefix)

**Examples**:

- `react (@vince)` (from directory `frontend/framework/react (@vince)`)
- `zustand (@vince)` (from directory `frontend/client-state-management/zustand (@vince)`)
- `hono (@vince)` (from directory `backend/api/hono (@vince)`)

**Where Used**:

- SKILL.md `name` field (source of truth)
- Stack config files (`src/stacks/*/config.yaml`)
- skill_aliases in skills-matrix.yaml
- All external APIs and references

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

| Directory Path                                      | Frontmatter Name (Canonical) |
| --------------------------------------------------- | ---------------------------- |
| `frontend/framework/react (@vince)`                 | `react (@vince)`             |
| `frontend/client-state-management/zustand (@vince)` | `zustand (@vince)`           |
| `backend/api/hono (@vince)`                         | `hono (@vince)`              |
| `frontend/styling/scss-modules (@vince)`            | `scss-modules (@vince)`      |
| `frontend/testing/vitest (@vince)`                  | `vitest (@vince)`            |
| `backend/database/drizzle (@vince)`                 | `drizzle (@vince)`           |
| `reviewing/reviewing (@vince)`                      | `reviewing (@vince)`         |
| `security/security (@vince)`                        | `security (@vince)`          |
| `setup/tooling/tooling (@vince)`                    | `tooling (@vince)`           |

**Pattern**: The frontmatter name uses just the skill name plus author - no category prefix. Directory paths are internal only.

---

## 3. Skills Matrix References

### 3.1 skill_aliases Section

Maps short names to canonical frontmatter IDs:

```yaml
skill_aliases:
  react: "react (@vince)"
  zustand: "zustand (@vince)"
  hono: "hono (@vince)"
  reviewing: "reviewing (@vince)"
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

### 4.2 Resolution Order in `resolveToCanonicalId()`

```typescript
function resolveToCanonicalId(aliasOrId, aliases, idToDirectoryPath) {
  // 1. Check aliases first - maps to canonical frontmatter names
  if (aliases[aliasOrId]) return aliases[aliasOrId];

  // 2. Check if it's already a canonical ID
  if (idToDirectoryPath[aliasOrId]) return aliasOrId;

  // 3. Return as-is (assume it's already a canonical ID)
  return aliasOrId;
}
```

### 4.3 The `idToDirectoryPath` Mapping

Built during matrix loading to resolve canonical IDs to filesystem paths:

```typescript
{
  "react (@vince)": "frontend/framework/react (@vince)",
  "zustand (@vince)": "frontend/client-state-management/zustand (@vince)",
  "hono (@vince)": "backend/api/hono (@vince)"
}
```

---

## 5. Stack Config Format

### 5.1 Top-level skills array

```yaml
# src/stacks/fullstack-react/config.yaml
skills:
  - id: react (@vince)
  - id: scss-modules (@vince)
  - id: hono (@vince)
  - id: reviewing (@vince)
```

### 5.2 Per-agent skill assignments

```yaml
agent_skills:
  frontend-developer:
    framework:
      - id: react (@vince)
        preloaded: true
    styling:
      - id: scss-modules (@vince)
        preloaded: true
```

**Note**: All stack configs now use simplified frontmatter names.

---

## 6. Compiler Transformation

### 6.1 Skill Plugin Compiler

```typescript
// From: react (@vince)
// To: skill-react

function extractSkillPluginName(skillId: string): string {
  const withoutAuthor = skillId.replace(/\s*\(@\w+\)$/, "").trim();
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
  id: string; // Canonical frontmatter name (e.g., "react (@vince)")
  preloaded?: boolean;
}

interface SkillFrontmatter {
  name: string; // Canonical ID: "skillname (@author)"
  description: string;
}
```

### 7.2 Matrix Types (src/cli/types-matrix.ts)

```typescript
interface ExtractedSkillMetadata {
  id: string; // Canonical frontmatter name: "react (@vince)"
  directoryPath: string; // Filesystem path: "frontend/framework/react (@vince)"
  name: string; // Display name: "React"
}

interface ResolvedSkill {
  id: string; // Canonical frontmatter name
  path: string; // Directory path for filesystem access
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
    "description": "Skill identifier. Use format 'name (@author)' (e.g., 'react (@vince)').",
    "examples": ["react (@vince)", "hono (@vince)", "zustand (@vince)"]
  }
}
```

### 8.2 Kebab-case Validation

```typescript
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
```

---

## 9. Migration Status (COMPLETED)

All files have been migrated to use frontmatter name as canonical ID.

### 9.1 Stack Config Files - MIGRATED

All 13 stack config files now use simplified frontmatter names (e.g., `react (@vince)` instead of `frontend/framework/react (@vince)`).

### 9.2 Skills Matrix - MIGRATED

- `src/config/skills-matrix.yaml` - All `skill_aliases` use frontmatter names

### 9.3 Loader Files - MIGRATED

- `src/cli/lib/loader.ts` - Uses frontmatter name as canonical ID
- `src/cli/lib/matrix-loader.ts` - `buildIdToDirectoryPathMap()` for path resolution
- `src/cli/lib/matrix-resolver.ts` - Updated resolution logic

### 9.4 Compiler Files - MIGRATED

- `src/cli/lib/skill-plugin-compiler.ts` - Works with frontmatter names
- `src/cli/lib/stack-plugin-compiler.ts` - Resolves paths via skill.path
- `src/cli/lib/skill-copier.ts` - Uses skill.path for filesystem

### 9.5 Test Files - MIGRATED

All test files updated to use frontmatter name format.

---

## 10. Current Standard (IMPLEMENTED)

### Frontmatter Name as Canonical

**Format**: `{skill-name} (@{author})` (no category prefix)

**Examples**:

- `react (@vince)`
- `zustand (@vince)`
- `hono (@vince)`
- `drizzle (@vince)`

**Benefits**:

- Simple and clean
- SKILL.md `name` field is the source of truth
- User-friendly for all external references
- Directory paths are internal implementation detail

---

## 11. Migration Completed

All phases complete as of 2026-01-25:

1. **Phase 1**: skill_aliases updated - DONE
2. **Phase 2**: Stack configs updated - DONE
3. **Phase 3**: Loaders updated - DONE
4. **Phase 4**: Mapping inverted to `idToDirectoryPath` - DONE
5. **Phase 5**: Tests updated - DONE
6. **Phase 6**: Documentation updated - DONE

---

## References

- See SKILL-ID-MIGRATION-PROGRESS.md for detailed migration log
