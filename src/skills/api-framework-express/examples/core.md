# Express.js - Core Examples

> Essential setup, error handling, and async patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: None - these are the foundational patterns.

---

## Pattern 1: Application Setup

```typescript
// src/app.ts
import express from "express";
import type { Express } from "express";

import { userRoutes } from "./routes/user-routes";
import { productRoutes } from "./routes/product-routes";
import { errorHandler } from "./middleware/error-handler";

const JSON_LIMIT = "10mb";

const app: Express = express();

// Built-in middleware for body parsing
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// Mount route modules
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);

// Error handler MUST be last
app.use(errorHandler);

export { app };
```

**Why good:** Named constants for configuration, built-in body parsers registered early, error handler registered last, modular route mounting

### Bad Example - Error Handler in Wrong Position

```typescript
// WRONG: Error handler before routes
const app = express();
app.use(errorHandler); // Too early - won't catch route errors
app.use(express.json({ limit: "10mb" })); // Magic string
app.use("/api/users", userRoutes);
```

**Why bad:** Error handler before routes means it never catches errors, magic strings make configuration hard to maintain

---

## Pattern 2: Error Handling Middleware

Error handlers MUST have 4 arguments: `(err, req, res, next)`. Express identifies error middleware solely by the function's arity.

### Good Example - Centralized Error Handler

```typescript
// src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from "express";

const HTTP_INTERNAL_ERROR = 500;

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Already sent response - delegate to Express default handler
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || HTTP_INTERNAL_ERROR;

  // Don't expose internal error details in production
  const message =
    statusCode === HTTP_INTERNAL_ERROR && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || "INTERNAL_ERROR",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};

export { errorHandler };
```

**Why good:** 4 arguments (critical for Express to recognize as error handler), checks `headersSent`, hides internals in production, logs full error context

### Bad Example - Wrong Signature

```typescript
// WRONG - Only 3 arguments, treated as regular middleware
const errorHandler = (err, req, res) => {
  res.status(500).json({ error: err.message }); // Magic number
};
// Express calls this as (req, res, next) - err is actually req!
```

**Why bad:** Express calls this as regular middleware - `err` parameter receives `req`, completely wrong behavior

---

## Pattern 3: Async Error Forwarding

### Express 5 (Default Since 2025)

Express 5 auto-forwards errors from rejected promises:

```typescript
// Express 5: async errors auto-forwarded to error handler
router.get("/:id", async (req: Request, res: Response) => {
  const product = await getProductById(req.params.id); // If throws, error handler catches
  res.status(HTTP_OK).json({ data: product });
});
```

### Express 4 (Manual Forwarding Required)

```typescript
// Express 4: MUST forward manually
const HTTP_OK = 200;

// Option 1: try/catch with next(error)
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await getProductById(req.params.id);
    res.status(HTTP_OK).json({ data: product });
  } catch (error) {
    next(error); // REQUIRED in Express 4
  }
});

// Option 2: Promise .catch(next)
router.get("/featured", (req: Request, res: Response, next: NextFunction) => {
  getFeaturedProducts()
    .then((products) => res.status(HTTP_OK).json({ data: products }))
    .catch(next);
});
```

### asyncHandler Wrapper (Express 4)

Eliminates repetitive try/catch in every route handler:

```typescript
// src/utils/async-handler.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { asyncHandler };
```

**Usage:**

```typescript
import { asyncHandler } from "../utils/async-handler";

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    res.status(HTTP_OK).json({ data: product });
    // Errors automatically forwarded to error handler
  }),
);
```

**Why good:** Eliminates try/catch boilerplate, errors automatically forwarded, cleaner route definitions

### Bad Example - Missing Error Forwarding

```typescript
// WRONG - Unhandled promise rejection in Express 4
router.get("/:id", async (req, res) => {
  const user = await getUserById(req.params.id); // If throws, request hangs forever
  res.json({ data: user });
});
```

**Why bad:** In Express 4, async errors don't propagate to error handler. Request hangs until timeout.

---

## Pattern 4: Custom Error Classes

Create typed errors that the centralized error handler can interpret:

```typescript
// src/errors/app-error.ts
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;

class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, HTTP_NOT_FOUND, "NOT_FOUND");
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(message, HTTP_BAD_REQUEST, "VALIDATION_ERROR");
  }
}

export { AppError, NotFoundError, ValidationError };
```

**Usage in routes:**

```typescript
router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) throw new NotFoundError("User");
    res.status(HTTP_OK).json({ data: user });
  } catch (error) {
    next(error);
  }
});
```

**Why good:** Error handler reads `statusCode` and `code` directly, `isOperational` distinguishes expected errors from crashes, class hierarchy keeps error creation clean
