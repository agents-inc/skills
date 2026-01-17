# Redux Toolkit (RTK) Best Practices Research

**Research Date:** 2026-01-15
**Purpose:** Atomic skill creation for Redux Toolkit patterns
**Sources:** Official Redux/RTK documentation, community best practices 2025

---

## Table of Contents

1. [createSlice Patterns](#1-createslice-patterns)
2. [RTK Query Patterns](#2-rtk-query-patterns)
3. [createAsyncThunk Patterns](#3-createasyncthunk-patterns)
4. [Entity Adapter Patterns](#4-entity-adapter-patterns)
5. [Selector Patterns](#5-selector-patterns)
6. [Middleware Patterns](#6-middleware-patterns)
7. [Store Setup Patterns](#7-store-setup-patterns)
8. [TypeScript Integration](#8-typescript-integration)
9. [Normalized State Patterns](#9-normalized-state-patterns)
10. [Testing Redux Logic](#10-testing-redux-logic)

---

## 1. createSlice Patterns

### Core Pattern: Basic Slice with TypeScript

```typescript
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

// 1. Define state interface
interface CounterState {
  value: number
  status: 'idle' | 'loading' | 'failed'
}

// 2. Define initial state with type assertion
const initialState: CounterState = {
  value: 0,
  status: 'idle',
}

// 3. Create slice
const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment(state) {
      state.value++
    },
    decrement(state) {
      state.value--
    },
    incrementByAmount(state, action: PayloadAction<number>) {
      state.value += action.payload
    },
    reset: () => initialState,
  },
})

// 4. Export actions and reducer
export const { increment, decrement, incrementByAmount, reset } = counterSlice.actions
export default counterSlice.reducer
```

### Pattern: Prepared Reducers (Custom Action Payloads)

```typescript
import { createSlice, nanoid } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface Todo {
  id: string
  text: string
  createdAt: string
}

interface TodosState {
  items: Todo[]
}

const todosSlice = createSlice({
  name: 'todos',
  initialState: { items: [] } as TodosState,
  reducers: {
    // Prepare callback for generating payload
    addTodo: {
      reducer(state, action: PayloadAction<Todo>) {
        state.items.push(action.payload)
      },
      prepare(text: string) {
        return {
          payload: {
            id: nanoid(),
            text,
            createdAt: new Date().toISOString(),
          },
        }
      },
    },
  },
})
```

### Pattern: Creator Callback with Async Thunks (RTK 2.0+)

```typescript
import { createSlice, buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit'

// Create custom createSlice with async thunk support
const createSliceWithThunks = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
})

interface User {
  id: string
  name: string
}

interface UsersState {
  data: User[]
  loading: boolean
  error: string | null
}

const usersSlice = createSliceWithThunks({
  name: 'users',
  initialState: { data: [], loading: false, error: null } as UsersState,
  reducers: (create) => ({
    // Regular reducer
    clearUsers: create.reducer((state) => {
      state.data = []
    }),

    // Async thunk with lifecycle handlers
    fetchUsers: create.asyncThunk(
      async (_, { rejectWithValue }) => {
        try {
          const response = await fetch('/api/users')
          return (await response.json()) as User[]
        } catch (error) {
          return rejectWithValue('Failed to fetch users')
        }
      },
      {
        pending: (state) => {
          state.loading = true
          state.error = null
        },
        fulfilled: (state, action) => {
          state.loading = false
          state.data = action.payload
        },
        rejected: (state, action) => {
          state.loading = false
          state.error = action.payload as string
        },
      }
    ),
  }),
})
```

### Pattern: extraReducers with Builder Callback

```typescript
import { createSlice, createAction } from '@reduxjs/toolkit'
import type { Action } from '@reduxjs/toolkit'

// External action from another slice
const userLoggedOut = createAction('auth/logout')

// Type guard for rejected actions
function isRejectedAction(action: Action): action is Action & { error: Error } {
  return action.type.endsWith('rejected')
}

const dataSlice = createSlice({
  name: 'data',
  initialState: { items: [], error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Handle specific action
      .addCase(userLoggedOut, (state) => {
        state.items = []
      })
      // Handle pattern matching
      .addMatcher(isRejectedAction, (state, action) => {
        state.error = action.error?.message ?? 'Unknown error'
      })
      // Default case
      .addDefaultCase((state, action) => {
        // Optional: handle unmatched actions
      })
  },
})
```

### Pattern: Slice Selectors (RTK 2.0+)

```typescript
import { createSlice, createSelector } from '@reduxjs/toolkit'

interface CartItem {
  id: string
  price: number
  quantity: number
}

interface CartState {
  items: CartItem[]
  discount: number
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], discount: 0 } as CartState,
  reducers: {
    addItem: (state, action) => {
      state.items.push(action.payload)
    },
  },
  selectors: {
    // Simple selector
    selectItems: (state) => state.items,
    selectDiscount: (state) => state.discount,
    // Derived selector
    selectSubtotal: (state) =>
      state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    // Composed selector using slice's own selectors
    selectTotal: createSelector(
      (state: CartState) => state.items,
      (state: CartState) => state.discount,
      (items, discount) => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        return subtotal * (1 - discount)
      }
    ),
  },
})

export const { selectItems, selectTotal, selectSubtotal } = cartSlice.selectors
```

### Anti-Patterns to Avoid

```typescript
// BAD: Mutating state outside Immer context
const badSlice = createSlice({
  name: 'bad',
  initialState: { items: [] },
  reducers: {
    // WRONG: Returning AND mutating
    addItem(state, action) {
      state.items.push(action.payload)
      return state // Don't return when mutating!
    },
  },
})

// BAD: Object syntax in extraReducers (deprecated in RTK 2.0)
const deprecatedSlice = createSlice({
  name: 'deprecated',
  initialState: {},
  reducers: {},
  // WRONG: Object syntax is deprecated
  extraReducers: {
    'auth/logout': (state) => initialState,
  },
})

// BAD: Non-serializable values in state
const nonSerializableSlice = createSlice({
  name: 'nonSerializable',
  initialState: {
    callback: () => {}, // WRONG: Functions aren't serializable
    date: new Date(),   // WRONG: Date objects aren't serializable
    map: new Map(),     // WRONG: Map isn't serializable
  },
  reducers: {},
})

// BAD: Putting derived data in state
const derivedSlice = createSlice({
  name: 'derived',
  initialState: {
    items: [],
    // WRONG: This should be computed via selector
    totalCount: 0,
    filteredItems: [],
  },
  reducers: {},
})
```

### When to Use createSlice

**Use When:**
- Managing any piece of Redux state
- Need automatic action creator generation
- Want type-safe reducer logic with Immer
- Building feature-based state modules

**Don't Use When:**
- Data should live in component local state (use useState)
- Server data that should use RTK Query instead
- Simple derived values (use selectors instead)

---

## 2. RTK Query Patterns

### Core Pattern: API Slice Setup

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Types
interface User {
  id: number
  name: string
  email: string
}

interface CreateUserRequest {
  name: string
  email: string
}

// API slice
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ['User', 'Post'],
  endpoints: () => ({}),
})
```

### Pattern: Query Endpoints

```typescript
import { apiSlice } from './apiSlice'

interface User {
  id: number
  name: string
  email: string
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // Basic query
    getUser: build.query<User, number>({
      query: (id) => `users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),

    // Query with parameters
    getUsers: build.query<PaginatedResponse<User>, { page: number; limit: number }>({
      query: ({ page, limit }) => ({
        url: 'users',
        params: { page, limit },
      }),
      // Transform nested response
      transformResponse: (response: { users: PaginatedResponse<User> }) => response.users,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),

    // Query with validation
    getUserWithValidation: build.query<User, number>({
      query: (id) => `users/${id}`,
      transformResponse: (response: unknown) => {
        // Validate with Zod or similar
        return userSchema.parse(response)
      },
      transformErrorResponse: (response) => ({
        status: response.status,
        message: 'Failed to fetch user',
      }),
    }),
  }),
})

export const { useGetUserQuery, useGetUsersQuery } = usersApi
```

### Pattern: Mutation Endpoints

```typescript
export const usersApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // Create mutation
    createUser: build.mutation<User, CreateUserRequest>({
      query: (body) => ({
        url: 'users',
        method: 'POST',
        body,
      }),
      // Invalidate list cache
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),

    // Update mutation
    updateUser: build.mutation<User, { id: number; data: Partial<User> }>({
      query: ({ id, data }) => ({
        url: `users/${id}`,
        method: 'PATCH',
        body: data,
      }),
      // Invalidate specific user
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
    }),

    // Delete mutation
    deleteUser: build.mutation<void, number>({
      query: (id) => ({
        url: `users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
  }),
})

export const { useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation } = usersApi
```

### Pattern: Optimistic Updates

```typescript
export const postsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    updatePost: build.mutation<Post, { id: number; title: string }>({
      query: ({ id, ...body }) => ({
        url: `posts/${id}`,
        method: 'PATCH',
        body,
      }),
      async onQueryStarted({ id, ...patch }, { dispatch, queryFulfilled }) {
        // Optimistic update
        const patchResult = dispatch(
          postsApi.util.updateQueryData('getPost', id, (draft) => {
            Object.assign(draft, patch)
          })
        )
        try {
          await queryFulfilled
        } catch {
          // Rollback on error
          patchResult.undo()
        }
      },
    }),
  }),
})
```

### Pattern: Pessimistic Updates

```typescript
export const postsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    addPost: build.mutation<Post, Omit<Post, 'id'>>({
      query: (body) => ({
        url: 'posts',
        method: 'POST',
        body,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data: newPost } = await queryFulfilled
          // Update cache after server confirms
          dispatch(
            postsApi.util.updateQueryData('getPosts', undefined, (draft) => {
              draft.push(newPost)
            })
          )
        } catch {
          // Handle error
        }
      },
    }),
  }),
})
```

### Pattern: Conditional Fetching and Polling

```typescript
function UserProfile({ userId }: { userId: number | null }) {
  // Skip query when no userId
  const { data, isLoading } = useGetUserQuery(userId!, {
    skip: userId === null,
  })

  // Polling
  const { data: notifications } = useGetNotificationsQuery(undefined, {
    pollingInterval: 30000, // 30 seconds
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })

  return <div>{/* ... */}</div>
}
```

### Pattern: Streaming Updates (WebSocket)

```typescript
export const chatApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getMessages: build.query<Message[], string>({
      query: (channelId) => `channels/${channelId}/messages`,
      async onCacheEntryAdded(
        channelId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        const ws = new WebSocket(`wss://api.example.com/channels/${channelId}`)

        try {
          await cacheDataLoaded

          ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data)
            updateCachedData((draft) => {
              draft.push(message)
            })
          })
        } catch {
          // Handle error
        }

        await cacheEntryRemoved
        ws.close()
      },
    }),
  }),
})
```

### Anti-Patterns to Avoid

```typescript
// BAD: Multiple API slices (should be one per app)
const usersApi = createApi({ reducerPath: 'usersApi', ... })
const postsApi = createApi({ reducerPath: 'postsApi', ... }) // WRONG

