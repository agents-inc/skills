# CLI Phase 2 Implementation Plan

> **Purpose**: Complete remaining CLI features
> **Date**: 2026-01-11
> **Prerequisite**: Phase 1 complete (core compile functionality working)

---

## Outstanding Features

| Feature | Priority | Complexity | Status |
|---------|----------|------------|--------|
| Fix `cc init` to actually compile | HIGH | Low | DONE (2026-01-11) |
| `cc list stacks/skills/agents` | HIGH | Low | DONE (2026-01-11) |
| `cc create stack` | HIGH | Medium | DONE (2026-01-11) |
| `cc create skill` | MEDIUM | Medium | Not started |
| `cc create agent` | LOW | Medium | Not started |
| `cc update` | LOW | Medium | Not started |

---

## Feature 1: Fix `cc init` (Bug Fix)

**Problem**: When user selects a stack in init wizard, it shows "Stack ready" but doesn't actually compile.

**Current behavior** (lines 203-219 in init.ts):
```typescript
if (config.compile) {
  p.log.step('Running compilation...');
  // Just shows a message, doesn't actually compile
  p.log.info(`Run: ${pc.cyan(`cc compile ${config.stack ? `--stack ${config.stack}` : ''}`)}`);
}
```

**Solution**: Import and call the compile logic directly.

**Implementation**:
```typescript
// Add import at top
import { runCompile } from './compile';

// Replace the compile section with:
if (config.compile && config.stack) {
  await runCompile({ stack: config.stack, verbose: false });
} else if (config.compile) {
  await runCompile({ profile: 'home', verbose: false });
}
```

**Also needed**: Export a `runCompile()` function from `compile.ts` that can be called programmatically (separate from the Commander action).

---

## Feature 2: `cc list` Command

**Purpose**: List available stacks, skills, or agents in a formatted table.

**Usage**:
```bash
cc list stacks      # List all stacks with description
cc list skills      # List all skills grouped by category
cc list agents      # List all agents with description
```

**File**: `src/cli/commands/list.ts`

**Implementation**:
```typescript
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadAllAgents, loadAllSkills } from '../lib/loader';
import { glob, readFile } from '../utils/fs';
import { parse as parseYaml } from 'yaml';
import path from 'path';
import { DIRS } from '../consts';

export const listCommand = new Command('list')
  .description('List available stacks, skills, or agents')
  .argument('<type>', 'What to list: stacks, skills, agents')
  .action(async (type: string) => {
    const projectRoot = process.cwd();

    switch (type) {
      case 'stacks':
        await listStacks(projectRoot);
        break;
      case 'skills':
        await listSkills(projectRoot);
        break;
      case 'agents':
        await listAgents(projectRoot);
        break;
      default:
        p.log.error(`Unknown type: ${type}. Use: stacks, skills, agents`);
        process.exit(1);
    }
  });

async function listStacks(projectRoot: string) {
  const stacksDir = path.join(projectRoot, DIRS.stacks);
  const stackFiles = await glob('*/config.yaml', stacksDir);

  console.log(pc.bold('\nAvailable Stacks:\n'));

  for (const file of stackFiles) {
    const stackId = file.replace('/config.yaml', '');
    const content = await readFile(path.join(stacksDir, file));
    const config = parseYaml(content);

    console.log(`  ${pc.cyan(stackId)}`);
    console.log(`    ${pc.dim(config.description || 'No description')}`);
    console.log(`    ${pc.dim(`${config.agents?.length || 0} agents, ${config.skills?.length || 0} skills`)}\n`);
  }
}

async function listSkills(projectRoot: string) {
  const skills = await loadAllSkills(projectRoot);

  console.log(pc.bold('\nAvailable Skills:\n'));

  // Group by category (first part of path)
  const grouped: Record<string, typeof skills> = {};
  for (const [id, skill] of Object.entries(skills)) {
    const category = skill.path.split('/')[1] || 'other';
    if (!grouped[category]) grouped[category] = {};
    grouped[category][id] = skill;
  }

  for (const [category, categorySkills] of Object.entries(grouped)) {
    console.log(`  ${pc.bold(pc.cyan(category))}`);
    for (const [id, skill] of Object.entries(categorySkills)) {
      console.log(`    ${pc.green(skill.name)} ${pc.dim(`(${id})`)}`);
      console.log(`      ${pc.dim(skill.description)}\n`);
    }
  }
}

async function listAgents(projectRoot: string) {
  const agents = await loadAllAgents(projectRoot);

  console.log(pc.bold('\nAvailable Agents:\n'));

  for (const [id, agent] of Object.entries(agents)) {
    console.log(`  ${pc.cyan(id)}`);
    console.log(`    ${pc.bold(agent.title)}`);
    console.log(`    ${pc.dim(agent.description)}\n`);
  }
}
```

