# Redux Toolkit - Middleware Examples

Custom middleware patterns for logging, analytics, and side effects.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration) for store setup.

---

## Pattern: Custom Middleware

### Good Example - Logger Middleware

```typescript
// store/middleware/logger-middleware.ts
import type { Middleware } from "@reduxjs/toolkit";
import { isAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

const ENABLE_LOGGING = process.env.NODE_ENV === "development";

// RTK 2.0: action is typed as `unknown`, must use isAction() type guard
export const loggerMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action) => {
    if (!ENABLE_LOGGING) {
      return next(action);
    }

    // RTK 2.0: Use isAction() to safely access action.type
    if (isAction(action)) {
      console.group(action.type);
      console.log("Dispatching:", action);
      console.log("Previous state:", store.getState());

      const result = next(action);

      console.log("Next state:", store.getState());
      console.groupEnd();

      return result;
    }

    return next(action);
  };
```

**Why good:** RTK 2.0 isAction() type guard for safe action.type access, typed middleware with RootState, named constants for config, conditionally enables based on environment

---

### Good Example - Analytics Middleware

```typescript
// store/middleware/analytics-middleware.ts
import type { Middleware } from "@reduxjs/toolkit";
import { isAction } from "@reduxjs/toolkit";

const TRACKED_ACTIONS = new Set([
  "auth/login/fulfilled",
  "auth/logout",
  "todos/addTodo",
  "users/userRemoved",
]);

// RTK 2.0: action is unknown, use isAction() type guard
export const analyticsMiddleware: Middleware = () => (next) => (action) => {
  if (isAction(action) && TRACKED_ACTIONS.has(action.type)) {
    // Send to analytics service
    // analytics.track(action.type, action.payload);
    console.log("[Analytics]", action.type);
  }

  return next(action);
};
```

**Why good:** RTK 2.0 isAction() type guard before accessing action.type, declarative list of tracked actions, easily extensible, named constant for tracked actions set

---

## Store Configuration with Custom Middleware

```typescript
// store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { loggerMiddleware } from "./middleware/logger-middleware";
import { analyticsMiddleware } from "./middleware/analytics-middleware";
import { apiSlice } from "./api/api-slice";
import { todosReducer } from "./slices/todos-slice";

export const store = configureStore({
  reducer: {
    todos: todosReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiSlice.middleware)
      .concat(loggerMiddleware)
      .concat(analyticsMiddleware),
});
```

**Why good:** getDefaultMiddleware preserves serialization and immutability checks, middleware chained correctly, named exports

---