// GOOD: Single API with injected endpoints
const apiSlice = createApi({ ... })
const usersEndpoints = apiSlice.injectEndpoints({ ... })
const postsEndpoints = apiSlice.injectEndpoints({ ... })

// BAD: Using refetchOnMountOrArgChange indiscriminately
const { data } = useGetUserQuery(id, {
  refetchOnMountOrArgChange: true, // Defeats caching purpose
})

// BAD: Manual cache management when tags work
const handleUpdate = async () => {
  await updateUser(data)
  // WRONG: Manually refetching
  refetch()
}

// GOOD: Use invalidation tags instead
invalidatesTags: [{ type: 'User', id }]

// BAD: Putting non-API state in RTK Query
const api = createApi({
  endpoints: (build) => ({
    // WRONG: This isn't fetched data
    setTheme: build.mutation<void, string>({
      queryFn: (theme) => {
        localStorage.setItem('theme', theme)
        return { data: undefined }
      },
    }),
  }),
})
```

### When to Use RTK Query

**Use When:**
- Fetching data from REST or GraphQL APIs
- Need automatic caching and invalidation
- Want deduplication of requests
- Need loading/error states handled automatically
- Building data-fetching heavy applications

**Don't Use When:**
- Simple one-off requests (use fetch directly)
- Local-only state management
- File uploads (may need custom handling)
- WebSocket-only communication (though it can augment queries)

---

## 3. createAsyncThunk Patterns

### Core Pattern: Basic Async Thunk

```typescript
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

interface User {
  id: number
  name: string
}

// Define thunk
export const fetchUserById = createAsyncThunk(
  'users/fetchById',
  async (userId: number) => {
    const response = await fetch(`/api/users/${userId}`)
    return (await response.json()) as User
  }
)

// Use in slice
const usersSlice = createSlice({
  name: 'users',
  initialState: {
    entity: null as User | null,
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false
        state.entity = action.payload
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch user'
      })
  },
})
```

### Pattern: Pre-typed Thunk Creator

```typescript
import { createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from './store'

// Create pre-typed version once
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
  extra: { api: ApiClient }
}>()

// Use without repeating types
export const fetchUserById = createAppAsyncThunk(
  'users/fetchById',
  async (userId: number, { getState, extra, rejectWithValue }) => {
    const state = getState() // Correctly typed as RootState
    const { api } = extra   // Correctly typed

    try {
      return await api.getUser(userId)
    } catch (error) {
      return rejectWithValue('Failed to fetch user')
    }
  }
)
```

### Pattern: Error Handling with rejectWithValue

```typescript
interface ApiError {
  code: string
  message: string
  field?: string
}

export const createUser = createAppAsyncThunk<
  User,           // Return type
  CreateUserDto,  // Argument type
  { rejectValue: ApiError }
>(
  'users/create',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error as ApiError)
      }

      return (await response.json()) as User
    } catch (error) {
      return rejectWithValue({
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
      })
    }
  }
)

// Handle in slice
builder.addCase(createUser.rejected, (state, action) => {
  if (action.payload) {
    // Typed error from rejectWithValue
    state.error = action.payload.message
    state.errorField = action.payload.field
  } else {
    // Unexpected error
    state.error = action.error.message ?? 'Unknown error'
  }
})
```

### Pattern: Conditional Fetching

```typescript
export const fetchUserById = createAppAsyncThunk(
  'users/fetchById',
  async (userId: number) => {
    const response = await fetch(`/api/users/${userId}`)
    return (await response.json()) as User
  },
  {
    // Skip if already cached
    condition: (userId, { getState }) => {
      const { users } = getState()
      const existingUser = users.entities[userId]

      // Don't fetch if we have fresh data
      if (existingUser && !users.stale) {
        return false
      }

      // Don't fetch if already loading
      if (users.loadingIds.includes(userId)) {
        return false
      }

      return true
    },
    // Optional: dispatch rejected action when skipped
    dispatchConditionRejection: false,
  }
)
```

### Pattern: Request Cancellation

```typescript
export const fetchUserById = createAppAsyncThunk(
  'users/fetchById',
  async (userId: number, { signal }) => {
    const response = await fetch(`/api/users/${userId}`, { signal })
    return (await response.json()) as User
  }
)

// In component
function UserProfile({ userId }: { userId: number }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const promise = dispatch(fetchUserById(userId))

    return () => {
      // Cancel on unmount or userId change
      promise.abort()
    }
  }, [userId, dispatch])
}
```

### Pattern: Thunk Composition

```typescript
export const initializeApp = createAppAsyncThunk(
  'app/initialize',
  async (_, { dispatch }) => {
    // Dispatch multiple thunks in sequence
    const userResult = await dispatch(fetchCurrentUser())

    if (fetchCurrentUser.fulfilled.match(userResult)) {
      // Parallel fetches after user is loaded
      await Promise.all([
        dispatch(fetchUserPreferences(userResult.payload.id)),
        dispatch(fetchUserNotifications(userResult.payload.id)),
      ])
    }

    return { initialized: true }
  }
)
```

### Anti-Patterns to Avoid

```typescript
// BAD: Not using rejectWithValue for typed errors
export const badThunk = createAsyncThunk(
  'bad/thunk',
  async () => {
    try {
      return await fetchData()
    } catch (error) {
      throw error // Loses type safety
    }
  }
)

