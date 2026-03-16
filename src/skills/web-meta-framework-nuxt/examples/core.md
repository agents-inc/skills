# Nuxt - Core Examples

> Essential patterns for routing, layouts, error handling, and auto-imports. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Page with Data Fetching

### Good Example - Dynamic Route Page

```vue
<!-- pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute();
const slug = route.params.slug as string;

const { data: post, error } = await useFetch(`/api/posts/${slug}`);

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Post not found",
  });
}
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <div v-html="post.content" />
  </article>
</template>
```

**Why good:** Dynamic segment via bracket syntax, useFetch for SSR-safe data, createError triggers error page

### Bad Example - Raw $fetch in Setup

```vue
<script setup lang="ts">
// WRONG - Runs on both server AND client = double fetch
const post = ref(null);
post.value = await $fetch(`/api/posts/${route.params.slug}`);
</script>
```

**Why bad:** $fetch in setup causes duplicate requests, no loading/error states, hydration mismatch

---

## Pattern 2: Catch-All Route

### Good Example - Documentation Hierarchy

```vue
<!-- pages/docs/[...slug].vue -->
<script setup lang="ts">
const route = useRoute();
// slug is array: ['guide', 'getting-started'] for /docs/guide/getting-started
const slugArray = route.params.slug as string[];
const path = slugArray.join("/");

const { data: doc } = await useFetch(`/api/docs/${path}`);
</script>

<template>
  <div v-if="doc">
    <h1>{{ doc.title }}</h1>
    <div v-html="doc.content" />
  </div>
</template>
```

**Why good:** Catch-all with `[...slug]` handles nested paths, slug is array of segments

---

## Pattern 3: Layout with Auth-Aware Navigation

### Good Example - Default Layout

```vue
<!-- layouts/default.vue -->
<script setup lang="ts">
const { isLoggedIn, user } = useUser();
</script>

<template>
  <div class="layout">
    <header>
      <nav>
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
        <template v-if="isLoggedIn">
          <span>{{ user?.name }}</span>
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
        </template>
        <NuxtLink v-else to="/login">Login</NuxtLink>
      </nav>
    </header>

    <main>
      <slot />
    </main>

    <footer>
      <p>&copy; 2025 My App</p>
    </footer>
  </div>
</template>
```

**Why good:** `<slot />` renders page content, composables work in layouts, NuxtLink provides prefetching

---

## Pattern 4: Custom Layout with definePageMeta

### Good Example - Admin Layout

```vue
<!-- layouts/admin.vue -->
<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <NuxtLink to="/admin">Dashboard</NuxtLink>
      <NuxtLink to="/admin/users">Users</NuxtLink>
      <NuxtLink to="/admin/settings">Settings</NuxtLink>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>
```

```vue
<!-- pages/admin/index.vue -->
<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "auth",
});
</script>

<template>
  <div>Admin Dashboard</div>
</template>
```

**Why good:** definePageMeta selects layout and attaches middleware in one place

---

## Pattern 5: Dynamic Layout Switching

### Good Example - Conditional Layout

```vue
<!-- app.vue -->
<script setup lang="ts">
const route = useRoute();
const layout = computed(() => {
  return route.query.print ? "print" : "default";
});
</script>

<template>
  <NuxtLayout :name="layout">
    <NuxtPage />
  </NuxtLayout>
</template>
```

**Why good:** `NuxtLayout` with dynamic `:name`, reactive layout switching based on query params

---

## Pattern 6: Error Page

### Good Example - Global Error Handler

```vue
<!-- error.vue (root level, NOT in pages/) -->
<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{
  error: NuxtError;
}>();

const handleError = () => clearError({ redirect: "/" });

const HTTP_NOT_FOUND = 404;
</script>

<template>
  <div class="error-page">
    <h1>
      {{ error.statusCode === HTTP_NOT_FOUND ? "Page Not Found" : "Error" }}
    </h1>
    <p>{{ error.message }}</p>
    <button @click="handleError">Go Home</button>
  </div>
</template>
```

**Why good:** Root-level error.vue catches all unhandled errors, clearError for recovery with redirect, typed error props

---

