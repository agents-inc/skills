# Vitest — Integration Test Machinery

> Environments, setup files, lifecycle hooks and transport-level mocking. Referenced from
> [SKILL.md](../SKILL.md). See [core.md](core.md) for the runner's core API.

An integration test in Vitest is an ordinary test file with two extra things configured: an
**environment** that supplies the globals the code under test expects, and a **setup file** that
starts and resets whatever stands in for the outside world.

---

## Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // "node" (default) | "jsdom" | "happy-dom" | "edge-runtime"
    environment: "jsdom",
    // Runs once per test FILE, before its tests.
    setupFiles: ["./tests/setup.ts"],
    // Runs once per RUN, in Node, before any file — for ports, containers, seeds.
    globalSetup: ["./tests/global-setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

A single file can override the environment without a second config, which keeps one stray DOM test
out of the whole suite's budget:

```typescript
// @vitest-environment jsdom
```

**Why good:** the environment is the expensive part of a test run. Declaring it per suite means the
pure-logic files stay in Node and finish in milliseconds.

---

## Setup file lifecycle

```typescript
// tests/setup.ts
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mock-server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
// Handlers are process-global: without this, an override in one test answers the next one's request.
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Why good:** `onUnhandledRequest: "error"` turns a request nobody stubbed into a failure with a URL
in it, rather than a timeout or a silent empty response fifty lines away.

---

## Mocking at the transport boundary

The handler API belongs to whichever interception library the project uses; what matters here is
where the calls sit in the Vitest lifecycle and what the test asserts.

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../../tests/mock-server";
import { featureHandlers } from "./handlers";

describe("loadFeatures", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("returns the parsed feature list", async () => {
    server.use(featureHandlers.list());
    await expect(loadFeatures()).resolves.toHaveLength(3);
  });

  it("returns an empty list rather than throwing", async () => {
    server.use(featureHandlers.empty());
    await expect(loadFeatures()).resolves.toStrictEqual([]);
  });

  it("surfaces a server error as a typed failure", async () => {
    server.use(featureHandlers.error(500));
    await expect(loadFeatures()).rejects.toThrowError(/failed to load/i);
  });
});
```

**Why good:** the code under test is exercised through the request it really makes, so the JSON
shape, the status handling and the parsing are all covered. Nothing here knows how `loadFeatures`
imports its client, so moving that import breaks no test.

**Why a module mock is worse here:** `vi.mock("./client")` replaces the transport with a resolved
value, which skips serialisation entirely and re-binds the test to the import graph. Keep module
mocks for collaborators with no transport at all — the filesystem, the clock, a native module.

---

## Several environments in one run

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["src/**/*.dom.test.ts"],
        },
      },
    ],
  },
});
```

**Why good:** one command runs both, the reporter labels each failure with its project name, and
neither suite pays for the other's environment. `projects` replaced the separate workspace file in
v3.2 — see [reference.md](../reference.md).

---

## Stubbing environment variables and globals

```typescript
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("reads the API base from the environment", () => {
  vi.stubEnv("API_URL", "https://api.test");
  expect(resolveBaseUrl()).toBe("https://api.test");
});

it("treats a missing crypto implementation as a hard failure", () => {
  vi.stubGlobal("crypto", undefined);
  expect(() => newRequestId()).toThrowError(/crypto/i);
});
```

**Why good:** both stubs are undone by a named call rather than by remembering the previous value,
so a test that fails mid-way still leaves the process clean.
