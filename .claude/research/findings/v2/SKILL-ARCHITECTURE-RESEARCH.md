# Skill Architecture Research

> **Purpose**: Shared research file for investigating schema updates and preloaded/dynamic skill implementation.
> **Status**: COMPLETE (Phase 3)
> **Last Updated**: 2026-01-12

---

## Research Questions

### Phase 1 (Original)

1. What schemas exist and what is their current state?
2. How does the current skill loading mechanism work in compile.ts?
3. What is the agent frontmatter/metadata structure?
4. How should preloaded vs dynamic skills work architecturally?

### Phase 2 (User Corrections Applied)

5. What is the official Claude Code skills frontmatter syntax?
6. How does the CLI (not compile.ts) handle skill loading?
7. What are dynamic schema approaches to replace regex patterns?
8. How can the CLI auto-generate/extend schemas?

### Phase 3 (Zero-Tooling Constraint)

9. How to achieve type safety with CLI in separate repository?
10. Can JSON Schema alone provide sufficient validation?
11. What works when embedded in JavaScript (non-TypeScript) projects?
12. Can IDE extensions provide validation without package.json?

---

## Section 1: Schema Analysis

**Researcher**: Schema Agent
**Status**: COMPLETE

### Current Schema Files Found (7 Total)

Located in `/src/schemas/`:

| Schema                       | Purpose                         | Status                                        |
| ---------------------------- | ------------------------------- | --------------------------------------------- |
| `skills.schema.json`         | Validates skill list collection | OUTDATED - path pattern too restrictive       |
| `agents.schema.json`         | Validates agent definitions     | OUTDATED - expects registry-style structure   |
| `registry.schema.json`       | Combined agents + skills        | OUTDATED - replaced by Phase 0A/0B            |
| `profile-config.schema.json` | Profile configuration           | CURRENT - in use with yaml-language-server    |
| `skill.schema.json`          | Individual skill metadata       | DESIGN MISMATCH - conflates identity/metadata |
| `stack.schema.json`          | Stack configurations            | CURRENT - in use with yaml-language-server    |
| `metadata.schema.json`       | Skill metadata (Phase 0B)       | CURRENT - in use with yaml-language-server    |

### Schema Issues Identified

**CRITICAL: No Runtime Validation**

- Schemas provide YAML language server hints only (IDE autocomplete)
- No AJV or similar JSON Schema validator in compile.ts
- TypeScript types in `types.ts` are the actual runtime source of truth

**OUTDATED SCHEMAS (3):**

1. **skills.schema.json**: Pattern `^skills/[a-z][a-z0-9-]*/[a-z][a-z0-9-]*\\.md$` expects files, but actual usage is folders: `skills/{category}/{skill}/`

2. **agents.schema.json**: Expects registry structure `{ agents: { ... } }` but Phase 0A uses co-located `agent-sources/{id}/agent.yaml` files

3. **registry.schema.json**: Obsolete - registry was split into Phase 0A (agents) and Phase 0B (skills)

**MISSING SCHEMAS (2 Critical):**

1. **agent.yaml schema** - No schema for `src/agent-sources/{id}/agent.yaml`
2. **SKILL.md frontmatter schema** - No schema for frontmatter validation

### Recommended Schema Updates

1. **Create**: `agent.schema.json` for co-located agent.yaml files
2. **Create**: `skill-frontmatter.schema.json` for SKILL.md frontmatter
3. **Archive/Delete**: `skills.schema.json`, `agents.schema.json`, `registry.schema.json`
4. **Add**: `preloaded_skills` field to `stack.schema.json` and `profile-config.schema.json`
5. **Consider**: Adding AJV runtime validation in compile.ts

---

## Section 2: CLI Skill Loading (Updated from compile.ts)

**Researcher**: CLI Agent
**Status**: COMPLETE (Phase 2 Update)

> **Note**: Original research focused on `compile.ts`. User correction: The CLI (`src/cli/`) is now the primary entry point. This section has been updated accordingly.

### CLI Architecture Overview

The CLI uses a modular architecture with three main modules:

```
src/cli/
├── index.ts           # Entry point (commander)
├── commands/
│   └── compile.ts     # Compile command
└── lib/
    ├── loader.ts      # Discovery (loadAllSkills, loadAllAgents)
    ├── resolver.ts    # Resolution (getAgentSkills, resolveStackSkills)
    └── compiler.ts    # Compilation (compileAgent, compileAllSkills)
```

### Current Skill Loading Flow (CLI)

