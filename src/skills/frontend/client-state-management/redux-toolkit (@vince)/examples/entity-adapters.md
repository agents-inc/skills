# Redux Toolkit - Entity Adapter Examples

Entity adapters for normalized state management with CRUD operations.

**Prerequisites:** Understand [core.md](core.md) (Slice Creation) and [typed-hooks.md](typed-hooks.md) first.

---

## Pattern: Entity Adapters for Normalized State

### Good Example - Entity Adapter with Typed Selectors

```typescript
// store/slices/users-slice.ts
import {
  createSlice,
  createEntityAdapter,
  createAsyncThunk,
} from "@reduxjs/toolkit";
import type { PayloadAction, EntityState } from "@reduxjs/toolkit";
import type { RootState } from "../index";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

interface UsersState extends EntityState<User, string> {
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

// RTK 2.0: Create adapter with explicit ID type as second generic parameter
// Handles normalized state { ids: [], entities: {} }
const usersAdapter = createEntityAdapter<User, string>({
  // Custom ID selector if not using `id` field
  selectId: (user) => user.id,
  // Sort by name
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const initialState: UsersState = usersAdapter.getInitialState({
  status: "idle",
  error: null,
});

// Async thunk for fetching users
export const fetchUsers = createAsyncThunk<User[], void>(
  "users/fetchUsers",
  async () => {
    const response = await fetch("/api/users");
    return response.json();
  }
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    // Use adapter methods as reducers
    userAdded: usersAdapter.addOne,
    userUpdated: usersAdapter.updateOne,
    userRemoved: usersAdapter.removeOne,
    usersReceived: usersAdapter.setAll,

    // Custom reducer using adapter as helper
    userRoleChanged: (
      state,
      action: PayloadAction<{ id: string; role: User["role"] }>
    ) => {
      usersAdapter.updateOne(state, {
        id: action.payload.id,
        changes: { role: action.payload.role },
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        usersAdapter.setAll(state, action.payload);
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to fetch users";
      });
  },
});

// Export actions
export const {
  userAdded,
  userUpdated,
  userRemoved,
  usersReceived,
  userRoleChanged,
} = usersSlice.actions;

// Generate selectors for this entity state
export const {
  selectAll: selectAllUsers,
  selectById: selectUserById,
  selectIds: selectUserIds,
  selectEntities: selectUserEntities,
  selectTotal: selectTotalUsers,
} = usersAdapter.getSelectors<RootState>((state) => state.users);

// Custom selectors
export const selectUsersByRole = (state: RootState, role: User["role"]) =>
  selectAllUsers(state).filter((user) => user.role === role);

export const selectUsersStatus = (state: RootState) => state.users.status;
export const selectUsersError = (state: RootState) => state.users.error;

export const usersReducer = usersSlice.reducer;
```

**Why good:** Entity adapter standardizes CRUD operations, sorted entities via sortComparer, typed selectors with RootState, extraReducers handles async thunk lifecycle, status/error in extended state, named exports

---

## Component Usage with Entity Adapter

```typescript
// components/users-admin.tsx
import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  fetchUsers,
  selectAllUsers,
  selectUsersStatus,
  selectUsersError,
  userRemoved,
  userRoleChanged,
} from "../store/slices/users-slice";

export const UsersAdmin = () => {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectAllUsers);
  const status = useAppSelector(selectUsersStatus);
  const error = useAppSelector(selectUsersError);

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchUsers());
    }
  }, [status, dispatch]);

  if (status === "loading") return <div>Loading...</div>;
  if (status === "failed") return <div>Error: {error}</div>;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.name} - {user.role}
          <button
            onClick={() =>
              dispatch(
                userRoleChanged({
                  id: user.id,
                  role: user.role === "admin" ? "user" : "admin",
                })
              )
            }
          >
            Toggle Role
          </button>
          <button onClick={() => dispatch(userRemoved(user.id))}>Remove</button>
        </li>
      ))}
    </ul>
  );
};
```

**Why good:** Uses entity adapter selectors, dispatch properly typed, status-based rendering, named export

---
