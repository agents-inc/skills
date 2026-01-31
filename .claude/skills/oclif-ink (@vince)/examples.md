# oclif + Ink - Core Examples

> Core patterns for building CLIs with oclif and Ink. See [SKILL.md](SKILL.md) for overview and decision framework.

**Prerequisites**: Familiarity with TypeScript, React hooks, and async/await patterns.

---

## Pattern 1: Basic oclif Command

### Good Example - Typed Command with Flags and Args

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

**Why good:** Uses static properties for metadata, typed flags/args, named constants for defaults, proper async/await pattern.

### Bad Example - Missing Types and Practices

```typescript
// BAD: Missing types, using console.log, magic strings
import { Command } from "@oclif/core";

export default class Greet extends Command {
  // BAD: No description or examples
  async run() {
    // BAD: No type safety, using any
    const { args, flags } = await this.parse(Greet as any);

    // BAD: Using console.log instead of this.log
    console.log("Hello " + args.name);
  }
}
```

**Why bad:** Default export breaks tree-shaking, no TypeScript types, console.log breaks --json flag, no documentation.

---

## Pattern 2: Flag Types

### Good Example - Comprehensive Flag Definitions

```typescript
// src/commands/process.ts
import { Command, Flags, Args } from "@oclif/core";

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;

export class Process extends Command {
  static summary = "Process files with various options";

  static flags = {
    // String flag with short alias
    output: Flags.string({
      char: "o",
      description: "Output directory",
      required: true,
    }),

    // Boolean flag with allowNo for --no-verbose
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
      allowNo: true,
    }),

    // Integer flag with validation
    retries: Flags.integer({
      char: "r",
      description: "Number of retry attempts",
      default: MAX_RETRIES,
      min: 0,
      max: 10,
    }),

    // String flag with constrained options
    format: Flags.string({
      char: "f",
      description: "Output format",
      options: ["json", "yaml", "toml"] as const,
      default: "json",
    }),

    // Multiple values flag
    include: Flags.string({
      char: "i",
      description: "Patterns to include",
      multiple: true,
      default: [],
    }),

    // Flag from environment variable
    apiKey: Flags.string({
      description: "API key for authentication",
      env: "MY_CLI_API_KEY",
    }),

    // URL flag with built-in validation
    endpoint: Flags.url({
      description: "API endpoint URL",
    }),

    // Custom flag with parse function
    timeout: Flags.integer({
      description: "Timeout in seconds",
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

  static args = {
    files: Args.string({
      description: "Files to process",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Process);

    if (flags.verbose) {
      this.log(`Processing with timeout: ${flags.timeout}ms`);
      this.log(`Output format: ${flags.format}`);
      this.log(`Include patterns: ${flags.include.join(", ")}`);
    }

    // Process files...
    this.log(`Processed ${args.files} to ${flags.output}`);
  }
}
```

**Why good:** Uses all common flag types, includes validation, environment variable support, custom parsing, and named constants.

---

## Pattern 3: Args Definition

### Good Example - Multiple Args with Types

```typescript
// src/commands/copy.ts
import { Command, Args } from "@oclif/core";

export class Copy extends Command {
  static summary = "Copy files from source to destination";

  static args = {
    source: Args.string({
      description: "Source file or directory",
      required: true,
    }),
    destination: Args.string({
      description: "Destination path",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(Copy);
    this.log(`Copying ${args.source} to ${args.destination}`);
  }
}
```

### Good Example - Variable Arguments with Strict Mode Off

```typescript
// src/commands/concat.ts
import { Command, Args } from "@oclif/core";

export class Concat extends Command {
  static summary = "Concatenate multiple files";
  static strict = false; // Allow variable number of args

  static args = {
    files: Args.string({
      description: "Files to concatenate",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { argv } = await this.parse(Concat);
    // argv contains all positional arguments as array
    this.log(`Concatenating ${argv.length} files: ${argv.join(", ")}`);
  }
}
```

