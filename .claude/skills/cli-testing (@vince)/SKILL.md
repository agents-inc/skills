---
name: cli-testing
description: Testing patterns for oclif + Ink CLI applications with Vitest
category: testing
author: "@vince"
version: 1
tags:
  - testing
  - cli
  - ink
  - oclif
  - vitest
---

# CLI Testing Patterns (oclif + Ink + Vitest)

> **Quick Guide:** Use ink-testing-library for Ink component tests, @oclif/test for command tests, and Vitest with proper async handling. Always disable console interception and use correct escape sequences for keyboard simulation.

---

<critical_requirements>

## CRITICAL: Before Writing CLI Tests

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST add `disableConsoleIntercept: true` to vitest.config.ts for proper stdout/stderr capture)**

**(You MUST use ink-testing-library for Ink components - NOT @testing-library/react)**

**(You MUST await or flush stdin.write() calls - they are asynchronous)**

**(You MUST use correct escape sequences: Arrow Up = `\x1B[A`, Arrow Down = `\x1B[B`, Enter = `\r`, Escape = `\x1B`)**

**(You MUST clean up rendered components with unmount() in afterEach hooks)**

</critical_requirements>

---

**Auto-detection:** ink-testing-library, @oclif/test, runCommand, stdin.write, lastFrame, useInput, Select component test, TextInput test, wizard test, CLI test

**When to use:**

- Testing Ink React components that render to terminal
- Testing oclif commands (flags, args, exit codes)
- Testing interactive CLI wizards with keyboard navigation
- Testing Zustand stores for wizard state management
- Verifying file system outputs from CLI commands

**Key patterns covered:**

- ink-testing-library render, stdin, stdout patterns
- Keyboard escape sequences for terminal input simulation
- oclif command testing with runCommand
- Zustand store testing for CLI state
- File system assertions for CLI outputs
- Integration testing for full wizard flows

---

<philosophy>

## Philosophy

CLI testing requires a different mental model than web testing:

1. **Terminal is the DOM** - Use `lastFrame()` instead of `screen.getByText()`
2. **Escape sequences are events** - Use `stdin.write('\x1B[B')` instead of `fireEvent.click()`
3. **Async rendering** - Terminal updates are asynchronous; always await or use delays
4. **State isolation** - Reset Zustand stores between tests to prevent state leakage

**When to use each testing approach:**

- **ink-testing-library**: Testing Ink React components in isolation
- **@oclif/test runCommand**: Testing full command execution with flags/args
- **Direct store testing**: Testing Zustand state transitions without UI
- **Integration tests**: Testing full flows from command to file output

**When NOT to use these patterns:**

- Web React components (use @testing-library/react instead)
- Non-interactive scripts (use simple function tests)
- API endpoints (use supertest or similar)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic Ink Component Testing

Use ink-testing-library to render Ink components and assert on terminal output.

#### Constants

```typescript
// test-constants.ts
export const ARROW_UP = "\x1B[A";
export const ARROW_DOWN = "\x1B[B";
export const ARROW_LEFT = "\x1B[D";
export const ARROW_RIGHT = "\x1B[C";
export const ENTER = "\r";
export const ESCAPE = "\x1B";
export const CTRL_C = "\x03";
export const TAB = "\t";
export const BACKSPACE = "\x7F";

// Timing constants
export const INPUT_DELAY_MS = 50;
export const RENDER_DELAY_MS = 100;
```

#### Implementation

```typescript
// spinner.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Text } from 'ink';
import { Spinner } from '@inkjs/ui';

describe('Spinner component', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('should render spinner with label', () => {
    const { lastFrame, unmount } = render(
      <Spinner label="Loading..." />
    );
    cleanup = unmount;

    const output = lastFrame();
    expect(output).toContain('Loading...');
  });

  it('should update label on rerender', () => {
    const { lastFrame, rerender, unmount } = render(
      <Spinner label="Step 1" />
    );
    cleanup = unmount;

    expect(lastFrame()).toContain('Step 1');

    rerender(<Spinner label="Step 2" />);
    expect(lastFrame()).toContain('Step 2');
  });
});
```

**Why good:** Proper cleanup with afterEach prevents memory leaks and test pollution, lastFrame() gives current terminal state, rerender() tests dynamic updates

