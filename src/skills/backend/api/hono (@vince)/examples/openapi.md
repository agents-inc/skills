# Hono + OpenAPI - Spec Generation Examples

> OpenAPI specification generation patterns. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route definition patterns from core examples first.

---

## Pattern 1: Build-Time Spec Generation

### Good Example - Build-Time Spec Generation

**File: `/scripts/generate-openapi.ts`**

```typescript
import { writeFileSync } from "fs";
import { app } from "../app/api/[[...route]]/route";

const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "1.0.0";
const INDENT_SPACES = 2;

const spec = app.getOpenAPI31Document();

if (!spec) {
  console.error("Could not generate OpenAPI spec");
  process.exit(1);
}

const fullSpec = {
  openapi: OPENAPI_VERSION,
  info: {
    version: API_VERSION,
    title: "Jobs API",
    description: "API for managing job postings",
  },
  servers: [
    { url: "http://localhost:3000/api", description: "Local development" },
    { url: "https://api.example.com/api", description: "Production" },
  ],
  ...spec,
};

const outputPath = "./public/openapi.json";
writeFileSync(outputPath, JSON.stringify(fullSpec, null, INDENT_SPACES));
console.log(`OpenAPI spec written to ${outputPath}`);
```

**Why good:** Build-time = spec generated once (fast), env-specific servers = proper URLs in docs, exit(1) fails CI if spec broken

**Package.json:**
```json
{ "scripts": { "prebuild": "bun run scripts/generate-openapi.ts && openapi-ts" } }
```

### Bad Example - Runtime spec generation

```typescript
// BAD Example - Runtime spec generation
app.get("/openapi.json", (c) => {
  // BAD: Generates spec on every request (slow)
  // BAD: No version info, no servers
  return c.json(app.getOpenAPI31Document());
});
```

**Why bad:** Runtime = regenerates on every request (CPU), no version info breaks client caching, can't use client generators at build time

---
