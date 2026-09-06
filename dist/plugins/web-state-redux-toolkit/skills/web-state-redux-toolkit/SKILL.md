---
name: web-state-redux-toolkit
description: Redux Toolkit patterns for complex client state. Use when managing enterprise-scale state, needing DevTools, entity normalization, or RTK Query for data fetching.
---

# Redux Toolkit Patterns

> **Quick Guide:** Redux Toolkit earns its place where state is complex enough to want DevTools, middleware, time-travel or normalised entities. `configureStore` and `createSlice` are the whole authoring surface; Immer makes reducers read as mutations while staying immutable. RTK 2.0 removed the object form of `extraReducers` and the array forms of `middleware` and `enhancers` — all three are callbacks now — and `AnyAction` gave way to `UnknownAction`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — `configureStore`, `createSlice`, Immer reducers, prepare callbacks
- [examples/typed-hooks.md](examples/typed-hooks.md) — `useAppSelector` / `useAppDispatch` via `.withTypes()`
- [examples/rtk-query.md](examples/rtk-query.md) — `createApi`, endpoints, cache tags, invalidation
- [examples/entity-adapters.md](examples/entity-adapters.md) — normalised collections and their selectors
- [examples/async-thunks.md](examples/async-thunks.md) — `createAsyncThunk` and its lifecycle actions
- [examples/selectors.md](examples/selectors.md) — `createSelector` and memoisation
- [examples/rtk-2-features.md](examples/rtk-2-features.md) — `combineSlices`, inline selectors, `buildCreateSlice`
- [examples/middleware.md](examples/middleware.md) — custom middleware
- [examples/testing.md](examples/testing.md) — testing reducers, thunks and selectors
- [examples/persistence.md](examples/persistence.md) — persisting the store across sessions
- [reference.md](reference.md) — anti-pattern code, TypeScript recipes, RTK 2.0 migration, performance notes

---

## Which path applies

- **Client state the app owns** — slices, reducers and selectors; follow [examples/core.md](examples/core.md).
- **A collection of items keyed by id** — an entity adapter gives O(1) lookup and the CRUD reducers; follow [examples/entity-adapters.md](examples/entity-adapters.md).
- **Data fetched over the network, when the store is where it should live** — RTK Query owns the cache rather than a slice; follow [examples/rtk-query.md](examples/rtk-query.md).

---

<critical_requirements>

## Before writing Redux Toolkit code

**Build the store with `configureStore`.** It wires DevTools, the thunk middleware and the development-only mutation and serialisability checks, none of which `createStore` does.

**Write reducers with `createSlice`.** The action types and creators come from the reducer names, so a typo becomes a compile error rather than an action nothing handles.

**Define `useAppSelector` and `useAppDispatch` once, in their own file.** The plain hooks do not know `RootState` and do not know the dispatch accepts thunks; defining them alongside the store creates an import cycle.

**Register the RTK Query middleware when you register its reducer.** Without it the cache never populates, polling never fires and invalidation never runs — all silently, since the queries still resolve.

**Compute derived values in selectors rather than storing them.** A count kept in state has to be recalculated by every reducer that can change it, and the one that forgets is the bug.

</critical_requirements>

---

**Auto-detection:** `configureStore`, `createSlice`, `createAsyncThunk`, `createEntityAdapter`, `createSelector`, `createApi`, `PayloadAction`, `useSelector`, `useDispatch`, `.withTypes()`, `extraReducers`, `combineSlices`, `buildCreateSlice`, `UnknownAction`, `@reduxjs/toolkit`

**Applies to:**

- Store configuration, slices, and reducers written against Immer
- Typed hooks and the `RootState` / `AppDispatch` inference chain
- Normalised entity state, memoised selectors, custom middleware
- RTK Query endpoints and cache invalidation
- Migrating from legacy Redux, or from RTK 1.x to 2.0

**Handled elsewhere:**

- Values a single component reads — component-local state needs no store
- Filters, search and pagination — those belong in the URL, where they survive a reload and can be shared
- Styling and rendering — a slice knows what the state is, not how it looks

---

<philosophy>

One store, changed only by pure reducers, in response to actions that describe what happened. That constraint is what buys the DevTools timeline, replayable sessions and a state change you can point at.

RTK's contribution is removing the cost of it. `createSlice` derives the action types and creators from the reducer names, so the three-file dance of constants, creators and a switch statement collapses to one object. Immer lets a reducer read as a mutation while producing a new state, so the spread chains that made deep updates error-prone go away.

The overhead that remains is conceptual rather than syntactic: an action indirection between an event and a state change. Where state is small and flat, that indirection buys nothing and something lighter fits better.

</philosophy>

---

<decision_framework>

### RTK Query, a thunk, or middleware

```
Is it a straightforward request against an endpoint?
├─ YES → RTK Query — caching, invalidation and generated hooks come with it
└─ NO → Is it a multi-step flow that reads state as it goes?
    ├─ YES → createAsyncThunk — sequential calls, conditional logic, upload progress
    └─ NO → Is it a side effect reacting to actions?
        └─ YES → middleware — logging, analytics, persistence
```

### Entity adapter or a plain array

