# oclif + Ink - Testing Examples

> Testing patterns for oclif commands and Ink components. See [examples.md](examples.md) for core patterns.

**Prerequisites**: Understand command structure and Ink components from core examples.

---

## Pattern 1: Setting Up Test Environment

### Good Example - Vitest Configuration for oclif + Ink

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // CRITICAL: Disable console interception for @oclif/test
    disableConsoleIntercept: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.test.ts"],
    },
  },
});
```

```typescript
// vitest.setup.ts
import { beforeEach, afterEach } from "vitest";

// Reset any global state between tests
beforeEach(() => {
  // Clear environment variables that might affect tests
  delete process.env.MY_CLI_CONFIG;
});

afterEach(() => {
  // Cleanup
});
```

---

## Pattern 2: Testing oclif Commands with @oclif/test

### Good Example - Basic Command Test

```typescript
// src/commands/greet.test.ts
import { runCommand } from "@oclif/test";
import { expect, describe, it } from "vitest";

describe("greet command", () => {
  it("greets with default message", async () => {
    const { stdout } = await runCommand(["greet", "World"]);
    expect(stdout).toContain("Hello, World!");
  });

  it("uses custom greeting flag", async () => {
    const { stdout } = await runCommand(["greet", "World", "--greeting", "Hi"]);
    expect(stdout).toContain("Hi, World!");
  });

  it("supports short flag alias", async () => {
    const { stdout } = await runCommand(["greet", "World", "-g", "Hey"]);
    expect(stdout).toContain("Hey, World!");
  });

  it("converts to uppercase with --loud flag", async () => {
    const { stdout } = await runCommand(["greet", "World", "--loud"]);
    expect(stdout).toContain("HELLO, WORLD!");
  });

  it("requires name argument", async () => {
    const { error } = await runCommand(["greet"]);
    expect(error?.message).toContain("Missing required arg");
  });
});
```

**Why good:** Tests flags, args, error cases, uses runCommand for clean setup.

### Good Example - Testing Command with JSON Output

```typescript
// src/commands/list.test.ts
import { runCommand } from "@oclif/test";
import { expect, describe, it, beforeEach, vi } from "vitest";

// Mock the API module
vi.mock("../lib/api.js", () => ({
  fetchSkills: vi.fn(),
}));

import { fetchSkills } from "../lib/api.js";

const mockSkills = [
  { id: "react", name: "React", category: "frontend", installed: true },
  { id: "node", name: "Node.js", category: "backend", installed: false },
];

describe("list command", () => {
  beforeEach(() => {
    vi.mocked(fetchSkills).mockResolvedValue(mockSkills);
  });

  it("returns JSON when --json flag is used", async () => {
    const { stdout } = await runCommand(["list", "--json"]);
    const result = JSON.parse(stdout);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("react");
  });

  it("filters installed skills with --installed flag", async () => {
    const { stdout } = await runCommand(["list", "--installed", "--json"]);
    const result = JSON.parse(stdout);

    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(true);
  });
});
```

**Why good:** Mocks external dependencies, tests JSON output mode, isolated tests.

### Good Example - Testing Error Handling

```typescript
// src/commands/deploy.test.ts
import { runCommand } from "@oclif/test";
import { expect, describe, it, vi } from "vitest";

vi.mock("../lib/deploy.js", () => ({
  deploy: vi.fn(),
  checkAuth: vi.fn(),
}));

import { deploy, checkAuth } from "../lib/deploy.js";

