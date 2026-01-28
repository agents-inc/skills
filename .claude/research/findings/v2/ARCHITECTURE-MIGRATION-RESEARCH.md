# Architecture Migration Research: Stacks → Single-Config

**Status:** Complete
**Started:** 2026-01-26
**Completed:** 2026-01-26

---

## Research Areas

### 1. Current Implementation Deep Dive

**Status:** Complete

#### Wizard Flow (wizard.ts)

The wizard uses a 7-step state machine:

1. **"approach"** - Choose between "Use pre-built template" (stack) or "Start from scratch"
2. **"stack"** - If choosing stack, select from `matrix.suggestedStacks`
3. **"stack_review"** - Review stack selections (confirm, edit, or go back)
4. **"category"** - Navigate top-level categories (frontend, backend, mobile, setup, reviewing)
5. **"subcategory"** - Navigate subcategories within selected category
6. **"skill"** - Multi-select skills with conflict/requirement validation
7. **"confirm"** - Final validation with error/warning display

**Key State Data:**

```typescript
interface WizardState {
  currentStep: WizardStep;
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  expertMode: boolean; // Disables conflict checking
  visitedCategories: Set<string>;
}
```

#### Resolver (resolver.ts) - Skill-to-Agent Mapping

**Resolution Flow:**

1. Check if agent has explicit `agent_skills[agentName]` assignments (hierarchical)
2. If yes, flatten via `flattenAgentSkills()` and use those skills
3. If no, fall back to stack-level `skills` array
4. Expand directory prefixes (e.g., "methodology/universal" → all skills under that path)
5. Validate against stack's skill list
6. Create SkillReference objects with preloaded flag preserved

**Hierarchical Format in config.yaml:**

```yaml
agent_skills:
  frontend-developer:
    framework:
      - id: react (@vince)
        preloaded: true
    styling:
      - id: scss-modules (@vince)
```

#### Preloaded vs Dynamic Skills

- **Preloaded (`preloaded: true`):** Full content embedded in compiled agent markdown
- **Dynamic (`preloaded: false`):** Only metadata included; loaded via Skill tool at runtime
- Default is `false` (dynamic)

#### Stack config.yaml Structure

**Required Fields:**

- `name`, `version`, `author`
- `skills: SkillAssignment[]` - Array of `{id, preloaded?}`
- `agents: string[]` - Agent IDs to include

**Optional Fields:**

- `description`, `framework`, `philosophy`, `principles`, `tags`
- `agent_skills: Record<agentId, Record<category, SkillAssignment[]>>`
- `hooks: Record<eventType, HookDefinition[]>`

---

### 2. Skill Discovery & Loading

**Status:** Complete

#### How loader.ts Finds Skills

- `loadSkillsByIds()` scans `src/skills/**/SKILL.md` using glob
- `buildIdToDirectoryPathMap()` creates mapping: frontmatter name → directory path
- Skills can be referenced by:
  1. **Canonical ID** (frontmatter name): `"react (@vince)"`
  2. **Directory path**: `"frontend/framework/react (@vince)"`
  3. **Directory prefix** (wildcard): `"methodology/universal"` → loads all skills

#### SKILL.md Frontmatter Format

```yaml
---
name: react (@vince) # Canonical ID
description: Component patterns
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Grep, Glob
model: inherit
---
```

#### metadata.yaml Usage

- **Cataloging:** category, cli_name, cli_description, usage_guidance, tags
- **Relationships:** compatible_with, conflicts_with, requires, requires_setup, provides_setup_for
- **Tracking:** content_hash, updated, forked_from

#### Adding Local Skill Discovery (.claude/skills/)

Would need new function following same pattern:

```typescript
export async function loadLocalSkills(projectRoot: string) {
  const localSkillsDir = path.join(projectRoot, ".claude/skills");
  if (!(await directoryExists(localSkillsDir))) return {};
  const files = await glob("**/SKILL.md", localSkillsDir);
  // Same parsing as loadSkillsByIds...
}
```

---

### 3. Config Generation Requirements

**Status:** Complete

