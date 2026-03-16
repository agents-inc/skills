# Express.js - Middleware Examples

> Request processing, validation, auth guards, and ordering. See [core.md](core.md) for error handling and async patterns.

**Prerequisites**: Understand error handler pattern and async forwarding from [core.md](core.md).

---

## Request Logging Middleware

### Good Example - Request/Response Logger

```typescript
// src/middleware/request-logger.ts
import type { Request, Response, NextFunction } from "express";

interface RequestLogInfo {
  method: string;
  path: string;
  query: Record<string, unknown>;
  timestamp: string;
}

const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();

  const logInfo: RequestLogInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    timestamp: new Date().toISOString(),
  };

  console.log("[Request]", JSON.stringify(logInfo));

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      "[Response]",
      JSON.stringify({
        ...logInfo,
        statusCode: res.statusCode,
        durationMs: duration,
      }),
    );
  });

  next();
};

export { requestLogger };
```

**Why good:** Named export, typed parameters, logs both request and response, calculates duration via `res.on("finish")`

### Bad Example - Blocking Middleware

```typescript
// WRONG - Forgot to call next()
const middleware = (req, res, next) => {
  console.log("Request:", req.path);
  // Missing next() - request hangs forever!
};
```

**Why bad:** Request hangs until timeout. Must always call `next()` or end response.

---

## Validation Middleware

### Good Example - Request Body Validation

```typescript
// src/middleware/validators.ts
import type { Request, Response, NextFunction } from "express";

const HTTP_BAD_REQUEST = 400;
const MIN_EMAIL_LENGTH = 5;
const MAX_EMAIL_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;

const validateEmail = (email: unknown): boolean => {
  if (typeof email !== "string") return false;
  if (email.length < MIN_EMAIL_LENGTH || email.length > MAX_EMAIL_LENGTH)
    return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePassword = (password: unknown): boolean => {
  if (typeof password !== "string") return false;
  return password.length >= MIN_PASSWORD_LENGTH;
};

const validateLoginBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { email, password } = req.body;
  const errors: string[] = [];

  if (!validateEmail(email)) {
    errors.push(
      `Email must be ${MIN_EMAIL_LENGTH}-${MAX_EMAIL_LENGTH} characters and valid format`,
    );
  }

  if (!validatePassword(password)) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (errors.length > 0) {
    res.status(HTTP_BAD_REQUEST).json({
      error: {
        message: "Validation failed",
        details: errors,
      },
    });
    return;
  }

  next();
};

export { validateLoginBody };
```

**Usage:**

```typescript
router.post("/login", validateLoginBody, async (req, res, next) => {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
```

**Why good:** Validation logic separated from business logic, named constants for limits, early return with error details, reusable across routes

---

## Authentication Middleware

### Good Example - Auth Guard with Role Checking

```typescript
// src/middleware/auth-guard.ts
import type { Request, Response, NextFunction } from "express";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const BEARER_PREFIX = "Bearer ";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    res.status(HTTP_UNAUTHORIZED).json({
      error: { message: "Missing or invalid authorization header" },
    });
    return;
  }

  const token = authHeader.slice(BEARER_PREFIX.length);

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(HTTP_UNAUTHORIZED).json({
      error: { message: "Invalid or expired token" },
    });
  }
};

const requireRole = (...allowedRoles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(HTTP_UNAUTHORIZED).json({
        error: { message: "Authentication required" },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(HTTP_FORBIDDEN).json({
        error: { message: "Insufficient permissions" },
      });
      return;
    }

    next();
  };
};

export { requireAuth, requireRole };
export type { AuthenticatedRequest };
```

**Usage:**

```typescript
// Protect all routes in router
router.use(requireAuth);

// Specific route requires admin
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  // Only admins reach here
});
```

**Why good:** `AuthenticatedRequest` extends Request with user, `requireRole` accepts variadic roles, early returns prevent further processing

---

## Middleware Ordering

### Good Example - Correct Order

```typescript
// src/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

const RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes
const RATE_LIMIT_MAX = 100;
const JSON_LIMIT = "10mb";

// 1. Security headers FIRST
app.use(helmet());

// 2. CORS (before body parsing)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [],
    credentials: true,
  }),
);

// 3. Rate limiting (before parsing to save resources)
app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  }),
);

// 4. Body parsing
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// 5. Request logging
app.use(requestLogger);

// 6. Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);

// 7. 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: "Route not found" } });
});

// 8. Error handler LAST
app.use(errorHandler);

export { app };
```

**Why good:** Security first, rate limit before expensive parsing, routes in middle, error handler absolutely last

---

## Quick Reference

| Middleware Type | Signature                | Purpose               |
| --------------- | ------------------------ | --------------------- |
| Regular         | `(req, res, next)`       | Request processing    |
| Error           | `(err, req, res, next)`  | Error handling        |
| Async wrapper   | Returns `RequestHandler` | Auto error forwarding |

| Middleware Order  | Reason                       |
| ----------------- | ---------------------------- |
| Security (helmet) | Block attacks early          |
| CORS              | Must be before routes        |
| Rate limit        | Before parsing to save CPU   |
| Body parsers      | Before routes that need body |
| Logging           | Before routes for timing     |
| Routes            | Main logic                   |
| 404 handler       | Catch unmatched routes       |
| Error handler     | Catch all errors LAST        |
