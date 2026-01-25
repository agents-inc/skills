# Methodology Skills Implementation Spec

> **Created**: 2025-01-25
> **Status**: Ready for Implementation
> **Purpose**: Convert `_principles/` to methodology skills with directory-based loading

---

## Overview

Convert the 7 principle files in `src/agents/_principles/` to proper skills under `src/skills/methodology/`. Enable directory-based skill loading so agents can reference `methodology/universal` to load all skills in that directory.

---

## 1. Directory Structure

### Current Principles Location

```
src/agents/_principles/
├── core-principles.md
├── investigation-requirement.md
├── anti-over-engineering.md
├── success-criteria-template.md
├── write-verification.md
├── improvement-protocol.md
└── context-management.md
```

### Target Skills Structure

```
src/skills/methodology/
├── universal/                              # ALL agents need these
│   ├── core-principles @vince/
│   │   ├── SKILL.md
│   │   └── metadata.yaml
│   ├── investigation-requirements @vince/
│   │   ├── SKILL.md
│   │   └── metadata.yaml
│   ├── anti-over-engineering @vince/
│   │   ├── SKILL.md
│   │   └── metadata.yaml
│   └── success-criteria @vince/
│       ├── SKILL.md
│       └── metadata.yaml
│
├── implementation/                         # Developer, tester agents
│   ├── write-verification @vince/
│   │   ├── SKILL.md
│   │   └── metadata.yaml
│   └── improvement-protocol @vince/
│       ├── SKILL.md
│       └── metadata.yaml
│
└── extended-session/                       # Long-running agents
    └── context-management @vince/
        ├── SKILL.md
        └── metadata.yaml
```

---

## 2. Principle → Skill Mapping

| Current Principle              | New Skill Path                                            | Subcategory      |
| ------------------------------ | --------------------------------------------------------- | ---------------- |
| `core-principles.md`           | `methodology/universal/core-principles @vince`            | universal        |
| `investigation-requirement.md` | `methodology/universal/investigation-requirements @vince` | universal        |
| `anti-over-engineering.md`     | `methodology/universal/anti-over-engineering @vince`      | universal        |
| `success-criteria-template.md` | `methodology/universal/success-criteria @vince`           | universal        |
| `write-verification.md`        | `methodology/implementation/write-verification @vince`    | implementation   |
| `improvement-protocol.md`      | `methodology/implementation/improvement-protocol @vince`  | implementation   |
| `context-management.md`        | `methodology/extended-session/context-management @vince`  | extended-session |

---

## 3. Directory-Based Loading (Simple Approach)

### Config Usage

```yaml
# src/stacks/fullstack-react/config.yaml
agents:
  frontend-developer:
    skills:
      precompiled:
        - methodology/universal # Directory → load ALL children
        - methodology/implementation # Directory → load ALL children
        - frontend/react @vince # Specific skill
      dynamic:
        - frontend/styling-scss-modules @vince

  frontend-researcher:
    skills:
      precompiled:
        - methodology/universal # Directory → load ALL children
        # No implementation skills - researchers don't write code
        - frontend/react @vince
```

### Loader Logic

**File:** `src/cli/lib/loader.ts`
**Function:** `loadSkillsByIds()` (around line 207)

```typescript
export async function loadSkillsByIds(
  skillIds: Array<{ id: string }>,
  projectRoot: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const skillsDir = path.join(projectRoot, DIRS.skills);

  // Build mapping from skill IDs to directory paths
  const idToDirectoryPath = await buildIdToDirectoryPathMap(skillsDir);
  const allSkillIds = Object.keys(idToDirectoryPath);

  // Expand directory references to individual skills
  const expandedSkillIds: string[] = [];

  for (const { id: skillId } of skillIds) {
    // Try as specific skill first
    if (idToDirectoryPath[skillId]) {
      expandedSkillIds.push(skillId);
    } else {
      // Try as directory - find all skills that start with this path
      const childSkills = allSkillIds.filter((id) =>
        id.startsWith(skillId + "/"),
      );

      if (childSkills.length > 0) {
        expandedSkillIds.push(...childSkills);
        // Optional: verbose logging
        // console.log(`Expanded '${skillId}' to: ${childSkills.join(', ')}`);
      } else {
        console.warn(`Warning: Unknown skill reference '${skillId}'`);
      }
    }
  }

  // Deduplicate (in case of overlapping references)
  const uniqueSkillIds = [...new Set(expandedSkillIds)];

  // Load all skills (existing logic continues here)
  for (const skillId of uniqueSkillIds) {
    const directoryPath = idToDirectoryPath[skillId];
    // ... existing load logic ...
  }

  return skills;
}
```

