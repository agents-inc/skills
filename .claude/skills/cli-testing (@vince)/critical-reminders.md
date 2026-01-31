# CLI Testing Critical Reminders

Common mistakes, gotchas, and critical rules for CLI testing with oclif + Ink + Vitest.

---

## Top 5 Critical Rules

### 1. Configure Vitest Correctly

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // CRITICAL: Required for @oclif/test and ink-testing-library
    disableConsoleIntercept: true,

    environment: "node",
    globals: true,
  },
});
```

**Why:** Without `disableConsoleIntercept: true`, Vitest intercepts console.log/error, breaking stdout/stderr capture in @oclif/test and ink-testing-library.

---

### 2. Use ink-testing-library, NOT @testing-library/react

```typescript
// CORRECT
import { render } from "ink-testing-library";

// WRONG - This is for web React, not terminal
import { render } from "@testing-library/react";
```

**Why:** ink-testing-library renders to a virtual terminal buffer, @testing-library/react renders to DOM. They are completely different render targets.

---

### 3. Always Await stdin.write()

```typescript
// CORRECT
await stdin.write(ARROW_DOWN);
await delay(INPUT_DELAY_MS);

// WRONG - Race condition
stdin.write(ARROW_DOWN);
expect(onSelect).toHaveBeenCalled(); // May fail randomly
```

**Why:** stdin.write() is asynchronous. Assertions may run before the terminal processes the input, causing flaky tests.

---

### 4. Use Correct Escape Sequences

| Key        | Correct  | Common Mistakes  |
| ---------- | -------- | ---------------- |
| Enter      | `\r`     | `\n`, `\x0D`     |
| Escape     | `\x1B`   | `\e`, `\033`     |
| Arrow Up   | `\x1B[A` | `^[[A`, `\033[A` |
| Arrow Down | `\x1B[B` | `^[[B`, `\033[B` |

**Why:** JavaScript strings don't interpret `\e` as escape. Use hex codes `\x1B` consistently.

---

### 5. Clean Up Rendered Components

```typescript
let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

it('test', () => {
  const { unmount } = render(<Component />);
  cleanup = unmount;
  // ...
});
```

**Why:** Ink components may have timers, subscriptions, or side effects. Without unmount(), tests may hang or leak memory.

---

## Common Mistakes and Fixes

### Mistake 1: Using Old @oclif/test API

```typescript
// WRONG - v3 API (deprecated, doesn't work with Vitest)
test
  .stdout()
  .command(["info"])
  .it("shows info", (ctx) => {
    expect(ctx.stdout).to.contain("Version");
  });

// CORRECT - v4 API
it("shows info", async () => {
  const { stdout } = await runCommand(["info"]);
  expect(stdout).toContain("Version");
});
```

---

### Mistake 2: Not Resetting Zustand Stores

```typescript
// WRONG - State leaks between tests
describe("wizard", () => {
  it("test 1", () => {
    useWizardStore.getState().toggleSkill("react");
    // ...
  });

  it("test 2", () => {
    // ERROR: Still has 'react' selected from test 1!
    expect(useWizardStore.getState().selectedSkills).toEqual([]);
  });
});

// CORRECT - Reset in beforeEach
describe("wizard", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("test 1", () => {
    /* ... */
  });
  it("test 2", () => {
    /* ... */
  }); // Clean state
});
```

---

### Mistake 3: No Delay After stdin.write()

```typescript
// WRONG - Flaky
await stdin.write(ARROW_DOWN);
expect(lastFrame()).toContain("selected");

// CORRECT - Allow processing time
await stdin.write(ARROW_DOWN);
await delay(INPUT_DELAY_MS);
expect(lastFrame()).toContain("selected");
```

---

### Mistake 4: Using \n for Enter

```typescript
// WRONG - \n is newline, not Enter key in terminal
await stdin.write("text\n");

// CORRECT - \r is carriage return (Enter key)
await stdin.write("text" + ENTER); // ENTER = '\r'
```

---

### Mistake 5: Hardcoded Escape Sequences

```typescript
// WRONG - Magic strings, hard to maintain
await stdin.write("\x1B[B"); // What key is this?

// CORRECT - Use named constants
await stdin.write(ARROW_DOWN);
```

---

### Mistake 6: Testing UI When Store Test Suffices

```typescript
// OVERKILL - Full render just to test state
it('should toggle skill', async () => {
  const { stdin, unmount } = render(<Wizard matrix={matrix} />);
  // ... complex UI interaction
  await stdin.write(/* navigate to skill, select it */);
  expect(useWizardStore.getState().selectedSkills).toContain('react');
  unmount();
});

// BETTER - Direct store test
it('should toggle skill', () => {
  useWizardStore.getState().toggleSkill('react (@vince)');
  expect(useWizardStore.getState().selectedSkills).toContain('react (@vince)');
});
```

---

### Mistake 7: Not Isolating File System Tests

```typescript
// WRONG - Tests in current directory
it("creates config", async () => {
  await writeFile("config.yaml", "test: true");
  // Pollutes actual project!
});

// CORRECT - Use temp directories
it("creates config", async () => {
  const tempDir = await mkdtemp(os.tmpdir() + "/test-");
  const originalCwd = process.cwd();
  process.chdir(tempDir);

  try {
    await writeFile("config.yaml", "test: true");
    // Safe in temp directory
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true });
  }
});
```

---

### Mistake 8: Synchronous Frame Assertions

```typescript
// WRONG - Render hasn't happened yet
const { lastFrame } = render(<AsyncComponent />);
expect(lastFrame()).toContain('loaded'); // Fails - still loading

// CORRECT - Wait for render
const { lastFrame } = render(<AsyncComponent />);
await delay(RENDER_DELAY_MS);
expect(lastFrame()).toContain('loaded');
```

---

### Mistake 9: Missing Error Handling in Commands

```typescript
// WRONG - Error not captured
const { stdout } = await runCommand(["invalid-cmd"]);
expect(stdout).toContain("error"); // May not work

// CORRECT - Check error object
const { stdout, error } = await runCommand(["invalid-cmd"]);
if (error) {
  expect(error.oclif?.exit).toBe(1);
} else {
  expect(stdout).toContain("error");
}
```

---

### Mistake 10: Using process.exit in Component Tests

```typescript
// WRONG - process.exit terminates the test runner!
const ExitComponent = () => {
  if (error) process.exit(1);
  return <Text>OK</Text>;
};

// CORRECT - Use callbacks or throw errors
const ExitComponent = ({ onExit }) => {
  if (error) {
    onExit(1);
    return null;
  }
  return <Text>OK</Text>;
};
```

---

## Gotchas and Edge Cases

### TTY Detection

Many Ink components check `process.stdout.isTTY`. In tests, this is often `false`.

```typescript
// Components may behave differently in tests
if (!process.stdout.isTTY) {
  // Simplified output
}

// Mock if needed
beforeEach(() => {
  vi.spyOn(process.stdout, "isTTY", "get").mockReturnValue(true);
});
```

---

### CI Timing Issues

CI environments are slower. Use timing multipliers:

```typescript
const CI_MULTIPLIER = process.env.CI ? 2 : 1;
const INPUT_DELAY_MS = 50 * CI_MULTIPLIER;
const RENDER_DELAY_MS = 100 * CI_MULTIPLIER;
```

---

### Component Timers

Components with `setInterval` or `setTimeout` can cause tests to hang:

```typescript
// Component with timer
const Spinner = () => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 100);
    return () => clearInterval(id);
  }, []);
  return <Text>{frames[frame % frames.length]}</Text>;
};

// Test MUST call unmount() or timer keeps running
it('renders spinner', () => {
  const { unmount } = render(<Spinner />);
  // ... assertions
  unmount(); // CRITICAL
});
```

---

### Arrow Key Sequences Across Terminals

Arrow key escape sequences can vary by terminal emulator. The standard sequences work in most cases:

```
Arrow Up:    \x1B[A (or \x1BOA in application mode)
Arrow Down:  \x1B[B (or \x1BOB in application mode)
Arrow Right: \x1B[C (or \x1BOC in application mode)
Arrow Left:  \x1B[D (or \x1BOD in application mode)
```

ink-testing-library uses the `[` variants, which are most common.

---

### Multi-Byte Input

Some inputs span multiple bytes. stdin.write() handles this, but be aware:

```typescript
// Unicode characters work
await stdin.write("Hello");

// Emoji also work
await stdin.write("Hello 🎉");
```

---

### Exit Code Testing

Exit codes in @oclif/test v4 are on the error object:

```typescript
// No error = exit 0
const { error } = await runCommand(["info"]);
expect(error).toBeUndefined(); // Success

// Error with exit code
const { error } = await runCommand(["bad-cmd"]);
expect(error?.oclif?.exit).toBe(1);
```

---

### Testing Select with Many Options

Select components may virtualize long lists. Only visible options are rendered:

```typescript
// With 100 options, only ~10 may be visible
const { lastFrame } = render(<Select options={hundredOptions} />);

// This may fail if option is outside viewport
expect(lastFrame()).toContain('Option 50'); // May not be rendered

// Navigate to it first
await stdin.write(ARROW_DOWN.repeat(50));
await delay(INPUT_DELAY_MS);
expect(lastFrame()).toContain('Option 50');
```

---

### Parallel Test Isolation

When running tests in parallel, ensure complete isolation:

```typescript
// WRONG - Shared state
const tempDir = "/tmp/test";

// CORRECT - Unique per test
const tempDir = await mkdtemp("/tmp/test-");
```

---

### Testing useInput Hook

Components using `useInput` receive raw key data:

```typescript
const MyComponent = () => {
  useInput((input, key) => {
    if (key.escape) {
      // ESC pressed
    }
    if (key.return) {
      // Enter pressed
    }
  });
  return <Text>Press a key</Text>;
};

// Test with escape sequences
await stdin.write(ESCAPE); // key.escape = true
await stdin.write(ENTER);  // key.return = true
```

---

## Debug Techniques

### Inspect Frame Content

```typescript
it('debug frame', async () => {
  const { lastFrame } = render(<Component />);
  await delay(100);

  // Print frame content
  console.log('Frame:', JSON.stringify(lastFrame()));

  // Strip ANSI codes for cleaner output
  const clean = lastFrame()?.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  console.log('Clean:', clean);
});
```

---

### Track All Frames

```typescript
it('debug all frames', async () => {
  const { frames, stdin } = render(<Component />);

  await stdin.write(ARROW_DOWN);
  await delay(100);

  // See all rendered frames
  console.log('All frames:', frames);
});
```

---

### Debug Store Changes

```typescript
it("debug store", () => {
  const unsubscribe = useWizardStore.subscribe((state) =>
    console.log("State changed:", state),
  );

  // Actions will log state changes
  useWizardStore.getState().toggleSkill("react");

  unsubscribe();
});
```

---

## Quick Reference Card

```
ink-testing-library          @oclif/test v4
-----------------           ---------------
render()                    runCommand()
lastFrame()                 { stdout, stderr, error }
stdin.write()               error?.oclif?.exit
frames[]
unmount()

Escape Sequences            Delays
----------------           ------
ARROW_UP = '\x1B[A'        INPUT_DELAY_MS = 50
ARROW_DOWN = '\x1B[B'      RENDER_DELAY_MS = 100
ENTER = '\r'               CI: multiply by 2
ESCAPE = '\x1B'

Setup                       Cleanup
-----                      -------
beforeEach: reset stores   afterEach: unmount()
beforeEach: create tempDir afterEach: rm tempDir
process.chdir(tempDir)     process.chdir(originalCwd)
```