```
1. ENTRY: cc compile --profile home (or --stack work-stack)
   └─ src/cli/commands/compile.ts

2. DISCOVERY: loader.ts
   ├─ loadAllSkills() → fast-glob("skills/**/SKILL.md")
   ├─ loadStackSkills() → fast-glob("stacks/{id}/skills/**/SKILL.md")
   └─ loadAllAgents() → fast-glob("agent-sources/*/agent.yaml")

3. PARSING: loader.ts
   └─ parseFrontmatter() with regex: /^---\n([\s\S]*?)\n---/
   └─ Extracts: name, description, model (optional)

4. RESOLUTION: resolver.ts
   ├─ resolveAgents() → orchestrates full resolution
   ├─ getAgentSkills() → cascade: profile → stack → empty
   └─ resolveStackSkills() → per-agent or global skills

5. COMPILATION: compiler.ts
   ├─ compileAgent() → renders template with skills metadata
   └─ compileAllSkills() → copies SKILL.md to .claude/skills/

6. OUTPUT:
   ├─ .claude/agents/{name}.md
   └─ .claude/skills/{skill-id}/SKILL.md
```

### Skill Resolution Cascade (Priority Order)

```typescript
// resolver.ts:141-153
if (profileAgentConfig.skills?.length > 0) {
  return profileAgentConfig.skills // PRIORITY 1: Explicit profile skills
}
if (profileConfig.stack) {
  return resolveStackSkills(stack, agentName, skills) // PRIORITY 2: Stack skills
}
return [] // PRIORITY 3: Empty array
```

**Stack Resolution Details:**

1. Check `stack.agent_skills[agentName]` for per-agent overrides
2. Fall back to `stack.skills` (all skills) if no per-agent assignment
3. Validate skill exists in global registry
4. Create `SkillReference[]` with usage string: `when working with ${skillDef.name.toLowerCase()}`

### Key CLI Functions

| Module      | Function                   | Purpose                                      |
| ----------- | -------------------------- | -------------------------------------------- |
| loader.ts   | `loadAllSkills()`          | Glob + parse skills from filesystem          |
| loader.ts   | `loadStackSkills()`        | Load stack-embedded skills                   |
| resolver.ts | `getAgentSkills()`         | Cascade resolution (profile → stack → empty) |
| resolver.ts | `resolveStackSkills()`     | Convert stack config to SkillReference[]     |
| resolver.ts | `resolveSkillReferences()` | Transform SkillReference[] → Skill[]         |
| compiler.ts | `compileAgent()`           | Render template with CompiledAgentData       |
| compiler.ts | `compileAllSkills()`       | Copy SKILL.md + supporting files             |

### Current Limitations

1. **No Preloaded Skills**: All skills are dynamic (metadata only)
2. **No Skill Content Loading**: `skill.content` field is never populated
3. **No Distinction in Template**: Template doesn't differentiate preloaded vs dynamic
4. **No Frontmatter Skills Field**: Compiled agents don't include `skills` in frontmatter

---

## Section 3: Agent Frontmatter Structure

**Researcher**: Agent Metadata Agent
**Status**: COMPLETE

### Current Agent YAML Structure

**Location**: `src/agent-sources/{agentId}/agent.yaml`

```yaml
id: frontend-developer
title: Frontend Developer Agent
description: Implements frontend features...
model: opus # Optional, defaults to "opus"
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
output_format: output-formats-developer
```

### Current Frontmatter Fields (Compiled Output)

```yaml
---
name: frontend-developer
description: Implements frontend features...
model: opus
tools: Read, Write, Edit, Grep, Glob, Bash
---
```

### Proposed Preloaded Skills Field

**Add to compiled agent frontmatter:**

```yaml
---
name: frontend-developer
description: Implements frontend features...
model: opus
tools: Read, Write, Edit, Grep, Glob, Bash
preloaded_skills:
  - frontend/react (@vince)
  - frontend/styling-scss-modules (@vince)
  - frontend/state-zustand (@vince)
  - frontend/server-state-react-query (@vince)
---
```

**Benefits:**

- Documentation of what's embedded
- Runtime info for Claude Code integration
- Validation that compiled agent matches config intent

---

## Section 4: Preloaded vs Dynamic Architecture

**Researcher**: Architecture Agent
**Status**: COMPLETE

### Current Behavior

- **ALL skills are dynamic** - metadata only, loaded via Skill tool at runtime
- `Skill.content` field exists but is NOT populated
- Comment in types.ts Line 54: `content?: string; // Populated at compile time for precompiled skills`
- Line 141: `skills: Skill[]; // Flat array of all skills (metadata only, no content)`