// BAD: Accessing state without proper typing
export const untypedThunk = createAsyncThunk(
  'untyped/thunk',
  async (_, { getState }) => {
    const state = getState() // any type
    return state.users.currentUser // No type safety
  }
)

// BAD: Side effects in thunk without cleanup
export const leakyThunk = createAsyncThunk(
  'leaky/thunk',
  async () => {
    setInterval(() => { /* polling */ }, 1000) // Never cleaned up
    return data
  }
)

// BAD: Not handling AbortError
export const unhandledAbort = createAsyncThunk(
  'unhandled/thunk',
  async (_, { signal }) => {
    const response = await fetch('/api/data', { signal })
    // AbortError will be thrown as rejected action
    return response.json()
  }
)
```

### When to Use createAsyncThunk

**Use When:**
- Need to dispatch actions before/after async operations
- Complex async logic with multiple dispatch calls
- Need access to getState() during async operation
- Legacy codebases not using RTK Query

**Don't Use When:**
- Simple data fetching (use RTK Query)
- CRUD operations with caching needs (use RTK Query)
- Sync operations (use regular reducers)

---

## 4. Entity Adapter Patterns

### Core Pattern: Basic Entity Adapter

```typescript
import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
} from '@reduxjs/toolkit'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

// Create adapter
const usersAdapter = createEntityAdapter<User>()

// Get initial state with additional fields
const initialState = usersAdapter.getInitialState({
  loading: false,
  error: null as string | null,
  selectedId: null as string | null,
})

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Use adapter methods directly as reducers
    userAdded: usersAdapter.addOne,
    usersReceived: usersAdapter.setAll,
    userUpdated: usersAdapter.updateOne,
    userRemoved: usersAdapter.removeOne,

    // Custom reducers that use adapter methods
    userSelected(state, action: PayloadAction<string>) {
      state.selectedId = action.payload
    },
  },
})
```

### Pattern: Custom ID and Sorting

```typescript
interface Book {
  bookId: string  // Non-standard ID field
  title: string
  author: string
  publishedYear: number
}

const booksAdapter = createEntityAdapter<Book>({
  // Custom ID selector
  selectId: (book) => book.bookId,

  // Sort by title alphabetically
  sortComparer: (a, b) => a.title.localeCompare(b.title),
})
```

### Pattern: Entity Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit'

// Create selectors scoped to slice
const usersSelectors = usersAdapter.getSelectors<RootState>(
  (state) => state.users
)

// Export basic selectors
export const {
  selectAll: selectAllUsers,
  selectById: selectUserById,
  selectIds: selectUserIds,
  selectEntities: selectUserEntities,
  selectTotal: selectTotalUsers,
} = usersSelectors

// Create derived selectors
export const selectAdminUsers = createSelector(
  [selectAllUsers],
  (users) => users.filter((user) => user.role === 'admin')
)

export const selectSelectedUser = createSelector(
  [selectUserEntities, (state: RootState) => state.users.selectedId],
  (entities, selectedId) => (selectedId ? entities[selectedId] : null)
)

// Parameterized selector
export const selectUsersByRole = createSelector(
  [selectAllUsers, (_, role: User['role']) => role],
  (users, role) => users.filter((user) => user.role === role)
)
```

### Pattern: Entity Adapter with Async Thunks

```typescript
export const fetchUsers = createAsyncThunk('users/fetchAll', async () => {
  const response = await fetch('/api/users')
  return (await response.json()) as User[]
})

export const addUser = createAsyncThunk(
  'users/add',
  async (user: Omit<User, 'id'>) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    })
    return (await response.json()) as User
  }
)

const usersSlice = createSlice({
  name: 'users',
  initialState: usersAdapter.getInitialState({ loading: false }),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false
        usersAdapter.setAll(state, action.payload)
      })
      .addCase(addUser.fulfilled, (state, action) => {
        usersAdapter.addOne(state, action.payload)
      })
  },
})
```

### Pattern: Upsert Operations

```typescript
const usersSlice = createSlice({
  name: 'users',
  initialState: usersAdapter.getInitialState(),
  reducers: {
    // Add or update single entity
    userUpserted: usersAdapter.upsertOne,

    // Add or update multiple entities
    usersUpserted: usersAdapter.upsertMany,

    // Partial update (only specified fields)
    userPartiallyUpdated(
      state,
      action: PayloadAction<{ id: string; changes: Partial<User> }>
    ) {
      usersAdapter.updateOne(state, {
        id: action.payload.id,
        changes: action.payload.changes,
      })
    },
  },
})
```

### Pattern: Working with Normalized Relationships

```typescript
// Entity types with relationships
interface Author {
  id: string
  name: string
  bookIds: string[]
}

interface Book {
  id: string
  title: string
  authorId: string
}

// Separate adapters for each entity type
const authorsAdapter = createEntityAdapter<Author>()
const booksAdapter = createEntityAdapter<Book>()

// Slice with both entity types
interface LibraryState {
  authors: ReturnType<typeof authorsAdapter.getInitialState>
  books: ReturnType<typeof booksAdapter.getInitialState>
}

// Selector to get author with their books
export const selectAuthorWithBooks = createSelector(
  [
    (state: RootState) => state.library.authors.entities,
    (state: RootState) => state.library.books.entities,
    (_, authorId: string) => authorId,
  ],
  (authors, books, authorId) => {
    const author = authors[authorId]
    if (!author) return null

    return {
      ...author,
      books: author.bookIds
        .map((id) => books[id])
        .filter((book): book is Book => book !== undefined),
    }
  }
)
```

### Anti-Patterns to Avoid

```typescript
// BAD: Storing derived data in entity state
const badAdapter = createEntityAdapter<User>()
const badSlice = createSlice({
  name: 'users',
  initialState: badAdapter.getInitialState({
    adminCount: 0,        // WRONG: Should be computed via selector
    filteredIds: [],      // WRONG: Should be computed via selector
  }),
  reducers: {
    userAdded(state, action) {
      badAdapter.addOne(state, action.payload)
      // WRONG: Manually maintaining derived data
      if (action.payload.role === 'admin') {
        state.adminCount++
      }
    },
  },
})

// BAD: Not using adapter methods
const manualSlice = createSlice({
  name: 'users',
  initialState: { ids: [], entities: {} },
  reducers: {
    userAdded(state, action) {
      // WRONG: Manual normalization
      state.ids.push(action.payload.id)
      state.entities[action.payload.id] = action.payload
    },
  },
})

// BAD: Storing non-normalized data
interface BadState {
  users: User[]  // WRONG: Array instead of normalized structure
}
```

### When to Use Entity Adapter

**Use When:**
- Managing collections of similar items (users, posts, products)
- Need efficient lookups by ID
- Want consistent CRUD operations
- Working with normalized relational data

**Don't Use When:**
- Single object state (user profile, settings)
- Non-collection data (UI state, form state)
- Data that doesn't have unique IDs
- Small, fixed-size collections (< 10 items)

---

## 5. Selector Patterns

### Core Pattern: Basic Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './store'

// Simple selector (not memoized)
export const selectTodos = (state: RootState) => state.todos.items

// Memoized selector for derived data
export const selectCompletedTodos = createSelector(
  [selectTodos],
  (todos) => todos.filter((todo) => todo.completed)
)

// Multiple input selectors
export const selectFilteredTodos = createSelector(
  [selectTodos, (state: RootState) => state.todos.filter],
  (todos, filter) => {
    switch (filter) {
      case 'completed':
        return todos.filter((t) => t.completed)
      case 'active':
        return todos.filter((t) => !t.completed)
      default:
        return todos
    }
  }
)
```

### Pattern: Composing Selectors

```typescript
// Base selectors
const selectUsers = (state: RootState) => state.users.entities
const selectPosts = (state: RootState) => state.posts.entities
const selectCurrentUserId = (state: RootState) => state.auth.userId

// Composed selectors
export const selectCurrentUser = createSelector(
  [selectUsers, selectCurrentUserId],
  (users, userId) => (userId ? users[userId] : null)
)