```
Do the items have unique ids?
├─ NO  → a plain object or array in the slice
└─ YES → Are they looked up or updated individually?
    ├─ YES → createEntityAdapter — O(1) by id, CRUD reducers, memoised selectors
    └─ NO  → an array in the slice is simpler and reads in order for free
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Store Configuration

The store's own type is the source for `RootState` and `AppDispatch`, so nothing is typed by hand.

```typescript
export const store = configureStore({
  reducer: { todos: todosReducer, [apiSlice.reducerPath]: apiSlice.reducer },
  middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
});

setupListeners(store.dispatch); // refetch on focus and reconnect

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Full code: [examples/core.md](examples/core.md#pattern-1-store-configuration)

### Pattern 2: Slice Creation with createSlice

State, reducers and action creators in one place. The "mutations" run through Immer.

```typescript
const todosSlice = createSlice({
  name: "todos",
  initialState,
  reducers: {
    toggleTodo: (state, action: PayloadAction<string>) => {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.completed = !todo.completed;
    },
  },
});
```

A `prepare` callback covers an action creator that has to build its payload — generating an id, stamping a time.

Full code: [examples/core.md](examples/core.md#pattern-2-slice-creation-with-createslice)

### Pattern 3: Typed Hooks

Defined once, against the store's inferred types.

```typescript
// store/hooks.ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

`.withTypes()` needs React Redux 9.1 or later. These live beside the store rather than in it, or the store imports the hooks that import the store.

Full code: [examples/typed-hooks.md](examples/typed-hooks.md)

### Pattern 4: RTK Query for Data Fetching

An API slice declares endpoints and the tags that connect a mutation to the queries it invalidates.

```typescript
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Todo"],
  endpoints: (build) => ({
    getTodos: build.query<Todo[], void>({
      query: () => "/todos",
      providesTags: ["Todo"],
    }),
    addTodo: build.mutation<Todo, NewTodo>({
      query: (body) => ({ url: "/todos", method: "POST", body }),
      invalidatesTags: ["Todo"],
    }),
  }),
});
```

Full code: [examples/rtk-query.md](examples/rtk-query.md)

### Pattern 5: Entity Adapters

Normalised storage — an `ids` array and an `entities` map — plus the reducers and selectors that go with it.

```typescript
const usersAdapter = createEntityAdapter<User, string>({
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const usersSlice = createSlice({
  name: "users",
  initialState: usersAdapter.getInitialState(),
  reducers: {
    userAdded: usersAdapter.addOne,
    userUpdated: usersAdapter.updateOne,
  },
});
```

Full code: [examples/entity-adapters.md](examples/entity-adapters.md)

### Pattern 6: Async Thunks

`createAsyncThunk` dispatches `pending`, `fulfilled` and `rejected` itself; the slice handles them in `extraReducers`.

```typescript
const fetchUser = createAsyncThunk(
  "users/fetch",
  async (id: string, { rejectWithValue }) => {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return rejectWithValue("Not found");
    return res.json();
  },
);
```

`rejectWithValue` is what makes the failure payload typed instead of a serialised error.

Full code: [examples/async-thunks.md](examples/async-thunks.md)

### Pattern 7: Selectors and Memoisation

A selector deriving a new array or object memoises, or every render sees a new reference.

```typescript
const selectActiveTodos = createSelector(
  [(state: RootState) => state.todos.items],
  (items) => items.filter((t) => !t.completed),
);
```

Full code: [examples/selectors.md](examples/selectors.md)

### Pattern 8: Middleware

The `middleware` option is a callback so the defaults are kept and extended rather than replaced.

```typescript
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware().concat(analyticsMiddleware);
```

Full code: [examples/middleware.md](examples/middleware.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **An API slice's reducer registered without its middleware** — queries resolve but nothing caches, invalidates or polls, and no error says so.
- **`setupListeners` never called** — `refetchOnFocus` and `refetchOnReconnect` are configured and inert.
- **Object syntax in `extraReducers`** — removed in RTK 2.0; the builder callback is the only form.
- **An array passed to `middleware` or `enhancers`** — both take a callback in RTK 2.0.
- **State mutated outside a reducer** — Immer's draft only exists inside `createSlice` and `createReducer`. The same syntax in a thunk mutates the real state object.
- **Typed hooks defined in the store file** — a circular import between the store and the hooks that need its types.
- **A persisted store that does not exclude the RTK Query cache** — rehydration restores a cache the server has moved past.

**Surprising behaviour:**

- `updateOne` and `updateMany` merge shallowly, so a `changes` object naming a nested field replaces the whole nested object and drops its siblings.
- RTK Query tag names are compared exactly: `"User"` and `"user"` are two tags, and a mutation invalidating one leaves the other's queries alone.
- `getDefaultMiddleware` is a function to call, not a value to spread; the callback receives it and the result is what gets concatenated.
- `createAsyncThunk` dispatches its own lifecycle actions — dispatching `pending` by hand runs the handler twice.
- A selector returning `items.filter(...)` unmemoised returns a new array every call, so a connected component re-renders on every action.
- `RootState` is inferred from `store.getState`, so a slice whose state type is loose quietly loosens the type every selector is checked against.
- RTK 2.0 replaced `AnyAction` with `UnknownAction`, which does not let you read `action.type` until `isAction()` has narrowed it — deliberately, since middleware receives anything.

</red_flags>
