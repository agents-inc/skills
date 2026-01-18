# Jotai Persistence Patterns

Patterns for persisting state with Jotai.

---

## Pattern 1: atomWithStorage for localStorage

### Good Example - localStorage Persistence

```typescript
import { atomWithStorage, createJSONStorage, RESET } from "jotai/utils";

const STORAGE_KEY_THEME = "app-theme";
const STORAGE_KEY_PREFERENCES = "user-preferences";
const DEFAULT_THEME = "light" as const;

type Theme = "light" | "dark" | "system";

interface UserPreferences {
  notifications: boolean;
  language: string;
  fontSize: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: true,
  language: "en",
  fontSize: 16,
};

// Persists to localStorage by default
const themeAtom = atomWithStorage<Theme>(STORAGE_KEY_THEME, DEFAULT_THEME);

// With getOnInit option (v2) - immediately returns stored value on first render
// Without getOnInit (default): renders initialValue first, then stored value
// With getOnInit: true: renders stored value immediately (may cause hydration issues in SSR)
const themeWithGetOnInitAtom = atomWithStorage<Theme>(
  STORAGE_KEY_THEME,
  DEFAULT_THEME,
  undefined, // use default localStorage
  { getOnInit: true }
);

const preferencesAtom = atomWithStorage<UserPreferences>(
  STORAGE_KEY_PREFERENCES,
  DEFAULT_PREFERENCES
);

// sessionStorage variant
const sessionStorage = createJSONStorage(() => globalThis.sessionStorage);

const sessionDataAtom = atomWithStorage(
  "session-data",
  { token: "" },
  sessionStorage
);

export { themeAtom, preferencesAtom, sessionDataAtom, RESET };
```

### Good Example - Resetting Stored Values

```tsx
import { useSetAtom } from "jotai";
import { RESET } from "jotai/utils";

function ResetButton() {
  const setPreferences = useSetAtom(preferencesAtom);

  const handleReset = () => {
    setPreferences(RESET); // Resets to default value
  };

  return <button onClick={handleReset}>Reset to Defaults</button>;
}

export { ResetButton };
```

**Why good:** Automatic localStorage sync, RESET symbol for clearing stored values, supports custom storage backends

---

## Pattern 2: selectAtom for Large Objects

### Good Example - Granular Selection

```typescript
import { atom } from "jotai";
import { selectAtom } from "jotai/utils";

interface UserProfile {
  name: string;
  email: string;
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  preferences: {
    theme: "light",
    notifications: true,
  },
  metadata: {
    createdAt: "",
    updatedAt: "",
  },
};

const userProfileAtom = atom<UserProfile>(DEFAULT_PROFILE);

// Only re-render when name changes
const nameAtom = selectAtom(userProfileAtom, (profile) => profile.name);

// Deep selection with custom equality
const themeAtom = selectAtom(
  userProfileAtom,
  (profile) => profile.preferences.theme,
  (a, b) => a === b
);

// Select computed value
const hasNotificationsAtom = selectAtom(
  userProfileAtom,
  (profile) => profile.preferences.notifications
);

export { userProfileAtom, nameAtom, themeAtom, hasNotificationsAtom };
```

**Why good:** Components only subscribe to specific properties, prevents re-renders when unrelated parts of object change, custom equality for precise control

### When NOT to Use selectAtom

```typescript
// BAD: Object updates every second - selectAtom adds overhead without benefit
const realtimeDataAtom = atom({ x: 0, y: 0, z: 0 }); // Updates 60fps
const xAtom = selectAtom(realtimeDataAtom, (d) => d.x); // Wasteful

// GOOD: Just use the atom directly for frequently-updating data
function LiveDisplay() {
  const [data] = useAtom(realtimeDataAtom);
  return (
    <div>
      {data.x}, {data.y}, {data.z}
    </div>
  );
}
```

**Why bad:** When all values update together anyway, selectAtom adds overhead without preventing re-renders

---

## Pattern 3: splitAtom for Array Optimization

### Good Example - Optimized Array Items

```typescript
import { atom, useAtom } from "jotai";
import { splitAtom } from "jotai/utils";
import type { PrimitiveAtom } from "jotai";

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const todosAtom = atom<Todo[]>([
  { id: "1", text: "Learn Jotai", done: false },
  { id: "2", text: "Build app", done: false },
]);

// Split into individual atoms - each item gets its own atom
const todoAtomsAtom = splitAtom(todosAtom);

// With keyExtractor for stability (recommended for items with IDs)
const todoAtomsWithKeyAtom = splitAtom(todosAtom, (todo) => todo.id);

export { todosAtom, todoAtomsAtom, todoAtomsWithKeyAtom };
```

### Usage Example - Optimized List

```tsx
import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";

interface TodoItemProps {
  todoAtom: PrimitiveAtom<Todo>;
  onRemove: () => void;
}

// Each TodoItem only re-renders when its own todo changes
function TodoItem({ todoAtom, onRemove }: TodoItemProps) {
  const [todo, setTodo] = useAtom(todoAtom);

  const toggleDone = () => {
    setTodo({ ...todo, done: !todo.done });
  };

  return (
    <div>
      <input type="checkbox" checked={todo.done} onChange={toggleDone} />
      <span>{todo.text}</span>
      <button onClick={onRemove}>Remove</button>
    </div>
  );
}

function TodoList() {
  const [todoAtoms, dispatch] = useAtom(todoAtomsWithKeyAtom);

  return (
    <ul>
      {todoAtoms.map((todoAtom) => (
        <li key={`${todoAtom}`}>
          <TodoItem
            todoAtom={todoAtom}
            onRemove={() => dispatch({ type: "remove", atom: todoAtom })}
          />
        </li>
      ))}
    </ul>
  );
}

export { TodoItem, TodoList };
```

**Why good:** Updating one item only re-renders that item's component, dispatch handles add/remove operations, keyExtractor ensures stable atom identity
