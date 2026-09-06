---
name: web-framework-vue-composition-api
description: Vue 3 Composition API — reactivity primitives, composables, lifecycle, the 3.4+ and 3.5+ macros. Load when writing Vue 3 components or composables.
---

# Vue 3 Composition API

> **Quick Guide:** `<script setup>` for every component. `ref()` for primitives and anything reassigned, `reactive()` for an object mutated in place. Reusable stateful logic goes into a `use*` composable that returns an object of refs. Everything opened in `onMounted` is closed in `onUnmounted`. The 3.4+ and 3.5+ macros — `defineModel()`, `useTemplateRef()`, `useId()`, `onWatcherCleanup()` — replace whole patterns that preceded them, and destructured props need a getter wrapper in `watch()`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a complete component, template refs, focus management
- [examples/reactivity.md](examples/reactivity.md) — `ref`, `reactive`, `computed` and their anti-patterns
- [examples/composables.md](examples/composables.md) — useFetch, useLocalStorage, useDebounce, useIntersectionObserver
- [examples/lifecycle.md](examples/lifecycle.md) — WebSockets, timers, event listeners, cleanup
- [examples/provide-inject.md](examples/provide-inject.md) — theme provider, typed injection keys
- [examples/define-expose.md](examples/define-expose.md) — form field validation, parent-child coordination
- [examples/vue-3-5-features.md](examples/vue-3-5-features.md) — defineModel, useTemplateRef, useId, onWatcherCleanup, reactive destructure, deferred Teleport
- [examples/async.md](examples/async.md) — lazy loading, Suspense, async setup
- [reference.md](reference.md) — decision trees, anti-patterns with corrected code, checklists, TypeScript patterns

---

## Which path applies

- **Vue on its own** — component data fetching goes through `watch`/`watchEffect` or an async composable, as Patterns 3 and 5 describe.
- **Vue under a meta-framework** — the framework owns fetching, caching and SSR-safe hydration through its own composables; take Patterns 1, 2, 4 and 6–11 unchanged and let it handle the rest.

---

<critical_requirements>

## Before writing Vue code

**Write components as `<script setup>`.** Bindings reach the template with no return statement, and the compiler macros — `defineProps`, `defineEmits`, `defineModel` — only exist inside it.

**Pair every `onMounted` setup with an `onUnmounted` teardown.** Timers, listeners, observers and sockets outlive the component otherwise, and nothing reports it.

**Pick `ref()` for primitives and anything you will reassign, `reactive()` for an object you mutate in place.** A reassigned `reactive` variable leaves the old proxy behind, still wired to the template.

**Prefix a composable with `use`.** The convention is what tells a reader — and the linter — that the function may call lifecycle hooks and must run during setup.

**Wrap a destructured prop in a getter for `watch()` — `watch(() => count, …)`.** Passing the value itself hands `watch` a number, which it can never see change.

</critical_requirements>

---

**Auto-detection:** Vue 3 Composition API, script setup, ref, reactive, computed, watch, watchEffect, composables, onMounted, onUnmounted, defineProps, defineEmits, defineExpose, defineModel, useTemplateRef, useId, onWatcherCleanup, provide, inject, InjectionKey, Suspense, toRefs, toValue, MaybeRefOrGetter

**Applies to:**

- Reactive state with `ref`, `reactive`, `computed`, `watch` and `watchEffect`
- Component contracts: props, emits, exposed methods, v-model
- Composables for reusable stateful logic
- Lifecycle and cleanup
- Provide/inject, async components and Suspense

**Handled elsewhere:**

- Styling — a `<style scoped>` block is Vue's, and which CSS approach fills it is not settled here
- Application-wide state stores that outlive a component tree
- Server-state caching, invalidation and request deduplication
- Routing, and the data a route loads
- Test doubles for the network

---

<philosophy>

## Philosophy

The Composition API groups code by the concern it serves rather than by the kind of thing it is. One feature's state, its derived values, its watcher and its cleanup sit together and can be lifted out whole into a composable — where the Options API scattered the same feature across `data`, `computed`, `methods` and `mounted`, and offered no way to move it.

That is what makes a composable the unit of reuse: it is a plain function that happens to call reactive primitives, so it composes, takes arguments and returns whatever shape suits — no mixin merge order, no name collisions.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Script setup, props and emits

`defineProps` and `defineEmits` take type arguments, so the contract is declared once and checked at both ends.

```vue
<script setup lang="ts">
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
</script>
```

The named-tuple emit syntax (3.3+) documents each payload in the type itself.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: ref and reactive

```typescript
const count = ref(0);
count.value++;

const state = reactive({
  user: null as User | null,
  settings: { theme: "light" },
});
state.settings.theme = "dark";
```

`.value` in script, unwrapped in template. Destructuring a `reactive` object copies its values out of the proxy — `toRefs(state)` is what keeps them connected.

Full code: [examples/reactivity.md](examples/reactivity.md)

---

### Pattern 3: watch and watchEffect

`watch` names its source and gives you the previous value; `watchEffect` tracks whatever it reads and runs immediately. `onWatcherCleanup()` (3.5+) cancels work the next run supersedes.

```typescript
watch(searchQuery, async (newQuery, oldQuery) => {
  /* … */
});

watchEffect(async () => {
  if (userId.value) userData.value = await fetchUser(userId.value);
});

watch(searchQuery, async (query) => {
  const controller = new AbortController();
  onWatcherCleanup(() => controller.abort());
  await fetch(`/api/search?q=${query}`, { signal: controller.signal });
});
```

A property of a `reactive` object is watched through a getter — `watch(() => state.count, …)`.

