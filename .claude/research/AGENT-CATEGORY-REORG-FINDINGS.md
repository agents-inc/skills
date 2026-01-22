# Agent Category Reorganization Research Findings

> **Generated**: 2026-01-22
> **Purpose**: Consolidated findings from research agents investigating the agent-sources reorganization
> **Status**: ✅ Complete - Ready for Implementation

---

## Overview

Reorganize `src/agent-sources/` from flat sibling structure to category-based structure matching `.claude/agents/` output.

### Target Structure Example

```
src/agent-sources/
├── developer/
│   ├── output-format.md          # Shared output format for all developers
│   ├── backend-developer/
│   │   └── agent.yaml
│   └── frontend-developer/
│       └── agent.yaml
├── researcher/
│   ├── output-format.md
│   ├── backend-researcher/
│   │   └── agent.yaml
│   └── frontend-researcher/
│       └── agent.yaml
├── reviewer/
│   ├── output-format.md
│   ├── backend-reviewer/
│   │   └── agent.yaml
│   └── frontend-reviewer/
│       └── agent.yaml
├── meta/
│   ├── output-format.md
│   ├── agent-summoner/
│   ├── skill-summoner/
│   └── documentor/
├── pattern/
│   ├── output-format.md
│   ├── pattern-scout/
│   └── pattern-critique/
├── planning/
│   ├── output-format.md
│   ├── pm/
│   ├── architecture/
│   └── orchestrator/
└── tester/
    ├── output-format.md
    └── tester/
```

---

## Research Agent Assignments

| Agent | Area                                                    | Status      |
| ----- | ------------------------------------------------------- | ----------- |
| 1     | Current agent-sources structure and agent.yaml format   | ✅ Complete |
| 2     | Compilation pipeline (compiler.ts, templates)           | ✅ Complete |
| 3     | agents.yaml master config and how it references sources | ✅ Complete |
| 4     | Output format files in .claude/agents/ categories       | ✅ Complete |
| 5     | Documentation files that reference agent paths          | ✅ Complete |
| 6     | Tests and scripts that reference agent-sources          | ✅ Complete |

---

## Agent 1: Current Structure Analysis

**Files to investigate:**

- `src/agent-sources/` directory listing
- Sample `agent.yaml` files
- Any existing category conventions

### Findings

**16 Agents in Flat Structure:**

```
src/agent-sources/
├── agent-summoner/
├── architecture/
├── backend-developer/
├── backend-researcher/
├── backend-reviewer/
├── documentor/
├── frontend-developer/
├── frontend-researcher/
├── frontend-reviewer/
├── orchestrator/
├── pattern-critique/
├── pattern-scout/
├── pm/
├── skill-summoner/
└── tester/
```

**agent.yaml Schema (5 fields):**

```yaml
id: <agent-id> # kebab-case identifier (e.g., "frontend-developer")
title: <human-readable> # Title of the agent (e.g., "Frontend Developer Agent")
description: <text> # Detailed description + invoke instructions
model: opus # LLM model (all use "opus")
tools: # List of available tools
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
output_format: <format-id> # References output format (e.g., "output-formats-developer")
```

**Standard Files Per Agent:**

- `agent.yaml` - Configuration
- `intro.md` - Introduction/overview
- `workflow.md` - Detailed workflow
- `critical-requirements.md` - Critical requirements
- `critical-reminders.md` - Important reminders
- `examples.md` - Example usage (missing in orchestrator)

**Output Format Mapping (7 distinct formats):**

| Output Format                 | Agents Using It                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `output-formats-developer`    | frontend-developer, backend-developer, architecture, agent-summoner, pattern-scout, skill-summoner |
| `output-formats-researcher`   | backend-researcher, frontend-researcher                                                            |
| `output-formats-reviewer`     | backend-reviewer, frontend-reviewer                                                                |
| `output-formats-tester`       | tester                                                                                             |
| `output-formats-pm`           | pm                                                                                                 |
| `output-formats-orchestrator` | orchestrator                                                                                       |
| `output-formats-critique`     | pattern-critique                                                                                   |
| `output-formats-documentor`   | documentor                                                                                         |