**Register in index.ts**:
```typescript
import { listCommand } from './commands/list';
program.addCommand(listCommand);
```

---

## Feature 3: `cc create stack` Command

**Purpose**: Interactive wizard to create a new stack by selecting skills and agents.

**Usage**:
```bash
cc create stack              # Interactive wizard
cc create stack my-stack     # With name pre-filled
```

**File**: `src/cli/commands/create/stack.ts`

**Wizard Flow**:
1. Enter stack name (kebab-case)
2. Enter description
3. Select agents (multi-select from available)
4. Select skills (multi-select from available, grouped by category)
5. Optionally assign skills to specific agents
6. Generate `src/stacks/{name}/config.yaml` and `src/stacks/{name}/CLAUDE.md`

**Implementation**:
```typescript
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'path';
import { stringify as stringifyYaml } from 'yaml';
import { loadAllAgents, loadAllSkills } from '../../lib/loader';
import { writeFile, fileExists } from '../../utils/fs';
import { DIRS } from '../../consts';

export const createStackCommand = new Command('stack')
  .description('Create a new stack')
  .argument('[name]', 'Stack name (kebab-case)')
  .action(async (providedName?: string) => {
    p.intro(pc.cyan('Create New Stack'));

    const projectRoot = process.cwd();

    // Load available agents and skills
    const agents = await loadAllAgents(projectRoot);
    const skills = await loadAllSkills(projectRoot);

    const config = await p.group({
      name: () => {
        if (providedName) return Promise.resolve(providedName);
        return p.text({
          message: 'Stack name (kebab-case):',
          placeholder: 'my-awesome-stack',
          validate: (v) => {
            if (!v) return 'Name is required';
            if (!/^[a-z0-9-]+$/.test(v)) return 'Use kebab-case (lowercase, hyphens)';
          },
        });
      },

      description: () => p.text({
        message: 'Description:',
        placeholder: 'A stack for...',
      }),

      selectedAgents: () => p.multiselect({
        message: 'Select agents to include:',
        options: Object.entries(agents).map(([id, agent]) => ({
          value: id,
          label: agent.title,
          hint: agent.description.slice(0, 50),
        })),
        required: true,
      }),

      selectedSkills: () => p.multiselect({
        message: 'Select skills to include:',
        options: Object.entries(skills).map(([id, skill]) => ({
          value: id,
          label: skill.name,
          hint: skill.description.slice(0, 50),
        })),
        required: true,
      }),
    }, {
      onCancel: () => {
        p.cancel('Cancelled');
        process.exit(0);
      },
    });

    // Check if stack already exists
    const stackDir = path.join(projectRoot, DIRS.stacks, config.name as string);
    if (await fileExists(stackDir)) {
      const overwrite = await p.confirm({
        message: `Stack "${config.name}" already exists. Overwrite?`,
        initialValue: false,
      });
      if (!overwrite) {
        p.cancel('Cancelled');
        process.exit(0);
      }
    }

    // Generate stack config
    const stackConfig = {
      name: config.name,
      version: '1.0.0',
      author: 'You',
      description: config.description,
      created: new Date().toISOString().split('T')[0],
      agents: config.selectedAgents,
      skills: config.selectedSkills,
    };

    // Write config.yaml
    const configPath = path.join(stackDir, 'config.yaml');
    await writeFile(configPath, stringifyYaml(stackConfig));

    // Write CLAUDE.md template
    const claudeMdPath = path.join(stackDir, 'CLAUDE.md');
    const claudeMdContent = `# ${config.name}