### Proposed Distinction

| Type          | Definition                              | When to Use                                   |
| ------------- | --------------------------------------- | --------------------------------------------- |
| **Preloaded** | Full content embedded in compiled agent | High-frequency, essential skills (80/20 rule) |
| **Dynamic**   | Metadata only, load via Skill tool      | Specialized, occasional-use skills            |

**Preloaded Skills:**

- Full SKILL.md content embedded in compiled agent markdown
- Listed in agent frontmatter `preloaded_skills` array
- Shown with "EMBEDDED" status in skill activation protocol
- No need to invoke Skill tool

**Dynamic Skills:**

- Only metadata (id, description, usage) in compiled agent
- Must be loaded via `skill: "[skill-id]"` invocation
- Shown in evaluation table requiring YES/NO decision

### Implementation Approach

**1. Stack Configuration (`config.yaml`):**

```yaml
skills:
  - frontend/react (@vince)
  - frontend/styling-scss-modules (@vince)
  # ... all available skills

agent_skills:
  frontend-developer:
    - frontend/react (@vince)
    - frontend/styling-scss-modules (@vince)
    # ... skills for this agent

preloaded_skills: # NEW
  frontend-developer:
    - frontend/react (@vince)
    - frontend/styling-scss-modules (@vince)
    - frontend/state-zustand (@vince)
    - frontend/server-state-react-query (@vince)
```

**2. Profile Override (Optional):**

```yaml
name: work
stack: work-stack

preloaded_skills: # Override stack's preloads
  frontend-developer:
    - frontend/react+mobx (@photoroom)
    - frontend/styling-tailwind (@photoroom)
```

**3. Types Updates:**

```typescript
// types.ts

export interface StackConfig {
  // ... existing
  preloaded_skills?: Record<string, string[]> // NEW
}

export interface CompileAgentConfig {
  // ... existing
  preloaded_skills?: string[] // NEW (optional override)
}

export interface CompiledAgentData {
  // ... existing
  preloadedSkills: Skill[] // NEW (with content)
  dynamicSkills: Skill[] // NEW (metadata only)
}
```

---

## Section 5: Template Integration

**Researcher**: Template Agent
**Status**: COMPLETE

### Current agent.liquid Template

**Key Sections (in order):**

1. Lines 1-6: Frontmatter (name, description, model, tools)
2. Lines 8: Title
3. Lines 10-12: Role section (`{{ intro }}`)
4. Lines 16-28: `<preloaded_content>` - lists prompt names only
5. Lines 32-39: `<critical_requirements>`
6. Lines 40-93: `<skill_activation_protocol>` - ALL skills listed dynamically
7. Line 97: `{{ corePromptsContent }}`
8. Line 101: `{{ workflow }}`
9. Line 111: `{{ examples }}`
10. Line 115: `{{ outputFormat }}`
11. Line 119: `{{ endingPromptsContent }}`
12. Lines 123-125: `<critical_reminders>`

### Changes Needed for Preloaded Skills

**1. Update Frontmatter (Lines 1-6):**

```liquid
---
name: {{ agent.name }}
description: {{ agent.description }}
model: {{ agent.model | default: "opus" }}
tools: {{ agent.tools | join: ", " }}
preloaded_skills:
{% for skill in preloadedSkills %}
  - {{ skill.id }}
{% endfor %}
---
```

**2. Update `<preloaded_content>` (Lines 16-28):**

```liquid
<preloaded_content>
**IMPORTANT: The following content is already in your context.**

**Preloaded Skills (full content embedded):**
{% for skill in preloadedSkills %}
- {{ skill.id }} [EMBEDDED]
{% endfor %}

**Core Prompts (loaded at beginning):**
{% for prompt in corePromptNames %}
- {{ prompt }}
{% endfor %}

**Dynamic Skills (load via Skill tool as needed):**
{% for skill in dynamicSkills %}
- {{ skill.id }}
{% endfor %}

**Ending Prompts (loaded at end):**
{% for prompt in endingPromptNames %}
- {{ prompt }}
{% endfor %}
</preloaded_content>
```

**3. Update `<skill_activation_protocol>` (Lines 40-93):**