export const selectCurrentUserPosts = createSelector(
  [selectPosts, selectCurrentUserId],
  (posts, userId) =>
    Object.values(posts).filter((post) => post?.authorId === userId)
)

// Deeply composed selector
export const selectCurrentUserWithPosts = createSelector(
  [selectCurrentUser, selectCurrentUserPosts],
  (user, posts) => (user ? { ...user, posts } : null)
)
```

### Pattern: Parameterized Selectors

```typescript
// Factory function for parameterized selectors
export const makeSelectUserById = () =>
  createSelector(
    [selectUsers, (_, userId: string) => userId],
    (users, userId) => users[userId]
  )

// Usage in component (create instance per component)
function UserCard({ userId }: { userId: string }) {
  // Create selector instance once
  const selectUserById = useMemo(makeSelectUserById, [])
  const user = useAppSelector((state) => selectUserById(state, userId))

  return <div>{user?.name}</div>
}

// Alternative: Selector with inline parameter
export const selectUserById = createSelector(
  [selectUsers, (_, userId: string) => userId],
  (users, userId) => users[userId]
)

// Usage (less optimal for multiple instances)
const user = useAppSelector((state) => selectUserById(state, userId))
```

### Pattern: Selector with Multiple Parameters

```typescript
interface FilterParams {
  status: 'all' | 'active' | 'completed'
  searchTerm: string
  sortBy: 'date' | 'name'
}

export const selectFilteredAndSortedTodos = createSelector(
  [
    selectTodos,
    (_, params: FilterParams) => params,
  ],
  (todos, { status, searchTerm, sortBy }) => {
    let result = todos

    // Filter by status
    if (status !== 'all') {
      result = result.filter((t) =>
        status === 'completed' ? t.completed : !t.completed
      )
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((t) => t.text.toLowerCase().includes(term))
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      return a.text.localeCompare(b.text)
    })

    return result
  }
)
```

### Pattern: Reselect with Increased Cache Size

```typescript
import { createSelectorCreator, lruMemoize } from '@reduxjs/toolkit'

// Create selector with larger cache
const createLruSelector = createSelectorCreator({
  memoize: lruMemoize,
  memoizeOptions: {
    maxSize: 10, // Cache up to 10 different argument combinations
  },
})

export const selectUserById = createLruSelector(
  [selectUsers, (_, userId: string) => userId],
  (users, userId) => users[userId]
)
```

### Pattern: Draft-Safe Selectors for Reducers

```typescript
import { createDraftSafeSelector } from '@reduxjs/toolkit'

// Safe to use inside createSlice reducers
const selectSelf = (state: TodosState) => state

export const selectCompletedCount = createDraftSafeSelector(
  [selectSelf],
  (state) => state.items.filter((t) => t.completed).length
)

// Usage in reducer
const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    logCompletedCount(state) {
      // Safe to use with Immer draft
      const count = selectCompletedCount(state)
      console.log(`Completed: ${count}`)
    },
  },
})
```

### Pattern: Structuring Selectors

```typescript
// selectors/users.selectors.ts
import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../store'

// Private base selectors
const selectUsersSlice = (state: RootState) => state.users
const selectUsersEntities = (state: RootState) => state.users.entities
const selectUsersIds = (state: RootState) => state.users.ids

// Public selectors
export const selectAllUsers = createSelector(
  [selectUsersEntities, selectUsersIds],
  (entities, ids) => ids.map((id) => entities[id]!)
)

export const selectUsersLoading = createSelector(
  [selectUsersSlice],
  (slice) => slice.loading
)

export const selectUsersError = createSelector(
  [selectUsersSlice],
  (slice) => slice.error
)

// Re-export factory functions
export { makeSelectUserById } from './users.factories'
```

### Anti-Patterns to Avoid

```typescript
// BAD: Creating new references in selector
const badSelector = createSelector(
  [selectTodos],
  (todos) => {
    // WRONG: Always creates new array even if filter matches all
    return todos.filter(() => true)
  }
)

// BAD: Selector with side effects
const sideEffectSelector = createSelector(
  [selectTodos],
  (todos) => {
    console.log('Todos:', todos) // WRONG: Side effect
    localStorage.setItem('todoCount', todos.length) // WRONG: Side effect
    return todos
  }
)

// BAD: Over-memoization
const overMemoized = createSelector(
  [selectTodos],
  (todos) => todos // WRONG: No transformation, just use selectTodos
)

// BAD: Creating selector inside component
function TodoList() {
  // WRONG: Creates new selector on every render
  const selectCompletedTodos = createSelector(
    [selectTodos],
    (todos) => todos.filter((t) => t.completed)
  )

  const completed = useAppSelector(selectCompletedTodos)
}

// BAD: Not using input selectors properly
const badInputSelector = createSelector(
  // WRONG: Accessing nested state inline
  [(state: RootState) => state.users.entities[state.auth.currentUserId!]],
  (user) => user
)
```

### When to Use Selectors

**Use When:**
- Deriving data from Redux state
- Transforming data for components
- Filtering or sorting collections
- Computing values from multiple state slices
- Need to prevent unnecessary re-renders

**Don't Use When:**
- Simple state access without transformation
- One-time data access (not in useSelector)
- Data that changes on every access (timestamps, random values)

---

## 6. Middleware Patterns

### Core Pattern: Listener Middleware Setup

```typescript
import {
  createListenerMiddleware,
  isAnyOf,
  TypedStartListening,
} from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from './store'

// Create middleware
export const listenerMiddleware = createListenerMiddleware()

// Create pre-typed startListening
export type AppStartListening = TypedStartListening<RootState, AppDispatch>
export const startAppListening =
  listenerMiddleware.startListening as AppStartListening

// Alternative: Using withTypes (RTK 2.0+)
export const startAppListening = listenerMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>()
```

### Pattern: Action Listener

```typescript
import { userLoggedIn, userLoggedOut } from './authSlice'

// Listen to specific action
startAppListening({
  actionCreator: userLoggedIn,
  effect: async (action, listenerApi) => {
    const { user } = action.payload

    // Access dispatch and getState
    const { dispatch, getState } = listenerApi

    // Perform side effects
    await analytics.identify(user.id)
    localStorage.setItem('lastLogin', new Date().toISOString())

    // Dispatch other actions
    dispatch(fetchUserPreferences(user.id))
  },
})

// Listen to multiple actions
startAppListening({
  matcher: isAnyOf(userLoggedIn, userLoggedOut),
  effect: async (action, listenerApi) => {
    if (userLoggedIn.match(action)) {
      console.log('User logged in:', action.payload.user.name)
    } else {
      console.log('User logged out')
    }
  },
})
```

### Pattern: State Change Listener

```typescript
startAppListening({
  predicate: (action, currentState, previousState) => {
    // Listen when cart total changes
    return currentState.cart.total !== previousState.cart.total
  },
  effect: async (action, listenerApi) => {
    const { cart } = listenerApi.getState()

    // Persist cart to server
    await api.updateCart(cart)
  },
})
```

### Pattern: Debounce / Take Latest

```typescript
startAppListening({
  actionCreator: searchQueryChanged,
  effect: async (action, listenerApi) => {
    // Cancel any in-progress instances of this listener
    listenerApi.cancelActiveListeners()

    // Debounce by 300ms
    await listenerApi.delay(300)

    // Perform search
    const results = await api.search(action.payload)
    listenerApi.dispatch(searchResultsReceived(results))
  },
})
```

### Pattern: Take Leading

```typescript
startAppListening({
  actionCreator: expensiveOperation,
  effect: async (action, listenerApi) => {
    // Unsubscribe to prevent new listeners
    listenerApi.unsubscribe()

    try {
      await performExpensiveOperation(action.payload)
    } finally {
      // Re-subscribe when done
      listenerApi.subscribe()
    }
  },
})
```

### Pattern: Conditional Waiting

```typescript
startAppListening({
  actionCreator: checkoutStarted,
  effect: async (action, listenerApi) => {
    const { condition, take } = listenerApi

    // Wait for cart to be validated
    const cartValidated = await condition(
      (action, currentState) => currentState.cart.validated,
      5000 // 5 second timeout
    )

    if (!cartValidated) {
      listenerApi.dispatch(checkoutFailed('Cart validation timed out'))
      return
    }

    // Wait for payment action
    const [paymentAction] = await take(paymentReceived.match, 30000)

    if (paymentAction) {
      listenerApi.dispatch(orderCompleted(paymentAction.payload))
    } else {
      listenerApi.dispatch(checkoutFailed('Payment timed out'))
    }
  },
})
```

### Pattern: Fork for Parallel Tasks

```typescript
startAppListening({
  actionCreator: appInitialized,
  effect: async (action, listenerApi) => {
    const { fork } = listenerApi

    // Fork parallel tasks
    const userTask = fork(async (forkApi) => {
      await forkApi.delay(100)
      const user = await api.getCurrentUser()
      return user
    })

    const settingsTask = fork(async (forkApi) => {
      const settings = await api.getSettings()
      return settings
    })

    // Wait for all tasks
    const [userResult, settingsResult] = await Promise.all([
      userTask.result,
      settingsTask.result,
    ])

    if (userResult.status === 'ok' && settingsResult.status === 'ok') {
      listenerApi.dispatch(
        initializationComplete({
          user: userResult.value,
          settings: settingsResult.value,
        })
      )
    }
  },
})
```

### Pattern: Polling with Cancellation

```typescript
startAppListening({
  actionCreator: startPolling,
  effect: async (action, listenerApi) => {
    const { fork, condition } = listenerApi
    const { interval, endpoint } = action.payload

    // Start polling in forked task
    const pollingTask = fork(async (forkApi) => {
      while (true) {
        const data = await api.fetch(endpoint)
        listenerApi.dispatch(pollingDataReceived(data))
        await forkApi.delay(interval)
      }
    })

    // Wait for stop action
    await condition(stopPolling.match)

    // Cancel polling
    pollingTask.cancel()
  },
})
```

### Pattern: Dynamic Listener in Component

```typescript
import { addListener, removeListener } from '@reduxjs/toolkit'

