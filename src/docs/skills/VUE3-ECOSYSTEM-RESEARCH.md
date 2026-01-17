# Vue 3 Ecosystem Research for Atomic Skills

> Research compiled: 2026-01-15
> Purpose: Foundation for creating atomic Vue 3 skills

---

## Table of Contents

1. [Composition API Patterns](#1-composition-api-patterns)
2. [Script Setup Syntax](#2-script-setup-syntax)
3. [Pinia State Management](#3-pinia-state-management)
4. [Vue Router Patterns](#4-vue-router-patterns)
5. [Nuxt 3 Patterns](#5-nuxt-3-patterns)
6. [Component Patterns](#6-component-patterns-slots-provideinject-teleport)
7. [Form Handling Patterns](#7-form-handling-patterns)
8. [Testing Patterns](#8-testing-patterns-vitest--vue-test-utils)
9. [Performance Optimization](#9-performance-optimization)
10. [TypeScript Integration](#10-typescript-integration)

---

## 1. Composition API Patterns

### Core Patterns

#### Pattern 1.1: Composable Structure

Composables are functions that encapsulate and reuse stateful logic using the Composition API.

```typescript
// composables/use-counter.ts
import { ref, computed, onMounted, onUnmounted } from 'vue'

const INITIAL_COUNT = 0
const INCREMENT_STEP = 1

export function useCounter(initialValue = INITIAL_COUNT) {
  const count = ref(initialValue)

  const doubled = computed(() => count.value * 2)
  const isPositive = computed(() => count.value > 0)

  function increment() {
    count.value += INCREMENT_STEP
  }

  function decrement() {
    count.value -= INCREMENT_STEP
  }

  function reset() {
    count.value = initialValue
  }

  return {
    // State (refs)
    count,
    // Computed
    doubled,
    isPositive,
    // Methods
    increment,
    decrement,
    reset,
  }
}
```

**Why good:** Named export for tree-shaking, named constants for magic numbers, returns refs for reactivity preservation, clear separation of state/computed/methods.

#### Pattern 1.2: Async Composable with Cleanup

```typescript
// composables/use-fetch.ts
import { ref, watchEffect, toValue, type MaybeRefOrGetter } from 'vue'

const FETCH_TIMEOUT_MS = 30000

interface UseFetchOptions {
  immediate?: boolean
}

interface UseFetchReturn<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  execute: () => Promise<void>
}

export function useFetch<T>(
  url: MaybeRefOrGetter<string>,
  options: UseFetchOptions = { immediate: true }
): UseFetchReturn<T> {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  let abortController: AbortController | null = null

  async function execute() {
    // Cancel previous request
    abortController?.abort()
    abortController = new AbortController()

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(toValue(url), {
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      data.value = await response.json()
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        error.value = err
      }
    } finally {
      isLoading.value = false
    }
  }

  // Auto-execute and cleanup
  if (options.immediate) {
    watchEffect(() => {
      execute()
    })
  }

  onUnmounted(() => {
    abortController?.abort()
  })

  return { data, error, isLoading, execute }
}
```

**Why good:** Uses `toValue()` for flexibility (accepts refs, getters, or primitives), proper cleanup with AbortController, typed return interface.

#### Pattern 1.3: Composable Nesting

```typescript
// composables/use-user-search.ts
import { computed, type MaybeRefOrGetter } from 'vue'
import { useFetch } from './use-fetch'
import { useDebounce } from './use-debounce'

const DEBOUNCE_DELAY_MS = 300
const API_BASE_URL = '/api/users'

export function useUserSearch(query: MaybeRefOrGetter<string>) {
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS)

  const searchUrl = computed(() => {
    const q = toValue(debouncedQuery)
    return q ? `${API_BASE_URL}?q=${encodeURIComponent(q)}` : null
  })

  const { data, error, isLoading } = useFetch<User[]>(
    () => searchUrl.value ?? '',
    { immediate: false }
  )

  // Only fetch when we have a URL
  watchEffect(() => {
    if (searchUrl.value) {
      execute()
    }
  })

  return {
    users: data,
    error,
    isLoading,
    query: debouncedQuery,
  }
}
```

**Why good:** Composes multiple composables together, debounces user input, conditional fetching.

### Anti-Patterns to Avoid

```typescript
// BAD: Destructuring reactive objects breaks reactivity
const state = reactive({ count: 0 })
const { count } = state // BROKEN: count is not reactive

// GOOD: Use toRefs() or access properties directly
const { count } = toRefs(state) // count is now a ref
// OR
state.count // access directly

// BAD: Using reactive() for primitives
const count = reactive(0) // WRONG: reactive() only works with objects

// GOOD: Use ref() for primitives
const count = ref(0)

// BAD: Calling composables outside setup
function someHelper() {
  const { count } = useCounter() // WRONG: No component context
}

// GOOD: Only call composables in setup() or <script setup>
// <script setup>
const { count } = useCounter() // Correct context

// BAD: Async composable without cleanup
export function useFetch(url: string) {
  // Missing abort controller cleanup
  fetch(url).then(/* ... */)
}

// GOOD: Always cleanup side effects
onUnmounted(() => {
  abortController?.abort()
})
```

### When to Use vs Not Use

| Use Composables | Use Components |
|-----------------|----------------|
| Reusing pure logic | Reusing logic AND visual layout |
| State management logic | UI with template structure |
| Event handling logic | Slots, props, emit patterns |
| API integration | Self-contained features |

---

## 2. Script Setup Syntax

### Core Patterns

#### Pattern 2.1: Basic Script Setup

```vue
<!-- components/user-card.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { UserAvatar } from './user-avatar.vue'

// Props with type-based declaration
interface Props {
  name: string
  email: string
  role?: 'admin' | 'user' | 'guest'
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  role: 'user',
  isActive: true,
})

// Emits with typed payload
const emit = defineEmits<{
  select: [userId: string]
  delete: [userId: string, reason?: string]
}>()

// Computed
const displayName = computed(() =>
  props.name || props.email.split('@')[0]
)

const roleLabel = computed(() => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    user: 'Standard User',
    guest: 'Guest',
  }
  return labels[props.role]
})

// Methods
function handleSelect() {
  emit('select', props.email)
}

function handleDelete(reason?: string) {
  emit('delete', props.email, reason)
}
</script>

<template>
  <div
    class="user-card"
    :data-active="isActive"
    :data-role="role"
  >
    <UserAvatar :name="name" />
    <div class="user-card__info">
      <h3>{{ displayName }}</h3>
      <span class="user-card__role">{{ roleLabel }}</span>
    </div>
    <button @click="handleSelect">Select</button>
    <button @click="handleDelete()">Delete</button>
  </div>
</template>
```

**Why good:** Type-based props declaration with defaults, typed emits with payloads, data-attributes for styling states.

#### Pattern 2.2: defineModel (Vue 3.4+)

```vue
<!-- components/custom-input.vue -->
<script setup lang="ts">
// Vue 3.4+ simplified v-model
const model = defineModel<string>({ required: true })

// Multiple v-models
const firstName = defineModel<string>('firstName')
const lastName = defineModel<string>('lastName')

// With modifiers
const [modelValue, modifiers] = defineModel<string, 'trim' | 'uppercase'>()

function handleInput(event: Event) {
  let value = (event.target as HTMLInputElement).value

  if (modifiers.trim) {
    value = value.trim()
  }
  if (modifiers.uppercase) {
    value = value.toUpperCase()
  }

  model.value = value
}
</script>

<template>
  <input
    :value="model"
    @input="handleInput"
    type="text"
  />
</template>
```

**Why good:** Cleaner than manual v-model implementation, supports modifiers, multiple models.

#### Pattern 2.3: Expose and Template Refs

```vue
<!-- components/form-input.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

function focus() {
  inputRef.value?.focus()
}

function blur() {
  inputRef.value?.blur()
}

function selectAll() {
  inputRef.value?.select()
}

// Expose specific methods to parent
defineExpose({
  focus,
  blur,
  selectAll,
  // Expose computed state if needed
  isFocused,
})

onMounted(() => {
  // Auto-focus on mount if needed
})
</script>

<template>
  <input
    ref="inputRef"
    @focus="isFocused = true"
    @blur="isFocused = false"
  />
</template>
```

**Why good:** Explicit control over what's exposed, typed refs, encapsulation.

### Anti-Patterns to Avoid

```vue
<!-- BAD: Using both type-based and runtime props -->
<script setup lang="ts">
// WRONG: Can't use both
defineProps<{ name: string }>()
defineProps({ name: String }) // ERROR
</script>

<!-- BAD: Forgetting withDefaults for optional props -->
<script setup lang="ts">
interface Props {
  name: string
  count?: number // No default provided
}
const props = defineProps<Props>()
// props.count is possibly undefined everywhere
</script>

<!-- GOOD: Always provide defaults -->
<script setup lang="ts">
const props = withDefaults(defineProps<Props>(), {
  count: 0,
})
</script>

<!-- BAD: Using 'any' for refs -->
<script setup lang="ts">
const inputRef = ref() // Type is Ref<any>
</script>

<!-- GOOD: Explicit typing -->
<script setup lang="ts">
const inputRef = ref<HTMLInputElement | null>(null)
</script>
```

### When to Use vs Not Use

| Use Script Setup | Use Options API |
|------------------|-----------------|
| New Vue 3 projects | Legacy codebases |
| TypeScript projects | Quick prototypes |
| Production code | Learning Vue basics |
| Performance-critical | Migrating from Vue 2 |

---

## 3. Pinia State Management

### Core Patterns

#### Pattern 3.1: Composition API Store (Recommended)

```typescript
// stores/auth-store.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const TOKEN_STORAGE_KEY = 'auth_token'
const SESSION_DURATION_MS = 3600000 // 1 hour

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters (computed)
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const displayName = computed(() => user.value?.name || user.value?.email || 'Guest')

  // Actions
  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        throw new Error('Invalid credentials')
      }

      const data = await response.json()

      token.value = data.token
      user.value = data.user
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }

  async function fetchUser() {
    if (!token.value) return

    isLoading.value = true

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      })

      if (!response.ok) {
        throw new Error('Session expired')
      }

      user.value = await response.json()
    } catch {
      await logout()
    } finally {
      isLoading.value = false
    }
  }

  // Return everything that should be accessible
  return {
    // State
    user,
    token,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    isAdmin,
    displayName,
    // Actions
    login,
    logout,
    fetchUser,
  }
})
```

**Why good:** Composition API syntax with better TypeScript inference, clear organization, proper async handling.

#### Pattern 3.2: Store with Persistence

```typescript
// stores/preferences-store.ts
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'user_preferences'

type Theme = 'light' | 'dark' | 'system'
type Locale = 'en' | 'es' | 'fr' | 'de'

interface Preferences {
  theme: Theme
  locale: Locale
  sidebarCollapsed: boolean
  itemsPerPage: number
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'en',
  sidebarCollapsed: false,
  itemsPerPage: 20,
}

function loadFromStorage(): Preferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_PREFERENCES
}

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<Preferences>(loadFromStorage())

  // Individual getters for convenience
  const theme = computed(() => preferences.value.theme)
  const locale = computed(() => preferences.value.locale)
  const sidebarCollapsed = computed(() => preferences.value.sidebarCollapsed)
  const itemsPerPage = computed(() => preferences.value.itemsPerPage)

  // Persist on change
  watch(
    preferences,
    (newPrefs) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
    },
    { deep: true }
  )

  // Actions
  function setTheme(value: Theme) {
    preferences.value.theme = value
  }

  function setLocale(value: Locale) {
    preferences.value.locale = value
  }

  function toggleSidebar() {
    preferences.value.sidebarCollapsed = !preferences.value.sidebarCollapsed
  }

  function setItemsPerPage(value: number) {
    preferences.value.itemsPerPage = value
  }

  function reset() {
    preferences.value = { ...DEFAULT_PREFERENCES }
  }

  return {
    preferences,
    theme,
    locale,
    sidebarCollapsed,
    itemsPerPage,
    setTheme,
    setLocale,
    toggleSidebar,
    setItemsPerPage,
    reset,
  }
})
```

**Why good:** Self-persisting store, typed preferences, individual getters for convenience.

#### Pattern 3.3: Using storeToRefs

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth-store'
import { usePreferencesStore } from '@/stores/preferences-store'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

// GOOD: Destructure reactive state with storeToRefs
const { user, isAuthenticated, isLoading } = storeToRefs(authStore)
const { theme, locale } = storeToRefs(preferencesStore)

// Actions can be destructured directly (they're not reactive)
const { login, logout } = authStore
const { setTheme, toggleSidebar } = preferencesStore

async function handleLogin(email: string, password: string) {
  await login(email, password)
}
</script>
```

**Why good:** Preserves reactivity when destructuring state, actions don't need storeToRefs.

### Anti-Patterns to Avoid

```typescript
// BAD: Mutating state directly outside actions
const store = useAuthStore()
store.user = null // AVOID: Direct mutation

// GOOD: Use actions for mutations
store.logout()

// BAD: Giant monolithic store
export const useStore = defineStore('app', () => {
  // Auth state
  // User state
  // Products state
  // Cart state
  // ... 1000 lines
})

// GOOD: Split by domain
export const useAuthStore = defineStore('auth', () => { /* ... */ })
export const useUserStore = defineStore('user', () => { /* ... */ })
export const useCartStore = defineStore('cart', () => { /* ... */ })

// BAD: Using store for server data
const products = ref<Product[]>([]) // Server data in Pinia

// GOOD: Use data fetching solution for server data
// Pinia is for client-side UI state only

// BAD: Destructuring without storeToRefs
const { user, isLoading } = useAuthStore() // Loses reactivity!

// GOOD: Use storeToRefs for state
const { user, isLoading } = storeToRefs(useAuthStore())
```

### When to Use vs Not Use

| Use Pinia | Don't Use Pinia |
|-----------|-----------------|
| Shared UI state (modals, sidebars) | Server/API data (use Vue Query) |
| User preferences | URL state (use router) |
| Shopping cart state | Component-local state (use ref) |
| Multi-step form state | Computed values from props |
| Global notifications | One-time config (use provide/inject) |

---

## 4. Vue Router Patterns

### Core Patterns

#### Pattern 4.1: Typed Route Definitions

```typescript
// router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Route name constants to prevent typos
export const ROUTE_NAMES = {
  HOME: 'home',
  LOGIN: 'login',
  DASHBOARD: 'dashboard',
  USER_PROFILE: 'user-profile',
  USER_SETTINGS: 'user-settings',
  NOT_FOUND: 'not-found',
} as const

// Route meta typing
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: ('admin' | 'user')[]
    title?: string
    layout?: 'default' | 'auth' | 'dashboard'
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: ROUTE_NAMES.HOME,
    component: () => import('@/pages/home-page.vue'),
    meta: { title: 'Home', layout: 'default' },
  },
  {
    path: '/login',
    name: ROUTE_NAMES.LOGIN,
    component: () => import('@/pages/login-page.vue'),
    meta: { title: 'Login', layout: 'auth' },
  },
  {
    path: '/dashboard',
    name: ROUTE_NAMES.DASHBOARD,
    component: () => import('@/pages/dashboard-page.vue'),
    meta: { requiresAuth: true, title: 'Dashboard', layout: 'dashboard' },
  },
  {
    path: '/user/:userId',
    name: ROUTE_NAMES.USER_PROFILE,
    component: () => import('@/pages/user-profile-page.vue'),
    meta: { requiresAuth: true, title: 'User Profile' },
    props: true, // Pass route params as props
  },
  {
    path: '/:pathMatch(.*)*',
    name: ROUTE_NAMES.NOT_FOUND,
    component: () => import('@/pages/not-found-page.vue'),
    meta: { title: 'Page Not Found' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})
```

**Why good:** Typed meta fields, named constants for routes, lazy-loaded components, scroll behavior handling.

#### Pattern 4.2: Navigation Guards

```typescript
// router/guards.ts
import { router, ROUTE_NAMES } from './index'
import { useAuthStore } from '@/stores/auth-store'

// Global before guard - Authentication
router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  // Skip auth check for public routes
  if (!to.meta.requiresAuth) {
    return true
  }

  // Not authenticated - redirect to login
  if (!authStore.isAuthenticated) {
    return {
      name: ROUTE_NAMES.LOGIN,
      query: { redirect: to.fullPath },
    }
  }

  // Check role-based access
  if (to.meta.roles && to.meta.roles.length > 0) {
    const userRole = authStore.user?.role
    if (!userRole || !to.meta.roles.includes(userRole)) {
      return { name: ROUTE_NAMES.DASHBOARD } // Redirect to safe page
    }
  }

  return true
})

// Global after hook - Page title and analytics
router.afterEach((to) => {
  // Update page title
  const baseTitle = 'My App'
  document.title = to.meta.title
    ? `${to.meta.title} | ${baseTitle}`
    : baseTitle

  // Track page view (integrate with analytics)
  // analytics.pageView(to.fullPath)
})

// Error handling
router.onError((error) => {
  console.error('Router error:', error)
  // Report to error tracking service
})
```

**Why good:** Centralized auth logic, role-based access control, page title management.

#### Pattern 4.3: Composables with Router

```vue
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ROUTE_NAMES } from '@/router'

const route = useRoute()
const router = useRouter()

// Reactive route params
const userId = computed(() => route.params.userId as string)
const searchQuery = computed(() => route.query.q as string | undefined)

// URL-driven state
const currentPage = computed({
  get: () => Number(route.query.page) || 1,
  set: (value) => {
    router.push({
      query: { ...route.query, page: String(value) },
    })
  },
})

// Navigation helpers
function goToUser(id: string) {
  router.push({
    name: ROUTE_NAMES.USER_PROFILE,
    params: { userId: id },
  })
}

function updateFilters(filters: Record<string, string>) {
  router.replace({
    query: { ...route.query, ...filters },
  })
}

// In-component guard
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    const answer = window.confirm('You have unsaved changes. Leave anyway?')
    if (!answer) return false
  }
  return true
})

// Watch route changes
watch(
  () => route.params.userId,
  (newId) => {
    if (newId) {
      fetchUserData(newId as string)
    }
  },
  { immediate: true }
)
</script>
```

**Why good:** Reactive route state, URL-driven pagination, unsaved changes protection.

### Anti-Patterns to Avoid

```typescript
// BAD: Hardcoded route paths
router.push('/user/123') // Prone to typos, hard to refactor

// GOOD: Use named routes
router.push({ name: ROUTE_NAMES.USER_PROFILE, params: { userId: '123' } })

// BAD: Reading $route in component directly
// (couples component to router)
export default {
  computed: {
    userId() {
      return this.$route.params.userId
    }
  }
}

// GOOD: Use props: true and receive params as props
// router config: props: true
defineProps<{ userId: string }>()

// BAD: Blocking navigation with sync operations
router.beforeEach((to) => {
  const data = heavySyncOperation() // Blocks UI
})

// GOOD: Use async guards
router.beforeEach(async (to) => {
  const data = await fetchDataAsync()
})

// BAD: Not handling navigation failures
router.push('/protected-page') // Might fail silently

// GOOD: Handle navigation results
try {
  await router.push('/protected-page')
} catch (error) {
  if (isNavigationFailure(error, NavigationFailureType.aborted)) {
    // Handle aborted navigation
  }
}
```

### When to Use vs Not Use

| Use Router State | Don't Use Router State |
|------------------|------------------------|
| Shareable URLs (filters, search) | Sensitive data |
| Pagination state | Temporary UI state |
| Tab/view selection | Form input values |
| Sort order | Loading states |
| Active filters | Error messages |

---

## 5. Nuxt 3 Patterns

### Core Patterns

#### Pattern 5.1: Server Components (*.server.vue)

```vue
<!-- components/syntax-highlighter.server.vue -->
<script setup lang="ts">
import { highlight } from '@/utils/highlighter'

interface Props {
  code: string
  language: string
}

const props = defineProps<Props>()

// Heavy operation runs ONLY on server
const highlightedCode = highlight(props.code, props.language)
</script>

<template>
  <pre class="syntax-highlighter">
    <code v-html="highlightedCode" />
  </pre>
</template>
```

**Why good:** Expensive operations stay on server, reduces client bundle, no hydration needed.

#### Pattern 5.2: Hybrid Rendering Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // Static pages - generated at build time
    '/': { prerender: true },
    '/about': { prerender: true },
    '/blog/**': { prerender: true },

    // SSR with caching
    '/products/**': {
      swr: 3600, // Stale-while-revalidate: 1 hour
    },

    // Client-only (SPA mode)
    '/dashboard/**': { ssr: false },
    '/admin/**': { ssr: false },

    // API routes with caching
    '/api/products': {
      cache: { maxAge: 60 * 60 }, // 1 hour cache
    },
  },

  experimental: {
    componentIslands: true, // Enable server components
  },
})
```

**Why good:** Per-route rendering strategy, optimal caching, hybrid approach.

#### Pattern 5.3: Data Fetching with useFetch

```vue
<!-- pages/products/[id].vue -->
<script setup lang="ts">
import type { Product } from '@/types'

const route = useRoute()
const productId = computed(() => route.params.id as string)

// Fetches on server, hydrates on client (no duplicate requests)
const {
  data: product,
  pending,
  error,
  refresh,
} = await useFetch<Product>(`/api/products/${productId.value}`, {
  // Re-fetch when productId changes
  watch: [productId],

  // Transform response
  transform: (response) => ({
    ...response,
    formattedPrice: formatCurrency(response.price),
  }),

  // Error handling
  onResponseError({ response }) {
    if (response.status === 404) {
      throw createError({
        statusCode: 404,
        message: 'Product not found',
      })
    }
  },
})

// SEO
useSeoMeta({
  title: () => product.value?.name ?? 'Product',
  description: () => product.value?.description,
  ogImage: () => product.value?.image,
})
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <article v-else-if="product">
    <h1>{{ product.name }}</h1>
    <p>{{ product.formattedPrice }}</p>
  </article>
</template>
```

**Why good:** SSR-compatible data fetching, automatic hydration, reactive to params.

#### Pattern 5.4: Server API Routes

```typescript
// server/api/products/[id].get.ts
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  // Validate params
  const result = paramsSchema.safeParse(event.context.params)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid product ID',
    })
  }

  const { id } = result.data

  // Fetch from database
  const product = await db.product.findUnique({
    where: { id },
  })

  if (!product) {
    throw createError({
      statusCode: 404,
      message: 'Product not found',
    })
  }

  return product
})
```

**Why good:** File-based routing, Zod validation, proper error handling.

### Anti-Patterns to Avoid

```typescript
// BAD: Using fetch() instead of useFetch in pages
// Results in double fetching (server + client)
const response = await fetch('/api/products')
const products = await response.json()

// GOOD: useFetch handles SSR correctly
const { data: products } = await useFetch('/api/products')

// BAD: Server component with interactivity
// components/interactive.server.vue
<template>
  <button @click="handleClick">Click me</button> <!-- WON'T WORK -->
</template>

// GOOD: Use slots for interactive parts
// components/static-wrapper.server.vue
<template>
  <div class="wrapper">
    <slot /> <!-- Interactive content via slot -->
  </div>
</template>

// BAD: Too many NuxtIsland components on one page
// Each creates a mini Nuxt app

// GOOD: Limit server components, batch related content
```

### When to Use vs Not Use

| Use Nuxt 3 | Don't Use Nuxt 3 |
|------------|------------------|
| SEO-critical apps | Pure client-side apps |
| E-commerce sites | Internal tools |
| Content-heavy sites | Real-time dashboards |
| Marketing sites | Simple SPAs |
| Need hybrid rendering | Already have backend |

---

## 6. Component Patterns (Slots, Provide/Inject, Teleport)

### Core Patterns

#### Pattern 6.1: Scoped Slots

```vue
<!-- components/data-list.vue -->
<script setup lang="ts" generic="T">
interface Props {
  items: T[]
  keyField: keyof T
}

const props = defineProps<Props>()

const selectedItems = ref<Set<T[keyof T]>>(new Set())

function toggleItem(key: T[keyof T]) {
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
}

function isSelected(key: T[keyof T]): boolean {
  return selectedItems.value.has(key)
}
</script>

<template>
  <ul class="data-list">
    <li
      v-for="item in items"
      :key="String(item[keyField])"
      :data-selected="isSelected(item[keyField])"
    >
      <!-- Scoped slot exposes item and helpers -->
      <slot
        :item="item"
        :selected="isSelected(item[keyField])"
        :toggle="() => toggleItem(item[keyField])"
      />
    </li>
  </ul>
</template>
```

```vue
<!-- Usage -->
<script setup lang="ts">
interface User {
  id: string
  name: string
  email: string
}

const users: User[] = [/* ... */]
</script>

<template>
  <DataList :items="users" key-field="id">
    <template #default="{ item, selected, toggle }">
      <div class="user-row">
        <input
          type="checkbox"
          :checked="selected"
          @change="toggle"
        />
        <span>{{ item.name }}</span>
        <span>{{ item.email }}</span>
      </div>
    </template>
  </DataList>
</template>
```

**Why good:** Generic component with type safety, exposes interaction helpers via scoped slot.

#### Pattern 6.2: Provide/Inject for Dependency Injection

```typescript
// context/theme-context.ts
import { type InjectionKey, type Ref, provide, inject, ref, readonly } from 'vue'

type Theme = 'light' | 'dark'

interface ThemeContext {
  theme: Readonly<Ref<Theme>>
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')

export function provideTheme(initialTheme: Theme = 'light') {
  const theme = ref<Theme>(initialTheme)

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  const context: ThemeContext = {
    theme: readonly(theme),
    setTheme,
    toggleTheme,
  }

  provide(THEME_KEY, context)

  return context
}

export function useTheme(): ThemeContext {
  const context = inject(THEME_KEY)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
```

```vue
<!-- components/theme-provider.vue -->
<script setup lang="ts">
import { provideTheme } from '@/context/theme-context'

interface Props {
  defaultTheme?: 'light' | 'dark'
}

const props = withDefaults(defineProps<Props>(), {
  defaultTheme: 'light',
})

provideTheme(props.defaultTheme)
</script>

<template>
  <slot />
</template>
```

**Why good:** Typed injection key, readonly state exposure, explicit error on missing provider.

#### Pattern 6.3: Teleport for Modals

```vue
<!-- components/modal.vue -->
<script setup lang="ts">
import { watch, onMounted } from 'vue'

interface Props {
  open: boolean
  title: string
  closeOnOverlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closeOnOverlay: true,
})

const emit = defineEmits<{
  close: []
}>()

// Lock body scroll when open
watch(() => props.open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        @click.self="handleOverlayClick"
      >
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title"
        >
          <header class="modal-header">
            <h2 :id="title">{{ title }}</h2>
            <button
              type="button"
              aria-label="Close modal"
              @click="emit('close')"
            >
              &times;
            </button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

**Why good:** Teleports to body, handles keyboard/escape, body scroll lock, accessible.

### Anti-Patterns to Avoid

```typescript
// BAD: Using provide/inject for frequently changing state
provide('counter', ref(0)) // Triggers re-renders everywhere

// GOOD: Use Pinia for shared reactive state
// Provide/inject is for rarely-changing dependencies

// BAD: Deeply nested provide without keys
provide('user', user) // Easy to collide with other providers

// GOOD: Use Symbol keys
const USER_KEY: InjectionKey<User> = Symbol('user')
provide(USER_KEY, user)

// BAD: Not handling missing injection
const user = inject('user') // Could be undefined

// GOOD: Throw on missing required injection
const user = inject(USER_KEY)
if (!user) throw new Error('User not provided')

// BAD: Teleporting without checking target exists
<Teleport to="#modal-container"> <!-- Might not exist yet -->

// GOOD: Use defer in Vue 3.5+ or conditional teleport
<Teleport to="#modal-container" :disabled="!targetExists">
```

### When to Use vs Not Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Scoped Slots | Parent needs to customize child rendering | Simple prop passing suffices |
| Provide/Inject | Dependency injection, rarely-changing config | Frequently updating state |
| Teleport | Modals, tooltips, dropdowns | Normal component hierarchy |

---

## 7. Form Handling Patterns

### Core Patterns

#### Pattern 7.1: Native Vue 3 Forms with Zod

```vue
<!-- components/contact-form.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { z } from 'zod'

const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 100
const MAX_MESSAGE_LENGTH = 1000

const contactSchema = z.object({
  name: z.string()
    .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`),
  email: z.string()
    .email('Please enter a valid email address'),
  subject: z.enum(['general', 'support', 'sales'], {
    errorMap: () => ({ message: 'Please select a subject' }),
  }),
  message: z.string()
    .min(1, 'Message is required')
    .max(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters`),
})

type ContactForm = z.infer<typeof contactSchema>

const emit = defineEmits<{
  submit: [data: ContactForm]
}>()

// Form state
const formData = ref<ContactForm>({
  name: '',
  email: '',
  subject: 'general',
  message: '',
})

const errors = ref<Partial<Record<keyof ContactForm, string>>>({})
const touched = ref<Partial<Record<keyof ContactForm, boolean>>>({})
const isSubmitting = ref(false)

// Computed
const isValid = computed(() => {
  const result = contactSchema.safeParse(formData.value)
  return result.success
})

const messageCount = computed(() => formData.value.message.length)

// Validation
function validateField(field: keyof ContactForm) {
  touched.value[field] = true

  const fieldSchema = contactSchema.shape[field]
  const result = fieldSchema.safeParse(formData.value[field])

  if (!result.success) {
    errors.value[field] = result.error.errors[0].message
  } else {
    delete errors.value[field]
  }
}

function validateAll(): boolean {
  const result = contactSchema.safeParse(formData.value)

  if (!result.success) {
    errors.value = {}
    result.error.errors.forEach((err) => {
      const field = err.path[0] as keyof ContactForm
      if (!errors.value[field]) {
        errors.value[field] = err.message
      }
    })
    return false
  }

  errors.value = {}
  return true
}

// Handlers
function handleBlur(field: keyof ContactForm) {
  validateField(field)
}

async function handleSubmit() {
  // Mark all fields as touched
  Object.keys(formData.value).forEach((key) => {
    touched.value[key as keyof ContactForm] = true
  })

  if (!validateAll()) {
    return
  }

  isSubmitting.value = true

  try {
    emit('submit', formData.value)
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  formData.value = {
    name: '',
    email: '',
    subject: 'general',
    message: '',
  }
  errors.value = {}
  touched.value = {}
}
</script>

<template>
  <form @submit.prevent="handleSubmit" novalidate>
    <div class="form-field" :data-error="!!errors.name && touched.name">
      <label for="name">Name</label>
      <input
        id="name"
        v-model="formData.name"
        type="text"
        @blur="handleBlur('name')"
        :aria-invalid="!!errors.name"
        :aria-describedby="errors.name ? 'name-error' : undefined"
      />
      <span v-if="errors.name && touched.name" id="name-error" class="error">
        {{ errors.name }}
      </span>
    </div>

    <div class="form-field" :data-error="!!errors.email && touched.email">
      <label for="email">Email</label>
      <input
        id="email"
        v-model="formData.email"
        type="email"
        @blur="handleBlur('email')"
        :aria-invalid="!!errors.email"
      />
      <span v-if="errors.email && touched.email" class="error">
        {{ errors.email }}
      </span>
    </div>

    <div class="form-field">
      <label for="subject">Subject</label>
      <select
        id="subject"
        v-model="formData.subject"
        @blur="handleBlur('subject')"
      >
        <option value="general">General Inquiry</option>
        <option value="support">Technical Support</option>
        <option value="sales">Sales</option>
      </select>
    </div>

    <div class="form-field" :data-error="!!errors.message && touched.message">
      <label for="message">Message</label>
      <textarea
        id="message"
        v-model="formData.message"
        rows="4"
        @blur="handleBlur('message')"
        :aria-invalid="!!errors.message"
      />
      <div class="form-field__footer">
        <span v-if="errors.message && touched.message" class="error">
          {{ errors.message }}
        </span>
        <span class="char-count">
          {{ messageCount }}/{{ MAX_MESSAGE_LENGTH }}
        </span>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" @click="resetForm">Reset</button>
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Sending...' : 'Send Message' }}
      </button>
    </div>
  </form>
</template>
```

**Why good:** Native Vue with Zod validation, per-field validation on blur, accessible error handling.

#### Pattern 7.2: FormKit Integration

```vue
<!-- components/registration-form.vue -->
<script setup lang="ts">
import { FormKit } from '@formkit/vue'

const MIN_PASSWORD_LENGTH = 8

interface RegistrationData {
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

const emit = defineEmits<{
  submit: [data: RegistrationData]
}>()

async function handleSubmit(data: RegistrationData) {
  emit('submit', data)
}
</script>

<template>
  <FormKit
    type="form"
    @submit="handleSubmit"
    submit-label="Create Account"
    :actions="true"
  >
    <FormKit
      type="email"
      name="email"
      label="Email"
      placeholder="you@example.com"
      validation="required|email"
      validation-visibility="blur"
    />

    <FormKit
      type="password"
      name="password"
      label="Password"
      :validation="`required|length:${MIN_PASSWORD_LENGTH}`"
      :validation-messages="{
        length: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      }"
      validation-visibility="blur"
    />

    <FormKit
      type="password"
      name="confirmPassword"
      label="Confirm Password"
      validation="required|confirm"
      validation-label="Password confirmation"
      validation-visibility="blur"
    />

    <FormKit
      type="checkbox"
      name="acceptTerms"
      label="I accept the terms and conditions"
      validation="accepted"
      validation-visibility="dirty"
    />
  </FormKit>
</template>
```

**Why good:** Declarative validation, built-in accessibility, minimal boilerplate.

#### Pattern 7.3: VeeValidate with Composition API

```vue
<!-- components/login-form.vue -->
<script setup lang="ts">
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const loginSchema = toTypedSchema(
  z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().default(false),
  })
)

const { handleSubmit, errors, isSubmitting, resetForm } = useForm({
  validationSchema: loginSchema,
  initialValues: {
    email: '',
    password: '',
    rememberMe: false,
  },
})

const { value: email, errorMessage: emailError } = useField('email')
const { value: password, errorMessage: passwordError } = useField('password')
const { value: rememberMe } = useField('rememberMe')

const emit = defineEmits<{
  submit: [data: { email: string; password: string; rememberMe: boolean }]
}>()

const onSubmit = handleSubmit((values) => {
  emit('submit', values)
})
</script>

<template>
  <form @submit="onSubmit">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" />
      <span v-if="emailError" class="error">{{ emailError }}</span>
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input id="password" v-model="password" type="password" />
      <span v-if="passwordError" class="error">{{ passwordError }}</span>
    </div>

    <div class="field">
      <label>
        <input v-model="rememberMe" type="checkbox" />
        Remember me
      </label>
    </div>

    <button type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Logging in...' : 'Log in' }}
    </button>
  </form>
</template>
```

**Why good:** Composition API integration, Zod schema support, typed form values.

### Anti-Patterns to Avoid

```vue
<!-- BAD: No validation feedback -->
<input v-model="email" type="email" />

<!-- GOOD: Accessible validation feedback -->
<input
  v-model="email"
  type="email"
  :aria-invalid="!!errors.email"
  :aria-describedby="errors.email ? 'email-error' : undefined"
/>
<span v-if="errors.email" id="email-error" role="alert">
  {{ errors.email }}
</span>

<!-- BAD: Validating on every keystroke -->
<input @input="validate()" />

<!-- GOOD: Validate on blur or submit -->
<input @blur="validateField('email')" />

<!-- BAD: No loading state during submission -->
<button type="submit">Submit</button>

<!-- GOOD: Disable and indicate loading -->
<button type="submit" :disabled="isSubmitting">
  {{ isSubmitting ? 'Submitting...' : 'Submit' }}
</button>
```

### When to Use vs Not Use

| Library | Use When | Avoid When |
|---------|----------|------------|
| Native + Zod | Full control needed, simple forms | Complex multi-step forms |
| FormKit | Rapid development, consistent UI | Heavy customization needed |
| VeeValidate | Need Composition API integration | Want declarative approach |

---

## 8. Testing Patterns (Vitest + Vue Test Utils)

### Core Patterns

#### Pattern 8.1: Component Testing with Vue Test Utils

```typescript
// components/__tests__/user-card.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { UserCard } from '../user-card.vue'

describe('UserCard', () => {
  const defaultProps = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user' as const,
  }

  it('renders user name and email', () => {
    const wrapper = mount(UserCard, {
      props: defaultProps,
    })

    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('john@example.com')
  })

  it('displays role badge correctly', () => {
    const wrapper = mount(UserCard, {
      props: { ...defaultProps, role: 'admin' },
    })

    expect(wrapper.find('[data-role="admin"]').exists()).toBe(true)
  })

  it('emits select event with user id when clicked', async () => {
    const wrapper = mount(UserCard, {
      props: defaultProps,
    })

    await wrapper.find('[data-testid="select-button"]').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')![0]).toEqual([defaultProps.email])
  })

  it('shows loading state when isLoading is true', () => {
    const wrapper = mount(UserCard, {
      props: { ...defaultProps, isLoading: true },
    })

    expect(wrapper.find('[data-loading="true"]').exists()).toBe(true)
  })
})
```

**Why good:** Clear arrange/act/assert pattern, tests behavior not implementation, uses data-testid for queries.

#### Pattern 8.2: Testing Composables

```typescript
// composables/__tests__/use-counter.test.ts
import { describe, it, expect } from 'vitest'
import { useCounter } from '../use-counter'

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { count } = useCounter()
    expect(count.value).toBe(0)
  })

  it('initializes with custom value', () => {
    const { count } = useCounter(10)
    expect(count.value).toBe(10)
  })

  it('increments count', () => {
    const { count, increment } = useCounter()

    increment()

    expect(count.value).toBe(1)
  })

  it('decrements count', () => {
    const { count, decrement } = useCounter(5)

    decrement()

    expect(count.value).toBe(4)
  })

  it('resets to initial value', () => {
    const { count, increment, reset } = useCounter(10)

    increment()
    increment()
    reset()

    expect(count.value).toBe(10)
  })

  it('computes doubled value', () => {
    const { count, doubled, increment } = useCounter(5)

    expect(doubled.value).toBe(10)

    increment()

    expect(doubled.value).toBe(12)
  })
})
```

**Why good:** Tests composable in isolation, verifies reactive behavior.

#### Pattern 8.3: Testing Composables with Lifecycle Hooks

```typescript
// composables/__tests__/use-window-size.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useWindowSize } from '../use-window-size'

