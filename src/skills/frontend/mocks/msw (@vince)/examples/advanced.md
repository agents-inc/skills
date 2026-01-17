# MSW Advanced Examples

> Runtime variant switching and network simulation. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Package configuration, mock data, variant handlers
- [browser.md](browser.md) - Browser worker for development
- [node.md](node.md) - Server worker setup
- [testing.md](testing.md) - Per-test handler overrides

---

## Runtime Variant Switching

### Variant Management

```typescript
// packages/api-mocks/src/manage-mock-selection.ts
// Good Example
export type MockVariant = "default" | "empty" | "error";

export const mockVariantsByEndpoint: Record<string, MockVariant> = {
  features: "default",
  users: "default",
  // Add more endpoints as needed
};

// Optional: UI for switching variants in development
export function setMockVariant(endpoint: string, variant: MockVariant) {
  mockVariantsByEndpoint[endpoint] = variant;
}
```

**Why good:** Type-safe variant names prevent typos, centralized state for all endpoint variants, mutation function allows runtime changes, enables testing UI states without restarting app

```typescript
// Bad Example - Using strings without type safety
export const mockVariants = {
  features: "default",
  users: "defualt", // Typo not caught
};

export function setMockVariant(endpoint, variant) {
  mockVariants[endpoint] = variant;
}
```

**Why bad:** No TypeScript validation allows typos ("defualt") to slip through, any parameters accept anything causing runtime errors, no autocomplete or IDE support for variant names

**When not to use:** In test environment (use explicit handler overrides instead for deterministic behavior).

---

## Simulating Network Latency

### Implementation

```typescript
// Good Example
import { http, HttpResponse, delay } from "msw";

const MOCK_NETWORK_LATENCY_MS = 500;
const HTTP_STATUS_OK = 200;

const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    await delay(MOCK_NETWORK_LATENCY_MS);
    return HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
  });
```

**Why good:** Named constant makes latency configurable and self-documenting, realistic delay reveals loading state bugs, using MSW's `delay` utility is clean and cancellable

```typescript
// Bad Example
import { http, HttpResponse } from "msw";

const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return HttpResponse.json(defaultFeatures, { status: 200 });
  });
```

**Why bad:** Magic number 300ms without context or configurability, manual Promise wrapper instead of MSW utility, magic number 200 status code repeated, harder to disable delay when needed

**When not to use:** In tests where speed matters more than loading state validation (omit delay for faster test execution).

---

_Related examples: [core.md](core.md) | [browser.md](browser.md) | [node.md](node.md) | [testing.md](testing.md)_
