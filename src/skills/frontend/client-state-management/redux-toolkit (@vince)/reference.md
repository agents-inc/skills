# Redux Toolkit - Reference

Decision frameworks, red flags, and anti-patterns for Redux Toolkit state management.

---

## Decision Framework

### When to Use Redux Toolkit vs Alternatives

```
What kind of state do I have?

Is it server data (from API)?
├─ YES → Do you need sophisticated caching/invalidation?
│   ├─ YES → RTK Query (if already using RTK) or React Query
│   └─ NO → React Query (simpler) or RTK Query
└─ NO → Is it complex client state with many interactions?
    ├─ YES → Do you need DevTools/time-travel debugging?
    │   ├─ YES → Redux Toolkit
    │   └─ NO → Is state deeply nested or relational?
    │       ├─ YES → Redux Toolkit with Entity Adapters
    │       └─ NO → Zustand (simpler API)
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Zustand (simplest) or Redux Toolkit
        └─ NO → useState (component local)
```

### RTK Query vs createAsyncThunk

```
Do I need data fetching?

Is it a standard REST/GraphQL API call?
├─ YES → Use RTK Query
│   - Automatic caching and invalidation
│   - Generated hooks for queries/mutations
│   - Optimistic updates built-in
└─ NO → Is it a complex async flow?
    ├─ YES → Use createAsyncThunk
    │   - Multiple sequential API calls
    │   - Conditional logic based on state
    │   - File uploads with progress
    └─ NO → Is it a side effect (analytics, logging)?
        └─ YES → Use middleware
```

### Entity Adapter vs Plain State

```
Am I storing a collection of items?

Does each item have a unique ID?
├─ YES → Is performance critical (large lists)?
│   ├─ YES → createEntityAdapter (normalized state)
│   └─ NO → Are items frequently updated individually?
│       ├─ YES → createEntityAdapter (O(1) lookups)
│       └─ NO → Array in createSlice (simpler)
└─ NO → Plain object in createSlice
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data with caching | RTK Query | Auto caching, invalidation, hooks |
| Complex client state | Redux Toolkit createSlice | DevTools, predictable updates |
| Collections with IDs | createEntityAdapter | Normalized state, CRUD operations |
| Complex async flows | createAsyncThunk | Lifecycle actions, state access |
| Simple UI state | Zustand or useState | Less boilerplate |
| Side effects | Custom middleware | Centralized, testable |

---

## RED FLAGS

**High Priority Issues:**

- **Using legacy createStore instead of configureStore** - misses DevTools, development checks, and middleware defaults
- **Switch statements in reducers** - use createSlice which generates action creators automatically
- **Manual action type strings** - createSlice generates these from reducer names
- **Mutating state outside Immer context** - only "mutate" inside createSlice/createReducer
- **Default exports in Redux files** - violates project conventions, breaks tree-shaking
- **Storing derived state** - compute in selectors, not in state
- **RTK Query cache not blacklisted in redux-persist** - causes stale cache restoration
- **RTK 2.0: Object syntax in extraReducers** - removed in v2, use builder callback
- **RTK 2.0: Using AnyAction type** - deprecated, use UnknownAction with isAction() guard

**Medium Priority Issues:**

- Using untyped useDispatch/useSelector instead of typed hooks
- Not using rejectWithValue for typed error handling in thunks
- Deeply nested state structure (normalize with entity adapters)
- Subscribing to entire store instead of specific slices
- Not using createSelector for derived data (causes unnecessary recalculations)
- Magic numbers for config values (timeouts, thresholds)

**Common Mistakes:**

- Defining typed hooks in the same file as store (causes circular imports)
- Not calling setupListeners for RTK Query refetch behaviors
- Forgetting to add RTK Query middleware to store configuration
- Using any type for action payloads instead of PayloadAction<T>
- Not handling all thunk lifecycle states (pending, fulfilled, rejected)
- Accessing state in action creators without proper typing

**Gotchas & Edge Cases:**

- Immer mutations only work inside createSlice/createReducer - not in action creators
- Entity adapter updateOne/updateMany perform shallow updates only - deep nested updates need manual handling
- RTK Query cache tags are case-sensitive - "User" !== "user"
- createAsyncThunk auto-dispatches pending/fulfilled/rejected - don't dispatch manually
- getDefaultMiddleware() must be called - not referenced - in middleware config
- TypeScript infers RootState from store.getState return type - keep slice types accurate

---

## Anti-Patterns

### Legacy Redux Patterns

Using createStore, combineReducers manually, switch statements, and string action types.

```typescript
// WRONG - Legacy patterns
import { createStore, combineReducers } from "redux";

const todosReducer = (state = [], action) => {
  switch (action.type) {
    case "ADD_TODO":
      return [...state, action.payload];
    default:
      return state;
  }
};

const store = createStore(combineReducers({ todos: todosReducer }));

