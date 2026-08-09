# OpenAPI Quick Reference

## OpenAPI 3.0 to 3.1 Migration

| Feature           | 3.0 Syntax                         | 3.1 Syntax                             |
| ----------------- | ---------------------------------- | -------------------------------------- |
| Nullable          | `nullable: true`                   | `type: ["string", "null"]`             |
| Exclusive min/max | `exclusiveMinimum: true` (boolean) | `exclusiveMinimum: 0` (number)         |
| `$ref` siblings   | Siblings ignored                   | Siblings allowed (e.g., `description`) |
| Constant value    | `enum: [value]`                    | `const: value`                         |
| Examples          | `example: "val"`                   | `examples: ["val1", "val2"]`           |
| JSON Schema       | Subset (extended)                  | Superset of Draft 2020-12              |

---

## Schema Type Quick Reference

| OpenAPI Type         | Format      | TypeScript          | Notes                      |
| -------------------- | ----------- | ------------------- | -------------------------- |
| `string`             | —           | `string`            |                            |
| `string`             | `email`     | `string`            | Validated format           |
| `string`             | `uri`       | `string`            | Validated format           |
| `string`             | `uuid`      | `string`            | Validated format           |
| `string`             | `date`      | `string`            | ISO 8601 date              |
| `string`             | `date-time` | `string`            | ISO 8601 datetime          |
| `string`             | `password`  | `string`            | UI hint only               |
| `string`             | `binary`    | `Blob`              | File upload                |
| `integer`            | —           | `number`            |                            |
| `integer`            | `int32`     | `number`            | 32-bit                     |
| `integer`            | `int64`     | `number`            | 64-bit (JS precision loss) |
| `number`             | —           | `number`            |                            |
| `number`             | `float`     | `number`            |                            |
| `number`             | `double`    | `number`            |                            |
| `boolean`            | —           | `boolean`           |                            |
| `array`              | —           | `T[]`               | `items` required           |
| `object`             | —           | `Record<string, T>` | Or typed properties        |
| `["string", "null"]` | —           | `string \| null`    | 3.1 nullable               |

---

## Composition Cheat Sheet

| Keyword         | Meaning                  | Use Case                          |
| --------------- | ------------------------ | --------------------------------- |
| `$ref`          | Reference another schema | Reuse, DRY                        |
| `allOf`         | Must match ALL schemas   | Extend base schema                |
| `oneOf`         | Must match exactly ONE   | Polymorphism with discriminator   |
| `anyOf`         | Must match ONE or MORE   | Flexible matching                 |
| `not`           | Must NOT match           | Exclusion constraint              |
| `discriminator` | Hint for codegen         | Identifies variant by field value |

---

## openapi-typescript CLI Flags

| Flag                      | Short | Default | Purpose                   |
| ------------------------- | ----- | ------- | ------------------------- |
| `--output`                | `-o`  | stdout  | Output file path          |
| `--immutable`             | —     | `false` | `readonly` properties     |
| `--alphabetize`           | —     | `false` | Sort types                |
| `--export-type`           | `-t`  | `false` | `type` vs `interface`     |
| `--enum`                  | —     | `false` | TS enums vs unions        |
| `--default-non-nullable`  | —     | `true`  | Defaults are non-nullable |
| `--path-params-as-types`  | —     | `false` | Dynamic path lookups      |
| `--exclude-deprecated`    | —     | `false` | Omit deprecated fields    |
| `--check`                 | —     | `false` | CI freshness check        |
| `--additional-properties` | —     | `false` | Allow extra properties    |
| `--array-length`          | —     | `false` | Tuple from min/maxItems   |

---

## openapi-fetch API Reference

```typescript
import createClient from "openapi-fetch";
import type { paths } from "./schema.d.ts";

// Create client
const client = createClient<paths>({ baseUrl: "https://api.example.com/v1" });

// HTTP methods
const { data, error, response } = await client.GET("/path/{id}", {
  params: { path: { id: "123" }, query: { page: 1 } },
});

const { data } = await client.POST("/path", {
  body: { field: "value" },
});

const { data } = await client.PUT("/path/{id}", {
  params: { path: { id: "123" } },
  body: { field: "updated" },
});

const { error } = await client.DELETE("/path/{id}", {
  params: { path: { id: "123" } },
});

// Middleware
client.use(middleware); // Register
client.eject(middleware); // Remove
```

### Middleware Interface

```typescript
import type { Middleware } from "openapi-fetch";

const middleware: Middleware = {
  async onRequest({ request, options }) {
    // Modify request before sending
    return request; // or undefined to skip
  },
  async onResponse({ request, response, options }) {
    // Inspect/modify response
    return response;
  },
  async onError({ error }) {
    // Handle fetch failures (NOT 4xx/5xx)
    return new Error("Network error", { cause: error });
  },
};
```

---

## Decision Framework

### When to Use Which Tool

```
Need TypeScript types from a spec?
+-- openapi-typescript (zero-runtime .d.ts files)

Need a type-safe HTTP client?
+-- openapi-fetch (6kb, uses generated paths type)

Need full SDK with Zod schemas / query hooks?
+-- @hey-api/openapi-ts (plugin ecosystem)

Need to lint / validate a spec?
+-- Redocly CLI (rules, bundling, preview)

Need to generate the spec from code?
+-- Use your framework's OpenAPI integration
```

### Spec Organization

```
Single spec under 500 lines?
+-- Single YAML file

Spec growing beyond 500 lines?
+-- Split by domain into multiple files, use $ref across files

Multiple independent APIs?
+-- Separate specs, redocly.yaml for multi-schema generation
```
