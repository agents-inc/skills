---
name: web-framework-vue-composition-api
description: Vue 3 Composition API patterns, reactivity primitives, composables, lifecycle hooks
---

# Vue 3 Composition API

> **Quick Guide:** Use `<script setup>` for all components. `ref()` for primitives, `reactive()` for objects. Extract reusable logic into composables (`use*` functions). Clean up side effects in `onUnmounted`. Use `defineModel()` for v-model (3.4+), `useTemplateRef()` for DOM refs (3.5+), `onWatcherCleanup()` to cancel stale async work (3.5+). Destructured props require getter wrappers in `watch()`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `<script setup>` syntax for all new Vue components)**

**(You MUST clean up all side effects (timers, listeners, subscriptions) in `onUnmounted`)**

**(You MUST use `ref()` for primitives and `reactive()` for objects - access ref values via `.value`)**

**(You MUST prefix all composable functions with `use` following Vue conventions)**

**(You MUST wrap destructured props in a getter for `watch()` - `watch(() => count, ...)` not `watch(count, ...)`)**

</critical_requirements>

---

**Auto-detection:** Vue 3 Composition API, script setup, ref, reactive, computed, watch, watchEffect, composables, onMounted, onUnmounted, defineProps, defineEmits, defineExpose, defineModel, useTemplateRef, useId, onWatcherCleanup, provide, inject, Suspense

**When to use:**

- Building Vue 3 components using Composition API
- Creating reusable composables (use\* functions)
- Managing reactive state with ref/reactive
- Handling component lifecycle and side effects
- TypeScript integration with Vue components

**Key patterns covered:**

- Script setup syntax and compiler macros (defineProps, defineEmits, defineExpose)
- Reactivity primitives (ref, reactive, computed, watch, watchEffect)
- Composables pattern for logic reuse
- defineModel() for v-model binding (Vue 3.4+)
- useTemplateRef(), useId(), onWatcherCleanup() (Vue 3.5+)
- Reactive props destructure with getter requirement (Vue 3.5+)
- Provide/Inject for dependency injection
- Async components and Suspense

**When NOT to use:**

- Components that don't benefit from logic extraction
- When team has no Composition API experience (consider gradual adoption)

---

<philosophy>

## Philosophy

The Composition API enables organizing code by **logical concern** rather than by option type (data, methods, computed). This makes complex components more maintainable and enables powerful logic reuse through composables.

**Core principles:**

1. **Composition over configuration** - Group related logic together instead of splitting across options
2. **Explicit reactivity** - State is explicitly reactive via `ref()` and `reactive()`
3. **Logic reuse via composables** - Extract and share stateful logic between components
4. **TypeScript-first** - Types flow naturally without excessive annotations

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Script Setup with Props and Emits

All variables/functions in `<script setup>` are automatically available in the template. Use TypeScript generics with `defineProps` and `defineEmits` for type-safe interfaces.

```vue
<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  userId: string;
  initialCount?: number;
}>();

const emit = defineEmits<{
  update: [value: number];
  submit: [];
}>();

const count = ref(props.initialCount ?? 0);
const doubleCount = computed(() => count.value * 2);

function increment() {
  count.value++;
  emit("update", count.value);
}
</script>
```

**Why good:** No explicit return needed, TypeScript types flow naturally, named tuple emit syntax (Vue 3.3+) self-documents payloads

See [examples/core.md](examples/core.md) for a complete component with loading/error handling.

---

### Pattern 2: Reactivity - ref vs reactive

`ref()` for primitives and reassignable values, `reactive()` for objects with nested properties. Access ref values via `.value` in script; templates unwrap automatically.

```typescript
const count = ref(0); // Primitive -> ref
count.value++; // .value in script

const state = reactive({
  // Nested object -> reactive
  user: null as User | null,
  settings: { theme: "light" },
});
state.settings.theme = "dark"; // Direct access, no .value
```

**Gotcha:** Destructuring `reactive()` loses reactivity - use `toRefs(state)` if you need to destructure.

See [examples/reactivity.md](examples/reactivity.md) for ref/reactive/computed patterns and anti-patterns.

---

### Pattern 3: Watch and WatchEffect

**Skip if using Nuxt — use useFetch or useAsyncData instead.**

`watch()` for explicit sources with access to old values. `watchEffect()` for automatic dependency tracking that runs immediately. Use `onWatcherCleanup()` (Vue 3.5+) to cancel stale async work.

