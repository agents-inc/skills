# Production Hardening

> CORS, CSRF prevention, response caching, security plugins, logging. Referenced from [SKILL.md](../SKILL.md).

---

## Pattern 1: CORS Configuration

Yoga enables CORS with `Access-Control-Allow-Origin: *` by default. Lock to specific origins before production deployment.

```typescript
import { createYoga } from "graphql-yoga";

// Static origin list
const yoga = createYoga({
  schema,
  cors: {
    origin: ["https://app.example.com", "https://admin.example.com"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["POST"],
  },
});
```

#### Dynamic Origin

```typescript
const ALLOWED_ORIGINS = new Set([
  "https://app.example.com",
  "https://admin.example.com",
]);

const yoga = createYoga({
  schema,
  cors: (request) => {
    const origin = request.headers.get("origin") ?? "";
    return {
      origin: ALLOWED_ORIGINS.has(origin) ? origin : "",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["POST"],
    };
  },
});
```

**Why good:** dynamic function allows per-request origin validation from a Set (O(1) lookups), empty string for rejected origins

#### Disabling CORS

```typescript
const yoga = createYoga({
  schema,
  cors: false, // Remove all CORS headers
});
```

**When to use:** Same-origin only APIs where no cross-origin requests are expected.

---

## Pattern 2: CSRF Prevention

Require a custom header on all requests to prevent cross-site request forgery.

```typescript
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";

const yoga = createYoga({
  schema,
  plugins: [
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"], // Default header name
    }),
  ],
});
```

**How it works:** Custom headers cannot be sent by plain HTML forms or simple requests -- they require a CORS preflight. This transforms what would be a "simple" request into one that requires explicit CORS approval, preventing CSRF attacks from malicious forms.

---

## Pattern 3: Response Caching

Use the Yoga-specific response cache plugin (not the Envelop equivalent) for HTTP-level caching that skips GraphQL execution entirely.

```typescript
import {
  useResponseCache,
  createInMemoryCache,
} from "@graphql-yoga/plugin-response-cache";

const GLOBAL_TTL_MS = 5_000;
const USER_TTL_MS = 1_000;

const cache = createInMemoryCache();

const yoga = createYoga({
  schema,
  plugins: [
    useResponseCache({
      session: (request) => request.headers.get("authorization"),
      ttl: GLOBAL_TTL_MS,
      ttlPerType: {
        User: USER_TTL_MS,
      },
      scopePerSchemaCoordinate: {
        "Query.me": "PRIVATE",
      },
      cache,
    }),
  ],
});

// Manual cache invalidation (e.g., after a mutation via webhook)
cache.invalidate([{ typename: "User", id: "user-123" }]);
```

**Key points:**

- `session` must return a string (user ID) for PRIVATE-scoped queries, or `null` for public queries
- `ttlPerType` overrides global TTL for specific types (lowest TTL wins when result contains multiple types)
- `scopePerSchemaCoordinate` marks fields as PRIVATE (cached per session) or PUBLIC (shared across users)

---

## Pattern 4: Security with GraphQL Armor

Use GraphQL Armor plugins to protect against query complexity attacks on public APIs.

```typescript
import { createYoga } from "graphql-yoga";

// Install: npm i @escape.tech/graphql-armor-cost-limit
//          npm i @escape.tech/graphql-armor-max-tokens
//          npm i @escape.tech/graphql-armor-max-depth
//          npm i @escape.tech/graphql-armor-max-aliases
//          npm i @escape.tech/graphql-armor-max-directives

const MAX_QUERY_COST = 5000;
const MAX_QUERY_TOKENS = 1000;
const MAX_QUERY_DEPTH = 10;
const MAX_QUERY_ALIASES = 15;
const MAX_QUERY_DIRECTIVES = 50;

const yoga = createYoga({
  schema,
  plugins: [
    costLimitPlugin({ maxCost: MAX_QUERY_COST }),
    maxTokensPlugin({ n: MAX_QUERY_TOKENS }),
    maxDepthPlugin({ n: MAX_QUERY_DEPTH }),
    maxAliasesPlugin({ n: MAX_QUERY_ALIASES }),
    maxDirectivesPlugin({ n: MAX_QUERY_DIRECTIVES }),
  ],
});
```

**When to use:** Public-facing APIs where untrusted clients can send arbitrary queries. For private APIs using persisted operations, these protections may be unnecessary.

---

## Pattern 5: Logging Configuration

Yoga supports four log levels: `debug`, `info`, `warn`, `error`. Default is `info` (includes info, warn, error).

```typescript
// Set log level
const yoga = createYoga({
  schema,
  logging: "warn", // Only warnings and errors
});

// Custom logger integration
const yoga = createYoga({
  schema,
  logging: {
    debug: (...args: unknown[]) => logger.debug(...args),
    info: (...args: unknown[]) => logger.info(...args),
    warn: (...args: unknown[]) => logger.warn(...args),
    error: (...args: unknown[]) => logger.error(...args),
  },
});
```

---

## Pattern 6: Production Disable GraphiQL

GraphiQL is enabled by default. Disable it in production.

```typescript
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const yoga = createYoga({
  schema,
  graphiql: !IS_PRODUCTION,
});
```

---

## Pattern 7: Complete Production Configuration

```typescript
import { createYoga, createSchema } from "graphql-yoga";
import { useResponseCache } from "@graphql-yoga/plugin-response-cache";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CACHE_TTL_MS = 10_000;
const PORT = 4000;

const yoga = createYoga({
  schema,
  // Disable GraphiQL in production
  graphiql: !IS_PRODUCTION,
  // Lock CORS to known origins
  cors: {
    origin: IS_PRODUCTION
      ? ["https://app.example.com"]
      : ["http://localhost:3000"],
    credentials: true,
    methods: ["POST"],
  },
  plugins: [
    // CSRF protection
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"],
    }),
    // Response caching
    useResponseCache({
      session: (request) => request.headers.get("authorization"),
      ttl: CACHE_TTL_MS,
    }),
  ],
});
```

**Why good:** defense in depth (CORS + CSRF + caching), GraphiQL off in production, environment-aware configuration