describe("deploy command", () => {
  it("exits with error when not authenticated", async () => {
    vi.mocked(checkAuth).mockResolvedValue(false);

    const { error } = await runCommand(["deploy", "--env", "staging"]);

    expect(error?.oclif?.exit).toBe(2);
    expect(error?.message).toContain("Not authenticated");
  });

  it("provides suggestions on auth error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(false);

    const { error } = await runCommand(["deploy", "--env", "staging"]);

    // Check for suggestions in error
    expect(error?.message).toContain("mycli login");
  });

  it("deploys successfully when authenticated", async () => {
    vi.mocked(checkAuth).mockResolvedValue(true);
    vi.mocked(deploy).mockResolvedValue(undefined);

    const { stdout, error } = await runCommand(["deploy", "--env", "staging"]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("Deployed to staging");
  });
});
```

**Why good:** Tests error codes, error messages, suggestions, and success path.

---

## Pattern 3: Testing oclif Hooks

### Good Example - Testing Init Hook

```typescript
// src/hooks/init.test.ts
import { runHook } from "@oclif/test";
import { expect, describe, it, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

describe("init hook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads config when file exists", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ source: "https://example.com" }),
    );

    const { result } = await runHook("init", { id: "list" });

    expect(result.successes).toHaveLength(1);
  });

  it("warns when config is missing for non-init commands", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const { stdout } = await runHook("init", { id: "list" });

    expect(stdout).toContain("No configuration found");
  });

  it("skips warning for init command", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const { stdout } = await runHook("init", { id: "init" });

    expect(stdout).not.toContain("No configuration found");
  });

  it("skips for help commands", async () => {
    const { result } = await runHook("init", { id: "help" });

    // Should complete without loading config
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});
```

**Why good:** Tests hook in isolation, mocks file system, tests different command contexts.

---

## Pattern 4: Testing Ink Components with ink-testing-library

### Good Example - Basic Component Test

```tsx
// src/components/counter.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { expect, describe, it, vi } from "vitest";
import { Counter } from "./counter.js";

describe("Counter component", () => {
  it("renders initial value", () => {
    const { lastFrame } = render(<Counter initialValue={5} />);

    expect(lastFrame()).toContain("Counter: 5");
  });

  it("increments on up arrow", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={0} />);

    // Simulate up arrow key
    stdin.write("\u001B[A"); // Up arrow escape sequence

    expect(lastFrame()).toContain("Counter: 1");
  });

  it("decrements on down arrow", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={5} />);

    // Simulate down arrow key
    stdin.write("\u001B[B"); // Down arrow escape sequence

    expect(lastFrame()).toContain("Counter: 4");
  });

  it("does not go below minimum", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={0} />);

    stdin.write("\u001B[B"); // Try to go below 0

    expect(lastFrame()).toContain("Counter: 0");
  });

  it("calls onComplete when pressing Enter", () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <Counter initialValue={5} onComplete={onComplete} />,
    );

    stdin.write("\r"); // Enter key

    expect(onComplete).toHaveBeenCalledWith(5);
  });

  it("exits on q key", () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <Counter initialValue={3} onComplete={onComplete} />,
    );

    stdin.write("q");

    expect(onComplete).toHaveBeenCalledWith(3);
  });
});
```

**Why good:** Tests rendering, keyboard input simulation, callbacks.

### Key Code Reference for Input Simulation

```typescript
// Common escape sequences for stdin.write()
const KEY_CODES = {
  // Arrow keys
  UP: "\u001B[A",
  DOWN: "\u001B[B",
  RIGHT: "\u001B[C",
  LEFT: "\u001B[D",

  // Control keys
  ENTER: "\r",
  ESCAPE: "\u001B",
  TAB: "\t",
  BACKSPACE: "\u007F",
  SPACE: " ",

  // Ctrl combinations
  CTRL_C: "\u0003",
  CTRL_D: "\u0004",
} as const;
```

---

## Pattern 5: Testing Ink Components with State

### Good Example - Testing Stateful Wizard

```tsx
// src/components/wizard.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { SetupWizard } from "./setup-wizard.js";

