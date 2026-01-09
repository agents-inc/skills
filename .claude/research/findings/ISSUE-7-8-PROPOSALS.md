# Proposals for Issues #7 and #8

> **Context:** Detailed solutions with ACTUAL CODE EXAMPLES for config redundancy and multi-file update workflow.

---

## Issue #7: Config File Redundancy (625+ lines)

### Current State Analysis

**File: `src/profiles/home/config.yaml`** - 626 lines

**Redundancy Breakdown:**

| Redundancy Type | Lines | Occurrences |
|-----------------|-------|-------------|
| `core_prompts` array | ~60 lines | 15 agents |
| `ending_prompts` array | ~30 lines | 15 agents |
| Same skill ID repeated | ~200 lines | Multiple agents |
| Verbose skill metadata (work profile) | ~100 lines | Ignored by compiler |

---

### BEFORE: Current Redundant YAML (Actual Example)

```yaml
# From home/config.yaml - Lines 14-44 (frontend-developer)
agents:
  frontend-developer:
    core_prompts:
      - core-principles           # REPEATED 15x
      - investigation-requirement # REPEATED 15x
      - write-verification        # REPEATED 15x
      - anti-over-engineering     # REPEATED 15x
    ending_prompts:
      - context-management        # REPEATED 15x
      - improvement-protocol      # REPEATED 15x
    precompiled:
      - id: frontend/react
        usage: when implementing React components
      - id: frontend/styling
        usage: when implementing styles
    dynamic:
      - id: frontend/api
        usage: when implementing data fetching, API calls, or React Query integrations
      # ... 7 more skills

  backend-developer:
    core_prompts:                 # SAME 4 ITEMS REPEATED
      - core-principles
      - investigation-requirement
      - write-verification
      - anti-over-engineering
    ending_prompts:               # SAME 2 ITEMS REPEATED
      - context-management
      - improvement-protocol
    # ... etc

  frontend-reviewer:
    core_prompts:                 # AGAIN - 3 items (missing anti-over-engineering)
      - core-principles
      - investigation-requirement
      - write-verification
    ending_prompts:               # SAME 2 ITEMS REPEATED
      - context-management
      - improvement-protocol
    # ... etc
```

**Problem Summary:**
- 4 core_prompts x 15 agents = 60 lines repeated
- 2 ending_prompts x 15 agents = 30 lines repeated
- `frontend/react` appears in 9+ agents
- Work profile has 100+ lines of `path/name/description` overrides that the compiler IGNORES

---

### AFTER: Phase 1 - YAML Anchors (No Code Changes)

**Estimated Reduction: 40% (~250 lines)**

```yaml
# yaml-language-server: $schema=../../schemas/profile-config.schema.json
name: home
description: Personal projects (SCSS/cva, Zustand, React Query)
claude_md: ./CLAUDE.md

# =============================================================================
# YAML Anchors - Define once, reference everywhere
# =============================================================================

# Prompt sets (different agents need different combinations)
prompt_sets:
  developer_prompts: &developer_prompts
    core_prompts:
      - core-principles
      - investigation-requirement
      - write-verification
      - anti-over-engineering
    ending_prompts:
      - context-management
      - improvement-protocol

  reviewer_prompts: &reviewer_prompts
    core_prompts:
      - core-principles
      - investigation-requirement
      - write-verification
    ending_prompts:
      - context-management
      - improvement-protocol

  researcher_prompts: &researcher_prompts
    core_prompts:
      - core-principles
      - investigation-requirement
      - write-verification
    ending_prompts:
      - context-management
      - improvement-protocol

# Skill bundles - commonly assigned together
skill_bundles:
  frontend_core: &frontend_core
    - id: frontend/react
      usage: when implementing React components
    - id: frontend/styling
      usage: when implementing styles

  frontend_dynamic_common: &frontend_dynamic_common
    - id: frontend/api
      usage: when implementing data fetching
    - id: frontend/client-state
      usage: when implementing Zustand stores
    - id: frontend/accessibility
      usage: when implementing accessible components
    - id: frontend/performance
      usage: when optimizing renders

  backend_core: &backend_core
    - id: backend/api
      usage: when implementing API routes
    - id: backend/authentication
      usage: when implementing authentication

  all_skills: &all_skills
    - id: frontend/react
      usage: when working with React
    - id: frontend/styling
      usage: when working with styling
    - id: frontend/api
      usage: when working with data fetching
    # ... all 28 skills with context-specific usage

# =============================================================================
# Agent Configurations (now DRY)
# =============================================================================

agents:
  frontend-developer:
    <<: *developer_prompts
    precompiled: *frontend_core
    dynamic: *frontend_dynamic_common

  backend-developer:
    <<: *developer_prompts
    precompiled: *backend_core
    dynamic:
      - id: backend/database
        usage: when implementing database queries
      - id: backend/ci-cd
        usage: when implementing deployment pipelines
      # ... backend-specific skills

  frontend-reviewer:
    <<: *reviewer_prompts
    precompiled:
      - *frontend_core
      - id: shared/reviewing
        usage: when reviewing code
      - id: frontend/accessibility
        usage: when reviewing accessibility
    dynamic:
      - id: frontend/performance
        usage: when reviewing performance-critical code

  pm:
    <<: *reviewer_prompts
    precompiled: []
    dynamic: *all_skills

  skill-summoner:
    <<: *developer_prompts
    precompiled: []
    dynamic: *all_skills

  agent-summoner:
    <<: *developer_prompts
    precompiled: []
    dynamic: *all_skills

  # ... remaining agents follow same pattern
```

