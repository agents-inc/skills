# Simplified Architecture Migration Research

> **Generated:** 2026-01-25
> **Purpose:** Research findings to support migration from multi-stack to single-plugin architecture

---

## Stack References

\_Findings from Stack References Agent - investigating `.claude-collective/`, `stack` references, and `COLLECTIVE\__` constants\*

**Research Date:** 2026-01-25
**Files Examined:** 27 source files across src/cli/
**All Paths Verified:** Yes

---

### Files Referencing `.claude-collective/`

| File                          | Purpose             | References                              | Action   |
| ----------------------------- | ------------------- | --------------------------------------- | -------- |
| `src/cli/consts.ts:17`        | Directory constants | `COLLECTIVE_DIR = ".claude-collective"` | REFACTOR |
| `src/cli/lib/config.ts:48,52` | Config interfaces   | `active_stack` field                    | REFACTOR |
| `src/cli/commands/init.ts`    | Init command        | Stack directory creation                | REFACTOR |
| `src/cli/commands/switch.ts`  | Switch command      | Stack switching                         | REMOVE   |
| `src/cli/commands/edit.ts`    | Edit command        | Stack skills editing                    | REFACTOR |

### Files Referencing `stack` Concepts

| File                                   | Purpose                 | Stack Concepts Used                          | Action   |
| -------------------------------------- | ----------------------- | -------------------------------------------- | -------- |
| `src/cli/commands/list.ts`             | List stacks command     | `getStacksInfo`, `formatStackDisplay`        | REFACTOR |
| `src/cli/commands/switch.ts`           | Switch active stack     | Entire file is stack-based                   | REMOVE   |
| `src/cli/commands/update.ts`           | Deprecated update       | Stack references                             | REMOVE   |
| `src/cli/lib/stack-list.ts`            | Stack listing utilities | `StackInfo`, `getStacksInfo`                 | REMOVE   |
| `src/cli/lib/stack-config.ts`          | Stack config CRUD       | `StackConfig`, `writeStackConfig`            | REMOVE   |
| `src/cli/lib/stack-skills.ts`          | Stack skill extraction  | `getStackSkillIds`                           | REMOVE   |
| `src/cli/lib/stack-creator.ts`         | Stack creation          | `promptStackName`, `createStackFromSource`   | REFACTOR |
| `src/cli/lib/skill-copier.ts`          | Skill copying           | `copySkillsToStackFromSource`                | REFACTOR |
| `src/cli/lib/config.ts`                | Config management       | `getActiveStack`, `setActiveStack`           | REFACTOR |
| `src/cli/lib/loader.ts`                | Loading utilities       | `loadStack`                                  | REFACTOR |
| `src/cli/lib/resolver.ts`              | Resolution utilities    | `stackToCompileConfig`, `resolveStackSkills` | REFACTOR |
| `src/cli/lib/stack-plugin-compiler.ts` | Plugin compilation      | `compileStackPlugin`, `hashStackConfig`      | REFACTOR |

### COLLECTIVE\_\* Constants

Found in `/home/vince/dev/claude-subagents/src/cli/consts.ts`:

- `COLLECTIVE_DIR = ".claude-collective"` (line 17) - Used in config paths
- `COLLECTIVE_STACKS_SUBDIR = "stacks"` (line 18) - Used in stack paths
- `getProjectCollectiveDir()` (lines 21-23) - Returns `.claude-collective` path
- `getProjectStacksDir()` (lines 25-27) - Returns `.claude-collective/stacks` path
- `getUserCollectiveDir` / `getUserStacksDir` aliases (lines 30-31) - User-level stack paths

### Summary

| Category             | Count |
| -------------------- | ----- |
| Total files affected | 27    |
| Files to REMOVE      | 7     |
| Files to REFACTOR    | 15    |
| Files unchanged      | 5     |

---

## Command Dependencies

_Findings from Command Dependencies Agent - analyzing init.ts, edit.ts, switch.ts, list.ts_

**Research Date:** 2026-01-25
**Files Examined:** 12
**All Paths Verified:** Yes

---

### init.ts

**Location:** `/home/vince/dev/claude-subagents/src/cli/commands/init.ts`
**Lines:** 439

**Current Behavior:**
Creates a new "stack" in `.claude-collective/stacks/<name>/`, copies selected skills to the stack, then either creates a new plugin or prompts to switch to the new stack. Handles first-time plugin creation vs. subsequent stack creation differently.

**Dependencies:**

| Import                                                                    | Source File                    | Used For                                     |
| ------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| `PLUGIN_MANIFEST_DIR`, `PLUGIN_MANIFEST_FILE`, `DIRS`, `getUserStacksDir` | `../consts`                    | Stack directory paths                        |
| `ensureDir`, `writeFile`, `directoryExists`, `copy`, `remove`             | `../utils/fs`                  | File operations                              |
| `runWizard`, `clearTerminal`, `renderSelectionsHeader`                    | `../lib/wizard`                | Skill selection UI                           |
| `loadSkillsMatrixFromSource`                                              | `../lib/source-loader`         | Load skills from source                      |
| `promptStackName`                                                         | `../lib/stack-creator`         | **STACK-RELATED** - Prompt for stack name    |
| `formatSourceOrigin`, `setActiveStack`                                    | `../lib/config`                | **STACK-RELATED** - Set active stack         |
| `copySkillsToStackFromSource`                                             | `../lib/skill-copier`          | **STACK-RELATED** - Copy skills to stack dir |
| `checkPermissions`                                                        | `../lib/permission-checker`    | Permission checking                          |
| `createStackConfig`, `createStackConfigFromSuggested`                     | `../lib/stack-config`          | **STACK-RELATED** - Stack config generation  |
| `generateStackPluginManifest`                                             | `../lib/plugin-manifest`       | Plugin manifest generation                   |
| `loadAllAgents`, `loadPluginSkills`, `loadStack`                          | `../lib/loader`                | Load agents/skills                           |
| `resolveAgents`, `stackToCompileConfig`                                   | `../lib/resolver`              | **STACK-RELATED** - Stack to compile config  |
| `compileAgentForPlugin`                                                   | `../lib/stack-plugin-compiler` | Agent compilation                            |
| `getCollectivePluginDir`                                                  | `../lib/plugin-finder`         | Plugin directory path                        |

