# CLI Commander - Core Examples

> Essential patterns for Commander.js + @clack/prompts CLI applications. See [SKILL.md](../SKILL.md) for decision frameworks and philosophy.

---

## Pattern 1: CLI Entry Point Structure

Organize the main entry point with global options, signal handling, and command registration.

```typescript
// src/cli/index.ts
import { Command } from "commander";
import pc from "picocolors";
import { initCommand } from "./commands/init";
import { configCommand } from "./commands/config";
import { validateCommand } from "./commands/validate";
import { EXIT_CODES } from "./lib/exit-codes";

// Handle Ctrl+C gracefully - REQUIRED for good UX
process.on("SIGINT", () => {
  console.log(pc.yellow("\nCancelled"));
  process.exit(EXIT_CODES.CANCELLED);
});

async function main() {
  const program = new Command();

  program
    .name("mycli")
    .description("My CLI tool description")
    .version("1.0.0")
    // Global options available to all commands
    .option("--dry-run", "Preview operations without executing")
    .option("-v, --verbose", "Enable verbose output")
    // Customize error output with colors
    .configureOutput({
      writeErr: (str) => console.error(pc.red(str)),
    })
    // Show help after errors for discoverability
    .showHelpAfterError(true);

  // Register commands - keep main file clean
  program.addCommand(initCommand);
  program.addCommand(configCommand);
  program.addCommand(validateCommand);

  // Use parseAsync for proper async error handling
  await program.parseAsync(process.argv);
}

// Centralized error handling
main().catch((err) => {
  console.error(pc.red("Error:"), err.message);
  process.exit(EXIT_CODES.ERROR);
});
```

**Why good:** SIGINT handler prevents orphaned processes, `parseAsync` properly propagates errors, `configureOutput` adds consistent styling, global options shared across commands

---

## Pattern 2: Standardized Exit Codes

Define exit codes as named constants for consistency and maintainability.

```typescript
// src/cli/lib/exit-codes.ts

/**
 * CLI exit codes for standardized process termination.
 * Following Unix conventions: 0 = success, non-zero = error.
 */
export const EXIT_CODES = {
  /** Successful execution */
  SUCCESS: 0,
  /** General error */
  ERROR: 1,
  /** Invalid arguments or options */
  INVALID_ARGS: 2,
  /** Network or connectivity error */
  NETWORK_ERROR: 3,
  /** User cancelled operation (Ctrl+C) */
  CANCELLED: 4,
  /** Resource not found */
  NOT_FOUND: 5,
  /** Permission denied */
  PERMISSION_DENIED: 6,
  /** Validation failed */
  VALIDATION_ERROR: 7,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
```

**Why good:** Named constants make code readable, `as const` enables type inference, JSDoc explains each code's meaning, follows Unix conventions

```typescript
// BAD: Magic numbers
process.exit(1); // What does 1 mean?
process.exit(0);

// GOOD: Named constants
import { EXIT_CODES } from "./lib/exit-codes";
process.exit(EXIT_CODES.VALIDATION_ERROR);
```

**Why bad:** Magic numbers are unmaintainable, unclear to readers, and impossible to grep for specific error conditions

---

## Pattern 3: Command Definition with Options

Structure individual commands with proper typing and option handling.

```typescript
// src/cli/commands/init.ts
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { EXIT_CODES } from "../lib/exit-codes";

export const initCommand = new Command("init")
  .description("Initialize the project")
  // Options with descriptions for auto-generated help
  .option("--source <url>", "Source URL (e.g., github:org/repo)")
  .option("--refresh", "Force refresh from remote", false)
  .option("-f, --force", "Overwrite existing files", false)
  // Consistent error styling
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  // Action handler receives options and command context
  .action(async (options, command) => {
    // Access global options from parent
    const globalOpts = command.optsWithGlobals();
    const dryRun = globalOpts.dryRun ?? false;
    const verbose = globalOpts.verbose ?? false;

    // Start interactive UI
    p.intro(pc.cyan("Project Setup"));

    if (dryRun) {
      p.log.info(
        pc.yellow("[dry-run] Preview mode - no files will be created"),
      );
    }

    // ... implementation
  });
```

**Why good:** Named export follows convention, options have descriptions for help text, access global options via `optsWithGlobals()`, intro sets context for user

---

## Pattern 4: Interactive Prompts with Cancellation

