# API Client Patterns

**Auto-detection:** OpenAPI schema, hey-api code generation, generated React Query hooks, MSW mocking, API client configuration

**When to use:**

- Setting up hey-api to generate client from OpenAPI specs
- Using generated React Query query options (getFeaturesOptions pattern)
- Configuring MSW mocks for API endpoints
- Troubleshooting API type generation or regeneration

**Key patterns covered:**

- OpenAPI-first development with hey-api (@hey-api/openapi-ts)
- Generated React Query hooks and query options (never custom hooks)
- Centralized MSW mocking with @repo/api-mocks
- Type safety from generated types (never manual type definitions)

---

# API Client Architecture

> **Quick Guide:** Using OpenAPI? Need type safety? Integrating with React Query? Setting up MSW mocks?

---

## OpenAPI/Swagger Integration

- Schema-first development approach
- **Using hey-api (@hey-api/openapi-ts)** with plugins:
  - `@hey-api/client-fetch` for fetch-based client
  - `@tanstack/react-query` for automatic React Query hooks
- Type generation from OpenAPI specs
- Generated query options and query keys
- Keeping schemas in sync with backend
- Manual regeneration when schema changes (`bun run build` in packages/api)

---

## Client Configuration

- Base URL configuration via `client.setConfig()` (environment-specific)
- Configure in app providers before React Query setup
- No interceptors (fetch-based client)
- Authentication handling via fetch headers (if needed)
- Timeout configuration at fetch level
- Retry logic handled by React Query (not at client level)
- Global defaults set in QueryClient configuration

---

## Type Safety

- **Generated types from OpenAPI** (never manual)
- All types auto-generated from schema (types, requests, responses)
- Type inference from generated query options
- Full autocomplete in components
- Breaking change detection via TypeScript errors
- Optional: Runtime validation with Zod schemas (if generated from OpenAPI)

---

## Error Handling