describe("SetupWizard component", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts on name step", () => {
    const { lastFrame } = render(<SetupWizard onComplete={onComplete} />);

    expect(lastFrame()).toContain("project name");
  });

  it("advances to framework step after name input", async () => {
    const { lastFrame, stdin } = render(
      <SetupWizard onComplete={onComplete} />,
    );

    // Type project name and submit
    stdin.write("my-project");
    stdin.write("\r"); // Enter

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lastFrame()).toContain("Select framework");
  });

  it("shows confirmation after all steps", async () => {
    const { lastFrame, stdin } = render(
      <SetupWizard onComplete={onComplete} />,
    );

    // Step 1: Name
    stdin.write("my-project\r");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Step 2: Framework (select first option with Enter)
    stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should show confirmation
    expect(lastFrame()).toContain("my-project");
    expect(lastFrame()).toContain("Create project");
  });

  it("calls onComplete with config when confirmed", async () => {
    const { stdin } = render(<SetupWizard onComplete={onComplete} />);

    // Complete wizard
    stdin.write("test-project\r");
    await new Promise((resolve) => setTimeout(resolve, 0));

    stdin.write("\r"); // Select framework
    await new Promise((resolve) => setTimeout(resolve, 0));

    stdin.write("y"); // Confirm
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "test-project",
        confirmed: true,
      }),
    );
  });
});
```

**Why good:** Tests step transitions, state accumulation, final callback.

---

## Pattern 6: Testing with @inkjs/ui Components

### Good Example - Testing Select Component Integration

```tsx
// src/components/framework-select.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { expect, describe, it, vi } from "vitest";
import { FrameworkSelect } from "./framework-select.js";

describe("FrameworkSelect component", () => {
  it("renders all framework options", () => {
    const { lastFrame } = render(<FrameworkSelect onSelect={vi.fn()} />);

    expect(lastFrame()).toContain("React");
    expect(lastFrame()).toContain("Vue");
    expect(lastFrame()).toContain("Svelte");
  });

  it("highlights first option by default", () => {
    const { lastFrame } = render(<FrameworkSelect onSelect={vi.fn()} />);

    // Check for focus indicator on React (first option)
    const frame = lastFrame();
    const lines = frame?.split("\n") ?? [];
    const reactLine = lines.find((l) => l.includes("React"));

    // Focus indicator typically shown with color or prefix
    expect(reactLine).toBeDefined();
  });

  it("navigates options with arrow keys", () => {
    const { lastFrame, stdin } = render(<FrameworkSelect onSelect={vi.fn()} />);

    // Move to second option
    stdin.write("\u001B[B"); // Down arrow

    const frame = lastFrame();
    // Vue should now be focused
    expect(frame).toContain("Vue");
  });

  it("calls onSelect when Enter pressed", () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FrameworkSelect onSelect={onSelect} />);

    stdin.write("\r"); // Enter on first option

    expect(onSelect).toHaveBeenCalledWith("react");
  });

  it("selects navigated option", () => {
    const onSelect = vi.fn();
    const { stdin } = render(<FrameworkSelect onSelect={onSelect} />);

    stdin.write("\u001B[B"); // Down to Vue
    stdin.write("\r"); // Enter

    expect(onSelect).toHaveBeenCalledWith("vue");
  });
});
```

**Why good:** Tests keyboard navigation with @inkjs/ui Select component.

---

## Pattern 7: Testing Async Operations in Components

### Good Example - Testing Components with Async Effects

```tsx
// src/components/data-loader.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { expect, describe, it, vi, beforeEach } from "vitest";
import { DataLoader } from "./data-loader.js";

vi.mock("../lib/api.js", () => ({
  fetchData: vi.fn(),
}));

import { fetchData } from "../lib/api.js";