**Why good:** Shows both fixed args and variable args patterns with proper strict mode handling.

---

## Pattern 4: Command Output Methods

### Good Example - Using Built-in Output Methods

```typescript
// src/commands/status.ts
import { Command, Flags } from "@oclif/core";

export class Status extends Command {
  static summary = "Check system status";
  static enableJsonFlag = true; // Adds --json flag automatically

  static flags = {
    verbose: Flags.boolean({ char: "v" }),
  };

  async run(): Promise<{ status: string; healthy: boolean }> {
    const { flags } = await this.parse(Status);

    // Standard output - use this.log()
    this.log("Checking system status...");

    // Warnings - yellow by default
    this.warn("Cache is stale, consider refreshing");

    // Verbose output - only when flag is set
    if (flags.verbose) {
      this.log("Detailed: Running health checks...");
    }

    // For JSON output support, return data from run()
    const result = { status: "operational", healthy: true };

    if (this.jsonEnabled()) {
      // Return value becomes JSON output when --json flag is used
      return result;
    }

    this.log(`Status: ${result.status}`);
    return result;
  }
}
```

### Bad Example - Using console Methods

```typescript
// BAD: Direct console usage
async run(): Promise<void> {
  console.log("Status: OK"); // BAD: Breaks --json mode
  console.warn("Warning!");  // BAD: Not captured by oclif
  console.error("Error!");   // BAD: Use this.error() instead
}
```

**Why bad:** Console methods bypass oclif's output handling, break JSON mode, and aren't captured in tests.

---

## Pattern 5: Error Handling

### Good Example - Proper Error Handling

```typescript
// src/commands/deploy.ts
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

    // Check prerequisites
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      // Exit with specific code and message
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
        this.error(`Deployment target not found: ${error.message}`, {
          code: "NOT_FOUND",
          exit: EXIT_CODE_NOT_FOUND,
        });
      }
      // Re-throw unexpected errors
      throw error;
    }
  }

  private async checkAuth(): Promise<boolean> {
    // Auth check implementation
    return true;
  }

  private async deploy(env: string): Promise<void> {
    // Deployment implementation
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
```

**Why good:** Uses this.error() with codes and suggestions, named exit codes, catches specific error types.

---

## Pattern 6: Basic Ink Component

### Good Example - Functional Component with Hooks

```tsx
// src/components/counter.tsx
import React, { useState, useEffect } from "react";
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

    if (key.upArrow && count < MAX_VALUE) {
      setCount((c) => c + 1);
    }

    if (key.downArrow && count > MIN_VALUE) {
      setCount((c) => c - 1);
    }

    if (key.return) {
      onComplete?.(count);
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Counter: {count}</Text>
      <Box marginTop={1}>
        <Text dimColor>Use arrows to change, Enter to confirm, q to quit</Text>
      </Box>
    </Box>
  );
};
```

**Why good:** Functional component, proper TypeScript props, useInput for keyboard handling, cleanup with exit().

### Bad Example - Class Component and Missing Cleanup

```tsx
// BAD: Class component, no exit handling
import React from "react";
import { Box, Text } from "ink";

export class Counter extends React.Component {
  state = { count: 0 };

  // BAD: Class components don't work well with Ink hooks
  // BAD: No keyboard handling
  // BAD: No way to exit

  render() {
    return (
      <Box>
        <Text>Count: {this.state.count}</Text>
      </Box>
    );
  }
}
```

**Why bad:** Class components can't use Ink hooks, no keyboard handling, no exit mechanism.

---

## Pattern 7: Text and Box Styling

### Good Example - Styled Terminal Output

