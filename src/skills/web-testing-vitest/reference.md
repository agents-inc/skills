# Testing Reference

> Decision frameworks and Vitest v3/v4 migration notes. See [SKILL.md](SKILL.md) for core patterns.

---

## Vitest v3/v4 Notes

> **Current Stable:** Vitest 4.x (released December 2025). Requires Vite >= 6.0.0 and Node.js >= 20.0.0. v4 marks Browser Mode as stable and includes visual regression testing.

**Test Options Syntax (v3+ breaking change):**

```typescript
// CORRECT (v3+): Options as second argument
test("example", { retry: 2 }, () => {
  /* ... */
});

// Include timeout in options object (NOT as third argument)
test("heavy test", { retry: 2, timeout: 10_000 }, () => {
  /* ... */
});

// DEPRECATED (v2): Options as third argument - NO LONGER WORKS in v4
test("example", () => {}, { retry: 2 }); // INVALID
```

**CRITICAL:** When using options object, you cannot also pass timeout as third argument:

```typescript
// WRONG: Cannot combine options object with third argument
test("test", { skip: true }, () => {}, 10_000); // INVALID

// CORRECT: Include timeout in options object
test("test", { skip: true, timeout: 10_000 }, () => {}); // VALID
```

**Workspace Migration (v3.2+ - workspace deprecated):**

```typescript
// OLD: vitest.workspace.js file (DEPRECATED in v3.2)
// OLD: test: { workspace: './vitest.workspace.js' } (DEPRECATED)

// NEW: use `projects` directly in vitest.config.ts
export default defineConfig({
  test: {
    projects: ["./packages/*"],
  },
});

// With inline configuration
export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.unit.test.ts"],
        },
      },
    ],
  },
});
```

**Pool Configuration (v4 breaking change):**

```typescript
// OLD (v3): maxThreads/maxForks
export default defineConfig({
  test: {
    poolOptions: {
      threads: { maxThreads: 4 },
    },
  },
});

// NEW (v4): maxWorkers (unified)
export default defineConfig({
  test: {
    maxWorkers: 4,
    // For single-worker mode (replaces singleThread/singleFork):
    // maxWorkers: 1, isolate: false
  },
});
```

**Coverage Changes (v4):**

```typescript
// REMOVED in v4: coverage.all option
// V8 provider now uses AST-based analysis (more accurate)

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"], // REQUIRED: Must explicitly define
      // REMOVED: all, ignoreEmptyLines, experimentalAstAwareRemapping
    },
  },
});
```

**Schema Validation Matcher (v4 - asymmetric matcher):**

```typescript
import { expect, test } from "vitest";
import { z } from "zod";

// expect.schemaMatching() is an asymmetric matcher (NOT toMatchSchema)
// Works with any Standard Schema v1 library: Zod, Valibot, ArkType
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

test("validates user schema fields", () => {
  const user = { name: "John", email: "john@example.com" };

  // Use inside equality matchers
  expect(user).toEqual({
    name: expect.schemaMatching(z.string()),
    email: expect.schemaMatching(z.string().email()),
  });

  // Negation
  expect({ email: "not-an-email" }).toEqual({
    email: expect.not.schemaMatching(z.string().email()),
  });
});
```

**vi.mockObject (v3.2+):**

```typescript
import { vi } from "vitest";

// Deep mock an object with all methods as spies
const mockService = vi.mockObject({
  getUser: () => ({ id: 1, name: "Test" }),
  saveUser: (user: User) => user,
});

// With spy option to preserve implementations while tracking calls
const trackedService = vi.mockObject(realService, { spy: true });
```

**vi.mock Factory with importOriginal:**

```typescript
import { vi } from "vitest";

// Access original module in factory
vi.mock("./module.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./module.js")>();
  return {
    ...mod,
    namedExport: vi.fn(), // Override specific export
  };
});

// For default exports, must use `default` key
vi.mock("./module.js", () => ({
  default: vi.fn(),
  namedExport: vi.fn(),
}));
```

**Other v4 Breaking Changes:**

- `vi.fn().getMockName()` returns `"vi.fn()"` instead of `"spy"` - update snapshot assertions
- `vi.restoreAllMocks()` only affects manual spies, not automocks - use `vi.resetAllMocks()` for full reset
- Automocked getters return `undefined` by default instead of calling originals
- `basic` reporter removed - use `['default', { summary: false }]`
- `verbose` reporter is now flat - use `tree` for hierarchical output
- Default excludes simplified to only `node_modules` and `.git` - use `test.dir` for scoping
- Shadow root now printed in snapshots - set `printShadowRoot: false` to restore old behavior
- `deps.optimizer.web` renamed to `deps.optimizer.client`

---

## Decision Framework

```
Is it a user-facing workflow?
├─ YES → Write E2E test (Playwright)
└─ NO → Is it a pure function with no side effects?
    ├─ YES → Write unit test (Vitest)
    └─ NO → Is it component behavior in isolation?
        ├─ MAYBE → Integration test acceptable but E2E preferred
        └─ NO → Is it a React component?
            └─ YES → Write E2E test, NOT unit test

Test organization decision:
├─ Is it an integration/unit test?
│   └─ YES → Co-locate with code (direct or __tests__ subdirectory)
└─ Is it an E2E test?
    └─ YES → Place in tests/e2e/ organized by user journey
```

**Migration Path for Existing Codebases:**

1. Keep integration tests for component behavior
2. Add E2E tests for user workflows
3. Eventually: E2E tests primary, integration tests secondary