${config.description}

## Stack Philosophy

<!-- Describe the guiding principles for this stack -->

## Quick Reference

<!-- Add quick reference information here -->
`;
    await writeFile(claudeMdPath, claudeMdContent);

    p.outro(pc.green(`Stack created at ${stackDir}`));

    console.log('\n' + pc.dim('Next steps:'));
    console.log(pc.dim('  1. Edit ') + pc.cyan(`${stackDir}/CLAUDE.md`) + pc.dim(' with your guidelines'));
    console.log(pc.dim('  2. Run ') + pc.cyan(`cc compile --stack ${config.name}`));
  });
```

**Parent command** (`src/cli/commands/create/index.ts`):
```typescript
import { Command } from 'commander';
import { createStackCommand } from './stack';
import { createSkillCommand } from './skill';
import { createAgentCommand } from './agent';

export const createCommand = new Command('create')
  .description('Create new stacks, skills, or agents')
  .addCommand(createStackCommand)
  .addCommand(createSkillCommand)
  .addCommand(createAgentCommand);
```

---

## Feature 4: `cc create skill` Command

**Purpose**: Scaffold a new skill with proper folder structure.

**Generated structure**:
```
src/skills/{category}/{skill-name}/
├── SKILL.md           # Main skill content with frontmatter
├── examples.md        # Usage examples (optional)
└── reference.md       # API reference (optional)
```

**Wizard Flow**:
1. Select category (frontend, backend, setup, etc.)
2. Enter skill name
3. Enter description
4. Select model (optional: haiku, sonnet, opus)
5. Generate folder with templates

---

## Feature 5: `cc create agent` Command

**Purpose**: Scaffold a new agent with proper folder structure.

**Generated structure**:
```
src/agent-sources/{agent-name}/
├── agent.yaml         # Agent configuration
├── intro.md           # Agent introduction
├── workflow.md        # Agent workflow
├── examples.md        # Examples (optional)
├── critical-requirements.md  # Critical requirements (optional)
└── critical-reminders.md     # Critical reminders (optional)
```

---

## Feature 6: `cc update` Command (Future)

**Purpose**: Fetch latest skills/stacks from GitHub repository.

**Note**: This is lower priority since the CLI currently works with local content.

---

## Implementation Order

### Batch 1 (Parallel - 3 agents)
1. **Agent 1**: Fix `cc init` bug + refactor compile.ts to export `runCompile()`
2. **Agent 2**: Implement `cc list` command
3. **Agent 3**: Create `src/cli/commands/create/index.ts` parent command structure

### Batch 2 (Parallel - 2 agents, after Batch 1)
4. **Agent 4**: Implement `cc create stack` wizard
5. **Agent 5**: Implement `cc create skill` wizard

### Batch 3 (Optional)
6. **Agent 6**: Implement `cc create agent` wizard
7. **Agent 7**: Implement `cc update` command

---

## Files to Create/Modify

### New Files
- `src/cli/commands/list.ts`
- `src/cli/commands/create/index.ts`
- `src/cli/commands/create/stack.ts`
- `src/cli/commands/create/skill.ts`
- `src/cli/commands/create/agent.ts`

### Modified Files
- `src/cli/commands/compile.ts` - Export `runCompile()` function
- `src/cli/commands/init.ts` - Call `runCompile()` instead of showing message
- `src/cli/index.ts` - Register new commands

---

## Testing Commands

After implementation, test with:
```bash
# Test list
bun src/cli/index.ts list stacks
bun src/cli/index.ts list skills
bun src/cli/index.ts list agents

# Test create stack
bun src/cli/index.ts create stack test-stack

# Test init actually compiles
bun src/cli/index.ts init --stack home-stack

# Verify compilation worked
ls -la .claude/agents/
```

---

_Created: 2026-01-11_