// Helper to test composables with lifecycle hooks
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result: T

  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })

  const wrapper = mount(TestComponent)

  return {
    result: result!,
    unmount: () => wrapper.unmount(),
  }
}

describe('useWindowSize', () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth })
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight })
  })

  it('returns initial window dimensions', () => {
    const { result } = withSetup(() => useWindowSize())

    expect(result.width.value).toBe(1024)
    expect(result.height.value).toBe(768)
  })

  it('updates on window resize', async () => {
    const { result } = withSetup(() => useWindowSize())

    // Simulate resize
    Object.defineProperty(window, 'innerWidth', { value: 800 })
    Object.defineProperty(window, 'innerHeight', { value: 600 })
    window.dispatchEvent(new Event('resize'))

    await flushPromises()

    expect(result.width.value).toBe(800)
    expect(result.height.value).toBe(600)
  })

  it('removes event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = withSetup(() => useWindowSize())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
```

**Why good:** Uses helper for lifecycle-dependent composables, tests cleanup, mocks window.

#### Pattern 8.4: Testing with Pinia

```typescript
// stores/__tests__/auth-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth-store'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch.mockReset()
    localStorage.clear()
  })

  it('starts with unauthenticated state', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('logs in successfully', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test', role: 'user' }
    const mockToken = 'jwt-token'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser, token: mockToken }),
    })

    const store = useAuthStore()

    await store.login('test@example.com', 'password')

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toEqual(mockUser)
    expect(store.token).toBe(mockToken)
    expect(localStorage.getItem('auth_token')).toBe(mockToken)
  })

  it('handles login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const store = useAuthStore()

    await expect(store.login('bad@email.com', 'wrong')).rejects.toThrow()

    expect(store.isAuthenticated).toBe(false)
    expect(store.error).toBe('Invalid credentials')
  })

  it('logs out and clears state', async () => {
    const store = useAuthStore()
    store.user = { id: '1', email: 'test@example.com', name: 'Test', role: 'user' }
    store.token = 'jwt-token'
    localStorage.setItem('auth_token', 'jwt-token')

    await store.logout()

    expect(store.user).toBeNull()
    expect(store.token).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})
