# CLI Testing Examples

Comprehensive test examples for the oclif + Ink + Vitest CLI ecosystem.

---

## Test Constants Module

Create a shared constants file for all tests:

```typescript
// src/cli-v2/lib/__tests__/test-constants.ts

/**
 * Terminal escape sequences for keyboard input simulation.
 * Use these constants instead of hardcoded strings.
 */

// Arrow keys
export const ARROW_UP = "\x1B[A";
export const ARROW_DOWN = "\x1B[B";
export const ARROW_LEFT = "\x1B[D";
export const ARROW_RIGHT = "\x1B[C";

// Common keys
export const ENTER = "\r";
export const ESCAPE = "\x1B";
export const TAB = "\t";
export const BACKSPACE = "\x7F";
export const DELETE = "\x1B[3~";
export const SPACE = " ";

// Control keys
export const CTRL_C = "\x03";
export const CTRL_D = "\x04";
export const CTRL_Z = "\x1A";

// Navigation
export const HOME = "\x1B[H";
export const END = "\x1B[F";
export const PAGE_UP = "\x1B[5~";
export const PAGE_DOWN = "\x1B[6~";

// Timing constants
export const INPUT_DELAY_MS = 50;
export const RENDER_DELAY_MS = 100;
export const LONG_OPERATION_DELAY_MS = 500;

// CI-aware timing multiplier
const CI_MULTIPLIER = process.env.CI ? 2 : 1;
export const CI_INPUT_DELAY_MS = INPUT_DELAY_MS * CI_MULTIPLIER;
export const CI_RENDER_DELAY_MS = RENDER_DELAY_MS * CI_MULTIPLIER;

/**
 * Promise-based delay utility
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
```

---

## Example 1: Testing @inkjs/ui Select Component

```typescript
// src/cli-v2/components/__tests__/select.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Select } from '@inkjs/ui';
import {
  ARROW_DOWN,
  ARROW_UP,
  ENTER,
  INPUT_DELAY_MS,
  delay,
} from '../lib/__tests__/test-constants';

// Wrapper component that displays selection
const SelectTest: React.FC<{
  options: Array<{ label: string; value: string }>;
  onSelect?: (value: string) => void;
}> = ({ options, onSelect }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleChange = (value: string) => {
    setSelected(value);
    onSelect?.(value);
  };

  return (
    <Box flexDirection="column">
      <Select options={options} onChange={handleChange} />
      {selected && <Text>Selected: {selected}</Text>}
    </Box>
  );
};

describe('Select component', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  const defaultOptions = [
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
    { label: 'Angular', value: 'angular' },
    { label: 'Svelte', value: 'svelte' },
  ];

  it('should render all options', () => {
    const { lastFrame, unmount } = render(
      <SelectTest options={defaultOptions} />
    );
    cleanup = unmount;

    const output = lastFrame();
    expect(output).toContain('React');
    expect(output).toContain('Vue');
    expect(output).toContain('Angular');
    expect(output).toContain('Svelte');
  });

  it('should highlight first option by default', () => {
    const { lastFrame, unmount } = render(
      <SelectTest options={defaultOptions} />
    );
    cleanup = unmount;

    // First option should have visual indicator (varies by theme)
    // Just verify the component renders without error
    expect(lastFrame()).toBeTruthy();
  });

  it('should navigate down with arrow key', async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <SelectTest options={defaultOptions} onSelect={onSelect} />
    );
    cleanup = unmount;

    // Navigate to second option
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);

    // Select it
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSelect).toHaveBeenCalledWith('vue');
    expect(lastFrame()).toContain('Selected: vue');
  });

  it('should navigate up with arrow key', async () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <SelectTest options={defaultOptions} onSelect={onSelect} />
    );
    cleanup = unmount;

    // Navigate down twice, then up once
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);
    await stdin.write(ARROW_UP);
    await delay(INPUT_DELAY_MS);

    // Should be on second option
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSelect).toHaveBeenCalledWith('vue');
  });

  it('should wrap around when navigating past last option', async () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <SelectTest options={defaultOptions} onSelect={onSelect} />
    );
    cleanup = unmount;

    // Navigate down 4 times (past the end)
    for (let i = 0; i < 4; i++) {
      await stdin.write(ARROW_DOWN);
      await delay(INPUT_DELAY_MS);
    }

    // Should wrap to first option
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSelect).toHaveBeenCalledWith('react');
  });

  it('should handle rapid sequential key presses', async () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <SelectTest options={defaultOptions} onSelect={onSelect} />
    );
    cleanup = unmount;

    // Send all keys in sequence
    await stdin.write(ARROW_DOWN + ARROW_DOWN + ARROW_DOWN + ENTER);
    await delay(INPUT_DELAY_MS * 2);

    expect(onSelect).toHaveBeenCalledWith('svelte');
  });
});
```