**Stack-Related Code:**

| Lines   | Function/Variable                    | Description                                                       |
| ------- | ------------------------------------ | ----------------------------------------------------------------- |
| 10-11   | `getUserStacksDir()` import          | Gets user stacks directory (`.claude-collective/stacks/`)         |
| 28      | `promptStackName` import             | Prompts user for stack name                                       |
| 29      | `setActiveStack` import              | Sets active stack in config                                       |
| 30      | `copySkillsToStackFromSource` import | Copies skills to stack directory                                  |
| 33-35   | `createStackConfig*` imports         | Creates stack config files                                        |
| 38      | `stackToCompileConfig` import        | Converts stack config to compile config                           |
| 84-86   | `getStackOutputPath()`               | Helper to get `~/.claude-collective/stacks/{name}/`               |
| 91-116  | `displayStackSummary()`              | Displays stack creation summary                                   |
| 119     | Command description                  | "Create a new Claude Collective stack"                            |
| 125     | `--name` option                      | "Stack name"                                                      |
| 204-211 | Stack name prompt                    | Calls `promptStackName()`                                         |
| 213-221 | Stack/plugin paths                   | Sets up `stackDir`, `stackSkillsDir`, `pluginDir`, etc.           |
| 224-225 | Plugin existence check               | Determines if first stack or subsequent                           |
| 248-276 | Stack directory creation             | Creates stack dir, copies skills to stack                         |
| 285-309 | Stack config handling                | Uses `loadStack`, `stackToCompileConfig`, creates `compileConfig` |
| 339-345 | Stack config generation              | Creates `stackConfig` from wizard result                          |
| 360-361 | Active stack setting                 | Calls `setActiveStack(stackName)`                                 |
| 381-431 | Plugin exists branch                 | Prompts to switch, copies from stack to plugin                    |

**Migration Plan:**

1. **Remove stack name prompting** (lines 204-211)
   - Change to asking for plugin name or use default "claude-collective"

2. **Remove stack directory creation** (lines 213-221, 248-262)
   - Create plugin directory directly at `.claude/plugins/claude-collective/`
   - No intermediate stack dir

3. **Remove stack config handling** (lines 285-345)
   - No `loadStack`, `createStackConfig`, `stackToCompileConfig`
   - Build `compileConfig` directly from selected skills

4. **Remove active stack tracking** (lines 360-361, 414)
   - No `setActiveStack()` calls

5. **Remove "plugin exists" branch logic** (lines 266, 381-431)
   - If plugin exists, prompt to overwrite or merge
   - No stack switching prompt

6. **Update command description** (line 119)
   - "Create a new Claude Collective plugin" or "Initialize Claude Collective"

7. **Remove stack-related imports** (lines 28, 29, 30, 33-35, 38)
   - Keep: `getCollectivePluginDir`, `generateStackPluginManifest`, `checkPermissions`

---

### edit.ts

**Location:** `/home/vince/dev/claude-subagents/src/cli/commands/edit.ts`
**Lines:** 270

**Current Behavior:**
Gets the active stack, loads its skills, runs wizard with pre-selected skills, then updates the stack and syncs skills to the plugin. Requires an active stack to exist first.

**Dependencies:**

| Import                                                        | Source File               | Used For                                     |
| ------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| `getUserStacksDir`, `DIRS`                                    | `../consts`               | Stack directory paths                        |
| `directoryExists`, `ensureDir`, `remove`, `copy`, `writeFile` | `../utils/fs`             | File operations                              |
| `getCollectivePluginDir`                                      | `../lib/plugin-finder`    | Plugin directory path                        |
| `getActiveStack`, `resolveSource`                             | `../lib/config`           | **STACK-RELATED** - Get active stack         |
| `loadSkillsMatrixFromSource`                                  | `../lib/source-loader`    | Load skills from source                      |
| `runWizard`, `clearTerminal`, `renderSelectionsHeader`        | `../lib/wizard`           | Skill selection UI                           |
| `copySkillsToStackFromSource`                                 | `../lib/skill-copier`     | **STACK-RELATED** - Copy skills to stack     |
| `recompileAgents`                                             | `../lib/agent-recompiler` | Recompile agents                             |
| `bumpPluginVersion`                                           | `../lib/plugin-version`   | Version management                           |
| `fetchAgentDefinitions`                                       | `../lib/agent-fetcher`    | Fetch agent definitions                      |
| `getStackSkillIds`                                            | `../lib/stack-skills`     | **STACK-RELATED** - Get skill IDs from stack |

**Stack-Related Code:**

| Lines   | Function/Variable                    | Description                                        |
| ------- | ------------------------------------ | -------------------------------------------------- |
| 13      | `getUserStacksDir` import            | Gets stacks directory                              |
| 15      | `getActiveStack` import              | Gets currently active stack                        |
| 22      | `copySkillsToStackFromSource` import | Copies skills to stack dir                         |
| 26      | `getStackSkillIds` import            | Reads skill IDs from stack                         |
| 40-46   | Active stack check                   | Gets `activeStack`, errors if none                 |
| 48-49   | Stack directory paths                | `stackDir`, `stackSkillsDir` from active stack     |
| 51-55   | Stack existence check                | Errors if stack skills dir missing                 |
| 57      | Intro message                        | "Edit Stack: {activeStack}"                        |
| 89-102  | Read current skills                  | Gets skill IDs from stack via `getStackSkillIds()` |
| 162-183 | Update stack skills                  | Removes old skills, copies new selection to stack  |
| 185-199 | Sync to plugin                       | Copies from stack to plugin                        |