**Tool Permission Patterns:**

- **Read-only** (researchers): Read, Grep, Glob, Bash only
- **Full CRUD** (developers): Read, Write, Edit, Grep, Glob, Bash
- **Specialist**: WebSearch, WebFetch (skill-summoner)
- **Orchestrator**: Task, TaskOutput (unique)

---

## Agent 2: Compilation Pipeline Analysis

**Files to investigate:**

- `src/compiler.ts` or similar
- `src/templates/agent.liquid`
- Any build scripts

### Findings

**Compilation Pipeline Flow:**

```
1. Load Phase (loader.ts:88-113) → loadAllAgents()
   - Glob: "*/agent.yaml" against src/agent-sources
   - Returns Record<string, AgentDefinition>

2. Resolution Phase (resolver.ts:185-230) → resolveAgents()
   - Merges agent IDs with compile config
   - Creates AgentConfig objects

3. Compilation Phase (compiler.ts:49-135) → compileAgent()
   - Constructs paths: path.join(projectRoot, DIRS.agents, name)
   - Reads: intro.md, workflow.md, examples.md, critical-requirements.md, critical-reminders.md
   - Renders via Liquid template

4. Template Rendering (agent.liquid)
   - Pure data-driven, no path logic
```

**Critical Code Changes Required:**

| File                       | Line       | Current                     | Needed                           |
| -------------------------- | ---------- | --------------------------- | -------------------------------- |
| `src/cli/lib/loader.ts`    | 94         | `*/agent.yaml`              | `**/agent.yaml` (recursive glob) |
| `src/cli/lib/loader.ts`    | 101-107    | Reads YAML only             | Track file path alongside data   |
| `src/cli/lib/compiler.ts`  | 57         | `path.join(..., name)`      | Use stored path from loader      |
| `src/cli/lib/compiler.ts`  | 60-71      | Read from constructed path  | Read from tracked path           |
| `src/cli/lib/validator.ts` | 43, 48, 61 | Constructs flat path        | Use stored path from loader      |
| `src/types.ts`             | 77-83      | `AgentDefinition` interface | Add `path?: string` field        |

**Key Insight:**
The glob pattern in `loader.ts:94` is the **single most critical change**:

- Current: `*/agent.yaml` matches only direct children
- Needed: `**/agent.yaml` matches at any depth

**Template Impact:** None - `agent.liquid` is purely data-driven, no path-based logic.

**Type Enhancement Needed:**

```typescript
// src/types.ts - AgentDefinition
export interface AgentDefinition {
  title: string;
  description: string;
  model?: string;
  tools: string[];
  output_format: string;
  path?: string; // NEW: Relative path to agent folder
}
```

**Good News:** Skills already support nested paths (`skill.path` in compiler.ts:194-195)

---

## Agent 3: agents.yaml Master Config Analysis

**Files to investigate:**

- `src/agents.yaml`
- How agent paths are resolved
- Config schema

### Findings

**Key Discovery: NO centralized agents.yaml exists**

The system uses **dynamic discovery** via glob patterns, not a central config file.

**Agent Discovery Mechanism:**

```typescript
// src/cli/lib/loader.ts:88-113
export async function loadAllAgents(projectRoot: string): Promise<Record<string, AgentDefinition>> {
  const agentSourcesDir = path.join(projectRoot, DIRS.agents);
  const files = await glob("*/agent.yaml", agentSourcesDir);  // KEY: flat glob

  for (const file of files) {
    const config = parseYaml(content) as AgentYamlConfig;
    agents[config.id] = { ... };  // Agent ID from YAML, not directory name
  }
  return agents;
}
```

**Individual agent.yaml Schema:**

```yaml
id: backend-developer # kebab-case, required - unique identifier
title: Backend Developer # required - human-readable
description: | # required - purpose and behavior
  Implements backend features...
model: opus # optional, default: "opus"
tools: # required, min 1
  - Read
  - Write
  - Edit
output_format: output-formats-developer # required - maps to src/agent-outputs/
```

**TypeScript Types (src/types.ts):**