```

**Why good:** Fresh Pinia instance per test, mocked fetch, tests state transitions.

### Anti-Patterns to Avoid

```typescript
// BAD: Testing implementation details
expect(wrapper.vm.internalState).toBe(true) // Don't test internal state

// GOOD: Test what user sees
expect(wrapper.find('[data-state="active"]').exists()).toBe(true)

// BAD: Snapshot testing everything
expect(wrapper.html()).toMatchSnapshot() // Brittle, unclear what's being tested

// GOOD: Assert specific behaviors
expect(wrapper.find('h1').text()).toBe('Welcome')

// BAD: Not waiting for async operations
wrapper.find('button').trigger('click')
expect(wrapper.emitted('submit')).toBeTruthy() // Might be false!

// GOOD: Use async/await
await wrapper.find('button').trigger('click')
expect(wrapper.emitted('submit')).toBeTruthy()

// BAD: Testing CSS classes for state
expect(wrapper.classes()).toContain('is-active')

// GOOD: Test data attributes
expect(wrapper.attributes('data-active')).toBe('true')
```

### When to Use vs Not Use

| Test Type | Use When | Avoid When |
|-----------|----------|------------|
| Unit (Vitest) | Pure functions, composables | Complex integrations |
| Component (VTU) | Component behavior | E2E user flows |
| E2E (Playwright) | Critical user journeys | Every edge case |

---

## 9. Performance Optimization

### Core Patterns

#### Pattern 9.1: Lazy Loading Components

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('@/pages/home-page.vue'),
  },
  {
    path: '/dashboard',
    component: () => import('@/pages/dashboard-page.vue'),
  },
  // With loading/error states
  {
    path: '/analytics',
    component: defineAsyncComponent({
      loader: () => import('@/pages/analytics-page.vue'),
      loadingComponent: LoadingSpinner,
      errorComponent: ErrorDisplay,
      delay: 200, // Show loading after 200ms
      timeout: 10000, // Timeout after 10s
    }),
  },
]
```

