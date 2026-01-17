# Redux Toolkit - Typed Hooks Examples

Typed hooks for React components using Redux Toolkit.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration, Slice Creation) first.

---

## Pattern: Typed Hooks for Components

### Good Example - Typed Hooks with withTypes (React Redux v9.1.0+)

```typescript
// store/hooks.ts
import { useDispatch, useSelector, useStore } from "react-redux";
import type { RootState, AppDispatch, AppStore } from "./index";

// Use the hook's built-in withTypes method for type inference
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
```

**Why good:** Clean single-line definitions, types inferred from store, no manual typing in components, prevents circular imports (hooks.ts is separate from store/index.ts)

### Good Example - Legacy Typed Hooks (pre-v9.1.0)

```typescript
// store/hooks.ts (for older React Redux versions)
import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Why good:** Works with older versions, still provides type safety, named exports

---

## Component Usage

```typescript
// components/todo-list.tsx
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { toggleTodo, removeTodo, setFilter } from "../store/slices/todos-slice";

export const TodoList = () => {
  const dispatch = useAppDispatch();
  const todos = useAppSelector((state) => state.todos.items);
  const filter = useAppSelector((state) => state.todos.filter);

  const filteredTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  return (
    <ul>
      {filteredTodos.map((todo) => (
        <li key={todo.id} data-completed={todo.completed}>
          <span onClick={() => dispatch(toggleTodo(todo.id))}>{todo.title}</span>
          <button onClick={() => dispatch(removeTodo(todo.id))}>Delete</button>
        </li>
      ))}
    </ul>
  );
};
```

**Why good:** Uses typed hooks (no manual RootState typing), dispatch correctly types thunks, data-attribute for styling state, named export

---

## Bad Example - Untyped Hooks

```typescript
// WRONG - Using untyped hooks
import { useDispatch, useSelector } from "react-redux";

function TodoList() {
  const dispatch = useDispatch(); // No thunk types!
  const todos = useSelector((state: any) => state.todos.items); // any type!

  // TypeScript can't catch errors here
}

export default TodoList; // BAD: default export
```

**Why bad:** No type safety for state access, dispatch does not know about thunks, any type defeats TypeScript benefits, default export

---