Full code: [examples/vue-3-5-features.md](examples/vue-3-5-features.md)

---

### Pattern 4: Lifecycle and cleanup

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

Full code: [examples/lifecycle.md](examples/lifecycle.md)

---

### Pattern 5: Composables

A composable returns an object of refs, so a caller can destructure it without flattening the reactivity.

```typescript
export function useCounter(options: UseCounterOptions = {}) {
  const { initialValue = 0, max = Infinity } = options;
  const count = ref(initialValue);
  const isAtMax = computed(() => count.value >= max);

  function increment() {
    if (count.value < max) count.value++;
  }

  return { count, isAtMax, increment };
}
```

An async composable takes `MaybeRefOrGetter<T>` inputs, normalises them with `toValue()`, and returns `{ data, error, isLoading }` — so a caller can pass a ref, a getter or a plain value interchangeably.

Full code: [examples/composables.md](examples/composables.md)

---

### Pattern 6: defineModel for v-model (3.4+)

Returns a ref that reads the prop and emits the update, replacing the `defineProps` + `defineEmits` pair the parent used to need.

```vue
<script setup lang="ts">
const model = defineModel<string>();
const firstName = defineModel<string>("firstName");

const [value, modifiers] = defineModel<string>({
  set(v) {
    return modifiers.capitalize ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  },
});
</script>
```

Full code: [examples/vue-3-5-features.md](examples/vue-3-5-features.md)

---

### Pattern 7: Template refs (3.5+)

`useTemplateRef()` looks up a ref by its string name, which is what makes it work with a dynamic name and inside a composable. A plain `ref()` matching the attribute still works for a static one.

```vue
<script setup lang="ts">
const inputRef = useTemplateRef<HTMLInputElement>("myInput");
onMounted(() => inputRef.value?.focus());
</script>
<template>
  <input ref="myInput" type="text" />
</template>
```

For a child component, `defineExpose()` declares its public surface, and the parent types the ref `InstanceType<typeof Child>`.

Full code: [examples/define-expose.md](examples/define-expose.md), [examples/vue-3-5-features.md](examples/vue-3-5-features.md)

---

### Pattern 8: useId for accessible ids (3.5+)

Generates an id that matches between server and client render, which is what a hand-rolled counter or a random string cannot do.

```vue
<script setup lang="ts">
const id = useId();
</script>
<template>
  <label :for="id">Email</label>
  <input :id="id" type="email" />
</template>
```

Each call returns a different id, so call it once per field in setup — never inside a `computed`.

Full code: [examples/vue-3-5-features.md](examples/vue-3-5-features.md)

---

### Pattern 9: Reactive props destructure (3.5+)

Destructured props stay reactive, and JavaScript default syntax replaces `withDefaults()`.

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

watch(
  () => count,
  (newCount) => {
    /* … */
  },
);
</script>
```

The compiler rewrites each reference into a prop access, so a destructured name passed as a value — to `watch`, or into a function — is just the value at that instant. Hence the getter.

Full code: [examples/vue-3-5-features.md](examples/vue-3-5-features.md)

---

### Pattern 10: Provide/inject

An `InjectionKey<T>` symbol carries the value's type from provider to consumer, so neither side casts.

```typescript
// injection-keys.ts
export const THEME_KEY: InjectionKey<ThemeContext> = Symbol("theme");

// provider
provide(THEME_KEY, { theme, toggleTheme });

// consumer
const ctx = inject(THEME_KEY);
if (!ctx) throw new Error("Must be used within ThemeProvider");
```

Full code: [examples/provide-inject.md](examples/provide-inject.md)

---

### Pattern 11: Async components and Suspense

`defineAsyncComponent` code-splits at the component boundary. A top-level `await` in `<script setup>` makes the component async, which requires a `<Suspense>` above it.

```typescript
const LOADING_DELAY_MS = 200;
const LOAD_TIMEOUT_MS = 10000;

const HeavyChart = defineAsyncComponent({
  loader: () => import("./components/heavy-chart.vue"),
  loadingComponent: LoadingSpinner,
  delay: LOADING_DELAY_MS,
  timeout: LOAD_TIMEOUT_MS,
});
```

`delay` is what stops the spinner flashing on a fast load. Errors from the boundary are caught with `onErrorCaptured`.

Full code: [examples/async.md](examples/async.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A prop assigned to — `props.count++` warns and changes nothing, because props are read-only; emit an update and let the parent own the value
- A destructured prop watched directly — `watch(count, …)` receives a number and never fires; wrap it in a getter
- A `reactive` object destructured without `toRefs()` — the copies leave the proxy and stop updating
- A `reactive` variable reassigned — the template still holds the old proxy
- Setup opened without a matching `onUnmounted` — the timer, listener or socket survives the component
- `watch` running an async request with no cleanup — a slow earlier response overwrites a fast later one; `onWatcherCleanup()` (3.5+) or the cleanup callback settles the order
- `useId()` called inside a `computed` — it mints a new id per evaluation, so the label and the input drift apart
- `provide()` with a string key — the consumer gets `unknown`, and two features can collide on the same key

**Surprising behaviour:**

- `.value` written in a template is wrong; templates unwrap refs already
- Refs nested in a `reactive` object unwrap at the root, but not inside an array, a `Map` or a `Set`
- `watchEffect` runs immediately, `watch` does not until `immediate: true`
- A `computed` is read-only unless declared with a getter and a setter
- A provided value is not reactive on its own — wrap it in `ref()` or `reactive()` if consumers should see changes
- `onUnmounted` never runs for a component that threw during setup
- `defineModel` returns a ref, so it takes `.value` in script and none in the template

</red_flags>
