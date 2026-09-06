---
name: web-testing-vitest
description: Vitest test runner - configuration, assertions, mocking (vi.fn, vi.mock, vi.spyOn), fake timers, snapshot testing, coverage, workspace projects
---

# Vitest Test Runner Patterns

> **Quick Guide:** Vitest runs tests through the same transform pipeline and config the app is built
> with, so aliases, plugins and TypeScript work without a second toolchain. `describe`/`it`/`expect`
> for structure, `vi.fn()` and `vi.spyOn()` for test doubles, `vi.mock()` for whole modules, and
> `vi.useFakeTimers()` for anything clock-driven. Vitest 4 is current stable (Vite 6+, Node 20+) and
> changed several mock defaults — `vi.restoreAllMocks()` no longer resets automocks, and
> `poolOptions` is gone.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — test structure and options, spies, module mocking, fake
  timers, assertions and snapshots
- [examples/integration.md](examples/integration.md) — setup files, lifecycle hooks, environments,
  and mocking at the transport boundary
- [examples/anti-patterns.md](examples/anti-patterns.md) — what not to write a test for
- [reference.md](reference.md) — v3/v4 migration notes, config and mock API lookup

---

## Which path applies

- **Pure logic, no DOM** — the default `environment: "node"`, no setup file; follow
  [examples/core.md](examples/core.md).
- **Code that touches `document` or `window`** — set `environment: "jsdom"` (or `happy-dom`) and a
  setup file; follow [examples/integration.md](examples/integration.md).
- **Several suites with different environments in one repo** — one `projects` entry each, so a
  single run covers all of them; see [reference.md](reference.md).

---

<critical_requirements>

## Before writing Vitest code

**Pass test options as the second argument** — `test("name", { timeout: 10_000 }, () => {})`. The
trailing-options form was removed after v2, and mixing an options object with a trailing timeout is
rejected outright.

**Return every export the file under test imports from a `vi.mock()` factory.** The factory
replaces the whole module, so anything it omits is undefined at import time; reach for
`importOriginal()` to keep the rest, and remember the call is hoisted above every import in the file.

**Reset mock state between tests** — `restoreMocks: true` in config, or an explicit
`vi.resetAllMocks()` in `afterEach`. In v4 `vi.restoreAllMocks()` touches only manual spies, so
automocked modules keep their state without it.

**Mock at the boundary the code crosses.** A module mock binds the test to the import graph and
breaks on any refactor that moves a function; intercepting HTTP leaves the import graph free and
exercises serialisation.

</critical_requirements>

---

**Auto-detection:** Vitest, vitest.config, vi.fn, vi.mock, vi.spyOn, vi.hoisted, vi.mockObject,
vi.useFakeTimers, vi.advanceTimersByTime, mockResolvedValue, mockRejectedValue, importOriginal,
toMatchInlineSnapshot, expect.schemaMatching, defineConfig test block, projects, coverage provider

**Applies to:**

- Running and configuring the test runner — environments, setup files, `projects`, coverage
- Test doubles: spies, stubs, module mocks, mocked timers and mocked globals
- Assertions, async assertions and snapshots
- Deciding what to cover with a test at all, and at which level

**Handled elsewhere:**

- Rendering components and querying the result — the runner supplies the environment; what mounts
  inside it is settled by whatever owns component testing
- Defining HTTP handlers and running an interception server — this skill covers where in the test
  lifecycle they start and reset, not how they are written
- Driving a real browser through a user journey — a different tool and a different feedback loop

---

<philosophy>

Vitest reads the project's own Vite config, so a test resolves imports, aliases and plugins exactly
as the application does. That is the whole reason it needs so little configuration of its own — and
the reason a failure is usually a config question ("which environment is this suite running in?")
rather than a runner question.

</philosophy>

---

<decision_framework>

**Which kind of test double:**

- The collaborator is a function you already own a reference to → `vi.spyOn(obj, "method")`, which
  keeps the original for restore.
- The collaborator is passed in → `vi.fn()` with `mockReturnValue` / `mockResolvedValue`; no module
  machinery needed.
- The collaborator is reached over HTTP → intercept the request rather than the module, so the
  test covers serialisation and survives refactors.