**Migration Plan:**

1. **Remove active stack dependency** (lines 40-55)
   - Work directly with plugin skills at `.claude/plugins/claude-collective/skills/`

2. **Replace `getStackSkillIds`** (lines 89-102)
   - Create new function `getPluginSkillIds(pluginSkillsDir, matrix)` or refactor existing

3. **Remove stack update step** (lines 162-183)
   - Write directly to plugin skills directory

4. **Remove stack-to-plugin sync** (lines 185-199)
   - No longer needed - editing plugin directly

5. **Update intro message** (line 57)
   - "Edit Plugin Skills" instead of "Edit Stack: {name}"

6. **Remove stack-related imports** (lines 13, 15, 22, 26)
   - Keep: `getCollectivePluginDir`, `recompileAgents`, `bumpPluginVersion`

---

### switch.ts

**Location:** `/home/vince/dev/claude-subagents/src/cli/commands/switch.ts`
**Lines:** 102

**Status:** **REMOVE ENTIRELY**

**Current Behavior:**
Lists available stacks, lets user select one, validates it exists, removes current plugin skills, copies skills from selected stack to plugin, updates active stack config.

**Dependencies:**

| Import                               | Source File            | Used For                             |
| ------------------------------------ | ---------------------- | ------------------------------------ |
| `directoryExists`, `remove`, `copy`  | `../utils/fs`          | File operations                      |
| `getUserStacksDir`                   | `../consts`            | **STACK-RELATED** - Stacks directory |
| `getCollectivePluginDir`             | `../lib/plugin-finder` | Plugin directory path                |
| `setActiveStack`                     | `../lib/config`        | **STACK-RELATED** - Set active stack |
| `getStacksInfo`, `formatStackOption` | `../lib/stack-list`    | **STACK-RELATED** - List stacks      |

**Stack-Related Code:**

- **ALL code is stack-related** - entire purpose is stack switching

**Dependents (who imports this):**

| File                           | Import                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| `src/cli/index.ts:12`          | `import { switchCommand } from "./commands/switch";`                 |
| `src/cli/index.ts:46`          | `program.addCommand(switchCommand);`                                 |
| `src/cli/commands/init.ts:275` | Comment reference: "Copy skills from stack to plugin (switch logic)" |

**Removal Checklist:**

- [ ] Remove `import { switchCommand } from "./commands/switch";` from `src/cli/index.ts` (line 12)
- [ ] Remove `program.addCommand(switchCommand);` from `src/cli/index.ts` (line 46)
- [ ] Delete file `src/cli/commands/switch.ts`
- [ ] Update any documentation referencing `cc switch`

---

### list.ts

**Location:** `/home/vince/dev/claude-subagents/src/cli/commands/list.ts`
**Lines:** 31

**Current Behavior:**
Lists all available stacks with their skill counts and active status.

**Dependencies:**

| Import                                | Source File         | Used For                                      |
| ------------------------------------- | ------------------- | --------------------------------------------- |
| `getStacksInfo`, `formatStackDisplay` | `../lib/stack-list` | **STACK-RELATED** - Get and format stack info |

**Stack-Related Code:**

| Lines | Function/Variable                             | Description                                    |
| ----- | --------------------------------------------- | ---------------------------------------------- |
| 4     | `getStacksInfo`, `formatStackDisplay` imports | Stack info functions                           |
| 8     | Command description                           | "List all stacks"                              |
| 14    | `getStacksInfo()` call                        | Gets stack information                         |
| 16-19 | Empty stacks message                          | "No stacks found"                              |
| 23    | Header                                        | "Stacks:"                                      |
| 25-27 | Stack iteration                               | Displays each stack via `formatStackDisplay()` |

**Migration Plan:**

1. **Change purpose** from listing stacks to showing plugin info

2. **New behavior:**
   - Show plugin version from `plugin.json`
   - Show skill count in plugin
   - Show agent count in plugin
   - Show when plugin was last updated (from version bump)

3. **Replace dependencies:**
   - Remove `getStacksInfo`, `formatStackDisplay` from `stack-list.ts`
   - Create new functions in `plugin-info.ts`:
     - `getPluginInfo(pluginDir)` - returns version, skill count, agent count
     - `formatPluginDisplay(info)` - formats for display

4. **Update command description:**
   - "Show plugin information" instead of "List all stacks"

5. **Consider alias:**
   - Keep `ls` alias but maybe add `info` as primary

---

### Dependency Graph

```
init.ts
├── ../consts.ts
│   ├── PLUGIN_MANIFEST_DIR
│   ├── PLUGIN_MANIFEST_FILE
│   ├── DIRS
│   └── getUserStacksDir ← STACK-RELATED
├── ../utils/fs.ts
├── ../lib/wizard.ts
├── ../lib/source-loader.ts
├── ../lib/stack-creator.ts ← STACK-RELATED (promptStackName)
├── ../lib/config.ts
│   ├── formatSourceOrigin
│   └── setActiveStack ← STACK-RELATED
├── ../lib/skill-copier.ts ← STACK-RELATED (copySkillsToStackFromSource)
├── ../lib/permission-checker.ts
├── ../lib/stack-config.ts ← STACK-RELATED (entire file)
├── ../lib/plugin-manifest.ts
├── ../lib/loader.ts
│   ├── loadAllAgents
│   ├── loadPluginSkills
│   └── loadStack ← STACK-RELATED
├── ../lib/resolver.ts
│   ├── resolveAgents
│   └── stackToCompileConfig ← STACK-RELATED
├── ../lib/stack-plugin-compiler.ts
└── ../lib/plugin-finder.ts

edit.ts
├── ../consts.ts
│   ├── getUserStacksDir ← STACK-RELATED
│   └── DIRS
├── ../utils/fs.ts
├── ../lib/plugin-finder.ts
├── ../lib/config.ts
│   ├── getActiveStack ← STACK-RELATED
│   └── resolveSource
├── ../lib/source-loader.ts
├── ../lib/wizard.ts
├── ../lib/skill-copier.ts ← STACK-RELATED (copySkillsToStackFromSource)
├── ../lib/agent-recompiler.ts
├── ../lib/plugin-version.ts
├── ../lib/agent-fetcher.ts
└── ../lib/stack-skills.ts ← STACK-RELATED (entire file)

switch.ts ← REMOVE ENTIRELY
├── ../consts.ts (getUserStacksDir)
├── ../utils/fs.ts
├── ../lib/plugin-finder.ts
├── ../lib/config.ts (setActiveStack)
└── ../lib/stack-list.ts ← STACK-RELATED (entire file)

list.ts
└── ../lib/stack-list.ts ← STACK-RELATED (entire file)
```

