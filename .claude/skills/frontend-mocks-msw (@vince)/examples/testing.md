# MSW Testing Examples

> Per-test handler overrides for testing different scenarios. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Package configuration, mock data, variant handlers
- [browser.md](browser.md) - Browser worker for development
- [node.md](node.md) - Server worker setup
- [advanced.md](advanced.md) - Variant switching, network latency

---

## Per-Test Handler Overrides

### Test Implementation

```typescript
// apps/client-react/src/__tests__/features.test.tsx
// Good Example
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { serverWorker } from "@repo/api-mocks/serverWorker";

it("should render features", async () => {
  // Uses default handler
  renderApp();
  // Assert using your component testing library
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});

it("should render empty state", async () => {
  // Override with empty handler for this test
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();

  await expect(findByText("No features found")).resolves.toBeInTheDocument();
});

it("should handle errors", async () => {
  // Override with error handler for this test
  serverWorker.use(getFeaturesHandlers.errorHandler());
  renderApp();

  await expect(findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why good:** `serverWorker.use()` scoped to individual test for isolation, explicit handler names make test intent clear, tests all scenarios (success, empty, error) for comprehensive coverage, `afterEach` reset ensures overrides don't leak

```typescript
// Bad Example - Only testing happy path
it("should render features", async () => {
  renderApp();
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});
// Missing: tests for empty and error scenarios
```

**Why bad:** Only tests default success scenario, empty and error states go untested causing bugs to reach production, no validation that error handling works, incomplete test coverage

---

_Related examples: [core.md](core.md) | [browser.md](browser.md) | [node.md](node.md) | [advanced.md](advanced.md)_