## Pattern 7: NuxtErrorBoundary

### Good Example - Component-Level Error Isolation

```vue
<template>
  <NuxtErrorBoundary @error="handleError">
    <RiskyComponent />

    <template #error="{ error, clearError }">
      <div class="error-boundary">
        <p>Component failed: {{ error.message }}</p>
        <button @click="clearError">Retry</button>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
function handleError(error: Error) {
  console.error("Caught error:", error);
}
</script>
```

**Why good:** Component-level isolation prevents full-page errors, clearError enables retry, @error for logging

---

## Pattern 8: SEO with useSeoMeta

### Good Example - Dynamic SEO for Blog Posts

```vue
<script setup lang="ts">
const route = useRoute();
const { data: post } = await useFetch(`/api/posts/${route.params.slug}`);

useSeoMeta({
  title: () => post.value?.title ?? "Blog Post",
  description: () => post.value?.excerpt ?? "",
  ogTitle: () => post.value?.title ?? "Blog Post",
  ogDescription: () => post.value?.excerpt ?? "",
  ogImage: () => post.value?.coverImage ?? "/default-og.png",
  ogType: "article",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <article v-if="post">
    <h1>{{ post.title }}</h1>
    <img :src="post.coverImage" :alt="post.title" />
    <div v-html="post.content" />
  </article>
</template>
```

**Why good:** Reactive getter functions, type-safe property names, automatic Open Graph and Twitter cards, SSR-rendered

---

## Pattern 9: useHead with Title Template

### Good Example - Consistent Page Titles

```vue
<script setup lang="ts">
const SITE_NAME = "My App";

useHead({
  title: "About Us",
  titleTemplate: (title) => `${title} | ${SITE_NAME}`,
  meta: [{ name: "description", content: "Learn about our company" }],
  link: [{ rel: "canonical", href: "https://example.com/about" }],
});
</script>
```

**Why good:** titleTemplate for consistent formatting across all pages, composable API, SSR-rendered

---

## Pattern 10: Plugins

### Good Example - Configured API Client Plugin

```typescript
// plugins/api.ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      const token = useCookie("token");
      if (token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token.value}`,
        };
      }
    },
  });

  return { provide: { api } };
});
```

```vue
<script setup lang="ts">
const { $api } = useNuxtApp();
const { data } = await useAsyncData("users", () => $api("/users"));
</script>
```

**Why good:** $fetch.create for configured client, useRuntimeConfig for environment values, useCookie for auth tokens, provide/inject pattern

### Good Example - Client-Only Plugin

```typescript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  // .client suffix = runs only in browser
  const analytics = initializeAnalytics();
  return { provide: { analytics } };
});
```

**Why good:** `.client.ts` suffix restricts to browser, `.server.ts` for server-only

---

## Pattern 11: Runtime Config for Secrets

### Good Example - Separating Public and Private Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Private (server-only) -- never exposed to client
    apiKey: process.env.API_KEY,
    dbUrl: process.env.DATABASE_URL,

    // Public (available in client)
    public: {
      apiBase: process.env.API_BASE_URL,
    },
  },
});
```

```typescript
// server/api/data.ts -- server-only access
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  // Safe: config.apiKey only available server-side
  const response = await $fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  return response;
});
```

**Why good:** Private keys never reach client, public keys available everywhere, environment variable mapping

---

## File Conventions Quick Reference

| Directory            | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `pages/`             | File-based routing (auto-generates routes)    |
| `server/api/`        | API routes (prefixed with `/api`)             |
| `server/routes/`     | Server routes (no prefix)                     |
| `server/middleware/` | Server middleware (runs on every request)     |
| `middleware/`        | Route middleware (client + server navigation) |
| `layouts/`           | Page layouts (wrap pages via `<slot />`)      |
| `components/`        | Vue components (auto-imported)                |
| `composables/`       | Composables (auto-imported, `use*` prefix)    |
| `plugins/`           | Nuxt plugins (run before app creation)        |
| `utils/`             | Utility functions (auto-imported)             |
| `assets/`            | Build-processed assets (styles, images)       |
| `public/`            | Static assets (served as-is)                  |