```typescript
interface AgentYamlConfig {
  id: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  output_format: string;
}

interface AgentDefinition {
  title: string;
  description: string;
  model?: string;
  tools: string[];
  output_format: string;
  // NEED TO ADD: path?: string
}
```

**Central Constant (src/cli/consts.ts:31-39):**

```typescript
export const DIRS = {
  agents: "src/agent-sources",
  skills: "src/skills",
  agentOutputs: "src/agent-outputs",
  // ...
} as const;
```

**Glob Pattern in Schema Validator (src/cli/lib/schema-validator.ts:106-110):**

```typescript
{
  name: 'Agent Definition',
  schema: 'agent.schema.json',
  pattern: '*/agent.yaml',      // NEEDS TO CHANGE TO: '**/agent.yaml'
  baseDir: 'src/agent-sources',
}
```

**Implication:** Reorganization is simpler than expected - no central config to update, just glob patterns

---

## Agent 4: Output Format Analysis

**Files to investigate:**

- `.claude/agents/*/output-format.md` files
- How output formats are currently used
- Mapping between categories and agents

### Findings

**Key Discovery: Output formats are in `src/agent-outputs/`, NOT `.claude/agents/`**

`.claude/agents/` contains 15 **compiled agent files** (flat, no categories):

- agent-summoner.md, architecture.md, backend-developer.md, etc.

**8 Output Format Files in `src/agent-outputs/`:**

| Output Format                    | Agents Using It                                                                                    | Purpose               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| `output-formats-developer.md`    | backend-developer, frontend-developer, architecture, agent-summoner, pattern-scout, skill-summoner | Code implementation   |
| `output-formats-researcher.md`   | backend-researcher, frontend-researcher                                                            | Research findings     |
| `output-formats-reviewer.md`     | backend-reviewer, frontend-reviewer                                                                | Code reviews          |
| `output-formats-tester.md`       | tester                                                                                             | TDD test creation     |
| `output-formats-pm.md`           | pm                                                                                                 | Requirements specs    |
| `output-formats-critique.md`     | pattern-critique                                                                                   | Architecture critique |
| `output-formats-documentor.md`   | documentor                                                                                         | AI documentation      |
| `output-formats-orchestrator.md` | orchestrator                                                                                       | Task coordination     |

**How Output Formats Are Injected:**

1. **Agent YAML** specifies `output_format: output-formats-developer`
2. **Compiler** reads `src/agent-outputs/{output_format}.md` (compiler.ts:82-85)
3. **Template** injects content at compile time (agent.liquid:122)

**Proposed Category Mapping:**

| Category   | Output Format                       | Agents                                              |
| ---------- | ----------------------------------- | --------------------------------------------------- |
| developer  | output-formats-developer            | backend-developer, frontend-developer, architecture |
| researcher | output-formats-researcher           | backend-researcher, frontend-researcher             |
| reviewer   | output-formats-reviewer             | backend-reviewer, frontend-reviewer                 |
| planning   | output-formats-pm                   | pm, orchestrator                                    |
| pattern    | output-formats-developer + critique | pattern-scout, pattern-critique                     |
| meta       | output-formats-developer            | agent-summoner, skill-summoner, documentor          |
| tester     | output-formats-tester               | tester                                              |

**Note:** Output format files stay in `src/agent-outputs/` - they're already well-organized by role

---

## Agent 5: Documentation Analysis

**Files to investigate:**

- `src/docs/INDEX.md`
- `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`
- `src/docs/TODO.md`
- Any other docs referencing agent paths

### Findings

**12 Files Reference agent-sources Paths:**