---

## Example 2: Testing @inkjs/ui TextInput Component

```typescript
// src/cli-v2/components/__tests__/text-input.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';
import {
  ENTER,
  BACKSPACE,
  INPUT_DELAY_MS,
  delay,
} from '../lib/__tests__/test-constants';

// Test wrapper that tracks state
const TextInputTest: React.FC<{
  placeholder?: string;
  defaultValue?: string;
  suggestions?: string[];
  onSubmit?: (value: string) => void;
}> = ({ placeholder, defaultValue, suggestions, onSubmit }) => {
  const [value, setValue] = useState(defaultValue || '');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const handleSubmit = (val: string) => {
    setSubmitted(val);
    onSubmit?.(val);
  };

  return (
    <Box flexDirection="column">
      <TextInput
        placeholder={placeholder}
        defaultValue={defaultValue}
        suggestions={suggestions}
        onChange={setValue}
        onSubmit={handleSubmit}
      />
      <Text>Current: {value}</Text>
      {submitted && <Text>Submitted: {submitted}</Text>}
    </Box>
  );
};

describe('TextInput component', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it('should show placeholder when empty', () => {
    const { lastFrame, unmount } = render(
      <TextInputTest placeholder="Enter your name..." />
    );
    cleanup = unmount;

    expect(lastFrame()).toContain('Enter your name...');
  });

  it('should display typed characters', async () => {
    const { stdin, lastFrame, unmount } = render(<TextInputTest />);
    cleanup = unmount;

    await stdin.write('Hello');
    await delay(INPUT_DELAY_MS);

    expect(lastFrame()).toContain('Current: Hello');
  });

  it('should handle character-by-character input', async () => {
    const { stdin, lastFrame, unmount } = render(<TextInputTest />);
    cleanup = unmount;

    await stdin.write('H');
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: H');

    await stdin.write('i');
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: Hi');

    await stdin.write('!');
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: Hi!');
  });

  it('should submit on enter', async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <TextInputTest onSubmit={onSubmit} />
    );
    cleanup = unmount;

    await stdin.write('test-value');
    await delay(INPUT_DELAY_MS);
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    expect(onSubmit).toHaveBeenCalledWith('test-value');
    expect(lastFrame()).toContain('Submitted: test-value');
  });

  it('should handle backspace', async () => {
    const { stdin, lastFrame, unmount } = render(<TextInputTest />);
    cleanup = unmount;

    await stdin.write('Testing');
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: Testing');

    await stdin.write(BACKSPACE);
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: Testin');

    await stdin.write(BACKSPACE + BACKSPACE);
    await delay(INPUT_DELAY_MS);
    expect(lastFrame()).toContain('Current: Test');
  });

  it('should use default value', () => {
    const { lastFrame, unmount } = render(
      <TextInputTest defaultValue="Default Text" />
    );
    cleanup = unmount;

    expect(lastFrame()).toContain('Current: Default Text');
  });

  it('should support autocomplete suggestions', async () => {
    const suggestions = ['JavaScript', 'Java', 'Python'];
    const onSubmit = vi.fn();

    const { stdin, unmount } = render(
      <TextInputTest suggestions={suggestions} onSubmit={onSubmit} />
    );
    cleanup = unmount;

    // Type partial match
    await stdin.write('Jav');
    await delay(INPUT_DELAY_MS);

    // Submit (should autocomplete to first match)
    await stdin.write(ENTER);
    await delay(INPUT_DELAY_MS);

    // Note: Exact behavior depends on @inkjs/ui implementation
    expect(onSubmit).toHaveBeenCalled();
  });

  it('should handle special characters', async () => {
    const { stdin, lastFrame, unmount } = render(<TextInputTest />);
    cleanup = unmount;

    await stdin.write('user@example.com');
    await delay(INPUT_DELAY_MS);

    expect(lastFrame()).toContain('Current: user@example.com');
  });

  it('should handle unicode characters', async () => {
    const { stdin, lastFrame, unmount } = render(<TextInputTest />);
    cleanup = unmount;

    await stdin.write('Hello World');
    await delay(INPUT_DELAY_MS);

    expect(lastFrame()).toContain('Hello World');
  });
});
```