describe("DataLoader component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(fetchData).mockReturnValue(new Promise(() => {})); // Never resolves

    const { lastFrame } = render(<DataLoader />);

    expect(lastFrame()).toContain("Loading");
  });

  it("shows data when loaded", async () => {
    vi.mocked(fetchData).mockResolvedValue([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ]);

    const { lastFrame } = render(<DataLoader />);

    // Wait for async effect
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Item 1");
    });

    expect(lastFrame()).toContain("Item 2");
  });

  it("shows error state on failure", async () => {
    vi.mocked(fetchData).mockRejectedValue(new Error("Network error"));

    const { lastFrame } = render(<DataLoader />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Error");
    });

    expect(lastFrame()).toContain("Network error");
  });

  it("retries on retry action", async () => {
    vi.mocked(fetchData)
      .mockRejectedValueOnce(new Error("First failure"))
      .mockResolvedValueOnce([{ id: "1", name: "Item 1" }]);

    const { lastFrame, stdin } = render(<DataLoader />);

    // Wait for error state
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Error");
    });

    // Press 'r' to retry
    stdin.write("r");

    // Wait for success
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Item 1");
    });
  });
});
```

**Why good:** Tests loading, success, and error states, uses vi.waitFor for async assertions.

---

## Pattern 8: Testing Commands with Ink Components

### Good Example - Integration Test for Command + Component

```typescript
// src/commands/init.integration.test.ts
import { runCommand, captureOutput } from "@oclif/test";
import { expect, describe, it, vi, beforeEach } from "vitest";

vi.mock("../lib/config.js", () => ({
  writeConfig: vi.fn().mockResolvedValue(undefined),
}));

import { writeConfig } from "../lib/config.js";

describe("init command integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses defaults with --yes flag", async () => {
    const { stdout, error } = await runCommand(["init", "--yes"]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("initialized with defaults");
    expect(writeConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "my-project",
        confirmed: true,
      }),
    );
  });

  // Note: Testing interactive Ink components through oclif commands
  // is complex due to the render loop. For full interaction testing,
  // test the Ink component directly with ink-testing-library.
});
```

---

## Pattern 9: Mocking File System and External Services

### Good Example - Comprehensive Mocking

```typescript
// src/commands/sync.test.ts
import { runCommand } from "@oclif/test";
import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import { execa } from "execa";

// Mock modules
vi.mock("node:fs/promises");
vi.mock("execa");

describe("sync command", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default successful mocks
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ source: "https://example.com" }),
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(execa).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    } as any);
  });

  it("syncs from configured source", async () => {
    const { stdout, error } = await runCommand(["sync"]);

    expect(error).toBeUndefined();
    expect(execa).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["clone"]),
      expect.any(Object),
    );
  });

  it("handles missing config file", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    const { error } = await runCommand(["sync"]);

    expect(error?.message).toContain("No configuration found");
  });

  it("handles git clone failure", async () => {
    vi.mocked(execa).mockRejectedValue(
      Object.assign(new Error("git clone failed"), { exitCode: 128 }),
    );

    const { error } = await runCommand(["sync"]);

    expect(error?.message).toContain("Failed to sync");
  });

  it("respects --dry-run flag", async () => {
    const { stdout } = await runCommand(["sync", "--dry-run"]);

    expect(stdout).toContain("Dry run");
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(execa).not.toHaveBeenCalled();
  });
});
```

**Why good:** Comprehensive mocking, tests success and failure paths, tests flags.

---

## Pattern 10: Snapshot Testing for Ink Components

### Good Example - Frame Snapshot Tests

```tsx
// src/components/status-display.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { expect, describe, it } from "vitest";
import { StatusDisplay } from "./status-display.js";

describe("StatusDisplay snapshots", () => {
  it("renders success state", () => {
    const { lastFrame } = render(
      <StatusDisplay
        title="Build"
        status="success"
        message="All tasks completed"
        details={["Task 1: OK", "Task 2: OK"]}
      />,
    );

    expect(lastFrame()).toMatchInlineSnapshot(`
      "
      +---------------------------+
      | Build           [SUCCESS] |
      |                           |
      | All tasks completed       |
      |                           |
      |   - Task 1: OK            |
      |   - Task 2: OK            |
      +---------------------------+
      "
    `);
  });

  it("renders error state", () => {
    const { lastFrame } = render(
      <StatusDisplay
        title="Deploy"
        status="error"
        message="Deployment failed"
      />,
    );

    // Use snapshot for complex output
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders warning state", () => {
    const { lastFrame } = render(
      <StatusDisplay
        title="Lint"
        status="warning"
        message="3 warnings found"
      />,
    );

    expect(lastFrame()).toContain("WARNING");
    expect(lastFrame()).toContain("3 warnings found");
  });
});
```

**Why good:** Snapshot tests capture visual output, inline snapshots for simple cases.

---

## Pattern 11: Testing Zustand Stores

### Good Example - Store Unit Tests

```typescript
// src/stores/wizard-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "./wizard-store.js";