function NotificationListener() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        actionCreator: notificationReceived,
        effect: (action) => {
          // Show toast notification
          toast.show(action.payload.message)
        },
      })
    )

    return () => unsubscribe()
  }, [dispatch])

  return null
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Listener with no cleanup for long-running effects
startAppListening({
  actionCreator: startBackgroundTask,
  effect: async (action, listenerApi) => {
    // WRONG: No way to cancel this
    while (true) {
      await doWork()
      await sleep(1000)
    }
  },
})

// GOOD: Use fork with cancellation
startAppListening({
  actionCreator: startBackgroundTask,
  effect: async (action, listenerApi) => {
    const task = listenerApi.fork(async (forkApi) => {
      while (true) {
        await doWork()
        await forkApi.delay(1000)
      }
    })

    await listenerApi.condition(stopBackgroundTask.match)
    task.cancel()
  },
})

// BAD: Modifying state directly in listener
startAppListening({
  actionCreator: someAction,
  effect: async (action, listenerApi) => {
    // WRONG: Direct state mutation
    const state = listenerApi.getState()
    state.someValue = 'new value'
  },
})

// BAD: Not handling errors in async effects
startAppListening({
  actionCreator: fetchData,
  effect: async (action, listenerApi) => {
    // WRONG: Unhandled promise rejection
    const data = await api.fetch()
    listenerApi.dispatch(dataReceived(data))
  },
})

// GOOD: Handle errors
startAppListening({
  actionCreator: fetchData,
  effect: async (action, listenerApi) => {
    try {
      const data = await api.fetch()
      listenerApi.dispatch(dataReceived(data))
    } catch (error) {
      listenerApi.dispatch(fetchFailed(error.message))
    }
  },
})
```

### When to Use Listener Middleware

**Use When:**
- Need to respond to dispatched actions with side effects
- Complex async workflows (debounce, throttle, polling)
- Cross-slice logic that depends on multiple state changes
- Migrating from Redux Saga/Observable
- Analytics tracking, logging, persistence

**Don't Use When:**
- Simple data fetching (use RTK Query)
- Logic that belongs in a thunk
- Synchronous state updates (use reducers)
- Component-local side effects (use useEffect)

---

## 7. Store Setup Patterns

### Core Pattern: Basic Store Setup

```typescript
import { configureStore } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listenerMiddleware'
import counterReducer from '../features/counter/counterSlice'
import usersReducer from '../features/users/usersSlice'
import { apiSlice } from '../features/api/apiSlice'

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    users: usersReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(listenerMiddleware.middleware)
      .concat(apiSlice.middleware),
})

// Infer types from store
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

### Pattern: Store Factory for Testing

```typescript
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { PreloadedState } from '@reduxjs/toolkit'

// Create root reducer separately for type inference
const rootReducer = combineReducers({
  counter: counterReducer,
  users: usersReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

// Store factory for testing with preloaded state
export function setupStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof setupStore>
export type AppDispatch = AppStore['dispatch']

// Default store for production
export const store = setupStore()
```

### Pattern: Store with Extra Argument

```typescript
interface ExtraArgument {
  api: ApiClient
  analytics: AnalyticsService
}

const extraArgument: ExtraArgument = {
  api: new ApiClient(),
  analytics: new AnalyticsService(),
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: {
        extraArgument,
      },
    }),
})

// Access in thunks
export const fetchUser = createAsyncThunk(
  'users/fetch',
  async (userId: string, { extra }) => {
    const { api } = extra as ExtraArgument
    return api.getUser(userId)
  }
)
```

### Pattern: Development vs Production Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development'

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    const middleware = getDefaultMiddleware({
      // Disable expensive checks in production
      serializableCheck: isDevelopment,
      immutableCheck: isDevelopment,
    }).concat(apiSlice.middleware)

    if (isDevelopment) {
      // Add development-only middleware
      const { createLogger } = require('redux-logger')
      return middleware.concat(createLogger({ collapsed: true }))
    }

    return middleware
  },
  devTools: isDevelopment,
})
```

### Pattern: Persisted State with Redux Persist

```typescript
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth', 'settings'], // Only persist these reducers
}

const rootReducer = combineReducers({
  auth: authReducer,
  settings: settingsReducer,
  users: usersReducer, // Not persisted
  [apiSlice.reducerPath]: apiSlice.reducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
})

export const persistor = persistStore(store)
```

### Pattern: Code Splitting with Reducer Injection

```typescript
import { configureStore } from '@reduxjs/toolkit'

// Create store with static reducers
const staticReducers = {
  core: coreReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
}

export const store = configureStore({
  reducer: staticReducers,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
})

// Type for async reducers
type AsyncReducers = Record<string, Reducer>
const asyncReducers: AsyncReducers = {}

// Inject reducer dynamically
export function injectReducer(key: string, reducer: Reducer) {
  if (asyncReducers[key]) {
    return // Already injected
  }

  asyncReducers[key] = reducer
  store.replaceReducer(
    combineReducers({
      ...staticReducers,
      ...asyncReducers,
    })
  )
}

// Usage in lazy-loaded module
// features/dashboard/index.ts
import { injectReducer } from '../../store'
import dashboardReducer from './dashboardSlice'

injectReducer('dashboard', dashboardReducer)
export { DashboardPage } from './DashboardPage'
```

### Pattern: Store with RTK Query API

```typescript
import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { apiSlice } from './api/apiSlice'

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    // other reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
})

// Enable refetchOnFocus and refetchOnReconnect
setupListeners(store.dispatch)
```

### Anti-Patterns to Avoid

```typescript
// BAD: Multiple store instances
const store1 = configureStore({ reducer: rootReducer })
const store2 = configureStore({ reducer: rootReducer }) // WRONG

// BAD: Modifying store after creation
store.reducer = newReducer // WRONG: Use replaceReducer instead

// BAD: Using spread for middleware (loses type safety)
middleware: (getDefaultMiddleware) => [
  ...getDefaultMiddleware(), // WRONG: Loses Tuple type
  customMiddleware,
]

// GOOD: Use concat
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware().concat(customMiddleware)

// BAD: Disabling checks without reason
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: false, // WRONG: Hiding bugs
    immutableCheck: false,
  })

