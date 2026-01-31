# CLI Testing Reusable Patterns

Reusable test utilities, patterns, and helpers for consistent CLI testing.

---

## Test Constants Module

```typescript
// src/cli-v2/lib/__tests__/test-constants.ts

// ============================================================================
// Keyboard Escape Sequences
// ============================================================================

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
export const CTRL_A = "\x01";
export const CTRL_E = "\x05";
export const CTRL_K = "\x0B";
export const CTRL_U = "\x15";
export const CTRL_W = "\x17";

// Navigation keys
export const HOME = "\x1B[H";
export const END = "\x1B[F";
export const PAGE_UP = "\x1B[5~";
export const PAGE_DOWN = "\x1B[6~";

// Function keys (F1-F4 most common)
export const F1 = "\x1BOP";
export const F2 = "\x1BOQ";
export const F3 = "\x1BOR";
export const F4 = "\x1BOS";

// ============================================================================
// Timing Constants
// ============================================================================

export const INPUT_DELAY_MS = 50;
export const RENDER_DELAY_MS = 100;
export const LONG_OPERATION_DELAY_MS = 500;
export const NETWORK_DELAY_MS = 1000;

// CI-aware timing multiplier
const CI_MULTIPLIER = process.env.CI ? 2 : 1;
export const CI_INPUT_DELAY_MS = INPUT_DELAY_MS * CI_MULTIPLIER;
export const CI_RENDER_DELAY_MS = RENDER_DELAY_MS * CI_MULTIPLIER;

// ============================================================================
// Exit Codes
// ============================================================================

export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
export const EXIT_INVALID_ARGS = 2;
export const EXIT_CANCELLED = 130;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Promise-based delay utility
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a sequence of key presses with delays between each
 */
export async function typeSequence(
  stdin: { write: (data: string) => Promise<void> },
  keys: string[],
  delayMs = INPUT_DELAY_MS,
): Promise<void> {
  for (const key of keys) {
    await stdin.write(key);
    await delay(delayMs);
  }
}

/**
 * Type text character by character
 */
export async function typeText(
  stdin: { write: (data: string) => Promise<void> },
  text: string,
  delayMs = INPUT_DELAY_MS,
): Promise<void> {
  for (const char of text) {
    await stdin.write(char);
    await delay(delayMs);
  }
}
```

---

## Ink Testing Utilities

```typescript
// src/cli-v2/lib/__tests__/ink-test-utils.tsx
import { render as inkRender, type RenderResult } from "ink-testing-library";
import React from "react";
import { RENDER_DELAY_MS, delay } from "./test-constants";

/**
 * Extended render result with helper methods
 */
export interface ExtendedRenderResult extends RenderResult {
  /**
   * Type keys with automatic delay
   */
  type: (text: string) => Promise<void>;

  /**
   * Press a key with automatic delay
   */
  press: (key: string) => Promise<void>;

  /**
   * Wait for a specific text to appear in output
   */
  waitForText: (text: string, timeout?: number) => Promise<void>;

  /**
   * Get current frame with ANSI codes stripped
   */
  getPlainText: () => string;
}

/**
 * Enhanced render function with additional utilities
 */
export function renderWithUtils(
  element: React.ReactElement,
): ExtendedRenderResult {
  const result = inkRender(element);

  const type = async (text: string): Promise<void> => {
    for (const char of text) {
      await result.stdin.write(char);
      await delay(50);
    }
  };

  const press = async (key: string): Promise<void> => {
    await result.stdin.write(key);
    await delay(50);
  };

  const waitForText = async (text: string, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (result.lastFrame()?.includes(text)) {
        return;
      }
      await delay(50);
    }
    throw new Error(`Text "${text}" not found within ${timeout}ms`);
  };

  const getPlainText = (): string => {
    const frame = result.lastFrame() || "";
    // Strip ANSI escape codes
    return frame.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  };

  return {
    ...result,
    type,
    press,
    waitForText,
    getPlainText,
  };
}

/**
 * Render and wait for initial render
 */
export async function renderAndWait(
  element: React.ReactElement,
  delayMs = RENDER_DELAY_MS,
): Promise<ExtendedRenderResult> {
  const result = renderWithUtils(element);
  await delay(delayMs);
  return result;
}
```

---

## File System Test Utilities