```vue
<!-- Conditional lazy loading in templates -->
<script setup lang="ts">
import { defineAsyncComponent, shallowRef } from 'vue'

const HeavyChart = defineAsyncComponent(
  () => import('./heavy-chart.vue')
)

const showChart = shallowRef(false)
</script>

<template>
  <button @click="showChart = true">Load Chart</button>
  <HeavyChart v-if="showChart" />
</template>
```

**Why good:** Reduces initial bundle, lazy loads on demand, handles loading/error states.

#### Pattern 9.2: Virtual Scrolling

```vue
<!-- components/virtual-list.vue -->
<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

interface Props {
  items: unknown[]
  itemHeight: number
}

defineProps<Props>()
</script>

<template>
  <RecycleScroller
    class="virtual-list"
    :items="items"
    :item-size="itemHeight"
    key-field="id"
    v-slot="{ item }"
  >
    <slot :item="item" />
  </RecycleScroller>
</template>

<style scoped>
.virtual-list {
  height: 100%;
  overflow-y: auto;
}
</style>
```

```vue
<!-- Usage -->
<script setup lang="ts">
const ITEM_HEIGHT = 64
const users = ref<User[]>([/* 10,000 users */])
</script>

<template>
  <VirtualList :items="users" :item-height="ITEM_HEIGHT">
    <template #default="{ item }">
      <UserRow :user="item" />
    </template>
  </VirtualList>
</template>
```