```liquid
<skill_activation_protocol>
## Skill Activation Protocol

### Preloaded Skills (Already In Context)

| Skill | Status |
|-------|--------|
{% for skill in preloadedSkills %}
| {{ skill.id }} | [EMBEDDED] |
{% endfor %}

### Dynamic Skills (Evaluate Below)

| Skill | Relevant? | Reason |
|-------|-----------|--------|
{% for skill in dynamicSkills %}
| {{ skill.id }} | YES / NO | ... |
{% endfor %}

For any skill marked YES, invoke:
```

skill: "[skill-id]"

```
</skill_activation_protocol>
```

**4. Add `<preloaded_skills_content>` Section (NEW - After critical_requirements):**

```liquid
{% if preloadedSkills.size > 0 %}
<preloaded_skills_content>
## Preloaded Skills Reference

{% for skill in preloadedSkills %}
---

## {{ skill.name }}

{{ skill.content }}

{% endfor %}
</preloaded_skills_content>
{% endif %}
```

---

## Section 6: Dynamic Schema Approaches

**Researcher**: Schema Approaches Agent
**Status**: COMPLETE (Phase 2)

### Problem Statement

Current schemas use regex patterns that:

- Validate FORMAT only, not EXISTENCE of skills/agents
- Require manual updates when new skills are added
- Provide no TypeScript type safety

**Example of Current Limitation:**

```json
{
  "SkillId": {
    "type": "string",
    "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*/[a-z][a-z0-9]*(-[a-z0-9]+)*$"
    // Allows any format-matching string, even if skill doesn't exist
  }
}
```

### JSON Schema Native Limitations

JSON Schema (draft 7) does **not** support dynamic enums natively:

- No enum values fetched from external sources
- No runtime population of enum lists
- No conditional enum population

### IDE vs Runtime Validation Distinction

| Aspect      | IDE-Time (yaml-language-server) | Runtime (CLI)        |
| ----------- | ------------------------------- | -------------------- |
| Schema Type | Static JSON files               | TypeScript code      |
| Capability  | Autocomplete, hover docs        | Filesystem discovery |
| Enum Values | Must be pre-calculated          | Can glob directories |
| Execution   | Read-only                       | Full code execution  |

### Recommended Approach: TypeScript-First Build-Time Generation

**Three-Tier Architecture:**

```
Tier 1: TypeScript Constants (autogenerated)
├── src/constants/generated/skills.ts
└── Single source of truth from filesystem discovery

Tier 2: Zod Runtime Validation
├── src/schemas/zod/skills.ts
└── Runtime validation using z.enum()

Tier 3: JSON Schema for IDE
├── src/schemas/generated/skills.enum.json
└── Generated via zod-to-json-schema
```

**Example Implementation:**

```typescript
// Tier 1: src/constants/generated/skills.ts (autogenerated)
export const ALL_SKILL_IDS = [
  'frontend/react (@vince)',
  'frontend/styling-scss-modules (@vince)',
  'backend/api-hono (@vince)',
] as const
export type SkillId = (typeof ALL_SKILL_IDS)[number]

// Tier 2: src/schemas/zod/skills.ts
import { z } from 'zod'
import { ALL_SKILL_IDS } from '../constants/generated/skills'
export const skillIdSchema = z.enum(ALL_SKILL_IDS)

// Tier 3: JSON Schema (generated via zod-to-json-schema)
// { "type": "string", "enum": ["frontend/react (@vince)", ...] }
```

### Tools for Schema Generation

| Tool                       | Purpose                        |
| -------------------------- | ------------------------------ |
| `ts-json-schema-generator` | TypeScript types → JSON Schema |
| `zod-to-json-schema`       | Zod schemas → JSON Schema      |
| `ts-to-zod`                | TypeScript types → Zod schemas |

### Benefits vs Current Approach

| Aspect           | Before (Regex)       | After (Dynamic Enum)     |
| ---------------- | -------------------- | ------------------------ |
| IDE Autocomplete | Format hints only    | All valid values listed  |
| Validation       | Format-only          | Validates existence      |
| Adding New Skill | Manual schema update | Automatic                |
| Type Safety      | Manual unions        | Generated from constants |

---

## Section 7: CLI Schema Auto-Generation

**Researcher**: CLI Auto-Schema Agent
**Status**: COMPLETE (Phase 2)

### Proposed CLI Command: `cc sync-schemas`

```bash
cc sync-schemas          # Regenerate schemas from filesystem
cc sync-schemas --check  # Check if schemas are stale (for CI)
cc sync-schemas --watch  # Watch mode for development
```

### When to Regenerate (Smart Triggers)