```typescript
// BAD Example - Missing cleanup
import { render } from 'ink-testing-library';

it('renders spinner', () => {
  const { lastFrame } = render(<Spinner label="Loading" />);
  expect(lastFrame()).toContain('Loading');
  // Missing unmount() - component keeps running!
});
```

**Why bad:** Missing unmount causes memory leaks and can cause tests to hang, especially with components that have intervals or subscriptions

---

### Pattern 2: Keyboard Input Simulation

Simulate keyboard interactions using stdin.write() with proper escape sequences.

#### Implementation

```typescript
// select.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Select } from '@inkjs/ui';
import { ARROW_DOWN, ENTER, INPUT_DELAY_MS } from './test-constants';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Select component', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('should navigate with arrow keys and select with enter', async () => {
    const onSelect = vi.fn();
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
      { label: 'Option C', value: 'c' },
    ];

    const { stdin, lastFrame, unmount } = render(
      <Select options={options} onChange={onSelect} />
    );
    cleanup = unmount;

    // Initial state - first option highlighted
    expect(lastFrame()).toContain('Option A');

    // Navigate down
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);

    // Navigate down again to Option C
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);

    // Select current option
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('should handle rapid key presses', async () => {
    const onSelect = vi.fn();
    const options = [
      { label: 'First', value: '1' },
      { label: 'Second', value: '2' },
      { label: 'Third', value: '3' },
      { label: 'Fourth', value: '4' },
    ];

    const { stdin, unmount } = render(
      <Select options={options} onChange={onSelect} />
    );
    cleanup = unmount;

    // Multiple arrow downs followed by enter
    await stdin.write(ARROW_DOWN + ARROW_DOWN + ARROW_DOWN + ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSelect).toHaveBeenCalledWith('4');
  });
});
```

**Why good:** Uses await with stdin.write for proper async handling, delay() ensures terminal has time to process input, cleanup in afterEach prevents test pollution

```typescript
// BAD Example - Synchronous stdin.write without await
it('should select option', () => {
  const { stdin, lastFrame } = render(<Select options={options} onChange={onSelect} />);

  stdin.write(ARROW_DOWN); // Missing await!
  stdin.write(ENTER);      // Missing await!

  expect(onSelect).toHaveBeenCalled(); // Flaky - may not have processed yet
});
```

**Why bad:** stdin.write is async so assertions may run before input is processed causing flaky tests

---

### Pattern 3: TextInput Component Testing

Test text input with character-by-character simulation.

#### Implementation

```typescript
// text-input.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { TextInput } from '@inkjs/ui';
import { ENTER, BACKSPACE, INPUT_DELAY_MS } from './test-constants';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('TextInput component', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('should capture typed text and submit on enter', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <TextInput
        placeholder="Enter name..."
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    cleanup = unmount;

    // Type characters one by one
    await stdin.write('J');
    await delay(INPUT_DELAY_MS);
    await stdin.write('o');
    await delay(INPUT_DELAY_MS);
    await stdin.write('h');
    await delay(INPUT_DELAY_MS);
    await stdin.write('n');
    await delay(INPUT_DELAY_MS);

    // Verify onChange called for each character
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(lastFrame()).toContain('John');

    // Submit
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSubmit).toHaveBeenCalledWith('John');
  });

  it('should handle backspace', async () => {
    const onChange = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <TextInput onChange={onChange} />
    );
    cleanup = unmount;

    // Type then delete
    await stdin.write('Test');
    await delay(INPUT_DELAY_MS);
    await stdin.write(BACKSPACE);
    await delay(INPUT_DELAY_MS);

    expect(lastFrame()).toContain('Tes');
  });

  it('should show placeholder when empty', () => {
    const { lastFrame, unmount } = render(
      <TextInput placeholder="Type here..." onChange={() => {}} />
    );
    cleanup = unmount;

    expect(lastFrame()).toContain('Type here...');
  });
});
```

**Why good:** Tests realistic typing behavior, verifies both onChange and onSubmit callbacks, handles special keys like backspace

**When to use:** Testing any component that accepts text input from the user.

---

### Pattern 4: Testing oclif Commands with runCommand