**Why good:** Only renders visible items, handles thousands of items smoothly.

#### Pattern 9.3: Computed and Memoization

```vue
<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'

const items = ref<Product[]>([])
const searchQuery = ref('')
const sortBy = ref<'name' | 'price'>('name')

// GOOD: Computed caches result, recalculates only when dependencies change
const filteredItems = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return items.value.filter((item) =>
    item.name.toLowerCase().includes(query)
  )
})

const sortedItems = computed(() => {
  return [...filteredItems.value].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    }
    return a.price - b.price
  })
})

// For expensive non-reactive computations
const expensiveResult = shallowRef<Result | null>(null)

async function computeExpensive() {
  // Worker or heavy computation
  const result = await heavyComputation(items.value)
  expensiveResult.value = result
}
</script>
```

**Why good:** Computed values cache results, shallowRef for non-reactive expensive data.

#### Pattern 9.4: Avoiding Unnecessary Reactivity

```vue
<script setup lang="ts">
import { ref, shallowRef, markRaw, triggerRef } from 'vue'

// GOOD: Use shallowRef for large objects that don't need deep reactivity
const chartInstance = shallowRef<ChartJS | null>(null)

// GOOD: Mark objects that should never be reactive
const staticConfig = markRaw({
  animation: false,
  responsive: true,
  // ... large config object
})

// GOOD: Manual trigger when shallow ref's internals change
function updateChart() {
  chartInstance.value?.update()
  triggerRef(chartInstance) // Force re-render
}

// BAD: Making everything deeply reactive
const hugeDataset = ref(largeArray) // Every nested property is reactive

// GOOD: Only make what needs to be reactive
const hugeDataset = shallowRef(largeArray)
</script>
```