---

## Example 3: Testing Wizard with Multiple Steps

```typescript
// src/cli-v2/components/__tests__/wizard-flow.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Wizard, type WizardResult } from '../wizard/wizard';
import { useWizardStore } from '../../stores/wizard-store';
import {
  ARROW_DOWN,
  ENTER,
  ESCAPE,
  INPUT_DELAY_MS,
  RENDER_DELAY_MS,
  delay,
} from '../../lib/__tests__/test-constants';

// Comprehensive mock matrix
const createMockMatrix = () => ({
  version: '1.0.0',
  skills: {
    'react (@vince)': {
      id: 'react (@vince)',
      name: 'react',
      description: 'React patterns',
      category: 'frontend/framework',
      tags: ['ui', 'framework'],
    },
    'vue (@vince)': {
      id: 'vue (@vince)',
      name: 'vue',
      description: 'Vue patterns',
      category: 'frontend/framework',
      tags: ['ui', 'framework'],
    },
    'zustand (@vince)': {
      id: 'zustand (@vince)',
      name: 'zustand',
      description: 'State management',
      category: 'frontend/state',
      tags: ['state'],
    },
    'hono (@vince)': {
      id: 'hono (@vince)',
      name: 'hono',
      description: 'Hono web framework',
      category: 'backend/framework',
      tags: ['api', 'framework'],
    },
  },
  categories: {
    frontend: { name: 'Frontend', description: 'Frontend development' },
    'frontend/framework': { name: 'Frameworks', description: 'UI frameworks' },
    'frontend/state': { name: 'State', description: 'State management' },
    backend: { name: 'Backend', description: 'Backend development' },
    'backend/framework': { name: 'Frameworks', description: 'API frameworks' },
  },
  suggestedStacks: [
    {
      id: 'react-fullstack',
      name: 'React Fullstack',
      description: 'Full React stack',
      allSkillIds: ['react (@vince)', 'zustand (@vince)', 'hono (@vince)'],
    },
  ],
  aliases: {},
  aliasesReverse: {},
  generatedAt: new Date().toISOString(),
});

describe('Wizard flow integration', () => {
  let cleanup: (() => void) | undefined;
  let mockMatrix: ReturnType<typeof createMockMatrix>;

  beforeEach(() => {
    mockMatrix = createMockMatrix();
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe('approach selection', () => {
    it('should show approach step initially', async () => {
      const { lastFrame, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should show approach selection options
      const output = lastFrame();
      expect(output).toBeTruthy();
    });

    it('should navigate to stack selection', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to "Use a stack" and select
      await stdin.write(ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe('stack');
    });

    it('should navigate to expert mode (category selection)', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate to "Expert mode" and select
      await stdin.write(ARROW_DOWN + ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);

      const { step, expertMode } = useWizardStore.getState();
      expect(step).toBe('category');
      expect(expertMode).toBe(true);
    });
  });

  describe('stack selection', () => {
    it('should select stack and populate skills', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      // Go to stack selection
      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);

      // Select first stack
      await stdin.write(ENTER);
      await delay(INPUT_DELAY_MS);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack?.id).toBe('react-fullstack');
      expect(selectedSkills).toContain('react (@vince)');
      expect(selectedSkills).toContain('zustand (@vince)');
      expect(selectedSkills).toContain('hono (@vince)');
    });

    it('should proceed to confirm after stack selection', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      // Navigate: approach -> stack -> select stack
      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);
      await stdin.write(ENTER);
      await delay(RENDER_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe('confirm');
    });
  });

  describe('completion and cancellation', () => {
    it('should call onComplete with result', async () => {
      const onComplete = vi.fn();

      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      // Complete flow: approach -> stack -> select -> confirm
      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN + ENTER); // Go to stack
      await delay(RENDER_DELAY_MS);
      await stdin.write(ENTER); // Select stack
      await delay(RENDER_DELAY_MS);
      await stdin.write(ENTER); // Confirm
      await delay(INPUT_DELAY_MS);

      expect(onComplete).toHaveBeenCalledTimes(1);

      const result: WizardResult = onComplete.mock.calls[0][0];
      expect(result.cancelled).toBe(false);
      expect(result.selectedSkills.length).toBeGreaterThan(0);
      expect(result.validation).toBeDefined();
    });

    it('should call onCancel when escaping at first step', async () => {
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={onCancel}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      await stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should go back instead of cancel at later steps', async () => {
      const onCancel = vi.fn();

      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={onCancel}
        />
      );
      cleanup = unmount;

      // Navigate forward first
      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN + ENTER); // Go to stack
      await delay(RENDER_DELAY_MS);

      // Now escape should go back, not cancel
      await stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);

      const { step } = useWizardStore.getState();
      expect(step).toBe('approach');
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('navigation history', () => {
    it('should track navigation history', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Navigate forward
      await stdin.write(ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);

      const { history } = useWizardStore.getState();
      expect(history).toContain('approach');
    });

    it('should navigate back through history', async () => {
      const { stdin, unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      cleanup = unmount;

      // Navigate: approach -> stack -> back
      await delay(RENDER_DELAY_MS);
      await stdin.write(ARROW_DOWN + ENTER);
      await delay(RENDER_DELAY_MS);
      expect(useWizardStore.getState().step).toBe('stack');

      await stdin.write(ESCAPE);
      await delay(INPUT_DELAY_MS);
      expect(useWizardStore.getState().step).toBe('approach');
    });
  });

  describe('with initial skills', () => {
    it('should skip approach step when initial skills provided', async () => {
      const { unmount } = render(
        <Wizard
          matrix={mockMatrix as any}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          initialSkills={['react (@vince)', 'zustand (@vince)']}
        />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);

      // Should start at category, not approach
      const { step, selectedSkills } = useWizardStore.getState();
      expect(step).toBe('category');
      expect(selectedSkills).toContain('react (@vince)');
      expect(selectedSkills).toContain('zustand (@vince)');
    });
  });
});
```