---

### Library Files Analysis

#### Files to REMOVE

| File                          | Lines | Reason                                     |
| ----------------------------- | ----- | ------------------------------------------ |
| `src/cli/lib/stack-list.ts`   | 84    | Only used for stack listing/selection      |
| `src/cli/lib/stack-config.ts` | 98    | Only used for stack config files           |
| `src/cli/lib/stack-skills.ts` | 77    | Only used to read skill IDs from stack dir |

#### Files to REFACTOR

| File                           | Lines | Changes Needed                                                  |
| ------------------------------ | ----- | --------------------------------------------------------------- |
| `src/cli/lib/stack-creator.ts` | 126   | Keep `promptStackName` (rename), remove `createStackFromSource` |
| `src/cli/lib/skill-copier.ts`  | 227   | Change destination from stack to plugin, update paths           |
| `src/cli/lib/config.ts`        | 340   | Remove `getActiveStack`, `setActiveStack` (lines 185-232)       |
| `src/cli/consts.ts`            | 56    | Remove `COLLECTIVE_*` constants, `getUserStacksDir`             |

#### Files to KEEP as-is

| File                              | Reason                            |
| --------------------------------- | --------------------------------- |
| `src/cli/lib/plugin-finder.ts`    | Still needed for plugin directory |
| `src/cli/lib/plugin-manifest.ts`  | Still generate plugin.json        |
| `src/cli/lib/plugin-version.ts`   | Version management unchanged      |
| `src/cli/lib/agent-recompiler.ts` | Agent recompilation unchanged     |
| `src/cli/lib/wizard.ts`           | Skill selection UI unchanged      |
| `src/cli/lib/source-loader.ts`    | Source loading unchanged          |

---

### Impact Summary

| Category                  | Count   | Details                                                         |
| ------------------------- | ------- | --------------------------------------------------------------- |
| Commands to REMOVE        | 1       | `switch.ts`                                                     |
| Commands to REFACTOR      | 3       | `init.ts`, `edit.ts`, `list.ts`                                 |
| Library files to REMOVE   | 3       | `stack-list.ts`, `stack-config.ts`, `stack-skills.ts`           |
| Library files to REFACTOR | 4       | `stack-creator.ts`, `skill-copier.ts`, `config.ts`, `consts.ts` |
| CLI index changes         | 2 lines | Remove switch import and registration                           |

### Estimated Line Changes

| File              | Lines to Remove | Lines to Add | Net Change |
| ----------------- | --------------- | ------------ | ---------- |
| `init.ts`         | ~150            | ~50          | -100       |
| `edit.ts`         | ~80             | ~30          | -50        |
| `list.ts`         | ~20             | ~30          | +10        |
| `switch.ts`       | 102             | 0            | -102       |
| `stack-list.ts`   | 84              | 0            | -84        |
| `stack-config.ts` | 98              | 0            | -98        |
| `stack-skills.ts` | 77              | 0            | -77        |
| `config.ts`       | ~50             | 0            | -50        |
| `consts.ts`       | ~10             | 0            | -10        |
| **Total**         | ~671            | ~110         | **-561**   |

---

## Type Dependencies

_Findings from Type Dependencies Agent - tracing StackConfig, StackInfo, and related types_

### Overview

This section documents all TypeScript types related to the "stack" concept and their usage throughout the codebase. Understanding these type dependencies is critical for migrating from the current multi-stack architecture to a simplified single-plugin model.

**Files Examined:** 15 TypeScript files
**Total Stack-Related Type Occurrences:** 47 across 9 files

---

### Type: StackConfig (Primary - from src/types.ts)

**Defined in:** `/home/vince/dev/claude-subagents/src/types.ts:177-199`

**Structure:**

```typescript
export interface StackConfig {
  id?: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  created?: string;
  updated?: string;
  framework?: string;
  /** Array of skill assignments with preloaded flag */
  skills: SkillAssignment[];
  /** List of agent names this stack supports */
  agents: string[];
  /** Per-agent skill assignments - maps agent name to categories, each with array of skill assignments */
  agent_skills?: Record<string, Record<string, SkillAssignment[]>>;
  /** Lifecycle hooks for the stack plugin */
  hooks?: Record<string, AgentHookDefinition[]>;
  philosophy?: string;
  principles?: string[];
  tags?: string[];
  overrides?: Record<string, StackOverrideRule>;
  metrics?: StackMetrics;
}
```

**Dependencies:**

- `SkillAssignment` (from src/types.ts:25-28)
- `AgentHookDefinition` (from src/types.ts:309-312)
- `StackOverrideRule` (from src/types.ts:201-204)
- `StackMetrics` (from src/types.ts:206-209)

**Used in:**