**Why good:** Reduces reactivity overhead, explicit control over updates.

### Anti-Patterns to Avoid

```vue
<!-- BAD: v-if and v-for on same element -->
<template>
  <div v-for="item in items" v-if="item.active" :key="item.id">
    {{ item.name }}
  </div>
</template>

<!-- GOOD: Filter in computed -->
<script setup>
const activeItems = computed(() => items.value.filter(i => i.active))
</script>
<template>
  <div v-for="item in activeItems" :key="item.id">
    {{ item.name }}
  </div>
</template>

<!-- BAD: Inline functions in templates -->
<template>
  <button @click="() => handleClick(item.id)">Click</button>
</template>

<!-- GOOD: Define handlers in script -->
<script setup>
function handleItemClick(id: string) {
  handleClick(id)
}
</script>
<template>
  <button @click="handleItemClick(item.id)">Click</button>
</template>

<!-- BAD: Watching entire objects -->
<script setup>
watch(largeObject, () => { /* ... */ }) // Triggers on ANY change
</script>

<!-- GOOD: Watch specific properties -->
<script setup>
watch(() => largeObject.value.specificField, () => { /* ... */ })
</script>
```

### When to Use vs Not Use

| Optimization | Use When | Avoid When |
|--------------|----------|------------|
| Lazy loading | Routes, heavy components | Small components |
| Virtual scrolling | >100 items in list | Small lists (<50 items) |
| shallowRef | Large objects, chart instances | Simple reactive state |
| markRaw | Static config, library instances | Data that needs reactivity |

