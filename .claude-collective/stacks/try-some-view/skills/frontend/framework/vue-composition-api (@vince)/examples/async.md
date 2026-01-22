# Vue 3 Composition API - Async Examples

> Async components, code splitting, and Suspense. See [SKILL.md](../SKILL.md) for concepts.

---

## Lazy Loaded Components

### Good Example - defineAsyncComponent for routes

```typescript
// router/index.ts
import { defineAsyncComponent } from "vue";

const LOADING_DELAY_MS = 200;

// Lazy load heavy components
const Dashboard = defineAsyncComponent({
  loader: () => import("@/views/Dashboard.vue"),
  delay: LOADING_DELAY_MS,
});

const Analytics = defineAsyncComponent({
  loader: () => import("@/views/Analytics.vue"),
  delay: LOADING_DELAY_MS,
});
```

**Why good:** Code splitting reduces initial bundle, delay prevents loading flicker for fast loads

---

## Async Components with Error Handling

### Good Example - Full async component configuration

```vue
<!-- App.vue -->
<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import ErrorBoundary from "@/components/ErrorBoundary.vue";

const LOAD_TIMEOUT_MS = 10000;

const HeavyChart = defineAsyncComponent({
  loader: () => import("@/components/HeavyChart.vue"),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorBoundary,
  delay: 200,
  timeout: LOAD_TIMEOUT_MS,
});

const showChart = ref(false);
</script>

<template>
  <div>
    <button @click="showChart = true">Load Chart</button>
    <HeavyChart v-if="showChart" />
  </div>
</template>
```

**Why good:** Code splitting reduces initial bundle, loading component prevents layout shift, error component handles load failures, delay prevents loading flicker, named constants for configuration

---

## Suspense with Async Setup

### Good Example - Component with top-level await

```vue
<!-- AsyncUserList.vue -->
<script setup lang="ts">
import type { User } from "@/types";

const props = defineProps<{
  teamId: string;
}>();

// Top-level await makes this async
const response = await fetch(`/api/teams/${props.teamId}/users`);
if (!response.ok) {
  throw new Error(`Failed to fetch users: ${response.status}`);
}
const users: User[] = await response.json();
</script>

<template>
  <ul>
    <li v-for="user in users" :key="user.id">
      {{ user.name }}
    </li>
  </ul>
</template>
```

**Why good:** Top-level await simplifies async data fetching, error handling with throw, clean template without loading states

---

## Suspense Boundary

### Good Example - Parent with Suspense and error handling

```vue
<!-- TeamPage.vue -->
<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";
import AsyncUserList from "./AsyncUserList.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";

const props = defineProps<{
  teamId: string;
}>();

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err;
  return false; // Don't propagate
});
</script>

<template>
  <div>
    <h1>Team Members</h1>

    <div v-if="error" class="error">Failed to load: {{ error.message }}</div>

    <Suspense v-else>
      <template #default>
        <AsyncUserList :team-id="teamId" />
      </template>
      <template #fallback>
        <LoadingSpinner />
      </template>
    </Suspense>
  </div>
</template>
```

**Why good:** Suspense coordinates loading state, onErrorCaptured handles errors at boundary, clean separation of loading/error/content states

---

## Decision Framework

```
Need to lazy load a component?
├─ Is it a route-level component?
│   └─ YES → defineAsyncComponent in router
└─ Is it conditionally rendered?
    └─ YES → defineAsyncComponent with v-if trigger

Component has async data fetching?
├─ Simple one-time fetch?
│   └─ YES → Top-level await + Suspense
└─ Complex fetching with refetch?
    └─ YES → useFetch composable (see composables.md)

Need error handling for async component?
├─ YES → Wrap with Suspense + onErrorCaptured
└─ NO → defineAsyncComponent errorComponent option
```

---

## See Also

- [composables.md](composables.md) - useFetch for data fetching
- [lifecycle.md](lifecycle.md) - Cleanup for async operations
