# CLI Commander - Wizard Patterns

> Advanced patterns for multi-step flows, configuration, and dry-run. See [core.md](core.md) for essential patterns.

**Prerequisites**: Understand exit codes (Pattern 2) and cancellation handling (Pattern 4) from core examples first.

---

## Pattern 6: Wizard State Machine

Implement complex multi-step flows with a state machine pattern for back navigation and step control.

#### Constants

```typescript
// Navigation sentinel values
const BACK_VALUE = "__back__";
const CONTINUE_VALUE = "__continue__";

// State machine step types
type WizardStep = "approach" | "selection" | "review" | "confirm";
```

#### State Interface

```typescript
interface WizardState {
  currentStep: WizardStep;
  selectedItems: string[];
  history: WizardStep[]; // For back navigation
  lastSelectedItem: string | null; // For cursor restoration
}

function createInitialState(): WizardState {
  return {
    currentStep: "approach",
    selectedItems: [],
    history: [],
    lastSelectedItem: null,
  };
}
```

#### State Machine Implementation

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";

interface WizardResult {
  selectedItems: string[];
  confirmed: boolean;
}

export async function runWizard(): Promise<WizardResult | null> {
  const state = createInitialState();

  // Main wizard loop
  while (true) {
    switch (state.currentStep) {
      case "approach": {
        const result = await stepApproach(state);

        if (p.isCancel(result)) {
          return null; // User cancelled
        }

        if (result === "scratch") {
          pushHistory(state);
          state.currentStep = "selection";
        } else if (result === "template") {
          // Handle template selection...
        }
        break;
      }

      case "selection": {
        const result = await stepSelection(state);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "approach";
          break;
        }

        if (result === CONTINUE_VALUE) {
          pushHistory(state);
          state.currentStep = "confirm";
          break;
        }

        // Toggle selection
        toggleSelection(state, result as string);
        break;
      }

      case "confirm": {
        const result = await stepConfirm(state);

        if (p.isCancel(result)) {
          return null;
        }

        if (result === BACK_VALUE) {
          state.currentStep = popHistory(state) || "selection";
          break;
        }

        if (result === "confirm") {
          return {
            selectedItems: state.selectedItems,
            confirmed: true,
          };
        }
        break;
      }
    }
  }
}

// History management for back navigation
function pushHistory(state: WizardState): void {
  state.history.push(state.currentStep);
}

function popHistory(state: WizardState): WizardStep | null {
  return state.history.pop() || null;
}

function toggleSelection(state: WizardState, item: string): void {
  const index = state.selectedItems.indexOf(item);
  if (index > -1) {
    state.selectedItems.splice(index, 1);
  } else {
    state.selectedItems.push(item);
  }
  state.lastSelectedItem = item;
}
```

**Why good:** State machine makes complex flows manageable, history stack enables natural back navigation, separation of step functions keeps code organized, cancellation handled at every step

---

## Pattern 7: Configuration Hierarchy

Implement config resolution with clear precedence chain: flag > env > project > global > default.

```typescript
// src/cli/lib/config.ts
import path from "path";
import os from "os";
import { parse as parseYaml } from "yaml";

// Config locations
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".myapp");
export const GLOBAL_CONFIG_FILE = "config.yaml";
const PROJECT_CONFIG_DIR = ".myapp";
const PROJECT_CONFIG_FILE = "config.yaml";

// Environment variable name
export const SOURCE_ENV_VAR = "MYAPP_SOURCE";

// Default value
export const DEFAULT_SOURCE = "github:myorg/default-repo";

export interface GlobalConfig {
  source?: string;
  author?: string;
}

export interface ProjectConfig {
  source?: string;
}

export interface ResolvedConfig {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "global" | "default";
}

/**
 * Resolve configuration with precedence:
 * 1. CLI flag (--source)
 * 2. Environment variable (MYAPP_SOURCE)
 * 3. Project config (.myapp/config.yaml)
 * 4. Global config (~/.myapp/config.yaml)
 * 5. Default value
 */
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  // 1. CLI flag takes highest priority
  if (flagValue !== undefined) {
    if (flagValue.trim() === "") {
      throw new Error("--source flag cannot be empty");
    }
    return { source: flagValue, sourceOrigin: "flag" };
  }

  // 2. Environment variable
  const envValue = process.env[SOURCE_ENV_VAR];
  if (envValue) {
    return { source: envValue, sourceOrigin: "env" };
  }

  // 3. Project config
  if (projectDir) {
    const projectConfig = await loadProjectConfig(projectDir);
    if (projectConfig?.source) {
      return { source: projectConfig.source, sourceOrigin: "project" };
    }
  }

  // 4. Global config
  const globalConfig = await loadGlobalConfig();
  if (globalConfig?.source) {
    return { source: globalConfig.source, sourceOrigin: "global" };
  }

  // 5. Default
  return { source: DEFAULT_SOURCE, sourceOrigin: "default" };
}

export function formatSourceOrigin(
  origin: ResolvedConfig["sourceOrigin"],
): string {
  switch (origin) {
    case "flag":
      return "--source flag";
    case "env":
      return `${SOURCE_ENV_VAR} environment variable`;
    case "project":
      return "project config (.myapp/config.yaml)";
    case "global":
      return "global config (~/.myapp/config.yaml)";
    case "default":
      return "default";
  }
}
```

**Why good:** Clear precedence chain documented in JSDoc, each source explicitly named in the origin union, `formatSourceOrigin` provides user-friendly display for diagnostics

---

## Pattern 8: Dry-Run Mode

Implement preview functionality for destructive operations.

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";

export async function executeWithDryRun(
  dryRun: boolean,
  operations: Array<{ description: string; execute: () => Promise<void> }>,
): Promise<void> {
  if (dryRun) {
    p.log.info(pc.yellow("[dry-run] Preview mode - no changes will be made"));
    console.log("");

    for (const op of operations) {
      console.log(pc.yellow(`[dry-run] Would: ${op.description}`));
    }

    console.log("");
    p.outro(pc.green("[dry-run] Preview complete"));
    return;
  }

  // Execute for real
  const s = p.spinner();
  for (const op of operations) {
    s.start(op.description);
    await op.execute();
    s.stop(`Done: ${op.description}`);
  }
}

// Usage in command action
// .action(async (options, command) => {
//   const dryRun = command.optsWithGlobals().dryRun ?? false;
//
//   await executeWithDryRun(dryRun, [
//     {
//       description: "Create config file",
//       execute: async () => { await writeFile(configPath, content); },
//     },
//     {
//       description: "Install dependencies",
//       execute: async () => { await installDeps(); },
//     },
//   ]);
// });
```

**Why good:** Single function handles both modes, operations are declarative (description + executor), spinner feedback during real execution, clear preview output in dry-run