---

## 10. TypeScript Integration

### Core Patterns

#### Pattern 10.1: Typed Props with Generics (Vue 3.3+)

```vue
<!-- components/data-table.vue -->
<script setup lang="ts" generic="T extends Record<string, unknown>">
interface Column<TData> {
  key: keyof TData
  label: string
  sortable?: boolean
  render?: (value: TData[keyof TData], row: TData) => string
}

interface Props {
  data: T[]
  columns: Column<T>[]
  keyField: keyof T
}

const props = defineProps<Props>()

const emit = defineEmits<{
  rowClick: [row: T]
  sort: [column: keyof T, direction: 'asc' | 'desc']
}>()

function handleRowClick(row: T) {
  emit('rowClick', row)
}
</script>

<template>
  <table>
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="String(col.key)"
          @click="col.sortable && emit('sort', col.key, 'asc')"
        >
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in data"
        :key="String(row[keyField])"
        @click="handleRowClick(row)"
      >
        <td v-for="col in columns" :key="String(col.key)">
          {{ col.render ? col.render(row[col.key], row) : row[col.key] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

```vue
<!-- Usage with full type inference -->
<script setup lang="ts">
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

const users: User[] = [/* ... */]

const columns: Column<User>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  {
    key: 'createdAt',
    label: 'Joined',
    render: (value) => new Date(value as Date).toLocaleDateString(),
  },
]

function handleRowClick(user: User) {
  // user is fully typed
  console.log(user.name)
}
</script>

<template>
  <DataTable
    :data="users"
    :columns="columns"
    key-field="id"
    @row-click="handleRowClick"
  />
</template>
```

**Why good:** Full generic support, typed columns match data shape, type-safe events.

#### Pattern 10.2: Typed Template Refs

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ComponentPublicInstance } from 'vue'

// DOM element ref
const inputRef = ref<HTMLInputElement | null>(null)

// Component ref with exposed interface
interface FormInputExpose {
  focus: () => void
  blur: () => void
  value: string
}

const formInputRef = ref<ComponentPublicInstance<{}, FormInputExpose> | null>(null)

// Or use InstanceType for component refs
import { FormInput } from './form-input.vue'
const formInputRef2 = ref<InstanceType<typeof FormInput> | null>(null)

onMounted(() => {
  // Fully typed
  inputRef.value?.focus()
  formInputRef.value?.focus()
})
</script>

<template>
  <input ref="inputRef" type="text" />
  <FormInput ref="formInputRef" />
</template>
```