| File                                   | Usage                                          | Line(s)               |
| -------------------------------------- | ---------------------------------------------- | --------------------- |
| `src/cli/lib/loader.ts`                | Import, function return type, cache value type | 11, 347, 352-376      |
| `src/cli/lib/resolver.ts`              | Import, function parameter type                | 14, 161, 311          |
| `src/cli/lib/resolver.test.ts`         | Import, test fixtures typed as StackConfig     | 7, 105, 127, 139      |
| `src/cli/lib/stack-plugin-compiler.ts` | Import, function parameters                    | 24, 95, 113, 262, 347 |

**Cascade Effects:**

- Removing this type requires updating:
  - `loadStack()` function return type
  - `resolveStackSkills()` function parameter
  - `stackToCompileConfig()` function parameter
  - `hashStackConfig()` function parameter
  - `determineStackVersion()` function parameter
  - `stackHasHooks()` function parameter
  - `compileStackPlugin()` internal usage
  - All test fixtures in resolver.test.ts

---

### Type: StackConfig (Secondary - from src/cli/lib/stack-config.ts)

**Defined in:** `/home/vince/dev/claude-subagents/src/cli/lib/stack-config.ts:14-21`

**Note:** This is a DIFFERENT interface with the same name, used specifically for user-created stacks stored in `~/.claude-collective/stacks/`.

**Structure:**

```typescript
export interface StackConfig {
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  based_on_stack?: string;
  skill_ids: string[];
}
```

**Used in:**

| File                           | Usage                                       | Line(s)            |
| ------------------------------ | ------------------------------------------- | ------------------ |
| `src/cli/lib/stack-config.ts`  | Function return types, parameter types      | 31, 49, 61, 87, 90 |
| `src/cli/lib/stack-creator.ts` | Imports helper functions that use this type | 7-10               |
| `src/cli/commands/init.ts`     | Imports helper functions that use this type | 33-35              |

**Functions using this type:**

- `createStackConfig()` - returns StackConfig
- `createStackConfigFromSuggested()` - returns StackConfig
- `writeStackConfig()` - accepts StackConfig parameter
- `readStackConfig()` - returns Promise<StackConfig | null>
- `updateStackConfig()` - accepts and returns StackConfig

**Cascade Effects:**

- This type represents user stack metadata (NOT the compiled stack plugin config)
- Removing requires updating all stack CRUD operations
- Related types that depend on this: None directly (self-contained)

---

### Type: StackInfo

**Defined in:** `/home/vince/dev/claude-subagents/src/cli/lib/stack-list.ts:11-16`

**Structure:**

```typescript
export interface StackInfo {
  name: string;
  skillCount: number;
  isActive: boolean;
  version?: string;
}
```

**Used in:**

| File                         | Usage                                                    | Line(s)        |
| ---------------------------- | -------------------------------------------------------- | -------------- |
| `src/cli/lib/stack-list.ts`  | Function return type, array element type, parameter type | 21, 31, 54, 68 |
| `src/cli/commands/list.ts`   | Implicitly via getStacksInfo() return                    | 14             |
| `src/cli/commands/switch.ts` | Implicitly via getStacksInfo() return                    | 26, 56-57      |

**Functions using this type:**

- `getStacksInfo()` - returns Promise<StackInfo[]>
- `formatStackDisplay()` - accepts StackInfo parameter
- `formatStackOption()` - accepts StackInfo parameter

**Cascade Effects:**

- Removing this type requires updating:
  - `getStacksInfo()` return type
  - `formatStackDisplay()` parameter
  - `formatStackOption()` parameter
  - list.ts command output loop
  - switch.ts stack selection logic

---

### Type: StackOverrideRule

**Defined in:** `/home/vince/dev/claude-subagents/src/types.ts:201-204`

**Structure:**

```typescript
export interface StackOverrideRule {
  alternatives?: string[];
  locked?: boolean;
}
```

**Used in:**

| File           | Usage                         | Line(s) |
| -------------- | ----------------------------- | ------- |
| `src/types.ts` | Part of StackConfig.overrides | 197     |

**Cascade Effects:**

- Only referenced within StackConfig
- Removing requires removing overrides field from StackConfig

---

### Type: StackMetrics

**Defined in:** `/home/vince/dev/claude-subagents/src/types.ts:206-209`

**Structure:**

```typescript
export interface StackMetrics {
  upvotes?: number;
  downloads?: number;
}
```

**Used in:**

| File           | Usage                       | Line(s) |
| -------------- | --------------------------- | ------- |
| `src/types.ts` | Part of StackConfig.metrics | 198     |

**Cascade Effects:**

- Only referenced within StackConfig
- Removing requires removing metrics field from StackConfig

---

### Type: ResolvedStack (from types-matrix.ts)

**Defined in:** `/home/vince/dev/claude-subagents/src/cli/types-matrix.ts:510-539`

**Structure:**

```typescript
export interface ResolvedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  allSkillIds: string[];
  philosophy: string;
}
```

**Used in:**

| File                           | Usage                                      | Line(s) |
| ------------------------------ | ------------------------------------------ | ------- |
| `src/cli/types-matrix.ts`      | Part of MergedSkillsMatrix.suggestedStacks | 334     |
| `src/cli/lib/stack-config.ts`  | Import, function parameter type            | 4, 48   |
| `src/cli/lib/stack-creator.ts` | Import, function parameter type            | 11, 39  |

**Functions using this type:**

- `createStackConfigFromSuggested()` - accepts ResolvedStack parameter

**Cascade Effects:**

- Used for mapping suggested stacks to user stack configs
- Part of the wizard flow for pre-built stack selection
- Removing requires updating wizard result handling

---

### Type: SuggestedStack (from types-matrix.ts)

**Defined in:** `/home/vince/dev/claude-subagents/src/cli/types-matrix.ts:180-201`

**Structure:**

```typescript
export interface SuggestedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  philosophy: string;
}
```

