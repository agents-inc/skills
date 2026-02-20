# MobX - Architecture Examples

> Architecture patterns for multi-store setups, TypeScript integration, and performance optimization. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [Core Patterns](core.md) - Store creation, observer, useLocalObservable
- [Advanced Patterns](advanced.md) - Computed values, actions, async, reactions

---

## Pattern 10: Root Store Pattern

### Good Example - Root Store with Domain and UI Stores

```typescript
// stores/root-store.ts
import { UserStore } from "./user-store";
import { TodoStore } from "./todo-store";
import { UIStore } from "./ui-store";
import type { TransportLayer } from "../transport-layer";

class RootStore {
  userStore: UserStore;
  todoStore: TodoStore;
  uiStore: UIStore;

  constructor(transportLayer: TransportLayer) {
    // Each store receives a reference to the root store
    // enabling cross-store communication
    this.userStore = new UserStore(this, transportLayer);
    this.todoStore = new TodoStore(this, transportLayer);
    this.uiStore = new UIStore(this);
  }
}

export { RootStore };
```

**Why good:** Central coordinator for all stores, transport layer injected at root level for testability, each store can access peer stores through root reference, simple setup with strong typing

### Good Example - Domain Store with Root Reference

```typescript
// stores/todo-store.ts
import { makeAutoObservable, runInAction } from "mobx";
import type { RootStore } from "./root-store";
import type { TransportLayer } from "../transport-layer";

const INITIAL_LOADING_STATE = false;

interface Todo {
  id: string;
  title: string;
  authorId: string;
  completed: boolean;
}

class TodoStore {
  todos: Todo[] = [];
  isLoading = INITIAL_LOADING_STATE;

  constructor(
    private rootStore: RootStore,
    private transportLayer: TransportLayer,
  ) {
    makeAutoObservable(this, {
      rootStore: false,
      transportLayer: false,
    });
  }

  // Cross-store computed: accesses userStore through rootStore
  get todosForCurrentUser(): Todo[] {
    const currentUserId = this.rootStore.userStore.currentUserId;
    if (!currentUserId) return [];
    return this.todos.filter((todo) => todo.authorId === currentUserId);
  }

  get completedCount(): number {
    return this.todos.filter((t) => t.completed).length;
  }

  async fetchTodos(): Promise<void> {
    this.isLoading = true;
    try {
      const todos = await this.transportLayer.getTodos();
      runInAction(() => {
        this.todos = todos;
        this.isLoading = false;
      });
    } catch {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  addTodo(title: string): void {
    const currentUserId = this.rootStore.userStore.currentUserId;
    if (!currentUserId) return;
    this.todos.push({
      id: crypto.randomUUID(),
      title,
      authorId: currentUserId,
      completed: false,
    });
  }

  toggleTodo(id: string): void {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }
}

export { TodoStore };
export type { Todo };
```

**Why good:** Cross-store access via `rootStore` reference, non-observable dependencies excluded with overrides, computed value derives data from both local and peer store, transport layer abstracted for testability

### Good Example - UI Store

```typescript
// stores/ui-store.ts
import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";

const DEFAULT_SIDEBAR_STATE = true;
const DEFAULT_MODAL_STATE = false;
const DEFAULT_THEME = "light" as const;

type Theme = "light" | "dark";

class UIStore {
  sidebarOpen = DEFAULT_SIDEBAR_STATE;
  modalOpen = DEFAULT_MODAL_STATE;
  theme: Theme = DEFAULT_THEME;

  constructor(private rootStore: RootStore) {
    makeAutoObservable(this, {
      rootStore: false,
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  openModal(): void {
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }
}

export { UIStore };
```

**Why good:** UI-specific state separated from domain logic, named constants for all defaults, simple actions for UI state mutations, root reference excluded from observability

### Good Example - Root Store Provider and Hook

