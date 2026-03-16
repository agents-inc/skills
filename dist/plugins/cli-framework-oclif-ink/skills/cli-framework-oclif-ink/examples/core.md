# oclif + Ink - Core Examples

> Essential patterns for building CLIs with oclif and Ink. See [SKILL.md](../SKILL.md) for overview and decision guidance.

**Prerequisites**: TypeScript, React hooks, async/await.

---

## Pattern 1: Command with Typed Flags and Args

```typescript
// src/commands/greet.ts
import { Command, Flags, Args } from "@oclif/core";

const DEFAULT_GREETING = "Hello";

export class Greet extends Command {
  static summary = "Greet a user";
  static description = "Displays a greeting message to the specified user.";

  static examples = [
    "<%= config.bin %> greet World",
    "<%= config.bin %> greet World --greeting Hi",
    "<%= config.bin %> greet World -g Hey --loud",
  ];

  static flags = {
    greeting: Flags.string({
      char: "g",
      description: "Custom greeting",
      default: DEFAULT_GREETING,
    }),
    loud: Flags.boolean({
      char: "l",
      description: "Print in uppercase",
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: "Name to greet",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Greet);

    let message = `${flags.greeting}, ${args.name}!`;
    if (flags.loud) {
      message = message.toUpperCase();
    }

    this.log(message);
  }
}
```

**Why good:** Named constants for defaults, typed flags/args via static properties, `this.log()` for output, `examples` for help text generation.

---

## Pattern 2: Comprehensive Flag Types

```typescript
import { Command, Flags } from "@oclif/core";

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;

export class Process extends Command {
  static summary = "Process files with various options";

  static flags = {
    // String with short alias
    output: Flags.string({
      char: "o",
      description: "Output directory",
      required: true,
    }),

    // Boolean with --no-verbose support
    verbose: Flags.boolean({ char: "v", default: false, allowNo: true }),

    // Integer with range validation
    retries: Flags.integer({
      char: "r",
      default: MAX_RETRIES,
      min: 0,
      max: 10,
    }),

    // Constrained string options (type-safe)
    format: Flags.string({
      char: "f",
      options: ["json", "yaml", "toml"] as const,
      default: "json",
    }),

    // Multiple values
    include: Flags.string({ char: "i", multiple: true, default: [] }),

    // From environment variable
    apiKey: Flags.string({ env: "MY_CLI_API_KEY" }),

    // URL with built-in validation
    endpoint: Flags.url({ description: "API endpoint URL" }),

    // Custom parse function
    timeout: Flags.integer({
      default: DEFAULT_TIMEOUT_MS / 1000,
      parse: async (input) => {
        const seconds = parseInt(input, 10);
        if (isNaN(seconds) || seconds < 0) {
          throw new Error("Timeout must be a positive number");
        }
        return seconds * 1000; // Convert to ms
      },
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Process);
    if (flags.verbose) {
      this.log(`Format: ${flags.format}, Retries: ${flags.retries}`);
    }
  }
}
```

---

## Pattern 3: Variable Arguments with Strict Mode

```typescript
import { Command, Args } from "@oclif/core";

export class Concat extends Command {
  static summary = "Concatenate multiple files";
  static strict = false; // Allow variable number of args

  static args = {
    files: Args.string({ description: "Files to concatenate", required: true }),
  };

  async run(): Promise<void> {
    const { argv } = await this.parse(Concat);
    // argv contains all positional arguments as string[]
    this.log(`Concatenating ${argv.length} files: ${argv.join(", ")}`);
  }
}
```

---

## Pattern 4: Output Methods and JSON Support

```typescript
import { Command, Flags } from "@oclif/core";

export class Status extends Command {
  static summary = "Check system status";
  static enableJsonFlag = true; // Adds --json flag automatically

  async run(): Promise<{ status: string; healthy: boolean }> {
    const { flags } = await this.parse(Status);
    const result = { status: "operational", healthy: true };

    // Standard output
    this.log("Checking system status...");

    // Warnings (yellow by default)
    this.warn("Cache is stale, consider refreshing");

    // When --json flag is used, return value becomes the JSON output
    if (this.jsonEnabled()) {
      return result;
    }

    this.log(`Status: ${result.status}`);
    return result;
  }
}
```