#### Fields Moving to .claude/config.yaml

**Include:**

- `name`, `description`, `framework`
- `skills` (flat array with preloaded flag)
- `agents` (list of agent IDs)
- `agent_skills` (per-agent hierarchical assignments)
- `philosophy`, `principles`, `tags`
- `hooks`

**Exclude (goes to plugin.json):**

- `version`, `created`, `updated`, `id`

#### Smart Defaults Generation

Map skill categories to agents:

- Frontend skills → `frontend-developer`, `frontend-reviewer`, `frontend-researcher`
- Backend skills → `backend-developer`, `backend-reviewer`, `backend-researcher`
- Universal skills → all agents (methodology, reviewing)
- Setup skills → `architecture`, `pm`

#### Preloaded Flag Structure

```yaml
skills:
  - id: react (@vince)
    preloaded: true # Embedded in agent
  - id: zustand (@vince)
    # Default: false (dynamic)
```

#### Local vs Marketplace Differentiation

- Marketplace skills: `"skill-name (@author)"`
- Local skills: `"my-local-skill"` (no author prefix)
- Local skills discovered from `.claude/skills/` (not copied, just referenced)

---

### 4. Compilation Pipeline Changes

**Status:** Complete

#### Current Compilation Flow

1. **Loading:** Load stack config, all agents, skills by IDs
2. **Resolution:** stackToCompileConfig() → resolveAgents() → resolveStackSkills()
3. **Compilation:** Render agent.liquid template for each agent
4. **Assembly:** Create plugin structure, copy skills, generate manifests

#### What Compiler Needs from Config

- `name` - display name
- `agents[]` - which agents to compile
- `skills[]` - skill assignments with preloaded flag
- `agent_skills{}` - per-agent overrides (optional)
- `hooks{}` - lifecycle hooks (optional)

#### Changes for .claude/config.yaml

**New loading function:**

```typescript
async function loadConfigFromHome(): Promise<UserConfig> {
  const configPath = path.join(os.homedir(), ".claude/config.yaml");
  return parseYaml(await readFile(configPath));
}
```

**Modified compilation:**

