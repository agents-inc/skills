# CLI Implementation Plan: `cc` (Claude Collective CLI)

> **Purpose**: Step-by-step implementation guide for building the `cc` CLI tool.
> **Timeline**: Single staggered programming session
> **Date**: 2026-01-11
> **Status**: ✅ Core implementation complete (Phases 1-5)

---

## Implementation Progress

| Phase                     | Status      | Details                               |
| ------------------------- | ----------- | ------------------------------------- |
| Phase 1: Project Setup    | ✅ Complete | tsup.config.ts, package.json updated  |
| Phase 2: Core Utilities   | ✅ Complete | fs.ts, logger.ts, consts.ts, types.ts |
| Phase 3: Content Loading  | ✅ Complete | loader.ts, resolver.ts, validator.ts  |
| Phase 4: Compiler         | ✅ Complete | compiler.ts with all functions        |
| Phase 5: Commands         | ✅ Complete | index.ts, compile.ts, init.ts         |
| Phase 6: Content Fetching | ⏳ Pending  | fetcher.ts, cache.ts                  |
| Phase 7: Testing & Polish | ⏳ Pending  | Local testing, error handling         |
| Phase 8: Migration        | ⏳ Pending  | Repository split                      |

---

## Tech Stack (Confirmed)

| Package          | Purpose                  | Version |
| ---------------- | ------------------------ | ------- |
| `commander`      | CLI argument parsing     | ^12.x   |
| `@clack/prompts` | Interactive prompts      | ^0.11.x |
| `picocolors`     | Terminal colors          | ^1.x    |
| `giget`          | GitHub content fetching  | ^1.x    |
| `liquidjs`       | Template rendering       | ^10.x   |
| `yaml`           | YAML parsing             | ^2.x    |
| `fast-glob`      | File globbing (Node.js)  | ^3.x    |
| `fs-extra`       | Enhanced file operations | ^11.x   |
| `tsup`           | TypeScript bundling      | ^8.x    |

---

## Phase 1: Project Setup

### Step 1.1: Create CLI directory structure

```
src/cli/
├── index.ts                    # Entry point with shebang
├── commands/
│   ├── init.ts                 # cc init - wizard setup
│   ├── compile.ts              # cc compile - build .claude/
│   ├── update.ts               # cc update - fetch latest
│   ├── list.ts                 # cc list stacks/skills
│   └── create/
│       ├── index.ts            # cc create parent command
│       ├── skill.ts            # cc create skill
│       ├── stack.ts            # cc create stack
│       └── agent.ts            # cc create agent
├── lib/
│   ├── compiler.ts             # Ported compile.ts logic
│   ├── loader.ts               # Content loading (agents, skills, stacks)
│   ├── resolver.ts             # Cascade resolution (template, CLAUDE.md)
│   ├── validator.ts            # Pre-compilation validation
│   ├── fetcher.ts              # GitHub content fetching (giget wrapper)
│   └── cache.ts                # Cache management
├── utils/
│   ├── logger.ts               # Colored logging with picocolors
│   ├── fs.ts                   # File utilities (Node.js replacements for Bun)
│   ├── prompts.ts              # Prompt helpers and shared flows
│   └── pkg-manager.ts          # Detect npm/pnpm/yarn/bun
├── types.ts                    # CLI-specific types
└── consts.ts                   # Constants (paths, defaults)
```

### Step 1.2: Update package.json

```json
{
  "name": "@claude-collective/cc",
  "version": "0.1.0",
  "description": "CLI for managing Claude Collective skills, stacks, and agents",
  "type": "module",
  "bin": {
    "cc": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "cli": "node dist/cli/index.js",
    "cli:dev": "bun src/cli/index.ts"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "@clack/prompts": "^0.11.0",
    "picocolors": "^1.1.0",
    "giget": "^1.2.0",
    "liquidjs": "^10.24.0",
    "yaml": "^2.8.0",
    "fast-glob": "^3.3.0",
    "fs-extra": "^11.2.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.0",
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 1.3: Create tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  sourcemap: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
```

---

## Phase 2: Core Utilities

### Step 2.1: Logger utility (`src/cli/utils/logger.ts`)

```typescript
import pc from 'picocolors'

export const logger = {
  info: (msg: string) => console.log(pc.cyan(msg)),
  success: (msg: string) => console.log(pc.green(msg)),
  warn: (msg: string) => console.log(pc.yellow(msg)),
  error: (msg: string) => console.log(pc.red(msg)),
  dim: (msg: string) => console.log(pc.dim(msg)),
}
```

### Step 2.2: File utilities (`src/cli/utils/fs.ts`)

Port Bun-specific APIs to Node.js equivalents:

```typescript
import fs from 'fs-extra'
import fg from 'fast-glob'
import path from 'path'

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function readFileOptional(filePath: string, fallback = ''): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return fallback
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function glob(pattern: string, cwd: string): Promise<string[]> {
  return fg(pattern, { cwd, onlyFiles: true })
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf-8')
}

export { fs }
```

### Step 2.3: Constants (`src/cli/consts.ts`)

```typescript
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CLI_ROOT = path.resolve(__dirname, '../..')
export const DEFAULT_PROFILE = 'home'
export const OUTPUT_DIR = '.claude'
export const GITHUB_REPO = 'claude-collective/claude-collective'
export const CACHE_DIR_NAME = 'claude-cli'

export const SKILL_SUPPORTING_FILES = ['examples.md', 'reference.md']
```

---

## Phase 3: Content Loading & Resolution

### Step 3.1: Port loader functions (`src/cli/lib/loader.ts`)

- `loadAllAgents()` - Scan agent-sources/\*/agent.yaml
- `loadAllSkills()` - Scan skills/\*\*/SKILL.md + parse frontmatter
- `loadStack()` - Load stack config with caching
- `parseFrontmatter()` - Extract YAML from SKILL.md

### Step 3.2: Port resolver functions (`src/cli/lib/resolver.ts`)

- `resolveTemplate()` - Profile → Stack → Default cascade
- `resolveClaudeMd()` - Profile → Stack cascade
- `resolveStackSkills()` - Get skills from stack for agent
- `resolveAgents()` - Merge agent definitions with config
- `stackToProfileConfig()` - Convert stack to profile-like structure

### Step 3.3: Port validator (`src/cli/lib/validator.ts`)

- `validate()` - Pre-compilation validation with detailed error messages

---

## Phase 4: Compiler

### Step 4.1: Port compile logic (`src/cli/lib/compiler.ts`)

```typescript
import { Liquid } from 'liquidjs';
import type { CompiledAgentData, AgentConfig } from '../types.js';

const engine = new Liquid({
  root: path.join(CLI_ROOT, 'templates'),
  extname: '.liquid',
});

export async function compileAgent(agent: AgentConfig, ...): Promise<string> {
  // Port from compile.ts lines 579-644
  // 1. Read agent files (intro, workflow, examples, etc.)
  // 2. Read core prompts and ending prompts
  // 3. Read output format
  // 4. Prepare template data
  // 5. Render Liquid template
  return engine.renderFile('agent', data);
}

export async function compileAllAgents(...): Promise<void> {
  // Port from compile.ts lines 646-662
}

export async function compileAllSkills(...): Promise<void> {
  // Port from compile.ts lines 671-723
}

export async function copyClaude(...): Promise<void> {
  // Port from compile.ts lines 729-755
}

export async function compileAllCommands(...): Promise<void> {
  // Port from compile.ts lines 761-803
}
```

---

## Phase 5: Commands

### Step 5.1: Main entry point (`src/cli/index.ts`)

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { compileCommand } from './commands/compile.js'
import { createCommand } from './commands/create/index.js'
import { listCommand } from './commands/list.js'
import { updateCommand } from './commands/update.js'

async function main() {
  const program = new Command()

  program.name('cc').description('Claude Collective CLI - Manage skills, stacks, and agents').version('0.1.0')

  program.addCommand(initCommand)
  program.addCommand(compileCommand)
  program.addCommand(createCommand)
  program.addCommand(listCommand)
  program.addCommand(updateCommand)

  await program.parseAsync(process.argv)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
```

### Step 5.2: Compile command (`src/cli/commands/compile.ts`)

```typescript
import { Command, Option } from 'commander'
import * as p from '@clack/prompts'
import { compile } from '../lib/compiler.js'

export const compileCommand = new Command('compile')
  .description('Compile agents from profiles or stacks')
  .addOption(new Option('-p, --profile <name>', 'Profile to compile').conflicts('stack'))
  .addOption(new Option('-s, --stack <name>', 'Stack to compile').conflicts('profile'))
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async options => {
    const s = p.spinner()

    try {
      s.start('Compiling...')
      await compile({
        profile: options.stack ? undefined : options.profile || 'home',
        stack: options.stack,
        verbose: options.verbose,
      })
      s.stop('Compilation complete!')
    } catch (error) {
      s.stop('Compilation failed')
      p.log.error(error.message)
      process.exit(1)
    }
  })
```

### Step 5.3: Init command with wizard (`src/cli/commands/init.ts`)

```typescript
import { Command } from 'commander'
import * as p from '@clack/prompts'
import pc from 'picocolors'