// BAD: Not adding RTK Query middleware
const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  // WRONG: Missing apiSlice.middleware
})
```

### When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| Basic Setup | Small to medium apps, getting started |
| Store Factory | Testing, multiple store instances needed |
| Extra Argument | Dependency injection for thunks |
| Dev/Prod Config | All production apps |
| Redux Persist | Offline support, state hydration |
| Reducer Injection | Large apps with code splitting |

---

## 8. TypeScript Integration

### Core Pattern: Typed Hooks

```typescript
// store/hooks.ts
import { useDispatch, useSelector, useStore } from 'react-redux'
import type { RootState, AppDispatch, AppStore } from './store'

// Pre-typed hooks (React-Redux 9.1.0+)
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()

// Legacy approach (still works)
import type { TypedUseSelectorHook } from 'react-redux'
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

### Pattern: Typed Slice State

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Define state interface
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

// Define initial state with type
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
}

// Alternative: satisfies pattern for inference
const initialState = {
  user: null as User | null,
  token: null as string | null,
  isAuthenticated: false,
  loading: false,
  error: null as string | null,
} satisfies AuthState

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Payload type via PayloadAction
    loginSuccess(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
    },
    // No payload
    logout(state) {
      return initialState
    },
    // Optional payload
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})
```

### Pattern: Typed Thunks

```typescript
import { createAsyncThunk, AsyncThunk } from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from './store'

// Pre-typed thunk creator
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
}>()

// Typed thunk with all generics
interface FetchUserArgs {
  userId: string
  includeProfile?: boolean
}

interface FetchUserResponse {
  user: User
  profile?: UserProfile
}

export const fetchUser = createAppAsyncThunk<FetchUserResponse, FetchUserArgs>(
  'users/fetch',
  async ({ userId, includeProfile }, { getState, rejectWithValue }) => {
    // getState() is correctly typed as RootState
    const { auth } = getState()

    try {
      const user = await api.getUser(userId, auth.token)
      const profile = includeProfile ? await api.getProfile(userId) : undefined
      return { user, profile }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)
```

### Pattern: Typed Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './store'

// Simple typed selector
export const selectCurrentUser = (state: RootState) => state.auth.user

// Memoized selector with explicit return type
export const selectIsAdmin = createSelector(
  [selectCurrentUser],
  (user): boolean => user?.role === 'admin'
)

// Parameterized selector with factory
export const makeSelectUserById = () =>
  createSelector(
    [(state: RootState) => state.users.entities, (_, userId: string) => userId],
    (entities, userId): User | undefined => entities[userId]
  )

// Selector with multiple parameters
interface FilterOptions {
  status: 'all' | 'active' | 'completed'
  searchTerm: string
}

export const selectFilteredTodos = createSelector(
  [
    (state: RootState) => state.todos.items,
    (_, options: FilterOptions) => options,
  ],
  (todos, { status, searchTerm }): Todo[] => {
    return todos
      .filter((todo) => {
        if (status === 'active') return !todo.completed
        if (status === 'completed') return todo.completed
        return true
      })
      .filter((todo) =>
        todo.text.toLowerCase().includes(searchTerm.toLowerCase())
      )
  }
)
```

### Pattern: Typed Listener Middleware

```typescript
import {
  createListenerMiddleware,
  TypedStartListening,
  TypedAddListener,
  ListenerEffectAPI,
} from '@reduxjs/toolkit'
import type { RootState, AppDispatch } from './store'

export const listenerMiddleware = createListenerMiddleware()

// Pre-typed listener methods
export type AppStartListening = TypedStartListening<RootState, AppDispatch>
export type AppAddListener = TypedAddListener<RootState, AppDispatch>

export const startAppListening =
  listenerMiddleware.startListening as AppStartListening

// Type for effect callback
export type AppListenerEffectAPI = ListenerEffectAPI<RootState, AppDispatch>

// Usage with full typing
startAppListening({
  actionCreator: someAction,
  effect: async (action, listenerApi: AppListenerEffectAPI) => {
    const state = listenerApi.getState() // RootState
    listenerApi.dispatch(anotherAction()) // Typed dispatch
  },
})
```

### Pattern: Typed RTK Query

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

interface User {
  id: number
  name: string
  email: string
}

interface CreateUserRequest {
  name: string
  email: string
}

interface ApiError {
  status: number
  message: string
}

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: (build) => ({
    // Query: <ReturnType, ArgType>
    getUsers: build.query<User[], void>({
      query: () => 'users',
    }),

    getUser: build.query<User, number>({
      query: (id) => `users/${id}`,
    }),

    // Mutation: <ReturnType, ArgType>
    createUser: build.mutation<User, CreateUserRequest>({
      query: (body) => ({
        url: 'users',
        method: 'POST',
        body,
      }),
    }),

    // With transform
    getUserWithTransform: build.query<User, number>({
      query: (id) => `users/${id}`,
      transformResponse: (response: { data: User }) => response.data,
      transformErrorResponse: (response): ApiError => ({
        status: typeof response.status === 'number' ? response.status : 500,
        message: 'Failed to fetch user',
      }),
    }),
  }),
})

// Hooks are automatically typed
export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
} = usersApi
```

### Pattern: Type-Safe Action Matching

```typescript
import { isAnyOf, isAllOf, isFulfilled, isRejected } from '@reduxjs/toolkit'

// Match multiple actions
const isAuthAction = isAnyOf(login, logout, refreshToken)

// Match fulfilled async thunks
const isFetchFulfilled = isFulfilled(fetchUsers, fetchPosts)

// Type guard in reducer
extraReducers: (builder) => {
  builder
    .addMatcher(isFulfilled(fetchUsers), (state, action) => {
      // action.payload is typed as User[]
      state.users = action.payload
    })
    .addMatcher(isRejected(fetchUsers), (state, action) => {
      // action.error is typed
      state.error = action.error.message ?? 'Unknown error'
    })
}

// Type guard in listener
startAppListening({
  matcher: isAnyOf(login.fulfilled, signup.fulfilled),
  effect: async (action, listenerApi) => {
    // action is union of both action types
    if (login.fulfilled.match(action)) {
      // Narrowed to login action
      console.log('Login:', action.payload.user)
    }
  },
})
```

### Anti-Patterns to Avoid

```typescript
// BAD: Using any
const badSelector = (state: any) => state.users // WRONG

// BAD: Type assertions instead of proper typing
const user = action.payload as User // WRONG: Use PayloadAction<User>

// BAD: Not typing async thunk generics
const badThunk = createAsyncThunk(
  'bad/thunk',
  async (arg) => { // arg is unknown
    return data // return type is unknown
  }
)

// BAD: Ignoring type errors
// @ts-ignore
state.value = action.payload // WRONG

// BAD: Not using pre-typed hooks
import { useDispatch } from 'react-redux'
const dispatch = useDispatch() // Not typed for your store

// GOOD: Use typed hooks
const dispatch = useAppDispatch() // Correctly typed
```

### TypeScript Configuration

```json
// tsconfig.json recommended settings for Redux
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## 9. Normalized State Patterns

### Core Pattern: Manual Normalization

```typescript
// Types
interface User {
  id: string
  name: string
  email: string
  postIds: string[]
}

interface Post {
  id: string
  title: string
  content: string
  authorId: string
  commentIds: string[]
}

interface Comment {
  id: string
  text: string
  authorId: string
  postId: string
}

// Normalized state structure
interface NormalizedState {
  users: {
    byId: Record<string, User>
    allIds: string[]
  }
  posts: {
    byId: Record<string, Post>
    allIds: string[]
  }
  comments: {
    byId: Record<string, Comment>
    allIds: string[]
  }
}

// Normalization function
function normalizeApiResponse(response: ApiResponse): NormalizedState {
  const normalized: NormalizedState = {
    users: { byId: {}, allIds: [] },
    posts: { byId: {}, allIds: [] },
    comments: { byId: {}, allIds: [] },
  }

  response.users.forEach((user) => {
    normalized.users.byId[user.id] = {
      ...user,
      postIds: user.posts.map((p) => p.id),
    }
    normalized.users.allIds.push(user.id)

    user.posts.forEach((post) => {
      normalized.posts.byId[post.id] = {
        ...post,
        authorId: user.id,
        commentIds: post.comments.map((c) => c.id),
      }
      normalized.posts.allIds.push(post.id)

      post.comments.forEach((comment) => {
        normalized.comments.byId[comment.id] = {
          ...comment,
          postId: post.id,
        }
        normalized.comments.allIds.push(comment.id)
      })
    })
  })

  return normalized
}
```

