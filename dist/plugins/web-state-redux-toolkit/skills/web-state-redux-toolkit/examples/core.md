# Redux Toolkit - Core Examples

> Store configuration and slice creation. See [SKILL.md](../SKILL.md) for the decision trees and red flags, and [reference.md](../reference.md) for migration notes.

**Related examples:**

- [typed-hooks.md](typed-hooks.md) - Typed hooks for components
- [rtk-query.md](rtk-query.md) - RTK Query for data fetching
- [entity-adapters.md](entity-adapters.md) - Normalized state management
- [async-thunks.md](async-thunks.md) - Complex async logic
- [selectors.md](selectors.md) - Memoized derived state
- [middleware.md](middleware.md) - Custom middleware patterns
- [testing.md](testing.md) - Testing reducers and thunks
- [persistence.md](persistence.md) - persisting the store across sessions

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
```

**Why good:** `RootState` follows the reducer map automatically, so adding a slice types every selector without a second edit. The middleware callback extends the defaults rather than replacing them, and `setupListeners` is what makes the refetch options on the API slice do anything.

### Bad Example - Legacy createStore

```typescript
// WRONG - Legacy Redux pattern
import { createStore, combineReducers, applyMiddleware } from "redux";
import thunk from "redux-thunk";

const rootReducer = combineReducers({
  todos: todosReducer,
  users: usersReducer,
});

const store = createStore(rootReducer, applyMiddleware(thunk));
```

**Why bad:** No DevTools connection, no inferred `RootState`, and none of the development checks that catch an accidental mutation or a non-serialisable value in an action — each of which `configureStore` sets up without being asked.

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

export const {
  addTodo,
  toggleTodo,
  removeTodo,
  setFilter,
  addTodoWithTimestamp,
} = todosSlice.actions;

export const todosReducer = todosSlice.reducer;
```

**Why good:** The action creators and types are generated from the reducer keys, so `toggleTodo` cannot be dispatched under a name no reducer answers to. `PayloadAction<T>` types the payload at the point it is consumed, and the `prepare` callback keeps id and timestamp generation out of the reducer, which has to stay pure.

### Bad Example - Switch Statement Reducer

```typescript
// WRONG - Legacy switch statement pattern
const todosReducer = (state = initialState, action) => {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        items: [...state.items, { ...action.payload, id: Date.now() }], // collides within a tick
      };
    case "TOGGLE_TODO":
      return {
        ...state,
        items: state.items.map((t) =>
          t.id === action.payload ? { ...t, completed: !t.completed } : t,
        ),
      };
    default:
      return state;
  }
};

// Action creators written by hand, with the type string repeated
const addTodo = (todo) => ({ type: "ADD_TODO", payload: todo });
```

**Why bad:** The type string appears in two places and nothing checks that they agree, so a typo produces an action the reducer's `default` branch swallows in silence. Every update rebuilds the containing objects by hand, which is where deep updates go wrong.

---
