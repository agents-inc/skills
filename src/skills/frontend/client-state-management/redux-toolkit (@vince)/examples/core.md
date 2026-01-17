# Redux Toolkit - Core Examples

Core code examples for Redux Toolkit store configuration and slice creation.

**Related examples:**
- [typed-hooks.md](typed-hooks.md) - Typed hooks for components
- [rtk-query.md](rtk-query.md) - RTK Query for data fetching
- [entity-adapters.md](entity-adapters.md) - Normalized state management
- [async-thunks.md](async-thunks.md) - Complex async logic
- [selectors.md](selectors.md) - Memoized derived state
- [middleware.md](middleware.md) - Custom middleware patterns
- [testing.md](testing.md) - Testing reducers and thunks
- [integrations.md](integrations.md) - Redux Persist integration

---

## Pattern 1: Store Configuration

### Good Example - configureStore with TypeScript

```typescript
// store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { todosReducer } from "./slices/todos-slice";
import { usersReducer } from "./slices/users-slice";
import { apiSlice } from "./api/api-slice";

const ENABLE_DEV_TOOLS = process.env.NODE_ENV === "development";

export const store = configureStore({
  reducer: {
    todos: todosReducer,
    users: usersReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: ENABLE_DEV_TOOLS,
});

// Enable refetchOnFocus/refetchOnReconnect behaviors
setupListeners(store.dispatch);

// Infer types from store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export { store };
```

**Why good:** Types inferred from store (no manual typing), DevTools enabled via named constant, RTK Query middleware configured correctly, setupListeners enables automatic refetch behaviors, named exports follow project conventions

### Bad Example - Legacy createStore

```typescript
// WRONG - Legacy Redux pattern
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";

const rootReducer = combineReducers({
  todos: todosReducer,
  users: usersReducer,
});

const store = createStore(
  rootReducer,
  applyMiddleware(thunk)
);

export default store; // BAD: default export
```

**Why bad:** Manual middleware setup misses DevTools and development checks, no type inference, requires separate combineReducers call, default export violates conventions, no serializability or mutation checks

---

## Pattern 2: Slice Creation with createSlice

### Good Example - Typed Slice with Immer

```typescript
// store/slices/todos-slice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

const DEFAULT_COMPLETED = false;

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
}

interface TodosState {
  items: Todo[];
  filter: "all" | "active" | "completed";
}

const initialState: TodosState = {
  items: [],
  filter: "all",
};

const todosSlice = createSlice({
  name: "todos",
  initialState,
  reducers: {
    // Immer allows "mutative" syntax - actually immutable
    addTodo: (state, action: PayloadAction<Omit<Todo, "id" | "completed">>) => {
      const newTodo: Todo = {
        id: crypto.randomUUID(),
        completed: DEFAULT_COMPLETED,
        ...action.payload,
      };
      state.items.push(newTodo);
    },

    toggleTodo: (state, action: PayloadAction<string>) => {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) {
        todo.completed = !todo.completed;
      }
    },

    removeTodo: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex((t) => t.id === action.payload);
      if (index !== -1) {
        state.items.splice(index, 1);
      }
    },

    setFilter: (state, action: PayloadAction<TodosState["filter"]>) => {
      state.filter = action.payload;
    },

    // Prepare callback for complex action creation
    addTodoWithTimestamp: {
      reducer: (state, action: PayloadAction<Todo & { createdAt: number }>) => {
        state.items.push(action.payload);
      },
      prepare: (title: string, priority: number) => ({
        payload: {
          id: crypto.randomUUID(),
          title,
          priority,
          completed: DEFAULT_COMPLETED,
          createdAt: Date.now(),
        },
      }),
    },
  },
});

// Named exports for actions and reducer
export const {
  addTodo,
  toggleTodo,
  removeTodo,
  setFilter,
  addTodoWithTimestamp,
} = todosSlice.actions;

export const todosReducer = todosSlice.reducer;
```

**Why good:** Typed initial state enables inference, PayloadAction provides type-safe payloads, Immer syntax simplifies updates, prepare callback for complex action creation, named constants for default values, named exports for all

### Bad Example - Switch Statement Reducer

```typescript
// WRONG - Legacy switch statement pattern
const todosReducer = (state = initialState, action) => {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        items: [...state.items, { ...action.payload, id: Date.now() }], // Magic number!
      };
    case "TOGGLE_TODO":
      return {
        ...state,
        items: state.items.map((t) =>
          t.id === action.payload ? { ...t, completed: !t.completed } : t
        ),
      };
    default:
      return state;
  }
};

// Manual action creators
const addTodo = (todo) => ({ type: "ADD_TODO", payload: todo });

export default todosReducer; // BAD: default export
```

**Why bad:** No type safety, manual action creators prone to typos, spread operators verbose and error-prone, no DevTools action type inference, magic numbers, default export

---
