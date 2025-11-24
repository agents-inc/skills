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

@include(./docs.md)

---

@include(./examples.md)
