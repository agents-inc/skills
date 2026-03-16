# SolidJS - Store Examples

> createStore for complex nested state. See [SKILL.md](../SKILL.md) for concepts.

---

## Basic Store - Todo List

### Good Example - Todo store with path syntax

```typescript
import { createStore } from 'solid-js/store';
import { For, Show, type Component } from 'solid-js';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodoStore {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
}

const TodoApp: Component = () => {
  const [store, setStore] = createStore<TodoStore>({
    todos: [],
    filter: 'all'
  });

  let nextId = 1;

  const addTodo = (text: string) => {
    setStore('todos', todos => [
      ...todos,
      { id: nextId++, text, completed: false }
    ]);
  };

  const toggleTodo = (id: number) => {
    // Path syntax: 'todos', index finder, property
    setStore('todos', todo => todo.id === id, 'completed', c => !c);
  };

  const removeTodo = (id: number) => {
    setStore('todos', todos => todos.filter(t => t.id !== id));
  };

  const setFilter = (filter: TodoStore['filter']) => {
    setStore('filter', filter);
  };

  // Derived state - filter todos
  const filteredTodos = () => {
    switch (store.filter) {
      case 'active':
        return store.todos.filter(t => !t.completed);
      case 'completed':
        return store.todos.filter(t => t.completed);
      default:
        return store.todos;
    }
  };

  const remainingCount = () =>
    store.todos.filter(t => !t.completed).length;

  return (
    <div class="todo-app">
      <input
        type="text"
        placeholder="What needs to be done?"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            addTodo(e.currentTarget.value.trim());
            e.currentTarget.value = '';
          }
        }}
      />

      <div class="filters">
        <button
          classList={{ active: store.filter === 'all' }}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          classList={{ active: store.filter === 'active' }}
          onClick={() => setFilter('active')}
        >
          Active
        </button>
        <button
          classList={{ active: store.filter === 'completed' }}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      <ul class="todo-list">
        <For each={filteredTodos()}>
          {(todo) => (
            <li classList={{ completed: todo.completed }}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
              <button onClick={() => removeTodo(todo.id)}>×</button>
            </li>
          )}
        </For>
      </ul>

      <Show when={store.todos.length > 0}>
        <p class="count">{remainingCount()} items left</p>
      </Show>
    </div>
  );
};

export { TodoApp };
```

**Why good:** Path syntax for granular updates, filter function finds item to update, derived state via functions, classList for conditional classes

---

## Nested Store - User Settings

### Good Example - Deep nested updates with path syntax

```typescript
import { createStore } from 'solid-js/store';
import { type Component } from 'solid-js';

interface UserSettings {
  profile: {
    name: string;
    email: string;
    avatar: string | null;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      showOnline: boolean;
      allowMessages: 'all' | 'friends' | 'none';
    };
  };
}

const SettingsForm: Component = () => {
  const [settings, setSettings] = createStore<UserSettings>({
    profile: {
      name: '',
      email: '',
      avatar: null
    },
    preferences: {
      theme: 'system',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      privacy: {
        showOnline: true,
        allowMessages: 'all'
      }
    }
  });

  // Deep path updates
  const updateName = (name: string) => {
    setSettings('profile', 'name', name);
  };

  const updateTheme = (theme: UserSettings['preferences']['theme']) => {
    setSettings('preferences', 'theme', theme);
  };

  const toggleNotification = (type: keyof UserSettings['preferences']['notifications']) => {
    setSettings('preferences', 'notifications', type, v => !v);
  };

  const updatePrivacy = (key: keyof UserSettings['preferences']['privacy'], value: any) => {
    setSettings('preferences', 'privacy', key, value);
  };

  return (
    <form class="settings-form">
      <section>
        <h3>Profile</h3>
        <input
          type="text"
          value={settings.profile.name}
          onInput={(e) => updateName(e.currentTarget.value)}
          placeholder="Name"
        />
        <input
          type="email"
          value={settings.profile.email}
          onInput={(e) => setSettings('profile', 'email', e.currentTarget.value)}
          placeholder="Email"
        />
      </section>

      <section>
        <h3>Theme</h3>
        <select
          value={settings.preferences.theme}
          onChange={(e) => updateTheme(e.currentTarget.value as any)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </section>

      <section>
        <h3>Notifications</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.preferences.notifications.email}
            onChange={() => toggleNotification('email')}
          />
          Email notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.preferences.notifications.push}
            onChange={() => toggleNotification('push')}
          />
          Push notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.preferences.notifications.sms}
            onChange={() => toggleNotification('sms')}
          />
          SMS notifications
        </label>
      </section>

      <section>
        <h3>Privacy</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.preferences.privacy.showOnline}
            onChange={() => updatePrivacy('showOnline', !settings.preferences.privacy.showOnline)}
          />
          Show online status
        </label>
        <select
          value={settings.preferences.privacy.allowMessages}
          onChange={(e) => updatePrivacy('allowMessages', e.currentTarget.value)}
        >
          <option value="all">Everyone</option>
          <option value="friends">Friends only</option>
          <option value="none">No one</option>
        </select>
      </section>
    </form>
  );
};

export { SettingsForm };
```

