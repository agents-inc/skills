# Vitest Reference

> Version notes, migration steps and config lookup. See [SKILL.md](SKILL.md) for the patterns and
> [examples/core.md](examples/core.md) for the code.

**Current stable:** Vitest 4.x — requires Vite 6+ and Node 20+. Browser Mode is stable in this line
and ships visual regression testing.

---

## v4 breaking changes

| Was                                                          | Now                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `poolOptions: { threads: { maxThreads } }`                   | `maxWorkers` at the top level                              |
| `poolOptions` single-thread flags                            | `maxWorkers: 1, isolate: false`                            |
| `coverage.all`                                               | removed — `coverage.include` is required                   |
| `coverage.ignoreEmptyLines`, `experimentalAstAwareRemapping` | removed — the v8 provider is AST-based                     |
| `vi.restoreAllMocks()` resets everything                     | manual spies only; use `vi.resetAllMocks()` for automocks  |
| `vi.fn().getMockName()` → `"spy"`                            | `"vi.fn()"` — update snapshots that captured it            |
| automocked getters call the original                         | return `undefined`                                         |
| `mock.invocationCallOrder` starts at `0`                     | starts at `1`                                              |
| `basic` reporter                                             | `['default', { summary: false }]`                          |
| `verbose` reporter is hierarchical                           | flat — use `tree` for the old output                       |
| default excludes cover many directories                      | only `node_modules` and `.git` — scope with `test.dir`     |
| shadow roots omitted from snapshots                          | printed — `printShadowRoot: false` restores the old output |
| `deps.optimizer.web`                                         | `deps.optimizer.client`                                    |

## v3 breaking changes still worth knowing

**Test options moved to the second argument**, and combining an options object with a trailing
timeout is invalid:

```typescript
test("heavy", { retry: 2, timeout: 10_000 }, () => {}); // valid
test("heavy", () => {}, { retry: 2 }); // invalid since v3
test("heavy", { skip: true }, () => {}, 10_000); // invalid — timeout belongs in the object
```

**`vitest.workspace.js` was deprecated in v3.2** in favour of `projects` inside the main config:

```typescript
export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        extends: true,
        test: { name: "unit", include: ["tests/**/*.unit.test.ts"] },
      },
    ],
  },
});
```

---

## API added in the v3/v4 line

| API                             | Since | What it does                                                                         |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| `vi.mockObject(obj)`            | 3.2   | Replaces every method on an object with a spy                                        |
| `vi.mockObject(obj, { spy })`   | 3.2   | Keeps the implementations while recording calls                                      |
| `expect.schemaMatching(schema)` | 4.0   | Asymmetric matcher for any Standard Schema v1 validator; negatable with `expect.not` |

---

## Config lookup

| Option              | Effect                                                  | Typical value                      |
| ------------------- | ------------------------------------------------------- | ---------------------------------- |
| `environment`       | Globals available to a suite                            | `"node"`, `"jsdom"`, `"happy-dom"` |
| `setupFiles`        | Runs before each test file                              | `["./tests/setup.ts"]`             |
| `globalSetup`       | Runs once per run, in Node, before any file             | ports, containers, seed data       |
| `globals`           | Exposes `describe`/`it`/`expect` without importing them | `false` — explicit imports         |
| `restoreMocks`      | Restores spies between tests                            | `true`                             |
| `clearMocks`        | Clears call history between tests                       | `true`                             |
| `maxWorkers`        | Worker count (v4; replaces the pool-specific options)   | unset locally, pinned in CI        |
| `isolate`           | Fresh module registry per file                          | `true`                             |
| `coverage.provider` | Coverage engine                                         | `"v8"`                             |
| `coverage.include`  | Files to report on — required in v4                     | `["src/**/*.ts"]`                  |
| `projects`          | Several named configs in one run                        | see above                          |

Per-file override, no config change needed:

```typescript
// @vitest-environment jsdom
```

---

## Mock API lookup

| Call                                                   | Use for                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `vi.fn()`                                              | A double for a collaborator passed in as an argument        |
| `vi.spyOn(obj, "method")`                              | Wrapping an existing method, restorable                     |
| `vi.mock(path, factory)`                               | Replacing a module; hoisted above imports                   |
| `vi.hoisted(() => …)`                                  | Values a `vi.mock` factory needs to close over              |
| `vi.unmock(path)` / `vi.doMock(path)`                  | Cancelling a mock, and mocking without hoisting             |
| `vi.mockObject(obj)`                                   | Spying on every method of an object at once                 |
| `vi.useFakeTimers()` / `vi.useRealTimers()`            | Controlling the clock, and handing it back                  |
| `vi.advanceTimersByTime(ms)` / `…ByTimeAsync(ms)`      | Ticking; the async form flushes microtasks between ticks    |
| `vi.setSystemTime(date)`                               | Pinning `Date.now()` for date-dependent output              |
| `vi.stubEnv(key, value)` / `vi.stubGlobal(key, value)` | Environment and global overrides, undone by `vi.unstubAll…` |
| `vi.resetAllMocks()`                                   | Full reset, including automocks (v4)                        |

---

## CLI

```bash
npx vitest              # watch mode
npx vitest run          # single run
npx vitest run --coverage
npx vitest run --project unit
npx vitest run -t "formats the default currency"
npx vitest --ui
```
