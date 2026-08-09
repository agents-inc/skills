# Request/Response Validation

> Related: [core.md](core.md) for spec structure, [codegen.md](codegen.md) for type generation

---

## Pattern 1: Spec Validation and Linting

Validate your OpenAPI spec for correctness before generating types or publishing documentation. Catch structural errors, missing `$ref` targets, and convention violations early.

### Redocly CLI

```bash
# Install
npm install -D @redocly/cli

# Lint a spec
npx redocly lint ./api/openapi.yaml

# Bundle multi-file specs into a single file
npx redocly bundle ./api/openapi.yaml -o ./api/bundled.yaml

# Preview docs locally
npx redocly preview-docs ./api/openapi.yaml
```

### redocly.yaml Configuration

```yaml
# redocly.yaml
extends:
  - recommended

rules:
  # Require operationId on every operation
  operation-operationId: error

  # Require descriptions on operations
  operation-description: warn

  # Require tags on operations
  operation-tag-defined: error

  # Reject unused components
  no-unused-components: warn

  # Require info contact
  info-contact: warn
```

**Why good:** catches missing `operationId`, broken `$ref`, unused schemas, and convention violations before they reach codegen

---

## Pattern 2: Runtime Validation Strategies

### Spec-Derived Validation (Recommended)

When you write the spec first, derive runtime validation from it. The spec is the single source of truth for both types AND validation rules.

**Strategy 1: Generate Zod schemas from spec**

```bash
# Generate Zod schemas from OpenAPI spec
npx @hey-api/openapi-ts \
  -i ./api/openapi.yaml \
  -o ./api/generated \
  -p @hey-api/zod
```

This generates Zod schemas matching your OpenAPI schemas. Your validation layer uses generated schemas, keeping validation in sync with the spec automatically.

**Strategy 2: Framework-native validation from spec**

Many API frameworks read the OpenAPI spec directly and validate incoming requests against it at the middleware level. The spec defines the validation rules, the framework enforces them -- no separate validation code to maintain.

### Code-Derived Spec (Alternative)

When you write validation schemas first (code-first), generate the spec from them. Libraries like `zod-to-openapi` or framework-specific OpenAPI integrations derive the OpenAPI spec from your Zod schemas.

```typescript
// Code-first: Zod schema IS the source of truth
// OpenAPI spec is generated from it
// (import z from your framework's OpenAPI integration)
import { z } from "zod-to-openapi";

const CreateJobSchema = z
  .object({
    title: z.string().min(1).max(200),
    companyId: z.string().uuid(),
  })
  .openapi("CreateJobInput");
```

**When to use code-first:** Framework provides first-class OpenAPI generation, rapid prototyping, single-team internal APIs.

---

## Pattern 3: Request Validation Patterns

Regardless of spec-first or code-first, these patterns apply to validating incoming requests.

### Path Parameter Validation

```yaml
# In the spec
parameters:
  - name: jobId
    in: path
    required: true
    schema:
      type: string
      format: uuid
```

The `format: uuid` constraint should be enforced at runtime. Either your framework validates against the spec, or your validation layer checks the format.

### Query Parameter Validation with Defaults

```yaml
parameters:
  - name: page
    in: query
    schema:
      type: integer
      minimum: 1
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20
  - name: sort
    in: query
    schema:
      type: string
      enum: [createdAt, updatedAt, title]
      default: createdAt
```

**Key point:** Query params arrive as strings over HTTP. Your validation layer must coerce `"20"` to `20` for integer params.

### Request Body Validation

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/CreateJobInput"
```

The `required: true` means the body must be present. The schema's own `required` array defines which fields within the body are mandatory.

---

## Pattern 4: Response Validation

Validate outgoing responses in development/testing to catch implementation drift from the spec.

### Development-Time Response Validation

```typescript
// Only in development -- validate responses match spec
function validateResponse(
  path: string,
  method: string,
  statusCode: number,
  body: unknown,
): void {
  if (process.env.NODE_ENV !== "development") return;

  // Use your spec validation library to check body against
  // the response schema for this path/method/status
  const isValid = specValidator.validateResponse(
    path,
    method,
    statusCode,
    body,
  );

  if (!isValid) {
    console.warn(
      `Response for ${method.toUpperCase()} ${path} (${statusCode}) does not match spec`,
      specValidator.errors,
    );
  }
}
```

**Why validate responses:** Catches implementation bugs where the handler returns data that doesn't match the spec. Run in development/CI, not production.

---

## Pattern 5: Error Response Contract

Define a consistent error shape in the spec and enforce it across all endpoints.

```yaml
components:
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          description: Machine-readable error code
          examples: ["validation_error", "not_found", "unauthorized"]
        message:
          type: string
          description: Human-readable message
        details:
          type: array
          items:
            type: object
            required: [field, message]
            properties:
              field:
                type: string
              message:
                type: string
```

### Consistent Error Formatting

```typescript
// Named error codes from the spec
const ERROR_CODES = {
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  INTERNAL_ERROR: "internal_error",
} as const;

interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

function formatValidationError(
  issues: Array<{ path: string; message: string }>,
): ApiError {
  return {
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "Validation failed",
    details: issues.map((issue) => ({
      field: issue.path,
      message: issue.message,
    })),
  };
}

function formatNotFoundError(resource: string, id: string): ApiError {
  return {
    code: ERROR_CODES.NOT_FOUND,
    message: `${resource} with id '${id}' not found`,
  };
}
```

**Why good:** every endpoint returns the same error shape, clients can reliably parse errors, machine-readable codes enable programmatic handling

---

## Pattern 6: CI Pipeline Integration

Validate specs and check type freshness in CI to prevent drift.

```bash
# 1. Lint the spec
npx redocly lint ./api/openapi.yaml

# 2. Check if generated types are up to date
npx openapi-typescript ./api/openapi.yaml --check

# 3. Type-check the project (catches mismatches between generated types and code)
npx tsc --noEmit
```

**`--check` flag:** Compares the current generated file against what the spec would produce. Fails if they differ -- forces developers to regenerate types after spec changes.

### package.json Scripts

```json
{
  "scripts": {
    "api:lint": "redocly lint ./api/openapi.yaml",
    "api:generate": "openapi-typescript ./api/openapi.yaml -o ./api/schema.d.ts",
    "api:check": "openapi-typescript ./api/openapi.yaml --check",
    "precommit": "npm run api:lint && npm run api:check && tsc --noEmit"
  }
}
```
