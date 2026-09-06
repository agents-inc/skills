# MobX - Architecture Examples

> Multi-store setups, TypeScript annotations and render granularity. See [SKILL.md](../SKILL.md) for the decision frameworks and red flags.

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
    this.userStore = new UserStore(this, transportLayer);
    this.todoStore = new TodoStore(this, transportLayer);
    this.uiStore = new UIStore(this);
  }
}

export { RootStore };
```

**Why good:** Each store receives the root, so cross-store reads are an explicit reference rather than an import cycle. The transport layer enters once, at the top, which is what makes the whole graph constructible in a test.

### Good Example - Domain Store Reading a Peer

```typescript
// stores/todo-store.ts
import { makeAutoObservable, runInAction } from "mobx";
import type { RootStore } from "./root-store";
import type { TransportLayer } from "../transport-layer";

interface Todo {
  id: string;
  title: string;
  authorId: string;
  completed: boolean;
}

class TodoStore {
  todos: Todo[] = [];
  isLoading = false;

  constructor(
    private rootStore: RootStore,
    private transportLayer: TransportLayer,
  ) {
    makeAutoObservable(this, { rootStore: false, transportLayer: false });
  }

  get todosForCurrentUser(): Todo[] {
    const currentUserId = this.rootStore.userStore.currentUserId;
    if (!currentUserId) return [];
    return this.todos.filter((todo) => todo.authorId === currentUserId);
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

**Why good:** `todosForCurrentUser` reads an observable in a peer store, so it invalidates when the current user changes as readily as when a todo does. Both injected dependencies are excluded from observability — a transport client has no business being proxied.

### Good Example - UI Store

```typescript
// stores/ui-store.ts
import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";

type Theme = "light" | "dark";

class UIStore {
  sidebarOpen = true;
  modalOpen = false;
  theme: Theme = "light";

  constructor(private rootStore: RootStore) {
    makeAutoObservable(this, { rootStore: false });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }
}

export { UIStore };
```

**Why good:** Presentation state sits apart from the domain stores, so a component reading the sidebar does not subscribe to anything a fetch can change.

### Good Example - Provider and Hooks

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

function useTodoStore() {
  return useRootStore().todoStore;
}

function useUserStore() {
  return useRootStore().userStore;
}

function useUIStore() {
  return useRootStore().uiStore;
}

function RootStoreProvider({ store, children }: { store: RootStore; children: ReactNode }) {
  return <RootStoreContext.Provider value={store}>{children}</RootStoreContext.Provider>;
}

export {
  RootStoreProvider,
  useRootStore,
  useTodoStore,
  useUserStore,
  useUIStore,
};
```

**Why good:** The provider value is one reference that never changes, so this is injection and carries none of Context's re-render cost — reactivity comes from `observer`. The per-store hooks keep components from reaching through the root to get at one field.

### Good Example - Construction at Startup

```typescript
// app.tsx
import { RootStoreProvider } from "./context/root-store-context";
import { RootStore } from "./stores/root-store";
import { createTransportLayer } from "./transport-layer";
import { AppContent } from "./components/app-content";

const transportLayer = createTransportLayer("/api");
const rootStore = new RootStore(transportLayer);

function App() {
  return (
    <RootStoreProvider store={rootStore}>
      <AppContent />
    </RootStoreProvider>
  );
}

export { App };
```

**Why good:** One construction site, so a test builds its own root with a stub transport and renders the same tree.

### Bad Example - Uncoordinated Module Singletons

```typescript
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

const todoStore = new IsolatedTodoStore();
const userStore = new IsolatedUserStore();

export { todoStore, userStore };
```

**Why bad:** A cross-store computed has nothing to reach through, so the dependency reappears as a direct import and the graph goes unstated. The instances are created at module load, which leaves a test no seam to inject a stub or reset state between cases.

---

## Pattern 11: TypeScript Integration

### Good Example - Private Fields

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
    makeAutoObservable<AuthStore, "token" | "apiClient">(this, {
      token: true,
      apiClient: false,
    });

    this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  get isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
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

**Why good:** The second type parameter names the private members, which is what lets the annotation object mention them at all — without it `token` and `apiClient` are not assignable keys. `token` is observable so `isAuthenticated` invalidates on login; `apiClient` is not.

### Good Example - Typed Factory Store

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

**Why good:** The declared interface marks the getters `readonly`, so callers cannot assign over a computed, and the union types make an invalid scheme a compile error rather than a runtime one.

**A caveat on `isDark`:** `matchMedia` is not observable, so `cssVariables` will not recompute when the operating system theme changes. Feeding that through an observable field updated by a `change` listener is what makes it reactive.

---

## Pattern 12: Render Granularity

### Good Example - Dereference Late

```typescript
// components/user-list.tsx
import { observer } from "mobx-react-lite";
import type { User } from "../stores/user-store";
import { useUserStore } from "../context/root-store-context";

export const UserList = observer(function UserList() {
  const userStore = useUserStore();

  return (
    <div>
      <h2>Users ({userStore.userCount})</h2>
      <ul>
        {userStore.users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </ul>
    </div>
  );
});

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

**Why good:** `UserList` reads the array and the count; each `UserRow` reads its own fields. Renaming one user re-renders one row. Adding a level — page, list, item — pushes the boundary further still, so a header reading a count is untouched by an edit inside the list.

### Bad Example - Dereference Early

```typescript
export const BrokenUserList = observer(function BrokenUserList() {
  const userStore = useUserStore();

  return (
    <ul>
      {userStore.users.map((user) => (
        <UserRow key={user.id} name={user.name} email={user.email} role={user.role} />
      ))}
    </ul>
  );
});

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
```

**Why bad:** The three property reads happen in the parent, so the parent subscribes to every field of every user and one rename re-renders the whole list. `observer` on the child now wraps a component that receives plain strings and has nothing to track.

### Good Example - toJS at a Library Boundary

```typescript
// utils/export-data.ts
import { toJS } from "mobx";
import type { TodoStore } from "../stores/todo-store";

function exportTodosToCSV(todoStore: TodoStore): string {
  const plainTodos = toJS(todoStore.todos);

  const headers = "id,title,completed";
  const rows = plainTodos.map((t) => `${t.id},${t.title},${t.completed}`);
  return [headers, ...rows].join("\n");
}

export { exportTodosToCSV };
```

**Why good:** Observables are proxies, and a library that walks or serialises them sees the proxy rather than the data. `toJS` hands over a plain copy and leaves the store untouched.

### Good Example - Development Configuration

```typescript
// config/mobx-config.ts
import { configure } from "mobx";

configure({
  enforceActions: "always",
  computedRequiresReaction: true,
  reactionRequiresObservable: true,
  observableRequiresReaction: true,
});
```

**Why good:** `enforceActions` turns the commonest MobX bug into a throw at the point of the mistake, and the three warnings catch a computed read outside any reaction, a reaction tracking nothing, and an observable nothing observes — each a sign the reactive graph is not wired the way it looks.

These checks cost time on every access, so they belong in development builds rather than production ones.
