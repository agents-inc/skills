# Nuxt — Shared State

> `useState` composables, cookie persistence and server-initialised state. The `useState` checklist is
> in [reference.md](../reference.md).

---

## Basic useState

### Good Example - Simple Counter

```vue
<script setup lang="ts">
// Key-based state sharing across components
const counter = useState("counter", () => 0);

function increment() {
  counter.value++;
}

function decrement() {
  counter.value--;
}
</script>

<template>
  <div>
    <p>Count: {{ counter }}</p>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>
```

**Why good:** The key is the identity — any component calling `useState("counter")` gets this same
ref, with no provider to wire up and no import.

### Bad Example — a value that cannot be serialised

```typescript
// WRONG - Functions not JSON-serializable
const state = useState("broken", () => ({
  count: 0,
  increment() {
    this.count++;
  }, // Will break hydration!
}));
```

**Why bad:** The value is serialised into the HTML and revived in the browser, and a function does not
survive that trip — so the client's state differs from the server's and hydration fails. Put the
method on the composable rather than on the state.

---

## User State Composable

### Good Example — auth state

```typescript
// composables/use-user.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

export function useUser() {
  const user = useState<User | null>("user", () => null);
  const isLoggedIn = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === "admin");

  async function login(email: string, password: string) {
    const response = await $fetch<User>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    user.value = response;
  }

  async function logout() {
    await $fetch("/api/auth/logout", { method: "POST" });
    user.value = null;
  }

  async function fetchUser() {
    try {
      const response = await $fetch<User>("/api/auth/me");
      user.value = response;
    } catch {
      user.value = null;
    }
  }

  return {
    user: readonly(user),
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchUser,
  };
}
```

**Usage:**

```vue
<script setup lang="ts">
const { user, isLoggedIn, logout } = useUser();
</script>

<template>
  <header>
    <template v-if="isLoggedIn">
      <span>Welcome, {{ user?.name }}</span>
      <button @click="logout">Logout</button>
    </template>
    <NuxtLink v-else to="/login">Login</NuxtLink>
  </header>
</template>
```

**Why good:** `readonly(user)` means the only way to change the user is `login` or `logout`, so every
mutation goes through code that also talks to the server. `isLoggedIn` and `isAdmin` are derived
rather than stored, so they cannot drift out of step with `user`.

---

## Shopping Cart State

### Good Example — a larger state object

```typescript
// composables/use-cart.ts
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
}

const EMPTY_CART: Cart = {
  items: [],
  updatedAt: new Date().toISOString(),
};

export function useCart() {
  const cart = useState<Cart>("cart", () => EMPTY_CART);

  const itemCount = computed(() =>
    cart.value.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  const total = computed(() =>
    cart.value.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  function addItem(product: { id: string; name: string; price: number }) {
    const existingItem = cart.value.items.find(
      (i) => i.productId === product.id,
    );

    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.value.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      });
    }

    cart.value.updatedAt = new Date().toISOString();
  }

  function removeItem(productId: string) {
    const index = cart.value.items.findIndex((i) => i.productId === productId);
    if (index !== -1) {
      cart.value.items.splice(index, 1);
      cart.value.updatedAt = new Date().toISOString();
    }
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = cart.value.items.find((i) => i.productId === productId);
    if (item) {
      if (quantity <= 0) {
        removeItem(productId);
      } else {
        item.quantity = quantity;
        cart.value.updatedAt = new Date().toISOString();
      }
    }
  }

  function clearCart() {
    cart.value = EMPTY_CART;
  }

  return {
    cart: readonly(cart),
    itemCount,
    total,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };
}
```

**Why good:** Every field is a string, number or array, so the whole cart survives hydration. `total`
and `itemCount` are computed from the items rather than maintained alongside them, which is what stops
the badge and the basket disagreeing.

---

## UI State

### Good Example — theme and sidebar

