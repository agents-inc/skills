# Backend API Reference

> Decision frameworks, anti-patterns, and red flags for Hono + OpenAPI. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

**Hono + OpenAPI:** Public/multi-client APIs, need docs, complex validation, type generation with OpenAPI client generators

**Server Actions:** Simple forms, internal-only, no external API consumers, no complex validation

### When to Use Hono + OpenAPI

- Building type-safe REST APIs in Next.js API routes with Hono
- Defining OpenAPI specifications with automatic validation
- Creating standardized error responses with proper status codes
- Implementing filtering, pagination, and sorting patterns
- Need public or multi-client API with documentation
- Production APIs requiring rate limiting, CORS, health checks

### When NOT to Use Hono + OpenAPI

- Simple CRUD operations with no external consumers (use Server Actions instead)
- Internal-only APIs without documentation requirements (simpler approaches exist)
- Forms that don't need complex validation (React Hook Form + Server Actions)
- When building GraphQL APIs (use Apollo Server or similar)
- Single-use endpoints with no schema reuse (over-engineering)

### Pagination Decision

**Offset-based:** Most CRUD (simple). Use for standard list views.

**Cursor-based:** Real-time feeds or >100k rows (no page skipping, but handles inserts during pagination).

### Rate Limiting Decision

**When to use:** Any public API, APIs with external consumers, production deployments.

**When not to use:** Internal APIs behind VPN/firewall don't need rate limiting overhead.

### CORS Decision

**When to use:** APIs consumed by web apps from different origins.

**When not to use:** Same-origin only APIs (no external consumers) don't need CORS config.

### Health Check Decision

**Shallow `/health`:** Fast, no dependency checks. Use for load balancer liveness probes.

**Deep `/health/deep`:** Includes dependency checks. Use for readiness probes and monitoring.

### RPC vs REST Client Decision (v4.x)

**Use Hono RPC (`hc`):**

- Full-stack TypeScript monorepo
- Same Hono version on client and server
- Want end-to-end type safety without code generation
- Building internal APIs consumed by your own frontend

**Use REST/OpenAPI Client:**

- Multi-language clients (Python, Go, etc.)
- External consumers need generated SDKs
- Different teams own server and client
- Need formal OpenAPI documentation

### Context Storage vs Props Drilling Decision (v4.6.0+)

**Use Context Storage (`getContext`):**

- Accessing Cloudflare Workers bindings in utility functions
- Deep call stacks where passing context is cumbersome
- Typed variables needed across module boundaries

**Use Props Drilling:**

- Simple handlers with shallow call stacks
- Testing is easier with explicit dependencies
- Functions need to work outside request context

### Combine Middleware Decision

**Use `some()`:** First successful auth wins (premium API key skips rate limiting)

**Use `every()`:** All checks must pass (IP restriction AND bearer auth)

**Use `except()`:** Apply middleware to all paths except specific ones (public endpoints)

</decision_framework>

---

<red_flags>

## RED FLAGS

### High Priority Issues

- **Not using `.openapi()` on Zod schemas** - OpenAPI spec won't include schema metadata or examples
- **Forgetting `extendZodWithOpenApi(z)`** - Breaks schema registration entirely
- **Not handling validation errors properly** - Hono validates, but you must return proper error shapes
- **Not exporting `app` instance** - Can't generate OpenAPI spec at build time
- **Missing `operationId` in routes** - Generated client has ugly method names like `get_api_v1_jobs`
- **JWT/JWK without explicit `alg` option** - Vulnerable to algorithm confusion attacks (CVE-2026-22818) allowing forged tokens

### Medium Priority Issues

- **Queries without soft delete checks** - Returns deleted records to users
- **No pagination limits** - Can return massive datasets and crash clients
- **Generating spec at runtime** - Use build-time generation (prebuild script)
- **Missing error logging** - Can't debug production issues
- **No total count in paginated responses** - Can't build proper pagination UI
- **No rate limiting on public APIs** - Vulnerable to abuse and DDoS
- **Wildcard CORS with credentials** - Security violation (browsers reject this)
- **Missing health check endpoints** - Can't monitor or auto-scale properly
- **Logging PII without sanitization** - GDPR/compliance violations

### Common Mistakes

