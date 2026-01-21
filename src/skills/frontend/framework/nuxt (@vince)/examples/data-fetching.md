# Nuxt 3 - Data Fetching Examples

> SSR-safe data fetching with useFetch, useAsyncData, and $fetch. See [SKILL.md](../SKILL.md) for core concepts.

---

## useFetch for API Calls

### Good Example - Typed API Response

```vue
<script setup lang="ts">
interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

const USERS_ENDPOINT = '/api/users'
const DEFAULT_LIMIT = 20

const page = ref(1)

const { data: users, pending, error, refresh } = await useFetch<User[]>(USERS_ENDPOINT, {
  query: {
    page,
    limit: DEFAULT_LIMIT
  },
  // Refetch when page changes
  watch: [page]
})
</script>

<template>
  <div>
    <div v-if="pending">Loading users...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
    <button @click="page++">Next Page</button>
    <button @click="refresh()">Refresh</button>
  </div>
</template>
```

**Why good:** Type-safe response, reactive query params, watch triggers refetch on page change, SSR-safe hydration prevents double-fetching

### Bad Example - Raw $fetch in Setup

```vue
<script setup lang="ts">
// WRONG - Causes double-fetching (server + client)
const users = ref([])
users.value = await $fetch('/api/users')
</script>
```

**Why bad:** $fetch in setup runs on both server AND client, causing duplicate requests and hydration mismatch, no loading/error states

---

## useFetch with Transform

### Good Example - Data Transformation

```vue
<script setup lang="ts">
interface ApiPost {
  id: number
  title: string
  body: string
  userId: number
  createdAt: string
}

interface TransformedPost {
  id: number
  title: string
  preview: string
  authorId: number
}

const MAX_PREVIEW_LENGTH = 100

const { data: posts } = await useFetch<ApiPost[], TransformedPost[]>('/api/posts', {
  // Transform happens on server, smaller payload to client
  transform: (response) => response.map(post => ({
    id: post.id,
    title: post.title,
    preview: post.body.slice(0, MAX_PREVIEW_LENGTH) + '...',
    authorId: post.userId
  })),

  // Default value while loading
  default: () => []
})
</script>

<template>
  <article v-for="post in posts" :key="post.id">
    <h2>{{ post.title }}</h2>
    <p>{{ post.preview }}</p>
  </article>
</template>
```

**Why good:** Transform runs on server reducing client payload, default prevents null checks, typed input/output

---

## POST Requests with useFetch

### Good Example - Form Submission

```vue
<script setup lang="ts">
interface CreateUserPayload {
  name: string
  email: string
}

interface User {
  id: string
  name: string
  email: string
}

const form = reactive<CreateUserPayload>({
  name: '',
  email: ''
})

const { execute, status, error, data: createdUser } = useFetch<User>('/api/users', {
  method: 'POST',
  body: form,
  immediate: false, // Don't execute on mount
  watch: false // Don't re-execute when form changes
})

async function handleSubmit() {
  await execute()

  if (!error.value && createdUser.value) {
    navigateTo(`/users/${createdUser.value.id}`)
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.name" placeholder="Name" required />
    <input v-model="form.email" type="email" placeholder="Email" required />

    <button type="submit" :disabled="status === 'pending'">
      {{ status === 'pending' ? 'Creating...' : 'Create User' }}
    </button>

    <p v-if="error" class="error">{{ error.message }}</p>
  </form>
</template>
```

**Why good:** immediate: false for user-triggered actions, watch: false prevents unwanted re-execution, status for loading state, navigateTo for client-side redirect

---

## useAsyncData for Multiple Fetches

### Good Example - Parallel Data Loading