Test oclif commands using @oclif/test v4 API.

#### Implementation

```typescript
// info.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import path from "path";
import os from "os";

// Must configure vitest.config.ts with disableConsoleIntercept: true

describe("info command", () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cli-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should display version information", async () => {
    const { stdout } = await runCommand(["info"]);

    expect(stdout).toContain("Version:");
    expect(stdout).toContain("Node:");
  });

  it("should show project info when in project directory", async () => {
    // Setup: Create project structure
    const claudeDir = path.join(tempDir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "config.yaml"),
      "name: test-project\nskills:\n  - react\n",
    );

    const { stdout } = await runCommand(["info"]);

    expect(stdout).toContain("test-project");
    expect(stdout).toContain("react");
  });

  it("should handle --json flag", async () => {
    const { stdout } = await runCommand(["info", "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("node");
  });

  it("should exit with error for invalid project", async () => {
    // Create invalid config
    const claudeDir = path.join(tempDir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "config.yaml"),
      "invalid: yaml: content:",
    );

    const { error } = await runCommand(["info"]);

    expect(error?.oclif?.exit).toBeDefined();
  });
});
```

**Why good:** Uses runCommand from @oclif/test v4, tests both stdout and error cases, proper temp directory isolation, tests flag parsing

```typescript
// BAD Example - Using old @oclif/test v3 API
import { test } from "@oclif/test";

test
  .stdout()
  .command(["info"])
  .it("shows info", (ctx) => {
    expect(ctx.stdout).to.contain("Version");
  });
```

**Why bad:** v3 API is deprecated and doesn't work with Vitest, v4 uses async runCommand instead

---

### Pattern 5: Testing Zustand Stores

Test wizard state management stores directly without UI.

#### Implementation

```typescript
// wizard-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "../stores/wizard-store";

describe("WizardStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWizardStore.getState().reset();
  });

  describe("step navigation", () => {
    it("should start at approach step", () => {
      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should track navigation history", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("category");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "stack"]);
    });

    it("should go back through history", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("category");
      store.goBack();

      const { step, history } = useWizardStore.getState();
      expect(step).toBe("stack");
      expect(history).toEqual(["approach"]);
    });
  });

  describe("skill selection", () => {
    it("should toggle skills on and off", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      expect(useWizardStore.getState().selectedSkills).toContain(
        "react (@vince)",
      );

      store.toggleSkill("react (@vince)");
      expect(useWizardStore.getState().selectedSkills).not.toContain(
        "react (@vince)",
      );
    });

    it("should allow multiple skill selection", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      store.toggleSkill("zustand (@vince)");
      store.toggleSkill("vitest (@vince)");

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toHaveLength(3);
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
      expect(selectedSkills).toContain("vitest (@vince)");
    });
  });

  describe("stack selection", () => {
    it("should select stack and populate skills", () => {
      const store = useWizardStore.getState();
      const mockStack = {
        id: "nextjs-fullstack",
        name: "Next.js Fullstack",
        allSkillIds: ["react (@vince)", "nextjs (@vince)", "zustand (@vince)"],
      };

      store.selectStack(mockStack as any);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack?.id).toBe("nextjs-fullstack");
      expect(selectedSkills).toEqual(mockStack.allSkillIds);
    });

    it("should clear skills when stack is deselected", () => {
      const store = useWizardStore.getState();

      // First select a stack
      store.selectStack({
        id: "test",
        allSkillIds: ["skill1", "skill2"],
      } as any);

      // Then deselect
      store.selectStack(null);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack).toBeNull();
      expect(selectedSkills).toEqual([]);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      const store = useWizardStore.getState();

      // Make some changes
      store.setStep("category");
      store.toggleSkill("react (@vince)");
      store.toggleExpertMode();

      // Reset
      store.reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("approach");
      expect(state.selectedSkills).toEqual([]);
      expect(state.expertMode).toBe(false);
    });

    it("should accept initial skills on reset", () => {
      const store = useWizardStore.getState();

      store.reset({ initialSkills: ["react (@vince)", "zustand (@vince)"] });

      const { step, selectedSkills } = useWizardStore.getState();
      expect(step).toBe("category"); // Skips approach when skills provided
      expect(selectedSkills).toEqual(["react (@vince)", "zustand (@vince)"]);
    });
  });
});
```

