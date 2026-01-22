# React Testing Library - Configuration Examples

> Global configuration and userEvent setup options. Reference from [SKILL.md](../SKILL.md).

---

## Global Configuration

```typescript
// Good Example - Test setup file configuration
// test-setup.ts (referenced in vitest.config.ts or jest.config.js)
import { configure } from "@testing-library/react";
import "@testing-library/jest-dom";

// Configure Testing Library defaults
configure({
  // Change default test ID attribute
  testIdAttribute: "data-test-id",

  // Increase default async timeout (default: 1000ms)
  asyncUtilTimeout: 5000,

  // Throw errors on deprecated features
  throwSuggestions: true,
});
```

**Why good:** Centralizes configuration in setup file, applies to all tests automatically

---

## Custom Test ID Attribute

```typescript
// Good Example - Using custom test ID attribute
import { configure, render, screen } from "@testing-library/react";

// Configure custom attribute (typically in setup file)
configure({ testIdAttribute: "data-automation-id" });

// Component uses custom attribute
function MyComponent() {
  return <div data-automation-id="my-element">Content</div>;
}

test("finds element by custom test ID", () => {
  render(<MyComponent />);

  // getByTestId now uses data-automation-id
  expect(screen.getByTestId("my-element")).toBeInTheDocument();
});
```

**Why good:** Supports legacy test ID conventions or team-specific attributes

---

## userEvent with Fake Timers

```typescript
// Good Example - userEvent with Vitest fake timers
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebounceSearch } from "./debounce-search";

const DEBOUNCE_DELAY_MS = 300;

describe("DebounceSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("debounces search input", async () => {
    // CRITICAL: Pass advanceTimers when using fake timers
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });

    const onSearch = vi.fn();
    render(<DebounceSearch onSearch={onSearch} debounceMs={DEBOUNCE_DELAY_MS} />);

    // Type triggers debounce
    await user.type(screen.getByRole("searchbox"), "react");

    // Not called yet (debounce pending)
    expect(onSearch).not.toHaveBeenCalled();

    // Advance timers past debounce delay
    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);

    // Now called
    expect(onSearch).toHaveBeenCalledWith("react");
  });
});
```

**Why good:** Required for tests using fake timers - without advanceTimers, userEvent delays hang indefinitely

---

## userEvent Pointer Events Check

```typescript
// Good Example - Skipping pointer events check
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadingButton } from "./loading-button";

test("clicks button with pointer-events: none during loading", async () => {
  // Skip pointer events check for elements with pointer-events: none
  const user = userEvent.setup({
    pointerEventsCheck: 0, // 0 = never check
  });

  const onClick = vi.fn();
  render(<LoadingButton onClick={onClick} isLoading={true} />);

  // Button has pointer-events: none when loading
  // Without pointerEventsCheck: 0, this would fail
  await user.click(screen.getByRole("button"));

  // Click still fires (tests event handler, not CSS behavior)
  expect(onClick).toHaveBeenCalled();
});

// Default behavior (recommended for most tests)
test("respects pointer-events: none by default", async () => {
  const user = userEvent.setup(); // Default: pointerEventsCheck: 2

  render(<LoadingButton isLoading={true} />);

  // This would throw error because button has pointer-events: none
  // await user.click(screen.getByRole("button")); // THROWS
});
```

**Pointer events check levels:**

- `0` = Never check (skip all checks)
- `1` = Check once per target element
- `2` = Check per API call (default, most thorough)

---

## userEvent Delay Options

```typescript
// Good Example - Customizing event delays
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TypeAhead } from "./type-ahead";

test("fast typing for performance tests", async () => {
  // No delay between events (faster tests)
  const user = userEvent.setup({
    delay: null, // null = no delay
  });

  render(<TypeAhead />);

  // Types instantly without delays between keystrokes
  await user.type(screen.getByRole("textbox"), "Hello World");
});

test("realistic typing speed", async () => {
  // Custom delay between events (simulates real typing)
  const user = userEvent.setup({
    delay: 50, // 50ms between each event
  });

  render(<TypeAhead />);

  // Types with realistic delays (slower but more realistic)
  await user.type(screen.getByRole("textbox"), "Hello");
});
```

**Why good:** Allows trading off between test speed and realistic behavior

---

## Combined Configuration Pattern

```typescript
// Good Example - Test-specific configuration
import { render, screen, configure } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComplexForm } from "./complex-form";

const LONG_TIMEOUT_MS = 10000;

describe("ComplexForm with slow API", () => {
  beforeAll(() => {
    // Increase timeout for slow async operations
    configure({ asyncUtilTimeout: LONG_TIMEOUT_MS });
  });

  afterAll(() => {
    // Reset to default
    configure({ asyncUtilTimeout: 1000 });
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("handles slow form submission", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      delay: null, // Fast typing
    });

    render(<ComplexForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // Wait for slow response (uses increased timeout)
    const successMessage = await screen.findByText(/success/i);
    expect(successMessage).toBeInTheDocument();
  });
});
```

**Why good:** Combines global config changes with userEvent setup for specific test scenarios

---

## Reset Configuration Between Tests

```typescript
// Good Example - Resetting configuration
import { configure, getConfig } from "@testing-library/react";

describe("tests with custom config", () => {
  let originalConfig: ReturnType<typeof getConfig>;

  beforeAll(() => {
    // Save original config
    originalConfig = getConfig();

    // Apply custom config
    configure({
      testIdAttribute: "data-custom-id",
      asyncUtilTimeout: 3000,
    });
  });

  afterAll(() => {
    // Restore original config
    configure(originalConfig);
  });

  test("uses custom config", () => {
    expect(getConfig().testIdAttribute).toBe("data-custom-id");
    expect(getConfig().asyncUtilTimeout).toBe(3000);
  });
});
```

**Why good:** Prevents config changes from leaking between test suites

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy
- [async-testing.md](async-testing.md) - Async utilities with custom timeouts
- [user-events.md](user-events.md) - userEvent patterns