```typescript
// context/root-store-context.tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { RootStore } from "../stores/root-store";

const RootStoreContext = createContext<RootStore | null>(null);

function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) {
    throw new Error("useRootStore must be used within RootStoreProvider");
  }
  return store;
}

// Convenience hooks for individual stores
function useTodoStore() {
  return useRootStore().todoStore;
}

function useUserStore() {
  return useRootStore().userStore;
}

function useUIStore() {
  return useRootStore().uiStore;
}

function RootStoreProvider({
  store,
  children,
}: {
  store: RootStore;
  children: ReactNode;
}): JSX.Element {
  return (
    <RootStoreContext.Provider value={store}>
      {children}
    </RootStoreContext.Provider>
  );
}

export {
  RootStoreProvider,
  useRootStore,
  useTodoStore,
  useUserStore,
  useUIStore,
};
```

**Why good:** Context provides root store via dependency injection (store value never changes), convenience hooks avoid repeated `useRootStore().todoStore` access, error boundary on missing provider, named exports

### Good Example - App Setup with Root Store

```typescript
// app.tsx
import { RootStoreProvider } from "./context/root-store-context";
import { RootStore } from "./stores/root-store";
import { createTransportLayer } from "./transport-layer";
import { AppContent } from "./components/app-content";

const API_BASE_URL = "/api";

// Create stores once at app initialization
const transportLayer = createTransportLayer(API_BASE_URL);
const rootStore = new RootStore(transportLayer);

function App(): JSX.Element {
  return (
    <RootStoreProvider store={rootStore}>
      <AppContent />
    </RootStoreProvider>
  );
}

export { App };
```

**Why good:** Root store created once at module level, transport layer injected with configuration, single provider wraps the entire app, clean separation of initialization from rendering

### Bad Example - Stores Without Coordination

```typescript
// stores/uncoordinated-stores.ts
import { makeAutoObservable } from "mobx";

// BAD: Independent stores with no way to communicate
class IsolatedTodoStore {
  todos: Todo[] = [];
  constructor() {
    makeAutoObservable(this);
  }
}

class IsolatedUserStore {
  currentUserId: string | null = null;
  constructor() {
    makeAutoObservable(this);
  }
}

// BAD: Importing stores directly creates hidden dependencies
// and makes testing much harder
const todoStore = new IsolatedTodoStore();
const userStore = new IsolatedUserStore();

export { todoStore, userStore };
```

**Why bad:** Stores cannot access each other for cross-store computed values, module-level singletons are hard to test (cannot inject mocks), no central place to initialize or reset stores, hidden dependency graph

---

## Pattern 11: TypeScript Integration

### Good Example - Fully Typed Class Store

```typescript
// stores/notification-store.ts
import { makeAutoObservable } from "mobx";

const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_DISMISS_DELAY_MS = 5000;

type NotificationType = "success" | "error" | "warning" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

class NotificationStore {
  notifications: Notification[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  // TypeScript infers return type from computed getter
  get activeNotifications(): Notification[] {
    return this.notifications.filter((n) => !n.dismissed);
  }

  get errorCount(): number {
    return this.activeNotifications.filter((n) => n.type === "error").length;
  }

  get hasErrors(): boolean {
    return this.errorCount > 0;
  }

  addNotification(type: NotificationType, message: string): void {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now(),
      dismissed: false,
    };

    this.notifications.push(notification);

    // Enforce max notification limit
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(-MAX_NOTIFICATIONS);
    }
  }

  dismiss(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.dismissed = true;
    }
  }

  dismissAll(): void {
    this.notifications.forEach((n) => {
      n.dismissed = true;
    });
  }

  clearDismissed(): void {
    this.notifications = this.notifications.filter((n) => !n.dismissed);
  }
}

export { NotificationStore };
export type { Notification, NotificationType };
```

**Why good:** Full TypeScript type safety on all properties, methods, and computed values, named constants for limits, type alias exported with `export type`, notification type union prevents invalid states

### Good Example - Private Fields with makeAutoObservable