```typescript
// composables/use-ui.ts
type Theme = "light" | "dark" | "system";

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_UI_STATE: UIState = {
  theme: "system",
  sidebarOpen: true,
  sidebarCollapsed: false,
};

export function useUI() {
  const state = useState<UIState>("ui", () => DEFAULT_UI_STATE);

  function setTheme(theme: Theme) {
    state.value.theme = theme;
  }

  function toggleSidebar() {
    state.value.sidebarOpen = !state.value.sidebarOpen;
  }

  function toggleSidebarCollapse() {
    state.value.sidebarCollapsed = !state.value.sidebarCollapsed;
  }

  return {
    theme: computed(() => state.value.theme),
    sidebarOpen: computed(() => state.value.sidebarOpen),
    sidebarCollapsed: computed(() => state.value.sidebarCollapsed),
    setTheme,
    toggleSidebar,
    toggleSidebarCollapse,
  };
}
```

**Why good:** Exporting `computed` getters rather than the raw state keeps the setters as the only way
in, which is the same guarantee `readonly` gives on a single ref.

---

## Persisted State with Cookies

### Good Example — preferences that survive a reload

```typescript
// composables/use-preferences.ts
interface UserPreferences {
  currency: string;
  locale: string;
  itemsPerPage: number;
}

const DEFAULT_ITEMS_PER_PAGE = 20;

const DEFAULT_PREFERENCES: UserPreferences = {
  currency: "USD",
  locale: "en-US",
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
};

export function usePreferences() {
  // Cookie persists across sessions
  const preferencesCookie = useCookie<UserPreferences>("user-preferences", {
    default: () => DEFAULT_PREFERENCES,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  // useState syncs cookie with reactive state
  const preferences = useState<UserPreferences>(
    "preferences",
    () => preferencesCookie.value,
  );

  // Sync changes back to cookie
  watch(
    preferences,
    (newVal) => {
      preferencesCookie.value = newVal;
    },
    { deep: true },
  );

  function setCurrency(currency: string) {
    preferences.value.currency = currency;
  }

  function setLocale(locale: string) {
    preferences.value.locale = locale;
  }

  function setItemsPerPage(count: number) {
    preferences.value.itemsPerPage = count;
  }

  return {
    preferences: readonly(preferences),
    setCurrency,
    setLocale,
    setItemsPerPage,
  };
}
```

**Why good:** The cookie is readable during SSR, so the first server render already knows the user's
currency — which `localStorage` could not do. `useState` gives it reactivity, and the `watch` writes
changes back.

---

## State with Server Data

### Good Example — state seeded from the server

```typescript
// composables/use-notifications.ts
interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
}

export function useNotifications() {
  const notifications = useState<Notification[]>("notifications", () => []);
  const isLoaded = useState<boolean>("notifications-loaded", () => false);

  const unreadCount = computed(
    () => notifications.value.filter((n) => !n.read).length,
  );

  async function loadNotifications() {
    if (isLoaded.value) return;

    try {
      const data = await $fetch<Notification[]>("/api/notifications");
      notifications.value = data;
      isLoaded.value = true;
    } catch {
      notifications.value = [];
    }
  }

  async function markAsRead(id: string) {
    await $fetch(`/api/notifications/${id}/read`, { method: "POST" });

    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  async function markAllAsRead() {
    await $fetch("/api/notifications/read-all", { method: "POST" });
    notifications.value.forEach((n) => {
      n.read = true;
    });
  }

  return {
    notifications: readonly(notifications),
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}
```

**Why good:** A second `useState` key records that the fetch has happened, so navigating back to a page
does not re-request the list. The local update after each call keeps the badge correct without a
refetch.

---

## What useState Is Not

`useState` is a keyed, SSR-serializable ref. It covers auth state, UI state, a cart, a toast queue —
anything JSON can carry.

What it deliberately does not provide: devtools inspection, time-travel or undo, persistence beyond
what you wire up yourself, and any notion of one store depending on another.

---

_The `useState` checklist and the "where state belongs" decision tree are in
[reference.md](../reference.md)._