```tsx
// src/components/status-display.tsx
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

const STATUS_SYMBOLS = {
  success: "checkmark",
  warning: "warning",
  error: "cross",
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
      {/* Header row with title and status */}
      <Box>
        <Text bold>{title}</Text>
        <Spacer />
        <Text color={color}>[{status.toUpperCase()}]</Text>
      </Box>

      <Newline />

      {/* Main message */}
      <Text>{message}</Text>

      {/* Optional details list */}
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

**Why good:** Uses Box for layout, Text for styled content, Spacer for alignment, proper color constants.

---

## Pattern 8: @inkjs/ui Components

### Good Example - Using Pre-built Components

```tsx
// src/components/setup-wizard.tsx
import React, { useState } from "react";
import { Box, Text } from "ink";
import {
  TextInput,
  Select,
  ConfirmInput,
  Spinner,
  StatusMessage,
} from "@inkjs/ui";

interface SetupWizardProps {
  onComplete: (config: SetupConfig) => void;
}

interface SetupConfig {
  projectName: string;
  framework: string;
  confirmed: boolean;
}

type WizardStep = "name" | "framework" | "confirm" | "saving";

const FRAMEWORK_OPTIONS = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<WizardStep>("name");
  const [config, setConfig] = useState<Partial<SetupConfig>>({});

  const handleNameSubmit = (name: string) => {
    setConfig((c) => ({ ...c, projectName: name }));
    setStep("framework");
  };

  const handleFrameworkSelect = (framework: string) => {
    setConfig((c) => ({ ...c, framework }));
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("saving");
    // Simulate async save
    setTimeout(() => {
      onComplete(config as SetupConfig);
    }, 1000);
  };

  const handleCancel = () => {
    onComplete({ ...config, confirmed: false } as SetupConfig);
  };

  return (
    <Box flexDirection="column" gap={1}>
      {step === "name" && (
        <>
          <Text bold>What is your project name?</Text>
          <TextInput
            placeholder="my-awesome-project"
            onSubmit={handleNameSubmit}
          />
        </>
      )}

      {step === "framework" && (
        <>
          <Text bold>Select a framework:</Text>
          <Select
            options={FRAMEWORK_OPTIONS}
            onChange={handleFrameworkSelect}
          />
        </>
      )}

      {step === "confirm" && (
        <>
          <Text>
            Create project "{config.projectName}" with {config.framework}?
          </Text>
          <ConfirmInput onConfirm={handleConfirm} onCancel={handleCancel} />
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

**Why good:** Uses @inkjs/ui components for consistent UX, proper step management, typed state.

---

## Pattern 9: oclif + Ink Integration

### Good Example - Command Rendering Ink Component

```typescript
// src/commands/init.ts
import { Command, Flags } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { SetupWizard } from "../components/setup-wizard.js";
import { writeConfig } from "../lib/config.js";

export class Init extends Command {
  static summary = "Initialize a new project";
  static description = "Interactive wizard to set up project configuration.";

  static flags = {
    yes: Flags.boolean({
      char: "y",
      description: "Skip confirmation prompts",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (flags.yes) {
      // Non-interactive mode - use defaults
      await this.initWithDefaults();
      return;
    }

    // Interactive mode - render Ink wizard
    const { waitUntilExit } = render(
      <SetupWizard
        onComplete={async (config) => {
          if (config.confirmed) {
            await writeConfig(config);
            this.log("Project initialized successfully!");
          } else {
            this.log("Setup cancelled.");
          }
        }}
      />
    );

    // CRITICAL: Wait for Ink component to complete
    await waitUntilExit();
  }

  private async initWithDefaults(): Promise<void> {
    const defaultConfig = {
      projectName: "my-project",
      framework: "react",
      confirmed: true,
    };
    await writeConfig(defaultConfig);
    this.log("Project initialized with defaults.");
  }
}
```

**Why good:** Awaits waitUntilExit(), supports non-interactive mode, clean separation of concerns.

### Bad Example - Missing waitUntilExit

```typescript
// BAD: Command exits before Ink finishes
async run(): Promise<void> {
  render(<SetupWizard onComplete={handleComplete} />);
  // BAD: No waitUntilExit() - command exits immediately!
}
```

**Why bad:** Without awaiting waitUntilExit(), the command completes before user interaction finishes.

---

## Pattern 10: Lifecycle Hooks

### Good Example - Init Hook for Configuration

```typescript
// src/hooks/init.ts
import { Hook, Config } from "@oclif/core";
import { loadConfig } from "../lib/config.js";

const hook: Hook.Init = async function (options) {
  const { config, id } = options;

  // Skip for help commands
  if (id === "help" || id?.startsWith("help:")) {
    return;
  }

  // Load user configuration into context
  try {
    const userConfig = await loadConfig(config.configDir);
    // Make available to commands via config.runHook context
    this.config.pjson.userConfig = userConfig;
  } catch {
    // Config doesn't exist yet - that's okay for init command
    if (id !== "init") {
      this.warn("No configuration found. Run 'mycli init' first.");
    }
  }
};

export default hook;
```

### Good Example - Postrun Hook for Telemetry

```typescript
// src/hooks/postrun.ts
import { Hook } from "@oclif/core";

const TELEMETRY_TIMEOUT_MS = 5000;

const hook: Hook.Postrun = async function (options) {
  const { Command, result } = options;

  // Fire-and-forget telemetry (don't block CLI exit)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);

  try {
    await fetch("https://telemetry.example.com/event", {
      method: "POST",
      body: JSON.stringify({
        command: Command.id,
        success: true,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch {
    // Telemetry failure is non-critical
  } finally {
    clearTimeout(timeout);
  }
};

export default hook;
```

**Why good:** Default exports for hooks (oclif requirement), handles errors gracefully, doesn't block CLI.

---

## Pattern 11: Configuration with conf

### Good Example - Persistent Configuration Store

```typescript
// src/lib/config.ts
import Conf from "conf";

interface CliConfig {
  source: string;
  lastUsedSkills: string[];
  preferences: {
    colorMode: "light" | "dark" | "auto";
    verbose: boolean;
  };
}

const CONFIG_DEFAULTS: CliConfig = {
  source: "",
  lastUsedSkills: [],
  preferences: {
    colorMode: "auto",
    verbose: false,
  },
};

// Create typed config store
export const config = new Conf<CliConfig>({
  projectName: "mycli",
  defaults: CONFIG_DEFAULTS,
  schema: {
    source: { type: "string" },
    lastUsedSkills: {
      type: "array",
      items: { type: "string" },
    },
    preferences: {
      type: "object",
      properties: {
        colorMode: { type: "string", enum: ["light", "dark", "auto"] },
        verbose: { type: "boolean" },
      },
    },
  },
});

// Helper functions
export const getSource = (): string => config.get("source");

export const setSource = (source: string): void => {
  config.set("source", source);
};

export const addUsedSkill = (skillId: string): void => {
  const skills = config.get("lastUsedSkills");
  if (!skills.includes(skillId)) {
    config.set("lastUsedSkills", [...skills, skillId].slice(-10)); // Keep last 10
  }
};

export const getConfigPath = (): string => config.path;
```

**Why good:** Typed configuration, JSON schema validation, helper functions for common operations.

---

## Pattern 12: Configuration Loading with cosmiconfig

### Good Example - Multi-format Config File Support

```typescript
// src/lib/project-config.ts
import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";

const ProjectConfigSchema = z.object({
  source: z.string().url().optional(),
  skills: z.array(z.string()).default([]),
  agents: z.record(z.string(), z.string()).default({}),
  options: z
    .object({
      verbose: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    })
    .default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

const explorer = cosmiconfig("mycli", {
  searchPlaces: [
    "package.json",
    ".myclirc",
    ".myclirc.json",
    ".myclirc.yaml",
    ".myclirc.yml",
    "mycli.config.js",
    "mycli.config.ts",
    "mycli.config.mjs",
  ],
});

export const loadProjectConfig = async (
  searchFrom?: string,
): Promise<{ config: ProjectConfig; filepath: string } | null> => {
  const result = await explorer.search(searchFrom);

  if (!result || result.isEmpty) {
    return null;
  }

  // Validate with Zod
  const validated = ProjectConfigSchema.parse(result.config);

  return {
    config: validated,
    filepath: result.filepath,
  };
};

export const loadConfigFile = async (
  filepath: string,
): Promise<ProjectConfig> => {
  const result = await explorer.load(filepath);
  return ProjectConfigSchema.parse(result?.config ?? {});
};
```

**Why good:** Searches standard config locations, validates with Zod, supports multiple formats.

---

## Pattern 13: Process Execution with execa

### Good Example - Running External Commands

```typescript
// src/lib/git.ts
import { execa, ExecaError } from "execa";

const GIT_TIMEOUT_MS = 30000;

export const gitStatus = async (cwd: string): Promise<string> => {
  const { stdout } = await execa("git", ["status", "--porcelain"], {
    cwd,
    timeout: GIT_TIMEOUT_MS,
  });
  return stdout;
};

export const gitClone = async (
  url: string,
  dest: string,
  onProgress?: (line: string) => void,
): Promise<void> => {
  const subprocess = execa("git", ["clone", "--progress", url, dest], {
    stderr: "pipe",
  });

  // Stream progress to callback
  if (onProgress && subprocess.stderr) {
    subprocess.stderr.on("data", (chunk: Buffer) => {
      onProgress(chunk.toString());
    });
  }

  await subprocess;
};

export const isGitRepo = async (cwd: string): Promise<boolean> => {
  try {
    await execa("git", ["rev-parse", "--git-dir"], { cwd });
    return true;
  } catch {
    return false;
  }
};

export const gitCommit = async (
  cwd: string,
  message: string,
): Promise<void> => {
  try {
    await execa("git", ["add", "."], { cwd });
    await execa("git", ["commit", "-m", message], { cwd });
  } catch (error) {
    if (error instanceof ExecaError && error.exitCode === 1) {
      // Nothing to commit - not an error
      return;
    }
    throw error;
  }
};
```

**Why good:** Uses execa for cross-platform support, handles streaming output, proper error handling.

---

## Pattern 14: Task Lists with listr2

### Good Example - Multi-step Operations

```typescript
// src/lib/setup-tasks.ts
import { Listr } from "listr2";
import { execa } from "execa";

interface SetupContext {
  projectName: string;
  framework: string;
  dependencies?: string[];
}

export const runSetupTasks = async (
  projectName: string,
  framework: string,
): Promise<void> => {
  const tasks = new Listr<SetupContext>(
    [
      {
        title: "Creating project directory",
        task: async (ctx) => {
          await execa("mkdir", ["-p", ctx.projectName]);
        },
      },
      {
        title: "Initializing package.json",
        task: async (ctx) => {
          await execa("npm", ["init", "-y"], { cwd: ctx.projectName });
        },
      },
      {
        title: "Installing dependencies",
        task: async (ctx, task) => {
          const deps = getDependencies(ctx.framework);
          ctx.dependencies = deps;

          // Update task title with count
          task.title = `Installing ${deps.length} dependencies`;

          return task.newListr(
            deps.map((dep) => ({
              title: dep,
              task: async () => {
                await execa("npm", ["install", dep], { cwd: ctx.projectName });
              },
            })),
            { concurrent: true, rendererOptions: { collapseSubtasks: false } },
          );
        },
      },
      {
        title: "Creating configuration files",
        task: async (ctx) => {
          // Create config files
        },
      },
    ],
    {
      concurrent: false,
      exitOnError: true,
    },
  );

  await tasks.run({ projectName, framework });
};

const getDependencies = (framework: string): string[] => {
  const baseDeps = ["typescript", "@types/node"];
  const frameworkDeps: Record<string, string[]> = {
    react: ["react", "react-dom", "@types/react"],
    vue: ["vue"],
    svelte: ["svelte"],
  };
  return [...baseDeps, ...(frameworkDeps[framework] ?? [])];
};
```

**Why good:** Nested subtasks, concurrent execution where safe, context passing between tasks.
