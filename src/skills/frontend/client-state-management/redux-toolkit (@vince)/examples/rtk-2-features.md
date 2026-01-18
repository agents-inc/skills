# Redux Toolkit - RTK 2.0 Features

New features introduced in Redux Toolkit 2.0 including inline selectors, combineSlices, and buildCreateSlice.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration, Slice Creation) first.

---

## Pattern 1: Inline Selectors in createSlice

RTK 2.0 allows defining selectors directly within `createSlice`. These selectors receive slice state as their first parameter.

### Good Example - Selectors in Slice Definition

```typescript
// store/slices/counter-slice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

const DOUBLE_MULTIPLIER = 2;

interface CounterState {
  value: number;
}

const initialState: CounterState = {
  value: 0,
};

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
  },
  // RTK 2.0: Define selectors inline
  selectors: {
    selectValue: (state) => state.value,
    selectDoubled: (state): number => state.value * DOUBLE_MULTIPLIER,
    selectIsPositive: (state): boolean => state.value > 0,
  },
});

// Export actions
export const { increment, decrement, incrementByAmount } = counterSlice.actions;

// RTK 2.0: Export selectors from slice.selectors
// These are pre-wrapped to work with rootState[slice.reducerPath]
export const { selectValue, selectDoubled, selectIsPositive } =
  counterSlice.selectors;

// RTK 2.0: selectSlice returns the entire slice state
export const selectCounterState = counterSlice.selectSlice;

export const counterReducer = counterSlice.reducer;
```

**Why good:** Selectors co-located with slice logic, automatically wrapped for root state access via selectSlice, named constants for magic numbers, named exports

### Component Usage

```typescript
// components/counter.tsx
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  increment,
  decrement,
  selectValue,
  selectDoubled,
  selectIsPositive,
} from "../store/slices/counter-slice";

export const Counter = () => {
  const dispatch = useAppDispatch();
  const value = useAppSelector(selectValue);
  const doubled = useAppSelector(selectDoubled);
  const isPositive = useAppSelector(selectIsPositive);

  return (
    <div>
      <p>Value: {value}</p>
      <p>Doubled: {doubled}</p>
      <p data-positive={isPositive}>Status: {isPositive ? "Positive" : "Non-positive"}</p>
      <button onClick={() => dispatch(increment())}>+</button>
      <button onClick={() => dispatch(decrement())}>-</button>
    </div>
  );
};
```

**Why good:** Uses slice selectors directly, no need for separate selector file for simple cases, data-attribute for styling

---

## Pattern 2: getSelectors for Custom State Locations

When the slice is not at `rootState[slice.name]`, use `getSelectors` with a custom selector.

```typescript
// If slice is mounted at a different path
import type { RootState } from "../index";

// Custom state location
const { selectValue, selectDoubled } = counterSlice.getSelectors(
  (rootState: RootState) => rootState.ui.counter
);

// Or without wrapper (receives slice state directly)
const { selectValue: sliceSelectValue } = counterSlice.getSelectors();
// Usage: sliceSelectValue({ value: 5 }) returns 5
```

**Why good:** Flexibility for non-standard store structures, same selectors work with different mounting points

---

## Pattern 3: combineSlices for Lazy Loading

RTK 2.0 introduces `combineSlices` for composing reducers with support for lazy-loaded slices.

### Good Example - combineSlices with Lazy Loading

```typescript
// store/index.ts
import { configureStore, combineSlices } from "@reduxjs/toolkit";
import type { WithSlice } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { counterSlice } from "./slices/counter-slice";
import { todosSlice } from "./slices/todos-slice";
import { apiSlice } from "./api/api-slice";

// Declare lazy-loaded slice types for TypeScript
declare module "@reduxjs/toolkit" {
  interface LazyLoadedSlices extends WithSlice<typeof settingsSlice> {}
}

// Import lazily loaded slice (can be dynamically imported)
import { settingsSlice } from "./slices/settings-slice";

// Combine slices - automatically uses slice.reducerPath as key
const rootReducer = combineSlices(counterSlice, todosSlice, apiSlice)
  // Enable lazy loading for additional slices
  .withLazyLoadedSlices<WithSlice<typeof settingsSlice>>();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

// Inject lazy-loaded slice at runtime
rootReducer.inject(settingsSlice);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**Why good:** Automatic key assignment from slice names, type-safe lazy loading, reduces initial bundle size, named exports

### Injecting Slices at Runtime

```typescript
// features/settings/index.ts
import { rootReducer } from "../../store";
import { settingsSlice } from "./settings-slice";

// Inject when feature is loaded
export const initializeSettingsFeature = () => {
  rootReducer.inject(settingsSlice);
};

// Can also inject under a different path
rootReducer.inject(settingsSlice, { reducerPath: "customSettings" });
```

**Why good:** Code-splitting friendly, feature modules can self-register

---

## Pattern 4: buildCreateSlice for Async Thunks in Reducers

RTK 2.0 allows defining async thunks directly in `createSlice.reducers` using `buildCreateSlice`.

### Good Example - Async Thunks Inside createSlice

```typescript
// store/create-app-slice.ts
import { buildCreateSlice, asyncThunkCreator } from "@reduxjs/toolkit";

// Create a custom createSlice with async thunk support
export const createAppSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});
```

```typescript
// store/slices/users-slice.ts
import { createAppSlice } from "../create-app-slice";
import type { PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: string;
  name: string;
  email: string;
}

