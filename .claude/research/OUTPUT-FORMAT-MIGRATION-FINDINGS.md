# Output Format Migration Research Findings

> **Generated**: 2026-01-22
> **Purpose**: Research moving output format files from src/agent-outputs/ into agent source categories
> **Status**: ✅ Research Complete - Ready for Decision

---

## Overview

Move output format files from `src/agent-outputs/` into respective category directories:

```
Current:
src/agent-outputs/
├── output-formats-developer.md
├── output-formats-researcher.md
├── output-formats-reviewer.md
├── output-formats-tester.md
├── output-formats-pm.md
├── output-formats-critique.md
├── output-formats-documentor.md
└── output-formats-orchestrator.md

Target:
src/agent-sources/{category}/output-format.md
```

---

## Research Agent Assignments

| Agent | Area                                       | Status      |
| ----- | ------------------------------------------ | ----------- |
| 1     | Current output format references in code   | ✅ Complete |
| 2     | Compiler output format injection logic     | ✅ Complete |
| 3     | Agent-to-format mapping and shared formats | ✅ Complete |
| 4     | Path resolution changes required           | ✅ Complete |

---

## Agent 1: Output Format Code References - Findings

### Constants Defining Output Format Directory

**File: `src/cli/consts.ts`**

- **Line 36:** `agentOutputs: "src/agent-outputs",`

**File: `src/cli/lib/loader.ts`**

- **Line 46:** `agentOutputs: "src/agent-outputs",` (duplicated in getDirs() for user mode)

### Path Construction Logic

**File: `src/cli/lib/compiler.ts`**

- **Lines 82-86:** Critical path construction

```typescript
const outputFormat = await readFileOptional(
  path.join(projectRoot, DIRS.agentOutputs, `${agent.output_format}.md`),
  "",
);
```

Pattern: `{projectRoot}/src/agent-outputs/{output_format}.md`

### Type Definitions

**File: `src/types.ts`**

- **Line 82:** `output_format: string` (in AgentDefinition)
- **Line 136:** `output_format: string` (in AgentConfig)
- **Line 150:** `outputFormat: string` (in CompiledAgentData)

### Schema Definition

**File: `src/schemas/agent.schema.json`**

- **Lines 54-59:** Defines `output_format` as required field
- **Note:** Description says "core-prompts/{value}.md" but should be "agent-outputs/{value}.md" (documentation bug)

### Agent.yaml Files

All 15 agent.yaml files specify `output_format`:

| Agent                          | Output Format               |
| ------------------------------ | --------------------------- |
| developer/backend-developer    | output-formats-developer    |
| developer/frontend-developer   | output-formats-developer    |
| researcher/backend-researcher  | output-formats-researcher   |
| researcher/frontend-researcher | output-formats-researcher   |
| reviewer/backend-reviewer      | output-formats-reviewer     |
| reviewer/frontend-reviewer     | output-formats-reviewer     |
| planning/pm                    | output-formats-pm           |
| planning/orchestrator          | output-formats-orchestrator |
| developer/architecture         | output-formats-developer    |
| pattern/pattern-scout          | output-formats-developer    |
| pattern/pattern-critique       | output-formats-critique     |
| meta/agent-summoner            | output-formats-developer    |
| meta/skill-summoner            | output-formats-developer    |
| meta/documentor                | output-formats-documentor   |
| tester/tester-agent            | output-formats-tester       |

---

## Agent 2: Compiler Injection Logic - Findings

### Compilation Flow

1. **Load agent config** with `output_format` field
2. **Construct path** using `DIRS.agentOutputs` + `agent.output_format`
3. **Read file content** (or empty string if missing)
4. **Pass to template** as `outputFormat` string
5. **Inject via Liquid** at line 122 of agent.liquid

### Key Files

**`src/cli/lib/compiler.ts`:**

- Lines 82-86: Path construction
- Line 124: Pass `outputFormat` to template data

**`src/templates/agent.liquid`:**

- Line 122: `{{ outputFormat }}` injection point

### Template Data Structure

```typescript
interface CompiledAgentData {
  outputFormat: string; // Content (not path)
  // ...
}
```

---

## Agent 3: Agent-to-Format Mapping - Findings

### Output Format Usage by Category

| Category   | Formats Used                                | Homogeneous? |
| ---------- | ------------------------------------------- | ------------ |
| developer  | output-formats-developer (3 agents)         | ✅ Yes       |
| researcher | output-formats-researcher (2 agents)        | ✅ Yes       |
| reviewer   | output-formats-reviewer (2 agents)          | ✅ Yes       |
| tester     | output-formats-tester (1 agent)             | ✅ Yes       |
| planning   | 2 different formats (pm, orchestrator)      | ❌ No        |
| pattern    | 2 different formats (developer, critique)   | ❌ No        |
| meta       | 2 different formats (developer, documentor) | ❌ No        |

### The Shared Format Problem

**`output-formats-developer.md` is used by 6 agents across 3 categories:**

- developer/ (3 agents: backend-developer, frontend-developer, architecture)
- pattern/pattern-scout (1 agent)
- meta/ (2 agents: agent-summoner, skill-summoner)

---

## Agent 4: Path Resolution Changes - Findings

### Category Extraction from agent.path

```typescript
function extractCategory(agentPath: string): string {
  return agentPath.split("/")[0]; // "developer" from "developer/backend-developer"
}
```