```vue
<script setup lang="ts">
interface DashboardData {
  users: { id: string; name: string }[]
  stats: { totalUsers: number; activeUsers: number }
  recentActivity: { action: string; timestamp: string }[]
}

const { data, pending, error } = await useAsyncData<DashboardData>(
  'dashboard', // Unique cache key
  async () => {
    // Parallel fetches in single SSR request
    const [users, stats, activity] = await Promise.all([
      $fetch('/api/users'),
      $fetch('/api/stats'),
      $fetch('/api/activity')
    ])

    return { users, stats, recentActivity: activity }
  }
)
</script>

<template>
  <div v-if="pending">Loading dashboard...</div>
  <div v-else-if="error">Error loading dashboard</div>
  <div v-else-if="data">
    <StatsCard :stats="data.stats" />
    <UserList :users="data.users" />
    <ActivityFeed :items="data.recentActivity" />
  </div>
</template>
```

**Why good:** Promise.all for parallel fetches, single cache key for combined data, $fetch inside useAsyncData is SSR-safe

### Bad Example - Sequential Fetches

```vue
<script setup lang="ts">
// WRONG - Sequential fetches (slow)
const { data: users } = await useFetch('/api/users')
const { data: stats } = await useFetch('/api/stats')
const { data: activity } = await useFetch('/api/activity')
// Each waits for the previous to complete
</script>
```

**Why bad:** Sequential await blocks SSR, total time = sum of all request times instead of max

---

## Reactive useAsyncData

### Good Example - Dynamic Key with Watch

```vue
<script setup lang="ts">
interface Product {
  id: string
  name: string
  price: number
  description: string
}

const route = useRoute()
const productId = computed(() => route.params.id as string)

const { data: product, error } = await useAsyncData(
  // Dynamic key - changes when productId changes
  () => `product-${productId.value}`,
  () => $fetch<Product>(`/api/products/${productId.value}`),
  { watch: [productId] }
)

// Handle 404
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Product not found'
  })
}
</script>

<template>
  <article v-if="product">
    <h1>{{ product.name }}</h1>
    <p class="price">${{ product.price }}</p>
    <p>{{ product.description }}</p>
  </article>
</template>
```

**Why good:** Dynamic cache key function, watch triggers refetch on route change, createError triggers error page

---

## Lazy Data Fetching

### Good Example - Non-Blocking Navigation

```vue
<script setup lang="ts">
interface Notification {
  id: string
  message: string
  read: boolean
}

// Lazy: Don't block navigation/SSR for non-critical data
const { data: notifications, pending } = await useFetch<Notification[]>('/api/notifications', {
  lazy: true,
  default: () => []
})
</script>

<template>
  <div class="notification-bell">
    <span v-if="pending" class="loading-indicator" />
    <span v-else class="badge">{{ notifications.length }}</span>
  </div>
</template>
```

**Why good:** lazy: true doesn't block navigation, default prevents null during loading, non-critical UI updates gracefully

---

## Server-Only Data Fetching

### Good Example - Server-Side Only with pick

```vue
<script setup lang="ts">
interface SecureUser {
  id: string
  name: string
  email: string
  internalNotes: string // Should not reach client
}

const { data: user } = await useFetch<SecureUser>('/api/admin/user/123', {
  server: true, // Fetch only on server
  pick: ['id', 'name', 'email'] // Only these fields sent to client
})
</script>

<template>
  <div v-if="user">
    <h1>{{ user.name }}</h1>
    <p>{{ user.email }}</p>
    <!-- user.internalNotes is NOT available -->
  </div>
</template>
```

**Why good:** server: true prevents client-side refetch, pick filters sensitive fields from client payload

---

## Quick Reference

| Option | Purpose | Use When |
|--------|---------|----------|
| `query` | Query parameters | Filtering, pagination |
| `watch` | Auto-refetch triggers | Reactive dependencies |
| `lazy` | Non-blocking fetch | Non-critical data |
| `immediate` | Auto-execute | false for user-triggered |
| `transform` | Shape response | Reduce payload, format data |
| `pick` | Select fields | Security, payload size |
| `default` | Loading fallback | Avoid null checks |
| `server` | Server-only fetch | Sensitive data, SEO-only |