- Component-level error handling (isPending, error, isSuccess states)
- React Query's built-in retry logic (exponential backoff)
- Global error defaults in QueryClient configuration
- Per-query error handling and retry customization
- Network error handling via React Query
- No interceptors (fetch-based client doesn't support them)
- Display errors where they occur (better UX)

---

## Integration with React Query

- **Generated query options** from `@tanstack/react-query` plugin
- Use `getFeaturesOptions()` instead of writing custom hooks
- Generated query keys automatically namespaced
- Type inference works automatically
- Customize generated options by spreading them
- No manual query key factories needed
- Mutations follow same generated pattern

---

## MSW for API Mocking

- Centralized mock package (@repo/api-mocks)
- Separation of handlers and mock data
- Variant switching (default, empty, error scenarios)
- Shared mocks between browser (dev) and Node (tests)
- Type-safe mocks using generated types
- Per-test handler overrides

**RED FLAGS:**

- ❌ Manual API type definitions (should be generated from OpenAPI)
- ❌ Manual React Query hooks (should use generated query options)
- ❌ Hardcoded API URLs (should use environment variables)
- ❌ Not using generated types from `@repo/api/types`
- ❌ Writing custom query key factories (should use generated keys)
- ❌ Inconsistent error handling patterns
- ❌ Not separating handlers and mock data in MSW setup
- ❌ Trying to use interceptors with fetch-based client


---

# API Client Architecture - Examples

---

## OpenAPI/Swagger Integration

### Example: OpenAPI-Generated Client with hey-api + React Query

```yaml
# packages/api/openapi.yaml
openapi: 3.1.0
info:
  title: Side project features API
  description: API for managing side project features
  version: 0.0.1

servers:
  - url: /api/v1
    description: API routes

components:
  schemas:
    Feature:
      type: object
      properties:
        id:
          type: string
          description: Auto-generated ID for the feature
        name:
          type: string
          description: Name of the feature
        description:
          type: string
          description: Description of the feature
        status:
          type: string
          description: Status 'not started' | 'in progress' | 'done'
      required: [id, name, description, status]

paths:
  /features:
    get:
      summary: Get features
      responses:
        "200":
          description: Features
          content:
            application/json:
              schema:
                type: object
                properties:
                  features:
                    type: array
                    items:
                      $ref: "#/components/schemas/Feature"
```

```typescript
// packages/api/openapi-ts.config.ts
import { defaultPlugins, defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.yaml",
  output: {
    format: "prettier",
    lint: "eslint",
    path: "./src/apiClient",
  },
  // Generate both fetch client AND React Query hooks
  plugins: [...defaultPlugins, "@hey-api/client-fetch", "@tanstack/react-query"],
});
```

```json
// packages/api/package.json
{
  "name": "@repo/api",
  "scripts": {
    "build": "openapi-ts"
  },
  "exports": {
    "./types": "./src/apiClient/types.gen.ts",
    "./client": "./src/apiClient/services.gen.ts",
    "./reactQueries": "./src/apiClient/@tanstack/react-query.gen.ts"
  },
  "devDependencies": {
    "@hey-api/openapi-ts": "^0.59.2",
    "@hey-api/client-fetch": "^0.3.3",
    "@tanstack/react-query": "^5.62.11"
  }
}
```

**Generated files (auto-generated, do not edit):**

```typescript
// packages/api/src/apiClient/types.gen.ts
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export type GetFeaturesResponse = {
  features?: Feature[];
};
```

```typescript
// packages/api/src/apiClient/@tanstack/react-query.gen.ts
import type { QueryObserverOptions } from "@tanstack/react-query";
import { getFeaturesQueryKey, getFeatures } from "./services.gen";

// Auto-generated query options
export const getFeaturesOptions = (): QueryObserverOptions<GetFeaturesResponse> => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});
```

**Usage in apps:**

```typescript
// apps/client-next/app/features.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

export default function FeaturesPage() {
  // Use generated query options - fully typed!
  const { data, isPending, error } = useQuery(getFeaturesOptions());

  if (isPending) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}
```

**Why:**

- **Single source of truth:** OpenAPI schema defines everything
- **Automatic type generation:** Types, client functions, AND React Query hooks
- **Zero manual typing:** No need to write query functions or types
- **Type-safe queries:** Autocomplete and type checking for API calls
- **Consistent patterns:** All API calls use the same generated pattern

**Edge Cases:**

- Run `bun run build` in packages/api when OpenAPI schema changes
- Commit generated files for review (helps catch API breaking changes)
- Use explicit package.json exports to expose only what consumers need
- Configure API client base URL via environment variables in each app

---

## Client Configuration

_Examples coming soon_

---

## Type Safety

**Pattern:** All types are auto-generated from the OpenAPI schema using `@hey-api/openapi-ts`.

```typescript
// packages/api/src/apiClient/types.gen.ts (AUTO-GENERATED)
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export type GetFeaturesResponse = {
  features?: Feature[];
};
```

**Usage with type inference:**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import type { Feature } from "@repo/api/types";

export default function FeaturesPage() {
  const { data } = useQuery(getFeaturesOptions());

  // data is typed as GetFeaturesResponse | undefined
  // data.features is typed as Feature[] | undefined
  const features: Feature[] | undefined = data?.features;

  return (
    <ul>
      {features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>  // Full autocomplete!
      ))}
    </ul>
  );
}
```

**Why:** Zero manual typing. Types match backend exactly. Breaking changes detected via TypeScript errors.

---

## Error Handling

### Example: Error Handling with React Query

**Pattern:** Handle errors at the component level using React Query's built-in error handling

```typescript
// apps/client-next/app/features.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import { Info } from "@repo/ui/info";

export default function FeaturesPage() {
  const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());

  // Handle pending state
  if (isPending) {
    return <Skeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <Info
        variant="error"
        message={`An error has occurred: ${error}`}
      />
    );
  }

  // Handle empty state
  if (isSuccess && !data?.features?.length) {
    return <Info variant="info" message="No features found" />;
  }

  // Handle success state
  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}
```

### Example: Global Error Handling with QueryClient

```typescript
// apps/client-next/app/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Don't retry in development
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      onError: (error) => {
        // Global error handling for mutations
        console.error("Mutation error:", error);
        toast.error("Something went wrong. Please try again.");
      },
    },
  },
});

// Configure API client base URL
client.setConfig({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Example: Per-Query Error Handling

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

function Features() {
  const { data, error } = useQuery({
    ...getFeaturesOptions(),
    retry: 3, // Retry 3 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      // Component-specific error handling
      console.error("Failed to load features:", error);
      toast.error("Failed to load features");
    },
  });

  return <div>{/* ... */}</div>;
}
```

**Why:**

- **React Query handles retry logic:** Built-in exponential backoff
- **Component-level control:** Each component decides how to handle errors
- **Global defaults:** Consistent error handling across the app
- **No interceptors needed:** fetch-based client doesn't support interceptors
- **Better UX:** Show errors where they occur, not globally

**Edge Cases:**

- Use `retry: false` during development with MSW to fail fast
- Set appropriate `staleTime` to reduce unnecessary refetches
- Handle network errors vs API errors differently if needed
- Log errors to monitoring service in production

---

## Integration with React Query

### Example: Using Generated React Query Hooks

**Pattern:** Use generated query options directly - no need to write custom hooks!

**What's generated for you:**

```typescript
// packages/api/src/apiClient/@tanstack/react-query.gen.ts (AUTO-GENERATED)
import type { QueryObserverOptions } from "@tanstack/react-query";
import { getFeaturesQueryKey, getFeatures } from "./services.gen";

export const getFeaturesOptions = (): QueryObserverOptions<GetFeaturesResponse> => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});

