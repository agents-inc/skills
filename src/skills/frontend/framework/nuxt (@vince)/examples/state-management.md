# Nuxt 3 - State Management Examples

> useState for SSR-safe shared state. See [SKILL.md](../SKILL.md) for core concepts.

---

## Basic useState

### Good Example - Simple Counter

```vue
<script setup lang="ts">
// Key-based state sharing across components
const counter = useState('counter', () => 0)

function increment() {
  counter.value++
}

function decrement() {
  counter.value--
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

**Why good:** Key ensures state sharing across components, initializer runs once, SSR-safe hydration

### Bad Example - Non-Serializable State

```typescript
// WRONG - Functions not JSON-serializable
const state = useState('broken', () => ({
  count: 0,
  increment() { this.count++ } // Will break hydration!
}))
```

**Why bad:** Functions cannot be serialized from server to client, causes hydration mismatch

---

## User State Composable

### Good Example - Auth State

```typescript
// composables/use-user.ts
interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

export function useUser() {
  const user = useState<User | null>('user', () => null)
  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(email: string, password: string) {
    const response = await $fetch<User>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = response
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  async function fetchUser() {
    try {
      const response = await $fetch<User>('/api/auth/me')
      user.value = response
    } catch {
      user.value = null
    }
  }

  return {
    user: readonly(user),
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchUser
  }
}
```

**Usage:**

```vue
<script setup lang="ts">
const { user, isLoggedIn, logout } = useUser()
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

**Why good:** Composable encapsulates state logic, useState key ensures singleton, readonly prevents external mutation, computed for derived state

---

## Shopping Cart State

### Good Example - Complex State Object

```typescript
// composables/use-cart.ts
interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface Cart {
  items: CartItem[]
  updatedAt: string
}

const EMPTY_CART: Cart = {
  items: [],
  updatedAt: new Date().toISOString()
}

export function useCart() {
  const cart = useState<Cart>('cart', () => EMPTY_CART)

  const itemCount = computed(() =>
    cart.value.items.reduce((sum, item) => sum + item.quantity, 0)
  )

  const total = computed(() =>
    cart.value.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  )

  function addItem(product: { id: string; name: string; price: number }) {
    const existingItem = cart.value.items.find(i => i.productId === product.id)

    if (existingItem) {
      existingItem.quantity++
    } else {
      cart.value.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      })
    }

    cart.value.updatedAt = new Date().toISOString()
  }

  function removeItem(productId: string) {
    const index = cart.value.items.findIndex(i => i.productId === productId)
    if (index !== -1) {
      cart.value.items.splice(index, 1)
      cart.value.updatedAt = new Date().toISOString()
    }
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = cart.value.items.find(i => i.productId === productId)
    if (item) {
      if (quantity <= 0) {
        removeItem(productId)
      } else {
        item.quantity = quantity
        cart.value.updatedAt = new Date().toISOString()
      }
    }
  }

  function clearCart() {
    cart.value = EMPTY_CART
  }

  return {
    cart: readonly(cart),
    itemCount,
    total,
    addItem,
    removeItem,
    updateQuantity,
    clearCart
  }
}
```

**Why good:** All values JSON-serializable (strings, numbers, arrays), computed for derived values, mutation methods encapsulated, readonly export prevents direct mutation

---

## UI State

### Good Example - Theme and Sidebar State

```typescript
// composables/use-ui.ts
type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  sidebarCollapsed: boolean
}

const DEFAULT_UI_STATE: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarCollapsed: false
}

export function useUI() {
  const state = useState<UIState>('ui', () => DEFAULT_UI_STATE)

  function setTheme(theme: Theme) {
    state.value.theme = theme
  }

  function toggleSidebar() {
    state.value.sidebarOpen = !state.value.sidebarOpen
  }

  function toggleSidebarCollapse() {
    state.value.sidebarCollapsed = !state.value.sidebarCollapsed
  }

  return {
    theme: computed(() => state.value.theme),
    sidebarOpen: computed(() => state.value.sidebarOpen),
    sidebarCollapsed: computed(() => state.value.sidebarCollapsed),
    setTheme,
    toggleSidebar,
    toggleSidebarCollapse
  }
}
```

**Why good:** Simple UI state doesn't need external library, computed getters maintain reactivity, toggle functions for common operations

---

## Persisted State with Cookies

### Good Example - Remember User Preferences

```typescript
// composables/use-preferences.ts
interface UserPreferences {
  currency: string
  locale: string
  itemsPerPage: number
}

const DEFAULT_ITEMS_PER_PAGE = 20

const DEFAULT_PREFERENCES: UserPreferences = {
  currency: 'USD',
  locale: 'en-US',
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE
}

export function usePreferences() {
  // Cookie persists across sessions
  const preferencesCookie = useCookie<UserPreferences>('user-preferences', {
    default: () => DEFAULT_PREFERENCES,
    maxAge: 60 * 60 * 24 * 365 // 1 year
  })

  // useState syncs cookie with reactive state
  const preferences = useState<UserPreferences>('preferences', () => preferencesCookie.value)

  // Sync changes back to cookie
  watch(preferences, (newVal) => {
    preferencesCookie.value = newVal
  }, { deep: true })

  function setCurrency(currency: string) {
    preferences.value.currency = currency
  }

  function setLocale(locale: string) {
    preferences.value.locale = locale
  }

  function setItemsPerPage(count: number) {
    preferences.value.itemsPerPage = count
  }

  return {
    preferences: readonly(preferences),
    setCurrency,
    setLocale,
    setItemsPerPage
  }
}
```

**Why good:** useCookie for persistence, useState for reactivity, watch syncs to cookie, SSR-safe (cookies work on server)

---

## State with Server Data

### Good Example - Server-Initialized State

```typescript
// composables/use-notifications.ts
interface Notification {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
}

export function useNotifications() {
  const notifications = useState<Notification[]>('notifications', () => [])
  const isLoaded = useState<boolean>('notifications-loaded', () => false)

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  async function loadNotifications() {
    if (isLoaded.value) return

    try {
      const data = await $fetch<Notification[]>('/api/notifications')
      notifications.value = data
      isLoaded.value = true
    } catch {
      notifications.value = []
    }
  }

  async function markAsRead(id: string) {
    await $fetch(`/api/notifications/${id}/read`, { method: 'POST' })

    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }

  async function markAllAsRead() {
    await $fetch('/api/notifications/read-all', { method: 'POST' })
    notifications.value.forEach(n => { n.read = true })
  }

  return {
    notifications: readonly(notifications),
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead
  }
}
```

**Why good:** isLoaded prevents duplicate fetches, optimistic UI updates after API call, computed for derived counts

---

## useState vs External State Libraries

### When to Use useState

```typescript
// ✅ Good use cases for useState:
// - User/auth state
// - Simple UI state (sidebar, theme)
// - Cart/checkout state
// - Notification/toast state
// - Any state that's JSON-serializable

const simpleState = useState('simple', () => ({
  items: [],
  count: 0,
  isOpen: false
}))
```

### When to Consider External Libraries

```typescript
// Consider external state management (Pinia) when:
// - Complex state with many actions and getters
// - Need devtools integration
// - State persistence beyond cookies
// - Multiple stores with cross-store dependencies
// - Undo/redo functionality
// - Large-scale applications with team conventions
```

---

## Quick Reference

| useState Pattern | Use When |
|-----------------|----------|
| `useState('key', () => value)` | Simple shared state |
| `useState<Type>('key', () => init)` | Typed state |
| `composable with useState` | Encapsulated state + actions |
| `useState + useCookie` | Persisted preferences |
| `useState + watch` | Sync state with external source |

| Critical Rule | Reason |
|---------------|--------|
| Values must be JSON-serializable | SSR hydration |
| Use unique keys | State sharing/isolation |
| Wrap mutations in composable functions | Encapsulation |
| Use computed for derived state | Reactivity + performance |
| Use readonly() for exports | Prevent external mutation |
