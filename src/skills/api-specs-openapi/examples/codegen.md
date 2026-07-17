# TypeScript Code Generation

> Related: [core.md](core.md) for spec structure, [validation.md](validation.md) for request/response validation

---

## Pattern 1: CLI Type Generation with openapi-typescript

Generate zero-runtime TypeScript types from your OpenAPI spec.

### Basic Usage

```bash
# From local file
npx openapi-typescript ./api/openapi.yaml -o ./api/schema.d.ts

# From remote URL
npx openapi-typescript https://api.example.com/openapi.json -o ./api/schema.d.ts

# With useful flags
npx openapi-typescript ./api/openapi.yaml -o ./api/schema.d.ts \
  --immutable \           # Generate readonly properties and arrays
  --alphabetize \         # Sort types alphabetically
  --export-type           # Use 'type' instead of 'interface'
```

### Useful CLI Flags

| Flag                     | Default | Purpose                                      |
| ------------------------ | ------- | -------------------------------------------- |
| `--immutable`            | `false` | Generate `readonly` properties and arrays    |
| `--alphabetize`          | `false` | Sort generated types alphabetically          |
| `--export-type`          | `false` | Export `type` instead of `interface`         |
| `--enum`                 | `false` | Generate TypeScript enums (vs string unions) |
| `--default-non-nullable` | `true`  | Properties with defaults are non-nullable    |
| `--path-params-as-types` | `false` | Enable dynamic string lookups on paths       |
| `--exclude-deprecated`   | `false` | Omit deprecated fields                       |
| `--check`                | `false` | Verify types match current schema (CI)       |

---

## Pattern 2: Multi-Schema Config with redocly.yaml

For projects with multiple OpenAPI specs, use `redocly.yaml` (globbing is deprecated in v7).

```yaml
# redocly.yaml
apis:
  jobs@v1:
    root: ./specs/jobs.yaml
    x-openapi-ts:
      output: ./generated/jobs.ts
  companies@v1:
    root: ./specs/companies.yaml
    x-openapi-ts:
      output: ./generated/companies.ts
      # Per-schema overrides
      alphabetize: true
      immutable: true
```

```bash
# Generate all schemas (reads redocly.yaml automatically)
npx openapi-typescript
```

### Authenticated Remote Specs

```yaml
# redocly.yaml
resolve:
  http:
    headers:
      - matches: https://api.example.com/**
        name: X-API-KEY
        envVariable: API_KEY
```

---

## Pattern 3: Using Generated Types

The generated file exports `paths`, `components`, `operations`, and other top-level types.

```typescript
import type { paths, components } from "./api/schema.d.ts";

// Access schema types directly
type Job = components["schemas"]["Job"];
type Error = components["schemas"]["Error"];
type CreateJobInput = components["schemas"]["CreateJobInput"];

// Access path operation types
type ListJobsQuery = paths["/jobs"]["get"]["parameters"]["query"];

type ListJobsResponse =
  paths["/jobs"]["get"]["responses"]["200"]["content"]["application/json"];

type GetJobResponse =
  paths["/jobs/{jobId}"]["get"]["responses"]["200"]["content"]["application/json"];
```

**Why good:** all types derive from the spec, changing the spec and regenerating keeps everything in sync, zero runtime cost

---

## Pattern 4: openapi-fetch Client Setup

`openapi-fetch` is a 6kb type-safe fetch wrapper. It infers all types from the generated `paths` type.

### Basic Client

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./api/schema.d.ts";

const API_BASE_URL = "https://api.example.com/v1";

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
});
```

### CRUD Operations

```typescript
// GET -- list with query params
const { data: jobList, error: listError } = await apiClient.GET("/jobs", {
  params: {
    query: { page: 1, limit: 20, status: "active" },
  },
});

// GET -- single resource with path param
const { data: job, error: getError } = await apiClient.GET("/jobs/{jobId}", {
  params: { path: { jobId: "abc-123" } },
});