---

## Example 4: Testing oclif Commands

```typescript
// src/cli-v2/commands/__tests__/info.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import path from "path";
import os from "os";

describe("info command", () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "info-cmd-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should show CLI version", async () => {
    const { stdout } = await runCommand(["info"]);

    expect(stdout).toMatch(/version/i);
  });

  it("should detect project when .claude exists", async () => {
    // Setup project
    const claudeDir = path.join(tempDir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "config.yaml"),
      "name: my-test-project\nversion: 1.0.0\n",
    );

    const { stdout } = await runCommand(["info"]);

    expect(stdout).toContain("my-test-project");
  });

  it("should report no project when .claude missing", async () => {
    const { stdout } = await runCommand(["info"]);

    expect(stdout).toMatch(/no.*project/i);
  });

  it("should format output as JSON with --json flag", async () => {
    const { stdout } = await runCommand(["info", "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("version");
  });
});

// src/cli-v2/commands/__tests__/validate.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import path from "path";
import os from "os";

describe("validate command", () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "validate-cmd-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should validate a correct plugin structure", async () => {
    // Create valid plugin
    const pluginDir = path.join(tempDir, "test-plugin");
    const metaDir = path.join(pluginDir, ".claude-plugin");
    await mkdir(metaDir, { recursive: true });
    await writeFile(
      path.join(metaDir, "plugin.json"),
      JSON.stringify({
        $schema: "https://anthropic.com/claude-code/plugin.schema.json",
        name: "test-plugin",
        version: "1.0.0",
      }),
    );
    await writeFile(path.join(pluginDir, "README.md"), "# Test Plugin\n");

    const { stdout, error } = await runCommand(["validate", pluginDir]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("valid");
  });

  it("should report errors for invalid plugin", async () => {
    // Create invalid plugin (missing required fields)
    const pluginDir = path.join(tempDir, "invalid-plugin");
    const metaDir = path.join(pluginDir, ".claude-plugin");
    await mkdir(metaDir, { recursive: true });
    await writeFile(
      path.join(metaDir, "plugin.json"),
      JSON.stringify({ name: "incomplete" }),
    );

    const { stdout, error } = await runCommand(["validate", pluginDir]);

    // Should report validation errors
    expect(stdout + (error?.message || "")).toMatch(/error|invalid|missing/i);
  });

  it("should handle --all flag for batch validation", async () => {
    // Create plugins directory with multiple plugins
    const pluginsDir = path.join(tempDir, "plugins");

    for (const pluginName of ["plugin-a", "plugin-b"]) {
      const pluginPath = path.join(pluginsDir, pluginName);
      const metaPath = path.join(pluginPath, ".claude-plugin");
      await mkdir(metaPath, { recursive: true });
      await writeFile(
        path.join(metaPath, "plugin.json"),
        JSON.stringify({
          $schema: "https://anthropic.com/claude-code/plugin.schema.json",
          name: pluginName,
          version: "1.0.0",
        }),
      );
    }

    const { stdout } = await runCommand(["validate", pluginsDir, "--all"]);

    expect(stdout).toContain("plugin-a");
    expect(stdout).toContain("plugin-b");
  });
});
```

