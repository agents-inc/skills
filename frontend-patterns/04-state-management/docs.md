# 04. State Management

> **Quick Guide:** Data from API? Use React Query (§4.2). UI state? Use Zustand (§4.3). Multiple Zustand values? Use `shallow` (§4.3)!

## 4.1 Server State vs Client State

**STRICT SEPARATION REQUIRED:**

**Server State = React Query (or similar)**

- Data from APIs
- Database records
- Remote data of any kind
- User profiles, posts, comments, etc.

**Client State = Zustand/Context (or similar)**

- UI state (modals, dropdowns, selected items)
- Form input values (before submission)
- Filter selections
- Theme preferences
- Local-only data

**CRITICAL RED FLAG:**

- ❌ **NEVER store server data in Zustand/Context**
- ❌ **NEVER store UI state in React Query**
- ❌ Duplicating server data in client state
- ❌ Syncing server data manually to client state

> See [examples.md](./examples.md#41-server-state-vs-client-state) for good vs bad examples

## 4.2 React Query Patterns

> See [examples.md](./examples.md#42-react-query-patterns) for query key factory examples

**Patterns to extract:**

- Query key structure (generic → specific)
- Custom hooks wrapping useQuery/useMutation
- Error handling strategies
- Retry configuration
- Cache time and stale time defaults
- Optimistic updates
- Loading and error state management
- Query client configuration
- Prefetching strategies
- Infinite queries

**RED FLAGS:**

- ❌ Inconsistent query key structure
- ❌ String-only query keys (should be arrays)
- ❌ Missing error handling
- ❌ No loading states
- ❌ Stale data not being refetched

## 4.3 Zustand Patterns

**Critical Pattern: shallow comparison for multiple selections**

> See [examples.md](./examples.md#43-zustand-patterns) for shallow comparison examples

**Other patterns:**

- Store structure (slices vs monolithic)
- Action naming conventions
- Middleware usage (persist, devtools)
- Derived state (selectors)
- Store testing patterns

**RED FLAGS:**

- ❌ **Not using `shallow` when selecting multiple pieces of state**
- ❌ Stores that are too large (>200 lines)
- ❌ Actions that mutate state directly
- ❌ Server data in Zustand stores

## 4.4 Context API Usage

- When to use Context vs Zustand
- Context + useReducer patterns
- Performance considerations
- Provider composition

## 4.5 Cache Invalidation

- Invalidation strategies after mutations
- Prefix matching patterns
- Optimistic updates
- Refetch on window focus
- Background refetch strategies