```typescript
// src/cli-v2/lib/__tests__/fs-test-utils.ts
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import path from "path";
import os from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// ============================================================================
// Path Utilities
// ============================================================================

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

// ============================================================================
// File Content Utilities
// ============================================================================

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
 * Write YAML file
 */
export async function writeYaml(
  filePath: string,
  data: unknown,
): Promise<void> {
  const content = stringifyYaml(data, { indent: 2 });
  await writeFile(filePath, content);
}

/**
 * Write JSON file
 */
export async function writeJson(
  filePath: string,
  data: unknown,
  pretty = true,
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content);
}

// ============================================================================
// Test Context
// ============================================================================

/**
 * Test context for file system tests
 */
export interface TestContext {
  tempDir: string;
  projectDir: string;
  claudeDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete test context with standard directory structure
 */
export async function createTestContext(
  prefix = "cli-test-",
): Promise<TestContext> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const projectDir = path.join(tempDir, "project");
  const claudeDir = path.join(projectDir, ".claude");
  const skillsDir = path.join(claudeDir, "skills");
  const agentsDir = path.join(claudeDir, "agents");
  const configPath = path.join(claudeDir, "config.yaml");

  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });

  return {
    tempDir,
    projectDir,
    claudeDir,
    skillsDir,
    agentsDir,
    configPath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * Run a test function with automatic context creation and cleanup
 */
export async function withTestContext<T>(
  fn: (ctx: TestContext) => Promise<T>,
): Promise<T> {
  const ctx = await createTestContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.cleanup();
  }
}

// ============================================================================
// Mock Data Creators
// ============================================================================

/**
 * Create a mock skill directory with files
 */
export async function createMockSkill(
  skillsDir: string,
  skillName: string,
  options?: {
    description?: string;
    category?: string;
    content?: string;
    author?: string;
    version?: number;
    tags?: string[];
  },
): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });

  const frontmatter = {
    name: skillName,
    description: options?.description || `${skillName} skill`,
    category: options?.category || "test",
  };

  const skillContent =
    options?.content ||
    `---
${stringifyYaml(frontmatter).trim()}
---

# ${skillName}

Test skill content.
`;

  await writeFile(path.join(skillDir, "SKILL.md"), skillContent);

  const metadata = {
    version: options?.version || 1,
    author: options?.author || "@test",
    ...(options?.tags && { tags: options.tags }),
  };
  await writeYaml(path.join(skillDir, "metadata.yaml"), metadata);

  return skillDir;
}

/**
 * Create a mock config file
 */
export async function createMockConfig(
  ctx: TestContext,
  config: {
    name?: string;
    version?: string;
    skills?: Array<string | { id: string }>;
    agents?: string[];
    agent_skills?: Record<string, { default?: Array<{ id: string }> }>;
  },
): Promise<string> {
  const fullConfig = {
    name: config.name || "test-project",
    version: config.version || "1.0.0",
    skills: config.skills || [],
    agents: config.agents || [],
    ...(config.agent_skills && { agent_skills: config.agent_skills }),
  };

  await writeYaml(ctx.configPath, fullConfig);
  return ctx.configPath;
}

/**
 * Create a mock plugin directory
 */
export async function createMockPlugin(
  baseDir: string,
  pluginName: string,
  options?: {
    version?: string;
    description?: string;
    agents?: string[];
  },
): Promise<string> {
  const pluginDir = path.join(baseDir, pluginName);
  const metaDir = path.join(pluginDir, ".claude-plugin");
  await mkdir(metaDir, { recursive: true });

  const manifest = {
    $schema: "https://anthropic.com/claude-code/plugin.schema.json",
    name: pluginName,
    version: options?.version || "1.0.0",
    description: options?.description || `${pluginName} plugin`,
    ...(options?.agents && { agents: options.agents }),
  };

  await writeJson(path.join(metaDir, "plugin.json"), manifest);
  await writeFile(
    path.join(pluginDir, "README.md"),
    `# ${pluginName}\n\n${manifest.description}\n`,
  );

  return pluginDir;
}

/**
 * Create a mock agent markdown file
 */
export async function createMockAgent(
  agentsDir: string,
  agentName: string,
  content?: string,
): Promise<string> {
  const agentPath = path.join(agentsDir, `${agentName}.md`);

  const defaultContent = `# ${agentName}

This is a test agent.

## Instructions

Do the thing.
`;

  await writeFile(agentPath, content || defaultContent);
  return agentPath;
}
```

---

## oclif Command Testing Utilities

```typescript
// src/cli-v2/lib/__tests__/oclif-test-utils.ts
import { runCommand } from "@oclif/test";
import type { TestContext } from "./fs-test-utils";