**Why good:** Tests store logic without UI overhead, uses getState() for reading, properly resets state between tests, tests complex state transitions

**When to use:** Testing complex wizard or form state that's managed by Zustand, before testing the UI that uses it.

---

### Pattern 6: File System Verification

Assert that CLI commands create correct file structures and content.

#### Implementation

```typescript
// compile.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import path from "path";
import os from "os";
import { parse as parseYaml } from "yaml";

// Helper to check if path exists
async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("compile command", () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "compile-test-"));
    process.chdir(tempDir);

    // Setup: Create minimal project structure
    const claudeDir = path.join(tempDir, ".claude");
    const skillsDir = path.join(claudeDir, "skills", "react");
    const agentsDir = path.join(claudeDir, "agents");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });

    // Create config
    await writeFile(
      path.join(claudeDir, "config.yaml"),
      `name: test-project
skills:
  - id: react (@vince)
agents:
  - web-developer
`,
    );

    // Create skill file
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---
name: react
description: React patterns
---

# React Patterns

Content here...
`,
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should create agent markdown files", async () => {
    await runCommand(["compile"]);

    const agentPath = path.join(
      tempDir,
      ".claude",
      "agents",
      "web-developer.md",
    );
    expect(await pathExists(agentPath)).toBe(true);

    const content = await readFile(agentPath, "utf-8");
    expect(content).toContain("React");
  });

  it("should not modify source files", async () => {
    const skillPath = path.join(
      tempDir,
      ".claude",
      "skills",
      "react",
      "SKILL.md",
    );
    const originalContent = await readFile(skillPath, "utf-8");

    await runCommand(["compile"]);

    const newContent = await readFile(skillPath, "utf-8");
    expect(newContent).toBe(originalContent);
  });

  it("should handle dry-run flag", async () => {
    const { stdout } = await runCommand(["compile", "--dry-run"]);

    expect(stdout).toContain("dry-run");

    // Verify no files were created
    const agentPath = path.join(
      tempDir,
      ".claude",
      "agents",
      "web-developer.md",
    );
    expect(await pathExists(agentPath)).toBe(false);
  });

  it("should validate YAML config structure", async () => {
    const configPath = path.join(tempDir, ".claude", "config.yaml");
    const content = await readFile(configPath, "utf-8");
    const config = parseYaml(content);

    expect(config).toHaveProperty("name");
    expect(config).toHaveProperty("skills");
    expect(config).toHaveProperty("agents");
    expect(Array.isArray(config.skills)).toBe(true);
    expect(Array.isArray(config.agents)).toBe(true);
  });
});
```

**Why good:** Verifies actual file outputs, tests both creation and non-modification, uses temp directories for isolation, validates file content structure

---

### Pattern 7: Integration Test - Full Wizard Flow

Test complete wizard flows from start to finish.

#### Implementation

```typescript
// wizard.integration.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Wizard } from '../components/wizard/wizard';
import { useWizardStore } from '../stores/wizard-store';
import {
  ARROW_DOWN,
  ENTER,
  ESCAPE,
  INPUT_DELAY_MS,
  RENDER_DELAY_MS
} from './test-constants';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock matrix data
const mockMatrix = {
  version: '1.0.0',
  skills: {
    'react (@vince)': {
      id: 'react (@vince)',
      name: 'react',
      description: 'React patterns',
      category: 'frontend/framework',
    },
    'zustand (@vince)': {
      id: 'zustand (@vince)',
      name: 'zustand',
      description: 'State management',
      category: 'frontend/state',
    },
  },
  categories: {
    frontend: { name: 'Frontend', description: 'Frontend skills' },
    'frontend/framework': { name: 'Framework', description: 'UI frameworks' },
    'frontend/state': { name: 'State', description: 'State management' },
  },
  suggestedStacks: [
    {
      id: 'react-stack',
      name: 'React Stack',
      allSkillIds: ['react (@vince)', 'zustand (@vince)'],
    },
  ],
  aliases: {},
  aliasesReverse: {},
  generatedAt: new Date().toISOString(),
};

