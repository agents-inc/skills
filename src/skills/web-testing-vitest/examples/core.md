# Vitest — Core Examples

> Test structure, spies, module mocking, fake timers, assertions. Referenced from
> [SKILL.md](../SKILL.md). See also [integration.md](integration.md) for setup files and
> environments, and [anti-patterns.md](anti-patterns.md) for what not to test.

---

## Pattern 1: Test structure and options

```typescript
// utils/cart.test.ts
import { describe, expect, it } from "vitest";
import { calculateSubtotal, calculateTotal } from "./cart";

describe("calculateSubtotal", () => {
  it("multiplies price by quantity across items", () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 },
    ];
    expect(calculateSubtotal(items)).toBe(250);
  });

  it("applies a percentage discount per item", () => {
    expect(
      calculateSubtotal([{ price: 100, quantity: 1, discountPercent: 10 }]),
    ).toBe(90);
  });

  it.each([
    [[], 0],
    [[{ price: 0, quantity: 5 }], 0],
  ])("returns 0 for %j", (items, expected) => {
    expect(calculateSubtotal(items)).toBe(expected);
  });
});

describe("calculateTotal", () => {
  // Options go in the SECOND argument; a trailing options object is rejected.
  it("adds tax and shipping", { timeout: 10_000 }, () => {
    expect(calculateTotal(100, 8, 10)).toBe(118);
  });

  // Sibling `concurrent` tests share a file but run in parallel — they must not
  // share mutable state or fake timers.
  it.concurrent("is pure", async ({ expect }) => {
    await expect(Promise.resolve(calculateTotal(1, 1, 1))).resolves.toBe(3);
  });
});
```

**Why good:** a pure function needs no environment, no setup and no doubles, so the test is only the
input and the expected output — the fastest and most stable kind of test in the suite.

---

## Pattern 2: Spies and stubs

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

describe("submitDraft", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the payload to the injected save function", async () => {
    // vi.fn(): a standalone double for a collaborator that is passed in.
    const save = vi.fn().mockResolvedValue({ id: "draft-1" });

    await submitDraft({ title: "Draft" }, save);

    expect(save).toHaveBeenCalledWith({ title: "Draft" });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ title: "Draft" });
  });

  it("surfaces a rejection from the save function", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(submitDraft({ title: "Draft" }, save)).rejects.toThrowError(
      "offline",
    );
  });

  it("reports the failure count without hiding the real method", () => {
    // vi.spyOn(): wraps an existing method, keeps the original for restore.
    const spy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    retryTwice(() => {
      throw new Error("boom");
    });

    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore(); // or rely on restoreMocks: true in config
  });

  it("changes behaviour per call", () => {
    const nextId = vi
      .fn()
      .mockReturnValueOnce("a")
      .mockReturnValueOnce("b")
      .mockReturnValue("fallback");

    expect([nextId(), nextId(), nextId()]).toStrictEqual([
      "a",
      "b",
      "fallback",
    ]);
  });
});
```

**Why good:** `vi.fn()` is enough wherever the collaborator is a parameter, which keeps the test
free of module machinery. `vi.spyOn` is the version that can be undone, so nothing leaks into the
next file.

---

## Pattern 3: Module mocking

`vi.mock()` is hoisted above every import in the file. The factory therefore runs before the module
body, and can only see values produced by `vi.hoisted()`.

```typescript
import { beforeEach, expect, it, vi } from "vitest";
import { renderInvoice } from "./invoice";

// Hoisted alongside vi.mock, so the factory can close over it.
const { readConfig } = vi.hoisted(() => ({ readConfig: vi.fn() }));

// Spread the original first: anything the factory omits is undefined at import time.
vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  readConfig,
}));

beforeEach(() => {
  readConfig.mockReturnValue({ locale: "en-US", currency: "USD" });
});

it("formats the invoice for the configured locale", () => {
  expect(renderInvoice({ total: 1234.5 })).toContain("$1,234.50");
});
```

```typescript
// A module whose default export is what the code imports:
vi.mock("./client", () => ({
  default: vi.fn(), // the `default` key is required
  isRetryable: vi.fn(), // named exports the file also imports
}));

// Replace every method on an object with a spy in one call (v3.2+):
const service = vi.mockObject(realService);
// ...keeping the original implementations while still recording calls:
const tracked = vi.mockObject(realService, { spy: true });
```

**Why good:** the mock stays narrow. `importOriginal` means a later export added to `./config`
keeps working instead of arriving as `undefined` in every test that touched the module.

**Why the alternative is worse:** a factory listing only the export under test silently removes the
others, and the failure surfaces as `X is not a function` far from the mock that caused it.

---

## Pattern 4: Fake timers

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("watchIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Fake timers persist for the worker until this runs.
    vi.useRealTimers();
  });

  it("fires once after the idle window", () => {
    const onIdle = vi.fn();
    watchIdle(onIdle, 300);

    vi.advanceTimersByTime(299);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("awaits timers that resolve promises", async () => {
    const done = vi.fn();
    void pollUntilReady().then(done);

    // The async variant flushes microtasks between ticks.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(done).toHaveBeenCalled();
  });

  it("pins the wall clock for date-dependent output", () => {
    vi.setSystemTime(new Date("2024-03-15T00:00:00Z"));
    expect(stampFilename("report")).toBe("report-2024-03-15");
  });
});
```

**Why good:** each assertion states the exact instant it cares about, so the test carries no real
delay and cannot become flaky under a loaded CI machine.

---

## Pattern 5: Assertions and snapshots

```typescript
import { expect, it } from "vitest";

it("compares shape as well as value", () => {
  // toEqual ignores undefined keys and class identity; toStrictEqual does not.
  expect(toSummary(order)).toStrictEqual({ total: 118, items: 2 });
});

it("asserts on part of a large object", () => {
  expect(buildRequest()).toMatchObject({
    headers: { accept: "application/json" },
  });
  expect(listUsers()).toEqual(
    expect.arrayContaining([expect.objectContaining({ role: "admin" })]),
  );
});

it("keeps async assertions in one expression", async () => {
  await expect(loadUser("u-1")).resolves.toMatchObject({ id: "u-1" });
  await expect(loadUser("missing")).rejects.toThrowError(/not found/);
});

it("reports every failure in the run, not just the first", () => {
  expect.soft(parseArgs([]).json).toBe(false);
  expect.soft(parseArgs([]).verbose).toBe(false);
});

it("keeps the expected value beside the test", () => {
  // Written on first run, then reviewed in the diff like any other code. The
  // serialiser decides the formatting, so write an empty call and let `-u` fill it.
  expect(parseArgs(["--json"])).toMatchInlineSnapshot(`
    {
      "json": true,
    }
  `);
});

it("validates against a schema instead of a literal (v4)", () => {
  // Asymmetric matcher; accepts any Standard Schema v1 validator.
  expect(user).toEqual({
    name: expect.schemaMatching(nameSchema),
    email: expect.schemaMatching(emailSchema),
  });
});
```

**Why good:** an inline snapshot is reviewable in the same diff as the change that moved it, where a
file snapshot is usually approved unread.