### Pattern: Using normalizr Library

```typescript
import { normalize, schema } from 'normalizr'

// Define schemas
const commentSchema = new schema.Entity('comments')
const postSchema = new schema.Entity('posts', {
  comments: [commentSchema],
})
const userSchema = new schema.Entity('users', {
  posts: [postSchema],
})

// API response type
interface ApiUser {
  id: string
  name: string
  posts: {
    id: string
    title: string
    comments: { id: string; text: string }[]
  }[]
}

// Normalize API response
function normalizeUsers(users: ApiUser[]) {
  const normalized = normalize(users, [userSchema])

  return {
    entities: normalized.entities,
    result: normalized.result,
  }
}

// Result shape:
// {
//   entities: {
//     users: { '1': { id: '1', name: 'John', posts: ['p1', 'p2'] } },
//     posts: { 'p1': { id: 'p1', title: '...', comments: ['c1'] } },
//     comments: { 'c1': { id: 'c1', text: '...' } }
//   },
//   result: ['1']
// }
```

### Pattern: Entity Adapter for Each Entity Type

```typescript
import { createSlice, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit'

// Adapters for each entity type
const usersAdapter = createEntityAdapter<User>()
const postsAdapter = createEntityAdapter<Post>()
const commentsAdapter = createEntityAdapter<Comment>()

// Combined state
interface EntitiesState {
  users: ReturnType<typeof usersAdapter.getInitialState>
  posts: ReturnType<typeof postsAdapter.getInitialState>
  comments: ReturnType<typeof commentsAdapter.getInitialState>
}

const initialState: EntitiesState = {
  users: usersAdapter.getInitialState(),
  posts: postsAdapter.getInitialState(),
  comments: commentsAdapter.getInitialState(),
}

const entitiesSlice = createSlice({
  name: 'entities',
  initialState,
  reducers: {
    // Batch upsert from normalized data
    entitiesReceived(
      state,
      action: PayloadAction<{
        users?: User[]
        posts?: Post[]
        comments?: Comment[]
      }>
    ) {
      const { users, posts, comments } = action.payload
      if (users) usersAdapter.upsertMany(state.users, users)
      if (posts) postsAdapter.upsertMany(state.posts, posts)
      if (comments) commentsAdapter.upsertMany(state.comments, comments)
    },
  },
})

// Selectors
const usersSelectors = usersAdapter.getSelectors<RootState>(
  (state) => state.entities.users
)
const postsSelectors = postsAdapter.getSelectors<RootState>(
  (state) => state.entities.posts
)
```

### Pattern: Denormalization Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit'

// Denormalize post with author and comments
export const selectPostWithRelations = createSelector(
  [
    (state: RootState) => state.entities.posts.entities,
    (state: RootState) => state.entities.users.entities,
    (state: RootState) => state.entities.comments.entities,
    (_, postId: string) => postId,
  ],
  (posts, users, comments, postId) => {
    const post = posts[postId]
    if (!post) return null

    return {
      ...post,
      author: users[post.authorId],
      comments: post.commentIds
        .map((id) => comments[id])
        .filter((c): c is Comment => c !== undefined)
        .map((comment) => ({
          ...comment,
          author: users[comment.authorId],
        })),
    }
  }
)

// Select all posts by user with full data
export const selectUserPosts = createSelector(
  [
    (state: RootState) => state.entities.posts.ids,
    (state: RootState) => state.entities.posts.entities,
    (_, userId: string) => userId,
  ],
  (postIds, postEntities, userId) =>
    postIds
      .map((id) => postEntities[id])
      .filter((post): post is Post => post !== undefined && post.authorId === userId)
)
```

### Pattern: Handling Many-to-Many Relationships

```typescript
// Join table for tags and posts
interface PostTag {
  postId: string
  tagId: string
}

interface Tag {
  id: string
  name: string
}

// State with join table
const postTagsAdapter = createEntityAdapter<PostTag>({
  selectId: (postTag) => `${postTag.postId}-${postTag.tagId}`,
})

// Selector for post's tags
export const selectPostTags = createSelector(
  [
    (state: RootState) => Object.values(state.entities.postTags.entities),
    (state: RootState) => state.entities.tags.entities,
    (_, postId: string) => postId,
  ],
  (postTags, tags, postId) =>
    postTags
      .filter((pt): pt is PostTag => pt !== undefined && pt.postId === postId)
      .map((pt) => tags[pt.tagId])
      .filter((tag): tag is Tag => tag !== undefined)
)
```

### Anti-Patterns to Avoid

```typescript
// BAD: Storing duplicate data
interface BadState {
  currentUser: User
  users: User[] // currentUser duplicated here
  posts: Post[]
  postsByUser: Record<string, Post[]> // Duplicated from posts
}

// BAD: Deeply nested state
interface BadNestedState {
  users: {
    id: string
    posts: {
      id: string
      comments: {
        id: string
        author: User // Embedded, not referenced
      }[]
    }[]
  }[]
}

// BAD: Array-based lookups
const findUser = (state: BadState, userId: string) =>
  state.users.find((u) => u.id === userId) // O(n)

// GOOD: Object-based lookups
const findUser = (state: GoodState, userId: string) =>
  state.users.entities[userId] // O(1)

// BAD: Updating nested data requires complex spread
const updateComment = (state: BadNestedState, commentId: string, text: string) => ({
  ...state,
  users: state.users.map((user) => ({
    ...user,
    posts: user.posts.map((post) => ({
      ...post,
      comments: post.comments.map((comment) =>
        comment.id === commentId ? { ...comment, text } : comment
      ),
    })),
  })),
})
```

### When to Normalize

**Normalize When:**
- Data has IDs and relationships
- Same data referenced in multiple places
- Need efficient updates without deep cloning
- Working with large collections (100+ items)
- Data fetched from relational database

**Don't Normalize When:**
- Simple, flat data structures
- Data is only used in one place
- Small collections (< 20 items)
- Frequently accessed as a complete tree
- Read-only data that's never updated

---

## 10. Testing Redux Logic

### Core Pattern: Integration Test Setup

```typescript
// test-utils.tsx
import React, { PropsWithChildren } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { setupStore, RootState, AppStore } from '../store'
import type { PreloadedState } from '@reduxjs/toolkit'

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>
  store?: AppStore
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren): JSX.Element {
    return <Provider store={store}>{children}</Provider>
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}

export * from '@testing-library/react'
export { renderWithProviders }
```

### Pattern: Component Integration Tests

```typescript
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { UserProfile } from './UserProfile'

// MSW handlers
const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'John Doe',
      email: 'john@example.com',
    })
  }),
]

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('UserProfile', () => {
  it('displays user data after fetching', async () => {
    renderWithProviders(<UserProfile userId="1" />)

    // Initial loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Wait for data
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('handles error state', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ message: 'Not found' }, { status: 404 })
      })
    )

    renderWithProviders(<UserProfile userId="999" />)

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

### Pattern: Testing with Preloaded State

```typescript
describe('TodoList', () => {
  it('renders todos from preloaded state', () => {
    const preloadedState = {
      todos: {
        items: [
          { id: '1', text: 'Learn Redux', completed: false },
          { id: '2', text: 'Build app', completed: true },
        ],
        filter: 'all',
      },
    }

    renderWithProviders(<TodoList />, { preloadedState })

    expect(screen.getByText('Learn Redux')).toBeInTheDocument()
    expect(screen.getByText('Build app')).toBeInTheDocument()
  })

  it('filters completed todos', () => {
    const preloadedState = {
      todos: {
        items: [
          { id: '1', text: 'Learn Redux', completed: false },
          { id: '2', text: 'Build app', completed: true },
        ],
        filter: 'completed',
      },
    }

    renderWithProviders(<TodoList />, { preloadedState })

    expect(screen.queryByText('Learn Redux')).not.toBeInTheDocument()
    expect(screen.getByText('Build app')).toBeInTheDocument()
  })
})
```

### Pattern: Unit Testing Reducers

