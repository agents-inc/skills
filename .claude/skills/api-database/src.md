# API Development & Database Patterns (Hono + Drizzle + Neon)

**Auto-detection:** Hono, @hono/zod-openapi, OpenAPIHono, createRoute, drizzle-orm, Neon serverless, @neondatabase/serverless, hey-api, openapi-ts, db.query, db.transaction

**When to use:**

- Building type-safe REST APIs in Next.js API routes with Hono
- Defining OpenAPI specifications with automatic validation using @hono/zod-openapi
- Querying Neon serverless Postgres with Drizzle ORM
- Generating type-safe API clients with hey-api/openapi-ts
- Managing database schemas, relations, and transactions
- Implementing CRUD operations with proper error handling
- Working with serverless/edge-compatible database connections

**Key patterns covered:**

- Hono API route setup with OpenAPI integration
- Zod schema definition with OpenAPI metadata
- Drizzle schema design (tables, relations, enums)
- Database connection configuration for Neon serverless
- Relational queries with .with() and query builder
- Transaction patterns for data consistency
- Error handling and validation
- OpenAPI spec generation and client generation workflow
- Pagination, filtering, and sorting patterns
- Data transformation utilities

---

@include(./docs.md)

---

@include(./examples.md)