| File                                                                | Lines Affected                                                                | Update Type                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`                             | 11, 20, 56-60, 548, 558, 567-568, 589, 595, 600, 604, 955, 958-964, 1025-1026 | Directory diagrams, shell commands |
| `src/docs/INDEX.md`                                                 | 34, 347                                                                       | Navigation references              |
| `src/docs/TODO.md`                                                  | 51, 597-598                                                                   | Task descriptions                  |
| `src/docs/ARCHITECTURE_AGENT_CREATION.md`                           | 14, 59                                                                        | Cleanup commands                   |
| `src/docs/ARCHITECTURE_AGENT_PROMPT.md`                             | 265, 271                                                                      | Creation instructions              |
| `src/docs/REFACTOR-AGENT-ARCHITECTURE.md`                           | 11, 17, 37, 42, 156, 160                                                      | Structure diagrams                 |
| `.claude/research/findings/v2/FINAL-DECISION.md`                    | 30, 218-220                                                                   | Architecture diagrams              |
| `.claude/research/findings/v2/DRY-PRINCIPLES-AGENT5-FINDINGS.md`    | 17-18, 45-46, 64-65                                                           | Agent file paths                   |
| `.claude/research/findings/v2/SKILL-ARCHITECTURE-RESEARCH.md`       | 65, 71, 115, 183, 972                                                         | agent.yaml locations               |
| `.claude/research/findings/v2/ARCHITECTURE-IMPROVEMENT-FINDINGS.md` | 119, 120                                                                      | Creation steps                     |
| `.claude/research/findings/v2/CLI-PHASE-2-PLAN.md`                  | 342-343                                                                       | Directory structure                |
| `.claude/research/AGENT-CATEGORY-REORG-FINDINGS.md`                 | 11, 16-52, 60-65                                                              | (This file)                        |

**Content Types Needing Updates:**

1. **Directory Structure Diagrams** - Show `src/agent-sources/{agent-name}/` organization
2. **Shell Commands** - grep/check commands targeting `src/agent-sources/`
3. **Step-by-step Instructions** - How to create agents in specific locations
4. **Configuration References** - How agents.yaml relates to agent-sources

**Primary Files Requiring Significant Updates:**

1. `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` - **~20 locations** (directory diagrams, shell commands, creation steps)
2. `src/docs/REFACTOR-AGENT-ARCHITECTURE.md` - **6 locations** (historical context, structure diagrams)
3. `src/docs/TODO.md` - **2 locations** (task references)

**Note:** `CLAUDE.md` (root) does NOT reference agent-sources paths directly

---

## Agent 6: Tests and Scripts Analysis

**Files to investigate:**

- Test files referencing agent-sources
- Build/compile scripts
- CI/CD configurations

### Findings

**Good News: All paths centralized via `DIRS.agents` constant**

**Source Files with Hardcoded References (3 files):**

| File                              | Line | Reference                                            |
| --------------------------------- | ---- | ---------------------------------------------------- |
| `src/cli/consts.ts`               | 32   | `agents: "src/agent-sources"` - **Central constant** |
| `src/cli/lib/loader.ts`           | 42   | `agents: "src/agent-sources"` - getDirs() user mode  |
| `src/cli/lib/schema-validator.ts` | 109  | `baseDir: 'src/agent-sources'` - Validation target   |

**Compiler References (use DIRS.agents constant):**

| File                          | Line | Usage                                       |
| ----------------------------- | ---- | ------------------------------------------- |
| `src/cli/lib/compiler.ts`     | 57   | `path.join(projectRoot, DIRS.agents, name)` |
| `src/cli/lib/validator.ts`    | 43   | `path.join(projectRoot, DIRS.agents, name)` |
| `src/cli/commands/compile.ts` | 109  | `loadAllAgents(projectRoot)`                |

**Test Files (10 total) - None have hardcoded paths:**

- `loader.test.ts`, `resolver.test.ts`, `config.test.ts`, `source-loader.test.ts`
- `hash.test.ts`, `matrix-resolver.test.ts`, `skill-copier.test.ts`
- `versioning.test.ts`, `active-stack.test.ts`

**CI/CD:** `.github/workflows/ci.yml` - No hardcoded agent-sources paths

**Key Insight:** The reorganization is **low-risk** because:

1. All paths flow through `DIRS.agents` constant
2. No tests have brittle hardcoded paths
3. Only 3 files have literal "src/agent-sources" strings

---

## Consolidated File Change List

**Status: All 6 agents complete - Findings consolidated**

### Files Requiring Code Changes (6 files)

| File                              | Line(s)    | Change Required                                   | Impact       |
| --------------------------------- | ---------- | ------------------------------------------------- | ------------ |
| `src/cli/lib/loader.ts`           | 94         | Change glob `*/agent.yaml` → `**/agent.yaml`      | **Critical** |
| `src/cli/lib/loader.ts`           | 101-107    | Track file path alongside agent data              | **Critical** |
| `src/cli/lib/compiler.ts`         | 57, 60-71  | Use stored path instead of constructing from name | **Critical** |
| `src/cli/lib/validator.ts`        | 43, 48, 61 | Use stored path instead of constructing from name | Medium       |
| `src/cli/lib/schema-validator.ts` | 109        | Change pattern `*/agent.yaml` → `**/agent.yaml`   | Medium       |
| `src/types.ts`                    | 77-83      | Add `path?: string` to AgentDefinition interface  | Low          |

### Files Requiring Hardcoded Path Updates (3 files)

| File                              | Line | Current Value                  | New Value                          |
| --------------------------------- | ---- | ------------------------------ | ---------------------------------- |
| `src/cli/consts.ts`               | 32   | `"src/agent-sources"`          | No change needed (base stays same) |
| `src/cli/lib/loader.ts`           | 42   | `"src/agent-sources"`          | No change needed                   |
| `src/cli/lib/schema-validator.ts` | 109  | `baseDir: 'src/agent-sources'` | No change needed                   |

### Files Requiring Documentation Updates (12 files, ~50 locations)

| File                                                                | Lines                                                                         | Update Type                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`                             | 11, 20, 56-60, 548, 558, 567-568, 589, 595, 600, 604, 955, 958-964, 1025-1026 | **Major** - diagrams, shell commands |
| `src/docs/INDEX.md`                                                 | 34, 347                                                                       | Navigation refs                      |
| `src/docs/TODO.md`                                                  | 51, 597-598                                                                   | Task descriptions                    |
| `src/docs/ARCHITECTURE_AGENT_CREATION.md`                           | 14, 59                                                                        | Cleanup commands                     |
| `src/docs/ARCHITECTURE_AGENT_PROMPT.md`                             | 265, 271                                                                      | Creation instructions                |
| `src/docs/REFACTOR-AGENT-ARCHITECTURE.md`                           | 11, 17, 37, 42, 156, 160                                                      | Structure diagrams                   |
| `.claude/research/findings/v2/FINAL-DECISION.md`                    | 30, 218-220                                                                   | Architecture diagrams                |
| `.claude/research/findings/v2/DRY-PRINCIPLES-AGENT5-FINDINGS.md`    | 17-18, 45-46, 64-65                                                           | Agent file paths                     |
| `.claude/research/findings/v2/SKILL-ARCHITECTURE-RESEARCH.md`       | 65, 71, 115, 183, 972                                                         | agent.yaml locations                 |
| `.claude/research/findings/v2/ARCHITECTURE-IMPROVEMENT-FINDINGS.md` | 119, 120                                                                      | Creation steps                       |
| `.claude/research/findings/v2/CLI-PHASE-2-PLAN.md`                  | 342-343                                                                       | Directory structure                  |