- **Not using `c.req.valid()` for params** - Bypasses validation entirely
- **Using `parseInt()` without radix** - Can cause bugs (always use `parseInt(str, 10)`)
- **Transforming data in queries** - Do it in transformation utilities for reusability
- **Inline route handlers** - Create God files (use `app.route()` for modularization)
- **Case-sensitive filters** - Poor UX (use `LOWER()` for text comparisons)
- **Not returning proper status codes** - Always specify (200, 404, 500, etc.)
- **Missing context in console.error** - Log operation name with error
- **No rate limit headers** - Clients can't track usage or implement backoff
- **Health checks without timeouts** - Can hang load balancers indefinitely
- **No correlation IDs in logs** - Can't trace requests across services
- **Missing Cache-Control headers** - Unnecessary server load and slow responses

### Gotchas & Edge Cases

- **Health checks on Kubernetes:** Use `/health` for liveness, `/health/deep` for readiness
- **Rate limiting in multi-instance:** In-memory stores don't work - use Redis
- **CORS preflight:** OPTIONS requests bypass auth middleware - configure CORS before auth
- **ETags with dynamic content:** Don't use for user-specific data (generates new ETag per user)
- **Correlation IDs:** Forward from client if present (`X-Correlation-ID` header)
- **JWT `alg` option:** Required since v4.11.4 - omitting it allows algorithm confusion attacks where attackers forge tokens
- **RPC version mismatch:** Client and server MUST use same Hono version for RPC types to work correctly
- **RPC route chaining:** Routes must be chained (`.get().post()`) for type inference - separate `app.get()` calls break inference
- **RPC TypeScript strict mode:** Both client and server `tsconfig.json` MUST have `"strict": true` for RPC type inference to work properly
- **Context Storage requires middleware:** `contextStorage()` middleware must be registered BEFORE any code calls `getContext()`
- **getContext() throws:** Use `tryGetContext()` (v4.11.0+) in code that may run outside request context (tests, background jobs)
- **Middleware `next()` never throws:** Since Hono catches errors, wrapping `await next()` in try/catch is unnecessary
- **some/every execution order:** Middleware in `some()` runs sequentially until first success; in `every()` runs until first failure

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Inline Route Handlers Without Modularization

```typescript
// ANTI-PATTERN: All routes in one file
const app = new OpenAPIHono();

app.get("/jobs", async (c) => {
  /* 100+ lines */
});
app.get("/jobs/:id", async (c) => {
  /* 100+ lines */
});
app.get("/companies", async (c) => {
  /* 100+ lines */
});
app.get("/users", async (c) => {
  /* 100+ lines */
});
// ... 1000+ line file
```

**Why it's wrong:** Creates God files that are unmaintainable, no separation of concerns, hard to test individual routes.

**What to do instead:** Use `app.route()` to mount modular route files.

---

### Missing OpenAPI Schema Registration

```typescript
// ANTI-PATTERN: Zod schema without .openapi()
const JobSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255),
});

app.get("/jobs", async (c) => {
  return c.json({ jobs: [] });
});
```

**Why it's wrong:** No OpenAPI spec generation, no auto-documentation, loses type safety benefits.

**What to do instead:** Always use `extendZodWithOpenApi(z)` first, then `.openapi()` on schemas.

---

### Magic Numbers in API Code

```typescript
// ANTI-PATTERN: Magic numbers everywhere
const results = await db.select().from(jobs).limit(100);

if (count > 50) {
  return c.json({ error: "Rate limited" }, 429);
}

c.header("Cache-Control", "max-age=3600");
```

**Why it's wrong:** Numbers scattered across code, impossible to tune, no documentation of intent.

**What to do instead:** Use named constants like `DEFAULT_QUERY_LIMIT = 100`, `CACHE_MAX_AGE_SECONDS = 3600`.

---

### Validation Bypass

```typescript
// ANTI-PATTERN: Reading params directly without validation
app.get("/jobs/:id", async (c) => {
  const id = c.req.param("id"); // No validation!
  const country = c.req.query("country"); // Could be undefined

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
  });
});
```

**Why it's wrong:** Bypasses Zod validation, no type safety, crashes on bad input.

**What to do instead:** Always use `c.req.valid("param")` and `c.req.valid("query")` with createRoute.

---

### Insecure CORS Configuration

```typescript
// ANTI-PATTERN: Wildcard + credentials
app.use(
  "*",
  cors({
    origin: "*",
    credentials: true, // Browsers will reject this!
  }),
);
```