interface UsersState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
};

// Use callback syntax for reducers to access create.asyncThunk
const usersSlice = createAppSlice({
  name: "users",
  initialState,
  reducers: (create) => ({
    // Sync reducer using create.reducer
    clearSelectedUser: create.reducer((state) => {
      state.selectedUser = null;
    }),

    // Sync reducer with payload
    setSelectedUser: create.reducer(
      (state, action: PayloadAction<User>) => {
        state.selectedUser = action.payload;
      }
    ),

    // Async thunk using create.asyncThunk
    fetchUsers: create.asyncThunk(
      async (_arg: void, { rejectWithValue }) => {
        try {
          const response = await fetch("/api/users");
          if (!response.ok) {
            return rejectWithValue("Failed to fetch users");
          }
          return (await response.json()) as User[];
        } catch (error) {
          return rejectWithValue("Network error");
        }
      },
      {
        pending: (state) => {
          state.loading = true;
          state.error = null;
        },
        fulfilled: (state, action) => {
          state.users = action.payload;
        },
        rejected: (state, action) => {
          state.error = action.payload as string;
        },
        // RTK 2.0: settled runs after both fulfilled AND rejected
        settled: (state) => {
          state.loading = false;
        },
      }
    ),

    // Async thunk with argument
    fetchUserById: create.asyncThunk(
      async (userId: string, { rejectWithValue }) => {
        try {
          const response = await fetch(`/api/users/${userId}`);
          if (!response.ok) {
            return rejectWithValue("User not found");
          }
          return (await response.json()) as User;
        } catch (error) {
          return rejectWithValue("Network error");
        }
      },
      {
        pending: (state) => {
          state.loading = true;
        },
        fulfilled: (state, action) => {
          state.loading = false;
          state.selectedUser = action.payload;
        },
        rejected: (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        },
      }
    ),
  }),
  selectors: {
    selectUsers: (state) => state.users,
    selectSelectedUser: (state) => state.selectedUser,
    selectIsLoading: (state) => state.loading,
    selectError: (state) => state.error,
  },
});

export const {
  clearSelectedUser,
  setSelectedUser,
  fetchUsers,
  fetchUserById,
} = usersSlice.actions;

export const {
  selectUsers,
  selectSelectedUser,
  selectIsLoading,
  selectError,
} = usersSlice.selectors;

export const usersReducer = usersSlice.reducer;
```

**Why good:** Async thunks co-located with sync reducers, lifecycle handlers inline with thunk definition, selectors in same slice, no separate extraReducers needed, named exports

### Component Usage with Inline Async Thunks

```typescript
// components/users-list.tsx
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  fetchUsers,
  fetchUserById,
  selectUsers,
  selectIsLoading,
  selectError,
} from "../store/slices/users-slice";

export const UsersList = () => {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUsers);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id} onClick={() => dispatch(fetchUserById(user.id))}>
          {user.name}
        </li>
      ))}
    </ul>
  );
};
```

**Why good:** Uses slice-defined thunks and selectors, cleaner imports from single slice file

---

## Pattern 5: TypeScript Changes in RTK 2.0

### UnknownAction Replaces AnyAction

```typescript
// RTK 2.0: Use UnknownAction instead of AnyAction
import type { UnknownAction } from "@reduxjs/toolkit";
import { isAction } from "@reduxjs/toolkit";

// Type guard for checking action type
const loggerMiddleware: Middleware = () => (next) => (action) => {
  // RTK 2.0: action is now unknown, must use type guard
  if (isAction(action)) {
    console.log("Action type:", action.type);
  }
  return next(action);
};

// Or use action creator's .match() method
import { increment } from "./slices/counter-slice";

if (increment.match(action)) {
  // action is typed as PayloadAction from increment
  console.log("Increment called");
}
```

**Why good:** Stricter type safety, forces explicit type checking before accessing action properties

### Entity Adapter ID Type

```typescript
// RTK 2.0: Explicit ID type for entity adapter
import { createEntityAdapter } from "@reduxjs/toolkit";

interface User {
  id: string; // string ID
  name: string;
}

// Explicit ID type as second generic parameter
const usersAdapter = createEntityAdapter<User, string>({
  selectId: (user) => user.id,
});

// For numeric IDs
interface Product {
  id: number;
  name: string;
}

const productsAdapter = createEntityAdapter<Product, number>();
```

**Why good:** Precise ID type inference across selectors and operations

---

## Reselect 5.0 Changes

### Default Memoization Changed

```typescript
import { createSelector } from "@reduxjs/toolkit";

// Reselect 5.0: createSelector now uses weakMapMemoize by default
// This provides infinite cache size instead of lruMemoize (cache size 1)

const selectFilteredTodos = createSelector(
  [(state: RootState) => state.todos.items, (state: RootState) => state.todos.filter],
  (items, filter) => items.filter((t) => (filter === "all" ? true : t.status === filter))
);

// Benefits of weakMapMemoize:
// - Better cache hit rate for selectors called with different arguments
// - No need for per-component selector instances in most cases
// - Memory is automatically cleaned up via WeakMap garbage collection

// If you need the old behavior:
import { createSelector, lruMemoize } from "@reduxjs/toolkit";

const selectWithLru = createSelector(
  [selectTodoItems],
  (items) => items.length,
  { memoize: lruMemoize }
);
```

**Why good:** Better default caching behavior, simpler selector patterns in components

---