- The collaborator is a module with no seam at all (filesystem, clock, crypto) → `vi.mock()` for
  the module, `vi.useFakeTimers()` for the clock, `vi.stubGlobal()` for a global.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Test structure and options

Options are the second argument. `test.each` covers table-driven cases without a loop, and
`it.concurrent` runs siblings in parallel inside one file.

```typescript
describe("formatCurrency", () => {
  it("formats the default currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("retries a known-flaky path", { retry: 2, timeout: 10_000 }, async () => {
    await expect(fetchRate()).resolves.toBeGreaterThan(0);
  });

  it.each([
    [0, "$0.00"],
    [-1, "-$1.00"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatCurrency(input)).toBe(expected);
  });
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Spies and stubs

`vi.fn()` creates a standalone double; `vi.spyOn()` wraps an existing method and can be restored.
Both record calls on `.mock`.

```typescript
const onSave = vi.fn().mockResolvedValue({ id: "1" });
await submit({ onSave });
expect(onSave).toHaveBeenCalledWith({ title: "Draft" });

const spy = vi.spyOn(clock, "now").mockReturnValue(0);
stampEvent("saved");
expect(spy).toHaveBeenCalledTimes(1);
spy.mockRestore();
```

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Module mocking

`vi.mock()` is hoisted above the imports, so its factory sees nothing from the file body unless the
value comes from `vi.hoisted()`. `importOriginal` keeps the exports the test does not replace.

```typescript
const { readConfig } = vi.hoisted(() => ({ readConfig: vi.fn() }));

vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  readConfig,
}));

readConfig.mockReturnValue({ locale: "en-US" });
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Fake timers

Install fake timers, advance them explicitly, and return to real timers afterwards so later suites
are unaffected.

```typescript
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("fires the debounced callback once", () => {
  const onIdle = vi.fn();
  watchIdle(onIdle, 300);
  vi.advanceTimersByTime(300);
  expect(onIdle).toHaveBeenCalledOnce();
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Assertions and snapshots

`toStrictEqual` compares shape as well as value; `resolves` / `rejects` keep async assertions in one
expression; inline snapshots keep the expected value beside the test.

```typescript
await expect(loadUser("missing")).rejects.toThrowError(/not found/);
expect(toSummary(order)).toStrictEqual({ total: 118, items: 2 });
expect(parseArgs(["--json"]).json).toMatchInlineSnapshot(`true`);
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Configuration and environments

The `test` block lives in the project's own config file. `environment` decides what globals a suite
gets, `setupFiles` runs before each test file, and `projects` gives one run several of each.

```typescript
import { defineConfig } from "vitest/config"; // not "vite" — that one has no `test` key

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
```

Full code: [examples/integration.md](examples/integration.md) — lookup table in
[reference.md](reference.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Options passed after the test body — `test("x", fn, { retry: 2 })` — removed after v2; put them
  in the second argument.
- A `vi.mock()` factory referencing a `const` from the file body — the call is hoisted, so the
  binding is in its temporal dead zone; take the value from `vi.hoisted()`.
- A factory that returns only the export under test — every other export becomes undefined; spread
  `await importOriginal()` first.
- A default export replaced without the `default` key — the factory's return shape is the module's
  shape, so `default: vi.fn()` is required.
- `poolOptions` in a v4 config — removed; `maxWorkers` and `isolate` are top-level.
- `coverage.all` in a v4 config — removed; `coverage.include` is now required for anything to be
  reported.

**Surprising behaviour:**

- `vi.restoreAllMocks()` in v4 restores manual spies only; automocked modules need
  `vi.resetAllMocks()`.
- `vi.fn().mock.invocationCallOrder` starts at `1` in v4, where it started at `0` before.
- `vi.fn().getMockName()` answers `"vi.fn()"` rather than `"spy"`, which changes snapshots that
  captured it.
- Automocked getters return `undefined` instead of calling the original.
- Fake timers left installed leak into later files in the same worker — pair every
  `useFakeTimers()` with `useRealTimers()`.
- An interception server's handlers are process-global; reset them after each test or one test's
  override answers the next one's request.

</red_flags>