**Why it's wrong:** Violates CORS spec, browsers reject wildcard with credentials.

**What to do instead:** Use origin allowlist with explicit origins.

---

### Slow Health Checks

```typescript
// ANTI-PATTERN: Heavy checks on every ping
app.get("/health", async (c) => {
  await checkDatabase();
  await checkRedis();
  await checkExternalService();
  return c.json({ status: "ok" });
});
```

**Why it's wrong:** Load balancers ping frequently, this creates unnecessary load.

**What to do instead:** Use shallow `/health` for liveness, deep `/health/deep` for readiness.

---

### Logging PII Without Sanitization

```typescript
// ANTI-PATTERN: Logging user data directly
app.use("*", async (c, next) => {
  console.log("Request body:", await c.req.json());
  await next();
});
```

**Why it's wrong:** Logs may contain emails, passwords, credit cards - GDPR violation.

**What to do instead:** Sanitize PII patterns and redact sensitive fields before logging.

---

### No Error Context

```typescript
// ANTI-PATTERN: Generic error handling
try {
  // ... operation
} catch (error) {
  return c.json({ error: "Error" }, 500);
}
```

**Why it's wrong:** Can't debug in production, no correlation, no operation context.

**What to do instead:** Log with correlation ID, operation name, and structured format.

---

### Missing RPC Route Chaining

```typescript
// ANTI-PATTERN: Separate route definitions break type inference
const app = new OpenAPIHono();

app.openapi(getUserRoute, async (c) => {
  /* ... */
});
app.openapi(createUserRoute, async (c) => {
  /* ... */
});

export type AppType = typeof app; // Types won't include route details!
```

**Why it's wrong:** Separate `app.openapi()` calls don't chain types - client won't have route type info.

**What to do instead:** Chain route definitions: `const routes = app.openapi(route1, handler1).openapi(route2, handler2);` then export `typeof routes`.

---

### Using getContext() Without contextStorage Middleware

```typescript
// ANTI-PATTERN: getContext() without middleware setup
import { getContext } from "hono/context-storage";

// This will throw "Context is not available" error!
export function getDatabase() {
  const ctx = getContext();
  return ctx.env.DATABASE;
}
```

**Why it's wrong:** `getContext()` requires `contextStorage()` middleware to be registered first.

**What to do instead:** Register `app.use(contextStorage())` before any routes, or use `tryGetContext()` for optional access.

---

### Complex Auth Logic Without Combine Middleware

```typescript
// ANTI-PATTERN: Nested if/else auth logic
app.use("/api/*", async (c, next) => {
  const token = c.req.header("Authorization");
  const ip = c.req.header("X-Forwarded-For");

  if (token === ADMIN_TOKEN) {
    await next();
  } else if (INTERNAL_IPS.includes(ip || "")) {
    if (token === INTERNAL_TOKEN) {
      await next();
    } else {
      return c.json({ error: "Unauthorized" }, 401);
    }
  } else {
    return c.json({ error: "Unauthorized" }, 401);
  }
});
```

**Why it's wrong:** Hard to read, hard to test, easy to have logic bugs.

**What to do instead:** Use `some()`, `every()`, `except()` from `hono/combine` for declarative auth composition.

</anti_patterns>

---

## Production Checklist

### Before Deploying API Routes

- [ ] `extendZodWithOpenApi(z)` called before schemas
- [ ] All schemas have `.openapi()` registration
- [ ] All routes have `operationId`
- [ ] App instance exported for spec generation
- [ ] Error handling uses named constants
- [ ] No magic numbers
- [ ] Soft delete checks on all queries
- [ ] Pagination with total count
- [ ] Rate limiting configured (if public)
- [ ] CORS configured (if cross-origin)
- [ ] Health check endpoints implemented
- [ ] Logging with correlation IDs
- [ ] PII sanitization in logs
- [ ] Cache-Control headers set
- [ ] JWT/JWK middleware has explicit `alg` option (security requirement since v4.11.4)

### Hono v4.x Features Checklist

- [ ] If using RPC: Routes chained for type inference, `AppType` exported
- [ ] If using RPC: Same Hono version on client and server
- [ ] If using Context Storage: `contextStorage()` middleware registered first
- [ ] If accessing context in utilities: Use `tryGetContext()` for optional access
- [ ] If complex auth logic: Use `some`/`every`/`except` from `hono/combine`
