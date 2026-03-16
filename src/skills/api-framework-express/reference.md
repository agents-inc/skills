# Express.js Reference

> Decision frameworks, anti-patterns, and production checklist. Referenced from [SKILL.md](SKILL.md).

---

<decision_framework>

## Decision Framework

### Middleware vs Route Handler

```
Where should this logic live?
├─ Is it reusable across multiple routes?
│   ├─ YES -> Middleware
│   └─ NO -> Route handler
├─ Does it modify req/res for downstream handlers?
│   ├─ YES -> Middleware
│   └─ NO -> Route handler
├─ Is it authentication/authorization?
│   ├─ YES -> Middleware (route guard)
│   └─ NO -> Continue evaluation
├─ Is it request validation?
│   ├─ YES -> Middleware
│   └─ NO -> Route handler
└─ Is it error handling?
    ├─ YES -> Error middleware (4 args)
    └─ NO -> Route handler
```

### express.Router() vs app.METHOD()

```
How to structure routes?
├─ Small app with few routes?
│   └─ app.get/post/etc. on main app is acceptable
├─ Multiple resources (users, products, orders)?
│   └─ express.Router() per resource
├─ Need router-specific middleware?
│   └─ express.Router() with router.use()
└─ Routes growing beyond 200 lines?
    └─ Split into Router modules immediately
```

### Error Handling Strategy

```
How to handle this error?
├─ Is it a validation error?
│   └─ Return 400 with details immediately
├─ Is it a "not found" error?
│   └─ Return 404 in the route handler
├─ Is it authentication/authorization?
│   └─ Return 401/403 in auth middleware
├─ Is it an unexpected error?
│   └─ Call next(error) -> centralized handler
└─ Is the error in async code?
    ├─ Express 5 -> Automatic (errors auto-forwarded)
    └─ Express 4 -> Wrap in try/catch, call next(error)
```

### Async Handler Approach

```
How to handle async route handlers?
├─ Express 5?
│   └─ Use async/await directly (auto-forwarding)
├─ Express 4 with many async routes?
│   └─ Use asyncHandler wrapper utility
├─ Express 4 with few async routes?
│   └─ Manual try/catch + next(error)
└─ Using express-async-errors package?
    └─ Use async/await directly (patched behavior)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

### High Priority Issues

- **Error handler has only 3 arguments** - Express won't recognize it as error middleware, errors silently ignored
- **Error handler registered before routes** - Never catches route errors, useless middleware
- **Missing `next(error)` in async handlers (Express 4)** - Unhandled promise rejection, request hangs
- **Not using `express.json()` middleware** - `req.body` is undefined for JSON requests
- **Magic HTTP status codes** - Use named constants (HTTP_OK = 200, HTTP_NOT_FOUND = 404)

### Medium Priority Issues

- **All routes in single file** - Creates unmaintainable God file, use express.Router()
- **Not checking `res.headersSent` in error handler** - Causes "headers already sent" crashes
- **Default exports on route modules** - Violates project conventions, use named exports
- **Wildcard CORS with credentials** - Security violation, browsers reject this
- **Missing rate limiting on public APIs** - Vulnerable to abuse and DDoS

### Common Mistakes

- **Not calling `next()` in middleware** - Request hangs indefinitely
- **Calling `next()` after sending response** - Unpredictable behavior
- **Using `parseInt()` without radix** - `parseInt("08")` may fail, always use `parseInt(str, 10)`
- **Not validating route parameters** - Allows injection or invalid data
- **Logging full request body** - May contain passwords or PII

### Gotchas & Edge Cases

- **Middleware order matters** - helmet first, then cors, then rate limit, then body parsing
- **`next('route')` vs `next(error)`** - `'route'` skips to next route, anything else triggers error handler
- **`req.query` values are always strings** - Parse numbers explicitly with `parseInt`
- **Express 5: `req.body` is `undefined` when unparsed** - was `{}` in Express 4, may break existing guards
- **Express 5: wildcard routes require names** - `/*` must be `/{*splat}`
- **`express.static` without auth** - Files publicly accessible unless guarded
- **Router `mergeParams` option** - Required to access parent route params in nested routers

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Error Handler with Wrong Signature

```typescript
// WRONG: Only 3 arguments - NOT an error handler
const errorHandler = (err, req, res) => {
  res.status(500).json({ error: err.message });
};

// WRONG: Arguments in wrong order
const errorHandler = (req, res, err, next) => {
  res.status(500).json({ error: err.message });
};
```

**Why it's wrong:** Express identifies error handlers by the 4-argument signature `(err, req, res, next)`. Wrong signature means Express treats it as regular middleware.

**What to do instead:**

```typescript
const HTTP_INTERNAL_ERROR = 500;

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(HTTP_INTERNAL_ERROR).json({ error: err.message });
};
```

---

### Missing Async Error Forwarding (Express 4)

```typescript
// WRONG: Async error not forwarded
router.get("/:id", async (req, res) => {
  const user = await getUserById(req.params.id); // Error = unhandled rejection
  res.json({ data: user });
});
```

**Why it's wrong:** Express 4 doesn't catch errors from rejected promises. The request hangs until timeout.

**What to do instead:**

```typescript
// Option A: Explicit error forwarding
router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// Option B: Using wrapper utility
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    res.json({ data: user });
  }),
);
```

---

### God Route Files

```typescript
// WRONG: Everything in one file - 2000+ lines
const app = express();
app.get("/api/users", (req, res) => {
  /* 50 lines */
});
app.post("/api/users", (req, res) => {
  /* 50 lines */
});
app.get("/api/products", (req, res) => {
  /* 50 lines */
});
// ... hundreds more
```

**Why it's wrong:** Impossible to navigate, test, or maintain. No separation of concerns.

**What to do instead:**

```typescript
// src/routes/user-routes.ts
const router = Router();
router.get("/" /* ... */);
router.post("/" /* ... */);
export { router as userRoutes };