**Why good:** `enableJsonFlag` auto-adds `--json`, return type becomes the output shape. `this.log`/`this.warn` are captured by test harness.

---

## Pattern 5: Error Handling with Codes and Suggestions

```typescript
import { Command, Flags } from "@oclif/core";

const EXIT_CODE_AUTH_FAILED = 2;
const EXIT_CODE_NOT_FOUND = 3;

export class Deploy extends Command {
  static summary = "Deploy application";

  static flags = {
    env: Flags.string({
      char: "e",
      required: true,
      options: ["staging", "production"] as const,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Deploy);

    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      // this.error() throws -- it does NOT return
      this.error("Not authenticated. Run 'mycli login' first.", {
        code: "AUTH_REQUIRED",
        exit: EXIT_CODE_AUTH_FAILED,
        suggestions: ["Run 'mycli login' to authenticate"],
      });
    }

    try {
      await this.deploy(flags.env);
      this.log(`Deployed to ${flags.env}`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.error(`Deploy target not found: ${error.message}`, {
          code: "NOT_FOUND",
          exit: EXIT_CODE_NOT_FOUND,
        });
      }
      throw error; // Re-throw unexpected errors
    }
  }

  private async checkAuth(): Promise<boolean> {
    return true;
  }
  private async deploy(_env: string): Promise<void> {}
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
```

**Why good:** Named exit codes, `this.error()` with structured codes/suggestions, specific error type matching, re-throws unknowns.

---

## Pattern 6: Ink Component with Keyboard Input

```tsx
// src/components/counter.tsx
import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface CounterProps {
  initialValue?: number;
  onComplete?: (finalValue: number) => void;
}

const MIN_VALUE = 0;
const MAX_VALUE = 100;

export const Counter: React.FC<CounterProps> = ({
  initialValue = 0,
  onComplete,
}) => {
  const [count, setCount] = useState(initialValue);
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onComplete?.(count);
      exit();
      return;
    }
    if (key.upArrow && count < MAX_VALUE) setCount((c) => c + 1);
    if (key.downArrow && count > MIN_VALUE) setCount((c) => c - 1);
    if (key.return) {
      onComplete?.(count);
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Counter: {count}</Text>
      <Box marginTop={1}>
        <Text dimColor>Arrows to change, Enter to confirm, q to quit</Text>
      </Box>
    </Box>
  );
};
```

**Why good:** Functional component, typed props, `useInput` for keyboard, `useApp().exit()` for cleanup, named constants for bounds.

---

## Pattern 7: Box Layout and Text Styling

```tsx
import React from "react";
import { Box, Text, Newline, Spacer } from "ink";

interface StatusDisplayProps {
  title: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: string[];
}

const STATUS_COLORS = {
  success: "green",
  warning: "yellow",
  error: "red",
} as const;

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  title,
  status,
  message,
  details,
}) => {
  const color = STATUS_COLORS[status];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      padding={1}
    >
      <Box>
        <Text bold>{title}</Text>
        <Spacer />
        <Text color={color}>[{status.toUpperCase()}]</Text>
      </Box>
      <Newline />
      <Text>{message}</Text>
      {details && details.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {details.map((detail, index) => (
            <Text key={index} dimColor>
              - {detail}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
```

**Why good:** `Box` for flexbox layout, `Spacer` for alignment, `borderStyle` for visual structure, color constants.

---

## Pattern 8: @inkjs/ui Components