export const initCommand = new Command('init')
  .description('Initialize Claude Collective in your project')
  .option('--stack <name>', 'Use a specific stack')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async options => {
    p.intro(pc.cyan('Claude Collective Setup'))

    const config = await p.group(
      {
        // Skip if --stack provided
        ...(!options.stack && {
          approach: () =>
            p.select({
              message: 'How would you like to set up?',
              options: [
                { value: 'stack', label: 'Use a pre-built stack', hint: 'recommended' },
                { value: 'custom', label: 'Build custom configuration' },
              ],
            }),
        }),

        // Stack selection
        stack: ({ results }) => {
          if (options.stack) return Promise.resolve(options.stack)
          if (results.approach !== 'stack') return Promise.resolve(undefined)

          return p.select({
            message: 'Select a stack:',
            options: [
              { value: 'modern-react', label: 'Modern React', hint: 'SCSS, Zustand, React Query' },
              { value: 'minimal-react', label: 'Minimal React', hint: 'Lightweight setup' },
            ],
          })
        },

        // Custom: Framework selection
        framework: ({ results }) => {
          if (results.approach !== 'custom') return Promise.resolve(undefined)

          return p.select({
            message: 'Select your framework:',
            options: [
              { value: 'react', label: 'React' },
              { value: 'vue', label: 'Vue' },
              { value: 'svelte', label: 'Svelte' },
            ],
          })
        },

        // Custom: State management (React only)
        stateManagement: ({ results }) => {
          if (results.approach !== 'custom') return Promise.resolve(undefined)
          if (results.framework !== 'react') return Promise.resolve(undefined)

          return p.select({
            message: 'Select state management:',
            options: [
              { value: 'zustand', label: 'Zustand', hint: 'recommended' },
              { value: 'redux', label: 'Redux Toolkit' },
              { value: 'none', label: 'None' },
            ],
          })
        },

        // Custom: Styling
        styling: ({ results }) => {
          if (results.approach !== 'custom') return Promise.resolve(undefined)

          return p.select({
            message: 'Select styling approach:',
            options: [
              { value: 'scss-modules', label: 'SCSS Modules + cva' },
              { value: 'tailwind', label: 'Tailwind CSS' },
              { value: 'styled', label: 'Styled Components' },
            ],
          })
        },

        // Confirm compilation
        compile: () =>
          p.confirm({
            message: 'Compile now?',
            initialValue: true,
          }),
      },
      {
        onCancel: () => {
          p.cancel('Setup cancelled')
          process.exit(0)
        },
      },
    )

    // Execute setup based on config
    const s = p.spinner()

    if (config.stack) {
      s.start('Fetching stack...')
      // Use giget to fetch stack
      s.stop('Stack ready')
    }

    if (config.compile) {
      s.start('Compiling...')
      // Run compilation
      s.stop('Compilation complete')
    }

    p.outro(pc.green('Setup complete! Your .claude/ configuration is ready.'))
  })
```

### Step 5.4: Create commands (`src/cli/commands/create/`)

- `create skill` - Interactive skill scaffolding
- `create stack` - Interactive stack scaffolding
- `create agent` - Interactive agent scaffolding

### Step 5.5: List command (`src/cli/commands/list.ts`)

```typescript
export const listCommand = new Command('list')
  .description('List available stacks or skills')
  .argument('<type>', 'What to list: stacks, skills, agents')
  .action(async type => {
    // Display formatted list
  })
```

### Step 5.6: Update command (`src/cli/commands/update.ts`)

```typescript
import { downloadTemplate } from 'giget'

export const updateCommand = new Command('update')
  .description('Update skills and stacks from claude-collective')
  .option('--force', 'Force refresh, ignore cache')
  .action(async options => {
    const s = p.spinner()
    s.start('Fetching latest content...')

    await downloadTemplate(`gh:${GITHUB_REPO}`, {
      dir: '.claude-collective-cache',
      preferOffline: !options.force,
      force: options.force,
    })

    s.stop('Updated to latest')
  })
```

---

## Phase 6: Content Fetching

### Step 6.1: Fetcher module (`src/cli/lib/fetcher.ts`)

```typescript
import { downloadTemplate } from 'giget'
import path from 'path'
import { GITHUB_REPO, CACHE_DIR_NAME } from '../consts.js'

export async function fetchContent(
  subpath: string,
  options: { force?: boolean; destination?: string } = {},
): Promise<string> {
  const cacheDir = path.join(process.env.HOME || '', '.cache', CACHE_DIR_NAME)
  const dest = options.destination || path.join(cacheDir, subpath)

  const result = await downloadTemplate(`gh:${GITHUB_REPO}/${subpath}#main`, {
    dir: dest,
    auth: process.env.GITHUB_TOKEN || process.env.CLAUDE_GITHUB_TOKEN,
    preferOffline: !options.force,
    force: options.force,
  })

  return result.dir
}