describe('Wizard integration', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('should complete full wizard flow with stack selection', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <Wizard
        matrix={mockMatrix as any}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
    cleanup = unmount;

    // Wait for initial render
    await delay(RENDER_DELAY_MS);

    // Step 1: Approach selection - choose "Use a stack"
    expect(lastFrame()).toContain('approach');
    await stdin.write(ARROW_DOWN); // Navigate to stack option
    await delay(INPUT_DELAY_MS);
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    // Step 2: Stack selection
    await delay(RENDER_DELAY_MS);
    expect(lastFrame()).toContain('stack');
    await stdin.write(ENTER); // Select first stack
    await delay(INPUT_DELAY_MS);

    // Step 3: Confirm
    await delay(RENDER_DELAY_MS);
    expect(lastFrame()).toContain('confirm');
    await stdin.write(ENTER); // Confirm selection
    await delay(INPUT_DELAY_MS);

    // Verify completion callback
    expect(onComplete).toHaveBeenCalled();
    const result = onComplete.mock.calls[0][0];
    expect(result.selectedSkills).toContain('react (@vince)');
    expect(result.cancelled).toBe(false);
  });

  it('should allow cancellation with escape', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { stdin, unmount } = render(
      <Wizard
        matrix={mockMatrix as any}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
    cleanup = unmount;

    await delay(RENDER_DELAY_MS);

    // Press escape at first step
    await stdin.write(ESCAPE);
    await delay(INPUT_DELAY_MS);

    expect(onCancel).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should navigate back through history', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <Wizard
        matrix={mockMatrix as any}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
    cleanup = unmount;

    await delay(RENDER_DELAY_MS);

    // Navigate forward
    await stdin.write(ARROW_DOWN + ENTER); // Go to stack
    await delay(RENDER_DELAY_MS);
    expect(lastFrame()).toContain('stack');

    // Navigate back
    await stdin.write(ESCAPE);
    await delay(RENDER_DELAY_MS);
    expect(lastFrame()).toContain('approach');
  });

  it('should preserve selections when going back', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { stdin, unmount } = render(
      <Wizard
        matrix={mockMatrix as any}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
    cleanup = unmount;

    await delay(RENDER_DELAY_MS);

    // Select stack approach and pick a stack
    await stdin.write(ARROW_DOWN + ENTER);
    await delay(RENDER_DELAY_MS);
    await stdin.write(ENTER); // Select first stack
    await delay(INPUT_DELAY_MS);

    // Go back
    await stdin.write(ESCAPE);
    await delay(RENDER_DELAY_MS);

    // Skills should still be selected
    const { selectedSkills } = useWizardStore.getState();
    expect(selectedSkills.length).toBeGreaterThan(0);
  });
});
```

**Why good:** Tests realistic user flows, combines UI rendering with store state verification, tests navigation and cancellation paths, uses proper timing delays

</patterns>

---

<performance>

## Performance Optimization

**Test Speed:**

- Use `INPUT_DELAY_MS = 50` for most tests (balance between speed and reliability)
- Increase to `100ms` for complex multi-step interactions
- Run Zustand store tests without UI for faster feedback

**Parallel Testing:**

- File system tests must use unique temp directories
- Reset Zustand stores in beforeEach to prevent state leakage
- Use `vi.isolateModules()` if testing module-level state

**CI Considerations:**

- CI environments may need longer delays due to slower I/O
- Consider environment variable for delay multiplier: `const DELAY = (process.env.CI ? 2 : 1) * BASE_DELAY_MS`

</performance>

---

<decision_framework>

## Decision Framework

```
What are you testing?
|
+-- Ink React component?
|   |
|   +-- Uses @inkjs/ui components (Select, TextInput)?
|   |   --> ink-testing-library + keyboard escape sequences
|   |
|   +-- Custom component with useInput?
|   |   --> ink-testing-library + stdin.write for keys
|   |
|   +-- Static display component?
|       --> ink-testing-library + lastFrame assertions
|
+-- oclif command?
|   |
|   +-- Tests flags/arguments?
|   |   --> @oclif/test runCommand
|   |
|   +-- Tests exit codes?
|   |   --> runCommand + check error?.oclif?.exit
|   |
|   +-- Tests file output?
|       --> runCommand + fs assertions
|
+-- Zustand store?
|   |
|   +-- State transitions?
|   |   --> Direct store.getState() / actions
|   |
|   +-- Complex flows?
|       --> Store tests first, then UI integration
|
+-- Full wizard flow?
    --> Integration test with render + stdin + store checks
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Vitest**: Primary test runner - requires `disableConsoleIntercept: true`
- **@inkjs/ui**: Select, TextInput, Spinner - test with keyboard sequences
- **Zustand**: Test stores directly, then integration with UI
- **oclif**: Use @oclif/test v4 runCommand for commands

