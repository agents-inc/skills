# Nuxt — Core

> Pages, layouts, error handling, SEO composables, plugins and runtime config. Fetching options are
> in [data-fetching.md](data-fetching.md); guards are in [middleware.md](middleware.md).

---

## Pattern 1: Page with Data Fetching

### Good Example — a dynamic route

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

**Why good:** The 404 is decided during SSR, so a crawler and a user both get a real 404 status rather
than a page that renders empty.

### Bad Example — a bare $fetch in setup

```vue
<script setup lang="ts">
// WRONG - Runs on both server AND client = double fetch
const post = ref(null);
post.value = await $fetch(`/api/posts/${route.params.slug}`);
</script>
```

**Why bad:** Setup runs on the server and again during hydration, so the endpoint is hit twice — and
there is no `pending` or `error` to render in the gap.

---

## Pattern 2: Catch-All Route

### Good Example — a documentation hierarchy

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

**Why good:** One file serves every depth under `/docs`, and `params.slug` arrives as an array of
segments rather than a string to split.

---

## Pattern 3: Layout with Auth-Aware Navigation

### Good Example — the default layout

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

**Why good:** Composables work in a layout exactly as in a page, so the navigation reads the auth
state directly rather than being passed it. `NuxtLink` prefetches the destination when it scrolls into
view.

---

## Pattern 4: Custom Layout with definePageMeta

### Good Example — an admin layout

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

**Why good:** Layout and guard are declared together at the top of the page, so what protects a route
and what wraps it are visible in one place.

---

## Pattern 5: Dynamic Layout Switching

### Good Example — choosing a layout at runtime

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

**Why good:** `definePageMeta` is static, so a layout that depends on the URL has to be chosen through
`<NuxtLayout :name>` in `app.vue` instead.

---

## Pattern 6: Error Page

### Good Example — the root error handler

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

**Why good:** `error.vue` sits beside `app.vue` rather than inside `pages/`, because it replaces the
whole app rather than rendering as a route. `clearError` is the only way back — navigating alone
leaves the error state in place.

---

## Pattern 7: NuxtErrorBoundary

### Good Example — isolating one component's failure

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

**Why good:** One failing widget renders its own fallback instead of taking the page to `error.vue`,
and the slot's own `clearError` retries just that subtree.

---

## Pattern 8: SEO with useSeoMeta

### Good Example — metadata that tracks the post

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

**Why good:** The getters mean the tags update when `post` resolves rather than freezing at whatever
was there on the first render, and the flat property names are type-checked against the Open Graph
and Twitter vocabularies.

---

## Pattern 9: useHead with Title Template

### Good Example — consistent page titles

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

**Why good:** `titleTemplate` set once in a layout gives every page the suffix for the cost of its own
bare title. `useHead` is the escape hatch for anything `useSeoMeta` has no flat name for, such as
`link`.

---

## Pattern 10: Plugins

### Good Example — a configured client

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

**Why good:** The base URL and the auth header are attached once, at startup, so no call site repeats
them — and `onRequest` reads the cookie per request rather than capturing whatever it held at boot.

### Good Example — a browser-only plugin

```typescript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  // .client suffix = runs only in browser
  const analytics = initializeAnalytics();
  return { provide: { analytics } };
});
```

**Why good:** The suffix keeps browser-only code out of the server bundle entirely, rather than
guarding it with a runtime check that still ships.

---

## Pattern 11: Runtime Config for Secrets

### Good Example — separating public and private config

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

**Why good:** Everything outside `public` is stripped from the client bundle, so the split is the
security boundary — a secret that ends up under `public` is a secret in the browser.

---

_Fetching options are in [data-fetching.md](data-fetching.md); guards are in
[middleware.md](middleware.md); shared state is in [state-management.md](state-management.md)._