export async function fetchSkill(skillPath: string, options = {}) {
  return fetchContent(`skills/${skillPath}`, options)
}

export async function fetchStack(stackId: string, options = {}) {
  return fetchContent(`stacks/${stackId}`, options)
}
```

---

## Phase 7: Testing & Polish

### Step 7.1: Local testing

```bash
# Build
npm run build

# Link for local testing
npm link

# Test commands
cc --help
cc compile --help
cc init
cc compile --profile home
cc compile --stack modern-react
cc list stacks
cc create skill

# Unlink
npm unlink -g @claude-collective/cc
```

### Step 7.2: Error handling polish

- Graceful Ctrl+C handling everywhere
- Clear error messages with suggestions
- Validation before destructive operations

### Step 7.3: Help text and documentation

- Comprehensive `--help` for all commands
- Examples in help text
- Link to documentation

---

## Phase 8: Migration Preparation

### Step 8.1: Verify parity with current compile.ts

```bash
# Current (bun)
bun src/compile.ts --profile=home
cp -r .claude .claude-bun

# New CLI (node)
npm run build && cc compile --profile home
cp -r .claude .claude-node

# Compare
diff -rq .claude-bun .claude-node
```

### Step 8.2: Migration checklist for repository split

1. [ ] Create new `cc` repository
2. [ ] Copy CLI code (`src/cli/`)
3. [ ] Update imports for standalone operation
4. [ ] Add giget fetching for content (instead of local paths)
5. [ ] Strip content repo (remove CLI code)
6. [ ] Rename content repo to `claude-collective`
7. [ ] Publish CLI to npm
8. [ ] Update documentation

---

## Key Implementation Decisions

1. **Build in this repo first** - Easier to test parity with existing compile.ts
2. **Use giget for fetching** - Best maintained, native subdirectory support
3. **ESM-only** - Modern standard, matches create-t3-app
4. **tsup for bundling** - Auto-handles shebang, simple config
5. **@clack/prompts for wizards** - Beautiful UI, conditional flow support
6. **Cache in XDG directories** - Cross-platform standard

---

## Research Sources

Research conducted via multiple parallel agents examining:

- **Commander.js patterns** - Project structure, command organization, TypeScript build setup
- **@clack/prompts patterns** - Conditional flows, validation, error handling, group prompts
- **create-t3-app source** - Real-world reference using same stack (Commander + @clack/prompts)
- **Current compile.ts** - Functions to port, Bun → Node.js API mappings
- **Content fetching** - giget vs degit vs GitHub API, caching strategies

Key findings:

- create-t3-app uses Commander for parsing + @clack/prompts for wizard
- Conditional prompts via `({ results }) =>` callback in `p.group()`
- tsup handles shebang automatically
- giget is best for GitHub fetching (maintained, subdirectory support, caching)
- ESM-only with `.js` extensions in imports

---

## Files Created (2026-01-11)

### Phase 1-2: Foundation

- [x] `tsup.config.ts` - Build configuration for CLI bundling
- [x] `package.json` - Updated with CLI dependencies and scripts
- [x] `src/cli/utils/fs.ts` - File system utilities (Node.js/fs-extra)
- [x] `src/cli/utils/logger.ts` - Colored logging with picocolors
- [x] `src/cli/consts.ts` - CLI constants and paths
- [x] `src/cli/types.ts` - CLI-specific types + re-exports

### Phase 3: Core Logic

- [x] `src/cli/lib/loader.ts` - Content loading (agents, skills, stacks)
- [x] `src/cli/lib/resolver.ts` - Cascade resolution (template, CLAUDE.md, skills)
- [x] `src/cli/lib/validator.ts` - Pre-compilation validation

### Phase 4-5: Compiler + Commands

- [x] `src/cli/lib/compiler.ts` - Compile logic (LiquidJS template rendering)
- [x] `src/cli/commands/compile.ts` - `cc compile` command
- [x] `src/cli/commands/init.ts` - `cc init` wizard
- [x] `src/cli/index.ts` - CLI entry point

### Implementation Notes

- Used `os.homedir()` instead of `process.env.HOME` for cross-platform
- Used `fs.pathExists()` for file existence checks (not `fs.access`)
- Added Commander error handling: `configureOutput()`, `showHelpAfterError()`
- Used `p.tasks()` for multi-step operations in init wizard
- All imports use shared types from `../types.ts`

---

_Created: 2026-01-11_
_Implementation completed: 2026-01-11_
