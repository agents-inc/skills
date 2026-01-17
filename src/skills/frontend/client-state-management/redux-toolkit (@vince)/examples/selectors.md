# Redux Toolkit - Selectors Examples

Memoized selectors with createSelector for derived state.

**Prerequisites:** Understand [core.md](core.md) (Slice Creation) for todo state structure.

---

## Pattern: Selectors and Memoization

### Good Example - Memoized Selectors with createSelector

```typescript
// store/selectors/todos-selectors.ts
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";

const PRIORITY_THRESHOLD_HIGH = 8;
const PRIORITY_THRESHOLD_MEDIUM = 5;

// Basic selectors
export const selectTodosState = (state: RootState) => state.todos;
export const selectTodoItems = (state: RootState) => state.todos.items;
export const selectTodoFilter = (state: RootState) => state.todos.filter;

// Memoized selector - only recalculates when inputs change
export const selectFilteredTodos = createSelector(
  [selectTodoItems, selectTodoFilter],
  (items, filter) => {
    switch (filter) {
      case "active":
        return items.filter((todo) => !todo.completed);
      case "completed":
        return items.filter((todo) => todo.completed);
      default:
        return items;
    }
  }
);

// Memoized selector with derived data
export const selectTodoStats = createSelector([selectTodoItems], (items) => ({
  total: items.length,
  completed: items.filter((t) => t.completed).length,
  active: items.filter((t) => !t.completed).length,
  highPriority: items.filter((t) => t.priority >= PRIORITY_THRESHOLD_HIGH).length,
  mediumPriority: items.filter(
    (t) =>
      t.priority >= PRIORITY_THRESHOLD_MEDIUM &&
      t.priority < PRIORITY_THRESHOLD_HIGH
  ).length,
}));

// Parameterized selector factory
export const makeSelectTodoById = (id: string) =>
  createSelector([selectTodoItems], (items) =>
    items.find((todo) => todo.id === id)
  );

// Alternative: Selector with parameter
export const selectTodoById = createSelector(
  [selectTodoItems, (state: RootState, id: string) => id],
  (items, id) => items.find((todo) => todo.id === id)
);
```

**Why good:** createSelector memoizes by default, named constants for thresholds, parameterized selectors for specific item access, derived data computed only when inputs change

---

## Component Usage with Selectors

```typescript
// components/todo-stats.tsx
import { useAppSelector } from "../store/hooks";
import { selectTodoStats, selectFilteredTodos } from "../store/selectors/todos-selectors";

export const TodoStats = () => {
  const stats = useAppSelector(selectTodoStats);
  const filteredTodos = useAppSelector(selectFilteredTodos);

  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Active: {stats.active}</p>
      <p>Completed: {stats.completed}</p>
      <p>High Priority: {stats.highPriority}</p>
      <p>Currently showing: {filteredTodos.length} items</p>
    </div>
  );
};
```

**Why good:** Uses memoized selectors preventing unnecessary recalculations, named export

---
