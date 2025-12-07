# Profile-Based Agent Compilation System

> Specification for migrating from custom `@include()` preprocessor to a **hybrid TypeScript + LiquidJS** system with profile support.

---

## Problem Statement

The current AI agent setup has several issues:

1. **No profile separation** - Personal (home) and work configs are mixed
2. **Duplicated agents** - `frontend-developer.src.md` and `frontend-developer-work.src.md` exist separately
3. **Skill references are hardcoded** - Agents reference specific skill files, not profile-aware paths
4. **Custom `@include()` syntax** - Limited, no conditionals/loops, hard to extend
5. **No validation** - Missing files only discovered at runtime

## Solution

A **hybrid TypeScript + LiquidJS** compilation system:

1. **TypeScript** handles file reading, path resolution, template composition, and validation
2. **LiquidJS** handles simple variable interpolation and loops within templates
3. **Profiles** - `home` and `work` (extensible to more)
4. **Single agent definitions** - Agents are profile-agnostic
5. **Config-driven skills** - YAML config declares which skills each agent uses per profile

### Why Hybrid?

Standard LiquidJS does NOT support:
- `{% layout %}` / `{% block %}` template inheritance (that's Jinja2/Nunjucks syntax)
- Dynamic paths in `{% render %}` (e.g., `{% render 'agents/' | append: name %}` won't work)
- Reading arbitrary `.md` files without configuration

By handling composition in TypeScript, we get:
- Full control over file resolution and error handling
- Simpler, more predictable templates
- Better validation and error messages
- Easier debugging and testing

---

## Architecture Decisions

### 1. TypeScript Drives Composition

TypeScript reads all parts (intro, workflow, core prompts, skills) and passes them as pre-rendered strings to LiquidJS. LiquidJS only handles final assembly with simple variable interpolation and loops.

```typescript
// TypeScript reads everything
const intro = await readFile(`agents/${name}/intro.md`);
const workflow = await readFile(`agents/${name}/workflow.md`);
const corePrompts = await readCorePrompts(['core-principles', 'investigation-requirement']);
const skills = await readSkills(agentConfig.skills.precompiled, profile);

// LiquidJS assembles with simple template
const output = await engine.renderFile('agent.liquid', {
  agent: agentConfig,
  intro,
  workflow,
  corePrompts,
  skills,
});
```

### 2. Agents are profile-agnostic

Agents define structure and behavior. They never change between profiles.

```
agents/
└── frontend-developer/
    ├── intro.md                  # Agent identity and role
    ├── workflow.md               # Agent-specific workflow steps
    ├── examples.md               # Example outputs
    ├── critical-requirements.md  # <critical_requirements> at TOP (PROMPT_BIBLE)
    └── critical-reminders.md     # <critical_reminders> at BOTTOM (PROMPT_BIBLE)
```

### 3. Skills are profile-specific

Each profile has its own skill implementations.

```
profiles/
├── home/skills/frontend/styling.md      # SCSS/cva patterns
└── work/skills/frontend/styling.md      # Tailwind patterns
```

### 4. Config declares everything explicitly

No implicit inheritance. Every skill must be declared in the profile config.

```yaml
# profiles/work/config.yaml
agents:
  frontend-developer:
    skills:
      precompiled:
        - id: frontend/react
          path: skills/frontend/react.md
```

### 5. Core prompts are shared

Core prompts never change between profiles. They live at the root.

```
core-prompts/
├── core-principles.md           # Same for all profiles
└── improvement-protocol.md
```

### 6. CLAUDE.md is profile-specific

Each profile has its own project instructions.

```
profiles/
├── home/CLAUDE.md               # Personal project instructions
└── work/CLAUDE.md               # Photoroom instructions
```

---

## Folder Structure

```
.claude-src/
├── compile.ts                          # Bun + LiquidJS compile script
├── types.ts                            # TypeScript types
├── schema.json                         # JSON Schema for config validation
│
├── agents/                             # Profile-agnostic agent definitions
│   ├── frontend-developer/
│   │   ├── intro.md                    # Agent identity/role
│   │   ├── workflow.md                 # Development workflow steps
│   │   ├── examples.md                 # Example outputs
│   │   ├── critical-requirements.md    # <critical_requirements> at TOP
│   │   └── critical-reminders.md       # <critical_reminders> at BOTTOM
│   ├── backend-developer/
│   │   ├── intro.md
│   │   ├── workflow.md
│   │   ├── examples.md
│   │   ├── critical-requirements.md
│   │   └── critical-reminders.md
│   ├── pm/
│   ├── tester/
│   ├── frontend-reviewer/
│   ├── backend-reviewer/
│   ├── documentor/
│   ├── pattern-scout/
│   ├── pattern-critique/
│   ├── skill-summoner/
│   └── agent-summoner/
│
├── core-prompts/                       # Shared across ALL profiles
│   ├── core-principles.md
│   ├── investigation-requirement.md
│   ├── write-verification.md
│   ├── anti-over-engineering.md
│   ├── improvement-protocol.md
│   ├── context-management.md
│   ├── output-formats-developer.md
│   ├── output-formats-pm.md
│   ├── output-formats-reviewer.md
│   └── output-formats-tester.md
│
├── templates/                          # LiquidJS templates (simple interpolation only)
│   └── agent.liquid                    # Main agent template
│
├── profiles/
│   ├── home/                           # Personal profile
│   │   ├── config.yaml                 # Full config (agents + skills)
│   │   ├── CLAUDE.md                   # Personal project instructions
│   │   └── skills/
│   │       ├── frontend/
│   │       │   ├── react.md
│   │       │   ├── styling.md          # SCSS/cva
│   │       │   ├── client-state.md     # Zustand
│   │       │   ├── api.md
│   │       │   ├── testing.md
│   │       │   ├── accessibility.md
│   │       │   ├── performance.md
│   │       │   └── mocking.md
│   │       ├── backend/
│   │       │   ├── api.md
│   │       │   ├── database.md
│   │       │   └── ci-cd.md
│   │       ├── shared/
│   │       │   └── reviewing.md
│   │       └── security/
│   │           └── security.md
│   │
│   └── work/                           # Photoroom profile
│       ├── config.yaml
│       ├── CLAUDE.md                   # Photoroom instructions
│       └── skills/
│           ├── frontend/
│           │   ├── react.md            # MobX patterns
│           │   ├── styling.md          # Tailwind
│           │   ├── mobx-state.md       # MobX (replaces client-state)
│           │   ├── api.md
│           │   ├── testing.md
│           │   ├── accessibility.md
│           │   ├── performance.md
│           │   └── mocking.md
│           ├── backend/
│           │   ├── api.md
│           │   ├── database.md
│           │   └── ci-cd.md
│           ├── shared/
│           │   └── reviewing.md
│           └── security/
│               └── security.md
│
└── docs/
    ├── CLAUDE_ARCHITECTURE_BIBLE.md    # How agents work (source of truth)
    ├── SKILLS_ARCHITECTURE.md          # Skill definitions (update for new system)
    ├── PROMPT_BIBLE.md                 # Prompt engineering techniques
    └── PROFILE_SYSTEM_SPEC.md          # This file

# Output directory (auto-generated)
.claude/
├── agents/                             # Compiled agents
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
└── skills/                             # Compiled skills
    ├── frontend-react/
    │   └── SKILL.md
    ├── frontend-styling/
    │   └── SKILL.md
    └── ...
```

---

## Config Schema

`profiles/work/config.yaml`:

```yaml
# Profile metadata
name: work
description: Photoroom monorepo

# Profile-specific CLAUDE.md
claude_md: ./CLAUDE.md

# Which core prompts to include for each agent type
# (allows different agents to have different core prompts)
core_prompt_sets:
  developer:
    - core-principles
    - investigation-requirement
    - write-verification
    - anti-over-engineering
    - context-management
    - improvement-protocol
  reviewer:
    - core-principles
    - investigation-requirement
    - improvement-protocol
  pm:
    - core-principles
    - investigation-requirement
    - improvement-protocol

# Agent configurations
agents:
  frontend-developer:
    name: frontend-developer
    title: Frontend Developer Agent
    description: Implements frontend features from detailed specs - React components, TypeScript, styling, client state
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer  # References core_prompt_sets above
    output_format: output-formats-developer  # Which output format to include
    skills:
      precompiled:
        - id: frontend/react
          path: skills/frontend/react.md
          name: React Patterns
          description: Component architecture, hooks, MobX integration
        - id: frontend/styling
          path: skills/frontend/styling.md
          name: Styling Patterns
          description: Tailwind CSS, design tokens, clsx
      dynamic:
        - id: frontend/api
          path: skills/frontend/api.md
          name: API Integration
          description: REST APIs, React Query, data fetching
        - id: frontend/mobx-state
          path: skills/frontend/mobx-state.md
          name: MobX State
          description: MobX stores, reactions, computed values
        - id: frontend/accessibility
          path: skills/frontend/accessibility.md
          name: Accessibility
          description: WCAG, ARIA, keyboard navigation
        - id: frontend/performance
          path: skills/frontend/performance.md
          name: Performance
          description: Bundle optimization, render performance

  pm:
    name: pm
    title: Product Manager Agent
    description: Creates implementation specs by researching codebase patterns
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: pm
    output_format: output-formats-pm
    skills:
      precompiled: []
      dynamic:
        - id: frontend/react
          name: React Patterns
          description: Component architecture context
        - id: frontend/styling
          name: Styling Patterns
          description: Styling approach context
        - id: backend/api
          name: Backend API
          description: API route patterns

  frontend-reviewer:
    name: frontend-reviewer
    title: Frontend Reviewer Agent
    description: Reviews React code - components, hooks, props, state, performance, a11y patterns
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: reviewer
    output_format: output-formats-reviewer
    skills:
      precompiled:
        - id: frontend/react
          path: skills/frontend/react.md
          name: React Patterns
          description: Component patterns for review
        - id: frontend/styling
          path: skills/frontend/styling.md
          name: Styling Patterns
          description: Styling patterns for review
        - id: frontend/accessibility
          path: skills/frontend/accessibility.md
          name: Accessibility
          description: A11y requirements for review
        - id: shared/reviewing
          path: skills/shared/reviewing.md
          name: Review Process
          description: Review methodology and output format
      dynamic:
        - id: frontend/performance
          name: Performance
          description: Performance review criteria
        - id: frontend/mobx-state
          name: MobX State
          description: State management review

  # ... other agents follow same pattern
```

---

## LiquidJS Template

The template is intentionally simple - TypeScript does the heavy lifting.

`templates/agent.liquid`:

```liquid
---
name: {{ agent.name }}
description: {{ agent.description }}
model: {{ agent.model | default: "opus" }}
tools: {{ agent.tools | join: ", " }}
---

# {{ agent.title }}

{{ intro }}

---

<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (already loaded below):**
{% for prompt in corePromptNames %}
- ✅ {{ prompt }}
{% endfor %}

**Pre-compiled Skills (already loaded below):**
{% for skill in skills.precompiled %}
- ✅ {{ skill.name }}
{% endfor %}

**Dynamic Skills (invoke when needed):**
{% for skill in skills.dynamic %}
- Use `skill: "{{ skill.id | replace: "/", "-" }}"` for {{ skill.description }}
{% endfor %}
</preloaded_content>

---

{{ corePromptsContent }}

---

{{ workflow }}

---

## Pre-compiled Skills

{% for skill in skills.precompiled %}
### {{ skill.name }}

{{ skill.content }}

{% unless forloop.last %}---{% endunless %}
{% endfor %}

---

{{ examples }}

---

{{ outputFormat }}

---

{{ contextManagement }}

---

{{ improvementProtocol }}

---

{{ criticalReminders }}

---

**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE TO MAINTAIN INSTRUCTION CONTINUITY.**

**ALWAYS RE-READ FILES AFTER EDITING TO VERIFY CHANGES WERE WRITTEN.**
```

---

## Compile Script

`compile.ts` (Bun + LiquidJS - Hybrid Approach):

```typescript
import { Liquid } from 'liquidjs';
import { parse as parseYaml } from 'yaml';

// =============================================================================
// Types
// =============================================================================

interface Skill {
  id: string;
  path?: string;
  name: string;
  description: string;
  content?: string; // Populated at compile time for precompiled skills
}

interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string; // Key into core_prompt_sets
  output_format: string; // Which output format file to use
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}

interface ProfileConfig {
  name: string;
  description: string;
  claude_md: string;
  core_prompt_sets: Record<string, string[]>;
  agents: Record<string, AgentConfig>;
}

interface CompiledAgentData {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  criticalReminders: string;
  corePromptNames: string[];
  corePromptsContent: string;
  outputFormat: string;
  contextManagement: string;
  improvementProtocol: string;
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}

// =============================================================================
// Configuration
// =============================================================================

const PROFILE = Bun.argv.find(a => a.startsWith('--profile='))?.split('=')[1] ?? 'home';
const VERBOSE = Bun.argv.includes('--verbose');
const ROOT = import.meta.dir;
const OUT = `${ROOT}/../.claude`;

// =============================================================================
// LiquidJS Setup (minimal - just for final template rendering)
// =============================================================================

const engine = new Liquid({
  root: [`${ROOT}/templates`],
  extname: '.liquid',
  strictVariables: true, // Fail on undefined variables
  strictFilters: true,   // Fail on undefined filters
});

// =============================================================================
// File Reading Utilities
// =============================================================================

async function readFile(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }
  return file.text();
}

async function readFileOptional(path: string, fallback = ''): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return fallback;
  }
  return file.text();
}

function log(message: string): void {
  if (VERBOSE) {
    console.log(`  ${message}`);
  }
}

// =============================================================================
// Validation
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

async function validate(config: ProfileConfig): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check CLAUDE.md
  const claudePath = `${ROOT}/profiles/${PROFILE}/${config.claude_md}`;
  if (!(await Bun.file(claudePath).exists())) {
    errors.push(`CLAUDE.md not found: ${claudePath}`);
  }

  // Check core prompts directory exists
  const corePromptsDir = `${ROOT}/core-prompts`;
  if (!(await Bun.file(`${corePromptsDir}/core-principles.md`).exists())) {
    errors.push(`Core prompts directory missing or empty: ${corePromptsDir}`);
  }

  // Check each agent
  for (const [name, agent] of Object.entries(config.agents)) {
    const agentDir = `${ROOT}/agents/${name}`;

    // Required agent files
    const requiredFiles = ['intro.md', 'workflow.md'];
    for (const file of requiredFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        errors.push(`Missing ${file} for agent: ${name}`);
      }
    }

    // Optional agent files (warn if missing)
    const optionalFiles = ['examples.md', 'critical-reminders.md'];
    for (const file of optionalFiles) {
      if (!(await Bun.file(`${agentDir}/${file}`).exists())) {
        warnings.push(`Optional file missing for ${name}: ${file}`);
      }
    }

    // Check core_prompts reference
    if (!config.core_prompt_sets[agent.core_prompts]) {
      errors.push(`Invalid core_prompts reference "${agent.core_prompts}" for agent: ${name}`);
    }

    // Check precompiled skill paths
    for (const skill of agent.skills.precompiled) {
      if (!skill.path) {
        errors.push(`Precompiled skill missing path: ${skill.id} (agent: ${name})`);
        continue;
      }
      const skillPath = `${ROOT}/profiles/${PROFILE}/${skill.path}`;
      if (!(await Bun.file(skillPath).exists())) {
        errors.push(`Skill file not found: ${skill.path} (agent: ${name})`);
      }
    }

    // Check dynamic skills have paths (for compilation to .claude/skills/)
    for (const skill of agent.skills.dynamic) {
      if (!skill.path) {
        warnings.push(`Dynamic skill missing path (won't be compiled): ${skill.id} (agent: ${name})`);
      }
    }
  }

  // Check core prompt files exist
  const allCorePrompts = new Set<string>();
  for (const prompts of Object.values(config.core_prompt_sets)) {
    prompts.forEach(p => allCorePrompts.add(p));
  }
  for (const prompt of allCorePrompts) {
    const promptPath = `${ROOT}/core-prompts/${prompt}.md`;
    if (!(await Bun.file(promptPath).exists())) {
      errors.push(`Core prompt not found: ${prompt}.md`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Agent Compilation
// =============================================================================

async function readCorePrompts(promptNames: string[]): Promise<string> {
  const contents: string[] = [];
  for (const name of promptNames) {
    const content = await readFile(`${ROOT}/core-prompts/${name}.md`);
    contents.push(content);
  }
  return contents.join('\n\n---\n\n');
}

async function readSkillsWithContent(skills: Skill[], profile: string): Promise<Skill[]> {
  const result: Skill[] = [];
  for (const skill of skills) {
    if (!skill.path) continue;
    const content = await readFile(`${ROOT}/profiles/${profile}/${skill.path}`);
    result.push({ ...skill, content });
  }
  return result;
}

async function compileAgent(name: string, agent: AgentConfig, config: ProfileConfig): Promise<string> {
  log(`Reading agent files for ${name}...`);

  // Read agent-specific files
  const agentDir = `${ROOT}/agents/${name}`;
  const intro = await readFile(`${agentDir}/intro.md`);
  const workflow = await readFile(`${agentDir}/workflow.md`);
  const examples = await readFileOptional(`${agentDir}/examples.md`, '## Examples\n\n_No examples defined._');
  const criticalReminders = await readFileOptional(`${agentDir}/critical-reminders.md`, '');

  // Read core prompts for this agent type
  const corePromptNames = config.core_prompt_sets[agent.core_prompts] ?? [];
  const corePromptsContent = await readCorePrompts(corePromptNames);

  // Read output format
  const outputFormat = await readFileOptional(
    `${ROOT}/core-prompts/${agent.output_format}.md`,
    ''
  );

  // Read shared prompts that go at the end
  const contextManagement = await readFileOptional(`${ROOT}/core-prompts/context-management.md`, '');
  const improvementProtocol = await readFileOptional(`${ROOT}/core-prompts/improvement-protocol.md`, '');

  // Read precompiled skills with their content
  const precompiledSkills = await readSkillsWithContent(agent.skills.precompiled, PROFILE);

  // Prepare template data
  const data: CompiledAgentData = {
    agent,
    intro,
    workflow,
    examples,
    criticalReminders,
    corePromptNames: corePromptNames.map(n => n.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    corePromptsContent,
    outputFormat,
    contextManagement,
    improvementProtocol,
    skills: {
      precompiled: precompiledSkills,
      dynamic: agent.skills.dynamic,
    },
  };

  // Render with LiquidJS
  log(`Rendering template for ${name}...`);
  return engine.renderFile('agent', data);
}

async function compileAllAgents(config: ProfileConfig): Promise<void> {
  await Bun.$`mkdir -p ${OUT}/agents`;

  for (const [name, agent] of Object.entries(config.agents)) {
    try {
      const output = await compileAgent(name, agent, config);
      await Bun.write(`${OUT}/agents/${name}.md`, output);
      console.log(`  ✓ ${name}.md`);
    } catch (error) {
      console.error(`  ✗ ${name}.md - ${error}`);
      throw error;
    }
  }
}

// =============================================================================
// Skills Compilation
// =============================================================================

async function compileAllSkills(config: ProfileConfig): Promise<void> {
  // Collect all unique skills with paths
  const allSkills = Object.values(config.agents)
    .flatMap(a => [...a.skills.precompiled, ...a.skills.dynamic])
    .filter(s => s.path);

  const uniqueSkills = [...new Map(allSkills.map(s => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace('/', '-');
    const outDir = `${OUT}/skills/${id}`;
    await Bun.$`mkdir -p ${outDir}`;

    try {
      const content = await readFile(`${ROOT}/profiles/${PROFILE}/${skill.path}`);
      await Bun.write(`${outDir}/SKILL.md`, content);
      console.log(`  ✓ skills/${id}/SKILL.md`);
    } catch (error) {
      console.error(`  ✗ skills/${id}/SKILL.md - ${error}`);
      throw error;
    }
  }
}

// =============================================================================
// CLAUDE.md Compilation
// =============================================================================

async function copyClaude(config: ProfileConfig): Promise<void> {
  const content = await readFile(`${ROOT}/profiles/${PROFILE}/${config.claude_md}`);
  await Bun.write(`${OUT}/../CLAUDE.md`, content);
  console.log(`  ✓ CLAUDE.md`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log(`\n🚀 Compiling profile: ${PROFILE}\n`);

  // Load config
  const configPath = `${ROOT}/profiles/${PROFILE}/config.yaml`;
  let config: ProfileConfig;

  try {
    config = parseYaml(await readFile(configPath));
  } catch (error) {
    console.error(`❌ Failed to load config: ${configPath}`);
    console.error(`   ${error}`);
    process.exit(1);
  }

  // Validate
  console.log('🔍 Validating configuration...');
  const validation = await validate(config);

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (!validation.valid) {
    console.error('\n❌ Validation failed:');
    validation.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ Validation passed\n');

  // Clean output directory
  await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills`;

  // Compile
  console.log('📄 Compiling agents...');
  await compileAllAgents(config);

  console.log('\n📦 Compiling skills...');
  await compileAllSkills(config);

  console.log('\n📋 Copying CLAUDE.md...');
  await copyClaude(config);

  console.log('\n✨ Done!\n');
}

main().catch(error => {
  console.error('❌ Compilation failed:', error);
  process.exit(1);
});
```

---

## TypeScript Types

`types.ts`:

```typescript
export interface Skill {
  id: string;
  path?: string;
  name: string;
  description: string;
  content?: string;
}

export interface AgentConfig {
  name: string;
  title: string;
  description: string;
  model?: string;
  tools: string[];
  core_prompts: string;
  output_format: string;
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}

export interface ProfileConfig {
  name: string;
  description: string;
  claude_md: string;
  core_prompt_sets: Record<string, string[]>;
  agents: Record<string, AgentConfig>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompiledAgentData {
  agent: AgentConfig;
  intro: string;
  workflow: string;
  examples: string;
  criticalReminders: string;
  corePromptNames: string[];
  corePromptsContent: string;
  outputFormat: string;
  contextManagement: string;
  improvementProtocol: string;
  skills: {
    precompiled: Skill[];
    dynamic: Skill[];
  };
}
```

---

## Dependencies

```bash
bun add liquidjs yaml
```

---

## Commands

```bash
# Compile for personal projects
bun .claude-src/compile.ts --profile=home

# Compile for work (Photoroom)
bun .claude-src/compile.ts --profile=work

# Verbose mode (shows file reading progress)
bun .claude-src/compile.ts --profile=work --verbose

# Watch mode (auto-recompile on changes)
bun --watch .claude-src/compile.ts --profile=work
```

Add to `package.json`:

```json
{
  "scripts": {
    "compile": "bun .claude-src/compile.ts",
    "compile:home": "bun .claude-src/compile.ts --profile=home",
    "compile:work": "bun .claude-src/compile.ts --profile=work",
    "compile:watch": "bun --watch .claude-src/compile.ts"
  }
}
```

---

## Migration Steps

### Phase 0: Proof of Concept (DO THIS FIRST)

**Goal:** Validate the hybrid approach works before full migration.

1. Create minimal infrastructure:
   - `compile.ts` with hybrid TypeScript + LiquidJS
   - `templates/agent.liquid`
   - `profiles/home/config.yaml` (with ONE agent only)

2. Migrate ONE agent (`frontend-developer`):
   - Extract `intro.md` from current `.src.md`
   - Extract `workflow.md` from current `.src.md`
   - Create `examples.md` and `critical-reminders.md`

3. Copy skills for that agent:
   - `profiles/home/skills/frontend/react.md`
   - `profiles/home/skills/frontend/styling.md`

4. Run compilation and compare output:
   ```bash
   bun .claude-src/compile.ts --profile=home
   diff .claude/agents/frontend-developer.md .claude/agents/frontend-developer.md.backup
   ```

5. **Iterate until output matches** (or is intentionally improved)

6. Document learnings and adjust spec if needed

### Phase 1: Setup

1. Install dependencies:
   ```bash
   bun add liquidjs yaml
   ```

2. Create new folder structure (keep old files until migration complete)

3. Create `types.ts` and finalized `compile.ts`

### Phase 2: Migrate Core Prompts

1. Rename `core prompts/` → `core-prompts/` (kebab-case, no spaces)
2. No content changes needed - these are plain markdown

### Phase 3: Create Profiles

1. Create `profiles/home/` and `profiles/work/`
2. Create `config.yaml` for each profile with all agents and skills declared
3. Move/copy skills:
   - Current skills → `profiles/home/skills/`
   - Create work-specific versions → `profiles/work/skills/`
4. Create profile-specific `CLAUDE.md` files

### Phase 4: Migrate Agents

For each agent in current `agents/`:

1. Create `agents/{name}/` directory
2. Extract sections from current `.src.md`:
   - **intro.md** - The first paragraph(s) describing the agent's role
   - **workflow.md** - The "Your Development Workflow" or similar section
   - **examples.md** - Example outputs section
   - **critical-reminders.md** - Critical reminders/emphatic rules section

3. Delete `-work` suffix agents (no longer needed - profiles handle this)

### Phase 5: Test and Validate

1. Run `bun compile.ts --profile=home`
2. Run `bun compile.ts --profile=work`
3. Compare output with current compiled agents
4. Fix any discrepancies
5. Test agents in actual Claude Code sessions

### Phase 6: Cleanup

1. Remove old `.claude-src/agents/*.src.md` files
2. Remove old `.claude-src/skills/` (flat structure)
3. Update documentation (CLAUDE_ARCHITECTURE_BIBLE.md, SKILLS_ARCHITECTURE.md)
4. Update any scripts that reference old paths
5. Update `.gitignore` if needed

---

## Validation Rules

The compile script validates:

1. **Profile config exists** - `profiles/{profile}/config.yaml`
2. **CLAUDE.md exists** - Referenced path in config
3. **All agent files exist** - `intro.md`, `workflow.md` (required), `examples.md`, `critical-reminders.md` (optional)
4. **All skill paths exist** - Every `path` in precompiled skills
5. **Core prompt sets are valid** - All referenced `core_prompts` keys exist
6. **Core prompt files exist** - All `.md` files referenced in sets

---

## Hybrid Approach vs Pure LiquidJS

| Aspect | Pure LiquidJS (Original) | Hybrid TypeScript + LiquidJS |
|--------|-------------------------|------------------------------|
| Template inheritance | `{% layout %}` / `{% block %}` (doesn't exist in LiquidJS) | TypeScript composes sections |
| Dynamic paths | `{% render name | append: '.md' %}` (doesn't work) | TypeScript resolves paths |
| File reading | Limited to `.liquid` files in root | Any file, any location |
| Error messages | Generic Liquid errors | Detailed TypeScript errors with context |
| Validation | Runtime only | Pre-compilation validation |
| Testing | Hard to unit test | Easy to test TypeScript functions |
| Debugging | Template debugging is hard | Standard TypeScript debugging |
| Template complexity | Complex templates with blocks | Simple interpolation templates |

---

## Creating a New Profile

To add a new profile (e.g., `personal-tailwind`):

1. Create directory:
   ```bash
   mkdir -p .claude-src/profiles/personal-tailwind/skills/frontend
   ```

2. Create `config.yaml`:
   ```yaml
   name: personal-tailwind
   description: Personal projects with Tailwind

   claude_md: ./CLAUDE.md

   core_prompt_sets:
     developer:
       - core-principles
       - investigation-requirement
       - write-verification
       - anti-over-engineering
       - context-management
       - improvement-protocol

   agents:
     frontend-developer:
       # ... copy from another profile and adjust skills
   ```

3. Copy skills (can symlink or copy from other profiles):
   ```bash
   # Copy home profile skills as base
   cp -r profiles/home/skills/* profiles/personal-tailwind/skills/

   # Override styling with Tailwind version
   cp profiles/work/skills/frontend/styling.md profiles/personal-tailwind/skills/frontend/
   ```

4. Create `CLAUDE.md` for the profile

5. Compile:
   ```bash
   bun compile.ts --profile=personal-tailwind
   ```

---

## Notes

- **No inheritance** - Each profile is explicit and complete
- **Skills can be shared** - Copy or symlink between profiles
- **Agents are always shared** - Only skills differ between profiles
- **Core prompts are global** - Never change per profile
- **TypeScript handles complexity** - Templates stay simple and predictable
- **Validation catches errors early** - No more runtime surprises