**Used in:**

| File                      | Usage                                       | Line(s) |
| ------------------------- | ------------------------------------------- | ------- |
| `src/cli/types-matrix.ts` | Part of SkillsMatrixConfig.suggested_stacks | 30      |

**Cascade Effects:**

- Input type from skills-matrix.yaml
- Gets resolved to ResolvedStack during matrix merge

---

### Type: GlobalConfig & ProjectConfig (active_stack field)

**Defined in:** `/home/vince/dev/claude-subagents/src/cli/lib/config.ts:36-53`

**Structure:**

```typescript
export interface GlobalConfig {
  source?: string;
  author?: string;
  active_stack?: string; // <-- Stack reference
}

export interface ProjectConfig {
  source?: string;
  active_stack?: string; // <-- Stack reference
}
```

**Used in:**

| File                         | Usage                                              | Line(s)               |
| ---------------------------- | -------------------------------------------------- | --------------------- |
| `src/cli/lib/config.ts`      | Type definitions, validation, read/write functions | 36-53, 68-97, 117-218 |
| `src/cli/commands/init.ts`   | Via setActiveStack()                               | 361                   |
| `src/cli/commands/switch.ts` | Via setActiveStack()                               | 95                    |
| `src/cli/lib/stack-list.ts`  | Via getActiveStack()                               | 24                    |

**Functions using active_stack:**

- `getActiveStack()` - returns Promise<string | null>
- `setActiveStack()` - accepts stackName parameter
- `isValidGlobalConfig()` - validates active_stack field
- `isValidProjectConfig()` - validates active_stack field

**Cascade Effects:**

- active_stack field tracks which stack is currently "active"
- Removing requires updating config read/write/validate functions
- Impacts switch, list, and init commands

---

### Type Dependency Graph

```
StackConfig (src/types.ts) - Primary compilation config
├── used by: loader.ts (loadStack - reads stacks/{id}/config.yaml)
├── used by: resolver.ts (resolveStackSkills, stackToCompileConfig)
├── used by: stack-plugin-compiler.ts (hashStackConfig, determineStackVersion, compileStackPlugin)
├── used by: resolver.test.ts (test fixtures)
└── depends on: SkillAssignment, AgentHookDefinition, StackOverrideRule, StackMetrics

StackConfig (src/cli/lib/stack-config.ts) - User stack metadata
├── used by: stack-config.ts (CRUD functions)
├── used by: stack-creator.ts (createStackFromSource)
├── used by: init.ts (stack creation flow)
└── depends on: None (self-contained)

StackInfo
├── used by: stack-list.ts (getStacksInfo, formatStackDisplay, formatStackOption)
├── used by: list.ts (display stacks)
└── used by: switch.ts (select stack)

ResolvedStack (types-matrix.ts)
├── used by: stack-config.ts (createStackConfigFromSuggested)
├── used by: stack-creator.ts (wizard result handling)
└── referenced by: MergedSkillsMatrix.suggestedStacks

GlobalConfig.active_stack / ProjectConfig.active_stack
├── used by: config.ts (getActiveStack, setActiveStack)
├── used by: init.ts (activating new stack)
├── used by: switch.ts (switching stacks)
└── used by: stack-list.ts (marking active stack)
```

---

### New Types Needed

After removing/simplifying stack types for single-plugin architecture, we may need:

1. **`PluginConfig`** - Simplified version of StackConfig for the single plugin
   - `name: string`
   - `version: string`
   - `skills: SkillAssignment[]` (or simplified)

2. **`PluginInfo`** - Simplified version of StackInfo for `cc list` display
   - `name: string`
   - `skillCount: number`
   - `version?: string`

