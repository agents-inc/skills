---
name: cli-framework-cli-commander
description: Node.js CLI development with Commander.js and @clack/prompts - command structure, interactive prompts, wizard state machines, config hierarchies, exit codes, cancellation handling
---

# CLI Application Development with Commander.js

> **Quick Guide:** Use Commander.js for command structure and option parsing. Use @clack/prompts for interactive UX (spinners, selects, confirms). Always handle Ctrl+C cancellation with `p.isCancel()`. Use named exit code constants. Use `parseAsync()` for async actions. Structure commands in separate files. Resolve config with precedence: flag > env > project > global > default.

---

<critical_requirements>

## CRITICAL: Before Building CLI Applications

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST handle SIGINT (Ctrl+C) gracefully and exit with appropriate codes)**

**(You MUST use `p.isCancel()` to detect cancellation in ALL @clack/prompts calls and handle gracefully)**

**(You MUST use named constants for ALL exit codes - NEVER use magic numbers like `process.exit(1)`)**

**(You MUST use `parseAsync()` for async actions to properly propagate errors)**

**(You MUST stop spinners before any console output or error display)**

</critical_requirements>

---

**Auto-detection:** Commander.js, commander, @clack/prompts, picocolors, p.spinner, p.select, p.confirm, p.text, p.isCancel, p.tasks, p.progress, process.exit, exit codes, SIGINT handling, interactive prompts, wizard state machine, config hierarchy, CLI error handling, parseAsync, subcommand

**When to use:**

- Building command-line tools with Node.js using Commander.js
- Creating interactive terminal prompts and wizards with @clack/prompts
- Implementing multi-step wizard flows with back navigation
- Managing hierarchical configuration (flag > env > project > global)
- Structuring CLI applications with subcommands and global options

**When NOT to use:**

- Simple scripts with no user interaction (just use process.argv directly)
- Web server frameworks (use your API framework skill)
- Single-prompt scripts (use readline or raw @clack/prompts without Commander)

**Key patterns covered:**

- CLI entry point with SIGINT handling and global options
- Standardized exit codes with named constants
- Command definition with typed options and subcommands
- @clack/prompts for interactive UX (spinners, selects, confirms, text)
- Cancellation handling (`p.isCancel()`) on every prompt
- Wizard state machines with back navigation
- Configuration hierarchy resolution
- Dry-run mode implementation

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Entry point, exit codes, commands, prompts, cancellation
- [examples/wizard-patterns.md](examples/wizard-patterns.md) - State machines, config hierarchy, dry-run mode

---

<philosophy>

## Philosophy

**User experience first.** CLI tools should be intuitive, provide helpful feedback, and fail gracefully. Users should always know what's happening (spinners), what went wrong (clear errors), and how to fix it (actionable messages).

**Consistency across commands.** Every command follows the same patterns: options at top, spinner feedback, success/error messaging, and proper exit codes. This makes the CLI predictable and learnable.

**Graceful degradation.** Always handle cancellation (Ctrl+C), invalid input, and errors. Never leave users in an unknown state. Stop spinners before displaying errors.

**When to use Commander.js:**

- Multi-command CLI tools (git-like interfaces)
- Tools with complex option parsing and subcommands
- Applications needing auto-generated help text
- TypeScript-first development

**When to use @clack/prompts:**

- Interactive setup wizards and multi-step flows
- User confirmation before destructive actions
- Selection from lists of options
- Any user input beyond simple flags

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: CLI Entry Point Structure

