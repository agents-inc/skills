# oclif + Ink - Testing Examples

> Testing patterns for oclif commands and Ink components. See [core.md](core.md) for the patterns being tested.

**Prerequisites**: Understand command structure and Ink components from core examples.

---

## Pattern 1: Testing oclif Commands

Use `runCommand` from `@oclif/test` v4. It returns `{ stdout, stderr, error }` for assertion.

```typescript
// src/commands/greet.test.ts
import { runCommand } from "@oclif/test";

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

**Why good:** Tests flags, args, short aliases, and error cases; `runCommand` handles setup/teardown.

---

## Pattern 2: Testing JSON Output and Mocked Dependencies

```typescript
// src/commands/list.test.ts
import { runCommand } from "@oclif/test";

// Mock external dependencies
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

  it("filters installed skills", async () => {
    const { stdout } = await runCommand(["list", "--installed", "--json"]);
    const result = JSON.parse(stdout);
    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(true);
  });
});
```

---

## Pattern 3: Testing Error Handling

```typescript
import { runCommand } from "@oclif/test";

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

---

## Pattern 4: Testing oclif Hooks

```typescript
import { runHook } from "@oclif/test";
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
    // runHook returns { stdout, stderr } -- assert on captured output
    const { stdout, stderr } = await runHook("init", { argv: ["list"] });
    expect(stderr).toBe("");
  });

  it("warns when config missing for non-init commands", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    const { stdout } = await runHook("init", { argv: ["list"] });
    expect(stdout).toContain("No configuration found");
  });

  it("skips warning for init command", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    const { stdout } = await runHook("init", { argv: ["init"] });
    expect(stdout).not.toContain("No configuration found");
  });

  it("skips for help commands", async () => {
    await runHook("init", { argv: ["help"] });
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});
```

---

## Pattern 5: Testing Ink Components with ink-testing-library

Use `render` from `ink-testing-library`. It returns `{ lastFrame, stdin }` for rendering assertions and keyboard simulation.

```tsx
// src/components/counter.test.tsx
import React from "react";
import { render } from "ink-testing-library";
import { Counter } from "./counter.js";

describe("Counter component", () => {
  it("renders initial value", () => {
    const { lastFrame } = render(<Counter initialValue={5} />);
    expect(lastFrame()).toContain("Counter: 5");
  });

  it("increments on up arrow", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={0} />);
    stdin.write("\u001B[A"); // Up arrow
    expect(lastFrame()).toContain("Counter: 1");
  });

  it("decrements on down arrow", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={5} />);
    stdin.write("\u001B[B"); // Down arrow
    expect(lastFrame()).toContain("Counter: 4");
  });

  it("does not go below minimum", () => {
    const { lastFrame, stdin } = render(<Counter initialValue={0} />);
    stdin.write("\u001B[B");
    expect(lastFrame()).toContain("Counter: 0");
  });

  it("calls onComplete on Enter", () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <Counter initialValue={5} onComplete={onComplete} />,
    );
    stdin.write("\r");
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

### Key Code Reference

```typescript
// Common escape sequences for stdin.write()
const KEY_CODES = {
  UP: "\u001B[A",
  DOWN: "\u001B[B",
  RIGHT: "\u001B[C",
  LEFT: "\u001B[D",
  ENTER: "\r",
  ESCAPE: "\u001B",
  TAB: "\t",
  BACKSPACE: "\u007F",
  SPACE: " ",
  CTRL_C: "\u0003",
} as const;
```

---

## Pattern 6: Testing Stateful Wizards

```tsx
import React from "react";
import { render } from "ink-testing-library";
import { SetupWizard } from "./setup-wizard.js";

describe("SetupWizard", () => {
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
    stdin.write("my-project");
    stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 0)); // Flush state
    expect(lastFrame()).toContain("Select framework");
  });

  it("calls onComplete with config on confirmation", async () => {
    const { stdin } = render(<SetupWizard onComplete={onComplete} />);

    stdin.write("test-project\r");
    await new Promise((resolve) => setTimeout(resolve, 0));

    stdin.write("\r"); // Select framework
    await new Promise((resolve) => setTimeout(resolve, 0));

    stdin.write("y"); // Confirm
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: "test-project", confirmed: true }),
    );
  });
});
```

**Why good:** Tests step transitions, uses `setTimeout(0)` to flush React state updates between interactions.

---

## Pattern 7: Testing Async Operations in Components

```tsx
import React from "react";
import { render } from "ink-testing-library";
import { DataLoader } from "./data-loader.js";

vi.mock("../lib/api.js", () => ({ fetchData: vi.fn() }));
import { fetchData } from "../lib/api.js";

describe("DataLoader", () => {
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

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Item 1");
    });
    expect(lastFrame()).toContain("Item 2");
  });

  it("shows error on failure", async () => {
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

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Error");
    });
    stdin.write("r"); // Press 'r' to retry
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Item 1");
    });
  });
});
```

**Why good:** Tests loading/success/error states, uses `vi.waitFor` for async assertions, tests retry flow.

---

## Pattern 8: Integration Testing (Command + Ink)

```typescript
import { runCommand } from "@oclif/test";

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
      expect.objectContaining({ projectName: "my-project", confirmed: true }),
    );
  });

  // Note: Full interactive Ink testing through oclif is complex due to the render loop.
  // Test Ink components directly with ink-testing-library for interaction coverage.
});
```

---

## Pattern 9: Mocking File System and External Processes

```typescript
import { runCommand } from "@oclif/test";
import * as fs from "node:fs/promises";
import { execa } from "execa";

vi.mock("node:fs/promises");
vi.mock("execa");

describe("sync command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ source: "https://example.com" }),
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(execa).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    } as any);
  });

  it("syncs from configured source", async () => {
    const { error } = await runCommand(["sync"]);
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

  it("respects --dry-run flag", async () => {
    const { stdout } = await runCommand(["sync", "--dry-run"]);
    expect(stdout).toContain("Dry run");
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(execa).not.toHaveBeenCalled();
  });
});
```

---

## Pattern 10: Snapshot Testing for Ink

```tsx
import React from "react";
import { render } from "ink-testing-library";
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
    // Inline snapshots capture exact terminal output
    expect(lastFrame()).toMatchSnapshot();
  });

  it("contains expected content in error state", () => {
    const { lastFrame } = render(
      <StatusDisplay
        title="Deploy"
        status="error"
        message="Deployment failed"
      />,
    );
    expect(lastFrame()).toContain("ERROR");
    expect(lastFrame()).toContain("Deployment failed");
  });
});
```

---

## Pattern 11: E2E Command Testing with Real File System

```typescript
import { runCommand } from "@oclif/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("init command e2e", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cli-test-"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir("/");
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("creates config file with --yes flag", async () => {
    const { error } = await runCommand(["init", "--yes"]);
    expect(error).toBeUndefined();

    const configPath = path.join(testDir, ".config", "config.yaml");
    const exists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("does not overwrite existing config without --force", async () => {
    const configDir = path.join(testDir, ".config");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, "config.yaml"), "existing: true");

    const { error } = await runCommand(["init", "--yes"]);
    expect(error?.message).toContain("already exists");

    const content = await fs.readFile(
      path.join(configDir, "config.yaml"),
      "utf-8",
    );
    expect(content).toBe("existing: true");
  });
});
```

**Why good:** Real file system operations, temp directory per test, cleanup in afterEach.