3. Remove `active_stack` concept entirely (no need to track which stack is active if there's only one plugin)

4. Consider removing:
   - `StackOverrideRule` - likely not needed
   - `StackMetrics` - can be added later if marketplace needs it
   - `ResolvedStack` - simplify wizard flow
   - `SuggestedStack` - may keep for wizard presets but rename

---

### Removal Order

Based on dependency analysis, the recommended removal order is:

**Phase 1: Remove unused/optional fields**

1. `StackOverrideRule` - no downstream usage beyond type definition
2. `StackMetrics` - no downstream usage beyond type definition
3. `StackConfig.overrides` and `StackConfig.metrics` fields

**Phase 2: Remove user stack infrastructure**

1. `StackConfig` from `stack-config.ts` - user stack CRUD
2. `StackInfo` from `stack-list.ts` - stack listing
3. `active_stack` from `GlobalConfig` and `ProjectConfig`
4. Related functions: `getActiveStack()`, `setActiveStack()`

**Phase 3: Update compilation types**

1. Simplify `StackConfig` in `src/types.ts` or rename to `PluginConfig`
2. Update `loadStack()` -> maybe `loadPluginConfig()` or similar
3. Update `resolveStackSkills()` -> simplify or inline
4. Update `stackToCompileConfig()` -> may be removed if configs merge

**Phase 4: Update commands**

1. `init.ts` - simplify stack creation to plugin installation
2. `switch.ts` - remove entirely (no stack switching)
3. `list.ts` - simplify to show single plugin info

**Phase 5: Update tests**

1. `resolver.test.ts` - update fixtures and test names
2. Add new tests for simplified flow

---

### Files Requiring Changes

| File                                   | Change Type        | Scope                                        |
| -------------------------------------- | ------------------ | -------------------------------------------- |
| `src/types.ts`                         | Modify/Rename      | StackConfig, StackOverrideRule, StackMetrics |
| `src/cli/lib/stack-config.ts`          | Remove or Simplify | Entire file may be removable                 |
| `src/cli/lib/stack-list.ts`            | Remove or Simplify | StackInfo, formatting functions              |
| `src/cli/lib/stack-creator.ts`         | Simplify           | Remove stack creation logic                  |
| `src/cli/lib/loader.ts`                | Modify             | loadStack() function                         |
| `src/cli/lib/resolver.ts`              | Modify             | resolveStackSkills(), stackToCompileConfig() |
| `src/cli/lib/resolver.test.ts`         | Update             | Test fixtures and assertions                 |
| `src/cli/lib/stack-plugin-compiler.ts` | Modify             | Multiple functions using StackConfig         |
| `src/cli/lib/config.ts`                | Modify             | Remove active_stack handling                 |
| `src/cli/commands/init.ts`             | Major Rewrite      | Entire flow changes                          |
| `src/cli/commands/switch.ts`           | Remove             | No longer needed                             |
| `src/cli/commands/list.ts`             | Simplify           | Different output format                      |
| `src/cli/types-matrix.ts`              | Modify             | ResolvedStack, SuggestedStack                |

---

### Research Verification

| Finding                                     | Verification Method          | Status   |
| ------------------------------------------- | ---------------------------- | -------- |
| StackConfig defined in src/types.ts         | Read src/types.ts:177-199    | Verified |
| StackConfig also defined in stack-config.ts | Read stack-config.ts:14-21   | Verified |
| StackInfo defined in stack-list.ts          | Read stack-list.ts:11-16     | Verified |
| 47 total occurrences across 9 files         | Grep with count output       | Verified |
| active_stack in GlobalConfig/ProjectConfig  | Read config.ts:36-53         | Verified |
| ResolvedStack used in wizard flow           | Read types-matrix.ts:510-539 | Verified |

---

## Test Impact

_Findings from Test Impact Agent - identifying tests affected by migration_

**Research Date:** 2026-01-25
**Files Examined:** 17 test files
**All Paths Verified:** Yes

---

### Tests to DELETE

| Test File                          | Lines | Reason                                            |
| ---------------------------------- | ----- | ------------------------------------------------- |
| `src/cli/commands/switch.test.ts`  | 565   | Command being entirely removed                    |
| `src/cli/lib/skill-copier.test.ts` | 32    | Only tests `getStackDir()` which is being removed |

### Tests to UPDATE

| Test File                                             | Lines | Scope of Changes                             |
| ----------------------------------------------------- | ----- | -------------------------------------------- |
| `src/cli/commands/init.test.ts`                       | 685   | Major refactor - remove stack creation tests |
| `src/cli/lib/__tests__/stack-plugin-compiler.test.ts` | 1505  | Path updates, rename references              |
| `src/cli/lib/__tests__/integration.test.ts`           | 658   | Remove "Full Stack Pipeline" tests           |
| `src/cli/lib/__tests__/plugin-manifest.test.ts`       | 377   | Function rename updates                      |
| `src/cli/lib/resolver.test.ts`                        | 150   | Update `stackToCompileConfig` tests          |
| `src/cli/lib/config.test.ts`                          | 298   | Remove `.claude-collective` path tests       |
| `src/cli/lib/source-loader.test.ts`                   | 153   | Minor `suggestedStacks` updates              |

### Tests to KEEP (No Changes)

| Test File                                             | Lines | Reason                                 |
| ----------------------------------------------------- | ----- | -------------------------------------- |
| `src/cli/lib/hash.test.ts`                            | 47    | Pure utility - no stack references     |
| `src/cli/lib/versioning.test.ts`                      | 134   | Pure utility - no stack references     |
| `src/cli/lib/loader.test.ts`                          | 139   | Frontmatter parsing - no stack refs    |
| `src/cli/lib/source-fetcher.test.ts`                  | 111   | Source fetching - no stack refs        |
| `src/cli/lib/__tests__/plugin-validator.test.ts`      | 685   | Plugin validation - no stack refs      |
| `src/cli/lib/__tests__/skill-plugin-compiler.test.ts` | 729   | Skill compilation - no stack refs      |
| `src/cli/lib/__tests__/marketplace-generator.test.ts` | 481   | Marketplace generation - no stack refs |
| `src/cli/lib/matrix-resolver.test.ts`                 | 515   | Matrix resolution - no stack refs      |

### Summary

| Metric                    | Count                          |
| ------------------------- | ------------------------------ |
| Tests to DELETE           | 2 files (~600 lines)           |
| Tests to UPDATE           | 7 files (~2700 lines affected) |
| Tests unchanged           | 8 files (~2800 lines)          |
| Total test lines analyzed | ~6100 lines                    |

---

## Migration Summary

### Scope Overview

| Category              | Count | Net Line Change                     |
| --------------------- | ----- | ----------------------------------- |
| **Commands**          |       |                                     |
| Commands to REMOVE    | 1     | -102 lines                          |
| Commands to REFACTOR  | 3     | -140 lines                          |
| **Library Files**     |       |                                     |
| Lib files to REMOVE   | 3     | -259 lines                          |
| Lib files to REFACTOR | 8     | -60 lines                           |
| **Tests**             |       |                                     |
| Tests to DELETE       | 2     | -597 lines                          |
| Tests to UPDATE       | 7     | ~500 lines (refactor)               |
| **Types**             |       |                                     |
| Types to REMOVE       | 4     | (StackConfig x2, StackInfo, etc.)   |
| Types to MODIFY       | 3     | (GlobalConfig, ProjectConfig, etc.) |
| **Total Estimated**   |       | **-561 lines (source)**             |

### Prioritized Migration Checklist

#### Phase 1: Remove Stack Switching (Low Risk)

- [ ] Remove `import { switchCommand }` from `src/cli/index.ts:12`
- [ ] Remove `program.addCommand(switchCommand)` from `src/cli/index.ts:46`
- [ ] Delete `src/cli/commands/switch.ts`
- [ ] Delete `src/cli/commands/switch.test.ts`
- [ ] Delete `src/cli/lib/stack-list.ts`

#### Phase 2: Remove Stack Config Infrastructure (Medium Risk)

- [ ] Delete `src/cli/lib/stack-config.ts`
- [ ] Delete `src/cli/lib/stack-skills.ts`
- [ ] Delete `src/cli/lib/skill-copier.test.ts`
- [ ] Remove `getActiveStack()` from `src/cli/lib/config.ts:185-207`
- [ ] Remove `setActiveStack()` from `src/cli/lib/config.ts:209-232`
- [ ] Remove `active_stack` from `GlobalConfig` interface in `src/cli/lib/config.ts:42`
- [ ] Remove `active_stack` from `ProjectConfig` interface in `src/cli/lib/config.ts:52`

#### Phase 3: Remove COLLECTIVE\_\* Constants (Medium Risk)

- [ ] Remove `COLLECTIVE_DIR` from `src/cli/consts.ts:17`
- [ ] Remove `COLLECTIVE_STACKS_SUBDIR` from `src/cli/consts.ts:18`
- [ ] Remove `getProjectCollectiveDir()` from `src/cli/consts.ts:21-23`
- [ ] Remove `getProjectStacksDir()` from `src/cli/consts.ts:25-27`
- [ ] Remove `getUserCollectiveDir` / `getUserStacksDir` from `src/cli/consts.ts:30-31`

#### Phase 4: Refactor Commands (High Complexity)

- [ ] **init.ts**: Remove stack creation, create plugin directly
  - Remove `promptStackName` import and usage
  - Remove `copySkillsToStackFromSource` - use `copySkillsToPluginFromSource`
  - Remove `createStackConfig*` imports
  - Remove `setActiveStack()` calls
  - Update `getStackOutputPath()` → `getPluginOutputPath()`
  - Change command description to "Initialize Claude Collective"
- [ ] **edit.ts**: Edit plugin skills directly
  - Remove `getActiveStack` dependency
  - Replace `getStackSkillIds` with `getPluginSkillIds`
  - Remove stack-to-plugin sync step
  - Update intro message
- [ ] **list.ts**: Show plugin info instead of stack list
  - Create new `plugin-info.ts` with `getPluginInfo()`, `formatPluginDisplay()`
  - Update command description to "Show plugin information"

#### Phase 5: Refactor Library Files (Medium Complexity)

- [ ] **skill-copier.ts**: Change destination from stack to plugin
  - Rename `copySkillsToStackFromSource` → `copySkillsToPluginFromSource`
  - Update all paths from `~/.claude-collective/stacks/` → `.claude/plugins/claude-collective/`
- [ ] **stack-creator.ts**: Simplify or remove
  - Keep `promptStackName` (rename to `promptPluginName`?)
  - Remove `createStackFromSource`
- [ ] **loader.ts**: Update `loadStack()` function
  - May rename to `loadPluginConfig()` or simplify
- [ ] **resolver.ts**: Update stack-related functions
  - Rename/simplify `stackToCompileConfig()`
  - Update `resolveStackSkills()`
- [ ] **stack-plugin-compiler.ts**: Update for plugin-direct model
  - Consider renaming to `plugin-compiler.ts`
  - Update `compileStackPlugin()`, `hashStackConfig()`

#### Phase 6: Update Types (Low Complexity)

- [ ] Remove `StackOverrideRule` from `src/types.ts:201-204`
- [ ] Remove `StackMetrics` from `src/types.ts:206-209`
- [ ] Simplify `StackConfig` in `src/types.ts` or rename to `PluginConfig`
- [ ] Remove `StackInfo` type (deleted with stack-list.ts)
- [ ] Remove `ResolvedStack` from `types-matrix.ts` or rename to `Template`
- [ ] Consider renaming `SuggestedStack` to `SuggestedTemplate`

#### Phase 7: Update Tests (Medium Complexity)

- [ ] Update `src/cli/commands/init.test.ts`
  - Remove `TestDirs.stacksDir`, `TestDirs.collectiveDir`
  - Remove `simulateSubsequentInit()` function
  - Update path expectations
- [ ] Update `src/cli/lib/__tests__/stack-plugin-compiler.test.ts`
  - Consider renaming file
  - Update `createStack()` helper
  - Update path expectations
- [ ] Update `src/cli/lib/__tests__/integration.test.ts`
  - Remove "Full Stack Pipeline" test section
  - Remove `listStacks()` helper
- [ ] Update `src/cli/lib/config.test.ts`
  - Update path expectations from `.claude-collective/`
- [ ] Update `src/cli/lib/resolver.test.ts`
  - Rename/update `stackToCompileConfig` tests

#### Phase 8: Documentation & Cleanup

- [ ] Update any documentation referencing `cc switch`
- [ ] Update README if it mentions stacks
- [ ] Update help text in CLI
- [ ] Consider adding migration prompt for existing `.claude-collective/` users

---

### Risk Assessment

| Phase | Risk   | Mitigation                                 |
| ----- | ------ | ------------------------------------------ |
| 1     | Low    | Self-contained removal, no dependents      |
| 2     | Medium | Update config tests in parallel            |
| 3     | Medium | Update all imports before deletion         |
| 4     | High   | Extensive testing needed, most user-facing |
| 5     | Medium | Ensure all consumers updated first         |
| 6     | Low    | Mostly unused types                        |
| 7     | Medium | Run tests after each phase                 |
| 8     | Low    | Documentation only                         |

### Recommended Execution Order

1. **Start with Phase 1** - Easiest wins, removes dead code
2. **Phase 2 + 3 together** - Config infrastructure cleanup
3. **Phase 4** - Main refactoring work (most time-intensive)
4. **Phase 5** - Library updates (can parallel with Phase 4)
5. **Phase 6** - Type cleanup (after code changes complete)
6. **Phase 7** - Test updates (after functionality stable)
7. **Phase 8** - Final polish
