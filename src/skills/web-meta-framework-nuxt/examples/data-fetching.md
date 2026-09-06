# Nuxt — Data Fetching

> `useFetch`, `useAsyncData` and the options that shape what reaches the client. The full option
> table is in [reference.md](../reference.md).

---

## useFetch for API Calls

### Good Example - Typed API Response

```vue
<script setup lang="ts">
interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

const USERS_ENDPOINT = "/api/users";
const DEFAULT_LIMIT = 20;

const page = ref(1);

const {
  data: users,
  pending,
  error,
  refresh,
} = await useFetch<User[]>(USERS_ENDPOINT, {
  query: {
    page,
    limit: DEFAULT_LIMIT,
  },
  // Refetch when page changes
  watch: [page],
});
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

**Why good:** `page` is a ref inside `query`, so incrementing it refetches without any explicit call —
and the server's result is carried into hydration, so the first render costs one request rather than
two.

### Bad Example — a bare $fetch in setup

```vue
<script setup lang="ts">
// WRONG - Causes double-fetching (server + client)
const users = ref([]);
users.value = await $fetch("/api/users");
</script>
```

**Why bad:** Setup runs on the server and again during hydration, so the endpoint is hit twice for one
page view — and there is no `pending` or `error` to render in between.

---

## useFetch with Transform

### Good Example — reshaping the response

```vue
<script setup lang="ts">
interface ApiPost {
  id: number;
  title: string;
  body: string;
  userId: number;
  createdAt: string;
}

interface TransformedPost {
  id: number;
  title: string;
  preview: string;
  authorId: number;
}

const MAX_PREVIEW_LENGTH = 100;

const { data: posts } = await useFetch<ApiPost[], TransformedPost[]>(
  "/api/posts",
  {
    // Transform happens on server, smaller payload to client
    transform: (response) =>
      response.map((post) => ({
        id: post.id,
        title: post.title,
        preview: post.body.slice(0, MAX_PREVIEW_LENGTH) + "...",
        authorId: post.userId,
      })),

    // Default value while loading
    default: () => [],
  },
);
</script>

<template>
  <article v-for="post in posts" :key="post.id">
    <h2>{{ post.title }}</h2>
    <p>{{ post.preview }}</p>
  </article>
</template>
```

**Why good:** The transform runs on the server, so the full article bodies never travel to the client
— only the previews do. `default` means the template never has to guard against `undefined`.

---

## POST Requests with useFetch

### Good Example — a form submission

```vue
<script setup lang="ts">
interface CreateUserPayload {
  name: string;
  email: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const form = reactive<CreateUserPayload>({
  name: "",
  email: "",
});

const {
  execute,
  status,
  error,
  data: createdUser,
} = useFetch<User>("/api/users", {
  method: "POST",
  body: form,
  immediate: false, // Don't execute on mount
  watch: false, // Don't re-execute when form changes
});

async function handleSubmit() {
  await execute();

  if (!error.value && createdUser.value) {
    navigateTo(`/users/${createdUser.value.id}`);
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.name" placeholder="Name" required />
    <input v-model="form.email" type="email" placeholder="Email" required />

    <button type="submit" :disabled="status === 'pending'">
      {{ status === "pending" ? "Creating..." : "Create User" }}
    </button>

    <p v-if="error" class="error">{{ error.message }}</p>
  </form>
</template>
```

**Why good:** `immediate: false` stops the POST firing on mount, and `watch: false` stops every
keystroke in the form re-sending it — both are needed, since `body` is reactive.

---

## useAsyncData for Multiple Fetches

### Good Example — parallel loading

```vue
<script setup lang="ts">
interface DashboardData {
  users: { id: string; name: string }[];
  stats: { totalUsers: number; activeUsers: number };
  recentActivity: { action: string; timestamp: string }[];
}

const { data, pending, error } = await useAsyncData<DashboardData>(
  "dashboard", // Unique cache key
  async () => {
    // Parallel fetches in single SSR request
    const [users, stats, activity] = await Promise.all([
      $fetch("/api/users"),
      $fetch("/api/stats"),
      $fetch("/api/activity"),
    ]);

    return { users, stats, recentActivity: activity };
  },
);
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

**Why good:** `$fetch` inside `useAsyncData` is the one place a bare `$fetch` belongs — the composable
owns the hydration transfer, so the three calls happen once, on the server, at the same time.

### Bad Example — sequential fetches

```vue
<script setup lang="ts">
// WRONG - Sequential fetches (slow)
const { data: users } = await useFetch("/api/users");
const { data: stats } = await useFetch("/api/stats");
const { data: activity } = await useFetch("/api/activity");
// Each waits for the previous to complete
</script>
```

**Why bad:** Each `await` blocks the next, so the page waits for the sum of the three round trips
instead of the longest one.

---

## Reactive useAsyncData

### Good Example — a key that tracks the route

```vue
<script setup lang="ts">
interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

const route = useRoute();
const productId = computed(() => route.params.id as string);

const { data: product, error } = await useAsyncData(
  // Dynamic key - changes when productId changes
  () => `product-${productId.value}`,
  () => $fetch<Product>(`/api/products/${productId.value}`),
  { watch: [productId] },
);

// Handle 404
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Product not found",
  });
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

**Why good:** The key is a function of the route param, so navigating between two products gets two
cache entries rather than one stale one — which is the defect a static key produces here.

---

## Lazy Data Fetching

### Good Example — not blocking navigation

```vue
<script setup lang="ts">
interface Notification {
  id: string;
  message: string;
  read: boolean;
}

// Lazy: Don't block navigation/SSR for non-critical data
const { data: notifications, pending } = await useFetch<Notification[]>(
  "/api/notifications",
  {
    lazy: true,
    default: () => [],
  },
);
</script>

<template>
  <div class="notification-bell">
    <span v-if="pending" class="loading-indicator" />
    <span v-else class="badge">{{ notifications.length }}</span>
  </div>
</template>
```

**Why good:** A notification badge is not worth delaying the page for. `lazy: true` lets the
navigation complete and the count arrive afterwards, with `default` covering the gap.

---

## Server-Only Data Fetching

### Good Example — server: true plus pick

```vue
<script setup lang="ts">
interface SecureUser {
  id: string;
  name: string;
  email: string;
  internalNotes: string; // Should not reach client
}

const { data: user } = await useFetch<SecureUser>("/api/admin/user/123", {
  server: true, // Fetch only on server
  pick: ["id", "name", "email"], // Only these fields sent to client
});
</script>

<template>
  <div v-if="user">
    <h1>{{ user.name }}</h1>
    <p>{{ user.email }}</p>
    <!-- user.internalNotes is NOT available -->
  </div>
</template>
```

**Why good:** `pick` runs before the payload is serialised into the HTML, so `internalNotes` is never
in the page source — filtering it in the template would leave it there for anyone reading the markup.

---

_The full option table is in [reference.md](../reference.md)._
