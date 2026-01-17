# Hono + OpenAPI - Middleware Examples

> Authentication, rate limiting, CORS, logging, and caching middleware patterns. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand route handler patterns from core examples first.

---

## Authentication Middleware

### Good Example - JWT with Type-Safe Variables

```typescript
import { verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";

const BEARER_PREFIX = "Bearer ";
const BEARER_PREFIX_LENGTH = 7;
const HTTP_STATUS_UNAUTHORIZED = 401;

type AuthVariables = {
  userId: string;
  userRole: "admin" | "user";
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith(BEARER_PREFIX)) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header" },
      HTTP_STATUS_UNAUTHORIZED,
    );
  }

  const token = authHeader.slice(BEARER_PREFIX_LENGTH);

  try {
    const payload = await verify(token, process.env.JWT_SECRET!);

    if (!payload.userId || typeof payload.userId !== "string") {
      throw new Error("Invalid token payload");
    }

    c.set("userId", payload.userId);
    c.set("userRole", (payload.role as "admin" | "user") || "user");
    await next();
  } catch (error) {
    return c.json(
      { error: "unauthorized", message: "Invalid or expired token" },
      HTTP_STATUS_UNAUTHORIZED,
    );
  }
});
```

**Why good:** Type-safe Variables means c.get("userId") is typed, payload validation prevents accepting garbage tokens, default role prevents undefined access

**Usage in route:**

```typescript
const protectedRoute = createRoute({
  method: "get",
  path: "/me",
  middleware: [authMiddleware] as const, // as const for type inference
  operationId: "getCurrentUser",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(protectedRoute, async (c) => {
  // Type-safe access to userId from middleware
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return c.json(user, 200);
});
```

**Why good:** `as const` enables TypeScript to infer middleware types, 401 in responses shows auth requirement in docs

### Bad Example - Weak auth middleware

```typescript
// BAD Example - Weak auth middleware
const authMiddleware = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", ""); // BAD: Magic string

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401); // BAD: Magic number
  }

  // BAD: No payload validation
  const payload = await verify(token, process.env.JWT_SECRET!);

  // BAD: No type safety
  c.userId = payload.userId;

  await next();
};
```

**Why bad:** c.userId not typed = any access, no payload validation = trusts malicious tokens, "Unauthorized" gives attackers no info but also no help for debugging

---

## Rate Limiting Middleware

### Good Example - Rate Limiting with Headers

```typescript
import { createMiddleware } from "hono/factory";

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const RETRY_AFTER_SECONDS = 60;

// Simple in-memory rate limiter (use Redis for production multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const clientId = c.req.header("X-API-Key") || c.req.header("X-Forwarded-For") || "anonymous";
  const now = Date.now();

  let record = rateLimitStore.get(clientId);

  // Reset if window expired
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  record.count++;
  rateLimitStore.set(clientId, record);

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count);
  const resetTime = Math.ceil((record.resetTime - now) / 1000);

  // Set rate limit headers (industry standard)
  c.header("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(resetTime));

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    c.header("Retry-After", String(RETRY_AFTER_SECONDS));
    return c.json(
      {
        error: "rate_limit_exceeded",
        message: `Too many requests. Limit: ${MAX_REQUESTS_PER_WINDOW} per minute`,
        statusCode: HTTP_STATUS_TOO_MANY_REQUESTS,
        retryAfter: RETRY_AFTER_SECONDS,
      },
      HTTP_STATUS_TOO_MANY_REQUESTS,
    );
  }

  await next();
});
```

**Why good:** X-RateLimit-* headers let clients track usage before hitting limit, Retry-After enables proper backoff, API key fallback to IP covers both auth'd and anon

**Usage:**

```typescript
// Apply globally
const app = new OpenAPIHono();
app.use("*", rateLimitMiddleware);

// Or per-route
const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  middleware: [rateLimitMiddleware] as const,
  // ... rest of route config
});
```

### Bad Example - No rate limiting headers

```typescript
// BAD Example - No rate limiting headers or proper response
const rateLimiter = async (c, next) => {
  const count = getRequestCount(c);

  if (count > 100) {
    // BAD: Magic number
    return c.json({ error: "Too many requests" }, 429); // BAD: Magic number, no headers
  }

  await next();
};
```

**Why bad:** No headers = client can't implement proactive backoff, generic message doesn't tell them when to retry, magic 100 can't be tuned per deployment

---

## CORS Middleware

### Good Example - Secure CORS

```typescript
import { cors } from "hono/cors";

const ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://admin.example.com",
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",
].filter(Boolean);

const MAX_AGE_SECONDS = 86400; // 24 hours

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return "*";

    // Check against allowlist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }

    // Reject unknown origins
    return "";
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  credentials: true,
  maxAge: MAX_AGE_SECONDS,
});

// Apply globally
const app = new OpenAPIHono();
app.use("*", corsMiddleware);
```