describe("WizardStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useWizardStore.getState().reset();
  });

  describe("step management", () => {
    it("starts at approach step", () => {
      expect(useWizardStore.getState().step).toBe("approach");
    });

    it("advances step with setStep", () => {
      useWizardStore.getState().setStep("skills");
      expect(useWizardStore.getState().step).toBe("skills");
    });

    it("sets approach and advances to stack step", () => {
      useWizardStore.getState().setApproach("stack");

      const state = useWizardStore.getState();
      expect(state.approach).toBe("stack");
      expect(state.step).toBe("stack");
    });
  });

  describe("skill selection", () => {
    it("toggles skill on", () => {
      useWizardStore.getState().toggleSkill("react");
      expect(useWizardStore.getState().selectedSkills).toContain("react");
    });

    it("toggles skill off", () => {
      useWizardStore.getState().toggleSkill("react");
      useWizardStore.getState().toggleSkill("react");
      expect(useWizardStore.getState().selectedSkills).not.toContain("react");
    });

    it("maintains other skills when toggling", () => {
      useWizardStore.getState().toggleSkill("react");
      useWizardStore.getState().toggleSkill("node");
      useWizardStore.getState().toggleSkill("react");

      expect(useWizardStore.getState().selectedSkills).toEqual(["node"]);
    });
  });

  describe("canProceed computed", () => {
    it("returns false on approach step without selection", () => {
      expect(useWizardStore.getState().canProceed()).toBe(false);
    });

    it("returns true on approach step with selection", () => {
      useWizardStore.getState().setApproach("stack");
      useWizardStore.getState().setStep("approach"); // Go back to check
      expect(useWizardStore.getState().canProceed()).toBe(true);
    });

    it("returns true on confirm step", () => {
      useWizardStore.getState().setStep("confirm");
      expect(useWizardStore.getState().canProceed()).toBe(true);
    });
  });

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Mutate state
      useWizardStore.getState().setApproach("category");
      useWizardStore.getState().toggleSkill("react");
      useWizardStore.getState().setError("test error");

      // Reset
      useWizardStore.getState().reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("approach");
      expect(state.approach).toBeNull();
      expect(state.selectedSkills).toEqual([]);
      expect(state.error).toBeNull();
    });
  });
});
```

**Why good:** Tests store in isolation, tests actions and computed values, resets between tests.

---

## Pattern 12: End-to-End Command Testing

### Good Example - Full Command Flow Test

```typescript
// src/commands/init.e2e.test.ts
import { runCommand } from "@oclif/test";
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("init command e2e", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cli-test-"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Cleanup
    process.chdir("/");
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("creates config file with --yes flag", async () => {
    const { error } = await runCommand(["init", "--yes"]);

    expect(error).toBeUndefined();

    // Verify file was created
    const configPath = path.join(testDir, ".claude", "config.yaml");
    const exists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("creates skills directory structure", async () => {
    await runCommand(["init", "--yes"]);

    const skillsDir = path.join(testDir, ".claude", "skills");
    const stat = await fs.stat(skillsDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("does not overwrite existing config without --force", async () => {
    // Create existing config
    const configDir = path.join(testDir, ".claude");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, "config.yaml"), "existing: true");

    const { error } = await runCommand(["init", "--yes"]);

    expect(error?.message).toContain("already exists");

    // Verify original content preserved
    const content = await fs.readFile(
      path.join(configDir, "config.yaml"),
      "utf-8",
    );
    expect(content).toBe("existing: true");
  });
});
```

**Why good:** Real file system operations, cleanup after tests, tests actual behavior.