```typescript
// watch: explicit source, access to old value
watch(searchQuery, async (newQuery, oldQuery) => {
  /* ... */
});

// watchEffect: auto-tracks dependencies, runs immediately
watchEffect(async () => {
  if (userId.value) userData.value = await fetchUser(userId.value);
});

// Cleanup: cancel stale requests (Vue 3.5+)
watch(searchQuery, async (query) => {
  const controller = new AbortController();
  onWatcherCleanup(() => controller.abort());
  const res = await fetch(`/api/search?q=${query}`, {
    signal: controller.signal,
  });
});
```

**Gotcha:** Watch reactive object properties with a getter: `watch(() => state.count, ...)` not `watch(state.count, ...)`.

See [examples/vue-3-5-features.md](examples/vue-3-5-features.md) for complete onWatcherCleanup patterns.

---

### Pattern 4: Lifecycle and Cleanup

Always pair `onMounted` setup with `onUnmounted` cleanup. Timers, listeners, observers, WebSockets - anything opened must be closed.

```typescript
const POLL_INTERVAL_MS = 5000;
let intervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
```

See [examples/lifecycle.md](examples/lifecycle.md) for WebSocket reconnection and event listener cleanup patterns.

---

### Pattern 5: Composables

Extract reusable stateful logic into `use*` functions. Return objects with refs (not bare values) so destructuring preserves reactivity.

```typescript
export function useCounter(options: UseCounterOptions = {}) {
  const { initialValue = 0, min = -Infinity, max = Infinity } = options;
  const count = ref(initialValue);
  const isAtMax = computed(() => count.value >= max);

  function increment() {
    if (count.value < max) count.value++;
  }
  function reset() {
    count.value = initialValue;
  }

  return { count, isAtMax, increment, reset }; // Return object with refs
}
```

**Async composables** should accept `MaybeRefOrGetter<T>` inputs (use `toValue()` to normalize) and return `{ data, error, isLoading }` refs.

See [examples/composables.md](examples/composables.md) for useFetch, useLocalStorage, useDebounce, and useIntersectionObserver implementations.

---

### Pattern 6: defineModel for v-model (Vue 3.4+)

Replaces the `defineProps` + `defineEmits` boilerplate for two-way binding. Returns a ref-like value that syncs with the parent.

```vue
<script setup lang="ts">
const model = defineModel<string>(); // Single v-model
const firstName = defineModel<string>("firstName"); // Named v-model
const [model, modifiers] = defineModel<string>({
  // With modifiers
  set(value) {
    return modifiers.capitalize
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
  },
});
</script>
```

See [examples/vue-3-5-features.md](examples/vue-3-5-features.md) for complete defineModel examples with named models and modifiers.

---

### Pattern 7: Template Refs (Vue 3.5+)

`useTemplateRef()` separates template refs from reactive refs. Use for dynamic ref names and in composables. Traditional `ref()` still works for simple static refs.

```vue
<script setup lang="ts">
const inputRef = useTemplateRef<HTMLInputElement>("myInput");
onMounted(() => inputRef.value?.focus());
</script>
<template>
  <input ref="myInput" type="text" />
</template>
```

**For child component refs:** Use `defineExpose()` to declare the public API, then `ref<InstanceType<typeof Child>>()` in the parent.

See [examples/define-expose.md](examples/define-expose.md) for form validation with exposed methods and [examples/vue-3-5-features.md](examples/vue-3-5-features.md) for useTemplateRef in composables.

---

### Pattern 8: useId for Accessible IDs (Vue 3.5+)

Generates SSR-safe unique IDs for form labels and ARIA attributes. Each call produces a different ID. Must be called in setup (not in computed).

```vue
<script setup lang="ts">
const id = useId();
</script>
<template>
  <label :for="id">Email</label>
  <input :id="id" type="email" />
</template>
```

See [examples/vue-3-5-features.md](examples/vue-3-5-features.md) for multi-field forms and ARIA patterns.

---

### Pattern 9: Reactive Props Destructure (Vue 3.5+)

Destructured props are automatically reactive. Use JavaScript default syntax instead of `withDefaults()`. The critical gotcha: destructured props require a getter wrapper in `watch()`.

```vue
<script setup lang="ts">
const {
  title,
  count = 0,
  items = () => [],
} = defineProps<{
  title: string;
  count?: number;
  items?: string[];
}>();

// CORRECT: getter wrapper
watch(
  () => count,
  (newCount) => {
    /* ... */
  },
);

// WRONG: passes value, not reactive source
// watch(count, ...) // Never triggers!
</script>
```