**Benefits:**
- No compiler changes required
- Works today with standard YAML parsers
- Single source for prompt combinations
- Single source for common skill bundles
- Changes propagate automatically

---

### AFTER: Phase 2 - Profile Defaults (Small Code Change)

**Estimated Additional Reduction: 20-30% (~125 more lines)**

**New schema addition to `profile-config.schema.json`:**

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "description": { "type": "string" },
    "claude_md": { "type": "string" },
    "defaults": {
      "type": "object",
      "properties": {
        "core_prompts": {
          "type": "array",
          "items": { "type": "string" }
        },
        "ending_prompts": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "agents": { "..." }
  }
}
```

**New config format:**

```yaml
name: home
description: Personal projects (SCSS/cva, Zustand, React Query)
claude_md: ./CLAUDE.md

# Profile-level defaults - agents inherit these unless overridden
defaults:
  core_prompts:
    - core-principles
    - investigation-requirement
    - write-verification
    - anti-over-engineering
  ending_prompts:
    - context-management
    - improvement-protocol

agents:
  frontend-developer:
    # Inherits defaults automatically - no core_prompts/ending_prompts needed
    precompiled:
      - id: frontend/react
        usage: when implementing React components
      - id: frontend/styling
        usage: when implementing styles
    dynamic:
      - id: frontend/api
        usage: when implementing data fetching

  frontend-reviewer:
    # Override defaults when needed (reviewers skip anti-over-engineering)
    core_prompts:
      - core-principles
      - investigation-requirement
      - write-verification
    # ending_prompts inherited from defaults
    precompiled:
      - id: shared/reviewing
        usage: when reviewing code

  # Agents that match defaults need NO prompt arrays at all
  backend-developer:
    precompiled:
      - id: backend/api
        usage: when implementing API routes
    dynamic:
      - id: backend/database
        usage: when implementing database queries
```

**Required compile.ts change (~20 lines):**

```typescript
// In resolveAgentConfig function
function resolveAgentConfig(
  name: string,
  profileAgent: ProfileAgentConfig,
  profileDefaults?: ProfileDefaults
): ResolvedAgentConfig {
  return {
    name,
    core_prompts: profileAgent.core_prompts ?? profileDefaults?.core_prompts ?? [],
    ending_prompts: profileAgent.ending_prompts ?? profileDefaults?.ending_prompts ?? [],
    precompiled: profileAgent.precompiled ?? [],
    dynamic: profileAgent.dynamic ?? [],
  };
}

// In main compilation loop
const profileDefaults = profileConfig.defaults;
for (const [agentName, profileAgent] of Object.entries(profileConfig.agents)) {
  const resolved = resolveAgentConfig(agentName, profileAgent, profileDefaults);
  // ... continue compilation
}
```

---

### AFTER: Phase 3 - Skill Bundles (Medium Code Change)

**New `skills.yaml` format:**

```yaml
# yaml-language-server: $schema=./schemas/skills.schema.json