// POST -- create with request body
const { data: newJob, error: createError } = await apiClient.POST("/jobs", {
  body: {
    title: "Senior Engineer",
    companyId: "company-456",
    salary: { min: 120000, max: 180000, currency: "USD" },
  },
});

// PUT -- update
const { data: updated, error: updateError } = await apiClient.PUT(
  "/jobs/{jobId}",
  {
    params: { path: { jobId: "abc-123" } },
    body: { title: "Staff Engineer" },
  },
);

// DELETE
const { error: deleteError } = await apiClient.DELETE("/jobs/{jobId}", {
  params: { path: { jobId: "abc-123" } },
});
```

**Why good:** paths, parameters, request bodies, and responses are all type-checked against the spec. Typos in paths or invalid params are compile-time errors.

---

## Pattern 5: openapi-fetch Middleware

Middleware intercepts requests and responses. Use for auth headers, logging, and error handling.

### Auth Middleware

```typescript
import type { Middleware } from "openapi-fetch";

let accessToken: string | undefined;

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (accessToken) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return request;
  },
};

// Register middleware
apiClient.use(authMiddleware);

// Remove middleware later if needed
apiClient.eject(authMiddleware);
```

### Error Logging Middleware

```typescript
const loggingMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (!response.ok) {
      console.error(
        `API error: ${request.method} ${request.url} -> ${response.status}`,
      );
    }
    return response;
  },
};

apiClient.use(loggingMiddleware);
```

### Error Throwing Middleware

```typescript
const throwOnError: Middleware = {
  async onResponse({ response }) {
    if (!response.ok) {
      throw new Error(`${response.url}: ${response.status}`);
    }
    return response;
  },
};
```

**Execution order:** `onRequest` callbacks run in registration order. `onResponse` callbacks run in reverse order.

**Gotcha:** `onError` does NOT catch 4xx/5xx responses -- those are successful HTTP responses. Check `response.ok` or `response.status` in `onResponse` instead. `onError` only fires for network/fetch failures.

---

## Pattern 6: Response Handling Patterns

### Discriminated Error Handling

```typescript
const { data, error, response } = await apiClient.GET("/jobs/{jobId}", {
  params: { path: { jobId } },
});

// data and error are discriminated -- only one is defined
if (error) {
  // error is typed to the spec's error response schema
  switch (error.code) {
    case "not_found":
      // Handle 404
      break;
    case "unauthorized":
      // Handle 401
      break;
    default:
      // Unknown error
      break;
  }
  return;
}

// data is typed to the spec's 200 response schema
console.log(data.title);
```

### Accessing Response Headers

```typescript
const { data, response } = await apiClient.GET("/jobs", {
  params: { query: { page: 1 } },
});

// response is the raw Response object
const rateLimit = response.headers.get("X-RateLimit-Remaining");
const retryAfter = response.headers.get("Retry-After");
```

---

## Pattern 7: Programmatic Type Generation

Use the Node.js API when you need custom transforms (e.g., converting `date-time` strings to `Date` types).

```typescript
import fs from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";

const DATE_TYPE = ts.factory.createTypeReferenceNode("Date");
const NULL_TYPE = ts.factory.createLiteralTypeNode(ts.factory.createNull());

const ast = await openapiTS(new URL("./api/openapi.yaml", import.meta.url), {
  transform(schemaObject) {
    // Convert date-time strings to Date type
    if (schemaObject.format === "date-time") {
      return Array.isArray(schemaObject.type) &&
        schemaObject.type.includes("null")
        ? ts.factory.createUnionTypeNode([DATE_TYPE, NULL_TYPE])
        : DATE_TYPE;
    }
  },
});

const contents = astToString(ast);
fs.writeFileSync("./api/schema.ts", contents);
```

**When to use programmatic API:** custom type transforms (Date, Blob), build pipeline integration, dynamic schema loading, adding validation annotations to generated types.