// Query key is also generated
export function getFeaturesQueryKey() {
  return ["api", "v1", "features"] as const;
}
```

**Customizing generated options:**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

function Features() {
  const { data } = useQuery({
    ...getFeaturesOptions(),
    // Override defaults
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    enabled: someCondition, // Conditional fetching
  });

  return <div>{/* ... */}</div>;
}
```

**Why:**

- **Zero boilerplate:** No custom hooks to write
- **Type-safe:** All types inferred from generated options
- **Consistent patterns:** Same pattern for all API calls
- **Query keys managed:** Generated query keys are automatically namespaced
- **Easy to customize:** Spread generated options and override as needed

**Edge Cases:**

- For complex scenarios, you can still write custom hooks that wrap generated options
- Query keys are generated based on the API endpoint structure
- Mutations would follow the same pattern (use generated mutation options)
- Re-generate after OpenAPI schema changes to get new endpoints

---

## MSW for API Mocking

### Example: Centralized MSW Mocks with Variants

**Pattern:** Separate package for mocks with variant switching

**Package structure:**

```
packages/api-mocks/
├── src/
│   ├── handlers/
│   │   ├── index.ts
│   │   └── features/
│   │       └── getFeatures.ts
│   ├── mocks/
│   │   ├── index.ts
│   │   └── features.ts
│   ├── browserWorker.ts
│   ├── serverWorker.ts
│   └── manageMockSelection.ts
└── package.json
```

**Mock data (separate from handlers):**

```typescript
// packages/api-mocks/src/mocks/features.ts
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

**Handlers with variant switching:**

```typescript
// packages/api-mocks/src/handlers/features/getFeatures.ts
import { http, HttpResponse } from "msw";
import { mockVariantsByEndpoint } from "../../manageMockSelection";
import { defaultFeatures, emptyFeatures } from "../../mocks/features";

const URL = "api/v1/features";

const defaultResponse = () => HttpResponse.json(defaultFeatures, { status: 200 });
const emptyResponse = () => HttpResponse.json(emptyFeatures, { status: 200 });
const errorResponse = () => new HttpResponse("General error", { status: 500 });

// Default handler with variant switching
const defaultHandler = () =>
  http.get(URL, async () => {
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
  emptyHandler: () => http.get(URL, async () => emptyResponse()),
  errorHandler: () => http.get(URL, async () => errorResponse()),
};
```

**Package exports:**

```json
// packages/api-mocks/package.json
{
  "name": "@repo/api-mocks",
  "exports": {
    "./handlers": "./src/handlers/index.ts",
    "./mocks": "./src/mocks/index.ts",
    "./browserWorker": "./src/browserWorker.ts",
    "./serverWorker": "./src/serverWorker.ts"
  }
}
```

**Usage in development (browser):**

```typescript
// apps/client-react/src/main.tsx
import { browserWorker } from "@repo/api-mocks/browserWorker";

async function enableMocking() {
  if (import.meta.env.DEV) {
    await browserWorker.start({
      onUnhandledRequest: "bypass",
    });
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
```

**Usage in tests (Node):**

```typescript
// apps/client-react/src/__tests__/features.test.tsx
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { serverWorker } from "@repo/api-mocks/serverWorker";
import { screen } from "@testing-library/react";

it("should render empty state", async () => {
  // Override with empty handler for this test
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();

  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});

it("should handle errors", async () => {
  // Override with error handler for this test
  serverWorker.use(getFeaturesHandlers.errorHandler());
  renderApp();

  await expect(screen.findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why:**

- **Centralized mocks:** Shared between all apps and tests
- **Variant switching:** Test different scenarios (default, empty, error)
- **Separation of concerns:** Handlers separate from mock data
- **Type-safe:** Uses types from `@repo/api/types`
- **Reusable:** Same handlers for browser (dev) and Node (tests)
- **Easy testing:** Override handlers per-test for different scenarios

**Edge Cases:**

- Browser worker vs server worker setup is different (separate exports)
- Variant switching allows runtime mock selection in dev (useful for UI development)
- Keep mock data realistic - use actual types from generated API client
- Consider adding `delay()` to simulate network latency in development