# Individual skill definitions (unchanged)
skills:
  frontend/react:
    path: skills/frontend/react.md
    name: React
    description: Component architecture, hooks, patterns

  frontend/styling:
    path: skills/frontend/styling.md
    name: Styling
    description: SCSS Modules, cva, design tokens

  # ... all 28 skills

# NEW: Named bundles for common assignments
bundles:
  frontend-core:
    description: Essential frontend skills for React development
    skills:
      - frontend/react
      - frontend/styling

  frontend-extended:
    extends: frontend-core
    description: Full frontend stack including API and state
    skills:
      - frontend/api
      - frontend/client-state
      - frontend/accessibility
      - frontend/performance

  backend-core:
    description: Essential backend skills for API development
    skills:
      - backend/api
      - backend/authentication
      - backend/database

  all-frontend:
    extends: frontend-extended
    description: All frontend skills for PM/summoner agents
    skills:
      - frontend/testing
      - frontend/mocking

  all-backend:
    description: All backend skills
    skills:
      - backend/api
      - backend/authentication
      - backend/database
      - backend/ci-cd
      - backend/performance
      - backend/testing
      - backend/analytics
      - backend/feature-flags
      - backend/email
      - backend/observability

  all-skills:
    extends:
      - all-frontend
      - all-backend
    skills:
      - security/security
      - shared/reviewing
      - setup/monorepo
      - setup/package
      - setup/env
      - setup/tooling
```

**New config usage:**

```yaml
agents:
  frontend-developer:
    <<: *developer_prompts
    precompiled:
      bundle: frontend-core
    dynamic:
      bundle: frontend-extended
      exclude:
        - frontend/react     # Already in precompiled
        - frontend/styling   # Already in precompiled

  pm:
    <<: *reviewer_prompts
    precompiled: []
    dynamic:
      bundle: all-skills
      # No need to list 28 skills individually!
```

---

### Summary: Line Reduction by Phase

| Phase | Lines Before | Lines After | Reduction |
|-------|--------------|-------------|-----------|
| Current | 626 | 626 | 0% |
| Phase 1 (YAML Anchors) | 626 | ~375 | 40% |
| Phase 2 (+ Defaults) | ~375 | ~250 | 60% total |
| Phase 3 (+ Bundles) | ~250 | ~180 | 70% total |

---

## Issue #8: Multi-File Update Workflow

### Current State: Adding a New Agent

**Files that must be touched:**

1. `src/agents.yaml` - Add agent definition
2. `src/agent-sources/{agent-name}/intro.md` - Create
3. `src/agent-sources/{agent-name}/workflow.md` - Create
4. `src/agent-sources/{agent-name}/examples.md` - Create
5. `src/agent-sources/{agent-name}/critical-requirements.md` - Create
6. `src/agent-sources/{agent-name}/critical-reminders.md` - Create
7. `src/profiles/home/config.yaml` - Add agent config
8. `src/profiles/work/config.yaml` - Add agent config (if applicable)
9. Maybe: `src/skills.yaml` - Add new skills
10. Maybe: `src/profiles/{profile}/skills/{category}/{skill}.md` - Create skill files

**Time for new contributor:** 45-60 minutes (based on research findings)

---

### Proposed Solution: Scaffolding CLI

**Command:**

```bash
# Interactive mode
npm run create:agent

# Quick mode with flags
npm run create:agent -- --name=api-optimizer --archetype=developer --profiles=home,work
```

---

### CLI Script: `scripts/create-agent.ts`

```typescript
#!/usr/bin/env bun
/**
 * Agent Scaffolding CLI
 *
 * Reduces agent creation from 45-60 minutes to ~2 minutes by:
 * 1. Interactive prompts for agent configuration
 * 2. Template-based file generation from archetypes
 * 3. Automatic updates to agents.yaml and profile configs
 */

import { parseArgs } from "util";
import { resolve, join } from "path";

// =============================================================================
// Types
// =============================================================================

type Archetype = "developer" | "reviewer" | "researcher" | "pm" | "custom";

interface AgentScaffoldConfig {
  name: string;
  title: string;
  description: string;
  archetype: Archetype;
  profiles: string[];
  model: "opus" | "sonnet";
  tools: string[];
  precompiledSkills: string[];
  dynamicSkills: string[];
}

// =============================================================================
// Archetypes - Template configurations
// =============================================================================

