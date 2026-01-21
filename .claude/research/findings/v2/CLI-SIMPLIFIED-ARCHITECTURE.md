# CLI Simplified Architecture

> **Status**: PROPOSED - Simplified based on research
> **Created**: 2026-01-20
> **Philosophy**: Start simple, evolve as needed
> **Target LOC**: ~1,500 (inspired by create-t3-app's ~2,000)

---

## Design Principles

Based on research of create-t3-app, @clack/prompts patterns, and Unix philosophy:

1. **Start Flat** - Begin with minimal files, split only when necessary
2. **Do One Thing Well** - Each function has one purpose
3. **Humans First** - Design for humans, ensure scriptability
4. **Template Copying > Code Generation** - Easier to maintain
5. **No Classes** - Pure functions and typed objects only
6. **Minimal State** - Only track what's needed: selections, current step, history

---

## File Structure (Target: 8 files)

```
src/cli/
├── index.ts              # Entry point (~30 lines)
├── types.ts              # All types (~300 lines, condensed)
├── consts.ts             # Constants (~30 lines)
│
├── commands/
│   ├── init.ts           # Wizard command (~100 lines)
│   └── compile.ts        # Compile command (~150 lines)
│
└── lib/
    ├── matrix.ts         # Load + merge + resolve (~400 lines)
    └── wizard.ts         # Interactive prompts (~400 lines)
```

**Total: 8 files, ~1,410 lines**

Compare to current: 15+ files, ~2,500+ lines

---

## Core Insight: Merge Loader + Resolver

The biggest simplification: **combine matrix-loader.ts and matrix-resolver.ts into one module**.

They share the same data structure and are always used together.

```typescript
// lib/matrix.ts - Single module for all matrix operations

// === LOADING ===
export async function loadMatrix(configPath: string): Promise<Matrix>;
export async function extractSkills(skillsDir: string): Promise<Skill[]>;
export async function mergeMatrix(config: MatrixConfig, skills: Skill[]): Promise<Matrix>;

// === RESOLVING ===
export function isDisabled(skillId: string, selections: string[], matrix: Matrix): boolean;
export function getDisableReason(skillId: string, selections: string[], matrix: Matrix): string | undefined;
export function isRecommended(skillId: string, selections: string[], matrix: Matrix): boolean;
export function getRecommendReason(skillId: string, selections: string[], matrix: Matrix): string | undefined;
export function validateSelections(selections: string[], matrix: Matrix): ValidationResult;
export function getSkillOptions(categoryId: string, selections: string[], matrix: Matrix): SkillOption[];

// === HELPERS ===
export function resolveAlias(aliasOrId: string, matrix: Matrix): string;
export function getCategories(matrix: Matrix): Category[];
export function getSubcategories(parentId: string, matrix: Matrix): Category[];
```

---

## Wizard Pattern: While-Loop with History Stack

We need back navigation and dynamic options based on selections. This requires a state machine, but we keep it **minimal**:

```typescript
// lib/wizard.ts - While-loop wizard with back navigation (~400 lines)

import * as p from '@clack/prompts';
import { getSkillOptions, getCategories, validateSelections } from './matrix';

// Minimal state - only what's needed
type Step = 'approach' | 'stack' | 'category' | 'confirm';

interface WizardState {
  step: Step;
  selections: string[];
  stackId: string | null;
  categoryIndex: number;
  history: Step[];  // For back navigation
}

const BACK = Symbol('back');
const SKIP = Symbol('skip');

export async function runWizard(matrix: Matrix): Promise<WizardResult | null> {
  p.intro('claude-collective');

  const categories = getCategories(matrix);
  const state: WizardState = {
    step: 'approach',
    selections: [],
    stackId: null,
    categoryIndex: 0,
    history: [],
  };

  // Main loop - continues until done or cancelled
  while (true) {
    switch (state.step) {
      case 'approach': {
        const result = await stepApproach();
        if (result === null) return null; // Cancelled
        if (result === 'stack') {
          pushHistory(state, 'stack');
        } else {
          pushHistory(state, 'category');
        }
        break;
      }

      case 'stack': {
        const result = await stepStack(matrix, state);
        if (result === null) return null;
        if (result === BACK) {
          popHistory(state);
        } else {
          state.stackId = result;
          pushHistory(state, 'confirm');
        }
        break;
      }

      case 'category': {
        const category = categories[state.categoryIndex];
        if (!category) {
          // Done with categories
          pushHistory(state, 'confirm');
          break;
        }

        const result = await stepCategory(matrix, state, category);
        if (result === null) return null;
        if (result === BACK) {
          if (state.categoryIndex > 0) {
            state.categoryIndex--;
          } else {
            popHistory(state);
          }
        } else if (result === SKIP) {
          state.categoryIndex++;
        } else {
          // Selected a skill
          handleSelection(state, result, category, matrix);
          state.categoryIndex++;
        }
        break;
      }

      case 'confirm': {
        const result = await stepConfirm(matrix, state);
        if (result === null) return null;
        if (result === BACK) {
          popHistory(state);
        } else {
          // Done!
          p.outro('Configuration complete!');
          return {
            approach: state.stackId ? 'stack' : 'custom',
            stackId: state.stackId ?? undefined,
            skills: state.stackId
              ? matrix.stacks.find(s => s.id === state.stackId)!.skillIds
              : state.selections,
          };
        }
        break;
      }
    }
  }
}

// Step handlers - each returns: value, BACK, SKIP, or null (cancel)

async function stepApproach(): Promise<'stack' | 'custom' | null> {
  const choice = await p.select({
    message: 'How would you like to configure?',
    options: [
      { value: 'stack', label: 'Use a pre-built stack', hint: 'recommended' },
      { value: 'custom', label: 'Custom selection' },
    ],
  });
  return p.isCancel(choice) ? null : choice as 'stack' | 'custom';
}

async function stepStack(matrix: Matrix, state: WizardState): Promise<string | typeof BACK | null> {
  const choice = await p.select({
    message: 'Select a stack:',
    options: [
      { value: BACK, label: '← Back' },
      ...matrix.stacks.map(s => ({ value: s.id, label: s.name, hint: s.description })),
    ],
  });
  if (p.isCancel(choice)) return null;
  return choice as string | typeof BACK;
}

async function stepCategory(
  matrix: Matrix,
  state: WizardState,
  category: Category
): Promise<string | typeof BACK | typeof SKIP | null> {
  // Compute options with disabled/recommended based on current selections
  const options = getSkillOptions(category.id, state.selections, matrix);

  if (options.length === 0) return SKIP;

  const choice = await p.select({
    message: `${category.name}:`,
    options: [
      { value: BACK, label: '← Back' },
      { value: SKIP, label: 'Skip', hint: category.required ? undefined : 'optional' },
      ...options.map(o => ({
        value: o.id,
        label: formatOption(o),
        hint: o.disabled ? `✗ ${o.disabledReason}` : (o.recommended ? '★ recommended' : undefined),
      })),
    ],
  });
  if (p.isCancel(choice)) return null;
  return choice as string | typeof BACK | typeof SKIP;
}

async function stepConfirm(matrix: Matrix, state: WizardState): Promise<boolean | typeof BACK | null> {
  const skills = state.stackId
    ? matrix.stacks.find(s => s.id === state.stackId)!.skillIds
    : state.selections;

  // Show summary
  p.note(
    skills.map(id => `  ${matrix.skills[id]?.name || id}`).join('\n'),
    'Selected skills'
  );

  // Validate
  const validation = validateSelections(skills, matrix);
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => p.log.warn(w.message));
  }

  const choice = await p.select({
    message: 'Confirm selection?',
    options: [
      { value: true, label: 'Confirm', hint: 'generate files' },
      { value: BACK, label: '← Back', hint: 'edit selection' },
    ],
  });
  if (p.isCancel(choice)) return null;
  return choice as boolean | typeof BACK;
}

// Helpers

function pushHistory(state: WizardState, nextStep: Step) {
  state.history.push(state.step);
  state.step = nextStep;
}

function popHistory(state: WizardState) {
  const prev = state.history.pop();
  if (prev) state.step = prev;
}

function handleSelection(state: WizardState, skillId: string, category: Category, matrix: Matrix) {
  // If exclusive category, remove any existing selection from same category
  if (category.exclusive) {
    const existing = state.selections.find(id => matrix.skills[id]?.category === category.id);
    if (existing) {
      state.selections = state.selections.filter(id => id !== existing);
    }
  }
  state.selections.push(skillId);
}

function formatOption(opt: SkillOption): string {
  if (opt.selected) return `✓ ${opt.name}`;
  if (opt.disabled) return `✗ ${opt.name}`;
  if (opt.recommended) return `★ ${opt.name}`;
  return opt.name;
}
```

### Why While-Loop is Necessary

| Requirement | Sequential Prompts | While-Loop |
|-------------|-------------------|------------|
| Dynamic disable/recommend | ✅ | ✅ |
| Back navigation | ❌ | ✅ |
| Edit from summary | ❌ | ✅ |
| Skip categories | ⚠️ awkward | ✅ |

**Key insight**: The while-loop IS the simplest solution that supports back navigation. It's not over-engineering—it's the right tool.

---

## Types: Condensed to Essentials

```typescript
// types.ts - Only what's needed (~300 lines)

// === INPUT (from skills-matrix.yaml) ===
export interface MatrixConfig {
  version: string;
  categories: Record<string, Category>;
  relationships: Relationships;
  suggested_stacks: Stack[];
  skill_aliases: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  parent?: string;
  exclusive: boolean;
  required: boolean;
  order: number;
}

export interface Relationships {
  conflicts: { skills: string[]; reason: string }[];
  recommends: { when: string; suggest: string[]; reason: string }[];
  requires: { skill: string; needs: string[]; needs_any?: boolean; reason: string }[];
  alternatives: { purpose: string; skills: string[] }[];
}

export interface Stack {
  id: string;
  name: string;
  description: string;
  skills: Record<string, Record<string, string>>;
}

// === EXTRACTED (from metadata.yaml files) ===
export interface ExtractedSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  tags: string[];
  path: string;
}

// === MERGED (runtime) ===
export interface Matrix {
  version: string;
  categories: Record<string, Category>;
  skills: Record<string, ResolvedSkill>;
  stacks: ResolvedStack[];
  aliases: Record<string, string>;        // alias -> fullId
  aliasesReverse: Record<string, string>; // fullId -> alias
}

export interface ResolvedSkill {
  id: string;
  alias?: string;
  name: string;
  description: string;
  category: string;
  categoryExclusive: boolean;
  author: string;
  version: string;
  tags: string[];
  path: string;
  // Pre-computed relationships
  conflictsWith: { skillId: string; reason: string }[];
  recommends: { skillId: string; reason: string }[];
  recommendedBy: { skillId: string; reason: string }[];
  requires: { skillIds: string[]; needsAny: boolean; reason: string }[];
  requiredBy: { skillId: string; reason: string }[];
}

export interface ResolvedStack {
  id: string;
  name: string;
  description: string;
  skillIds: string[];
}

// === RUNTIME (wizard state) ===
export interface SkillOption {
  id: string;
  name: string;
  description: string;
  disabled: boolean;
  disabledReason?: string;
  recommended: boolean;
  recommendedReason?: string;
  selected: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: { type: string; message: string; skills: string[] }[];
  warnings: { type: string; message: string; skills: string[] }[];
}

export interface WizardResult {
  approach: 'stack' | 'custom';
  stackId?: string;
  skills: string[];
}

// === CLI ===
export interface InitOptions {
  stack?: string;
  yes?: boolean;
}

export interface CompileOptions {
  stack?: string;
  profile?: string;
  verbose?: boolean;
  dryRun?: boolean;
}
```

**Removed**:
- `MatrixLookupTables` (unused optimization)
- `WizardAction`, `WizardContext` (action/reducer pattern removed)
- `CategoryWithOptions` (compute inline)
- `ResolvedId` (inline the logic)

---

## Commands: Minimal Wrappers

```typescript
// commands/init.ts (~100 lines)
import * as p from '@clack/prompts';
import { loadMatrix, mergeMatrix, extractSkills, validateSelections } from '../lib/matrix';
import { runWizard } from '../lib/wizard';

export async function init(options: InitOptions) {
  const s = p.spinner();

  // Load matrix
  s.start('Loading skills matrix...');
  const config = await loadMatrix(MATRIX_PATH);
  const skills = await extractSkills(SKILLS_DIR);
  const matrix = await mergeMatrix(config, skills);
  s.stop('Loaded skills matrix');

  // Run wizard or use --stack flag
  let result: WizardResult;

  if (options.stack) {
    const stack = matrix.stacks.find(s => s.id === options.stack);
    if (!stack) {
      p.log.error(`Unknown stack: ${options.stack}`);
      process.exit(1);
    }
    result = { approach: 'stack', stackId: options.stack, skills: stack.skillIds };
  } else {
    const wizardResult = await runWizard(matrix);
    if (!wizardResult) {
      process.exit(0); // User cancelled
    }
    result = wizardResult;
  }

  // Validate
  const validation = validateSelections(result.skills, matrix);
  if (!validation.valid) {
    validation.errors.forEach(e => p.log.error(e.message));
    process.exit(1);
  }

  // Show summary
  p.note(
    result.skills.map(id => `  - ${matrix.skills[id]?.name || id}`).join('\n'),
    'Selected skills'
  );

  // TODO: Compile output
  p.log.info('Run `cc compile` to generate files.');
}
```

```typescript
// commands/compile.ts (~150 lines)
import * as p from '@clack/prompts';
import { loadProjectConfig, loadSkillContent, writeOutput } from '../lib/compiler';

export async function compile(options: CompileOptions) {
  const s = p.spinner();

  // Load project config
  s.start('Loading configuration...');
  const config = await loadProjectConfig(PROJECT_CONFIG_PATH);
  s.stop('Loaded configuration');

  if (options.dryRun) {
    p.log.info('Dry run - no files will be written');
  }

  // Load skill content
  s.start('Loading skills...');
  const skills = await loadSkillContent(config.skills, SKILLS_DIR);
  s.stop(`Loaded ${skills.length} skills`);

  // Generate output
  s.start('Generating output...');
  const files = await writeOutput(skills, OUTPUT_DIR, { dryRun: options.dryRun });
  s.stop('Generated output');

  // Summary
  p.note(
    files.map(f => `  ${f}`).join('\n'),
    options.dryRun ? 'Would generate' : 'Generated'
  );

  p.outro('Done!');
}
```

---

## Entry Point: Minimal

```typescript
// index.ts (~30 lines)
#!/usr/bin/env node
import { program } from 'commander';
import { init } from './commands/init';
import { compile } from './commands/compile';
import { version } from '../package.json';

program
  .name('cc')
  .description('Claude Collective CLI')
  .version(version);

program
  .command('init')
  .description('Initialize with interactive wizard')
  .option('-s, --stack <id>', 'Use a pre-built stack')
  .option('-y, --yes', 'Skip confirmations')
  .action(init);

program
  .command('compile')
  .description('Compile skills to output')
  .option('-s, --stack <id>', 'Compile a stack')
  .option('-p, --profile <id>', 'Compile a profile')
  .option('-v, --verbose', 'Verbose output')
  .option('--dry-run', 'Show what would be generated')
  .action(compile);

program.parse();
```

---

## What Changed from Original Proposal

| Aspect | Original Proposal | Simplified |
|--------|-------------------|------------|
| Files | 30+ | 8 |
| Lines | ~2,500+ | ~1,500 |
| Wizard pattern | State machine with actions/reducers | While-loop with history stack |
| matrix-loader + matrix-resolver | 2 files (~900 lines) | 1 file (~400 lines) |
| Types | 676 lines with unused types | ~300 lines, essentials only |
| Error classes | 5 class hierarchy | None (just exit codes) |
| cache-manager | Full giget caching | Deferred to v2 |
| config-manager | User/project persistence | Deferred to v2 |
| Signal handling | 4 signals | Just Ctrl+C via `p.isCancel()` |
| UI components | 6 separate files | Inline in wizard.ts |

---

## What's Kept from Current Implementation

1. **types-matrix.ts organization style** - Sections with `// ===` separators, JSDoc comments
2. **Bidirectional alias maps** - `aliases` and `aliasesReverse` for O(1) lookup
3. **Pre-computed relationships** - `conflictsWith`, `recommends`, `recommendedBy`, etc. on each skill
4. **Validation with typed errors/warnings** - Structured error objects
5. **Spinner pattern** - `@clack/prompts` spinner for async operations
6. **Category hierarchy** - Parent/child categories with `getSubcategories()`

---

## What's Kept from create-t3-app

1. **~2000 LOC target** - Proves this is enough for a full wizard
2. **Installer pattern** - (for future: one file per skill installer)
3. **Pure functions** - No classes
4. **Template copying** - Instead of code generation
5. **CI mode** - `--stack` flag for non-interactive
6. **`@clack/prompts`** - `p.select()`, `p.isCancel()`, `p.spinner()`, `p.note()`

---

## Migration Path

**Phase 1: Consolidate (Now)**
1. Merge `matrix-loader.ts` + `matrix-resolver.ts` → `lib/matrix.ts`
2. Remove unused types from `types-matrix.ts` → `types.ts`
3. Simplify `wizard.ts` to use while-loop with history stack (remove action/reducer pattern)

**Phase 2: Test**
1. Verify all existing functionality works
2. Add `--dry-run` to compile
3. Improve error messages

**Phase 3: Later (v2)**
1. Add cache-manager when network fetching needed
2. Add config persistence when users request it
3. Add installers pattern for skill setup scripts

---

## Exit Codes

Keep it simple (4 codes):

```typescript
// consts.ts
export const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  VALIDATION: 2,
  CANCELLED: 130,
} as const;
```

---

## Key Insight

The original proposal designed for a **production CLI** that doesn't exist yet.

This simplified architecture designs for the **MVP that exists now**: a wizard that loads a YAML config, lets users select skills, and generates output files.

**Start simple. Add complexity only when users need it.**

---

_Research sources: create-t3-app, @clack/prompts, Unix philosophy, current implementation analysis_