// CORRECT - Redux Toolkit
import { configureStore, createSlice } from "@reduxjs/toolkit";

const todosSlice = createSlice({
  name: "todos",
  initialState: [],
  reducers: {
    addTodo: (state, action) => { state.push(action.payload); },
  },
});

const store = configureStore({
  reducer: { todos: todosSlice.reducer },
});
```

### Mutating State Outside Immer

Attempting to mutate state outside of createSlice/createReducer context.

```typescript
// WRONG - Mutation outside Immer
const addTodo = (todo) => (dispatch, getState) => {
  const state = getState();
  state.todos.push(todo); // Direct mutation!
  dispatch({ type: "SYNC" });
};

// CORRECT - Dispatch action to slice
const addTodo = (todo) => (dispatch) => {
  dispatch(todosSlice.actions.addTodo(todo)); // Immer handles mutation
};
```

### Untyped Hooks

Using raw useDispatch/useSelector without type inference.

```typescript
// WRONG - Untyped hooks
import { useDispatch, useSelector } from "react-redux";

const Component = () => {
  const dispatch = useDispatch(); // Can't dispatch thunks correctly
  const todos = useSelector((state: any) => state.todos); // any defeats TypeScript
};

// CORRECT - Typed hooks
import { useAppDispatch, useAppSelector } from "../store/hooks";

const Component = () => {
  const dispatch = useAppDispatch(); // Knows about thunks
  const todos = useAppSelector((state) => state.todos); // Fully typed
};
```

### Storing Derived State

Computing values in reducers instead of selectors.

```typescript
// WRONG - Derived state stored
const todosSlice = createSlice({
  name: "todos",
  initialState: {
    items: [],
    completedCount: 0, // Derived!
    activeCount: 0, // Derived!
  },
  reducers: {
    addTodo: (state, action) => {
      state.items.push(action.payload);
      state.activeCount = state.items.filter(t => !t.completed).length;
      state.completedCount = state.items.filter(t => t.completed).length;
    },
  },
});

// CORRECT - Compute in selectors
const todosSlice = createSlice({
  name: "todos",
  initialState: { items: [] },
  reducers: {
    addTodo: (state, action) => { state.items.push(action.payload); },
  },
});

// Selectors
export const selectCompletedCount = createSelector(
  [(state) => state.todos.items],
  (items) => items.filter(t => t.completed).length
);
```

### Circular Import with Typed Hooks

Defining hooks in the store file causes circular imports.

```typescript
// WRONG - Hooks in store file
// store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

const store = configureStore({ /* ... */ });

export type RootState = ReturnType<typeof store.getState>;
export const useAppSelector = useSelector.withTypes<RootState>(); // Circular!

// CORRECT - Hooks in separate file
// store/index.ts
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// store/hooks.ts (separate file)
import type { RootState, AppDispatch } from "./index";
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

### RTK Query Without Middleware

Forgetting to add API middleware to store.

```typescript
// WRONG - Missing middleware
const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    // Caching won't work!
  },
});

// CORRECT - Include middleware
const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

setupListeners(store.dispatch); // Enable refetch behaviors
```

### Deep Nesting in Entity State

Using nested state with entity adapters causes update issues.

```typescript
// WRONG - Nested entities
interface User {
  id: string;
  name: string;
  address: { // Nested object
    street: string;
    city: string;
  };
}

// updateOne only does shallow merge - address is replaced entirely
usersAdapter.updateOne(state, {
  id: "1",
  changes: { address: { city: "New York" } }, // street is lost!
});

// CORRECT - Flat structure or manual update
interface User {
  id: string;
  name: string;
  addressStreet: string;
  addressCity: string;
}

// Or handle nested updates manually
const updateUserCity = (state, action) => {
  const user = state.entities[action.payload.id];
  if (user) {
    user.address.city = action.payload.city; // Immer handles this
  }
};
```

---

## TypeScript Integration Best Practices

### Type Inference Strategy

```typescript
// 1. Infer types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// 2. Define slice state types explicitly
interface TodosState {
  items: Todo[];
  filter: "all" | "active" | "completed";
}

// 3. Use PayloadAction for all action payloads
addTodo: (state, action: PayloadAction<Omit<Todo, "id">>) => { /* ... */ }

// 4. Type thunk generics for full safety
createAsyncThunk<ReturnType, ArgType, { state: RootState; rejectValue: string }>

// 5. RTK 2.0: Use typed entity adapter with explicit ID type
const adapter = createEntityAdapter<User, string>();

// 6. RTK 2.0: Use UnknownAction instead of AnyAction
import type { UnknownAction } from "@reduxjs/toolkit";
import { isAction } from "@reduxjs/toolkit";

// Type guard before accessing action properties
if (isAction(action)) {
  console.log(action.type); // Safe
}
```

### Pre-Typed createAsyncThunk