const ARCHETYPES: Record<Archetype, Partial<AgentScaffoldConfig>> = {
  developer: {
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
  },
  reviewer: {
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
  },
  researcher: {
    tools: ["Read", "Grep", "Glob", "Bash"], // No Write/Edit
    model: "opus",
  },
  pm: {
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
  },
  custom: {
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
  },
};

const PROMPT_SETS: Record<Archetype, { core: string[]; ending: string[] }> = {
  developer: {
    core: ["core-principles", "investigation-requirement", "write-verification", "anti-over-engineering"],
    ending: ["context-management", "improvement-protocol"],
  },
  reviewer: {
    core: ["core-principles", "investigation-requirement", "write-verification"],
    ending: ["context-management", "improvement-protocol"],
  },
  researcher: {
    core: ["core-principles", "investigation-requirement", "write-verification"],
    ending: ["context-management", "improvement-protocol"],
  },
  pm: {
    core: ["core-principles", "investigation-requirement", "write-verification"],
    ending: ["context-management", "improvement-protocol"],
  },
  custom: {
    core: ["core-principles", "investigation-requirement", "write-verification"],
    ending: ["context-management", "improvement-protocol"],
  },
};

// =============================================================================
// Interactive Prompts (using Bun's built-in)
// =============================================================================

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  process.stdout.write(`${question}${suffix}: `);

  for await (const line of console) {
    return line.trim() || defaultValue || "";
  }
  return defaultValue || "";
}

async function promptChoice<T extends string>(
  question: string,
  choices: T[],
  defaultChoice?: T
): Promise<T> {
  console.log(`\n${question}`);
  choices.forEach((choice, i) => {
    const marker = choice === defaultChoice ? " (default)" : "";
    console.log(`  ${i + 1}. ${choice}${marker}`);
  });

  const answer = await prompt("Enter number or name");

  // Check if answer is a number
  const num = parseInt(answer);
  if (!isNaN(num) && num >= 1 && num <= choices.length) {
    return choices[num - 1];
  }

  // Check if answer matches a choice
  const match = choices.find(c => c.toLowerCase() === answer.toLowerCase());
  if (match) return match;

  // Return default or first choice
  return defaultChoice || choices[0];
}

async function promptMultiple(question: string, available: string[]): Promise<string[]> {
  console.log(`\n${question}`);
  console.log("Available: " + available.join(", "));
  const answer = await prompt("Enter comma-separated list (or 'all')");

  if (answer.toLowerCase() === "all") {
    return available;
  }

  return answer.split(",").map(s => s.trim()).filter(s => available.includes(s));
}

// =============================================================================
// File Templates
// =============================================================================

const TEMPLATES = {
  intro: (config: AgentScaffoldConfig) => `# ${config.title}

<role>
You are an expert ${config.archetype} agent specializing in [DOMAIN].

**Your responsibilities:**
- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

</role>

---

<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (loaded at beginning):**
${PROMPT_SETS[config.archetype].core.map(p => `- ${p}`).join("\n")}

**Ending Prompts (loaded at end):**
${PROMPT_SETS[config.archetype].ending.map(p => `- ${p}`).join("\n")}

**Pre-compiled Skills (already loaded below):**
${config.precompiledSkills.length > 0 ? config.precompiledSkills.map(s => `- ${s}`).join("\n") : "(none)"}

**Dynamic Skills (invoke when needed):**
${config.dynamicSkills.length > 0 ? config.dynamicSkills.map(s => `- ${s}`).join("\n") : "(none)"}

</preloaded_content>

---
`,

  workflow: (config: AgentScaffoldConfig) => `## Your Process

<mandatory_investigation>
**BEFORE any work:**
1. Understand the request completely
2. Identify files to examine
3. Read similar implementations
4. Base analysis on actual code, not assumptions
</mandatory_investigation>

---

<${config.archetype}_workflow>
## ${config.archetype.charAt(0).toUpperCase() + config.archetype.slice(1)} Workflow

### Step 1: Investigation
[Describe investigation process]

### Step 2: Planning
[Describe planning process]

### Step 3: Execution
[Describe execution process]

### Step 4: Verification
[Describe verification process]

</${config.archetype}_workflow>

---

<self_correction_triggers>
## Self-Correction Checkpoints

**If you notice yourself:**
- **[Bad pattern 1]** -> STOP. [Correction]
- **[Bad pattern 2]** -> STOP. [Correction]
- **[Bad pattern 3]** -> STOP. [Correction]

</self_correction_triggers>

---

<progress_tracking>
## Progress Tracking

After each major action:
1. What was accomplished?
2. What gaps remain?
3. Should I adjust my approach?

</progress_tracking>

---

## Domain Scope

**You handle:**
- [Task 1]
- [Task 2]
- [Task 3]

**You DON'T handle:**
- [Out of scope 1] -> [Appropriate agent]
- [Out of scope 2] -> [Appropriate agent]
`,

  examples: (config: AgentScaffoldConfig) => `## Examples

### Example 1: [Common Scenario]

**Input:**
\`\`\`
[Example request]
\`\`\`

**Expected Output:**
\`\`\`
[Example response structure]
\`\`\`

---

### Example 2: [Edge Case]

**Input:**
\`\`\`
[Example edge case request]
\`\`\`

**Expected Output:**
\`\`\`
[Example response for edge case]
\`\`\`
`,

  criticalRequirements: (config: AgentScaffoldConfig) => `<critical_requirements>
## CRITICAL: Before Any Work

**(You MUST [critical rule 1])**

**(You MUST [critical rule 2])**

**(You MUST [critical rule 3])**

</critical_requirements>
`,

  criticalReminders: (config: AgentScaffoldConfig) => `<critical_reminders>
## CRITICAL REMINDERS

**(You MUST [critical rule 1])**

**(You MUST [critical rule 2])**

**(You MUST [critical rule 3])**

**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE.**

</critical_reminders>
`,
};