- Accept config path instead of stackId
- Check both `src/skills/` and `.claude/skills/` for skills
- Reference (don't copy) local skills

#### Handling Local Skills (Reference Not Copy)

```typescript
if (isLocalSkill(resolvedSkill)) {
  manifest.local_skills[skillId] = resolvedSkill.path;
  // Skip copy phase
} else {
  await copy(sourceSkillDir, destSkillDir);
}
```

**Updated plugin.json:**

```json
{
  "name": "my-config",
  "agents": "agents/",
  "skills": "skills/",
  "local_skills": {
    "my-local-skill": "../../.claude/skills/my-local-skill/"
  }
}
```

---

### 5. Wizard Simplification

**Status:** Complete

#### Steps to Remove

1. **Remove "stack_review"** - Redundant after stack selection
2. **Simplify "approach"** - No template vs scratch decision needed

#### Minimal Wizard Flow (5 steps)

1. **"category"** - Browse top-level categories
2. **"subcategory"** - Select subcategory
3. **"skill"** - Select/deselect with relationships
4. **"confirm"** - Validate and show errors
5. Done

#### Marketplace vs Local Skills Display

Add `source: "marketplace" | "local"` to ResolvedSkill:

```typescript
const skillOptions = skills.map((s) => ({
  ...formatSkillOption(s),
  label: `${s.source === "marketplace" ? "🔷 " : ""}${s.name}`,
}));
```

#### Category Structure for Grouping

- **Top-level (5):** frontend, backend, mobile, setup, reviewing
- **Subcategories (20):** framework, meta-framework, styling, client-state, etc.
- Use `getTopLevelCategories()` and `getSubcategories()` functions

---

## Architecture Diff

| Aspect           | Current (Stack-Based)                 | Target (Single-Config)                                  |
| ---------------- | ------------------------------------- | ------------------------------------------------------- |
| Config location  | `src/stacks/{stackId}/config.yaml`    | `.claude/config.yaml`                                   |
| Skill source     | `src/skills/` only                    | `src/skills/` (marketplace) + `.claude/skills/` (local) |
| Command          | `cc switch <stack>` then `cc compile` | `cc init` then `cc compile`                             |
| Stack concept    | Runtime selection                     | Template for initial config generation                  |
| Skill copying    | All skills copied to plugin           | Marketplace copied, local referenced                    |
| Config ownership | Repository-defined                    | User-defined in home directory                          |

---

## File-by-File Change List (Revised - Minimal Scope)

### Files to Modify

| File                          | Changes                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `src/cli/commands/init.ts`    | After compilation, write config.yaml to plugin folder             |
| `src/cli/commands/compile.ts` | Read config.yaml from plugin folder instead of from source stacks |

### Files Unchanged

| File                                   | Why                                |
| -------------------------------------- | ---------------------------------- |
| `src/cli/lib/wizard.ts`                | Wizard flow stays the same         |
| `src/cli/lib/loader.ts`                | Skill loading stays the same       |
| `src/cli/lib/resolver.ts`              | Resolution logic stays the same    |
| `src/cli/lib/stack-plugin-compiler.ts` | Compilation stays the same         |
| `src/cli/types.ts`                     | Using existing StackConfig type    |
| `src/cli/commands/switch.ts`           | Keep for now (can deprecate later) |

### No New Files Needed

Using existing types and loaders - just changing where config is read/written.

---

## New Schema

### .claude/config.yaml Schema

```yaml
# .claude/config.yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/.../user-config.schema.json

# Skills to include (marketplace + local)
skills:
  # Marketplace skills
  - id: react (@vince)
    preloaded: true
  - id: drizzle (@vince)
  - id: hono (@vince)
  # Local skills (auto-discovered from .claude/skills/)
  - id: my-company-api

# Agents to compile
agents:
  - frontend-developer
  - backend-developer
  - tester
  - pm

# Per-agent skill assignments (optional - defaults to category-based)
agent_skills:
  frontend-developer:
    framework:
      - id: react (@vince)
        preloaded: true
    styling:
      - id: scss-modules (@vince)
        preloaded: true
  backend-developer:
    api:
      - id: hono (@vince)
        preloaded: true
    database:
      - id: drizzle (@vince)

# Lifecycle hooks (optional)
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "npm run format"

# Metadata (optional)
philosophy: "Ship quality features fast"
principles:
  - "Test first"
  - "No over-engineering"
tags:
  - react
  - fullstack
```

### TypeScript Interface

```typescript
interface UserConfig {
  skills: SkillAssignment[];
  agents: string[];
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>;
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
  tags?: string[];
}

interface SkillAssignment {
  id: string;
  preloaded?: boolean; // Default: false
}
```

---

## Implementation Order (Revised)

**Confirmed approach:** Keep wizard as-is, same config format, output to plugin folder. Add skill-to-agent mapping for manual selection.

### Phase 1: Create Skill-to-Agent Mapping Config

Create `src/cli/lib/skill-agent-mappings.ts`:

```typescript
/**
 * Default mapping from skill categories to agents
 * Used when user manually selects skills (no pre-built stack)
 */

// Agent categories (from src/agents/ folder structure)
const AGENT_CATEGORIES = {
  developer: ["frontend-developer", "backend-developer", "architecture"],
  reviewer: ["frontend-reviewer", "backend-reviewer"],
  researcher: ["frontend-researcher", "backend-researcher"],
  tester: ["tester"],
  planning: ["pm"],
  pattern: ["pattern-scout", "pattern-critique"],
  meta: ["agent-summoner", "skill-summoner", "documentor"],
};

// Which agents get which skill categories
export const SKILL_TO_AGENTS: Record<string, string[]> = {
  // Frontend skills → frontend agents + shared
  "frontend/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Backend skills → backend agents + shared
  "backend/*": [
    "backend-developer",
    "backend-reviewer",
    "backend-researcher",
    "architecture",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Mobile skills → frontend agents (React Native/Expo are frontend tech)
  "mobile/*": [
    "frontend-developer",
    "frontend-reviewer",
    "frontend-researcher",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Setup skills → architecture + both developers + meta
  "setup/*": [
    "architecture",
    "frontend-developer",
    "backend-developer",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Security → both developers + both reviewers + architecture
  "security/*": [
    "frontend-developer",
    "backend-developer",
    "frontend-reviewer",
    "backend-reviewer",
    "architecture",
    "pm",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Reviewing skills → reviewer agents + pattern-critique
  "reviewing/*": [
    "frontend-reviewer",
    "backend-reviewer",
    "pattern-critique",
    "agent-summoner",
    "skill-summoner",
    "documentor",
  ],

  // Research methodology → researchers + planning + pattern agents
  "research/*": [
    "frontend-researcher",
    "backend-researcher",
    "pm",
    "pattern-scout",
    "pattern-critique",
    "documentor",
    "agent-summoner",
    "skill-summoner",
  ],

  // Testing skills → tester agent
  "frontend/testing": ["tester", "frontend-developer", "frontend-reviewer"],
  "backend/testing": ["tester", "backend-developer", "backend-reviewer"],
};

// Which skills should be preloaded for which agents
export const PRELOADED_SKILLS: Record<string, string[]> = {
  "frontend-developer": ["framework", "styling"],
  "backend-developer": ["api", "database"],
  "frontend-reviewer": ["framework", "styling", "reviewing"],
  "backend-reviewer": ["api", "database", "reviewing"],
  "frontend-researcher": ["framework", "research-methodology"],
  "backend-researcher": ["api", "research-methodology"],
  tester: ["frontend/testing", "backend/testing", "mocks"],
  architecture: ["setup/monorepo"],
  pm: ["research-methodology"],
  "pattern-scout": ["research-methodology"],
  "pattern-critique": ["research-methodology", "reviewing"],
  documentor: ["research-methodology"],
  // meta agents: no preloaded (they get everything dynamically)
};

// Subcategory to category mapping (for preloaded matching)
export const SUBCATEGORY_ALIASES: Record<string, string> = {
  framework: "frontend/framework",
  styling: "frontend/styling",
  api: "backend/api",
  database: "backend/database",
  mocks: "frontend/mocks",
  reviewing: "reviewing/*",
  "research-methodology": "research/*",
};
```

### Phase 2: Create Config Generator

Create `src/cli/lib/config-generator.ts`:

```typescript
import { SKILL_TO_AGENTS, PRELOADED_SKILLS } from "./skill-agent-mappings";
import type { StackConfig, SkillAssignment } from "../../types";

/**
 * Generate a StackConfig from manually selected skills
 * Uses default mappings to assign skills to agents
 */
export function generateConfigFromSkills(
  selectedSkillIds: string[],
  skillMetadata: Record<string, { category: string }>,
): StackConfig {
  const agentSkills: Record<string, Record<string, SkillAssignment[]>> = {};

  // For each selected skill, determine which agents get it
  for (const skillId of selectedSkillIds) {
    const category = skillMetadata[skillId]?.category || "unknown";
    const agents = findAgentsForSkill(category);

    for (const agentId of agents) {
      if (!agentSkills[agentId]) {
        agentSkills[agentId] = {};
      }

      const categoryKey = getCategoryKey(category);
      if (!agentSkills[agentId][categoryKey]) {
        agentSkills[agentId][categoryKey] = [];
      }

      const isPreloaded = shouldPreload(skillId, agentId, category);
      agentSkills[agentId][categoryKey].push({
        id: skillId,
        preloaded: isPreloaded,
      });
    }
  }

  // Build the config
  return {
    name: "claude-collective",
    version: "1.0.0",
    author: "@user",
    description: `Custom plugin with ${selectedSkillIds.length} skills`,
    skills: selectedSkillIds.map((id) => ({ id })),
    agents: Object.keys(agentSkills),
    agent_skills: agentSkills,
  };
}

function findAgentsForSkill(category: string): string[] {
  // Check exact match first
  if (SKILL_TO_AGENTS[category]) {
    return SKILL_TO_AGENTS[category];
  }

  // Check wildcard patterns (e.g., 'frontend/*')
  for (const [pattern, agents] of Object.entries(SKILL_TO_AGENTS)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (category.startsWith(prefix)) {
        return agents;
      }
    }
  }

  // Default: give to meta agents only
  return ["agent-summoner", "skill-summoner", "documentor"];
}

function shouldPreload(
  skillId: string,
  agentId: string,
  category: string,
): boolean {
  const preloadedFor = PRELOADED_SKILLS[agentId] || [];

  // Check if this skill's category/subcategory is in the preloaded list
  for (const preloadPattern of preloadedFor) {
    if (category.includes(preloadPattern) || skillId.includes(preloadPattern)) {
      return true;
    }
  }

  return false;
}

function getCategoryKey(category: string): string {
  // Extract subcategory for grouping (e.g., 'frontend/framework' → 'framework')
  const parts = category.split("/");
  return parts[parts.length - 1] || category;
}
```

### Phase 3: Update init.ts

Modify `src/cli/commands/init.ts`:

1. After wizard completes, check if user selected a stack or manual skills
2. If stack selected: use `loadedStackConfig` directly
3. If manual selection: call `generateConfigFromSkills(result.selectedSkills, ...)`
4. Write config.yaml to plugin folder
5. Show message about editing config

### Phase 4: Update compile.ts

Modify `src/cli/commands/compile.ts`:

1. Check for config.yaml in plugin folder first
2. If exists, read and use it
3. If not, fall back to source stack (backward compat)

### Phase 5: User messaging

1. After init: "Config saved to ~/.claude/plugins/claude-collective/config.yaml"
2. Explain: "Edit this file to customize agent-skill assignments, then run: cc compile"

---

**Files to create:**

- `src/cli/lib/skill-agent-mappings.ts` - Mapping configuration
- `src/cli/lib/config-generator.ts` - Config generation logic

**Files to modify:**

- `src/cli/commands/init.ts` - Output config.yaml
- `src/cli/commands/compile.ts` - Read from plugin folder

---

## Risk Assessment

### High Risk

| Risk                               | Mitigation                                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| Breaking existing user workflows   | Provide migration script; keep `cc switch` as deprecated alias |
| Local skill path resolution issues | Use absolute paths internally; validate on config load         |
| Config validation gaps             | Comprehensive schema; clear error messages                     |

### Medium Risk

| Risk                                                 | Mitigation                                     |
| ---------------------------------------------------- | ---------------------------------------------- |
| Missing skills during compilation                    | Validate all skill IDs exist before compile    |
| Agent-skill assignment gaps                          | Fall back to category-based defaults           |
| Merge conflicts between local and marketplace skills | Namespace validation; clear naming conventions |

### Low Risk

| Risk                               | Mitigation                                     |
| ---------------------------------- | ---------------------------------------------- |
| Performance with many local skills | Lazy loading; caching                          |
| User confusion about skill sources | Clear UI indicators (🔷 marketplace, 📁 local) |

### Migration Path

1. Existing stacks continue to work (backward compatibility)
2. `cc init` offers to migrate from stack to config
3. Stacks become "templates" that generate initial config
4. Eventually deprecate stack switching (Phase 2 of migration)

---

## Summary (Revised - Minimal Scope)

**Confirmed approach:** Minimal changes, same format, new output location.

### What Changes

1. `cc init` outputs `config.yaml` to `~/.claude/plugins/claude-collective/config.yaml`
2. `cc compile` reads from that location instead of source stacks
3. User can edit config.yaml and re-run `cc compile`

### What Stays the Same

- All 7 wizard steps
- Stack selection and templates
- Config.yaml format (identical to existing stack config)
- Skill loading and compilation logic
- All existing types and schemas

### Implementation Effort

- **2 files to modify:** init.ts, compile.ts
- **0 new files needed**
- **Estimated scope:** Small - mostly path changes and config output

### User Flow

```
cc init → wizard → compile → config.yaml saved to plugin folder
                              ↓
                    User edits config.yaml
                              ↓
cc compile → re-compiles agents with updated config
```
