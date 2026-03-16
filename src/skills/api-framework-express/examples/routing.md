# Express.js - Routing Examples

> Modular routes, parameters, query strings, response helpers, and versioned APIs. See [core.md](core.md) for error handling patterns.

**Prerequisites**: Understand error handling and async forwarding from [core.md](core.md).

---

## Modular Routes with Router

### Good Example - CRUD User Routes

```typescript
// src/routes/user-routes.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

const router = Router();

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NOT_FOUND = 404;
const HTTP_NO_CONTENT = 204;

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await getUsersFromDatabase();
    res.status(HTTP_OK).json({ data: users });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);

    if (!user) {
      res.status(HTTP_NOT_FOUND).json({ error: { message: "User not found" } });
      return;
    }

    res.status(HTTP_OK).json({ data: user });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newUser = await createUser(req.body);
    res.status(HTTP_CREATED).json({ data: newUser });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedUser = await updateUser(req.params.id, req.body);

    if (!updatedUser) {
      res.status(HTTP_NOT_FOUND).json({ error: { message: "User not found" } });
      return;
    }

    res.status(HTTP_OK).json({ data: updatedUser });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await deleteUser(req.params.id);

      if (!deleted) {
        res
          .status(HTTP_NOT_FOUND)
          .json({ error: { message: "User not found" } });
        return;
      }

      res.status(HTTP_NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  },
);

export { router as userRoutes };
```

**Mount in app:**

```typescript
// src/app.ts
import { userRoutes } from "./routes/user-routes";
app.use("/api/users", userRoutes);
```

**Why good:** Modular file per resource, named exports, explicit error forwarding, HTTP status codes as constants, 204 No Content for DELETE

---

## Nested Route Parameters

### Good Example - Parent/Child Resource Validation

```typescript
// src/routes/comment-routes.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

const router = Router();
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

// GET /api/posts/:postId/comments/:commentId
router.get(
  "/:postId/comments/:commentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { postId, commentId } = req.params;

      const post = await getPostById(postId);
      if (!post) {
        res
          .status(HTTP_NOT_FOUND)
          .json({ error: { message: "Post not found" } });
        return;
      }

      const comment = await getCommentById(postId, commentId);
      if (!comment) {
        res
          .status(HTTP_NOT_FOUND)
          .json({ error: { message: "Comment not found" } });
        return;
      }

      res.status(HTTP_OK).json({ data: comment });
    } catch (error) {
      next(error);
    }
  },
);

export { router as postRoutes };
```

**Why good:** Validates parent exists before child, clear parameter extraction from `req.params`

---

## Query String Handling

### Good Example - Search with Pagination

```typescript
// src/routes/search-routes.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

const router = Router();

const HTTP_OK = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface SearchQuery {
  q?: string;
  page?: string;
  limit?: string;
  sort?: string;
  order?: "asc" | "desc";
}

// GET /api/search?q=term&page=1&limit=20&sort=createdAt&order=desc
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as SearchQuery;

    const searchTerm = query.q || "";
    const page = Math.max(
      DEFAULT_PAGE,
      parseInt(query.page || String(DEFAULT_PAGE), 10),
    );
    const limit = Math.min(
      MAX_LIMIT,
      parseInt(query.limit || String(DEFAULT_LIMIT), 10),
    );
    const sort = query.sort || "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const offset = (page - 1) * limit;

    const [results, total] = await Promise.all([
      searchItems({ query: searchTerm, offset, limit, sort, order }),
      countSearchResults(searchTerm),
    ]);

    res.status(HTTP_OK).json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as searchRoutes };
```

**Why good:** Typed query interface, defaults with named constants, limit capped at `MAX_LIMIT` to prevent abuse, pagination metadata in response, parallel queries with `Promise.all`

---

## Response Helpers

### Good Example - Consistent Response Format