**Why good:** Path syntax reaches deeply nested properties, fine-grained updates only re-render affected parts, type-safe paths

---

## Using produce for Complex Mutations

### Good Example - Immer-like mutations

```typescript
import { createStore, produce } from 'solid-js/store';
import { For, Show, type Component } from 'solid-js';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  discount: number;
}

const Cart: Component = () => {
  const [cart, setCart] = createStore<CartStore>({
    items: [],
    discount: 0
  });

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    setCart(produce((state) => {
      const existing = state.items.find(i => i.id === item.id);
      if (existing) {
        existing.quantity++;
      } else {
        state.items.push({ ...item, quantity: 1 });
      }
    }));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(produce((state) => {
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.quantity = Math.max(0, item.quantity + delta);
        // Remove if quantity is 0
        if (item.quantity === 0) {
          const index = state.items.indexOf(item);
          state.items.splice(index, 1);
        }
      }
    }));
  };

  const clearCart = () => {
    setCart(produce((state) => {
      state.items = [];
      state.discount = 0;
    }));
  };

  const applyDiscount = (percent: number) => {
    setCart('discount', percent);
  };

  // Derived values
  const subtotal = () =>
    cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const discountAmount = () =>
    subtotal() * (cart.discount / 100);

  const total = () =>
    subtotal() - discountAmount();

  return (
    <div class="cart">
      <h2>Shopping Cart</h2>

      <For each={cart.items} fallback={<p>Cart is empty</p>}>
        {(item) => (
          <div class="cart-item">
            <span class="name">{item.name}</span>
            <span class="price">${item.price.toFixed(2)}</span>
            <div class="quantity">
              <button onClick={() => updateQuantity(item.id, -1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, 1)}>+</button>
            </div>
            <span class="item-total">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        )}
      </For>

      <div class="summary">
        <div>Subtotal: ${subtotal().toFixed(2)}</div>
        <Show when={cart.discount > 0}>
          <div>Discount ({cart.discount}%): -${discountAmount().toFixed(2)}</div>
        </Show>
        <div class="total">Total: ${total().toFixed(2)}</div>
      </div>

      <div class="actions">
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Discount %"
          onInput={(e) => applyDiscount(Number(e.currentTarget.value))}
        />
        <button onClick={clearCart}>Clear Cart</button>
      </div>
    </div>
  );
};

export { Cart };
```

**Why good:** `produce` enables mutable-style updates, complex logic is readable, array operations (push, splice) work naturally

---

## Using reconcile for External Data

### Good Example - Syncing with server data