### Directory Structure Changes (16 agent folders to move)

```
src/agent-sources/
├── developer/                          # NEW category
│   ├── backend-developer/              # MOVE from root
│   └── frontend-developer/             # MOVE from root
├── researcher/                         # NEW category
│   ├── backend-researcher/             # MOVE from root
│   └── frontend-researcher/            # MOVE from root
├── reviewer/                           # NEW category
│   ├── backend-reviewer/               # MOVE from root
│   └── frontend-reviewer/              # MOVE from root
├── planning/                           # NEW category
│   ├── pm/                             # MOVE from root
│   ├── architecture/                   # MOVE from root
│   └── orchestrator/                   # MOVE from root
├── pattern/                            # NEW category
│   ├── pattern-scout/                  # MOVE from root
│   └── pattern-critique/               # MOVE from root
├── meta/                               # NEW category
│   ├── agent-summoner/                 # MOVE from root
│   ├── skill-summoner/                 # MOVE from root
│   └── documentor/                     # MOVE from root
└── tester/                             # NEW category
    └── tester/                         # MOVE from root
```

---

## Migration Plan

**Estimated Scope:** 6 code files + 12 doc files + 16 directory moves

### Phase 1: Code Changes (Before Moving Directories)

**Order matters - update code FIRST so it supports nested paths**

