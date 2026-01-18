# Testing - Integration Examples

> Integration tests with network-level mocking. Reference from [SKILL.md](../SKILL.md).

---

## Integration Test with Network-Level Mocking

```typescript
// Good Example - Integration test with network-level mocking
// apps/client-react/src/home/__tests__/features.test.tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../testSetup/testUtils.local";
// Import your network mocking handlers (implementation varies by mocking library)
import { featuresHandlers, mockServer } from "../test-utils/mock-server";

const EXPECTED_FEATURE_COUNT = 3;

describe("Features", () => {
  it("should render empty state", async () => {
    // Override default handler with empty response
    mockServer.use(featuresHandlers.empty());
    renderApp();

    await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
  });

  it("should render error state", async () => {
    // Override default handler with error response
    mockServer.use(featuresHandlers.error());
    renderApp();

    await expect(screen.findByText(/An error has occurred/i)).resolves.toBeInTheDocument();
  });

  it("should render features", async () => {
    // Use default handler (returns feature list)
    mockServer.use(featuresHandlers.default());
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("feature")).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("feature")).toHaveLength(EXPECTED_FEATURE_COUNT);
  });

  it("should toggle feature", async () => {
    renderApp();

    const feature = await screen.findByTestId("feature");
    const switchElement = within(feature).getByRole("switch");

    expect(switchElement).toBeChecked();

    userEvent.click(switchElement);
    await waitFor(() => expect(switchElement).not.toBeChecked());
  });
});
```

**Why good:** Tests component with API integration via network-level mocking, tests all states (loading, empty, error, success) ensuring robustness, centralized mock handlers prevent duplication, shared between tests and development for consistency

```typescript
// Bad Example - Module-level mocking
import { vi } from "vitest";
import { getFeatures } from "../api";

// Note: vi.mock is hoisted - runs before imports
// Factory must return object with explicit exports (unlike Jest)
vi.mock("../api", () => ({
  getFeatures: vi.fn(),
  // For default exports: default: vi.fn()
}));

test("renders features", async () => {
  (getFeatures as any).mockResolvedValue({ features: [] });
  // Module mocking breaks at runtime, hard to maintain
});
```

**Why bad:** Module-level mocks break when import structure changes, mocking at wrong level defeats purpose of integration testing, doesn't test network layer or serialization, maintenance nightmare when refactoring

**Vitest-specific notes:**

- Unlike Jest, `vi.mock` factory must return an object with explicit exports
- Default exports require `default` key in the returned object
- Use `importOriginal` parameter to access original module when partially mocking:

```typescript
// If you must use module mocks, use importOriginal (v3+)
vi.mock("../api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../api")>();
  return {
    ...mod,
    getFeatures: vi.fn(), // Override only specific export
  };
});
```

---

## Network Mock Setup Pattern

```typescript
// Good Example - Network mock handler setup
// src/mocks/handlers.ts
// Note: Implementation varies by your chosen mocking library

const API_USER_ENDPOINT = "/api/users/:id";

export const userHandlers = {
  default: () => ({
    method: "GET",
    path: API_USER_ENDPOINT,
    response: {
      id: "123",
      name: "John Doe",
      email: "john@example.com",
    },
  }),
  error: () => ({
    method: "GET",
    path: API_USER_ENDPOINT,
    status: 500,
    response: { error: "Internal server error" },
  }),
};
```

```typescript
// src/mocks/server.ts
// Setup varies by mocking library - this is conceptual
import { handlers } from "./handlers";

export const mockServer = createMockServer(handlers);
```

**Why good:** Network-level mocking matches real API behavior, handlers are reusable across tests and development, easy to override per-test for different scenarios

---

## Test Setup

```typescript
// Good Example - Network mock setup for tests
// setupTests.ts
import { mockServer } from "./test-utils/mock-server";

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

**Why good:** Network-level mocking intercepts HTTP requests matching real API behavior, resetHandlers() after each test prevents test pollution, centralized mock server enables reuse across tests

---

## Per-Test Overrides

```typescript
// Good Example - Test-specific handler overrides
import { featuresHandlers, mockServer } from "./test-utils/mock-server";

it("should handle empty state", async () => {
  mockServer.use(featuresHandlers.empty());
  renderApp();
  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});
```

**Why good:** Easy to test different scenarios (empty, error, success), handlers are reusable across tests, doesn't pollute global state with per-test overrides

---

_For more patterns, see:_
- [core.md](core.md) - E2E and Unit testing essentials
- [anti-patterns.md](anti-patterns.md) - What NOT to test
- [ladle-stories.md](ladle-stories.md) - Component documentation stories
