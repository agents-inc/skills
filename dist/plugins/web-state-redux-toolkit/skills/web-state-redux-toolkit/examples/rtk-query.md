# Redux Toolkit - RTK Query Examples

RTK Query patterns for data fetching with automatic caching and invalidation.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration) first.

---

## Pattern: RTK Query for Data Fetching

### Good Example - API Slice with Cache Tags

```typescript
// store/api/api-slice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const API_BASE_URL = "/api/v1";
const CACHE_TIME_SECONDS = 60;

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  tagTypes: ["User", "Post"],
  keepUnusedDataFor: CACHE_TIME_SECONDS,
  endpoints: (builder) => ({
    // Query endpoint - for reading data
    getUsers: builder.query<User[], void>({
      query: () => "/users",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "User" as const, id })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    getUserById: builder.query<User, string>({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),

    // Mutation endpoint - for creating/updating/deleting
    createUser: builder.mutation<User, CreateUserRequest>({
      query: (newUser) => ({
        url: "/users",
        method: "POST",
        body: newUser,
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    updateUser: builder.mutation<User, Partial<User> & Pick<User, "id">>({
      query: ({ id, ...patch }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "User", id }],
    }),

    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
  }),
});

// Export auto-generated hooks
export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = apiSlice;
```

**Why good:** The tags connect the mutation to the queries it makes stale, so a successful write refetches the affected lists without any call site coordinating it. The hooks are generated from the endpoint definitions, so the request and response types cannot drift from the component that consumes them.

---

## Component Usage with RTK Query

```typescript
// components/user-list.tsx
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} from "../store/api/api-slice";

const REFETCH_INTERVAL_MS = 30000;

export const UserList = () => {
  const { data: users, isLoading, isError, error, refetch } = useGetUsersQuery(
    undefined,
    { pollingInterval: REFETCH_INTERVAL_MS }
  );
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div>Error: {String(error)}</div>;

  const handleCreate = async () => {
    try {
      await createUser({ name: "New User", email: "new@example.com" }).unwrap();
    } catch (err) {
      console.error("Failed to create user:", err);
    }
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isCreating}>
        {isCreating ? "Creating..." : "Add User"}
      </button>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {users?.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
            <button onClick={() => deleteUser(user.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**Why good:** The query hook owns the loading and error flags, so the component branches on them rather than tracking a request itself. `.unwrap()` is what makes the `try`/`catch` work: the promise a mutation trigger returns resolves with a result object either way, and only the unwrapped form rejects on failure.

---