1. **Update types** (`src/types.ts`)
   - Add `path?: string` to `AgentDefinition` interface

2. **Update loader** (`src/cli/lib/loader.ts`)
   - Line 94: Change glob `*/agent.yaml` → `**/agent.yaml`
   - Lines 101-107: Store relative path from glob result in agent definition

3. **Update compiler** (`src/cli/lib/compiler.ts`)
   - Line 57: Use `agent.path` instead of constructing from name
   - Lines 60-71: Use stored path for reading agent files

4. **Update validator** (`src/cli/lib/validator.ts`)
   - Lines 43, 48, 61: Use stored path for validation

5. **Update schema-validator** (`src/cli/lib/schema-validator.ts`)
   - Line 109: Change pattern `*/agent.yaml` → `**/agent.yaml`

6. **Run tests** - Ensure existing flat structure still works

### Phase 2: Directory Restructure

**Create categories and move agents (git mv for history)**

```bash
# Create category directories
mkdir -p src/agent-sources/{developer,researcher,reviewer,planning,pattern,meta,tester}

# Move agents to categories
git mv src/agent-sources/backend-developer src/agent-sources/developer/
git mv src/agent-sources/frontend-developer src/agent-sources/developer/
git mv src/agent-sources/backend-researcher src/agent-sources/researcher/
git mv src/agent-sources/frontend-researcher src/agent-sources/researcher/
git mv src/agent-sources/backend-reviewer src/agent-sources/reviewer/
git mv src/agent-sources/frontend-reviewer src/agent-sources/reviewer/
git mv src/agent-sources/pm src/agent-sources/planning/
git mv src/agent-sources/architecture src/agent-sources/planning/
git mv src/agent-sources/orchestrator src/agent-sources/planning/
git mv src/agent-sources/pattern-scout src/agent-sources/pattern/
git mv src/agent-sources/pattern-critique src/agent-sources/pattern/
git mv src/agent-sources/agent-summoner src/agent-sources/meta/
git mv src/agent-sources/skill-summoner src/agent-sources/meta/
git mv src/agent-sources/documentor src/agent-sources/meta/
git mv src/agent-sources/tester src/agent-sources/tester/
```

### Phase 3: Validation

1. **Run full test suite** - `bun test`
2. **Test compilation** - `bun src/cli/index.ts compile`
3. **Verify all 16 agents compile correctly**
4. **Check compiled output in `.claude/agents/`**

### Phase 4: Documentation Updates

**Update ~50 locations across 12 files**

Priority order:

1. `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` (~20 locations)
2. `src/docs/REFACTOR-AGENT-ARCHITECTURE.md` (6 locations)
3. `src/docs/TODO.md` (2 locations) - mark task complete
4. Remaining research docs (lower priority, internal)

### Phase 5: Optional Enhancements

- Add `category.yaml` to each category folder with metadata
- Add category-level README.md files
- Update `cc create agent` to prompt for category

---

## Risk Assessment

| Risk                          | Likelihood | Impact | Mitigation                                  |
| ----------------------------- | ---------- | ------ | ------------------------------------------- |
| Tests fail after code changes | Medium     | High   | Run tests after Phase 1 before moving dirs  |
| Glob pattern misses agents    | Low        | High   | Test `**/agent.yaml` pattern manually first |
| Documentation drift           | Low        | Low    | Can be updated incrementally                |
| Git history loss              | Low        | Medium | Use `git mv` not `mv`                       |

---

## Summary

**Total Changes:**

- **6 code files** (critical path changes)
- **12 documentation files** (~50 line updates)
- **16 agent directories** to move into 7 categories
- **0 test file changes** needed (paths centralized)

**Key Insight:** The architecture is well-designed for this change:

- Dynamic discovery via glob patterns
- Centralized path constants
- Agent ID from YAML, not directory name
- Skills already support nested paths

**Recommendation:** Proceed with confidence. The reorganization is low-risk due to the centralized path management

---

## Open Questions

1. Should category folders have their own metadata (category.yaml)?
2. How to handle agents that might fit multiple categories?
3. Should output-format.md be mandatory for each category?