```typescript
// src/utils/response.ts
import type { Response } from "express";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = HTTP_OK,
  meta?: Record<string, unknown>,
): void => {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta) {
    response.meta = meta;
  }
  res.status(statusCode).json(response);
};

const sendCreated = <T>(res: Response, data: T): void => {
  sendSuccess(res, data, HTTP_CREATED);
};

const sendNoContent = (res: Response): void => {
  res.status(HTTP_NO_CONTENT).send();
};

const sendError = (
  res: Response,
  message: string,
  statusCode: number = HTTP_BAD_REQUEST,
  code?: string,
  details?: unknown,
): void => {
  const response: ErrorResponse = {
    success: false,
    error: { message, code, details },
  };
  res.status(statusCode).json(response);
};

const sendNotFound = (res: Response, resource: string = "Resource"): void => {
  sendError(res, `${resource} not found`, HTTP_NOT_FOUND, "NOT_FOUND");
};

export { sendSuccess, sendCreated, sendNoContent, sendError, sendNotFound };
```

**Usage:**

```typescript
import { sendSuccess, sendNotFound, sendCreated } from "../utils/response";

router.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      sendNotFound(res, "User");
      return;
    }
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const user = await createUser(req.body);
    sendCreated(res, user);
  } catch (error) {
    next(error);
  }
});
```

**Why good:** Consistent `{ success, data }` / `{ success, error }` shape, typed helpers, status codes as constants, reduces boilerplate

---

## Versioned API with Sub-Routers

### Good Example - API Versioning

```typescript
// src/routes/v1/index.ts
import { Router } from "express";
import { userRoutes } from "./user-routes";
import { productRoutes } from "./product-routes";
import { orderRoutes } from "./order-routes";

const router = Router();

router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);

export { router as v1Routes };
```

```typescript
// src/routes/index.ts
import { Router } from "express";
import { v1Routes } from "./v1";
import { v2Routes } from "./v2";

const router = Router();

router.use("/v1", v1Routes);
router.use("/v2", v2Routes);

export { router as apiRoutes };
```

```typescript
// src/app.ts
import { apiRoutes } from "./routes";
app.use("/api", apiRoutes);
// Results in: /api/v1/users, /api/v2/users, etc.
```

**Why good:** Clean versioning, nested routers for organization, single mount point in app

---

## Route-Level Middleware

### Good Example - Mixed Public/Protected Routes

```typescript
// src/routes/post-routes.ts
import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth-guard";

const router = Router();

// Public: anyone can read
router.get("/", async (req, res, next) => {
  // No auth required
});

// Public with optional auth: shows user-specific data if logged in
router.get("/:id", optionalAuth, async (req, res, next) => {
  const post = await getPost(req.params.id);
  const isOwner = req.user?.id === post.authorId;
  // Can show edit controls if isOwner
});

// Protected: must be logged in
router.post("/", requireAuth, async (req, res, next) => {
  // Only authenticated users
});

export { router as postRoutes };
```

**Why good:** `router.use(requireAuth)` applies to all routes when needed, per-route middleware for mixed access, `optionalAuth` for hybrid routes

---

## Quick Reference

| Pattern                 | URL            | Description    |
| ----------------------- | -------------- | -------------- |
| `router.get("/")`       | /api/users     | List all       |
| `router.get("/:id")`    | /api/users/:id | Get one        |
| `router.post("/")`      | /api/users     | Create         |
| `router.put("/:id")`    | /api/users/:id | Full update    |
| `router.patch("/:id")`  | /api/users/:id | Partial update |
| `router.delete("/:id")` | /api/users/:id | Delete         |

| Status Code | Constant            | Use For           |
| ----------- | ------------------- | ----------------- |
| 200         | HTTP_OK             | Success with body |
| 201         | HTTP_CREATED        | Resource created  |
| 204         | HTTP_NO_CONTENT     | Success, no body  |
| 400         | HTTP_BAD_REQUEST    | Client error      |
| 404         | HTTP_NOT_FOUND      | Not found         |
| 500         | HTTP_INTERNAL_ERROR | Server error      |