Register commands, handle SIGINT, use `parseAsync()` for async error propagation. See [examples/core.md](examples/core.md#pattern-1-cli-entry-point-structure) for full implementation.

```typescript
// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(pc.yellow("\nCancelled"));
  process.exit(EXIT_CODES.CANCELLED);
});

// Use parseAsync for proper async error handling
await program.parseAsync(process.argv);
```

---

### Pattern 2: Standardized Exit Codes

Define all exit codes as named constants. Never use magic numbers. See [examples/core.md](examples/core.md#pattern-2-standardized-exit-codes) for the full constant definition.

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  CANCELLED: 4,
  VALIDATION_ERROR: 7,
} as const;

// GOOD: Named constant
process.exit(EXIT_CODES.VALIDATION_ERROR);

// BAD: Magic number
process.exit(1); // What does 1 mean?
```

---

### Pattern 3: Command Definition with Options

Structure commands with typed options, descriptions for help text, and global option access. See [examples/core.md](examples/core.md#pattern-3-command-definition-with-options) for full implementation.

```typescript
export const initCommand = new Command("init")
  .description("Initialize the project")
  .option("--source <url>", "Source URL")
  .option("-f, --force", "Overwrite existing files", false)
  .action(async (options, command) => {
    const globalOpts = command.optsWithGlobals();
    // ...
  });
```

---

### Pattern 4: Interactive Prompts with Cancellation

Every @clack/prompts call must be followed by `p.isCancel()`. See [examples/core.md](examples/core.md#pattern-4-interactive-prompts-with-cancellation) for spinner, select, confirm, and text patterns.

```typescript
const result = await p.select({
  message: "Select a framework:",
  options: [
    { value: "react", label: "React", hint: "recommended" },
    { value: "vue", label: "Vue" },
  ],
});

// CRITICAL: Always check for cancellation
if (p.isCancel(result)) {
  p.cancel("Setup cancelled");
  process.exit(EXIT_CODES.CANCELLED);
}
```

---

### Pattern 5: Subcommand Organization

Group related commands under parent commands. See [examples/core.md](examples/core.md#pattern-5-subcommand-organization) for full implementation.

```typescript
export const configCommand = new Command("config").description(
  "Manage configuration",
);

configCommand
  .command("show")
  .description("Show current effective configuration")
  .action(async () => {
    /* ... */
  });

configCommand
  .command("set")
  .argument("<key>", "Configuration key")
  .argument("<value>", "Configuration value")
  .action(async (key, value) => {
    /* ... */
  });
```

---

### Pattern 6: Wizard State Machine

Complex multi-step flows with back navigation. See [examples/wizard-patterns.md](examples/wizard-patterns.md#pattern-6-wizard-state-machine) for full state machine implementation.

```typescript
const state = createInitialState();

while (true) {
  switch (state.currentStep) {
    case "approach": {
      const result = await stepApproach(state);
      if (p.isCancel(result)) return null;
      pushHistory(state);
      state.currentStep = "selection";
      break;
    }
    case "selection": {
      const result = await stepSelection(state);
      if (result === BACK_VALUE) {
        state.currentStep = popHistory(state) || "approach";
        break;
      }
      // ...
    }
  }
}
```

---

### Pattern 7: Configuration Hierarchy

Resolve config values with clear precedence: flag > env > project > global > default. See [examples/wizard-patterns.md](examples/wizard-patterns.md#pattern-7-configuration-hierarchy) for full implementation.

```typescript
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  if (flagValue !== undefined)
    return { source: flagValue, sourceOrigin: "flag" };

  const envValue = process.env[SOURCE_ENV_VAR];
  if (envValue) return { source: envValue, sourceOrigin: "env" };

  // ... project config, global config, default
}
```

---

### Pattern 8: Dry-Run Mode

Preview operations without executing. See [examples/wizard-patterns.md](examples/wizard-patterns.md#pattern-8-dry-run-mode) for full implementation.

```typescript
export async function executeWithDryRun(
  dryRun: boolean,
  operations: Array<{ description: string; execute: () => Promise<void> }>,
): Promise<void> {
  if (dryRun) {
    for (const op of operations) {
      console.log(pc.yellow(`[dry-run] Would: ${op.description}`));
    }
    return;
  }
  // Execute for real with spinner feedback
}
```

</patterns>

---

<decision_framework>

## Decision Framework

### Command Structure Decision

```
Is it a single operation?
├─ YES → Single command with options
└─ NO → Are operations related?
    ├─ YES → Subcommands under parent (config show, config set)
    └─ NO → Separate top-level commands
```

### User Input Decision

```
Does user need to provide input?
├─ NO → Use options/flags only
└─ YES → Is it a simple yes/no?
    ├─ YES → p.confirm()
    └─ NO → Is it choosing from options?
        ├─ YES → p.select() or p.multiselect()
        └─ NO → Is it free-form text?
            └─ YES → p.text() with validation
```

### Async Operation Feedback

```
Is operation quick (< 500ms)?
├─ YES → No spinner needed
└─ NO → Use p.spinner() with:
    ├─ start("Descriptive message...")
    ├─ stop("Success with result info")
    └─ Error: stop first, then p.log.error()
```

### Config Value Resolution

```
Check in order, first defined wins:
1. --flag (CLI argument)
2. ENV_VAR (environment variable)
3. ./.myapp/config.yaml (project config)
4. ~/.myapp/config.yaml (global config)
5. DEFAULT_VALUE (hardcoded default)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `p.isCancel()` checks after prompts — causes undefined behavior on Ctrl+C
- Using magic numbers for exit codes — makes debugging impossible
- Not handling SIGINT — leaves processes in unknown state
- Using `.parse()` instead of `.parseAsync()` with async actions — swallows errors silently

**Medium Priority Issues:**

- Missing spinner feedback for operations > 500ms
- Inconsistent error message formatting across commands
- Missing `--help` descriptions for options
- Not stopping spinner before showing error output — corrupts terminal display

**Common Mistakes:**

- Forgetting to call `process.exit()` after `p.cancel()` — execution continues past cancellation
- Not validating inputs early — errors occur deep in flow where recovery is harder
- Not cleaning up on errors (spinners left running, terminal state corrupted)
- Using `program.parse()` then trying to catch errors — `parseAsync()` required for async error propagation

**Gotchas & Edge Cases:**

- Commander converts `--my-option` to `myOption` in camelCase automatically
- `optsWithGlobals()` needed to access parent command options (not just `opts()`)
- Spinner must be stopped before any `console.log` / `p.log` output
- `process.exit()` in async context may not wait for pending I/O — use `await` before exit-triggering operations
- Commander v14+ defaults `allowExcessArguments` to false — extra positional args are now errors
- @clack/prompts spinner has `.isCancelled` property and `.cancel()` / `.error()` methods for richer feedback

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST handle SIGINT (Ctrl+C) gracefully and exit with appropriate codes)**

**(You MUST use `p.isCancel()` to detect cancellation in ALL @clack/prompts calls and handle gracefully)**

**(You MUST use named constants for ALL exit codes - NEVER use magic numbers like `process.exit(1)`)**

**(You MUST use `parseAsync()` for async actions to properly propagate errors)**

**(You MUST stop spinners before any console output or error display)**

**Failure to follow these rules will result in poor UX, orphaned processes, and debugging nightmares.**

</critical_reminders>
