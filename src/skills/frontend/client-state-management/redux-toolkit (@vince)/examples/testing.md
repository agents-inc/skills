# Redux Toolkit - Testing Examples

Testing patterns for Redux slices, reducers, and async thunks.

**Prerequisites:** Understand [core.md](core.md) (Slice Creation) and [entity-adapters.md](entity-adapters.md) first.

---

## Pattern: Testing Redux Logic

### Testing Slice Reducers

```typescript
// store/slices/todos-slice.test.ts
import { describe, it, expect } from "vitest";
import {
  todosReducer,
  addTodo,
  toggleTodo,
  removeTodo,
  setFilter,
} from "./todos-slice";

const INITIAL_STATE = {
  items: [],
  filter: "all" as const,
};

const MOCK_TODO = {
  title: "Test Todo",
  priority: 5,
};

describe("todosSlice", () => {
  it("should return initial state", () => {
    expect(todosReducer(undefined, { type: "unknown" })).toEqual(INITIAL_STATE);
  });

  it("should add a todo", () => {
    const state = todosReducer(INITIAL_STATE, addTodo(MOCK_TODO));
    expect(state.items).toHaveLength(1);
    expect(state.items[0].title).toBe(MOCK_TODO.title);
    expect(state.items[0].completed).toBe(false);
  });

  it("should toggle a todo", () => {
    const stateWithTodo = todosReducer(INITIAL_STATE, addTodo(MOCK_TODO));
    const todoId = stateWithTodo.items[0].id;

    const toggledState = todosReducer(stateWithTodo, toggleTodo(todoId));
    expect(toggledState.items[0].completed).toBe(true);

    const toggledAgain = todosReducer(toggledState, toggleTodo(todoId));
    expect(toggledAgain.items[0].completed).toBe(false);
  });

  it("should remove a todo", () => {
    const stateWithTodo = todosReducer(INITIAL_STATE, addTodo(MOCK_TODO));
    const todoId = stateWithTodo.items[0].id;

    const removedState = todosReducer(stateWithTodo, removeTodo(todoId));
    expect(removedState.items).toHaveLength(0);
  });

  it("should set filter", () => {
    const state = todosReducer(INITIAL_STATE, setFilter("active"));
    expect(state.filter).toBe("active");
  });
});
```

**Why good:** Tests reducer in isolation, named constants for test data, tests all reducer actions, verifies immutability by checking new state

---

### Testing Async Thunks

```typescript
// store/slices/users-slice.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { fetchUsers, usersReducer } from "./users-slice";

const MOCK_USERS = [
  { id: "1", name: "Alice", email: "alice@test.com", role: "admin" as const },
  { id: "2", name: "Bob", email: "bob@test.com", role: "user" as const },
];

describe("users async thunks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should fetch users successfully", async () => {
    // Mock fetch at network level
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_USERS),
    });

    const store = configureStore({
      reducer: { users: usersReducer },
    });

    await store.dispatch(fetchUsers());

    const state = store.getState().users;
    expect(state.status).toBe("succeeded");
    expect(state.ids).toHaveLength(2);
    expect(state.entities["1"].name).toBe("Alice");
  });

  it("should handle fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const store = configureStore({
      reducer: { users: usersReducer },
    });

    await store.dispatch(fetchUsers());

    const state = store.getState().users;
    expect(state.status).toBe("failed");
    expect(state.error).toBeTruthy();
  });
});
```

**Why good:** Mock at network level not thunk level, test full store integration, named constants for mock data, tests both success and error paths

---

### Testing Selectors

```typescript
// store/selectors/todos-selectors.test.ts
import { describe, it, expect } from "vitest";
import { selectFilteredTodos, selectTodoStats } from "./todos-selectors";

const MOCK_STATE = {
  todos: {
    items: [
      { id: "1", title: "Active todo", completed: false, priority: 9 },
      { id: "2", title: "Completed todo", completed: true, priority: 3 },
      { id: "3", title: "Another active", completed: false, priority: 6 },
    ],
    filter: "all" as const,
  },
};

describe("todos selectors", () => {
  it("should select all todos when filter is all", () => {
    const result = selectFilteredTodos(MOCK_STATE);
    expect(result).toHaveLength(3);
  });

  it("should select only active todos when filter is active", () => {
    const stateWithActiveFilter = {
      ...MOCK_STATE,
      todos: { ...MOCK_STATE.todos, filter: "active" as const },
    };
    const result = selectFilteredTodos(stateWithActiveFilter);
    expect(result).toHaveLength(2);
    expect(result.every((t) => !t.completed)).toBe(true);
  });

  it("should compute correct stats", () => {
    const stats = selectTodoStats(MOCK_STATE);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.highPriority).toBe(1);
    expect(stats.mediumPriority).toBe(1);
  });
});
```

**Why good:** Tests selector logic with mock state, verifies memoization behavior, named constants for test data

---