**Replaces / Conflicts with:**

- **@testing-library/react**: Do NOT use for Ink - different render target
- **Jest**: Can work but Vitest is recommended; same config needed for console interception
- **@oclif/test v3**: Deprecated - use v4 async API

**Required Configuration:**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // CRITICAL: Required for @oclif/test and ink-testing-library
    disableConsoleIntercept: true,
  },
});
```

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `@testing-library/react` for Ink components (wrong library - renders to different target)
- Missing `disableConsoleIntercept: true` in vitest.config (stdout/stderr capture broken)
- Using @oclif/test v3 chainable API with Vitest (deprecated, doesn't work)
- Synchronous stdin.write without await (causes race conditions)

**Medium Priority Issues:**

- Missing cleanup/unmount in afterEach (memory leaks, hanging tests)
- Hardcoded escape sequences instead of constants (maintenance burden)
- Not resetting Zustand stores between tests (state pollution)
- No delay after stdin.write (flaky assertions)

**Common Mistakes:**

- Using `\n` for Enter key (should be `\r`)
- Using `\e` for Escape (should be `\x1B`)
- Expecting synchronous terminal updates (always async)
- Testing UI when store test would suffice (slower, more fragile)

**Gotchas & Edge Cases:**

- Arrow key sequences vary by terminal but `\x1B[A/B/C/D` works in most cases
- Some terminals send different sequences for Home/End/PageUp/PageDown
- `stdin.write()` may need multiple calls for multi-byte sequences on some systems
- Components using `setInterval` or `setTimeout` need explicit cleanup
- `process.stdout.isTTY` may be false in test environment - mock if component checks it

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST add `disableConsoleIntercept: true` to vitest.config.ts for proper stdout/stderr capture)**

**(You MUST use ink-testing-library for Ink components - NOT @testing-library/react)**

**(You MUST await or flush stdin.write() calls - they are asynchronous)**

**(You MUST use correct escape sequences: Arrow Up = `\x1B[A`, Arrow Down = `\x1B[B`, Enter = `\r`, Escape = `\x1B`)**

**(You MUST clean up rendered components with unmount() in afterEach hooks)**

**Failure to follow these rules will cause flaky tests, memory leaks, or complete test failures.**

</critical_reminders>

---

## Quick Reference

### Escape Sequences

| Key         | Sequence | Constant      |
| ----------- | -------- | ------------- |
| Arrow Up    | `\x1B[A` | `ARROW_UP`    |
| Arrow Down  | `\x1B[B` | `ARROW_DOWN`  |
| Arrow Left  | `\x1B[D` | `ARROW_LEFT`  |
| Arrow Right | `\x1B[C` | `ARROW_RIGHT` |
| Enter       | `\r`     | `ENTER`       |
| Escape      | `\x1B`   | `ESCAPE`      |
| Ctrl+C      | `\x03`   | `CTRL_C`      |
| Tab         | `\t`     | `TAB`         |
| Backspace   | `\x7F`   | `BACKSPACE`   |

### Common Test Patterns

```typescript
// Render and cleanup
const { stdin, lastFrame, unmount } = render(<Component />);
afterEach(() => unmount());

// Wait for render
await delay(RENDER_DELAY_MS);

// Keyboard input
await stdin.write(ARROW_DOWN);
await delay(INPUT_DELAY_MS);

// Assert output
expect(lastFrame()).toContain('expected text');

// oclif command
const { stdout, error } = await runCommand(['cmd', '--flag']);
expect(error?.oclif?.exit).toBeUndefined();

// Zustand store
useWizardStore.getState().reset();
const { step } = useWizardStore.getState();
```