| Command           | Regenerate? | Reason              |
| ----------------- | ----------- | ------------------- |
| `cc create skill` | Yes         | Skills changed      |
| `cc create agent` | Yes         | Agents changed      |
| `cc create stack` | Yes         | Stacks changed      |
| `cc compile`      | No          | Read-only operation |
| `cc list`         | No          | Read-only operation |

### Implementation Architecture

**New Files:**

```
src/cli/
├── lib/
│   └── schema-generator.ts  # Core generation logic
└── commands/
    └── sync-schemas.ts      # CLI command
```

**Core Functions:**

```typescript
// src/cli/lib/schema-generator.ts
export async function discoverSkillIds(projectRoot: string): Promise<string[]>
export async function discoverAgentIds(projectRoot: string): Promise<string[]>
export async function discoverStackIds(projectRoot: string): Promise<string[]>
export async function generateTypesFile(options: SchemaGeneratorOptions): Promise<void>
export async function regenerateSchemas(options: SchemaGeneratorOptions): Promise<void>
```

### Cache Invalidation for YAML Language Server

**Challenge:** yaml-language-server caches schemas; changes don't auto-reload.

**Solution:** Touch schema files after generation to trigger reload:

```typescript
async function notifyYamlLanguageServer(projectRoot: string): Promise<void> {
  const schemaDir = path.join(projectRoot, 'src', 'schemas')
  const now = new Date()
  for (const file of await glob('*.schema.json', schemaDir)) {
    await fs.utimes(path.join(schemaDir, file), now, now)
  }
}
```

### Pre-Commit Hook Safety

```bash
# .husky/pre-commit
if ! bun cc sync-schemas --check; then
  echo "Schemas are stale. Run 'cc sync-schemas' and commit."
  exit 1
fi
```

### Generated File Structure

```
src/
├── constants/
│   └── generated/        ← GITIGNORE
│       └── schemas.ts    # TypeScript unions
│
├── schemas/
│   ├── generated/        ← GITIGNORE
│   │   ├── skills.enum.json
│   │   ├── agents.enum.json
│   │   └── stacks.enum.json
│   │
│   ├── profile-config.schema.json  # Uses $ref to generated
│   └── stack.schema.json           # Uses $ref to generated
```

---

## Section 8: Official Claude Code Skills Syntax

**Researcher**: Frontmatter Agent
**Status**: COMPLETE (Phase 2)

### Official Skills Frontmatter Format

According to official Claude Code documentation, skills in agent frontmatter use a **comma-separated string**:

```yaml
---
name: code-reviewer
description: Review code for quality
skills: pr-review, security-check
---
```

### Key Characteristics

- **Format**: Comma-separated string (not YAML array)
- **Skill IDs**: Match directory names in `.claude/skills/`
- **Flat list**: No nested structure

### Resolution Path

Claude Code searches for skills in this priority order:

```
1. Enterprise (org-wide)
2. Personal (~/.claude/skills/)
3. Project (.claude/skills/)
4. Plugins/Marketplace
```

### Gap: Current Implementation

| Aspect          | Official Claude Code           | This Codebase           |
| --------------- | ------------------------------ | ----------------------- |
| Syntax          | `skills: skill-one, skill-two` | YAML config files       |
| Location        | Agent frontmatter              | Stack/profile config    |
| Format          | Comma-separated string         | SkillReference[] arrays |
| Compiled Output | Has `skills` field             | Missing `skills` field  |

### Recommended Fix

Update `agent.liquid` template to output skills in frontmatter:

```liquid
---
name: {{ agent.name }}
description: {{ agent.description }}
model: {{ agent.model | default: "opus" }}
tools: {{ agent.tools | join: ", " }}
skills: {{ preloadedSkills | map: "id" | join: ", " }}
---
```

---

## Section 9: Zero-Tooling Type Safety

**Researcher**: Multiple Agents (Phase 3)
**Status**: COMPLETE

### User Constraints Defined

The user specified strict constraints for this repository:

1. **CLI moves to SEPARATE repository** - run via `npx` or similar
2. **This repo should be deliberately thin** - only text files (markdown, yaml, json schemas)
3. **NO bundling, NO build steps, NO scripting** in this repo
4. **NO Zod, NO TypeScript compiler, NO npm packages** in this repo
5. **Must work when embedded in JavaScript (non-TypeScript) projects**
6. **yaml-language-server + .vscode/settings.json** as only validation mechanism
7. **CLI repo can have any tooling** - the constraint is on the consumer repo

### Key Finding: Zero-Tooling IS Already Working