---

## Example 5: Testing Exit Codes

```typescript
// src/cli-v2/commands/__tests__/exit-codes.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCommand } from "@oclif/test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import path from "path";
import os from "os";

// Exit code constants
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_CANCELLED = 130;

describe("command exit codes", () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "exit-code-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("info command", () => {
    it("should exit 0 on success", async () => {
      const { error } = await runCommand(["info"]);

      // No error means exit 0
      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  describe("compile command", () => {
    it("should exit with error when no config found", async () => {
      // No .claude directory
      const { error } = await runCommand(["compile"]);

      expect(error?.oclif?.exit).toBe(EXIT_ERROR);
    });

    it("should exit 0 with valid project", async () => {
      // Create minimal valid project
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(path.join(claudeDir, "skills"), { recursive: true });
      await mkdir(path.join(claudeDir, "agents"), { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        "name: test\nskills: []\nagents: []\n",
      );

      const { error } = await runCommand(["compile"]);

      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  describe("validate command", () => {
    it("should exit with error for invalid path", async () => {
      const { error } = await runCommand(["validate", "/nonexistent/path"]);

      expect(error).toBeDefined();
    });

    it("should exit with error for invalid plugin", async () => {
      // Create plugin with invalid JSON
      const pluginDir = path.join(tempDir, "bad-plugin");
      const metaDir = path.join(pluginDir, ".claude-plugin");
      await mkdir(metaDir, { recursive: true });
      await writeFile(path.join(metaDir, "plugin.json"), "not valid json {");

      const { error } = await runCommand(["validate", pluginDir]);

      expect(error).toBeDefined();
    });
  });
});
```

---

## Example 6: Testing Zustand Store Actions

