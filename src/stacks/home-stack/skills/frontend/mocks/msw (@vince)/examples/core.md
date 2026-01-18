# MSW Core Examples

> Core setup and handler patterns for MSW. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [browser.md](browser.md) - Browser worker setup, SPA/SSR integration
- [node.md](node.md) - Server worker setup, test configuration
- [testing.md](testing.md) - Per-test handler overrides
- [advanced.md](advanced.md) - Variant switching, network latency

---

## Package Configuration

```json
// packages/api-mocks/package.json
// Good Example
{
  "name": "@repo/api-mocks",
  "exports": {
    "./handlers": "./src/handlers/index.ts",
    "./mocks": "./src/mocks/index.ts",
    "./browserWorker": "./src/browser-worker.ts",
    "./serverWorker": "./src/server-worker.ts"
  }
}
```

**Why good:** Separate entry points prevent bundling unnecessary code (browser worker won't bundle in tests), explicit exports make dependencies clear, kebab-case file names follow project conventions

```json
// Bad Example
{
  "name": "@repo/api-mocks",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**Why bad:** Single entry point bundles everything together causing browser worker to load in Node tests (performance hit), mixing concerns violates separation of environments, harder to tree-shake unused code

---

## Mock Data Separation

### Mock Data Definition

```typescript
// packages/api-mocks/src/mocks/features.ts
// Good Example
import type { GetFeaturesResponse } from "@repo/api/types";

export const defaultFeatures: GetFeaturesResponse = {
  features: [
    {
      id: "1",
      name: "Dark mode",
      description: "Toggle dark mode",
      status: "done",
    },
    {
      id: "2",
      name: "User authentication",
      description: "JWT-based auth",
      status: "in progress",
    },
  ],
};

export const emptyFeatures: GetFeaturesResponse = {
  features: [],
};
```

**Why good:** Type safety from generated API types catches schema mismatches at compile time, reusable across multiple handlers, easy to update centrally when API changes, `import type` optimizes bundle size

```typescript
// Bad Example
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({
    features: [
      { id: "1", name: "Dark mode", description: "Toggle dark mode", status: "done" },
    ],
  });
});
```

**Why bad:** Mock data embedded in handler cannot be reused in other tests or handlers, no type checking against API schema causes runtime errors when schema changes, harder to test edge cases with different data variants

---

## Variant Handlers

### Handler Implementation

```typescript
// packages/api-mocks/src/handlers/features/get-features.ts
// Good Example
import { http, HttpResponse } from "msw";
import type { GetFeaturesResponse } from "@repo/api/types";
import { mockVariantsByEndpoint } from "../../manage-mock-selection";
import { defaultFeatures, emptyFeatures } from "../../mocks/features";

const API_ENDPOINT = "api/v1/features";
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Response factories
const defaultResponse = () => HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
const emptyResponse = () => HttpResponse.json(emptyFeatures, { status: HTTP_STATUS_OK });
const errorResponse = () => new HttpResponse("General error", { status: HTTP_STATUS_INTERNAL_SERVER_ERROR });

// Default handler with variant switching (for development)
const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    switch (mockVariantsByEndpoint.features) {
      case "empty": {
        return emptyResponse();
      }
      case "error": {
        return errorResponse();
      }
      default: {
        return defaultResponse();
      }
    }
  });

// Export handlers for different scenarios
export const getFeaturesHandlers = {
  defaultHandler,
  emptyHandler: () => http.get(API_ENDPOINT, async () => emptyResponse()),
  errorHandler: () => http.get(API_ENDPOINT, async () => errorResponse()),
};
```

**Why good:** Named constants eliminate magic numbers for maintainability, response factories reduce duplication and ensure consistency, variant switching enables UI development without code changes, explicit handler exports allow per-test overrides

```typescript
// Bad Example
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({ features: [] }, { status: 200 });
});
```

**Why bad:** Hardcoded 200 status is a magic number, only supports one scenario (empty) making error state testing impossible, no variant switching forces code changes to test different states, single export prevents flexible test scenarios

---

_Extended examples: [browser.md](browser.md) | [node.md](node.md) | [testing.md](testing.md) | [advanced.md](advanced.md)_