```typescript
import reducer, { todoAdded, todoToggled, todosCleared } from './todosSlice'

describe('todosSlice reducer', () => {
  const initialState = {
    items: [],
    filter: 'all' as const,
  }

  it('should return initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  it('should handle todoAdded', () => {
    const actual = reducer(initialState, todoAdded('New todo'))

    expect(actual.items).toHaveLength(1)
    expect(actual.items[0].text).toBe('New todo')
    expect(actual.items[0].completed).toBe(false)
    expect(actual.items[0].id).toBeDefined()
  })

  it('should handle todoToggled', () => {
    const stateWithTodo = {
      ...initialState,
      items: [{ id: '1', text: 'Test', completed: false }],
    }

    const actual = reducer(stateWithTodo, todoToggled('1'))

    expect(actual.items[0].completed).toBe(true)
  })

  it('should handle todosCleared', () => {
    const stateWithTodos = {
      ...initialState,
      items: [
        { id: '1', text: 'Test 1', completed: false },
        { id: '2', text: 'Test 2', completed: true },
      ],
    }

    const actual = reducer(stateWithTodos, todosCleared())

    expect(actual.items).toHaveLength(0)
  })
})
```

### Pattern: Testing Selectors

```typescript
import {
  selectAllTodos,
  selectCompletedTodos,
  selectTodoById,
} from './todosSelectors'

describe('todos selectors', () => {
  const state = {
    todos: {
      items: [
        { id: '1', text: 'Todo 1', completed: false },
        { id: '2', text: 'Todo 2', completed: true },
        { id: '3', text: 'Todo 3', completed: true },
      ],
      filter: 'all',
    },
  } as RootState

  it('selectAllTodos returns all todos', () => {
    const result = selectAllTodos(state)
    expect(result).toHaveLength(3)
  })

  it('selectCompletedTodos returns only completed', () => {
    const result = selectCompletedTodos(state)
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.completed)).toBe(true)
  })

  it('selectTodoById returns correct todo', () => {
    const result = selectTodoById(state, '2')
    expect(result?.text).toBe('Todo 2')
  })

  it('selectTodoById returns undefined for invalid id', () => {
    const result = selectTodoById(state, 'invalid')
    expect(result).toBeUndefined()
  })

  // Test memoization
  it('selectCompletedTodos is memoized', () => {
    const result1 = selectCompletedTodos(state)
    const result2 = selectCompletedTodos(state)
    expect(result1).toBe(result2) // Same reference
  })
})
```

### Pattern: Testing Async Thunks

```typescript
import { setupStore } from '../store'
import { fetchUsers, selectAllUsers, selectUsersLoading } from './usersSlice'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' },
    ])
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchUsers thunk', () => {
  it('fetches and stores users', async () => {
    const store = setupStore()

    // Check initial state
    expect(selectAllUsers(store.getState())).toHaveLength(0)

    // Dispatch thunk
    await store.dispatch(fetchUsers())

    // Check final state
    const users = selectAllUsers(store.getState())
    expect(users).toHaveLength(2)
    expect(users[0].name).toBe('John')
  })

  it('handles loading state', async () => {
    const store = setupStore()

    // Start fetch
    const promise = store.dispatch(fetchUsers())

    // Check loading state
    expect(selectUsersLoading(store.getState())).toBe(true)

    // Wait for completion
    await promise

    // Check loading complete
    expect(selectUsersLoading(store.getState())).toBe(false)
  })

  it('handles errors', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json({ message: 'Server error' }, { status: 500 })
      })
    )

    const store = setupStore()
    const result = await store.dispatch(fetchUsers())

    expect(fetchUsers.rejected.match(result)).toBe(true)
    expect(store.getState().users.error).toBeDefined()
  })
})
```

### Pattern: Testing RTK Query

```typescript
import { renderWithProviders, screen, waitFor } from './test-utils'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { UserList } from './UserList'

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ])
  })
)

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  // Clear RTK Query cache between tests
})
afterAll(() => server.close())

describe('UserList with RTK Query', () => {
  it('fetches and displays users', async () => {
    renderWithProviders(<UserList />)

    // Loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Wait for data
    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument()
      expect(screen.getByText('Jane')).toBeInTheDocument()
    })
  })

  it('displays error state', async () => {
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(null, { status: 500 })
      })
    )

    renderWithProviders(<UserList />)

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

### Pattern: Testing Listener Middleware

```typescript
import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { userLoggedIn, fetchUserPreferences } from './authSlice'

describe('auth listener middleware', () => {
  it('fetches preferences after login', async () => {
    const listenerMiddleware = createListenerMiddleware()
    const fetchPreferencesMock = vi.fn()

    listenerMiddleware.startListening({
      actionCreator: userLoggedIn,
      effect: async (action, listenerApi) => {
        fetchPreferencesMock(action.payload.user.id)
      },
    })

    const store = configureStore({
      reducer: { auth: authReducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().prepend(listenerMiddleware.middleware),
    })

    store.dispatch(userLoggedIn({ user: { id: '1', name: 'John' } }))

    // Allow async effect to run
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchPreferencesMock).toHaveBeenCalledWith('1')
  })
})
```

### Anti-Patterns to Avoid

```typescript
// BAD: Mocking Redux internals
vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
  useDispatch: vi.fn(),
}))

// BAD: Testing implementation details
it('dispatches INCREMENT action', () => {
  const dispatch = vi.fn()
  // Testing that specific actions are dispatched
})

// BAD: Not using MSW, mocking fetch directly
global.fetch = vi.fn(() =>
  Promise.resolve({ json: () => Promise.resolve(data) })
)

// BAD: Sharing store between tests
const store = setupStore()

describe('tests', () => {
  it('test 1', () => {
    store.dispatch(action1()) // Pollutes state
  })

  it('test 2', () => {
    // State from test 1 affects this test
  })
})

// GOOD: Create fresh store per test
describe('tests', () => {
  it('test 1', () => {
    const store = setupStore()
    store.dispatch(action1())
  })

  it('test 2', () => {
    const store = setupStore() // Fresh state
  })
})
```

### Testing Best Practices Summary

| Test Type | When to Use | Tools |
|-----------|-------------|-------|
| Integration | Default choice for components | RTL, MSW, real store |
| Unit (Reducers) | Complex reducer logic | Vitest/Jest |
| Unit (Selectors) | Complex derived data | Vitest/Jest |
| Thunk | Legacy async logic | Real store + MSW |
| RTK Query | Data fetching components | RTL + MSW |
| Listener | Side effect logic | Real middleware + mocks |

---

## Summary: When to Use Each Pattern

| Pattern | Primary Use Case | Alternative |
|---------|------------------|-------------|
| createSlice | Feature state management | useState for local state |
| RTK Query | Data fetching & caching | createAsyncThunk for legacy |
| createAsyncThunk | Complex async with state access | RTK Query for simple fetching |
| Entity Adapter | Collections with CRUD | Manual normalization |
| createSelector | Derived/computed state | Direct state access if simple |
| Listener Middleware | Side effects, cross-slice logic | Thunks for simple cases |
| Normalized State | Relational data, large collections | Flat state for simple data |

---

## Sources

- [Redux Toolkit Official Documentation](https://redux-toolkit.js.org/)
- [Redux Style Guide](https://redux.js.org/style-guide)
- [RTK Query Documentation](https://redux-toolkit.js.org/rtk-query/overview)
- [Usage With TypeScript](https://redux-toolkit.js.org/usage/usage-with-typescript)
- [Writing Tests | Redux](https://redux.js.org/usage/writing-tests)
- [createListenerMiddleware](https://redux-toolkit.js.org/api/createListenerMiddleware)
- [createEntityAdapter](https://redux-toolkit.js.org/api/createEntityAdapter)
- [Normalizing State Shape](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape)
- [Deriving Data with Selectors](https://redux.js.org/usage/deriving-data-selectors)
- [Redux Toolkit Best Practices 2025](https://medium.com/@mernstackdevbykevin/redux-toolkit-best-practices-in-2025-the-complete-developers-guide-74de800bfa37)
- [Modern Redux Debugging 2024-2025](https://trackjs.com/blog/common-redux-bugs/)