```tsx
import React, { useState } from "react";
import { Box, Text } from "ink";
import {
  TextInput,
  Select,
  ConfirmInput,
  Spinner,
  StatusMessage,
} from "@inkjs/ui";

type WizardStep = "name" | "framework" | "confirm" | "saving";

const FRAMEWORK_OPTIONS = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
];

export const SetupWizard: React.FC<{
  onComplete: (config: Record<string, unknown>) => void;
}> = ({ onComplete }) => {
  const [step, setStep] = useState<WizardStep>("name");
  const [config, setConfig] = useState<Record<string, unknown>>({});

  return (
    <Box flexDirection="column" gap={1}>
      {step === "name" && (
        <>
          <Text bold>What is your project name?</Text>
          <TextInput
            placeholder="my-awesome-project"
            onSubmit={(name) => {
              setConfig((c) => ({ ...c, projectName: name }));
              setStep("framework");
            }}
          />
        </>
      )}

      {step === "framework" && (
        <>
          <Text bold>Select a framework:</Text>
          <Select
            options={FRAMEWORK_OPTIONS}
            onChange={(framework) => {
              setConfig((c) => ({ ...c, framework }));
              setStep("confirm");
            }}
          />
        </>
      )}

      {step === "confirm" && (
        <>
          <Text>
            Create project "{config.projectName as string}" with{" "}
            {config.framework as string}?
          </Text>
          <ConfirmInput
            onConfirm={() => {
              setStep("saving");
              onComplete(config);
            }}
            onCancel={() => setStep("name")}
          />
        </>
      )}

      {step === "saving" && <Spinner label="Creating project..." />}
      {step === "saving" && (
        <StatusMessage variant="info">This may take a moment...</StatusMessage>
      )}
    </Box>
  );
};
```

**Why good:** Uses @inkjs/ui for consistent UX (TextInput, Select, ConfirmInput, Spinner, StatusMessage), step-based navigation, typed step union.

---

## Pattern 9: oclif + Ink Integration

```typescript
// src/commands/init.ts
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { SetupWizard } from "../components/setup-wizard.js";
import { writeConfig } from "../lib/config.js";

export class Init extends Command {
  static summary = "Initialize a new project";

  static flags = {
    yes: Flags.boolean({ char: "y", description: "Skip prompts", default: false }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (flags.yes) {
      await writeConfig({ projectName: "my-project", framework: "react" });
      this.log("Project initialized with defaults.");
      return;
    }

    const { waitUntilExit } = render(
      <SetupWizard
        onComplete={async (config) => {
          await writeConfig(config);
          this.log("Project initialized!");
        }}
      />
    );

    // CRITICAL: Without this, the command exits before the wizard finishes
    await waitUntilExit();
  }
}
```

**Why good:** Non-interactive fallback with `--yes`, `waitUntilExit()` properly awaited, clean separation between command (`.ts`) and component (`.tsx`).

---

## Pattern 10: Lifecycle Hooks

```typescript
// src/hooks/init.ts -- oclif hooks use default exports (framework requirement)
import { Hook } from "@oclif/core";
import { loadConfig } from "../lib/config.js";

const hook: Hook.Init = async function (options) {
  const { config, id } = options;

  // Skip for help commands
  if (id === "help" || id?.startsWith("help:")) return;

  try {
    const userConfig = await loadConfig(config.configDir);
    this.config.pjson.userConfig = userConfig;
  } catch {
    if (id !== "init") {
      this.warn("No configuration found. Run 'mycli init' first.");
    }
  }
};

export default hook; // Default export required by oclif hook system
```

```typescript
// src/hooks/postrun.ts
import { Hook } from "@oclif/core";

const TELEMETRY_TIMEOUT_MS = 5000;

const hook: Hook.Postrun = async function (options) {
  const { Command } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);

  try {
    await fetch("https://telemetry.example.com/event", {
      method: "POST",
      body: JSON.stringify({
        command: Command.id,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch {
    // Telemetry failure is non-critical -- never block CLI exit
  } finally {
    clearTimeout(timeout);
  }
};

export default hook;
```

**Why good:** Default exports (oclif hook requirement), handles errors gracefully, fire-and-forget telemetry with abort timeout.

---

## Pattern 11: Subcommands via Directory Structure

```
src/commands/
  config/
    get.ts      # mycli config get <key>
    set.ts      # mycli config set <key> <value>
    list.ts     # mycli config list
```

```typescript
// src/commands/config/get.ts
import { Command, Args } from "@oclif/core";
import { config } from "../../lib/config.js";

export class ConfigGet extends Command {
  static summary = "Get a configuration value";

  static args = {
    key: Args.string({ description: "Configuration key", required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigGet);
    const value = config.get(args.key);

    if (value === undefined) {
      this.error(`Configuration key '${args.key}' not found`);
    }

    this.log(JSON.stringify(value, null, 2));
  }
}
```

**Why good:** Directory structure auto-generates topics (`mycli config`), consistent arg patterns across subcommands.