// =============================================================================
// YAML Update Helpers
// =============================================================================

function generateAgentYamlEntry(config: AgentScaffoldConfig): string {
  return `
  ${config.name}:
    title: ${config.title}
    description: ${config.description}
    model: ${config.model}
    tools:
${config.tools.map(t => `      - ${t}`).join("\n")}
    output_format: output-formats-${config.archetype}
`;
}

function generateProfileConfigEntry(config: AgentScaffoldConfig): string {
  const prompts = PROMPT_SETS[config.archetype];

  let entry = `
  ${config.name}:
    core_prompts:
${prompts.core.map(p => `      - ${p}`).join("\n")}
    ending_prompts:
${prompts.ending.map(p => `      - ${p}`).join("\n")}
    precompiled:`;

  if (config.precompiledSkills.length === 0) {
    entry += " []";
  } else {
    entry += "\n" + config.precompiledSkills.map(s =>
      `      - id: ${s}\n        usage: when working with ${s.split("/")[1]}`
    ).join("\n");
  }

  entry += "\n    dynamic:";

  if (config.dynamicSkills.length === 0) {
    entry += " []";
  } else {
    entry += "\n" + config.dynamicSkills.map(s =>
      `      - id: ${s}\n        usage: when working with ${s.split("/")[1]}`
    ).join("\n");
  }

  return entry;
}

// =============================================================================
// Main CLI
// =============================================================================