**Key points:**

- No glob patterns or regex needed
- Simple string prefix matching: `id.startsWith(skillId + '/')`
- Backward compatible: specific skill IDs still work unchanged
- Deduplication handles overlapping references

---

## 4. Schema Updates

**File:** `src/schemas/metadata.schema.json`

The `SkillReference` definition should allow both:

1. Specific skill IDs: `frontend/react @vince`
2. Directory paths: `methodology/universal`

Current pattern validation may need relaxation to allow paths without `@author` suffix.

```json
"SkillReference": {
  "type": "string",
  "description": "Reference to a skill ID (e.g., 'frontend/react @vince') or directory path (e.g., 'methodology/universal')",
  "minLength": 1,
  "examples": [
    "frontend/react @vince",
    "methodology/universal",
    "methodology/implementation"
  ]
}
```

---

## 5. SKILL.md Template for Methodology Skills

```markdown
---
name: methodology/universal/core-principles @vince
description: Five universal principles for all AI development work - Investigation First, Follow Existing Patterns, Minimal Changes, Anti-Over-Engineering, Verify Everything.
---

# Core Principles

> **Quick Guide:** Display at start of EVERY response to maintain instruction continuity.

---

<critical_requirements>

## CRITICAL: Apply These to ALL Work

**(Display all 5 core principles at the start of every response)**

</critical_requirements>

---

[Content from original principle file, structured with XML tags]

---

<critical_reminders>

## CRITICAL REMINDERS

**(Display all 5 core principles at the start of every response)**

</critical_reminders>
```

---

## 6. metadata.yaml Template

```yaml
# yaml-language-server: $schema=../../../../schemas/metadata.schema.json
category: shared
author: "@vince"
version: 1
cli_name: Core Principles
cli_description: Foundation principles for all development work
usage_guidance: Use at the start of every task. Display principles at response start.
tags:
  - methodology
  - foundational
  - universal
```

---

## 7. Implementation Order

1. **Create directory structure** - `src/skills/methodology/{universal,implementation,extended-session}/`

2. **Convert one principle as template** - Start with `core-principles` to establish the pattern

3. **Update loader** - Add directory expansion logic to `loadSkillsByIds()`

4. **Update schema** - Allow directory paths in `SkillReference`

5. **Convert remaining principles** - Follow the template for the other 6 principles

6. **Update stack configs** - Change `core_prompts: developer` to `methodology/universal` etc.

7. **Update agent.liquid template** - Remove special handling for `core_prompts` and `ending_prompts`

8. **Test compilation** - Verify agents compile correctly with methodology skills

9. **Delete `_principles/`** - After successful migration

---

## 8. Files to Modify

| File                                 | Change                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `src/cli/lib/loader.ts`              | Add directory expansion in `loadSkillsByIds()`          |
| `src/schemas/metadata.schema.json`   | Update `SkillReference` to allow directory paths        |
| `src/stacks/*/config.yaml`           | Update skill references to use `methodology/`           |
| `src/agents/_templates/agent.liquid` | Remove `core_prompts`/`ending_prompts` special handling |

---

## 9. Benefits

1. **Unified mental model** - Everything is a skill
2. **Fine-grained composition** - Pick exactly which methodology skills each agent needs
3. **Plugin distribution** - Methodology skills become installable plugins
4. **Simpler config** - No separate `core_prompts` and `ending_prompts` concepts
5. **Directory shortcuts** - `methodology/universal` loads all 4 universal skills

---

## 10. Related Files

- Current principles: `src/agents/_principles/`
- Loader: `src/cli/lib/loader.ts`
- Template: `src/agents/_templates/agent.liquid`
- Schema: `src/schemas/metadata.schema.json`
- PROMPT_BIBLE: `src/docs/PROMPT_BIBLE.md` (validates critical_requirements + critical_reminders pattern)