See [examples/vue-3-5-features.md](examples/vue-3-5-features.md) for complete reactive destructure examples.

---

### Pattern 10: Provide/Inject

Type-safe dependency injection to avoid prop drilling. Define `InjectionKey<T>` symbols in a separate file, provide in ancestor, inject in descendant with an explicit error for missing providers.

```typescript
// injection-keys.ts
export const THEME_KEY: InjectionKey<ThemeContext> = Symbol("theme");

// Provider: provide(THEME_KEY, { theme, toggleTheme });
// Consumer: const ctx = inject(THEME_KEY);
//           if (!ctx) throw new Error("Must be used within ThemeProvider");
```

See [examples/provide-inject.md](examples/provide-inject.md) for a complete theme provider/consumer pattern.

---

### Pattern 11: Async Components and Suspense

`defineAsyncComponent` for code-splitting. Top-level `await` in `<script setup>` makes a component async (requires `<Suspense>` in parent). Use `onErrorCaptured` at the Suspense boundary for error handling.

```typescript
const LOADING_DELAY_MS = 200;
const LOAD_TIMEOUT_MS = 10000;

const HeavyChart = defineAsyncComponent({
  loader: () => import("@/components/HeavyChart.vue"),
  loadingComponent: LoadingSpinner,
  delay: LOADING_DELAY_MS,
  timeout: LOAD_TIMEOUT_MS,
});
```

See [examples/async.md](examples/async.md) for Suspense boundaries with error handling.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Complete component, template refs, focus management
- [examples/reactivity.md](examples/reactivity.md) - ref, reactive, computed patterns and anti-patterns
- [examples/composables.md](examples/composables.md) - useFetch, useLocalStorage, useDebounce, useIntersectionObserver
- [examples/lifecycle.md](examples/lifecycle.md) - WebSocket, timers, event listeners, cleanup patterns
- [examples/provide-inject.md](examples/provide-inject.md) - Theme provider, typed injection keys
- [examples/define-expose.md](examples/define-expose.md) - Form field validation, parent-child coordination
- [examples/vue-3-5-features.md](examples/vue-3-5-features.md) - defineModel, useTemplateRef, useId, onWatcherCleanup, reactive destructure, deferred Teleport
- [examples/async.md](examples/async.md) - Lazy loading, Suspense, async setup
- [reference.md](reference.md) - Decision frameworks, TypeScript patterns, anti-patterns, checklists

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing cleanup in `onUnmounted` - timers, listeners, subscriptions, WebSockets cause memory leaks
- Accessing `ref.value` in template - templates auto-unwrap refs, writing `.value` in templates is wrong
- Destructuring `reactive()` without `toRefs()` - loses reactivity silently
- Watching destructured prop directly - `watch(count, ...)` never triggers, use `watch(() => count, ...)`

**Medium Priority Issues:**

- Watch without async cleanup - causes race conditions; use `onWatcherCleanup()` (3.5+) or the cleanup callback
- Using `provide()` with string keys instead of typed `InjectionKey<T>` symbols - loses type safety
- Returning bare values from composables instead of an object with refs - breaks destructuring reactivity

**Gotchas & Edge Cases:**

- Refs in reactive objects are auto-unwrapped at root level, but NOT in arrays or Map/Set
- `watchEffect` runs immediately; `watch` is lazy by default
- Computed values are read-only by default; use getter/setter object for writable computed
- Top-level `await` makes a component async and requires `<Suspense>` in parent
- Provide values are not reactive by default - wrap in `ref()` or `reactive()` if consumers need reactivity
- `onUnmounted` won't run if component errors during setup - use error boundaries for critical cleanup
- `useId()` must not be called in computed - it generates a new ID each call
- `defineModel` returns a ref - use `.value` in script, auto-unwrapped in template

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `<script setup>` syntax for all new Vue components)**

**(You MUST clean up all side effects (timers, listeners, subscriptions) in `onUnmounted`)**

**(You MUST use `ref()` for primitives and `reactive()` for objects - access ref values via `.value`)**

**(You MUST prefix all composable functions with `use` following Vue conventions)**

**(You MUST wrap destructured props in a getter for `watch()` - `watch(() => count, ...)` not `watch(count, ...)`)**

**Failure to follow these rules will cause memory leaks, broken reactivity, and unmaintainable component APIs.**

</critical_reminders>
