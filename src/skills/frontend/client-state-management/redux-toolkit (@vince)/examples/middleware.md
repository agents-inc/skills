# Redux Toolkit - Middleware Examples

Custom middleware patterns for logging, analytics, and side effects.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration) for store setup.

---

## Pattern: Custom Middleware

### Good Example - Logger Middleware

```typescript
// store/middleware/logger-middleware.ts
import type { Middleware } from "@reduxjs/toolkit";
import type { RootState } from "../index";

const ENABLE_LOGGING = process.env.NODE_ENV === "development";

export const loggerMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action) => {
    if (!ENABLE_LOGGING) {
      return next(action);
    }

    console.group(action.type);
    console.log("Dispatching:", action);
    console.log("Previous state:", store.getState());

    const result = next(action);

    console.log("Next state:", store.getState());
    console.groupEnd();

    return result;
  };
```

**Why good:** Typed middleware with RootState, named constants for config, conditionally enables based on environment

---

### Good Example - Analytics Middleware

```typescript
// store/middleware/analytics-middleware.ts
import type { Middleware } from "@reduxjs/toolkit";

const TRACKED_ACTIONS = new Set([
  "auth/login/fulfilled",
  "auth/logout",
  "todos/addTodo",
  "users/userRemoved",
]);

export const analyticsMiddleware: Middleware = () => (next) => (action) => {
  if (TRACKED_ACTIONS.has(action.type)) {
    // Send to analytics service
    // analytics.track(action.type, action.payload);
    console.log("[Analytics]", action.type, action.payload);
  }

  return next(action);
};
```

**Why good:** Declarative list of tracked actions, easily extensible, named constant for tracked actions set

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