// ============================================================================
// Types
// ============================================================================

export interface CommandResult {
  stdout: string;
  stderr: string;
  error?: {
    message: string;
    oclif?: {
      exit?: number;
    };
  };
}

export interface CommandOptions {
  /** Current working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Run a command and return structured result
 */
export async function runCmd(
  args: string[],
  options?: CommandOptions,
): Promise<CommandResult> {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  try {
    if (options?.cwd) {
      process.chdir(options.cwd);
    }
    if (options?.env) {
      Object.assign(process.env, options.env);
    }

    const result = await runCommand(args);

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error
        ? {
            message: result.error.message,
            oclif: result.error.oclif,
          }
        : undefined,
    };
  } finally {
    process.chdir(originalCwd);
    process.env = originalEnv;
  }
}

/**
 * Run command in a test context
 */
export async function runCmdInContext(
  ctx: TestContext,
  args: string[],
): Promise<CommandResult> {
  return runCmd(args, { cwd: ctx.projectDir });
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert command succeeded (no error)
 */
export function assertSuccess(result: CommandResult): void {
  if (result.error) {
    throw new Error(
      `Expected command to succeed but got error: ${result.error.message}\n` +
        `stdout: ${result.stdout}\n` +
        `stderr: ${result.stderr}`,
    );
  }
}

/**
 * Assert command failed with specific exit code
 */
export function assertExitCode(result: CommandResult, code: number): void {
  const actualCode = result.error?.oclif?.exit;
  if (actualCode !== code) {
    throw new Error(
      `Expected exit code ${code} but got ${actualCode}\n` +
        `stdout: ${result.stdout}\n` +
        `stderr: ${result.stderr}`,
    );
  }
}

/**
 * Assert stdout contains text
 */
export function assertStdoutContains(
  result: CommandResult,
  text: string,
): void {
  if (!result.stdout.includes(text)) {
    throw new Error(
      `Expected stdout to contain "${text}" but got:\n${result.stdout}`,
    );
  }
}

/**
 * Assert stdout matches regex
 */
export function assertStdoutMatches(
  result: CommandResult,
  pattern: RegExp,
): void {
  if (!pattern.test(result.stdout)) {
    throw new Error(
      `Expected stdout to match ${pattern} but got:\n${result.stdout}`,
    );
  }
}

/**
 * Assert stderr contains text
 */
export function assertStderrContains(
  result: CommandResult,
  text: string,
): void {
  if (!result.stderr.includes(text)) {
    throw new Error(
      `Expected stderr to contain "${text}" but got:\n${result.stderr}`,
    );
  }
}

/**
 * Parse stdout as JSON
 */
export function parseStdoutJson<T = unknown>(result: CommandResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse stdout as JSON:\n${result.stdout}\nError: ${e}`,
    );
  }
}
```

---

## Zustand Store Testing Utilities

```typescript
// src/cli-v2/lib/__tests__/store-test-utils.ts
import type { StoreApi, UseBoundStore } from "zustand";

/**
 * Get the current state from a Zustand store
 */
export function getState<T>(store: UseBoundStore<StoreApi<T>>): T {
  return store.getState();
}

/**
 * Subscribe to store changes and collect states
 */
export function collectStates<T>(
  store: UseBoundStore<StoreApi<T>>,
  selector?: (state: T) => unknown,
): {
  states: T[];
  unsubscribe: () => void;
} {
  const states: T[] = [];
  const unsubscribe = store.subscribe((state) => {
    states.push(state);
  });

  return { states, unsubscribe };
}

/**
 * Wait for a specific condition in the store
 */
export function waitForState<T>(
  store: UseBoundStore<StoreApi<T>>,
  predicate: (state: T) => boolean,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Store condition not met within ${timeout}ms`));
    }, timeout);

    // Check immediately
    const currentState = store.getState();
    if (predicate(currentState)) {
      clearTimeout(timeoutId);
      resolve(currentState);
      return;
    }

    // Subscribe for changes
    const unsubscribe = store.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(state);
      }
    });
  });
}

/**
 * Create a store snapshot for comparison
 */
export function snapshot<T>(store: UseBoundStore<StoreApi<T>>): Readonly<T> {
  return Object.freeze({ ...store.getState() });
}

/**
 * Assert store state matches expected partial state
 */