async function main() {
  console.log("\n=== Agent Scaffolding CLI ===\n");

  const ROOT = resolve(import.meta.dir, "..");

  // Parse args for quick mode
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      name: { type: "string" },
      archetype: { type: "string" },
      profiles: { type: "string" },
    },
  });

  // Collect configuration
  const config: AgentScaffoldConfig = {
    name: values.name || await prompt("Agent name (kebab-case)", "my-agent"),
    title: "",
    description: "",
    archetype: (values.archetype as Archetype) || await promptChoice(
      "Select archetype:",
      ["developer", "reviewer", "researcher", "pm", "custom"] as Archetype[],
      "developer"
    ),
    profiles: values.profiles?.split(",") || await promptMultiple(
      "Which profiles should include this agent?",
      ["home", "work"]
    ),
    model: "opus",
    tools: [],
    precompiledSkills: [],
    dynamicSkills: [],
  };

  // Fill in archetype defaults
  const archetypeDefaults = ARCHETYPES[config.archetype];
  config.tools = archetypeDefaults.tools || [];
  config.model = archetypeDefaults.model || "opus";

  // Get remaining details
  config.title = await prompt("Agent title", `${config.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Agent`);
  config.description = await prompt("Agent description", `[TODO: Add description for ${config.name}]`);

  // Skill selection
  const availableSkills = [
    "frontend/react", "frontend/styling", "frontend/api", "frontend/client-state",
    "frontend/accessibility", "frontend/performance", "frontend/testing", "frontend/mocking",
    "backend/api", "backend/database", "backend/authentication", "backend/analytics",
    "backend/feature-flags", "backend/email", "backend/observability", "backend/ci-cd",
    "security/security", "shared/reviewing",
    "setup/monorepo", "setup/package", "setup/env", "setup/tooling"
  ];

  config.precompiledSkills = await promptMultiple(
    "Precompiled skills (always loaded):",
    availableSkills
  );

  config.dynamicSkills = await promptMultiple(
    "Dynamic skills (loaded on-demand):",
    availableSkills.filter(s => !config.precompiledSkills.includes(s))
  );

  // Show summary
  console.log("\n=== Configuration Summary ===");
  console.log(`Name: ${config.name}`);
  console.log(`Title: ${config.title}`);
  console.log(`Archetype: ${config.archetype}`);
  console.log(`Profiles: ${config.profiles.join(", ")}`);
  console.log(`Precompiled: ${config.precompiledSkills.join(", ") || "(none)"}`);
  console.log(`Dynamic: ${config.dynamicSkills.join(", ") || "(none)"}`);

  const confirm = await prompt("\nProceed with scaffolding? (y/n)", "y");
  if (confirm.toLowerCase() !== "y") {
    console.log("Aborted.");
    return;
  }

  // =============================================================================
  // Scaffold files
  // =============================================================================

  const agentDir = join(ROOT, "agent-sources", config.name);

  console.log("\n=== Creating Files ===\n");

  // 1. Create agent source directory
  await Bun.$`mkdir -p ${agentDir}`;
  console.log(`Created: agent-sources/${config.name}/`);

  // 2. Create agent source files
  const files = [
    { name: "intro.md", content: TEMPLATES.intro(config) },
    { name: "workflow.md", content: TEMPLATES.workflow(config) },
    { name: "examples.md", content: TEMPLATES.examples(config) },
    { name: "critical-requirements.md", content: TEMPLATES.criticalRequirements(config) },
    { name: "critical-reminders.md", content: TEMPLATES.criticalReminders(config) },
  ];

  for (const file of files) {
    await Bun.write(join(agentDir, file.name), file.content);
    console.log(`Created: agent-sources/${config.name}/${file.name}`);
  }

  // 3. Update agents.yaml
  const agentsYamlPath = join(ROOT, "agents.yaml");
  const agentsYaml = await Bun.file(agentsYamlPath).text();
  const newAgentEntry = generateAgentYamlEntry(config);

  // Append before the last closing structure
  const updatedAgentsYaml = agentsYaml.trimEnd() + "\n" + newAgentEntry;
  await Bun.write(agentsYamlPath, updatedAgentsYaml);
  console.log(`Updated: agents.yaml`);

  // 4. Update profile configs
  for (const profile of config.profiles) {
    const profileConfigPath = join(ROOT, "profiles", profile, "config.yaml");

    try {
      const profileConfig = await Bun.file(profileConfigPath).text();
      const newEntry = generateProfileConfigEntry(config);
      const updatedConfig = profileConfig.trimEnd() + "\n" + newEntry + "\n";
      await Bun.write(profileConfigPath, updatedConfig);
      console.log(`Updated: profiles/${profile}/config.yaml`);
    } catch (e) {
      console.log(`Skipped: profiles/${profile}/config.yaml (not found)`);
    }
  }

  // =============================================================================
  // Summary
  // =============================================================================

  console.log("\n=== Scaffolding Complete ===");
  console.log(`
Files created:
  - agent-sources/${config.name}/intro.md
  - agent-sources/${config.name}/workflow.md
  - agent-sources/${config.name}/examples.md
  - agent-sources/${config.name}/critical-requirements.md
  - agent-sources/${config.name}/critical-reminders.md

Files updated:
  - agents.yaml
${config.profiles.map(p => `  - profiles/${p}/config.yaml`).join("\n")}

Next steps:
  1. Edit agent-sources/${config.name}/*.md files to add real content
  2. Run: npm run compile:${config.profiles[0]} to verify compilation
  3. Test the agent with a sample task
`);
}

main().catch(console.error);
```

---

### Example CLI Session

```
$ npm run create:agent

=== Agent Scaffolding CLI ===

Agent name (kebab-case) [my-agent]: api-optimizer

Select archetype:
  1. developer (default)
  2. reviewer
  3. researcher
  4. pm
  5. custom