**Type safety without local tooling IS FULLY POSSIBLE AND ALREADY IMPLEMENTED.**

The current repository demonstrates a working zero-dependency type safety system:

1. **JSON Schemas** (7 files in `src/schemas/`)
2. **YAML Editor Validation** (via VSCode + yaml-language-server extension)
3. **IDE Directives** (`# yaml-language-server: $schema=...`)
4. **Documentation** (Embedded in schema descriptions)

**Evidence:** No `package.json` entry for yaml-language-server. No `.vscode/settings.json` configuration needed. Schemas just use relative paths from YAML files.

### Validation Coverage Analysis

| Validation Type                       | IDE Coverage | Notes                          |
| ------------------------------------- | ------------ | ------------------------------ |
| Type checking (string/number/boolean) | ✓ 100%       | Works via JSON Schema          |
| Enum validation                       | ✓ 100%       | Works via JSON Schema          |
| Pattern validation (regex)            | ✓ 100%       | Works via JSON Schema          |
| Required fields                       | ✓ 100%       | Works via JSON Schema          |
| Array structure & uniqueness          | ✓ 100%       | Works via JSON Schema          |
| Nested objects ($ref)                 | ✓ 100%       | Works via JSON Schema          |
| Autocomplete                          | ✓ 100%       | Works via yaml-language-server |
| Hover documentation                   | ✓ 100%       | Works via schema descriptions  |
| **Cross-file references**             | ✗ 0%         | **Requires runtime code**      |
| **File existence**                    | ✗ 0%         | **Requires filesystem access** |
| **Circular dependencies**             | ✗ 0%         | **Requires graph analysis**    |

**Summary:** JSON Schema provides ~70% validation coverage (structure, types, constraints). The remaining ~30% (semantic validation) requires runtime code.

### JSON Schema Sufficiency Analysis

**JSON Schema alone is NOT sufficient** for complete type safety.

#### What JSON Schema CAN Validate (70%)

```yaml
✓ Type checking (string/number/boolean/array/object)
✓ Enum validation (model: opus | sonnet | haiku)
✓ Pattern matching (author must match @username format)
✓ Required fields (title, description must be present)
✓ Min/max constraints (minLength, minItems)
✓ Object structure (additionalProperties: false)
✓ Array uniqueness (uniqueItems: true)
✓ Nested structure validation ($ref references)
```

#### What JSON Schema CANNOT Validate (30%)

```
✗ Cross-file references (skill IDs must exist in registry)
✗ Circular dependencies (A requires B, B conflicts_with A)
✗ Contextual rules (if model='haiku' then tools array size < 5)
✗ Directory structure (SKILL.md file must exist for skill reference)
✗ Semantic constraints (version numbers follow semver in practice)
```

### IDE Validation Without package.json

**CONFIRMED: package.json is irrelevant for IDE schema validation.**

How yaml-language-server loads schemas:

1. **Parses YAML comment directive:**

   ```yaml
   # yaml-language-server: $schema=../../schemas/stack.schema.json
   ```

2. **Resolves relative path** from YAML file location

3. **Loads JSON schema file** (plain file read, no package.json needed)

4. **Validates YAML against schema** (internal AJV or equivalent)

5. **Provides IDE hints** (autocomplete, errors, hover docs)

**Proof:** Clone this repo, skip `npm install`, open any `metadata.yaml` file - IDE validation works immediately.

### JavaScript Project Embedding

**When embedded in JavaScript (non-TypeScript) project:**

- YAML files: **Full validation** via yaml-language-server
- JavaScript code consuming YAML: **No validation** (returns `any` equivalent)

**Mitigation strategies:**

1. **CLI validation (recommended):** Run `cc compile --validate-only` in JS project
2. **JSDoc stubs:** Generate `.d.ts` from JSON Schema for IDE hints
3. **Runtime validation:** Consumer project adds Zod/Ajv (but this adds tooling to consumer)

### Recommended Two-Repository Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  THIS REPO (Zero-Tooling, Text Files Only)                  │
├─────────────────────────────────────────────────────────────┤
│  src/schemas/*.json       ← JSON Schemas (IDE validation)   │
│  src/stacks/*/config.yaml ← Config with schema directives   │
│  src/skills/*/*/SKILL.md  ← Skill content                   │
│  .vscode/extensions.json  ← OPTIONAL: recommend YAML ext    │
│                                                             │
│  NO: package.json, node_modules, TypeScript, Zod, build     │
└─────────────────────────────────────────────────────────────┘
           │
           │ npx cc compile / npx cc validate
           ▼
