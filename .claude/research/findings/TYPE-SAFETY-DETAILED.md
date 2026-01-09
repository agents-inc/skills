# Type Safety Analysis - Agent #2

**Analysis Date:** 2026-01-08
**Files Analyzed:** types.ts (155 lines), compile.ts (579 lines), 3 JSON schemas, agents.yaml, 2 profile configs

## 1. Current State

### What Exists:

1. **JSON Schemas** (`src/schemas/`) - Well-defined schemas for agents.yaml, profile-config.yaml, and skills.yaml with enum constraints
2. **TypeScript Interfaces** (`types.ts`) - Clean type definitions for all config structures, no `any` types found
3. **IDE Integration** - YAML files use `# yaml-language-server: $schema=...` for editor validation
4. **Partial Runtime Validation** - `validate()` function checks file existence and some properties

### Critical Gap:

```typescript
// compile.ts line 488 - parseYaml returns `any`, no validation!
agentsConfig = parseYaml(await readFile(agentsPath))
// Implicit cast to AgentsConfig - invalid YAML structure passes silently
```

## 2. Issues Found

| Issue                                                      | Severity | Impact                                   |
| ---------------------------------------------------------- | -------- | ---------------------------------------- |
| JSON schemas are IDE-only (not compile-time enforced)      | HIGH     | Typos pass if not editing in IDE         |
| `parseYaml()` returns `any`, implicitly cast to interfaces | HIGH     | Invalid YAML structure silently accepted |
| No enum validation for model/tools/output_format           | HIGH     | Invalid enum values pass compilation     |
| No cross-reference validation until resolution phase       | MEDIUM   | Skill ID typos cause late errors         |
| Schema drift risk (JSON schema vs TypeScript)              | MEDIUM   | Can diverge without detection            |

## 3. Failure Scenarios

### 3.1 Silent YAML Typo:

```yaml
frontend-developer:
  titl: Frontend Developer Agent # TYPO: 'titl' not 'title'
```

- YAML parsing: SUCCESS (valid YAML)
- TypeScript casting: SUCCESS (no runtime check)
- Template: FAILS with cryptic LiquidJS "undefined agent.title" error

### 3.2 Invalid Enum Values:

```yaml
frontend-developer:
  model: gpt4 # INVALID: should be 'opus' | 'sonnet' | 'haiku'
  tools: [Read, Writ] # TYPO: 'Writ' not 'Write'
```

- Passes compilation; only fails when Claude Code tries to use invalid tool

### 3.3 Late Cross-Reference Error:

```yaml
precompiled:
  - id: frontend/reac # TYPO: should be 'frontend/react'
```

- Good error message at resolution, but validation should catch earlier

## 4. Validation Coverage

### What IS Validated (compile.ts `validate()`):

- File existence (CLAUDE.md, intro.md, workflow.md, skill files, prompt files)
- Agent names in profile config exist in agents.yaml
- Dynamic skills have `usage` property
- Precompiled skills have `path` property

### What is NOT Validated:

- YAML structure matches TypeScript interfaces
- Required properties exist (title, description, tools, output_format)
- `model` value is valid enum ('opus' | 'sonnet' | 'haiku')
- `tools` array contains only valid tool names
- `output_format` references existing file
- `core_prompts`/`ending_prompts` contain valid prompt names
- Skill IDs exist in skills.yaml (checked late, at resolution)

## 5. Recommendations

### HIGH PRIORITY - Add Zod Runtime Validation:

```typescript
import { z } from 'zod'

const ToolNameSchema = z.enum([
  'Read',
  'Write',
  'Edit',
  'Grep',
  'Glob',
  'Bash',
  'WebSearch',
  'WebFetch',
  'Task',
  'TaskOutput',
])

const AgentDefinitionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  model: z.enum(['opus', 'sonnet', 'haiku']).default('opus'),
  tools: z.array(ToolNameSchema).min(1),
  output_format: z.string().min(1),
})

const AgentsConfigSchema = z.object({
  agents: z.record(AgentDefinitionSchema),
})

// Usage in compile.ts - safeParse for structured errors
const raw = parseYaml(await readFile(agentsPath))
const result = AgentsConfigSchema.safeParse(raw)
if (!result.success) {
  console.error('Invalid agents.yaml:', result.error.format())
  process.exit(1)
}
```

### MEDIUM PRIORITY - Single Source of Truth:

- Option 1: `json-schema-to-typescript` to generate types.ts from JSON schemas
- Option 2: Zod schemas as source, generate both TypeScript types AND JSON schemas
- Option 3: TypeBox for runtime validation + JSON schema generation

### MEDIUM PRIORITY - Early Cross-Reference Validation:

```typescript
// Add to validate() before resolution phase
for (const [agentName, config] of Object.entries(profileConfig.agents)) {
  for (const skill of [...config.precompiled, ...config.dynamic]) {
    if (!skillsConfig.skills[skill.id]) {
      errors.push(`Unknown skill "${skill.id}" in agent "${agentName}"`)
    }
  }
}
```

## 6. Files Analyzed

| File                         | Lines | Key Observations                                 |
| ---------------------------- | ----- | ------------------------------------------------ |
| `types.ts`                   | 155   | Well-structured interfaces, no `any` types       |
| `compile.ts`                 | 579   | No Zod/runtime validation, parseYaml returns any |
| `agents.schema.json`         | 92    | Good schema with model/tools enums               |
| `profile-config.schema.json` | 143   | Good schema, proper $ref usage                   |
| `skills.schema.json`         | 61    | Path patterns, required fields                   |

## 7. Summary

Type safety infrastructure is **half-built**: JSON schemas exist but only work in IDEs, TypeScript interfaces exist but don't validate at runtime. The `yaml` library's `parseYaml()` returns `any`, and this is implicitly cast to typed interfaces without validation.

Adding Zod would provide:

- Clear, actionable error messages for invalid YAML
- Runtime type safety matching TypeScript interfaces
- Single source of truth (generate JSON schemas from Zod for IDE support)

---

_This analysis was created by Agent #2 (Type Safety) for the Architecture Improvement Research Phase._