export function assertState<T>(
  store: UseBoundStore<StoreApi<T>>,
  expected: Partial<T>,
): void {
  const state = store.getState();
  for (const [key, value] of Object.entries(expected)) {
    const actual = state[key as keyof T];
    if (actual !== value) {
      throw new Error(
        `Expected store.${key} to be ${JSON.stringify(value)} but got ${JSON.stringify(actual)}`,
      );
    }
  }
}
```

---

## Mock Matrix Builder

```typescript
// src/cli-v2/lib/__tests__/mock-matrix.ts
import type { MergedSkillsMatrix, ResolvedSkill } from "../../types-matrix";

/**
 * Builder for creating test matrices
 */
export class MockMatrixBuilder {
  private skills: Record<string, ResolvedSkill> = {};
  private categories: Record<string, { name: string; description: string }> =
    {};
  private stacks: Array<{
    id: string;
    name: string;
    description: string;
    allSkillIds: string[];
  }> = [];
  private aliases: Record<string, string> = {};

  /**
   * Add a skill to the matrix
   */
  addSkill(id: string, options?: Partial<ResolvedSkill>): MockMatrixBuilder {
    const name = id.replace(/ \(@.*\)$/, "");
    this.skills[id] = {
      id,
      name,
      description: options?.description || `${name} skill`,
      category: options?.category || "test",
      categoryExclusive: options?.categoryExclusive || false,
      tags: options?.tags || [],
      author: options?.author || "@test",
      conflictsWith: options?.conflictsWith || [],
      recommends: options?.recommends || [],
      recommendedBy: options?.recommendedBy || [],
      requires: options?.requires || [],
      requiredBy: options?.requiredBy || [],
      alternatives: options?.alternatives || [],
      discourages: options?.discourages || [],
      requiresSetup: options?.requiresSetup || [],
      providesSetupFor: options?.providesSetupFor || [],
      path: options?.path || `skills/test/${name}/`,
      ...options,
    };
    return this;
  }

  /**
   * Add a category to the matrix
   */
  addCategory(
    id: string,
    name: string,
    description?: string,
  ): MockMatrixBuilder {
    this.categories[id] = {
      name,
      description: description || `${name} category`,
    };
    return this;
  }

  /**
   * Add a suggested stack
   */
  addStack(
    id: string,
    name: string,
    skillIds: string[],
    description?: string,
  ): MockMatrixBuilder {
    this.stacks.push({
      id,
      name,
      description: description || `${name} stack`,
      allSkillIds: skillIds,
    });
    return this;
  }

  /**
   * Add an alias
   */
  addAlias(alias: string, skillId: string): MockMatrixBuilder {
    this.aliases[alias] = skillId;
    return this;
  }

