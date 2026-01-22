# Vue 3 Composition API - Composables Examples

> Reusable composition functions. See [SKILL.md](../SKILL.md) for concepts.

---

## useFetch Composable

### Good Example - useFetch implementation

```typescript
// composables/use-fetch.ts
import {
  ref,
  toValue,
  watchEffect,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export interface UseFetchOptions {
  immediate?: boolean;
  refetchOnUrlChange?: boolean;
}

export interface UseFetchReturn<T> {
  data: Ref<T | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  execute: () => Promise<void>;
}

const DEFAULT_OPTIONS: UseFetchOptions = {
  immediate: true,
  refetchOnUrlChange: true,
};

export function useFetch<T = unknown>(
  url: MaybeRefOrGetter<string>,
  options: UseFetchOptions = {},
): UseFetchReturn<T> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function execute() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(toValue(url));

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`,
        );
      }

      data.value = await response.json();
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
      data.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  if (mergedOptions.refetchOnUrlChange) {
    watchEffect(() => {
      // Track URL dependency
      toValue(url);
      execute();
    });
  } else if (mergedOptions.immediate) {
    execute();
  }

  return {
    data,
    error,
    isLoading,
    execute,
  };
}
```

**Why good:** Accepts reactive or plain URLs via MaybeRefOrGetter, configurable behavior via options, returns refs for reactivity, explicit execute for manual refetch, proper error typing

### Good Example - useFetch usage

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { useFetch } from "@/composables/use-fetch";

interface Post {
  id: number;
  title: string;
  body: string;
}

const API_BASE = "/api";
const postId = ref(1);

// Reactive URL - refetches when postId changes
const postUrl = computed(() => `${API_BASE}/posts/${postId.value}`);

const { data: post, isLoading, error } = useFetch<Post>(postUrl);

function loadNext() {
  postId.value++;
}
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <article v-else-if="post">
      <h1>{{ post.title }}</h1>
      <p>{{ post.body }}</p>
    </article>
    <button @click="loadNext">Load Next</button>
  </div>
</template>
```

**Why good:** Computed URL creates reactive dependency, automatic refetch on postId change, destructuring renames avoid conflicts, clean template with v-if chain

---

## useLocalStorage Composable

### Good Example - useLocalStorage implementation

```typescript
// composables/use-local-storage.ts
import { ref, watch, type Ref } from "vue";

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  // Initialize from storage or default
  const storedValue = localStorage.getItem(key);
  const initialValue =
    storedValue !== null ? (JSON.parse(storedValue) as T) : defaultValue;

  const data = ref<T>(initialValue) as Ref<T>;

  // Sync to storage on change
  watch(
    data,
    (newValue) => {
      if (newValue === null || newValue === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    },
    { deep: true },
  );

  return data;
}
```

**Why good:** Type-safe with generics, initializes from storage, syncs changes automatically, handles null/undefined for removal, deep watch for nested changes

---

## useDebounce Composable

### Good Example - useDebounce implementation

```typescript
// composables/use-debounce.ts
import {
  ref,
  watch,
  onUnmounted,
  type Ref,
  type MaybeRefOrGetter,
  toValue,
} from "vue";

const DEFAULT_DELAY_MS = 300;

export function useDebounce<T>(
  value: MaybeRefOrGetter<T>,
  delay: number = DEFAULT_DELAY_MS,
): Ref<T> {
  const debouncedValue = ref<T>(toValue(value)) as Ref<T>;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  watch(
    () => toValue(value),
    (newValue) => {
      cleanup();
      timeoutId = setTimeout(() => {
        debouncedValue.value = newValue;
      }, delay);
    },
  );

  // Clean up on unmount
  onUnmounted(cleanup);

  return debouncedValue;
}
```

**Why good:** Accepts ref or plain value via MaybeRefOrGetter, named constant for default delay, proper cleanup on unmount, generic type preservation

---

## useIntersectionObserver Composable

### Good Example - useIntersectionObserver implementation

```typescript
// composables/use-intersection-observer.ts
import { ref, onMounted, onUnmounted, type Ref } from "vue";

const DEFAULT_THRESHOLD = 0.1;

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useIntersectionObserver(
  targetRef: Ref<HTMLElement | null>,
  callback: (isIntersecting: boolean) => void,
  options: UseIntersectionObserverOptions = {},
): { isIntersecting: Ref<boolean> } {
  const isIntersecting = ref(false);
  let observer: IntersectionObserver | null = null;

  const { threshold = DEFAULT_THRESHOLD, rootMargin = "0px" } = options;

  onMounted(() => {
    if (!targetRef.value) return;

    observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting.value = entry.isIntersecting;
        callback(entry.isIntersecting);
      },
      { threshold, rootMargin },
    );

    observer.observe(targetRef.value);
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  return { isIntersecting };
}
```

**Why good:** Encapsulates observer lifecycle, configurable via options, returns reactive isIntersecting state, proper cleanup on unmount

---

## See Also

- [lifecycle.md](lifecycle.md) - Resource cleanup patterns
- [core.md](core.md) - Using composables in components