```typescript
import { createStore, reconcile } from 'solid-js/store';
import { createEffect, onCleanup, For, type Component } from 'solid-js';

interface User {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'away';
}

const POLL_INTERVAL_MS = 30000;

const UserList: Component = () => {
  const [store, setStore] = createStore<{ users: User[] }>({
    users: []
  });

  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    const users: User[] = await response.json();

    // reconcile preserves object references where possible
    // Only changed users trigger updates
    setStore('users', reconcile(users));
  };

  createEffect(() => {
    // Initial fetch
    fetchUsers();

    // Poll for updates
    const intervalId = setInterval(fetchUsers, POLL_INTERVAL_MS);

    onCleanup(() => {
      clearInterval(intervalId);
    });
  });

  return (
    <div class="user-list">
      <h2>Users ({store.users.length})</h2>
      <For each={store.users}>
        {(user) => (
          <div class={`user user-${user.status}`}>
            <span class="status-dot" />
            <span class="name">{user.name}</span>
          </div>
        )}
      </For>
    </div>
  );
};

export { UserList };
```

**Why good:** `reconcile` efficiently diffs incoming data, unchanged items keep references (no unnecessary re-renders), polling with proper cleanup

---

## Store with Context - Global State

### Good Example - App-wide store via context

```typescript
import { createStore } from 'solid-js/store';
import { createContext, useContext, Show, type ParentComponent } from 'solid-js';

// Types
interface AppState {
  user: {
    id: string;
    name: string;
    role: 'admin' | 'user';
  } | null;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

interface AppContextValue {
  state: AppState;
  actions: {
    login: (user: AppState['user']) => void;
    logout: () => void;
    setTheme: (theme: AppState['theme']) => void;
    toggleSidebar: () => void;
  };
}

// Context
const AppContext = createContext<AppContextValue>();

// Provider
const AppProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<AppState>({
    user: null,
    theme: 'light',
    sidebarOpen: true
  });

  const actions: AppContextValue['actions'] = {
    login: (user) => setState('user', user),
    logout: () => setState('user', null),
    setTheme: (theme) => setState('theme', theme),
    toggleSidebar: () => setState('sidebarOpen', open => !open)
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {props.children}
    </AppContext.Provider>
  );
};

// Hook
function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Usage in component
const Header = () => {
  const { state, actions } = useApp();

  return (
    <header class={`header header-${state.theme}`}>
      <button onClick={actions.toggleSidebar}>
        {state.sidebarOpen ? 'Close' : 'Open'} Menu
      </button>

      <Show
        when={state.user}
        fallback={
          <button onClick={() => actions.login({ id: '1', name: 'John', role: 'user' })}>
            Login
          </button>
        }
      >
        <div class="user-menu">
          <span>{state.user!.name}</span>
          <button onClick={actions.logout}>Logout</button>
        </div>
      </Show>

      <select
        value={state.theme}
        onChange={(e) => actions.setTheme(e.currentTarget.value as 'light' | 'dark')}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </header>
  );
};

export { AppProvider, useApp };
```

**Why good:** Store + Context for global state, actions encapsulated, type-safe hook with error handling, fine-grained updates

---

## Bad Example - Direct Mutation

```typescript
import { createStore } from 'solid-js/store';

const BadExample = () => {
  const [store, setStore] = createStore({
    items: [{ id: 1, name: 'Test' }]
  });

  const badUpdate = () => {
    // BAD: Direct mutation won't trigger updates!
    store.items.push({ id: 2, name: 'New' });
    store.items[0].name = 'Changed';
  };

  const badReplace = () => {
    // BAD: Replacing entire store loses reactivity
    setStore({ ...store, items: [...store.items, { id: 3, name: 'Another' }] });
  };

  return <div>...</div>;
};
```

**Why bad:** Direct mutation bypasses proxy tracking, spreading store loses fine-grained updates

---

## See Also

- [core.md](core.md) - Signals, effects, and memos
- [components.md](components.md) - Component patterns
- [resources.md](resources.md) - createResource for async data