### New Path Resolution Logic

```typescript
function resolveOutputFormatPath(
  agentPath: string,
  projectRoot: string,
): string {
  const category = agentPath.split("/")[0];
  return path.join(projectRoot, DIRS.agents, category, "output-format.md");
}
```

### Files Requiring Changes

| File                       | Change                                          |
| -------------------------- | ----------------------------------------------- |
| `src/cli/lib/compiler.ts`  | Replace path construction (lines 82-86)         |
| `src/cli/lib/validator.ts` | Add validation for category output-format.md    |
| `src/types.ts`             | Remove `output_format` field (or mark optional) |
| `src/cli/consts.ts`        | Remove `DIRS.agentOutputs`                      |
| All 15 agent.yaml files    | Remove `output_format` field                    |

---

## Consolidated Migration Strategy

### Problem: Heterogeneous Categories

**4 categories are homogeneous** (single format):

- developer, researcher, reviewer, tester
- ✅ **Can move to category/output-format.md**

**3 categories are heterogeneous** (multiple formats):

- planning (3 formats), pattern (2 formats), meta (2 formats)
- ❌ **Cannot use single category/output-format.md**

### Recommended Approach: Hybrid Strategy

**Option A: Category-level + Shared (Recommended)**

```
src/agent-sources/
├── developer/
│   ├── output-format.md          ← Move from output-formats-developer.md
│   ├── backend-developer/
│   └── frontend-developer/
├── researcher/
│   ├── output-format.md          ← Move from output-formats-researcher.md
│   ├── backend-researcher/
│   └── frontend-researcher/
├── reviewer/
│   ├── output-format.md          ← Move from output-formats-reviewer.md
│   ├── backend-reviewer/
│   └── frontend-reviewer/
├── tester/
│   ├── output-format.md          ← Move from output-formats-tester.md
│   └── tester-agent/
├── planning/
│   ├── pm/
│   │   └── output-format.md      ← Move from output-formats-pm.md (agent-level)
│   ├── architecture/             ← Uses shared developer format
│   └── orchestrator/
│       └── output-format.md      ← Move from output-formats-orchestrator.md (agent-level)
├── pattern/
│   ├── pattern-scout/            ← Uses shared developer format
│   └── pattern-critique/
│       └── output-format.md      ← Move from output-formats-critique.md (agent-level)
└── meta/
    ├── agent-summoner/           ← Uses shared developer format
    ├── skill-summoner/           ← Uses shared developer format
    └── documentor/
        └── output-format.md      ← Move from output-formats-documentor.md (agent-level)

src/agent-outputs/
└── shared/
    └── developer.md              ← Shared by 6 agents
```

**Path Resolution Logic:**

1. Check for `agent-dir/output-format.md` (agent-level)
2. Fallback to `category/output-format.md` (category-level)
3. Fallback to `src/agent-outputs/shared/{format}.md` (shared formats)

---

## Migration Plan

### Phase 1: Code Changes

1. **Update compiler.ts** (lines 82-86)
   - Implement cascading path resolution:
     1. Try `{agent-path}/output-format.md`
     2. Try `{category}/output-format.md`
     3. Try `src/agent-outputs/shared/{output_format}.md`

2. **Update validator.ts**
   - Add validation for output-format.md existence

3. **Mark output_format field optional** in types.ts
   - Keep for backwards compatibility during transition

### Phase 2: File Migration

**Homogeneous categories (4):**

```bash
mv src/agent-outputs/output-formats-developer.md src/agent-outputs/shared/developer.md
mv src/agent-outputs/output-formats-researcher.md src/agent-sources/researcher/output-format.md
mv src/agent-outputs/output-formats-reviewer.md src/agent-sources/reviewer/output-format.md
mv src/agent-outputs/output-formats-tester.md src/agent-sources/tester/output-format.md
```

**Heterogeneous category agents (4 unique formats):**

```bash
mv src/agent-outputs/output-formats-pm.md src/agent-sources/planning/pm/output-format.md
mv src/agent-outputs/output-formats-orchestrator.md src/agent-sources/planning/orchestrator/output-format.md
mv src/agent-outputs/output-formats-critique.md src/agent-sources/pattern/pattern-critique/output-format.md
mv src/agent-outputs/output-formats-documentor.md src/agent-sources/meta/documentor/output-format.md
```

**Developer category:**

```bash
cp src/agent-outputs/shared/developer.md src/agent-sources/developer/output-format.md
```

### Phase 3: Remove output_format from agent.yaml

Remove the `output_format` field from all 15 agent.yaml files (now implicit from path).

### Phase 4: Validation

- Compile all agents
- Verify output-format.md resolved correctly
- Run tests

### Phase 5: Cleanup

- Remove unused files in src/agent-outputs/
- Remove `DIRS.agentOutputs` constant
- Update schema to make output_format optional/deprecated

---

## Decision Required

The user needs to decide on the migration approach:

**Option A: Hybrid (Recommended)**

- ✅ Clean for homogeneous categories
- ✅ Flexible for heterogeneous categories
- ✅ Handles shared formats well
- ⚠️ More complex path resolution

**Option B: Keep Centralized**

- ✅ Simple - no changes needed
- ❌ Doesn't achieve goal of co-locating with categories

**Option C: Full Per-Agent**

- ✅ Most explicit
- ❌ Duplicates developer format 6 times
- ❌ Content drift risk