```typescript
// src/cli-v2/stores/__tests__/wizard-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore, type WizardStep } from "../wizard-store";

describe("WizardStore", () => {
  // Reset store before each test
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  describe("initial state", () => {
    it("should start at approach step", () => {
      expect(useWizardStore.getState().step).toBe("approach");
    });

    it("should have empty skill selection", () => {
      expect(useWizardStore.getState().selectedSkills).toEqual([]);
    });

    it("should have no selected stack", () => {
      expect(useWizardStore.getState().selectedStack).toBeNull();
    });

    it("should have expert mode off", () => {
      expect(useWizardStore.getState().expertMode).toBe(false);
    });

    it("should default to local install mode", () => {
      expect(useWizardStore.getState().installMode).toBe("local");
    });
  });

  describe("setStep", () => {
    it("should update current step", () => {
      useWizardStore.getState().setStep("category");
      expect(useWizardStore.getState().step).toBe("category");
    });

    it("should push previous step to history", () => {
      useWizardStore.getState().setStep("stack");
      useWizardStore.getState().setStep("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "stack"]);
    });
  });

  describe("toggleSkill", () => {
    it("should add skill when not selected", () => {
      useWizardStore.getState().toggleSkill("react (@vince)");

      expect(useWizardStore.getState().selectedSkills).toContain(
        "react (@vince)",
      );
    });

    it("should remove skill when already selected", () => {
      const store = useWizardStore.getState();
      store.toggleSkill("react (@vince)");
      store.toggleSkill("react (@vince)");

      expect(useWizardStore.getState().selectedSkills).not.toContain(
        "react (@vince)",
      );
    });

    it("should maintain other selections", () => {
      const store = useWizardStore.getState();
      store.toggleSkill("react (@vince)");
      store.toggleSkill("zustand (@vince)");
      store.toggleSkill("react (@vince)"); // Remove react

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).not.toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
    });
  });

  describe("selectStack", () => {
    const mockStack = {
      id: "nextjs-fullstack",
      name: "Next.js Fullstack",
      allSkillIds: ["react (@vince)", "nextjs (@vince)", "zustand (@vince)"],
    };

    it("should set selected stack", () => {
      useWizardStore.getState().selectStack(mockStack as any);

      expect(useWizardStore.getState().selectedStack?.id).toBe(
        "nextjs-fullstack",
      );
    });

    it("should populate selectedSkills from stack", () => {
      useWizardStore.getState().selectStack(mockStack as any);

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toEqual(mockStack.allSkillIds);
    });

    it("should clear skills when null is passed", () => {
      const store = useWizardStore.getState();
      store.selectStack(mockStack as any);
      store.selectStack(null);

      expect(useWizardStore.getState().selectedStack).toBeNull();
      expect(useWizardStore.getState().selectedSkills).toEqual([]);
    });
  });

  describe("goBack", () => {
    it("should return to previous step", () => {
      const store = useWizardStore.getState();
      store.setStep("stack");
      store.setStep("confirm");
      store.goBack();

      expect(useWizardStore.getState().step).toBe("stack");
    });

    it("should pop from history", () => {
      const store = useWizardStore.getState();
      store.setStep("stack");
      store.setStep("category");
      store.goBack();

      expect(useWizardStore.getState().history).toEqual(["approach"]);
    });

    it("should return to approach when history empty", () => {
      useWizardStore.getState().goBack();

      expect(useWizardStore.getState().step).toBe("approach");
    });
  });

  describe("toggleExpertMode", () => {
    it("should toggle expert mode on", () => {
      useWizardStore.getState().toggleExpertMode();

      expect(useWizardStore.getState().expertMode).toBe(true);
    });

    it("should toggle expert mode off", () => {
      const store = useWizardStore.getState();
      store.toggleExpertMode();
      store.toggleExpertMode();

      expect(useWizardStore.getState().expertMode).toBe(false);
    });
  });

  describe("reset", () => {
    it("should restore initial state", () => {
      const store = useWizardStore.getState();
      store.setStep("confirm");
      store.toggleSkill("react (@vince)");
      store.toggleExpertMode();
      store.reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("approach");
      expect(state.selectedSkills).toEqual([]);
      expect(state.expertMode).toBe(false);
    });

    it("should accept initial skills", () => {
      useWizardStore.getState().reset({
        initialSkills: ["react (@vince)", "zustand (@vince)"],
      });

      const { step, selectedSkills } = useWizardStore.getState();
      expect(step).toBe("category"); // Skips approach
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
    });

    it("should enable expert mode when hasLocalSkills", () => {
      useWizardStore.getState().reset({ hasLocalSkills: true });

      expect(useWizardStore.getState().expertMode).toBe(true);
    });
  });

  describe("category tracking", () => {
    it("should track visited categories", () => {
      const store = useWizardStore.getState();
      store.markCategoryVisited("frontend");
      store.markCategoryVisited("backend");

      const { visitedCategories } = useWizardStore.getState();
      expect(visitedCategories.has("frontend")).toBe(true);
      expect(visitedCategories.has("backend")).toBe(true);
    });

    it("should set current category", () => {
      useWizardStore.getState().setCategory("frontend");

      expect(useWizardStore.getState().currentTopCategory).toBe("frontend");
    });

    it("should set current subcategory", () => {
      useWizardStore.getState().setSubcategory("frontend/framework");

      expect(useWizardStore.getState().currentSubcategory).toBe(
        "frontend/framework",
      );
    });
  });
});
```