  /**
   * Build the matrix
   */
  build(): MergedSkillsMatrix {
    // Build reverse alias map
    const aliasesReverse: Record<string, string[]> = {};
    for (const [alias, skillId] of Object.entries(this.aliases)) {
      if (!aliasesReverse[skillId]) {
        aliasesReverse[skillId] = [];
      }
      aliasesReverse[skillId].push(alias);
    }

    return {
      version: "1.0.0",
      skills: this.skills,
      categories: this.categories,
      suggestedStacks: this.stacks as any,
      aliases: this.aliases,
      aliasesReverse,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Create a default mock matrix with common skills
 */
export function createDefaultMockMatrix(): MergedSkillsMatrix {
  return new MockMatrixBuilder()
    .addCategory("frontend", "Frontend")
    .addCategory("frontend/framework", "Frameworks")
    .addCategory("frontend/state", "State Management")
    .addCategory("backend", "Backend")
    .addCategory("backend/framework", "Frameworks")
    .addSkill("react (@vince)", {
      category: "frontend/framework",
      description: "React patterns",
      tags: ["ui", "framework"],
    })
    .addSkill("vue (@vince)", {
      category: "frontend/framework",
      description: "Vue patterns",
      tags: ["ui", "framework"],
    })
    .addSkill("zustand (@vince)", {
      category: "frontend/state",
      description: "State management",
      tags: ["state"],
    })
    .addSkill("hono (@vince)", {
      category: "backend/framework",
      description: "Hono web framework",
      tags: ["api", "framework"],
    })
    .addStack(
      "react-fullstack",
      "React Fullstack",
      ["react (@vince)", "zustand (@vince)", "hono (@vince)"],
      "Complete React stack",
    )
    .build();
}
```

---

## Test Setup Pattern

Use this pattern for consistent test setup:

```typescript
// Example test file using all utilities
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import {
  ARROW_DOWN,
  ENTER,
  ESCAPE,
  INPUT_DELAY_MS,
  RENDER_DELAY_MS,
  delay,
} from './test-constants';
import {
  createTestContext,
  createMockSkill,
  createMockConfig,
  pathExists,
  type TestContext,
} from './fs-test-utils';
import {
  runCmdInContext,
  assertSuccess,
  assertStdoutContains,
} from './oclif-test-utils';
import { createDefaultMockMatrix } from './mock-matrix';
import { useWizardStore } from '../../stores/wizard-store';

describe('Feature Tests', () => {
  // File system context
  let ctx: TestContext;

  // Ink render cleanup
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    // Create test directories
    ctx = await createTestContext();

    // Reset Zustand stores
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    // Clean up Ink render
    cleanup?.();
    cleanup = undefined;

    // Clean up file system
    await ctx.cleanup();
  });

  describe('unit tests', () => {
    it('should test store behavior', () => {
      const store = useWizardStore.getState();
      store.toggleSkill('react (@vince)');

      expect(useWizardStore.getState().selectedSkills).toContain('react (@vince)');
    });
  });

  describe('component tests', () => {
    it('should render component', async () => {
      const matrix = createDefaultMockMatrix();

      const { lastFrame, unmount } = render(
        <YourComponent matrix={matrix} />
      );
      cleanup = unmount;

      await delay(RENDER_DELAY_MS);
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('command tests', () => {
    it('should run command successfully', async () => {
      // Setup files
      await createMockConfig(ctx, {
        name: 'test',
        skills: ['react (@vince)'],
        agents: ['web-developer'],
      });

      // Run command
      const result = await runCmdInContext(ctx, ['info']);

      // Assert
      assertSuccess(result);
      assertStdoutContains(result, 'test');
    });
  });

  describe('integration tests', () => {
    it('should complete full flow', async () => {
      // Setup
      await createMockSkill(ctx.skillsDir, 'react', {
        category: 'frontend/framework',
      });
      await createMockConfig(ctx, {
        skills: [{ id: 'react (@vince)' }],
        agents: ['web-developer'],
      });

      // Run command
      const result = await runCmdInContext(ctx, ['compile']);

      // Verify output files
      assertSuccess(result);
      expect(await pathExists(`${ctx.agentsDir}/web-developer.md`)).toBe(true);
    });
  });
});
```

---

## Common Test Patterns

### Pattern: Testing Multi-Step Interactions

```typescript
async function completeWizardFlow(
  stdin: { write: (data: string) => Promise<void> },
  steps: Array<{ keys: string; delayMs?: number }>,
): Promise<void> {
  for (const step of steps) {
    await stdin.write(step.keys);
    await delay(step.delayMs || INPUT_DELAY_MS);
  }
}

// Usage
await completeWizardFlow(stdin, [
  { keys: ARROW_DOWN + ENTER }, // Select stack approach
  { keys: ENTER, delayMs: RENDER_DELAY_MS }, // Select first stack
  { keys: ENTER }, // Confirm
]);
```

### Pattern: Testing Error States

```typescript
it('should handle errors gracefully', async () => {
  const onError = vi.fn();

  const { stdin, lastFrame, unmount } = render(
    <Component onError={onError} />
  );
  cleanup = unmount;

  // Trigger error condition
  await stdin.write('invalid-input' + ENTER);
  await delay(INPUT_DELAY_MS);

  expect(onError).toHaveBeenCalled();
  expect(lastFrame()).toContain('error');
});
```

### Pattern: Testing Async Operations

```typescript
it('should show loading state during async operation', async () => {
  const mockFetch = vi.fn().mockImplementation(
    () => new Promise((resolve) => setTimeout(resolve, 500))
  );

  const { lastFrame, unmount } = render(
    <AsyncComponent onFetch={mockFetch} />
  );
  cleanup = unmount;

  await delay(RENDER_DELAY_MS);

  // Should show loading state
  expect(lastFrame()).toContain('Loading');

  // Wait for completion
  await delay(600);

  // Should show results
  expect(lastFrame()).not.toContain('Loading');
});
```

### Pattern: Snapshot-Style Testing

```typescript
it('should render expected output', () => {
  const { lastFrame, unmount } = render(
    <StaticComponent items={['a', 'b', 'c']} />
  );
  cleanup = unmount;

  const output = lastFrame();

  // Use inline snapshots or explicit assertions
  expect(output).toContain('a');
  expect(output).toContain('b');
  expect(output).toContain('c');

  // Or snapshot (if configured)
  // expect(output).toMatchSnapshot();
});
```