**Why good:** Origin allowlist prevents CSRF from random sites, exposeHeaders lets client read rate limit headers, no-origin fallback handles mobile apps/Postman

### Bad Example - Insecure CORS

```typescript
// BAD Example - Insecure CORS configuration
import { cors } from "hono/cors";

app.use(
  "*",
  cors({
    origin: "*", // BAD: Wildcard with credentials is forbidden
    credentials: true, // BAD: Can't use with wildcard
    maxAge: 86400, // BAD: Magic number
  }),
);
```

**Why bad:** `*` + credentials is rejected by browsers (spec violation), magic maxAge can't be tuned, missing exposeHeaders = client can't read rate limit

---

## Logging Middleware

### Good Example - Structured JSON Logging with PII Sanitization

```typescript
import { randomUUID } from "crypto";
import { createMiddleware } from "hono/factory";

const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";
const SLOW_REQUEST_THRESHOLD_MS = 1000;

// PII patterns to sanitize
const PII_PATTERNS = [
  { regex: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: "[EMAIL]" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { regex: /\b\d{16}\b/g, replacement: "[CARD]" },
];

const sanitizePII = (data: any): any => {
  if (typeof data === "string") {
    let sanitized = data;
    for (const pattern of PII_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizePII);
  }

  if (typeof data === "object" && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (["password", "token", "apiKey", "secret"].includes(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizePII(value);
      }
    }
    return sanitized;
  }

  return data;
};

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || randomUUID();
  const startTime = Date.now();

  c.set("correlationId", correlationId);

  console.log(
    JSON.stringify({
      level: LOG_LEVEL_INFO,
      type: "request",
      correlationId,
      method: c.req.method,
      path: c.req.path,
      query: sanitizePII(c.req.query()),
      userAgent: c.req.header("User-Agent"),
      ip: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      timestamp: new Date().toISOString(),
    }),
  );

  await next();

  const duration = Date.now() - startTime;
  const status = c.res.status;

  console.log(
    JSON.stringify({
      level: status >= 500 ? LOG_LEVEL_ERROR : status >= 400 ? LOG_LEVEL_WARN : LOG_LEVEL_INFO,
      type: "response",
      correlationId,
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      slow: duration > SLOW_REQUEST_THRESHOLD_MS,
      timestamp: new Date().toISOString(),
    }),
  );

  c.header("X-Correlation-ID", correlationId);
});

app.use("*", loggingMiddleware);
```

**Why good:** Correlation IDs trace requests across services, PII sanitization = GDPR compliance, structured JSON = searchable in log aggregators, duration tracking finds slow endpoints

### Bad Example - No structure or sanitization

```typescript
// BAD Example - No structure or sanitization
app.use("*", async (c, next) => {
  // BAD: Logs PII without sanitization
  // BAD: No correlation ID
  // BAD: No structured format
  console.log(`${c.req.method} ${c.req.path}`, c.req.query());

  await next();

  // BAD: No duration tracking
  console.log(`Response: ${c.res.status}`);
});
```

**Why bad:** Logging PII = GDPR violation, no correlation = can't trace user's request across microservices, unstructured = grep only (not searchable in Datadog/Splunk)

---

## Caching Middleware

### Good Example - Cache-Control Headers

```typescript
import { createMiddleware } from "hono/factory";

const CACHE_MAX_AGE_SECONDS = 3600;
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 86400;

export const cacheMiddleware = createMiddleware(async (c, next) => {
  await next();

  // Only cache successful GET requests
  if (c.req.method === "GET" && c.res.status === 200) {
    // Public resources (job listings, company profiles)
    if (c.req.path.startsWith("/api/jobs") || c.req.path.startsWith("/api/companies")) {
      c.header(
        "Cache-Control",
        `public, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
      );
    }

    // Private resources (user data)
    if (c.req.path.startsWith("/api/me")) {
      c.header("Cache-Control", "private, max-age=0, must-revalidate");
    }
  }

  // Never cache errors
  if (c.res.status >= 400) {
    c.header("Cache-Control", "no-store");
  }
});
```

**Why good:** stale-while-revalidate serves cached while fetching new (fast UX), public/private prevents caching user data, no caching errors prevents stale failures

### Good Example - ETags

```typescript
import { createHash } from "crypto";

const HTTP_STATUS_NOT_MODIFIED = 304;

app.openapi(getJobsRoute, async (c) => {
  const jobs = await fetchJobs();
  const jobsJson = JSON.stringify(jobs);

  // Generate ETag from response content
  const etag = createHash("md5").update(jobsJson).digest("hex");

  // Check If-None-Match header
  const clientEtag = c.req.header("If-None-Match");

  if (clientEtag === etag) {
    return c.body(null, HTTP_STATUS_NOT_MODIFIED);
  }

  c.header("ETag", etag);
  return c.json(jobs, 200);
});
```

**Why good:** 304 sends no body = massive bandwidth savings, ETag comparison is cheap (hash compare), client caches intelligently

---