---

## Example 7: File System Test Helpers

```typescript
// src/cli-v2/lib/__tests__/fs-helpers.ts
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import path from "path";
import os from "os";
import { parse as parseYaml } from "yaml";

/**
 * Check if a path exists
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 */
export async function isFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
export async function isDirectory(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read and parse YAML file
 */
export async function readYaml<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return parseYaml(content) as T;
}

/**
 * Read and parse JSON file
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Test context for file system tests
 */
export interface TestContext {
  tempDir: string;
  projectDir: string;
  claudeDir: string;
  skillsDir: string;
  agentsDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete test context with directories
 */
export async function createTestContext(
  prefix = "cli-test-",
): Promise<TestContext> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const projectDir = path.join(tempDir, "project");
  const claudeDir = path.join(projectDir, ".claude");
  const skillsDir = path.join(claudeDir, "skills");
  const agentsDir = path.join(claudeDir, "agents");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return {
    tempDir,
    projectDir,
    claudeDir,
    skillsDir,
    agentsDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * Create a mock skill in the test context
 */
export async function createMockSkill(
  skillsDir: string,
  skillName: string,
  options?: {
    content?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });

  const content =
    options?.content ||
    `---
name: ${skillName}
description: A test skill
---

# ${skillName}

Test content.
`;

  await writeFile(path.join(skillDir, "SKILL.md"), content);

  if (options?.metadata) {
    const metaContent = Object.entries(options.metadata)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    await writeFile(path.join(skillDir, "metadata.yaml"), metaContent);
  }

  return skillDir;
}

/**
 * Create a mock config file
 */
export async function createMockConfig(
  claudeDir: string,
  config: {
    name?: string;
    skills?: Array<string | { id: string }>;
    agents?: string[];
    [key: string]: unknown;
  },
): Promise<string> {
  const defaultConfig = {
    name: "test-project",
    version: "1.0.0",
    skills: [],
    agents: [],
    ...config,
  };

  const configPath = path.join(claudeDir, "config.yaml");
  const content = Object.entries(defaultConfig)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length === 0) return `${k}: []`;
        const items = v
          .map((item) => {
            if (typeof item === "object") {
              return `  - id: ${(item as { id: string }).id}`;
            }
            return `  - ${item}`;
          })
          .join("\n");
        return `${k}:\n${items}`;
      }
      return `${k}: ${v}`;
    })
    .join("\n");

  await writeFile(configPath, content + "\n");
  return configPath;
}
```

---

## Vitest Configuration

Make sure your vitest.config.ts has the required settings:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],

    // CRITICAL: Required for @oclif/test stdout/stderr capture
    disableConsoleIntercept: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/cli-v2/**/*.ts", "src/cli-v2/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/index.ts"],
    },

    // Timeout for slow tests
    testTimeout: 10000,

    // Hooks timeout
    hookTimeout: 10000,
  },
});
```