```typescript
// store/create-app-async-thunk.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "./index";

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: string;
  extra: { apiClient: ApiClient };
}>();

// Usage
export const fetchUser = createAppAsyncThunk(
  "users/fetchUser",
  async (userId: string, { getState, extra }) => {
    // getState() returns RootState
    // extra.apiClient is typed
  }
);
```

---

## Performance Considerations

### Selector Memoization

```typescript
// WRONG - Creates new array on every call
const selectActiveTodos = (state) =>
  state.todos.items.filter(t => !t.completed);

// CORRECT - Memoized with createSelector
const selectActiveTodos = createSelector(
  [(state) => state.todos.items],
  (items) => items.filter(t => !t.completed)
);
```

### Entity Adapter Benefits

- **O(1) lookups** by ID via `entities` object
- **Sorted retrieval** via `ids` array with sortComparer
- **Memoized selectors** from getSelectors()
- **Standardized CRUD** operations

### RTK Query Cache Management

```typescript
// Configure cache lifetime
export const apiSlice = createApi({
  keepUnusedDataFor: 60, // Seconds to keep unused data
  refetchOnMountOrArgChange: 30, // Refetch if data older than 30s
  refetchOnFocus: true, // Refetch when window gains focus
  refetchOnReconnect: true, // Refetch when network reconnects
});
```

---

## Migration Guide

### From RTK 1.x to RTK 2.0

RTK 2.0 was released in December 2023. Most apps require minimal changes.

**Breaking Changes:**

1. **Object syntax removed** - `extraReducers` must use builder callback
   ```typescript
   // WRONG - No longer works in RTK 2.0
   extraReducers: {
     [fetchTodos.pending]: (state) => {}
   }

   // CORRECT - Required in RTK 2.0
   extraReducers: (builder) => {
     builder.addCase(fetchTodos.pending, (state) => {})
   }
   ```

2. **Middleware must be callback** - Cannot pass array directly
   ```typescript
   // WRONG - No longer works
   configureStore({ middleware: [myMiddleware] })

   // CORRECT
   configureStore({
     middleware: (getDefaultMiddleware) =>
       getDefaultMiddleware().concat(myMiddleware)
   })
   ```

3. **TypeScript: UnknownAction replaces AnyAction** - Use `isAction()` type guard

4. **TypeScript: Use `Tuple` for custom middleware arrays**
   ```typescript
   import { configureStore, Tuple } from "@reduxjs/toolkit";

   // WRONG - Type information lost with spread
   middleware: (getDefaultMiddleware) => [
     ...getDefaultMiddleware(),
     customMiddleware
   ]

   // CORRECT - Tuple preserves types
   middleware: (getDefaultMiddleware) =>
     new Tuple(...getDefaultMiddleware(), customMiddleware)
   ```

5. **Enhancers must be callback** - Similar to middleware
   ```typescript
   // WRONG - No longer works
   configureStore({ enhancers: [myEnhancer] })

   // CORRECT
   configureStore({
     enhancers: (getDefaultEnhancers) =>
       getDefaultEnhancers().concat(myEnhancer)
   })
   ```

**Automated Migration:**
```bash
# Run codemods for automatic syntax conversion
npx @reduxjs/rtk-codemods createSliceBuilder ./src
npx @reduxjs/rtk-codemods createReducerBuilder ./src
```

**New Features in RTK 2.0:**
- `selectors` field in `createSlice` for inline selectors
- `slice.selectSlice` auto-generated selector
- `combineSlices` for lazy-loading reducers
- `buildCreateSlice` with `asyncThunkCreator` for async thunks in reducers
- `settled` lifecycle handler for async thunks (runs after both fulfilled and rejected)
- Reselect 5.0 with `weakMapMemoize` default (infinite cache)
- `isAction()` type guard for safe action type checking in middleware

### From Legacy Redux to RTK

1. **Replace createStore with configureStore**
2. **Convert reducers to createSlice**
3. **Remove action type constants** (auto-generated)
4. **Remove action creator functions** (auto-generated)
5. **Add typed hooks** in separate hooks.ts file
6. **Replace mapStateToProps with useAppSelector**
7. **Replace mapDispatchToProps with useAppDispatch**

### From React Query to RTK Query

Only migrate if you need unified state management with Redux:

1. **Create API slice** with createApi
2. **Define endpoints** matching existing queries
3. **Add cache tags** for invalidation
4. **Replace useQuery with generated hooks**
5. **Configure store** with API middleware

---

## DevTools Usage

Redux DevTools provides:

- **Action history** - See all dispatched actions
- **State diff** - Compare state before/after each action
- **Time-travel** - Jump to any previous state
- **Action replay** - Re-dispatch recorded actions
- **Export/import** - Save and restore sessions

```typescript
// DevTools are enabled by default in development
const store = configureStore({
  reducer: { /* ... */ },
  devTools: process.env.NODE_ENV !== "production",
});
```
