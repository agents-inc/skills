# React Testing Library - Configuration Examples

> Non-obvious configuration patterns. See [core.md](core.md) for query patterns.

---

## userEvent with Fake Timers

```typescript
// Good Example - userEvent with fake timers
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
```

**Pointer events check levels:**

- `0` = Never check (skip all checks)
- `1` = Check once per target element
- `2` = Check per API call (default, most thorough)

---

## Combined Configuration with Fake Timers

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
// Good Example - Saving and restoring configuration
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