Every @clack/prompts call must be followed by a `p.isCancel()` check.

#### Spinner Pattern

```typescript
import * as p from "@clack/prompts";
import pc from "picocolors";
import { EXIT_CODES } from "../lib/exit-codes";

async function processFiles() {
  const s = p.spinner();

  s.start("Processing files...");

  try {
    const result = await doAsyncWork();
    s.stop(`Processed ${result.count} files`);
    return result;
  } catch (error) {
    // Stop spinner before showing error — required to avoid corrupted output
    s.stop("Failed to process files");
    p.log.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(EXIT_CODES.ERROR);
  }
}
```

#### Select Pattern

```typescript
async function selectFramework(): Promise<string> {
  const result = await p.select({
    message: "Select a framework:",
    options: [
      { value: "react", label: "React", hint: "recommended" },
      { value: "vue", label: "Vue" },
      { value: "angular", label: "Angular" },
    ],
    initialValue: "react",
  });

  // CRITICAL: Always check for cancellation
  if (p.isCancel(result)) {
    p.cancel("Setup cancelled");
    process.exit(EXIT_CODES.CANCELLED);
  }

  return result;
}
```

**Why good:** `isCancel` check prevents undefined behavior, `hint` guides users toward recommended choices, `initialValue` improves UX

#### Confirm Pattern

```typescript
async function confirmDestructiveAction(): Promise<boolean> {
  const proceed = await p.confirm({
    message: "This will delete existing files. Continue?",
    initialValue: false, // Default to safe option for destructive actions
  });

  if (p.isCancel(proceed)) {
    p.cancel("Operation cancelled");
    process.exit(EXIT_CODES.CANCELLED);
  }

  return proceed;
}
```

#### Text Input with Validation

```typescript
async function getProjectName(): Promise<string> {
  const name = await p.text({
    message: "Project name:",
    placeholder: "my-project",
    validate: (value) => {
      if (!value) return "Name is required";
      if (!/^[a-z0-9-]+$/.test(value)) {
        return "Use lowercase letters, numbers, and hyphens only";
      }
    },
  });

  if (p.isCancel(name)) {
    p.cancel("Setup cancelled");
    process.exit(EXIT_CODES.CANCELLED);
  }

  return name;
}
```

---

## Pattern 5: Subcommand Organization

Structure complex commands with subcommands for related operations.

```typescript
// src/cli/commands/config.ts
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  resolveSource,
  loadGlobalConfig,
  saveGlobalConfig,
  getGlobalConfigPath,
  formatSourceOrigin,
} from "../lib/config";
import { EXIT_CODES } from "../lib/exit-codes";

export const configCommand = new Command("config")
  .description("Manage configuration")
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true);

// Subcommand: config show
configCommand
  .command("show")
  .description("Show current effective configuration")
  .action(async () => {
    const projectDir = process.cwd();
    const resolved = await resolveSource(undefined, projectDir);

    console.log(pc.cyan("\nConfiguration\n"));
    console.log(pc.bold("Source:"));
    console.log(`  ${pc.green(resolved.source)}`);
    console.log(
      `  ${pc.dim(`(from ${formatSourceOrigin(resolved.sourceOrigin)})`)}`,
    );
    console.log("");
  });

// Subcommand: config set
configCommand
  .command("set")
  .description("Set a global configuration value")
  .argument("<key>", "Configuration key (source, author)")
  .argument("<value>", "Configuration value")
  .action(async (key: string, value: string) => {
    const validKeys = ["source", "author"];

    if (!validKeys.includes(key)) {
      p.log.error(`Unknown configuration key: ${key}`);
      p.log.info(`Valid keys: ${validKeys.join(", ")}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    const existingConfig = (await loadGlobalConfig()) || {};
    const newConfig = { ...existingConfig, [key]: value };

    await saveGlobalConfig(newConfig);

    p.log.success(`Set ${key} = ${value}`);
    p.log.info(`Saved to ${getGlobalConfigPath()}`);
  });

// Subcommand: config get
configCommand
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "Configuration key")
  .action(async (key: string) => {
    if (key === "source") {
      const resolved = await resolveSource(undefined, process.cwd());
      console.log(resolved.source);
    } else {
      p.log.error(`Unknown key: ${key}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }
  });
```

**Why good:** Logical grouping of related commands, arguments validated early with clear error messages, consistent error handling across subcommands