Enter number or name: 1

Which profiles should include this agent?
Available: home, work
Enter comma-separated list (or 'all'): home

Agent title [Api Optimizer Agent]: API Optimizer Agent
Agent description [[TODO: Add description for api-optimizer]]: Optimizes API routes for performance - analyzes query patterns, adds caching, improves response times

Precompiled skills (always loaded):
Available: frontend/react, frontend/styling, backend/api, backend/database, ...
Enter comma-separated list (or 'all'): backend/api, backend/performance

Dynamic skills (loaded on-demand):
Available: frontend/react, frontend/styling, backend/database, ...
Enter comma-separated list (or 'all'): backend/database, backend/observability

=== Configuration Summary ===
Name: api-optimizer
Title: API Optimizer Agent
Archetype: developer
Profiles: home
Precompiled: backend/api, backend/performance
Dynamic: backend/database, backend/observability

Proceed with scaffolding? (y/n) [y]: y

=== Creating Files ===

Created: agent-sources/api-optimizer/
Created: agent-sources/api-optimizer/intro.md
Created: agent-sources/api-optimizer/workflow.md
Created: agent-sources/api-optimizer/examples.md
Created: agent-sources/api-optimizer/critical-requirements.md
Created: agent-sources/api-optimizer/critical-reminders.md
Updated: agents.yaml
Updated: profiles/home/config.yaml

=== Scaffolding Complete ===

Files created:
  - agent-sources/api-optimizer/intro.md
  - agent-sources/api-optimizer/workflow.md
  - agent-sources/api-optimizer/examples.md
  - agent-sources/api-optimizer/critical-requirements.md
  - agent-sources/api-optimizer/critical-reminders.md

Files updated:
  - agents.yaml
  - profiles/home/config.yaml

Next steps:
  1. Edit agent-sources/api-optimizer/*.md files to add real content
  2. Run: npm run compile:home to verify compilation
  3. Test the agent with a sample task
```

---

### Generated File Example: `intro.md`

```markdown
# API Optimizer Agent

<role>
You are an expert developer agent specializing in API performance optimization.

**Your responsibilities:**
- Analyze API route performance patterns
- Identify and implement caching strategies
- Optimize database queries for better response times

</role>

---

<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (loaded at beginning):**
- core-principles
- investigation-requirement
- write-verification
- anti-over-engineering

**Ending Prompts (loaded at end):**
- context-management
- improvement-protocol

**Pre-compiled Skills (already loaded below):**
- backend/api
- backend/performance

**Dynamic Skills (invoke when needed):**
- backend/database
- backend/observability

</preloaded_content>

---
```

---

### Time Comparison

| Task | Before (Manual) | After (CLI) |
|------|-----------------|-------------|
| Create 5 agent source files | 20-30 min | 5 sec |
| Add to agents.yaml | 5-10 min | Automatic |
| Add to profile configs | 10-15 min | Automatic |
| Total | 45-60 min | ~2 min |

---

## Package.json Script Addition

```json
{
  "scripts": {
    "create:agent": "bun src/scripts/create-agent.ts",
    "create:skill": "bun src/scripts/create-skill.ts",
    "create:profile": "bun src/scripts/create-profile.ts"
  }
}
```

---

## Implementation Recommendation

### Phase 1 (Immediate - 2 hours)
1. Implement YAML anchors in `home/config.yaml`
2. Test compilation still works
3. Apply same pattern to `work/config.yaml`
4. **Result:** 40% line reduction, no code changes

### Phase 2 (Short-term - 4 hours)
1. Add `defaults` to profile config schema
2. Modify `compile.ts` to merge defaults
3. Simplify profile configs to use defaults
4. **Result:** Additional 20-30% reduction

### Phase 3 (Medium-term - 1 day)
1. Create `scripts/create-agent.ts` CLI
2. Add archetype templates
3. Test with new agent creation
4. **Result:** Agent creation drops from 45 min to 2 min

### Phase 4 (Optional - 1 day)
1. Add skill bundles to `skills.yaml` schema
2. Modify compiler to resolve bundles
3. Simplify profile configs to reference bundles
4. **Result:** Additional 10% reduction, easier skill management

---

*Document created: 2026-01-08*
*Based on research findings from Issues Index, DRY Principles (Agent #5), and Profile System (Agent #8)*