```typescript
// stores/auth-store.ts
import { makeAutoObservable, runInAction } from "mobx";
import type { ApiClient } from "../api-client";

const TOKEN_STORAGE_KEY = "auth-token";

interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

class AuthStore {
  user: AuthUser | null = null;
  isAuthenticating = false;
  private token: string | null = null;

  constructor(private apiClient: ApiClient) {
    // Generic parameter tells makeAutoObservable about private fields
    makeAutoObservable<AuthStore, "token" | "apiClient">(this, {
      token: true, // Make private field observable
      apiClient: false, // Exclude from observability
    });

    // Restore token from storage
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  get isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
  }

  get isAdmin(): boolean {
    return this.user?.role === "admin";
  }

  async login(email: string, password: string): Promise<void> {
    this.isAuthenticating = true;
    try {
      const { user, token } = await this.apiClient.login(email, password);
      runInAction(() => {
        this.user = user;
        this.token = token;
        this.isAuthenticating = false;
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      });
    } catch {
      runInAction(() => {
        this.isAuthenticating = false;
      });
      throw new Error("Login failed");
    }
  }

  logout(): void {
    this.user = null;
    this.token = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export { AuthStore };
export type { AuthUser };
```

**Why good:** Generic parameter `<AuthStore, "token" | "apiClient">` tells TypeScript about private field annotations, private token is observable (tracked by computed `isAuthenticated`), apiClient excluded from observability, `import type` for type-only imports

### Good Example - Typed Factory Function Store

```typescript
// stores/theme-store.ts
import { makeAutoObservable } from "mobx";

const DEFAULT_FONT_SIZE_PX = 16;
const MIN_FONT_SIZE_PX = 12;
const MAX_FONT_SIZE_PX = 24;
const FONT_SIZE_STEP_PX = 2;

type ColorScheme = "light" | "dark" | "system";
type AccentColor = "blue" | "green" | "purple" | "orange";

interface ThemeStore {
  colorScheme: ColorScheme;
  accentColor: AccentColor;
  fontSize: number;
  readonly cssVariables: Record<string, string>;
  readonly isDark: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
  setAccentColor: (color: AccentColor) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

function createThemeStore(): ThemeStore {
  return makeAutoObservable<ThemeStore>({
    colorScheme: "system",
    accentColor: "blue",
    fontSize: DEFAULT_FONT_SIZE_PX,

    get cssVariables(): Record<string, string> {
      return {
        "--accent-color": this.accentColor,
        "--font-size": `${this.fontSize}px`,
        "--color-scheme": this.isDark ? "dark" : "light",
      };
    },

    get isDark(): boolean {
      if (this.colorScheme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      return this.colorScheme === "dark";
    },

    setColorScheme(scheme: ColorScheme): void {
      this.colorScheme = scheme;
    },

    setAccentColor(color: AccentColor): void {
      this.accentColor = color;
    },

    increaseFontSize(): void {
      if (this.fontSize < MAX_FONT_SIZE_PX) {
        this.fontSize += FONT_SIZE_STEP_PX;
      }
    },

    decreaseFontSize(): void {
      if (this.fontSize > MIN_FONT_SIZE_PX) {
        this.fontSize -= FONT_SIZE_STEP_PX;
      }
    },
  });
}

export { createThemeStore };
export type { ThemeStore, ColorScheme, AccentColor };
```

**Why good:** Factory function with explicit return type interface, generic parameter ensures type safety on the created observable, named constants for all font size boundaries, union types prevent invalid states, types exported separately

---

## Pattern 12: Performance Optimization

### Good Example - Small Observer Components (Dereference Late)

```typescript
// components/user-list.tsx
import { observer } from "mobx-react-lite";
import type { User } from "../stores/user-store";
import { useUserStore } from "../context/root-store-context";

// GOOD: Parent passes observable OBJECTS, not extracted primitives
export const UserList = observer(function UserList() {
  const userStore = useUserStore();

  return (
    <div>
      <h2>Users ({userStore.userCount})</h2>
      <ul>
        {userStore.users.map((user) => (
          // Pass the observable user object, NOT user.name, user.email
          <UserRow key={user.id} user={user} />
        ))}
      </ul>
    </div>
  );
});

// GOOD: Small dedicated component dereferences observables late
// Only THIS component re-renders when THIS user's properties change
const UserRow = observer(function UserRow({ user }: { user: User }) {
  return (
    <li>
      <span>{user.name}</span>
      <span>{user.email}</span>
      <span data-role={user.role}>{user.role}</span>
    </li>
  );
});

export { UserRow };
```

**Why good:** Observables dereferenced as late as possible (inside the smallest component), `UserRow` only re-renders when its specific user changes (not when other users change), `UserList` only re-renders when the array itself changes (adds/removes), fine-grained reactivity

