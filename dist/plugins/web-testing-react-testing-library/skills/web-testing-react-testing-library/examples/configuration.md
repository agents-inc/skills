# React Testing Library - Configuration Examples

> The `userEvent.setup()` options that change behaviour, and the global `configure()` values worth moving. See [core.md](core.md) for queries and [async-testing.md](async-testing.md) for the timeouts these interact with.

> `useFakeTimers`, `useRealTimers`, `advanceTimersBy` and `advanceTimersByAsync` below stand for your test runner's fake-timer controls, and `fn()` for its mock-function factory. Installing fake timers, and what they patch, is the runner's concern; what is this skill's concern is the one option that has to be handed the runner's advance function.

---

## Fake timers, and the option that makes them work

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebounceSearch } from "./debounce-search";

const DEBOUNCE_DELAY_MS = 300;

describe("DebounceSearch", () => {
  beforeEach(() => useFakeTimers());
  afterEach(() => useRealTimers());

  test("debounces search input", async () => {
    // Without advanceTimers, userEvent's own inter-event delay is scheduled on the
    // patched clock, nothing advances it, and the first interaction never resolves
    const user = userEvent.setup({ advanceTimers: advanceTimersBy });

    const onSearch = fn();
    render(<DebounceSearch onSearch={onSearch} debounceMs={DEBOUNCE_DELAY_MS} />);

    await user.type(screen.getByRole("searchbox"), "react");
    expect(onSearch).not.toHaveBeenCalled();

    await advanceTimersByAsync(DEBOUNCE_DELAY_MS); // async form: lets promises settle too

    expect(onSearch).toHaveBeenCalledWith("react");
  });
});
```

**Why good:** the hang this prevents presents as a timeout with no error, which is the hardest failure to attribute. The async advance matters as well — advancing synchronously fires the timer but does not let the promise chain it starts resolve before the assertion.

---

## Interacting with an element the CSS has disabled for pointers

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadingButton } from "./loading-button";

test("the click handler still fires while loading", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });

  const onClick = fn();
  render(<LoadingButton onClick={onClick} isLoading />);

  await user.click(screen.getByRole("button"));

  expect(onClick).toHaveBeenCalled();
});
```

`pointerEventsCheck` takes `0` (never check), `1` (check once per target) or `2` (check on every API call, the default). Turning it off asserts about the handler and stops asserting about the CSS, so reach for it only when the CSS is deliberately not the subject — a component that is _meant_ to be unclickable should keep the check and assert that the click was refused.

---

## Raising the async timeout for a slow subject

```typescript
import { render, screen, configure } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComplexForm } from "./complex-form";

describe("ComplexForm with a slow submission", () => {
  beforeAll(() => configure({ asyncUtilTimeout: 10_000 }));
  afterAll(() => configure({ asyncUtilTimeout: 1000 })); // back to the default

  test("handles slow form submission", async () => {
    const user = userEvent.setup({ delay: null }); // no inter-event wait

    render(<ComplexForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/success/i)).toBeInTheDocument();
  });
});
```

Prefer the per-query `{ timeout }` option when one subject is slow; move it to `configure` only when the whole suite is.

---

## Restoring configuration between suites

```typescript
import { configure, getConfig } from "@testing-library/react";

describe("tests with a custom test id attribute", () => {
  let originalConfig: ReturnType<typeof getConfig>;

  beforeAll(() => {
    originalConfig = getConfig(); // capture before mutating
    configure({ testIdAttribute: "data-custom-id", asyncUtilTimeout: 3000 });
  });

  afterAll(() => configure(originalConfig));

  test("uses the custom attribute", () => {
    expect(getConfig().testIdAttribute).toBe("data-custom-id");
  });
});
```

**Why good:** `configure` mutates one module-level object shared by every file in the process. Capturing and restoring the whole config, rather than resetting the two keys you remember changing, is what keeps a later suite from inheriting a setting it never asked for.

The full option table is in [reference.md](../reference.md).

---

_Back to [core.md](core.md) for the query hierarchy._