**Why good:** Type-safe ref access, explicit exposed interface typing.

#### Pattern 10.3: Typed Provide/Inject

```typescript
// types/injection-keys.ts
import type { InjectionKey, Ref } from 'vue'

export interface UserContext {
  user: Ref<User | null>
  isAdmin: Ref<boolean>
  updateUser: (user: User) => Promise<void>
}

export interface ThemeContext {
  theme: Ref<'light' | 'dark'>
  setTheme: (theme: 'light' | 'dark') => void
}

export const USER_KEY: InjectionKey<UserContext> = Symbol('user')
export const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')
```

```vue
<!-- Provider -->
<script setup lang="ts">
import { provide, ref } from 'vue'
import { USER_KEY, type UserContext } from '@/types/injection-keys'

const user = ref<User | null>(null)
const isAdmin = computed(() => user.value?.role === 'admin')

async function updateUser(newUser: User) {
  user.value = newUser
}

provide<UserContext>(USER_KEY, {
  user,
  isAdmin,
  updateUser,
})
</script>
```

```vue
<!-- Consumer -->
<script setup lang="ts">
import { inject } from 'vue'
import { USER_KEY } from '@/types/injection-keys'

// Type-safe injection
const userContext = inject(USER_KEY)

if (!userContext) {
  throw new Error('UserContext not provided')
}

// userContext is fully typed
const { user, isAdmin, updateUser } = userContext
</script>
```

**Why good:** Type-safe injection keys, explicit interface for provided values.

#### Pattern 10.4: Utility Types for Vue

```typescript
// types/vue-utils.ts
import type { Ref, ComputedRef } from 'vue'

// Extract props type from component
type ExtractProps<T> = T extends new () => { $props: infer P } ? P : never

// Make all refs in object type regular values (for tests)
type UnwrapRefs<T> = {
  [K in keyof T]: T[K] extends Ref<infer V>
    ? V
    : T[K] extends ComputedRef<infer V>
      ? V
      : T[K]
}

// Optional ref wrapper
type MaybeRef<T> = T | Ref<T>

// Extract emits from component
type ExtractEmits<T> = T extends { $emit: infer E } ? E : never

// Store state type helper
type StoreState<T extends (...args: unknown[]) => unknown> = ReturnType<T>
```

**Why good:** Reusable utility types, makes working with Vue types easier.

### Anti-Patterns to Avoid

```typescript
// BAD: Using 'any' for refs
const data = ref<any>(null)

// GOOD: Explicit union type
const data = ref<User | null>(null)

// BAD: Not typing emits
const emit = defineEmits(['click', 'update'])

// GOOD: Typed emits with payloads
const emit = defineEmits<{
  click: [event: MouseEvent]
  update: [value: string]
}>()

// BAD: Ignoring provide/inject typing
provide('user', user) // String key, no type safety
const injectedUser = inject('user') // Type is unknown

// GOOD: InjectionKey with explicit type
const USER_KEY: InjectionKey<User> = Symbol('user')
provide(USER_KEY, user)
const injectedUser = inject(USER_KEY) // Type is User | undefined

// BAD: Template refs without null
const inputRef = ref<HTMLInputElement>() // Should handle null

// GOOD: Always include null
const inputRef = ref<HTMLInputElement | null>(null)
```

### When to Use vs Not Use

| Feature | Use When | Avoid When |
|---------|----------|------------|
| Generic components | Reusable data components | Simple single-use components |
| Typed inject | Shared context across app | Simple prop passing works |
| Utility types | Complex type transformations | Built-in types suffice |
| Strict null checks | Production apps | Quick prototypes |

---

## Recommended Skill Structure

Based on this research, the following atomic skills are recommended:

### Skill 1: `frontend-vue-composition-api`
- Composable patterns and structure
- Reactivity (ref, reactive, computed)
- Lifecycle hooks in composables
- Side effect cleanup

### Skill 2: `frontend-vue-components`
- Script setup syntax
- Props, emits, defineModel
- Slots, provide/inject, teleport
- Template refs and expose

### Skill 3: `frontend-vue-state-pinia`
- Store patterns (composition API style)
- Store organization and modularity
- Persistence patterns
- storeToRefs usage

### Skill 4: `frontend-vue-router`
- Route definitions and typing
- Navigation guards
- Route meta typing
- Composition API with router

### Skill 5: `frontend-vue-forms`
- Native Vue + Zod validation
- FormKit integration
- VeeValidate patterns
- Accessibility for forms

### Skill 6: `frontend-vue-testing`
- Component testing with VTU
- Composable testing
- Pinia store testing
- Testing patterns and helpers

### Skill 7: `frontend-vue-performance`
- Lazy loading patterns
- Virtual scrolling
- Reactivity optimization
- Computed caching

### Skill 8: `frontend-vue-typescript`
- Typed props with generics
- Typed template refs
- Typed provide/inject
- Utility types

### Skill 9: `frontend-nuxt` (Separate)
- Server components
- Hybrid rendering
- useFetch/useAsyncData
- Nuxt-specific patterns

---

## Sources

- [Vue.js Official Composables Guide](https://vuejs.org/guide/reusability/composables)
- [Pinia Official Documentation](https://pinia.vuejs.org/introduction.html)
- [Vue Router Navigation Guards](https://router.vuejs.org/guide/advanced/navigation-guards.html)
- [Vue 3 + TypeScript Best Practices 2025](https://eastondev.com/blog/en/posts/dev/20251124-vue3-typescript-best-practices/)
- [Nuxt 3 Server Components](https://roe.dev/blog/nuxt-server-components)
- [FormKit Documentation](https://formkit.com/getting-started/what-is-formkit)
- [VeeValidate Documentation](https://vee-validate.logaretm.com/v4/)
- [Vue Test Utils Getting Started](https://test-utils.vuejs.org/guide/)
- [Vue Performance Guide](https://vuejs.org/guide/best-practices/performance.html)
- [Using Vue with TypeScript](https://vuejs.org/guide/typescript/overview)
- [Design Patterns with Composition API](https://medium.com/@davisaac8/design-patterns-and-best-practices-with-the-composition-api-in-vue-3-77ba95cb4d63)
- [Good Practices for Vue Composables](https://dev.to/jacobandrewsky/good-practices-and-design-patterns-for-vue-composables-24lk)
- [Pinia Best Practices with TypeScript](https://seanwilson.ca/blog/pinia-vue-best-practices.html)
- [Vue 3 + Pinia Complete Guide 2025](https://medium.com/@dedikusniadi/vue-3-pinia-the-complete-guide-to-state-management-in-2025-712cc3cd691c)
- [Mastering Vue 3 Composables Testing](https://dylanbritz.dev/writing/testing-vue-composables-lifecycle/)
- [Optimizing Vue.js Apps 2025](https://metadesignsolutions.com/optimizing-vuejs-apps-in-2025-lazy-loading-tree-shaking-more/)
- [Nuxt Performance Best Practices](https://nuxt.com/docs/3.x/guide/best-practices/performance)