### Bad Example - Extracting Primitives Early (Dereference Too Soon)

```typescript
// components/broken-user-list.tsx
import { observer } from "mobx-react-lite";
import { useUserStore } from "../context/root-store-context";

// BAD: Extracting primitive values at the parent level
export const BrokenUserList = observer(function BrokenUserList() {
  const userStore = useUserStore();

  return (
    <ul>
      {userStore.users.map((user) => (
        // BAD: Extracting primitives here - parent re-renders for ALL user changes
        <UserRow
          key={user.id}
          name={user.name}
          email={user.email}
          role={user.role}
        />
      ))}
    </ul>
  );
});

// This component receives plain strings, NOT observables
// It cannot benefit from fine-grained tracking
const UserRow = observer(function UserRow({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <li>
      <span>{name}</span>
      <span>{email}</span>
      <span>{role}</span>
    </li>
  );
});

export { UserRow };
```

**Why bad:** Parent component dereferences `user.name`, `user.email`, `user.role` -- it subscribes to ALL user properties, any user property change causes the ENTIRE list to re-render, child receives plain strings (not observables) so `observer` on child is useless

### Good Example - Dedicated List Component

```typescript
// components/todo-page.tsx
import { observer } from "mobx-react-lite";
import { useTodoStore } from "../context/root-store-context";
import type { Todo } from "../stores/todo-store";

// GOOD: Page component only reads non-list data
export const TodoPage = observer(function TodoPage() {
  const todoStore = useTodoStore();

  return (
    <div>
      <h1>Todos</h1>
      <p>Completed: {todoStore.completedCount}</p>
      {/* Dedicated list component prevents page re-render on item changes */}
      <TodoList todos={todoStore.filteredTodos} />
    </div>
  );
});

// GOOD: Dedicated list component isolates array rendering
// Only re-renders when the filtered array changes (add/remove/filter change)
const TodoList = observer(function TodoList({
  todos,
}: {
  todos: Todo[];
}) {
  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
});

// GOOD: Individual item component - only re-renders when THIS todo changes
const TodoItem = observer(function TodoItem({ todo }: { todo: Todo }) {
  return (
    <li data-completed={todo.completed}>
      <span>{todo.title}</span>
    </li>
  );
});

export { TodoList, TodoItem };
```

**Why good:** Three-level component hierarchy (page/list/item) enables maximum granularity, changing a todo title only re-renders that specific `TodoItem`, adding/removing todos only re-renders `TodoList` (not the page header), `completedCount` is a computed value cached by MobX

### Good Example - Using toJS for Non-MobX Libraries

```typescript
// utils/export-data.ts
import { toJS } from "mobx";
import type { TodoStore } from "../stores/todo-store";

// Some libraries expect plain JS objects, not MobX observables
function exportTodosToCSV(todoStore: TodoStore): string {
  // toJS recursively converts observable objects to plain JS
  const plainTodos = toJS(todoStore.todos);

  // Now safe to pass to libraries that don't understand MobX proxies
  const headers = "id,title,completed";
  const rows = plainTodos.map((t) => `${t.id},${t.title},${t.completed}`);
  return [headers, ...rows].join("\n");
}

export { exportTodosToCSV };
```

**Why good:** `toJS` creates a plain JS copy for non-MobX-aware libraries, prevents issues with Proxy-based observables in serialization, keeps the observable store intact

### Good Example - Configure MobX for Development

```typescript
// config/mobx-config.ts
import { configure } from "mobx";

// Recommended development configuration
// Catches common mistakes early
configure({
  // Throw if observables are modified outside actions
  enforceActions: "always",
  // Warn if computed values are accessed outside reactions
  computedRequiresReaction: true,
  // Warn if reactions don't read any observables
  reactionRequiresObservable: true,
  // Warn if observables are created but never observed
  observableRequiresReaction: true,
});

export {};
```

**Why good:** `enforceActions: "always"` catches state mutations outside actions (the most common MobX bug), other flags catch misuse of computed/reactions, should be enabled in development for early error detection

**When to use:** Development builds for catching reactivity bugs early.

**When not to use:** Production builds (the checks add runtime overhead).
