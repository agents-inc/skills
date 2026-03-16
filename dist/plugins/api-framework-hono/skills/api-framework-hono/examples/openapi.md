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

const API_VERSION = "1.0.0";
const INDENT_SPACES = 2;

// getOpenAPI31Document requires a config object with openapi version and info
const spec = app.getOpenAPI31Document({
  openapi: "3.1.0",
  info: {
    title: "Jobs API",
    version: API_VERSION,
    description: "API for managing job postings",
  },
  servers: [
    { url: "http://localhost:3000/api", description: "Local development" },
    { url: "https://api.example.com/api", description: "Production" },
  ],
});

const outputPath = "./public/openapi.json";
writeFileSync(outputPath, JSON.stringify(spec, null, INDENT_SPACES));
console.log(`OpenAPI spec written to ${outputPath}`);
```

**Why good:** Build-time = spec generated once (fast), env-specific servers = proper URLs in docs, config object provides required OpenAPI metadata

You can also use `app.doc31("/doc", config)` to serve the spec at a route endpoint, but build-time generation is preferred for client code generators.

**Package.json:**

```json
{
  "scripts": { "prebuild": "bun run scripts/generate-openapi.ts && openapi-ts" }
}
```

### Bad Example - Runtime spec generation

```typescript
// BAD Example - Runtime spec generation
app.get("/openapi.json", (c) => {
  // BAD: Generates spec on every request (slow)
  // BAD: No servers config for client generators
  return c.json(
    app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "API", version: "1.0.0" },
    }),
  );
});
```

**Why bad:** Runtime = regenerates on every request (CPU cost), no servers config = no proper URLs for clients, can't use client generators at build time

---