┌─────────────────────────────────────────────────────────────┐
│  CLI REPO (Can Have Any Tooling)                            │
├─────────────────────────────────────────────────────────────┤
│  Full TypeScript codebase                                   │
│  Zod for runtime validation                                 │
│  Cross-file reference checking                              │
│  File existence validation                                  │
│  Circular dependency detection                              │
│  Schema generation (optional: cc sync-schemas)              │
└─────────────────────────────────────────────────────────────┘
```

### CLI-Generated Schemas Pattern

Industry examples using this pattern:

| Tool                | Generated Output            | Consumer Tooling Required |
| ------------------- | --------------------------- | ------------------------- |
| **Prisma**          | `.prisma/client/index.d.ts` | None (just imports)       |
| **GraphQL Codegen** | `types.generated.ts`        | None (just imports)       |
| **PostHog**         | Feature flag types          | None                      |
| **tRPC**            | Shared types                | None                      |

**Applicable pattern:** CLI generates schemas/types into consumer repo. Consumer has zero tooling requirements.

```bash
# In consumer project (this repo)
npx cc sync-schemas  # CLI generates src/schemas/generated/*.json
```

The generated schemas provide IDE autocomplete. The CLI provides runtime validation.

### Trade-off Summary

| Approach                        | IDE Coverage | Runtime Safety | Tooling in This Repo |
| ------------------------------- | ------------ | -------------- | -------------------- |
| **JSON Schema only**            | 70%          | 0%             | Zero ✓               |
| **Schema + CLI validation**     | 70%          | 100%           | Zero ✓               |
| **Schema + Zod in this repo**   | 70%          | 100%           | Requires npm ✗       |
| **TypeScript + Zod everywhere** | 100%         | 100%           | Requires npm ✗       |

**Recommendation:** JSON Schema only + CLI validation (second row)

### What This Repo Should Contain

**Keep:**

- `src/schemas/*.json` - JSON Schemas for IDE validation
- YAML config files with `# yaml-language-server:` directives
- Markdown files (skills, agents, docs)

**Optional (quality of life):**

- `.vscode/extensions.json` - Recommends YAML extension to contributors
- `README.md` - Documents schema usage

**Remove/Move to CLI repo:**

- Any `.ts` files requiring compilation
- Any `package.json` or `node_modules`
- Any build scripts or tooling

### Remaining Gap: Markdown Frontmatter Validation

**Issue:** YAML language server validates `.yaml` files but NOT markdown frontmatter.

**Current state:** `SKILL.md` frontmatter is NOT validated by IDE.

**Potential solutions:**

1. **CLI validation only** - Accept that frontmatter is validated at compile time
2. **VSCode extension** - Custom extension for markdown frontmatter (adds tooling)
3. **Frontmatter in separate YAML** - Co-locate `metadata.yaml` next to `SKILL.md`

**Recommendation:** Keep current approach (CLI validates frontmatter at compile time). The "zero-tooling" constraint means accepting this limitation.

---

## Consolidated Findings (Updated)

### Summary

**Phase 1 Findings:**

1. **Schema State**: 3 schemas current, 3 outdated, 2 missing. No runtime validation.
2. **Skill Loading**: Skills discovered via Glob, metadata only passed to template.
3. **Agent Frontmatter**: Missing `skills` field in compiled output.
4. **Architecture**: Need preloaded vs dynamic skill distinction.
5. **Template**: Need frontmatter + content sections for preloaded skills.

**Phase 2 Findings (User Corrections Applied):** 6. **CLI is Primary**: `src/cli/` is the entry point, not `compile.ts`. 7. **Official Syntax**: Skills use comma-separated string: `skills: skill-one, skill-two` 8. **Dynamic Schemas**: Use TypeScript-first build-time generation (no regex patterns). 9. **Auto-Generation**: CLI `cc sync-schemas` command for automatic schema updates.

**Phase 3 Findings (Zero-Tooling Constraint):** 10. **Zero-Tooling Works**: Current JSON Schema + yaml-language-server provides ~70% validation without any npm dependencies. 11. **JSON Schema Limitations**: Cannot validate cross-file references, file existence, or circular dependencies (requires CLI). 12. **Two-Repo Architecture**: This repo stays "deliberately thin" (text only); CLI repo handles runtime validation. 13. **IDE Independence**: yaml-language-server works without package.json - uses per-file directives. 14. **Markdown Gap**: Frontmatter in `.md` files is NOT validated by IDE (CLI validates at compile time).

### Updated Implementation Plan (Two-Repo Architecture)

> **Note:** The following plan assumes CLI will be moved to a separate repository. This repo becomes "deliberately thin" with only text files.

**Phase A: Prepare This Repo for Zero-Tooling**

1. Keep JSON Schemas in `src/schemas/` (IDE validation)
2. Keep YAML config files with schema directives
3. Keep Markdown files (skills, agents, docs)
4. Add `.vscode/extensions.json` recommending YAML extension (optional)
5. Archive outdated schemas: `skills.schema.json`, `agents.schema.json`, `registry.schema.json`

**Phase B: CLI Repository Setup**

1. Create separate CLI repository (e.g., `claude-subagents-cli`)
2. Move all TypeScript code (`src/cli/`, `src/types.ts`, etc.)
3. Add Zod for runtime validation
4. Implement cross-file reference checking
5. Implement file existence validation
6. Publish as npm package for `npx` usage

**Phase C: CLI Schema Generation (Optional)**

1. Create `cc sync-schemas` command in CLI repo
2. Generate JSON Schema enums from filesystem discovery
3. CLI writes generated schemas into consumer repo (this repo)
4. Pattern: Prisma/GraphQL codegen approach

**Phase D: Frontmatter Skills Field**

1. Update `agent.liquid` template in CLI repo to output `skills` field
2. Use comma-separated format per official Claude Code syntax
3. CLI validates frontmatter at compile time

**Phase E: Preloaded Skills Content**

1. Add `preloaded_skills` to StackConfig and CompileAgentConfig
2. Update CLI resolver to partition skills (preloaded vs dynamic)
3. Update template with preloaded_skills_content section

### File Distribution (Two Repos)

**This Repo (Zero-Tooling, Text Only):**

```
claude-subagents/
├── src/
│   ├── schemas/          ← JSON Schemas (IDE validation)
│   │   ├── stack.schema.json
│   │   ├── metadata.schema.json
│   │   ├── profile-config.schema.json
│   │   └── generated/    ← CLI-generated enums (optional)
│   ├── stacks/           ← YAML configs with directives
│   ├── skills/           ← SKILL.md files
│   └── agent-sources/    ← Agent YAML configs
├── .vscode/
│   └── extensions.json   ← Recommends YAML extension
└── README.md
```

**CLI Repo (Full Tooling):**

```
claude-subagents-cli/
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── compile.ts
│   │   │   ├── sync-schemas.ts  ← Generates into consumer repo
│   │   │   └── validate.ts
│   │   └── lib/
│   │       ├── loader.ts
│   │       ├── resolver.ts
│   │       ├── compiler.ts
│   │       └── schema-generator.ts
│   ├── types.ts
│   └── schemas/
│       └── zod/          ← Zod schemas for runtime validation
├── package.json
└── tsconfig.json
```

**Files to Archive (This Repo):**

- `src/schemas/skills.schema.json` (outdated)
- `src/schemas/agents.schema.json` (outdated)
- `src/schemas/registry.schema.json` (obsolete)

### Key Architectural Decisions

1. **Two-Repo Split**: This repo stays "deliberately thin" (text only); CLI repo handles all tooling
2. **JSON Schema for IDE**: Provides ~70% validation coverage without npm dependencies
3. **CLI for Runtime**: Handles remaining ~30% (cross-file refs, file existence, circular deps)
4. **Official Syntax Compliance**: Use comma-separated `skills` field in frontmatter
5. **CLI-Generated Schemas**: Optional `cc sync-schemas` generates enums into consumer repo
6. **Accept Markdown Gap**: Frontmatter in `.md` files validated at compile time, not IDE

### Validation Responsibility Matrix

| Validation Type      | This Repo (IDE) | CLI Repo           |
| -------------------- | --------------- | ------------------ |
| YAML structure       | ✓ JSON Schema   | ✓ Zod              |
| Type checking        | ✓ JSON Schema   | ✓ Zod              |
| Enum constraints     | ✓ JSON Schema   | ✓ Zod              |
| Pattern matching     | ✓ JSON Schema   | ✓ Zod              |
| Cross-file refs      | ✗               | ✓ Custom code      |
| File existence       | ✗               | ✓ fs.exists        |
| Circular deps        | ✗               | ✓ Graph analysis   |
| Markdown frontmatter | ✗               | ✓ Parse + validate |

---

_Phase 1 Research completed: 2026-01-12_
_Phase 2 Research completed: 2026-01-12_
_Phase 3 Research completed: 2026-01-12_