// src/app.ts
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
```

---

### Magic Numbers for HTTP Status

```typescript
// WRONG: Magic numbers everywhere
router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({ data: user });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
```

**What to do instead:**

```typescript
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      res.status(HTTP_NOT_FOUND).json({ error: "Not found" });
      return;
    }
    res.status(HTTP_OK).json({ data: user });
  } catch (error) {
    next(error); // Forward to centralized handler
  }
});
```

---

### Insecure CORS Configuration

```typescript
// WRONG: Wildcard origin with credentials
app.use(
  cors({
    origin: "*",
    credentials: true, // Browsers reject this combination!
  }),
);

// WRONG: Accepting any origin dynamically
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true); // Allows ANY origin
    },
    credentials: true,
  }),
);
```

**Why it's wrong:** Browsers reject wildcard with credentials. Accepting any origin defeats CORS purpose.

**What to do instead:**

```typescript
const ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://admin.example.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
```

</anti_patterns>

---

## HTTP Status Code Quick Reference

| Code | Constant Name          | Use Case                              |
| ---- | ---------------------- | ------------------------------------- |
| 200  | HTTP_OK                | Successful GET, PUT, PATCH            |
| 201  | HTTP_CREATED           | Successful POST creating resource     |
| 204  | HTTP_NO_CONTENT        | Successful DELETE                     |
| 400  | HTTP_BAD_REQUEST       | Validation failure, malformed request |
| 401  | HTTP_UNAUTHORIZED      | Missing or invalid authentication     |
| 403  | HTTP_FORBIDDEN         | Authenticated but not authorized      |
| 404  | HTTP_NOT_FOUND         | Resource doesn't exist                |
| 409  | HTTP_CONFLICT          | Resource already exists (duplicate)   |
| 422  | HTTP_UNPROCESSABLE     | Semantic validation failure           |
| 429  | HTTP_TOO_MANY_REQUESTS | Rate limit exceeded                   |
| 500  | HTTP_INTERNAL_ERROR    | Unexpected server error               |

---

## Production Checklist

### Before Deploying Express API

**Structure:**

- [ ] Routes organized with `express.Router()` by resource
- [ ] Error handler has 4 arguments `(err, req, res, next)`
- [ ] Error handler registered AFTER all routes
- [ ] All async handlers forward errors (Express 4) or use Express 5
- [ ] No God files (each file < 300 lines)

**Security:**

- [ ] Security headers middleware registered first
- [ ] CORS configured with explicit origin allowlist
- [ ] Rate limiting enabled for public endpoints
- [ ] Request body size limited (`express.json({ limit: ... })`)
- [ ] No wildcard CORS with credentials

**Code Quality:**

- [ ] HTTP status codes are named constants
- [ ] No magic numbers
- [ ] Named exports only (no default exports)
- [ ] kebab-case file names
- [ ] TypeScript types for req.body, req.params, req.query

**Error Handling:**

- [ ] Centralized error handler catches all errors
- [ ] Error handler checks `res.headersSent`
- [ ] Validation errors return 400 with details
- [ ] 404 handler for unmatched routes
- [ ] Errors logged with request context

**Middleware Order:**

- [ ] 1. Security headers
- [ ] 2. CORS
- [ ] 3. Rate limiting
- [ ] 4. Body parsing
- [ ] 5. Logging
- [ ] 6. Routes
- [ ] 7. 404 handler
- [ ] 8. Error handler (last)
